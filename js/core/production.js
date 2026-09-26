/**
 * production.js — начисление пассивного дохода и единый «доход» API.
 */

import { state, markDirty } from "./state.js";
import { recomputeDerived } from "./economy.js";
import { dayKey } from "../utils/time.js";
import { safeNum } from "../utils/format.js";

/** Обновить счётчик «сегодня», если сменился день */
const rollDayIfNeeded = () => {
  const today = dayKey();
  if (state.stats.today.date !== today) {
    state.stats.today = { date: today, commits: 0, clicks: 0 };
  }
};

/**
 * Главный способ добавить коммитов в экономику.
 * source: 'click' | 'production' | 'event' | 'offline'
 */
export function addCommits(amount, source = "production") {
  const n = safeNum(amount);
  if (n <= 0) return;
  state.resources.commits += n;
  state.resources.lifetimeCommits += n;
  state.resources.runCommits += n;
  state.stats.sessionCommits += n;
  rollDayIfNeeded();
  state.stats.today.commits += n;
  if (source in state.stats.earnedBySource) {
    state.stats.earnedBySource[source] += n;
  }
  if (source === "offline") state.stats.offlineEarnedTotal += n;
  markDirty();
}

/** Потратить коммиты; возвращает true, если хватило */
export function spendCommits(amount) {
  const n = safeNum(amount);
  if (n <= 0 || state.resources.commits < n) return false;
  state.resources.commits -= n;
  markDirty();
  return true;
}

/** Тик производства: dtSec — секунды с прошлого тика */
export function tickProduction(dtSec) {
  const cps = safeNum(state.derived.cps);
  if (cps > 0 && dtSec > 0) {
    addCommits(cps * dtSec, "production");
  }
}

/** Вызывается из game-loop для пересчёта derived раз в тик (эффекты истекли и т.п.) */
export const refreshEconomy = () => recomputeDerived();
