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
}

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
