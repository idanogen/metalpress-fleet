import type { Vehicle } from '@/types/fleet';
import { yearEfficiency } from '@/lib/fuelEfficiency';
import { isInventoryVehicle } from '@/lib/analytics';

export const FUEL_COLORS = ['#007AFF', '#34c759', '#ff9500', '#ff3b30', '#5856D6', '#ff2d55', '#5ac8fa', '#af52de'];

export const MONTH_NAMES_FULL = [
  '', 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];
export const MONTH_NAMES = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];

export const COMPANY_SHORT_NAMES: Record<string, string> = {
  'מטלפרס פתרונות חכמים בע"מ': 'פתרונות',
  'מטלפרס דלתות ומחיצות אש בע"מ': 'דלתות',
  'מטלפרס שירות בע"מ': 'שירות',
  'מטלפרס ניהול עשן בע"מ': 'ניהול עשן',
  "מטלפרס ייצוא (1982) בע'מ": 'ייצוא',
  'מטלפרס מיגון אש בע"מ': 'מיגון אש',
  'פ.א כוכב 2018 בע"מ': 'כוכב',
};

export function shortenCompanyName(name: string): string {
  return COMPANY_SHORT_NAMES[name] || name;
}

export interface CompanyFuelData {
  name: string;
  shortName: string;
  totalCost: number;
  totalLiters: number;
  vehicleCount: number;
  avgCostPerVehicle: number;
  avgLitersPerVehicle: number;
  months: { month: string; cost: number; liters: number }[];
}

export function getCompanyFuelBreakdown(vehicles: Vehicle[], year: string): CompanyFuelData[] {
  const map = new Map<string, { cost: number; liters: number; vehicles: Set<number>; months: Map<number, { cost: number; liters: number }> }>();

  for (const v of vehicles) {
    if (!v.company) continue;
    const company = v.company.trim();
    if (!map.has(company)) {
      map.set(company, { cost: 0, liters: 0, vehicles: new Set(), months: new Map() });
    }
    const entry = map.get(company)!;
    // נספר רק רכב שתדלק בשנה, כדי שהממוצע לרכב יהיה ממוצע לרכב שצרך דלק.
    const fueled = v.monthlyUsage.some(m => m.year === year && ((m.fuelCost || 0) > 0 || (m.fuelConsumption || 0) > 0));
    if (fueled) entry.vehicles.add(v.id);

    for (const m of v.monthlyUsage) {
      if (m.year !== year) continue;
      entry.cost += m.fuelCost || 0;
      entry.liters += m.fuelConsumption || 0;

      const monthNum = m.monthNum;
      if (!entry.months.has(monthNum)) {
        entry.months.set(monthNum, { cost: 0, liters: 0 });
      }
      const me = entry.months.get(monthNum)!;
      me.cost += m.fuelCost || 0;
      me.liters += m.fuelConsumption || 0;
    }
  }

  return Array.from(map.entries())
    .map(([name, data]) => ({
      name,
      shortName: shortenCompanyName(name),
      totalCost: Math.round(data.cost),
      totalLiters: Math.round(data.liters),
      vehicleCount: data.vehicles.size,
      avgCostPerVehicle: data.vehicles.size > 0 ? Math.round(data.cost / data.vehicles.size) : 0,
      avgLitersPerVehicle: data.vehicles.size > 0 ? Math.round(data.liters / data.vehicles.size) : 0,
      months: MONTH_NAMES.map((month, i) => {
        const me = data.months.get(i + 1);
        return { month, cost: Math.round(me?.cost || 0), liters: Math.round(me?.liters || 0) };
      }),
    }))
    .filter(c => c.totalCost > 0)
    .sort((a, b) => b.totalCost - a.totalCost);
}

export interface VehicleFuelData {
  id: number;
  driverName: string;
  model: string;
  plateNumber: string;
  company: string;
  companyShort: string;
  totalCost: number;
  totalLiters: number;
  monthsReported: number;
  avgMonthlyCost: number;
  currentMileage: number;
  kmPerLiter: number | null;
  isInventory: boolean;
}

export function getVehicleFuelBreakdown(vehicles: Vehicle[], year: string): VehicleFuelData[] {
  return vehicles
    .map(v => {
      let cost = 0;
      let liters = 0;
      let months = 0;
      for (const m of v.monthlyUsage) {
        if (m.year !== year) continue;
        if ((m.fuelCost || 0) > 0 || (m.fuelConsumption || 0) > 0) {
          cost += m.fuelCost || 0;
          liters += m.fuelConsumption || 0;
          months++;
        }
      }
      return {
        id: v.id,
        driverName: v.driverName || '—',
        model: v.model || '—',
        plateNumber: v.plateNumber || '—',
        company: v.company || '',
        companyShort: shortenCompanyName(v.company || ''),
        totalCost: Math.round(cost),
        totalLiters: Math.round(liters),
        monthsReported: months,
        avgMonthlyCost: months > 0 ? Math.round(cost / months) : 0,
        currentMileage: v.currentMileage || 0,
        kmPerLiter: yearEfficiency(v.monthlyUsage, year).kmPerLiter,
        isInventory: isInventoryVehicle(v),
      };
    })
    .filter(v => v.totalCost > 0 || v.totalLiters > 0);
}

export type VehicleSortKey = 'totalCost' | 'totalLiters' | 'avgMonthlyCost' | 'driverName' | 'monthsReported' | 'kmPerLiter';

/** החודש האחרון בשנה שיש בו נתוני דלק. שנה שעדיין רצה מושווית רק מול אותם חודשים
 * בשנה הקודמת, אחרת עשרה חודשים מושווים מול שנים עשר. */
export function getLastFuelMonth(vehicles: Vehicle[], year: string): number {
  let last = 0;
  for (const v of vehicles) {
    for (const m of v.monthlyUsage) {
      if (m.year === year && (m.fuelCost || 0) > 0 && m.monthNum > last) last = m.monthNum;
    }
  }
  return last;
}

export function getYearOverYearChange(vehicles: Vehicle[], currentYear: string, lastMonth: number) {
  const prevYear = String(Number(currentYear) - 1);
  let currentTotal = 0;
  let prevTotal = 0;

  for (const v of vehicles) {
    for (const m of v.monthlyUsage) {
      if (m.year === currentYear) currentTotal += m.fuelCost || 0;
      if (m.year === prevYear && m.monthNum <= lastMonth) prevTotal += m.fuelCost || 0;
    }
  }

  const change = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0;
  return { currentTotal: Math.round(currentTotal), prevTotal: Math.round(prevTotal), change: Math.round(change) };
}

export function getMonthlyFuelTrend(vehicles: Vehicle[], year: string) {
  const monthly = new Map<number, { cost: number; liters: number }>();

  for (const v of vehicles) {
    for (const m of v.monthlyUsage) {
      if (m.year !== year) continue;
      if (!monthly.has(m.monthNum)) monthly.set(m.monthNum, { cost: 0, liters: 0 });
      const entry = monthly.get(m.monthNum)!;
      entry.cost += m.fuelCost || 0;
      entry.liters += m.fuelConsumption || 0;
    }
  }

  return MONTH_NAMES.map((month, i) => {
    const data = monthly.get(i + 1);
    return { month, cost: Math.round(data?.cost || 0), liters: Math.round(data?.liters || 0) };
  }).filter(m => m.cost > 0 || m.liters > 0);
}

export interface CompanyYoYData {
  shortName: string;
  currentYear: number;
  prevYear: number;
  diff: number;
  diffPercent: number;
}

export function getCompanyYoYComparison(vehicles: Vehicle[], currentYear: string, lastMonth: number): CompanyYoYData[] {
  const prevYear = String(Number(currentYear) - 1);
  const map = new Map<string, { current: number; prev: number }>();

  for (const v of vehicles) {
    if (!v.company) continue;
    const company = v.company.trim();
    const short = shortenCompanyName(company);
    if (!map.has(short)) map.set(short, { current: 0, prev: 0 });
    const entry = map.get(short)!;

    for (const m of v.monthlyUsage) {
      if (m.year === currentYear) entry.current += m.fuelCost || 0;
      if (m.year === prevYear && m.monthNum <= lastMonth) entry.prev += m.fuelCost || 0;
    }
  }

  return Array.from(map.entries())
    .map(([shortName, data]) => ({
      shortName,
      currentYear: Math.round(data.current),
      prevYear: Math.round(data.prev),
      diff: Math.round(data.current - data.prev),
      diffPercent: data.prev > 0 ? Math.round(((data.current - data.prev) / data.prev) * 100) : 0,
    }))
    .filter(c => c.currentYear > 0 || c.prevYear > 0)
    .sort((a, b) => b.currentYear - a.currentYear);
}

export function getAvailableYears(vehicles: Vehicle[]): string[] {
  const years = new Set<string>();
  for (const v of vehicles) {
    for (const m of v.monthlyUsage) {
      if ((m.fuelCost || 0) > 0) years.add(m.year);
    }
  }
  return Array.from(years).sort().reverse();
}

/** סך עלות הדלק והליטרים לשנה. מקור אחד למסך הדלק ולדוח הדלק, כדי שהסכומים זהים. */
export function getFuelTotals(vehicles: Vehicle[], year: string): { totalCost: number; totalLiters: number } {
  let cost = 0;
  let liters = 0;
  for (const v of vehicles) {
    for (const m of v.monthlyUsage) {
      if (m.year !== year) continue;
      cost += m.fuelCost || 0;
      liters += m.fuelConsumption || 0;
    }
  }
  return { totalCost: Math.round(cost), totalLiters: Math.round(liters) };
}
