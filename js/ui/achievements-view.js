/**
 * achievements-view.js — вкладка достижений (контент области редактора).
 */

import { el } from "../utils/helpers.js";
import { state } from "../core/state.js";
import { ACHIEVEMENTS } from "../config/achievements.js";
import { achievementProgress, unlockedCount, totalCount } from "../systems/achievements.js";
import { fmtDateTime } from "../utils/time.js";
import { fmtPct } from "../utils/format.js";
import { BALANCE } from "../config/balance.js";

let root = null;

/** Отрендерить сетку достижений (вызывается при переключении вкладки) */
export function mountAchievements() {
  root = el("div", { cls: "stats-wrap" });
  const header = el("div", { cls: "panel-section__title", text: "// ACHIEVEMENTS" });
  const counter = el("span", { cls: "muted", attrs: { id: "ach-counter" } });
  header.appendChild(counter);

  const grid = el("div", { cls: "ach-grid", attrs: { id: "ach-grid" } });
  const frag = document.createDocumentFragment();
  for (const ach of ACHIEVEMENTS) frag.appendChild(card(ach));
  grid.appendChild(frag);

  root.append(header, counterRow(), grid);
  return root;
}

function counterRow() {
  return el("div", {
    cls: "stat-card",
    style: "margin-bottom:12px",
    html: `<div class="stat-card__label">Прогресс</div>
      <div class="stat-card__value" id="ach-progress-text"></div>
      <div class="stat-card__sub">Каждое достижение: +${fmtPct(BALANCE.production.achievementBonus)} к производству (макс x${BALANCE.production.achievementBonusCap})</div>`,
  });
}

function card(ach) {
  const rec = state.achievements[ach.id];
  const unlocked = Boolean(rec);
  const node = el("div", {
    cls: `ach-card ${unlocked ? "ach-card--unlocked" : "ach-card--locked"}`,
    attrs: { "data-ach": ach.id },
  });
  const icon = el("div", { cls: "ach-card__icon", text: unlocked ? ach.icon : "🔒" });
  const body = el("div", {});
  body.append(
    el("div", { cls: "ach-card__name", text: ach.name }),
    el("div", { cls: "ach-card__desc", text: ach.desc })
  );
  if (unlocked) {
    body.appendChild(el("div", { cls: "ach-card__date", text: `✔ ${fmtDateTime(rec.unlockedAt)}` }));
  } else if (ach.progress) {
    const p = achievementProgress(ach) ?? 0;
    const bar = el("div", { cls: "ach-progress" });
    bar.appendChild(el("div", { cls: "ach-progress__fill", style: `width:${Math.round(p * 100)}%` }));
    body.appendChild(bar);
  }
  node.append(icon, body);
  return node;
}

/** Лёгкое обновление без пересборки всей сетки (когда вкладка открыта) */
export function refreshAchievements() {
  if (!root) return;
  const done = unlockedCount();
  const total = totalCount();
  const c1 = document.getElementById("ach-counter");
  if (c1) c1.textContent = `  ${done}/${total}`;
  const pt = document.getElementById("ach-progress-text");
  if (pt) pt.textContent = `${done} / ${total}`;

  for (const ach of ACHIEVEMENTS) {
    const node = root.querySelector(`[data-ach="${ach.id}"]`);
    if (!node) continue;
    const unlockedNow = Boolean(state.achievements[ach.id]);
    // Если только что открылось — пересоздаём карточку целиком
    if (unlockedNow && node.classList.contains("ach-card--locked")) {
      node.replaceWith(card(ach));
      continue;
    }
    // Иначе обновляем полоску прогресса
    if (!unlockedNow && ach.progress) {
      const fill = node.querySelector(".ach-progress__fill");
      if (fill) fill.style.width = `${Math.round((achievementProgress(ach) ?? 0) * 100)}%`;
    }
  }
}

/** Сбросить кэш после престижа/wipe (сетка будет пересоздана при следующем mount) */
export const invalidateAchievements = () => { root = null; };
