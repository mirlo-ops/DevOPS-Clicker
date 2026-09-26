/**
 * dom.js — конструирование всего каркаса интерфейса VS Code.
 * Возвращает реестр элементов, на который опираются остальные UI-модули.
 */

import { el } from "../utils/helpers.js";
import { GAME_NAME } from "../config/constants.js";

const svgIcon = (name) => {
  // Иконки лежат в assets/icons; инлайним их через <img>, чтобы не дублировать разметку
  return el("img", {
    cls: "tab__icon",
    attrs: { src: `assets/icons/${name}.svg`, alt: "", "aria-hidden": "true" },
  });
};

export const ASCII_LOGO = String.raw`
 ____             ___  _     _ _      _       _   
|  _ \  _____   _| _ \| |   (_) |__  | | ___ | |_ 
| | | |/ _ \ \ / / | | | |   | | '_ \ | |/ _ \| __|
| |_| |  __/\ V /| |_| | |___| | |_) || | (_) | |_ 
|____/ \___| \_/ |___/|_____|_|_.__/ |_|\___/ \__|
`;

/** Построить layout внутри #app */
export function buildLayout() {
  const app = document.getElementById("app");
  app.innerHTML = "";

  /* ---------- Title bar ---------- */
  const titlebar = el("header", { cls: "titlebar", attrs: { role: "banner" } });
  titlebar.append(
    el("img", { attrs: { src: "assets/icons/favicon.svg", alt: "", class: "titlebar__logo" } }),
    (() => {
      const t = el("div", { cls: "glitch titlebar__title", attrs: { "data-text": `~/devops-clicker — ${GAME_NAME}` } });
      t.textContent = `~/devops-clicker — ${GAME_NAME}`;
      return t;
    })(),
    (el("div", { cls: "titlebar__tabs", dataset: { role: "editor-tabs" } })),
    el("div", { cls: "titlebar__spacer" }),
    (() => {
      const actions = el("div", { cls: "titlebar__actions" });
      actions.appendChild(
        el("button", {
          cls: "btn btn--ghost btn--small",
          text: "💾 Save",
          attrs: { id: "btn-save", "aria-label": "Сохранить игру" },
        })
      );
      return actions;
    })()
  );

  /* ---------- Activity bar ---------- */
  const activity = el("nav", { cls: "activitybar", attrs: { "aria-label": "Разделы игры" } });
  const actButtons = {};
  const addAct = (id, icon, label) => {
    const btn = el("button", {
      cls: "activity-btn",
      attrs: { "data-view": id, "aria-label": label, title: label, type: "button" },
    });
    btn.appendChild(svgIcon(icon));
    activity.appendChild(btn);
    actButtons[id] = btn;
    return btn;
  };
  addAct("clicker", "git", "Кликер (терминал)");
  addAct("buildings", "extensions", "Генераторы");
  addAct("upgrades", "search", "Улучшения");
  addAct("prestige", "debug", "Престиж");
  addAct("achievements", "explorer", "Достижения");
  addAct("stats", "stats", "Статистика");
  activity.appendChild(el("div", { cls: "activitybar__spacer" }));
  addAct("settings", "settings", "Настройки");

  /* ---------- Side panel (магазин) ---------- */
  const sidepanel = el("aside", { cls: "sidepanel", attrs: { "aria-label": "Магазин" } });
  sidepanel.append(
    (() => {
      const h = el("div", { cls: "sidepanel__header" });
      h.append(
        el("span", { text: "EXPLORER — MARKETPLACE" }),
        el("div", { cls: "btn-group", attrs: { id: "buy-mode", role: "group", "aria-label": "Режим покупки" } })
      );
      return h;
    })(),
    el("div", { cls: "sidepanel__body", dataset: { role: "sidepanel-body" } })
  );

  /* ---------- Editor (игровая зона) ---------- */
  const editor = el("main", { cls: "editor", attrs: { role: "main" } });
  editor.append(
    (() => {
      const res = el("div", { cls: "resource-bar", attrs: { "aria-live": "polite" } });
      res.append(
        resourceBlock("commits", "Commits", "git commits ▸ main"),
        resourceBlock("cps", "CPS", "production/sec"),
        resourceBlock("clickPower", "Click Power", "git push --force"),
        resourceBlock("tokens", "Cloud Tokens", "☁ prestige currency")
      );
      return res;
    })(),
    el("div", { cls: "breadcrumbs", html: "src &rsaquo; pipelines &rsaquo; <span>prod.deploy.ts</span>" }),
    (() => {
      const scroll = el("div", { cls: "editor__scroll" });
      const zone = el("section", { cls: "click-zone", attrs: { id: "click-zone" } });
      zone.append(
        el("pre", { cls: "ascii-art", text: ASCII_LOGO, attrs: { "aria-hidden": "true" } }),
        el("div", { cls: "muted", text: "# Каждый клик — коммит в мастер. Не забудьте .gitignore для депрессии." }),
        (() => {
          const btn = el("button", {
            cls: "commit-btn",
            text: 'git commit -m "fix prod"',
            attrs: { id: "commit-btn", "aria-label": "Сделать коммит", type: "button" },
          });
          return btn;
        })(),
        el("div", { cls: "click-power", attrs: { id: "click-power-note" }, text: "" }),
        el("div", { cls: "muted", attrs: { id: "deploy-status", style: "" }, text: "$ status: pipeline green ✔" })
      );
      scroll.appendChild(zone);
      return scroll;
    })()
  );

  /* ---------- Нижняя панель ---------- */
  const panel = el("section", { cls: "panel", attrs: { "aria-label": "Панель вывода" } });
  const panelTabs = el("div", { cls: "panel__tabs", attrs: { role: "tablist" } });
  ["TERMINAL", "OUTPUT", "PROBLEMS"].forEach((label, i) => {
    panelTabs.appendChild(
      el("button", {
        cls: `tab${i === 0 ? " tab--active" : ""}`,
        text: label,
        attrs: { "data-panel-tab": label.toLowerCase(), role: "tab", "aria-selected": i === 0 ? "true" : "false" },
      })
    );
  });
  const panelBody = el("div", { cls: "panel__body", dataset: { role: "panel-body" } });
  panelBody.append(
    el("div", { cls: "terminal", attrs: { id: "terminal", "data-panel": "terminal", role: "log", "aria-live": "off" } }),
    el("div", { hidden: true, dataset: { panel: "output" } }),
    el("div", { hidden: true, dataset: { panel: "problems" } })
  );
  panel.append(panelTabs, panelBody);

  /* ---------- Status bar ---------- */
  const status = el("footer", { cls: "statusbar", attrs: { role: "contentinfo" } });
  status.append(
    el("span", { cls: "statusbar__item", attrs: { id: "st-commit" }, text: "⎇ main" }),
    el("span", { cls: "statusbar__item", attrs: { id: "st-commits" }, text: "0 commits" }),
    el("span", { cls: "statusbar__item", attrs: { id: "st-cps" }, text: "0/s" }),
    (() => {
      const inc = el("span", {
        cls: "statusbar__item statusbar__item--warn",
        attrs: { id: "st-incident", hidden: "" },
      });
      inc.appendChild(
        el("button", {
          cls: "btn btn--danger btn--small",
          text: "🚨 RESOLVE INCIDENT",
          attrs: { id: "btn-incident", "aria-label": "Отбить инцидент" },
        })
      );
      return inc;
    })(),
    el("span", { cls: "statusbar__item statusbar__item--right statusbar__save", attrs: { id: "st-save" } }, ),
    el("span", { cls: "statusbar__item statusbar__fps", attrs: { id: "st-fps" }, text: "60 fps" })
  );

  /* ---------- Сборка grid ---------- */
  const layout = el("div", { cls: "layout" });
  layout.append(titlebar, activity, (() => {
    const main = el("div", { cls: "main", attrs: { id: "main-area" } });
    main.append(sidepanel, editor);
    return main;
  })(), panel, status);

  app.appendChild(layout);

  return {
    layout,
    titlebar,
    editorTabs: titlebar.querySelector('[data-role="editor-tabs"]'),
    activity,
    actButtons,
    sidepanel,
    sidepanelHeader: sidepanel.querySelector(".sidepanel__header span"),
    sidepanelBody: sidepanel.querySelector('[data-role="sidepanel-body"]'),
    buyMode: document.getElementById("buy-mode"),
    editor,
    commitBtn: document.getElementById("commit-btn"),
    clickZone: document.getElementById("click-zone"),
    deployStatus: document.getElementById("deploy-status"),
    panelTabs,
    terminal: document.getElementById("terminal"),
    outputPane: panelBody.querySelector('[data-panel="output"]'),
    problemsPane: panelBody.querySelector('[data-panel="problems"]'),
    status,
    stCommit: document.getElementById("st-commit"),
    stCommits: document.getElementById("st-commits"),
    stCps: document.getElementById("st-cps"),
    stIncident: document.getElementById("st-incident"),
    btnIncident: document.getElementById("btn-incident"),
    stSave: document.getElementById("st-save"),
    stFps: document.getElementById("st-fps"),
    btnSave: document.getElementById("btn-save"),
    resources: {
      commits: document.getElementById("res-commits"),
      commitsSub: document.getElementById("res-commits-sub"),
      cps: document.getElementById("res-cps"),
      clickPower: document.getElementById("res-clickpower"),
      tokens: document.getElementById("res-tokens"),
    },
  };
}

/** Блок ресурса в верхней панели */
function resourceBlock(id, label, sub) {
  const wrap = el("div", { cls: "resource" });
  const big = id === "commits";
  wrap.append(
    el("span", { cls: "resource__label", text: label }),
    el("span", {
      cls: `resource__value${big ? " resource__value--big" : ""}`,
      attrs: { id: `res-${id === "clickPower" ? "clickpower" : id}` },
      text: "0",
    }),
    el("span", { cls: "resource__sub", attrs: { id: `res-${id}-sub` }, text: sub })
  );
  return wrap;
}
