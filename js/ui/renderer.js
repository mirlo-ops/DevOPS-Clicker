/**
 * renderer.js — точечное обновление UI без пересборки DOM каждый кадр.
 * Кэширует последние выведенные строки: в DOM летит только изменившийся текст.
 */

import { state } from "../core/state.js";
import { fmt, fmtInt, fmtRate } from "../utils/format.js";
import { BUILDINGS } from "../config/buildings.js";
import { isBuildingUnlocked } from "../core/buildings-system.js";
import { visibleUpgrades } from "../core/upgrades-system.js";
import { pendingTokens, isPrestigeAvailable } from "../core/prestige-system.js";
import { refreshCards, shopMaybeRebuild } from "./shop-view.js";
import { refreshCurrent } from "./tabs.js";
import { log } from "./terminal-log.js";
import { spawnFloat } from "./floating-text.js";
import { CLICKS_LOG_THROTTLE_MS } from "../config/constants.js";

let dom = null;                       // реестр элементов из buildLayout()
const cache = new Map();              // key -> последняя выведенная строка
let lastClickLogAt = 0;               // троттлинг логов кликов
let prestigeAnnounced = false;        // не спамим сообщением о доступном престиже

/** Записать текст в узел, только если он изменился (защита от layout thrash) */
function setText(node, key, value) {
  if (!node) return;
  if (cache.get(key) === value) return;
  cache.set(key, value);
  node.textContent = value;
}

/** Инициализация рендерера */
export function initRenderer(registry) {
  dom = registry;
}

/** Реакция на клик: всплывающее число, анимация кнопки, лог */
export function onGameClick({ gain, crit, x, y }) {
  // Анимация нажатия кнопки
  dom.commitBtn?.classList.add("is-pressed");
  setTimeout(() => dom.commitBtn?.classList.remove("is-pressed"), 90);

  // Всплывающее число в координатах курсора
  spawnFloat(x, y, gain, crit);

  // Лог кликов — с троттлингом, чтобы не забивать терминал
  const now = Date.now();
  if (now - lastClickLogAt >= CLICKS_LOG_THROTTLE_MS) {
    lastClickLogAt = now;
    log("click", `[main] Commit created: +${fmt(gain)}${crit ? " ⚡CRITICAL" : ""}`);
  }
}

/** Обновить статус инцидента в статус-баре (мини-игры событий) */
function renderIncident() {
  const inter = state.events.interactive;
  const wrap = dom.stIncident;
  if (!wrap) return;
  if (!inter) {
    if (!wrap.hidden) wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  const remainMs = Math.max(0, inter.deadline - Date.now());
  const btn = dom.btnIncident;
  if (btn) {
    if (inter.kind === "clicks") {
      btn.textContent = `🦕 ${inter.clicksDone ?? 0}/${inter.clicksRequired} · ${Math.ceil(remainMs / 1000)}s`;
    } else {
      btn.textContent = `🚨 RESOLVE (${Math.ceil(remainMs / 1000)}s)`;
    }
  }
}

/** Основной «тикер» интерфейса — вызывается из игрового цикла ~раз в кадр,
 *  но внутри всё равно есть кэш, так что стоимость мизерная. */
export function renderFrame(fps) {
  if (!dom) return;
  const r = state.resources;
  const d = state.derived;

  /* Верхняя панель ресурсов */
  setText(dom.resources.commits, "res-commits", fmt(r.commits));
  setText(dom.resources.commitsSub, "res-commits-sub",
    `lifetime: ${fmt(r.lifetimeCommits)} · run: ${fmt(r.runCommits)}`);
  setText(dom.resources.cps, "res-cps", `${fmtRate(d.cps)}/s`);
  setText(dom.resources.clickPower, "res-clickpower", fmt(d.clickPower));
  setText(dom.resources.tokens, "res-tokens", fmtInt(r.prestigeTokens));

  /* Статус-бар */
  setText(dom.stCommits, "st-commits", `${fmt(r.commits)} commits`);
  setText(dom.stCps, "st-cps", `${fmtRate(d.cps)}/s`);
  if (fps !== null && fps !== undefined) {
    setText(dom.stFps, "st-fps", `${fps} fps`);
  }

  /* Подсказка под кнопкой кликера */
  const note = document.getElementById("click-power-note");
  if (note) {
    const critPct = Math.round(state.click.criticalChance * 100);
    setText(note, "click-note",
      `# click power: ${fmt(d.clickPower)} · crit ${critPct}% ×${state.click.criticalMultiplier}` +
      (state.events.activeEffects.length
        ? ` · active effects: ${state.events.activeEffects.map((e) => e.label).join(", ")}`
        : ""));
  }

  /* Статус-лайн деплоя меняет цвет при негативных эффектах */
  if (dom.deployStatus) {
    const bad = state.events.activeEffects.some((e) => e.type === "prod_mult" && e.value < 1);
    setText(dom.deployStatus, "deploy-status",
      bad ? "$ status: pipeline degraded ⚠ (см. эффекты событий)" : "$ status: pipeline green ✔");
  }

  renderIncident();

  /* Сообщение о доступном престиже (один раз за ран) */
  if (isPrestigeAvailable() && !prestigeAnnounced) {
    prestigeAnnounced = true;
    log("prestige", `[prestige] Migration to cloud available: +${pendingTokens()} Cloud Tokens`);
  }
  if (!isPrestigeAvailable()) prestigeAnnounced = false;
}

/** Тяжёлое обновление — раз в UI_FULL_REFRESH_MS (2 раза в секунду) */
export function renderHeavy() {
  if (!dom) return;
  shopMaybeRebuild();          // новые разблокировки в магазине
  refreshCards();              // цены/доступность карточек
  refreshCurrent();            // контент открытой вкладки редактора
  updateBadgeCounts();         // счётчики на activity bar
}

/* ---------------- Бейджи на activity bar ---------------- */

function updateBadgeCounts() {
  const b = dom.actButtons;
  if (!b) return;
  setBadge(b.buildings, BUILDINGS.filter(isBuildingUnlocked).length);
  setBadge(b.upgrades, visibleUpgrades().length);
  setBadge(b.prestige, isPrestigeAvailable() ? pendingTokens() : 0);
}

function setBadge(btn, n) {
  if (!btn) return;
  let badge = btn.querySelector(".activity-badge");
  if (n > 0) {
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "activity-badge";
      btn.appendChild(badge);
    }
    const text = fmtInt(Math.min(n, 9999));
    if (badge.textContent !== text) badge.textContent = text;
  } else if (badge) {
    badge.remove();
  }
}

/** Сброс кэша после престижа / wipe — иначе старые строки «залипнут» */
export const invalidateRenderCache = () => {
  cache.clear();
};
