import type { Vehicle, MonthlyUsage } from '@/types/fleet';
import { vehiclesData } from '@/data/vehicles';

// Make Data Store API
const MAKE_API_TOKEN = import.meta.env.VITE_MAKE_API_TOKEN || '';
const DATA_STORE_ID = import.meta.env.VITE_MAKE_DATA_STORE_ID || '';
// In dev, use Vite proxy. In prod, use Vercel serverless function to avoid CORS.
const MAKE_API_BASE = import.meta.env.DEV ? '/api/make' : '';
const USE_SERVERLESS = !import.meta.env.DEV;

interface MakeVehicleRecord {
  equipmentId: number;
  driverName: string;
  phone: string;
  model: string;
  plateNumber: string;
  ownershipType: string;
  supplier: string;
  company: string;
  currentMileage: number;
  rentValue: number;
  startDate: string;
  endDate: string;
  leaseEndDate: string;
  licenseEndDate: string;
  lastReportYear: string;
  lastReportMonth: string;
  monthlyUsage: string;
}

interface MakeDataStoreResponse {
  records: { key: string; data: MakeVehicleRecord }[];
  count: number;
  pg: { limit: number; offset: number };
}

function filterCurrentMonth(usage: MonthlyUsage[]): MonthlyUsage[] {
  const now = new Date();
  const currentYear = String(now.getFullYear());
  const currentMonth = now.getMonth() + 1; // 1-based
  return usage
    .filter(m => !(m.year === currentYear && m.monthNum === currentMonth))
    .map(m => {
      // Malformed entries from Priority have mileage === carUsage and no days field.
      // The value is actually a Priority internal row ID, not real mileage.
      if (m.mileage > 0 && m.mileage === m.carUsage && !m.days) {
        return { ...m, mileage: 0 };
      }
      return m;
    });
}

function mapMakeRecordToVehicle(record: MakeVehicleRecord): Vehicle {
  let monthlyUsage: MonthlyUsage[] = [];
  try {
    const rawStr = record.monthlyUsage || '[]';
    const match = rawStr.match(/\[[\s\S]*\]/);
    const clean = match ? match[0] : '[]';
    const parsed = JSON.parse(clean);
    monthlyUsage = Array.isArray(parsed) ? filterCurrentMonth(parsed) : [];
  } catch {
    monthlyUsage = [];
  }

  return {
    id: record.equipmentId,
    driverName: record.driverName || '',
    phone: record.phone || '',
    model: record.model || '',
    plateNumber: record.plateNumber || '',
    ownershipType: record.ownershipType || '',
    supplier: record.supplier || '',
    company: record.company || '',
    currentMileage: record.currentMileage || 0,
    rentValue: record.rentValue || 0,
    startDate: record.startDate || '',
    endDate: record.endDate || '',
    leaseEndDate: record.endDate || '',
    licenseEndDate: record.licenseEndDate || '',
    lastReportYear: record.lastReportYear || '',
    lastReportMonth: record.lastReportMonth || '',
    monthlyUsage,
  };
}

async function fetchPage(offset: number, limit: number = 100): Promise<MakeDataStoreResponse> {
  const url = `${MAKE_API_BASE}/data-stores/${DATA_STORE_ID}/data?pg%5Blimit%5D=${limit}&pg%5Boffset%5D=${offset}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${MAKE_API_TOKEN}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function fetchViaServerless(): Promise<MakeVehicleRecord[]> {
  const response = await fetch('/api/fleet');
  if (!response.ok) throw new Error(`Serverless ${response.status}`);
  const data = await response.json();
  return (data.records || []).map((r: { data: MakeVehicleRecord }) => r.data);
}

async function fetchViaProxy(): Promise<MakeVehicleRecord[]> {
  const allRecords: MakeVehicleRecord[] = [];
  let offset = 0;
  const pageSize = 100;

  while (true) {
    const page = await fetchPage(offset, pageSize);
    if (!page?.records || page.records.length === 0) break;
    allRecords.push(...page.records.map(r => r.data));
    if (page.records.length < pageSize) break;
    offset += page.records.length;
  }

  return allRecords;
}

export async function fetchFleetData(): Promise<Vehicle[]> {
  if (!USE_SERVERLESS && (!MAKE_API_TOKEN || !DATA_STORE_ID)) {
    console.log('[Fleet API] No Make API config, using static data');
    return vehiclesData;
  }

  try {
    const allRecords = USE_SERVERLESS ? await fetchViaServerless() : await fetchViaProxy();

    if (allRecords.length === 0) {
      console.warn('[Fleet API] Empty response from Make, falling back to static data');
      return vehiclesData;
    }

    const INACTIVE_DRIVER_NAMES = ['מושבת', 'מלאי'];
    const vehicles = allRecords
      .filter(r => !INACTIVE_DRIVER_NAMES.includes((r.driverName || '').trim()))
      .map(mapMakeRecordToVehicle);
    console.log(`[Fleet API] Loaded ${vehicles.length} active vehicles (filtered ${allRecords.length - vehicles.length} inactive/inventory)`);
    return vehicles;
  } catch (error) {
    console.error('[Fleet API] Failed to fetch from Make, using static fallback:', error);
    return vehiclesData;
  }
}
