/**
 * firebase.js — конфигурация Firebase-проекта DevOPS Clicker.
 * Публичные ключи веб-конфига не являются секретом: доступ ограничивается
 * правилами безопасности (см. firestore.rules, database.rules.json).
 */

export const firebaseConfig = {
  apiKey: "AIzaSyBfbeZwkh1SbSYcMubQsiA1txm8kCp4cXI",
  authDomain: "devops-clicker.firebaseapp.com",
  projectId: "devops-clicker",
  storageBucket: "devops-clicker.firebasestorage.app",
  messagingSenderId: "914100180294",
  appId: "1:914100180294:web:99195676c0ab8bd4118147",
  measurementId: "G-6QSTX2EDLN",
};

/** Cloud Firestore — сейвы и таблица лидеров */
export const FIRESTORE_COLLECTIONS = {
  saves: "saves",
  leaderboard: "leaderboard",
};

/** Realtime Database — лёгкая таблица лидеров для анонимных игроков */
export const RTDB_LEADERBOARD_PATH = "leaderboard";
export const RTDB_RANKING_RULES = ".value"; // ранжируем по числовому значению напрямую

/** Как часто слать облачный апсейв (мс), если игра активна и есть изменения */
export const CLOUD_SYNC_INTERVAL_MS = 30_000;

/** Период обновления таблицы лидеров из облака (мс) */
export const LEADERBOARD_REFRESH_MS = 60_000;

/** Лимит записей в топе */
export const LEADERBOARD_TOP_N = 20;
