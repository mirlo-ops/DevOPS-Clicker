/**
 * firebase-shim.js — ESM-обёртка над Firebase compat (window.firebase).
 * Генерируется из node_modules/firebase/compat (см. package.json: npm run build:vendor).
 */
const fb = window.firebase;
export const initializeApp = fb.initializeApp;
export const getApp = fb.getApp;
export const getApps = fb.getApps;
export const getAuth = fb.auth;
export const GoogleAuthProvider = fb.auth.GoogleAuthProvider;
export const signInAnonymously = fb.auth.signInAnonymously;
export const signInWithPopup = fb.auth.signInWithPopup;
export const signOut = fb.auth.signOut;
export const onAuthStateChanged = fb.auth.onAuthStateChanged;
export const getDatabase = fb.database;
export const ref = fb.database.ref;
export const get = fb.database.get;
export const set = fb.database.set;
export const update = fb.database.update;
export const onChildChanged = fb.database.onChildChanged;
export const off = (r, type, cb) => r.off(type, cb);
export const query = fb.database.query;
export const orderByChild = fb.database.orderByChild;
export const limitToLast = fb.database.limitToLast;
export const increment = fb.database.ServerValue.increment;
export const serverTimestamp = fb.database.ServerValue.TIMESTAMP;
export const getFirestore = fb.firestore;
export const getAnalytics = () => null; // analytics не требуется для БД
