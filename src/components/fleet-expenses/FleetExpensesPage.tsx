import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Wallet, TrendingUp, TrendingDown, Filter, Building2 } from 'lucide-react';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { FleetExpensesCharts } from './FleetExpensesCharts';
import { FleetExpensesTable } from './FleetExpensesTable';
import { MONTH_LABELS, formatCurrency, shortenCompanyName } from './expenseUi';
import { isMonthStillFilling } from '@/lib/analytics';
import type { Vehicle, MonthlyUsage, ExpenseCategoryKey } from '@/types/fleet';
import { EXPENSE_CATEGORIES } from '@/types/fleet';
import { VehicleExpenseDetail } from './VehicleExpenseDetail';

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
      .map(([, data]) => ({ ...data }));
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
            {isMonthStillFilling(selectedYear, selectedMonth) && (
              <p className="text-xs mt-2 font-medium text-[#c93400]">חודש שעדיין מוקלד בפריוריטי, הסכום חלקי</p>
            )}
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

      <FleetExpensesCharts
        pieData={pieData}
        trendData={trendData}
        monthTotal={monthData.totalCost}
        activeCategories={activeCategories}
      />

      <FleetExpensesTable
        vehiclesList={vehiclesList}
        activeCategories={activeCategories}
        search={search}
        setSearch={setSearch}
        sortBy={sortBy}
        setSortBy={setSortBy}
        setSelectedVehicle={setSelectedVehicle}
      />

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
