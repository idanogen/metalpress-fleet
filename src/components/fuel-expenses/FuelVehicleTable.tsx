import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, ArrowUpDown, User } from 'lucide-react';
import { VehicleImage } from '@/components/ui/VehicleImage';
import { formatKmPerLiter } from '@/lib/fuelEfficiency';
import type { VehicleFuelData, VehicleSortKey } from '@/lib/fuelStats';

interface FuelVehicleTableProps {
  year: string;
  /** שורות הרכבים אחרי סינון חברה, לפני חיפוש ומיון. */
  rows: VehicleFuelData[];
  /** כמה רכבים עם נתוני דלק יש בסך הכל, לשורת הסיכום. */
  totalRows: number;
  totalCost: number;
  onSelect: (vehicleId: number) => void;
}

export function FuelVehicleTable({ year, rows, totalRows, totalCost, onSelect }: FuelVehicleTableProps) {
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [vehicleSort, setVehicleSort] = useState<VehicleSortKey>('totalCost');
  const [vehicleSortDir, setVehicleSortDir] = useState<'asc' | 'desc'>('desc');

  const filteredVehicleFuelData = useMemo(() => {
    let result = rows;
    if (vehicleSearch) {
      const s = vehicleSearch.toLowerCase();
      result = result.filter(v =>
        v.driverName.toLowerCase().includes(s) ||
        v.model.toLowerCase().includes(s) ||
        v.plateNumber.includes(s)
      );
    }
    return [...result].sort((a, b) => {
      const dir = vehicleSortDir === 'asc' ? 1 : -1;
      if (vehicleSort === 'driverName') return a.driverName.localeCompare(b.driverName, 'he') * dir;
      // רכבים בלי ק"מ/ליטר (חשמלי / חסר נתונים) תמיד לתחתית
      if (vehicleSort === 'kmPerLiter') return ((a.kmPerLiter ?? -1) - (b.kmPerLiter ?? -1)) * dir;
      return ((a[vehicleSort] as number) - (b[vehicleSort] as number)) * dir;
    });
  }, [rows, vehicleSearch, vehicleSort, vehicleSortDir]);

  const toggleVehicleSort = (key: VehicleSortKey) => {
    if (vehicleSort === key) {
      setVehicleSortDir(vehicleSortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setVehicleSort(key);
      setVehicleSortDir('desc');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.95 }}
      className="glass-card overflow-hidden"
    >
      <div className="p-6 border-b border-white/30 flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-[#007AFF]" />
          <div>
            <h3 className="text-lg font-bold text-[#1d1d1f]">פירוט לפי נהג ורכב</h3>
            <p className="text-sm text-[#86868b]">{year} · {filteredVehicleFuelData.length} רכבים</p>
          </div>
        </div>
        <div className="relative flex-1 max-w-[280px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
          <input
            type="text"
            placeholder="חיפוש נהג, דגם, לוחית..."
            value={vehicleSearch}
            onChange={e => setVehicleSearch(e.target.value)}
            className="w-full bg-black/5 border-none rounded-xl pr-9 pl-3
              py-2.5 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
          />
        </div>
      </div>

      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="sticky top-0 bg-white/80 backdrop-blur-sm z-10">
            <tr className="border-b border-white/30">
              <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">
                <button onClick={() => toggleVehicleSort('driverName')} className="flex items-center gap-1 hover:text-[#007AFF]">
                  נהג <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">דגם</th>
              <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">לוחית</th>
              <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">חברה</th>
              <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">
                <button onClick={() => toggleVehicleSort('totalLiters')} className="flex items-center gap-1 hover:text-[#007AFF]">
                  ליטרים <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">
                <button onClick={() => toggleVehicleSort('kmPerLiter')} className="flex items-center gap-1 hover:text-[#007AFF]">
                  ק"מ/ליטר <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">
                <button onClick={() => toggleVehicleSort('totalCost')} className="flex items-center gap-1 hover:text-[#007AFF]">
                  עלות כוללת <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">
                <button onClick={() => toggleVehicleSort('avgMonthlyCost')} className="flex items-center gap-1 hover:text-[#007AFF]">
                  ממוצע חודשי <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">
                <button onClick={() => toggleVehicleSort('monthsReported')} className="flex items-center gap-1 hover:text-[#007AFF]">
                  חודשים <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">% מהסה"כ</th>
            </tr>
          </thead>
          <tbody>
            {filteredVehicleFuelData.map((v) => {
              const pct = totalCost > 0 ? (v.totalCost / totalCost) * 100 : 0;
              return (
                <tr
                  key={v.id}
                  onClick={() => onSelect(v.id)}
                  className="border-b border-black/[0.03] hover:bg-white/40 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-[#1d1d1f] whitespace-nowrap">{v.driverName}</td>
                  <td className="px-4 py-3 text-[#424245]">
                    <div className="flex items-center gap-2.5 max-w-[200px]">
                      <VehicleImage model={v.model} width={40} height={28} />
                      <span className="truncate text-xs">{v.model}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#86868b] font-mono text-xs">{v.plateNumber}</td>
                  <td className="px-4 py-3 text-[#424245] text-xs">{v.companyShort || '—'}</td>
                  <td className="px-4 py-3 text-[#424245]">{v.totalLiters.toLocaleString()}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {v.kmPerLiter != null ? (
                      <span className="font-bold text-[#34c759]">{formatKmPerLiter(v.kmPerLiter)}</span>
                    ) : (
                      <span className="text-[#c7c7cc]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-bold text-[#1d1d1f] whitespace-nowrap">₪{v.totalCost.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[#424245] whitespace-nowrap">₪{v.avgMonthlyCost.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[#424245] text-center">{v.monthsReported}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-black/5 rounded-full max-w-[80px]">
                        <div className="h-full rounded-full bg-[#007AFF]" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-[#86868b] min-w-[32px]">{pct.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredVehicleFuelData.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-[#86868b]">
                  אין נתוני דלק תואמים
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-3 border-t border-white/30 text-xs text-[#86868b]">
        מציג {filteredVehicleFuelData.length} מתוך {totalRows} רכבים עם נתוני דלק
      </div>
    </motion.div>
  );
}
