/**
 * balance.js — все числовые рычаги баланса в одном файле.
 * Меняя значения здесь, можно полностью перенастроить экономику игры.
 */

export const BALANCE = {
  /* --- Клик --- */
  click: {
    basePower: 1,             // базовая сила клика
    baseCritChance: 0.02,     // базовый шанс крита 2%
    baseCritMultiplier: 2,    // крит x2
    maxCritChance: 0.5,       // потолок шанса крита
    maxCritMultiplier: 10,    // потолок множителя крита
    // Каждый Cloud Token: +2% к силе клика
    tokenClickBonus: 0.02,
  },

  /* --- Производство --- */
  production: {
    // Каждый Cloud Token: +3% глобального производства
    tokenProductionBonus: 0.03,
    // Каждое достижение: +0.5% глобально
    achievementBonus: 0.005,
    // Максимум достижений учитывается в бонусе (защита от эксплоита)
    achievementBonusCap: 1.5, // x1.5 максимум
  },

  /* --- Престиж --- */
  prestige: {
    // Формула токенов: floor( sqrt(lifetimeCommits / DIVISOR) ) ^ POWER
    divisor: 1_000_000,       // первый токен примерно за 1M lifetime commits
    power: 0.5,               // sqrt-кривая: рост замедляется
    minGain: 1,               // минимальная выдача при доступном престиже
    tokensForDiscountPer: 25, // каждые N токенов генераторы дешевеют...
    discountPerStep: 0.02,    // ...на 2% (потолок ниже)
    maxDiscount: 0.5,         // максимум -50% к стоимости
    offlineBoostPerToken: 0.01, // +1% эффективности офлайна за токен
    maxOfflineEfficiency: 1.0,
  },

  /* --- Стоимость генераторов --- */
  building: {
    growthFactorDefault: 1.15, // если у здания не задан свой factor
    // Разблокировка: здание видно, когда lifetimeCommits >= baseCost * ratio
    unlockRatio: 0.5,
    // «Показывать следующее скрытое» — превью за серой карточкой
    teaserCount: 1,
  },

  /* --- Случайные события --- */
  events: {
    chancePerCheck: 0.18,      // шанс события при проверке (~раз в 55 сек в среднем)
    cooldownMs: 45_000,        // пауза между событиями
    minLifetimeCommits: 100,   // события включаются не сразу
    fridayDeployRisk: 0.35,    // шанс провала Friday Deploy
  },

  /* --- Достижения --- */
  achievements: {
    checkIntervalMs: 1000,
  },
};
