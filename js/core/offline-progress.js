/**
 * offline-progress.js — расчёт дохода за время, пока вкладка была закрыта.
 */

import { state } from "./state.js";
import { addCommits } from "./production.js";
import { OFFLINE_MAX_HOURS } from "../config/constants.js";
import { safeNum, fmt } from "../utils/format.js";
import { fmtDuration } from "../utils/time.js";

/**
 * Вызывается один раз при старте после загрузки сохранения.
 * Возвращает { earned, awayMs } или null, если офлайна не было.
 */
export function applyOfflineProgress() {
  const last = Number(state.lastSave ?? state.lastTick ?? 0);
  if (!Number.isFinite(last) || last <= 0) return null;

  const awayMsRaw = Date.now() - last;
  if (awayMsRaw < 60_000) return null; // меньше минуты — не считаем

  const cappedMs = Math.min(awayMsRaw, OFFLINE_MAX_HOURS * 3600_000);
  const cps = safeNum(state.derived.cps);
  if (cps <= 0) return { earned: 0, awayMs: cappedMs };

  const earned = cps * (cappedMs / 1000) * safeNum(state.derived.offlineEfficiency);
  if (earned > 0) addCommits(earned, "offline");

  return { earned, awayMs: cappedMs };
}

/** Человекочитаемое сообщение для модалки офлайн-дохода */
export const offlineMessage = ({ earned, awayMs }) =>
  `Пока вас не было (${fmtDuration(awayMs)}), CI/CD пайплайн тихо собрал ` +
  `<b class="modal__highlight">${fmt(earned)}</b> коммитов. ` +
  `Эффективность офлайна: ${Math.round(safeNum(state.derived.offlineEfficiency) * 100)}%.`;
