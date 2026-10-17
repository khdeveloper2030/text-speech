const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");
const googleTTS = require("google-tts-api");

if (admin && admin.apps && admin.apps.length === 0) {
  try {
    const serviceAccount = require("./serviceAccountKey.json");
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("✅ Firebase Admin SDK Initialized!");
  } catch (e) {
    console.warn("⚠️ Firebase Admin serviceAccountKey.json មិនបានស្វែងរកឃើញ៖", e.message);
  }
}

const app = express();
app.use(cors());
app.use(express.json());

const db = (admin && admin.apps && admin.apps.length > 0) ? admin.firestore() : null;

function getEdgeVoiceName(lang, voiceType) {
  if (lang === "km") {
    return voiceType === "man" || voiceType === "boy" 
      ? "km-KH-PisethNeural" 
      : "km-KH-SreymomNeural";
  } else if (lang === "en") {
    return voiceType === "man" || voiceType === "boy" 
      ? "en-US-GuyNeural" 
      : "en-US-AriaNeural";
  } else if (lang === "fr") {
    return "fr-FR-DeniseNeural";
  } else if (lang === "ja") {
    return "ja-JP-NanamiNeural";
  } else if (lang === "zh") {
    return "zh-CN-XiaoxiaoNeural";
  } else if (lang === "th") {
    return "th-TH-PremwadeeNeural";
  } else if (lang === "vi") {
    return "vi-VN-HoaiMyNeural";
  }
  return "km-KH-SreymomNeural";
}

function splitTextIntoChunks(text, maxLength = 200) {
  const sentences = text.match(/[^.!?។\n]+[.!?។\n]*/g) || [text];
  const chunks = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxLength) {
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  return chunks;
}

async function generateSingleEdgeChunk(textChunk, voiceName, retries = 3) {
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
        const timeout = setTimeout(() => {
          reject(new Error("Edge TTS Stream Timeout"));
        }, 12000);

        audioStream.on("data", (c) => chunks.push(c));
        audioStream.on("close", () => {
          clearTimeout(timeout);
          resolve(Buffer.concat(chunks));
        });
        audioStream.on("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      if (buffer && buffer.length > 0) return buffer;
    } catch (err) {
      console.warn(`Edge TTS attempt ${attempt} failed: ${err.message}`);
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 800));
    }
  }
}

async function generateEdgeTTSWithChunking(text, voiceName) {
  const chunks = splitTextIntoChunks(text, 180);
  const audioBuffers = [];

  for (const chunk of chunks) {
    const buf = await generateSingleEdgeChunk(chunk, voiceName);
    audioBuffers.push(buf);
  }

  return Buffer.concat(audioBuffers);
}

async function generateGoogleTTSFallback(text, lang = "km") {
  try {
    const base64Audio = await googleTTS.getAudioBase64(text, {
      lang: lang === "km" ? "km" : lang,
      slow: false,
      host: "https://translate.google.com",
      timeout: 10000,
    });
    return Buffer.from(base64Audio, "base64");
  } catch (err) {
    console.error("Google TTS Fallback failed:", err.message);
    throw err;
  }
}

// 🎯 API Synthesize Speech
app.post("/api/tts", async (req, res) => {
  const { text, lang = "km", voiceType = "woman", idToken } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ success: false, error: "សូមបញ្ចូលអត្ថបទជាមុនសិន!" });
  }

  let userEmail = "";
  let userUid = "";

  if (idToken && admin && admin.apps && admin.apps.length > 0) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      userUid = decodedToken.uid;
      userEmail = decodedToken.email ? decodedToken.email.toLowerCase().trim() : "";
    } catch (e) {
      console.warn("Invalid Firebase ID Token:", e.message);
    }
  }

  let role = "free";
  let limit = 200;
  let dailyUsed = 0;
  let targetUserRef = null;

  if (db && (userUid || userEmail)) {
    try {
      let userSnap = null;
      
      // 1. ស្វែងរក Document តាម UID
      if (userUid) {
        userSnap = await db.collection("Users").doc(userUid).get();
      }

      // 2. បើរកមិនឃើញ ស្វែងរកតាម Email 
      if ((!userSnap || !userSnap.exists) && userEmail) {
        const emailDocSnap = await db.collection("Users").doc(userEmail).get();
        if (emailDocSnap.exists) {
          userSnap = emailDocSnap;
        } else {
          const querySnap = await db.collection("Users").where("email", "==", userEmail).get();
          if (!querySnap.empty) {
            userSnap = querySnap.docs[0];
          }
        }
      }

      if (userSnap && userSnap.exists) {
        targetUserRef = userSnap.ref;
        const userData = userSnap.data();
        role = userData.role || "free";
        dailyUsed = Number(userData.dailyUsed || 0);

        const parsedLimit = Number(userData.dailyLimit);

        if (role === "admin" || userEmail === "seyhaemdev@gmail.com") {
          role = "admin";
          limit = -1;
        } else if (role === "vip") {
          limit = (!isNaN(parsedLimit) && parsedLimit > 200) ? parsedLimit : 10000;
        } else if (!isNaN(parsedLimit) && parsedLimit > 0) {
          limit = parsedLimit;
        } else {
          limit = 200;
        }
      } else if (userEmail === "seyhaemdev@gmail.com") {
        role = "admin";
        limit = -1;
      }
    } catch (dbErr) {
      console.error("Error reading Firestore user in backend:", dbErr.message);
    }
  }

  const charCount = text.trim().length;

  if (limit !== -1 && (dailyUsed + charCount) > limit) {
    return res.status(403).json({
      success: false,
      limitExceeded: true,
      error: `អ្នកបានប្រើប្រាស់អស់ដែនកំណត់ប្រចាំថ្ងៃហើយ! (${dailyUsed + charCount}/${limit} តួអក្សរ)។ សូមទាក់ទងដំឡើងទៅ VIP ដើម្បីប្រើប្រាស់បន្ថែម!`,
      usage: { role, dailyUsed, limit }
    });
  }

  const voiceName = getEdgeVoiceName(lang, voiceType);
  let audioBuffer;

  try {
    audioBuffer = await generateEdgeTTSWithChunking(text, voiceName);
  } catch (edgeErr) {
    console.warn("Edge TTS Chunking Failed. Fallback to Google TTS...", edgeErr.message);
    try {
      audioBuffer = await generateGoogleTTSFallback(text, lang);
    } catch (googleErr) {
      return res.status(500).json({ 
        success: false, 
        error: "មិនអាចបង្កើតសំឡេងបានទេ!" 
      });
    }
  }

  const newDailyUsed = dailyUsed + charCount;

  // 🔑 បូកបន្ថែមចំនួន dailyUsed ចូលទៅក្នុង Firestore ដោយប្រើ FieldValue.increment
  if (targetUserRef) {
    try {
      await targetUserRef.set({
        email: userEmail,
        role: role,
        dailyLimit: limit,
        dailyUsed: admin.firestore.FieldValue.increment(charCount),
        lastUsedDate: new Date().toISOString().split("T")[0]
      }, { merge: true });
    } catch (updateErr) {
      console.error("Failed to update dailyUsed in Firestore:", updateErr.message);
    }
  }

  const base64Audio = `data:audio/mp3;base64,${audioBuffer.toString("base64")}`;
  res.json({
    success: true,
    audioUrl: base64Audio,
    usage: {
      role,
      dailyUsed: newDailyUsed, // ផ្ញើ 12 តួអក្សរត្រឡប់ទៅ Frontend វិញ
      limit: role === "admin" ? -1 : limit
    }
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));