import type { Vehicle } from '@/types/fleet';

/**
 * ותק הרכב ושימוש מצטבר — בקשת עקול ניסימוב (בעלים) מ-22/7/2026,
 * שהובהרה ע"י מעיין דורי ב-6/8/2026:
 *
 *   "תאריך עלייה לכביש
 *    מספר החודשים שהרכב קיים - מתאריך העלייה לכביש ועד היום
 *    קילומטר מצטבר - קריאת הקילומטר העדכנית
 *    ממוצע ק"מ מצטבר לחודש - מחלקים את הקילומטר המצטבר במספר החודשים שהרכב קיים"
 *
 * ⚠️ שים לב להבדל מ-`getDriverAvgUsage`: שם הממוצע מחושב מהפרשי קריאות
 * אודומטר בין חודשים שדווחו בפועל, כלומר "כמה הרכב נוסע עכשיו". כאן הממוצע
 * הוא על פני כל חיי הרכב, כלומר "כמה הרכב נסע בממוצע מאז שעלה לכביש".
 * שני מדדים שונים שיכולים להיראות דומים. אין להחליף ביניהם.
 */
export interface VehicleTenure {
  /** תאריך עלייה לכביש (STARTDATE בפריוריטי) */
  onRoadSince: string | null;
  /** מספר חודשים מלאים מאז העלייה לכביש ועד היום. לעולם לא פחות מ-1. */
  monthsOnRoad: number | null;
  /** קריאת האודומטר העדכנית */
  cumulativeKm: number | null;
  /** ק"מ מצטבר חלקי מספר החודשים */
  avgKmPerMonth: number | null;
}

export function getVehicleTenure(vehicle: Vehicle, now: Date = new Date()): VehicleTenure {
  const empty: VehicleTenure = {
    onRoadSince: null, monthsOnRoad: null, cumulativeKm: null, avgKmPerMonth: null,
  };

  if (!vehicle.startDate) return empty;
  const start = new Date(vehicle.startDate);
  if (Number.isNaN(start.getTime())) return empty;
  // תאריך עתידי (רכב שטרם נמסר) אינו ותק.
  if (start.getTime() > now.getTime()) {
    return { ...empty, onRoadSince: vehicle.startDate };
  }

  // חודשים קלנדריים מלאים, לא חלוקה ב-30 יום: "מספר החודשים שהרכב קיים"
  // הוא מדד ניהולי, ורבע-חודש לא מעניין כאן.
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  // רכב שעלה לכביש החודש נחשב חודש אחד, אחרת נחלק באפס.
  const monthsOnRoad = Math.max(1, months);

  const cumulativeKm = vehicle.currentMileage > 0 ? vehicle.currentMileage : null;

  return {
    onRoadSince: vehicle.startDate,
    monthsOnRoad,
    cumulativeKm,
    avgKmPerMonth: cumulativeKm === null ? null : Math.round(cumulativeKm / monthsOnRoad),
  };
}

/** "3 שנים ו-2 חודשים" / "8 חודשים" / "חודש" */
export function formatTenure(months: number | null): string {
  if (months === null) return '—';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return rest === 1 ? 'חודש' : `${rest} חודשים`;
  const yearPart = years === 1 ? 'שנה' : years === 2 ? 'שנתיים' : `${years} שנים`;
  if (rest === 0) return yearPart;
  const monthPart = rest === 1 ? 'חודש' : `${rest} חודשים`;
  return `${yearPart} ו-${monthPart}`;
}
