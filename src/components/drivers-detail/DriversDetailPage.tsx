import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, Phone, Car, Calendar, Gauge } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import type { Vehicle } from '@/types/fleet';
import { getDriverAvgUsage } from '@/lib/analytics';
import { VehicleImage } from '@/components/ui/VehicleImage';

interface DriversDetailPageProps {
  vehicles: Vehicle[];
}

const MONTH_NAMES_HE: Record<number, string> = {
  1: 'ינו׳', 2: 'פבר׳', 3: 'מרץ', 4: 'אפר׳',
  5: 'מאי', 6: 'יוני', 7: 'יולי', 8: 'אוג׳',
  9: 'ספט׳', 10: 'אוק׳', 11: 'נוב׳', 12: 'דצמ׳',
};

function DriverRow({ vehicle, isOpen, onToggle }: { vehicle: Vehicle; isOpen: boolean; onToggle: () => void }) {
  const avg = getDriverAvgUsage(vehicle);
  const last12 = useMemo(() =>
    [...(Array.isArray(vehicle.monthlyUsage) ? vehicle.monthlyUsage : [])]
      .sort((a, b) => {
        if (a.year !== b.year) return a.year.localeCompare(b.year);
        return a.monthNum - b.monthNum;
      })
      .slice(-12),
    [vehicle.monthlyUsage]
  );

  const chartData = last12.map(m => ({
    month: `${MONTH_NAMES_HE[m.monthNum] || m.monthName} ${m.year.slice(2)}`,
    km: m.carUsage,
    mileage: m.mileage,
    reported: m.mileage > 0,
    monthNum: m.monthNum,
    year: m.year,
  }));

  const totalKm = last12.reduce((sum, m) => sum + m.carUsage, 0);
  const reportedMonths = last12.filter(m => m.mileage > 0).length;

  return (
    <div className={`border-b border-black/[0.03] ${isOpen ? 'bg-white/30' : ''}`}>
      {/* Summary Row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center px-4 py-3 hover:bg-white/40 transition-colors text-right"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <VehicleImage model={vehicle.model} width={44} height={30} />
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#1d1d1f] truncate">{vehicle.driverName}</p>
            <p className="text-xs text-[#86868b] truncate">{vehicle.model}</p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs shrink-0">
          <div className="text-center w-[70px]">
            <p className="text-[#86868b]">לוחית</p>
            <p className="font-mono text-[#424245]">{vehicle.plateNumber}</p>
          </div>
          <div className="text-center w-[70px]">
            <p className="text-[#86868b]">ממוצע</p>
            <p className="font-bold text-[#007AFF]">{avg > 0 ? Math.round(avg).toLocaleString() : '—'}</p>
          </div>
          <div className="text-center w-[70px]">
            <p className="text-[#86868b]">דיווחים</p>
            <p className={`font-bold ${reportedMonths >= 10 ? 'text-[#34c759]' : reportedMonths >= 6 ? 'text-[#ff9500]' : 'text-[#ff3b30]'}`}>
              {reportedMonths}/12
            </p>
          </div>
          <div className="w-5">
            {isOpen ? <ChevronUp className="w-4 h-4 text-[#86868b]" /> : <ChevronDown className="w-4 h-4 text-[#86868b]" />}
          </div>
        </div>
      </button>

      {/* Expanded Detail */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4">
              {/* Info cards */}
              <div className="grid grid-cols-4 gap-3">
                <InfoMini icon={Car} label="לוחית" value={vehicle.plateNumber} />
                <InfoMini icon={Phone} label="טלפון" value={vehicle.phone || '—'} isPhone={!!vehicle.phone} />
                <InfoMini icon={Calendar} label="ספק" value={vehicle.supplier || '—'} />
                <InfoMini icon={Gauge} label="מד אוזר" value={vehicle.currentMileage > 0 ? `${vehicle.currentMileage.toLocaleString()}` : '—'} />
              </div>

              {/* Monthly breakdown table */}
              <div className="rounded-2xl bg-white/30 border border-white/40 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/30">
                      <th className="px-3 py-2 text-right text-[#86868b] font-bold">חודש</th>
                      <th className="px-3 py-2 text-right text-[#86868b] font-bold">ק״מ חודשי</th>
                      <th className="px-3 py-2 text-right text-[#86868b] font-bold">מד אוזר</th>
                      <th className="px-3 py-2 text-right text-[#86868b] font-bold">סטטוס</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...last12].reverse().map((m, i) => {
                      const deviation = avg > 0 ? ((m.carUsage - avg) / avg) * 100 : 0;
                      return (
                        <tr key={i} className="border-b border-black/[0.02]">
                          <td className="px-3 py-2 text-[#1d1d1f] font-medium">
                            {MONTH_NAMES_HE[m.monthNum]} {m.year}
                          </td>
                          <td className="px-3 py-2">
                            {m.carUsage > 0 ? (
                              <span className={`font-bold ${
                                deviation > 30 ? 'text-[#ff9500]' : deviation < -30 ? 'text-[#5ac8fa]' : 'text-[#1d1d1f]'
                              }`}>
                                {m.carUsage.toLocaleString()}
                                {Math.abs(deviation) > 30 && (
                                  <span className="text-[10px] mr-1 opacity-70">
                                    ({deviation > 0 ? '+' : ''}{Math.round(deviation)}%)
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-[#c7c7cc]">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-[#86868b] font-mono">
                            {m.mileage > 0 ? m.mileage.toLocaleString() : '—'}
                          </td>
                          <td className="px-3 py-2">
                            {m.mileage > 0 ? (
                              <span className="inline-block w-2 h-2 rounded-full bg-[#34c759]" title="דווח" />
                            ) : (
                              <span className="inline-block w-2 h-2 rounded-full bg-[#c7c7cc]" title="לא דווח" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Chart */}
              {chartData.length > 0 && (
                <div className="rounded-2xl bg-white/30 border border-white/40 p-4">
                  <h4 className="text-xs font-bold text-[#86868b] mb-2">ק״מ חודשי — 12 חודשים אחרונים</h4>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                      <XAxis dataKey="month" tick={{ fill: '#86868b', fontSize: 9 }} />
                      <YAxis tick={{ fill: '#86868b', fontSize: 9 }} width={40} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="bg-white/90 backdrop-blur-xl border border-white/60 rounded-xl px-3 py-2 shadow-lg text-xs">
                              <p className="text-[#86868b]">{label}</p>
                              <p className="font-bold text-[#1d1d1f]">{Number(payload[0].value).toLocaleString()} ק״מ</p>
                              {d.mileage > 0 && <p className="text-[#86868b]">מד: {d.mileage.toLocaleString()}</p>}
                            </div>
                          );
                        }}
                      />
                      {avg > 0 && <ReferenceLine y={avg} stroke="#007AFF" strokeDasharray="3 3" />}
                      <Bar dataKey="km" radius={[3, 3, 0, 0]}>
                        {chartData.map((entry, i) => {
                          const deviation = avg > 0 ? ((entry.km - avg) / avg) * 100 : 0;
                          let fill = '#007AFF';
                          if (deviation > 30) fill = '#ff9500';
                          else if (deviation < -30) fill = '#5ac8fa';
                          if (!entry.reported && entry.km > 0) fill = '#86868b';
                          return <Cell key={i} fill={fill} fillOpacity={0.7} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Summary footer */}
              <div className="flex items-center justify-between text-xs text-[#86868b] pt-2 border-t border-white/30">
                <span>סה״כ ק״מ (12 חודשים): <strong className="text-[#1d1d1f]">{totalKm.toLocaleString()}</strong></span>
                <span>ממוצע חודשי: <strong className="text-[#007AFF]">{avg > 0 ? Math.round(avg).toLocaleString() : '—'}</strong></span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoMini({ icon: Icon, label, value, isPhone }: { icon: typeof Car; label: string; value: string; isPhone?: boolean }) {
  const inner = (
    <div className="rounded-xl bg-white/30 border border-white/40 p-2.5 flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-[#86868b]">{label}</p>
        <p className="text-xs text-[#1d1d1f] font-medium truncate" dir="ltr">{value}</p>
      </div>
    </div>
  );
  if (isPhone) return <a href={`tel:${value}`} className="hover:opacity-80 transition-opacity">{inner}</a>;
  return inner;
}

export function DriversDetailPage({ vehicles }: DriversDetailPageProps) {
  const [search, setSearch] = useState('');
  const [openDriverId, setOpenDriverId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'avg' | 'reports'>('name');

  const sorted = useMemo(() => {
    const list = [...vehicles];
    switch (sortBy) {
      case 'name':
        return list.sort((a, b) => a.driverName.localeCompare(b.driverName, 'he'));
      case 'avg':
        return list.sort((a, b) => getDriverAvgUsage(b) - getDriverAvgUsage(a));
      case 'reports': {
        const countReports = (v: Vehicle) => {
          const usage = Array.isArray(v.monthlyUsage) ? v.monthlyUsage : [];
          return usage.slice(-12).filter(m => m.mileage > 0).length;
        };
        return list.sort((a, b) => countReports(a) - countReports(b));
      }
      default:
        return list;
    }
  }, [vehicles, sortBy]);

  const filtered = useMemo(() => {
    if (!search) return sorted;
    const s = search.toLowerCase();
    return sorted.filter(v =>
      v.driverName.includes(s) ||
      v.model.toLowerCase().includes(s) ||
      v.plateNumber.includes(s) ||
      v.phone.includes(s)
    );
  }, [sorted, search]);

  const sortOptions: { value: typeof sortBy; label: string }[] = [
    { value: 'name', label: 'שם' },
    { value: 'avg', label: 'ק״מ ממוצע' },
    { value: 'reports', label: 'מעט דיווחים' },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-5"
      >
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-[300px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
            <input
              type="text"
              placeholder="חיפוש נהג, דגם, לוחית, טלפון..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-black/5 border-none rounded-xl pr-9 pl-3 py-2.5 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
            />
          </div>

          <div className="h-8 w-px bg-black/10" />

          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#86868b]">מיון:</span>
            {sortOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSortBy(opt.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  sortBy === opt.value
                    ? 'bg-[#007AFF]/10 text-[#007AFF]'
                    : 'bg-black/5 text-[#424245] hover:bg-black/[0.08]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <span className="mr-auto text-sm text-[#86868b]">{filtered.length} נהגים</span>
        </div>
      </motion.div>

      {/* Drivers List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass-card overflow-hidden"
      >
        <div className="p-6 border-b border-white/30">
          <h2 className="text-lg font-bold text-[#1d1d1f]">נהגים מפורט — 12 חודשים אחרונים</h2>
        </div>

        <div className="max-h-[650px] overflow-y-auto">
          {filtered.map(vehicle => (
            <DriverRow
              key={vehicle.id}
              vehicle={vehicle}
              isOpen={openDriverId === vehicle.id}
              onToggle={() => setOpenDriverId(openDriverId === vehicle.id ? null : vehicle.id)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-12 text-center text-[#86868b]">
              לא נמצאו תוצאות
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
