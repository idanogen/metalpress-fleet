#!/usr/bin/env node
/**
 * 3-way reconciliation: Dashboard (Supabase) vs Priority (proxy) vs heyy.
 *
 * Priority can't be read directly (IP whitelist), so its value is proxied by the
 * latest source='priority' row in monthly_reports (last monthly sync) plus the
 * write-back audit trail in inbound_messages. heyy + Supabase are read live.
 *
 * Run: node scripts/reconcile-three-sources.mjs
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const HEYY_KEY = process.env.HEYY_API_KEY;
const HEYY_BASE = process.env.HEYY_BASE_URL || 'https://api.heyy.io/api/v2.0';
const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!HEYY_KEY || !SB_URL || !SB_KEY) {
  console.error('Missing env: HEYY_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(SB_URL, SB_KEY, { db: { schema: 'fleet' }, auth: { persistSession: false } });
const heyyHeaders = { Authorization: `Bearer ${HEYY_KEY}`, Accept: 'application/json', 'Content-Type': 'application/json' };

function toE164(phone) {
  if (!phone) return null;
  const d = String(phone).replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('972')) return '+' + d;
  if (d.startsWith('0')) return '+972' + d.slice(1);
  return '+' + d;
}

async function fetchAll(table, select, filter) {
  const all = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    let q = sb.from(table).select(select).range(from, from + pageSize - 1);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw error;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function listAllContacts() {
  const all = [];
  let page = 0;
  while (true) {
    const url = new URL(`${HEYY_BASE}/contacts`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('pageSize', '100');
    const r = await fetch(url, { headers: heyyHeaders });
    if (!r.ok) { console.error('heyy list failed', r.status); break; }
    const body = await r.json();
    const items = body.data?.contacts || body.data || [];
    all.push(...items);
    if (items.length < 100) break;
    page++;
    if (page > 50) break;
  }
  return all;
}

function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('en-US'); }

async function main() {
  console.log('🔍 Loading Supabase vehicles...');
  const vehicles = await fetchAll(
    'vehicles',
    'id, plate_number, model, current_mileage, current_driver_id, last_report_year, last_report_month, is_inventory, last_synced_at, driver:drivers!current_driver_id(id, name, phone)',
    q => q.eq('is_active', true).eq('is_inventory', false).neq('model', 'שוטף')
  );
  console.log(`   ${vehicles.length} active fleet vehicles`);

  console.log('🔍 Loading all monthly_reports...');
  const reports = await fetchAll('monthly_reports', 'vehicle_id, report_year, report_month, mileage, source');
  console.log(`   ${reports.length} reports`);

  // per-vehicle: latest report (by year,month) and highest priority reading
  const latestByVehicle = new Map();
  const priorityPeakByVehicle = new Map();
  for (const r of reports) {
    const key = r.vehicle_id;
    const ym = r.report_year * 100 + r.report_month;
    const cur = latestByVehicle.get(key);
    if (!cur || ym > cur.ym) latestByVehicle.set(key, { ...r, ym });
    if (r.source === 'priority') {
      const pk = priorityPeakByVehicle.get(key);
      if (!pk || Number(r.mileage) > Number(pk.mileage)) priorityPeakByVehicle.set(key, r);
    }
  }

  console.log('🔍 Loading inbound_messages (bot audit)...');
  const inbound = await fetchAll('inbound_messages', 'matched_vehicle_id, parsed_mileage, parsed_year, parsed_month, status, received_at');
  // latest bot writeback per vehicle
  const botByVehicle = new Map();
  for (const m of inbound) {
    if (!m.matched_vehicle_id) continue;
    const cur = botByVehicle.get(m.matched_vehicle_id);
    if (!cur || (m.received_at || '') > (cur.received_at || '')) botByVehicle.set(m.matched_vehicle_id, m);
  }

  console.log('📞 Loading heyy contacts...');
  const contacts = await listAllContacts();
  const heyyByPhone = new Map();
  for (const c of contacts) {
    if (!c.phoneNumber) continue;
    const kilo = (c.attributes || []).find(a => (a.attribute?.externalId ?? a.externalId) === 'kilo')?.value;
    heyyByPhone.set(c.phoneNumber, { kilo: kilo != null && kilo !== '' ? Number(kilo) : null, id: c.id });
  }
  console.log(`   ${contacts.length} heyy contacts`);

  // ---- Reconcile ----
  const rows = [];
  for (const v of vehicles) {
    const latest = latestByVehicle.get(v.id);
    const priPeak = priorityPeakByVehicle.get(v.id);
    const e164 = toE164(v.driver?.phone);
    const heyy = e164 ? heyyByPhone.get(e164) : null;
    const sbCurrent = v.current_mileage != null ? Number(v.current_mileage) : null;
    const heyyKilo = heyy?.kilo ?? null;

    rows.push({
      plate: v.plate_number,
      driver: v.driver?.name || '(אין נהג)',
      phone: v.driver?.phone || '',
      sbCurrent,
      latestReport: latest ? Number(latest.mileage) : null,
      latestSource: latest?.source || '—',
      latestYM: latest ? `${latest.report_month}/${latest.report_year}` : '—',
      priorityPeak: priPeak ? Number(priPeak.mileage) : null,
      heyyKilo,
      hasHeyy: !!heyy,
      botStatus: botByVehicle.get(v.id)?.status || null,
    });
  }

  // ---- Mismatch buckets ----
  const heyyMismatch = rows.filter(r => r.hasHeyy && r.heyyKilo != null && r.sbCurrent != null && r.heyyKilo !== r.sbCurrent);
  const heyyMissing = rows.filter(r => r.phone && (!r.hasHeyy || r.heyyKilo == null));
  // current_mileage should equal the latest report; if not, dashboard internal drift
  const internalDrift = rows.filter(r => r.latestReport != null && r.sbCurrent != null && r.sbCurrent !== r.latestReport);
  // dashboard current is BELOW the highest priority reading → Priority ahead of dashboard
  const belowPriority = rows.filter(r => r.priorityPeak != null && r.sbCurrent != null && r.sbCurrent < r.priorityPeak);

  console.log('\n' + '='.repeat(70));
  console.log('📊 סיכום אבחון 3 מקורות');
  console.log('='.repeat(70));
  console.log(`רכבים בצי (פעילים, לא מלאי, לא שוטף): ${rows.length}`);
  console.log(`\n❌ heyy ≠ דשבורד (kilo שונה מ-current_mileage): ${heyyMismatch.length}`);
  console.log(`⚠️  heyy חסר/ריק עבור נהג עם טלפון: ${heyyMissing.length}`);
  console.log(`⚠️  drift פנימי בדשבורד (current_mileage ≠ דיווח אחרון): ${internalDrift.length}`);
  console.log(`🔴 דשבורד נמוך מ-peak של Priority (Priority מקדים): ${belowPriority.length}`);

  const show = (title, list, cols) => {
    if (!list.length) return;
    console.log(`\n── ${title} ──`);
    for (const r of list.slice(0, 60)) console.log('  ' + cols(r));
  };

  show('heyy ≠ דשבורד', heyyMismatch, r =>
    `${(r.plate||'').padEnd(9)} ${(r.driver||'').slice(0,16).padEnd(17)} dashboard=${fmt(r.sbCurrent).padStart(9)}  heyy=${fmt(r.heyyKilo).padStart(9)}`);
  show('heyy חסר', heyyMissing, r =>
    `${(r.plate||'').padEnd(9)} ${(r.driver||'').slice(0,16).padEnd(17)} dashboard=${fmt(r.sbCurrent).padStart(9)}  heyy=${r.hasHeyy?'(ריק)':'(אין קשר)'}`);
  show('drift פנימי בדשבורד', internalDrift, r =>
    `${(r.plate||'').padEnd(9)} ${(r.driver||'').slice(0,16).padEnd(17)} current=${fmt(r.sbCurrent).padStart(9)}  latestReport=${fmt(r.latestReport).padStart(9)} (${r.latestSource} ${r.latestYM})`);
  show('דשבורד נמוך מ-Priority peak', belowPriority, r =>
    `${(r.plate||'').padEnd(9)} ${(r.driver||'').slice(0,16).padEnd(17)} current=${fmt(r.sbCurrent).padStart(9)}  priorityPeak=${fmt(r.priorityPeak).padStart(9)}`);

  // write full json for the html report
  const out = { generatedAt: new Date().toISOString(), totals: {
    vehicles: rows.length, heyyMismatch: heyyMismatch.length, heyyMissing: heyyMissing.length,
    internalDrift: internalDrift.length, belowPriority: belowPriority.length,
  }, rows };
  const fs = await import('node:fs');
  fs.writeFileSync('reconcile-data.json', JSON.stringify(out, null, 2));
  console.log('\n💾 נשמר reconcile-data.json');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
