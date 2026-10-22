// MP-6 כניסה אחת למערכות מטלפרס (22/10/2026).
// מודול משותף לדפדפן: שומר את הסשן של סופאבייס בעוגייה על הדומיין metalpress.ogensolutions.biz,
// כך שהמרכז, טופס 10, גורמי מקצוע וצי רכב חולקים כניסה אחת. מחוץ לדומיין (למשל כתובת vercel.app
// ישנה או localhost) נופלים חזרה ל-localStorage, ושום דבר לא נשבר.
// העתק אחד לכל מערכת (hub/crm/fleet מייבאות את ה-ESM, טופס 10 מקבל את גרסת ה-IIFE מ-make.mjs).
// המקור היחיד: ~/Idan-HQ/company/metalpress-sso/mp-sso.mjs. לא לערוך עותקים.

export const SSO_DOMAIN = 'metalpress.ogensolutions.biz';
export const HUB_URL = 'https://' + SSO_DOMAIN;
export const STORAGE_KEY = 'mp-auth';
const CHUNK = 3000;                 // עוגייה בודדת עד 4KB; הסשן בבסיס 64 הוא 4-5KB, ולכן נחתך לשניים
const MAX_AGE = 30 * 24 * 3600;     // העוגייה עצמה; תוקף הסשן נקבע בסופאבייס (פקיעה אחרי חוסר פעילות)
const MAX_CHUNKS = 10;

export function onSsoDomain() {
  const h = typeof location !== 'undefined' ? location.hostname : '';
  return h === SSO_DOMAIN || h.endsWith('.' + SSO_DOMAIN);
}

function readCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name.replace(/[.$]/g, '\\$&') + '=([^;]*)'));
  return m ? m[1] : null;
}
function writeCookie(name, value, maxAge) {
  document.cookie = name + '=' + value + '; Domain=.' + SSO_DOMAIN + '; Path=/; Max-Age=' + maxAge + '; Secure; SameSite=Lax';
}
// בסיס 64 בטוח לעוגייה (בלי = + /), כמו @supabase/ssr
function enc(json) {
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function dec(b64) {
  try { return decodeURIComponent(escape(atob(b64.replace(/-/g, '+').replace(/_/g, '/')))); } catch { return null; }
}

export function readSession() {
  let raw = readCookie(STORAGE_KEY);
  if (!raw) {
    raw = '';
    for (let i = 0; i < MAX_CHUNKS; i++) { const c = readCookie(STORAGE_KEY + '.' + i); if (c === null) break; raw += c; }
  }
  return raw ? dec(raw) : null;
}
export function clearSession() {
  writeCookie(STORAGE_KEY, '', 0);
  for (let i = 0; i < MAX_CHUNKS; i++) writeCookie(STORAGE_KEY + '.' + i, '', 0);
}
function writeSession(json) {
  const b64 = enc(json);
  clearSession();
  if (b64.length <= CHUNK) { writeCookie(STORAGE_KEY, b64, MAX_AGE); return; }
  for (let i = 0; i * CHUNK < b64.length; i++) writeCookie(STORAGE_KEY + '.' + i, b64.slice(i * CHUNK, (i + 1) * CHUNK), MAX_AGE);
}

// מתאם אחסון לסופאבייס: המפתח הראשי בעוגיית הדומיין, כל השאר (code verifier וכד') ב-localStorage
export const storage = {
  getItem(k) { return k === STORAGE_KEY && onSsoDomain() ? readSession() : localStorage.getItem(k); },
  setItem(k, v) { if (k === STORAGE_KEY && onSsoDomain()) writeSession(v); else localStorage.setItem(k, v); },
  removeItem(k) { if (k === STORAGE_KEY && onSsoDomain()) clearSession(); else localStorage.removeItem(k); },
};

// להעביר ל-createClient(url, key, { auth: authOptions })
export const authOptions = { storage, storageKey: STORAGE_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false };

// כתובת חזרה בטוחה: רק https תחת הדומיין שלנו
export function safeNext(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol === 'https:' && (u.hostname === SSO_DOMAIN || u.hostname.endsWith('.' + SSO_DOMAIN))) return u.href;
  } catch { /* לא כתובת */ }
  return null;
}

// אין כניסה: למסך הכניסה של המרכז, ובחזרה לכאן אחרי הכניסה
export function goToHub(why) {
  const here = location.href;
  const q = '?next=' + encodeURIComponent(here) + (why ? '&why=' + encodeURIComponent(why) : '');
  location.replace(HUB_URL + '/' + q);
}

// יציאה מכולן: הסשן בסופאבייס נסגר בכל המכשירים, והעוגייה נמחקת
export async function signOutEverywhere(sb) {
  try { await sb.auth.signOut({ scope: 'global' }); } catch { /* גם אם הרשת נפלה, מוחקים מקומית */ }
  clearSession();
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ריק */ }
}
