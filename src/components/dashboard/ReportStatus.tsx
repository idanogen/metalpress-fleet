import { CheckCircle2, XCircle, Phone, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import type { Vehicle, FleetStats } from '@/types/fleet';
import { getDriverAvgUsage, getMonthData } from '@/lib/analytics';

interface ReportStatusProps {
  stats: FleetStats;
  reportedVehicles: Vehicle[];
  unreportedVehicles: Vehicle[];
  selectedYear: string;
  selectedMonth: number;
  onSelectVehicle: (vehicle: Vehicle) => void;
}

export function ReportStatus({
  stats,
  reportedVehicles,
  unreportedVehicles,
  selectedYear,
  selectedMonth,
  onSelectVehicle,
}: ReportStatusProps) {
  const [activeTab, setActiveTab] = useState<'unreported' | 'reported'>('unreported');
  const [search, setSearch] = useState('');

  const filteredUnreported = unreportedVehicles.filter(v =>
    v.driverName.includes(search) || v.model.includes(search) || v.plateNumber.includes(search)
  );

  const filteredReported = reportedVehicles.filter(v =>
    v.driverName.includes(search) || v.model.includes(search) || v.plateNumber.includes(search)
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass-card overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 border-b border-white/30">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#1d1d1f]">סטטוס דיווח חודשי</h2>
          <span className="text-sm text-[#86868b]">
            {stats.reportedThisMonth} מתוך {stats.totalVehicles}
          </span>
        </div>
        <div className="h-2 bg-black/5 rounded-[10px] overflow-hidden">
          <div
            className="h-full rounded-[10px] bg-gradient-to-l from-[#007AFF] to-[#5ac8fa]"
            style={{ width: `${stats.reportPercentage}%` }}
          />
        </div>
        <p className="text-xs text-[#86868b] mt-2">{stats.reportPercentage.toFixed(1)}% דיווחו</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/30">
        <button
          onClick={() => setActiveTab('unreported')}
          className={`flex-1 px-4 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'unreported'
              ? 'text-[#ff9500] border-b-2 border-[#ff9500] bg-[#ff9500]/5'
              : 'text-[#86868b] hover:text-[#424245]'
          }`}
        >
          <XCircle className="w-4 h-4" />
          טרם דיווחו ({unreportedVehicles.length})
        </button>
        <button
          onClick={() => setActiveTab('reported')}
          className={`flex-1 px-4 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'reported'
              ? 'text-[#34c759] border-b-2 border-[#34c759] bg-[#34c759]/5'
              : 'text-[#86868b] hover:text-[#424245]'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          דיווחו ({reportedVehicles.length})
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-white/30">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
          <input
            type="text"
            placeholder="חיפוש נהג, רכב או לוחית..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-black/5 border-none rounded-xl pr-9 pl-3 py-2.5 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
          />
        </div>
      </div>

      {/* List */}
      <div className="max-h-[400px] overflow-y-auto">
        {activeTab === 'unreported' ? (
          filteredUnreported.length === 0 ? (
            <div className="p-8 text-center text-[#86868b] text-sm">
              {search ? 'לא נמצאו תוצאות' : 'כולם דיווחו!'}
            </div>
          ) : (
            filteredUnreported.map((vehicle, i) => (
              <div
                key={`${vehicle.id}-${vehicle.plateNumber}`}
                onClick={() => onSelectVehicle(vehicle)}
                className="flex items-center justify-between px-5 py-3 border-b border-black/[0.03] hover:bg-white/40 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#ff9500]/10 flex items-center justify-center text-xs font-bold text-[#c93400]">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1d1d1f]">{vehicle.driverName}</p>
                    <p className="text-xs text-[#86868b]">{vehicle.model} | {vehicle.plateNumber}</p>
                  </div>
                </div>
                <a
                  href={`tel:${vehicle.phone}`}
                  onClick={e => e.stopPropagation()}
                  className="w-8 h-8 rounded-xl bg-black/5 flex items-center justify-center hover:bg-[#007AFF]/10 transition-colors"
                >
                  <Phone className="w-4 h-4 text-[#86868b]" />
                </a>
              </div>
            ))
          )
        ) : (
          filteredReported.length === 0 ? (
            <div className="p-8 text-center text-[#86868b] text-sm">
              {search ? 'לא נמצאו תוצאות' : 'אף אחד עוד לא דיווח'}
            </div>
          ) : (
            filteredReported.map((vehicle) => {
              const monthData = getMonthData(vehicle, selectedYear, selectedMonth);
              const avg = getDriverAvgUsage(vehicle);
              const usage = monthData?.carUsage || 0;
              const diff = avg > 0 ? ((usage - avg) / avg * 100) : 0;

              return (
                <div
                  key={`${vehicle.id}-${vehicle.plateNumber}`}
                  onClick={() => onSelectVehicle(vehicle)}
                  className="flex items-center justify-between px-5 py-3 border-b border-black/[0.03] hover:bg-white/40 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#34c759]/10 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-[#248a3d]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#1d1d1f]">{vehicle.driverName}</p>
                      <p className="text-xs text-[#86868b]">{vehicle.model}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-[#1d1d1f]">{usage.toLocaleString()} ק"מ</p>
                    {avg > 0 && (
                      <p className={`text-xs ${diff > 20 ? 'text-[#ff9500]' : diff < -20 ? 'text-[#ff3b30]' : 'text-[#86868b]'}`}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(0)}% מהממוצע
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )
        )}
      </div>
    </motion.div>
  );
}
