/**
 * sound.js — звуковая система на Web Audio API + короткие сэмплы WAV.
 * Звук выключен по умолчанию (state.settings.sound === false).
 */

import { state } from "../core/state.js";

const SOURCES = {
  click: "assets/audio/click.wav",
  deploy: "assets/audio/deploy.wav",
  achievement: "assets/audio/achievement.wav",
  error: "assets/audio/error.wav",
};

const buffers = new Map();   // name -> AudioBuffer
let ctx = null;              // AudioContext (создаётся лениво по первому клику)
let lastPlayedAt = 0;

const ensureContext = () => {
  if (!ctx) {
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
};

/** Предзагрузка всех буферов (вызывается один раз при старте) */
export async function preloadSounds() {
  const c = ensureContext();
  if (!c) return;
  for (const [name, url] of Object.entries(SOURCES)) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.arrayBuffer();
      buffers.set(name, await c.decodeAudioData(data));
    } catch {
      // тишина лучше падения: файл может быть недоступен
    }
  }
}

/**
 * Воспроизвести звук по имени.
 * Защита от накладок частых звуков: клик не чаще 40мс.
 */
export function playSound(name) {
  if (!state.settings.sound) return;
  const now = performance.now();
  if (name === "click" && now - lastPlayedAt < 40) return;
  lastPlayedAt = now;

  const c = ensureContext();
  const buf = buffers.get(name);
  if (!c || !buf) return;
  try {
    const src = c.createBufferSource();
    const gain = c.createGain();
    gain.gain.value = Math.max(0, Math.min(1, state.settings.volume ?? 0.5)) * 0.6;
    src.buffer = buf;
    src.connect(gain).connect(c.destination);
    src.start(0);
    src.onended = () => {
      src.disconnect();
      gain.disconnect();
    };
  } catch {
    /* ignore */
  }
}
