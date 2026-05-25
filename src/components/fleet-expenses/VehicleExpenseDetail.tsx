import { X, Wallet, TrendingUp, Calendar, Building2, Receipt, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { useMemo, useState } from 'react';
import type { Vehicle, MonthlyUsage, ExpenseCategoryKey, VehicleInvoice } from '@/types/fleet';
import { EXPENSE_CATEGORIES } from '@/types/fleet';
import { VehicleImage } from '@/components/ui/VehicleImage';
import { useVehicleInvoices } from '@/hooks/useVehicleInvoices';

const MONTH_LABELS = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];

function formatCurrency(value: number): string {
  return `₪${Math.round(value).toLocaleString()}`;
}

function sumCategories(m: MonthlyUsage, keys: readonly ExpenseCategoryKey[]): number {
  let total = 0;
  for (const k of keys) total += Number(m[k] || 0);
  return total;
}

interface VehicleExpenseDetailProps {
  vehicle: Vehicle | null;
  activeCategories: Set<ExpenseCategoryKey>;
  onClose: () => void;
}

export function VehicleExpenseDetail({ vehicle, activeCategories, onClose }: VehicleExpenseDetailProps) {
  const activeKeys = useMemo(() => [...activeCategories] as ExpenseCategoryKey[], [activeCategories]);
  const { data: invoices = [], isLoading: invoicesLoading } = useVehicleInvoices(vehicle?.id ?? null);

  // Filter only categories that have any value for this vehicle
  const usedCategories = useMemo(() => {
    if (!vehicle) return [];
    return EXPENSE_CATEGORIES.filter(c => {
      if (!activeCategories.has(c.key)) return false;
      return vehicle.monthlyUsage.some(m => Number(m[c.key] || 0) > 0);
    });
  }, [vehicle, activeCategories]);

  // Sort months ascending (oldest → newest) and take last 12
  const last12 = useMemo(() => {
    if (!vehicle) return [];
    return [...vehicle.monthlyUsage]
      .sort((a, b) => {
        if (a.year !== b.year) return a.year.localeCompare(b.year);
        return a.monthNum - b.monthNum;
      })
      .slice(-12);
  }, [vehicle]);

  // Trend chart data — stacked by category
  const trendData = useMemo(() => {
    return last12.map(m => {
      const row: Record<string, number | string> = {
        label: `${MONTH_LABELS[m.monthNum - 1]} ${m.year.slice(2)}`,
        _total: sumCategories(m, activeKeys),
      };
      for (const cat of EXPENSE_CATEGORIES) {
        if (activeCategories.has(cat.key)) {
          row[cat.key] = Number(m[cat.key] || 0);
        }
      }
      return row;
    });
  }, [last12, activeKeys, activeCategories]);

  // Pie data — total across all months for this vehicle
  const pieData = useMemo(() => {
    if (!vehicle) return [];
    const totals: Record<string, number> = {};
    for (const m of vehicle.monthlyUsage) {
      for (const cat of EXPENSE_CATEGORIES) {
        if (!activeCategories.has(cat.key)) continue;
        totals[cat.key] = (totals[cat.key] || 0) + Number(m[cat.key] || 0);
      }
    }
    return EXPENSE_CATEGORIES
      .filter(c => activeCategories.has(c.key) && (totals[c.key] || 0) > 0)
      .map(c => ({ name: c.label, value: totals[c.key] || 0, color: c.color }))
      .sort((a, b) => b.value - a.value);
  }, [vehicle, activeCategories]);

  // Aggregate metrics
  const metrics = useMemo(() => {
    if (!vehicle) return { totalAll: 0, totalLast12: 0, monthsWithData: 0, avgPerMonth: 0, topCategory: '—', topCategoryValue: 0 };
    let totalAll = 0;
    let totalLast12 = 0;
    let monthsWithData = 0;
    for (const m of vehicle.monthlyUsage) {
      const s = sumCategories(m, activeKeys);
      totalAll += s;
      if (s > 0) monthsWithData++;
    }
    for (const m of last12) {
      totalLast12 += sumCategories(m, activeKeys);
    }
    const avgPerMonth = monthsWithData > 0 ? totalAll / monthsWithData : 0;
    const topCategory = pieData[0]?.name || '—';
    const topCategoryValue = pieData[0]?.value || 0;
    return { totalAll, totalLast12, monthsWithData, avgPerMonth, topCategory, topCategoryValue };
  }, [vehicle, last12, activeKeys, pieData]);

  if (!vehicle) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        />

        {/* Drawer */}
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-[820px] h-full bg-white/85 backdrop-blur-[30px] border-l border-white/60 shadow-2xl overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white/70 backdrop-blur-xl border-b border-white/40 px-6 py-4 flex items-center gap-3">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-[#1d1d1f]" />
            </button>
            <VehicleImage model={vehicle.model} width={56} height={38} />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-extrabold text-[#1d1d1f] truncate">{vehicle.driverName}</h2>
              <p className="text-xs text-[#86868b] truncate">
                {vehicle.model} · <span className="font-mono">{vehicle.plateNumber}</span>
              </p>
            </div>
            <div className="text-left">
              <p className="text-[10px] text-[#86868b]">סה״כ הוצאות (היסטוריה)</p>
              <p className="text-xl font-extrabold text-[#1d1d1f]">{formatCurrency(metrics.totalAll)}</p>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* KPI strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiMini
                icon={Wallet}
                color="#007AFF"
                label="12 חודשים אחרונים"
                value={formatCurrency(metrics.totalLast12)}
              />
              <KpiMini
                icon={Calendar}
                color="#34c759"
                label="חודשי דיווח"
                value={`${metrics.monthsWithData}`}
              />
              <KpiMini
                icon={TrendingUp}
                color="#ff9500"
                label="ממוצע חודשי"
                value={formatCurrency(metrics.avgPerMonth)}
              />
              <KpiMini
                icon={Building2}
                color="#5856D6"
                label="קטגוריה מובילה"
                value={metrics.topCategory}
                sub={formatCurrency(metrics.topCategoryValue)}
              />
            </div>

            {/* Trend chart — stacked bars per month */}
            <div className="glass-card p-4">
              <h3 className="text-sm font-bold text-[#1d1d1f] mb-3">מגמת הוצאות חודשית — 12 חודשים אחרונים</h3>
              {trendData.length > 0 && trendData.some(d => Number(d._total) > 0) ? (
                <div dir="ltr"><ResponsiveContainer width="100%" height={240}>
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
                            {rows.slice(0, 8).map((row, i) => (
                              <div key={i} className="flex items-center justify-between gap-3">
                                <span style={{ color: row.color }}>{row.name}</span>
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
                          dataKey={cat.key}
                          stackId="cost"
                          fill={cat.color}
                          fillOpacity={0.9}
                          name={cat.label}
                        />
                      ))}
                  </BarChart>
                </ResponsiveContainer></div>
              ) : (
                <div className="h-[240px] flex items-center justify-center text-[#86868b] text-sm">
                  אין נתוני הוצאה לרכב זה
                </div>
              )}
            </div>

            {/* Pie — total breakdown */}
            <div className="glass-card p-4">
              <h3 className="text-sm font-bold text-[#1d1d1f] mb-3">פילוח כולל לפי קטגוריה</h3>
              {pieData.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
                  <div dir="ltr"><ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={85}
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
                          const pct = (d.value / metrics.totalAll) * 100;
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

                  {/* Legend */}
                  <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-2">
                    {pieData.map((item, i) => {
                      const pct = (item.value / metrics.totalAll) * 100;
                      return (
                        <div key={i} className="flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-[#1d1d1f] truncate">{item.name}</span>
                          </div>
                          <div className="text-left shrink-0">
                            <span className="font-bold text-[#1d1d1f]">{formatCurrency(item.value)}</span>
                            <span className="text-[#86868b] mr-1.5">{pct.toFixed(0)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-[100px] flex items-center justify-center text-[#86868b] text-sm">
                  אין נתוני הוצאה לרכב זה
                </div>
              )}
            </div>

            {/* Monthly breakdown table */}
            <div className="glass-card overflow-hidden">
              <div className="px-4 py-3 border-b border-white/30">
                <h3 className="text-sm font-bold text-[#1d1d1f]">טבלת חודשים מפורטת</h3>
              </div>
              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white/80 backdrop-blur-sm z-10">
                    <tr className="border-b border-white/30">
                      <th className="px-3 py-2 text-right font-bold text-[#86868b] whitespace-nowrap">חודש</th>
                      <th className="px-3 py-2 text-right font-bold text-[#86868b] whitespace-nowrap">סה״כ</th>
                      {usedCategories.map(cat => (
                        <th
                          key={cat.key}
                          className="px-2.5 py-2 text-right font-bold whitespace-nowrap"
                          style={{ color: cat.color }}
                        >
                          {cat.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...last12].reverse().map((m, i) => {
                      const total = sumCategories(m, activeKeys);
                      return (
                        <tr key={i} className="border-b border-black/[0.03] hover:bg-white/40 transition-colors">
                          <td className="px-3 py-2 text-[#1d1d1f] font-medium whitespace-nowrap">
                            {MONTH_LABELS[m.monthNum - 1]} {m.year}
                          </td>
                          <td className="px-3 py-2 font-bold text-[#1d1d1f] whitespace-nowrap">
                            {total > 0 ? formatCurrency(total) : <span className="text-[#c7c7cc]">—</span>}
                          </td>
                          {usedCategories.map(cat => {
                            const v = Number(m[cat.key] || 0);
                            return (
                              <td key={cat.key} className="px-2.5 py-2 whitespace-nowrap">
                                {v > 0 ? (
                                  <span className="font-medium" style={{ color: cat.color }}>
                                    {formatCurrency(v)}
                                  </span>
                                ) : (
                                  <span className="text-[#c7c7cc]">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Invoices table — per-line invoice details from Priority EDPE_CARUSAGEPIVENV */}
            <InvoicesSection invoices={invoices} loading={invoicesLoading} />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function KpiMini({
  icon: Icon,
  color,
  label,
  value,
  sub,
}: {
  icon: typeof Wallet;
  color: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-white/40 bg-white/30 p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <p className="text-[10px] text-[#86868b] font-medium">{label}</p>
      </div>
      <p className="text-lg font-extrabold text-[#1d1d1f] truncate">{value}</p>
      {sub && <p className="text-[10px] text-[#86868b] mt-0.5">{sub}</p>}
    </div>
  );
}

// Fuzzy-match a Priority category description to one of our EXPENSE_CATEGORIES
// so the invoice row can be colored consistently with the rest of the dashboard.
function categoryColorFor(name: string | null): string {
  if (!name) return '#86868b';
  const lower = name.toLowerCase();
  const match = EXPENSE_CATEGORIES.find(c => {
    const cl = c.label.toLowerCase();
    return lower.includes(cl) || cl.includes(lower);
  });
  return match?.color ?? '#86868b';
}

function formatInvoiceDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y.slice(2)}`;
}

function InvoicesSection({ invoices, loading }: { invoices: VehicleInvoice[]; loading: boolean }) {
  const [monthFilter, setMonthFilter] = useState<string>('all');

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    for (const inv of invoices) {
      if (inv.reportYear && inv.reportMonth) {
        set.add(`${inv.reportYear}-${String(inv.reportMonth).padStart(2, '0')}`);
      }
    }
    return [...set].sort().reverse();
  }, [invoices]);

  const filtered = useMemo(() => {
    if (monthFilter === 'all') return invoices;
    const [y, m] = monthFilter.split('-');
    return invoices.filter(
      i => String(i.reportYear) === y && String(i.reportMonth).padStart(2, '0') === m
    );
  }, [invoices, monthFilter]);

  const totalAmount = useMemo(
    () => filtered.reduce((s, i) => s + (i.amount || 0), 0),
    [filtered]
  );

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 border-b border-white/30 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-[#5856D6]" />
          <h3 className="text-sm font-bold text-[#1d1d1f]">
            חשבוניות הוצאות רכב
            {!loading && invoices.length > 0 && (
              <span className="text-[#86868b] font-normal mr-2">
                ({invoices.length} {invoices.length === 1 ? 'חשבונית' : 'חשבוניות'})
              </span>
            )}
          </h3>
        </div>

        {monthOptions.length > 1 && (
          <select
            value={monthFilter}
            onChange={e => setMonthFilter(e.target.value)}
            className="text-xs bg-white/60 border border-white/40 rounded-lg px-2.5 py-1 text-[#1d1d1f] font-medium cursor-pointer"
          >
            <option value="all">כל החודשים</option>
            {monthOptions.map(opt => {
              const [y, m] = opt.split('-');
              return (
                <option key={opt} value={opt}>
                  {MONTH_LABELS[parseInt(m, 10) - 1]} {y}
                </option>
              );
            })}
          </select>
        )}

        {filtered.length > 0 && (
          <div className="ms-auto text-xs text-[#86868b]">
            סה״כ: <span className="font-bold text-[#1d1d1f]">{formatCurrency(totalAmount)}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-[120px] flex items-center justify-center text-[#86868b] text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          טוען חשבוניות…
        </div>
      ) : filtered.length === 0 ? (
        <div className="h-[100px] flex items-center justify-center text-[#86868b] text-sm">
          {invoices.length === 0 ? 'אין חשבוניות מסונכרנות לרכב זה' : 'אין חשבוניות לחודש שנבחר'}
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[400px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white/80 backdrop-blur-sm z-10">
              <tr className="border-b border-white/30">
                <th className="px-3 py-2 text-right font-bold text-[#86868b] whitespace-nowrap">תאריך</th>
                <th className="px-3 py-2 text-right font-bold text-[#86868b] whitespace-nowrap">קטגוריה</th>
                <th className="px-3 py-2 text-right font-bold text-[#86868b] whitespace-nowrap">ספק</th>
                <th className="px-3 py-2 text-right font-bold text-[#86868b] whitespace-nowrap">חברה</th>
                <th className="px-3 py-2 text-right font-bold text-[#86868b] whitespace-nowrap">מס׳ חשבונית</th>
                <th className="px-3 py-2 text-left font-bold text-[#86868b] whitespace-nowrap">סכום</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => {
                const color = categoryColorFor(inv.categoryName);
                return (
                  <tr key={inv.id} className="border-b border-black/[0.03] hover:bg-white/40 transition-colors">
                    <td className="px-3 py-2 text-[#1d1d1f] whitespace-nowrap font-mono">
                      {formatInvoiceDate(inv.invoiceDate)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
                        style={{ backgroundColor: `${color}18`, color }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                        {inv.categoryName || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[#1d1d1f] max-w-[180px] truncate" title={inv.supplierName ?? ''}>
                      {inv.supplierName || '—'}
                    </td>
                    <td className="px-3 py-2 text-[#86868b] whitespace-nowrap font-mono text-[11px]">
                      {inv.companyCode || '—'}
                    </td>
                    <td className="px-3 py-2 text-[#86868b] whitespace-nowrap font-mono text-[11px]">
                      {inv.invoiceNumber || '—'}
                    </td>
                    <td className="px-3 py-2 text-left font-bold text-[#1d1d1f] whitespace-nowrap font-mono">
                      {formatCurrency(inv.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
