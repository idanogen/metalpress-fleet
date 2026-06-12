#!/usr/bin/env node
/**
 * Replay a Priority full-sync payload through public.sync_vehicle_from_priority.
 *
 * Takes the JSON exported from the Make HTTP module of scenario 4646251
 * (METL_EMPLOYEECARS with $expand=METL_CARUSAGE_SUBFORM) and calls the RPC
 * once per vehicle — exactly what the monthly scenario does. Idempotent:
 * priority rows realign to Priority, bot/manual rows are protected by the RPC.
 *
 * Run:
 *   node scripts/replay-priority-sync.mjs <payload.json>            # dry-run
 *   node scripts/replay-priority-sync.mjs <payload.json> --apply    # call the RPC
 */
import 'dotenv/config';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const file = process.argv.find(a => a.endsWith('.json'));

if (!file) {
  console.error('Usage: node scripts/replay-priority-sync.mjs <payload.json> [--apply]');
  process.exit(1);
}

const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) {
  console.error('Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// The RPC lives in public (Make's Supabase module is pinned to public schema),
// so use the default-schema client here — not the fleet-schema one.
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
// Make module export: [{data: {value: [...vehicles]}}, ...] — flatten all bundles.
const vehicles = [];
if (Array.isArray(raw)) {
  for (const bundle of raw) {
    const list = bundle?.data?.value ?? bundle?.value ?? [];
    vehicles.push(...list);
  }
} else {
  vehicles.push(...(raw?.data?.value ?? raw?.value ?? []));
}

console.log(APPLY ? '🚀 APPLY — calling RPC per vehicle' : '🔍 DRY-RUN — pass --apply to sync');
console.log(`📦 ${vehicles.length} vehicles in payload`);

let inserted = 0, updated = 0, reportsIns = 0, reportsUpd = 0, skipped = 0, flagged = 0, failed = 0;
for (const v of vehicles) {
  if (v?.EQUIPMENT_ID == null) { console.warn('   ⚠️ vehicle without EQUIPMENT_ID — skipped'); continue; }
  if (!APPLY) continue;
  const { data, error } = await sb.rpc('sync_vehicle_from_priority', { p_payload: v });
  if (error) {
    failed++;
    console.error(`   ❌ ${v.EQUIPMENT_ID} (${v.VEHICLENUMCH ?? '?'}): ${error.message}`);
    continue;
  }
  if (data.vehicle_inserted) inserted++;
  if (data.vehicle_updated) updated++;
  reportsIns += data.reports_inserted ?? 0;
  reportsUpd += data.reports_updated ?? 0;
  skipped += data.reports_skipped ?? 0;
  flagged += data.divergences_flagged ?? 0;
  if (data.divergences_flagged > 0) {
    console.log(`   🔔 ${v.EQUIPMENT_ID} (${v.VEHICLENUMCH ?? '?'}): ${data.divergences_flagged} divergence(s) flagged for review`);
  }
}

console.log('\n📊 Summary:');
if (APPLY) {
  console.log(`   vehicles inserted: ${inserted}, updated: ${updated}, failed: ${failed}`);
  console.log(`   reports inserted: ${reportsIns}, updated: ${reportsUpd}, protected-skipped: ${skipped}`);
  console.log(`   divergences flagged for review: ${flagged}`);
} else {
  console.log(`   would sync ${vehicles.length} vehicles`);
}
