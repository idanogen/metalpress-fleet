import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Fuel, TrendingDown, TrendingUp, Droplets, Building2 } from 'lucide-react';
import type { Vehicle } from '@/types/fleet';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { VehicleFuelDetail } from './VehicleFuelDetail';
import { FuelCharts } from './FuelCharts';
import { FuelCompanyTable } from './FuelCompanyTable';
import { FuelVehicleTable } from './FuelVehicleTable';
import {
  MONTH_NAMES_FULL, getAvailableYears, getCompanyFuelBreakdown, getVehicleFuelBreakdown, getLastFuelMonth,
  getCompanyYoYComparison, getMonthlyFuelTrend, getYearOverYearChange, getFuelTotals,
} from '@/lib/fuelStats';

interface FuelExpensesPageProps {
  vehicles: Vehicle[];
  selectedYear: string;
}

export function FuelExpensesPage({ vehicles, selectedYear: initialYear }: FuelExpensesPageProps) {
  const availableYears = useMemo(() => getAvailableYears(vehicles), [vehicles]);
  const [year, setYear] = useState(() => {
    if (availableYears.includes(initialYear)) return initialYear;
    return availableYears[0] || initialYear;
  });
  const [selectedCompany, setSelectedCompany] = useState<string>('all');

  const [selectedVehicleDetail, setSelectedVehicleDetail] = useState<Vehicle | null>(null);

  const companyData = useMemo(() => getCompanyFuelBreakdown(vehicles, year), [vehicles, year]);
  const vehicleFuelData = useMemo(() => getVehicleFuelBreakdown(vehicles, year), [vehicles, year]);
  const lastFuelMonth = useMemo(() => getLastFuelMonth(vehicles, year), [vehicles, year]);
  const periodLabel = lastFuelMonth > 0 && lastFuelMonth < 12
    ? `ינואר עד ${MONTH_NAMES_FULL[lastFuelMonth]} ${year}`
    : `כל שנת ${year}`;
  const companyYoY = useMemo(
    () => getCompanyYoYComparison(vehicles, year, lastFuelMonth),
    [vehicles, year, lastFuelMonth],
  );
  const prevYearLabel = String(Number(year) - 1);
  const monthlyTrend = useMemo(() => getMonthlyFuelTrend(vehicles, year), [vehicles, year]);

  // Company-specific monthly trend
  const companyMonthlyData = useMemo(() => {
    if (selectedCompany === 'all') return null;
    return companyData.find(c => c.name === selectedCompany)?.months.filter(m => m.cost > 0) || [];
  }, [companyData, selectedCompany]);

  // Filter vehicles by selected company for KPIs
  const filteredVehicles = useMemo(() => {
    if (selectedCompany === 'all') return vehicles;
    return vehicles.filter(v => v.company?.trim() === selectedCompany);
  }, [vehicles, selectedCompany]);

  // הסכום מעוגל פעם אחת בסוף (לא סכום של חברות מעוגלות), כדי שיהיה זהה לשקל לדוח הדלק.
  const { totalCost, totalLiters } = useMemo(() => getFuelTotals(filteredVehicles, year), [filteredVehicles, year]);

  // הממוצע מחולק ברכבים שתדלקו בפועל, לא בכל הרכבים של החברה.
  const fueledRows = selectedCompany === 'all'
    ? vehicleFuelData
    : vehicleFuelData.filter(v => v.company.trim() === selectedCompany);
  const fueledVehicles = fueledRows.length;
  const avgPerVehicle = fueledVehicles > 0 ? Math.round(totalCost / fueledVehicles) : 0;
  const inventoryCost = fueledRows.filter(v => v.isInventory).reduce((sum, v) => sum + v.totalCost, 0);

  const filteredYoy = useMemo(
    () => getYearOverYearChange(filteredVehicles, year, lastFuelMonth),
    [filteredVehicles, year, lastFuelMonth],
  );

  const kpis = [
    {
      label: 'סה"כ עלות דלק',
      numValue: totalCost,
      prefix: '₪',
      suffix: '',
      icon: Fuel,
      iconBg: 'bg-[#ff9500]/10',
      iconColor: 'text-[#ff9500]',
      sub: inventoryCost > 0 ? `${periodLabel} · מתוכו ₪${inventoryCost.toLocaleString()} רכבי מלאי` : periodLabel,
    },
    {
      label: 'סה"כ ליטרים',
      numValue: totalLiters,
      prefix: '',
      suffix: '',
      icon: Droplets,
      iconBg: 'bg-[#007AFF]/10',
      iconColor: 'text-[#007AFF]',
      sub: 'ליטר',
    },
    {
      label: 'ממוצע לרכב',
      numValue: avgPerVehicle,
      prefix: '₪',
      suffix: '',
      icon: Building2,
      iconBg: 'bg-[#5856D6]/10',
      iconColor: 'text-[#5856D6]',
      sub: `${fueledVehicles} רכבים שתדלקו`,
    },
    {
      label: `שינוי מול אותם חודשים ב-${Number(year) - 1}`,
      numValue: filteredYoy.change,
      prefix: filteredYoy.change > 0 ? '+' : '',
      suffix: '%',
      icon: filteredYoy.change <= 0 ? TrendingDown : TrendingUp,
      iconBg: filteredYoy.change <= 0 ? 'bg-[#34c759]/10' : 'bg-[#ff3b30]/10',
      iconColor: filteredYoy.change <= 0 ? 'text-[#34c759]' : 'text-[#ff3b30]',
      sub: `₪${filteredYoy.prevTotal.toLocaleString()} → ₪${filteredYoy.currentTotal.toLocaleString()}`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Year & Company Selector */}
      <div className="flex items-center gap-4 flex-wrap">
        {availableYears.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#86868b]">שנה:</span>
            <div className="flex items-center bg-black/5 rounded-2xl p-1">
              {availableYears.map(y => (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                    year === y
                      ? 'bg-white text-[#ff9500] shadow-sm'
                      : 'text-[#86868b] hover:text-[#424245]'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[#86868b]">חברה:</span>
          <select
            value={selectedCompany}
            onChange={e => setSelectedCompany(e.target.value)}
            className="bg-black/5 border-none rounded-xl px-3 py-2 text-sm
              font-bold text-[#424245] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 cursor-pointer"
          >
            <option value="all">כל החברות</option>
            {companyData.map(c => (
              <option key={c.name} value={c.name}>{c.shortName}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
            >
              <div className="glass-card p-4 lg:p-6 hover:translate-y-[-8px] transition-all duration-300 cursor-default">
                <div className={`w-10 h-10 rounded-2xl ${kpi.iconBg} flex items-center justify-center mb-4`}>
                  <Icon className={`w-5 h-5 ${kpi.iconColor}`} />
                </div>
                <span className="text-2xl lg:text-3xl font-extrabold text-[#1d1d1f]">
                  <AnimatedNumber value={kpi.numValue} prefix={kpi.prefix} suffix={kpi.suffix} />
                </span>
                <p className="text-sm text-[#86868b] mt-1">{kpi.label}</p>
                <p className="text-xs text-[#c7c7cc] mt-0.5">{kpi.sub}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <FuelCharts
        year={year}
        selectedCompany={selectedCompany}
        companyData={companyData}
        monthlyTrend={monthlyTrend}
        companyMonthlyData={companyMonthlyData}
        companyYoY={companyYoY}
        prevYearLabel={prevYearLabel}
        periodLabel={periodLabel}
      />

      <FuelCompanyTable
        year={year}
        companyData={companyData}
        totalCost={totalCost}
        totalLiters={totalLiters}
        totalVehicles={fueledVehicles}
        avgPerVehicle={avgPerVehicle}
      />

      <FuelVehicleTable
        year={year}
        rows={fueledRows}
        totalRows={vehicleFuelData.length}
        totalCost={totalCost}
        onSelect={(id) => setSelectedVehicleDetail(vehicles.find(v => v.id === id) ?? null)}
      />

      {/* Per-vehicle fuel drawer */}
      {selectedVehicleDetail && (
        <VehicleFuelDetail
          vehicle={selectedVehicleDetail}
          year={year}
          onClose={() => setSelectedVehicleDetail(null)}
        />
      )}
    </div>
  );
}
