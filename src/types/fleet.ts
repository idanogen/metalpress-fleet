export interface MonthlyUsage {
  year: string;
  monthName: string;
  monthNum: number;
  startDate: string;
  endDate: string;
  days: number;
  mileage: number; // קילומטראז' מפריורטי (0 = לא דווח)
  fuelConsumption: number;
  fuelCost: number;
  carUsage: number; // מזהה שורה פנימי של פריורטי — לא לשימוש בתצוגה
  source: string; // priority / whatsapp_bot / manual
  // Additional cost categories from Priority METL_CARUSAGE_SUBFORM
  road6Cost: number;
  road6NorthCost: number;
  pangoCost: number;
  carmelCost: number;
  reportsCost: number;
  maintenanceCost: number;
  insuranceCost: number;
  licenseCost: number;
  ituranCost: number;
  carwashCost: number;
  tiresCost: number;
  rentalCost: number;
  electricCost: number;
}

// Palette designed for maximum hue separation across 14 categories
export const EXPENSE_CATEGORIES = [
  { key: 'fuelCost', label: 'דלק', color: '#FF6B35' },              // כתום-אדום
  { key: 'road6Cost', label: 'כביש 6', color: '#1E40AF' },          // כחול עמוק
  { key: 'road6NorthCost', label: 'כביש 6 חוצה צפון', color: '#0EA5E9' }, // תכלת ים
  { key: 'pangoCost', label: 'פנגו', color: '#7C3AED' },            // סגול אינדיגו
  { key: 'carmelCost', label: 'מנהרות הכרמל', color: '#DB2777' },   // מג'נטה
  { key: 'reportsCost', label: 'דוחות וקנסות', color: '#DC2626' },  // אדום עז
  { key: 'maintenanceCost', label: 'טיפולים', color: '#059669' },   // ירוק יער
  { key: 'insuranceCost', label: 'ביטוח', color: '#92400E' },       // חום
  { key: 'licenseCost', label: 'רישיון', color: '#F59E0B' },        // צהוב-כתום
  { key: 'ituranCost', label: 'איתוראן', color: '#64748B' },        // אפור-כחול
  { key: 'carwashCost', label: 'שטיפות', color: '#06B6D4' },        // טורקיז
  { key: 'tiresCost', label: 'צמיגים', color: '#1F2937' },          // אפור פחם
  { key: 'rentalCost', label: 'שכירות', color: '#BE185D' },         // ורוד עמוק
  { key: 'electricCost', label: 'חשמל', color: '#84CC16' },         // ירוק לימון
] as const;

export type ExpenseCategoryKey = typeof EXPENSE_CATEGORIES[number]['key'];

export interface Vehicle {
  id: number;
  driverName: string;
  phone: string;
  model: string;
  plateNumber: string;
  ownershipType: string;
  supplier: string;
  currentMileage: number;
  lastReportYear: string;
  lastReportMonth: string;
  company: string;
  startDate: string;
  endDate: string;
  leaseEndDate: string;
  licenseEndDate: string;
  rentValue: number;
  monthlyUsage: MonthlyUsage[];
}

export interface DriverAnomaly {
  vehicle: Vehicle;
  type: 'spike' | 'drop' | 'chronic_no_report';
  currentValue: number;
  average: number;
  deviation: number; // percentage
  monthName: string;
  year: string;
}

export type UrgencyLevel = 'expired' | 'critical' | 'warning' | 'soon' | 'ok';
export type DateType = 'lease' | 'license';

export interface ExpirationItem {
  vehicle: Vehicle;
  dateType: DateType;
  dateStr: string;
  daysUntil: number;
  urgencyLevel: UrgencyLevel;
}

export interface ExpirationStats {
  leaseExpired: number;
  lease30: number;
  lease60: number;
  lease90: number;
  licenseExpired: number;
  license30: number;
  license60: number;
  license90: number;
  totalUrgent: number;
}

export interface FleetStats {
  totalVehicles: number;
  totalDrivers: number;
  reportedThisMonth: number;
  notReportedThisMonth: number;
  reportPercentage: number;
  avgMonthlyKm: number;
  totalMonthlyKm: number;
  anomalyCount: number;
}
