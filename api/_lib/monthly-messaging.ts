/**
 * מנוע השליחה החודשית לנהגים — מחליף את ה-broadcast החוזר של heyy.
 *
 * למה: ה-broadcast של heyy היה קופסה שחורה. ב-1/7/2026 הוא שלח ל-26 מתוך 102
 * נהגים בלבד, ולאף אחד לא הגיעה הודעה — בלי שנדע. כאן השרת עובר על מקור האמת
 * (Supabase), שולח לכל נהג ישירות דרך ה-API של heyy (המסלול שעוקף את בעיית
 * ה-subscribe של broadcasts), ורושם פר-נהג ל-fleet.message_log מה קרה.
 *
 * הקובץ יושב תחת api/_lib/ — קבצים/תיקיות שמתחילים ב-"_" לא הופכים ל-routes
 * ב-Vercel, אז זה מודול משותף לשני ה-endpoints ולא endpoint בעצמו.
 */
import type { VercelRequest } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';
import { sendFailureMail } from './failure-mail.js';

const HEYY_API_KEY = process.env.HEYY_API_KEY;
const HEYY_BASE_URL = process.env.HEYY_BASE_URL || 'https://api.heyy.io/api/v2.0';
const HEYY_CHANNEL_ID = process.env.HEYY_CHANNEL_ID;
const CRON_SECRET = process.env.CRON_SECRET;
const SYNC_SECRET = process.env.HEYY_SYNC_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// תבניות WhatsApp מאושרות (Meta) ב-heyy. ראה GET /message_templates.
export const TEMPLATES = {
  // "מילוי קילומטרז חודשי עם שם" — מחליף את "הודעה בתחילת חודש" (95c9ac60) שהיה
  // בנוי עם טוקן driver_name ריק ולכן יצא "שלום" בלי שם. התבנית החדשה בנויה עם
  // הטוקן #first_name (זהה לתזכורת, מאוכלס מ-drivers.name) ומתקנת שתי שגיאות כתיב
  // (קילומטרז, Metalpress). נוצרה ונשלחה לאישור Meta ב-2/8/2026.
  month_open: '1c32ab60-406d-4712-bf41-96583f67510b', // "מילוי קילומטרז חודשי עם שם"
  reminder: '9224835e-e2a8-4818-b7ff-18250db2fac0', // "תזכורת"
} as const;

export type MessageKind = 'month_open' | 'reminder';

// נהגים/רכבים "מדומים" שאסור לשלוח אליהם — חשבונות הוצאה וסטטוסים לא-נהג.
// זהה לסינון ב-useFleetData: model='שוטף' (overhead), driverName 'מלאי'/'מושבת'.
const EXCLUDED_MODELS = new Set(['שוטף']);
const EXCLUDED_DRIVER_NAMES = new Set(['מלאי', 'מושבת']);

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/** אימות: Bearer CRON_SECRET (Vercel מוסיף לקרונים) או x-sync-secret (ידני). */
export function isAuthorized(req: VercelRequest): boolean {
  const auth = req.headers.authorization;
  if (CRON_SECRET && typeof auth === 'string' && safeCompare(auth, `Bearer ${CRON_SECRET}`)) {
    return true;
  }
  const syncHeader = req.headers['x-sync-secret'];
  if (SYNC_SECRET && typeof syncHeader === 'string' && safeCompare(syncHeader, SYNC_SECRET)) {
    return true;
  }
  return false;
}

export function envReady(): string | null {
  if (!SUPABASE_URL || !SERVICE_KEY) return 'Supabase env missing';
  if (!HEYY_API_KEY || !HEYY_CHANNEL_ID) return 'heyy env missing';
  return null;
}

export function getSupabase() {
  return createClient(SUPABASE_URL as string, SERVICE_KEY as string, {
    db: { schema: 'fleet' },
    auth: { persistSession: false },
  });
}

type FleetDB = ReturnType<typeof getSupabase>;

/**
 * חודש הדיווח = החודש הקודם (1-based). נהגים מדווחים בתחילת חודש על החודש שעבר.
 * זהה ל-previousMonth() ב-heyy-webhook וללוגיקת החודשים ב-useFleetData.
 */
export function reportingPeriod(now = new Date()): { year: number; month: number } {
  const m = now.getMonth(); // 0-based → זה כבר החודש הקודם ב-1-based
  const y = now.getFullYear();
  return { year: m === 0 ? y - 1 : y, month: m === 0 ? 12 : m };
}

/** טלפון מקומי (0542424185) או בינלאומי → E.164 (+972542424185). */
export function toE164(phone: string): string | null {
  let d = String(phone).replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('972')) return '+' + d;
  if (d.startsWith('0')) d = d.slice(1);
  return '+972' + d;
}

export interface RecipientVehicle {
  id: number;
  startDate: string | null; // תחילת השירות ברכב (vehicles.start_date)
}

export interface Recipient {
  driverId: number;
  driverName: string;
  phone: string; // E.164
  vehicleId: number; // רכב מייצג (הראשון)
  plate: string;
  vehicles: RecipientVehicle[]; // כל הרכבים של הנהג
}

/**
 * האם הרכב היה בשירות בחודש הדיווח. רכב שנכנס אחרי סוף אותו חודש לא חייב דיווח
 * עליו, ואי אפשר לדווח עליו רטרואקטיבית.
 * זהה ל-isApplicableForMonth ב-src/lib/analytics.ts (הדשבורד), שלא היה בשרת.
 */
export function isApplicableForMonth(
  startDate: string | null,
  year: number,
  month: number,
): boolean {
  if (!startDate) return true;
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return true;
  // month הוא 1-based, ולכן Date.UTC(y, month, 0) הוא היום האחרון של אותו חודש.
  return start.getTime() <= Date.UTC(year, month, 0, 23, 59, 59, 999);
}

/** כל הנהגים הפעילים שאמורים לדווח ק"מ (deduped פר-נהג). */
export async function loadRecipients(supabase: FleetDB): Promise<Recipient[]> {
  const [{ data: vehicles, error: vErr }, { data: drivers, error: dErr }] = await Promise.all([
    supabase
      .from('vehicles')
      .select('id, plate_number, model, current_driver_id, start_date')
      .eq('is_active', true)
      .eq('is_inventory', false)
      .not('current_driver_id', 'is', null),
    supabase.from('drivers').select('id, name, phone'),
  ]);
  if (vErr) throw new Error(`load vehicles: ${vErr.message}`);
  if (dErr) throw new Error(`load drivers: ${dErr.message}`);

  const driverById = new Map<number, { id: number; name: string; phone: string | null }>();
  for (const d of drivers ?? []) driverById.set(d.id, d);

  const byDriver = new Map<number, Recipient>();
  for (const v of vehicles ?? []) {
    if (EXCLUDED_MODELS.has((v.model ?? '').trim())) continue;
    const drv = driverById.get(v.current_driver_id);
    if (!drv) continue;
    const name = (drv.name ?? '').trim();
    if (EXCLUDED_DRIVER_NAMES.has(name)) continue;
    const e164 = drv.phone ? toE164(drv.phone) : null;
    if (!e164) continue;

    const existing = byDriver.get(drv.id);
    const entry: RecipientVehicle = { id: v.id, startDate: v.start_date ?? null };
    if (existing) {
      existing.vehicles.push(entry);
    } else {
      byDriver.set(drv.id, {
        driverId: drv.id,
        driverName: name,
        phone: e164,
        vehicleId: v.id,
        plate: v.plate_number ?? '',
        vehicles: [entry],
      });
    }
  }
  return [...byDriver.values()];
}

export interface PeriodReports {
  /** רכבים שיש להם דיווח ק"מ אמיתי (mileage>0) לתקופה. */
  vehicleIds: Set<number>;
  /**
   * הרכבים שדווחו בתקופה, מקובצים לפי הנהג שרשום על הדיווח.
   * זה מה שמאפשר לזהות דיווח שנעשה על רכב שהנהג כבר לא נוהג בו (החלפת רכב).
   */
  vehicleIdsByDriver: Map<number, Set<number>>;
}

/** מה כבר דווח בתקופה, לפי רכב ולפי נהג. */
export async function loadPeriodReports(
  supabase: FleetDB,
  year: number,
  month: number,
): Promise<PeriodReports> {
  const { data, error } = await supabase
    .from('monthly_reports')
    .select('vehicle_id, driver_id')
    .eq('report_year', year)
    .eq('report_month', month)
    .gt('mileage', 0);
  if (error) throw new Error(`load reported: ${error.message}`);

  const vehicleIds = new Set<number>();
  const vehicleIdsByDriver = new Map<number, Set<number>>();
  for (const r of data ?? []) {
    vehicleIds.add(r.vehicle_id);
    if (r.driver_id == null) continue;
    const set = vehicleIdsByDriver.get(r.driver_id) ?? new Set<number>();
    set.add(r.vehicle_id);
    vehicleIdsByDriver.set(r.driver_id, set);
  }
  return { vehicleIds, vehicleIdsByDriver };
}

/**
 * האם הנהג עדיין חייב דיווח לתקופה.
 *
 * 🔴 הכלל: החוב הוא של הנהג, לא של הרכב שרשום עליו ברגע הבדיקה.
 * הבדיקה הישנה שאלה "האם לרכב הנוכחי יש דיווח", ולכן שני מצבים ייצרו תזכורת שקרית
 * (נמדד ב-15/8/2026: 4 מתוך 29 נהגים, איריס שרביט רז חודשיים ברצף):
 *   1. החלפת רכב — הדיווח יושב על הרכב הישן, שהסנכרון מפריוריטי כבר ניתק מהנהג,
 *      ולכן הוא נעלם מהחישוב. לכן סופרים גם דיווחים שרשומים על שם הנהג.
 *   2. רכב חדש — רכב שהתקבל אחרי סוף חודש הדיווח מעולם לא יכול היה להיות מדווח.
 *      לכן הוא לא נספר בכלל.
 */
export function needsReminder(r: Recipient, year: number, month: number, reports: PeriodReports): boolean {
  const applicable = r.vehicles.filter((v) => isApplicableForMonth(v.startDate, year, month));
  if (applicable.length === 0) return false;

  // דיווחי הנהג לתקופה: לפי שיוך הדיווח, ובנוסף לפי הרכבים שרשומים עליו עכשיו
  // (רשת ביטחון לשורות היסטוריות שבהן driver_id ריק).
  const filed = new Set(reports.vehicleIdsByDriver.get(r.driverId) ?? []);
  for (const v of applicable) if (reports.vehicleIds.has(v.id)) filed.add(v.id);

  return filed.size < applicable.length;
}

export interface SendResult {
  ok: boolean;
  heyyMessageId: string | null;
  status: string | null;
  error: string | null;
}

/**
 * 🔴 מגבלת הקצב של heyy: 100 בקשות לדקה לכל הדייר (חלון קבוע), גם כשלים נספרים,
 * והמונה משותף לכל הערוצים והנתיבים (גם הוובהוק שעונה לנהגים בזמן אמת).
 * ב-1/9/2026 יצאו 99 הודעות ב-46 שניות, והחמש האחרונות (בהן איריס שרביט רז)
 * נדחו ב-429 "Too many requests" בלי שאיש ידע. לכן:
 *   1. ריווח קבוע בין שליחות (SEND_SPACING_MS) שמשאיר מקום לתעבורת הוובהוק.
 *   2. על 429 ממתינים עד x-ratelimit-reset ומנסים שוב (עד MAX_RATE_RETRIES).
 */
const SEND_SPACING_MS = 1000; // ≤60 שליחות לדקה, 40 נשארות לוובהוק ולשאר
const MAX_RATE_RETRIES = 2;
const MAX_RATE_WAIT_MS = 70_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** כמה להמתין אחרי 429: עד חותמת ה-reset של heyy (שניות יוניקס), עם רצפה ותקרה. */
function rateLimitWaitMs(r: Response): number {
  const reset = Number(r.headers.get('x-ratelimit-reset'));
  const retryAfter = Number(r.headers.get('retry-after'));
  let ms = 0;
  if (Number.isFinite(reset) && reset > 0) ms = reset * 1000 - Date.now() + 1500;
  else if (Number.isFinite(retryAfter) && retryAfter > 0) ms = retryAfter * 1000;
  if (!(ms > 0)) ms = 61_000;
  return Math.min(ms, MAX_RATE_WAIT_MS);
}

/** שולח תבנית WhatsApp לנהג דרך heyy. PENDING עם body ריק = הצלחה (שליחה אסינכרונית). */
export async function sendTemplate(
  phoneE164: string,
  templateId: string,
  onRateLimit?: (waitMs: number) => void,
): Promise<SendResult> {
  for (let attempt = 0; ; attempt++) {
    const result = await sendTemplateOnce(phoneE164, templateId);
    if (!result.rateLimited || attempt >= MAX_RATE_RETRIES) return result;
    onRateLimit?.(result.waitMs);
    await sleep(result.waitMs);
  }
}

type SendAttempt = SendResult & { rateLimited: boolean; waitMs: number };

async function sendTemplateOnce(phoneE164: string, templateId: string): Promise<SendAttempt> {
  const plain = (r: SendResult): SendAttempt => ({ ...r, rateLimited: false, waitMs: 0 });
  try {
    const r = await fetch(`${HEYY_BASE_URL}/${HEYY_CHANNEL_ID}/whatsapp_messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HEYY_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        phoneNumber: phoneE164,
        type: 'TEMPLATE',
        messageTemplateId: templateId,
        variables: [],
      }),
    });
    const body = (await r.json().catch(() => null)) as
      | { success?: boolean; data?: { id?: string; waMessageId?: string; status?: string; errors?: unknown[] }; error?: { message?: string } }
      | null;
    if (r.status === 429) {
      const msg = body?.error?.message || 'HTTP 429';
      return { ok: false, heyyMessageId: null, status: null, error: msg, rateLimited: true, waitMs: rateLimitWaitMs(r) };
    }
    if (!r.ok || body?.success === false) {
      const msg = body?.error?.message || `HTTP ${r.status}`;
      return plain({ ok: false, heyyMessageId: null, status: null, error: msg });
    }
    const data = body?.data ?? {};
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return plain({ ok: false, heyyMessageId: null, status: data.status ?? null, error: JSON.stringify(data.errors).slice(0, 400) });
    }
    return plain({
      ok: true,
      heyyMessageId: data.waMessageId || data.id || null,
      status: data.status ?? null,
      error: null,
    });
  } catch (e) {
    return plain({ ok: false, heyyMessageId: null, status: null, error: e instanceof Error ? e.message : String(e) });
  }
}

export interface RunSummary {
  kind: MessageKind;
  year: number;
  month: number;
  recipients: number;
  targeted: number;
  sent: number;
  failed: number;
  skipped: number;
  failures: Array<{ driver: string; phone: string; error: string }>;
  /** כמה פעמים heyy החזיר 429 והמתנו ל-reset (אמור להיות 0 בזכות הריווח). */
  rateLimitWaits: number;
  /** האם יצא מייל כשל לאיריס (רק כש-failed > 0). */
  failureMailSent?: boolean;
  dryRun?: boolean;
  wouldSend?: Array<{ driver: string; phone: string }>;
}

/**
 * הריצה המרכזית: שולח לכל הנהגים הרלוונטיים ורושם ל-message_log.
 * אידמפוטנטי — נהג עם שורה 'accepted' לתקופה+kind מדולג, אז אפשר להריץ שוב בבטחה.
 *
 * dryRun=true מחשב את רשימת היעד ומחזיר אותה בלי לשלוח הודעה ובלי לכתוב ליומן.
 * זה מה שמאפשר לאמת שינוי בלוגיקת המיקוד על נתוני אמת בלי להתיז וואטסאפ לנהגים.
 */
export async function runMonthlySend(
  kind: MessageKind,
  now = new Date(),
  dryRun = false,
  /** להודעת תחילת החודש בלבד: לצמצם למי שעדיין חייב דיווח (הרצה חוזרת אחרי כשל חלקי). */
  onlyUnreported = false,
): Promise<RunSummary> {
  const supabase = getSupabase();
  const { year, month } = reportingPeriod(now);
  const startedAt = now.toISOString();
  const templateId = TEMPLATES[kind];

  const allRecipients = await loadRecipients(supabase);

  // תזכורת נשלחת רק לנהגים שעדיין חייבים דיווח לתקופה. ראה needsReminder.
  let targets = allRecipients;
  if (kind === 'reminder' || onlyUnreported) {
    const reports = await loadPeriodReports(supabase, year, month);
    targets = allRecipients.filter((r) => needsReminder(r, year, month, reports));
  }

  // דילוג על נהגים שכבר קיבלו בהצלחה את ההודעה הזו החודש.
  const { data: existing } = await supabase
    .from('message_log')
    .select('driver_id, send_status')
    .eq('report_year', year)
    .eq('report_month', month)
    .eq('kind', kind);
  const accepted = new Set((existing ?? []).filter((e) => e.send_status === 'accepted').map((e) => e.driver_id));

  const toSend = targets.filter((r) => !accepted.has(r.driverId));

  if (dryRun) {
    return {
      kind,
      year,
      month,
      recipients: allRecipients.length,
      targeted: targets.length,
      sent: 0,
      failed: 0,
      skipped: targets.length - toSend.length,
      failures: [],
      rateLimitWaits: 0,
      dryRun: true,
      wouldSend: toSend.map((r) => ({ driver: r.driverName, phone: r.phone })),
    };
  }

  let sent = 0;
  let failed = 0;
  let rateLimitWaits = 0;
  const failures: RunSummary['failures'] = [];

  for (const [i, r] of toSend.entries()) {
    // ריווח קבוע בין שליחות. 99 נהגים ≈ 100 שניות, בתוך maxDuration של הפונקציה (vercel.json).
    if (i > 0) await sleep(SEND_SPACING_MS);
    const result = await sendTemplate(r.phone, templateId, (waitMs) => {
      rateLimitWaits++;
      console.warn(`heyy 429 for ${r.driverName}, waiting ${Math.round(waitMs / 1000)}s`);
    });
    if (result.ok) sent++;
    else {
      failed++;
      failures.push({ driver: r.driverName, phone: r.phone, error: result.error ?? 'unknown' });
    }

    // upsert לשורת היומן על מפתח (year,month,driver,kind).
    const { error: upErr } = await supabase.from('message_log').upsert(
      {
        kind,
        report_year: year,
        report_month: month,
        driver_id: r.driverId,
        vehicle_id: r.vehicleId,
        driver_name: r.driverName,
        phone: r.phone,
        template_id: templateId,
        send_status: result.ok ? 'accepted' : 'failed',
        heyy_message_id: result.heyyMessageId,
        error: result.error,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'report_year,report_month,driver_id,kind' },
    );
    if (upErr) console.error(`message_log upsert failed for ${r.driverName}:`, upErr.message);
  }

  const summary: RunSummary = {
    kind,
    year,
    month,
    recipients: allRecipients.length,
    targeted: targets.length,
    sent,
    failed,
    skipped: targets.length - toSend.length,
    failures,
    rateLimitWaits,
  };

  // כשל שנשאר אחרי הניסיון החוזר → מייל לאיריס (ולעידן). ביום תקין לא יוצא מייל.
  if (failed > 0) {
    const mail = await sendFailureMail(summary);
    if (!mail.ok) console.error('failure mail not sent:', mail.error);
    summary.failureMailSent = mail.ok;
  }

  // רישום לסיכום הסנכרון — לניטור ולמייל הבריאות.
  await supabase.from('sync_log').insert({
    source: `monthly_${kind}`,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    success: failed === 0,
    records_total: targets.length,
    records_updated: sent,
    records_failed: failed,
    metadata: summary,
  });

  return summary;
}
