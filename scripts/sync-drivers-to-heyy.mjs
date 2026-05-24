#!/usr/bin/env node
/**
 * One-shot sync: Supabase drivers → heyy.io contacts
 *
 * For each active driver in fleet.vehicles:
 *  - Phone must exist
 *  - Not an inventory vehicle
 *  - Creates contact in heyy with attributes: kilo, vehicleId, plateNumber, vehicleModel
 *
 * Run: node scripts/sync-drivers-to-heyy.mjs
 *
 * Re-runnable: skips contacts that already exist (by phone).
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const HEYY_KEY = process.env.HEYY_API_KEY;
const HEYY_BASE = process.env.HEYY_BASE_URL || 'https://api.heyy.io/api/v2.0';
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!HEYY_KEY || !SB_URL || !SB_KEY) {
  console.error('Missing env: HEYY_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SB_URL, SB_KEY, {
  db: { schema: 'fleet' },
  auth: { persistSession: false },
});

const heyyHeaders = {
  Authorization: `Bearer ${HEYY_KEY}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

// Convert 0523694547 → +972523694547 (heyy expects E.164)
function toE164(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('972')) return '+' + digits;
  if (digits.startsWith('0')) return '+972' + digits.slice(1);
  return '+' + digits;
}

async function listExistingContacts() {
  // List all contacts paginated by page/pageSize. Map by phone.
  const map = new Map();
  const pageSize = 100;
  let page = 0;
  while (true) {
    const url = new URL(`${HEYY_BASE}/contacts`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('pageSize', String(pageSize));
    const r = await fetch(url, { headers: heyyHeaders });
    if (!r.ok) {
      console.error('Failed to list contacts:', r.status, await r.text());
      break;
    }
    const body = await r.json();
    const items = body.data?.contacts || body.data || [];
    for (const c of items) {
      if (c.phoneNumber) map.set(c.phoneNumber, c);
    }
    if (items.length < pageSize) break;
    page++;
    if (page > 50) break; // safety
  }
  return map;
}

async function createContact({ name, phone, kilo, vehicleId, plate, model }) {
  const body = {
    firstName: name,
    phoneNumber: phone,
    attributes: [
      { externalId: 'kilo', value: String(kilo ?? 0) },
      { externalId: 'vehicleId', value: String(vehicleId) },
      { externalId: 'plateNumber', value: plate || '' },
      { externalId: 'vehicleModel', value: model || '' },
    ],
  };
  const r = await fetch(`${HEYY_BASE}/contacts`, {
    method: 'POST',
    headers: heyyHeaders,
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`heyy ${r.status}: ${await r.text()}`);
  return r.json();
}

async function main() {
  console.log('🔍 Loading active drivers from Supabase...');
  const { data, error } = await supabase
    .from('vehicles')
    .select(`
      id, current_mileage, plate_number, model, is_inventory, is_active,
      driver:drivers!current_driver_id(id, name, phone)
    `)
    .eq('is_inventory', false)
    .eq('is_active', true);
  if (error) throw error;

  // Dedupe by phone — a driver with multiple vehicles becomes one contact
  // (the one with the highest current_mileage = the most active vehicle)
  const byPhone = new Map();
  for (const v of data) {
    if (!v.driver?.phone) continue;
    const phone = toE164(v.driver.phone);
    if (!phone) continue;
    const candidate = {
      name: v.driver.name,
      phone,
      kilo: v.current_mileage,
      vehicleId: v.id,
      plate: v.plate_number,
      model: v.model,
    };
    const existing = byPhone.get(phone);
    if (!existing || candidate.kilo > existing.kilo) {
      byPhone.set(phone, candidate);
    }
  }
  const targets = [...byPhone.values()];

  console.log(`📋 ${targets.length} drivers to sync`);
  console.log(`📞 Checking existing contacts in heyy...`);
  const existing = await listExistingContacts();
  console.log(`   ${existing.size} contacts already in heyy`);

  let created = 0, skipped = 0, failed = 0;
  for (const t of targets) {
    if (existing.has(t.phone)) {
      skipped++;
      continue;
    }
    try {
      await createContact(t);
      created++;
      console.log(`   ✅ ${t.name} ${t.phone} (vehicle ${t.vehicleId}, ${t.kilo} ק"מ)`);
    } catch (err) {
      failed++;
      console.error(`   ❌ ${t.name} ${t.phone}: ${err.message}`);
    }
    // Rate limit gentleness
    await new Promise(res => setTimeout(res, 80));
  }

  console.log(`\n📊 Done: created=${created}, skipped=${skipped}, failed=${failed}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
