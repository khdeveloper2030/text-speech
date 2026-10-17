import React from "react";
import { Download, Sparkles, AlertCircle, RefreshCw, Crown } from "lucide-react";

export default function TTSSection({
  t,
  userUsage,
  usagePercentage,
  language,
  setLanguage,
  voiceType,
  setVoiceType,
  characterStyle,
  setCharacterStyle,
  text,
  setText,
  error,
  loading,
  progress,
  handleGenerateTTS,
  handleDownload,
  audioUrl,
  setShowUpgradeModal,
  LANGUAGES,
  VOICE_TYPES,
  CHARACTER_STYLES
}) {
  const isUnlimited = userUsage.role === "admin" || userUsage.limit === -1;

  return (
    <div className="tts-card" style={{ maxWidth: "800px", margin: "24px auto", padding: "28px", background: "#ffffff", borderRadius: "16px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)" }}>
      
      <div className="usage-bar-container" style={{ marginBottom: "20px", background: "#f8fafc", padding: "14px 18px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", fontWeight: "bold", color: "#1e293b" }}>
          <span>{t.dailyUsage || "ការប្រើប្រាស់ប្រចាំថ្ងៃ"}:</span>
          <span style={{ color: isUnlimited ? "#16a34a" : "#2563eb" }}>
            {isUnlimited 
              ? `${userUsage.dailyUsed} / ♾️ (Admin Unlimited)` 
              : `${userUsage.dailyUsed} / ${userUsage.limit} ${t.chars || "តួអក្សរ"}`}
          </span>
        </div>
        {!isUnlimited && (
          <div style={{ background: "#e2e8f0", borderRadius: "10px", height: "8px", marginTop: "8px", overflow: "hidden" }}>
            <div 
              style={{ 
                width: `${usagePercentage}%`, 
                background: usagePercentage >= 90 ? "#ef4444" : "#2563eb", 
                height: "100%", 
                transition: "width 0.3s ease" 
              }} 
            />
          </div>
        )}
        {userUsage.role === "free" && (
          <div style={{ marginTop: "10px", textAlign: "right" }}>
            <button 
              onClick={() => setShowUpgradeModal(true)}
              style={{ background: "#d97706", color: "#ffffff", border: "none", padding: "5px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
            >
              <Crown size={12} /> Upgrade to VIP
            </button>
          </div>
        )}
      </div>

      <div className="options-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "18px" }}>
        <div className="option-group">
          <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "6px", color: "#475569" }}>{t.selectLanguage || "ភាសា"}</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </select>
        </div>

        <div className="option-group">
          <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "6px", color: "#475569" }}>{t.selectVoice || "ប្រភេទសំឡេង"}</label>
          <select value={voiceType} onChange={(e) => setVoiceType(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
            {VOICE_TYPES.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>

        <div className="option-group">
          <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "6px", color: "#475569" }}>{t.selectStyle || "រចនាប័ទ្ម"}</label>
          <select value={characterStyle} onChange={(e) => setCharacterStyle(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
            {CHARACTER_STYLES.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="textarea-container">
        <textarea
          rows={6}
          placeholder={t.placeholder || "បញ្ចូលអត្ថបទនៅទីនេះដើម្បីបម្លែងជាសំឡេង..."}
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "14px", resize: "vertical", boxSizing: "border-box" }}
        />
        <div style={{ textAlign: "right", fontSize: "12px", color: "#64748b", marginTop: "6px" }}>
          {text.length} {t.chars || "តួអក្សរ"} {isUnlimited && "(Admin Unlimited Input)"}
        </div>
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", padding: "12px", borderRadius: "8px", marginTop: "14px", fontSize: "13px" }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {loading && (
        <div style={{ marginTop: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "bold", color: "#2563eb", marginBottom: "6px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <RefreshCw className="spin" size={14} /> កំពុងបម្លែងសំឡេង...
            </span>
            <span>{progress}%</span>
          </div>
          <div style={{ background: "#e2e8f0", borderRadius: "10px", height: "10px", overflow: "hidden" }}>
            <div 
              style={{ 
                width: `${progress}%`, 
                background: "#2563eb", 
                height: "100%", 
                transition: "width 0.2s ease-in-out" 
              }} 
            />
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
        <button 
          onClick={handleGenerateTTS} 
          disabled={loading}
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: loading ? "#94a3b8" : "#2563eb", color: "#ffffff", padding: "14px", borderRadius: "10px", border: "none", fontWeight: "bold", fontSize: "15px", cursor: loading ? "not-allowed" : "pointer" }}
        >
          <Sparkles size={20} /> {loading ? "កំពុងដំណើរការ..." : t.generate || "បម្លែងជាសំឡេង"}
        </button>

        {audioUrl && (
          <button 
            onClick={handleDownload}
            style={{ background: "#16a34a", color: "#ffffff", border: "none", padding: "14px 24px", borderRadius: "10px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}
          >
            <Download size={18} /> {t.download || "ទាញយក"}
          </button>
        )}
      </div>

      {audioUrl && (
        <div style={{ marginTop: "22px", padding: "18px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "12px", textAlign: "center" }}>
          <h4 style={{ margin: "0 0 10px 0", color: "#15803d", fontSize: "14px" }}>🎉 រកឃើញសំឡេងដែលបានបម្លែងរួចរាល់!</h4>
          <audio controls src={audioUrl} style={{ width: "100%" }}>
            Your browser does not support audio playback.
          </audio>
        </div>
      )}
    </div>
  );
}