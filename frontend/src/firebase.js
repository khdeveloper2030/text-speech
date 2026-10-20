import { initializeApp, getApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase settings come from frontend/.env (Create React App).
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: "G-L0VVCLWL85",
};

const requiredConfigKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
];
const missingConfigKeys = requiredConfigKeys.filter(
  (key) => !firebaseConfig[key] || !String(firebaseConfig[key]).trim()
);

if (missingConfigKeys.length > 0) {
  throw new Error(
    `Firebase configuration is incomplete. Check frontend/.env: ${missingConfigKeys.join(", ")}`
  );
}

// Prevent duplicate-app errors during React development hot reload.
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
// Keep Google login active after refresh and across browser sessions.
export const authPersistenceReady = setPersistence(auth, browserLocalPersistence);
export const db = getFirestore(app);
// Use the bucket value exactly as configured. Firebase accepts a bucket name or gs:// URL.
const configuredBucket = String(firebaseConfig.storageBucket || "").trim();
const normalizedBucket = configuredBucket.replace(/^gs:\/\//i, "").replace(/\/$/, "");
export const storage = normalizedBucket ? getStorage(app, `gs://${normalizedBucket}`) : getStorage(app);

export const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

export const signInWithGoogle = async () => {
  try {
    await authPersistenceReady;
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    if (
      error?.code === "auth/cancelled-popup-request" ||
      error?.code === "auth/popup-closed-by-user"
    ) {
      console.info("Google Login was cancelled or the popup was closed.");
      return null;
    }

    console.error("Google sign-in failed:", error?.code || "unknown", error);
    throw error;
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout failed:", error?.code || "unknown", error);
    throw error;
  }
};

export default app;
