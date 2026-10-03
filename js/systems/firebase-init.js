/**
 * firebase-init.js — инициализация Firebase (App / Auth / Firestore).
 *
 * SDK подключается как вендорный бандл `vendor/firebase-app-compat.js`
 * (собирается из npm-пакета `firebase` командой `npm run build:vendor`),
 * поэтому игра остаётся статическим сайтом без сборщика в рантайме.
 *
 * Все операции с БД деградируют мягко: если Firebase недоступен
 * (офлайн, правила безопасности, блокировщик) — игра живёт на localStorage.
 */

import { firebaseConfig } from "../config/firebase.js";

let _app = null;       // firebase.app()
let _auth = null;      // firebase.auth()
let _db = null;        // firebase.firestore()
let _ready = false;
let _failed = false;

/** Подгружаем compat-бандл один раз */
function loadSdk() {
  if (window.firebase) return Promise.resolve(window.firebase);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "vendor/firebase-app-compat.js";
    s.async = true;
    s.onload = () => resolve(window.firebase);
    s.onerror = () => reject(new Error("Firebase SDK не загрузился"));
    document.head.appendChild(s);
  });
}

/**
 * Инициализировать Firebase. Идемпотентно.
 * @returns {Promise<{app:any, auth:any, db:any}|null>} null при ошибке
 */
export async function initFirebase() {
  if (_ready) return { app: _app, auth: _auth, db: _db };
  if (_failed) return null;
  try {
    const fb = await loadSdk();
    _app = fb.initializeApp(firebaseConfig);
    _auth = fb.auth();
    _db = fb.firestore();
    // Быстрый таймаут: при недоступной сети get() может висеть долго
    _db.settings({ ignoreUndefinedProperties: true });
    _ready = true;
    return { app: _app, auth: _auth, db: _db };
  } catch (err) {
    _failed = true;
    console.warn("[firebase] init failed:", err);
    return null;
  }
}

/** Готов ли Firebase (синхронный геттер для UI) */
export const isFirebaseReady = () => _ready && !_failed;

/** Статус одной строкой для терминала/настроек */
export function firebaseStatusText() {
  if (_ready && !_failed) return `connected (project: ${firebaseConfig.projectId})`;
  if (_failed) return "ERROR: SDK init failed";
  return "initializing…";
}

export const getDb = () => _db;
export const getAuth = () => _auth;
export const getApp = () => _app;
