/**
 * POST /api/send-manual-reminder — כפתור "שלח תזכורת" בעמוד התזכורות לנהגים.
 *
 * עד 02/11/2026 הכפתור ירה מהדפדפן ישירות למייק (תרחיש 4627015), והרישום היחיד היה
 * כתיבה מהדפדפן ל-reminder_log, שנכשלה בשקט מ-22/10. ב-02/11 יצאו כ-100 תזכורות
 * ידניות שלא נשארו מהן עקבות אצלנו. מעכשיו השליחה עוברת כאן:
 *   - אימות: אסימון הסשן של המרכז (Authorization: Bearer) + hub_can_open על כרטיס הצי.
 *   - שליחה: אותה תבנית "תזכורת" ואותה שכבת heyy של השליחה החודשית (ניסיון חוזר על 429).
 *   - רישום: message_log (kind='manual', מי לחץ ב-error כשאין כשל) + reminder_log לצינון בעמוד.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TEMPLATES, envReady, getSupabase, sendTemplate, toE164 } from './_lib/monthly-messaging.js';

const FLEET_HOST = 'fleet.metalpress.ogensolutions.biz';
const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

/** מחזיר את מזהה המשתמש אם הסשן תקף ויש לו הרשאה לכרטיס הצי, אחרת null. */
async function authorizedUser(token: string): Promise<string | null> {
  if (!SUPABASE_URL || !ANON_KEY) return null;
  const headers = { apikey: ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const can = await fetch(`${SUPABASE_URL}/rest/v1/rpc/hub_can_open`, {
    method: 'POST', headers, body: JSON.stringify({ p_host: FLEET_HOST }),
  });
  if (!can.ok || (await can.json()) !== true) return null;
  const me = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers });
  if (!me.ok) return null;
  const user = (await me.json()) as { email?: string; id?: string };
  return user.email || user.id || null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const envErr = envReady();
  if (envErr) return res.status(500).json({ error: envErr });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const who = token ? await authorizedUser(token) : null;
  if (!who) return res.status(401).json({ error: 'not signed in to the fleet card' });

  const { vehicleId, year, month } = (req.body || {}) as { vehicleId?: number; year?: number; month?: number };
  if (!Number.isInteger(vehicleId) || !Number.isInteger(year) || !Number.isInteger(month) || month! < 1 || month! > 12) {
    return res.status(400).json({ error: 'vehicleId, year, month required' });
  }

  const supabase = getSupabase();
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('id, current_driver_id, drivers:current_driver_id (id, name, phone)')
    .eq('id', vehicleId!)
    .maybeSingle();
  type DriverRow = { id: number; name: string; phone: string | null };
  const embedded = vehicle?.drivers as unknown as DriverRow | DriverRow[] | null | undefined;
  const driver = (Array.isArray(embedded) ? embedded[0] : embedded) ?? null;
  const phone = toE164(driver?.phone ?? '');
  if (!vehicle || !driver || !phone) return res.status(404).json({ error: 'no driver phone for this vehicle' });

  const result = await sendTemplate(phone, TEMPLATES.reminder);

  const { error: logErr } = await supabase.from('message_log').upsert(
    {
      kind: 'manual',
      report_year: year,
      report_month: month,
      driver_id: driver.id,
      vehicle_id: vehicle.id,
      driver_name: driver.name,
      phone,
      template_id: TEMPLATES.reminder,
      send_status: result.ok ? 'accepted' : 'failed',
      heyy_message_id: result.heyyMessageId,
      error: result.ok ? `manual by ${who}` : result.error,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'report_year,report_month,driver_id,kind' },
  );
  if (logErr) console.error(`message_log upsert failed for manual ${driver.name}:`, logErr.message);

  if (result.ok) {
    const { error: remErr } = await supabase.from('reminder_log').insert({
      vehicle_id: vehicle.id, driver_id: driver.id, report_year: year, report_month: month,
      channel: 'whatsapp', provider: 'heyy', status: 'sent', provider_message_id: result.heyyMessageId,
    });
    if (remErr) console.error(`reminder_log insert failed for ${driver.name}:`, remErr.message);
  }

  if (!result.ok) return res.status(502).json({ ok: false, error: result.error });
  return res.status(200).json({ ok: true, driver: driver.name, logged: !logErr });
}
