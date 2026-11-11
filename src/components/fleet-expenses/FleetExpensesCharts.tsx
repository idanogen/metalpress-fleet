import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import type { ExpenseCategoryKey } from '@/types/fleet';
import { EXPENSE_CATEGORIES } from '@/types/fleet';
import { formatCurrency } from './expenseUi';

interface FleetExpensesChartsProps {
  pieData: { name: string; value: number; color: string }[];
  trendData: { label: string; total: number; perCategory: Record<string, number> }[];
  monthTotal: number;
  activeCategories: Set<ExpenseCategoryKey>;
}

export function FleetExpensesCharts({ pieData, trendData, monthTotal, activeCategories }: FleetExpensesChartsProps) {
  return (
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
                  const pct = (d.value / monthTotal) * 100;
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
  );
}
