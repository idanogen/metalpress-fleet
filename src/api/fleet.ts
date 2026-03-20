import type { Vehicle, MonthlyUsage } from '@/types/fleet';
import { vehiclesData } from '@/data/vehicles';

// Make Data Store API — direct access
const MAKE_API_TOKEN = import.meta.env.VITE_MAKE_API_TOKEN || '';
const DATA_STORE_ID = import.meta.env.VITE_MAKE_DATA_STORE_ID || '';
// In dev, use Vite proxy to avoid CORS. In prod, call Make API directly.
const MAKE_API_BASE = import.meta.env.DEV ? '/api/make' : 'https://us1.make.com/api/v2';

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

function mapMakeRecordToVehicle(record: MakeVehicleRecord): Vehicle {
  let monthlyUsage: MonthlyUsage[] = [];
  try {
    const rawStr = record.monthlyUsage || '[]';
    const match = rawStr.match(/\[[\s\S]*\]/);
    const clean = match ? match[0] : '[]';
    const parsed = JSON.parse(clean);
    monthlyUsage = Array.isArray(parsed) ? parsed : [];
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
    leaseEndDate: record.leaseEndDate || '',
    licenseEndDate: record.licenseEndDate || '',
    lastReportYear: record.lastReportYear || '',
    lastReportMonth: record.lastReportMonth || '',
    monthlyUsage,
  };
}

async function fetchPage(offset: number): Promise<MakeDataStoreResponse> {
  const url = `${MAKE_API_BASE}/data-stores/${DATA_STORE_ID}/data?pg%5Boffset%5D=${offset}`;
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

export async function fetchFleetData(): Promise<Vehicle[]> {
  if (!MAKE_API_TOKEN || !DATA_STORE_ID) {
    console.log('[Fleet API] No Make API config, using static data');
    return vehiclesData;
  }

  try {
    const allRecords: MakeVehicleRecord[] = [];
    let offset = 0;
    const pageSize = 10; // Make default

    // Fetch all pages
    while (true) {
      const page = await fetchPage(offset);

      if (!page?.records || page.records.length === 0) break;

      allRecords.push(...page.records.map(r => r.data));

      // If we got less than page size, we're done
      if (page.records.length < pageSize) break;

      offset += page.records.length;
    }

    if (allRecords.length === 0) {
      console.warn('[Fleet API] Empty response from Make, falling back to static data');
      return vehiclesData;
    }

    const vehicles = allRecords.map(mapMakeRecordToVehicle);
    console.log(`[Fleet API] Loaded ${vehicles.length} vehicles from Make Data Store (${Math.ceil(vehicles.length / pageSize)} pages)`);
    return vehicles;
  } catch (error) {
    console.error('[Fleet API] Failed to fetch from Make, using static fallback:', error);
    return vehiclesData;
  }
}
