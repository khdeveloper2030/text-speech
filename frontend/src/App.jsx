import React, { useState, useEffect, useRef } from "react";
import { auth, signInWithGoogle, logout, db, storage } from "./firebase";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";
import { 
  doc, 
  collection, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  getDoc,
  getDocs,
  serverTimestamp,
  runTransaction
} from "firebase/firestore";
import { LogIn, X, Mail, Send, Database, User, Shield, Crown, LoaderCircle } from "lucide-react";
import { TRANSLATIONS } from "./translations";
import Navbar from "./components/Navbar";
import TTSSection from "./components/TTSSection";
import AdminPanel from "./components/AdminPanel";
import PlansLanding from "./components/PlansLanding";
import "./App.css";

export const formatGoogleDriveUrl = (url) => {
  if (!url) return "";
  const value = String(url).trim();
  if (/^https?:\/\/lh[0-9]\.googleusercontent\.com\/d\//i.test(value)) return value;
  const filePathMatch = value.match(/drive\.google\.com\/file\/d\/([^/?]+)/i);
  const queryMatch = value.match(/[?&]id=([^&]+)/i);
  const googleusercontentMatch = value.match(/googleusercontent\.com\/d\/([^/?]+)/i);
  const fileId = (filePathMatch && filePathMatch[1]) || (queryMatch && queryMatch[1]) || (googleusercontentMatch && googleusercontentMatch[1]);
  return fileId ? `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=w1200` : value;
};

const SETTINGS_DOC_ID = "h4syLlqcg33B60hE3b1B";

export const getGoogleDriveImageFallbacks = (url) => {
  const original = String(url || "").trim();
  if (!original) return [];
  const idMatch = original.match(/drive\.google\.com\/file\/d\/([^/?]+)/i) || original.match(/[?&]id=([^&]+)/i) || original.match(/googleusercontent\.com\/d\/([^/?=]+)/i);
  if (!idMatch) return [original];
  const id = idMatch[1];
  const urls = [];
  urls.push(original);
  urls.push(`https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w1200`);
  urls.push(`https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=s1200`);
  urls.push(`https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1200`);
  urls.push(`https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`);
  return [...new Set(urls)];
};

const formatDateDMY = (value) => {
  if (!value) return "—";
  let date;
  if (typeof value?.toDate === "function") date = value.toDate();
  else if (value instanceof Date) date = value;
  else {
    const raw = String(value).trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(raw);
  }
  if (Number.isNaN(date.getTime())) return String(value);
  return `${String(date.getDate()).padStart(2,"0")}-${String(date.getMonth()+1).padStart(2,"0")}-${date.getFullYear()}`;
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
];

const CHARACTER_STYLES = [
  { id: "general", name: "🗣️ ទូទៅ (General)" },
  { id: "news", name: "📰 អានព័ត៌មាន (Reading News)" },
  { id: "story", name: "📖 អានរឿង (Story Telling)" },
];

function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentTab, setCurrentTab] = useState(() => {
    try { return sessionStorage.getItem("textSpeechCurrentTab") === "admin" ? "admin" : "user"; } catch { return "user"; }
  });
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
  const [vipLoginPending, setVipLoginPending] = useState(false);
  const [error, setError] = useState("");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [paymentRequired, setPaymentRequired] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginPlan, setLoginPlan] = useState("free");
  const [pendingPaymentEmail, setPendingPaymentEmail] = useState("");
  const [pendingPaymentUid, setPendingPaymentUid] = useState("");
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [showPaidApprovalModal, setShowPaidApprovalModal] = useState(false);
  const previousPaymentStatuses = useRef({});
  const [hasPendingPayment, setHasPendingPayment] = useState(false);
  const [paymentSubmitStage, setPaymentSubmitStage] = useState("");
  const [paymentReceiptFile, setPaymentReceiptFile] = useState(null);
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [selectedVipPlan, setSelectedVipPlan] = useState("pro");
  const [qrImageFailed, setQrImageFailed] = useState(false);
  const [qrFallbackIndex, setQrFallbackIndex] = useState(0);

  const [userUsage, setUserUsage] = useState({
    role: "free",
    dailyUsed: 0,
    limit: 200,
    vipExpiresAt: "",
  });

  const [pricingLoaded, setPricingLoaded] = useState(false);
  const [pricingAvailable, setPricingAvailable] = useState(false);

  const [paymentSettings, setPaymentSettings] = useState({
    docId: SETTINGS_DOC_ID,
    bankName: "",
    accountNumber: "",
    qrCodeUrl: "https://lh3.googleusercontent.com/d/1xK0ufr7n0hYWBK9Fdr_JQAY35H1vqx6n",
    gmail: "seyhaemdev@gmail.com",
    telegram: "https://t.me/em_seyha",
    pay_month: 12,
    freeLimit: 200,
    vipProLimit: 10000,
    vipProPrice: 3,
    vipUnlimitedLimit: 50000,
    vipUnlimitedPrice: 14,
    yearlyDiscountPercent: 10
  });

  const [paymentsList, setPaymentsList] = useState([]);
  const [usersList, setUsersList] = useState([]);

  useEffect(() => {
    try { sessionStorage.setItem("textSpeechCurrentTab", currentTab); } catch {}
  }, [currentTab]);

  // Public pricing contains no bank/account details, so PlansLanding can show
  // the latest prices even before a visitor signs in.
  useEffect(() => {
    const publicPricingRef = doc(db, "publicConfig", "pricing");
    const unsubPublicPricing = onSnapshot(publicPricingRef, { includeMetadataChanges: true }, (pricingSnap) => {
      // Ignore cached snapshots so old cached prices are never shown while
      // waiting for the latest server values.
      if (pricingSnap.metadata.fromCache) return;
      if (!pricingSnap.exists()) {
        setPricingAvailable(false);
        setPricingLoaded(true);
        return;
      }
      const pricing = pricingSnap.data();
      setPaymentSettings((previous) => ({
        ...previous,
        freeLimit: pricing.freeLimit !== undefined ? Number(pricing.freeLimit) : previous.freeLimit,
        vipProLimit: pricing.vipProLimit !== undefined ? Number(pricing.vipProLimit) : previous.vipProLimit,
        vipProPrice: pricing.vipProPrice !== undefined ? Number(pricing.vipProPrice) : previous.vipProPrice,
        vipUnlimitedLimit: pricing.vipUnlimitedLimit !== undefined ? Number(pricing.vipUnlimitedLimit) : previous.vipUnlimitedLimit,
        vipUnlimitedPrice: pricing.vipUnlimitedPrice !== undefined ? Number(pricing.vipUnlimitedPrice) : previous.vipUnlimitedPrice,
        yearlyDiscountPercent: pricing.yearlyDiscountPercent !== undefined ? Number(pricing.yearlyDiscountPercent) : previous.yearlyDiscountPercent
      }));
      setPricingAvailable(true);
      setPricingLoaded(true);
    }, (err) => {
      console.error("Public pricing listener failed:", err.code, err.message);
      setPricingAvailable(false);
      setPricingLoaded(true);
    });
    return () => unsubPublicPricing();
  }, []);

  const t = TRANSLATIONS[appLang] || TRANSLATIONS.km;
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";

  useEffect(() => {
    setDbLoading(true);
    setDbProgress(30);

    // Firestore rules require authentication to read the private settings document.
    // Start the settings listener only after Firebase confirms the signed-in user.
    let unsubSettings = null;
    let unsubUser = null;
    let unsubPayments = null;
    let unsubUsersList = null;
    let authGeneration = 0;

    const stopUserListeners = () => {
      if (unsubUser) { unsubUser(); unsubUser = null; }
      if (unsubPayments) { unsubPayments(); unsubPayments = null; }
      if (unsubUsersList) { unsubUsersList(); unsubUsersList = null; }
    };

    const applySettingsSnapshot = (settingsSnap) => {
      if (!settingsSnap.exists()) {
        console.warn(
          `Canonical settings document settings/${SETTINGS_DOC_ID} does not exist. ` +
          "The app will keep its current defaults instead of loading a random legacy document."
        );
        return;
      }
      const data = settingsSnap.data();
      console.log("[Settings Debug]", {
        documentId: settingsSnap.id,
        vipProPrice: data.vipProPrice,
        vipUnlimitedPrice: data.vipUnlimitedPrice,
        updatedAt: data.updatedAt
      });
      setPaymentSettings({
        docId: SETTINGS_DOC_ID,
        bankName: data.bankName ?? "",
        accountNumber: data.accountNumber ?? "",
        qrCodeUrl: data.qrCodeUrl ?? "https://lh3.googleusercontent.com/d/1xK0ufr7n0hYWBK9Fdr_JQAY35H1vqx6n",
        gmail: data.gmail ?? "seyhaemdev@gmail.com",
        telegram: data.telegram ?? "https://t.me/em_seyha",
        pay_month: data.pay_month !== undefined ? Number(data.pay_month) : 12,
        freeLimit: data.freeLimit !== undefined ? Number(data.freeLimit) : 200,
        vipProLimit: data.vipProLimit !== undefined ? Number(data.vipProLimit) : 10000,
        vipProPrice: data.vipProPrice !== undefined ? Number(data.vipProPrice) : 3,
        vipUnlimitedLimit: data.vipUnlimitedLimit !== undefined ? Number(data.vipUnlimitedLimit) : 50000,
        vipUnlimitedPrice: data.vipUnlimitedPrice !== undefined ? Number(data.vipUnlimitedPrice) : 14,
        yearlyDiscountPercent: data.yearlyDiscountPercent !== undefined ? Number(data.yearlyDiscountPercent) : 10
      });
      setDbProgress((prev) => Math.min(90, prev + 25));
    };

    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      const generation = ++authGeneration;
      if (unsubSettings) { unsubSettings(); unsubSettings = null; }
      stopUserListeners();

      setAuthReady(true);
      setUser(currentUser);
      const authEmail = String(currentUser?.email || "").toLowerCase().trim();
      if (authEmail === "seyhaemdev@gmail.com") {
        setIsAdmin(true);
        setCurrentTab("admin");
      }
      setAudioUrl("");
      setText("");
      setError("");
      setProgress(0);

      if (!currentUser) {
        setIsAdmin(false);
        setCurrentTab("user");
        setPaymentRequired(false);
        setShowUpgradeModal(false);
        setUserUsage({ role: "free", dailyUsed: 0, limit: 200 });
        setDbProgress(100);
        setDbLoading(false);
        return;
      }

      // Settings are private (bank/account details), so read them only after login.
      unsubSettings = onSnapshot(
        doc(db, "settings", SETTINGS_DOC_ID),
        applySettingsSnapshot,
        (err) => {
          console.error("Settings document listener failed:", err.code, err.message);
          setError(`Settings: ${err.code || "error"} — ${err.message || "Read failed"}`);
        }
      );

      const userEmail = String(currentUser.email || "").toLowerCase().trim();
      const isMasterAdmin = userEmail === "seyhaemdev@gmail.com";
      const emailDocRef = doc(db, "Users", userEmail);
      const uidDocRef = doc(db, "Users", currentUser.uid);

      try {
        const [uidSnap, emailSnap] = await Promise.all([getDoc(uidDocRef), getDoc(emailDocRef)]);
        if (generation !== authGeneration) return;
        if (!uidSnap.exists() && emailSnap.exists()) {
          const emailData = emailSnap.data();
          await setDoc(uidDocRef, { ...emailData, email: userEmail, uid: currentUser.uid }, { merge: true });
        }
      } catch (e) {
        console.warn("Legacy User document migration skipped:", e?.code || e?.message || e);
      }
      if (generation !== authGeneration) return;

      unsubUser = onSnapshot(uidDocRef, (docSnap) => {
        let role = isMasterAdmin ? "admin" : "free";
        let limit = isMasterAdmin ? -1 : 200;
        let dailyUsed = 0;
        let vipExpiresAt = "";

        if (docSnap.exists()) {
          const data = docSnap.data();
          vipExpiresAt = data.vipExpiresAt || data.expiresAt || "";
          const rawRole = String(data.role || role).toLowerCase().trim();
          const isUnlimitedRole = rawRole === "vip unlimited" || rawRole === "vip_unlimited" || rawRole === "unlimited" || rawRole === "unlimited vip";
          const isVipRole = rawRole === "vip" || rawRole === "vip pro" || rawRole === "vip_pro" || rawRole === "plus" || rawRole === "pro" || isUnlimitedRole;
          const isVipTier = rawRole === "vip" || isUnlimitedRole;
          role = rawRole === "administrator" ? "admin" : (isUnlimitedRole ? "vip unlimited" : (isVipRole ? (rawRole === "vip" ? "vip" : "plus") : rawRole));

          const todayKey = new Date().toISOString().split("T")[0];
          const savedUsage = data.charactersUsed !== undefined
            ? data.charactersUsed
            : (String(data.lastUsedDate || "") === todayKey ? data.dailyUsed : 0);
          dailyUsed = Math.max(0, Number(savedUsage || 0) || 0);
          const parsedLimit = Number(data.dailyLimit);

          if (role === "admin" || isMasterAdmin) {
            limit = -1;
          } else if (isVipRole) {
            const tierDefault = isVipTier ? 50000 : 10000;
            const savedTotalLimit = Number(data.totalCharacterLimit);
            limit = data.customCharacterLimit === true && Number.isFinite(parsedLimit) && parsedLimit > 0
              ? parsedLimit
              : (Number.isFinite(savedTotalLimit) && savedTotalLimit > 0 ? savedTotalLimit : tierDefault);
          } else if (!isNaN(parsedLimit) && parsedLimit > 0) {
            limit = parsedLimit;
          } else {
            limit = 200;
          }
        }

        const roleIsPaid = ["plus", "vip", "vip unlimited"].includes(String(role).toLowerCase());
        let pendingPlan = "";
        try { pendingPlan = localStorage.getItem("textSpeechPendingVipPlan") || ""; } catch {}
        const pendingPlanIsApproved = pendingPlan === "unlimited"
          ? ["vip", "vip unlimited"].includes(String(role).toLowerCase())
          : pendingPlan === "pro"
            ? String(role).toLowerCase() === "plus"
            : roleIsPaid;

        if (isMasterAdmin || role === "admin") {
          setIsAdmin(true);
          role = "admin";
          limit = -1;
          setShowUpgradeModal(false);
          try { localStorage.removeItem("textSpeechPendingVipPlan"); } catch {}
        } else {
          setIsAdmin(false);
          setCurrentTab("user");
          if (roleIsPaid && pendingPlanIsApproved) {
            // The selected plan is approved; don't show payment after refresh.
            setShowUpgradeModal(false);
            try { localStorage.removeItem("textSpeechPendingVipPlan"); } catch {}
          } else if (pendingPlan === "pro" || pendingPlan === "unlimited") {
            // Preserve the selected paid plan across refresh until that tier is approved.
            setSelectedVipPlan(pendingPlan);
            setShowUpgradeModal(true);
          }
        }

        setUserUsage({ role, dailyUsed, limit, vipExpiresAt });
        setPaymentRequired(false);
        setDbProgress(100);
        setTimeout(() => setDbLoading(false), 300);
      }, (err) => {
        console.error("User document listener failed:", err.code, err.message);
        setError(`User: ${err.code || "error"} — ${err.message || "Read failed"}`);
        setDbLoading(false);
      });

      unsubPayments = onSnapshot(collection(db, "payments"), (snapshot) => {
        const rows = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setPaymentsList(rows);
        const currentEmail = String(currentUser.email || "").toLowerCase().trim();
        const nextStatuses = { ...previousPaymentStatuses.current };
        rows.forEach((payment) => {
          const paymentEmail = String(payment.email || payment.userEmail || "").toLowerCase().trim();
          const status = String(payment.status || "pending").toLowerCase();
          const previousStatus = previousPaymentStatuses.current[payment.id];
          if (paymentEmail === currentEmail && previousStatus === "pending" && status === "approved") {
            setShowPaidApprovalModal(true);
          }
          nextStatuses[payment.id] = status;
        });
        previousPaymentStatuses.current = nextStatuses;
        setHasPendingPayment(rows.some((payment) =>
          String(payment.email || payment.userEmail || "").toLowerCase().trim() === currentEmail &&
          String(payment.status || "pending").toLowerCase() === "pending"
        ));
      }, (err) => {
        console.error("Payments collection listener failed:", err.code, err.message);
        if (isMasterAdmin) setError(`Payments Collection: ${err.code || "error"} — ${err.message || "Read failed"}`);
      });

      unsubUsersList = onSnapshot(collection(db, "Users"), (snapshot) => {
        const unique = new Map();
        snapshot.docs.forEach(d => {
          const item = { id: d.id, ...d.data() };
          const key = String(item.email || item.id).toLowerCase().trim();
          if (!unique.has(key) || item.id === String(item.email || "").toLowerCase().trim()) unique.set(key, item);
        });
        setUsersList([...unique.values()]);
      }, (err) => {
        console.error("Users collection listener failed:", err.code, err.message);
      });
    });

    return () => {
      authGeneration += 1;
      if (unsubSettings) unsubSettings();
      stopUserListeners();
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

  const handleVipLogin = async (plan = "pro") => {
    if (isLoggingIn) return;
    const selectedPlan = plan === "unlimited" ? "unlimited" : "pro";
    setSelectedVipPlan(selectedPlan);
    try { localStorage.setItem("textSpeechPendingVipPlan", selectedPlan); } catch {}
    setBillingCycle("monthly");
    setQrImageFailed(false);
    setQrFallbackIndex(0);
    setIsLoggingIn(true);
    setVipLoginPending(true);
    try {
      const signedInUser = auth.currentUser || await signInWithGoogle();
      if (!signedInUser) {
        setShowUpgradeModal(false);
        return;
      }
      const email = String(signedInUser.email || "").toLowerCase().trim();
      setPendingPaymentEmail(email);
      setPendingPaymentUid(signedInUser.uid || "");
      if (!email) throw new Error("Google account did not provide an email address.");
      
      const roleIsApproved = (data = {}) => {
        const role = String(data.role || "").toLowerCase().replace(/[_-]/g, " ").trim();
        const isAdminRole = role === "admin" || role === "administrator";
        const isVipRole = ["vip", "vip unlimited", "unlimited", "unlimited vip"].includes(role);
        const isPlusRole = ["plus", "pro", "vip pro"].includes(role);
        if (!isAdminRole && !(selectedPlan === "unlimited" ? isVipRole : isPlusRole)) return false;
        if (data.paymentStatus && String(data.paymentStatus).toLowerCase() === "unapproved") return false;
        if (data.vipExpiresAt) {
          const expiry = new Date(data.vipExpiresAt);
          if (!Number.isNaN(expiry.getTime()) && expiry < new Date(new Date().toDateString())) return false;
        }
        return true;
      };
      const uidUserSnap = await getDoc(doc(db, "Users", signedInUser.uid));
      const adminAssigned = uidUserSnap.exists() && roleIsApproved(uidUserSnap.data());
      if (adminAssigned || email === "seyhaemdev@gmail.com") {
        setShowUpgradeModal(false);
        setShowLoginModal(false);
        setVipLoginPending(false);
        try { localStorage.removeItem("textSpeechPendingVipPlan"); } catch {}
      } else {
        setShowUpgradeModal(true);
        setVipLoginPending(false);
      }
    } catch (err) {
      console.error("VIP login verification failed:", err);
      setShowUpgradeModal(true);
      setVipLoginPending(false);
      setError("Could not verify VIP access. You can submit a pending payment request or retry.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    setAudioUrl("");
    setText("");
    setError("");
    setHasPendingPayment(false);
    await logout();
  };

  const requestLogin = (plan = "free") => {
    setLoginPlan(plan);
    if (plan !== "free") {
      setSelectedVipPlan(plan === "unlimited" ? "unlimited" : "pro");
      setBillingCycle("monthly");
    }
    setShowLoginModal(true);
  };

  const continueLogin = async () => {
    setShowLoginModal(false);
    if (loginPlan === "free") await handleLogin();
    else await handleVipLogin(loginPlan);
  };

  // ⭐️ ជំនួសមុខងារ Submit Payment ឱ្យអាប់ឡូតចូល Firebase Storage ផ្ទាល់ ⭐️
 // ⭐️ ជំនួសមុខងារ Submit Payment ឱ្យអាប់ឡូតផ្ទាល់ពី Frontend ទៅ Firebase Storage
// ⭐️ ជំនួសមុខងារ Submit Payment ឱ្យអាប់ឡូតផ្ទាល់ពី Frontend ទៅ Firebase Storage
  const handleSubmitPayment = async () => {
    const currentUser = auth.currentUser;
    const email = String(currentUser?.email || "").toLowerCase().trim();
    if (!currentUser || !email) {
      setShowLoginModal(true); setLoginPlan(selectedVipPlan); return;
    }
    if (!paymentReceiptFile) {
      alert(appLang === "km" ? "សូម Upload បង្កាន់ដៃបង់ប្រាក់ជាមុនសិន។" : "Please upload your payment receipt first."); return;
    }
    if (paymentReceiptFile.size > 10 * 1024 * 1024) {
      alert(appLang === "km" ? "ឯកសារធំពេក។ សូមប្រើរូបភាព ឬ PDF តូចជាង 10MB។" : "Receipt is too large. Please use an image or PDF under 10MB."); return;
    }
    if (paymentSubmitting) return;

    setPaymentSubmitting(true);
    setError("");
    try {
      const receiptFile = paymentReceiptFile;
      setPaymentSubmitStage(appLang === "km" ? "កំពុង Upload បង្កាន់ដៃទៅ Firebase Storage..." : "Uploading receipt to Firebase Storage...");
      
      // 1. អាប់ឡូតឯកសារផ្ទាល់ពី Frontend ទៅ Firebase Storage
      const filePath = `receipts/${currentUser.uid}_${Date.now()}_${receiptFile.name}`;
      const fileRef = storageRef(storage, filePath);
      const snapshot = await uploadBytes(fileRef, receiptFile);
      
      // 2. យករសជា Download URL សម្រាប់ឱ្យ Admin មើលឃើញ
      const receiptUrl = await getDownloadURL(snapshot.ref);

      setPaymentSubmitStage(appLang === "km" ? "កំពុងរក្សាទុកសំណើបង់ប្រាក់..." : "Saving payment request...");
      const monthlyLimit = Number(selectedPlanLimit) || (selectedVipPlan === "unlimited" ? 50000 : 10000);
      const months = billingCycle === "yearly" ? 12 : 1;
      const totalLimit = monthlyLimit * months;
      
      // 3. រក្សាទុកទិន្នន័យចូលទៅក្នុង Firestore payments Collection
      await addDoc(collection(db, "payments"), {
        email, uid: currentUser.uid, userId: currentUser.uid, userEmail: email,
        packageName: `${selectedPlanName} ${billingCycle}`, plan: selectedVipPlan, billingCycle,
        amount: Number(selectedPlanPrice.toFixed(2)), currency: "USD", status: "pending",
        monthlyCharacterLimit: monthlyLimit, characterLimit: totalLimit, totalCharacterLimit: totalLimit,
        subscriptionMonths: months, bankName: paymentSettings.bankName || "", createdAt: serverTimestamp(),
        source: "khmer-tts-studio", receiptUrl, receiptPath: filePath, receiptStorage: "firebase-storage",
        receiptFileName: receiptFile.name, receiptContentType: receiptFile.type || "application/octet-stream"
      });

      setPaymentReceiptFile(null);
      setHasPendingPayment(true);
      setPaymentRequired(false);
      setShowUpgradeModal(false);
      setShowPaymentSuccess(true); // Show confirmation that admin approval is pending.
    } catch (err) {
      console.error("Payment submission failed:", err);
      const message = appLang === "km"
        ? `មិនអាចផ្ញើសំណើបានទេ៖ ${err?.message || "សូមពិនិត្យ Firebase Rules"}`
        : `Payment request failed: ${err?.message || "Check Firebase Rules."}`;
      setError(message); alert(message);
    } finally {
      setPaymentSubmitting(false); setPaymentSubmitStage("");
    }
  };
  const handleSetPaymentStatus = async (payment, status) => {
    if (status === "approved") return handleApprovePayment(payment);
    try {
      await updateDoc(doc(db, "payments", payment.id), { status, updatedAt: serverTimestamp() });
      if (status === "unapproved") {
        const email = String(payment.email || "").toLowerCase().trim();
        if (email) {
          await setDoc(doc(db, "Users", email), {
            email, role: "free", dailyLimit: Number(paymentSettings.freeLimit) || 200,
            totalCharacterLimit: Number(paymentSettings.freeLimit) || 200,
            vipExpiresAt: "", paymentStatus: "unapproved"
          }, { merge: true });
        }
      }
    } catch (err) {
      console.error("Payment status update failed:", err);
      alert("Could not update payment status: " + (err.message || "Unknown error"));
    }
  };

  const handleDeletePayment = async (payment) => {
    const confirmText = appLang === "km" ? "តើអ្នកចង់លុបកំណត់ត្រាបង់ប្រាក់នេះមែនទេ?" : "Delete this payment record?";
    if (!window.confirm(confirmText)) return;
    try {
      await deleteDoc(doc(db, "payments", payment.id));
      if (payment.receiptPath) {
        try { await deleteObject(storageRef(storage, payment.receiptPath)); }
        catch (storageError) { console.warn("Receipt file cleanup failed:", storageError); }
      }
    } catch (err) {
      console.error("Payment delete failed:", err);
      alert((appLang === "km" ? "មិនអាចលុបបាន៖ " : "Could not delete: ") + (err.message || "Unknown error"));
    }
  };

  const handleEditPayment = async (payment) => {
    const nextAmount = window.prompt("Edit payment amount (USD):", String(payment.amount ?? ""));
    if (nextAmount === null) return;
    const amount = Number(nextAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      alert("Please enter a valid amount.");
      return;
    }
    const nextPackage = window.prompt("Edit package name:", String(payment.packageName || "Plus"));
    if (nextPackage === null) return;
    try {
      await updateDoc(doc(db, "payments", payment.id), {
        amount, packageName: nextPackage.trim(), updatedAt: serverTimestamp()
      });
    } catch (err) {
      alert("Could not edit payment: " + (err.message || "Unknown error"));
    }
  };

  const handleGenerateTTS = async () => {
    if (!text.trim()) {
      setError(t.errorText || "សូមបញ្ចូលអត្ថបទជាមុនសិន!");
      return;
    }
    if (!user) {
      setError(appLang === "km" ? "សូមចូលប្រើប្រាស់ជាមុនសិន!" : "Please sign in first.");
      return;
    }

    const currentTextLength = text.trim().length;
    const usedCharacters = Math.max(0, Number(userUsage.dailyUsed) || 0);
    const remainingCharacters = userUsage.limit === -1 ? Infinity : Math.max(0, userUsage.limit - usedCharacters);
    if (userUsage.limit !== -1 && currentTextLength > remainingCharacters) {
      const errorMsg = appLang === "km"
        ? `អ្នកនៅសល់ ${remainingCharacters.toLocaleString()} តួអក្សរ ប៉ុន្តែអត្ថបទនេះមាន ${currentTextLength.toLocaleString()} តួអក្សរ។ សូមដំឡើងគម្រោង ឬទាក់ទង Admin។`
        : `You have ${remainingCharacters.toLocaleString()} characters remaining, but this request has ${currentTextLength.toLocaleString()}. Upgrade your plan or contact Admin.`;
      setError(errorMsg);
      setShowUpgradeModal(true);
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
        let nextUsed = usedCharacters + currentTextLength;
        try {
          const usageRef = doc(db, "Users", user.uid);
          nextUsed = await runTransaction(db, async (transaction) => {
            const usageSnap = await transaction.get(usageRef);
            const saved = usageSnap.exists() ? usageSnap.data() : {};
            const persistedUsed = Math.max(
              0,
              Number(saved.charactersUsed ?? saved.dailyUsed ?? 0) || 0,
              usedCharacters
            );
            const updatedUsed = persistedUsed + currentTextLength;
            transaction.set(usageRef, {
              charactersUsed: updatedUsed,
              dailyUsed: updatedUsed,
              lastUsedDate: new Date().toISOString().split("T")[0]
            }, { merge: true });
            return updatedUsed;
          });
        } catch (usageSaveError) {
          console.warn("Could not persist character usage:", usageSaveError?.code || usageSaveError?.message || usageSaveError);
        }
        setUserUsage((prev) => ({ ...prev, dailyUsed: nextUsed }));
        if (userUsage.limit !== -1 && nextUsed >= userUsage.limit) {
          setError(appLang === "km"
            ? "អ្នកបានប្រើអស់ចំនួនតួអក្សររបស់គម្រោងហើយ។ សូមទាក់ទង Admin ដើម្បីបន្តប្រើប្រាស់។"
            : "You have used all characters included in your plan. Please upgrade or contact the admin.");
          setShowUpgradeModal(true);
        }

      } else {
        setError(data.error || "មានបញ្ហាក្នុងការបម្លែងសំឡេង!");
      }
    } catch (err) {
      clearInterval(interval);
      console.error("Error generating TTS:", err);
      setError(appLang === "km" ? "មិនអាចតភ្ជាប់ទៅកាន់ Server បានទេ!" : "Could not connect to the server.");
    } finally {
      setTimeout(() => { setLoading(false); setProgress(0); }, 400);
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    try {
      const a = document.createElement("a");
      a.href = audioUrl;
      a.download = `speech_${language}_${voiceType}_${Date.now()}.${audioUrl.startsWith("data:audio/wav") ? "wav" : "mp3"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Download error:", err);
      setError(appLang === "km" ? "មិនអាចទាញយកឯកសារបានទេ!" : "Could not download the audio file.");
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
      const record = {
        email: targetEmail,
        role: userData.role,
        dailyLimit: limitVal,
        customCharacterLimit: userData.customCharacterLimit === true,
        dailyUsed: Number(userData.dailyUsed || 0),
        charactersUsed: Number(userData.dailyUsed || 0),
        totalCharacterLimit: Number.isFinite(limitVal) ? limitVal : 0,
        lastUsedDate: userData.lastUsedDate || new Date().toISOString().split('T')[0],
        paymentDate: userData.paymentDate || "",
        billingCycle: userData.billingCycle || "monthly",
        vipExpiresAt: userData.vipExpiresAt || ""
      };
      await setDoc(doc(db, "Users", targetEmail), record, { merge: true });
      const allUsersSnapshot = await getDocs(collection(db, "Users"));
      const matchingDocs = allUsersSnapshot.docs.filter((snap) => {
        const data = snap.data();
        return snap.id !== targetEmail && String(data.email || "").toLowerCase().trim() === targetEmail;
      });
      for (const matching of matchingDocs) {
        const existing = matching.data();
        await setDoc(doc(db, "Users", matching.id), { ...record, uid: existing.uid || matching.id }, { merge: true });
      }
      alert(userData.id ? "អាប់ដេតព័ត៌មាន User បានដោយជោគជ័យ!" : "បន្ថែម User ថ្មីបានដោយជោគជ័យ!");
    } catch (err) {
      console.error("Error saving user:", err);
      alert("មានបញ្ហាក្នុងការរក្សាទុក User: " + err.message);
    }
  };

  const handleApprovePayment = async (payment) => {
    try {
      const targetEmail = String(payment.email || "").toLowerCase().trim();
      if (!targetEmail) throw new Error("Payment record has no email.");
      const planKey = String(payment.plan || "").toLowerCase().replace(/[_-]/g, " ").trim();
      const packageText = String(payment.packageName || "").toLowerCase().replace(/[_-]/g, " ").trim();
      
      let isUnlimited;
      if (["plus", "pro", "vip pro"].includes(planKey)) {
        isUnlimited = false;
      } else if (["unlimited", "vip", "vip unlimited", "unlimited vip", "premium"].includes(planKey)) {
        isUnlimited = true;
      } else {
        isUnlimited = /(^|\b)(vip unlimited|unlimited|premium|vip)(\b|$)/i.test(packageText)
          && !/\b(vip pro|plus|pro)\b/i.test(packageText);
      }
      const role = isUnlimited ? "vip" : "plus";
      const perMonthLimit = isUnlimited ? 50000 : 10000;
      const billingCycle = String(payment.billingCycle || "monthly").toLowerCase();
      const subscriptionMonths = billingCycle === "yearly" ? 12 : 1;
      const dailyLimit = Number(payment.totalCharacterLimit || payment.characterLimit) > 0
        ? Number(payment.totalCharacterLimit || payment.characterLimit)
        : perMonthLimit * (billingCycle === "yearly" ? 12 : 1);
      const allUsersSnapshot = await getDocs(collection(db, "Users"));
      const matchingUserDocs = allUsersSnapshot.docs.filter((snap) =>
        String(snap.data().email || "").toLowerCase().trim() === targetEmail || snap.id.toLowerCase() === targetEmail
      );
      const existingSnap = matchingUserDocs.find((snap) => snap.id !== targetEmail) || matchingUserDocs[0];
      const existingData = existingSnap ? existingSnap.data() : {};
      // Calculate expiry from the payment date (createdAt), not the day the admin clicks Approve.
      // Monthly plans last 30 days; yearly plans last 365 days.
      const toValidDate = (value) => {
        if (!value) return null;
        try {
          const parsed = typeof value?.toDate === "function"
            ? value.toDate()
            : value instanceof Date
              ? value
              : new Date(value);
          return Number.isNaN(parsed.getTime()) ? null : parsed;
        } catch {
          return null;
        }
      };
      const paymentDate = toValidDate(
        payment.paymentDate || payment.paidAt || payment.createdAt || payment.submittedAt || payment.approvedAt
      ) || new Date();
      const expiry = new Date(paymentDate);
      expiry.setDate(expiry.getDate() + (billingCycle === "yearly" ? 365 : 30));
      const activationData = {
        email: targetEmail,
        role,
        dailyLimit,
        totalCharacterLimit: dailyLimit,
        customCharacterLimit: false,
        dailyUsed: Number(existingData.charactersUsed ?? existingData.dailyUsed ?? 0),
        charactersUsed: Number(existingData.charactersUsed ?? existingData.dailyUsed ?? 0),
        lastUsedDate: existingData.lastUsedDate || new Date().toISOString().split("T")[0],
        paymentDate: paymentDate.toISOString().split("T")[0],
        vipExpiresAt: expiry.toISOString().split("T")[0],
      };
      await setDoc(doc(db, "Users", targetEmail), { ...activationData, paymentStatus: "approved" }, { merge: true });
      const uidCandidates = new Set([String(payment.uid || payment.userId || "").trim()]);
      matchingUserDocs.forEach((snap) => {
        if (snap.id !== targetEmail) uidCandidates.add(String(snap.id));
        const storedUid = String(snap.data().uid || "").trim();
        if (storedUid && storedUid !== targetEmail) uidCandidates.add(storedUid);
      });
      for (const uid of uidCandidates) {
        if (uid) await setDoc(doc(db, "Users", uid), { ...activationData, uid, paymentStatus: "approved" }, { merge: true });
      }
      await updateDoc(doc(db, "payments", payment.id), {
        status: "approved",
        paymentDate: paymentDate.toISOString().split("T")[0],
        vipExpiresAt: expiry.toISOString().split("T")[0],
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      try { const emailResponse = await fetch(`${BACKEND_URL}/api/payment-approved-email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: targetEmail, packageName: payment.packageName || (isUnlimited ? "VIP" : "Plus"), amount: payment.amount || 0 }) }); if (!emailResponse.ok) console.warn("Approval email service returned", emailResponse.status); }
      catch (emailErr) { console.warn("Approval email could not be sent:", emailErr); }
      alert(`Approved ${targetEmail} as ${isUnlimited ? "VIP" : "Plus"}.`);
    } catch (err) {
      console.error("Payment approval failed:", err);
      alert("Could not approve payment: " + (err.message || "Unknown error"));
    }
  };

  const handleDeleteUser = async (userId) => {
    // One click deletes the selected document and duplicate email/UID documents
    // that otherwise make the same user appear to remain in the list.
    try {
      const target = (usersList || []).find((item) => item.id === userId);
      const targetEmail = String(target?.email || (userId.includes("@") ? userId : "")).toLowerCase().trim();
      const candidates = new Set([String(userId)]);
      if (targetEmail) {
        const allUsersSnapshot = await getDocs(collection(db, "Users"));
        allUsersSnapshot.docs.forEach((snap) => {
          const data = snap.data();
          if (String(data.email || "").toLowerCase().trim() === targetEmail || snap.id.toLowerCase() === targetEmail) {
            candidates.add(snap.id);
          }
        });
      }
      await Promise.all([...candidates].map((id) => deleteDoc(doc(db, "Users", id))));
      alert("លុប User បានដោយជោគជ័យ!");
    } catch (err) {
      console.error("Error deleting user:", err);
      alert("មានបញ្ហាក្នុងការលុប User: " + (err.message || "Unknown error"));
    }
  };

  const handleSavePaymentSettings = async (e) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    try {
      // Use one stable document ID so the listener and the save operation never
      // write/read different settings documents after refresh or deployment.
      const settingsToSave = {
        bankName: String(paymentSettings.bankName ?? ""),
        accountNumber: String(paymentSettings.accountNumber ?? ""),
        qrCodeUrl: String(paymentSettings.qrCodeUrl ?? ""),
        gmail: String(paymentSettings.gmail ?? ""),
        telegram: String(paymentSettings.telegram ?? ""),
        pay_month: Number(paymentSettings.pay_month ?? 12),
        freeLimit: Number(paymentSettings.freeLimit ?? 200),
        vipProLimit: Number(paymentSettings.vipProLimit ?? 10000),
        vipProPrice: Number(paymentSettings.vipProPrice ?? 3),
        vipUnlimitedLimit: Number(paymentSettings.vipUnlimitedLimit ?? 50000),
        vipUnlimitedPrice: Number(paymentSettings.vipUnlimitedPrice ?? 14),
        yearlyDiscountPercent: Number(paymentSettings.yearlyDiscountPercent ?? 10),
        updatedAt: serverTimestamp()
      };
      // Keep private payment details in settings; publish only non-sensitive plan data
      // separately so the Plans page can read current prices before login.
      await Promise.all([
        setDoc(doc(db, "settings", SETTINGS_DOC_ID), settingsToSave, { merge: true }),
        setDoc(doc(db, "publicConfig", "pricing"), {
          freeLimit: settingsToSave.freeLimit,
          vipProLimit: settingsToSave.vipProLimit,
          vipProPrice: settingsToSave.vipProPrice,
          vipUnlimitedLimit: settingsToSave.vipUnlimitedLimit,
          vipUnlimitedPrice: settingsToSave.vipUnlimitedPrice,
          yearlyDiscountPercent: settingsToSave.yearlyDiscountPercent,
          updatedAt: serverTimestamp()
        }, { merge: true })
      ]);
      setPaymentSettings((previous) => ({ ...previous, ...settingsToSave, docId: SETTINGS_DOC_ID }));
      alert("រក្សាទុកព័ត៌មានទូទាត់ និង Pricing Settings ចូល Firestore បានដោយជោគជ័យ!");
    } catch (err) {
      console.error("Error saving payment settings:", err);
      alert("មានបញ្ហាក្នុងការរក្សាទុក: " + (err?.message || "Unknown error"));
    }
  };

  const openGmail = () => {
    const recipient = paymentSettings.gmail || "seyhaemdev@gmail.com";
    const subject = encodeURIComponent(`VIP Payment - ${selectedPlanName} (${billingCycle}) - $${selectedPlanPrice.toFixed(2)}`);
    const body = encodeURIComponent(`Hello Admin,\n\nI would like to request/confirm ${selectedPlanName}.\nBilling cycle: ${billingCycle}.\nAmount: $${selectedPlanPrice.toFixed(2)}.\nUser Email: ${user?.email || ""}\n\nI have uploaded my payment receipt.`);
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${recipient}&su=${subject}&body=${body}`, "_blank");
  };

  const usagePercentage = userUsage.role === "admin" || userUsage.limit === -1 
    ? 0 
    : Math.min(100, (userUsage.dailyUsed / userUsage.limit) * 100);

  const qrImageFallbacks = getGoogleDriveImageFallbacks(paymentSettings.qrCodeUrl);
  const qrImageSrc = qrImageFallbacks[qrFallbackIndex] || formatGoogleDriveUrl(paymentSettings.qrCodeUrl);
  useEffect(() => { setQrImageFailed(false); setQrFallbackIndex(0); }, [paymentSettings.qrCodeUrl]);
  const discountPercent = Math.max(0, Math.min(100, Number(paymentSettings.yearlyDiscountPercent ?? 10)));
  const discountMultiplier = 1 - (discountPercent / 100);
  const vipProYearlyPrice = (Number(paymentSettings.vipProPrice || 0) * 12 * discountMultiplier).toFixed(2);
  const vipUnlimitedYearlyPrice = (Number(paymentSettings.vipUnlimitedPrice || 0) * 12 * discountMultiplier).toFixed(2);
  const selectedPlanName = selectedVipPlan === "unlimited" ? "VIP" : "Plus";
  const selectedMonthlyPrice = Number(selectedVipPlan === "unlimited" ? paymentSettings.vipUnlimitedPrice : paymentSettings.vipProPrice) || 0;
  const selectedYearlyPrice = Number(selectedVipPlan === "unlimited" ? vipUnlimitedYearlyPrice : vipProYearlyPrice) || 0;
  const selectedPlanPrice = billingCycle === "yearly" ? selectedYearlyPrice : selectedMonthlyPrice;
  const selectedPlanLimit = Number(selectedVipPlan === "unlimited" ? paymentSettings.vipUnlimitedLimit : paymentSettings.vipProLimit) || 0;
  const selectedPlanDuration = billingCycle === "yearly" ? 12 : 1;

  const userIsAdmin = user && (isAdmin || userUsage.role === "admin" || user.email?.toLowerCase().trim() === "seyhaemdev@gmail.com");

  // On refresh, show a full-screen spinner until Firebase auth and the data
  // required for the correct screen have finished loading. This prevents the
  // previous/default UI from flashing before the final screen is known.
  const appStartupLoading = !authReady || (!user && !pricingLoaded) || (Boolean(user) && dbLoading);
  if (appStartupLoading) {
    return (
      <div className="app-startup-loading" role="status" aria-live="polite">
        <LoaderCircle className="app-startup-spinner" size={48} strokeWidth={2.5} aria-hidden="true" />
        <p>{appLang === "km" ? "កំពុងផ្ទុកកម្មវិធី... សូមរង់ចាំ" : "Loading app... Please wait"}</p>
      </div>
    );
  }

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

        {(!authReady || (user && !userIsAdmin && dbLoading)) ? (
          <div style={{ minHeight: "40vh", display: "grid", placeItems: "center", color: "#64748b" }}>Loading...</div>
        ) : (vipLoginPending || (paymentRequired && user && !userIsAdmin)) ? (
          <div style={{ minHeight: "55vh", display: "grid", placeItems: "center", textAlign: "center", color: "#475569", padding: "24px" }}>
            <div>
              <Crown size={38} style={{ color: "#7c3aed", marginBottom: "12px" }} />
              <h2 style={{ margin: "0 0 8px", color: "#0f172a" }}>{appLang === "km" ? "កំពុងផ្ទៀងផ្ទាត់គម្រោង" : "Checking plan status"}</h2>
              <p style={{ margin: 0 }}>{appLang === "km" ? "សូមរង់ចាំបន្តិច..." : "Please wait..."}</p>
            </div>
          </div>
        ) : !user ? (
          <PlansLanding
            appLang={appLang}
            settings={paymentSettings}
            pricingLoaded={pricingLoaded}
            pricingAvailable={pricingAvailable}
            onFreeClick={() => requestLogin("free")}
            onVipClick={(plan) => requestLogin(plan)}
            isLoggingIn={isLoggingIn}
            t={t}
          />
        ) : currentTab === "user" ? (
          <>
          {hasPendingPayment && (
            <div role="status" style={{ maxWidth: 800, margin: "18px auto 0", padding: "14px 18px", borderRadius: 12, border: "1px solid #fcd34d", background: "#fffbeb", color: "#92400e", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Crown size={20} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>{appLang === "km" ? "កំពុងរង់ចាំ Admin បញ្ជាក់ការទូទាត់" : "Waiting for admin payment confirmation"}</strong>
                <div style={{ marginTop: 4, fontSize: 13 }}>{appLang === "km" ? "សំណើបង់ប្រាក់របស់អ្នកបានទទួលហើយ។ អ្នកអាចប្រើគម្រោង Free ខណៈពេលរង់ចាំការអនុម័ត។" : "Your payment request was received. You can continue using the Free plan while waiting for approval."}</div>
              </div>
            </div>
          )}
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
          </>
        ) : (
          <AdminPanel 
            appLang={appLang}
            paymentSettings={paymentSettings}
            setPaymentSettings={setPaymentSettings}
            handleSavePaymentSettings={handleSavePaymentSettings}
            paymentsList={paymentsList}
            handleApprovePayment={handleApprovePayment}
            handleSetPaymentStatus={handleSetPaymentStatus}
            handleEditPayment={handleEditPayment}
            handleDeletePayment={handleDeletePayment}
            usersList={usersList}
            handleSaveUser={handleSaveUser}
            handleDeleteUser={handleDeleteUser}
          />
        )}
      </main>

      {showPaidApprovalModal && (
        <div role="dialog" aria-modal="true" aria-labelledby="payment-approved-title" className="modal-overlay" style={{ position: "fixed", inset: 0, zIndex: 10001, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,.72)", padding: 16 }}>
          <div style={{ width: "100%", maxWidth: 440, background: "#fff", color: "#0f172a", borderRadius: 18, padding: 28, textAlign: "center", boxShadow: "0 24px 70px rgba(0,0,0,.25)" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#dcfce7", color: "#15803d", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <Shield size={34} />
            </div>
            <h2 id="payment-approved-title" style={{ margin: "0 0 10px", fontSize: 22 }}>
              {appLang === "km" ? "ការបង់ប្រាក់របស់អ្នកត្រូវបានអនុម័ត!" : "Your payment has been approved!"}
            </h2>
            <p style={{ margin: "0 0 22px", lineHeight: 1.6, color: "#475569" }}>
              {appLang === "km" ? "Admin បានអនុម័តគណនីរបស់អ្នករួចរាល់ហើយ។ ចុចប៊ូតុងខាងក្រោម ដើម្បីចូលប្រើកម្មវិធី។" : "The admin has approved your payment. Click below to enter the project."}
            </p>
            <button type="button" onClick={() => setShowPaidApprovalModal(false)} style={{ width: "100%", border: 0, borderRadius: 10, padding: "12px 18px", background: "#15803d", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 15 }}>
              {appLang === "km" ? "ចូលទៅកម្មវិធី" : "Go to project"}
            </button>
          </div>
        </div>
      )}

      {showPaymentSuccess && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,.62)", padding: 20 }} role="dialog" aria-modal="true">
          <div className="modal-content" style={{ width: "min(440px, 100%)", textAlign: "center", borderRadius: 18, padding: 30, background: "#fff", boxShadow: "0 24px 70px rgba(0,0,0,.25)" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 16px", display: "grid", placeItems: "center", background: "#dcfce7", color: "#15803d", fontSize: 34 }}>✓</div>
            <h2 style={{ margin: "0 0 12px", color: "#166534" }}>{appLang === "km" ? "បានដាក់ស្នើដោយជោគជ័យ" : "Submit Successfully"}</h2>
            <p style={{ color: "#334155", lineHeight: 1.7, marginBottom: 22 }}>{appLang === "km" ? "សំណើបង់ប្រាក់របស់អ្នកត្រូវបានរក្សាទុក។ សូមរង់ចាំ Admin អនុម័ត។" : "Your payment request has been submitted. Please wait for approval from admin."}</p>
            <button type="button" onClick={() => setShowPaymentSuccess(false)} style={{ border: 0, borderRadius: 10, padding: "11px 26px", color: "#fff", background: "#15803d", fontWeight: 700, cursor: "pointer" }}>{appLang === "km" ? "យល់ព្រម" : "OK"}</button>
          </div>
        </div>
      )}

      {showLoginModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Google sign in">
          <div className="modal-content login-modal-card">
            <button className="modal-close" onClick={() => setShowLoginModal(false)} aria-label="Close"><X size={20} /></button>
            <div className="login-modal-icon"><User size={27} /></div>
            <h2>{appLang === "km" ? "ចូលដោយគណនី Google" : "Continue with Google"}</h2>
            <p>{appLang === "km" ? "សូមជ្រើសរើស Gmail ដែលអ្នកចង់ប្រើសម្រាប់ Text-Speech។ សម្រាប់ VIP សូមប្រើ Gmail ដូចគ្នានឹងការបង់ប្រាក់។" : "Choose the Gmail account you want to use. VIP approval must match this email address."}</p>
            <div className="login-account-hint">{loginPlan === "free" ? (appLang === "km" ? "គម្រោងឥតគិតថ្លៃ" : "Free plan") : (loginPlan === "unlimited" ? "VIP" : "Plus")}</div>
            <button className="google-login-button" onClick={continueLogin} disabled={isLoggingIn}>
              <span className="google-g-mark">G</span>{isLoggingIn ? (appLang === "km" ? "កំពុងចូល..." : "Signing in...") : (appLang === "km" ? "បន្តជាមួយ Google" : "Continue with Google")}
            </button>
            <button className="login-cancel-button" onClick={() => setShowLoginModal(false)}>{appLang === "km" ? "បោះបង់" : "Cancel"}</button>
          </div>
        </div>
      )}

      {showUpgradeModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ borderRadius: "16px", padding: "24px", maxWidth: "550px", width: "90%" }}>
            <button className="modal-close" onClick={() => { setShowUpgradeModal(false); try { localStorage.removeItem("textSpeechPendingVipPlan"); } catch {} }} aria-label={appLang === "km" ? "បិទបង្អួចបង់ប្រាក់" : "Close payment window"} title={appLang === "km" ? "បិទ / បោះបង់" : "Close / Cancel"}>
              <X size={20} />
            </button>

            <div style={{ textAlign: "center", marginBottom: "18px" }}>
              <div style={{ margin: "0 auto 10px", width: 54, height: 54, display: "grid", placeItems: "center", borderRadius: 16, color: "#fff", background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}><Crown size={26} /></div>
              <h2 style={{ margin: 0, color: "#0f172a", fontSize: "1.45rem" }}>{appLang === "km" ? `បង់ប្រាក់សម្រាប់ ${selectedPlanName}` : `Payment for ${selectedPlanName}`}</h2>
              <p style={{ margin: "6px 0 0 0", color: "#64748b", fontSize: "13px" }}>{appLang === "km" ? "ជ្រើសរើសរយៈពេល ហើយស្កែន QR Code ដើម្បីបង់ប្រាក់" : "Choose a billing period, then scan the QR code to pay."}</p>
            </div>

            <div style={{ display: "flex", gap: "8px", marginBottom: "18px", background: "#f1f5f9", padding: "5px", borderRadius: "12px" }}>
              <button onClick={() => setBillingCycle("monthly")} style={{ flex: 1, padding: "11px 10px", background: billingCycle === "monthly" ? "#4f46e5" : "transparent", color: billingCycle === "monthly" ? "#fff" : "#475569", border: "none", borderRadius: "9px", cursor: "pointer", fontWeight: 700 }}>
                {appLang === "km" ? "ប្រចាំខែ" : "Monthly"}
              </button>
              <button onClick={() => setBillingCycle("yearly")} style={{ flex: 1, padding: "11px 10px", background: billingCycle === "yearly" ? "#059669" : "transparent", color: billingCycle === "yearly" ? "#fff" : "#475569", border: "none", borderRadius: "9px", cursor: "pointer", fontWeight: 700 }}>
                {appLang === "km" ? "ប្រចាំឆ្នាំ" : "Yearly"} <span style={{ background: "#fef3c7", color: "#92400e", fontSize: "10px", padding: "2px 6px", borderRadius: "10px", marginLeft: "4px" }}>{discountPercent}% OFF</span>
              </button>
            </div>

            <div style={{ border: "1px solid #dbeafe", background: "linear-gradient(135deg,#eff6ff,#faf5ff)", borderRadius: "16px", padding: "18px", marginBottom: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                <div>
                  <div style={{ color: "#4f46e5", fontWeight: 800, fontSize: 12, letterSpacing: ".06em" }}>{appLang === "km" ? "គម្រោងដែលបានជ្រើស" : "SELECTED PLAN"}</div>
                  <h3 style={{ margin: "5px 0", color: "#111827", fontSize: 20 }}>{selectedPlanName}</h3>
                  <div style={{ color: "#64748b", fontSize: 12 }}>{(selectedPlanLimit * selectedPlanDuration).toLocaleString()} {appLang === "km" ? "តួអក្សរសរុបក្នុងរយៈពេលនេះ" : "total characters for this period"}</div>
                </div>
                <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <div style={{ color: "#111827", fontWeight: 800, fontSize: 28 }}>${selectedPlanPrice.toFixed(2)}</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>{billingCycle === "yearly" ? (appLang === "km" ? "សម្រាប់ ១ ឆ្នាំ" : "per year") : (appLang === "km" ? "ក្នុងមួយខែ" : "per month")}</div>
                  {billingCycle === "yearly" && discountPercent > 0 && <div style={{ color: "#047857", fontSize: 11 }}>{appLang === "km" ? `សន្សំ ${discountPercent}%` : `Save ${discountPercent}%`}</div>}
                </div>
              </div>
            </div>

            <div className="qr-section" style={{ textAlign: "center", background: "#f8fafc", padding: "16px", borderRadius: "14px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
              <h4 style={{ margin: "0 0 12px", fontSize: "14px", color: "#1e293b" }}>{appLang === "km" ? "ស្កែន QR Code ដើម្បីទូទាត់" : "Scan QR code to pay"} · {paymentSettings.bankName || ""}</h4>
              <div className="qr-box" style={{ display: "inline-block", background: "#ffffff", padding: "10px", borderRadius: "12px", boxShadow: "0 2px 12px rgba(15,23,42,.08)" }}>
                {qrImageSrc && !qrImageFailed ? (
                  <img key={qrImageSrc} src={qrImageSrc} alt="Payment QR code" referrerPolicy="no-referrer" onError={() => { if (qrFallbackIndex + 1 < qrImageFallbacks.length) setQrFallbackIndex((index) => index + 1); else setQrImageFailed(true); }} style={{ width: "220px", height: "220px", borderRadius: "8px", objectFit: "contain" }} />
                ) : (
                  <div style={{ width: 220, minHeight: 150, display: "grid", placeItems: "center", padding: 14, boxSizing: "border-box", color: "#92400e", fontSize: 12, background: "#fffbeb", borderRadius: 8 }}>
                    <div><Database size={24} style={{ marginBottom: 8 }} /><div>{appLang === "km" ? "QR Code មិនអាចបង្ហាញបានទេ។" : "QR code could not load."}</div></div>
                  </div>
                )}
                <div style={{ marginTop: "10px", fontSize: "13px", fontWeight: "bold", color: "#0f172a" }}>{paymentSettings.bankName}: {paymentSettings.accountNumber}</div>
              </div>
              <div style={{ marginTop: 12, fontSize: 13, color: "#334155" }}><strong>{appLang === "km" ? "ចំនួនត្រូវបង់៖" : "Amount due:"} ${selectedPlanPrice.toFixed(2)}</strong></div>
            </div>

            <div style={{ margin: "14px 0", padding: 14, border: "1px dashed #94a3b8", borderRadius: 10, background: "#f8fafc" }}>
              <label htmlFor="payment-receipt-upload" style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>
                {appLang === "km" ? "បង្ហោះបង្កាន់ដៃបង់ប្រាក់ (រូបភាព ឬ PDF)" : "Upload payment receipt (image or PDF)"}
              </label>
              <input id="payment-receipt-upload" type="file" accept="image/*,application/pdf" onChange={(e) => setPaymentReceiptFile(e.target.files?.[0] || null)} style={{ width: "100%" }} />
              {paymentReceiptFile && <p style={{ marginTop: 6, fontSize: 12, color: "#166534" }}>{paymentReceiptFile.name}</p>}
            </div>

            <div className="contact-buttons" style={{ textAlign: "center" }}>
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
                  <Mail size={16} /> {appLang === "km" ? "ផ្ញើតាម Gmail" : "Send via Gmail"}
                </button>
              </div>
              <button
                type="button"
                onClick={handleSubmitPayment}
                disabled={paymentSubmitting}
                style={{ width: "100%", marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: paymentSubmitting ? "#94a3b8" : "linear-gradient(135deg,#059669,#047857)", color: "#fff", border: 0, padding: "13px 16px", borderRadius: 10, fontWeight: 800, cursor: paymentSubmitting ? "wait" : "pointer" }}
              >
                {paymentSubmitting ? (appLang === "km" ? paymentSubmitStage || "កំពុងផ្ញើ..." : "Submitting...") : (appLang === "km" ? "ខ្ញុំបានបង់ប្រាក់ — ផ្ញើសំណើទៅ Admin" : "I have paid — submit payment request")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;