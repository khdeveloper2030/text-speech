import React from "react";
import { Download, RefreshCw, AlertCircle } from "lucide-react";

export default function TTSSection({
  t, appLang = "km", userUsage, usagePercentage, language, setLanguage, voiceType, setVoiceType,
  characterStyle, setCharacterStyle, text, setText, error, loading, progress,
  handleGenerateTTS, handleDownload, audioUrl, LANGUAGES,
  VOICE_TYPES, CHARACTER_STYLES
}) {
  const isUnlimited = userUsage.role === "admin" || userUsage.limit === -1;
  const formatDateDMY = (value) => {
    if (!value) return "—";
    const raw = String(value);
    const match = raw.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);
    const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
    if (Number.isNaN(date.getTime())) return raw;
    return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
  };

  return (
    <div className="tts-card" style={{ maxWidth: "800px", margin: "24px auto", padding: "28px", background: "#ffffff", borderRadius: "16px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)" }}>
      
      {/* 1. Cumulative plan allowance meter: successful generation adds characters to used total. */}
      <div className="usage-container" style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "8px", fontSize: "14px", fontWeight: "bold" }}>
          <span>{t.characters || "Characters used / allowance"}</span>
          <span>{isUnlimited ? (t.unlimited || "Unlimited") : `${Number(userUsage.dailyUsed || 0).toLocaleString()} / ${Number(userUsage.limit).toLocaleString()}`}</span>
        </div>
        {userUsage.vipExpiresAt && (() => {
          const expiry = new Date(userUsage.vipExpiresAt);
          const validExpiry = !Number.isNaN(expiry.getTime());
          return validExpiry ? (
            <div style={{ marginBottom: "10px", fontSize: "13px", color: expiry < new Date() ? "#dc2626" : "#475569" }}>
              {t.planDeadline || (appLang === "km" ? "ថ្ងៃផុតកំណត់គម្រោង៖" : "Plan expiration:")} {formatDateDMY(userUsage.vipExpiresAt)}
            </div>
          ) : null;
        })()}
        {!isUnlimited && (
          <div style={{ width: "100%", height: "8px", background: "#e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, (Number(userUsage.dailyUsed || 0) / Math.max(1, userUsage.limit)) * 100)}%`, height: "100%", background: Number(userUsage.dailyUsed || 0) >= userUsage.limit ? "#ef4444" : "#2563eb", transition: "width 0.3s" }} />
          </div>
        )}
      </div>



      {/* 2. Language, voice and reading-style options */}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <div>
          <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "bold" }}>🌍 {t.selectLang || "Select language"}</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {t.selectLang && t.selectLang.toLowerCase().includes("select")
                  ? ({ km: "Khmer", en: "English", fr: "French", ja: "Japanese", zh: "Chinese", th: "Thai", vi: "Vietnamese" }[lang.code] || lang.name)
                  : ({ km: "ខ្មែរ", en: "អង់គ្លេស", fr: "បារាំង", ja: "ជប៉ុន", zh: "ចិន", th: "ថៃ", vi: "វៀតណាម" }[lang.code] || lang.name)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "bold" }}>👤 {t.voiceType || "Voice type"}</label>
          <select value={voiceType} onChange={(e) => setVoiceType(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
            {VOICE_TYPES.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.id === "woman" ? (t.woman || voice.name) : (t.man || voice.name)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "bold" }}>🎭 {t.readingStyle || "Reading style"}</label>
          <select value={characterStyle} onChange={(e) => setCharacterStyle(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
            {CHARACTER_STYLES.map((style) => (
              <option key={style.id} value={style.id}>
                {style.id === "general" ? (t.general || style.name) : style.id === "news" ? (t.news || style.name) : (t.story || style.name)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Voice cloning option removed; standard TTS controls remain. */}

      {/* 4. កន្លែងវាយអត្ថបទ (Textarea) */}
      <div className="textarea-container" style={{ marginBottom: "20px" }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.placeholder || "សូមបញ្ចូលអត្ថបទរបស់អ្នកនៅទីនេះ..."}
          style={{ width: "100%", height: "150px", padding: "16px", borderRadius: "12px", border: "1px solid #cbd5e1", fontSize: "15px", resize: "vertical" }}
        />
        <div style={{ textAlign: "right", fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
          {t.characters || "Characters"}: {text.length}
        </div>
      </div>

      {/* 5. បង្ហាញ Error */}
      {error && (
        <div style={{ padding: "12px", marginBottom: "20px", background: "#fef2f2", color: "#ef4444", borderRadius: "8px", display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* 6. ប៊ូតុង Generate និង Progress Bar */}
      <button 
        onClick={handleGenerateTTS} 
        disabled={loading}
        style={{ width: "100%", padding: "14px", background: loading ? "#94a3b8" : "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontSize: "16px", fontWeight: "bold", cursor: loading ? "not-allowed" : "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}
      >
        {loading ? (
          <>
            <RefreshCw size={20} className="spin" /> {t.generating || "Generating..."}
          </>
        ) : (
          t.generateBtn || "Generate speech"
        )}
      </button>

      {loading && (
        <div style={{ marginTop: "16px", width: "100%", height: "6px", background: "#e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
          <div style={{ width: `${progress}%`, height: "100%", background: "#10b981", transition: "width 0.2s" }} />
        </div>
      )}

      {/* 7. លទ្ធផលសំឡេង និងប៊ូតុងទាញយក */}
      {audioUrl && !loading && (
        <div className="result-container" style={{ marginTop: "24px", padding: "20px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "16px" }}>🔊 {t.outputTitle || "Generated audio"}</h3>
          <audio src={audioUrl} controls style={{ width: "100%", marginBottom: "16px" }} />
          <button 
            onClick={handleDownload}
            style={{ width: "100%", padding: "12px", background: "#10b981", color: "#fff", border: "none", borderRadius: "8px", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: "bold" }}
          >
            <Download size={18} /> {t.download || "Download file"}
          </button>
        </div>
      )}
    </div>
  );
}