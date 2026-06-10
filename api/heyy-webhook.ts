import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HEYY_WEBHOOK_SECRET = process.env.HEYY_WEBHOOK_SECRET;
const HEYY_API_KEY = process.env.HEYY_API_KEY;

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}
const HEYY_BASE_URL = process.env.HEYY_BASE_URL || 'https://api.heyy.io/api/v2.0';
const HEYY_CHANNEL_ID = process.env.HEYY_CHANNEL_ID;
const MAKE_PRIORITY_WRITE_WEBHOOK = process.env.MAKE_PRIORITY_WRITE_WEBHOOK;

// Sends a free-form WhatsApp text to the driver. Safe within the 24h window
// opened by the driver's inbound message — Meta blocks free-form text
// outside that window and a template would be required instead.
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
    // swallow — message-send is best-effort; data writes are what matter
  }
}

// Forwards the validated report to a Make scenario, which writes to Priority's
// METL_CARUSAGE_SUBFORM from a whitelisted IP. Best-effort; logged in inbound_messages.
async function writeToPriorityViaMake(p: { vehicleId: number; year: number; month: number; mileage: number }): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!MAKE_PRIORITY_WRITE_WEBHOOK) return { ok: false, error: 'no webhook configured' };
  try {
    const r = await fetch(MAKE_PRIORITY_WRITE_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
    // The Make scenario now returns Priority's real status code (not a fake 200).
    // On failure, capture the response body too — Priority explains the reason in
    // Hebrew (e.g. "קילומטראז' גבוה יותר נרשם"), which we want surfaced in the log.
    if (r.ok) return { ok: true, status: r.status };
    let body = '';
    try { body = (await r.text()).slice(0, 500); } catch { /* ignore */ }
    return { ok: false, status: r.status, error: `HTTP ${r.status}${body ? `: ${body}` : ''}` };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// Pushes the new mileage to the heyy contact so the next AI conversation
// has the fresh baseline. Phone is in local format (e.g., 0542424115).
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

interface HeyyPayload {
  // Channel webhook (Settings > Webhooks > WhatsApp Message Received)
  event?: string;
  data?: {
    id?: string;
    sender?: string;
    content?: { body?: string };
    contact?: { phoneNumber?: string };
    handle?: { value?: string };
  };
  // Legacy / automation API-call shape: {from, text}
  type?: string;
  message?: { id?: string; from?: string; text?: string; body?: string };
  from?: string;
  text?: string;
  body?: string;
  id?: string;
}

// Pulls phone + text + providerId out of either payload shape Heyy sends.
function extractMessage(payload: HeyyPayload): { rawPhone: string | undefined; rawText: string | undefined; providerId: string | null } {
  // Channel webhook (event=message.received)
  if (payload.event === 'message.received' && payload.data) {
    return {
      rawPhone: payload.data.contact?.phoneNumber || payload.data.handle?.value,
      rawText: payload.data.content?.body,
      providerId: payload.data.id ?? null,
    };
  }
  // Automation flow API call
  const msg = payload.message ?? payload;
  return {
    rawPhone: msg.from || payload.from,
    rawText: msg.text || msg.body || payload.text || payload.body,
    providerId: msg.id || payload.id || null,
  };
}

function normalizePhone(raw: string | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  // 972523694547 → 0523694547
  if (digits.startsWith('972') && digits.length === 12) return '0' + digits.slice(3);
  // already 05XXXXXXXX
  if (digits.startsWith('0') && digits.length === 10) return digits;
  return digits;
}

function parseMileage(text: string | undefined): number | null {
  if (!text) return null;
  const m = String(text).match(/(\d[\d,.]*)/);
  if (!m) return null;
  const num = parseInt(m[1].replace(/[,.]/g, ''), 10);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function previousMonth(): { year: number; month: number } {
  const now = new Date();
  let m = now.getMonth(); // 0-based, so this is current_month - 1 (1-based)
  let y = now.getFullYear();
  if (m === 0) { m = 12; y -= 1; }
  return { year: y, month: m };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'Server missing Supabase config' });

  // TODO security: make this fail-closed once heyy.io webhook is configured to
  // send the `x-heyy-secret` header. Currently optional to avoid breaking the
  // production bot before that config exists.
  if (HEYY_WEBHOOK_SECRET) {
    const gotHeader = req.headers['x-heyy-secret'] || req.headers['x-webhook-secret'];
    const got = Array.isArray(gotHeader) ? gotHeader[0] : gotHeader;
    if (typeof got !== 'string' || !safeCompare(got, HEYY_WEBHOOK_SECRET)) {
      return res.status(401).json({ error: 'Bad secret' });
    }
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    db: { schema: 'fleet' },
    auth: { persistSession: false },
  });

  const payload = (req.body || {}) as HeyyPayload;

  // Ignore outbound message events (echo of our own sends) — only process inbound
  if (payload.event && payload.event !== 'message.received') {
    return res.status(200).json({ ok: true, ignored: payload.event });
  }
  if (payload.data?.sender === 'outbound') {
    return res.status(200).json({ ok: true, ignored: 'outbound message' });
  }

  const { rawPhone, rawText, providerId } = extractMessage(payload);
  const phone = normalizePhone(rawPhone);

  // Idempotency: if heyy retries the channel webhook for the same message,
  // short-circuit so we don't send the WhatsApp reply twice.
  if (providerId) {
    const { data: existing } = await supabase
      .from('inbound_messages')
      .select('id')
      .eq('provider_message_id', providerId)
      .maybeSingle();
    if (existing) {
      return res.status(200).json({ ok: true, deduped: providerId });
    }
  }

  // Always log inbound first — even if parsing fails
  const inboundBase = {
    provider: 'heyy',
    provider_message_id: providerId,
    phone,
    raw_text: rawText ?? null,
    raw_payload: payload,
  };

  if (!phone || !rawText) {
    await supabase.from('inbound_messages').insert({
      ...inboundBase,
      status: 'failed',
      error: 'missing phone or text',
      processed_at: new Date().toISOString(),
    });
    // 200 (not 400) so heyy doesn't retry this webhook
    return res.status(200).json({ ok: false, validation: 'missing phone or text' });
  }

  // Look up driver by phone
  const { data: driver } = await supabase
    .from('drivers')
    .select('id, name')
    .eq('phone', phone)
    .maybeSingle();

  if (!driver) {
    await supabase.from('inbound_messages').insert({
      ...inboundBase,
      status: 'failed',
      error: `no driver found for phone ${phone}`,
      processed_at: new Date().toISOString(),
    });
    return res.status(404).json({ error: 'Driver not found', phone });
  }

  // Look up the (single) vehicle this driver currently has
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, current_mileage, plate_number')
    .eq('current_driver_id', driver.id)
    .eq('is_active', true)
    .eq('is_inventory', false);

  if (!vehicles || vehicles.length === 0) {
    await supabase.from('inbound_messages').insert({
      ...inboundBase,
      matched_driver_id: driver.id,
      status: 'failed',
      error: 'no vehicle assigned',
      processed_at: new Date().toISOString(),
    });
    return res.status(404).json({ error: 'No vehicle for driver', driver: driver.name });
  }
  if (vehicles.length > 1) {
    // Driver is assigned to more than one active vehicle (typically mid-swap: the
    // old car wasn't deactivated in Priority yet). We can't tell which odometer
    // this reading belongs to — so instead of dropping it silently (the old bug),
    // route it to the dashboard's anomaly review with NO vehicle picked. A human
    // selects the correct plate there, and resolve-review writes it through.
    const ambiguousMileage = parseMileage(rawText);
    const { year: ambYear, month: ambMonth } = previousMonth();
    const ackE164 = '+972' + phone.replace(/^0/, '');
    const ackFirst = driver.name.split(/\s+/)[0];
    const plates = vehicles.map(v => v.plate_number).filter(Boolean).join(', ');

    // Couldn't even read a number — tell the driver and log as a plain failure.
    if (ambiguousMileage === null) {
      await sendHeyyWhatsAppText(ackE164,
        `${ackFirst}, לא הצלחתי לזהות מספר קילומטראז' תקין בהודעה.\nנא לשלוח רק את המספר, לדוגמה: 125430`);
      await supabase.from('inbound_messages').insert({
        ...inboundBase,
        matched_driver_id: driver.id,
        status: 'failed',
        error: `multiple vehicles (${vehicles.length}) + unparseable mileage`,
        processed_at: new Date().toISOString(),
      });
      return res.status(200).json({ ok: false, validation: 'multiple vehicles + could not parse mileage' });
    }

    // Acknowledge so the driver isn't left in the dark, then queue for review.
    await sendHeyyWhatsAppText(ackE164,
      `תודה ${ackFirst} 🙏 קיבלנו את הקריאה ${ambiguousMileage.toLocaleString('he-IL')} ק"מ.\nמכיוון שרשומים על שמך כמה רכבים, נשייך אותה לרכב הנכון ונאשר בהקדם.`);
    await supabase.from('inbound_messages').insert({
      ...inboundBase,
      matched_driver_id: driver.id,
      parsed_mileage: ambiguousMileage,
      parsed_year: ambYear,
      parsed_month: ambMonth,
      status: 'pending_review',
      error: `ריבוי רכבים (${vehicles.length}) — נדרשת בחירת רכב ידנית${plates ? `: ${plates}` : ''}`,
    });
    return res.status(200).json({ ok: false, validation: 'multiple vehicles — sent to review', count: vehicles.length });
  }

  const vehicle = vehicles[0];
  const mileage = parseMileage(rawText);
  const { year, month } = previousMonth();

  const e164 = '+972' + phone.replace(/^0/, '');
  const firstName = driver.name.split(/\s+/)[0];

  if (mileage === null) {
    await sendHeyyWhatsAppText(e164,
      `${firstName}, לא הצלחתי לזהות מספר קילומטראז' תקין בהודעה.\nנא לשלוח רק את המספר, לדוגמה: 125430`);
    await supabase.from('inbound_messages').insert({
      ...inboundBase,
      matched_driver_id: driver.id,
      matched_vehicle_id: vehicle.id,
      status: 'failed',
      error: 'could not parse mileage from text',
      processed_at: new Date().toISOString(),
    });
    return res.status(200).json({ ok: false, validation: 'could not parse mileage' });
  }

  // Block unsolicited follow-up reports: if a real report already exists for
  // this (vehicle, year, month) — regardless of source — refuse the new value
  // and route corrections through a human, so we never silently overwrite history.
  // A row with mileage=0 is NOT a real report — it's a placeholder the Priority
  // sync creates for vehicles that have monthly costs but no kilometer reading
  // yet. The upsert below will fill in the mileage without touching cost columns.
  const { data: existingReport } = await supabase
    .from('monthly_reports')
    .select('mileage, source')
    .eq('vehicle_id', vehicle.id)
    .eq('report_year', year)
    .eq('report_month', month)
    .maybeSingle();

  if (existingReport && Number(existingReport.mileage) > 0) {
    await sendHeyyWhatsAppText(e164,
      `${firstName}, כבר קיבלנו ממך דיווח לחודש ${month}/${year}: ${Number(existingReport.mileage).toLocaleString('he-IL')} ק"מ.\nאם נדרש תיקון, נא לפנות למנהל הצי.`);
    await supabase.from('inbound_messages').insert({
      ...inboundBase,
      matched_driver_id: driver.id,
      matched_vehicle_id: vehicle.id,
      parsed_mileage: mileage,
      parsed_year: year,
      parsed_month: month,
      status: 'blocked',
      error: `report already exists for ${month}/${year} (existing ${existingReport.mileage}, source ${existingReport.source})`,
      processed_at: new Date().toISOString(),
    });
    return res.status(200).json({ ok: false, validation: 'already reported', existing: existingReport.mileage, reported: mileage });
  }

  // The floor for a valid reading is the highest mileage we trust for this vehicle.
  // current_mileage alone is not enough — a bad manual/earlier report can lower it
  // below reality (it happened: a vehicle showed 21,514 while Priority held 198,262,
  // so a fresh ~21K reading passed this guard but Priority rejected the write-back).
  // Priority is the system of record, so we also floor against the highest reading
  // it ever reported. A new value below the floor is flagged for human review.
  const { data: priorityPeak } = await supabase
    .from('monthly_reports')
    .select('mileage')
    .eq('vehicle_id', vehicle.id)
    .eq('source', 'priority')
    .order('mileage', { ascending: false })
    .limit(1)
    .maybeSingle();
  const floor = Math.max(vehicle.current_mileage || 0, Number(priorityPeak?.mileage) || 0);

  if (mileage <= floor && floor > 0) {
    await sendHeyyWhatsAppText(e164,
      `${firstName}, המספר ששלחת (${mileage.toLocaleString('he-IL')}) נמוך או שווה לקריאה האחרונה (${floor.toLocaleString('he-IL')}).\nנא לבדוק ולשלוח שוב — רק את המספר, בלי טקסט נוסף.`);
    await supabase.from('inbound_messages').insert({
      ...inboundBase,
      matched_driver_id: driver.id,
      matched_vehicle_id: vehicle.id,
      parsed_mileage: mileage,
      parsed_year: year,
      parsed_month: month,
      status: 'pending_review',
      error: `mileage ${mileage} below or equal to floor ${floor} (current ${vehicle.current_mileage}, priority peak ${priorityPeak?.mileage ?? 0})`,
    });
    return res.status(200).json({ ok: false, validation: 'mileage below or equal to floor', floor, reported: mileage });
  }

  if (floor > 0 && mileage - floor > 10000) {
    await sendHeyyWhatsAppText(e164,
      `${firstName}, הקריאה (${mileage.toLocaleString('he-IL')}) גבוהה משמעותית מהקודמת (${floor.toLocaleString('he-IL')}).\nנא לוודא שלא נוספה ספרה בטעות ולשלוח שוב — רק את המספר, בלי טקסט נוסף.`);
    await supabase.from('inbound_messages').insert({
      ...inboundBase,
      matched_driver_id: driver.id,
      matched_vehicle_id: vehicle.id,
      parsed_mileage: mileage,
      parsed_year: year,
      parsed_month: month,
      status: 'pending_review',
      error: `mileage jump ${mileage - floor} exceeds 10000 (floor ${floor})`,
    });
    return res.status(200).json({ ok: false, validation: 'mileage jump too large', floor, reported: mileage });
  }

  // Upsert the report
  const { error: reportError } = await supabase
    .from('monthly_reports')
    .upsert({
      vehicle_id: vehicle.id,
      driver_id: driver.id,
      report_year: year,
      report_month: month,
      mileage,
      source: 'whatsapp_bot',
      reported_at: new Date().toISOString(),
    }, { onConflict: 'vehicle_id,report_year,report_month' });

  if (reportError) {
    await supabase.from('inbound_messages').insert({
      ...inboundBase,
      matched_driver_id: driver.id,
      matched_vehicle_id: vehicle.id,
      parsed_mileage: mileage,
      status: 'failed',
      error: `report insert: ${reportError.message}`,
      processed_at: new Date().toISOString(),
    });
    return res.status(500).json({ error: 'Failed to save report', detail: reportError.message });
  }

  // Update the vehicle's quick-access fields
  await supabase
    .from('vehicles')
    .update({
      current_mileage: mileage,
      last_report_year: year,
      last_report_month: month,
    })
    .eq('id', vehicle.id);

  // Update heyy.io contact attribute "kilo" so the next conversation
  // compares against the fresh value, not the stale one.
  const heyyOk = await updateHeyyContactMileage(phone, mileage);

  // Push the report to Priority via Make (Priority whitelists Make's IPs only).
  const priorityResult = await writeToPriorityViaMake({ vehicleId: vehicle.id, year, month, mileage });

  // Confirm to the driver. Plate number is what they recognize, not vehicleId.
  await sendHeyyWhatsAppText(e164,
    `תודה ${firstName} ✅ נרשם ${mileage.toLocaleString('he-IL')} ק"מ לרכב ${vehicle.plate_number}.`);

  const errors: string[] = [];
  if (!heyyOk) errors.push('heyy contact update failed');
  if (!priorityResult.ok) errors.push(`priority write failed: ${priorityResult.error ?? `HTTP ${priorityResult.status}`}`);

  // The mileage is always saved to Supabase, so the dashboard is correct either way.
  // But if Priority rejected the write, mark it distinctly so it's queryable and
  // doesn't masquerade as a clean success — Priority is the system of record.
  await supabase.from('inbound_messages').insert({
    ...inboundBase,
    matched_driver_id: driver.id,
    matched_vehicle_id: vehicle.id,
    parsed_mileage: mileage,
    parsed_year: year,
    parsed_month: month,
    status: priorityResult.ok ? 'written' : 'priority_failed',
    processed_at: new Date().toISOString(),
    error: errors.length ? errors.join('; ') : null,
  });
  // Once configured, POST to {PRIORITY_URL}/METL_EMPLOYEECARS({equipmentId})/METL_CARUSAGE_SUBFORM

  return res.status(200).json({
    ok: true,
    vehicle: { id: vehicle.id, plate: vehicle.plate_number },
    driver: { id: driver.id, name: driver.name },
    report: { year, month, mileage },
  });
}
