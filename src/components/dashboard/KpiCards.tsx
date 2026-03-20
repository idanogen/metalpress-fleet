import { Car, CheckCircle2, AlertCircle, Gauge, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import type { FleetStats } from '@/types/fleet';

interface KpiCardsProps {
  stats: FleetStats;
}

const cards = [
  {
    key: 'total',
    label: 'רכבים פעילים',
    icon: Car,
    getValue: (s: FleetStats) => s.totalVehicles,
    iconBg: 'bg-[#007AFF]/10',
    iconColor: 'text-[#007AFF]',
  },
  {
    key: 'reported',
    label: 'דיווחו החודש',
    icon: CheckCircle2,
    getValue: (s: FleetStats) => s.reportedThisMonth,
    getSubtext: (s: FleetStats) => `${s.reportPercentage.toFixed(0)}%`,
    iconBg: 'bg-[#34c759]/10',
    iconColor: 'text-[#248a3d]',
  },
  {
    key: 'unreported',
    label: 'טרם דיווחו',
    icon: AlertCircle,
    getValue: (s: FleetStats) => s.notReportedThisMonth,
    getSubtext: (s: FleetStats) => `${(100 - s.reportPercentage).toFixed(0)}%`,
    iconBg: 'bg-[#ff9500]/10',
    iconColor: 'text-[#c93400]',
  },
  {
    key: 'avg',
    label: 'ק"מ ממוצע חודשי',
    icon: Gauge,
    getValue: (s: FleetStats) => s.avgMonthlyKm.toLocaleString(),
    iconBg: 'bg-[#5856D6]/10',
    iconColor: 'text-[#5856D6]',
  },
  {
    key: 'anomalies',
    label: 'חריגות שזוהו',
    icon: AlertTriangle,
    getValue: (s: FleetStats) => s.anomalyCount,
    iconBg: 'bg-[#ff3b30]/10',
    iconColor: 'text-[#ff3b30]',
  },
];

export function KpiCards({ stats }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-6">
      {cards.map((card, i) => {
        const Icon = card.icon;
        const value = card.getValue(stats);
        const subtext = card.getSubtext?.(stats);

        return (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
          >
            <div className="glass-card p-4 lg:p-6 hover:translate-y-[-8px] transition-all duration-300 cursor-default">
              <div className={`w-10 h-10 rounded-2xl ${card.iconBg} flex items-center justify-center mb-4`}>
                <Icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-2xl lg:text-3xl font-extrabold text-[#1d1d1f]">{value}</span>
                {subtext && (
                  <span className="text-sm font-bold text-[#86868b]">{subtext}</span>
                )}
              </div>

              <p className="text-sm text-[#86868b] mt-1">{card.label}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
