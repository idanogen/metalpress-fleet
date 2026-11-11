import { motion } from 'framer-motion';
import { FileDown, Check, Fuel, Route, AlertTriangle, Building2, Users, Car, TrendingUp } from 'lucide-react';
import type { Vehicle } from '@/types/fleet';
import { loadSettings } from '@/components/settings/SettingsPage';
import { exportExcel } from '@/lib/excelExport';
import { getFuelTotals } from '@/lib/fuelStats';

const MONTH_NAMES_HE: Record<number, string> = {
  1: 'ינואר', 2: 'פברואר', 3: 'מרץ', 4: 'אפריל', 5: 'מאי', 6: 'יוני',
  7: 'יולי', 8: 'אוגוסט', 9: 'ספטמבר', 10: 'אוקטובר', 11: 'נובמבר', 12: 'דצמבר',
};

import { ReportCard } from './ReportCard';
import type { ReportStat } from './ReportCard';

interface ReportsPageProps {
  vehicles: Vehicle[];
  /** כל הרכבים כולל מלאי. דוח הדלק סופר את כולם, כמו מסך הוצאות הדלק. */
  allVehicles: Vehicle[];
  selectedYear: string;
  selectedMonth: number;
}

export function ReportsPage({ vehicles, allVehicles, selectedYear, selectedMonth }: ReportsPageProps) {
  const fuelVehicles = allVehicles;
  const settings = loadSettings();

  // Find the latest year that has fuel data (fuel data may lag behind km data)
  const fuelYear = (() => {
    const years = new Set<string>();
    for (const v of fuelVehicles) {
      for (const m of v.monthlyUsage) {
        if ((m.fuelCost || 0) > 0) years.add(m.year);
      }
    }
    const sorted = [...years].sort().reverse();
    return sorted[0] || selectedYear;
  })();

  const getCompanyLabel = (name: string) => settings.companyShortNames[name] || name;

  const exportFuelReport = async () => {
    const rows: Record<string, string | number>[] = [];
    let totalCost = 0, totalLiters = 0;

    for (const v of fuelVehicles) {
      let cost = 0, liters = 0;
      for (const m of v.monthlyUsage) {
        if (m.year !== fuelYear) continue;
        cost += m.fuelCost || 0;
        liters += m.fuelConsumption || 0;
      }
      totalCost += cost;
      totalLiters += liters;
      rows.push({
        driver: v.driverName,
        model: v.model,
        plate: v.plateNumber,
        company: getCompanyLabel(v.company),
        liters: Math.round(liters),
        cost: Math.round(cost),
      });
    }

    // Sort by cost descending
    rows.sort((a, b) => (b.cost as number) - (a.cost as number));

    await exportExcel({
      sheetName: `דוח_דלק_${fuelYear}`,
      title: `דוח הוצאות דלק — ${fuelYear}`,
      subtitle: `${new Date().toLocaleDateString('he-IL')} | ${fuelVehicles.length} רכבים | סה"כ ₪${Math.round(totalCost).toLocaleString()}`,
      accentColor: 'FF9500',
      columns: [
        { header: 'נהג', key: 'driver', width: 20, type: 'text' },
        { header: 'דגם', key: 'model', width: 22, type: 'text' },
        { header: 'לוחית', key: 'plate', width: 14, type: 'text' },
        { header: 'חברה', key: 'company', width: 18, type: 'text' },
        { header: 'ליטרים', key: 'liters', width: 14, type: 'number' },
        { header: 'עלות דלק', key: 'cost', width: 16, type: 'currency' },
      ],
      rows,
      summaryRow: {
        driver: 'סה"כ',
        model: '',
        plate: '',
        company: `${fuelVehicles.length} רכבים`,
        liters: Math.round(totalLiters),
        cost: Math.round(totalCost),
      },
      tabGroupKey: 'company',
    });
  };

  const exportKmReport = async () => {
    const monthName = MONTH_NAMES_HE[selectedMonth] || '';
    const rows: Record<string, string | number>[] = [];
    let totalKm = 0, reported = 0;

    for (const v of vehicles) {
      const month = v.monthlyUsage.find(m => m.year === selectedYear && m.monthNum === selectedMonth);
      const km = month?.mileage || 0;
      const didReport = km > 0;
      if (didReport) { totalKm += km; reported++; }
      rows.push({
        driver: v.driverName,
        model: v.model,
        plate: v.plateNumber,
        company: getCompanyLabel(v.company),
        km,
        status: didReport ? 'דיווח' : 'טרם דיווח',
      });
    }

    await exportExcel({
      sheetName: `דוח_קמ_${monthName}_${selectedYear}`,
      title: `דוח קילומטראז' חודשי — ${monthName} ${selectedYear}`,
      subtitle: `${reported} דיווחו מתוך ${vehicles.length} | סה"כ ${totalKm.toLocaleString()} ק"מ`,
      accentColor: '007AFF',
      columns: [
        { header: 'נהג', key: 'driver', width: 20, type: 'text' },
        { header: 'דגם', key: 'model', width: 22, type: 'text' },
        { header: 'לוחית', key: 'plate', width: 14, type: 'text' },
        { header: 'חברה', key: 'company', width: 18, type: 'text' },
        { header: 'ק"מ', key: 'km', width: 14, type: 'number' },
        { header: 'סטטוס', key: 'status', width: 14, type: 'text' },
      ],
      rows,
      summaryRow: {
        driver: 'סה"כ',
        model: '',
        plate: '',
        company: `${reported} דיווחו`,
        km: totalKm,
        status: `${Math.round((reported / vehicles.length) * 100)}%`,
      },
      tabGroupKey: 'company',
    });
  };

  const exportAnomalyReport = async () => {
    const threshold = settings.anomalyThreshold;
    const rows: Record<string, string | number>[] = [];

    for (const v of vehicles) {
      const month = v.monthlyUsage.find(m => m.year === selectedYear && m.monthNum === selectedMonth);
      if (!month || month.mileage <= 0) continue;

      const otherMonths = v.monthlyUsage.filter(m => m.mileage > 0 && !(m.year === selectedYear && m.monthNum === selectedMonth));
      if (otherMonths.length === 0) continue;

      const avg = otherMonths.reduce((s, m) => s + m.mileage, 0) / otherMonths.length;
      const deviation = ((month.mileage - avg) / avg) * 100;

      if (Math.abs(deviation) > threshold) {
        rows.push({
          driver: v.driverName,
          model: v.model,
          plate: v.plateNumber,
          company: getCompanyLabel(v.company),
          type: deviation > 0 ? 'עלייה חדה' : 'ירידה חדה',
          km: month.mileage,
          avg: Math.round(avg),
          deviation: `${Math.round(deviation)}%`,
        });
      }
    }

    const monthName = MONTH_NAMES_HE[selectedMonth] || '';

    await exportExcel({
      sheetName: `דוח_חריגות_${selectedYear}`,
      title: `דוח חריגות קילומטראז' — ${monthName} ${selectedYear}`,
      subtitle: `סף חריגה: ${threshold}% | ${rows.length} חריגות זוהו`,
      accentColor: 'FF3B30',
      columns: [
        { header: 'נהג', key: 'driver', width: 20, type: 'text' },
        { header: 'דגם', key: 'model', width: 20, type: 'text' },
        { header: 'לוחית', key: 'plate', width: 14, type: 'text' },
        { header: 'חברה', key: 'company', width: 16, type: 'text' },
        { header: 'סוג', key: 'type', width: 14, type: 'text' },
        { header: 'ק"מ בפועל', key: 'km', width: 14, type: 'number' },
        { header: 'ממוצע', key: 'avg', width: 14, type: 'number' },
        { header: 'סטייה', key: 'deviation', width: 12, type: 'percent' },
      ],
      rows,
      tabGroupKey: 'company',
    });
  };

  // Compute stats for cards
  const fuelStats = (() => {
    const { totalCost, totalLiters } = getFuelTotals(fuelVehicles, fuelYear);
    const companySet = new Set<string>();
    for (const v of fuelVehicles) if (v.company) companySet.add(v.company.trim());
    return [
      { label: 'חברות', value: String(companySet.size), icon: Building2 },
      { label: 'סה"כ עלות', value: `₪${totalCost.toLocaleString()}`, icon: TrendingUp },
      { label: 'סה"כ ליטרים', value: totalLiters.toLocaleString(), icon: Fuel },
    ] as ReportStat[];
  })();

  const kmStats = (() => {
    let reported = 0, totalKm = 0;
    for (const v of vehicles) {
      const month = v.monthlyUsage.find(m => m.year === selectedYear && m.monthNum === selectedMonth);
      if (month && month.mileage > 0) { reported++; totalKm += month.mileage; }
    }
    return [
      { label: 'נהגים', value: String(vehicles.length), icon: Users },
      { label: 'דיווחו', value: String(reported), icon: Check },
      { label: 'סה"כ ק"מ', value: totalKm.toLocaleString(), icon: Route },
    ] as ReportStat[];
  })();

  const anomalyStats = (() => {
    let spikes = 0, drops = 0;
    const threshold = settings.anomalyThreshold;
    for (const v of vehicles) {
      const month = v.monthlyUsage.find(m => m.year === selectedYear && m.monthNum === selectedMonth);
      if (!month || month.mileage <= 0) continue;
      const others = v.monthlyUsage.filter(m => m.mileage > 0 && !(m.year === selectedYear && m.monthNum === selectedMonth));
      if (others.length === 0) continue;
      const avg = others.reduce((s, m) => s + m.mileage, 0) / others.length;
      const dev = ((month.mileage - avg) / avg) * 100;
      if (dev > threshold) spikes++;
      else if (dev < -threshold) drops++;
    }
    return [
      { label: 'עליות חדות', value: String(spikes), icon: TrendingUp },
      { label: 'ירידות חדות', value: String(drops), icon: AlertTriangle },
      { label: 'סה"כ חריגות', value: String(spikes + drops), icon: Car },
    ] as ReportStat[];
  })();

  const companyCount = new Set(vehicles.map(v => v.company).filter(Boolean)).size;
  const tabInfoText = `כולל לשוניות לפי חברה (${companyCount} חברות)`;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-extrabold text-[#1d1d1f]">ייצוא דוחות</h2>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-[#34c759]/10 flex items-center justify-center">
            <FileDown className="w-5 h-5 text-[#34c759]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#1d1d1f]">דוחות להורדה</h3>
            <p className="text-sm text-[#86868b]">הורדת דוחות כקובץ Excel — כל דוח כולל לשוניות לפי חברה</p>
          </div>
        </div>

        <div className="space-y-4">
          <ReportCard
            icon={Fuel}
            color="#ff9500"
            title="דוח הוצאות דלק"
            description="עלות דלק וליטרים לכל נהג — לשוניות לפי חברה"
            period={fuelYear}
            stats={fuelStats}
            onExport={exportFuelReport}
            tabInfo={tabInfoText}
          />

          <ReportCard
            icon={Route}
            color="#007AFF"
            title="דוח קילומטראז' חודשי"
            description="ק״מ לכל נהג, סטטוס דיווח, דגם ולוחית — לחודש נבחר"
            period={`${MONTH_NAMES_HE[selectedMonth]} ${selectedYear}`}
            stats={kmStats}
            onExport={exportKmReport}
            tabInfo={tabInfoText}
          />

          <ReportCard
            icon={AlertTriangle}
            color="#ff3b30"
            title="דוח חריגות קילומטראז'"
            description={`נהגים שחורגים ב-${settings.anomalyThreshold}%+ מהממוצע האישי שלהם`}
            period={`${MONTH_NAMES_HE[selectedMonth]} ${selectedYear}`}
            stats={anomalyStats}
            onExport={exportAnomalyReport}
            tabInfo={tabInfoText}
          />

          <ReportCard
            icon={Car}
            color="#5856D6"
            title="דוח צי מלא"
            description="כל הרכבים הפעילים — נהג, דגם, לוחית, חברה, ספק, בעלות, ק״מ"
            period="עדכני"
            stats={[
              { label: 'רכבים פעילים', value: String(vehicles.length), icon: Car },
              { label: 'חברות', value: String(companyCount), icon: Building2 },
              { label: 'ספקים', value: String(new Set(vehicles.map(v => v.supplier).filter(Boolean)).size), icon: Users },
            ]}
            onExport={async () => {
              const rows = vehicles.map(v => ({
                driver: v.driverName,
                model: v.model,
                plate: v.plateNumber,
                company: getCompanyLabel(v.company),
                supplier: v.supplier || '',
                ownership: v.ownershipType || '',
                km: v.currentMileage || 0,
                rent: v.rentValue || 0,
              }));
              await exportExcel({
                sheetName: 'צי_רכבים_מלא',
                title: 'דוח צי רכבים מלא — MetalPress',
                subtitle: `${vehicles.length} רכבים פעילים | ${new Date().toLocaleDateString('he-IL')}`,
                accentColor: '5856D6',
                columns: [
                  { header: 'נהג', key: 'driver', width: 20, type: 'text' },
                  { header: 'דגם', key: 'model', width: 22, type: 'text' },
                  { header: 'לוחית', key: 'plate', width: 14, type: 'text' },
                  { header: 'חברה', key: 'company', width: 18, type: 'text' },
                  { header: 'ספק', key: 'supplier', width: 16, type: 'text' },
                  { header: 'בעלות', key: 'ownership', width: 14, type: 'text' },
                  { header: 'ק"מ נוכחי', key: 'km', width: 14, type: 'number' },
                  { header: 'שכירות', key: 'rent', width: 14, type: 'currency' },
                ],
                rows,
                tabGroupKey: 'company',
              });
            }}
            tabInfo={tabInfoText}
          />
        </div>
      </motion.div>
    </div>
  );
}
