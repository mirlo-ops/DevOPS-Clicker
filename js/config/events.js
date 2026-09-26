/**
 * events.js — конфигурация случайных событий.
 * Поля:
 *  id, name, icon, msg (текст для терминала), tone ('good'|'bad'|'risk')
 *  weight — относительный вес при выборе
 *  durationMs — длительность эффекта (если есть)
 *  apply(state, api) — мгновенный эффект/запуск; api = { addCommits, log, notify, setEffect }
 *  interactive: true — требует клика игрока в течение graceMs, иначе штраф
 */

import { BALANCE } from "./balance.js";

export const EVENTS = [
  {
    id: "hackathon", name: "Hackathon", icon: "⚡", tone: "good", weight: 3,
    msg: "Хакатон! Кофе, пицца и адреналин.",
    durationMs: 30_000,
    effect: { type: "click_mult", value: 3 },
  },
  {
    id: "autoscaling_triggered", name: "Auto-scaling Triggered", icon: "📈", tone: "good", weight: 3,
    msg: "HPA поднял реплики: производство x2 на 40 секунд.",
    durationMs: 40_000,
    effect: { type: "prod_mult", value: 2 },
  },
  {
    id: "security_patch", name: "Security Patch", icon: "🩹", tone: "good", weight: 2,
    msg: "Срочный патч принят с первого ревью. Бонус коммитами!",
    instant: (api) => {
      const bonus = Math.max(50, api.state.derived.cps * 60);
      api.addCommits(bonus, "event");
      return `+${api.fmt(bonus)} commits`;
    },
  },
  {
    id: "oss_contribution", name: "Open Source Contribution", icon: "🌟", tone: "good", weight: 2,
    msg: "Ваш PR в мейнлайн приняли. 15 секунд славы = множитель клика x5.",
    durationMs: 15_000,
    effect: { type: "click_mult", value: 5 },
  },
  {
    id: "friday_deploy", name: "Friday Deploy", icon: "😈", tone: "risk", weight: 2,
    msg: "Деплой в пятницу... Ставки сделаны.",
    resolve: (api) => {
      const risk = BALANCE.events.fridayDeployRisk;
      if (Math.random() < risk) {
        api.setEffect("incident", { type: "prod_mult", value: 0.5, until: Date.now() + 60_000 });
        api.log("warn", "[prod] Friday deploy failed: rollback in progress (-50% prod, 60s)");
        return "Провал: -50% производства на минуту 😵";
      }
      const bonus = Math.max(200, api.state.derived.cps * 180);
      api.addCommits(bonus, "event");
      return `Успех! +${api.fmt(bonus)} commits 🎉`;
    },
  },
  {
    id: "incident", name: "Incident in Production", icon: "🚨", tone: "bad", weight: 3,
    msg: "INCIDENT: latency spike! Кликните по кнопке в статус-баре за 10 секунд, чтобы отбить.",
    interactive: true,
    graceMs: 10_000,
    onSuccess: (api) => {
      api.state.stats.events.resolvedIncidents += 1;
      const reward = Math.max(100, api.state.derived.cps * 30);
      api.addCommits(reward, "event");
      return `Инцидент закрыт за MTTR 10 сек! +${api.fmt(reward)} commits`;
    },
    onFail: (api) => {
      api.setEffect("incident", { type: "prod_mult", value: 0.4, until: Date.now() + 45_000 });
      return "Постмор written. Производство -60% на 45 секунд.";
    },
  },
  {
    id: "cloud_outage", name: "Cloud Outage", icon: "☁️‍🗨️", tone: "bad", weight: 2,
    msg: "us-east-1 горит. region is degraded.",
    durationMs: 30_000,
    effect: { type: "prod_mult", value: 0.6 },
  },
  {
    id: "legacy_code", name: "Legacy Code Discovery", icon: "🦕", tone: "bad", weight: 2,
    msg: "Найден COBOL-модуль 1998 года. Мини-игра: сделайте 25 кликов за 15 секунд!",
    interactive: true,
    clicksRequired: 25,
    graceMs: 15_000,
    onSuccess: (api) => {
      const reward = Math.max(150, api.state.derived.cps * 45);
      api.addCommits(reward, "event");
      return `Легаси портировано! +${api.fmt(reward)} commits`;
    },
    onFail: (api) => {
      api.setEffect("legacy", { type: "prod_mult", value: 0.7, until: Date.now() + 30_000 });
      return "Модуль остался в проде. Производство -30% на 30 секунд.";
    },
  },
];

/* Помощник: взвешенный выбор события (используется events-system) */
export const pickEvent = () => {
  const total = EVENTS.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * total;
  for (const ev of EVENTS) {
    roll -= ev.weight;
    if (roll <= 0) return ev;
  }
  return EVENTS[EVENTS.length - 1];
};
