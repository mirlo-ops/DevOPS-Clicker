/**
 * shop-view.js — боковая панель магазина: генераторы и улучшения.
 * Карточки создаются один раз, далее обновляются точечно (стоимость/доступность),
 * чтобы не пересоздавать DOM каждые 500 мс.
 */

import { el, delegate } from "../utils/helpers.js";
import { state, markDirty } from "../core/state.js";
import { BUILDINGS, BUILDING_CATEGORIES } from "../config/buildings.js";
import { UPGRADES, UPGRADE_CATEGORIES } from "../config/upgrades.js";
import { BUY_AMOUNTS } from "../config/constants.js";
import { fmt, fmtRate, fmtInt } from "../utils/format.js";
import {
  isBuildingUnlocked, buildingBulkPrice, buildingAffordable, buyBuilding, nextLockedTeaser,
} from "../core/buildings-system.js";
import { visibleUpgrades, buyUpgrade } from "../core/upgrades-system.js";
import { buildingContribution } from "../core/economy.js";
import { setSetting } from "../systems/settings.js";
import { hideTooltip } from "./tooltips.js";

let dom = null;                 // реестр элементов
let logFn = null;               // (type, text) => void
let soundFn = null;             // (name) => void
let side = "buildings";         // что показано в сайдбаре сейчас
let listRoot = null;            // контейнер списка
const cardRefs = new Map();     // id -> { node, costEl, ownedEl, metaEl, btnEl } для генераторов

/** Инициализация магазина: режим покупки + делегирование кликов */
export function initShop(registry, { log, sound }) {
  dom = registry;
  logFn = log;
  soundFn = sound;

  renderBuyMode();
  setSetting("buyAmount", state.settings.buyAmount ?? 1); // синхронизация после загрузки сейва

  delegate(dom.sidepanelBody, "click", "[data-buy-building]", (e, t) => {
    e.preventDefault();
    purchaseBuilding(t.getAttribute("data-buy-building"));
  });
  delegate(dom.sidepanelBody, "click", "[data-buy-upgrade]", (e, t) => {
    e.preventDefault();
    purchaseUpgrade(t.getAttribute("data-buy-upgrade"));
  });
}

/** Переключить содержимое сайдбара: 'buildings' | 'upgrades' */
export function showShopSide(next) {
  side = next;
  const titles = {
    buildings: "EXPLORER — GENERATORS",
    upgrades: "EXPLORER — EXTENSIONS",
  };
  dom.sidepanelHeader.textContent = titles[side] ?? "MARKETPLACE";
  dom.buyMode.style.display = side === "buildings" ? "" : "none";
  rebuildList();
}

/* ---------------- Режим покупки x1/x10/x100/Max ---------------- */

function renderBuyMode() {
  const g = dom.buyMode;
  g.innerHTML = "";
  const options = [...BUY_AMOUNTS, "max"];
  for (const amount of options) {
    const btn = el("button", {
      cls: "btn",
      text: amount === "max" ? "MAX" : `x${amount}`,
      attrs: { type: "button", "aria-label": `Режим покупки x${amount}` },
    });
    btn.dataset.amount = String(amount);
    btn.addEventListener("click", () => {
      state.settings.buyAmount = amount;
      markDirty();
      syncBuyMode();
      refreshCards(); // цены в карточках меняются вместе с режимом
    });
    g.appendChild(btn);
  }
  syncBuyMode();
}

function syncBuyMode() {
  const cur = String(state.settings.buyAmount ?? 1);
  dom.buyMode.querySelectorAll("[data-amount]").forEach((b) => {
    b.classList.toggle("btn--on", b.dataset.amount === cur);
  });
}

/* ---------------- Покупки ---------------- */

function purchaseBuilding(id) {
  const amount = state.settings.buyAmount ?? 1;
  const mode = amount === "max" ? "max" : "fixed";
  const res = buyBuilding(id, mode === "max" ? Infinity : Number(amount), mode);
  if (!res.ok) {
    if (res.reason === "afford") soundFn?.("error");
    return;
  }
  const cfg = BUILDINGS.find((b) => b.id === id);
  logFn?.("buy", `[shop] Purchased ${cfg.icon} ${cfg.name} x${res.bought} for ${fmt(res.cost)} commits`);
  soundFn?.("deploy");
  refreshCards();
  hideTooltip();
}

function purchaseUpgrade(id) {
  const res = buyUpgrade(id);
  if (!res.ok) {
    if (res.reason === "afford") soundFn?.("error");
    return;
  }
  logFn?.("buy", `[shop] Installed upgrade ${res.cfg.icon} ${res.cfg.name} (-${fmt(res.cfg.cost)})`);
  soundFn?.("achievement");
  rebuildList(); // состав доступных апгрейдов мог измениться
  hideTooltip();
}

/* ---------------- Полная пересборка списка ---------------- */

function rebuildList() {
  if (!listRoot) {
    listRoot = el("div", { cls: "shop-list" });
    dom.sidepanelBody.innerHTML = "";
    dom.sidepanelBody.appendChild(listRoot);
  }
  cardRefs.clear();
  listRoot.innerHTML = "";
  const frag = document.createDocumentFragment();

  if (side === "buildings") {
    let lastCat = null;
    for (const cfg of BUILDINGS) {
      const unlocked = isBuildingUnlocked(cfg);
      if (!unlocked) continue;
      if (cfg.category !== lastCat) {
        lastCat = cfg.category;
        frag.appendChild(el("div", { cls: "shop-category", text: BUILDING_CATEGORIES[cfg.category] ?? cfg.category }));
      }
      frag.appendChild(buildingCard(cfg));
    }
    const teaser = nextLockedTeaser();
    if (teaser) {
      frag.appendChild(el("div", { cls: "shop-category", text: "🔒 locked — скоро" }));
      frag.appendChild(el("div", {
        cls: "building-card building-card--locked",
        html: `<span class="building-card__icon">🔒</span>
          <div><div class="building-card__name">???</div>
          <div class="building-card__desc">Следующий генератор откроется при ${fmt(teaser.need)} lifetime commits.</div></div>`,
      }));
    }
  } else {
    const ups = visibleUpgrades().sort((a, b) => a.cost - b.cost);
    if (!ups.length) {
      frag.appendChild(el("div", { cls: "empty-state", text: "Нет доступных улучшений. Развивайте инфраструктуру!" }));
    }
    let lastCat = null;
    for (const cfg of ups) {
      if (cfg.category !== lastCat) {
        lastCat = cfg.category;
        frag.appendChild(el("div", { cls: "shop-category", text: UPGRADE_CATEGORIES[cfg.category] ?? cfg.category }));
      }
      frag.appendChild(upgradeCard(cfg));
    }
  }
  listRoot.appendChild(frag);
  refreshCards();
}

/* ---------------- Карточки ---------------- */

function buildingCard(cfg) {
  const node = el("div", { cls: "building-card", attrs: { role: "group", "aria-label": cfg.name } });
  node.dataset.building = cfg.id;

  const icon = el("span", { cls: "building-card__icon", text: cfg.icon });
  const info = el("div", {});
  const name = el("div", { cls: "building-card__name", text: cfg.name });
  const desc = el("div", { cls: "building-card__desc", text: cfg.desc });
  info.append(name, desc);

  const right = el("div", { cls: "building-card__right" });
  const owned = el("div", { cls: "building-card__owned", text: "0" });
  const cost = el("div", { cls: "building-card__cost", text: "—" });
  const meta = el("div", { cls: "building-card__meta", text: "" });
  const btn = el("button", {
    cls: "btn btn--primary btn--small",
    text: "Buy",
    attrs: { type: "button", "aria-label": `Купить ${cfg.name}` },
  });
  btn.dataset.buyBuilding = cfg.id;
  right.append(owned, cost, meta, btn);

  node.append(icon, info, right);
  cardRefs.set(cfg.id, { node, owned, cost, meta, btn, cfg });
  return node;
}

function upgradeCard(cfg) {
  const node = el("div", {
    cls: "upgrade-card",
    attrs: {
      tabindex: "0",
      role: "button",
      "aria-label": `${cfg.name}: ${cfg.desc} Стоимость ${fmt(cfg.cost)} коммитов`,
    },
  });
  node.dataset.buyUpgrade = cfg.id;
  node.textContent = cfg.icon;
  node.dataset.tip =
    `<b>${cfg.name}</b><br>${cfg.desc}<br><span class="tooltip__price">💰 ${fmt(cfg.cost)} commits</span>`;
  // Enter/Space для клавиатуры
  node.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      purchaseUpgrade(cfg.id);
    }
  });
  return node;
}

/* ---------------- Точечное обновление (без пересборки DOM) ---------------- */

/** Обновить цены/доступность генераторов и подсветку апгрейдов. Вызывается из renderer. */
export function refreshCards() {
  if (side === "buildings") {
    const amount = state.settings.buyAmount ?? 1;
    for (const { node, owned, cost, meta, btn, cfg } of cardRefs.values()) {
      const have = state.buildings[cfg.id] ?? 0;
      owned.textContent = fmtInt(have);

      let count;
      let price;
      if (amount === "max") {
        count = Math.max(1, buildingAffordable(cfg.id));
        price = buildingBulkPrice(cfg.id, buildingAffordable(cfg.id) || 1);
      } else {
        count = Number(amount);
        price = buildingBulkPrice(cfg.id, count);
      }
      const affordable = state.resources.commits >= price && (amount !== "max" || buildingAffordable(cfg.id) > 0);
      cost.textContent = `💰 ${fmt(price)}`;
      btn.textContent = amount === "max" ? `Buy max (${count})` : `Buy x${count}`;
      btn.disabled = !affordable;
      node.classList.toggle("building-card--unaffordable", !affordable);

      const contrib = buildingContribution(cfg.id);
      const unit = have > 0 ? contrib / have : cfg.baseProd;
      meta.innerHTML = `+${fmtRate(unit)}/s each · total <b>${fmtRate(contrib)}</b>/s`;

      node.dataset.tip =
        `<b>${cfg.icon} ${cfg.name}</b><br>${cfg.desc}<br>` +
        `Стоимость x${amount === "max" ? buildingAffordable(cfg.id) : amount}: <b>${fmt(price)}</b><br>` +
        `Вклад в CPS: <b>${fmtRate(contrib)}</b> (${state.derived.cps > 0 ? Math.round((contrib / state.derived.cps) * 100) : 0}% от общего)`;
    }
  } else {
    // Апгрейды: просто подсвечиваем те, что по карману
    dom.sidepanelBody.querySelectorAll("[data-buy-upgrade]").forEach((node) => {
      const id = node.getAttribute("data-buy-upgrade");
      const cfg = UPGRADES.find((u) => u.id === id);
      if (!cfg) return;
      node.classList.toggle("upgrade-card--unaffordable", state.resources.commits < cfg.cost);
    });
  }
}

/** Есть ли вообще карточки (после разблокировки новых зданий нужен rebuild) */
let lastSignature = "";
export function shopMaybeRebuild() {
  const sig = side === "buildings"
    ? BUILDINGS.filter(isBuildingUnlocked).map((b) => b.id).join(",")
    : visibleUpgrades().map((u) => u.id).join(",");
  if (sig !== lastSignature) {
    lastSignature = sig;
    rebuildList();
  }
}
