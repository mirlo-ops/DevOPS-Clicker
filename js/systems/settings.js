/**
 * settings.js — применение настроек к DOM (классы body) и мутации state.settings.
 */

import { state, markDirty } from "../core/state.js";
import { saveGame } from "./save.js";

/** Переприменить все визуальные настройки к документу */
export function applySettings() {
  const b = document.body.classList;
  b.toggle("no-anim", !state.settings.animations);
  b.toggle("no-matrix", !state.settings.matrixRain);
  b.toggle("no-scanlines", !state.settings.scanlines);
  b.toggle("reduced-motion", Boolean(state.settings.reducedMotion));
}

/** Изменить настройку + сохранить */
export function setSetting(key, value) {
  if (!(key in state.settings)) return;
  state.settings[key] = value;
  markDirty();
  applySettings();
  saveGame();
}

/** Все текущие настройки (копия для UI) */
export const getSettings = () => ({ ...state.settings });
