import { Car, CheckCircle2, AlertCircle, Gauge, AlertTriangle, PackageOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import type { FleetStats } from '@/types/fleet';

interface KpiCardsProps {
  stats: FleetStats;
  inventoryCount: number;
}

type CardDef = {
  key: string;
  label: string;
  icon: typeof Car;
  getValue: (s: FleetStats, inventoryCount: number) => string | number;
  getSubtext?: (s: FleetStats, inventoryCount: number) => string;
  iconBg: string;
  iconColor: string;
};

const cards: CardDef[] = [
  {
    key: 'total',
    label: 'רכבים פעילים',
    icon: Car,
    getValue: (s) => s.totalVehicles,
    iconBg: 'bg-[#007AFF]/10',
    iconColor: 'text-[#007AFF]',
  },
  {
    key: 'inventory',
    label: 'רכבי מלאי',
    icon: PackageOpen,
    getValue: (_s, inv) => inv,
    iconBg: 'bg-[#86868b]/10',
    iconColor: 'text-[#86868b]',
  },
  {
    key: 'reported',
    label: 'דיווחו החודש',
    icon: CheckCircle2,
    getValue: (s) => s.reportedThisMonth,
    getSubtext: (s) => `${s.reportPercentage.toFixed(0)}%`,
    iconBg: 'bg-[#34c759]/10',
    iconColor: 'text-[#248a3d]',
  },
  {
    key: 'unreported',
    label: 'טרם דיווחו',
    icon: AlertCircle,
    getValue: (s) => s.notReportedThisMonth,
    getSubtext: (s) => `${(100 - s.reportPercentage).toFixed(0)}%`,
    iconBg: 'bg-[#ff9500]/10',
    iconColor: 'text-[#c93400]',
  },
  {
    key: 'avg',
    label: 'ק"מ ממוצע חודשי',
    icon: Gauge,
    getValue: (s) => s.avgMonthlyKm.toLocaleString(),
    iconBg: 'bg-[#5856D6]/10',
    iconColor: 'text-[#5856D6]',
  },
  {
    key: 'anomalies',
    label: 'חריגות שזוהו',
    icon: AlertTriangle,
    getValue: (s) => s.anomalyCount,
    iconBg: 'bg-[#ff3b30]/10',
    iconColor: 'text-[#ff3b30]',
  },
];

export function KpiCards({ stats, inventoryCount }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-6">
      {cards.map((card, i) => {
        const Icon = card.icon;
        const value = card.getValue(stats, inventoryCount);
        const subtext = card.getSubtext?.(stats, inventoryCount);

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
