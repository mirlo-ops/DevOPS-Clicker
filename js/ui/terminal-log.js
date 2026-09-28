/**
 * terminal-log.js — нижняя панель терминала с цветными логами.
 * Ограничивает число строк, чтобы не раздувать DOM.
 */

import { el } from "../utils/helpers.js";
import { fmtClock } from "../utils/time.js";
import { LOG_MAX_LINES } from "../config/constants.js";

let container = null;
const promptLine = el("div", { cls: "terminal__line" });

export const initTerminal = (node) => {
  // Guard: если элемент терминала не найден в реестре — предупреждаем и выходим,
  // чтобы не ронять всю цепочку инициализации main.js
  if (!node) {
    console.warn("[terminal-log] Контейнер логов терминала не найден — initTerminal пропущен.");
    return;
  }
  container = node;
  container.innerHTML = "";
  promptLine.appendChild(el("span", { cls: "terminal__prompt", text: "$ " }));
  container.appendChild(promptLine);
};

/**
 * Записать строку.
 * type: info | click | buy | event | achievement | warn | save | prestige
 */
export function log(type, text) {
  if (!container) return;
  const line = el("div", { cls: `terminal__line terminal__line--${type}` });
  line.append(
    el("span", { cls: "terminal__time", text: fmtClock() }),
    el("span", { cls: "terminal__msg", text })
  );
  container.insertBefore(line, promptLine);
  // Автопрокрутка вниз, только если пользователь у низа
  const scroller = container.parentElement;
  if (scroller) {
    const nearBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 60;
    if (nearBottom) scroller.scrollTop = scroller.scrollHeight;
  }
  // Обрезаем старые строки (LOG_MAX_LINES)
  while (container.children.length > LOG_MAX_LINES + 1) {
    container.firstChild.remove();
  }
}

/** Печататающийся текст-приветствие (эффект typewriter) */
export function bootSequence(lines, delayMs = 90) {
  let i = 0;
  const step = () => {
    if (i >= lines.length) return;
    const [type, text] = lines[i++];
    log(type, text);
    setTimeout(step, delayMs);
  };
  step();
}
