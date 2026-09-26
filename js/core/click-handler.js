/**
 * click-handler.js — обработка кликов по главной кнопке.
 * Защита от спама, криты, статистика, интерактивные события.
 */

import { state, markDirty } from "./state.js";
import { addCommits } from "./production.js";
import { CLICK_MIN_INTERVAL_MS } from "../config/constants.js";
import { safeNum } from "../utils/format.js";
import { chance } from "../utils/random.js";

let lastClickAt = 0;

/** Колбэки внедряются из main.js (чтобы не создавать циклических импортов UI) */
const hooks = {
  onCritical: null,   // (gain) => void
  onClick: null,      // (gain, isCrit, x, y) => void
  notifyError: null,  // (msg) => void
};

export const setClickHooks = (partial) => Object.assign(hooks, partial);

/**
 * Совершить клик. x/y — координаты для всплывающего числа.
 * Возвращает { gain, crit } или null, если клик отброшен (спам-защита).
 */
export function handleClick(x, y) {
  const now = Date.now();
  // Анти-спам: слишком частые программные события игнорируем
  if (now - lastClickAt < CLICK_MIN_INTERVAL_MS) return null;
  lastClickAt = now;

  let gain = safeNum(state.derived.clickPower);
  if (gain <= 0) gain = state.click.basePower; // страховка от 0 до первого recompute

  const isCrit = chance(state.click.criticalChance);
  if (isCrit) {
    gain *= state.click.criticalMultiplier;
    state.stats.clicks.crits += 1;
  }

  gain = Math.max(1, gain);
  addCommits(gain, "click");

  state.stats.clicks.manual += 1;
  if (gain > state.stats.clicks.bestClickValue) {
    state.stats.clicks.bestClickValue = gain;
  }
  const today = new Date().toISOString().slice(0, 10);
  if (state.stats.today.date !== today) {
    state.stats.today = { date: today, commits: state.stats.today.commits, clicks: 0 };
  }
  state.stats.today.clicks += 1;
  markDirty();

  // Интерактивное событие: засчитываем клик в мини-игру
  const inter = state.events.interactive;
  if (inter?.clicksRequired) {
    inter.clicksDone = (inter.clicksDone ?? 0) + 1;
  }

  hooks.onClick?.(gain, isCrit, x, y);
  if (isCrit) hooks.onCritical?.(gain);

  return { gain, crit: isCrit };
}
