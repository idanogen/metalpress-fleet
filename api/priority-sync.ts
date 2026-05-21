import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SYNC_SECRET = process.env.PRIORITY_SYNC_SECRET;

interface PrioritySubform {
  GLNAME?: string;        // year as text, e.g. "2026"
  MONTHNUM?: number;
  MONTHNAME?: string;
  SDATE?: string;
  EDATE?: string;
  DAYS?: number | null;
  MILEAGE?: number | null;
  CARUSAGE?: number | null;
  FUELCONSUMPTION?: number | null;
  FUELCOST?: number | null;
}

interface PriorityVehicle {
  EQUIPMENT_ID?: number;
  VEHICLENUMCH?: string;
  MODEL?: string;
  OWNERSHIPTYPE?: string;
  SUPPLIER?: string;
  DNAMETITLE?: string;
  SNAME?: string;
  EDPE_CELLPHONE?: string;
  STARTDATE?: string;
  ENDDATE?: string;
  RENTENDDATE?: string;
  LICENSEENDDATE?: string;
  RENTVALUE?: number;
  MILEAGE?: number;
  MILEAGEYEAR?: string;
  MILEAGEMONTNAME?: string;
  METL_CARUSAGE_SUBFORM?: PrioritySubform[];
}

// Priority sends "0545744212" / "972545744212" / sometimes with spaces.
// Normalize to local 10-digit (e.g. "0545744212"); return null for anything unrecognized.
function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('972') && digits.length === 12) return '0' + digits.slice(3);
  if (digits.startsWith('0') && digits.length === 10) return digits;
  return null;
}

// "2026-03-29T00:00:00+03:00" → "2026-03-29". Postgres DATE columns parse YYYY-MM-DD directly.
function priorityDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = String(raw).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function toIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'Server missing Supabase config' });

  if (SYNC_SECRET) {
    const got = req.headers['x-sync-secret'] || req.headers['x-priority-sync-secret'];
    if (got !== SYNC_SECRET) return res.status(401).json({ error: 'Bad secret' });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    db: { schema: 'fleet' },
    auth: { persistSession: false },
  });

  const startedAt = new Date();
  const t0 = Date.now();

  // Accept any of three shapes:
  //   1) raw array       — [vehicle, vehicle, ...]
  //   2) OData response  — {value: [vehicle, ...]}
  //   3) single vehicle  — {EQUIPMENT_ID: ..., METL_CARUSAGE_SUBFORM: [...]}
  // The third shape is what the Make iterator sends — one POST per vehicle.
  let body: { value?: PriorityVehicle[] } | PriorityVehicle | PriorityVehicle[] | undefined = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = undefined; }
  }
  const rawList: PriorityVehicle[] =
    Array.isArray(body) ? body :
    Array.isArray((body as { value?: PriorityVehicle[] })?.value) ? (body as { value: PriorityVehicle[] }).value :
    (body && typeof body === 'object' && 'EQUIPMENT_ID' in body) ? [body as PriorityVehicle] :
    [];

  if (rawList.length === 0) {
    const ct = req.headers['content-type'] ?? null;
    const bodyDiag = {
      type: typeof req.body,
      isArray: Array.isArray(req.body),
      keys: req.body && typeof req.body === 'object' ? Object.keys(req.body).slice(0, 10) : null,
      sample: typeof req.body === 'string' ? (req.body as string).slice(0, 400) : undefined,
      value: typeof req.body === 'number' || typeof req.body === 'boolean' ? req.body : undefined,
      contentType: Array.isArray(ct) ? ct.join(',') : ct,
    };
    await supabase.from('sync_log').insert({
      source: 'priority_full',
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      success: false,
      records_total: 0,
      duration_ms: Date.now() - t0,
      error: 'empty payload',
      metadata: bodyDiag,
    });
    return res.status(400).json({ error: 'empty payload', diag: bodyDiag });
  }

  const vehicles = rawList.filter(v => Number.isFinite(v.EQUIPMENT_ID));
  const vehicleIds = vehicles.map(v => v.EQUIPMENT_ID as number);

  // Bulk-load existing state up-front to keep round-trips O(1) instead of O(n).
  const [existingVehiclesRes, existingDriversRes, existingReportsRes] = await Promise.all([
    supabase.from('vehicles').select('id').in('id', vehicleIds),
    supabase.from('drivers').select('id, name, phone').not('phone', 'is', null),
    supabase.from('monthly_reports')
      .select('vehicle_id, report_year, report_month')
      .in('vehicle_id', vehicleIds),
  ]);

  if (existingVehiclesRes.error || existingDriversRes.error || existingReportsRes.error) {
    const err = existingVehiclesRes.error || existingDriversRes.error || existingReportsRes.error;
    await supabase.from('sync_log').insert({
      source: 'priority_full',
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      success: false,
      records_total: vehicles.length,
      duration_ms: Date.now() - t0,
      error: `prefetch: ${err?.message}`,
    });
    return res.status(500).json({ error: 'prefetch failed', detail: err?.message });
  }

  const existingVehicleIds = new Set((existingVehiclesRes.data ?? []).map(v => v.id));
  const driversByPhone = new Map<string, { id: number; name: string }>();
  for (const d of existingDriversRes.data ?? []) {
    if (d.phone) driversByPhone.set(d.phone, { id: d.id, name: d.name });
  }
  const existingReportKeys = new Set(
    (existingReportsRes.data ?? []).map(r => `${r.vehicle_id}-${r.report_year}-${r.report_month}`)
  );

  // Pass 1: collect drivers we need to create (by phone). One insert call below.
  const driversToCreate = new Map<string, { name: string; phone: string }>();
  for (const v of vehicles) {
    const phone = normalizePhone(v.EDPE_CELLPHONE);
    const name = (v.SNAME ?? '').trim();
    if (!phone || !name) continue;
    if (!driversByPhone.has(phone) && !driversToCreate.has(phone)) {
      driversToCreate.set(phone, { name, phone });
    }
  }

  let driversInserted = 0;
  if (driversToCreate.size > 0) {
    const { data: inserted, error: driverErr } = await supabase
      .from('drivers')
      .insert([...driversToCreate.values()])
      .select('id, name, phone');
    if (driverErr) {
      await supabase.from('sync_log').insert({
        source: 'priority_full',
        started_at: startedAt.toISOString(),
        finished_at: new Date().toISOString(),
        success: false,
        records_total: vehicles.length,
        duration_ms: Date.now() - t0,
        error: `drivers insert: ${driverErr.message}`,
      });
      return res.status(500).json({ error: 'drivers insert failed', detail: driverErr.message });
    }
    for (const d of inserted ?? []) {
      if (d.phone) driversByPhone.set(d.phone, { id: d.id, name: d.name });
    }
    driversInserted = inserted?.length ?? 0;
  }

  // Pass 2: build vehicle rows.
  // For new vehicles → full insert (including current_mileage as seed).
  // For existing vehicles → UPDATE only metadata + current_driver_id; never touch
  // is_active/is_inventory/current_mileage/last_report_* (owned by WhatsApp flow).
  const now = new Date().toISOString();
  type VehicleInsert = {
    id: number;
    plate_number: string | null;
    model: string | null;
    ownership_type: string | null;
    supplier: string | null;
    company: string | null;
    start_date: string | null;
    end_date: string | null;
    lease_end_date: string | null;
    license_end_date: string | null;
    rent_value: number | null;
    current_mileage: number;
    current_driver_id: number | null;
    last_synced_at: string;
  };
  type VehicleUpdate = Omit<VehicleInsert, 'current_mileage'>;

  const vehiclesToInsert: VehicleInsert[] = [];
  const vehiclesToUpdate: VehicleUpdate[] = [];

  for (const v of vehicles) {
    const id = v.EQUIPMENT_ID as number;
    const phone = normalizePhone(v.EDPE_CELLPHONE);
    const driverEntry = phone ? driversByPhone.get(phone) : undefined;

    const base = {
      id,
      plate_number: v.VEHICLENUMCH ?? null,
      model: v.MODEL ?? null,
      ownership_type: v.OWNERSHIPTYPE ?? null,
      supplier: v.SUPPLIER ?? null,
      company: v.DNAMETITLE ?? null,
      start_date: priorityDate(v.STARTDATE),
      end_date: priorityDate(v.ENDDATE),
      lease_end_date: priorityDate(v.RENTENDDATE),
      license_end_date: priorityDate(v.LICENSEENDDATE),
      rent_value: toNumOrNull(v.RENTVALUE),
      current_driver_id: driverEntry?.id ?? null,
      last_synced_at: now,
    };

    if (existingVehicleIds.has(id)) {
      vehiclesToUpdate.push(base);
    } else {
      vehiclesToInsert.push({
        ...base,
        current_mileage: toIntOrNull(v.MILEAGE) ?? 0,
      });
    }
  }

  let vehiclesInsertedCount = 0;
  let vehiclesUpdatedCount = 0;
  let vehiclesFailed = 0;

  if (vehiclesToInsert.length > 0) {
    const { data, error } = await supabase
      .from('vehicles')
      .insert(vehiclesToInsert)
      .select('id');
    if (error) {
      vehiclesFailed += vehiclesToInsert.length;
    } else {
      vehiclesInsertedCount = data?.length ?? 0;
    }
  }

  // Updates are per-row (no PostgREST bulk-update with different values per row).
  // Run in parallel with modest concurrency.
  const updateConcurrency = 10;
  for (let i = 0; i < vehiclesToUpdate.length; i += updateConcurrency) {
    const chunk = vehiclesToUpdate.slice(i, i + updateConcurrency);
    const results = await Promise.all(chunk.map(row => {
      const { id, ...patch } = row;
      return supabase.from('vehicles').update(patch).eq('id', id);
    }));
    for (const r of results) {
      if (r.error) vehiclesFailed += 1;
      else vehiclesUpdatedCount += 1;
    }
  }

  // Pass 3: build monthly_reports inserts. Skip any (vehicle, year, month) that
  // already exists — existing rows are locked regardless of source, by policy.
  type ReportInsert = {
    vehicle_id: number;
    driver_id: number | null;
    report_year: number;
    report_month: number;
    mileage: number;
    start_date: string | null;
    end_date: string | null;
    days: number | null;
    fuel_consumption: number | null;
    fuel_cost: number | null;
    source: string;
    reported_at: string;
  };

  const reportsToInsert: ReportInsert[] = [];
  let reportsSkippedExisting = 0;
  let reportsSkippedEmpty = 0;

  for (const v of vehicles) {
    const vehicleId = v.EQUIPMENT_ID as number;
    const phone = normalizePhone(v.EDPE_CELLPHONE);
    const driverEntry = phone ? driversByPhone.get(phone) : undefined;
    const subform = Array.isArray(v.METL_CARUSAGE_SUBFORM) ? v.METL_CARUSAGE_SUBFORM : [];

    for (const s of subform) {
      const mileage = toIntOrNull(s.MILEAGE);
      const year = toIntOrNull(s.GLNAME);
      const month = toIntOrNull(s.MONTHNUM);
      if (!mileage || mileage <= 0) { reportsSkippedEmpty += 1; continue; }
      if (!year || !month) { reportsSkippedEmpty += 1; continue; }

      const key = `${vehicleId}-${year}-${month}`;
      if (existingReportKeys.has(key)) { reportsSkippedExisting += 1; continue; }

      reportsToInsert.push({
        vehicle_id: vehicleId,
        driver_id: driverEntry?.id ?? null,
        report_year: year,
        report_month: month,
        mileage,
        start_date: priorityDate(s.SDATE),
        end_date: priorityDate(s.EDATE),
        days: toIntOrNull(s.DAYS),
        fuel_consumption: toNumOrNull(s.FUELCONSUMPTION),
        fuel_cost: toNumOrNull(s.FUELCOST),
        source: 'priority_sync',
        reported_at: now,
      });
      // Reserve the key so duplicates within the same payload don't double-insert.
      existingReportKeys.add(key);
    }
  }

  let reportsInsertedCount = 0;
  let reportsFailed = 0;

  if (reportsToInsert.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < reportsToInsert.length; i += chunkSize) {
      const chunk = reportsToInsert.slice(i, i + chunkSize);
      const { data, error } = await supabase
        .from('monthly_reports')
        .insert(chunk)
        .select('id');
      if (error) {
        reportsFailed += chunk.length;
      } else {
        reportsInsertedCount += data?.length ?? 0;
      }
    }
  }

  const durationMs = Date.now() - t0;
  const totalFailed = vehiclesFailed + reportsFailed;

  await supabase.from('sync_log').insert({
    source: 'priority_full',
    started_at: startedAt.toISOString(),
    finished_at: new Date().toISOString(),
    success: totalFailed === 0,
    records_total: vehicles.length,
    records_inserted: vehiclesInsertedCount + reportsInsertedCount,
    records_updated: vehiclesUpdatedCount,
    records_failed: totalFailed,
    duration_ms: durationMs,
    metadata: {
      drivers_inserted: driversInserted,
      vehicles_inserted: vehiclesInsertedCount,
      vehicles_updated: vehiclesUpdatedCount,
      vehicles_failed: vehiclesFailed,
      reports_inserted: reportsInsertedCount,
      reports_failed: reportsFailed,
      reports_skipped_existing: reportsSkippedExisting,
      reports_skipped_empty: reportsSkippedEmpty,
      payload_size: rawList.length,
    },
  });

  return res.status(200).json({
    ok: totalFailed === 0,
    duration_ms: durationMs,
    payload_vehicles: rawList.length,
    drivers_inserted: driversInserted,
    vehicles_inserted: vehiclesInsertedCount,
    vehicles_updated: vehiclesUpdatedCount,
    vehicles_failed: vehiclesFailed,
    reports_inserted: reportsInsertedCount,
    reports_failed: reportsFailed,
    reports_skipped_existing: reportsSkippedExisting,
    reports_skipped_empty: reportsSkippedEmpty,
  });
}
