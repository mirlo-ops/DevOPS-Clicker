/**
 * load.js — загрузка, валидация и миграция сохранений.
 * Повреждённое сохранение не должно ронять игру: недостающие поля
 * добираются из чистого состояния (deep-merge поверх createInitialState).
 */

import { state, createInitialState, markDirty } from "../core/state.js";
import { SAVE_KEY, SAVE_VERSION } from "../config/constants.js";
import { storageGet, storageSet, storageRemove, jsonParseSafe } from "../utils/storage.js";
import { safeNum } from "../utils/format.js";

/** Рекурсивный merge: значения из saved поверх defaults */
function deepMerge(defaults, saved) {
  if (saved === null || saved === undefined) return defaults;
  if (Array.isArray(defaults)) return Array.isArray(saved) ? saved : defaults;
  if (typeof defaults === "object" && typeof saved === "object") {
    const out = { ...defaults };
    for (const key of Object.keys(defaults)) {
      out[key] = deepMerge(defaults[key], saved[key]);
    }
    return out;
  }
  // Примитивы: принимаем saved только совместимого типа
  if (typeof defaults === "number") {
    const n = safeNum(saved);
    return Number.isFinite(n) ? n : defaults;
  }
  if (typeof defaults === typeof saved) return saved;
  return defaults;
}

/** Миграции между версиями схемы. Каждая — функция (data) => data */
const MIGRATIONS = {
  // пример для будущих версий:
  // 2: (d) => ({ ...d, newField: 0 }),
};

function migrate(data) {
  let d = data;
  let v = safeNum(d.version) || 1;
  while (v < SAVE_VERSION) {
    const step = MIGRATIONS[v + 1];
    if (!step) break;
    d = step(d);
    v += 1;
  }
  return d;
}

/** Санаторы зданий/апгрейдов: отбрасываем неизвестные id и мусор */
function sanitizeCollections(merged) {
  const knownBuildings = merged.buildings ?? {};
  const cleanB = {};
  for (const [id, n] of Object.entries(knownBuildings)) {
    const count = Math.floor(safeNum(n));
    if (count > 0) cleanB[id] = count;
  }
  merged.buildings = cleanB;

  const cleanU = {};
  for (const [id, val] of Object.entries(merged.upgrades ?? {})) {
    if (val === true) cleanU[id] = true;
  }
  merged.upgrades = cleanU;

  const cleanA = {};
  for (const [id, rec] of Object.entries(merged.achievements ?? {})) {
    if (rec && typeof rec === "object" && Number.isFinite(rec.unlockedAt)) {
      cleanA[id] = rec;
    }
  }
  merged.achievements = cleanA;
  return merged;
}

/**
 * Загрузить сохранение.
 * @returns {'fresh'|'loaded'|'corrupted'} статус для UI
 */
export function loadGame() {
  const raw = storageGet(SAVE_KEY);
  if (!raw) return "fresh";

  const parsed = jsonParseSafe(raw);
  if (!parsed || typeof parsed !== "object") return "corrupted";

  try {
    const migrated = migrate(parsed);
    const defaults = createInitialState();
    const merged = sanitizeCollections(deepMerge(defaults, migrated));
    Object.assign(state, merged);
    state.flags.dirty = true;
    markDirty();
    return "loaded";
  } catch (err) {
    console.error("[load] failed:", err);
    return "corrupted";
  }
}

/** Импортировать сохранение из JSON-строки (файл или base64 из экспорта) */
export function importSaveFromString(text) {
  let candidate = String(text ?? "").trim();
  // Пробуем сначала как обычный JSON, затем как base64 из экспорта
  let data = jsonParseSafe(candidate);
  if (!data) {
    try {
      const decoded = decodeURIComponent(escape(atob(candidate)));
      data = jsonParseSafe(decoded);
    } catch {
      data = null;
    }
  }
  if (!data || typeof data !== "object" || !data.resources) {
    throw new Error("Файл сохранения повреждён или не является сохранением DevOPS Clicker");
  }
  storageSet(SAVE_KEY, JSON.stringify(data));
  const status = loadGame();
  if (status === "corrupted") throw new Error("Сохранение не прошло валидацию");
  return status;
}

/** Полный сброс прогресса */
export function wipeSave() {
  const fresh = createInitialState();
  Object.assign(state, fresh);
  storageRemove(SAVE_KEY);
  markDirty();
}
