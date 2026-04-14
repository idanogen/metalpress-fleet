import { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Vehicle } from '@/types/fleet';
import { getDriverAvgUsage, getMonthData, getMonthDelta } from '@/lib/analytics';
import { VehicleImage } from '@/components/ui/VehicleImage';

interface FleetTableProps {
  vehicles: Vehicle[];
  selectedYear: string;
  selectedMonth: number;
  onSelectVehicle: (vehicle: Vehicle) => void;
}

type SortField = 'driverName' | 'model' | 'plateNumber' | 'ownershipType' | 'mileage' | 'avg';
type SortDir = 'asc' | 'desc';

export function FleetTable({ vehicles, selectedYear, selectedMonth, onSelectVehicle }: FleetTableProps) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('driverName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const enriched = useMemo(() => {
    return vehicles.map(v => {
      const monthData = getMonthData(v, selectedYear, selectedMonth);
      const avg = getDriverAvgUsage(v);
      return {
        vehicle: v,
        mileage: getMonthDelta(v, selectedYear, selectedMonth),
        avg: Math.round(avg),
        reported: (monthData?.mileage || 0) > 0,
      };
    });
  }, [vehicles, selectedYear, selectedMonth]);

  const filtered = useMemo(() => {
    let result = enriched;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(d =>
        d.vehicle.driverName.includes(s) ||
        d.vehicle.model.toLowerCase().includes(s) ||
        d.vehicle.plateNumber.includes(s) ||
        d.vehicle.ownershipType.includes(s)
      );
    }

    result.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sortField) {
        case 'driverName': aVal = a.vehicle.driverName; bVal = b.vehicle.driverName; break;
        case 'model': aVal = a.vehicle.model; bVal = b.vehicle.model; break;
        case 'plateNumber': aVal = a.vehicle.plateNumber; bVal = b.vehicle.plateNumber; break;
        case 'ownershipType': aVal = a.vehicle.ownershipType; bVal = b.vehicle.ownershipType; break;
        case 'mileage': aVal = a.mileage; bVal = b.mileage; break;
        case 'avg': aVal = a.avg; bVal = b.avg; break;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal), 'he')
        : String(bVal).localeCompare(String(aVal), 'he');
    });

    return result;
  }, [enriched, search, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronsUpDown className="w-3 h-3 text-[#86868b]/50" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-[#007AFF]" />
      : <ChevronDown className="w-3 h-3 text-[#007AFF]" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.9 }}
      className="glass-card overflow-hidden"
    >
      <div className="p-6 border-b border-white/30 flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-[#1d1d1f] whitespace-nowrap">צי רכבים מלא</h2>
        <div className="relative max-w-xs w-full">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
          <input
            type="text"
            placeholder="חיפוש..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-black/5 border-none rounded-xl pr-9 pl-3 py-2.5 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
          />
        </div>
      </div>

      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="sticky top-0 z-10 bg-white/80 backdrop-blur-md">
            <tr className="border-b border-white/30">
              {[
                { field: 'driverName' as SortField, label: 'נהג' },
                { field: 'model' as SortField, label: 'דגם' },
                { field: 'plateNumber' as SortField, label: 'לוחית' },
                { field: 'ownershipType' as SortField, label: 'בעלות' },
                { field: 'mileage' as SortField, label: 'קילומטראז\'' },
                { field: 'avg' as SortField, label: 'ממוצע' },
              ].map(col => (
                <th
                  key={col.field}
                  onClick={() => handleSort(col.field)}
                  className="px-4 py-3 text-right text-xs font-bold text-[#86868b] cursor-pointer hover:text-[#424245] select-none"
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    <SortIcon field={col.field} />
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">דווח</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(row => (
              <tr
                key={`${row.vehicle.id}-${row.vehicle.plateNumber}`}
                onClick={() => onSelectVehicle(row.vehicle)}
                className="border-b border-black/[0.03] hover:bg-white/40 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 text-[#1d1d1f] font-medium">{row.vehicle.driverName}</td>
                <td className="px-4 py-3 text-[#424245]">
                  <div className="flex items-center gap-2.5 max-w-[250px]">
                    <VehicleImage model={row.vehicle.model} width={56} height={36} />
                    <span className="truncate">{row.vehicle.model}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[#86868b] font-mono text-xs">{row.vehicle.plateNumber}</td>
                <td className="px-4 py-3">
                  <span className="px-3 py-1 rounded-[20px] text-xs font-bold bg-black/[0.03] text-[#424245]">
                    {row.vehicle.ownershipType}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#1d1d1f] font-medium">{row.mileage > 0 ? row.mileage.toLocaleString() : '—'}</td>
                <td className="px-4 py-3 text-[#86868b]">{row.avg > 0 ? row.avg.toLocaleString() : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${row.reported ? 'bg-[#34c759]' : 'bg-[#ff9500]'}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-3 border-t border-white/30 text-xs text-[#86868b]">
        מציג {filtered.length} מתוך {vehicles.length} רכבים
      </div>
    </motion.div>
  );
}
