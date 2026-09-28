/**
 * tooltips.js — единый плавающий тултип.
 * Делегируем mouseover/mouseout/focusin на document: элементы помечаются data-tip.
 * Тяжёлые строки не плодим — один узел на всю игру.
 */

import { escapeHtml } from "../utils/helpers.js";

let node = null;
let currentOwner = null;

const ensureNode = () => {
  if (!node) node = document.getElementById("tooltip");
  return node;
};

/* ---------------- Конструкторы контента (Блок 3.2) ---------------- */

/** Строка «метка — значение» для панели тултипа */
export const tipRow = (label, value, cls = "") => ({ label, value, cls });

/**
 * Собрать HTML-панель тултипа в стиле подсказок IDE:
 * заголовок, описание, таблица строк, нижняя подсказка.
 */
export const buildTooltip = ({ title = "", desc = "", rows = [], hint = "" }) => {
  const parts = [];
  if (title) parts.push(`<div class="tooltip__title">${escapeHtml(title)}</div>`);
  if (desc) parts.push(`<div class="tooltip__desc">${escapeHtml(desc)}</div>`);
  for (const r of rows) {
    if (!r) continue;
    parts.push(
      `<div class="tooltip__row"><span>${escapeHtml(r.label)}</span>` +
      `<b class="${r.cls || ""}">${escapeHtml(String(r.value))}</b></div>`
    );
  }
  if (hint) parts.push(`<div class="tooltip__hint">${escapeHtml(hint)}</div>`);
  return parts.join("");
};

/** Найти ближайший элемент с текстом подсказки */
const findTarget = (from) => {
  let cur = from instanceof Element ? from : null;
  while (cur && cur !== document.body) {
    const text = cur.getAttribute?.("data-tip");
    if (text) return { el: cur, text };
    cur = cur.parentElement;
  }
  return null;
};

/** Позиционирование: над элементом, с прижатием к краям экрана */
const place = (x, y) => {
  const n = ensureNode();
  if (!n) return;
  const pad = 10;
  const w = n.offsetWidth;
  const h = n.offsetHeight;
  let left = x - w / 2;
  let top = y - h - 14;
  left = Math.max(pad, Math.min(left, window.innerWidth - w - pad));
  if (top < pad) top = y + 22; // под элементом, если сверху не влезает
  n.style.left = `${left}px`;
  n.style.top = `${top}px`;
};

const show = (target, x, y) => {
  const n = ensureNode();
  if (!n) return;
  n.innerHTML = target.text; // текст может содержать <b>/<span> из наших карточек
  n.hidden = false;
  currentOwner = target.el;
  place(x, y);
};

const hide = () => {
  const n = ensureNode();
  if (!n) return;
  n.hidden = true;
  currentOwner = null;
};

export function initTooltips() {
  document.addEventListener("mouseover", (e) => {
    const t = findTarget(e.target);
    if (!t || t.el === currentOwner) return;
    const r = t.el.getBoundingClientRect();
    show(t, r.left + r.width / 2, r.top);
  });

  document.addEventListener("mouseout", (e) => {
    const t = findTarget(e.target);
    if (t && t.el === currentOwner) hide();
  });

  // Клавиатурная доступность: focus-visible тоже показывает подсказку
  document.addEventListener("focusin", (e) => {
    const t = findTarget(e.target);
    if (!t) { if (currentOwner) hide(); return; }
    const r = t.el.getBoundingClientRect();
    show(t, r.left + r.width / 2, r.top);
  });
  document.addEventListener("focusout", hide);

  // Скролл/ресайз могут «отклеить» тултип от элемента — прячем
  window.addEventListener("scroll", hide, true);
  window.addEventListener("resize", hide);
}

/** Принудительно спрятать (например перед удалением элемента из DOM) */
export const hideTooltip = hide;
