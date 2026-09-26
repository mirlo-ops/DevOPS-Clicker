/**
 * events-system.js — случайные события и активные эффекты.
 */

import { state, markDirty } from "./state.js";
import { EVENTS, pickEvent } from "../config/events.js";
import { BALANCE } from "../config/balance.js";
import { EVENT_CHECK_INTERVAL_MS, EVENTS_HISTORY_MAX } from "../config/constants.js";
import { addCommits } from "./production.js";
import { recomputeDerived } from "./economy.js";
import { chance } from "../utils/random.js";
import { fmt } from "../utils/format.js";
import { hasUnlock, unlockValue } from "./upgrades-system.js";

/** Хуки внедряются из main.js: log(type, text), notify(title, body, kind), sound(name) */
const hooks = { log: null, notify: null, sound: null };
export const setEventHooks = (partial) => Object.assign(hooks, partial);

let checkAccumulator = 0;
let canaryAccumulator = 0;
let lastCheckAt = Date.now();

const api = () => ({
  state,
  addCommits,
  fmt,
  log: (type, text) => hooks.log?.(type, text),
  notify: (title, body, kind) => hooks.notify?.(title, body, kind),
  setEffect: (key, eff) => setActiveEffect(key, eff),
});

/** Установить/обновить активный эффект по ключу */
function setActiveEffect(key, eff) {
  const existing = state.events.activeEffects.find((e) => e.key === key);
  if (existing) Object.assign(existing, eff);
  else state.events.activeEffects.push({ key, ...eff });
  markDirty();
  recomputeDerived();
}

/** Сила негатива с учётом Linter Config / Zero Trust / Feature Flags */
const badScale = () => {
  let scale = 1;
  const linter = state.flags.unlocks.error_reduction ?? 0;
  scale *= 1 - linter; // error_reduction из Linter Config
  // Zero Trust: type=event_bad value=0.5 -> ослабляет дебаффы событий на 50%
  const zeroTrust = state.upgrades.zero_trust ? 0.5 : 1;
  scale *= zeroTrust;
  if (hasUnlock("flags_toggle") && state.settings.featureFlagsExp) scale *= 1.05;
  return Math.max(0.1, scale);
};

/** Ослабить значение дебафф-эффекта (0.4 -> ближе к 1) */
const softenDebuff = (value) => {
  const reduction = 1 - value; // насколько режет
  return 1 - reduction * badScale();
};

/** Усилить бафф-эффект (2 -> до 3 при Chaos Engineering) */
const boostBuff = (value) => {
  const chaosMult = state.upgrades.chaos_engineering ? 1.5 : 1;
  return 1 + (value - 1) * chaosMult;
};

/** Запустить событие */
function triggerEvent(ev) {
  const a = api();
  state.stats.events.total += 1;
  state.events.lastEventAt = Date.now();
  hooks.log?.("event", `${ev.icon} [event] ${ev.name}: ${ev.msg}`);

  if (ev.interactive) {
    if (ev.id === "incident") state.stats.events.incidents += 1;
    state.events.interactive = {
      id: ev.id,
      name: ev.name,
      icon: ev.icon,
      deadline: Date.now() + ev.graceMs,
      clicksRequired: ev.clicksRequired ?? 1,
      clicksDone: 0,
      kind: ev.clicksRequired ? "clicks" : "button",
    };
    hooks.notify?.(`${ev.icon} ${ev.name}`, ev.msg, "event");
    markDirty();
    return;
  }

  if (ev.effect) {
    const isBuff = ev.effect.value >= 1;
    const value = isBuff ? boostBuff(ev.effect.value) : softenDebuff(ev.effect.value);
    setActiveEffect(`event:${ev.id}`, {
      type: ev.effect.type,
      value,
      until: Date.now() + ev.durationMs,
      label: `${ev.icon} ${ev.name}`,
    });
    hooks.notify?.(`${ev.icon} ${ev.name}`, ev.msg, ev.tone === "bad" ? "error" : "success");
    return;
  }

  if (ev.instant) {
    const result = ev.instant(a);
    hooks.log?.("event", `[event] Результат: ${result}`);
    hooks.notify?.(`${ev.icon} ${ev.name}`, result, "success");
    pushHistory(ev, result);
    return;
  }

  if (ev.resolve) {
    const result = ev.resolve(a);
    hooks.log?.("event", `[event] Friday Deploy → ${result}`);
    hooks.notify?.(`${ev.icon} ${ev.name}`, result, "event");
    pushHistory(ev, result);
  }
}

/** Разрешение интерактивного события (кнопка «Отбить инцидент» или завершение мини-игры) */
export function resolveInteractive(success) {
  const inter = state.events.interactive;
  if (!inter) return;
  const ev = EVENTS.find((e) => e.id === inter.id);
  state.events.interactive = null;
  const a = api();
  let result;
  if (success && ev?.onSuccess) {
    result = ev.onSuccess(a);
    hooks.log?.("event", `✅ [event] ${ev.name}: ${result}`);
    hooks.notify?.(`✅ ${ev.name}`, result, "success");
    hooks.sound?.("deploy");
  } else if (ev?.onFail) {
    result = ev.onFail(a);
    // Штраф смягчаем апгрейдами
    const debuff = state.events.activeEffects.find((e) => e.until > Date.now() && e.key.startsWith("event:") === false);
    if (debuff) debuff.value = softenDebuff(debuff.value);
    hooks.log?.("warn", `❌ [event] ${ev.name}: ${result}`);
    hooks.notify?.(`❌ ${ev.name}`, result, "error");
    hooks.sound?.("error");
  }
  pushHistory(ev, result ?? (success ? "resolved" : "failed"));
  markDirty();
  recomputeDerived();
}

const pushHistory = (ev, result) => {
  state.stats.events.log.unshift({ t: Date.now(), id: ev?.id ?? "?", name: ev?.name ?? "?", result: String(result ?? "") });
  if (state.stats.events.log.length > EVENTS_HISTORY_MAX) {
    state.stats.events.log.length = EVENTS_HISTORY_MAX;
  }
};

/** Клик по кнопке «Resolve incident» в статус-баре */
export const attemptIncidentFix = () => {
  const inter = state.events.interactive;
  if (inter && inter.kind === "button") resolveInteractive(true);
};

/** Проверка завершения интерактивных событий (вызывается каждый тик) */
function tickInteractive() {
  const inter = state.events.interactive;
  if (!inter) return;
  const now = Date.now();
  if (inter.kind === "clicks" && (inter.clicksDone ?? 0) >= inter.clicksRequired) {
    resolveInteractive(true);
    return;
  }
  if (now >= inter.deadline) {
    resolveInteractive(false);
  }
}

/** Удаление истёкших эффектов */
function tickEffects() {
  const now = Date.now();
  const before = state.events.activeEffects.length;
  state.events.activeEffects = state.events.activeEffects.filter((e) => e.until > now);
  if (state.events.activeEffects.length !== before) {
    recomputeDerived();
    markDirty();
  }
}

/** Canary Release: периодический шанс мгновенного бонуса */
function tickCanary(dtSec) {
  if (!hasUnlock("canary")) return;
  canaryAccumulator += dtSec;
  if (canaryAccumulator < 1) return;
  const ticks = Math.floor(canaryAccumulator);
  canaryAccumulator -= ticks;
  let p = unlockValue("canary");
  if (hasUnlock("flags_toggle") && state.settings.featureFlagsExp) p *= 0.95;
  for (let i = 0; i < ticks; i += 1) {
    if (chance(p)) {
      const bonus = Math.max(50, state.derived.cps * 30);
      addCommits(bonus, "event");
      hooks.log?.("event", `🐦 [canary] Canary release flew! +${fmt(bonus)} commits`);
      break; // не более одного вылета в секунду
    }
  }
}

/** Главный тик системы событий */
export function tickEvents(dtMs) {
  tickEffects();
  tickInteractive();
  tickCanary(dtMs / 1000);

  checkAccumulator += dtMs;
  if (checkAccumulator < EVENT_CHECK_INTERVAL_MS) return;
  checkAccumulator = 0;

  const now = Date.now();
  if (now - lastCheckAt < EVENT_CHECK_INTERVAL_MS / 2) return;
  lastCheckAt = now;

  if (state.resources.lifetimeCommits < BALANCE.events.minLifetimeCommits) return;
  if (state.events.interactive) return; // не плодим события во время мини-игры
  if (now - state.events.lastEventAt < BALANCE.events.cooldownMs) return;

  let p = BALANCE.events.chancePerCheck;
  if (hasUnlock("flags_toggle") && state.settings.featureFlagsExp) p *= 0.95;
  if (!chance(p)) return;

  triggerEvent(pickEvent());
}
