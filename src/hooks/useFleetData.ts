import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { vehiclesData } from '@/data/vehicles';
import { fetchFleetData } from '@/api/fleet';
import { getFleetStats, detectAnomalies, hasReported, getMonthData } from '@/lib/analytics';
import type { Vehicle } from '@/types/fleet';

// Default to previous month — drivers report in current month for last month
const now = new Date();
const defaultMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // getMonth() is 0-based, so March=2 → prev=2 (Feb)
const defaultYear = now.getMonth() === 0 ? String(now.getFullYear() - 1) : String(now.getFullYear());

export function useFleetData() {
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  const { data: vehicles = vehiclesData, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ['fleet-data'],
    queryFn: fetchFleetData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: vehiclesData,
  });

  const stats = useMemo(
    () => getFleetStats(vehicles, selectedYear, selectedMonth),
    [vehicles, selectedYear, selectedMonth]
  );

  const anomalies = useMemo(
    () => detectAnomalies(vehicles, selectedYear, selectedMonth),
    [vehicles, selectedYear, selectedMonth]
  );

  const reportedVehicles = useMemo(
    () => vehicles.filter(v => hasReported(v, selectedYear, selectedMonth)),
    [vehicles, selectedYear, selectedMonth]
  );

  const unreportedVehicles = useMemo(
    () => vehicles.filter(v => !hasReported(v, selectedYear, selectedMonth)),
    [vehicles, selectedYear, selectedMonth]
  );

  const getVehicleMonthData = (vehicle: Vehicle) =>
    getMonthData(vehicle, selectedYear, selectedMonth);

  return {
    vehicles,
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
