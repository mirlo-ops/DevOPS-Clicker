/**
 * storage.js — обёртка над localStorage с защитой от исключений
 * (приватный режим браузера, переполнение квоты и т.п.).
 */

export const storageGet = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    console.warn("[storage] getItem failed:", err);
    return null;
  }
};

export const storageSet = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn("[storage] setItem failed:", err);
    return false;
  }
};

export const storageRemove = (key) => {
  try {
    window.localStorage.removeItem(key);
  } catch (err) {
    console.warn("[storage] removeItem failed:", err);
  }
};

/** Безопасный JSON.parse: вместо исключения вернёт null */
export const jsonParseSafe = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};
