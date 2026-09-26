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
