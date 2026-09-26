/**
 * math.js — математические хелперы экономики.
 */

import { safeNum } from "./format.js";

/** Сумма геометрической прогрессии для покупки N штук по baseCost*g^owned */
export const bulkCost = (baseCost, growth, owned, count) => {
  const g = growth;
  return baseCost * Math.pow(g, owned) * (Math.pow(g, count) - 1) / (g - 1);
};

/** Сколько единиц можно купить на budget (решение неравенства геометр. прогрессии) */
export const affordableCount = (baseCost, growth, owned, budget) => {
  if (baseCost <= 0 || budget < baseCost * Math.pow(growth, owned)) return 0;
  const numerator = 1 + (budget * (growth - 1)) / (baseCost * Math.pow(growth, owned));
  if (numerator <= 0) return 0;
  return Math.max(0, Math.floor(Math.log(numerator) / Math.log(growth)));
};

/** Зажать значение в диапазон [min, max] */
export const clamp = (v, min, max) => Math.min(max, Math.max(min, safeNum(v)));

/** Безопасное умножение (NaN -> fallback) */
export const mulSafe = (a, b, fallback = 1) => {
  const r = safeNum(a) * safeNum(b);
  return Number.isFinite(r) ? r : fallback;
};
