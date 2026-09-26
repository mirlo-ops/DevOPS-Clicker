/**
 * settings-view.js — вкладка «Настройки»: звук, визуальные эффекты,
 * экспорт/импорт сохранения и опасная зона полного сброса.
 */

import { el, downloadText, readFileAsText } from "../utils/helpers.js";
import { state, createInitialState } from "../core/state.js";
import { setSetting, applySettings } from "../systems/settings.js";
import { saveGame, exportSaveString } from "../systems/save.js";
import { importSaveFromString, wipeSave } from "../systems/load.js";
import { playSound } from "../systems/sound.js";
import { OFFLINE_MAX_HOURS, AUTOSAVE_INTERVAL_MS } from "../config/constants.js";
import { fmtClock } from "../utils/time.js";
import { openModal, confirmModal, closeModal } from "./modals.js";
import { log } from "./terminal-log.js";
import { notify } from "../systems/notifications.js";
import { switchView } from "./tabs.js";
import { showHelpModal } from "./stats-view.js";
import { invalidateRenderCache } from "./renderer.js";
import { invalidateAchievements } from "./achievements-view.js";

let root = null;

/* ---------------- Сборка вкладки ---------------- */

export function mountSettings() {
  root = el("div", { cls: "stats-wrap" });
  root.appendChild(el("div", { cls: "panel-section__title", text: "// SETTINGS — user.json" }));

  const grid = el("div", { cls: "settings-grid" });
  grid.append(
    toggleRow("sound", "🔊 Звук", "Клики, покупки и достижения",
    sliderRow("volume", "Громкость", 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`),
    toggleRow("animations", "✨ Анимации", "Всплывающие числа и переходы",
    toggleRow("matrixRain", "🟩 Matrix rain", "Зелёный дождь на фоне",
    toggleRow("scanlines", "📺 Scanlines", "ЭЛТ-развёртка поверх интерфейса",
    toggleRow("reducedMotion", "♿ Reduced motion", "Минимум движения (доступность)",
  );
  if (state.flags.unlocks.flags_toggle) {
    grid.appendChild(toggleRow("featureFlagsExp", "🚩 Feature Flags (experimental)", +10% к клику, слабее события и бонусы canary"));
  }
  root.appendChild(grid);

  /* --- Действия --- */
  root.appendChild(el("div", { cls: "panel-section__title", text: "// ACTIONS" }));
  const actions = el("div", { style: "display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px" });
  actions.append(
    actionBtn("💾 Сохранить сейчас", "btn--primary", () => manualSave()),
    actionBtn("⬇ Экспорт JSON", "btn--ghost", () => {
      downloadText(`devops-clicker-save-${Date.now()}.json`, exportSaveString(), "text/plain");
      log("save", "[save] Exported save to JSON file");
    }),
    actionBtn("⬆ Импорт JSON", "btn--ghost", () => openImportDialog()),
    actionBtn("📖 Как играть", "btn--ghost", () => showHelpModal()),
  );
  root.appendChild(actions);

  /* --- Инфо о сейвах --- */
  root.appendChild(rowsBlock([
    ["Последнее сохранение:", state.lastSave ? fmtClock(new Date(state.lastSave)) : "—"],
    ["Всего сохранений:", String(state.stats.savesCount)],
    ["Автосохранение:", `каждые ${AUTOSAVE_INTERVAL_MS / 1000} сек + при закрытии вкладки`],
    ["Офлайн-лимит:", `${OFFLINE_MAX_HOURS} часов (config/constants.js → OFFLINE_MAX_HOURS)`],
    ["Хранилище:", "localStorage (ключ devops-clicker-save-v1)"],
  ]));

  /* --- Опасная зона --- */
  const danger = el("div", { cls: "danger-zone" });
  danger.appendChild(el("div", { cls: "danger-zone__title", text: "⚠ DANGER ZONE — terraform destroy -auto-approve" }));
  const dangerBtns = el("div", { style: "display:flex; gap:8px; flex-wrap:wrap" });
  dangerBtns.append(
    actionBtn("🧹 Сбросить ран (без токенов)", "btn--ghost", () =>
      confirmModal(
        "Сбросить текущий ран?",
        "<p>Коммиты, генераторы и улучшения этого рана будут удалены. Cloud Tokens, ачивки и статистика останутся.</p>",
        () => {
          wipeRunOnly();
          closeModal();
        },
        "Сбросить ран",
      )),
    actionBtn("☠ Полный сброс прогресса", "btn--danger", () =>
      confirmModal(
        "ПОЛНЫЙ СБРОС: всё навсегда?",
        "<p><b class=\"modal__highlight\">Это удалит ВСЁ</b>: коммиты, генераторы, улучшения, достижения, Cloud Tokens и статистику.</p><p>Рекомендуем сначала сделать экспорт сохранения.</p>",
        () => {
          wipeSave();
          applySettings();
          invalidateRenderCache();
          invalidateAchievements();
          saveGame();
          log("warn", "[system] Save wiped by user. Fresh repository initialized.");
          notify("☠ Прогресс сброшен", "Репозиторий переинициализирован (git init).", "error");
          closeModal();
          switchView("clicker");
        },
        "Уничтожить всё",
      ))
  );
  danger.appendChild(dangerBtns);
  root.appendChild(danger);
  return root;
}

/** Лёгкое обновление (кнопки могут появляться после разблокировок) */
export function refreshSettings() {
  // Пересобираем только если появились новые разблокировки (дешевле — перемонтировать при switchView)
  void root;
}

/* ---------------- Хелперы ---------------- */

const actionBtn = (label, cls, onClick) => {
  const b = el("button", { cls: `btn ${cls}`, text: label, attrs: { type: "button", "aria-label": label } });
  b.addEventListener("click", onClick);
  return b;
};

const toggleRow = (key, label, hint) => {
  const row = el("div", { cls: "setting-row" });
  const text = el("div", {});
  text.append(
    el("div", { cls: "setting-row__label", text: label }),
    el("div", { cls: "setting-row__hint", text: hint }),
  );
  const input = el("input", {
    cls: "switch",
    attrs: { type: "checkbox", "aria-label": label },
  });
  input.checked = Boolean(state.settings[key]);
  input.addEventListener("change", () => {
    setSetting(key, input.checked);
    if (key === "sound" && input.checked) playSound("click"); // сразу показать, как звучит
    log("info", `[settings] ${key} = ${input.checked}`);
  });
  row.append(text, input);
  return row;
};

const sliderRow = (key, label, min, max, step, display) => {
  const row = el("div", { cls: "setting-row" });
  const text = el("div", {});
  text.append(
    el("div", { cls: "setting-row__label", text: label }),
    el("div", { cls: "setting-row__hint", text: "Web Audio API, без внешних файлов плеера" }),
  );
  const val = el("span", { cls: "stat-row__val", text: display(state.settings[key]) });
  const input = el("input", {
    cls: "slider",
    attrs: { type: "range", min: String(min), max: String(max), step: String(step), "aria-label": label },
  });
  input.value = String(state.settings[key]);
  input.addEventListener("input", () => {
    const v = Number(input.value);
    setSetting(key, Number.isFinite(v) ? v : 0.5);
    val.textContent = display(v);
  });
  row.append(text, input, val);
  return row;
};

const statRow = (k, v) => {
  const r = el("div", { cls: "stat-row" });
  r.append(el("span", { cls: "stat-row__key", text: k }), el("span", { cls: "stat-row__val", text: v }));
  return r;
};

const rowsBlock = (pairs) => {
  const wrap = el("div", { cls: "stat-rows", style: "margin-bottom:14px" });
  wrap.append(...pairs.map(([k, v]) => statRow(k, v)));
  return wrap;
};

/* ---------------- Сохранения ---------------- */

function manualSave() {
  const ok = saveGame();
  log(ok ? "save" : "warn", ok ? `[save] Progress saved at ${fmtClock()}` : "[save] FAILED: localStorage недоступен или переполнен");
  notify(ok ? "💾 Сохранено" : "⚠ Ошибка сохранения", ok ? `git add -A && git commit — ок (${fmtClock()})` : "Проверьте настройки приватности браузера.", ok ? "success" : "error");
  if (ok) playSound("deploy");
}

/** Сброс только рана (как мягкий престиж без награды) — для «испортили билд» */
function wipeRunOnly() {
  const keep = {
    tokens: state.resources.prestigeTokens,
    lifetimeTokens: state.resources.lifetimePrestigeTokens,
    lifetimeCommits: state.resources.lifetimeCommits,
    achievements: { ...state.achievements },
    stats: state.stats,
    settings: { ...state.settings },
  };
  {
    const fresh = createInitialState();
    Object.assign(state, fresh);
    state.resources.prestigeTokens = keep.tokens;
    state.resources.lifetimePrestigeTokens = keep.lifetimeTokens;
    state.resources.lifetimeCommits = keep.lifetimeCommits;
    state.achievements = keep.achievements;
    state.stats = keep.stats;
    state.settings = keep.settings;
    saveGame();
    invalidateRenderCache();
    invalidateAchievements();
    log("warn", "[system] Run reset (soft rollback): git reset --hard HEAD~∞");
    notify("🧹 Ран сброшен", "Откат без потери Cloud Tokens и достижений.", "info");
    closeModal();
    switchView("clicker");
  }
}

/** Модалка импорта: textarea с JSON/base64 или выбор файла */
function openImportDialog() {
  const modal = openModal({
    title: "⬆ Импорт сохранения",
    wide: true,
    bodyHtml: `
      <p class="muted">Вставьте строку экспорта (base64 или JSON) либо выберите файл .json.</p>
      <textarea id="import-area" rows="7" spellcheck="false"
        style="width:100%;background:#111;color:#d4d4d4;border:1px solid #444;border-radius:4px;padding:8px;font-family:monospace;font-size:11px"
        aria-label="Данные сохранения"></textarea>
      <div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input type="file" id="import-file" accept=".json,.txt,application/json" aria-label="Файл сохранения" />
        <span id="import-error" class="setting-row__hint" style="color:var(--vscode-red)"></span>
      </div>`,
    buttons: [
      { label: "Отмена", cls: "btn--ghost" },
      {
        label: "Импортировать", cls: "btn--primary", closeAfter: false,
        onClick: (btn) => {
          void btn;
          const area = document.getElementById("import-area");
          const err = document.getElementById("import-error");
          const text = (area?.value ?? "").trim();
          if (!text) {
            if (err) err.textContent = "Пустое поле: вставьте данные или выберите файл.";
            return false; // не закрываем
          }
          try {
            importSaveFromString(text);
            afterImport();
            return true;
          } catch (e) {
            if (err) err.textContent = `❌ ${e.message}`;
            log("warn", `[save] Import failed: ${e.message}`);
            return false;
          }
        },
      },
    ],
  });
  // Загрузка файла -> в textarea
  modal?.querySelector("#import-file")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      const area = modal.querySelector("#import-area");
      if (area) area.value = text.trim();
    } catch {
      const err = modal.querySelector("#import-error");
      if (err) err.textContent = "❌ Не удалось прочитать файл.";
    }
  });
}

function afterImport() {
  applySettings();
  invalidateRenderCache();
  invalidateAchievements();
  closeModal();
  log("save", `[save] Save imported successfully at ${fmtClock()}`);
  notify("⬆ Импорт завершён", "Сохранение загружено, экономика пересчитана.", "success");
  switchView("clicker");
}
