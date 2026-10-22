// MP-6 כניסה אחת למערכות מטלפרס: שומר כניסה משותף (Edge Middleware של ורסל). נוצר מ-make.mjs עבור fleet.metalpress.ogensolutions.biz.
// המקור: ~/Idan-HQ/company/metalpress-sso/guard.template.js. לא לערוך את העותק, לערוך את התבנית ולייצר מחדש.
//
// מה הוא עושה בכל בקשה:
//   1. כתובת ישנה (vercel.app) ⟵ הפניה קבועה לכתובת הקנונית, כדי שעוגיית הדומיין תהיה זמינה.
//   2. נכסים (css/js/תמונות) עוברים. כל השאר דורש סשן של המרכז בעוגייה mp-auth (נכתבת על ידי mp-sso.mjs).
//   3. הסשן פג ⟵ רענון מול סופאבייס עם ה-refresh token, כתיבת עוגייה חדשה והפניה לאותה כתובת.
//   4. hub_can_open(host) בסופאבייס: PostgREST מאמת את חתימת ה-JWT, והפונקציה בודקת הרשאה מלאה לכרטיס במרכז.
//      אין סשן ⟵ מסך הכניסה של המרכז וחזרה לכאן. יש סשן בלי כרטיס ⟵ עמוד "אין הרשאה".
export const config = { matcher: ['/((?!favicon\\.ico|favicon\\.svg|robots\\.txt).*)'] };

const HOST = 'fleet.metalpress.ogensolutions.biz';
const SSO_DOMAIN = 'metalpress.ogensolutions.biz';
const HUB = 'https://' + SSO_DOMAIN;
const SB = 'https://mbodppnsdnmlejdldztp.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ib2RwcG5zZG5tbGVqZGxkenRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MzI0MDgsImV4cCI6MjA5MzQwODQwOH0.ekRmetxkiiRmebkAXNUy6sfVIu6T4CWD_w4m37Bd-0Q';
const KEY = 'mp-auth';
const CHUNK = 3000, MAX_CHUNKS = 10, MAX_AGE = 30 * 24 * 3600;
const ASSET = /\.(css|js|mjs|map|png|jpe?g|gif|svg|ico|webp|avif|woff2?|ttf|otf|webmanifest|txt|xml)$/i;

function cookies(req) {
  const o = {};
  for (const p of (req.headers.get('cookie') || '').split(/;\s*/)) { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i)] = p.slice(i + 1); }
  return o;
}
function dec(b64) { try { return decodeURIComponent(escape(atob(b64.replace(/-/g, '+').replace(/_/g, '/')))); } catch { return null; } }
function enc(json) { return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function readSession(c) {
  let raw = c[KEY];
  if (!raw) { raw = ''; for (let i = 0; i < MAX_CHUNKS && c[KEY + '.' + i] !== undefined; i++) raw += c[KEY + '.' + i]; }
  if (!raw) return null;
  try { return JSON.parse(dec(raw)); } catch { return null; }
}
const attrs = (maxAge) => `; Domain=.${SSO_DOMAIN}; Path=/; Max-Age=${maxAge}; Secure; SameSite=Lax`;
function clearCookies() {
  const out = [KEY + '=' + attrs(0)];
  for (let i = 0; i < MAX_CHUNKS; i++) out.push(`${KEY}.${i}=` + attrs(0));
  return out;
}
function sessionCookies(session) {
  const b64 = enc(JSON.stringify(session));
  const out = [];
  if (b64.length <= CHUNK) {
    out.push(KEY + '=' + b64 + attrs(MAX_AGE));
    for (let i = 0; i < MAX_CHUNKS; i++) out.push(`${KEY}.${i}=` + attrs(0));
  } else {
    out.push(KEY + '=' + attrs(0));
    let n = 0;
    for (; n * CHUNK < b64.length; n++) out.push(`${KEY}.${n}=` + b64.slice(n * CHUNK, (n + 1) * CHUNK) + attrs(MAX_AGE));
    for (; n < MAX_CHUNKS; n++) out.push(`${KEY}.${n}=` + attrs(0));
  }
  return out;
}
function jwtSub(t) { try { return JSON.parse(dec(t.split('.')[1])).sub || null; } catch { return null; } }
function withCookies(res, list) { const h = new Headers(res.headers); for (const c of list) h.append('Set-Cookie', c); return new Response(res.body, { status: res.status, headers: h }); }

function page(title, body, status) {
  return new Response(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:-apple-system,"Segoe UI",Heebo,Arial,sans-serif;background:#eef2f7;color:#1b2a41}
.card{background:#fff;border-radius:16px;padding:32px 36px;max-width:440px;box-shadow:0 10px 40px rgba(20,34,58,.12);text-align:center}h1{font-size:20px;margin:0 0 10px}p{margin:0 0 18px;line-height:1.6;color:#4b5a6e}
a{display:inline-block;background:#1b3a5c;color:#fff;text-decoration:none;padding:10px 20px;border-radius:10px;font-weight:600}</style></head>
<body><div class="card"><h1>${title}</h1><p>${body}</p><a href="${HUB}/">למרכז הדשבורדים</a></div></body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

export default async function middleware(req) {
  const url = new URL(req.url);
  if (url.hostname !== HOST && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    url.hostname = HOST; url.protocol = 'https:'; url.port = '';
    return Response.redirect(url.toString(), 308);
  }
  if (ASSET.test(url.pathname)) return;

  const isDoc = req.method === 'GET' && (req.headers.get('accept') || '').includes('text/html');
  const toHub = (why) => {
    if (!isDoc) return new Response(JSON.stringify({ error: why }), { status: 401, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
    return Response.redirect(HUB + '/?next=' + encodeURIComponent(url.toString()) + '&why=' + why, 302);
  };

  const s = readSession(cookies(req));
  if (!s || !s.access_token) return toHub('login');

  const now = Math.floor(Date.now() / 1000);
  if (s.expires_at && s.expires_at < now + 30) {
    if (!s.refresh_token) return withCookies(toHub('expired'), clearCookies());
    const r = await fetch(SB + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: s.refresh_token }),
    });
    if (!r.ok) return withCookies(toHub('expired'), clearCookies());
    const ns = await r.json();
    if (!ns.expires_at) ns.expires_at = now + (ns.expires_in || 3600);
    return new Response(null, { status: 302, headers: [['Location', url.toString()], ...sessionCookies(ns).map((c) => ['Set-Cookie', c])] });
  }

  // שתי בדיקות במקביל, שתיהן עם ה-JWT של המשתמש (PostgREST מאמת את החתימה): הרשאה לכרטיס, ודגל "חובה להחליף סיסמה"
  const H = { apikey: ANON, Authorization: 'Bearer ' + s.access_token, 'content-type': 'application/json' };
  const uid = jwtSub(s.access_token);
  const [ok, prof] = await Promise.all([
    fetch(SB + '/rest/v1/rpc/hub_can_open', { method: 'POST', headers: H, body: JSON.stringify({ p_host: HOST }) }),
    uid ? fetch(SB + '/rest/v1/hub_profiles?select=must_change_password&id=eq.' + uid, { headers: H }) : null,
  ]);
  if (ok.status === 401) return withCookies(toHub('expired'), clearCookies());
  if (!ok.ok) return page('שער הכניסה לא זמין כרגע', 'נסו שוב בעוד רגע (' + ok.status + ').', 503);
  if (prof && prof.ok) {
    const rows = await prof.json();
    if (Array.isArray(rows) && rows[0] && rows[0].must_change_password === true) return isDoc ? Response.redirect(HUB + '/?next=' + encodeURIComponent(url.toString()) + '&why=password', 302) : toHub('password');
  }
  if ((await ok.json()) !== true) return isDoc ? Response.redirect(HUB + '/?next=' + encodeURIComponent(url.toString()) + '&why=denied', 302) : new Response(JSON.stringify({ error: 'denied' }), { status: 403, headers: { 'content-type': 'application/json' } });
  return; // סשן תקין והרשאה לכרטיס: ממשיכים לקובץ
}
