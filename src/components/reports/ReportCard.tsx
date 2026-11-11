import { useState } from 'react';
import { Check, Fuel, Download, Building2 } from 'lucide-react';

export interface ReportStat {
  label: string;
  value: string;
  icon: typeof Fuel;
}

export function ReportCard({ icon: Icon, color, title, description, period, stats, onExport, tabInfo }: {
  icon: typeof Fuel;
  color: string;
  title: string;
  description: string;
  period: string;
  stats: ReportStat[];
  onExport: () => void;
  tabInfo?: string;
}) {
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    onExport();
    setExporting(true);
    setTimeout(() => setExporting(false), 1500);
  };

  return (
    <div
      className="relative overflow-hidden rounded-[20px] border border-black/[0.04] bg-gradient-to-l from-transparent"
      style={{ backgroundColor: `${color}05` }}
    >
      <div className="absolute top-3 right-3 w-11 h-11 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>

      <div className="relative p-5 pr-16">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h4 className="text-[15px] font-bold text-[#1d1d1f]">{title}</h4>
            <p className="text-xs text-[#86868b] mt-0.5">{description}</p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ backgroundColor: `${color}12`, color }}>{period}</span>
        </div>

        <div className="flex items-center gap-3 mb-4">
          {stats.map((stat) => {
            const StatIcon = stat.icon;
            return (
              <div key={stat.label} className="flex-1 flex items-center gap-2 p-2.5 rounded-xl bg-white/60 backdrop-blur-sm">
                <StatIcon className="w-3.5 h-3.5 text-[#86868b] flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-[#86868b] truncate">{stat.label}</p>
                  <p className="text-sm font-bold text-[#1d1d1f] truncate">{stat.value}</p>
                </div>
              </div>
            );
          })}
        </div>

        {tabInfo && (
          <p className="text-[11px] text-[#86868b] mb-2 flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            {tabInfo}
          </p>
        )}

        <button
          onClick={handleExport}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-300"
          style={{
            backgroundColor: exporting ? '#34c75920' : `${color}10`,
            color: exporting ? '#34c759' : color,
          }}
        >
          {exporting ? (
            <>
              <Check className="w-4 h-4" />
              הקובץ ירד!
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              הורד Excel
            </>
          )}
        </button>
      </div>
    </div>
  );
}
