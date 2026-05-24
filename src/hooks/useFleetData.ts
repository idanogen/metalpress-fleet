import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchFleetData } from '@/api/fleet';
import { getFleetStats, detectAnomalies, hasReported, isApplicableForMonth, getMonthData } from '@/lib/analytics';
import { useSettings } from '@/components/settings/SettingsPage';
import type { Vehicle } from '@/types/fleet';

// Default to previous month — drivers report in current month for last month.
// Computed lazily inside useState so a tab left open across a month rollover
// gets the correct default on next mount, not a stale module-load snapshot.
function computeDefaultMonth(): { year: string; month: number } {
  const now = new Date();
  const month = now.getMonth() === 0 ? 12 : now.getMonth();
  const year = now.getMonth() === 0 ? String(now.getFullYear() - 1) : String(now.getFullYear());
  return { year, month };
}

export function useFleetData() {
  const [selectedYear, setSelectedYear] = useState(() => computeDefaultMonth().year);
  const [selectedMonth, setSelectedMonth] = useState(() => computeDefaultMonth().month);

  const { data: rawData = [], isLoading, error, dataUpdatedAt } = useQuery<Vehicle[]>({
    queryKey: ['fleet-data'],
    queryFn: fetchFleetData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    // "מושבת" = inactive in Priority — never display anywhere
    select: (data) => data.filter(v => v.driverName !== 'מושבת'),
  });

  // model='שוטף' = fictitious overhead accounts (one per company) for expenses
  // that don't belong to a specific vehicle — Pango subscriptions, fines on company
  // level, etc. Excluded from main fleet listings, shown in dedicated overhead page.
  const overheadAccounts = useMemo(
    () => rawData.filter(v => v.model === 'שוטף'),
    [rawData]
  );

  // All real vehicles (excludes overhead accounts).
  const allVehicles = useMemo(
    () => rawData.filter(v => v.model !== 'שוטף'),
    [rawData]
  );

  // Separate inventory from active fleet — inventory vehicles don't count in stats.
  const vehicles = useMemo(() => allVehicles.filter(v => v.driverName !== 'מלאי'), [allVehicles]);
  const inventoryVehicles = useMemo(() => allVehicles.filter(v => v.driverName === 'מלאי'), [allVehicles]);
  const inventoryCount = inventoryVehicles.length;

  const { anomalyThreshold } = useSettings();

  const stats = useMemo(
    () => getFleetStats(vehicles, selectedYear, selectedMonth, anomalyThreshold),
    [vehicles, selectedYear, selectedMonth, anomalyThreshold]
  );

  const anomalies = useMemo(
    () => detectAnomalies(vehicles, selectedYear, selectedMonth, anomalyThreshold),
    [vehicles, selectedYear, selectedMonth, anomalyThreshold]
  );

  const reportedVehicles = useMemo(
    () => vehicles.filter(v => hasReported(v, selectedYear, selectedMonth)),
    [vehicles, selectedYear, selectedMonth]
  );

  const unreportedVehicles = useMemo(
    () => vehicles.filter(v =>
      isApplicableForMonth(v, selectedYear, selectedMonth) &&
      !hasReported(v, selectedYear, selectedMonth)
    ),
    [vehicles, selectedYear, selectedMonth]
  );

  const getVehicleMonthData = (vehicle: Vehicle) =>
    getMonthData(vehicle, selectedYear, selectedMonth);

  return {
    vehicles,
    allVehicles,
    inventoryVehicles,
    inventoryCount,
    overheadAccounts,
    stats,
    anomalies,
    reportedVehicles,
    unreportedVehicles,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    getVehicleMonthData,
    isLoading,
    error,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
  };
}
