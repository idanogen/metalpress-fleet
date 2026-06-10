#!/usr/bin/env node
/**
 * Backfill heyy.io contact "plate" attribute from Supabase fleet.vehicles.plate_number.
 *
 * WHY: the monthly reminder template now includes the vehicle plate (variable {{2}}),
 * so the driver knows which car to report. For SINGLE-vehicle drivers we can store the
 * plate on the contact (attribute "plate") and the heyy flow can reference {{contact.plate}}.
 *
 * ⚠️ MULTI-VEHICLE DRIVERS: a heyy contact is one-per-phone and an attribute holds ONE
 * value — it cannot represent two plates. Those drivers must get one template per vehicle,
 * with the plate passed as a SEND-TIME template parameter from the Make scenario that
 * iterates METL_EMPLOYEECARS (one row per vehicle). This script does NOT try to cram
 * multiple plates into one attribute — instead it sets the single-vehicle plate and
 * prints the multi-vehicle drivers so they can be handled per-vehicle in Make.
 *
 * Mirrors scripts/backfill-heyy-kilo.mjs.
 *
 * Run:
 *   node scripts/backfill-heyy-plate.mjs            # dry-run (default)
 *   node scripts/backfill-heyy-plate.mjs --apply    # actually write
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');

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

function toE164(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('972')) return '+' + digits;
  if (digits.startsWith('0')) return '+972' + digits.slice(1);
  return '+' + digits;
}

async function listAllContacts() {
  const all = [];
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
    all.push(...items);
    if (items.length < pageSize) break;
    page++;
    if (page > 50) break;
  }
  return all;
}

async function setPlate(contactId, value) {
  const r = await fetch(`${HEYY_BASE}/contacts/${contactId}/attributes`, {
    method: 'POST',
    headers: heyyHeaders,
    body: JSON.stringify({ externalId: 'plate', value: String(value) }),
  });
  if (!r.ok) throw new Error(`heyy ${r.status}: ${await r.text()}`);
  return r.json().catch(() => ({}));
}

async function main() {
  console.log(APPLY ? '🚀 APPLY mode — will write to heyy' : '🔍 DRY-RUN — no writes (pass --apply to write)');

  console.log('🔍 Loading active vehicles from Supabase...');
  const { data, error } = await supabase
    .from('vehicles')
    .select(`
      id, plate_number,
      driver:drivers!current_driver_id(id, name, phone)
    `)
    .eq('is_inventory', false)
    .eq('is_active', true);
  if (error) throw error;

  // Group every active vehicle per phone so we can tell single- from multi-vehicle drivers.
  const byPhone = new Map();
  for (const v of data) {
    if (!v.driver?.phone || !v.plate_number) continue;
    const phone = toE164(v.driver.phone);
    if (!phone) continue;
    const entry = byPhone.get(phone) ?? { name: v.driver.name, phone, plates: [] };
    entry.plates.push(v.plate_number);
    byPhone.set(phone, entry);
  }

  const multiVehicle = [...byPhone.values()].filter(e => e.plates.length > 1);
  const single = [...byPhone.values()].filter(e => e.plates.length === 1);
  console.log(`📋 ${single.length} single-vehicle drivers · ${multiVehicle.length} multi-vehicle drivers`);

  if (multiVehicle.length) {
    console.log('\n⚠️  MULTI-VEHICLE drivers — NOT written (one attribute can\'t hold several plates).');
    console.log('   These must get one template per vehicle, plate as a send-time param in Make:');
    for (const e of multiVehicle) {
      console.log(`   • ${e.name.padEnd(20)} ${e.phone}  →  ${e.plates.join(', ')}`);
    }
    console.log('');
  }

  console.log('📞 Listing heyy contacts...');
  const contacts = await listAllContacts();
  console.log(`   ${contacts.length} contacts in heyy`);

  const singleByPhone = new Map(single.map(e => [e.phone, e]));

  let updated = 0, missingInSb = 0, noChange = 0, skippedMulti = 0, failed = 0;
  for (const c of contacts) {
    const phone = c.phoneNumber;
    if (!phone) continue;
    if (byPhone.has(phone) && !singleByPhone.has(phone)) { skippedMulti++; continue; }
    const target = singleByPhone.get(phone);
    if (!target) {
      missingInSb++;
      continue;
    }
    const currentPlate = (c.attributes || []).find(a => (a.attribute?.externalId ?? a.externalId) === 'plate')?.value;
    const newVal = String(target.plates[0]);
    if (currentPlate === newVal) {
      noChange++;
      continue;
    }
    try {
      if (APPLY) await setPlate(c.id, newVal);
      updated++;
      console.log(`   ${APPLY ? '✅' : '📝'} ${target.name.padEnd(20)} ${phone}  ${currentPlate ?? '(empty)'} → ${newVal}`);
    } catch (err) {
      failed++;
      console.error(`   ❌ ${target.name} ${phone}: ${err.message}`);
    }
    if (APPLY) await new Promise(res => setTimeout(res, 80));
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ${APPLY ? 'updated' : 'would update'}: ${updated}`);
  console.log(`   no change needed:    ${noChange}`);
  console.log(`   skipped (multi-vehicle, handle in Make): ${skippedMulti}`);
  console.log(`   heyy contact not in Supabase: ${missingInSb}`);
  console.log(`   failed: ${failed}`);
  if (!APPLY && updated > 0) console.log(`\n💡 Re-run with --apply to write these to heyy.`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
