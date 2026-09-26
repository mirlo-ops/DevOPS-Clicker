/**
 * random.js — работа со случайными числами.
 */

/** Целое из диапазона [min, max] включительно */
export const randInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

/** Проверка «выпадения» с вероятностью p (0..1) */
export const chance = (p) => Math.random() < p;

/** Случайный элемент массива */
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
