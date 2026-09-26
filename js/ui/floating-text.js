/**
 * floating-text.js — всплывающие числа при кликах.
 */

import { el } from "../utils/helpers.js";
import { FLOAT_TEXT_MAX } from "../config/constants.js";
import { fmt } from "../utils/format.js";

let layer = null;
let liveCount = 0;

export const initFloating = () => {
  layer = document.getElementById("floating-layer");
};

/** Показать "+N" в точке (x, y). crit — жёлтый крупный стиль */
export function spawnFloat(x, y, value, crit = false) {
  if (!layer || liveCount >= FLOAT_TEXT_MAX) return;
  liveCount += 1;
  const jitterX = (Math.random() - 0.5) * 40;
  const node = el("div", {
    cls: `float-text${crit ? " float-text--crit" : ""}`,
    text: `${crit ? "⚡CRIT " : "+"}${fmt(value)}`,
  });
  node.style.left = `${x + jitterX}px`;
  node.style.top = `${y - 12}px`;
  layer.appendChild(node);
  const kill = () => {
    node.remove();
    liveCount -= 1;
  };
  node.addEventListener("animationend", kill, { once: true });
  setTimeout(kill, 1200); // страховка, если анимации отключены
}
