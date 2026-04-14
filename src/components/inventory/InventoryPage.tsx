import { useState, useMemo } from 'react';
import { Search, Package, Building2, Gauge, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Vehicle } from '@/types/fleet';
import { VehicleImage } from '@/components/ui/VehicleImage';
import { formatDateHebrew } from '@/lib/fleetDates';

interface InventoryPageProps {
  vehicles: Vehicle[];
  onSelectVehicle: (vehicle: Vehicle) => void;
}

export function InventoryPage({ vehicles, onSelectVehicle }: InventoryPageProps) {
  const [search, setSearch] = useState('');
  const [filterCompany, setFilterCompany] = useState('all');
  const [filterSupplier, setFilterSupplier] = useState('all');
  const [filterUsed, setFilterUsed] = useState<'all' | 'used' | 'unused'>('all');

  const companies = useMemo(() => {
    const set = new Set(vehicles.map(v => v.company).filter(Boolean));
    return Array.from(set).sort();
  }, [vehicles]);

  const suppliers = useMemo(() => {
    const set = new Set(vehicles.map(v => v.supplier).filter(Boolean));
    return Array.from(set).sort();
  }, [vehicles]);

  const filtered = useMemo(() => {
    let result = vehicles;
    if (filterCompany !== 'all') result = result.filter(v => v.company === filterCompany);
    if (filterSupplier !== 'all') result = result.filter(v => v.supplier === filterSupplier);
    if (filterUsed === 'used') result = result.filter(v => v.currentMileage > 0);
    if (filterUsed === 'unused') result = result.filter(v => !v.currentMileage);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(v =>
        v.model.toLowerCase().includes(s) ||
        v.plateNumber.includes(s) ||
        v.supplier?.toLowerCase().includes(s) ||
        v.company?.toLowerCase().includes(s)
      );
    }
    return result;
  }, [vehicles, search, filterCompany, filterSupplier, filterUsed]);

  const stats = useMemo(() => {
    const used = vehicles.filter(v => v.currentMileage > 0).length;
    const totalKm = vehicles.reduce((sum, v) => sum + (v.currentMileage || 0), 0);
    return { total: vehicles.length, used, unused: vehicles.length - used, totalKm };
  }, [vehicles]);

  const summaryCards = [
    { key: 'total', label: 'סה"כ במלאי', value: stats.total, icon: Package, iconBg: 'bg-[#ff9500]/10', iconColor: 'text-[#ff9500]' },
    { key: 'unused', label: 'ללא ק"מ', value: stats.unused, icon: Package, iconBg: 'bg-[#34c759]/10', iconColor: 'text-[#248a3d]' },
    { key: 'used', label: 'עם ק"מ צבור', value: stats.used, icon: Gauge, iconBg: 'bg-[#007AFF]/10', iconColor: 'text-[#007AFF]' },
    { key: 'totalKm', label: 'סה"כ ק"מ', value: stats.totalKm.toLocaleString(), icon: Gauge, iconBg: 'bg-[#5856D6]/10', iconColor: 'text-[#5856D6]' },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        {summaryCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
            >
              <div className="glass-card p-4 lg:p-6 hover:translate-y-[-8px] transition-all duration-300 cursor-default">
                <div className={`w-10 h-10 rounded-2xl ${card.iconBg} flex items-center justify-center mb-4`}>
                  <Icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
                <span className="text-3xl font-extrabold text-[#1d1d1f]">{card.value}</span>
                <p className="text-sm text-[#86868b] mt-1">{card.label}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="glass-card p-5"
      >
        <div className="flex flex-wrap items-center gap-3 lg:gap-4">
          <div className="relative flex-1 max-w-[260px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
            <input
              type="text"
              placeholder="חיפוש דגם, לוחית, ספק..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-black/5 border-none rounded-xl pr-9 pl-3 py-2.5 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
            />
          </div>

          <div className="h-8 w-px bg-black/10 hidden lg:block" />

          {/* Used / unused */}
          <div className="flex items-center bg-black/5 rounded-2xl p-1">
            {([
              { value: 'all', label: 'הכל' },
              { value: 'unused', label: 'ללא ק"מ' },
              { value: 'used', label: 'עם ק"מ' },
            ] as const).map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilterUsed(opt.value)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterUsed === opt.value
                    ? 'bg-white text-[#ff9500] shadow-sm'
                    : 'text-[#86868b] hover:text-[#424245]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Company */}
          {companies.length > 0 && (
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#86868b]" />
              <select
                value={filterCompany}
                onChange={e => setFilterCompany(e.target.value)}
                className="bg-black/5 border-none rounded-xl px-3 py-2 text-xs font-bold text-[#424245] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 cursor-pointer max-w-[180px]"
              >
                <option value="all">כל החברות</option>
                {companies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {/* Supplier */}
          {suppliers.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#86868b]">ספק:</span>
              <select
                value={filterSupplier}
                onChange={e => setFilterSupplier(e.target.value)}
                className="bg-black/5 border-none rounded-xl px-3 py-2 text-xs font-bold text-[#424245] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 cursor-pointer"
              >
                <option value="all">הכל</option>
                {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="glass-card overflow-hidden"
      >
        <div className="p-6 border-b border-white/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#ff9500]" />
            <h2 className="text-lg font-bold text-[#1d1d1f]">רכבי מלאי</h2>
          </div>
          <span className="text-sm text-[#86868b]">{filtered.length} רכבים</span>
        </div>

        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead className="sticky top-0 bg-white/80 backdrop-blur-sm z-10">
              <tr className="border-b border-white/30">
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">ID</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">דגם</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">לוחית</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">ק"מ צבור</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">בעלות</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">ספק</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">חברה</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">סיום ליסינג</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">סיום רישוי</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">דמי שכירות</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">דיווח אחרון</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((vehicle) => (
                <tr
                  key={vehicle.id}
                  onClick={() => onSelectVehicle(vehicle)}
                  className="border-b border-black/[0.03] hover:bg-white/40 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-[#86868b] font-mono text-xs">{vehicle.id}</td>
                  <td className="px-4 py-3 text-[#1d1d1f]">
                    <div className="flex items-center gap-2.5 max-w-[220px]">
                      <VehicleImage model={vehicle.model} width={48} height={32} />
                      <span className="truncate font-medium">{vehicle.model || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#86868b] font-mono text-xs">{vehicle.plateNumber || '—'}</td>
                  <td className="px-4 py-3 text-[#424245]">
                    {vehicle.currentMileage ? (
                      <span className="font-medium">{vehicle.currentMileage.toLocaleString()}</span>
                    ) : (
                      <span className="text-[#c7c7cc]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#424245] text-xs">{vehicle.ownershipType || '—'}</td>
                  <td className="px-4 py-3 text-[#424245] text-xs">{vehicle.supplier || '—'}</td>
                  <td className="px-4 py-3 text-[#424245] text-xs max-w-[160px] truncate">{vehicle.company || '—'}</td>
                  <td className="px-4 py-3 text-[#424245] text-xs whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {vehicle.leaseEndDate && <Calendar className="w-3 h-3 text-[#86868b]" />}
                      {formatDateHebrew(vehicle.leaseEndDate)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#424245] text-xs whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {vehicle.licenseEndDate && <Calendar className="w-3 h-3 text-[#86868b]" />}
                      {formatDateHebrew(vehicle.licenseEndDate)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#424245] text-xs">
                    {vehicle.rentValue ? `₪${vehicle.rentValue.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-[#424245] text-xs">
                    {vehicle.lastReportMonth && vehicle.lastReportYear
                      ? `${vehicle.lastReportMonth} ${vehicle.lastReportYear}`
                      : <span className="text-[#c7c7cc]">לא דווח</span>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-[#86868b]">
                    אין רכבי מלאי תואמים
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 border-t border-white/30 text-xs text-[#86868b]">
          מציג {filtered.length} מתוך {vehicles.length} רכבי מלאי
        </div>
      </motion.div>
    </div>
  );
}
