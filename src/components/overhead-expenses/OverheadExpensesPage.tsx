import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { Briefcase, TrendingUp, TrendingDown, Building2, Filter, ChevronLeft } from 'lucide-react';
import type { Vehicle, MonthlyUsage, ExpenseCategoryKey } from '@/types/fleet';
import { EXPENSE_CATEGORIES } from '@/types/fleet';
import { VehicleExpenseDetail } from '../fleet-expenses/VehicleExpenseDetail';

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

function sumMonthCost(m: MonthlyUsage, keys: readonly ExpenseCategoryKey[]): number {
  let total = 0;
  for (const k of keys) total += Number(m[k] || 0);
  return total;
}

interface OverheadExpensesPageProps {
  overheadAccounts: Vehicle[];
  selectedYear: string;
  selectedMonth: number;
}

export function OverheadExpensesPage({ overheadAccounts, selectedYear, selectedMonth }: OverheadExpensesPageProps) {
  const [activeCategories, setActiveCategories] = useState<Set<ExpenseCategoryKey>>(
    () => new Set(EXPENSE_CATEGORIES.map(c => c.key))
  );
  const [selectedAccount, setSelectedAccount] = useState<Vehicle | null>(null);
  const [companyFilter, setCompanyFilter] = useState<string>('all');

  const activeKeys = useMemo(() => [...activeCategories] as ExpenseCategoryKey[], [activeCategories]);

  const filteredAccounts = useMemo(() => {
    if (companyFilter === 'all') return overheadAccounts;
    return overheadAccounts.filter(a => a.company?.trim() === companyFilter);
  }, [overheadAccounts, companyFilter]);

  // Per-account: total cost for selected month + last 12 months + category breakdown
  const accountSummaries = useMemo(() => {
    return filteredAccounts.map(account => {
      const monthUsage = account.monthlyUsage.find(m => m.year === selectedYear && m.monthNum === selectedMonth);
      const monthCost = monthUsage ? sumMonthCost(monthUsage, activeKeys) : 0;

      // Last 12 months for trend
      const last12 = [...account.monthlyUsage]
        .sort((a, b) => {
          if (a.year !== b.year) return a.year.localeCompare(b.year);
          return a.monthNum - b.monthNum;
        })
        .slice(-12);

      const last12Total = last12.reduce((sum, m) => sum + sumMonthCost(m, activeKeys), 0);

      // Top category for this account
      const catTotals: Record<string, number> = {};
      for (const m of account.monthlyUsage) {
        for (const cat of EXPENSE_CATEGORIES) {
          if (!activeCategories.has(cat.key)) continue;
          catTotals[cat.key] = (catTotals[cat.key] || 0) + Number(m[cat.key] || 0);
        }
      }
      const topCat = EXPENSE_CATEGORIES
        .filter(c => activeCategories.has(c.key) && (catTotals[c.key] || 0) > 0)
        .sort((a, b) => (catTotals[b.key] || 0) - (catTotals[a.key] || 0))[0];

      // Previous month delta
      let prevYear = selectedYear;
      let prevMonth = selectedMonth - 1;
      if (prevMonth === 0) { prevMonth = 12; prevYear = String(Number(selectedYear) - 1); }
      const prevUsage = account.monthlyUsage.find(m => m.year === prevYear && m.monthNum === prevMonth);
      const prevCost = prevUsage ? sumMonthCost(prevUsage, activeKeys) : 0;
      const delta = prevCost > 0 ? ((monthCost - prevCost) / prevCost) * 100 : null;

      // Breakdown for current month
      const monthBreakdown = monthUsage ? EXPENSE_CATEGORIES
        .filter(c => activeCategories.has(c.key))
        .map(c => ({ ...c, value: Number(monthUsage[c.key] || 0) }))
        .filter(c => c.value > 0)
        .sort((a, b) => b.value - a.value)
      : [];

      return {
        account,
        monthCost,
        last12Total,
        topCat,
        topCatValue: topCat ? catTotals[topCat.key] || 0 : 0,
        delta,
        monthBreakdown,
      };
    });
  }, [filteredAccounts, selectedYear, selectedMonth, activeCategories, activeKeys]);

  // Aggregate KPIs
  const aggregateMetrics = useMemo(() => {
    let totalMonth = 0;
    let totalLast12 = 0;
    let activeCompaniesThisMonth = 0;
    let prevMonthTotal = 0;
    const categoryTotals: Record<string, number> = {};

    let prevYear = selectedYear;
    let prevMonth = selectedMonth - 1;
    if (prevMonth === 0) { prevMonth = 12; prevYear = String(Number(selectedYear) - 1); }

    for (const summary of accountSummaries) {
      totalMonth += summary.monthCost;
      totalLast12 += summary.last12Total;
      if (summary.monthCost > 0) activeCompaniesThisMonth++;

      const prevUsage = summary.account.monthlyUsage.find(m => m.year === prevYear && m.monthNum === prevMonth);
      if (prevUsage) prevMonthTotal += sumMonthCost(prevUsage, activeKeys);

      for (const m of summary.account.monthlyUsage) {
        if (m.year === selectedYear && m.monthNum === selectedMonth) {
          for (const cat of EXPENSE_CATEGORIES) {
            if (!activeCategories.has(cat.key)) continue;
            categoryTotals[cat.key] = (categoryTotals[cat.key] || 0) + Number(m[cat.key] || 0);
          }
        }
      }
    }

    const monthDelta = prevMonthTotal > 0 ? ((totalMonth - prevMonthTotal) / prevMonthTotal) * 100 : null;
    const topCategory = EXPENSE_CATEGORIES
      .filter(c => (categoryTotals[c.key] || 0) > 0)
      .sort((a, b) => (categoryTotals[b.key] || 0) - (categoryTotals[a.key] || 0))[0];

    return {
      totalMonth,
      totalLast12,
      activeCompaniesThisMonth,
      monthDelta,
      topCategory,
      topCategoryValue: topCategory ? categoryTotals[topCategory.key] || 0 : 0,
      categoryTotals,
    };
  }, [accountSummaries, selectedYear, selectedMonth, activeCategories, activeKeys]);

  // 12-month trend — stacked by company
  const trendData = useMemo(() => {
    const months = new Map<string, { label: string; byCompany: Record<string, number>; total: number }>();
    for (const account of filteredAccounts) {
      const companyShort = shortenCompanyName(account.company || account.driverName);
      for (const m of account.monthlyUsage) {
        const key = `${m.year}-${String(m.monthNum).padStart(2, '0')}`;
        if (!months.has(key)) {
          months.set(key, {
            label: `${MONTH_LABELS[m.monthNum - 1]} ${m.year.slice(2)}`,
            byCompany: {},
            total: 0,
          });
        }
        const bucket = months.get(key)!;
        const value = sumMonthCost(m, activeKeys);
        bucket.byCompany[companyShort] = (bucket.byCompany[companyShort] || 0) + value;
        bucket.total += value;
      }
    }
    return [...months.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 12)
      .reverse()
      .map(([, data]) => ({
        label: data.label,
        total: data.total,
        ...data.byCompany,
      }));
  }, [filteredAccounts, activeKeys]);

  // Companies present in data
  const companies = useMemo(() => {
    const set = new Set<string>();
    for (const a of filteredAccounts) {
      set.add(shortenCompanyName(a.company || a.driverName));
    }
    return [...set];
  }, [filteredAccounts]);

  const allCompanies = useMemo(() => {
    const set = new Set<string>();
    for (const a of overheadAccounts) if (a.company) set.add(a.company.trim());
    return [...set].sort();
  }, [overheadAccounts]);

  // Color per company (cycle through palette)
  const companyColors = useMemo(() => {
    const palette = ['#007AFF', '#34c759', '#ff9500', '#ff3b30', '#5856D6', '#af52de', '#BE185D', '#06B6D4', '#84CC16'];
    const map: Record<string, string> = {};
    companies.forEach((c, i) => { map[c] = palette[i % palette.length]; });
    return map;
  }, [companies]);

  // Pie for current month — by category
  const pieData = useMemo(() => {
    return EXPENSE_CATEGORIES
      .filter(c => activeCategories.has(c.key) && (aggregateMetrics.categoryTotals[c.key] || 0) > 0)
      .map(c => ({
        name: c.label,
        value: aggregateMetrics.categoryTotals[c.key] || 0,
        color: c.color,
      }))
      .sort((a, b) => b.value - a.value);
  }, [activeCategories, aggregateMetrics.categoryTotals]);

  const toggleCategory = (key: ExpenseCategoryKey) => {
    setActiveCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="glass-card p-4 lg:p-6">
            <div className="w-10 h-10 rounded-2xl bg-[#007AFF]/10 flex items-center justify-center mb-4">
              <Briefcase className="w-5 h-5 text-[#007AFF]" />
            </div>
            <p className="text-xs text-[#86868b] mb-1">סה״כ הוצאות כלליות החודש</p>
            <span className="text-3xl font-extrabold text-[#1d1d1f]">
              {formatCurrency(aggregateMetrics.totalMonth)}
            </span>
            {aggregateMetrics.monthDelta !== null && (
              <div className={`flex items-center gap-1 text-xs mt-2 font-medium ${
                aggregateMetrics.monthDelta > 0 ? 'text-[#ff3b30]' : 'text-[#34c759]'
              }`}>
                {aggregateMetrics.monthDelta > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {Math.abs(Math.round(aggregateMetrics.monthDelta))}% מחודש קודם
              </div>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.4 }}>
          <div className="glass-card p-4 lg:p-6">
            <div className="w-10 h-10 rounded-2xl bg-[#34c759]/10 flex items-center justify-center mb-4">
              <Building2 className="w-5 h-5 text-[#34c759]" />
            </div>
            <p className="text-xs text-[#86868b] mb-1">12 חודשים אחרונים</p>
            <span className="text-3xl font-extrabold text-[#1d1d1f]">
              {formatCurrency(aggregateMetrics.totalLast12)}
            </span>
            <p className="text-xs text-[#86868b] mt-2">סה״כ הוצאות כלליות</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.4 }}>
          <div className="glass-card p-4 lg:p-6">
            <div className="w-10 h-10 rounded-2xl bg-[#ff9500]/10 flex items-center justify-center mb-4">
              <TrendingUp className="w-5 h-5 text-[#ff9500]" />
            </div>
            <p className="text-xs text-[#86868b] mb-1">קטגוריה מובילה החודש</p>
            <span className="text-xl font-extrabold text-[#1d1d1f] truncate block">
              {aggregateMetrics.topCategory?.label || '—'}
            </span>
            <p className="text-xs text-[#86868b] mt-1">
              {formatCurrency(aggregateMetrics.topCategoryValue)}
            </p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24, duration: 0.4 }}>
          <div className="glass-card p-4 lg:p-6">
            <div className="w-10 h-10 rounded-2xl bg-[#5856D6]/10 flex items-center justify-center mb-4">
              <Filter className="w-5 h-5 text-[#5856D6]" />
            </div>
            <p className="text-xs text-[#86868b] mb-1">חברות עם הוצאות החודש</p>
            <span className="text-3xl font-extrabold text-[#1d1d1f]">
              {aggregateMetrics.activeCompaniesThisMonth}/{filteredAccounts.length}
            </span>
            <p className="text-xs text-[#86868b] mt-2">מתוך חשבונות פיקטיביים</p>
          </div>
        </motion.div>
      </div>

      {/* Filter + Category toggles */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.32 }}
        className="glass-card p-5 space-y-4"
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

        <div className="border-t border-black/5 pt-3">
          <div className="flex items-center gap-2 mb-2">
            <Filter className="w-3.5 h-3.5 text-[#86868b]" />
            <span className="text-xs font-bold text-[#86868b] uppercase tracking-wider">קטגוריות הוצאה</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {EXPENSE_CATEGORIES.map(cat => {
              const isOn = activeCategories.has(cat.key);
              const value = aggregateMetrics.categoryTotals[cat.key] || 0;
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
        </div>
      </motion.div>

      {/* Company cards grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <h3 className="text-sm font-bold text-[#1d1d1f] mb-3 px-1">חשבונות הוצאה לפי חברה</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {accountSummaries.map(({ account, monthCost, last12Total, topCat, delta, monthBreakdown }) => (
            <motion.button
              key={account.id}
              onClick={() => setSelectedAccount(account)}
              whileHover={{ y: -2 }}
              className="glass-card p-5 text-right cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-3.5 h-3.5 text-[#86868b] shrink-0" />
                    <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider truncate">
                      {shortenCompanyName(account.company || account.driverName)}
                    </p>
                  </div>
                  <p className="text-xl font-extrabold text-[#1d1d1f] truncate">{account.driverName}</p>
                  <p className="text-[10px] text-[#86868b] font-mono">{account.plateNumber}</p>
                </div>
                <ChevronLeft className="w-4 h-4 text-[#c7c7cc]" />
              </div>

              <div className="space-y-2 pt-3 border-t border-white/40">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] text-[#86868b]">החודש</span>
                  <span className="text-lg font-extrabold text-[#1d1d1f]">{formatCurrency(monthCost)}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] text-[#86868b]">12 חודשים</span>
                  <span className="text-sm font-bold text-[#424245]">{formatCurrency(last12Total)}</span>
                </div>
                {delta !== null && (
                  <div className={`flex items-center gap-1 text-[10px] font-medium ${
                    delta > 0 ? 'text-[#ff3b30]' : 'text-[#34c759]'
                  }`}>
                    {delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(Math.round(delta))}% מחודש קודם
                  </div>
                )}
              </div>

              {monthBreakdown.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/40">
                  <p className="text-[9px] text-[#86868b] mb-1.5 uppercase tracking-wider">פירוט החודש</p>
                  <div className="flex flex-wrap gap-1">
                    {monthBreakdown.slice(0, 5).map(item => (
                      <span
                        key={item.key}
                        title={`${item.label}: ${formatCurrency(item.value)}`}
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                        style={{ backgroundColor: `${item.color}20`, color: item.color }}
                      >
                        {item.label} {formatCurrency(item.value)}
                      </span>
                    ))}
                    {monthBreakdown.length > 5 && (
                      <span className="text-[10px] text-[#86868b] self-center">+{monthBreakdown.length - 5}</span>
                    )}
                  </div>
                </div>
              )}

              {topCat && (
                <div className="mt-3 flex items-center gap-1.5 text-[10px] text-[#86868b]">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: topCat.color }} />
                  <span>קטגוריה מובילה: <span className="font-bold" style={{ color: topCat.color }}>{topCat.label}</span></span>
                </div>
              )}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pie — distribution this month */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.48 }}
          className="glass-card p-5 lg:col-span-1"
        >
          <h3 className="text-sm font-bold text-[#1d1d1f] mb-3">פילוח קטגוריות החודש</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
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
                    const pct = aggregateMetrics.totalMonth > 0
                      ? (d.value / aggregateMetrics.totalMonth) * 100
                      : 0;
                    return (
                      <div className="bg-white/90 backdrop-blur-xl border border-white/60 rounded-xl px-3 py-2 shadow-lg text-xs">
                        <p className="font-bold text-[#1d1d1f]">{d.name}</p>
                        <p className="text-[#86868b]">{formatCurrency(d.value)} ({pct.toFixed(1)}%)</p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-[#86868b] text-sm">
              אין הוצאות לחודש זה
            </div>
          )}
        </motion.div>

        {/* Trend — 12 months stacked by company */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.56 }}
          className="glass-card p-5 lg:col-span-2"
        >
          <h3 className="text-sm font-bold text-[#1d1d1f] mb-3">מגמת הוצאות לפי חברה — 12 חודשים אחרונים</h3>
          {trendData.length > 0 && trendData.some(d => Number(d.total) > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="label" tick={{ fill: '#86868b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#86868b', fontSize: 10 }} width={50} tickFormatter={v => `₪${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const rows = payload
                      .filter(p => Number(p.value) > 0 && p.name !== 'total')
                      .sort((a, b) => Number(b.value) - Number(a.value));
                    const total = rows.reduce((s, p) => s + Number(p.value || 0), 0);
                    return (
                      <div className="bg-white/95 backdrop-blur-xl border border-white/60 rounded-xl px-3 py-2.5 shadow-lg text-xs max-w-[240px]">
                        <p className="font-bold text-[#1d1d1f] mb-1.5">{label} · {formatCurrency(total)}</p>
                        {rows.map((row, i) => (
                          <div key={i} className="flex items-center justify-between gap-3">
                            <span style={{ color: row.color }}>{row.name}</span>
                            <span className="font-mono text-[#1d1d1f]">{formatCurrency(Number(row.value))}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                {companies.map(c => (
                  <Bar
                    key={c}
                    dataKey={c}
                    stackId="cost"
                    fill={companyColors[c]}
                    fillOpacity={0.85}
                    name={c}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-[#86868b] text-sm">
              אין נתונים להצגה
            </div>
          )}
        </motion.div>
      </div>

      {/* Per-account drawer (reuse from fleet-expenses) */}
      {selectedAccount && (
        <VehicleExpenseDetail
          vehicle={selectedAccount}
          activeCategories={activeCategories}
          onClose={() => setSelectedAccount(null)}
        />
      )}
    </div>
  );
}
