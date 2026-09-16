/**
 * מייל כשל לשליחה החודשית, לאיריס (ולעידן), רק כשיש כשלים אחרי הניסיון החוזר.
 *
 * למה: ב-1/9/2026 חמישה נהגים לא קיבלו את ההודעה החודשית (429 מ-heyy). הכשל נרשם
 * ביומן ובלוג הסנכרון ואיש לא ראה, עד שאיריס שאלה שבוע אחר כך. עידן (8/9/2026):
 * "אם יש כשל לשלוח מייל לאיריס". ביום תקין לא יוצא מייל.
 *
 * הובלה: וובהוק במייק (סנריו "עוגן — שליחת מייל מערכת", hook 2815862) → ג'ימייל.
 * הערכה: api/_lib/emailkit.ts (עותק של company/email-kit/emailkit.ts).
 */
import { render, p, table, esc, FLAME } from './emailkit.js';
import type { RunSummary } from './monthly-messaging.js';

const MAIL_WEBHOOK_URL =
  process.env.MAIL_WEBHOOK_URL || 'https://hook.us1.make.com/q03exyxcibffnuvzm2hbyxuj1h22oitl';
const FAILURE_MAIL_TO = process.env.FAILURE_MAIL_TO || 'iris@metalpress.co.il,idan@ogensolutions.biz';
const DASHBOARD_URL = 'https://metalpress-fleet.vercel.app';

const KIND_LABEL: Record<RunSummary['kind'], string> = {
  month_open: 'הודעת תחילת החודש',
  reminder: 'תזכורת הק"מ',
};

const HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

export function buildFailureMail(s: RunSummary): { subject: string; html: string } {
  const label = KIND_LABEL[s.kind];
  const period = `${HE_MONTHS[s.month - 1]} ${s.year}`;
  const subject = `⚠️ ${label} לא הגיעה ל-${s.failed} נהגים · דיווח ${period}`;
  const body =
    p(`${esc(label)} לדיווח על ${esc(period)} יצאה ל-${s.sent} נהגים, ו-${s.failed} לא קיבלו אותה גם אחרי ניסיון חוזר. אלה הנהגים, כדי שתדעו מי לא קיבל ואפשר יהיה לפנות אליהם בדרך אחרת:`) +
    table(
      ['נהג', 'טלפון', 'שגיאה'],
      s.failures.map((f) => [esc(f.driver), `<span dir="ltr">${esc(f.phone)}</span>`, `<span dir="ltr" style="font-size:12px">${esc(f.error)}</span>`]),
      ['right', 'left', 'left'],
    );
  const html = render({
    title: `${label} לא הגיעה ל-${s.failed} נהגים`,
    preheader: `${label}: ${s.failed} נהגים לא קיבלו, ${s.sent} קיבלו`,
    intro: '',
    body,
    tiles: [
      [String(s.sent), 'קיבלו'],
      [String(s.failed), 'לא קיבלו', FLAME],
      [String(s.targeted), 'ברשימה'],
    ],
    cta: ['לפתוח את מעקב ההודעות', `${DASHBOARD_URL}`],
    note: 'הרשימה המלאה פר נהג, מי קיבל ומי לא, יושבת בדשבורד בדף "מעקב הודעות". אם אותה שגיאה חוזרת על כמה נהגים, זו תקלה בערוץ ולא בנהג, ואנחנו מטפלים.',
    system: 'צי רכב',
    client: 'מטלפרס',
  });
  return { subject, html };
}

/** שולח את מייל הכשל דרך הוובהוק. לא זורק: כשל במייל לא אמור להפיל את סיכום הריצה. */
export async function sendFailureMail(s: RunSummary): Promise<{ ok: boolean; error: string | null }> {
  if (s.failed === 0 || s.dryRun) return { ok: true, error: null };
  const { subject, html } = buildFailureMail(s);
  try {
    const r = await fetch(MAIL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: FAILURE_MAIL_TO, subject, html }),
    });
    if (!r.ok) return { ok: false, error: `mail webhook HTTP ${r.status}` };
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
