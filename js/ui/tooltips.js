/**
 * tooltips.js — единый плавающий тултип.
 * Делегируем mouseover/mouseout/focusin на document: элементы помечаются data-tip.
 * Тяжёлые строки не плодим — один узел на всю игру.
 */

let node = null;
let currentOwner = null;

const ensureNode = () => {
  if (!node) node = document.getElementById("tooltip");
  return node;
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
