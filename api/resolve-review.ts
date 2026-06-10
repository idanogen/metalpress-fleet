import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HEYY_API_KEY = process.env.HEYY_API_KEY;
const HEYY_BASE_URL = process.env.HEYY_BASE_URL || 'https://api.heyy.io/api/v2.0';
const HEYY_CHANNEL_ID = process.env.HEYY_CHANNEL_ID;
const MAKE_PRIORITY_WRITE_WEBHOOK = process.env.MAKE_PRIORITY_WRITE_WEBHOOK;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

async function sendHeyyWhatsAppText(e164Phone: string, bodyText: string): Promise<void> {
  if (!HEYY_API_KEY || !HEYY_CHANNEL_ID) return;
  try {
    await fetch(`${HEYY_BASE_URL}/${HEYY_CHANNEL_ID}/whatsapp_messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HEYY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phoneNumber: e164Phone, type: 'TEXT', bodyText }),
    });
  } catch {
    // best-effort
  }
}

async function updateHeyyContactMileage(localPhone: string, mileage: number): Promise<boolean> {
  if (!HEYY_API_KEY) return false;
  const e164 = '+972' + localPhone.replace(/^0/, '');
  try {
    const search = await fetch(
      `${HEYY_BASE_URL}/contacts?search=${encodeURIComponent(e164)}&pageSize=5&page=0`,
      { headers: { Authorization: `Bearer ${HEYY_API_KEY}`, Accept: 'application/json' } }
    );
    if (!search.ok) return false;
    const body = await search.json();
    const contact = (body?.data?.contacts ?? []).find((c: { phoneNumber?: string }) => c.phoneNumber === e164);
    if (!contact?.id) return false;
    const upd = await fetch(`${HEYY_BASE_URL}/contacts/${contact.id}/attributes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HEYY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ externalId: 'kilo', value: String(mileage) }),
    });
    return upd.ok;
  } catch {
    return false;
  }
}

async function writeToPriorityViaMake(p: { vehicleId: number; year: number; month: number; mileage: number }): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!MAKE_PRIORITY_WRITE_WEBHOOK) return { ok: false, error: 'no webhook configured' };
  try {
    const r = await fetch(MAKE_PRIORITY_WRITE_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
    // Capture Priority's real status + body so a rejection (e.g. mileage lower
    // than a past month) is surfaced, not swallowed.
    if (r.ok) return { ok: true, status: r.status };
    let body = '';
    try { body = (await r.text()).slice(0, 500); } catch { /* ignore */ }
    return { ok: false, status: r.status, error: `HTTP ${r.status}${body ? `: ${body}` : ''}` };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'server not configured' });

  if (!ADMIN_SECRET) {
    return res.status(500).json({ error: 'Server missing ADMIN_SECRET' });
  }
  const gotHeader = req.headers['x-admin-secret'];
  const got = Array.isArray(gotHeader) ? gotHeader[0] : gotHeader;
  if (typeof got !== 'string' || !safeCompare(got, ADMIN_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id, action, corrected_mileage, vehicle_id } = (req.body ?? {}) as {
    id?: number;
    action?: string;
    corrected_mileage?: number;
    vehicle_id?: number;
  };

  if (typeof id !== 'number') return res.status(400).json({ error: 'id (number) required' });
  if (action !== 'approve' && action !== 'reject') {
    return res.status(400).json({ error: "action must be 'approve' or 'reject'" });
  }
  if (action === 'reject' && (typeof corrected_mileage !== 'number' || corrected_mileage <= 0)) {
    return res.status(400).json({ error: 'corrected_mileage (positive number) required for reject' });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'fleet' }, auth: { persistSession: false } });

  const { data: row, error: fetchErr } = await supabase
    .from('inbound_messages')
    .select('id, status, matched_vehicle_id, matched_driver_id, parsed_mileage, parsed_year, parsed_month')
    .eq('id', id)
    .single();

  if (fetchErr || !row) return res.status(404).json({ error: 'inbound message not found' });
  if (row.status !== 'pending_review') return res.status(400).json({ error: `already ${row.status}` });
  if (!row.matched_driver_id || !row.parsed_year || !row.parsed_month) {
    return res.status(400).json({ error: 'inbound message missing required context (driver/year/month)' });
  }

  const { matched_driver_id: driverId, parsed_year: year, parsed_month: month } = row;

  // Most pending rows already know their vehicle. Ambiguous rows (driver had several
  // active vehicles) carry no vehicle — the reviewer must pass the chosen vehicle_id,
  // which we validate belongs to this driver and is an active, non-inventory car.
  let vehicleId = row.matched_vehicle_id as number | null;
  if (!vehicleId) {
    if (typeof vehicle_id !== 'number') {
      return res.status(400).json({ error: 'יש לבחור רכב עבור דיווח שלא שויך אוטומטית' });
    }
    const { data: chosen } = await supabase
      .from('vehicles')
      .select('id, current_driver_id, is_active, is_inventory')
      .eq('id', vehicle_id)
      .single();
    if (!chosen || chosen.current_driver_id !== driverId || !chosen.is_active || chosen.is_inventory) {
      return res.status(400).json({ error: 'הרכב שנבחר אינו משויך לנהג או אינו פעיל' });
    }
    vehicleId = vehicle_id;
  }

  const finalMileage = action === 'approve' ? row.parsed_mileage : corrected_mileage!;

  const [{ data: driver }, { data: vehicle }] = await Promise.all([
    supabase.from('drivers').select('phone, name').eq('id', driverId).single(),
    supabase.from('vehicles').select('plate_number, current_mileage, last_report_year, last_report_month').eq('id', vehicleId).single(),
  ]);

  // Business rule (mirrors Priority): odometer can only go up. Refuse to commit a
  // reading at or below the vehicle's current mileage — Priority would reject it
  // anyway, and writing it to Supabase only creates a dashboard↔Priority mismatch.
  // The reviewer must enter a corrected value that's higher than the current reading.
  if (vehicle && vehicle.current_mileage > 0 && finalMileage <= vehicle.current_mileage) {
    return res.status(409).json({
      error: `קריאה ${finalMileage.toLocaleString('he-IL')} אינה גבוהה מהקריאה הקיימת (${vehicle.current_mileage.toLocaleString('he-IL')}). פריוריטי לא יקבל מספר נמוך — יש להזין קריאה מתוקנת גבוהה יותר.`,
      current_mileage: vehicle.current_mileage,
      attempted: finalMileage,
    });
  }

  const { error: reportError } = await supabase
    .from('monthly_reports')
    .upsert({
      vehicle_id: vehicleId,
      driver_id: driverId,
      report_year: year,
      report_month: month,
      mileage: finalMileage,
      source: 'manual',
      reported_at: new Date().toISOString(),
    }, { onConflict: 'vehicle_id,report_year,report_month' });

  if (reportError) return res.status(500).json({ error: `report upsert: ${reportError.message}` });

  // Update vehicle "current" pointers only if this report is newer than (or equals) the existing last report.
  const isNewerOrSame =
    !vehicle?.last_report_year ||
    year > vehicle.last_report_year ||
    (year === vehicle.last_report_year && month >= (vehicle.last_report_month ?? 0));
  if (isNewerOrSame) {
    await supabase.from('vehicles').update({
      current_mileage: finalMileage,
      last_report_year: year,
      last_report_month: month,
    }).eq('id', vehicleId);
  }

  let heyyOk = false;
  if (driver?.phone) heyyOk = await updateHeyyContactMileage(driver.phone, finalMileage);
  const priorityResult = await writeToPriorityViaMake({ vehicleId, year, month, mileage: finalMileage });

  if (driver?.phone) {
    const e164 = '+972' + driver.phone.replace(/^0/, '');
    const firstName = driver.name?.split(' ')[0] ?? '';
    const text = action === 'approve'
      ? `תודה ${firstName} ✅ אישרנו את הקריאה ${finalMileage.toLocaleString('he-IL')} ק"מ לרכב ${vehicle?.plate_number ?? ''}.`
      : `תודה ${firstName} ✅ הקריאה תוקנה ל-${finalMileage.toLocaleString('he-IL')} ק"מ לרכב ${vehicle?.plate_number ?? ''}.`;
    await sendHeyyWhatsAppText(e164, text);
  }

  await supabase.from('inbound_messages').update({
    status: action === 'approve' ? 'approved' : 'rejected',
    parsed_mileage: finalMileage,
    matched_vehicle_id: vehicleId,
    processed_at: new Date().toISOString(),
  }).eq('id', id);

  // Auto-resolve duplicates (same vehicle+year+month, still pending_review) so they don't linger.
  await supabase.from('inbound_messages').update({
    status: 'duplicate',
    processed_at: new Date().toISOString(),
  })
    .eq('status', 'pending_review')
    .eq('matched_vehicle_id', vehicleId)
    .eq('parsed_year', year)
    .eq('parsed_month', month);

  return res.status(200).json({
    ok: true,
    action,
    mileage: finalMileage,
    heyyContactUpdated: heyyOk,
    priorityWritten: priorityResult.ok,
    priorityNote: priorityResult.ok ? null : 'Priority write לא בוצע — צריך עדכון ידני בפריורטי',
  });
}
