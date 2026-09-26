/**
 * time.js — форматирование времени и длительностей.
 */

/** мс -> "1ч 05м 12с" */
export function fmtDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [];
  if (h > 0) parts.push(`${h}ч`);
  if (h > 0 || m > 0) parts.push(`${String(m).padStart(2, "0")}м`);
  parts.push(`${String(sec).padStart(2, "0")}с`);
  return parts.join(" ");
}

/** мс -> компактный таймер "MM:SS" */
export function fmtTimer(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Дата -> "HH:MM:SS" (локальное время) */
export function fmtClock(date = new Date()) {
  const p = (x) => String(x).padStart(2, "0");
  return `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

/** Дата -> "DD.MM.YYYY HH:MM" для достижений */
export function fmtDateTime(ts) {
  const d = new Date(ts);
  const p = (x) => String(x).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Ключ дня для статистики «за сегодня»: YYYY-MM-DD */
export const dayKey = (date = new Date()) => date.toISOString().slice(0, 10);
