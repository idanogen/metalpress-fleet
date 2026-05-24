#!/usr/bin/env node
/**
 * Backfill heyy.io contact "kilo" attribute from Supabase fleet.vehicles.current_mileage.
 *
 * Use when the kilo custom attribute was deleted/recreated in heyy and all values
 * came back empty. Iterates every heyy contact, matches by phone (E.164) to a
 * driver in Supabase, and writes the matching vehicle's current_mileage to kilo.
 *
 * Run:
 *   node scripts/backfill-heyy-kilo.mjs            # dry-run (default)
 *   node scripts/backfill-heyy-kilo.mjs --apply    # actually write
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

async function setKilo(contactId, value) {
  const r = await fetch(`${HEYY_BASE}/contacts/${contactId}/attributes`, {
    method: 'POST',
    headers: heyyHeaders,
    body: JSON.stringify({ externalId: 'kilo', value: String(value) }),
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
      id, current_mileage, plate_number,
      driver:drivers!current_driver_id(id, name, phone)
    `)
    .eq('is_inventory', false)
    .eq('is_active', true);
  if (error) throw error;

  // Dedupe by phone: a driver with multiple vehicles → use the one with the highest mileage
  const byPhone = new Map();
  for (const v of data) {
    if (!v.driver?.phone) continue;
    const phone = toE164(v.driver.phone);
    if (!phone) continue;
    const km = Number(v.current_mileage ?? 0);
    const existing = byPhone.get(phone);
    if (!existing || km > existing.kilo) {
      byPhone.set(phone, {
        name: v.driver.name,
        phone,
        kilo: km,
        vehicleId: v.id,
        plate: v.plate_number,
      });
    }
  }
  console.log(`📋 ${byPhone.size} drivers with phone + vehicle in Supabase`);

  console.log('📞 Listing heyy contacts...');
  const contacts = await listAllContacts();
  console.log(`   ${contacts.length} contacts in heyy`);

  let updated = 0, missingInSb = 0, noChange = 0, failed = 0;
  for (const c of contacts) {
    const phone = c.phoneNumber;
    if (!phone) continue;
    const target = byPhone.get(phone);
    if (!target) {
      missingInSb++;
      continue;
    }
    const currentKilo = (c.attributes || []).find(a => (a.attribute?.externalId ?? a.externalId) === 'kilo')?.value;
    const newVal = String(target.kilo);
    if (currentKilo === newVal) {
      noChange++;
      continue;
    }
    try {
      if (APPLY) await setKilo(c.id, newVal);
      updated++;
      console.log(`   ${APPLY ? '✅' : '📝'} ${target.name.padEnd(20)} ${phone}  ${currentKilo ?? '(empty)'} → ${newVal}`);
    } catch (err) {
      failed++;
      console.error(`   ❌ ${target.name} ${phone}: ${err.message}`);
    }
    if (APPLY) await new Promise(res => setTimeout(res, 80));
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ${APPLY ? 'updated' : 'would update'}: ${updated}`);
  console.log(`   no change needed:    ${noChange}`);
  console.log(`   heyy contact not in Supabase: ${missingInSb}`);
  console.log(`   failed: ${failed}`);
  if (!APPLY && updated > 0) console.log(`\n💡 Re-run with --apply to write these to heyy.`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
