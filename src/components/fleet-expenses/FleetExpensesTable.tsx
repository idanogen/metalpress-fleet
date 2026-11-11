import { motion } from 'framer-motion';
import { Search, ArrowUpDown, ChevronLeft } from 'lucide-react';
import type { Vehicle, MonthlyUsage, ExpenseCategoryKey } from '@/types/fleet';
import { EXPENSE_CATEGORIES } from '@/types/fleet';
import { VehicleImage } from '@/components/ui/VehicleImage';
import { formatCurrency, shortenCompanyName } from './expenseUi';

interface FleetExpensesTableProps {
  vehiclesList: { vehicle: Vehicle; cost: number; usage: MonthlyUsage | null }[];
  activeCategories: Set<ExpenseCategoryKey>;
  search: string;
  setSearch: (value: string) => void;
  sortBy: 'cost' | 'name';
  setSortBy: (value: 'cost' | 'name') => void;
  setSelectedVehicle: (vehicle: Vehicle) => void;
}

export function FleetExpensesTable({
  vehiclesList, activeCategories, search, setSearch, sortBy, setSortBy, setSelectedVehicle,
}: FleetExpensesTableProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.64 }}
      className="glass-card overflow-hidden"
    >
      <div className="p-5 border-b border-white/30 flex flex-wrap items-center gap-3">
        <h3 className="text-base font-bold text-[#1d1d1f]">פירוט לפי רכב</h3>
        <span className="text-sm text-[#86868b]">{vehiclesList.length} רכבים</span>

        <div className="relative mr-auto flex-1 max-w-[280px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
          <input
            type="text"
            placeholder="חיפוש נהג, לוחית, דגם..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-black/5 border-none rounded-xl pr-9 pl-3
              py-2 text-sm placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
          />
        </div>

        <button
          onClick={() => setSortBy(sortBy === 'cost' ? 'name' : 'cost')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/5 text-xs font-bold text-[#424245] hover:bg-black/[0.08]"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          {sortBy === 'cost' ? 'לפי הוצאה' : 'לפי שם'}
        </button>
      </div>

      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full text-xs min-w-[700px]">
          <thead className="sticky top-0 bg-white/80 backdrop-blur-sm z-10">
            <tr className="border-b border-white/30">
              <th className="px-4 py-3 text-right font-bold text-[#86868b]">נהג / רכב</th>
              <th className="px-3 py-3 text-right font-bold text-[#86868b]">לוחית</th>
              <th className="px-3 py-3 text-right font-bold text-[#86868b]">חברה</th>
              <th className="px-3 py-3 text-right font-bold text-[#86868b]">סה״כ</th>
              <th className="px-3 py-3 text-right font-bold text-[#86868b]">פילוח</th>
            </tr>
          </thead>
          <tbody>
            {vehiclesList.map(({ vehicle, cost, usage }) => {
              const breakdown = usage ? EXPENSE_CATEGORIES
                .filter(c => activeCategories.has(c.key))
                .map(c => ({ ...c, value: Number(usage[c.key] || 0) }))
                .filter(c => c.value > 0)
                .sort((a, b) => b.value - a.value)
              : [];
              return (
                <tr
                  key={vehicle.id}
                  onClick={() => setSelectedVehicle(vehicle)}
                  className="border-b border-black/[0.03] hover:bg-[#007AFF]/5 transition-colors cursor-pointer group"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <VehicleImage model={vehicle.model} width={40} height={28} />
                      <div className="min-w-0">
                        <p className="font-bold text-[#1d1d1f] truncate">{vehicle.driverName}</p>
                        <p className="text-[10px] text-[#86868b] truncate">{vehicle.model}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[#424245] font-mono">{vehicle.plateNumber}</td>
                  <td className="px-3 py-2.5 text-[#86868b]">{shortenCompanyName(vehicle.company || '—')}</td>
                  <td className="px-3 py-2.5">
                    {cost > 0 ? (
                      <span className="font-bold text-[#1d1d1f]">{formatCurrency(cost)}</span>
                    ) : (
                      <span className="text-[#c7c7cc]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 flex-wrap flex-1">
                        {breakdown.length > 0 ? (
                          <>
                            {breakdown.slice(0, 5).map(item => (
                              <span
                                key={item.key}
                                title={`${item.label}: ${formatCurrency(item.value)}`}
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                style={{ backgroundColor: `${item.color}20`, color: item.color }}
                              >
                                {item.label} {formatCurrency(item.value)}
                              </span>
                            ))}
                            {breakdown.length > 5 && (
                              <span className="text-[10px] text-[#86868b]">+{breakdown.length - 5}</span>
                            )}
                          </>
                        ) : (
                          <span className="text-[#c7c7cc]">—</span>
                        )}
                      </div>
                      <ChevronLeft className="w-3.5 h-3.5 text-[#c7c7cc] group-hover:text-[#007AFF] transition-colors shrink-0" />
                    </div>
                  </td>
                </tr>
              );
            })}
            {vehiclesList.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[#86868b]">
                  אין רכבים להצגה
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
