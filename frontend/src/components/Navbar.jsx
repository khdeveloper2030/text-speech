import React from "react";
import { LogIn, LogOut, Volume2, Shield, User, ShieldCheck, Crown } from "lucide-react";

export default function Navbar({ 
  user, 
  isAdmin, 
  currentTab, 
  setCurrentTab, 
  appLang, 
  setAppLang, 
  t, 
  userUsage = { role: "free" }, 
  handleLogin, 
  logout, 
  isLoggingIn 
}) {
  return (
    <header className="header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", padding: "14px 24px", background: "#ffffff", borderBottom: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
      <div className="logo" style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "fit-content" }}>
        <div style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)", padding: "8px", borderRadius: "10px", color: "#ffffff", display: "flex", alignItems: "center" }}>
          <Volume2 size={20} />
        </div>
        <h1 style={{ fontSize: "1.25rem", margin: 0, fontWeight: "800", color: "#0f172a", letterSpacing: "-0.02em" }}>
          {t.title || "Khmer TTS Pro"}
        </h1>
      </div>

      <div className="header-right" style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: "fit-content" }}>
        
{/*       
        {isAdmin && user && (
          <div style={{ display: "flex", background: "#f1f5f9", borderRadius: "8px", padding: "3px", border: "1px solid #cbd5e1" }}>
            <button 
              onClick={() => setCurrentTab("user")}
              style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "6px", 
                background: currentTab === "user" ? "#2563eb" : "transparent", 
                color: currentTab === "user" ? "#ffffff" : "#475569", 
                border: "none", 
                padding: "6px 12px", 
                borderRadius: "6px", 
                cursor: "pointer", 
                fontSize: "12px", 
                fontWeight: "bold" 
              }}
            >
              <User size={14} /> Normal UI
            </button>
            <button 
              onClick={() => setCurrentTab("admin")}
              style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "6px", 
                background: currentTab === "admin" ? "#dc2626" : "transparent", 
                color: currentTab === "admin" ? "#ffffff" : "#475569", 
                border: "none", 
                padding: "6px 12px", 
                borderRadius: "6px", 
                cursor: "pointer", 
                fontSize: "12px", 
                fontWeight: "bold" 
              }}
            >
              <Shield size={14} /> Admin Panel
            </button>
          </div>
        )} */}

        <button 
          onClick={() => setAppLang(appLang === "km" ? "en" : "km")}
          style={{ padding: "6px 12px", cursor: "pointer", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#f8fafc", fontWeight: "bold", fontSize: "12px", color: "#334155" }}
        >
          {appLang === "km" ? "🇰🇭 KM" : "🇬🇧 EN"}
        </button>

        <div className="auth-section">
          {user ? (
            <div className="user-profile" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName} className="avatar" style={{ width: "32px", height: "32px", borderRadius: "50%", border: "1px solid #cbd5e1" }} />
              ) : (
                <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <User size={18} />
                </div>
              )}
              
              {userUsage?.role === "admin" && (
                <span style={{ background: "#dc2626", color: "#fff", padding: "3px 8px", borderRadius: "12px", fontSize: "10px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "3px" }}>
                  <ShieldCheck size={12} /> ADMIN
                </span>
              )}
              {userUsage?.role === "vip" && (
                <span style={{ background: "#d97706", color: "#fff", padding: "3px 8px", borderRadius: "12px", fontSize: "10px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "3px" }}>
                  <Crown size={12} /> VIP
                </span>
              )}
              {userUsage?.role === "free" && (
                <span style={{ background: "#64748b", color: "#fff", padding: "3px 8px", borderRadius: "12px", fontSize: "10px", fontWeight: "bold" }}>
                  FREE
                </span>
              )}

              <button 
                onClick={logout} 
                style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "bold" }}
              >
                <LogOut size={14} /> Log out
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin} 
              disabled={isLoggingIn}
              style={{ background: "#2563eb", color: "#ffffff", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: "bold" }}
            >
              <LogIn size={16} /> {isLoggingIn ? "Logging in..." : "Login"}
            </button>
          )}
        </div>

      </div>
    </header>
  );
}