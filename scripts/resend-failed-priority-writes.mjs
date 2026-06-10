#!/usr/bin/env node
/**
 * Re-send mileage reports that were saved to Supabase but rejected by Priority.
 *
 * When Priority is down/unauthenticated, api/heyy-webhook.ts still saves the
 * report to fleet.monthly_reports and marks the inbound_messages row
 * status='priority_failed' (the data is never lost — the dashboard is correct).
 * This script replays those rows to the same Make → Priority webhook the live
 * flow uses. The Priority write is a PATCH on a compound key (GLNAME, MONTHNUM),
 * so replaying is idempotent — it sets the value, it never duplicates rows.
 *
 * On a successful re-send the row is flipped to status='written' so it won't be
 * picked up again.
 *
 * Run:
 *   node scripts/resend-failed-priority-writes.mjs            # dry-run (default)
 *   node scripts/resend-failed-priority-writes.mjs --apply    # actually re-send
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');

const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAKE_WEBHOOK = process.env.MAKE_PRIORITY_WRITE_WEBHOOK;

if (!SB_URL || !SB_KEY || !MAKE_WEBHOOK) {
  console.error('Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MAKE_PRIORITY_WRITE_WEBHOOK');
  process.exit(1);
}

const supabase = createClient(SB_URL, SB_KEY, {
  db: { schema: 'fleet' },
  auth: { persistSession: false },
});

// Mirrors writeToPriorityViaMake() in api/heyy-webhook.ts
async function writeToPriority(p) {
  const r = await fetch(MAKE_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(p),
  });
  if (r.ok) return { ok: true, status: r.status };
  let body = '';
  try { body = (await r.text()).slice(0, 500); } catch { /* ignore */ }
  return { ok: false, status: r.status, error: `HTTP ${r.status}${body ? `: ${body}` : ''}` };
}

async function main() {
  console.log(APPLY ? '🚀 APPLY mode — will re-send to Priority' : '🔍 DRY-RUN — no writes (pass --apply to re-send)');

  const { data: rows, error } = await supabase
    .from('inbound_messages')
    .select('id, phone, matched_vehicle_id, parsed_mileage, parsed_year, parsed_month, received_at')
    .eq('status', 'priority_failed')
    .order('received_at', { ascending: true });
  if (error) throw error;

  // Guard: every row must have the fields Priority needs.
  const valid = rows.filter(r => r.matched_vehicle_id && r.parsed_mileage > 0 && r.parsed_year && r.parsed_month);
  const skipped = rows.length - valid.length;
  console.log(`📋 ${rows.length} priority_failed rows (${valid.length} replayable, ${skipped} missing fields)`);

  let ok = 0, failed = 0;
  for (const r of valid) {
    const payload = {
      vehicleId: r.matched_vehicle_id,
      year: r.parsed_year,
      month: r.parsed_month,
      mileage: r.parsed_mileage,
    };
    if (!APPLY) {
      console.log(`   📝 #${r.id} vehicle ${payload.vehicleId}  ${payload.month}/${payload.year}  ${payload.mileage.toLocaleString()} km`);
      continue;
    }
    const res = await writeToPriority(payload);
    if (res.ok) {
      await supabase
        .from('inbound_messages')
        .update({ status: 'written', error: null, processed_at: new Date().toISOString() })
        .eq('id', r.id);
      ok++;
      console.log(`   ✅ #${r.id} vehicle ${payload.vehicleId}  ${payload.mileage.toLocaleString()} km → written`);
    } else {
      await supabase
        .from('inbound_messages')
        .update({ error: `resend failed: ${res.error}` })
        .eq('id', r.id);
      failed++;
      console.error(`   ❌ #${r.id} vehicle ${payload.vehicleId}: ${res.error}`);
    }
    await new Promise(res => setTimeout(res, 200)); // gentle on Priority
  }

  console.log(`\n📊 Summary:`);
  if (APPLY) {
    console.log(`   re-sent OK: ${ok}`);
    console.log(`   still failing: ${failed}`);
  } else {
    console.log(`   would re-send: ${valid.length}`);
    console.log(`\n💡 Re-run with --apply to push these to Priority.`);
  }
  if (skipped) console.log(`   skipped (missing fields): ${skipped}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
