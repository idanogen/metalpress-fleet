import { supabase } from '@/lib/supabase';

/**
 * גיל הסנכרון מפריוריטי, כפי שהוא נראה מהדשבורד עצמו.
 *
 * הרקע: ב-20/7/2026 הסנריו השבועי במייק נכבה אוטומטית (3 כשלים רצופים על
 * מודול המייל האחרון), והדשבורד הציג נתונים מיושנים 17 יום בלי שום סימן.
 * ההתראה היחידה שהייתה קיימת היא מייל הסיכום, כלומר בדיוק הערוץ שנשבר.
 * לכן הסימן הזה חייב לחיות בדשבורד עצמו ולא להסתמך על שום שירות חיצוני.
 *
 * שים לב: `lastUpdated` שב-Header הוא זמן ה-fetch של הדפדפן, לא זמן הסנכרון.
 * הוא תמיד "עכשיו" גם כשהנתונים בני שבועיים, ולכן אינו יכול לשמש לזה.
 */
export interface SyncHealth {
  lastSyncedAt: Date | null;
  daysSince: number | null;
  level: 'ok' | 'warning' | 'critical' | 'unknown';
}

/** הסנכרון רץ שבועי (יום שני 23:00), אז עד 8 ימים זה תקין. */
const WARNING_AFTER_DAYS = 8;
/** מעל שבועיים = לפחות שתי ריצות שבועיות שלא קרו. */
const CRITICAL_AFTER_DAYS = 14;

export async function fetchSyncHealth(): Promise<SyncHealth> {
  // הרכב שסונכרן הכי לאחרונה מייצג את הריצה האחרונה של הסנכרון.
  // מסננים חשבונות "שוטף" ורכבים לא פעילים כדי לא להיתלות בשורה חריגה.
  const { data, error } = await supabase
    .from('vehicles')
    .select('last_synced_at')
    .eq('is_active', true)
    .neq('model', 'שוטף')
    .not('last_synced_at', 'is', null)
    .order('last_synced_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.last_synced_at) {
    return { lastSyncedAt: null, daysSince: null, level: 'unknown' };
  }

  const lastSyncedAt = new Date(data.last_synced_at);
  const daysSince = Math.floor((Date.now() - lastSyncedAt.getTime()) / 86_400_000);

  const level: SyncHealth['level'] =
    daysSince >= CRITICAL_AFTER_DAYS ? 'critical'
    : daysSince >= WARNING_AFTER_DAYS ? 'warning'
    : 'ok';

  return { lastSyncedAt, daysSince, level };
}

/** "היום" / "אתמול" / "לפני יומיים" / "לפני 5 ימים" */
export function formatDaysAgo(days: number): string {
  if (days <= 0) return 'היום';
  if (days === 1) return 'אתמול';
  if (days === 2) return 'לפני יומיים';
  return `לפני ${days} ימים`;
}
