// ערכת המייל של עוגן סולושנס, גרסת TypeScript/ESM לפונקציות קצה (Deno/Supabase) ול-Node.
// אותו מבנה בדיוק כמו emailkit.py: כרטיס לבן על רקע המותג, פס כחול, כותרת, אריחים, שורות
// עם תגית, כפתור ופוטר. טבלאות ו-CSS בתוך התגיות, רוחב 600, RTL. לוגו מכתובת מארחת.
// עותק זהה יושב ב-supabase/functions/_shared/emailkit.ts של כל פרויקט שמשתמש בו; המקור כאן.

export const PAPER = '#f4f1ea';
export const INK = '#0e0f13';
export const SIGNAL = '#1452ff';
export const FLAME = '#ff3b1d';
export const MUTED = '#6b7280';
export const LINE = '#e6e1d6';
export const LOGO = 'https://ogensolutions.vercel.app/img/ogen-mascot.png';
export const FONT = "'Assistant','Heebo',Arial,Helvetica,sans-serif";
export const DISPLAY = "'Frank Ruhl Libre',Georgia,'Times New Roman',serif";

export type Tile = [string, string, string?];
export type Row = { mk: string; title: string; meta: string; pill?: [string, string, string] };
export type Spec = {
  title: string; intro: string; tiles?: Tile[]; rows?: Row[]; cta?: [string, string] | null;
  note?: string; system?: string; client?: string; preheader?: string; body?: string;
};

export function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/—/g, '-').replace(/–/g, '-');
}

function tiles(t: Tile[] = []): string {
  if (!t.length) return '';
  const w = Math.floor(100 / t.length);
  const cells = t.map(([v, lab, color]) =>
    `<td width="${w}%" style="padding:0 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};border-radius:12px"><tr><td style="padding:14px 12px;text-align:center">` +
    `<div style="font-family:${DISPLAY};font-size:26px;font-weight:700;color:${color || INK};line-height:1.1">${esc(v)}</div>` +
    `<div style="font-family:${FONT};font-size:12px;color:${MUTED};margin-top:4px">${esc(lab)}</div></td></tr></table></td>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="margin:18px 0 6px"><tr>${cells}</tr></table>`;
}

function rows(r: Row[] = []): string {
  if (!r.length) return '';
  const out = r.map((x) => {
    const pill = x.pill ? `<span style="display:inline-block;background:${x.pill[1]};color:${x.pill[2]};font-family:${FONT};font-size:11.5px;font-weight:700;padding:3px 10px;border-radius:999px;white-space:nowrap">${esc(x.pill[0])}</span>` : '';
    return `<tr><td style="padding:12px 0;border-top:1px solid ${LINE}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="rtl"><tr>` +
      `<td style="vertical-align:top"><div style="font-family:${FONT};font-size:14.5px;color:${INK};font-weight:600;line-height:1.4">` +
      `<span dir="ltr" style="font-family:Menlo,Consolas,monospace;font-size:13px;color:${SIGNAL};font-weight:700">${esc(x.mk)}</span> &nbsp;${esc(x.title)}</div>` +
      `<div style="font-family:${FONT};font-size:12.5px;color:${MUTED};margin-top:3px">${x.meta}</div></td>` +
      `<td width="90" style="vertical-align:top;text-align:left;padding-inline-start:10px">${pill}</td></tr></table></td></tr>`;
  }).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="margin-top:10px">${out}</table>`;
}

function button(text: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" dir="rtl" style="margin:22px 0 6px"><tr><td style="background:${SIGNAL};border-radius:999px">` +
    `<a href="${href}" style="display:inline-block;padding:12px 26px;font-family:${FONT};font-size:14.5px;font-weight:700;color:#ffffff;text-decoration:none">${esc(text)}</a></td></tr></table>`;
}

/** פסקה בסגנון הערכה, לשימוש בתוך intro כשבונים גוף חופשי. */
export function p(html: string): string {
  return `<p style="margin:0 0 10px;font-family:${FONT};font-size:14.5px;color:#3d4a63;line-height:1.6">${html}</p>`;
}

/** טבלה נתונים בסגנון הערכה (כותרות נייבי, שורות דקות). headers: מחרוזות; rows: מערכי תאים (HTML מותר). */
export function table(headers: string[], body: (string | number)[][], align: ('right' | 'left' | 'center')[] = []): string {
  const th = headers.map((h, i) => `<th style="padding:7px 10px;text-align:${align[i] || 'right'};font-family:${FONT};font-size:12.5px;font-weight:600;color:#fff;background:#14223a;white-space:nowrap">${esc(h)}</th>`).join('');
  const tr = body.map((r) => `<tr>${r.map((c, i) => `<td style="padding:6px 10px;border-bottom:1px solid ${LINE};font-family:${FONT};font-size:13px;color:${INK};text-align:${align[i] || 'right'}">${c}</td>`).join('')}</tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="border-collapse:collapse;margin:12px 0"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

export function render(s: Spec): string {
  const note = s.note ? `<div style="font-family:${FONT};font-size:12.5px;color:${MUTED};line-height:1.6;margin-top:16px;border-top:1px solid ${LINE};padding-top:14px">${s.note}</div>` : '';
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(s.title)}</title>
<style>@media only screen and (max-width:620px){.wrap{width:100%!important}.pad{padding:22px 18px!important}}</style>
</head><body style="margin:0;padding:0;background:${PAPER}">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:${PAPER}">${esc(s.preheader || s.intro.replace(/<[^>]+>/g, ''))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" dir="rtl" style="width:600px;max-width:100%">
 <tr><td style="padding:0 6px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="rtl"><tr>
   <td style="vertical-align:middle"><img src="${LOGO}" width="36" height="36" alt="עוגן סולושנס" style="display:inline-block;vertical-align:middle;border-radius:9px">
    <span style="font-family:${FONT};font-size:13px;color:${INK};font-weight:700;vertical-align:middle;margin-inline-start:8px">עוגן סולושנס</span>
    <span style="font-family:${FONT};font-size:12.5px;color:${MUTED};vertical-align:middle">&nbsp;· ${esc(s.system || '')}</span></td>
   <td style="text-align:left;vertical-align:middle;font-family:${FONT};font-size:12px;color:${MUTED}">${esc(s.client || '')}</td>
  </tr></table></td></tr>
 <tr><td style="background:#ffffff;border-radius:16px;overflow:hidden">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:5px;background:${SIGNAL};font-size:0;line-height:0">&nbsp;</td></tr></table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="rtl"><tr><td class="pad" style="padding:28px 30px 26px">
   <div style="font-family:${DISPLAY};font-size:26px;font-weight:700;color:${INK};line-height:1.25">${esc(s.title)}</div>
   <div style="font-family:${FONT};font-size:15px;color:#3d4a63;line-height:1.6;margin-top:10px">${s.intro}</div>
   ${tiles(s.tiles)}${s.body || ''}${rows(s.rows)}${s.cta ? button(s.cta[0], s.cta[1]) : ''}${note}
  </td></tr></table></td></tr>
 <tr><td style="padding:16px 8px 0;text-align:center;font-family:${FONT};font-size:12px;color:${MUTED};line-height:1.7">
  מייל מערכת של עוגן סולושנס · <a href="https://ogensolutions.biz" style="color:${MUTED}">ogensolutions.biz</a> · 052-369-4547<br>
  נשלח אוטומטית. אפשר להשיב למייל הזה ואנחנו נראה את התשובה.</td></tr>
</table></td></tr></table></body></html>`;
}
