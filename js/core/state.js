/**
 * state.js — центральное состояние игры.
 * Единый источник правды; все системы читают/пишут только сюда.
 */

import { BALANCE } from "../config/balance.js";
import { SAVE_VERSION } from "../config/constants.js";
import { dayKey } from "../utils/time.js";

/** Создать «чистое» состояние (используется при старте и после престижа) */
export const createInitialState = () => ({
  version: SAVE_VERSION,

  resources: {
    commits: 0,            // текущая валюта
    lifetimeCommits: 0,    // всего коммитов за всё время (не сбрасывается престижем? — сбрасывается partially, см. prestige-system)
    runCommits: 0,         // коммиты за текущий «ран» (до престижа) — база для формулы престижа
    prestigeTokens: 0,     // Cloud Tokens (тратятся на бонусы-пассивки, но учитываются lifetime)
    lifetimePrestigeTokens: 0,
  },

  click: {
    basePower: BALANCE.click.basePower,
    multiplier: 1,        // пересчитывается economy.js
    criticalChance: BALANCE.click.baseCritChance,
    criticalMultiplier: BALANCE.click.baseCritMultiplier,
  },

  production: {
    baseCps: 0,           // пересчитывается production.js
    multiplier: 1,        // пересчитывается economy.js
  },

  buildings: {},          // id -> количество
  upgrades: {},           // id -> true (куплено)
  achievements: {},       // id -> { unlockedAt }
  events: {
    activeEffects: [],    // [{ key, type, value, until, label }]
    interactive: null,    // { id, name, icon, deadline, clicksRequired?, clicksDone?, kind }
    lastEventAt: 0,
  },

  stats: {
    clicks: { manual: 0, crits: 0, bestClickValue: 0 },
    cpsHistory: [],       // [{ t, cps }] — sparkline
    bestCps: 0,
    today: { date: dayKey(), commits: 0, clicks: 0 },
    sessionCommits: 0,
    sessionStart: Date.now(),
    playTimeMs: 0,
    lastSessionMs: 0,
    savesCount: 0,
    offlineEarnedTotal: 0,
    earnedBySource: { click: 0, production: 0, event: 0, offline: 0 },
    spentOnBuildings: 0,
    spentOnUpgrades: 0,
    buildingsBoughtTotal: 0,
    upgradesBoughtTotal: 0,
    events: { total: 0, incidents: 0, resolvedIncidents: 0, log: [] }, // log: [{t, id, name, result}]
    prestige: { count: 0, lastAt: 0 },
  },

  settings: {
    sound: false,          // по умолчанию выключен (требование ТЗ)
    volume: 0.5,
    animations: true,
    matrixRain: true,
    scanlines: true,
    reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    featureFlagsExp: false, // экспериментальные бонусы (Feature Flags upgrade)
    buyAmount: 1,           // режим покупки генераторов x1/x10/x100
    cloudSync: true,        // облачный синк с Firebase (если доступен)
    playerName: "",         // имя для таблицы лидеров
  },

  derived: {
    // Кэшированные производные величины (пересчёт в economy.recomputeDerived)
    cps: 0,
    clickPower: 0,
    globalMult: 1,
    costDiscount: 0,
    offlineEfficiency: BALANCE.prestige.offlineBoostPerToken > 0 ? 0 : 0,
  },

  flags: {
    unlocks: {},   // target -> value из upgrade type=unlock
    dirty: true,   // есть несохранённые изменения
  },

  lastSave: null,
  lastTick: Date.now(),
});

/** Глобальный экземпляр состояния (единственный на приложение) */
export const state = createInitialState();

/** Помощник: отметить состояние изменённым (для автосохранения) */
export const markDirty = () => {
  state.flags.dirty = true;
};
