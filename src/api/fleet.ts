import type { Vehicle, MonthlyUsage } from '@/types/fleet';
import { supabase } from '@/lib/supabase';

const HEBREW_MONTHS: Record<number, string> = {
  1: 'ינו', 2: 'פבר', 3: 'מרץ', 4: 'אפר', 5: 'מאי', 6: 'יונ',
  7: 'יול', 8: 'אוג', 9: 'ספט', 10: 'אוק', 11: 'נוב', 12: 'דצמ',
};

interface DbVehicle {
  id: number;
  plate_number: string | null;
  model: string | null;
  ownership_type: string | null;
  supplier: string | null;
  company: string | null;
  lease_end_date: string | null;
  license_end_date: string | null;
  start_date: string | null;
  end_date: string | null;
  rent_value: number | null;
  current_mileage: number;
  last_report_year: number | null;
  last_report_month: number | null;
  is_inventory: boolean;
  current_driver: { name: string; phone: string | null } | null;
  monthly_reports: DbReport[];
}

interface DbReport {
  report_year: number;
  report_month: number;
  mileage: number;
  start_date: string | null;
  end_date: string | null;
  days: number | null;
  fuel_consumption: number | null;
  fuel_cost: number | null;
  priority_row_id: number | null;
  source: string | null;
  road6_cost: number | null;
  road6_north_cost: number | null;
  pango_cost: number | null;
  carmel_cost: number | null;
  reports_cost: number | null;
  maintenance_cost: number | null;
  insurance_cost: number | null;
  license_cost: number | null;
  ituran_cost: number | null;
  carwash_cost: number | null;
  tires_cost: number | null;
  rental_cost: number | null;
  electric_cost: number | null;
}

function toIsoStart(d: string | null): string {
  return d ? `${d}T00:00:00+02:00` : '';
}

function mapReport(r: DbReport): MonthlyUsage {
  return {
    year: String(r.report_year),
    monthNum: r.report_month,
    monthName: HEBREW_MONTHS[r.report_month] || '',
    startDate: toIsoStart(r.start_date),
    endDate: toIsoStart(r.end_date),
    days: r.days ?? 0,
    mileage: r.mileage,
    fuelConsumption: Number(r.fuel_consumption ?? 0),
    fuelCost: Number(r.fuel_cost ?? 0),
    carUsage: r.priority_row_id ?? 0,
    source: r.source ?? '',
    road6Cost: Number(r.road6_cost ?? 0),
    road6NorthCost: Number(r.road6_north_cost ?? 0),
    pangoCost: Number(r.pango_cost ?? 0),
    carmelCost: Number(r.carmel_cost ?? 0),
    reportsCost: Number(r.reports_cost ?? 0),
    maintenanceCost: Number(r.maintenance_cost ?? 0),
    insuranceCost: Number(r.insurance_cost ?? 0),
    licenseCost: Number(r.license_cost ?? 0),
    ituranCost: Number(r.ituran_cost ?? 0),
    carwashCost: Number(r.carwash_cost ?? 0),
    tiresCost: Number(r.tires_cost ?? 0),
    rentalCost: Number(r.rental_cost ?? 0),
    electricCost: Number(r.electric_cost ?? 0),
  };
}

function mapVehicle(v: DbVehicle): Vehicle {
  const driverName = v.is_inventory ? 'מלאי' : (v.current_driver?.name ?? '');
  const phone = v.current_driver?.phone ?? '';

  const monthlyUsage = (v.monthly_reports ?? [])
    .map(mapReport)
    .sort((a, b) =>
      a.year !== b.year ? b.year.localeCompare(a.year) : b.monthNum - a.monthNum
    );

  return {
    id: v.id,
    driverName,
    phone,
    model: v.model ?? '',
    plateNumber: v.plate_number ?? '',
    ownershipType: v.ownership_type ?? '',
    supplier: v.supplier ?? '',
    company: v.company ?? '',
    currentMileage: v.current_mileage,
    rentValue: v.rent_value ?? 0,
    startDate: v.start_date ?? '',
    endDate: v.end_date ?? '',
    leaseEndDate: v.lease_end_date ?? v.end_date ?? '',
    licenseEndDate: v.license_end_date ?? '',
    lastReportYear: v.last_report_year ? String(v.last_report_year) : '',
    lastReportMonth: v.last_report_month ? String(v.last_report_month) : '',
    monthlyUsage,
  };
}

export async function fetchFleetData(): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from('vehicles')
    .select(`
      id, plate_number, model, ownership_type, supplier, company,
      lease_end_date, license_end_date, start_date, end_date,
      rent_value, current_mileage, last_report_year, last_report_month,
      is_inventory,
      current_driver:drivers!current_driver_id(name, phone),
      monthly_reports(
        report_year, report_month, mileage,
        start_date, end_date, days,
        fuel_consumption, fuel_cost, priority_row_id, source,
        road6_cost, road6_north_cost, pango_cost, carmel_cost, reports_cost,
        maintenance_cost, insurance_cost, license_cost, ituran_cost,
        carwash_cost, tires_cost, rental_cost, electric_cost
      )
    `)
    .eq('is_active', true)
    .order('id');

  if (error) throw new Error(`Supabase: ${error.message}`);

  const vehicles = (data as unknown as DbVehicle[]).map(mapVehicle);
  console.log(`[Fleet API] Loaded ${vehicles.length} vehicles from Supabase`);
  return vehicles;
}
