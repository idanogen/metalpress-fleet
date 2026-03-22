import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, Phone, Car, Calendar, Gauge, Fuel, DollarSign, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
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

type ChartTab = 'km' | 'fuel' | 'cost';

const CHART_TABS: { key: ChartTab; label: string; icon: typeof TrendingUp; color: string }[] = [
  { key: 'km', label: 'ק״מ חודשי', icon: TrendingUp, color: '#007AFF' },
  { key: 'fuel', label: 'צריכת דלק', icon: Fuel, color: '#ff9500' },
  { key: 'cost', label: 'עלות תדלוק', icon: DollarSign, color: '#34c759' },
];

function DriverRow({ vehicle, isOpen, onToggle }: { vehicle: Vehicle; isOpen: boolean; onToggle: () => void }) {
  const [chartTab, setChartTab] = useState<ChartTab>('km');
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
    km: m.mileage,
    mileage: m.mileage,
    fuel: m.fuelConsumption || 0,
    cost: m.fuelCost || 0,
    reported: m.mileage > 0,
    monthNum: m.monthNum,
    year: m.year,
  }));

  const totalKm = last12.reduce((sum, m) => sum + m.mileage, 0);
  const totalFuel = last12.reduce((sum, m) => sum + (m.fuelConsumption || 0), 0);
  const totalCost = last12.reduce((sum, m) => sum + (m.fuelCost || 0), 0);
  const reportedMonths = last12.filter(m => m.mileage > 0).length;
  const fuelMonths = last12.filter(m => (m.fuelConsumption || 0) > 0).length;
  const avgFuel = fuelMonths > 0 ? totalFuel / fuelMonths : 0;
  const avgCost = fuelMonths > 0 ? totalCost / fuelMonths : 0;
  const hasFuelData = totalFuel > 0;

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
              <div className={`grid gap-3 ${hasFuelData ? 'grid-cols-2 lg:grid-cols-6' : 'grid-cols-2 lg:grid-cols-4'}`}>
                <InfoMini icon={Car} label="לוחית" value={vehicle.plateNumber} />
                <InfoMini icon={Phone} label="טלפון" value={vehicle.phone || '—'} isPhone={!!vehicle.phone} />
                <InfoMini icon={Calendar} label="ספק" value={vehicle.supplier || '—'} />
                <InfoMini icon={Gauge} label="מד אוזר" value={vehicle.currentMileage > 0 ? `${vehicle.currentMileage.toLocaleString()}` : '—'} />
                {hasFuelData && (
                  <>
                    <InfoMini icon={Fuel} label="ממוצע דלק/חודש" value={`${avgFuel.toFixed(0)} ליטר`} highlight="orange" />
                    <InfoMini icon={DollarSign} label="ממוצע עלות/חודש" value={`₪${avgCost.toFixed(0)}`} highlight="green" />
                  </>
                )}
              </div>

              {/* Chart with tabs */}
              {chartData.length > 0 && (
                <div className="rounded-2xl bg-white/30 border border-white/40 p-4">
                  {/* Tab buttons */}
                  <div className="flex items-center gap-2 mb-3">
                    {CHART_TABS.map(tab => {
                      if ((tab.key === 'fuel' || tab.key === 'cost') && !hasFuelData) return null;
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => setChartTab(tab.key)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            chartTab === tab.key
                              ? 'text-white shadow-sm'
                              : 'bg-black/5 text-[#424245] hover:bg-black/[0.08]'
                          }`}
                          style={chartTab === tab.key ? { backgroundColor: tab.color } : undefined}
                        >
                          <Icon className="w-3 h-3" />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* KM Chart */}
                  {chartTab === 'km' && (
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
                  )}

                  {/* Fuel Consumption Chart */}
                  {chartTab === 'fuel' && (
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                        <XAxis dataKey="month" tick={{ fill: '#86868b', fontSize: 9 }} />
                        <YAxis tick={{ fill: '#86868b', fontSize: 9 }} width={45} tickFormatter={v => `${v}L`} />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0].payload;
                            return (
                              <div className="bg-white/90 backdrop-blur-xl border border-white/60 rounded-xl px-3 py-2 shadow-lg text-xs">
                                <p className="text-[#86868b]">{label}</p>
                                <p className="font-bold text-[#ff9500]">{Number(d.fuel).toFixed(1)} ליטר</p>
                                {d.km > 0 && d.fuel > 0 && (
                                  <p className="text-[#86868b]">{(d.km / d.fuel).toFixed(1)} ק״מ/ליטר</p>
                                )}
                              </div>
                            );
                          }}
                        />
                        {avgFuel > 0 && <ReferenceLine y={avgFuel} stroke="#ff9500" strokeDasharray="3 3" />}
                        <Bar dataKey="fuel" radius={[3, 3, 0, 0]}>
                          {chartData.map((entry, i) => {
                            const deviation = avgFuel > 0 ? ((entry.fuel - avgFuel) / avgFuel) * 100 : 0;
                            let fill = '#ff9500';
                            if (deviation > 30) fill = '#ff3b30';
                            else if (deviation < -30) fill = '#34c759';
                            return <Cell key={i} fill={fill} fillOpacity={entry.fuel > 0 ? 0.7 : 0.15} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}

                  {/* Cost Chart */}
                  {chartTab === 'cost' && (
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id={`costGradient-${vehicle.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#34c759" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#34c759" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                        <XAxis dataKey="month" tick={{ fill: '#86868b', fontSize: 9 }} />
                        <YAxis tick={{ fill: '#86868b', fontSize: 9 }} width={50} tickFormatter={v => `₪${v}`} />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0].payload;
                            return (
                              <div className="bg-white/90 backdrop-blur-xl border border-white/60 rounded-xl px-3 py-2 shadow-lg text-xs">
                                <p className="text-[#86868b]">{label}</p>
                                <p className="font-bold text-[#34c759]">₪{Number(d.cost).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                                {d.fuel > 0 && (
                                  <p className="text-[#86868b]">₪{(d.cost / d.fuel).toFixed(2)} / ליטר</p>
                                )}
                              </div>
                            );
                          }}
                        />
                        {avgCost > 0 && <ReferenceLine y={avgCost} stroke="#34c759" strokeDasharray="3 3" />}
                        <Area
                          type="monotone"
                          dataKey="cost"
                          stroke="#34c759"
                          strokeWidth={2}
                          fill={`url(#costGradient-${vehicle.id})`}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}

              {/* Monthly breakdown table */}
              <div className="rounded-2xl bg-white/30 border border-white/40 overflow-x-auto">
                <table className="w-full text-xs min-w-[400px]">
                  <thead>
                    <tr className="border-b border-white/30">
                      <th className="px-3 py-2 text-right text-[#86868b] font-bold">חודש</th>
                      <th className="px-3 py-2 text-right text-[#86868b] font-bold">ק״מ חודשי</th>
                      <th className="px-3 py-2 text-right text-[#86868b] font-bold">מד אוזר</th>
                      {hasFuelData && (
                        <>
                          <th className="px-3 py-2 text-right text-[#86868b] font-bold">דלק (ליטר)</th>
                          <th className="px-3 py-2 text-right text-[#86868b] font-bold">עלות (₪)</th>
                        </>
                      )}
                      <th className="px-3 py-2 text-right text-[#86868b] font-bold">סטטוס</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...last12].reverse().map((m, i) => {
                      const deviation = avg > 0 ? ((m.mileage - avg) / avg) * 100 : 0;
                      return (
                        <tr key={i} className="border-b border-black/[0.02]">
                          <td className="px-3 py-2 text-[#1d1d1f] font-medium">
                            {MONTH_NAMES_HE[m.monthNum]} {m.year}
                          </td>
                          <td className="px-3 py-2">
                            {m.mileage > 0 ? (
                              <span className={`font-bold ${
                                deviation > 30 ? 'text-[#ff9500]' : deviation < -30 ? 'text-[#5ac8fa]' : 'text-[#1d1d1f]'
                              }`}>
                                {m.mileage.toLocaleString()}
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
                          {hasFuelData && (
                            <>
                              <td className="px-3 py-2">
                                {(m.fuelConsumption || 0) > 0 ? (
                                  <span className="font-medium text-[#ff9500]">{m.fuelConsumption.toFixed(1)}</span>
                                ) : (
                                  <span className="text-[#c7c7cc]">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {(m.fuelCost || 0) > 0 ? (
                                  <span className="font-medium text-[#34c759]">₪{m.fuelCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                ) : (
                                  <span className="text-[#c7c7cc]">—</span>
                                )}
                              </td>
                            </>
                          )}
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

              {/* Summary footer */}
              <div className={`flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-[#86868b] pt-2 border-t border-white/30 ${hasFuelData ? 'justify-start' : 'justify-between'}`}>
                <span>סה״כ ק״מ: <strong className="text-[#1d1d1f]">{totalKm.toLocaleString()}</strong></span>
                <span>ממוצע חודשי: <strong className="text-[#007AFF]">{avg > 0 ? Math.round(avg).toLocaleString() : '—'}</strong></span>
                {hasFuelData && (
                  <>
                    <span>סה״כ דלק: <strong className="text-[#ff9500]">{totalFuel.toFixed(0)} ליטר</strong></span>
                    <span>סה״כ עלות: <strong className="text-[#34c759]">₪{totalCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong></span>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoMini({ icon: Icon, label, value, isPhone, highlight }: { icon: typeof Car; label: string; value: string; isPhone?: boolean; highlight?: 'orange' | 'green' }) {
  const highlightColors = {
    orange: 'bg-[#ff9500]/10 border-[#ff9500]/20',
    green: 'bg-[#34c759]/10 border-[#34c759]/20',
  };
  const textColor = highlight === 'orange' ? 'text-[#ff9500]' : highlight === 'green' ? 'text-[#34c759]' : 'text-[#1d1d1f]';
  const bgClass = highlight ? highlightColors[highlight] : 'bg-white/30 border-white/40';

  const inner = (
    <div className={`rounded-xl border p-2.5 flex items-center gap-2 ${bgClass}`}>
      <Icon className={`w-3.5 h-3.5 shrink-0 ${highlight ? textColor : 'text-[#86868b]'}`} />
      <div className="min-w-0">
        <p className="text-[10px] text-[#86868b]">{label}</p>
        <p className={`text-xs font-medium truncate ${textColor}`} dir="ltr">{value}</p>
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
        <div className="flex flex-wrap items-center gap-3 lg:gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-[300px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
            <input
              type="text"
              placeholder="חיפוש נהג, דגם, לוחית, טלפון..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-black/5 border-none rounded-xl pr-9 pl-3 py-2.5 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
            />
          </div>

          <div className="h-8 w-px bg-black/10 hidden lg:block" />

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
