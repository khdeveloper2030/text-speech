// import React, { useEffect, useState } from "react";

// const LANGUAGES = [
//   ["en", "English"],
//   ["es", "Spanish"],
//   ["fr", "French"],
//   ["de", "German"],
//   ["it", "Italian"],
//   ["pt", "Portuguese"],
//   ["zh-cn", "Chinese (Simplified)"],
//   ["ja", "Japanese"],
//   ["ko", "Korean"],
//   ["hi", "Hindi"],
//   ["ar", "Arabic"],
//   ["ru", "Russian"],
//   ["tr", "Turkish"],
//   ["pl", "Polish"],
//   ["nl", "Dutch"],
//   ["cs", "Czech"],
//   ["hu", "Hungarian"]
// ];

// export default function VoiceCloner() {
//   const [text, setText] = useState("");
//   const [language, setLanguage] = useState("en");
//   const [audioFile, setAudioFile] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [generatedAudioUrl, setGeneratedAudioUrl] = useState(null);
//   const [errorMsg, setErrorMsg] = useState("");
//   const [health, setHealth] = useState("checking");

//   useEffect(() => {
//     let active = true;
//     fetch("http://127.0.0.1:8000/health")
//       .then(response => {
//         if (!response.ok) throw new Error("Python server is not ready");
//         return response.json();
//       })
//       .then(() => active && setHealth("online"))
//       .catch(() => active && setHealth("offline"));
//     return () => {
//       active = false;
//       if (generatedAudioUrl) URL.revokeObjectURL(generatedAudioUrl);
//     };
//   }, [generatedAudioUrl]);

//   const handleFileChange = (event) => {
//     const file = event.target.files && event.target.files[0];
//     setAudioFile(file || null);
//     setErrorMsg("");
//   };

//   const handleGenerate = async () => {
//     if (!text.trim()) {
//       setErrorMsg("សូមបញ្ចូលអត្ថបទជាមុនសិន។");
//       return;
//     }
//     if (!audioFile) {
//       setErrorMsg("សូមជ្រើសរើសសំឡេងគំរូជាមុនសិន។");
//       return;
//     }

//     setLoading(true);
//     setErrorMsg("");
//     if (generatedAudioUrl) URL.revokeObjectURL(generatedAudioUrl);
//     setGeneratedAudioUrl(null);

//     const formData = new FormData();
//     formData.append("text", text.trim());
//     formData.append("language", language);
//     formData.append("speaker_wav", audioFile, audioFile.name);

//     try {
//       const response = await fetch("http://127.0.0.1:8000/generate-voice", {
//         method: "POST",
//         body: formData
//       });

//       if (!response.ok) {
//         let message = "ការបង្កើតសំឡេងបរាជ័យ។";
//         try {
//           const data = await response.json();
//           if (data && data.detail) message = data.detail;
//         } catch (_error) {
//           // Keep fallback message if server didn't return JSON.
//         }
//         throw new Error(message);
//       }

//       const blob = await response.blob();
//       if (!blob.size) throw new Error("Server បានបញ្ជូនឯកសារសំឡេងទទេ។");
//       setGeneratedAudioUrl(URL.createObjectURL(blob));
//     } catch (error) {
//       console.error("Voice cloning error:", error);
//       setErrorMsg(
//         error.message && error.message !== "Failed to fetch"
//           ? error.message
//           : "មិនអាចតភ្ជាប់ទៅ Python Server បានទេ។ សូមពិនិត្យថា main.py កំពុងដំណើរការនៅ Port 8000។"
//       );
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div style={{ maxWidth: 650, margin: "40px auto", padding: 24, border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff" }}>
//       <h2>AI Voice Cloning (Coqui XTTS v2)</h2>
//       <p style={{ color: health === "online" ? "#15803d" : health === "offline" ? "#b91c1c" : "#64748b" }}>
//         Python server: {health === "online" ? "Online" : health === "offline" ? "Offline" : "Checking..."}
//       </p>

//       <div style={{ marginBottom: 16 }}>
//         <label htmlFor="clone-language">ភាសា (Language)</label>
//         <select id="clone-language" value={language} onChange={e => setLanguage(e.target.value)} style={{ display: "block", width: "100%", padding: 9, marginTop: 6 }}>
//           {LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
//         </select>
//       </div>

//       <div style={{ marginBottom: 16 }}>
//         <label htmlFor="clone-text" style={{ display: "block", marginBottom: 6 }}>អត្ថបទដែលត្រូវនិយាយ</label>
//         <textarea id="clone-text" rows={5} value={text} onChange={e => setText(e.target.value)} placeholder="Type the text to speak..." style={{ width: "100%", padding: 10, boxSizing: "border-box" }} />
//       </div>

//       <div style={{ marginBottom: 18 }}>
//         <label htmlFor="clone-audio" style={{ display: "block", marginBottom: 6 }}>សំឡេងគំរូ (WAV / MP3)</label>
//         <input id="clone-audio" type="file" accept="audio/wav,audio/x-wav,audio/mpeg,audio/mp3,audio/*" onChange={handleFileChange} />
//         {audioFile && <p style={{ fontSize: 13, color: "#475569" }}>បានជ្រើសរើស៖ {audioFile.name}</p>}
//       </div>

//       <button onClick={handleGenerate} disabled={loading} style={{ padding: "11px 18px", background: loading ? "#94a3b8" : "#2563eb", color: "#fff", border: 0, borderRadius: 6, cursor: loading ? "not-allowed" : "pointer" }}>
//         {loading ? "កំពុងបង្កើតសំឡេង..." : "Generate Cloned Voice"}
//       </button>

//       {errorMsg && <div role="alert" style={{ marginTop: 16, padding: 12, color: "#b91c1c", background: "#fef2f2", borderRadius: 6 }}>{errorMsg}</div>}

//       {generatedAudioUrl && (
//         <div style={{ marginTop: 22, padding: 16, background: "#f0f9ff", borderRadius: 8 }}>
//           <h3>លទ្ធផលសំឡេង</h3>
//           <audio controls src={generatedAudioUrl} style={{ width: "100%" }} />
//           <p><a href={generatedAudioUrl} download="cloned_voice.wav">ទាញយក WAV</a></p>
//         </div>
//       )}
//       <p style={{ marginTop: 16, fontSize: 12, color: "#64748b" }}>
//         ចំណាំ៖ XTTS v2 មិនគាំទ្រភាសាខ្មែរទេ។ សម្រាប់ Khmer សូមប្រើ Standard TTS ដែលគ្មាន Audio Sample។
//       </p>
//     </div>
//   );
// }
