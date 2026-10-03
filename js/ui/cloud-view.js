/**
 * cloud-view.js — вкладка «cloud.db»: Firebase-статус, аккаунт и лидерборд.
 * Монтируется через registerMounter/Refresher (см. main.js).
 */

import { state } from "../core/state.js";
import { fmt, fmtInt } from "../utils/format.js";
import { isFirebaseReady, firebaseStatusText } from "../systems/firebase-init.js";
import { getUid, isSignedIn, hasGoogleProvider, linkGoogle, signOutToAnonymous } from "../systems/firebase-auth.js";
import { fetchLeaderboard, pushCloudSave, pullCloudSave, getSyncStatus } from "../systems/firebase-db.js";

let root = null;
let lbRows = [];
let busy = false;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const timeAgo = (ts) => {
  if (!ts) return "—";
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}с назад`;
  if (s < 3600) return `${Math.floor(s / 60)}м назад`;
  if (s < 86400) return `${Math.floor(s / 3600)}ч назад`;
  return `${Math.floor(s / 86400)}д назад`;
};

function statusLine() {
  const sync = getSyncStatus();
  const parts = [
    `DB: ${isFirebaseReady() ? "🟢 " + firebaseStatusText() : "🔴 недоступна (локальный режим)"}`,
    `Auth: ${isSignedIn() ? (hasGoogleProvider() ? "👤 Google" : "👻 anonymous") : "⚪ guest"}`,
    `UID: ${getUid() ? getUid().slice(0, 12) + "…" : "—"}`,
    `Push: ${sync.lastPushAt ? timeAgo(sync.lastPushAt) : "—"}`,
    `Pull: ${sync.lastPullAt ? timeAgo(sync.lastPullAt) : "—"}`,
    sync.lastError ? `Last error: ${sync.lastError}` : "Errors: none",
  ];
  return parts.map((p) => `<div class="stat-row"><span>${esc(p.split(":")[0])}</span><b>${esc(p.slice(p.indexOf(":") + 1).trim())}</b></div>`).join("");
}

function renderLb() {
  if (!lbRows.length) {
    return `<div class="terminal-line">leaderboard empty — нажми «Обновить» или синхронизируйся</div>`;
  }
  const head = `<tr><th>#</th><th>engineer</th><th>lifetime commits</th><th>achv.</th><th>престиж</th><th>обновлён</th></tr>`;
  const rows = lbRows.map((r, i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
    return `<tr class="${r.me ? "lb-me" : ""}">
      <td>${medal}</td>
      <td>${esc(r.name || "anonymous")}${r.me ? " ← ты" : ""}</td>
      <td>${fmt(Math.floor(r.lifetimeCommits || 0))}</td>
      <td>${fmtInt(r.achievements || 0)}</td>
      <td>${fmtInt(r.prestigeCount || 0)}</td>
      <td>${timeAgo(r.updatedAt)}</td>
    </tr>`;
  }).join("");
  return `<table class="stats-table lb-table">${head}${rows}</table>`;
}

function refreshDom() {
  if (!root) return;
  root.querySelector("[data-lb-status]") && (root.querySelector("[data-lb-status]").innerHTML = statusLine());
  const body = root.querySelector("[data-lb-body]");
  if (body) body.innerHTML = renderLb();
}

export function mountCloud() {
  root = document.createElement("div");
  root.className = "panel cloud-panel";
  root.innerHTML = `
    <h3 class="panel-title">☁️ Firebase Cloud Storage</h3>
    <div class="stat-list" data-lb-status></div>
    <div class="btn-group" style="margin:10px 0; display:flex; gap:8px; flex-wrap:wrap;">
      <button class="btn btn--primary" data-act="sync-now">⇡ Синхронизировать сейчас</button>
      <button class="btn" data-act="pull">⇣ Загрузить из облака</button>
      <button class="btn" data-act="refresh-lb">⟳ Обновить лидерборд</button>
      <button class="btn" data-act="google" ${hasGoogleProvider() ? "disabled" : ""}>${hasGoogleProvider() ? "✓ Google привязан" : "🔗 Привязать Google"}</button>
      <button class="btn" data-act="signout" ${hasGoogleProvider() ? "" : "disabled"}>Выйти из Google</button>
    </div>
    <label class="setting-row">
      <span>Имя в таблице лидеров</span>
      <input type="text" maxlength="32" placeholder="anonymous engineer" data-act="name" value="${esc(state.settings.playerName || "")}" />
    </label>
    <label class="setting-row">
      <input type="checkbox" data-act="cloud-toggle" ${state.settings.cloudSync ? "checked" : ""}/>
      <span>Облачный автосинк (Firebase)</span>
    </label>
    <h4 class="panel-subtitle">🏆 Top engineers (по lifetime commits)</h4>
    <div data-lb-body class="lb-body"></div>
  `;

  root.addEventListener("click", async (e) => {
    const act = e.target?.dataset?.act;
    if (!act || busy) return;
    const btn = e.target.closest("button");
    if (!btn) return;
    busy = true;
    btn.classList.add("is-busy");
    try {
      if (act === "sync-now") {
        const ok = await pushCloudSave();
        emit(ok ? "cloud:pushed" : "cloud:failed");
      } else if (act === "pull") {
        const res = await pullCloudSave();
        emit(res === "loaded" ? "cloud:pulled" : "cloud:failed", res);
      } else if (act === "refresh-lb") {
        lbRows = await fetchLeaderboard(true);
      } else if (act === "google") {
        await linkGoogle();
        emit("cloud:linked");
        btn.disabled = true;
        btn.textContent = "✓ Google привязан";
        root.querySelector('[data-act="signout"]').disabled = false;
      } else if (act === "signout") {
        await signOutToAnonymous();
        emit("cloud:unlinked");
      }
    } catch (err) {
      emit("cloud:failed", err?.message ?? String(err));
    } finally {
      busy = false;
      btn.classList.remove("is-busy");
      refreshDom();
    }
  });

  root.addEventListener("change", (e) => {
    const act = e.target?.dataset?.act;
    if (act === "cloud-toggle") {
      state.settings.cloudSync = e.target.checked;
      emit("cloud:toggle", e.target.checked);
    } else if (act === "name") {
      state.settings.playerName = String(e.target.value || "").slice(0, 32);
      emit("cloud:name", state.settings.playerName);
    }
  });

  // Первый фоновый запрос списка
  fetchLeaderboard().then((rows) => { lbRows = rows; refreshDom(); });
  refreshDom();
  return root;
}

function emit(type, detail) {
  window.dispatchEvent(new CustomEvent(type, { detail }));
}

export function refreshCloud() {
  refreshDom();
}
