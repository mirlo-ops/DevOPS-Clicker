/**
 * firebase-db.js — слой работы с базой данных Firebase (Cloud Firestore).
 *
 * Коллекции:
 *   saves/{uid}        — облачная копия сохранения игрока
 *   leaderboard/{uid}  — публичный профиль для таблицы лидеров
 *
 * Принципы:
 *  - localStorage остаётся основным сейвом (мгновенные автосейвы);
 *    в облако пишем не чаще CLOUD_SYNC_INTERVAL_MS и только при dirty;
 *  - любая сетевая ошибка не роняет игру — статус показывается в UI;
 *  - конкурентные записи разрешаются по lastSave (кто новее, того и сейв),
 *    запись идёт через setDoc(merge) c optimistic-concurrency проверкой.
 */

import { serialize } from "./save.js";
import { importSaveFromString } from "./load.js";
import { state } from "../core/state.js";
import { getUid, isSignedIn } from "./firebase-auth.js";
import { initFirebase } from "./firebase-init.js";
import {
  FIRESTORE_COLLECTIONS,
  LEADERBOARD_TOP_N,
  LEADERBOARD_REFRESH_MS,
  CLOUD_SYNC_INTERVAL_MS,
} from "../config/firebase.js";

/* ================= Состояние синка ================= */

const sync = {
  lastPushAt: 0,
  lastPullAt: 0,
  lastError: null,
  pending: false,
};

export const getSyncStatus = () => ({ ...sync });

/* ================= Чтение/запись сейва ================= */

/**
 * Загрузить облачный сейв текущего пользователя.
 * @returns {Promise<{data:object|null, error:string|null}>}
 */
export async function fetchCloudSave() {
  if (!isSignedIn()) return { data: null, error: "no-user" };
  try {
    const ctx = await initFirebase();
    if (!ctx) return { data: null, error: "no-firebase" };
    const snap = await ctx.db.collection(FIRESTORE_COLLECTIONS.saves).doc(getUid()).get();
    sync.lastError = null;
    if (!snap.exists) return { data: null, error: null };
    return { data: snap.data(), error: null };
  } catch (err) {
    sync.lastError = err?.code ?? String(err);
    console.warn("[cloud] fetchCloudSave failed:", err);
    return { data: null, error: sync.lastError };
  }
}

/** Собрать «профиль» для лидерборда из текущего состояния */
export function buildLeaderboardEntry() {
  const name = (state.settings.playerName || "").trim() || "anonymous engineer";
  return {
    name: name.slice(0, 32),
    lifetimeCommits: Math.floor(state.resources.lifetimeCommits),
    bestCps: state.derived?.cps ?? 0,
    prestigeCount: state.stats.prestige.count,
    achievements: Object.keys(state.achievements).length,
    playTimeMs: state.stats.playTimeMs,
    updatedAt: Date.now(),
  };
}

/**
 * Записать состояние в облако (сейв + лидерборд).
 * @returns {Promise<boolean>}
 */
export async function pushCloudSave() {
  if (!isSignedIn()) return false;
  const ctx = await initFirebase();
  if (!ctx) return false;
  sync.pending = true;
  try {
    const payload = JSON.parse(serialize()); // сериализуем так же, как в localStorage
    const uid = getUid();
    const savesCol = ctx.db.collection(FIRESTORE_COLLECTIONS.saves);
    const lbCol = ctx.db.collection(FIRESTORE_COLLECTIONS.leaderboard);

    // Protect: не перезаписывать более свежий облачный сейв более старым локальным
    const remote = await savesCol.doc(uid).get();
    const remoteLastSave = remote.exists ? Number(remote.data()?.lastSave) || 0 : 0;
    if (remoteLastSave > payload.lastSave && remoteLastSave - payload.lastSave > 5_000) {
      // облако новее — пропустить пуш (пользователю предложим pull)
      sync.lastError = "remote-newer";
      sync.pending = false;
      return false;
    }

    await Promise.all([
      savesCol.doc(uid).set(payload),
      lbCol.doc(uid).set(buildLeaderboardEntry()),
    ]);
    sync.lastPushAt = Date.now();
    sync.lastError = null;
    sync.pending = false;
    return true;
  } catch (err) {
    sync.lastError = err?.code ?? String(err);
    sync.pending = false;
    console.warn("[cloud] pushCloudSave failed:", err);
    return false;
  }
}

/**
 * Применить облачный сейв локально (pull).
 * @returns {Promise<'loaded'|'empty'|string>} статус или код ошибки
 */
export async function pullCloudSave() {
  const { data, error } = await fetchCloudSave();
  if (error) return error;
  if (!data) return "empty";
  try {
    importSaveFromString(JSON.stringify(data));
    sync.lastPullAt = Date.now();
    sync.lastError = null;
    return "loaded";
  } catch (err) {
    sync.lastError = "corrupted";
    return "corrupted";
  }
}

/* ================= Таблица лидеров ================= */

let lbCache = { at: 0, rows: [] };

/**
 * Топ игроков по lifetimeCommits (сортировка на клиенте после чтения
 * небольшой выборки; для масштаба добавается составной индекс в rules).
 */
export async function fetchLeaderboard(force = false) {
  const now = Date.now();
  if (!force && now - lbCache.at < LEADERBOARD_REFRESH_MS) return lbCache.rows;
  const ctx = await initFirebase();
  if (!ctx) return lbCache.rows;
  try {
    const snap = await ctx.db
      .collection(FIRESTORE_COLLECTIONS.leaderboard)
      .orderBy("lifetimeCommits", "desc")
      .limit(LEADERBOARD_TOP_N)
      .get();
    const me = getUid();
    lbCache = {
      at: now,
      rows: snap.docs.map((d) => ({ id: d.id, me: d.id === me, ...d.data() })),
    };
    sync.lastError = null;
  } catch (err) {
    sync.lastError = err?.code ?? String(err);
    console.warn("[cloud] leaderboard failed:", err);
  }
  return lbCache.rows;
}

export const getCachedLeaderboard = () => lbCache.rows;

/* ================= Периодический облачный синк ================= */

let cloudTimer = null;

/**
 * Запустить фоновый облачный синк: раз в CLOUD_SYNC_INTERVAL_MS
 * отправляем сейв, если были изменения (dirty) и игрок авторизован.
 */
export function startCloudSync(onEvent) {
  stopCloudSync();
  cloudTimer = setInterval(async () => {
    if (!isSignedIn()) return;
    if (document.hidden) return;              // не жжём трафик в фоне
    if (!state.flags.dirty) return;           // ничего не изменилось
    const ok = await pushCloudSave();
    onEvent?.(ok ? "pushed" : "failed", sync.lastError);
  }, CLOUD_SYNC_INTERVAL_MS);
}

export const stopCloudSync = () => {
  if (cloudTimer !== null) clearInterval(cloudTimer);
  cloudTimer = null;
};

/** Финальный синк при закрытии вкладки (fire-and-forget) */
export function bindCloudLifecycle() {
  window.addEventListener("beforeunload", () => {
    if (isSignedIn() && state.flags.dirty) pushCloudSave();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && isSignedIn() && state.flags.dirty) pushCloudSave();
  });
}
