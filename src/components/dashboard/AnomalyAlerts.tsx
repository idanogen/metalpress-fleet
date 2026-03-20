import { TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import type { DriverAnomaly, Vehicle } from '@/types/fleet';

interface AnomalyAlertsProps {
  anomalies: DriverAnomaly[];
  onSelectVehicle: (vehicle: Vehicle) => void;
}

export function AnomalyAlerts({ anomalies, onSelectVehicle }: AnomalyAlertsProps) {
  if (anomalies.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card p-8 text-center"
      >
        <div className="w-12 h-12 rounded-full bg-[#34c759]/10 flex items-center justify-center mx-auto mb-3">
          <TrendingUp className="w-6 h-6 text-[#248a3d]" />
        </div>
        <p className="text-sm text-[#86868b]">לא זוהו חריגות החודש</p>
      </motion.div>
    );
  }

  const spikes = anomalies.filter(a => a.type === 'spike');
  const drops = anomalies.filter(a => a.type === 'drop');
  const chronic = anomalies.filter(a => a.type === 'chronic_no_report');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="glass-card overflow-hidden"
    >
      <div className="p-6 border-b border-white/30">
        <h2 className="text-lg font-bold text-[#1d1d1f]">התראות וחריגות</h2>
        <p className="text-xs text-[#86868b] mt-1">{anomalies.length} חריגות זוהו</p>
      </div>

      <div className="max-h-[400px] overflow-y-auto divide-y divide-black/[0.03]">
        {spikes.map((a, i) => (
          <div
            key={`spike-${i}`}
            onClick={() => onSelectVehicle(a.vehicle)}
            className="px-5 py-3 hover:bg-white/40 cursor-pointer transition-colors flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-2xl bg-[#ff9500]/10 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-[#c93400]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1d1d1f] truncate">{a.vehicle.driverName}</p>
              <p className="text-xs text-[#86868b] truncate">{a.vehicle.model}</p>
            </div>
            <div className="text-left shrink-0">
              <p className="text-sm font-bold text-[#ff9500]">+{a.deviation}%</p>
              <p className="text-xs text-[#86868b]">{a.currentValue.toLocaleString()} / {a.average.toLocaleString()}</p>
            </div>
          </div>
        ))}

        {drops.map((a, i) => (
          <div
            key={`drop-${i}`}
            onClick={() => onSelectVehicle(a.vehicle)}
            className="px-5 py-3 hover:bg-white/40 cursor-pointer transition-colors flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-2xl bg-[#007AFF]/10 flex items-center justify-center shrink-0">
              <TrendingDown className="w-4 h-4 text-[#007AFF]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1d1d1f] truncate">{a.vehicle.driverName}</p>
              <p className="text-xs text-[#86868b] truncate">{a.vehicle.model}</p>
            </div>
            <div className="text-left shrink-0">
              <p className="text-sm font-bold text-[#007AFF]">{a.deviation}%</p>
              <p className="text-xs text-[#86868b]">{a.currentValue.toLocaleString()} / {a.average.toLocaleString()}</p>
            </div>
          </div>
        ))}

        {chronic.map((a, i) => (
          <div
            key={`chronic-${i}`}
            onClick={() => onSelectVehicle(a.vehicle)}
            className="px-5 py-3 hover:bg-white/40 cursor-pointer transition-colors flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-2xl bg-[#ff3b30]/10 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-[#ff3b30]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1d1d1f] truncate">{a.vehicle.driverName}</p>
              <p className="text-xs text-[#86868b] truncate">{a.vehicle.model}</p>
            </div>
            <div className="text-left shrink-0">
              <p className="text-sm font-bold text-[#ff3b30]">{a.currentValue} חודשים</p>
              <p className="text-xs text-[#86868b]">ללא דיווח</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
