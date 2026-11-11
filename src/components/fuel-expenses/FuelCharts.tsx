import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area,
} from 'recharts';
import { MONTH_NAMES, shortenCompanyName, FUEL_COLORS as COLORS } from '@/lib/fuelStats';
import type { CompanyFuelData, CompanyYoYData } from '@/lib/fuelStats';


interface CostTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name?: string; color?: string; dataKey?: string }>;
  label?: string;
}

function CostTooltip({ active, payload, label }: CostTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-2xl px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
      <p className="text-xs text-[#86868b] mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-bold text-[#1d1d1f]" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          {entry.dataKey === 'liters' || entry.dataKey === 'totalLiters' || entry.dataKey === 'avgLitersPerVehicle' ? ' ליטר' : ' ₪'}
        </p>
      ))}
    </div>
  );
}

function PieCostTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-2xl px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
      <p className="text-sm font-bold text-[#1d1d1f]">{payload[0].name}</p>
      <p className="text-sm text-[#424245]">{payload[0].value.toLocaleString()} ₪</p>
    </div>
  );
}

interface FuelChartsProps {
  year: string;
  selectedCompany: string;
  companyData: CompanyFuelData[];
  monthlyTrend: { month: string; cost: number; liters: number }[];
  companyMonthlyData: { month: string; cost: number; liters: number }[] | null;
  companyYoY: CompanyYoYData[];
  prevYearLabel: string;
  periodLabel: string;
}

export function FuelCharts({
  year, selectedCompany, companyData, monthlyTrend, companyMonthlyData, companyYoY, prevYearLabel, periodLabel,
}: FuelChartsProps) {
  return (
    <>
      {/* Monthly Fuel Trend — Area Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="glass-card p-6"
      >
        <div className="mb-4">
          <h3 className="text-lg font-bold text-[#1d1d1f]">מגמת הוצאות דלק חודשית</h3>
          <p className="text-sm text-[#86868b]">{year}{selectedCompany !== 'all' ? ` — ${shortenCompanyName(selectedCompany)}` : ''}</p>
        </div>
        <div dir="ltr"><ResponsiveContainer width="100%" height={300}>
          <AreaChart data={companyMonthlyData || monthlyTrend}>
            <defs>
              <linearGradient id="fuelCostGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff9500" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ff9500" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fuelLitersGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#007AFF" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#007AFF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="month" tick={{ fill: '#86868b', fontSize: 11 }} />
            <YAxis tick={{ fill: '#86868b', fontSize: 11 }} tickFormatter={v => `₪${(v / 1000).toFixed(0)}K`} />
            <Tooltip content={<CostTooltip />} />
            <Legend formatter={v => <span className="text-xs text-[#424245]">{v}</span>} />
            <Area type="monotone" dataKey="cost" name="עלות ₪" stroke="#ff9500" strokeWidth={2.5} fill="url(#fuelCostGrad)" />
            <Area type="monotone" dataKey="liters" name="ליטרים" stroke="#007AFF" strokeWidth={2.5} fill="url(#fuelLitersGrad)" />
          </AreaChart>
        </ResponsiveContainer></div>
      </motion.div>

      {/* Year-over-Year Comparison */}
      {companyYoY.some(c => c.prevYear > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-6"
        >
          <h3 className="text-lg font-bold text-[#1d1d1f] mb-1">השוואת הוצאות דלק — {prevYearLabel} מול {year}</h3>
          <p className="text-sm text-[#86868b] mb-4">לפי חברה · {periodLabel} מול אותם חודשים ב-{prevYearLabel}</p>
          <div dir="ltr"><ResponsiveContainer width="100%" height={350}>
            <BarChart data={companyYoY} margin={{ right: 80, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="shortName" tick={{ fill: '#424245', fontSize: 12 }} />
              <YAxis tick={{ fill: '#86868b', fontSize: 11 }} tickFormatter={v => `₪${(v / 1000).toFixed(0)}K`} />
              <Tooltip content={<CostTooltip />} />
              <Legend formatter={v => <span className="text-xs text-[#424245]">{v}</span>} />
              <Bar dataKey="prevYear" name={prevYearLabel} fill="#86868b" fillOpacity={0.4} radius={[8, 8, 0, 0]} />
              <Bar dataKey="currentYear" name={year} fill="#007AFF" fillOpacity={0.7} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer></div>

          {/* Diff Table */}
          <div className="mt-4 flex flex-wrap gap-3 justify-center">
            {companyYoY.map(c => (
              <div key={c.shortName} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/[0.03]">
                <span className="text-xs font-bold text-[#424245]">{c.shortName}</span>
                <span className={`text-xs font-bold ${c.diff <= 0 ? 'text-[#34c759]' : 'text-[#ff3b30]'}`}>
                  {c.diff <= 0 ? '' : '+'}{c.diffPercent}%
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost per Company — Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="glass-card p-6"
        >
          <h3 className="text-lg font-bold text-[#1d1d1f] mb-1">עלות דלק לפי חברה</h3>
          <p className="text-sm text-[#86868b] mb-4">{periodLabel}</p>
          <div dir="ltr"><ResponsiveContainer width="100%" height={350}>
            <BarChart data={companyData} layout="vertical" margin={{ right: 80, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis type="number" tick={{ fill: '#86868b', fontSize: 11 }} tickFormatter={v => `₪${(v / 1000).toFixed(0)}K`} />
              <YAxis
                dataKey="shortName" type="category" orientation="right" width={70}
                tick={{ fill: '#424245', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false}
              />
              <Tooltip content={<CostTooltip />} />
              <Bar dataKey="totalCost" name="עלות" radius={[0, 8, 8, 0]}>
                {companyData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer></div>
        </motion.div>

        {/* Cost Distribution — Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="glass-card p-6"
        >
          <h3 className="text-lg font-bold text-[#1d1d1f] mb-1">חלוקת הוצאות דלק</h3>
          <p className="text-sm text-[#86868b] mb-4">לפי חברה</p>
          <div dir="ltr"><ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={companyData.map(c => ({ name: c.shortName, value: c.totalCost }))}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
              >
                {companyData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<PieCostTooltip />} />
              <Legend formatter={v => <span className="text-xs text-[#424245]">{v}</span>} />
            </PieChart>
          </ResponsiveContainer></div>
        </motion.div>
      </div>

      {/* Liters per Company — Bar Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 }}
        className="glass-card p-6"
      >
        <h3 className="text-lg font-bold text-[#1d1d1f] mb-1">צריכת ליטרים לפי חברה</h3>
        <p className="text-sm text-[#86868b] mb-4">ממוצע לרכב</p>
        <div dir="ltr"><ResponsiveContainer width="100%" height={280}>
          <BarChart data={companyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="shortName" tick={{ fill: '#424245', fontSize: 11 }} />
            <YAxis tick={{ fill: '#86868b', fontSize: 11 }} />
            <Tooltip content={<CostTooltip />} />
            <Bar dataKey="avgLitersPerVehicle" name="ליטר ממוצע לרכב" radius={[8, 8, 0, 0]}>
              {companyData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer></div>
      </motion.div>

      {/* Company Comparison — Multi-line Chart */}
      {companyData.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
          className="glass-card p-6"
        >
          <h3 className="text-lg font-bold text-[#1d1d1f] mb-1">השוואת חברות — מגמה חודשית</h3>
          <p className="text-sm text-[#86868b] mb-4">עלות דלק ₪</p>
          <div dir="ltr"><ResponsiveContainer width="100%" height={320}>
            <LineChart data={MONTH_NAMES.map((month, i) => {
              const point: Record<string, string | number> = { month };
              for (const c of companyData) {
                point[c.shortName] = c.months[i]?.cost || 0;
              }
              return point;
            }).filter((_, i) => companyData.some(c => (c.months[i]?.cost || 0) > 0))}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="month" tick={{ fill: '#86868b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#86868b', fontSize: 11 }} tickFormatter={v => `₪${(v / 1000).toFixed(0)}K`} />
              <Tooltip content={<CostTooltip />} />
              <Legend formatter={v => <span className="text-xs text-[#424245]">{v}</span>} />
              {companyData.map((c, i) => (
                <Line
                  key={c.shortName}
                  type="monotone"
                  dataKey={c.shortName}
                  name={c.shortName}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: COLORS[i % COLORS.length] }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer></div>
        </motion.div>
      )}
    </>
  );
}
