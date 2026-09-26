/**
 * save.js — сериализация и сохранение состояния в localStorage.
 */

import { state } from "../core/state.js";
import { SAVE_KEY, SAVE_VERSION, AUTOSAVE_INTERVAL_MS } from "../config/constants.js";
import { storageSet } from "../utils/storage.js";

/** Взять только сохраняемые поля (не тащим функции и кэш) */
export function serialize() {
  return JSON.stringify({
    version: SAVE_VERSION,
    resources: state.resources,
    click: { basePower: state.click.basePower },
    buildings: state.buildings,
    upgrades: state.upgrades,
    achievements: state.achievements,
    events: {
      // эффекты событий не сохраняем — они короткие; интерактив тоже
      lastEventAt: state.events.lastEventAt,
    },
    stats: state.stats,
    settings: state.settings,
    flags: { unlocks: state.flags.unlocks },
    lastSave: Date.now(),
  });
}

/** Записать в localStorage. Возвращает true при успехе. */
export function saveGame() {
  const ok = storageSet(SAVE_KEY, serialize());
  if (ok) {
    state.flags.dirty = false;
    state.lastSave = Date.now();
    state.stats.savesCount += 1;
  }
  return ok;
}

/* ---------- Автосохранение по таймеру ---------- */
let autosaveTimer = null;

export function startAutosave(onSaved) {
  stopAutosave();
  autosaveTimer = setInterval(() => {
    if (!state.flags.dirty) return;
    const ok = saveGame();
    onSaved?.(ok);
  }, AUTOSAVE_INTERVAL_MS);
}

export const stopAutosave = () => {
  if (autosaveTimer !== null) clearInterval(autosaveTimer);
  autosaveTimer = null;
};

/** Сохранение «на всякий случай»: закрытие вкладки / потеря фокуса */
export function bindLifecycleEvents(onSaved) {
  window.addEventListener("beforeunload", () => {
    if (saveGame()) onSaved?.(true);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && saveGame()) onSaved?.(true);
  });
}

/** Экспорт сохранения в виде строки (для скачивания файла) */
export const exportSaveString = () => btoaSafe(serialize());

function btoaSafe(str) {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    return btoa(str);
  }
}
