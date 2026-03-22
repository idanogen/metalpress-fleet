import type { Vehicle, MonthlyUsage, DriverAnomaly, FleetStats } from '@/types/fleet';

export function getMonthData(vehicle: Vehicle, year: string, monthNum: number): MonthlyUsage | undefined {
  if (!Array.isArray(vehicle.monthlyUsage)) return undefined;
  return vehicle.monthlyUsage.find(m => m.year === year && m.monthNum === monthNum);
}

export function hasReported(vehicle: Vehicle, year: string, monthNum: number): boolean {
  const month = getMonthData(vehicle, year, monthNum);
  return !!month && month.mileage > 0;
}

export function getDriverAvgUsage(vehicle: Vehicle, excludeYear?: string, excludeMonth?: number): number {
  const usage = Array.isArray(vehicle.monthlyUsage) ? vehicle.monthlyUsage : [];
  const months = usage.filter(m => {
    if (m.mileage <= 0) return false;
    if (excludeYear && excludeMonth && m.year === excludeYear && m.monthNum === excludeMonth) return false;
    return true;
  });
  if (months.length === 0) return 0;
  return months.reduce((sum, m) => sum + m.mileage, 0) / months.length;
}

export function getFleetStats(vehicles: Vehicle[], year: string, monthNum: number): FleetStats {
  const reported = vehicles.filter(v => hasReported(v, year, monthNum));
  const notReported = vehicles.filter(v => !hasReported(v, year, monthNum));

  const monthUsages = vehicles
    .map(v => getMonthData(v, year, monthNum))
    .filter((m): m is MonthlyUsage => !!m && m.mileage > 0);

  const totalKm = monthUsages.reduce((sum, m) => sum + m.mileage, 0);
  const avgKm = monthUsages.length > 0 ? totalKm / monthUsages.length : 0;

  const anomalies = detectAnomalies(vehicles, year, monthNum);

  return {
    totalVehicles: vehicles.length,
    totalDrivers: new Set(vehicles.map(v => v.driverName)).size,
    reportedThisMonth: reported.length,
    notReportedThisMonth: notReported.length,
    reportPercentage: vehicles.length > 0 ? (reported.length / vehicles.length) * 100 : 0,
    avgMonthlyKm: Math.round(avgKm),
    totalMonthlyKm: totalKm,
    anomalyCount: anomalies.length,
  };
}

export function detectAnomalies(vehicles: Vehicle[], year: string, monthNum: number): DriverAnomaly[] {
  const anomalies: DriverAnomaly[] = [];

  for (const vehicle of vehicles) {
    const monthData = getMonthData(vehicle, year, monthNum);
    if (!monthData) continue;

    const avg = getDriverAvgUsage(vehicle, year, monthNum);
    if (avg <= 0) continue;

    const currentUsage = monthData.mileage;
    if (currentUsage <= 0) continue;

    const deviation = ((currentUsage - avg) / avg) * 100;

    if (deviation > 30) {
      anomalies.push({
        vehicle,
        type: 'spike',
        currentValue: currentUsage,
        average: Math.round(avg),
        deviation: Math.round(deviation),
        monthName: monthData.monthName,
        year,
      });
    } else if (deviation < -30) {
      anomalies.push({
        vehicle,
        type: 'drop',
        currentValue: currentUsage,
        average: Math.round(avg),
        deviation: Math.round(deviation),
        monthName: monthData.monthName,
        year,
      });
    }
  }

  // Chronic no-report: 3+ consecutive months with mileage === 0
  for (const vehicle of vehicles) {
    let consecutive = 0;
    const sorted = [...vehicle.monthlyUsage].sort((a, b) => {
      if (a.year !== b.year) return b.year.localeCompare(a.year);
      return b.monthNum - a.monthNum;
    });

    for (const m of sorted) {
      if (m.mileage === 0) {
        consecutive++;
      } else {
        break;
      }
    }

    if (consecutive >= 3) {
      const alreadyAdded = anomalies.some(a => a.vehicle.id === vehicle.id && a.vehicle.plateNumber === vehicle.plateNumber);
      if (!alreadyAdded) {
        anomalies.push({
          vehicle,
          type: 'chronic_no_report',
          currentValue: consecutive,
          average: 0,
          deviation: 0,
          monthName: `${consecutive} חודשים`,
          year,
        });
      }
    }
  }

  return anomalies;
}

export function getOwnershipBreakdown(vehicles: Vehicle[]): { name: string; value: number }[] {
  const normalized: Record<string, string> = {
    'ליסינג': 'ליסינג',
    'ליסנג': 'ליסינג',
    'ליסניג': 'ליסינג',
    'ליסינכ': 'ליסינג',
    'חברה': 'חברה',
    'פרטית': 'פרטית',
    'פרטי': 'פרטית',
    'השכרה': 'השכרה',
    'השכרה\\ החכר': 'השכרה',
  };

  const counts: Record<string, number> = {};
  for (const v of vehicles) {
    const type = normalized[v.ownershipType] || v.ownershipType;
    counts[type] = (counts[type] || 0) + 1;
  }

  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function getSupplierBreakdown(vehicles: Vehicle[]): { name: string; value: number }[] {
  const counts: Record<string, number> = {};
  for (const v of vehicles) {
    const supplier = v.supplier || 'לא ידוע';
    counts[supplier] = (counts[supplier] || 0) + 1;
  }

  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function getTopDriversByUsage(vehicles: Vehicle[], year: string, monthNum: number, limit = 10): { name: string; km: number; model: string }[] {
  return vehicles
    .map(v => {
      const month = getMonthData(v, year, monthNum);
      return {
        name: v.driverName,
        km: month?.mileage || 0,
        model: v.model,
      };
    })
    .filter(d => d.km > 0)
    .sort((a, b) => b.km - a.km)
    .slice(0, limit);
}

export function getMonthlyTrend(vehicles: Vehicle[], months = 12): { month: string; totalKm: number; avgKm: number; count: number }[] {
  // Get all unique year-month combos, sorted
  const allMonths = new Map<string, { totalKm: number; count: number }>();

  for (const v of vehicles) {
    for (const m of v.monthlyUsage) {
      if (m.mileage <= 0) continue;
      const key = `${m.year}-${String(m.monthNum).padStart(2, '0')}`;
      const existing = allMonths.get(key) || { totalKm: 0, count: 0 };
      existing.totalKm += m.mileage;
      existing.count += 1;
      allMonths.set(key, existing);
    }
  }

  const sorted = [...allMonths.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, months)
    .reverse();

  const monthNames: Record<number, string> = {
    1: 'ינו', 2: 'פבר', 3: 'מרץ', 4: 'אפר', 5: 'מאי', 6: 'יונ',
    7: 'יול', 8: 'אוג', 9: 'ספט', 10: 'אוק', 11: 'נוב', 12: 'דצמ',
  };

  return sorted.map(([key, data]) => {
    const [year, monthStr] = key.split('-');
    const monthNum = parseInt(monthStr);
    return {
      month: `${monthNames[monthNum]} ${year.slice(2)}`,
      totalKm: data.totalKm,
      avgKm: Math.round(data.totalKm / data.count),
      count: data.count,
    };
  });
}

export function getAvailableMonths(vehicles: Vehicle[]): { year: string; monthNum: number; monthName: string }[] {
  const months = new Set<string>();
  const result: { year: string; monthNum: number; monthName: string }[] = [];

  for (const v of vehicles) {
    for (const m of v.monthlyUsage) {
      const key = `${m.year}-${m.monthNum}`;
      if (!months.has(key)) {
        months.add(key);
        result.push({ year: m.year, monthNum: m.monthNum, monthName: m.monthName });
      }
    }
  }

  return result.sort((a, b) => {
    if (a.year !== b.year) return b.year.localeCompare(a.year);
    return b.monthNum - a.monthNum;
  });
}

export const MONTH_NAMES: Record<number, string> = {
  1: 'ינואר', 2: 'פברואר', 3: 'מרץ', 4: 'אפריל', 5: 'מאי', 6: 'יוני',
  7: 'יולי', 8: 'אוגוסט', 9: 'ספטמבר', 10: 'אוקטובר', 11: 'נובמבר', 12: 'דצמבר',
};
