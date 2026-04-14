import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import type { Vehicle } from '@/types/fleet';
import { getOwnershipBreakdown, getSupplierBreakdown, getTopDriversByUsage, getMonthlyTrend } from '@/lib/analytics';

interface FleetChartsProps {
  vehicles: Vehicle[];
  selectedYear: string;
  selectedMonth: number;
}

const COLORS = ['#007AFF', '#34c759', '#ff9500', '#ff3b30', '#5856D6', '#ff2d55', '#5ac8fa', '#af52de'];

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name?: string; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-2xl px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
      <p className="text-xs text-[#86868b] mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-bold text-[#1d1d1f]">
          {entry.name ? `${entry.name}: ` : ''}{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value} ק"מ
        </p>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-2xl px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
      <p className="text-sm font-bold text-[#1d1d1f]">{payload[0].name}: {payload[0].value}</p>
    </div>
  );
}

export function FleetCharts({ vehicles, selectedYear, selectedMonth }: FleetChartsProps) {
  const ownershipData = getOwnershipBreakdown(vehicles);
  const supplierData = getSupplierBreakdown(vehicles).slice(0, 6);
  const topDrivers = getTopDriversByUsage(vehicles, selectedYear, selectedMonth, 10);
  const trend = getMonthlyTrend(vehicles, 12);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Monthly Trend */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass-card p-6 lg:col-span-2"
      >
        <h3 className="text-lg font-bold text-[#1d1d1f] mb-1">מגמת ק"מ חודשית</h3>
        <p className="text-sm text-[#86868b] mb-4">ממוצע לנהג</p>
        <div dir="ltr">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={trend} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="month" tick={{ fill: '#86868b', fontSize: 11 }} />
            <YAxis tick={{ fill: '#86868b', fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="avgKm"
              name="ממוצע ק״מ"
              stroke="#007AFF"
              strokeWidth={2.5}
              dot={{ fill: '#007AFF', r: 3 }}
              activeDot={{ r: 6, stroke: '#007AFF', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Top Drivers Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="glass-card p-6"
      >
        <h3 className="text-lg font-bold text-[#1d1d1f] mb-1">דירוג נהגים</h3>
        <p className="text-sm text-[#86868b] mb-4">ק"מ חודשי</p>
        <div dir="ltr" style={{ overflow: 'visible' }}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={topDrivers} layout="vertical" margin={{ left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
            <XAxis type="number" tick={{ fill: '#86868b', fontSize: 11 }} />
            <YAxis dataKey="name" type="category" width={130} tick={{ fill: '#424245', fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="km" name="ק״מ" radius={[0, 8, 8, 0]}>
              {topDrivers.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Ownership Pie */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="glass-card p-6"
      >
        <h3 className="text-lg font-bold text-[#1d1d1f] mb-1">פילוח סוג בעלות</h3>
        <p className="text-sm text-[#86868b] mb-4">התפלגות</p>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={ownershipData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={3}
              dataKey="value"
            >
              {ownershipData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip />} />
            <Legend
              formatter={(value) => <span className="text-xs text-[#424245]">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Supplier Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="glass-card p-6 lg:col-span-2"
      >
        <h3 className="text-lg font-bold text-[#1d1d1f] mb-1">פילוח ספקים</h3>
        <p className="text-sm text-[#86868b] mb-4">מספר רכבים</p>
        <div dir="ltr">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={supplierData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="name" tick={{ fill: '#424245', fontSize: 11 }} />
            <YAxis tick={{ fill: '#86868b', fontSize: 11 }} />
            <Tooltip content={<PieTooltip />} />
            <Bar dataKey="value" name="רכבים" radius={[8, 8, 0, 0]}>
              {supplierData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}
