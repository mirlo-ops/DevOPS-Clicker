/**
 * game-loop.js — стабильный игровой цикл на requestAnimationFrame.
 * Экономика считается фиксированными тиками (delta time), UI — по расписанию.
 */

import { state, markDirty } from "./state.js";
import { TICK_INTERVAL_MS } from "../config/constants.js";
import { tickProduction, refreshEconomy } from "./production.js";
import { tickEvents } from "./events-system.js";
import { autobuyOnce } from "./buildings-system.js";
import { hasUnlock } from "./upgrades-system.js";
import { safeNum } from "../utils/format.js";

const listeners = new Set();
const autobuyListeners = new Set();

/** Подписка на тик: fn(dtSec) */
export const onTick = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Подписка на автопокупку GitOps Bot: fn({ id, bought, cost }) */
export const onAutobuy = (fn) => {
  autobuyListeners.add(fn);
  return () => autobuyListeners.delete(fn);
};

let rafId = null;
let lastFrameAt = performance.now();
let acc = 0;              // аккумулятор экономических тиков
let autobuyAcc = 0;       // аккумулятор автопокупок GitOps Bot
let running = false;

/** Один экономический тик */
function economyTick(dtSec) {
  refreshEconomy();
  tickProduction(dtSec);
  tickEvents(dtSec * 1000);

  // GitOps Bot: раз в 10 секунд покупаем самый дешёвый доступный генератор
  if (hasUnlock("autobuy")) {
    autobuyAcc += dtSec;
    if (autobuyAcc >= 10) {
      autobuyAcc = 0;
      const res = autobuyOnce();
      if (res) autobuyListeners.forEach((fn) => fn(res));
    }
  }

  state.stats.playTimeMs += dtSec * 1000;
  markDirty();
}

function frame(now) {
  if (!running) return;
  rafId = requestAnimationFrame(frame);

  // Ограничиваем dt: вкладка могла быть фоновой (rAF троттлится до ~1 fps).
  // Большие пропуски обрабатываются как обычные тики — это «догоняющая» симуляция.
  let dtMs = now - lastFrameAt;
  lastFrameAt = now;
  if (!Number.isFinite(dtMs) || dtMs < 0) dtMs = 0;
  dtMs = Math.min(dtMs, 60_000); // максимум догоним 1 минуту за кадр

  acc += dtMs;
  // Фиксированный шаг: стабильная экономика независимо от FPS
  let guard = 0;
  while (acc >= TICK_INTERVAL_MS && guard < 600) {
    acc -= TICK_INTERVAL_MS;
    guard += 1;
    economyTick(safeNum(TICK_INTERVAL_MS) / 1000);
  }

  listeners.forEach((fn) => fn(dtMs / 1000));
}

/** Публичный getter FPS для статус-бара */
let fpsFrames = 0;
let fpsLast = performance.now();
export const fpsCounter = () => {
  fpsFrames += 1;
  const now = performance.now();
  if (now - fpsLast >= 1000) {
    const fps = Math.round((fpsFrames * 1000) / (now - fpsLast));
    fpsFrames = 0;
    fpsLast = now;
    return fps;
  }
  return null; // ещё не секунда
};

export function startLoop() {
  if (running) return;
  running = true;
  lastFrameAt = performance.now();
  state.lastTick = Date.now();
  rafId = requestAnimationFrame(frame);
}

export function stopLoop() {
  running = false;
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
}

/** При возврате с фоновой вкладки синхронизируем lastFrameAt, чтобы не было гигантского dt */
export const resumeClock = () => {
  lastFrameAt = performance.now();
  acc = 0;
  state.lastTick = Date.now();
};
