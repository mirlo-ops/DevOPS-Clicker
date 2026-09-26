/**
 * notifications.js — всплывающие уведомления справа снизу.
 */

import { el } from "../utils/helpers.js";

const MAX_VISIBLE = 4;
const LIFETIME_MS = 5000;

let container = null;

export const initNotifications = () => {
  container = document.getElementById("notifications");
};

/**
 * Показать уведомление.
 * kind: 'achievement' | 'event' | 'error' | 'success' | 'info'
 */
export function notify(title, body = "", kind = "info") {
  if (!container) return;
  // Ограничиваем число видимых — старые удаляем сразу
  while (container.children.length >= MAX_VISIBLE) {
    container.firstChild.remove();
  }

  const node = el("div", {
    cls: `notification notification--${kind}`,
    attrs: { role: "status" },
  });
  node.appendChild(el("div", { cls: "notification__title", text: title }));
  if (body) node.appendChild(el("div", { cls: "notification__body", text: body }));
  container.appendChild(node);

  setTimeout(() => {
    node.classList.add("notification--hide");
    node.addEventListener("animationend", () => node.remove(), { once: true });
    // Страховка: если анимация отключена настройками
    setTimeout(() => node.remove(), 600);
  }, LIFETIME_MS);
}
