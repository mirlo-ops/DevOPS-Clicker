/**
 * tabs.js — коммутатор представлений (activity bar + вкладки редактора).
 * Каждое «представление» — это либо магазин в боковой панели, либо контент в области редактора.
 */

import { el } from "../utils/helpers.js";

const VIEWS = ["clicker", "buildings", "upgrades", "prestige", "achievements", "stats", "settings"];

// Представления, которым нужен магазин в сайдбаре (кликер показывает там генераторы)
const SHOP_VIEWS = new Set(["clicker", "buildings", "upgrades"]);

let dom = null;              // реестр элементов из buildLayout()
let current = "clicker";
const mounters = new Map();  // view -> fn() => HTMLElement (контент редактора)
const refresher = new Map(); // view -> fn() (ленивое обновление открытой вкладки)
const onSwitchCallbacks = [];

/**
 * Инициализация.
 * @param registry результат buildLayout()
 * @param editors список [{ id, label, icon }] — какие вкладки-«файлы» показывать в titlebar
 */
export function initTabs(registry, editors) {
  dom = registry;

  // Вкладки-редакторы в titlebar (как открытые файлы VS Code)
  dom.editorTabs.innerHTML = "";
  for (const ed of editors) {
    const tab = el("button", {
      cls: "tab",
      attrs: { type: "button", "data-view": ed.id, "aria-label": ed.label, title: ed.label },
    });
    const img = el("img", { attrs: { src: `assets/icons/${ed.icon}.svg`, alt: "", class: "tab__icon" } });
    tab.append(img, el("span", { text: ed.label }));
    dom.editorTabs.appendChild(tab);
  }

  // Делегирование кликов по activity bar и вкладкам
  document.addEventListener("click", (e) => {
    const btn = e.target.closest?.("[data-view]");
    if (!btn) return;
    const view = btn.getAttribute("data-view");
    if (VIEWS.includes(view)) switchView(view);
  });

  syncUi();
}

/** Зарегистрировать рендерер контента представления в области редактора */
export const registerMounter = (view, fn) => mounters.set(view, fn);

/** Зарегистрировать лёгкое обновление открытого представления (данные могли измениться) */
export const registerRefresher = (view, fn) => refresher.set(view, fn);

/** Переключить активное представление */
export function switchView(view) {
  if (!VIEWS.includes(view) || view === current) return;
  current = view;
  syncUi();
  renderEditor();
  onSwitchCallbacks.forEach((fn) => fn(view));
}

export const currentView = () => current;
export const onSwitch = (fn) => onSwitchCallbacks.push(fn);

/** Обновить текущее представление (вызывается из renderer раз в UI_FULL_REFRESH_MS) */
export const refreshCurrent = () => refresher.get(current)?.();

/** Перерисовать контент редактора для текущего представления */
function renderEditor() {
  const scroll = dom.editor.querySelector(".editor__scroll");
  if (!scroll) return;
  scroll.innerHTML = "";
  const mount = mounters.get(current);
  if (mount) {
    scroll.appendChild(mount());
  } else {
    // Кликер: базовая зона уже отрендерена отдельно (см. renderer.initClickZone)
    scroll.appendChild(dom.clickZone ?? el("div", { text: "" }));
  }
}

/** Синхронизация подсветки кнопок/вкладок и видимости сайдбара */
function syncUi() {
  for (const [id, btn] of Object.entries(dom.actButtons ?? {})) {
    btn.classList.toggle("activity-btn--active", id === current);
    btn.setAttribute("aria-current", id === current ? "page" : "false");
  }
  dom.editorTabs?.querySelectorAll("[data-view]").forEach((t) => {
    t.classList.toggle("tab--active", t.getAttribute("data-view") === current);
  });
  // Сайдбар магазина нужен не во всех представлениях
  const main = document.getElementById("main-area");
  main?.classList.toggle("main--full", !SHOP_VIEWS.has(current));
  dom.sidepanel.style.display = SHOP_VIEWS.has(current) ? "" : "none";
}
