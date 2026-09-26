/**
 * constants.js — глобальные константы игры.
 * Здесь нет магических чисел «в коде»: всё важное собирается в одном месте.
 */

export const GAME_NAME = "DevOPS Clicker";
export const SAVE_KEY = "devops-clicker-save-v1";
export const SAVE_VERSION = 1; // версия схемы сохранения

/* Экономика престижа */
export const PRESTIGE_CURRENCY = "Cloud Tokens";

/* Игровой цикл */
export const TICK_INTERVAL_MS = 100;        // расчёт экономики 10 раз/сек
export const UI_FULL_REFRESH_MS = 500;      // «тяжёлые» списки обновляем 2 раза/сек
export const AUTOSAVE_INTERVAL_MS = 12000;  // автосохранение каждые 12 секунд
export const HISTORY_SAMPLE_MS = 5000;      // семпл графика дохода каждые 5 сек
export const HISTORY_MAX_POINTS = 120;      // максимум точек на sparkline (10 минут)

/* Офлайн-прогресс */
export const OFFLINE_MAX_HOURS = 8;         // ограничение офлайн-дохода (см. prestige-бонус offlineBoost)
export const OFFLINE_EFFICIENCY = 0.5;      // базовая эффективность офлайн-дохода (50%)

/* Терминальный лог */
export const LOG_MAX_LINES = 160;           // не храним больше строк (защита памяти)

/* Клик: защита от спама */
export const CLICK_MIN_INTERVAL_MS = 30;    // минимум между кликами (анти-автокликер через paste-события)
export const CLICKS_LOG_THROTTLE_MS = 400;  // не пишем каждый клик в лог

/* Всплывающие числа */
export const FLOAT_TEXT_MAX = 40;           // максимум одновременно живущих элементов

/* События */
export const EVENT_CHECK_INTERVAL_MS = 10000; // проверка возможности события
export const EVENTS_HISTORY_MAX = 50;

/* Покупки */
export const BUY_AMOUNTS = [1, 10, 100];    // режимы покупки генераторов
