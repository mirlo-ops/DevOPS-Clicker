/**
 * buildings-system.js — покупка и учёт генераторов.
 */

import { state, markDirty } from "./state.js";
import { BUILDINGS } from "../config/buildings.js";
import { BALANCE } from "../config/balance.js";
import { recomputeDerived, buildingUnitCost } from "./economy.js";
import { spendCommits } from "./production.js";
import { bulkCost, affordableCount } from "../utils/math.js";

const cfgById = new Map(BUILDINGS.map((b) => [b.id, b]));

export const getBuildingCfg = (id) => cfgById.get(id) ?? null;

/** Разблокировано ли здание (по lifetime commits этого рана или владению) */
export const isBuildingUnlocked = (cfg) =>
  (state.buildings[cfg.id] ?? 0) > 0 ||
  state.resources.lifetimeCommits >= cfg.unlockAt;

/** Стоимость покупки count штук */
export const buildingBulkPrice = (id, count) => {
  const cfg = cfgById.get(id);
  if (!cfg) return Infinity;
  const owned = state.buildings[id] ?? 0;
  const perUnit = (i) => buildingUnitCost(cfg, owned + i);
  // discount уже внутри unit cost; считаем сумму по прогрессии с множителем скидки
  const discount = 1 - state.derived.costDiscount;
  return bulkCost(cfg.baseCost * discount, cfg.growthFactor, owned, count);
};

/** Сколько единиц можно купить на текущий бюджет */
export const buildingAffordable = (id) => {
  const cfg = cfgById.get(id);
  if (!cfg) return 0;
  const owned = state.buildings[id] ?? 0;
  const first = buildingUnitCost(cfg, owned);
  if (state.resources.commits < first) return 0;
  return affordableCount(cfg.baseCost * (1 - state.derived.costDiscount), cfg.growthFactor, owned, state.resources.commits);
};

/**
 * Купить count зданий. mode: 'fixed' | 'max'.
 * Возвращает { ok, bought, cost } — для логов и уведомлений.
 */
export function buyBuilding(id, amount, mode = "fixed") {
  const cfg = cfgById.get(id);
  if (!cfg) return { ok: false, reason: "unknown" };
  if (!isBuildingUnlocked(cfg)) return { ok: false, reason: "locked" };

  let count = amount;
  if (mode === "max") count = buildingAffordable(id);
  if (count <= 0) return { ok: false, reason: "afford" };

  const cost = buildingBulkPrice(id, count);
  if (!spendCommits(cost)) return { ok: false, reason: "afford" };

  state.buildings[id] = (state.buildings[id] ?? 0) + count;
  state.stats.spentOnBuildings += cost;
  state.stats.buildingsBoughtTotal += count;
  markDirty();
  recomputeDerived();
  return { ok: true, bought: count, cost };
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
