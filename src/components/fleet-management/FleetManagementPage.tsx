import { useState, useMemo } from 'react';
import { Search, AlertTriangle, Clock, ShieldCheck, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Vehicle, UrgencyLevel, DateType } from '@/types/fleet';
import {
  getUniqueSuppliers,
  getUrgencyColor,
  getUrgencyLevel,
  getDaysUntil,
  formatDateHebrew,
  getDaysLabel,
  URGENCY_LABELS,
} from '@/lib/fleetDates';
import { VehicleImage } from '@/components/ui/VehicleImage';

const INVENTORY_DRIVER_NAME = 'מלאי';
type TabType = DateType | 'inventory';

interface FleetManagementPageProps {
  vehicles: Vehicle[];
  onSelectVehicle: (vehicle: Vehicle) => void;
}

function DateCell({ dateStr }: { dateStr: string }) {
  if (!dateStr) return <span className="text-[#c7c7cc]">—</span>;

  const days = getDaysUntil(dateStr);
  const level = getUrgencyLevel(dateStr);
  const color = getUrgencyColor(level);

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${color.dot}`} />
      <div className="flex flex-col gap-0.5">
        <span className="text-[#1d1d1f] text-sm">{formatDateHebrew(dateStr)}</span>
        <span className={`text-xs font-bold ${color.text}`}>
          {level === 'expired' && (
            <span className={`inline-block px-1.5 py-0.5 rounded-md text-[10px] ml-1 ${color.badge}`}>
              {URGENCY_LABELS.expired}
            </span>
          )}
          {getDaysLabel(days)}
        </span>
      </div>
    </div>
  );
}

export function FleetManagementPage({ vehicles, onSelectVehicle }: FleetManagementPageProps) {
  const [activeTab, setActiveTab] = useState<TabType>('lease');
  const [search, setSearch] = useState('');
  const [filterUrgency, setFilterUrgency] = useState<UrgencyLevel | 'all'>('all');
  const [filterSupplier, setFilterSupplier] = useState('all');

  const isInventoryTab = activeTab === 'inventory';
  const dateField = activeTab === 'lease' ? 'leaseEndDate' : 'licenseEndDate' as const;
  const tableTitle = activeTab === 'lease' ? 'סיום ליסינג' : activeTab === 'license' ? 'סיום רישוי' : 'מלאי';

  // Separate inventory from regular vehicles
  const regularVehicles = useMemo(() => vehicles.filter(v => v.driverName !== INVENTORY_DRIVER_NAME), [vehicles]);
  const inventoryVehicles = useMemo(() => vehicles.filter(v => v.driverName === INVENTORY_DRIVER_NAME), [vehicles]);

  const suppliers = useMemo(() => getUniqueSuppliers(regularVehicles), [regularVehicles]);

  const vehicleRows = useMemo(() => {
    if (isInventoryTab) return inventoryVehicles;
    return [...regularVehicles]
      .filter(v => v[dateField])
      .sort((a, b) => getDaysUntil(a[dateField]) - getDaysUntil(b[dateField]));
  }, [regularVehicles, inventoryVehicles, isInventoryTab, dateField]);

  const filtered = useMemo(() => {
    let result = vehicleRows;

    if (!isInventoryTab && filterUrgency !== 'all') {
      result = result.filter(v => getUrgencyLevel(v[dateField]) === filterUrgency);
    }
    if (!isInventoryTab && filterSupplier !== 'all') {
      result = result.filter(v => v.supplier === filterSupplier);
    }
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(v =>
        v.driverName.includes(s) ||
        v.model.toLowerCase().includes(s) ||
        v.plateNumber.includes(s)
      );
    }

    return result;
  }, [vehicleRows, isInventoryTab, dateField, filterUrgency, filterSupplier, search]);

  const counts = useMemo(() => {
    const c = { expired: 0, critical: 0, warning: 0, soon: 0, ok: 0 };
    for (const v of vehicleRows) {
      const level = getUrgencyLevel(v[dateField]);
      c[level]++;
    }
    return c;
  }, [vehicleRows, dateField]);

  const summaryCards = [
    {
      key: 'expired',
      label: 'פג תוקף',
      value: counts.expired,
      icon: AlertTriangle,
      iconBg: 'bg-[#ff3b30]/10',
      iconColor: 'text-[#ff3b30]',
    },
    {
      key: 'critical',
      label: 'עד 30 יום',
      value: counts.critical,
      icon: AlertTriangle,
      iconBg: 'bg-[#ff3b30]/10',
      iconColor: 'text-[#ff3b30]',
    },
    {
      key: 'warning-soon',
      label: '30–90 יום',
      value: counts.warning + counts.soon,
      icon: Clock,
      iconBg: 'bg-[#ffcc00]/10',
      iconColor: 'text-[#b38600]',
    },
    {
      key: 'ok',
      label: 'תקין (90+ יום)',
      value: counts.ok,
      icon: ShieldCheck,
      iconBg: 'bg-[#34c759]/10',
      iconColor: 'text-[#248a3d]',
    },
  ];

  const urgencyOptions: { value: UrgencyLevel | 'all'; label: string }[] = [
    { value: 'expired', label: 'פג תוקף' },
    { value: 'critical', label: '30 יום' },
    { value: 'warning', label: '60 יום' },
    { value: 'soon', label: '90 יום' },
    { value: 'ok', label: 'תקין' },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards — hide for inventory */}
      {!isInventoryTab && (
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
      )}

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="glass-card p-5"
      >
        <div className="flex flex-wrap items-center gap-3 lg:gap-4">
          {/* Tab Toggle — Lease / License / Inventory */}
          <div className="flex items-center bg-black/5 rounded-2xl p-1">
            <button
              onClick={() => { setActiveTab('lease'); setFilterUrgency('all'); }}
              className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'lease'
                  ? 'bg-white text-[#5856D6] shadow-sm'
                  : 'text-[#86868b] hover:text-[#424245]'
              }`}
            >
              סיום ליסינג
            </button>
            <button
              onClick={() => { setActiveTab('license'); setFilterUrgency('all'); }}
              className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'license'
                  ? 'bg-white text-[#007AFF] shadow-sm'
                  : 'text-[#86868b] hover:text-[#424245]'
              }`}
            >
              סיום רישוי
            </button>
            <button
              onClick={() => { setActiveTab('inventory'); setFilterUrgency('all'); setFilterSupplier('all'); }}
              className={`px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'inventory'
                  ? 'bg-white text-[#ff9500] shadow-sm'
                  : 'text-[#86868b] hover:text-[#424245]'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              מלאי
              {inventoryVehicles.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeTab === 'inventory' ? 'bg-[#ff9500]/15 text-[#ff9500]' : 'bg-black/5 text-[#86868b]'
                }`}>
                  {inventoryVehicles.length}
                </span>
              )}
            </button>
          </div>

          <div className="h-8 w-px bg-black/10 hidden lg:block" />

          {/* Search */}
          <div className="relative flex-1 max-w-[260px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
            <input
              type="text"
              placeholder="חיפוש נהג, דגם, לוחית..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-black/5 border-none rounded-xl pr-9 pl-3 py-2.5 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
            />
          </div>

          {!isInventoryTab && (
            <>
              <div className="h-8 w-px bg-black/10 hidden lg:block" />

              {/* Urgency filter */}
              <div className="flex flex-wrap items-center gap-1.5 lg:gap-2">
                <span className="text-xs font-bold text-[#86868b]">דחיפות:</span>
                {urgencyOptions.map(opt => {
                  const color = opt.value === 'all' ? getUrgencyColor('ok') : getUrgencyColor(opt.value);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setFilterUrgency(filterUrgency === opt.value ? 'all' : opt.value)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        filterUrgency === opt.value
                          ? 'bg-[#007AFF]/10 text-[#007AFF] ring-2 ring-[#007AFF]/30'
                          : `${color.badge} hover:opacity-80`
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
                {filterUrgency !== 'all' && (
                  <button
                    onClick={() => setFilterUrgency('all')}
                    className="px-2 py-1.5 text-xs text-[#86868b] hover:text-[#1d1d1f] transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Supplier filter */}
              {suppliers.length > 0 && (
                <>
                  <div className="h-8 w-px bg-black/10 hidden lg:block" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#86868b]">ספק:</span>
                    <select
                      value={filterSupplier}
                      onChange={e => setFilterSupplier(e.target.value)}
                      className="bg-black/5 border-none rounded-xl px-3 py-2 text-xs font-bold text-[#424245] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 cursor-pointer"
                    >
                      <option value="all">הכל</option>
                      {suppliers.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* Table */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="glass-card overflow-hidden"
      >
        <div className="p-6 border-b border-white/30 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1d1d1f]">{tableTitle}</h2>
          <span className="text-sm text-[#86868b]">{filtered.length} רכבים</span>
        </div>

        <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="sticky top-0 bg-white/80 backdrop-blur-sm z-10">
              <tr className="border-b border-white/30">
                {isInventoryTab ? (
                  <>
                    <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">דגם</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">לוחית</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">ספק</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">ק"מ</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">חברה</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">נהג</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">דגם</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">לוחית</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">ספק</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">תאריך סיום</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((vehicle) => {
                const level = isInventoryTab ? 'ok' as const : getUrgencyLevel(vehicle[dateField]);
                return (
                  <tr
                    key={vehicle.id}
                    onClick={() => onSelectVehicle(vehicle)}
                    className={`border-b border-black/[0.03] hover:bg-white/40 cursor-pointer transition-colors ${
                      !isInventoryTab && level === 'expired' ? 'bg-[#ff3b30]/[0.03]' : ''
                    }`}
                  >
                    {isInventoryTab ? (
                      <>
                        <td className="px-4 py-3 text-[#424245]">
                          <div className="flex items-center gap-2.5 max-w-[200px]">
                            <VehicleImage model={vehicle.model} width={48} height={32} />
                            <span className="truncate">{vehicle.model}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#86868b] font-mono text-xs">{vehicle.plateNumber}</td>
                        <td className="px-4 py-3 text-[#424245] text-xs">{vehicle.supplier || '—'}</td>
                        <td className="px-4 py-3 text-[#424245] text-xs">{vehicle.currentMileage ? vehicle.currentMileage.toLocaleString() : '—'}</td>
                        <td className="px-4 py-3 text-[#424245] text-xs">{vehicle.company || '—'}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-[#1d1d1f] font-medium">{vehicle.driverName}</td>
                        <td className="px-4 py-3 text-[#424245]">
                          <div className="flex items-center gap-2.5 max-w-[200px]">
                            <VehicleImage model={vehicle.model} width={48} height={32} />
                            <span className="truncate">{vehicle.model}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#86868b] font-mono text-xs">{vehicle.plateNumber}</td>
                        <td className="px-4 py-3 text-[#424245] text-xs">{vehicle.supplier || '—'}</td>
                        <td className="px-4 py-3">
                          <DateCell dateStr={vehicle[dateField]} />
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-[#86868b]">
                    {isInventoryTab ? 'אין פריטי מלאי' : 'לא נמצאו תוצאות'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 border-t border-white/30 text-xs text-[#86868b]">
          מציג {filtered.length} מתוך {vehicleRows.length} רכבים
        </div>
      </motion.div>
    </div>
  );
}
