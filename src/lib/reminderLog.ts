import { supabase } from '@/lib/supabase';

export interface ReminderLogRow {
  id: number;
  vehicle_id: number;
  sent_at: string;
  report_year: number;
  report_month: number;
  status: string;
}

export async function fetchReminders(
  year: number,
  month: number,
): Promise<ReminderLogRow[]> {
  const { data, error } = await supabase
    .from('reminder_log')
    .select('id, vehicle_id, sent_at, report_year, report_month, status')
    .eq('report_year', year)
    .eq('report_month', month)
    .order('sent_at', { ascending: true });

  if (error) throw new Error(`Supabase reminder_log read: ${error.message}`);
  return (data ?? []) as ReminderLogRow[];
}

export async function insertReminder(
  vehicleId: number,
  year: number,
  month: number,
): Promise<ReminderLogRow> {
  const { data, error } = await supabase
    .from('reminder_log')
    .insert({
      vehicle_id: vehicleId,
      report_year: year,
      report_month: month,
      provider: 'heyy',
      status: 'sent',
    })
    .select('id, vehicle_id, sent_at, report_year, report_month, status')
    .single();

  if (error) throw new Error(`Supabase reminder_log insert: ${error.message}`);
  return data as ReminderLogRow;
}
