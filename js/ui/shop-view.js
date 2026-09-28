/**
 * shop-view.js — боковая панель магазина: генераторы и улучшения.
 * Карточки создаются один раз, далее обновляются точечно (стоимость/доступность),
 * чтобы не пересоздавать DOM каждые 500 мс.
 *
 * UX (Блок 3):
 *  - Кнопка Buy активна (ярко-синяя, hover, pointer) только когда хватает коммитов;
 *    иначе — полупрозрачная, not-allowed, текст "Need X more commits".
 *  - Тултипы карточек: название, описание, уровень, цена, +CPS/sec, доля в доходе %.
 *  - Новые разблокированные здания пульсируют рамкой и носят бейдж NEW до первой покупки.
 */

import { el, delegate } from "../utils/helpers.js";
import { state, markDirty } from "../core/state.js";
import { BUILDINGS, BUILDING_CATEGORIES } from "../config/buildings.js";
import { UPGRADES, UPGRADE_CATEGORIES } from "../config/upgrades.js";
import { BUY_AMOUNTS } from "../config/constants.js";
import { fmt, fmtRate, fmtInt } from "../utils/format.js";
import {
  isBuildingUnlocked, buildingBulkPrice, buildingAffordable, buyBuilding, nextLockedTeaser,
  findBuildingCfg, buildingUnitCpsGain, buildingIncomeSharePct, markBuildingBought,
} from "../core/buildings-system.js";
import { visibleUpgrades, buyUpgrade, getUpgradeCfg } from "../core/upgrades-system.js";
import { buildingContribution, upgradeEffectLabel } from "../core/economy.js";
import { setSetting } from "../systems/settings.js";
import { hideTooltip, tipRow, buildTooltip } from "./tooltips.js";

let dom = null;                 // реестр элементов
let logFn = null;               // (type, text) => void
let soundFn = null;             // (name) => void
let side = "buildings";         // что показано в сайдбаре сейчас
let listRoot = null;            // контейнер списка
const cardRefs = new Map();     // id -> { node, ownedEl, costEl, metaEl, btnEl, cfg, seenAt }

/** Инициализация магазина: режим покупки + делегирование кликов */
export function initShop(registry, { log, sound }) {
  dom = registry;
  logFn = log;
  soundFn = sound;

  renderBuyMode();
  syncBuyAmount();

  /* FIX (Блок 1): клик по всей карточке тоже покупает — раньше игрок мог
     «промахнуться» мимо маленькой кнопки Buy. Нормализуем id из атрибута
     (trim) — обработчик больше не зависит от точного написания ключа. */
  delegate(dom.sidepanelBody, "click", "[data-buy-building]", (e, t) => {
    e.preventDefault();
    purchaseBuilding(String(t.getAttribute("data-buy-building") ?? "").trim());
  });
  // Делегат на всю карточку: если кликнули не в кнопку — покупаем всё равно
  delegate(dom.sidepanelBody, "click", ".building-card:not(.building-card--locked)", (e, t) => {
    if (e.target.closest("[data-buy-building]")) return; // уже обработано выше
    const id = String(t.dataset.building ?? "").trim();
    if (id) purchaseBuilding(id);
  });
  delegate(dom.sidepanelBody, "click", "[data-buy-upgrade]", (e, t) => {
    e.preventDefault();
    purchaseUpgrade(String(t.getAttribute("data-buy-upgrade") ?? "").trim());
  });
}

/** Режим покупки должен существовать в state.settings, иначе setSetting его проглотит */
function syncBuyAmount() {
  const cur = state.settings.buyAmount ?? 1;
  if (!("buyAmount" in state.settings)) {
    state.settings.buyAmount = 1; // страховка для старых сейвов
  }
  setSetting("buyAmount", cur); // синхронизация после загрузки сейва
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
  lastSignature = ""; // при смене вкладки пересобрать принудительно
  rebuildList();
  shopMaybeRebuild();
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

function purchaseBuilding(rawId) {
  const id = String(rawId ?? "").trim();
  const cfg = findBuildingCfg(id); // нормализованный поиск (fix рассинхрона ключей)
  if (!cfg) return;
  const amount = state.settings.buyAmount ?? 1;
  const mode = amount === "max" ? "max" : "fixed";
  const res = buyBuilding(cfg.id, mode === "max" ? Infinity : Number(amount), mode);
  if (!res.ok) {
    if (res.reason === "afford") {
      soundFn?.("error");
      flashNeedMore(cfg.id);
    } else if (res.reason === "unknown") {
      console.warn(`[shop] Unknown building id: "${rawId}"`);
    }
    refreshCards();
    return;
  }
  markBuildingBought(cfg.id);
  logFn?.("buy", `[shop] Purchased ${cfg.icon} ${cfg.name} x${res.bought} for ${fmt(res.cost)} commits`);
  soundFn?.("deploy");
  // Мгновенный пересчёт стоимости следующего уровня и CPS в статус-баре
  refreshCards();
  dom.commitBtn?.classList.remove("is-pressed");
  hideTooltip();
}

function purchaseUpgrade(rawId) {
  const id = String(rawId ?? "").trim();
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

/** Короткая подсветка «не хватило» прямо на кнопке */
function flashNeedMore(id) {
  const ref = cardRefs.get(id);
  if (!ref) return;
  ref.node.classList.add("building-card--denied");
  setTimeout(() => ref.node.classList.remove("building-card--denied"), 450);
}

/* ---------------- Полная пересборка списка ---------------- */

function rebuildList() {
  if (!listRoot) {
    listRoot = el("div", { cls: "shop-list" });
    dom.sidepanelBody.innerHTML = "";
    dom.sidepanelBody.appendChild(listRoot);
  }
  // Сохраняем «видели ли уже это здание» между пересборками (для NEW-бейджей)
  const prevSeen = new Map([...cardRefs.entries()].map(([k, v]) => [k, v.seenAt]));
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
      frag.appendChild(buildingCard(cfg, prevSeen.get(cfg.id)));
    }
    const teaser = nextLockedTeaser();
    if (teaser) {
      frag.appendChild(el("div", { cls: "shop-category", text: "🔒 locked — скоро" }));
      frag.appendChild(el("div", {
        cls: "building-card building-card--locked",
        html: `<span class="building-card__icon building-card__icon--locked">🔒</span>
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

function buildingCard(cfg, seenAt = undefined) {
  const node = el("div", { cls: "building-card", attrs: { role: "group", "aria-label": cfg.name } });
  node.dataset.building = cfg.id;

  const icon = el("span", { cls: "building-card__icon", text: cfg.icon });
  const info = el("div", {});
  const name = el("div", { cls: "building-card__name" });
  name.append(el("span", { text: cfg.name }), el("span", { cls: "new-badge", text: "NEW", hidden: "" }));
  const desc = el("div", { cls: "building-card__desc", text: cfg.desc });
  info.append(name, desc);

  const right = el("div", { cls: "building-card__right" });
  const owned = el("div", { cls: "building-card__owned", text: "0" });
  const cost = el("div", { cls: "building-card__cost", text: "—" });
  const meta = el("div", { cls: "building-card__meta", text: "" });
  const btn = el("button", {
    cls: "btn btn--primary btn--small buy-btn",
    text: "Buy",
    attrs: { type: "button", "aria-label": `Купить ${cfg.name}` },
  });
  btn.dataset.buyBuilding = cfg.id;
  right.append(owned, cost, meta, btn);

  node.append(icon, info, right);
  cardRefs.set(cfg.id, {
    node, owned, cost, meta, btn, cfg,
    badgeEl: name.querySelector(".new-badge"),
    seenAt: seenAt ?? Date.now(),
  });
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
  node.appendChild(el("span", { cls: "upgrade-card__icon", text: cfg.icon }));
  // Enter/Space для клавиатуры
  node.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      purchaseUpgrade(cfg.id);
    }
  });
  return node;
}

/* ---------------- Тултипы (Блок 3.2) ---------------- */

function buildingTipHtml(ref) {
  const { cfg } = ref;
  const amount = state.settings.buyAmount ?? 1;
  const affordN = buildingAffordable(cfg.id);
  const count = amount === "max" ? Math.max(1, affordN) : Number(amount);
  const price = buildingBulkPrice(cfg.id, count);
  const have = state.buildings[cfg.id] ?? 0;
  const unitGain = buildingUnitCpsGain(cfg.id);
  const contrib = buildingContribution(cfg.id);
  const share = buildingIncomeSharePct(cfg.id);
  const missing = Math.max(0, price - state.resources.commits);
  return buildTooltip({
    title: `${cfg.icon} ${cfg.name}`,
    desc: cfg.desc,
    rows: [
      tipRow("Уровень (владею)", fmtInt(have)),
      tipRow(`Цена ×${count}`, fmt(price), missing > 0 ? "tooltip__price--miss" : ""),
      tipRow("Прибавка к CPS", `+${fmtRate(unitGain)}/sec`),
      tipRow("Вклад сейчас", `${fmtRate(contrib)}/sec`),
      tipRow("Доля в общем доходе", `${share}%`),
    ],
    hint: missing > 0 ? `Не хватает ${fmt(missing)} коммитов` : "Клик по карточке — купить",
  });
}

function upgradeTipHtml(cfg) {
  const effect = upgradeEffectLabel(cfg);
  const missing = Math.max(0, cfg.cost - state.resources.commits);
  return buildTooltip({
    title: `${cfg.icon} ${cfg.name}`,
    desc: cfg.desc,
    rows: [
      tipRow("Эффект", effect || "—"),
      tipRow("Стоимость", `${fmt(cfg.cost)} commits`, missing > 0 ? "tooltip__price--miss" : ""),
    ],
    hint: missing > 0 ? `Не хватает ${fmt(missing)} коммитов` : "Клик — установить",
  });
}

/* ---------------- Точечное обновление (без пересборки DOM) ---------------- */

/** Обновить цены/доступность генераторов и подсветку апгрейдов. Вызывается из renderer. */
export function refreshCards() {
  if (side === "buildings") {
    const amount = state.settings.buyAmount ?? 1;
    for (const ref of cardRefs.values()) {
      const { node, owned, cost, meta, btn, cfg } = ref;
      const have = state.buildings[cfg.id] ?? 0;
      owned.textContent = fmtInt(have);

      const affordN = buildingAffordable(cfg.id);
      let count;
      let price;
      if (amount === "max") {
        count = Math.max(1, affordN);
        price = buildingBulkPrice(cfg.id, count);
      } else {
        count = Number(amount);
        price = buildingBulkPrice(cfg.id, count);
      }
      const affordable = state.resources.commits >= price && (amount !== "max" || affordN > 0);

      /* --- Состояние кнопки (Блок 3.1) --- */
      const missing = Math.max(0, Math.ceil(price - state.resources.commits));
      cost.textContent = `💰 ${fmt(price)}`;
      if (affordable) {
        btn.disabled = false;
        btn.classList.remove("btn--needs-more");
        btn.textContent = amount === "max" ? `Buy max (${count})` : `Buy x${count}`;
      } else {
        btn.disabled = true;
        btn.classList.add("btn--needs-more");
        btn.textContent = `Need ${fmt(missing)} more commits`;
      }
      node.classList.toggle("building-card--unaffordable", !affordable);
      node.classList.toggle("building-card--affordable", affordable);

      const contrib = buildingContribution(cfg.id);
      const unit = buildingUnitCpsGain(cfg.id);
      meta.innerHTML = `+${fmtRate(unit)}/s each · total <b>${fmtRate(contrib)}</b>/s`;

      /* --- NEW-бейдж / пульсация до первой покупки (Блок 3.4) --- */
      const isNew = have === 0 && !ref.seenAtMarked;
      if (isNew) {
        node.classList.add("building-card--new");
        if (ref.badgeEl) ref.badgeEl.hidden = false;
      } else {
        node.classList.remove("building-card--new");
        if (ref.badgeEl) ref.badgeEl.hidden = true;
        ref.seenAtMarked = true;
      }

      node.dataset.tip = buildingTipHtml(ref);
    }
  } else {
    // Апгрейды: подсвечиваем те, что по карману, навешиваем тултипы
    dom.sidepanelBody.querySelectorAll("[data-buy-upgrade]").forEach((node) => {
      const id = String(node.getAttribute("data-buy-upgrade") ?? "").trim();
      const cfg = getUpgradeCfg(id);
      if (!cfg) return;
      const canAfford = state.resources.commits >= cfg.cost;
      node.classList.toggle("upgrade-card--unaffordable", !canAfford);
      node.classList.toggle("upgrade-card--affordable", canAfford);
      node.dataset.tip = upgradeTipHtml(cfg);
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
