/**
 * matrix-rain.js — фоновый «матричный дождь» на canvas #matrix-rain.
 * Управляется настройкой state.settings.matrixRain; при выключении цикл останавливается.
 */

import { state } from "../core/state.js";

const GLYPHS = "01{}[]()<>/*+-=;$#@%&:|~^abcdefnoprstxyz0123456789sudo rm grep awk sed git docker kubectl".split("");
const FONT_SIZE = 14;

let canvas = null;
let ctx = null;
let columns = 0;
let drops = [];       // y-позиция каждой колонки (в строках)
let rafId = null;
let lastFrame = 0;
let running = false;

function resize() {
  if (!canvas || !ctx) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  columns = Math.ceil(canvas.width / FONT_SIZE);
  drops = new Array(columns).fill(0).map(() => Math.random() * -60);
}

function frame(now) {
  if (!running) return;
  rafId = requestAnimationFrame(frame);
  // ~30 fps достаточно для фона и бережёт батарею
  if (now - lastFrame < 33) return;
  lastFrame = now;
  if (!ctx) return;

  ctx.fillStyle = "rgba(8, 12, 10, 0.16)"; // полупрозрачная подложка — шлейф
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = `${FONT_SIZE}px monospace`;

  for (let i = 0; i < columns; i += 1) {
    const glyph = GLYPHS[(Math.random() * GLYPHS.length) | 0];
    const x = i * FONT_SIZE;
    const y = drops[i] * FONT_SIZE;
    // яркая «голова» капли, хвосты стирает подложка
    ctx.fillStyle = Math.random() < 0.02 ? "#b6ffcb" : "#0e5c2a";
    ctx.fillText(glyph, x, y);
    if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
    drops[i] += 1;
  }
}

export function startMatrixRain() {
  if (running) return;
  canvas ??= document.getElementById("matrix-rain");
  if (!canvas) return;
  ctx ??= canvas.getContext("2d");
  resize();
  running = true;
  rafId = requestAnimationFrame(frame);
}

export function stopMatrixRain() {
  running = false;
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
  if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/** Синхронизация с настройкой (вызывать из applySettings / init) */
export function syncMatrixRain() {
  if (state.settings.matrixRain && !state.settings.reducedMotion) startMatrixRain();
  else stopMatrixRain();
}

export function initMatrixRain() {
  window.addEventListener("resize", () => {
    if (running) resize();
  });
  syncMatrixRain();
}
