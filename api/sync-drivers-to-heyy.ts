import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HEYY_API_KEY = process.env.HEYY_API_KEY;
const HEYY_BASE_URL = process.env.HEYY_BASE_URL || 'https://api.heyy.io/api/v2.0';
const SYNC_SECRET = process.env.HEYY_SYNC_SECRET;

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

interface HeyyAttributeEntry {
  attribute?: { externalId?: string };
  value?: string;
}

interface HeyyContact {
  id: string;
  firstName?: string;
  phoneNumber?: string;
  attributes?: HeyyAttributeEntry[];
}

interface DriverRow {
  id: number;
  current_mileage: number | null;
  plate_number: string | null;
  model: string | null;
  driver: { id: number; name: string | null; phone: string | null } | null;
}

interface SyncTarget {
  driverId: number;
  name: string;
  phone: string;
  kilo: string;
  vehicleId: string;
  plateNumber: string;
  vehicleModel: string;
}

function toE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('972') && digits.length === 12) return '+' + digits;
  if (digits.startsWith('0') && digits.length === 10) return '+972' + digits.slice(1);
  return null;
}

const heyyHeaders = {
  Authorization: `Bearer ${HEYY_API_KEY}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

// heyy's rate limit is per-minute-per-tenant. On 429 it returns either
// X-RateLimit-Reset (epoch seconds) or Retry-After (seconds). Wait the
// indicated time and retry once. Best-effort; gives up after one retry.
async function heyyFetch(url: string, init: RequestInit): Promise<Response> {
  let r = await fetch(url, init);
  if (r.status !== 429) return r;
  const reset = r.headers.get('x-ratelimit-reset');
  const retryAfter = r.headers.get('retry-after');
  let waitMs = 65_000;
  if (reset) {
    const resetEpoch = Number(reset);
    if (Number.isFinite(resetEpoch)) {
      const diff = resetEpoch * 1000 - Date.now();
      if (diff > 0 && diff < 120_000) waitMs = diff + 1000;
    }
  } else if (retryAfter) {
    const sec = Number(retryAfter);
    if (Number.isFinite(sec) && sec > 0 && sec < 120) waitMs = sec * 1000 + 1000;
  }
  await new Promise(res => setTimeout(res, waitMs));
  r = await fetch(url, init);
  return r;
}

async function listHeyyContacts(): Promise<Map<string, HeyyContact>> {
  const map = new Map<string, HeyyContact>();
  const pageSize = 100;
  let page = 0;
  while (page < 50) {
    const url = new URL(`${HEYY_BASE_URL}/contacts`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('pageSize', String(pageSize));
    const r = await heyyFetch(url.toString(), { headers: heyyHeaders });
    if (!r.ok) break;
    const body = await r.json();
    const items: HeyyContact[] = body.data?.contacts || body.data || [];
    for (const c of items) {
      if (c.phoneNumber) map.set(c.phoneNumber, c);
    }
    if (items.length < pageSize) break;
    page++;
  }
  return map;
}

async function createContact(t: SyncTarget): Promise<{ ok: boolean; error?: string }> {
  const r = await heyyFetch(`${HEYY_BASE_URL}/contacts`, {
    method: 'POST',
    headers: heyyHeaders,
    body: JSON.stringify({
      firstName: t.name,
      phoneNumber: t.phone,
      attributes: [
        { externalId: 'kilo', value: t.kilo },
        { externalId: 'vehicleId', value: t.vehicleId },
        { externalId: 'plateNumber', value: t.plateNumber },
        { externalId: 'vehicleModel', value: t.vehicleModel },
      ],
    }),
  });
  if (!r.ok) return { ok: false, error: `${r.status} ${await r.text()}` };
  return { ok: true };
}

async function updateContactName(contactId: string, name: string): Promise<boolean> {
  const r = await heyyFetch(`${HEYY_BASE_URL}/contacts/${contactId}`, {
    method: 'PATCH',
    headers: heyyHeaders,
    body: JSON.stringify({ firstName: name }),
  });
  return r.ok;
}

async function setAttribute(contactId: string, externalId: string, value: string): Promise<boolean> {
  const r = await heyyFetch(`${HEYY_BASE_URL}/contacts/${contactId}/attributes`, {
    method: 'POST',
    headers: heyyHeaders,
    body: JSON.stringify({ externalId, value }),
  });
  return r.ok;
}

function attrValue(contact: HeyyContact, externalId: string): string {
  const a = (contact.attributes ?? []).find(x => x.attribute?.externalId === externalId);
  return a?.value ?? '';
}

async function syncOne(target: SyncTarget, existing: HeyyContact | undefined): Promise<{ outcome: 'created' | 'updated' | 'unchanged' | 'failed'; reason?: string }> {
  if (!existing) {
    const r = await createContact(target);
    return r.ok ? { outcome: 'created' } : { outcome: 'failed', reason: r.error };
  }
  const changes: string[] = [];
  if (existing.firstName !== target.name) {
    const ok = await updateContactName(existing.id, target.name);
    if (ok) changes.push('name');
  }
  const fields: Array<[string, string]> = [
    ['vehicleId', target.vehicleId],
    ['plateNumber', target.plateNumber],
    ['vehicleModel', target.vehicleModel],
    ['kilo', target.kilo],
  ];
  for (const [key, val] of fields) {
    if (attrValue(existing, key) !== val) {
      const ok = await setAttribute(existing.id, key, val);
      if (ok) changes.push(key);
    }
  }
  return changes.length ? { outcome: 'updated' } : { outcome: 'unchanged' };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!SYNC_SECRET) {
    return res.status(500).json({ error: 'Server missing HEYY_SYNC_SECRET' });
  }
  const gotHeader = req.headers['x-sync-secret'];
  const got = Array.isArray(gotHeader) ? gotHeader[0] : gotHeader;
  if (typeof got !== 'string' || !safeCompare(got, SYNC_SECRET)) {
    return res.status(401).json({ error: 'Bad secret' });
  }

  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'Supabase env missing' });
  if (!HEYY_API_KEY) return res.status(500).json({ error: 'HEYY_API_KEY missing' });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    db: { schema: 'fleet' },
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from('vehicles')
    .select(`id, current_mileage, plate_number, model, is_inventory, is_active,
             driver:drivers!current_driver_id(id, name, phone)`)
    .eq('is_inventory', false)
    .eq('is_active', true);

  if (error) return res.status(500).json({ error: `Supabase: ${error.message}` });

  // Dedupe by phone — driver with multiple vehicles → one contact (highest mileage wins)
  const byPhone = new Map<string, SyncTarget>();
  for (const v of (data as unknown as DriverRow[])) {
    if (!v.driver?.phone || !v.driver.name) continue;
    const phone = toE164(v.driver.phone);
    if (!phone) continue;
    const candidate: SyncTarget = {
      driverId: v.driver.id,
      name: v.driver.name,
      phone,
      kilo: String(v.current_mileage ?? 0),
      vehicleId: String(v.id),
      plateNumber: v.plate_number ?? '',
      vehicleModel: v.model ?? '',
    };
    const existing = byPhone.get(phone);
    if (!existing || Number(candidate.kilo) > Number(existing.kilo)) {
      byPhone.set(phone, candidate);
    }
  }
  const targets = Array.from(byPhone.values());

  const existing = await listHeyyContacts();

  let created = 0, updated = 0, unchanged = 0, failed = 0;
  const failures: Array<{ name: string; phone: string; reason: string }> = [];

  for (const t of targets) {
    const result = await syncOne(t, existing.get(t.phone));
    if (result.outcome === 'created') created++;
    else if (result.outcome === 'updated') updated++;
    else if (result.outcome === 'unchanged') unchanged++;
    else {
      failed++;
      failures.push({ name: t.name, phone: t.phone, reason: result.reason ?? 'unknown' });
    }
    // Rate-limit gentleness — only sleep when we actually called heyy
    if (result.outcome !== 'unchanged') {
      await new Promise(r => setTimeout(r, 80));
    }
  }

  return res.status(200).json({
    ok: true,
    totalTargets: targets.length,
    heyyContactsExisting: existing.size,
    created,
    updated,
    unchanged,
    failed,
    failures: failures.slice(0, 10),
  });
}
