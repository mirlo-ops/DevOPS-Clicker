/**
 * buildings.js — конфигурация 20 генераторов.
 * cost(n) = baseCost * growthFactor^n
 * Баланс: каждый следующий генератор примерно в 5-8 раз дороже и
 * даёт примерно в 4-6 раз больше CPS => окупаемость растёт плавно.
 */

export const BUILDINGS = [
  {
    id: "junior", name: "Junior Developer", icon: "🧑‍💻", category: "team",
    desc: "Гуглит error'ы и верит в магию Stack Overflow.",
    baseCost: 15, growthFactor: 1.12, baseProd: 0.1,
    unlockAt: 0, // доступен сразу
  },
  {
    id: "senior", name: "Senior Developer", icon: "🧔", category: "team",
    desc: "Знает, почему этот код работает. Не спрашивайте.",
    baseCost: 100, growthFactor: 1.12, baseProd: 0.5,
    unlockAt: 50,
  },
  {
    id: "ci_runner", name: "CI Runner", icon: "⚙️", category: "pipeline",
    desc: "Собирает проект 47 минут, чтобы найти одну опечатку.",
    baseCost: 600, growthFactor: 1.13, baseProd: 2.5,
    unlockAt: 300,
  },
  {
    id: "docker", name: "Docker Container", icon: "🐳", category: "infra",
    desc: "Упаковывает баг так аккуратно, что он работает везде.",
    baseCost: 3_500, growthFactor: 1.13, baseProd: 12,
    unlockAt: 1_800,
  },
  {
    id: "k8s_pod", name: "Kubernetes Pod", icon: "☸️", category: "infra",
    desc: "Оркестрирует контейнеры и вашу нервную систему.",
    baseCost: 20_000, growthFactor: 1.14, baseProd: 55,
    unlockAt: 10_000,
  },
  {
    id: "terraform", name: "Terraform Module", icon: "🏗️", category: "iac",
    desc: "plan: 15 to add. apply: инфраструктура на другом континенте.",
    baseCost: 120_000, growthFactor: 1.14, baseProd: 260,
    unlockAt: 60_000,
  },
  {
    id: "ansible", name: "Ansible Playbook", icon: "📜", category: "iac",
    desc: "Настраивает 500 серверов за один вечер пятницы.",
    baseCost: 700_000, growthFactor: 1.15, baseProd: 1_200,
    unlockAt: 350_000,
  },
  {
    id: "monitoring", name: "Monitoring Agent", icon: "📡", category: "observability",
    desc: "Видит всё. Особенно тогда, когда чинить уже поздно.",
    baseCost: 4_000_000, growthFactor: 1.15, baseProd: 5_500,
    unlockAt: 2_000_000,
  },
  {
    id: "logs", name: "Log Aggregator", icon: "🗃️", category: "observability",
    desc: "Собирает 4 ТБ логов ради строчки 'it works on my machine'.",
    baseCost: 25_000_000, growthFactor: 1.15, baseProd: 26_000,
    unlockAt: 12_000_000,
  },
  {
    id: "scanner", name: "Security Scanner", icon: "🛡️", category: "security",
    desc: "Находит dependency с CVE 2014 года. Каждый день.",
    baseCost: 150_000_000, growthFactor: 1.15, baseProd: 120_000,
    unlockAt: 75_000_000,
  },
  {
    id: "lb", name: "Load Balancer", icon: "⚖️", category: "infra",
    desc: "Раздаёт трафик так справедливо, как только может round-robin.",
    baseCost: 900_000_000, growthFactor: 1.15, baseProd: 560_000,
    unlockAt: 450_000_000,
  },
  {
    id: "cdn", name: "CDN Edge Node", icon: "🌍", category: "infra",
    desc: "Отдавает картинку кота из ближайшего дата-центра.",
    baseCost: 5_500_000_000, growthFactor: 1.15, baseProd: 2_600_000,
    unlockAt: 2_700_000_000,
  },
  {
    id: "serverless", name: "Serverless Function", icon: "λ", category: "cloud",
    desc: "Серверов нет. Счетов за них тоже. Или есть?",
    baseCost: 35_000_000_000, growthFactor: 1.15, baseProd: 12_000_000,
    unlockAt: 17_000_000_000,
  },
  {
    id: "db_replica", name: "Database Replica", icon: "🗄️", category: "data",
    desc: "Читает с копии, пишет с болью в сердце.",
    baseCost: 200_000_000_000, growthFactor: 1.16, baseProd: 58_000_000,
    unlockAt: 100_000_000_000,
  },
  {
    id: "sre_bot", name: "SRE Bot", icon: "🤖", category: "automation",
    desc: "Получает pagerduty вместо вас. Идеальный коллега.",
    baseCost: 1_400_000_000_000, growthFactor: 1.16, baseProd: 280_000_000,
    unlockAt: 700_000_000_000,
  },
  {
    id: "chaos", name: "Chaos Monkey", icon: "🐒", category: "automation",
    desc: "Ломает прод специально. Прод становится сильнее.",
    baseCost: 10_000_000_000_000, growthFactor: 1.16, baseProd: 1_400_000_000,
    unlockAt: 5_000_000_000_000,
  },
  {
    id: "authealing", name: "Auto-healing Cluster", icon: "🩺", category: "cloud",
    desc: "Сам себя лечит. Страховая не в восторге.",
    baseCost: 75_000_000_000_000, growthFactor: 1.17, baseProd: 7_000_000_000,
    unlockAt: 37_000_000_000_000,
  },
  {
    id: "region", name: "Private Cloud Region", icon: "🏝️", category: "cloud",
    desc: "Свой остров датасерверов. Со своими акулами-инвесторами.",
    baseCost: 500_000_000_000_000, growthFactor: 1.17, baseProd: 35_000_000_000,
    unlockAt: 250_000_000_000_000,
  },
  {
    id: "multicloud", name: "Multi-cloud Orchestrator", icon: "🪬", category: "cloud",
    desc: "Вендор-лок? Какие вендоры? Их все наши.",
    baseCost: 3_500_000_000_000_000, growthFactor: 1.18, baseProd: 175_000_000_000,
    unlockAt: 1_700_000_000_000_000,
  },
  {
    id: "ai_devops", name: "AI DevOps Assistant", icon: "🧠", category: "automation",
    desc: "Пишет YAML, чинит пайплайны и объясняет всё словами 'as an AI'.",
    baseCost: 25_000_000_000_000_000, growthFactor: 1.18, baseProd: 900_000_000_000,
    unlockAt: 12_000_000_000_000_000,
  },
];

/* Категории для группировки в магазине */
export const BUILDING_CATEGORIES = {
  team: "Команда",
  pipeline: "CI/CD",
  infra: "Инфраструктура",
  iac: "IaC",
  observability: "Observability",
  security: "Security",
  cloud: "Cloud",
  data: "Data",
  automation: "Automation",
};
