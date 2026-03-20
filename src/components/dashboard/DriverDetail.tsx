import { X, Phone, Car, Calendar, Gauge, TrendingUp, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import type { Vehicle } from '@/types/fleet';
import { getDriverAvgUsage } from '@/lib/analytics';
import { VehicleImage } from '@/components/ui/VehicleImage';

interface DriverDetailProps {
  vehicle: Vehicle | null;
  onClose: () => void;
}

export function DriverDetail({ vehicle, onClose }: DriverDetailProps) {
  if (!vehicle) return null;

  const avg = getDriverAvgUsage(vehicle);
  const last12 = [...vehicle.monthlyUsage]
    .sort((a, b) => {
      if (a.year !== b.year) return a.year.localeCompare(b.year);
      return a.monthNum - b.monthNum;
    })
    .slice(-12);

  const chartData = last12.map(m => ({
    month: `${m.monthName} ${m.year.slice(2)}`,
    km: m.carUsage,
    reported: m.mileage > 0,
  }));

  const totalKm = vehicle.monthlyUsage.reduce((sum, m) => sum + m.carUsage, 0);
  const maxKm = Math.max(...vehicle.monthlyUsage.map(m => m.carUsage));
  const minKm = Math.min(...vehicle.monthlyUsage.filter(m => m.carUsage > 0).map(m => m.carUsage));
  const monthsWithData = vehicle.monthlyUsage.filter(m => m.carUsage > 0).length;
  const reportedMonths = vehicle.monthlyUsage.filter(m => m.mileage > 0).length;

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

        {/* Panel */}
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
              <InfoCard icon={Car} label="לוחית" value={vehicle.plateNumber} />
              <InfoCard icon={Phone} label="טלפון" value={vehicle.phone} isPhone />
              <InfoCard icon={Calendar} label="סוג בעלות" value={vehicle.ownershipType} />
              <InfoCard icon={Gauge} label="מד אוזר" value={vehicle.currentMileage > 0 ? `${vehicle.currentMileage.toLocaleString()} ק"מ` : 'לא דווח'} />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatBox label="ממוצע חודשי" value={`${Math.round(avg).toLocaleString()}`} unit="ק״מ" color="text-[#007AFF]" />
              <StatBox label="מקסימום" value={`${maxKm.toLocaleString()}`} unit="ק״מ" color="text-[#ff9500]" />
              <StatBox label="מינימום" value={minKm > 0 ? `${minKm.toLocaleString()}` : '—'} unit="ק״מ" color="text-[#34c759]" />
              <StatBox label="דיווחים" value={`${reportedMonths}/${monthsWithData}`} unit="" color="text-[#5856D6]" />
            </div>

            {/* Chart */}
            <div className="rounded-2xl bg-white/30 border border-white/40 p-4">
              <h3 className="text-sm font-bold text-[#1d1d1f] mb-3">ק"מ חודשי — 12 חודשים אחרונים</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="month" tick={{ fill: '#86868b', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#86868b', fontSize: 10 }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-2xl px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
                          <p className="text-xs text-[#86868b]">{label}</p>
                          <p className="text-sm font-bold text-[#1d1d1f]">{Number(payload[0].value).toLocaleString()} ק"מ</p>
                          <p className="text-xs text-[#86868b]">{d.reported ? 'דווח' : 'לא דווח'}</p>
                        </div>
                      );
                    }}
                  />
                  {avg > 0 && <ReferenceLine y={avg} stroke="#007AFF" strokeDasharray="3 3" label={{ value: 'ממוצע', fill: '#007AFF', fontSize: 10, position: 'right' }} />}
                  <Bar dataKey="km" radius={[4, 4, 0, 0]}>
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

            {/* Report History */}
            <div className="rounded-2xl bg-white/30 border border-white/40 p-4">
              <h3 className="text-sm font-bold text-[#1d1d1f] mb-3">היסטוריית דיווח</h3>
              <div className="flex flex-wrap gap-1.5">
                {[...vehicle.monthlyUsage]
                  .sort((a, b) => {
                    if (a.year !== b.year) return b.year.localeCompare(a.year);
                    return b.monthNum - a.monthNum;
                  })
                  .slice(0, 24)
                  .map((m, i) => (
                    <div
                      key={i}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-medium ${
                        m.mileage > 0
                          ? 'bg-[#34c759]/15 text-[#248a3d]'
                          : 'bg-black/[0.03] text-[#86868b]/50'
                      }`}
                      title={`${m.monthName} ${m.year}: ${m.mileage > 0 ? 'דווח' : 'לא דווח'}`}
                    >
                      {m.monthNum}
                    </div>
                  ))}
              </div>
              <p className="text-xs text-[#86868b] mt-2">ירוק = דווח | אפור = לא דווח</p>
            </div>

            {/* Total */}
            <div className="text-center py-4 border-t border-white/30">
              <p className="text-xs text-[#86868b]">סה"כ ק"מ מתועד</p>
              <p className="text-2xl font-extrabold text-[#1d1d1f]">{totalKm.toLocaleString()}</p>
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

  if (isPhone && value) {
    return <a href={`tel:${value}`} className="block hover:opacity-80 transition-opacity">{content}</a>;
  }
  return content;
}

function StatBox({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="rounded-2xl bg-white/30 border border-white/40 p-3 text-center">
      <p className="text-xs text-[#86868b] mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      {unit && <p className="text-xs text-[#86868b]/60">{unit}</p>}
    </div>
  );
}
