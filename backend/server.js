const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");
const googleTTS = require("google-tts-api"); // Kept to preserve your existing dependency/import.
const fs = require("fs");
const path = require("path");

// Initialize Firebase Admin only when credentials are available.
if (admin && admin.apps && admin.apps.length === 0) {
  try {
    const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("✅ Firebase Admin SDK Initialized!");
    } else {
      console.warn("⚠️ serviceAccountKey.json not found; Firebase Admin features are disabled.");
    }
  } catch (e) {
    console.warn("⚠️ Firebase Admin initialization failed:", e.message);
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const db = admin && admin.apps && admin.apps.length > 0 ? admin.firestore() : null;
void db; // Kept available for existing Firebase-related extensions.

// Edge TTS is a shared service and commonly returns HTTP 429 when several
// WebSocket sessions start at once. Serialize generation requests in this
// process to reduce rate-limit bursts without changing the public API.
let edgeQueue = Promise.resolve();
async function runEdgeTtsInQueue(task) {
  const previous = edgeQueue;
  let release;
  edgeQueue = new Promise(resolve => { release = resolve; });
  await previous;
  try { return await task(); }
  finally { release(); }
}
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getEdgeVoiceName(lang, voiceType, characterStyle) {
  const gender = ["man", "boy"].includes(String(voiceType || "").toLowerCase()) ? "man" : "woman";
  const language = String(lang || "km").toLowerCase();
  // Use distinct natural voices where Edge offers them. Voice gender is only
  // guaranteed for languages with an explicit male/female pair below.
  const voiceMap = {
    km: { man: "km-KH-PisethNeural", woman: "km-KH-SreymomNeural" },
    en: {
      man: characterStyle === "news" ? "en-US-ChristopherNeural" : "en-US-GuyNeural",
      woman: characterStyle === "story" ? "en-US-JennyNeural" : "en-US-AriaNeural"
    },
    fr: { man: "fr-FR-HenriNeural", woman: "fr-FR-DeniseNeural" },
    ja: { man: "ja-JP-KeitaNeural", woman: "ja-JP-NanamiNeural" },
    zh: { man: "zh-CN-YunxiNeural", woman: "zh-CN-XiaoxiaoNeural" },
    "zh-cn": { man: "zh-CN-YunxiNeural", woman: "zh-CN-XiaoxiaoNeural" },
    th: { man: "th-TH-NiwatNeural", woman: "th-TH-PremwadeeNeural" },
    vi: { man: "vi-VN-NamMinhNeural", woman: "vi-VN-HoaiMyNeural" },
    es: { man: "es-ES-AlvaroNeural", woman: "es-ES-ElviraNeural" },
    de: { man: "de-DE-ConradNeural", woman: "de-DE-KatjaNeural" },
    it: { man: "it-IT-DiegoNeural", woman: "it-IT-ElsaNeural" },
    pt: { man: "pt-BR-AntonioNeural", woman: "pt-BR-FranciscaNeural" }
  };
  const pair = voiceMap[language] || voiceMap.km;
  return pair[gender];
}

// Style is applied through prosody-like text pacing plus voice choice.
// msedge-tts's public toStream API accepts text rather than a guaranteed
// arbitrary-SSML contract, so do not inject unverified SSML tags.
function applyReadingStyle(text, style) {
  const clean = String(text || "").trim();
  if (style === "news") {
    // News copy benefits from clear, short clauses and explicit pauses.
    return clean
      .replace(/([,;:])\s*/g, "$1 ")
      .replace(/([.!?។])\s*/g, "$1 ");
  }
  if (style === "story") {
    // Slightly more expressive punctuation/pacing without altering words.
    return clean
      .replace(/([.!?។])\s*/g, "$1 … ")
      .replace(/,\s*/g, ", ");
  }
  return clean;
}

function splitTextIntoChunks(text, maxLength = 200) {
  const source = String(text || "");
  const chunks = [];
  let remaining = source.trim();
  while (remaining.length > maxLength) {
    let cut = remaining.lastIndexOf(" ", maxLength);
    if (cut < Math.floor(maxLength * 0.55)) cut = maxLength;
    const chunk = remaining.slice(0, cut).trim();
    if (chunk) chunks.push(chunk);
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

async function generateSingleEdgeChunk(textChunk, voiceName, retries = 4) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const escapedText = textChunk
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const { audioStream } = await tts.toStream(escapedText);
      const chunks = [];

      const buffer = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("MsEdgeTTS stream timeout")), 20000);
        audioStream.on("data", chunk => chunks.push(chunk));
        audioStream.on("end", () => {
          clearTimeout(timeout);
          resolve(Buffer.concat(chunks));
        });
        audioStream.on("error", err => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      if (!buffer.length) throw new Error("Empty audio response from Edge TTS.");
      return buffer;
    } catch (err) {
      const message = String(err?.message || err || "Edge TTS error");
      const rateLimited = /\b429\b|too many requests|unexpected server response/i.test(message);
      console.warn(`MsEdgeTTS attempt ${attempt}/${retries} failed${rateLimited ? " (rate limited)" : ""}:`, message);
      if (attempt === retries) throw err;
      // Give Edge TTS time to release the rate limit. Do not hammer it with
      // rapid retries; 429 responses need a longer exponential cooldown.
      await sleep(rateLimited ? Math.min(15000, 2000 * (2 ** (attempt - 1))) : 1000 * attempt);
    }
  }
}

app.get("/health", (_req, res) => {
  res.json({ success: true, service: "text-speech-node" });
});

// Sends approval confirmation email using backend-only SMTP credentials.
app.post("/api/payment-approved-email", async (req, res) => {
  const { email, packageName, amount } = req.body || {};
  if (!email || !String(email).includes("@")) return res.status(400).json({ success: false, error: "Valid recipient email required." });
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return res.status(503).json({ success: false, error: "Email service is not configured on the backend." });
  try {
    const nodemailer = require("nodemailer");
    const port = Number(SMTP_PORT || 587);
    const transporter = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
    await transporter.sendMail({ from: SMTP_FROM || SMTP_USER, to: String(email), subject: "Khmer TTS Studio — Payment approved", text: `Your payment has been approved.\n\nPlan: ${String(packageName || "VIP")}\nAmount: $${Number(amount || 0).toFixed(2)}\n\nYour VIP access is now active. Thank you for using Khmer TTS Studio.` });
    return res.json({ success: true, sent: true });
  } catch (err) { console.error("Approval email failed:", err.message); return res.status(502).json({ success: false, error: "Could not send approval email. Check SMTP and nodemailer." }); }
});

// Main TTS API. Existing route shape and standard Edge TTS fallback are preserved.
app.post("/api/tts", async (req, res) => {
  try {
    const { text, lang = "km", voiceType = "woman", characterStyle = "general" } = req.body || {};
    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ success: false, error: "សូមបញ្ចូលអត្ថបទ!" });
    }

    const cleanText = text.trim();
    const normalizedLang = String(lang || "km").toLowerCase();
    const styledText = applyReadingStyle(cleanText, characterStyle);
    const voiceName = getEdgeVoiceName(normalizedLang, voiceType, characterStyle);
    const textChunks = splitTextIntoChunks(styledText, 200);
    const combinedBuffer = await runEdgeTtsInQueue(async () => {
      console.log(`🔊 Running Standard Edge TTS (${textChunks.length} chunk${textChunks.length === 1 ? "" : "s"})...`);
      const audioBuffers = [];
      for (let index = 0; index < textChunks.length; index++) {
        audioBuffers.push(await generateSingleEdgeChunk(textChunks[index], voiceName));
        if (index < textChunks.length - 1) await sleep(350);
      }
      return Buffer.concat(audioBuffers);
    });
    if (!combinedBuffer.length) throw new Error("Edge TTS returned an empty audio file.");

    return res.json({
      success: true,
      audioUrl: `data:audio/mp3;base64,${combinedBuffer.toString("base64")}`,
      audioType: "audio/mp3",
      usage: { dailyUsed: cleanText.length, limit: 10000 }
    });
  } catch (err) {
    console.error("❌ General TTS API Error:", err);
    return res.status(500).json({
      success: false,
      error: "មានបញ្ហាក្នុងការបង្កើតសំឡេង។ សូមព្យាយាមម្ដងទៀត។",
      details: process.env.NODE_ENV === "development" ? err.message : undefined
    });
  }
});

const PORT = Number(process.env.PORT) || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Node.js Express Server running on http://localhost:${PORT}`);
});
