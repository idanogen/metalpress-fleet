import { supabase } from '@/lib/supabase';

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
  const seen = new Set<string>();
  return rows.filter(row => {
    const key = `${row.vehicle?.id ?? 'x'}-${row.parsed_year}-${row.parsed_month}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
): Promise<ResolveResult> {
  const adminSecret = import.meta.env.VITE_ADMIN_SECRET;
  const r = await fetch('/api/resolve-review', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(adminSecret ? { 'x-admin-secret': adminSecret } : {}),
    },
    body: JSON.stringify({ id, action, corrected_mileage: correctedMileage }),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(body?.error || `HTTP ${r.status}`);
  return body as ResolveResult;
}
