import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "skilled-circle-qxctm",
  appId: "1:236161581367:web:14670a5e2ff2479c479ab2",
  apiKey: "AIzaSyALe2Ni26qY76ph_ZTWLH5xzS2Toh1Itrw",
  authDomain: "skilled-circle-qxctm.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-niftyaccumulatio-cf25d571-935b-4a4e-b86b-5876fa8a722c",
  storageBucket: "skilled-circle-qxctm.firebasestorage.app",
  messagingSenderId: "236161581367",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
