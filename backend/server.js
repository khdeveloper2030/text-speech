const express = require("express");
const cors = require("cors");
// Use the supported modular Firebase Admin API (works with current firebase-admin versions).
const firebaseAdminApp = require("firebase-admin/app");
const firebaseAdminAuth = require("firebase-admin/auth");
const firebaseAdminFirestore = require("firebase-admin/firestore");
const firebaseAdminStorage = require("firebase-admin/storage");

// Use the modular API supported by current firebase-admin releases.
let firebaseAdminInstance = null;
function getFirebaseAdminApps() {
  return firebaseAdminApp.getApps();
}
function getFirebaseAuth() {
  if (!firebaseAdminInstance) throw new Error("Firebase Admin is not initialized.");
  return firebaseAdminAuth.getAuth(firebaseAdminInstance);
}
function getFirebaseFirestore() {
  if (!firebaseAdminInstance) throw new Error("Firebase Admin is not initialized.");
  return firebaseAdminFirestore.getFirestore(firebaseAdminInstance);
}
// Use Python edge-tts for Microsoft's current Edge TTS token protocol.
// Install locally with: py -m pip install --upgrade edge-tts==7.3.1
const { spawn } = require("child_process");
const os = require("os");
const googleTTS = require("google-tts-api"); // Kept to preserve your existing dependency/import.
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { google } = require("googleapis");

// Payment receipt uploads are limited to common image formats and PDF, up to 10 MB.
const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
    if (!allowed.has(String(file.mimetype || "").toLowerCase())) {
      return cb(new Error("Receipt must be a JPG, PNG, WEBP, or PDF file."));
    }
    cb(null, true);
  }
});

const RECEIPT_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_RECEIPTS_FOLDER_ID || "1i5_D4-ChqiyfvUyTn1YQPa0oTbaAq4Gd";

function getDriveAuth() {
  let credentials;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    credentials = require(path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS));
  } else {
    const driveKeyPath = path.join(__dirname, "tts-drive-uploader.json");
    const legacyPath = path.join(__dirname, "serviceAccountKey.json");
    if (fs.existsSync(driveKeyPath)) credentials = require(driveKeyPath);
    else if (fs.existsSync(legacyPath)) credentials = require(legacyPath);
  }
  if (!credentials || !credentials.client_email || !credentials.private_key) {
    throw new Error("Google Drive credentials not configured. Add backend/tts-drive-uploader.json or set GOOGLE_APPLICATION_CREDENTIALS.");
  }
  return new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/drive"] });
}

// Initialize Firebase Admin using the modular API.
function initializeFirebaseAdmin() {
  try {
    if (getFirebaseAdminApps().length > 0) {
      firebaseAdminInstance = getFirebaseAdminApps()[0];
      console.log("✅ Firebase Admin SDK already initialized.");
      return true;
    }

    let serviceAccount = null;
    const envJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const localPath = path.join(__dirname, "serviceAccountKey.json");

    if (envJson) {
      serviceAccount = JSON.parse(envJson);
    } else {
      const credentialPath = envPath ? path.resolve(envPath) : localPath;
      if (fs.existsSync(credentialPath)) {
        serviceAccount = JSON.parse(fs.readFileSync(credentialPath, "utf8"));
      } else {
        console.error(`❌ Firebase credentials file not found: ${credentialPath}`);
      }
    }

    if (!serviceAccount || serviceAccount.type !== "service_account" ||
        !serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      console.error("❌ Firebase credentials are missing or invalid. Check backend/serviceAccountKey.json.");
      return false;
    }

    // Initialize with storageBucket option derived from project_id if not explicitly set
    const defaultBucketName = `${serviceAccount.project_id}.appspot.com`;
    firebaseAdminInstance = firebaseAdminApp.initializeApp({
      credential: firebaseAdminApp.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || defaultBucketName
    });
    console.log(`✅ Firebase Admin SDK initialized for project: ${serviceAccount.project_id}`);
    return true;
  } catch (error) {
    console.error("❌ Firebase Admin initialization failed:", error.message);
    return false;
  }
}

const firebaseAdminReady = initializeFirebaseAdmin();

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const db = firebaseAdminReady ? getFirebaseFirestore() : null;
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

function applyReadingStyle(text, style) {
  const clean = String(text || "").trim();
  if (style === "news") {
    return clean
      .replace(/([,;:])\s*/g, "$1 ")
      .replace(/([.!?។])\s*/g, "$1 ");
  }
  if (style === "story") {
    return clean
      .replace(/([.!?។])\s*/g, "$1 … ")
      .replace(/,\s*/g, ", ");
  }
  return clean;
}

function splitTextIntoChunks(text, maxLength = 800) {
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

// Run Python edge-tts as a child process. This avoids the outdated v1 token
// implementation in the old msedge-tts Node package that can return HTTP 403.
function getPythonCommand() {
  if (process.env.PYTHON_EXECUTABLE) return process.env.PYTHON_EXECUTABLE;
  return process.platform === "win32" ? "py" : "python3";
}

async function generateSingleEdgeChunk(textChunk, voiceName, retries = 3) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "khmer-tts-"));
  const outputPath = path.join(tempDir, `speech-${Date.now()}-${Math.random().toString(16).slice(2)}.mp3`);
  let lastError;

  try {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const audio = await new Promise((resolveAttempt, rejectAttempt) => {
          const pythonCommand = getPythonCommand();
          const args = [
            "-m", "edge_tts",
            "--voice", voiceName,
            "--text", textChunk,
            "--write-media", outputPath
          ];

          console.log(`🐍 Python Edge TTS attempt ${attempt}/${retries} (${voiceName})...`);
          const child = spawn(pythonCommand, args, {
            windowsHide: true,
            stdio: ["ignore", "ignore", "pipe"]
          });

          let stderr = "";
          let settled = false;
          const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            child.kill();
            rejectAttempt(new Error("Python Edge TTS timed out after 90000 ms."));
          }, 90000);

          child.stderr.on("data", data => {
            stderr += data.toString();
            if (stderr.length > 12000) stderr = stderr.slice(-12000);
          });

          child.on("error", err => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            if (err.code === "ENOENT") {
              rejectAttempt(new Error(
                `Python executable "${pythonCommand}" was not found. Install Python and edge-tts, or set PYTHON_EXECUTABLE.`
              ));
            } else {
              rejectAttempt(err);
            }
          });

          child.on("close", code => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);

            if (code !== 0) {
              rejectAttempt(new Error(
                `Python edge-tts exited with code ${code}. ${stderr.trim() || "No diagnostic output."}`
              ));
              return;
            }

            try {
              if (!fs.existsSync(outputPath)) {
                rejectAttempt(new Error("Python edge-tts finished but did not create an MP3 file."));
                return;
              }
              const audioBuffer = fs.readFileSync(outputPath);
              if (!audioBuffer.length) {
                rejectAttempt(new Error("Python edge-tts created an empty MP3 file."));
                return;
              }
              resolveAttempt(audioBuffer);
            } catch (readErr) {
              rejectAttempt(readErr);
            }
          });
        });

        return audio;
      } catch (err) {
        lastError = err;
        const message = String(err?.message || err || "Python Edge TTS error");
        console.warn(`Python Edge TTS attempt ${attempt}/${retries} failed:`, message);
        if (attempt >= retries || /\b403\b|forbidden|token/i.test(message)) break;
        await sleep(Math.min(5000, 1000 * attempt));
      }
    }

    throw lastError || new Error("Python edge-tts failed.");
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.warn("Could not clean temporary TTS files:", cleanupErr.message);
    }
  }
}

app.get("/health", (_req, res) => {
  res.json({ success: true, service: "text-speech-node" });
});

// Upload a receipt to Firebase Storage using Firebase Admin SDK.
app.post("/api/payment-receipt", async (req, res) => {
  const authHeader = String(req.headers.authorization || "");
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) return res.status(401).json({ success: false, error: "Please sign in again before uploading a receipt." });
  
  if (!firebaseAdminReady) {
    return res.status(503).json({ success: false, error: "Firebase Admin is not configured." });
  }

  try {
    const decoded = await getFirebaseAuth().verifyIdToken(tokenMatch[1]);
    receiptUpload.single("receipt")(req, res, async (uploadErr) => {
      if (uploadErr) return res.status(400).json({ success: false, error: uploadErr.message || "Invalid receipt file." });
      if (!req.file) return res.status(400).json({ success: false, error: "Receipt file is required." });
      
      try {
        // ប្រើប្រាស់ Firebase Admin Storage bucket យ៉ាងត្រឹមត្រូវ
        const bucket = firebaseAdminStorage.getStorage(firebaseAdminInstance).bucket();

        const safeName = String(req.file.originalname || "receipt").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
        const fileName = `receipts/${decoded.uid}_${Date.now()}_${safeName}`;
        const fileRef = bucket.file(fileName);

        // Upload Buffer ចូលទៅ Firebase Storage ផ្ទាល់
        await fileRef.save(req.file.buffer, {
          metadata: { contentType: req.file.mimetype }
        });

        // ព្យាយាមធ្វើឱ្យឯកសារអាចមើលជាសាធារណៈបាន
        try {
          await fileRef.makePublic();
        } catch (e) {
          console.warn("Could not make file public directly:", e.message);
        }

        const receiptUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

        return res.status(201).json({ success: true, receiptUrl, fileName, mimeType: req.file.mimetype });
      } catch (storageErr) {
        console.error("Firebase Storage receipt upload failed:", storageErr.message);
        return res.status(502).json({ success: false, error: `Firebase Storage upload failed: ${storageErr.message}` });
      }
    });
  } catch (err) {
    console.error("Receipt upload authentication failed:", err.message);
    return res.status(401).json({ success: false, error: "Could not verify your login. Please sign in again." });
  }
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
    const textChunks = splitTextIntoChunks(styledText, 800);
    const combinedBuffer = await runEdgeTtsInQueue(async () => {
      console.log(`🔊 Running Python Edge TTS 7.3.1 (${textChunks.length} chunk${textChunks.length === 1 ? "" : "s"})...`);
      const audioBuffers = [];
      for (let index = 0; index < textChunks.length; index++) {
        audioBuffers.push(await generateSingleEdgeChunk(textChunks[index], voiceName));
        if (index < textChunks.length - 1) await sleep(100);
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
    console.error("❌ General TTS API Error:", err?.message || err);
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