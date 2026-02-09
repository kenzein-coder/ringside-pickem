/**
 * Firebase configuration and initialized services.
 * Used by App and scripts that need auth, Firestore, or Storage.
 */
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let firebaseError = null;
let app, auth, db, storage;

try {
  if (!firebaseConfig.apiKey) {
    throw new Error('Firebase API Key is missing. Set VITE_FIREBASE_API_KEY in .env');
  }
  if (firebaseConfig.apiKey.includes('...') || firebaseConfig.apiKey.includes('your_')) {
    throw new Error('Firebase API Key looks like a placeholder. Use your real API key.');
  }
  if (firebaseConfig.apiKey.length < 20) {
    throw new Error('Firebase API Key is too short. Check your .env.');
  }
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} catch (error) {
  console.error('Firebase initialization error:', error);
  firebaseError = error.message;
}

const appId = firebaseConfig.projectId || 'default-app-id';
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export { app, auth, db, storage, appId, googleProvider, firebaseError };
