/**
 * upgrades-system.js — покупка и условия доступности улучшений.
 */

import { state, markDirty } from "./state.js";
import { UPGRADES } from "../config/upgrades.js";
import { spendCommits } from "./production.js";
import { recomputeDerived } from "./economy.js";

const byId = new Map(UPGRADES.map((u) => [u.id, u]));

export const getUpgradeCfg = (id) => byId.get(id) ?? null;

/** Выполнены ли условия отображения/покупки апгрейда */
export function isUpgradeAvailable(cfg) {
  if (state.upgrades[cfg.id]) return false; // одноразовые: уже куплен
  const req = cfg.req ?? {};
  if (req.clicks != null && state.stats.clicks.manual < req.clicks) return false;
  if (req.lifetimeCommits != null && state.resources.lifetimeCommits < req.lifetimeCommits) return false;
  if (req.prestigeCount != null && state.stats.prestige.count < req.prestigeCount) return false;
  if (req.upgradeOwned != null && !state.upgrades[req.upgradeOwned]) return false;
  if (req.buildings) {
    for (const [bid, need] of Object.entries(req.buildings)) {
      if ((state.buildings[bid] ?? 0) < need) return false;
    }
  }
  return true;
}

/** Список апгрейдов, доступных к покупке прямо сейчас */
export const visibleUpgrades = () => UPGRADES.filter(isUpgradeAvailable);

/** Купленные апгрейды */
export const ownedUpgrades = () =>
  UPGRADES.filter((u) => state.upgrades[u.id]);

/** Купить улучшение */
export function buyUpgrade(id) {
  const cfg = byId.get(id);
  if (!cfg || !isUpgradeAvailable(cfg)) return { ok: false, reason: "unavailable" };
  if (!spendCommits(cfg.cost)) return { ok: false, reason: "afford" };

  state.upgrades[id] = true;
  state.stats.spentOnUpgrades += cfg.cost;
  state.stats.upgradesBoughtTotal += 1;

  // unlock-эффекты применяются сразу
  if (cfg.type === "unlock") {
    state.flags.unlocks[cfg.target] = cfg.value;
  }

  markDirty();
  recomputeDerived();
  return { ok: true, cfg };
}

/** Есть ли разблокированная фича (для UI/систем) */
export const hasUnlock = (target) => Boolean(state.flags.unlocks[target]);

/** Значение разблокированной фичи (например шанс canary) */
export const unlockValue = (target) => state.flags.unlocks[target] ?? 0;
