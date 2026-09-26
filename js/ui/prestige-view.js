/**
 * prestige-view.js — вкладка «Migration to Cloud» в области редактора.
 * Показывает предстоящую награду, текущие бонусы токенов и кнопку престижа.
 */

import { el } from "../utils/helpers.js";
import { state } from "../core/state.js";
import { BALANCE } from "../config/balance.js";
import { PRESTIGE_CONFIG } from "../config/prestige.js";
import { pendingTokens, activeBonuses, doPrestige, isPrestigeAvailable } from "../core/prestige-system.js";
import { fmt, fmtInt, fmtMult, fmtPct } from "../utils/format.js";
import { fmtDateTime } from "../utils/time.js";
import { confirmModal, closeModal } from "./modals.js";
import { log } from "./terminal-log.js";
import { notify } from "../systems/notifications.js";
import { playSound } from "../systems/sound.js";
import { saveGame } from "../systems/save.js";
import { recomputeDerived } from "../core/economy.js";

let root = null;
let refs = {};

/** Отрендерить вкладку престижа */
export function mountPrestige() {
  root = el("div", { cls: "stats-wrap" });

  const title = el("div", { cls: "panel-section__title", text: `// ${PRESTIGE_CONFIG.name.toUpperCase()}` });
  const flavor = el("pre", { cls: "ascii-art", text: PRESTIGE_CONFIG.flavor.join("\n"), attrs: { "aria-hidden": "true" } });

  const card = el("div", { cls: "prestige-card" });
  refs.pendingLabel = el("div", { cls: "prestige-card__value", text: "0 ☁" });
  refs.reqText = el("div", { cls: "muted", text: "" });
  refs.prestigeBtn = el("button", {
    cls: "btn btn--primary",
    text: "☁ terraform apply -destroy && migrate",
    attrs: { type: "button", "aria-label": "Совершить престиж" },
  });
  refs.prestigeBtn.addEventListener("click", () => askPrestige());
  card.append(
    el("div", { cls: "prestige-card__title", text: "Доступно Cloud Tokens при переезде:" }),
    refs.pendingLabel,
    refs.reqText,
    (() => {
      const row = el("div", { style: "margin-top:10px" });
      row.appendChild(refs.prestigeBtn);
      return row;
    })(),
  );

  const bonuses = el("div", { cls: "prestige-card" });
  bonuses.appendChild(el("div", { cls: "prestige-card__title", text: "Постоянные бонусы от токенов" }));
  refs.bonusRows = {};
  for (const b of PRESTIGE_CONFIG.bonusesList) {
    const row = el("div", { cls: "prestige-bonus" });
    const val = el("b", { text: "—" });
    row.append(el("span", { text: b.label }), val);
    bonuses.appendChild(row);
    refs.bonusRows[b.key] = val;
  }

  const history = el("div", { cls: "stat-rows", attrs: { id: "prestige-history" } });
  refs.history = history;

  root.append(title, flavor, card, bonuses,
    el("div", { cls: "panel-section__title", text: "// HISTORY" }), history);

  refreshPrestige();
  return root;
}

/** Лёгкое обновление цифр (вызывается раз в 500мс пока вкладка открыта) */
export function refreshPrestige() {
  if (!root) return;
  const gain = pendingTokens();
  const avail = isPrestigeAvailable();
  refs.pendingLabel.textContent = `${fmtInt(gain)} ☁`;
  refs.reqText.innerHTML = avail
    ? `Готово к переезду! Run commits: <b>${fmt(state.resources.runCommits)}</b>`
    : `${PRESTIGE_CONFIG.requirementText}<br>Текущий ран: ${fmt(state.resources.runCommits)} commits.`;
  refs.prestigeBtn.disabled = !avail;

  const b = activeBonuses();
  refs.bonusRows.prod.textContent = fmtMult(b.prod);
  refs.bonusRows.click.textContent = fmtMult(b.click);
  refs.bonusRows.cost.textContent = `-${fmtPct(b.cost, 0)}`;
  refs.bonusRows.offline.textContent = fmtPct(b.offline, 0);

  const hist = [];
  hist.push(statRow("Престижей совершено:", fmtInt(state.stats.prestige.count)));
  if (state.stats.prestige.lastAt) hist.push(statRow("Последний переезд:", fmtDateTime(state.stats.prestige.lastAt)));
  hist.push(statRow("Cloud Tokens сейчас:", fmtInt(state.resources.prestigeTokens)));
  hist.push(statRow("Lifetime токенов:", fmtInt(state.resources.lifetimePrestigeTokens)));
  refs.history.replaceChildren(...hist);
}

const statRow = (k, v) => {
  const r = el("div", { cls: "stat-row" });
  r.append(el("span", { cls: "stat-row__key", text: k }), el("span", { cls: "stat-row__val", text: v }));
  return r;
};

/** Модалка подтверждения престижа с раскладом потерь/приобретений */
function askPrestige() {
  const gain = pendingTokens();
  if (gain <= 0) return;
  confirmModal(
    "⚠ Подтвердите Migration to Cloud",
    `<p>Будут <b class="modal__highlight">сброшены</b>: коммиты, все генераторы и обычные улучшения этого рана.</p>
     <p>Останутся: Cloud Tokens, достижения, статистика, настройки.</p>
     <p>Вы получите: <b class="modal__highlight">${fmtInt(gain)} Cloud Tokens</b>
     (+${fmtPct(gain * BALANCE.prestige.tokenProductionBonus, 0)} к производству,
     +${fmtPct(gain * BALANCE.click.tokenClickBonus, 0)} к клику навсегда).</p>`,
    () => performPrestige(gain),
    "☁ MIGRATE",
  );
}

function performPrestige(expectedGain) {
  const res = doPrestige();
  if (!res.ok) {
    notify("Престиж недоступен", "Недостаточно lifetime commits этого рана.", "error");
    playSound("error");
    return;
  }
  closeModal();
  saveGame();
  recomputeDerived();
  log("prestige", `[prestige] Migration complete: +${res.gain} Cloud Tokens. New stack provisioned from scratch.`);
  notify("🚀 Migration to Cloud", `Получено ${fmtInt(res.gain)} Cloud Tokens. Инфраструктура пересобрана.`, "achievement");
  playSound("achievement");
  // Пересобираем магазин/вкладки после полного сброса
  window.dispatchEvent(new CustomEvent("devops:prestiged", { detail: { gain: res.gain ?? expectedGain } }));
}
