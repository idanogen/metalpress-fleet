import type { MonthlyUsage } from '@/types/fleet';

/**
 * יעילות דלק (ק"מ לליטר) לפי הנוסחה של מעיין:
 *   ק"מ לליטר = ק"מ שנסעו בחודש ÷ ליטרים שתודלקו בחודש
 *
 * דקות חשובות:
 * - `mileage` ב-monthly_reports הוא קריאת מד-אוץ' **מצטברת** (אודומטר), לא ק"מ לחודש.
 *   לכן ק"מ שנסעו בחודש = קריאת החודש פחות קריאת החודש הקודם.
 * - מחשבים דלתא רק בין חודשים **עוקבים** עם קריאה תקינה. פער חודשים (חודש שלא דווח)
 *   או ירידת אודומטר (שגיאת נתונים / החלפת רכב) → ק"מ-לחודש לא ידוע (null), כדי לא
 *   לנפח את המספר.
 * - רכב חשמלי / חודש בלי תדלוק (ליטרים=0) → אין ק"מ לליטר (null).
 */

export interface MonthEfficiency {
  year: string;
  monthNum: number;
  kmDriven: number | null;
  liters: number;
  kmPerLiter: number | null;
}

function isConsecutive(prevYear: string, prevMonth: number, year: string, month: number): boolean {
  const py = Number(prevYear), y = Number(year);
  if (prevMonth === 12) return y === py + 1 && month === 1;
  return y === py && month === prevMonth + 1;
}

/** מפה מ-"year-monthNum" ליעילות החודש. מחושב מכל ההיסטוריה (צריך את החודש הקודם). */
export function computeEfficiency(monthlyUsage: MonthlyUsage[]): Map<string, MonthEfficiency> {
  const sorted = [...monthlyUsage].sort((a, b) =>
    a.year !== b.year ? a.year.localeCompare(b.year) : a.monthNum - b.monthNum,
  );
  const result = new Map<string, MonthEfficiency>();
  let last: { year: string; month: number; reading: number } | null = null;

  for (const m of sorted) {
    const reading = m.mileage > 0 ? m.mileage : null;
    const liters = m.fuelConsumption || 0;
    let kmDriven: number | null = null;

    if (
      reading !== null &&
      last !== null &&
      reading >= last.reading &&
      isConsecutive(last.year, last.month, m.year, m.monthNum)
    ) {
      kmDriven = reading - last.reading;
    }

    const kmPerLiter = kmDriven !== null && kmDriven > 0 && liters > 0 ? kmDriven / liters : null;
    result.set(`${m.year}-${m.monthNum}`, { year: m.year, monthNum: m.monthNum, kmDriven, liters, kmPerLiter });

    if (reading !== null) last = { year: m.year, month: m.monthNum, reading };
  }
  return result;
}

/**
 * יעילות שנתית = ק"מ שנסעו בשנה ÷ סך הליטרים שתודלקו בשנה.
 *
 * הק"מ מחושבים מ**הפרש קריאות האודומטר** בשנה (אחרונה פחות ראשונה), ולא מסכימת
 * דלתות חודשיות. כך המדד עומד בפערים בדיווח (חודש חסר לא "מוחק" את הק"מ שנסעו בו),
 * בניגוד לחישוב חודש-אחר-חודש שמפספס ק"מ סביב פערים ומטה את התוצאה כלפי מטה.
 * על פני שנה שלמה עיתוי המילויים (מיכל שמחזיק שבועות) מתקזז והמדד אמין.
 */
export function yearEfficiency(
  monthlyUsage: MonthlyUsage[],
  year: string,
): { kmDriven: number; liters: number; kmPerLiter: number | null } {
  const inYear = monthlyUsage.filter((m) => m.year === year);
  const readings = inYear.filter((m) => m.mileage > 0).map((m) => m.mileage);
  const liters = inYear.reduce((s, m) => s + (m.fuelConsumption || 0), 0);
  // צריך לפחות שתי קריאות אודומטר כדי לגזור מרחק שנסע.
  const kmDriven = readings.length >= 2 ? Math.max(...readings) - Math.min(...readings) : 0;
  const kmPerLiter = kmDriven > 0 && liters > 0 ? kmDriven / liters : null;
  return { kmDriven, liters, kmPerLiter };
}

/** עיצוב לתצוגה: "8.3" או "—". */
export function formatKmPerLiter(v: number | null): string {
  if (v === null || !Number.isFinite(v) || v <= 0) return '—';
  return v.toFixed(1);
}
