/**
 * prestige-system.js — «Migration to Cloud».
 * Сбрасывает ран, выдаёт Cloud Tokens за lifetime commits рана.
 */

import { state, createInitialState, markDirty } from "./state.js";
import { BALANCE } from "../config/balance.js";
import { recomputeDerived } from "./economy.js";
import { clamp } from "../utils/math.js";

/** Сколько токенов игрок заработает при престиже прямо сейчас */
export function pendingTokens() {
  const { divisor, power } = BALANCE.prestige;
  const base = state.resources.runCommits / divisor;
  if (base < 1) return 0;
  return Math.max(BALANCE.prestige.minGain, Math.floor(Math.pow(base, power)));
}

/** Доступен ли престиж */
export const isPrestigeAvailable = () => pendingTokens() >= BALANCE.prestige.minGain;

/** Текущие бонусы от накопленных токенов (для UI вкладки престижа) */
export function activeBonuses() {
  const t = state.resources.prestigeTokens;
  const steps = Math.floor(state.resources.lifetimePrestigeTokens / BALANCE.prestige.tokensForDiscountPer);
  return {
    prod: 1 + t * BALANCE.prestige.tokenProductionBonus,
    click: 1 + t * BALANCE.click.tokenClickBonus,
    cost: clamp(steps * BALANCE.prestige.discountPerStep, 0, BALANCE.prestige.maxDiscount),
    offline: clamp(
      0.5 + t * BALANCE.prestige.offlineBoostPerToken,
      0,
      BALANCE.prestige.maxOfflineEfficiency
    ),
  };
}

/**
 * Совершить престиж.
 * Сохраняет настройки, часть статистики и токены; всё остальное — чистый лист.
 */
export function doPrestige() {
  const gain = pendingTokens();
  if (gain <= 0) return { ok: false };

  // Snapshot того, что переживает сброс
  const keep = {
    tokens: state.resources.prestigeTokens + gain,
    lifetimeTokens: state.resources.lifetimePrestigeTokens + gain,
    lifetimeCommitsAll: state.resources.lifetimeCommits,
    settings: { ...state.settings },
    achievements: { ...state.achievements },
    stats: {
      clicks: { ...state.stats.clicks },
      playTimeMs: state.stats.playTimeMs,
      lastSessionMs: Date.now() - state.stats.sessionStart,
      savesCount: state.stats.savesCount,
      offlineEarnedTotal: state.stats.offlineEarnedTotal,
      events: { ...state.stats.events, log: [...state.stats.events.log] },
      prestige: {
        count: state.stats.prestige.count + 1,
        lastAt: Date.now(),
      },
      bestCps: state.stats.bestCps,
    },
  };

  // Полный сброс состояния до чистого
  Object.assign(state, createInitialState());

  state.resources.prestigeTokens = keep.tokens;
  state.resources.lifetimePrestigeTokens = keep.lifetimeTokens;
  state.resources.lifetimeCommits = keep.lifetimeCommitsAll; // общий lifetime не обнуляем
  state.settings = keep.settings;
  state.achievements = keep.achievements;
  Object.assign(state.stats, {
    clicks: keep.stats.clicks,
    playTimeMs: keep.stats.playTimeMs,
    lastSessionMs: keep.stats.lastSessionMs,
    savesCount: keep.stats.savesCount,
    offlineEarnedTotal: keep.stats.offlineEarnedTotal,
    bestCps: keep.stats.bestCps,
    prestige: keep.stats.prestige,
  });
  state.stats.events.total = keep.stats.events.total ?? 0;
  state.stats.events.incidents = keep.stats.events.incidents ?? 0;
  state.stats.events.resolvedIncidents = keep.stats.events.resolvedIncidents ?? 0;
  state.stats.events.log = keep.stats.events.log ?? [];

  markDirty();
  recomputeDerived();
  return { ok: true, gain };
}

/** Текстовое требование для UI */
export const prestigeRequirementText = () =>
  `Первый токен: ${BALANCE.prestige.divisor.toLocaleString("ru")} lifetime commits этого запуска.`;
