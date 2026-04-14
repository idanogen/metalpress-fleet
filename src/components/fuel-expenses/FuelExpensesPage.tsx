import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area,
} from 'recharts';
import { Fuel, TrendingDown, TrendingUp, Droplets, Building2, Search, ArrowUpDown, User } from 'lucide-react';
import type { Vehicle } from '@/types/fleet';
import { VehicleImage } from '@/components/ui/VehicleImage';
import { VehicleFuelDetail } from './VehicleFuelDetail';

const COLORS = ['#007AFF', '#34c759', '#ff9500', '#ff3b30', '#5856D6', '#ff2d55', '#5ac8fa', '#af52de'];

function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 80, damping: 20, mass: 1 });
  const [display, setDisplay] = useState('0');
  const prevValue = useRef(0);

  useEffect(() => {
    motionValue.set(prevValue.current);
    motionValue.set(value);
    prevValue.current = value;
  }, [value, motionValue]);

  useEffect(() => {
    const unsubscribe = spring.on('change', (v) => {
      setDisplay(Math.round(v).toLocaleString());
    });
    return unsubscribe;
  }, [spring]);

  return <>{prefix}{display}{suffix}</>;
}

const MONTH_NAMES = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];

const COMPANY_SHORT_NAMES: Record<string, string> = {
  'מטלפרס פתרונות חכמים בע"מ': 'פתרונות',
  'מטלפרס דלתות ומחיצות אש בע"מ': 'דלתות',
  'מטלפרס שירות בע"מ': 'שירות',
  'מטלפרס ניהול עשן בע"מ': 'ניהול עשן',
  "מטלפרס ייצוא (1982) בע'מ": 'ייצוא',
  'מטלפרס מיגון אש בע"מ': 'מיגון אש',
  'פ.א כוכב 2018 בע"מ': 'כוכב',
};

function shortenCompanyName(name: string): string {
  return COMPANY_SHORT_NAMES[name] || name;
}

interface FuelExpensesPageProps {
  vehicles: Vehicle[];
  selectedYear: string;
}

interface CompanyFuelData {
  name: string;
  shortName: string;
  totalCost: number;
  totalLiters: number;
  vehicleCount: number;
  avgCostPerVehicle: number;
  avgLitersPerVehicle: number;
  months: { month: string; cost: number; liters: number }[];
}

function getCompanyFuelBreakdown(vehicles: Vehicle[], year: string): CompanyFuelData[] {
  const map = new Map<string, { cost: number; liters: number; vehicles: Set<number>; months: Map<number, { cost: number; liters: number }> }>();

  for (const v of vehicles) {
    if (!v.company) continue;
    const company = v.company.trim();
    if (!map.has(company)) {
      map.set(company, { cost: 0, liters: 0, vehicles: new Set(), months: new Map() });
    }
    const entry = map.get(company)!;
    entry.vehicles.add(v.id);

    for (const m of v.monthlyUsage) {
      if (m.year !== year) continue;
      entry.cost += m.fuelCost || 0;
      entry.liters += m.fuelConsumption || 0;

      const monthNum = m.monthNum;
      if (!entry.months.has(monthNum)) {
        entry.months.set(monthNum, { cost: 0, liters: 0 });
      }
      const me = entry.months.get(monthNum)!;
      me.cost += m.fuelCost || 0;
      me.liters += m.fuelConsumption || 0;
    }
  }

  return Array.from(map.entries())
    .map(([name, data]) => ({
      name,
      shortName: shortenCompanyName(name),
      totalCost: Math.round(data.cost),
      totalLiters: Math.round(data.liters),
      vehicleCount: data.vehicles.size,
      avgCostPerVehicle: data.vehicles.size > 0 ? Math.round(data.cost / data.vehicles.size) : 0,
      avgLitersPerVehicle: data.vehicles.size > 0 ? Math.round(data.liters / data.vehicles.size) : 0,
      months: MONTH_NAMES.map((month, i) => {
        const me = data.months.get(i + 1);
        return { month, cost: Math.round(me?.cost || 0), liters: Math.round(me?.liters || 0) };
      }),
    }))
    .filter(c => c.totalCost > 0)
    .sort((a, b) => b.totalCost - a.totalCost);
}

interface VehicleFuelData {
  id: number;
  driverName: string;
  model: string;
  plateNumber: string;
  company: string;
  companyShort: string;
  totalCost: number;
  totalLiters: number;
  monthsReported: number;
  avgMonthlyCost: number;
  currentMileage: number;
}

function getVehicleFuelBreakdown(vehicles: Vehicle[], year: string): VehicleFuelData[] {
  return vehicles
    .map(v => {
      let cost = 0;
      let liters = 0;
      let months = 0;
      for (const m of v.monthlyUsage) {
        if (m.year !== year) continue;
        if ((m.fuelCost || 0) > 0 || (m.fuelConsumption || 0) > 0) {
          cost += m.fuelCost || 0;
          liters += m.fuelConsumption || 0;
          months++;
        }
      }
      return {
        id: v.id,
        driverName: v.driverName || '—',
        model: v.model || '—',
        plateNumber: v.plateNumber || '—',
        company: v.company || '',
        companyShort: shortenCompanyName(v.company || ''),
        totalCost: Math.round(cost),
        totalLiters: Math.round(liters),
        monthsReported: months,
        avgMonthlyCost: months > 0 ? Math.round(cost / months) : 0,
        currentMileage: v.currentMileage || 0,
      };
    })
    .filter(v => v.totalCost > 0 || v.totalLiters > 0);
}

type VehicleSortKey = 'totalCost' | 'totalLiters' | 'avgMonthlyCost' | 'driverName' | 'monthsReported';

function getYearOverYearChange(vehicles: Vehicle[], currentYear: string) {
  const prevYear = String(Number(currentYear) - 1);
  let currentTotal = 0;
  let prevTotal = 0;

  for (const v of vehicles) {
    for (const m of v.monthlyUsage) {
      if (m.year === currentYear) currentTotal += m.fuelCost || 0;
      if (m.year === prevYear) prevTotal += m.fuelCost || 0;
    }
  }

  const change = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0;
  return { currentTotal: Math.round(currentTotal), prevTotal: Math.round(prevTotal), change: Math.round(change) };
}

function getMonthlyFuelTrend(vehicles: Vehicle[], year: string) {
  const monthly = new Map<number, { cost: number; liters: number }>();

  for (const v of vehicles) {
    for (const m of v.monthlyUsage) {
      if (m.year !== year) continue;
      if (!monthly.has(m.monthNum)) monthly.set(m.monthNum, { cost: 0, liters: 0 });
      const entry = monthly.get(m.monthNum)!;
      entry.cost += m.fuelCost || 0;
      entry.liters += m.fuelConsumption || 0;
    }
  }

  return MONTH_NAMES.map((month, i) => {
    const data = monthly.get(i + 1);
    return { month, cost: Math.round(data?.cost || 0), liters: Math.round(data?.liters || 0) };
  }).filter(m => m.cost > 0 || m.liters > 0);
}

interface CompanyYoYData {
  shortName: string;
  currentYear: number;
  prevYear: number;
  diff: number;
  diffPercent: number;
}

function getCompanyYoYComparison(vehicles: Vehicle[], currentYear: string): CompanyYoYData[] {
  const prevYear = String(Number(currentYear) - 1);
  const map = new Map<string, { current: number; prev: number }>();

  for (const v of vehicles) {
    if (!v.company) continue;
    const company = v.company.trim();
    const short = shortenCompanyName(company);
    if (!map.has(short)) map.set(short, { current: 0, prev: 0 });
    const entry = map.get(short)!;

    for (const m of v.monthlyUsage) {
      if (m.year === currentYear) entry.current += m.fuelCost || 0;
      if (m.year === prevYear) entry.prev += m.fuelCost || 0;
    }
  }

  return Array.from(map.entries())
    .map(([shortName, data]) => ({
      shortName,
      currentYear: Math.round(data.current),
      prevYear: Math.round(data.prev),
      diff: Math.round(data.current - data.prev),
      diffPercent: data.prev > 0 ? Math.round(((data.current - data.prev) / data.prev) * 100) : 0,
    }))
    .filter(c => c.currentYear > 0 || c.prevYear > 0)
    .sort((a, b) => b.currentYear - a.currentYear);
}

function CostTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name?: string; color?: string; dataKey?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-2xl px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
      <p className="text-xs text-[#86868b] mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-bold text-[#1d1d1f]" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          {entry.dataKey === 'liters' || entry.dataKey === 'totalLiters' || entry.dataKey === 'avgLitersPerVehicle' ? ' ליטר' : ' ₪'}
        </p>
      ))}
    </div>
  );
}

function PieCostTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-2xl px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
      <p className="text-sm font-bold text-[#1d1d1f]">{payload[0].name}</p>
      <p className="text-sm text-[#424245]">{payload[0].value.toLocaleString()} ₪</p>
    </div>
  );
}

function getAvailableYears(vehicles: Vehicle[]): string[] {
  const years = new Set<string>();
  for (const v of vehicles) {
    for (const m of v.monthlyUsage) {
      if ((m.fuelCost || 0) > 0) years.add(m.year);
    }
  }
  return Array.from(years).sort().reverse();
}

export function FuelExpensesPage({ vehicles, selectedYear: initialYear }: FuelExpensesPageProps) {
  const availableYears = useMemo(() => getAvailableYears(vehicles), [vehicles]);
  const [year, setYear] = useState(() => {
    if (availableYears.includes(initialYear)) return initialYear;
    return availableYears[0] || initialYear;
  });
  const [selectedCompany, setSelectedCompany] = useState<string>('all');

  const [vehicleSearch, setVehicleSearch] = useState('');
  const [vehicleSort, setVehicleSort] = useState<VehicleSortKey>('totalCost');
  const [vehicleSortDir, setVehicleSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedVehicleDetail, setSelectedVehicleDetail] = useState<Vehicle | null>(null);

  const companyData = useMemo(() => getCompanyFuelBreakdown(vehicles, year), [vehicles, year]);
  const vehicleFuelData = useMemo(() => getVehicleFuelBreakdown(vehicles, year), [vehicles, year]);
  const companyYoY = useMemo(() => getCompanyYoYComparison(vehicles, year), [vehicles, year]);
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

  const filteredCompanyData = useMemo(() => {
    if (selectedCompany === 'all') return companyData;
    return companyData.filter(c => c.name === selectedCompany);
  }, [companyData, selectedCompany]);

  const totalCost = filteredCompanyData.reduce((sum, c) => sum + c.totalCost, 0);
  const totalLiters = filteredCompanyData.reduce((sum, c) => sum + c.totalLiters, 0);

  const filteredVehicleFuelData = useMemo(() => {
    let result = vehicleFuelData;
    if (selectedCompany !== 'all') {
      result = result.filter(v => v.company.trim() === selectedCompany);
    }
    if (vehicleSearch) {
      const s = vehicleSearch.toLowerCase();
      result = result.filter(v =>
        v.driverName.toLowerCase().includes(s) ||
        v.model.toLowerCase().includes(s) ||
        v.plateNumber.includes(s)
      );
    }
    const sorted = [...result].sort((a, b) => {
      const dir = vehicleSortDir === 'asc' ? 1 : -1;
      if (vehicleSort === 'driverName') return a.driverName.localeCompare(b.driverName, 'he') * dir;
      return (a[vehicleSort] - b[vehicleSort]) * dir;
    });
    return sorted;
  }, [vehicleFuelData, selectedCompany, vehicleSearch, vehicleSort, vehicleSortDir]);

  const toggleVehicleSort = (key: VehicleSortKey) => {
    if (vehicleSort === key) {
      setVehicleSortDir(vehicleSortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setVehicleSort(key);
      setVehicleSortDir('desc');
    }
  };
  const totalVehicles = filteredCompanyData.reduce((sum, c) => sum + c.vehicleCount, 0);
  const avgPerVehicle = totalVehicles > 0 ? Math.round(totalCost / totalVehicles) : 0;

  const filteredYoy = useMemo(() => getYearOverYearChange(filteredVehicles, year), [filteredVehicles, year]);

  const kpis = [
    {
      label: 'סה"כ עלות דלק',
      numValue: totalCost,
      prefix: '₪',
      suffix: '',
      icon: Fuel,
      iconBg: 'bg-[#ff9500]/10',
      iconColor: 'text-[#ff9500]',
      sub: year,
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
      sub: `${totalVehicles} רכבים`,
    },
    {
      label: `שינוי מ-${Number(year) - 1}`,
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
            className="bg-black/5 border-none rounded-xl px-3 py-2 text-sm font-bold text-[#424245] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 cursor-pointer"
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

      {/* Monthly Fuel Trend — Area Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="glass-card p-6"
      >
        <div className="mb-4">
          <h3 className="text-lg font-bold text-[#1d1d1f]">מגמת הוצאות דלק חודשית</h3>
          <p className="text-sm text-[#86868b]">{year}{selectedCompany !== 'all' ? ` — ${shortenCompanyName(selectedCompany)}` : ''}</p>
        </div>
        <div dir="ltr"><ResponsiveContainer width="100%" height={300}>
          <AreaChart data={companyMonthlyData || monthlyTrend}>
            <defs>
              <linearGradient id="fuelCostGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff9500" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ff9500" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fuelLitersGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#007AFF" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#007AFF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="month" tick={{ fill: '#86868b', fontSize: 11 }} />
            <YAxis tick={{ fill: '#86868b', fontSize: 11 }} tickFormatter={v => `₪${(v / 1000).toFixed(0)}K`} />
            <Tooltip content={<CostTooltip />} />
            <Legend formatter={v => <span className="text-xs text-[#424245]">{v}</span>} />
            <Area type="monotone" dataKey="cost" name="עלות ₪" stroke="#ff9500" strokeWidth={2.5} fill="url(#fuelCostGrad)" />
            <Area type="monotone" dataKey="liters" name="ליטרים" stroke="#007AFF" strokeWidth={2.5} fill="url(#fuelLitersGrad)" />
          </AreaChart>
        </ResponsiveContainer></div>
      </motion.div>

      {/* Year-over-Year Comparison */}
      {companyYoY.some(c => c.prevYear > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-6"
        >
          <h3 className="text-lg font-bold text-[#1d1d1f] mb-1">השוואת הוצאות דלק — {prevYearLabel} מול {year}</h3>
          <p className="text-sm text-[#86868b] mb-4">לפי חברה</p>
          <div dir="ltr"><ResponsiveContainer width="100%" height={350}>
            <BarChart data={companyYoY} margin={{ right: 80, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="shortName" tick={{ fill: '#424245', fontSize: 12 }} />
              <YAxis tick={{ fill: '#86868b', fontSize: 11 }} tickFormatter={v => `₪${(v / 1000).toFixed(0)}K`} />
              <Tooltip content={<CostTooltip />} />
              <Legend formatter={v => <span className="text-xs text-[#424245]">{v}</span>} />
              <Bar dataKey="prevYear" name={prevYearLabel} fill="#86868b" fillOpacity={0.4} radius={[8, 8, 0, 0]} />
              <Bar dataKey="currentYear" name={year} fill="#007AFF" fillOpacity={0.7} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer></div>

          {/* Diff Table */}
          <div className="mt-4 flex flex-wrap gap-3 justify-center">
            {companyYoY.map(c => (
              <div key={c.shortName} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/[0.03]">
                <span className="text-xs font-bold text-[#424245]">{c.shortName}</span>
                <span className={`text-xs font-bold ${c.diff <= 0 ? 'text-[#34c759]' : 'text-[#ff3b30]'}`}>
                  {c.diff <= 0 ? '' : '+'}{c.diffPercent}%
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost per Company — Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="glass-card p-6"
        >
          <h3 className="text-lg font-bold text-[#1d1d1f] mb-1">עלות דלק לפי חברה</h3>
          <p className="text-sm text-[#86868b] mb-4">סה"כ שנתי</p>
          <div dir="ltr"><ResponsiveContainer width="100%" height={350}>
            <BarChart data={companyData} layout="vertical" margin={{ right: 80, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis type="number" tick={{ fill: '#86868b', fontSize: 11 }} tickFormatter={v => `₪${(v / 1000).toFixed(0)}K`} />
              <YAxis dataKey="shortName" type="category" orientation="right" width={70} tick={{ fill: '#424245', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CostTooltip />} />
              <Bar dataKey="totalCost" name="עלות" radius={[0, 8, 8, 0]}>
                {companyData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer></div>
        </motion.div>

        {/* Cost Distribution — Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="glass-card p-6"
        >
          <h3 className="text-lg font-bold text-[#1d1d1f] mb-1">חלוקת הוצאות דלק</h3>
          <p className="text-sm text-[#86868b] mb-4">לפי חברה</p>
          <div dir="ltr"><ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={companyData.map(c => ({ name: c.shortName, value: c.totalCost }))}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
              >
                {companyData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<PieCostTooltip />} />
              <Legend formatter={v => <span className="text-xs text-[#424245]">{v}</span>} />
            </PieChart>
          </ResponsiveContainer></div>
        </motion.div>
      </div>

      {/* Liters per Company — Bar Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 }}
        className="glass-card p-6"
      >
        <h3 className="text-lg font-bold text-[#1d1d1f] mb-1">צריכת ליטרים לפי חברה</h3>
        <p className="text-sm text-[#86868b] mb-4">ממוצע לרכב</p>
        <div dir="ltr"><ResponsiveContainer width="100%" height={280}>
          <BarChart data={companyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="shortName" tick={{ fill: '#424245', fontSize: 11 }} />
            <YAxis tick={{ fill: '#86868b', fontSize: 11 }} />
            <Tooltip content={<CostTooltip />} />
            <Bar dataKey="avgLitersPerVehicle" name="ליטר ממוצע לרכב" radius={[8, 8, 0, 0]}>
              {companyData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer></div>
      </motion.div>

      {/* Company Comparison — Multi-line Chart */}
      {companyData.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
          className="glass-card p-6"
        >
          <h3 className="text-lg font-bold text-[#1d1d1f] mb-1">השוואת חברות — מגמה חודשית</h3>
          <p className="text-sm text-[#86868b] mb-4">עלות דלק ₪</p>
          <div dir="ltr"><ResponsiveContainer width="100%" height={320}>
            <LineChart data={MONTH_NAMES.map((month, i) => {
              const point: Record<string, string | number> = { month };
              for (const c of companyData) {
                point[c.shortName] = c.months[i]?.cost || 0;
              }
              return point;
            }).filter((_, i) => companyData.some(c => (c.months[i]?.cost || 0) > 0))}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="month" tick={{ fill: '#86868b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#86868b', fontSize: 11 }} tickFormatter={v => `₪${(v / 1000).toFixed(0)}K`} />
              <Tooltip content={<CostTooltip />} />
              <Legend formatter={v => <span className="text-xs text-[#424245]">{v}</span>} />
              {companyData.map((c, i) => (
                <Line
                  key={c.shortName}
                  type="monotone"
                  dataKey={c.shortName}
                  name={c.shortName}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: COLORS[i % COLORS.length] }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer></div>
        </motion.div>
      )}

      {/* Detailed Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85 }}
        className="glass-card overflow-hidden"
      >
        <div className="p-6 border-b border-white/30">
          <h3 className="text-lg font-bold text-[#1d1d1f]">פירוט לפי חברה</h3>
          <p className="text-sm text-[#86868b]">{year}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-white/40">
              <tr className="border-b border-white/30">
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">חברה</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">רכבים</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">ליטרים</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">עלות כוללת</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">ממוצע לרכב</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">חלק מהסה"כ</th>
              </tr>
            </thead>
            <tbody>
              {companyData.map((company, i) => (
                <tr key={company.name} className="border-b border-black/[0.03] hover:bg-white/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="font-medium text-[#1d1d1f]">{company.shortName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#424245]">{company.vehicleCount}</td>
                  <td className="px-4 py-3 text-[#424245]">{company.totalLiters.toLocaleString()}</td>
                  <td className="px-4 py-3 font-bold text-[#1d1d1f]">₪{company.totalCost.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[#424245]">₪{company.avgCostPerVehicle.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-black/5 rounded-full max-w-[100px]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${totalCost > 0 ? (company.totalCost / totalCost) * 100 : 0}%`,
                            backgroundColor: COLORS[i % COLORS.length],
                          }}
                        />
                      </div>
                      <span className="text-xs text-[#86868b]">
                        {totalCost > 0 ? Math.round((company.totalCost / totalCost) * 100) : 0}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-white/30 border-t-2 border-[#007AFF]/20">
                <td className="px-4 py-3 font-bold text-[#1d1d1f]">סה"כ</td>
                <td className="px-4 py-3 font-bold text-[#1d1d1f]">{totalVehicles}</td>
                <td className="px-4 py-3 font-bold text-[#1d1d1f]">{totalLiters.toLocaleString()}</td>
                <td className="px-4 py-3 font-bold text-[#007AFF]">₪{totalCost.toLocaleString()}</td>
                <td className="px-4 py-3 font-bold text-[#1d1d1f]">₪{avgPerVehicle.toLocaleString()}</td>
                <td className="px-4 py-3 font-bold text-[#1d1d1f]">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Per-Vehicle / Per-Driver Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.95 }}
        className="glass-card overflow-hidden"
      >
        <div className="p-6 border-b border-white/30 flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-[#007AFF]" />
            <div>
              <h3 className="text-lg font-bold text-[#1d1d1f]">פירוט לפי נהג ורכב</h3>
              <p className="text-sm text-[#86868b]">{year} · {filteredVehicleFuelData.length} רכבים</p>
            </div>
          </div>
          <div className="relative flex-1 max-w-[280px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
            <input
              type="text"
              placeholder="חיפוש נהג, דגם, לוחית..."
              value={vehicleSearch}
              onChange={e => setVehicleSearch(e.target.value)}
              className="w-full bg-black/5 border-none rounded-xl pr-9 pl-3 py-2.5 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="sticky top-0 bg-white/80 backdrop-blur-sm z-10">
              <tr className="border-b border-white/30">
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">
                  <button onClick={() => toggleVehicleSort('driverName')} className="flex items-center gap-1 hover:text-[#007AFF]">
                    נהג <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">דגם</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">לוחית</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">חברה</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">
                  <button onClick={() => toggleVehicleSort('totalLiters')} className="flex items-center gap-1 hover:text-[#007AFF]">
                    ליטרים <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">
                  <button onClick={() => toggleVehicleSort('totalCost')} className="flex items-center gap-1 hover:text-[#007AFF]">
                    עלות כוללת <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">
                  <button onClick={() => toggleVehicleSort('avgMonthlyCost')} className="flex items-center gap-1 hover:text-[#007AFF]">
                    ממוצע חודשי <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">
                  <button onClick={() => toggleVehicleSort('monthsReported')} className="flex items-center gap-1 hover:text-[#007AFF]">
                    חודשים <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">% מהסה"כ</th>
              </tr>
            </thead>
            <tbody>
              {filteredVehicleFuelData.map((v) => {
                const pct = totalCost > 0 ? (v.totalCost / totalCost) * 100 : 0;
                const fullVehicle = vehicles.find(vv => vv.id === v.id) || null;
                return (
                  <tr
                    key={v.id}
                    onClick={() => fullVehicle && setSelectedVehicleDetail(fullVehicle)}
                    className="border-b border-black/[0.03] hover:bg-white/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-[#1d1d1f] whitespace-nowrap">{v.driverName}</td>
                    <td className="px-4 py-3 text-[#424245]">
                      <div className="flex items-center gap-2.5 max-w-[200px]">
                        <VehicleImage model={v.model} width={40} height={28} />
                        <span className="truncate text-xs">{v.model}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#86868b] font-mono text-xs">{v.plateNumber}</td>
                    <td className="px-4 py-3 text-[#424245] text-xs">{v.companyShort || '—'}</td>
                    <td className="px-4 py-3 text-[#424245]">{v.totalLiters.toLocaleString()}</td>
                    <td className="px-4 py-3 font-bold text-[#1d1d1f] whitespace-nowrap">₪{v.totalCost.toLocaleString()}</td>
                    <td className="px-4 py-3 text-[#424245] whitespace-nowrap">₪{v.avgMonthlyCost.toLocaleString()}</td>
                    <td className="px-4 py-3 text-[#424245] text-center">{v.monthsReported}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-black/5 rounded-full max-w-[80px]">
                          <div className="h-full rounded-full bg-[#007AFF]" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-[#86868b] min-w-[32px]">{pct.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredVehicleFuelData.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-[#86868b]">
                    אין נתוני דלק תואמים
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 border-t border-white/30 text-xs text-[#86868b]">
          מציג {filteredVehicleFuelData.length} מתוך {vehicleFuelData.length} רכבים עם נתוני דלק
        </div>
      </motion.div>

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
