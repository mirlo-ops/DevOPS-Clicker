/**
 * stats-view.js — вкладка «Статистика» с внутренними разделами:
 * Обзор / Производство / Клики / Достижения / История / События.
 * Графики рисуются на чистом canvas (sparkline), без внешних библиотек.
 */

import { el, downloadText } from "../utils/helpers.js";
import { state } from "../core/state.js";
import { BUILDINGS } from "../config/buildings.js";
import { ACHIEVEMENTS } from "../config/achievements.js";
import { EVENTS } from "../config/events.js";
import { unlockedCount, totalCount } from "../systems/achievements.js";
import { averageCps, topBuildings, lifetimeAvgCps } from "../systems/stats.js";
import { buildingContribution } from "../core/economy.js";
import { pendingTokens, activeBonuses } from "../core/prestige-system.js";
import { fmt, fmtInt, fmtRate, fmtPct, fmtMult, safeNum } from "../utils/format.js";
import { fmtDuration, fmtDateTime } from "../utils/time.js";
import { openModal } from "./modals.js";
import { hasUnlock } from "../core/upgrades-system.js";
import { totalBuildingsOwned } from "../core/buildings-system.js";
import { ownedUpgrades } from "../core/upgrades-system.js";

const SECTIONS = [
  { id: "overview", label: "Обзор" },
  { id: "production", label: "Производство" },
  { id: "clicks", label: "Клики" },
  { id: "achievements", label: "Достижения" },
  { id: "history", label: "История" },
  { id: "events", label: "События" },
];

let root = null;
let section = "overview";
let sparkCanvas = null;

/* ---------------- Сборка вкладки ---------------- */

export function mountStats() {
  root = el("div", { cls: "stats-wrap" });

  const tabsRow = el("div", { cls: "stats-tabs", attrs: { role: "tablist", "aria-label": "Разделы статистики" } });
  for (const s of SECTIONS) {
    const btn = el("button", {
      cls: `tab${s.id === section ? " tab--active" : ""}`,
      text: s.label,
      attrs: { type: "button", role: "tab", "data-stats-section": s.id, "aria-selected": String(s.id === section) },
    });
    tabsRow.appendChild(btn);
  }
  tabsRow.addEventListener("click", (e) => {
    const btn = e.target.closest?.("[data-stats-section]");
    if (!btn) return;
    section = btn.getAttribute("data-stats-section");
    tabsRow.querySelectorAll("[data-stats-section]").forEach((t) => {
      const on = t === btn;
      t.classList.toggle("tab--active", on);
      t.setAttribute("aria-selected", String(on));
    });
    renderSection();
  });

  const body = el("div", { attrs: { id: "stats-body" } });
  root.append(el("div", { cls: "panel-section__title", text: "// TELEMETRY" }), tabsRow, body);
  renderSection();
  return root;
}

/** Лёгкое обновление (раз в 500мс, пока вкладка открыта) */
export function refreshStats() {
  if (!root) return;
  renderSection();
}

function renderSection() {
  const body = root?.querySelector("#stats-body");
  if (!body) return;
  const builders = {
    overview: overviewSection,
    production: productionSection,
    clicks: clicksSection,
    achievements: achievementsSection,
    history: historySection,
    events: eventsSection,
  };
  body.innerHTML = "";
  body.appendChild((builders[section] ?? overviewSection)());
}

/* ---------------- Хелперы разметки ---------------- */

const statCard = (label, value, sub = "") =>
  el("div", {
    cls: "stat-card",
    html: `<div class="stat-card__label">${label}</div>
           <div class="stat-card__value">${value}</div>
           ${sub ? `<div class="stat-card__sub">${sub}</div>` : ""}`,
  });

const statRow = (k, v) => {
  const r = el("div", { cls: "stat-row" });
  r.append(el("span", { cls: "stat-row__key", text: k }), el("span", { cls: "stat-row__val", text: v }));
  return r;
};

const rowsBlock = (pairs) => {
  const wrap = el("div", { cls: "stat-rows" });
  wrap.append(...pairs.map(([k, v]) => statRow(k, v)));
  return wrap;
};

/* ---------------- Раздел: обзор ---------------- */

function overviewSection() {
  const frag = document.createDocumentFragment();
  const grid = el("div", { cls: "stat-grid" });
  grid.append(
    statCard("Текущие коммиты", fmt(state.resources.commits)),
    statCard("Генераторов в строю", fmtInt(totalBuildingsOwned()), `улучшений установлено: ${fmtInt(ownedUpgrades().length)}`),
    statCard("Lifetime commits", fmt(state.resources.lifetimeCommits), "за всё время со всеми престижами"),
    statCard("За сегодня", fmt(state.stats.today.commits), `${fmtInt(state.stats.today.clicks)} кликов`),
    statCard("За сессию", fmt(state.stats.sessionCommits)),
    statCard("CPS сейчас", `${fmtRate(state.derived.cps)}/s`, `средний: ${fmtRate(averageCps())}/s · лучший: ${fmtRate(state.stats.bestCps)}/s`),
    statCard("Cloud Tokens", fmtInt(state.resources.prestigeTokens), `престиж доступен за: ${fmtInt(pendingTokens())} ☁`),
  );
  frag.appendChild(grid);

  // Sparkline дохода
  const spark = el("div", { cls: "spark-block" });
  spark.appendChild(el("div", { cls: "spark-block__title", html: "<span>CPS history (10 min)</span><span>avg ${}</span>".replace("${}", fmtRate(averageCps())) }));
  sparkCanvas = el("canvas", { cls: "spark", attrs: { "aria-label": "График дохода в секунду", role: "img" } });
  spark.appendChild(sparkCanvas);
  frag.appendChild(spark);
  requestAnimationFrame(() => drawSparkline(sparkCanvas, state.stats.cpsHistory));

  frag.appendChild(rowsBlock([
    ["Генераторов куплено всего:", fmtInt(state.stats.buildingsBoughtTotal)],
    ["Улучшений куплено:", fmtInt(state.stats.upgradesBoughtTotal)],
    ["Достижений:", `${unlockedCount()} / ${totalCount()}`],
    ["Время в игре:", fmtDuration(state.stats.playTimeMs)],
    ["Прошлая сессия:", fmtDuration(state.stats.lastSessionMs)],
    ["Сохранений:", fmtInt(state.stats.savesCount)],
  ]));
  return fragWrapper(frag);
}

/** Обёртка для fragment -> div (некоторые секции возвращают узлы списком) */
function fragWrapper(frag) {
  const box = el("div", {});
  box.appendChild(frag);
  return box;
}

/* ---------------- Раздел: производство ---------------- */

function productionSection() {
  const b = activeBonuses();
  const box = el("div", {});
  const grid = el("div", { cls: "stat-grid" });
  grid.append(
    statCard("Базовый CPS", fmtRate(state.production.baseCps), "сумма генераторов до множителей"),
    statCard("Глобальный множитель", fmtMult(state.production.multiplier), "престиж + ачивки + апгрейды + события"),
    statCard("Итоговый CPS", `${fmtRate(state.derived.cps)}/s`, `среднее за игру: ${fmtRate(lifetimeAvgCps())}/s`),
    statCard("Офлайн-эффективность", fmtPct(state.derived.offlineEfficiency, 0), `скидка на генераторы: -${fmtPct(state.derived.costDiscount, 0)}`),
  );
  box.appendChild(grid);

  box.appendChild(el("div", { cls: "panel-section__title", text: "// TOP BUILDERS" }));
  const tops = topBuildings(8);
  if (!tops.length) {
    box.appendChild(el("div", { cls: "empty-state", text: "Генераторы ещё не приносят доход. Купите Junior Developer!" }));
  } else {
    const max = tops[0].contribution || 1;
    const list = el("div", {});
    for (const t of tops) {
      const item = el("div", { cls: "top-item" });
      item.append(
        el("span", { text: t.icon }),
        el("span", { text: `${t.name} ×${fmtInt(t.owned)}` }),
        el("span", { cls: "stat-row__val", text: `${fmtRate(t.contribution)}/s` }),
        el("span", { cls: "muted", text: fmtPct(t.contribution / (state.derived.cps || 1), 0) }),
        el("div", { cls: "top-item__bar", html: `<div class="top-item__fill" style="width:${Math.round((t.contribution / max) * 100)}%"></div>` }),
      );
      list.appendChild(item);
    }
    box.appendChild(list);
  }

  box.appendChild(el("div", { cls: "panel-section__title", text: "// BREAKDOWN" }));
  box.appendChild(rowsBlock(BUILDINGS.filter((bd) => (state.buildings[bd.id] ?? 0) > 0).map((bd) => [
    `${bd.icon} ${bd.name} ×${fmtInt(state.buildings[bd.id])}`,
    `${fmtRate(buildingContribution(bd.id))}/s`,
  ])));

  box.appendChild(el("div", { cls: "panel-section__title", text: "// PRESTIGE BONUSES" }));
  box.appendChild(rowsBlock([
    ["Production ×", fmtMult(b.prod)],
    ["Click ×", fmtMult(b.click)],
    ["Cost discount", `-${fmtPct(b.cost, 0)}`],
    ["Offline", fmtPct(b.offline, 0)],
  ]));
  return box;
}

/* ---------------- Раздел: клики ---------------- */

function clicksSection() {
  const c = state.stats.clicks;
  const box = el("div", {});
  const grid = el("div", { cls: "stat-grid" });
  grid.append(
    statCard("Ручных кликов", fmtInt(c.manual)),
    statCard("Критических", fmtInt(c.crits), `шанс ${fmtPct(state.click.criticalChance, 0)} · ×${state.click.criticalMultiplier}`),
    statCard("Лучший клик", fmt(c.bestClickValue)),
    statCard("Сила клика", fmt(state.derived.clickPower), `всего заработано кликами: ${fmt(state.stats.earnedBySource.click)}`),
  );
  box.appendChild(grid);
  const perClick = c.manual > 0 ? state.stats.earnedBySource.click / c.manual : 0;
  box.appendChild(rowsBlock([
    ["Средний доход с клика:", fmt(perClick)],
    ["Доля ручного дохода:", fmtPct(c.manual && state.resources.lifetimeCommits ? state.stats.earnedBySource.click / state.resources.lifetimeCommits : 0, 1)],
    ["Автодоход (production):", fmt(state.stats.earnedBySource.production)],
    ["Офлайн-доход:", fmt(state.stats.offlineEarnedTotal)],
    ["Потрачено на генераторы:", fmt(state.stats.spentOnBuildings)],
    ["Потрачено на улучшения:", fmt(state.stats.spentOnUpgrades)],
  ]));
  return box;
}

/* ---------------- Раздел: достижения ---------------- */

function achievementsSection() {
  const box = el("div", {});
  box.appendChild(el("div", { cls: "panel-section__title", text: `// UNLOCKED ${unlockedCount()}/${totalCount()}` }));
  const list = el("ul", { cls: "bare-list" });
  for (const ach of ACHIEVEMENTS) {
    const rec = state.achievements[ach.id];
    const item = el("li", { cls: "stat-row" });
    item.append(
      el("span", { cls: "stat-row__key", text: `${rec ? "✔" : "•"} ${ach.icon} ${ach.name}` }),
      el("span", { cls: "stat-row__val", text: rec ? fmtDateTime(rec.unlockedAt) : ach.desc }),
    );
    list.appendChild(item);
  }
  box.appendChild(list);
  return box;
}

/* ---------------- Раздел: история ---------------- */

function historySection() {
  const box = el("div", {});
  box.appendChild(el("div", { cls: "panel-section__title", text: "// CPS HISTORY" }));
  sparkCanvas = el("canvas", { cls: "spark", attrs: { "aria-label": "История CPS", role: "img" } });
  box.appendChild(sparkCanvas);
  requestAnimationFrame(() => drawSparkline(sparkCanvas, state.stats.cpsHistory));
  box.appendChild(rowsBlock([
    ["Точек истории:", fmtInt(state.stats.cpsHistory.length)],
    ["Первая точка:", state.stats.cpsHistory[0] ? fmtDateTime(state.stats.cpsHistory[0].t) : "—"],
    ["Последняя точка:", state.stats.cpsHistory.at(-1) ? fmtDateTime(state.stats.cpsHistory.at(-1).t) : "—"],
    ["Начало сессии:", fmtDateTime(state.stats.sessionStart)],
    ["Последний престиж:", state.stats.prestige.lastAt ? fmtDateTime(state.stats.prestige.lastAt) : "—"],
  ]));

  const actions = el("div", { style: "margin-top:12px; display:flex; gap:8px; flex-wrap:wrap" });
  const exportBtn = el("button", { cls: "btn btn--ghost", text: "⬇ Экспорт сохранения", attrs: { type: "button" } });
  exportBtn.addEventListener("click", async () => {
    const { exportSaveString } = await import("../systems/save.js");
    downloadText("devops-clicker-save.json", exportSaveString(), "text/plain");
  });
  actions.appendChild(exportBtn);
  box.appendChild(actions);
  return box;
}

/* ---------------- Раздел: события ---------------- */

function eventsSection() {
  const box = el("div", {});
  const ev = state.stats.events;
  const grid = el("div", { cls: "stat-grid" });
  grid.append(
    statCard("Всего событий", fmtInt(ev.total)),
    statCard("Инцидентов", fmtInt(ev.incidents), `отбито: ${fmtInt(ev.resolvedIncidents)} (${ev.incidents ? Math.round((ev.resolvedIncidents / ev.incidents) * 100) : 0}% SLA)`),
    statCard("Активных эффектов", fmtInt(state.events.activeEffects.length)),
    statCard("Доход от событий", fmt(state.stats.earnedBySource.event)),
  );
  box.appendChild(grid);

  if (hasUnlock("advanced_stats")) {
    box.appendChild(el("div", { cls: "panel-section__title", text: "// EXTENDED (Observability Stack)" }));
    box.appendChild(rowsBlock([
      ["Все возможные события:", fmtInt(EVENTS.length)],
      ["Последнее событие:", state.events.lastEventAt ? fmtDateTime(state.events.lastEventAt) : "—"],
      ["Множитель престижа:", fmtMult(activeBonuses().prod)],
    ]));
  } else {
    box.appendChild(el("div", { cls: "empty-state", text: "🔭 Купите улучшение Observability Stack, чтобы открыть расширенную телеметрию." }));
  }

  box.appendChild(el("div", { cls: "panel-section__title", text: "// EVENT LOG" }));
  const logRows = (ev.log ?? []).slice(0, 30);
  if (!logRows.length) {
    box.appendChild(el("div", { cls: "empty-state", text: "Событий пока не было. Они начинаются после 100 lifetime commits." }));
  } else {
    const list = el("div", { cls: "stat-rows" });
    for (const rec of logRows) {
      list.appendChild(statRow(`${fmtDateTime(rec.t)} · ${rec.name}`, String(rec.result).slice(0, 90)));
    }
    box.appendChild(list);
  }
  return box;
}

/* ---------------- Sparkline на чистом canvas ---------------- */

function drawSparkline(canvas, points) {
  if (!canvas) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || canvas.parentElement?.clientWidth || 400;
  const h = 90;
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.floor(h * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  // сетка
  ctx.strokeStyle = "rgba(60,60,60,0.5)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i += 1) {
    const y = (h / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const data = (points ?? []).map((p) => safeNum(p.cps)).filter((n) => Number.isFinite(n));
  if (data.length < 2) {
    ctx.fillStyle = "#858585";
    ctx.font = "11px monospace";
    ctx.fillText("collecting telemetry…", 8, h / 2);
    return;
  }
  const max = Math.max(...data, 1);
  const stepX = w / (data.length - 1);
  const toY = (v) => h - 4 - (v / max) * (h - 10);

  // область под линией
  ctx.beginPath();
  ctx.moveTo(0, h);
  data.forEach((v, i) => ctx.lineTo(i * stepX, toY(v)));
  ctx.lineTo((data.length - 1) * stepX, h);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "rgba(0,255,65,0.22)");
  grad.addColorStop(1, "rgba(0,255,65,0.02)");
  ctx.fillStyle = grad;
  ctx.fill();

  // линия
  ctx.beginPath();
  data.forEach((v, i) => (i === 0 ? ctx.moveTo(0, toY(v)) : ctx.lineTo(i * stepX, toY(v))));
  ctx.strokeStyle = "#00ff41";
  ctx.lineWidth = 1.5;
  ctx.shadowColor = "rgba(0,255,65,0.7)";
  ctx.shadowBlur = 4;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // подпись максимума
  ctx.fillStyle = "#858585";
  ctx.font = "10px monospace";
  ctx.fillText(`max ${fmt(max)}/s`, 6, 12);
}

/** Открыть модалку «как играть» (используется из main.js при первом запуске) */
export const showHelpModal = () => {
  openModal({
    title: "📖 README.md — как играть",
    wide: true,
    bodyHtml: `
      <p><b>DevOPS Clicker</b> — кликер про CI/CD и облачную инфраструктуру.</p>
      <ul class="bare-list">
        <li>▸ Кликайте <code>git commit -m "fix prod"</code> — это основная валюта (commits).</li>
        <li>▸ Покупайте генераторы (вкладка Extensions слева) — они дают пассивный CPS.</li>
        <li>▸ Улучшения усиливают клик, здания и глобальное производство.</li>
        <li>▸ Следите за терминалом: инциденты нужно отбивать кнопкой в статус-баре или быстрыми кликами.</li>
        <li>▸ После ~1M lifetime commits станет доступен престиж <b>Migration to Cloud</b> за Cloud Tokens.</li>
        <li>▸ Прогресс сохраняется автоматически; экспорт/импорт — во вкладке Настройки.</li>
      </ul>`,
    buttons: [{ label: "Понятно", cls: "btn--primary" }],
  });
};

