import { supabase } from '@/lib/supabase';

export type SendStatus = 'pending' | 'accepted' | 'failed';
export type DeliveryStatus = 'sent' | 'delivered' | 'read' | 'failed' | 'undelivered' | null;
export type MessageKind = 'month_open' | 'reminder' | 'manual';

export interface MessageLogRow {
  kind: MessageKind;
  driver_id: number | null;
  driver_name: string | null;
  phone: string | null;
  send_status: SendStatus;
  delivery_status: DeliveryStatus;
  error: string | null;
  updated_at: string;
}

/** יומן ההודעות היוצאות לנהגים לתקופת דיווח (report_year/report_month, 1-based). */
export async function fetchMessageLog(year: number, month: number): Promise<MessageLogRow[]> {
  const { data, error } = await supabase
    .from('message_log')
    .select('kind, driver_id, driver_name, phone, send_status, delivery_status, error, updated_at')
    .eq('report_year', year)
    .eq('report_month', month);
  if (error) throw new Error(`message_log read: ${error.message}`);
  return (data ?? []) as MessageLogRow[];
}

/** מפתח התאמה בין טלפון מקומי (0523...) לבינלאומי (+97252...) — 9 הספרות האחרונות. */
export function phoneKey(phone?: string | null): string {
  return (phone ?? '').replace(/\D/g, '').slice(-9);
}

export type EffectiveStatus = 'read' | 'delivered' | 'sent' | 'failed' | 'not_sent';

/** מאחד send_status + delivery_status לסטטוס אחד להצגה. */
export function effectiveStatus(row: MessageLogRow | undefined): EffectiveStatus {
  if (!row) return 'not_sent';
  if (row.delivery_status === 'read') return 'read';
  if (row.delivery_status === 'delivered') return 'delivered';
  if (row.delivery_status === 'failed' || row.delivery_status === 'undelivered') return 'failed';
  if (row.delivery_status === 'sent') return 'sent';
  if (row.send_status === 'accepted') return 'sent';
  if (row.send_status === 'failed') return 'failed';
  return 'not_sent';
}

/** האם ההודעה הגיעה לנהג (נמסרה/נקראה, או לפחות נשלחה בהצלחה). */
export function reachedDriver(s: EffectiveStatus): boolean {
  return s === 'read' || s === 'delivered' || s === 'sent';
}
