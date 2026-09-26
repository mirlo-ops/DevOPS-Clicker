/**
 * stats.js — сборная статистика для вкладок и sparkline-графиков.
 */

import { state } from "../core/state.js";
import { BUILDINGS } from "../config/buildings.js";
import { HISTORY_SAMPLE_MS, HISTORY_MAX_POINTS } from "../config/constants.js";
import { buildingContribution } from "../core/economy.js";
import { safeNum } from "../utils/format.js";

let sampleAccumulator = 0;

/** Вызывается из игрового цикла: снимает точку CPS раз в HISTORY_SAMPLE_MS */
export function sampleHistory(dtSec) {
  sampleAccumulator += dtSec * 1000;
  if (sampleAccumulator < HISTORY_SAMPLE_MS) return false;
  sampleAccumulator = 0;
  state.stats.cpsHistory.push({ t: Date.now(), cps: safeNum(state.derived.cps) });
  if (state.stats.cpsHistory.length > HISTORY_MAX_POINTS) {
    state.stats.cpsHistory.splice(0, state.stats.cpsHistory.length - HISTORY_MAX_POINTS);
  }
  return true;
}

/** Средний CPS за историю */
export const averageCps = () => {
  const h = state.stats.cpsHistory;
  if (!h.length) return safeNum(state.derived.cps);
  return h.reduce((s, p) => s + p.cps, 0) / h.length;
};

/** Топ-N генераторов по вкладу в CPS */
export const topBuildings = (n = 5) => {
  const rows = BUILDINGS.map((b) => ({
    id: b.id,
    name: b.name,
    icon: b.icon,
    owned: state.buildings[b.id] ?? 0,
    contribution: buildingContribution(b.id),
  })).filter((r) => r.owned > 0);
  rows.sort((a, b) => b.contribution - a.contribution);
  return rows.slice(0, n);
};

/** Средняя CPS «за игру» с учётом времени */
export const lifetimeAvgCps = () => {
  const hours = state.stats.playTimeMs / 3600_000;
  if (hours <= 0) return 0;
  return state.resources.lifetimeCommits / (state.stats.playTimeMs / 1000 || 1);
};

/** Итоговый объект для вкладки «Обзор» */
export const overviewStats = () => ({
  commits: state.resources.commits,
  lifetime: state.resources.lifetimeCommits,
  today: state.stats.today.commits,
  session: state.stats.sessionCommits,
  clicks: state.stats.clicks.manual,
  cps: state.derived.cps,
  avgCps: averageCps(),
  bestCps: state.stats.bestCps,
});
