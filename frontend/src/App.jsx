import React, { useState, useEffect } from "react";
import { auth, signInWithGoogle, logout, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  doc, 
  collection, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  getDoc
} from "firebase/firestore";
import { LogIn, X, Mail, Send, Database, User, Shield } from "lucide-react";
import { TRANSLATIONS } from "./translations";
import Navbar from "./components/Navbar";
import TTSSection from "./components/TTSSection";
import AdminPanel from "./components/AdminPanel";
import "./App.css";

export const formatGoogleDriveUrl = (url) => {
  if (!url) return "";
  try {
    let fileId = "";
    if (url.includes("drive.google.com/file/d/")) {
      fileId = url.split("drive.google.com/file/d/")[1]?.split("/")[0];
    } else if (url.includes("id=")) {
      fileId = url.split("id=")[1]?.split("&")[0];
    } else if (url.includes("googleusercontent.com/d/")) {
      fileId = url.split("googleusercontent.com/d/")[1]?.split("/")[0];
    } else if (url.includes("drive.google.com/uc?")) {
      const match = url.match(/[?&]id=([^&]+)/);
      if (match) fileId = match[1];
    }
    if (fileId) {
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
  } catch (e) {
    console.error("URL Format Error:", e);
  }
  return url;
};

const LANGUAGES = [
  { code: "km", name: "ខ្មែរ (Khmer)" },
  { code: "en", name: "អង់គ្លេស (English)" },
  { code: "fr", name: "បារាំង (French)" },
  { code: "ja", name: "ជប៉ុន (Japanese)" },
  { code: "zh", name: "ចិន (Chinese)" },
  { code: "th", name: "ថៃ (Thai)" },
  { code: "vi", name: "វៀតណាម (Vietnamese)" },
];

const VOICE_TYPES = [
  { id: "woman", name: "👩 ស្រី (Woman)" },
  { id: "man", name: "👨 ប្រុស (Man)" },
  { id: "girl", name: "👧 ក្មេងស្រី (Girl)" },
  { id: "boy", name: "👦 ក្មេងប្រុស (Boy)" },
];

const CHARACTER_STYLES = [
  { id: "general", name: "🗣️ ទូទៅ (General)" },
  { id: "news", name: "📰 អានព័ត៌មាន (Reading News)" },
  { id: "story", name: "📖 អានរឿង (Story Telling)" },
];

function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentTab, setCurrentTab] = useState("user");
  const [appLang, setAppLang] = useState("km");
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("km");
  const [voiceType, setVoiceType] = useState("woman");
  const [characterStyle, setCharacterStyle] = useState("general");
  const [audioUrl, setAudioUrl] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const [dbLoading, setDbLoading] = useState(true);
  const [dbProgress, setDbProgress] = useState(20);

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState("");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [billingCycle, setBillingCycle] = useState("monthly");

  const [userUsage, setUserUsage] = useState({
    role: "free",
    dailyUsed: 0,
    limit: 200,
  });

  const [paymentSettings, setPaymentSettings] = useState({
    docId: "h4syLlqcg33B60hE3b1B",
    bankName: "ABA Bank",
    accountNumber: "000 123 456",
    qrCodeUrl: "https://drive.google.com/uc?export=view&id=1A2B3C4D5E6F7G8H9I0J",
    gmail: "seyhaemdev@gmail.com",
    telegram: "https://t.me/em_seyha",
    pay_month: 10,
    freeLimit: 200,
    vipProLimit: 10000,
    vipProPrice: 1.00,
    vipUnlimitedLimit: 50000,
    vipUnlimitedPrice: 3.00,
    yearlyDiscountPercent: 5
  });

  const [paymentsList, setPaymentsList] = useState([]);
  const [usersList, setUsersList] = useState([]);

  const t = TRANSLATIONS[appLang] || TRANSLATIONS.km;
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";

  useEffect(() => {
    setDbLoading(true);
    setDbProgress(30);

    const unsubSettings = onSnapshot(collection(db, "settings"), (snapshot) => {
      if (!snapshot.empty) {
        const targetDoc = snapshot.docs.find(d => d.id === "h4syLlqcg33B60hE3b1B") || snapshot.docs[0];
        const data = targetDoc.data();
        setPaymentSettings({
          docId: targetDoc.id,
          bankName: data.bankName || "",
          accountNumber: data.accountNumber || "",
          qrCodeUrl: data.qrCodeUrl || "",
          gmail: data.gmail || "",
          telegram: data.telegram || "",
          pay_month: data.pay_month !== undefined ? Number(data.pay_month) : 10,
          freeLimit: data.freeLimit !== undefined ? Number(data.freeLimit) : 200,
          vipProLimit: data.vipProLimit !== undefined ? Number(data.vipProLimit) : 10000,
          vipProPrice: data.vipProPrice !== undefined ? Number(data.vipProPrice) : 1.00,
          vipUnlimitedLimit: data.vipUnlimitedLimit !== undefined ? Number(data.vipUnlimitedLimit) : 50000,
          vipUnlimitedPrice: data.vipUnlimitedPrice !== undefined ? Number(data.vipUnlimitedPrice) : 3.00,
          yearlyDiscountPercent: data.yearlyDiscountPercent !== undefined ? Number(data.yearlyDiscountPercent) : 5
        });
      }
      setDbProgress((prev) => Math.min(90, prev + 25));
    });

    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAudioUrl("");
      setText("");
      setError("");
      setProgress(0);

      if (currentUser) {
        const userEmail = currentUser.email ? currentUser.email.toLowerCase().trim() : "";
        const isMasterAdmin = userEmail === "seyhaemdev@gmail.com";

        // 🔄 Sync Email Doc to UID Doc
        const emailDocRef = doc(db, "Users", userEmail);
        const uidDocRef = doc(db, "Users", currentUser.uid);

        try {
          const emailSnap = await getDoc(emailDocRef);
          if (emailSnap.exists()) {
            const emailData = emailSnap.data();
            await setDoc(uidDocRef, {
              ...emailData,
              email: userEmail,
              uid: currentUser.uid
            }, { merge: true });
          }
        } catch (e) {
          console.warn("Syncing Email doc to UID doc failed:", e);
        }

        // Listen Users Collection to find real-time changes
        const unsubUsersList = onSnapshot(collection(db, "Users"), (snapshot) => {
          const allUsers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          setUsersList(allUsers);

          const foundUser = allUsers.find(
            u => u.id === currentUser.uid || (u.email && u.email.toLowerCase().trim() === userEmail)
          );

          let role = isMasterAdmin ? "admin" : "free";
          let limit = isMasterAdmin ? -1 : (paymentSettings.freeLimit || 200);
          let dailyUsed = 0;

          if (foundUser) {
            role = foundUser.role || role;
            dailyUsed = Number(foundUser.dailyUsed || 0);

            const parsedLimit = Number(foundUser.dailyLimit);

            if (role === "admin" || isMasterAdmin) {
              limit = -1;
            } else if (role === "vip") {
              limit = (!isNaN(parsedLimit) && parsedLimit > 200) ? parsedLimit : (paymentSettings.vipProLimit || 10000);
            } else if (!isNaN(parsedLimit) && parsedLimit > 0) {
              limit = parsedLimit;
            } else {
              limit = paymentSettings.freeLimit || 200;
            }
          }

          if (isMasterAdmin || role === "admin") {
            setIsAdmin(true);
            role = "admin";
            limit = -1;
          } else {
            setIsAdmin(false);
            setCurrentTab("user");
          }

          setUserUsage({ role, dailyUsed, limit });
          setDbProgress(100);
          setTimeout(() => setDbLoading(false), 300);
        });

        const unsubPayments = onSnapshot(collection(db, "payments"), (snapshot) => {
          setPaymentsList(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => {
          unsubPayments();
          unsubUsersList();
        };
      } else {
        setIsAdmin(false);
        setCurrentTab("user");
        setUserUsage({ role: "free", dailyUsed: 0, limit: paymentSettings.freeLimit || 200 });
        setDbProgress(100);
        setTimeout(() => setDbLoading(false), 300);
      }
    });

    return () => {
      unsubSettings();
      unsubAuth();
    };
  }, []);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error("Login Error:", err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    setAudioUrl("");
    setText("");
    setError("");
    await logout();
  };

 const handleGenerateTTS = async () => {
  if (!text.trim()) {
    setError(t.errorText || "សូមបញ្ចូលអត្ថបទជាមុនសិន!");
    return;
  }
  if (!user) {
    setError("សូមចូលប្រើប្រាស់ (Login) ជាមុនសិន!");
    return;
  }

  const currentTextLength = text.trim().length;
  const newCalculatedUsed = userUsage.dailyUsed + currentTextLength;

  // 1. ឆែកមើល Limit មុនពេលផ្ញើ Request
  if (userUsage.limit !== -1 && newCalculatedUsed > userUsage.limit) {
    const errorMsg = `អ្នកបានប្រើប្រាស់អស់ដែនកំណត់ប្រចាំថ្ងៃហើយ! (${newCalculatedUsed}/${userUsage.limit} តួអក្សរ)។ សូមទាក់ទងដំឡើងទៅ VIP ដើម្បីប្រើប្រាស់បន្ថែម!`;
    setError(errorMsg);
    if (userUsage.role !== "admin") {
      setShowUpgradeModal(true);
    }
    return;
  }

  setLoading(true);
  setProgress(15);
  setError("");
  setAudioUrl("");

  const interval = setInterval(() => {
    setProgress((prev) => (prev >= 85 ? 85 : prev + 15));
  }, 250);

  try {
    const idToken = await user.getIdToken();
    const response = await fetch(`${BACKEND_URL}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang: language, voiceType, characterStyle, idToken }),
    });

    clearInterval(interval);
    setProgress(100);

    const data = await response.json();

    if (data.success && data.audioUrl) {
      setAudioUrl(data.audioUrl);

      // 🔑 2. បង្ខំអាប់ដេតតម្លៃ dailyUsed បូកបន្ថែមភ្លាមៗនៅលើ UI (ឧទាហរណ៍៖ 6 + 6 = 12)
      setUserUsage((prev) => {
        const updatedUsed = data.usage && data.usage.dailyUsed !== undefined 
          ? Math.max(data.usage.dailyUsed, prev.dailyUsed + currentTextLength)
          : prev.dailyUsed + currentTextLength;

        return {
          ...prev,
          dailyUsed: updatedUsed,
          limit: (data.usage && data.usage.limit && data.usage.limit > 200) ? data.usage.limit : prev.limit
        };
      });

      // 🔑 3. Update ផ្ទាល់ចូលទៅក្នុង Firestore ពី Frontend ដើម្បីធានាថាទិន្នន័យត្រូវបាន Save 100%
      try {
        const userDocRef = doc(db, "Users", user.uid);
        await setDoc(userDocRef, {
          email: user.email ? user.email.toLowerCase().trim() : "",
          dailyUsed: newCalculatedUsed,
          lastUsedDate: new Date().toISOString().split("T")[0]
        }, { merge: true });
      } catch (fsErr) {
        console.warn("Direct Firestore update fallback:", fsErr);
      }

    } else {
      setError(data.error || "មានបញ្ហាក្នុងការបម្លែងសំឡេង!");
      if (data.limitExceeded && userUsage.role !== "admin") {
        setShowUpgradeModal(true);
      }
    }
  } catch (err) {
    clearInterval(interval);
    console.error("Error generating TTS:", err);
    setError("មិនអាចតភ្ជាប់ទៅកាន់ Server បានទេ!");
  } finally {
    setTimeout(() => {
      setLoading(false);
      setProgress(0);
    }, 400);
  }
};

  const handleDownload = () => {
    if (!audioUrl) return;
    try {
      const a = document.createElement("a");
      a.href = audioUrl;
      a.download = `speech_${language}_${voiceType}_${Date.now()}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Download error:", err);
      setError("មិនអាចទាញយកឯកសារបានទេ!");
    }
  };

  const handleSaveUser = async (userData) => {
    try {
      const targetEmail = userData.email ? userData.email.toLowerCase().trim() : "";
      if (!targetEmail) {
        alert("សូមបញ្ចូល Email របស់ User!");
        return;
      }

      const limitVal = Number(userData.dailyLimit);

      if (userData.id) {
        const userRef = doc(db, "Users", userData.id);
        await updateDoc(userRef, {
          email: targetEmail,
          role: userData.role,
          dailyLimit: limitVal,
          dailyUsed: Number(userData.dailyUsed || 0),
          lastUsedDate: userData.lastUsedDate || new Date().toISOString().split('T')[0],
          vipExpiresAt: userData.vipExpiresAt || ""
        });
        alert("អាប់ដេតព័ត៌មាន User បានដោយជោគជ័យ!");
      } else {
        const existingUser = usersList.find(u => u.email && u.email.toLowerCase().trim() === targetEmail);
        const docId = existingUser ? existingUser.id : targetEmail;

        await setDoc(doc(db, "Users", docId), {
          email: targetEmail,
          role: userData.role,
          dailyLimit: limitVal,
          dailyUsed: Number(userData.dailyUsed || 0),
          lastUsedDate: new Date().toISOString().split('T')[0],
          vipExpiresAt: userData.vipExpiresAt || ""
        }, { merge: true });

        alert("បន្ថែម User ថ្មីបានដោយជោគជ័យ!");
      }
    } catch (err) {
      console.error("Error saving user:", err);
      alert("មានបញ្ហាក្នុងការរក្សាទុក User: " + err.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm("តើអ្នកពិតជាចង់លុប User នេះមែនទេ?")) {
      try {
        await deleteDoc(doc(db, "Users", userId));
        alert("លុប User បានដោយជោគជ័យ!");
      } catch (err) {
        console.error("Error deleting user:", err);
        alert("មានបញ្ហាក្នុងការលុប User!");
      }
    }
  };

  const handleSavePaymentSettings = async (e) => {
    e.preventDefault();
    try {
      const docId = paymentSettings.docId || "h4syLlqcg33B60hE3b1B";
      await setDoc(doc(db, "settings", docId), paymentSettings, { merge: true });
      alert("រក្សាទុកព័ត៌មានទូទាត់ និង Pricing Settings ចូល Firestore បានដោយជោគជ័យ!");
    } catch (err) {
      console.error("Error saving payment settings:", err);
      alert("មានបញ្ហាក្នុងការរក្សាទុក!");
    }
  };

  const openGmail = () => {
    const recipient = paymentSettings.gmail || "seyhaemdev@gmail.com";
    const subject = encodeURIComponent("Upgrade VIP Request - Khmer TTS");
    const body = encodeURIComponent(`Hello Admin,\n\nI have transferred the payment for upgrading my VIP account.\n\nUser Email: ${user?.email || ""}`);
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${recipient}&su=${subject}&body=${body}`, "_blank");
  };

  const usagePercentage = userUsage.role === "admin" || userUsage.limit === -1 
    ? 0 
    : Math.min(100, (userUsage.dailyUsed / userUsage.limit) * 100);

  const qrImageSrc = formatGoogleDriveUrl(paymentSettings.qrCodeUrl);

  const discountMultiplier = 1 - ((paymentSettings.yearlyDiscountPercent || 5) / 100);
  const vipProYearlyPrice = (paymentSettings.vipProPrice * 12 * discountMultiplier).toFixed(2);
  const vipUnlimitedYearlyPrice = (paymentSettings.vipUnlimitedPrice * 12 * discountMultiplier).toFixed(2);

  const userIsAdmin = user && (isAdmin || userUsage.role === "admin" || user.email?.toLowerCase().trim() === "seyhaemdev@gmail.com");

  return (
    <div className="container">
      
      <Navbar 
        user={user}
        isAdmin={userIsAdmin}
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        appLang={appLang}
        setAppLang={setAppLang}
        t={t}
        userUsage={userUsage}
        handleLogin={handleLogin}
        logout={handleLogout}
        isLoggingIn={isLoggingIn}
      />

      <main className="main-content" style={{ marginTop: dbLoading ? "50px" : "0px", padding: "20px" }}>
        
        {userIsAdmin && (
          <div style={{ 
            display: "flex", 
            justifyContent: "center", 
            gap: "12px", 
            marginBottom: "24px", 
            background: "#ffffff", 
            padding: "12px", 
            borderRadius: "12px", 
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            border: "1px solid #cbd5e1" 
          }}>
            <button 
              onClick={() => setCurrentTab("user")}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "10px 24px",
                backgroundColor: currentTab === "user" ? "#2563eb" : "#f1f5f9",
                color: currentTab === "user" ? "#ffffff" : "#475569",
                border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold",
                fontSize: "14px", transition: "all 0.2s"
              }}
            >
              <User size={18} /> Normal UI
            </button>

            <button 
              onClick={() => setCurrentTab("admin")}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "10px 24px",
                backgroundColor: currentTab === "admin" ? "#dc2626" : "#f1f5f9",
                color: currentTab === "admin" ? "#ffffff" : "#475569",
                border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold",
                fontSize: "14px", transition: "all 0.2s"
              }}
            >
              <Shield size={18} /> Admin / User Management
            </button>
          </div>
        )}

        {!user ? (
          <div className="login-prompt">
            <h2>{t.signInPrompt || "សូមចូលប្រើប្រាស់កម្មវិធី"}</h2>
            <p>{t.signInDesc || "ចូលប្រព័ន្ធជាមួយ Google ដើម្បីប្រើប្រាស់សេវាកម្ម TTS"}</p>
            <button onClick={handleLogin} disabled={isLoggingIn} className="btn-login-large">
              <LogIn size={20} /> {isLoggingIn ? "កំពុងចូល..." : t.login || "Sign in with Google"}
            </button>
          </div>
        ) : currentTab === "user" ? (
          <TTSSection 
            t={t}
            userUsage={userUsage}
            usagePercentage={usagePercentage}
            language={language}
            setLanguage={setLanguage}
            voiceType={voiceType}
            setVoiceType={setVoiceType}
            characterStyle={characterStyle}
            setCharacterStyle={setCharacterStyle}
            text={text}
            setText={setText}
            error={error}
            loading={loading}
            progress={progress}
            handleGenerateTTS={handleGenerateTTS}
            handleDownload={handleDownload}
            audioUrl={audioUrl}
            setShowUpgradeModal={setShowUpgradeModal}
            LANGUAGES={LANGUAGES}
            VOICE_TYPES={VOICE_TYPES}
            CHARACTER_STYLES={CHARACTER_STYLES}
          />
        ) : (
          <AdminPanel 
            paymentSettings={paymentSettings}
            setPaymentSettings={setPaymentSettings}
            handleSavePaymentSettings={handleSavePaymentSettings}
            paymentsList={paymentsList}
            usersList={usersList}
            handleSaveUser={handleSaveUser}
            handleDeleteUser={handleDeleteUser}
          />
        )}
      </main>

      {showUpgradeModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ borderRadius: "16px", padding: "24px", maxWidth: "550px", width: "90%" }}>
            <button className="modal-close" onClick={() => setShowUpgradeModal(false)}>
              <X size={20} />
            </button>

            <div style={{ textAlign: "center", marginBottom: "18px" }}>
              <h2 style={{ margin: 0, color: "#0f172a", fontSize: "1.4rem" }}>👑 ដំឡើងគណនី VIP (Upgrade VIP)</h2>
              <p style={{ margin: "6px 0 0 0", color: "#64748b", fontSize: "13px" }}>
                កញ្ចប់សេវាកម្ម {paymentSettings.pay_month} ខែ - ស្កែន QR Code ដើម្បីទូទាត់
              </p>
            </div>

            <div style={{ display: "flex", gap: "8px", marginBottom: "18px", justifyContent: "center", background: "#f1f5f9", padding: "4px", borderRadius: "10px" }}>
              <button 
                onClick={() => setBillingCycle("monthly")}
                style={{ flex: 1, padding: "8px 14px", background: billingCycle === "monthly" ? "#2563eb" : "transparent", color: billingCycle === "monthly" ? "#fff" : "#475569", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}
              >
                Monthly Plan
              </button>
              <button 
                onClick={() => setBillingCycle("yearly")}
                style={{ flex: 1, padding: "8px 14px", background: billingCycle === "yearly" ? "#10b981" : "transparent", color: billingCycle === "yearly" ? "#fff" : "#475569", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}
              >
                Yearly Plan <span style={{ background: "#fef08a", color: "#854d0e", fontSize: "10px", padding: "2px 6px", borderRadius: "10px", marginLeft: "4px" }}>{paymentSettings.yearlyDiscountPercent}% OFF</span>
              </button>
            </div>

            <div className="pricing-grid" style={{ gap: "10px", marginBottom: "18px" }}>
              <div className="pricing-card" style={{ padding: "12px", border: "1px solid #e2e8f0", borderRadius: "10px" }}>
                <h4 style={{ margin: "0 0 4px 0", fontSize: "14px" }}>Free Tier</h4>
                <div className="price" style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#0f172a" }}>$0 <span style={{ fontSize: "11px", color: "#64748b" }}>/{billingCycle === "yearly" ? "ឆ្នាំ" : "ខែ"}</span></div>
                <ul style={{ fontSize: "11px", paddingLeft: "16px", margin: "8px 0 0 0", color: "#475569" }}>
                  <li><strong>{paymentSettings.freeLimit.toLocaleString()}</strong> តួអក្សរ/ថ្ងៃ</li>
                </ul>
              </div>

              <div className="pricing-card featured" style={{ padding: "12px", border: "2px solid #2563eb", borderRadius: "10px", background: "#f0f6ff", position: "relative" }}>
                <span className="badge" style={{ position: "absolute", top: "-10px", right: "10px", background: "#2563eb", color: "#fff", fontSize: "9px", padding: "2px 8px", borderRadius: "10px", fontWeight: "bold" }}>POPULAR</span>
                <h4 style={{ margin: "0 0 4px 0", fontSize: "14px", color: "#1e40af" }}>VIP Pro ({paymentSettings.pay_month} Months)</h4>
                <div className="price" style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#1e3a8a" }}>
                  ${billingCycle === "yearly" ? vipProYearlyPrice : Number(paymentSettings.vipProPrice).toFixed(2)} 
                  <span style={{ fontSize: "11px", color: "#64748b" }}>/{billingCycle === "yearly" ? "ឆ្នាំ" : "ខែ"}</span>
                </div>
                <ul style={{ fontSize: "11px", paddingLeft: "16px", margin: "8px 0 0 0", color: "#334155" }}>
                  <li><strong>{paymentSettings.vipProLimit.toLocaleString()}</strong> តួអក្សរ/ថ្ងៃ</li>
                  <li>សុពលភាព: {paymentSettings.pay_month} ខែ</li>
                </ul>
              </div>

              <div className="pricing-card" style={{ padding: "12px", border: "1px solid #e2e8f0", borderRadius: "10px" }}>
                <h4 style={{ margin: "0 0 4px 0", fontSize: "14px" }}>VIP Unlimited</h4>
                <div className="price" style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#0f172a" }}>
                  ${billingCycle === "yearly" ? vipUnlimitedYearlyPrice : Number(paymentSettings.vipUnlimitedPrice).toFixed(2)} 
                  <span style={{ fontSize: "11px", color: "#64748b" }}>/{billingCycle === "yearly" ? "ឆ្នាំ" : "ខែ"}</span>
                </div>
                <ul style={{ fontSize: "11px", paddingLeft: "16px", margin: "8px 0 0 0", color: "#475569" }}>
                  <li><strong>{paymentSettings.vipUnlimitedLimit.toLocaleString()}</strong> តួអក្សរ/ថ្ងៃ</li>
                  <li>សុពលភាព: {paymentSettings.pay_month} ខែ</li>
                </ul>
              </div>
            </div>

            <div className="qr-section" style={{ textAlign: "center", background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "13px", color: "#1e293b" }}>
                Scan QR Code ដើម្បីទូទាត់ ({paymentSettings.bankName || "ABA Bank"}) - {paymentSettings.pay_month} ខែ
              </h4>
              <div className="qr-box" style={{ display: "inline-block", background: "#ffffff", padding: "10px", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <img 
                  src={qrImageSrc || "https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=ABA_PAYMENT"} 
                  alt="KHQR Code" 
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=ABA_PAYMENT";
                  }}
                  style={{ width: "160px", height: "160px", borderRadius: "8px", objectFit: "contain" }}
                />
                <div style={{ marginTop: "8px", fontSize: "13px", fontWeight: "bold", color: "#0f172a" }}>
                  {paymentSettings.bankName}: {paymentSettings.accountNumber}
                </div>
              </div>
            </div>

            <div className="contact-buttons" style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "#475569", fontWeight: "bold" }}>
                បន្ទាប់ពីទូទាត់រួច សូមផ្ញើវិក្កយបត្រ (Receipt) មកកាន់ Admin ({paymentSettings.gmail})៖
              </p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                <a 
                  href={paymentSettings.telegram || "https://t.me/em_seyha"} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", background: "#0088cc", color: "#fff", padding: "10px", borderRadius: "8px", textDecoration: "none", fontWeight: "bold", fontSize: "13px" }}
                >
                  <Send size={16} /> Telegram Admin
                </a>
                <button 
                  onClick={openGmail}
                  style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", background: "#ea4335", color: "#fff", border: "none", padding: "10px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}
                >
                  <Mail size={16} /> Send via Gmail
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default App;