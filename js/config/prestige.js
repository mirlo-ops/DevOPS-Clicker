/**
 * prestige.js — настройки престижа «Migration to Cloud».
 */

export const PRESTIGE_CONFIG = {
  name: "Migration to Cloud",
  flavor: [
    "$ terraform destroy — everything",
    "# Переезд в облако: текущая инфраструктура сносится,",
    "# но команда получает вечные сертификаты Cloud Tokens.",
  ],
  /* Порог доступности: сколько lifetime commits нужно,
     чтобы престиж стал доступен вообще (см. balance.prestige.divisor) */
  requirementText: "Нужно ≥ 1M lifetime commits для первого Cloud Token.",
  /* Постоянные бонусы за токены описаны в config/balance.js → prestige.* */
  bonusesList: [
    { key: "prod",   label: "Глобальное производство" },
    { key: "click",  label: "Сила клика" },
    { key: "cost",   label: "Скидка на генераторы" },
    { key: "offline", label: "Офлайн-эффективность" },
  ],
};
