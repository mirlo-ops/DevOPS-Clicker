/**
 * economy.js — расчёт производных величин: CPS, сила клика, множители.
 * Все формулы собраны здесь; остальные системы только читают state.derived.
 */

import { state } from "./state.js";
import { BUILDINGS, BUILDING_CATEGORIES } from "../config/buildings.js";
import { UPGRADES, UPGRADE_CATEGORIES } from "../config/upgrades.js";
import { BALANCE } from "../config/balance.js";
import { clamp } from "../utils/math.js";
import { safeNum, fmtMult, fmtPct } from "../utils/format.js";
import { OFFLINE_EFFICIENCY } from "../config/constants.js";

/** Множитель для конкретного здания из купленных апгрейдов */
export const buildingUpgradeMult = (buildingId) => {
  const cfg = BUILDINGS.find((b) => b.id === buildingId);
  let mult = 1;
  for (const up of UPGRADES) {
    if (!state.upgrades[up.id]) continue;
    if (up.type === "building_mult" && up.target === buildingId) mult *= up.value;
    if (up.type === "building_cat" && cfg && up.target === cfg.category) mult *= up.value;
  }
  return mult;
};

/** Базовый CPS без глобальных множителей (сумма по зданиям) */
export const computeBaseCps = () => {
  let total = 0;
  for (const b of BUILDINGS) {
    const owned = state.buildings[b.id] ?? 0;
    if (owned <= 0) continue;
    total += owned * b.baseProd * buildingUpgradeMult(b.id);
  }
  return total;
};

/** Вклад конкретного здания в итоговый CPS (для карточек и статистики) */
export const buildingContribution = (buildingId) => {
  const b = BUILDINGS.find((x) => x.id === buildingId);
  if (!b) return 0;
  const owned = state.buildings[b.id] ?? 0;
  return owned * b.baseProd * buildingUpgradeMult(b.id) * computeGlobalMult();
};

/** Глобальный множитель производства: престиж + достижения + апгрейды + эффекты событий */
export function computeGlobalMult() {
  let mult = 1;
  // Cloud Tokens
  mult *= 1 + state.resources.prestigeTokens * BALANCE.prestige.tokenProductionBonus;
  // Достижения (капленый бонус)
  const achCount = Object.keys(state.achievements).length;
  mult *= Math.min(
    1 + achCount * BALANCE.production.achievementBonus,
    BALANCE.production.achievementBonusCap
  );
  // Апгрейды global_mult
  for (const up of UPGRADES) {
    if (state.upgrades[up.id] && up.type === "global_mult") mult *= up.value;
  }
  // Активные эффекты событий (prod_mult)
  const now = Date.now();
  for (const eff of state.events.activeEffects) {
    if (eff.type === "prod_mult" && eff.until > now) mult *= eff.value;
  }
  return mult;
}

/** Множитель силы клика */
function computeClickMult() {
  let mult = 1;
  for (const up of UPGRADES) {
    if (!state.upgrades[up.id]) continue;
    if (up.type === "click_mult") mult *= up.value;
  }
  // Престиж-бонус к клику
  mult *= 1 + state.resources.prestigeTokens * BALANCE.click.tokenClickBonus;
  // Экспериментальные Feature Flags: +10% к клику, но -5% к событиям (см. events-system)
  if (state.flags.unlocks.flags_toggle && state.settings.featureFlagsExp) mult *= 1.1;
  // Эффекты событий (click_mult)
  const now = Date.now();
  for (const eff of state.events.activeEffects) {
    if (eff.type === "click_mult" && eff.until > now) mult *= eff.value;
  }
  return mult;
}

/** Шанс и множитель крита с учётом апгрейдов */
function computeCrit() {
  let chance = BALANCE.click.baseCritChance;
  let cmult = BALANCE.click.baseCritMultiplier;
  for (const up of UPGRADES) {
    if (!state.upgrades[up.id]) continue;
    if (up.type === "crit_chance") chance += up.value;
    if (up.type === "crit_mult") cmult += up.value;
  }
  return {
    chance: clamp(chance, 0, BALANCE.click.maxCritChance),
    mult: clamp(cmult, 1, BALANCE.click.maxCritMultiplier),
  };
}

/** Пересчитать все derived-величины. Вызывается при покупках и тиках эффектов. */
export function recomputeDerived() {
  const globalMult = computeGlobalMult();
  const baseCps = computeBaseCps();
  state.production.baseCps = baseCps;
  state.production.multiplier = globalMult;
  state.derived.cps = baseCps * globalMult;

  state.click.multiplier = computeClickMult();
  const crit = computeCrit();
  state.click.criticalChance = crit.chance;
  state.click.criticalMultiplier = crit.mult;

  // Бонус от Muscle Memory: клик получает % от CPS
  let cpsBonus = 0;
  for (const up of UPGRADES) {
    if (state.upgrades[up.id] && up.type === "cps_click") {
      cpsBonus += up.value * state.derived.cps;
    }
  }
  state.derived.clickPower =
    (state.click.basePower + cpsBonus) * state.click.multiplier;

  // Скидка на генераторы за токены
  const steps = Math.floor(state.resources.lifetimePrestigeTokens / BALANCE.prestige.tokensForDiscountPer);
  state.derived.costDiscount = clamp(steps * BALANCE.prestige.discountPerStep, 0, BALANCE.prestige.maxDiscount);

  // Офлайн-эффективность
  let offEff = OFFLINE_EFFICIENCY + state.resources.prestigeTokens * BALANCE.prestige.offlineBoostPerToken;
  for (const up of UPGRADES) {
    if (state.upgrades[up.id] && up.type === "offline_mult") offEff *= up.value;
  }
  state.derived.offlineEfficiency = clamp(offEff, 0, BALANCE.prestige.maxOfflineEfficiency);

  // Лучший CPS в статистику
  if (state.derived.cps > state.stats.bestCps) state.stats.bestCps = state.derived.cps;
}

/** Итоговая стоимость одной единицы здания с учётом скидки престижа */
export const buildingUnitCost = (cfg, ownedIndex) => {
  const raw = cfg.baseCost * Math.pow(cfg.growthFactor, ownedIndex);
  return raw * (1 - state.derived.costDiscount);
};

/* ---------------- Хелперы для UI: описание эффекта апгрейда ---------------- */

const UPGRADE_TYPE_LABELS = {
  click_mult: (v) => `Сила клика ×${fmtMult(v)}`,
  building_mult: (v, target) => `${targetName(target)} ×${fmtMult(v)}`,
  building_cat: (v, target) => `Категория «${categoryName(target)}» ×${fmtMult(v)}`,
  global_mult: (v) => `Всё производство ×${fmtMult(v)}`,
  crit_chance: (v) => `Шанс крита +${fmtPct(v)}`,
  crit_mult: (v) => `Множитель крита +${round1(v)}`,
  cps_click: (v) => `Клик получает +${fmtPct(v)} от CPS`,
  offline_mult: (v) => `Офлайн-доход ×${fmtMult(v)}`,
  event_bad: (v) => `Негативные события слабее на ${fmtPct(1 - v)}`,
  event_good: (v) => `Позитивные события сильнее на ${fmtPct(v - 1)}`,
  unlock: (v, target) => `Открывает: ${unlockName(target)}`,
};

const targetName = (id) => BUILDINGS.find((b) => b.id === id)?.name ?? id;
const categoryName = (cat) =>
  BUILDING_CATEGORIES[cat] ?? UPGRADE_CATEGORIES[cat] ?? cat;
const unlockName = (t) =>
  ({
    autobuy: "GitOps Bot (автопокупка генераторов)",
    advanced_stats: "Расширенная статистика",
    canary: "Canary-деплой (пассивный бонус)",
    flags_toggle: "Feature Flags (экспериментальные настройки)",
    error_reduction: "Снижение негативных событий",
  })[t] ?? t;
const round1 = (n) => String(Math.round(safeNum(n) * 10) / 10);

/** Человекочитаемое описание эффекта апгрейда (для тултипов) */
export const upgradeEffectLabel = (cfg) => {
  const fn = UPGRADE_TYPE_LABELS[cfg.type];
  return fn ? fn(cfg.value, cfg.target) : "";
};
