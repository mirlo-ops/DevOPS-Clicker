/**
 * firebase-auth.js — аутентификация игрока (Firebase Auth).
 *
 * Схема: анонимный аккаунт создаётся автоматически (id для облачных сейвов
 * и лидерборда), по желанию игрок «привязывает» его к Google — тогда
 * прогресс не теряется между браузерами.
 */

import { initFirebase } from "./firebase-init.js";

let _auth = null;
let _user = null; // firebase User | null
const _listeners = new Set();

export function notifyListeners() {
  for (const fn of _listeners) {
    try { fn(_user); } catch (e) { console.warn("[auth] listener error:", e); }
  }
}

/** Подписка на изменения пользователя. Возвращает функцию отписки. */
export function onAuthUser(cb) {
  _listeners.add(cb);
  cb(_user);
  return () => _listeners.delete(cb);
}

export const getCurrentUser = () => _user;
export const getUid = () => _user?.uid ?? null;
export const isSignedIn = () => Boolean(_user);
export const hasGoogleProvider = () =>
  Boolean(_user?.providerData?.some((p) => p.providerId === "google.com"));

/**
 * Инициализация auth: ждём текущий сессионный пользователь.
 * При отсутствии — молча пробуем анонимный вход (правила Firestore
 * должны разрешать create для anonymous).
 */
export async function initAuth() {
  const ctx = await initFirebase();
  if (!ctx) return null;
  _auth = ctx.auth;

  await new Promise((resolve) => {
    const unsub = _auth.onAuthStateChanged(async (u) => {
      _user = u;
      if (!_user && !_auth.isSignInPending?.()) {
        try { await _auth.signInAnonymously(); } catch (err) {
          // permission-denied означает, что Anonymous provider выключен —
          // игра продолжает работать локально
          console.warn("[auth] anonymous sign-in failed:", err?.code ?? err);
        }
      }
      notifyListeners();
      unsub();
      resolve();
    }, (err) => {
      console.warn("[auth] state error:", err);
      resolve();
    });
  });
  return _user;
}

/** Привязать Google к анонимному аккаунту (popup). */
export async function linkGoogle() {
  if (!_auth) throw new Error("Firebase недоступен");
  const provider = new window.firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await _auth.signInWithPopup(provider);
  // signInWithPopup заменяет сессию: переносим данные в linked-аккаунт
  _user = result.user;
  notifyListeners();
  return result;
}

/** Выйти из Google-связанного аккаунта → снова анонимный вход */
export async function signOutToAnonymous() {
  if (!_auth) throw new Error("Firebase недоступен");
  await _auth.signOut();
  try { await _auth.signInAnonymously(); } catch { /* останемся гостями */ }
  _user = _auth.currentUser;
  notifyListeners();
}
