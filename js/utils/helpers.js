/**
 * helpers.js — мелкие переиспользуемые хелперы DOM и общего назначения.
 */

/** Создать элемент с классом, текстом и атрибутами */
export function el(tag, { cls = "", text = "", html, attrs = {}, dataset = {} } = {}) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== "") node.textContent = text;
  if (html !== undefined) node.innerHTML = html;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const [k, v] of Object.entries(dataset)) node.dataset[k] = v;
  return node;
}

/** Экранирование для безопасной вставки текста в HTML-шаблоны (тултипы и т.п.) */
export function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Плавная анимация числа в DOM-узле (interpolate от предыдущего значения).
 * Используется для цифр дохода/CPS, чтобы они «перетекали», а не прыгали.
 */
const animatedNumbers = new WeakMap();
export function animateNumber(node, toValue, formatFn, durationMs = 350) {
  if (!node) return;
  const from = animatedNumbers.get(node)?.current ?? toValue;
  if (from === toValue) {
    node.textContent = formatFn(toValue);
    animatedNumbers.set(node, { current: toValue });
    return;
  }
  const anim = { from, to: toValue, start: performance.now(), durationMs, current: toValue };
  animatedNumbers.set(node, anim);
  const step = (now) => {
    if (animatedNumbers.get(node) !== anim) return; // перезаписана более свежей анимацией
    const t = Math.min(1, (now - anim.start) / anim.durationMs);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    const value = from + (anim.to - from) * eased;
    anim.current = t >= 1 ? anim.to : value;
    node.textContent = formatFn(anim.current);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Делегирование событий: вешаем один слушатель на контейнер */
export function delegate(root, eventName, selector, handler) {
  root.addEventListener(eventName, (e) => {
    const target = e.target.closest(selector);
    if (target && root.contains(target)) handler(e, target);
  });
}

/** Throttle по времени (leading edge): не чаще wait ms */
export function throttle(fn, waitMs) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= waitMs) {
      last = now;
      fn(...args);
    }
  };
}

/** Скачать текст как файл (экспорт сохранения) */
export function downloadText(filename, text, mime = "application/json") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el("a", { attrs: { href: url, download: filename } });
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Освобождаем память объекта URL (защита от утечек)
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Прочитать выбранный файл как текст */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.readAsText(file);
  });
}
