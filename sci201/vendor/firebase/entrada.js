export { initializeApp } from 'firebase/app';
export {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut,
  onAuthStateChanged, connectAuthEmulator, browserLocalPersistence, indexedDBLocalPersistence, initializeAuth,
  browserPopupRedirectResolver, signInWithCredential,
} from 'firebase/auth';
export {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator,
  doc, collection, getDoc, setDoc, updateDoc, deleteDoc, addDoc, onSnapshot, query, where, orderBy, limit, getDocs,
  serverTimestamp, deleteField, waitForPendingWrites, writeBatch, arrayUnion, arrayRemove, Timestamp,
} from 'firebase/firestore';
