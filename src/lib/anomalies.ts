import { supabase } from '@/lib/supabase';

export interface CandidateVehicle {
  id: number;
  plate_number: string | null;
  model: string | null;
  current_mileage: number;
}

export interface PendingAnomaly {
  id: number;
  parsed_mileage: number;
  parsed_year: number;
  parsed_month: number;
  raw_text: string | null;
  received_at: string;
  error: string | null;
  driver: { id: number; name: string; phone: string | null } | null;
  vehicle: { id: number; plate_number: string | null; model: string | null; current_mileage: number } | null;
  // Only populated for ambiguous reports (driver had several active vehicles, so the
  // webhook couldn't pick one). The reviewer chooses the right plate from these.
  candidates?: CandidateVehicle[];
}

export async function fetchPendingAnomalies(): Promise<PendingAnomaly[]> {
  const { data, error } = await supabase
    .from('inbound_messages')
    .select(`
      id, parsed_mileage, parsed_year, parsed_month, raw_text, received_at, error,
      driver:drivers!matched_driver_id(id, name, phone),
      vehicle:vehicles!matched_vehicle_id(id, plate_number, model, current_mileage)
    `)
    .eq('status', 'pending_review')
    .order('received_at', { ascending: false });

  if (error) throw new Error(`Supabase pending_review read: ${error.message}`);
  const rows = (data ?? []) as unknown as PendingAnomaly[];

  // Dedup: same (vehicle, year, month) → keep only the most recent (rows already ordered desc).
  // Older duplicates will be auto-resolved as 'duplicate' when admin resolves the visible row.
  // Ambiguous rows have no vehicle, so key on the driver instead — otherwise two different
  // drivers' ambiguous reports for the same month would collide and one would vanish.
  const seen = new Set<string>();
  const deduped = rows.filter(row => {
    const scope = row.vehicle?.id ?? `d${row.driver?.id ?? 'x'}`;
    const key = `${scope}-${row.parsed_year}-${row.parsed_month}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Enrich ambiguous rows (no matched vehicle) with the driver's current active
  // vehicles, so the dashboard can offer a plate picker.
  const ambiguous = deduped.filter(r => !r.vehicle && r.driver);
  if (ambiguous.length) {
    const driverIds = [...new Set(ambiguous.map(r => r.driver!.id))];
    const { data: vrows } = await supabase
      .from('vehicles')
      .select('id, plate_number, model, current_mileage, current_driver_id')
      .in('current_driver_id', driverIds)
      .eq('is_active', true)
      .eq('is_inventory', false);

    const byDriver = new Map<number, CandidateVehicle[]>();
    for (const v of (vrows ?? []) as Array<CandidateVehicle & { current_driver_id: number }>) {
      const list = byDriver.get(v.current_driver_id) ?? [];
      list.push({ id: v.id, plate_number: v.plate_number, model: v.model, current_mileage: v.current_mileage });
      byDriver.set(v.current_driver_id, list);
    }
    for (const r of ambiguous) r.candidates = byDriver.get(r.driver!.id) ?? [];
  }

  return deduped;
}

export interface ResolveResult {
  ok: boolean;
  action: 'approve' | 'reject';
  mileage: number;
  heyyContactUpdated: boolean;
  priorityWritten: boolean;
  priorityNote: string | null;
}

export async function resolveAnomaly(
  id: number,
  action: 'approve' | 'reject',
  correctedMileage?: number,
  vehicleId?: number,
): Promise<ResolveResult> {
  const adminSecret = import.meta.env.VITE_ADMIN_SECRET;
  const r = await fetch('/api/resolve-review', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(adminSecret ? { 'x-admin-secret': adminSecret } : {}),
    },
    body: JSON.stringify({ id, action, corrected_mileage: correctedMileage, vehicle_id: vehicleId }),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(body?.error || `HTTP ${r.status}`);
  return body as ResolveResult;
}
