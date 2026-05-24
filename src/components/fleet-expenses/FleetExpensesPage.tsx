import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { Wallet, TrendingUp, TrendingDown, Search, ArrowUpDown, Filter, Building2, ChevronLeft } from 'lucide-react';
import type { Vehicle, MonthlyUsage, ExpenseCategoryKey } from '@/types/fleet';
import { EXPENSE_CATEGORIES } from '@/types/fleet';
import { VehicleImage } from '@/components/ui/VehicleImage';
import { VehicleExpenseDetail } from './VehicleExpenseDetail';

const MONTH_LABELS = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];

const COMPANY_SHORT_NAMES: Record<string, string> = {
  'מטלפרס פתרונות חכמים בע"מ': 'פתרונות',
  'מטלפרס דלתות ומחיצות אש בע"מ': 'דלתות',
  'מטלפרס שירות בע"מ': 'שירות',
  'מטלפרס ניהול עשן בע"מ': 'ניהול עשן',
  "מטלפרס ייצוא (1982) בע'מ": 'ייצוא',
  'מטלפרס מיגון אש בע"מ': 'מיגון אש',
  'פ.א כוכב 2018 בע"מ': 'כוכב',
};

function shortenCompanyName(name: string): string {
  return COMPANY_SHORT_NAMES[name] || name;
}

function formatCurrency(value: number): string {
  return `₪${Math.round(value).toLocaleString()}`;
}

function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 80, damping: 20, mass: 1 });
  const [display, setDisplay] = useState('0');
  const prevValue = useRef(0);

  useEffect(() => {
    motionValue.set(prevValue.current);
    motionValue.set(value);
    prevValue.current = value;
  }, [value, motionValue]);

  useEffect(() => {
    const unsubscribe = spring.on('change', (v) => {
      setDisplay(Math.round(v).toLocaleString());
    });
    return unsubscribe;
  }, [spring]);

  return <>{prefix}{display}{suffix}</>;
}

function sumMonthCost(m: MonthlyUsage, keys: readonly ExpenseCategoryKey[]): number {
  let total = 0;
  for (const k of keys) total += Number(m[k] || 0);
  return total;
}

interface FleetExpensesPageProps {
  vehicles: Vehicle[];
  selectedYear: string;
  selectedMonth: number;
}

export function FleetExpensesPage({ vehicles, selectedYear, selectedMonth }: FleetExpensesPageProps) {
  const [activeCategories, setActiveCategories] = useState<Set<ExpenseCategoryKey>>(
    () => new Set(EXPENSE_CATEGORIES.map(c => c.key))
  );
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'cost' | 'name'>('cost');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  const activeKeys = useMemo(() => [...activeCategories] as ExpenseCategoryKey[], [activeCategories]);

  const allCompanies = useMemo(() => {
    const set = new Set<string>();
    for (const v of vehicles) if (v.company) set.add(v.company.trim());
    return [...set].sort();
  }, [vehicles]);

  // Filter vehicles by company
  const filteredVehicles = useMemo(() => {
    if (companyFilter === 'all') return vehicles;
    return vehicles.filter(v => v.company?.trim() === companyFilter);
  }, [vehicles, companyFilter]);

  // Aggregate metrics for selected month
  const monthData = useMemo(() => {
    const perCategory: Record<string, number> = {};
    let totalCost = 0;
    let reportingVehicles = 0;
    const perVehicle: Map<number, { vehicle: Vehicle; cost: number; usage: MonthlyUsage | null }> = new Map();

    for (const v of filteredVehicles) {
      const usage = v.monthlyUsage.find(m => m.year === selectedYear && m.monthNum === selectedMonth) ?? null;
      let vehicleCost = 0;
      if (usage) {
        for (const cat of EXPENSE_CATEGORIES) {
          if (!activeCategories.has(cat.key)) continue;
          const value = Number(usage[cat.key] || 0);
          perCategory[cat.key] = (perCategory[cat.key] || 0) + value;
          vehicleCost += value;
        }
      }
      if (vehicleCost > 0) reportingVehicles++;
      totalCost += vehicleCost;
      perVehicle.set(v.id, { vehicle: v, cost: vehicleCost, usage });
    }

    return { perCategory, totalCost, reportingVehicles, perVehicle };
  }, [filteredVehicles, selectedYear, selectedMonth, activeCategories]);

  // Aggregate metrics for previous month (for comparison)
  const prevMonthData = useMemo(() => {
    let prevYear = selectedYear;
    let prevMonth = selectedMonth - 1;
    if (prevMonth === 0) { prevMonth = 12; prevYear = String(Number(selectedYear) - 1); }
    let total = 0;
    for (const v of filteredVehicles) {
      const usage = v.monthlyUsage.find(m => m.year === prevYear && m.monthNum === prevMonth);
      if (!usage) continue;
      total += sumMonthCost(usage, activeKeys);
    }
    return { total };
  }, [filteredVehicles, selectedYear, selectedMonth, activeKeys]);

  // 12-month trend
  const trendData = useMemo(() => {
    const buckets = new Map<string, { label: string; total: number; perCategory: Record<string, number> }>();
    for (const v of filteredVehicles) {
      for (const m of v.monthlyUsage) {
        const key = `${m.year}-${String(m.monthNum).padStart(2, '0')}`;
        if (!buckets.has(key)) {
          buckets.set(key, {
            label: `${MONTH_LABELS[m.monthNum - 1]} ${m.year.slice(2)}`,
            total: 0,
            perCategory: {},
          });
        }
        const bucket = buckets.get(key)!;
        for (const cat of EXPENSE_CATEGORIES) {
          if (!activeCategories.has(cat.key)) continue;
          const value = Number(m[cat.key] || 0);
          bucket.total += value;
          bucket.perCategory[cat.key] = (bucket.perCategory[cat.key] || 0) + value;
        }
      }
    }
    return [...buckets.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 12)
      .reverse()
      .map(([_, data]) => ({ ...data }));
  }, [filteredVehicles, activeCategories]);

  // Vehicles list sorted by cost
  const vehiclesList = useMemo(() => {
    const list = [...monthData.perVehicle.values()];
    if (search) {
      const s = search.toLowerCase();
      const filtered = list.filter(({ vehicle: v }) =>
        v.driverName.toLowerCase().includes(s) ||
        v.plateNumber.toLowerCase().includes(s) ||
        v.model.toLowerCase().includes(s)
      );
      list.length = 0;
      list.push(...filtered);
    }
    list.sort((a, b) => {
      if (sortBy === 'name') return a.vehicle.driverName.localeCompare(b.vehicle.driverName, 'he');
      return b.cost - a.cost;
    });
    return list;
  }, [monthData.perVehicle, search, sortBy]);

  // Top categories for header (pie)
  const pieData = useMemo(() => {
    return EXPENSE_CATEGORIES
      .filter(c => activeCategories.has(c.key))
      .map(c => ({
        name: c.label,
        value: monthData.perCategory[c.key] || 0,
        color: c.color,
      }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [monthData.perCategory, activeCategories]);

  const monthDelta = prevMonthData.total > 0
    ? ((monthData.totalCost - prevMonthData.total) / prevMonthData.total) * 100
    : 0;

  const avgPerVehicle = monthData.reportingVehicles > 0
    ? monthData.totalCost / monthData.reportingVehicles
    : 0;

  const topCategoryName = pieData[0]?.name || '—';
  const topCategoryValue = pieData[0]?.value || 0;

  const toggleCategory = (key: ExpenseCategoryKey) => {
    setActiveCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allOn = activeCategories.size === EXPENSE_CATEGORIES.length;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="glass-card p-4 lg:p-6">
            <div className="w-10 h-10 rounded-2xl bg-[#007AFF]/10 flex items-center justify-center mb-4">
              <Wallet className="w-5 h-5 text-[#007AFF]" />
            </div>
            <p className="text-xs text-[#86868b] mb-1">סה״כ הוצאות החודש</p>
            <span className="text-3xl font-extrabold text-[#1d1d1f]">
              <AnimatedNumber value={Math.round(monthData.totalCost)} prefix="₪" />
            </span>
            {prevMonthData.total > 0 && (
              <div className={`flex items-center gap-1 text-xs mt-2 font-medium ${
                monthDelta > 0 ? 'text-[#ff3b30]' : 'text-[#34c759]'
              }`}>
                {monthDelta > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {Math.abs(Math.round(monthDelta))}% מחודש קודם
              </div>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.4 }}>
          <div className="glass-card p-4 lg:p-6">
            <div className="w-10 h-10 rounded-2xl bg-[#34c759]/10 flex items-center justify-center mb-4">
              <Building2 className="w-5 h-5 text-[#34c759]" />
            </div>
            <p className="text-xs text-[#86868b] mb-1">ממוצע לרכב</p>
            <span className="text-3xl font-extrabold text-[#1d1d1f]">
              <AnimatedNumber value={Math.round(avgPerVehicle)} prefix="₪" />
            </span>
            <p className="text-xs text-[#86868b] mt-2">
              {monthData.reportingVehicles} רכבים עם הוצאות
            </p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.4 }}>
          <div className="glass-card p-4 lg:p-6">
            <div className="w-10 h-10 rounded-2xl bg-[#ff9500]/10 flex items-center justify-center mb-4">
              <TrendingUp className="w-5 h-5 text-[#ff9500]" />
            </div>
            <p className="text-xs text-[#86868b] mb-1">קטגוריה מובילה</p>
            <span className="text-xl font-extrabold text-[#1d1d1f] truncate block">{topCategoryName}</span>
            <p className="text-xs text-[#86868b] mt-1">{formatCurrency(topCategoryValue)}</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24, duration: 0.4 }}>
          <div className="glass-card p-4 lg:p-6">
            <div className="w-10 h-10 rounded-2xl bg-[#5856D6]/10 flex items-center justify-center mb-4">
              <Filter className="w-5 h-5 text-[#5856D6]" />
            </div>
            <p className="text-xs text-[#86868b] mb-1">קטגוריות פעילות</p>
            <span className="text-3xl font-extrabold text-[#1d1d1f]">
              {activeCategories.size}/{EXPENSE_CATEGORIES.length}
            </span>
            <button
              onClick={() => setActiveCategories(
                allOn ? new Set() : new Set(EXPENSE_CATEGORIES.map(c => c.key))
              )}
              className="text-xs text-[#5856D6] hover:underline mt-2"
            >
              {allOn ? 'נקה הכל' : 'בחר הכל'}
            </button>
          </div>
        </motion.div>
      </div>

      {/* Filters bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.32 }}
        className="glass-card p-5"
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-[#86868b]">חברה:</span>
          <button
            onClick={() => setCompanyFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              companyFilter === 'all'
                ? 'bg-[#007AFF]/10 text-[#007AFF]'
                : 'bg-black/5 text-[#424245] hover:bg-black/[0.08]'
            }`}
          >
            הכל
          </button>
          {allCompanies.map(c => (
            <button
              key={c}
              onClick={() => setCompanyFilter(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                companyFilter === c
                  ? 'bg-[#007AFF]/10 text-[#007AFF]'
                  : 'bg-black/5 text-[#424245] hover:bg-black/[0.08]'
              }`}
            >
              {shortenCompanyName(c)}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Category toggles */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card p-5"
      >
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-3.5 h-3.5 text-[#86868b]" />
          <span className="text-xs font-bold text-[#86868b] uppercase tracking-wider">קטגוריות הוצאה</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {EXPENSE_CATEGORIES.map(cat => {
            const isOn = activeCategories.has(cat.key);
            const value = monthData.perCategory[cat.key] || 0;
            return (
              <button
                key={cat.key}
                onClick={() => toggleCategory(cat.key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isOn ? 'shadow-sm' : 'opacity-40 grayscale'
                }`}
                style={{
                  backgroundColor: isOn ? `${cat.color}15` : 'rgba(0,0,0,0.05)',
                  color: isOn ? cat.color : '#86868b',
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="font-bold">{cat.label}</span>
                {isOn && value > 0 && (
                  <span className="text-[10px] opacity-80 font-mono">{formatCurrency(value)}</span>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pie — distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.48 }}
          className="glass-card p-5 lg:col-span-1"
        >
          <h3 className="text-sm font-bold text-[#1d1d1f] mb-3">פילוח לפי קטגוריה</h3>
          {pieData.length > 0 ? (
            <div dir="ltr"><ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="rgba(255,255,255,0.6)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    const pct = (d.value / monthData.totalCost) * 100;
                    return (
                      <div className="bg-white/90 backdrop-blur-xl border border-white/60 rounded-xl px-3 py-2 shadow-lg text-xs">
                        <p className="font-bold text-[#1d1d1f]">{d.name}</p>
                        <p className="text-[#86868b]">{formatCurrency(d.value)} ({pct.toFixed(1)}%)</p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer></div>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-[#86868b] text-sm">
              אין הוצאות לחודש זה
            </div>
          )}
        </motion.div>

        {/* Trend — 12 months stacked */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.56 }}
          className="glass-card p-5 lg:col-span-2"
        >
          <h3 className="text-sm font-bold text-[#1d1d1f] mb-3">מגמת הוצאות — 12 חודשים אחרונים</h3>
          {trendData.length > 0 ? (
            <div dir="ltr"><ResponsiveContainer width="100%" height={260}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="label" tick={{ fill: '#86868b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#86868b', fontSize: 10 }} width={50} tickFormatter={v => `₪${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const rows = payload
                      .filter(p => Number(p.value) > 0)
                      .sort((a, b) => Number(b.value) - Number(a.value));
                    const total = rows.reduce((s, p) => s + Number(p.value || 0), 0);
                    return (
                      <div className="bg-white/95 backdrop-blur-xl border border-white/60 rounded-xl px-3 py-2.5 shadow-lg text-xs max-w-[240px]">
                        <p className="font-bold text-[#1d1d1f] mb-1.5">{label} · {formatCurrency(total)}</p>
                        {rows.slice(0, 6).map((row, i) => (
                          <div key={i} className="flex items-center justify-between gap-3">
                            <span className="text-[#86868b]" style={{ color: row.color }}>{row.name}</span>
                            <span className="font-mono text-[#1d1d1f]">{formatCurrency(Number(row.value))}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                {EXPENSE_CATEGORIES
                  .filter(c => activeCategories.has(c.key))
                  .map(cat => (
                    <Bar
                      key={cat.key}
                      dataKey={`perCategory.${cat.key}`}
                      stackId="cost"
                      fill={cat.color}
                      fillOpacity={0.85}
                      name={cat.label}
                    />
                  ))}
              </BarChart>
            </ResponsiveContainer></div>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-[#86868b] text-sm">
              אין נתונים להצגה
            </div>
          )}
        </motion.div>
      </div>

      {/* Vehicles table */}
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
              className="w-full bg-black/5 border-none rounded-xl pr-9 pl-3 py-2 text-sm placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
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

      {/* Per-vehicle expense drawer */}
      {selectedVehicle && (
        <VehicleExpenseDetail
          vehicle={selectedVehicle}
          activeCategories={activeCategories}
          onClose={() => setSelectedVehicle(null)}
        />
      )}
    </div>
  );
}
