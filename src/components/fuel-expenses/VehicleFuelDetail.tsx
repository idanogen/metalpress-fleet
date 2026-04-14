import { X, Phone, Car, Building2, Fuel, Droplets } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, ComposedChart, Line } from 'recharts';
import type { Vehicle } from '@/types/fleet';
import { VehicleImage } from '@/components/ui/VehicleImage';

interface VehicleFuelDetailProps {
  vehicle: Vehicle | null;
  year: string;
  onClose: () => void;
}

export function VehicleFuelDetail({ vehicle, year, onClose }: VehicleFuelDetailProps) {
  if (!vehicle) return null;

  const last12 = [...vehicle.monthlyUsage]
    .sort((a, b) => {
      if (a.year !== b.year) return a.year.localeCompare(b.year);
      return a.monthNum - b.monthNum;
    })
    .slice(-12);

  const chartData = last12.map(m => ({
    month: `${m.monthName} ${m.year.slice(2)}`,
    cost: Math.round(m.fuelCost || 0),
    liters: Math.round(m.fuelConsumption || 0),
    hasData: (m.fuelCost || 0) > 0 || (m.fuelConsumption || 0) > 0,
  }));

  const yearData = vehicle.monthlyUsage.filter(m => m.year === year);
  const yearCost = Math.round(yearData.reduce((s, m) => s + (m.fuelCost || 0), 0));
  const yearLiters = Math.round(yearData.reduce((s, m) => s + (m.fuelConsumption || 0), 0));
  const monthsReported = yearData.filter(m => (m.fuelCost || 0) > 0 || (m.fuelConsumption || 0) > 0).length;
  const avgMonthly = monthsReported > 0 ? Math.round(yearCost / monthsReported) : 0;
  const maxCost = chartData.length > 0 ? Math.max(...chartData.map(d => d.cost)) : 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-end">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        />

        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-lg h-full bg-white/60 backdrop-blur-[30px] border-r border-white/60 shadow-[-10px_0_40px_rgba(0,0,0,0.05)] overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white/50 backdrop-blur-xl border-b border-white/30 p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <VehicleImage model={vehicle.model} width={80} height={48} className="rounded-2xl" />
              <div>
                <h2 className="text-lg font-extrabold text-[#1d1d1f]">{vehicle.driverName}</h2>
                <p className="text-sm text-[#86868b]">{vehicle.model}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10 transition-colors"
            >
              <X className="w-4 h-4 text-[#86868b]" />
            </button>
          </div>

          <div className="p-5 space-y-6">
            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-3">
              <InfoCard icon={Car} label="לוחית" value={vehicle.plateNumber || '—'} />
              <InfoCard icon={Phone} label="טלפון" value={vehicle.phone || '—'} isPhone />
              <InfoCard icon={Building2} label="חברה" value={vehicle.company || '—'} />
              <InfoCard icon={Fuel} label="בעלות" value={vehicle.ownershipType || '—'} />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatBox label={`עלות ${year}`} value={`₪${yearCost.toLocaleString()}`} color="text-[#ff9500]" />
              <StatBox label={`ליטרים ${year}`} value={yearLiters.toLocaleString()} color="text-[#007AFF]" />
              <StatBox label="ממוצע חודשי" value={`₪${avgMonthly.toLocaleString()}`} color="text-[#5856D6]" />
              <StatBox label="חודשי דיווח" value={`${monthsReported}/12`} color="text-[#34c759]" />
            </div>

            {/* Chart — Cost + Liters */}
            <div className="rounded-2xl bg-white/30 border border-white/40 p-4">
              <h3 className="text-sm font-bold text-[#1d1d1f] mb-3">הוצאות דלק — 12 חודשים אחרונים</h3>
              <div dir="ltr">
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="month" tick={{ fill: '#86868b', fontSize: 10 }} />
                    <YAxis yAxisId="cost" tick={{ fill: '#ff9500', fontSize: 10 }} tickFormatter={v => `₪${(v / 1000).toFixed(0)}K`} />
                    <YAxis yAxisId="liters" orientation="right" tick={{ fill: '#007AFF', fontSize: 10 }} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-2xl px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
                            <p className="text-xs text-[#86868b] mb-1">{label}</p>
                            <p className="text-sm font-bold text-[#ff9500]">₪{d.cost.toLocaleString()}</p>
                            <p className="text-sm font-bold text-[#007AFF]">{d.liters.toLocaleString()} ליטר</p>
                          </div>
                        );
                      }}
                    />
                    <Legend formatter={v => <span className="text-xs text-[#424245]">{v}</span>} />
                    <Bar yAxisId="cost" dataKey="cost" name="עלות ₪" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.hasData ? '#ff9500' : '#d1d1d6'} fillOpacity={0.7} />
                      ))}
                    </Bar>
                    <Line yAxisId="liters" type="monotone" dataKey="liters" name="ליטרים" stroke="#007AFF" strokeWidth={2.5} dot={{ r: 3, fill: '#007AFF' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Monthly Breakdown Table */}
            <div className="rounded-2xl bg-white/30 border border-white/40 p-4">
              <h3 className="text-sm font-bold text-[#1d1d1f] mb-3">פירוט חודשי</h3>
              <div className="space-y-1.5">
                {[...chartData].reverse().map((m, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl ${
                      m.hasData ? 'bg-white/40' : 'bg-black/[0.02]'
                    }`}
                  >
                    <span className={`text-xs font-medium ${m.hasData ? 'text-[#1d1d1f]' : 'text-[#86868b]'}`}>
                      {m.month}
                    </span>
                    {m.hasData ? (
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Droplets className="w-3 h-3 text-[#007AFF]" />
                          <span className="text-xs text-[#424245]">{m.liters.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1.5 min-w-[100px] justify-end">
                          {maxCost > 0 && (
                            <div className="w-14 h-1 bg-black/5 rounded-full overflow-hidden">
                              <div className="h-full bg-[#ff9500] rounded-full" style={{ width: `${(m.cost / maxCost) * 100}%` }} />
                            </div>
                          )}
                          <span className="text-xs font-bold text-[#ff9500]">₪{m.cost.toLocaleString()}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-[#c7c7cc]">לא דווח</span>
                    )}
                  </div>
                ))}
                {chartData.length === 0 && (
                  <p className="text-center text-sm text-[#86868b] py-4">אין נתוני דלק</p>
                )}
              </div>
            </div>

            {/* Total */}
            <div className="text-center py-4 border-t border-white/30">
              <p className="text-xs text-[#86868b]">סה"כ הוצאות דלק ב-{year}</p>
              <p className="text-2xl font-extrabold text-[#ff9500]">₪{yearCost.toLocaleString()}</p>
              <p className="text-xs text-[#86868b] mt-1">{yearLiters.toLocaleString()} ליטרים · {monthsReported} חודשי דיווח</p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function InfoCard({ icon: Icon, label, value, isPhone }: { icon: typeof Car; label: string; value: string; isPhone?: boolean }) {
  const content = (
    <div className="rounded-2xl bg-white/30 border border-white/40 p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-black/5 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-[#86868b]" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-[#86868b]">{label}</p>
        <p className="text-sm text-[#1d1d1f] font-medium truncate" dir="ltr">{value}</p>
      </div>
    </div>
  );

  if (isPhone && value && value !== '—') {
    return <a href={`tel:${value}`} className="block hover:opacity-80 transition-opacity">{content}</a>;
  }
  return content;
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl bg-white/30 border border-white/40 p-3 text-center">
      <p className="text-xs text-[#86868b] mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}
