/**
 * main.js — точка входа: собирает системы, вешает обработчики, запускает цикл.
 * Порядок важен: состояние → каркас UI → подписки → загрузка сейва → старт.
 */

import { state } from "./core/state.js";
import { recomputeDerived } from "./core/economy.js";
import { handleClick, setClickHooks } from "./core/click-handler.js";
import { startLoop, onTick, onAutobuy, fpsCounter, resumeClock } from "./core/game-loop.js";
import { applyOfflineProgress, offlineMessage } from "./core/offline-progress.js";
import { attemptIncidentFix, resolveInteractive, setEventHooks } from "./core/events-system.js";
import { getBuildingCfg } from "./core/buildings-system.js";
import { pendingTokens } from "./core/prestige-system.js";

import { GAME_NAME, UI_FULL_REFRESH_MS } from "./config/constants.js";

import { buildLayout } from "./ui/dom.js";
import { initTabs, registerMounter, registerRefresher, switchView, currentView } from "./ui/tabs.js";
import { initShop, showShopSide } from "./ui/shop-view.js";
import { initTerminal, log, bootSequence } from "./ui/terminal-log.js";
import { initTooltips } from "./ui/tooltips.js";
import { initFloating } from "./ui/floating-text.js";
import { initRenderer, onGameClick, renderFrame, renderHeavy, invalidateRenderCache } from "./ui/renderer.js";
import { mountAchievements, refreshAchievements, invalidateAchievements } from "./ui/achievements-view.js";
import { mountStats, refreshStats, showHelpModal } from "./ui/stats-view.js";
import { mountPrestige, refreshPrestige } from "./ui/prestige-view.js";
import { mountSettings, refreshSettings } from "./ui/settings-view.js";
import { mountCloud, refreshCloud } from "./ui/cloud-view.js";
import { openModal } from "./ui/modals.js";
import { initMatrixRain, syncMatrixRain } from "./ui/matrix-rain.js";

import { loadGame } from "./systems/load.js";
import { saveGame, startAutosave, bindLifecycleEvents } from "./systems/save.js";
import { applySettings } from "./systems/settings.js";
import { preloadSounds, playSound } from "./systems/sound.js";
import { notify, initNotifications } from "./systems/notifications.js";
import { checkAchievements, setAchievementHook } from "./systems/achievements.js";
import { sampleHistory } from "./systems/stats.js";
import { initAuth } from "./systems/firebase-auth.js";
import { initFirebase, isFirebaseReady, firebaseStatusText } from "./systems/firebase-init.js";
import { startCloudSync, stopCloudSync, bindCloudLifecycle, pullCloudSave, fetchCloudSave, fetchLeaderboard } from "./systems/firebase-db.js";
import { LEADERBOARD_REFRESH_MS } from "./config/firebase.js";
import { fmt, fmtInt } from "./utils/format.js";

/* ================= 1. Каркас интерфейса ================= */

const dom = buildLayout();

initTerminal(dom.terminal);
initNotifications();
initFloating();
initTooltips();
initRenderer(dom);
initMatrixRain();

initTabs(dom, [
  { id: "clicker", label: "README.md", icon: "file-code" },
  { id: "buildings", label: "generators.json", icon: "file-json" },
  { id: "upgrades", label: "extensions.json", icon: "file-json" },
  { id: "prestige", label: "cloud.tf", icon: "file-code" },
  { id: "cloud", label: "cloud.db", icon: "database" },
  { id: "achievements", label: "ACHIEVEMENTS.md", icon: "file-markdown" },
  { id: "stats", label: "telemetry.log", icon: "file-log" },
  { id: "settings", label: "user.json", icon: "gear" },
]);

registerMounter("achievements", mountAchievements);
registerRefresher("achievements", refreshAchievements);
registerMounter("stats", mountStats);
registerRefresher("stats", refreshStats);
registerMounter("prestige", mountPrestige);
registerRefresher("prestige", refreshPrestige);
registerMounter("cloud", mountCloud);
registerRefresher("cloud", refreshCloud);
registerMounter("settings", mountSettings);
registerRefresher("settings", refreshSettings);

// Кликер не маунтится — его базовая зона живёт в реестре dom.clickZone

/* ================= 2. Магазин ================= */

initShop(dom, { log, sound: playSound });
showShopSide("buildings");

// Activity bar / editor tabs: синхронизируем содержимое сайдбара с текущим представлением
const SHOP_SIDES = { buildings: "buildings", upgrades: "upgrades" };
let lastView = currentView();
onTick(() => {
  const cur = currentView();
  if (cur !== lastView) {
    lastView = cur;
    if (SHOP_SIDES[cur]) showShopSide(SHOP_SIDES[cur]);
  }
});

/* ================= 3. Хуки систем → UI ================= */

setClickHooks({
  onClick: (gain, isCrit, x, y) => {
    onGameClick({ gain, crit: isCrit, x, y });
    playSound(isCrit ? "achievement" : "click");
  },
  onCritical: null,
  notifyError: (msg) => notify("⚠ Ошибка", msg, "error"),
});

setEventHooks({
  log,
  notify,
  sound: playSound,
});

setAchievementHook((ach) => {
  log("achievement", `[achieved] ${ach.icon} ${ach.name} — ${ach.desc}`);
  notify(`${ach.icon} Achievement unlocked!`, ach.name, "achievement");
  playSound("achievement");
});

/* ================= 4. Обработчики кликов каркаса ================= */

dom.commitBtn.addEventListener("pointerdown", (e) => {
  // pointerdown вместо click: отзывчивее на тач-устройствах
  handleClick(e.clientX, e.clientY);
});
// Enter/Space на сфокусированной кнопке
dom.commitBtn.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    const r = dom.commitBtn.getBoundingClientRect();
    handleClick(r.left + r.width / 2, r.top + r.height / 2);
  }
});

dom.btnIncident?.addEventListener("click", () => {
  const inter = state.events.interactive;
  if (!inter) return;
  if (inter.kind === "button") attemptIncidentFix();
  else resolveInteractive(false); // мини-игра по кликам: сдались — провал
});

dom.btnSave?.addEventListener("click", () => {
  const ok = saveGame();
  log(ok ? "save" : "warn", ok ? "[save] Manual save OK" : "[save] FAILED (localStorage?)");
  if (ok) playSound("deploy");
});

document.querySelectorAll("[data-open-help]").forEach((btn) => {
  btn.addEventListener("click", () => showHelpModal());
});

/* ================= 5. Игровой цикл: подписки ================= */

let uiAccumulator = 0;
let achAccumulator = 0;

onTick((dtSec) => {
  sampleHistory(dtSec);

  uiAccumulator += dtSec * 1000;
  if (uiAccumulator >= UI_FULL_REFRESH_MS) {
    uiAccumulator = 0;
    renderHeavy();
  }

  achAccumulator += dtSec * 1000;
  if (achAccumulator >= 1000) {
    achAccumulator = 0;
    checkAchievements();
  }
});

onAutobuy((res) => {
  const cfg = getBuildingCfg(res.id);
  if (cfg) log("buy", `[gitops] Bot auto-purchased ${cfg.icon} ${cfg.name} for ${fmt(res.cost)}`);
});

/* ================= 6. Загрузка сохранения и офлайн-доход ================= */

const loadStatus = loadGame();
applySettings();
recomputeDerived(); // после загрузки: derived из сохранённых зданий/апгрейдов

if (loadStatus === "corrupted") {
  notify("⚠ Save corrupted", "Сохранение повреждено — старт с чистого листа.", "error");
  log("warn", "[load] Save is corrupted; starting fresh repository.");
}

const offline = applyOfflineProgress();
if (offline && offline.earned > 0) {
  openModal({
    title: "🌙 Welcome back, engineer",
    bodyHtml: offlineMessage(offline),
    dismissible: true,
    buttons: [{ label: "Продолжить работу", cls: "btn--primary" }],
  });
  log("info", `[offline] Earned ${fmt(offline.earned)} commits while away.`);
}

if (loadStatus === "fresh") {
  bootSequence([
    ["info", `$ git init ${GAME_NAME.toLowerCase().replace(" ", "-")}`],
    ["info", "Initialized empty repository. Branch: main"],
    ["info", "$ npm install motivation — added 1 package"],
    ["good", "# Welcome! Click 'git commit' to earn your first commits."],
    ["info", "$ open README.md   # нажмите ? в titlebar, чтобы прочитать"],
  ]);
  setTimeout(() => showHelpModal(), 900);
} else {
  log("info", `[load] Save loaded: ${fmt(state.resources.commits)} commits, CPS ${fmt(state.derived.cps)}/s`);
}

/* ================= 7. Жизненный цикл и автосохранение ================= */

startAutosave((ok) => {
  if (ok) log("save", "[save] Autosave completed");
});
bindLifecycleEvents(() => {});

/* ================= 7b. Firebase: БД, облачные сейвы, лидерборд ================= */

/** Превью-значение из сериализованного состояния (для модалки сравнения) */
const previewCommits = (data) => Math.floor(data?.resources?.commits ?? 0);
const previewLifetime = (data) => Math.floor(data?.resources?.lifetimeCommits ?? 0);

(async function initCloud() {
  const ctx = await initFirebase();
  if (!ctx) {
    log("warn", "[cloud] Firebase недоступен — игра работает локально (localStorage).");
    return;
  }
  log("info", `[cloud] ${firebaseStatusText()} — Firestore подключён.`);

  const user = await initAuth();
  if (user) {
    log("info", `[auth] session restored: uid=${user.uid.slice(0, 8)}… ${user.isAnonymous ? "(anonymous)" : `(${user.displayName || "linked"})`}`);
  } else {
    log("warn", "[auth] вход не выполнен — лидерборд и облачные сейвы недоступны.");
    return;
  }

  // Если в облаке есть сейв свежее локального — предложить восстановить
  try {
    const { data: cloudSave } = await fetchCloudSave();
    if (cloudSave) {
      const localLast = Number(state.lastSave) || 0;
      const cloudLast = Number(cloudSave.lastSave) || 0;
      if (cloudLast > localLast + 5_000) {
        openModal({
          title: "☁️ Cloud save found",
          bodyHtml: `В Firebase найдено сохранение свежее локального:<br><br>
            <b>Облако:</b> ${fmt(previewCommits(cloudSave))} commits (${new Date(cloudLast).toLocaleString()})<br>
            <b>Локально:</b> ${fmt(state.resources.commits)} commits (${localLast ? new Date(localLast).toLocaleString() : "нет сейва"})<br><br>
            Восстановить прогресс из облака?`,
          dismissible: true,
          buttons: [
            { label: "☁️ Восстановить из облака", cls: "btn--primary", onClick: async () => {
                const res = await pullCloudSave();
                if (res === "loaded") {
                  log("good", "[cloud] Restore from cloud: save applied.");
                  notify("☁️ Cloud restore", "Прогресс восстановлен из Firebase.", "achievement");
                  recomputeDerived();
                  invalidateRenderCache();
                  window.dispatchEvent(new CustomEvent("devops:cloud-restored"));
                } else {
                  log("warn", `[cloud] restore failed: ${res}`);
                }
              } },
            { label: "Оставить локальное", cls: "btn", onClick: () => {
                log("info", "[cloud] Local save kept — will be pushed on next sync.");
              } },
          ],
        });
      } else {
        log("info", "[cloud] Local save is up to date.");
      }
    } else {
      log("info", "[cloud] Облачного сейва пока нет — он появится при первой синхронизации.");
    }
  } catch (err) {
    log("warn", `[cloud] restore check failed: ${err?.code ?? err}`);
  }

  const onSyncEvent = (kind, detail) => {
    if (kind === "pushed") log("save", "[cloud] Save synced to Firestore ✔");
    else log("warn", `[cloud] Sync skipped/failed: ${detail ?? "unknown"}`);
  };

  if (state.settings.cloudSync) {
    startCloudSync(onSyncEvent);
    bindCloudLifecycle();
    log("info", "[cloud] Autosync enabled (каждые 30 с при изменениях).");
  } else {
    log("info", "[cloud] Autosync выключен (флаг cloudSync в user.json).");
  }

  // Переключение автосинка из вкладки cloud.db
  window.addEventListener("cloud:toggle", (e) => {
    if (e.detail) startCloudSync(onSyncEvent);
    else stopCloudSync();
  });

  // Периодический фоновый прогрев кэша лидерборда
  every(LEADERBOARD_REFRESH_MS / 1000, () => { fetchLeaderboard(); });
})();

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    resumeClock();
    // Вернулись: возможно, пришло время офлайн-дохода по короткому отсутствию — не считаем,
    // game-loop сам догонит economyTick'ами (dt ограничен 60с).
  }
});

window.addEventListener("devops:prestiged", () => {
  invalidateRenderCache();
  invalidateAchievements();
  showShopSide("buildings");
  switchView("clicker");
  log("prestige", `[prestige] New run started. Tokens: ${fmtInt(state.resources.prestigeTokens)} ☁ (next: +${fmtInt(pendingTokens())})`);
});

/* ================= 8. Фоновые эффекты и запуск ================= */

// Синхронизируем matrix rain с настройками (поллинг раз в 2с дешевле подписок на все мутации)
every(2000, syncMatrixRain);

// Кадровый рендер: ресурсы/FPS — каждый кадр (внутри кэш строк)
onTick(() => {
  renderFrame(fpsCounter());
});

startLoop();
log("info", `[system] ${GAME_NAME} v1.0 — pipeline is up. May the uptime be with you.`);

/* ---------------- Утилиты ---------------- */

/** Планировщик «раз в N мс» поверх игрового тика (экономит работу вне кадров) */
function every(periodMs, fn) {
  let acc = 0;
  onTick((dtSec) => {
    acc += dtSec * 1000;
    if (acc < periodMs) return;
    acc = 0;
    fn();
  });
}
