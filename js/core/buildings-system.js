/**
 * buildings-system.js — покупка и учёт генераторов.
 */

import { state, markDirty } from "./state.js";
import { BUILDINGS } from "../config/buildings.js";
import { BALANCE } from "../config/balance.js";
import { recomputeDerived, buildingContribution } from "./economy.js";
import { spendCommits } from "./production.js";
import { bulkCost, affordableCount } from "../utils/math.js";
import { safeNum } from "../utils/format.js";

/* FIX (экономический баг покупок): id из DOM-атрибутов могли приходить с
   ведущими/замыкающими пробелами или в другом регистре (" Junior ", "JUNIOR"),
   Map искал точное ключевое совпадение и молча возвращал undefined →
   buyBuilding давал { ok:false, reason:"unknown" }, списаний не было.
   Нормализуем любой входящий id перед поиском конфигурации. */
const normalizeId = (raw) => String(raw ?? "").trim();

const cfgById = new Map(BUILDINGS.map((b) => [normalizeId(b.id).toLowerCase(), b]));

/** Найти конфиг по «грязному» id: trim + регистронезависимо */
export const findBuildingCfg = (rawId) => cfgById.get(normalizeId(rawId).toLowerCase()) ?? null;

export const getBuildingCfg = (id) => findBuildingCfg(id);

/** Разблокировано ли здание (по lifetime commits этого рана или владению) */
export const isBuildingUnlocked = (cfg) =>
  safeNum(state.buildings[cfg.id]) > 0 ||
  safeNum(state.resources.lifetimeCommits) >= safeNum(cfg.unlockAt);

/** Стоимость покупки count штук (одна формула с buildingAffordable!) */
export const buildingBulkPrice = (id, count) => {
  const cfg = findBuildingCfg(id);
  if (!cfg) return Infinity;
  const n = Math.floor(safeNum(count));
  if (n <= 0) return Infinity;
  const owned = safeNum(state.buildings[cfg.id]);
  const growth = cfg.growthFactor > 1 ? cfg.growthFactor : BALANCE.building.growthFactorDefault;
  const discountedBase = cfg.baseCost * (1 - clampDiscount(state.derived.costDiscount));
  return bulkCost(discountedBase, growth, owned, n);
};

/** Скидка не может увести цену в ноль/минус (защита от рассинхрона derived) */
const clampDiscount = (d) => Math.min(Math.max(safeNum(d), 0), 0.95);

/** Сколько единиц можно купить на текущий бюджет */
export const buildingAffordable = (id) => {
  const cfg = findBuildingCfg(id);
  if (!cfg) return 0;
  const owned = safeNum(state.buildings[cfg.id]);
  const growth = cfg.growthFactor > 1 ? cfg.growthFactor : BALANCE.building.growthFactorDefault;
  const discountedBase = cfg.baseCost * (1 - clampDiscount(state.derived.costDiscount));
  return affordableCount(discountedBase, growth, owned, safeNum(state.resources.commits));
};

/**
 * Купить count зданий. mode: 'fixed' | 'max'.
 * Возвращает { ok, bought, cost, id } — для логов и уведомлений.
 */
export function buyBuilding(rawId, amount, mode = "fixed") {
  const cfg = findBuildingCfg(rawId);
  if (!cfg) return { ok: false, reason: "unknown" };
  if (!isBuildingUnlocked(cfg)) return { ok: false, reason: "locked" };

  let count = Math.floor(safeNum(amount));
  if (mode === "max" || !Number.isFinite(amount) || amount === Infinity) {
    count = buildingAffordable(cfg.id);
  }
  if (count <= 0) return { ok: false, reason: "afford", need: buildingBulkPrice(cfg.id, 1) };

  // Финальная проверка достаточности средств (commits >= cost)
  const cost = Math.ceil(buildingBulkPrice(cfg.id, count));
  if (safeNum(state.resources.commits) < cost) {
    if (mode !== "max") return { ok: false, reason: "afford", need: cost };
    count = buildingAffordable(cfg.id);
    if (count <= 0) return { ok: false, reason: "afford", need: buildingBulkPrice(cfg.id, 1) };
  }

  // Списание средств: state.resources.commits -= cost (через единый API production.js)
  if (!spendCommits(cost)) return { ok: false, reason: "afford", need: cost };

  // Прирост количества здания: ownedCount += count
  state.buildings[cfg.id] = safeNum(state.buildings[cfg.id]) + count;
  state.stats.spentOnBuildings += cost;
  state.stats.buildingsBoughtTotal += count;
  markDirty();
  // Обновление глобального множителя производства (CPS) — немедленно,
  // чтобы UI (магазин, статус-бар) пересчитался без перезагрузки страницы.
  recomputeDerived();
  return { ok: true, bought: count, cost, id: cfg.id };
}

/** Автопокупка (GitOps Bot): самый дешёвый доступный генератор */
export function autobuyOnce() {
  let best = null;
  for (const cfg of BUILDINGS) {
    if (!isBuildingUnlocked(cfg)) continue;
    const price = buildingBulkPrice(cfg.id, 1);
    if (price <= state.resources.commits && (!best || price < best.price)) {
      best = { id: cfg.id, price };
    }
  }
  if (!best) return null;
  const res = buyBuilding(best.id, 1);
  return res.ok ? { id: best.id, bought: res.bought, cost: res.cost } : null;
}

/** Суммарное число купленных зданий */
export const totalBuildingsOwned = () =>
  Object.values(state.buildings).reduce((s, n) => s + n, 0);

/** Порог разблокировки следующего скрытого здания (для превью) */
export const nextLockedTeaser = () => {
  const ratio = BALANCE.building.unlockRatio;
  for (const cfg of BUILDINGS) {
    if (!isBuildingUnlocked(cfg)) {
      return { cfg, need: Math.max(cfg.unlockAt, cfg.baseCost * ratio) };
    }
  }
  return null;
};

/* ---------------- Хелперы для UI (тултипы / карточки) ---------------- */

/** Прибавка к CPS от одной единицы здания (с учётом всех множителей) */
export const buildingUnitCpsGain = (rawId) => {
  const cfg = findBuildingCfg(rawId);
  if (!cfg) return 0;
  const owned = safeNum(state.buildings[cfg.id]);
  const contrib = buildingContribution(cfg.id);
  // Если здание ещё не куплено — вклад одной единицы = baseProd × глобальный множитель
  const globalMult = safeNum(state.production.multiplier) || 1;
  return owned > 0 ? contrib / owned : cfg.baseProd * globalMult;
};

/** Доля здания в общем доходе, % (0..100) */
export const buildingIncomeSharePct = (rawId) => {
  const cfg = findBuildingCfg(rawId);
  if (!cfg) return 0;
  const cps = safeNum(state.derived.cps);
  if (cps <= 0) return 0;
  return Math.round((buildingContribution(cfg.id) / cps) * 100);
};

/** Недавно купленное здание? (для подсветки «just bought» / снятия NEW-бейджа) */
export const isBuildingJustBought = (rawId, windowMs = 3000) => {
  const cfg = findBuildingCfg(rawId);
  if (!cfg) return false;
  return Date.now() - (lastBoughtAt.get(cfg.id) ?? 0) < windowMs;
};
const lastBoughtAt = new Map();
export const markBuildingBought = (rawId) => {
  const cfg = findBuildingCfg(rawId);
  if (cfg) lastBoughtAt.set(cfg.id, Date.now());
};
