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

const HEYY_API_KEY = process.env.HEYY_API_KEY;
const HEYY_BASE_URL = process.env.HEYY_BASE_URL || 'https://api.heyy.io/api/v2.0';
const HEYY_CHANNEL_ID = process.env.HEYY_CHANNEL_ID;
const CRON_SECRET = process.env.CRON_SECRET;
const SYNC_SECRET = process.env.HEYY_SYNC_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// תבניות WhatsApp מאושרות (Meta) ב-heyy. ראה GET /message_templates.
export const TEMPLATES = {
  month_open: '95c9ac60-e944-49ae-a821-df83239501c4', // "הודעה בתחילת חודש"
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

export interface Recipient {
  driverId: number;
  driverName: string;
  phone: string; // E.164
  vehicleId: number; // רכב מייצג (הראשון)
  plate: string;
  vehicleIds: number[]; // כל הרכבים של הנהג
}

/** כל הנהגים הפעילים שאמורים לדווח ק"מ (deduped פר-נהג). */
export async function loadRecipients(supabase: FleetDB): Promise<Recipient[]> {
  const [{ data: vehicles, error: vErr }, { data: drivers, error: dErr }] = await Promise.all([
    supabase
      .from('vehicles')
      .select('id, plate_number, model, current_driver_id')
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
    if (existing) {
      existing.vehicleIds.push(v.id);
    } else {
      byDriver.set(drv.id, {
        driverId: drv.id,
        driverName: name,
        phone: e164,
        vehicleId: v.id,
        plate: v.plate_number ?? '',
        vehicleIds: [v.id],
      });
    }
  }
  return [...byDriver.values()];
}

/** vehicle_ids שכבר יש להם דיווח ק"מ אמיתי (mileage>0) לתקופה. */
export async function loadReportedVehicleIds(
  supabase: FleetDB,
  year: number,
  month: number,
): Promise<Set<number>> {
  const { data, error } = await supabase
    .from('monthly_reports')
    .select('vehicle_id')
    .eq('report_year', year)
    .eq('report_month', month)
    .gt('mileage', 0);
  if (error) throw new Error(`load reported: ${error.message}`);
  return new Set((data ?? []).map((r) => r.vehicle_id));
}

export interface SendResult {
  ok: boolean;
  heyyMessageId: string | null;
  status: string | null;
  error: string | null;
}

/** שולח תבנית WhatsApp לנהג דרך heyy. PENDING עם body ריק = הצלחה (שליחה אסינכרונית). */
export async function sendTemplate(phoneE164: string, templateId: string): Promise<SendResult> {
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
    if (!r.ok || body?.success === false) {
      const msg = body?.error?.message || `HTTP ${r.status}`;
      return { ok: false, heyyMessageId: null, status: null, error: msg };
    }
    const data = body?.data ?? {};
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return { ok: false, heyyMessageId: null, status: data.status ?? null, error: JSON.stringify(data.errors).slice(0, 400) };
    }
    return {
      ok: true,
      heyyMessageId: data.waMessageId || data.id || null,
      status: data.status ?? null,
      error: null,
    };
  } catch (e) {
    return { ok: false, heyyMessageId: null, status: null, error: e instanceof Error ? e.message : String(e) };
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
}

/**
 * הריצה המרכזית: שולח לכל הנהגים הרלוונטיים ורושם ל-message_log.
 * אידמפוטנטי — נהג עם שורה 'accepted' לתקופה+kind מדולג, אז אפשר להריץ שוב בבטחה.
 */
export async function runMonthlySend(kind: MessageKind, now = new Date()): Promise<RunSummary> {
  const supabase = getSupabase();
  const { year, month } = reportingPeriod(now);
  const startedAt = now.toISOString();
  const templateId = TEMPLATES[kind];

  const allRecipients = await loadRecipients(supabase);

  // תזכורת נשלחת רק לנהגים שעדיין לא דיווחו על אף אחד מהרכבים שלהם.
  let targets = allRecipients;
  if (kind === 'reminder') {
    const reported = await loadReportedVehicleIds(supabase, year, month);
    targets = allRecipients.filter((r) => r.vehicleIds.some((id) => !reported.has(id)));
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

  let sent = 0;
  let failed = 0;
  const failures: RunSummary['failures'] = [];

  for (const r of toSend) {
    const result = await sendTemplate(r.phone, templateId);
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
  };

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
