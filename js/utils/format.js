/**
 * format.js — форматирование больших чисел: 1,000 / 12.5K / 1.23M / ...
 */

const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

/** Защита от NaN/undefined: любое нечисло превращаем в 0 */
export const safeNum = (n) =>
  typeof n === "number" && Number.isFinite(n) ? n : 0;

/**
 * Основное форматирование.
 * < 1000: до 1 знака после запятой (целые без дробей), разделитель тысяч.
 * >= 1000: mantissa + суффикс.
 */
export function fmt(value, decimals = 2) {
  const n = safeNum(value);
  if (Math.abs(n) < 1000) {
    return Number.isInteger(n)
      ? groupThousands(n)
      : groupThousands(round(n, 1));
  }
  const tier = Math.min(
    Math.floor(Math.log10(Math.abs(n)) / 3),
    SUFFIXES.length - 1
  );
  const scaled = n / Math.pow(1000, tier);
  // За очень большими числами уходим в научную нотацию
  if (tier >= SUFFIXES.length - 1 && Math.abs(n) >= 1e39) {
    return n.toExponential(2).replace("+", "");
  }
  const d = scaled < 10 ? decimals : scaled < 100 ? 1 : 0;
  return `${round(scaled, d)}${SUFFIXES[tier]}`;
}

/** Целочисленное форматирование с разделителями разрядов */
export function fmtInt(value) {
  const n = Math.floor(safeNum(value));
  return groupThousands(n);
}

/** Формат CPS: всегда с 1 знаком, если маленький */
export function fmtRate(value) {
  const n = safeNum(value);
  if (n > 0 && n < 10) return String(round(n, 1));
  return fmt(n);
}

/** Проценты: 0.125 -> "12.5%" */
export function fmtPct(fraction, digits = 1) {
  return `${round(safeNum(fraction) * 100, digits)}%`;
}

/** Множитель: 1.25 -> "x1.25" */
export function fmtMult(m, digits = 2) {
  return `x${round(safeNum(m), digits)}`;
}

function round(n, d) {
  const f = Math.pow(10, d);
  return Math.round(safeNum(n) * f) / f;
}

function groupThousands(n) {
  const [int, frac] = String(n).split(".");
  const withSep = int.replace(/\B(?=(\d{3})+(?!\B))/g, ",");
  return frac ? `${withSep}.${frac}` : withSep;
}
