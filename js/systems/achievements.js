/**
 * achievements.js (systems) — проверка и выдача достижений.
 */

import { state, markDirty } from "../core/state.js";
import { ACHIEVEMENTS } from "../config/achievements.js";
import { recomputeDerived } from "../core/economy.js";

/** Хук уведомления внедряется из main.js */
let onUnlockHook = null;
export const setAchievementHook = (fn) => { onUnlockHook = fn; };

/** Проверить все ещё не выданные достижения. Возвращает список новых. */
export function checkAchievements() {
  const fresh = [];
  for (const ach of ACHIEVEMENTS) {
    if (state.achievements[ach.id]) continue;
    let done = false;
    try {
      done = Boolean(ach.check(state));
    } catch {
      done = false; // повреждённый конфиг не должен ронять игру
    }
    if (done) {
      state.achievements[ach.id] = { unlockedAt: Date.now() };
      fresh.push(ach);
    }
  }
  if (fresh.length) {
    markDirty();
    recomputeDerived(); // бонус достижений влияет на глобальный множитель
    fresh.forEach((ach) => onUnlockHook?.(ach));
  }
  return fresh;
}

/** Прогресс 0..1 для locked-достижения (если задан progress-функция) */
export const achievementProgress = (ach) => {
  if (!ach.progress) return null;
  try {
    const v = Number(ach.progress(state));
    if (!Number.isFinite(v)) return null;
    return Math.max(0, Math.min(1, v));
  } catch {
    return null;
  }
};

export const unlockedCount = () => Object.keys(state.achievements).length;
export const totalCount = () => ACHIEVEMENTS.length;
