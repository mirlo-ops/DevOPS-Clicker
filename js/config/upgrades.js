/**
 * upgrades.js — конфигурация улучшений.
 * Типы эффектов (type):
 *  - click_mult      : умножает силу клика
 *  - click_add       : добавляет к базовой силе клика
 *  - crit_chance     : +шанс крита
 *  - crit_mult       : +множитель крита
 *  - building_mult   : множитель производства конкретного здания (target = id здания)
 *  - building_cat    : множитель для всей категории зданий (target = category)
 *  - global_mult     : глобальный множитель производства
 *  - cps_click       : клик получает бонус = N% от CPS
 *  - offline_mult    : множитель офлайн-эффективности
 *  - event_good      : усиливает положительные события
 *  - event_bad       : смягчает отрицательные события
 *  - unlock          : разблокирует функцию (target = имя фичи)
 * repeatable: false — одноразовый апгрейд (по умолчанию).
 */

export const UPGRADES = [
  /* ---------- Клик ---------- */
  { id: "mech_keyboard", name: "Mechanical Keyboard", icon: "⌨️", cost: 100, type: "click_mult", value: 2,
    desc: "Clicky switch'и решают всё. Сила клика x2.", category: "click",
    req: { clicks: 30 } },
  { id: "coffee_machine", name: "Coffee Machine", icon: "☕", cost: 900, type: "building_cat", target: "team", value: 2,
    desc: "Кофеин в вену. Все разработчики работают вдвое быстрее.", category: "team",
    req: { buildings: { junior: 5 } } },
  { id: "vim_plugin", name: "Vim Plugin Pack", icon: "🔥", cost: 4_000, type: "click_mult", value: 2,
    desc: ":wq с первой попытки. Сила клика x2.", category: "click",
    req: { upgradeOwned: "mech_keyboard" } },
  { id: "linter_config", name: "Linter Config", icon: "🧹", cost: 8_000, type: "unlock", target: "error_reduction", value: 0.25,
    desc: "Автоформат ловит ошибки: негативные события слабее на 25%.", category: "special",
    req: { lifetimeCommits: 5_000 } },
  { id: "double_monitors", name: "Dual Monitors", icon: "🖥️", cost: 25_000, type: "click_mult", value: 3,
    desc: "На втором мониторе — Stack Overflow. Сила клика x3.", category: "click",
    req: { clicks: 300 } },
  { id: "crit_gloves", name: "Rubber Duck Debugging", icon: "🦆", cost: 60_000, type: "crit_chance", value: 0.05,
    desc: "Утка подтверждает: ваш клик критический чаще (+5% шанса).", category: "click",
    req: { lifetimeCommits: 40_000 } },
  { id: "duck_nano", name: "Nano Duck Edition", icon: "🐤", cost: 500_000, type: "crit_mult", value: 1,
    desc: "Маленькая утка — большой урон. Множитель крита +1.", category: "click",
    req: { upgradeOwned: "crit_gloves" } },
  { id: "muscle_memory", name: "Muscle Memory", icon: "💪", cost: 3_000_000, type: "cps_click", value: 0.01,
    desc: "Пальцы помнят CI: каждый клик приносит +1% от вашего CPS.", category: "click",
    req: { upgradeOwned: "double_monitors", lifetimeCommits: 1_500_000 } },

  /* ---------- Здания: команда и пайплайны ---------- */
  { id: "standups", name: "Daily Standups", icon: "🧍", cost: 1_500, type: "building_mult", target: "junior", value: 2,
    desc: "15 минут боли каждое утро. Junior Developers x2.", category: "team",
    req: { buildings: { junior: 10 } } },
  { id: "code_review", name: "Code Review Culture", icon: "👓", cost: 9_000, type: "building_mult", target: "senior", value: 2,
    desc: "LGTM! Senior Developers x2.", category: "team",
    req: { buildings: { senior: 10 } } },
  { id: "cache_layer", name: "Cache Layer", icon: "⚡", cost: 30_000, type: "building_mult", target: "ci_runner", value: 3,
    desc: "Build из кеша за 4 секунды. CI Runner x3.", category: "pipeline",
    req: { buildings: { ci_runner: 8 } } },
  { id: "parallel_pipelines", name: "Parallel Pipelines", icon: "🛤️", cost: 250_000, type: "building_cat", target: "pipeline", value: 2,
    desc: "Matrix build во всю мощь. Все CI/CD-генераторы x2.", category: "pipeline",
    req: { buildings: { ci_runner: 15 } } },

  /* ---------- Инфраструктура ---------- */
  { id: "dockerfile_best", name: "Multi-stage Dockerfile", icon: "📐", cost: 40_000, type: "building_mult", target: "docker", value: 3,
    desc: "Образ весит 12 МБ вместо 1.2 ГБ. Docker Container x3.", category: "infra",
    req: { buildings: { docker: 8 } } },
  { id: "helm_charts", name: "Helm Charts", icon: "🎻", cost: 300_000, type: "building_mult", target: "k8s_pod", value: 3,
    desc: "Templates внутри templates. Kubernetes Pod x3.", category: "infra",
    req: { buildings: { k8s_pod: 8 } } },
  { id: "cluster_autoscaler", name: "Cluster Autoscaler", icon: "📈", cost: 5_000_000, type: "building_cat", target: "infra", value: 2,
    desc: "Node pool сам масштабируется. Вся инфраструктура x2.", category: "infra",
    req: { buildings: { k8s_pod: 15 } } },
  { id: "cdn_warmup", name: "CDN Warm-up", icon: "🌐", cost: 100_000_000, type: "building_mult", target: "cdn", value: 3,
    desc: "Кэш прогрет заранее. CDN Edge Node x3.", category: "infra",
    req: { buildings: { cdn: 8 } } },

  /* ---------- IaC ---------- */
  { id: "iac_modules", name: "Infrastructure as Code", icon: "🏛️", cost: 1_500_000, type: "building_cat", target: "iac", value: 2.5,
    desc: "DRY-модули и remote state. Terraform и Ansible x2.5.", category: "iac",
    req: { buildings: { terraform: 8 } } },
  { id: "gitops_bot", name: "GitOps Bot", icon: "🔄", cost: 20_000_000, type: "unlock", target: "autobuy", value: 1,
    desc: "ArgoCD синхронизирует сам: автопокупка самого дешёвого доступного генератора раз в 10 сек.", category: "special",
    req: { buildings: { ansible: 5 } } },

  /* ---------- Observability / Security ---------- */
  { id: "obs_stack", name: "Observability Stack", icon: "🔭", cost: 15_000_000, type: "unlock", target: "advanced_stats", value: 1,
    desc: "Метрики, трейсы, дашборды: открывает расширенные вкладки статистики.", category: "observability",
    req: { buildings: { monitoring: 8 } } },
  { id: "zero_trust", name: "Zero Trust Security", icon: "🔐", cost: 120_000_000, type: "event_bad", value: 0.5,
    desc: "mTLS везде: негативные события слабее на 50%.", category: "security",
    req: { buildings: { scanner: 8 } } },
  { id: "dependency_audit", name: "Dependency Audit", icon: "📋", cost: 800_000_000, type: "building_mult", target: "scanner", value: 3,
    desc: "npm audit без слёз. Security Scanner x3.", category: "security",
    req: { buildings: { scanner: 12 } } },

  /* ---------- Cloud / Data ---------- */
  { id: "blue_green", name: "Blue-Green Deployment", icon: "🔵", cost: 50_000_000, type: "global_mult", value: 1.25,
    desc: "Переключение среды атомарно. Всё производство x1.25.", category: "global",
    req: { lifetimeCommits: 25_000_000 } },
  { id: "canary_release", name: "Canary Release", icon: "🐦", cost: 400_000_000, type: "unlock", target: "canary", value: 0.05,
    desc: "Каждую секунду 5% шанс «вылета канарейки»: мгновенный бонус = 30 сек дохода.", category: "global",
    req: { upgradeOwned: "blue_green" } },
  { id: "autoscaling", name: "Autoscaling Policy", icon: "🤏", cost: 2_000_000_000, type: "global_mult", value: 1.5,
    desc: "HPA на стероидах: всё производство x1.5.", category: "global",
    req: { upgradeOwned: "cluster_autoscaler" } },
  { id: "feature_flags", name: "Feature Flags", icon: "🚩", cost: 9_000_000_000, type: "unlock", target: "flags_toggle", value: 1,
    desc: "Открывает переключатель экспериментальных бонусов в настройках (+10% к клику, но −5% к событиям).", category: "special",
    req: { prestigeCount: 1 } },
  { id: "cloud_credits", name: "Cloud Credits", icon: "💳", cost: 50_000_000_000, type: "offline_mult", value: 1.5,
    desc: "Грант от облачного провайдера: офлайн-доход эффективнее в 1.5 раза.", category: "cloud",
    req: { buildings: { serverless: 10 } } },
  { id: "read_replicas", name: "Read Replicas Tuning", icon: "🗝️", cost: 500_000_000_000, type: "building_mult", target: "db_replica", value: 3,
    desc: "Репликация без лага. Database Replica x3.", category: "data",
    req: { buildings: { db_replica: 8 } } },

  /* ---------- Automation / Chaos ---------- */
  { id: "chaos_engineering", name: "Chaos Engineering", icon: "💣", cost: 80_000_000_000, type: "event_good", value: 1.5,
    desc: "GameDays окупаются: положительные события сильнее в 1.5 раза.", category: "automation",
    req: { buildings: { chaos: 5 } } },
  { id: "pager_duty_free", name: "Silenced Alerts", icon: "🔕", cost: 600_000_000_000, type: "building_mult", target: "sre_bot", value: 3,
    desc: "Алерты настроены. SRE Bot x3.", category: "automation",
    req: { buildings: { sre_bot: 8 } } },
  { id: "production_grade", name: "Production Grade", icon: "🏆", cost: 5_000_000_000_000, type: "global_mult", value: 2,
    desc: "Пять девяток надёжности. Постоянный глобальный множитель x2.", category: "global",
    req: { buildings: { authealing: 5 } } },
  { id: "ai_pair_devops", name: "AI Pair-DevOps", icon: "🤝", cost: 90_000_000_000_000, type: "building_mult", target: "ai_devops", value: 3,
    desc: "Промпт-инжиниринг уровня бога. AI DevOps Assistant x3.", category: "automation",
    req: { buildings: { ai_devops: 5 } } },
];

/* Категории для фильтра в магазине */
export const UPGRADE_CATEGORIES = {
  click: "Клик",
  team: "Команда",
  pipeline: "CI/CD",
  infra: "Инфра",
  iac: "IaC",
  observability: "Observability",
  security: "Security",
  cloud: "Cloud",
  data: "Data",
  automation: "Automation",
  global: "Глобальные",
  special: "Особые",
};
