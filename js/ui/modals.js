/**
 * modals.js — модальные окна поверх всего (офлайн-доход, престиж, сброс, импорт/экспорт).
 * Одна модалка за раз; Esc и клик по фону закрывают её.
 */

import { el } from "../utils/helpers.js";

let root = null;
let lastFocused = null; // куда вернуть фокус после закрытия (доступность)

const ensureRoot = () => {
  if (!root) root = document.getElementById("modal-root");
  return root;
};

/** Закрыть текущую модалку */
export function closeModal() {
  const r = ensureRoot();
  if (!r || r.hidden) return;
  r.innerHTML = "";
  r.hidden = true;
  document.removeEventListener("keydown", onEsc);
  lastFocused?.focus?.({ preventScroll: true });
  lastFocused = null;
}

function onEsc(e) {
  if (e.key === "Escape") closeModal();
}

/**
 * Открыть модалку.
 * @param {object} opts { title, bodyHtml, buttons: [{label, cls, onClick, closeAfter=true}], dismissible=true, wide=false }
 * @returns {HTMLElement} узел .modal (можно дополнять содержимое)
 */
export function openModal({ title, bodyHtml = "", buttons = [], dismissible = true, wide = false }) {
  const r = ensureRoot();
  if (!r) return null;

  closeModal(); // одна модалка за раз
  lastFocused = document.activeElement;

  const modal = el("div", {
    cls: `modal${wide ? " modal--wide" : ""}`,
    attrs: { role: "dialog", "aria-modal": "true", "aria-label": title },
  });

  const header = el("div", { cls: "modal__header" });
  header.append(
    el("span", { cls: "modal__title", text: title }),
    (() => {
      const x = el("button", {
        cls: "btn modal__close",
        text: "✕",
        attrs: { "aria-label": "Закрыть окно", type: "button" },
      });
      x.addEventListener("click", closeModal);
      return x;
    })()
  );

  const body = el("div", { cls: "modal__body" });
  body.innerHTML = bodyHtml; // html передаём только из доверенного нашего кода

  modal.append(header, body);

  if (buttons.length) {
    const footer = el("div", { cls: "modal__footer" });
    for (const b of buttons) {
      const btn = el("button", {
        cls: `btn ${b.cls ?? "btn--ghost"}`,
        text: b.label,
        attrs: { type: "button" },
      });
      btn.addEventListener("click", () => {
        const keepOpen = b.onClick?.(btn) === false; // false = не закрывать
        if (!keepOpen && b.closeAfter !== false) closeModal();
      });
      footer.appendChild(btn);
    }
    modal.appendChild(footer);
  }

  r.innerHTML = "";
  r.appendChild(modal);
  r.hidden = false;

  if (dismissible) {
    r.addEventListener("click", (e) => {
      if (e.target === r) closeModal();
    });
    document.addEventListener("keydown", onEsc);
  } else {
    // Обязательная модалка (например офлайн-доход): крестик скрываем
    header.querySelector(".modal__close")?.setAttribute("hidden", "");
  }

  // Фокус на первую кнопку — клавиатурный пользователь сразу «в диалоге»
  (modal.querySelector(".modal__footer .btn") ?? modal.querySelector("button"))?.focus?.();
  return modal;
}

/** Простое подтверждение с опасной кнопкой */
export const confirmModal = (title, bodyHtml, onYes, yesLabel = "Подтвердить") => {
  openModal({
    title,
    bodyHtml,
    buttons: [
      { label: "Отмена", cls: "btn--ghost" },
      { label: yesLabel, cls: "btn--danger", onClick: onYes },
    ],
  });
};
