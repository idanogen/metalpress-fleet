/**
 * One-time script: Upload vehicle data from vehicles.ts to Make Data Store
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MAKE_API_TOKEN = 'a762d75e-2017-427c-af83-6d8f6ba9a233';
const DATA_STORE_ID = 83526;
const MAKE_API_BASE = 'https://us1.make.com/api/v2';

// Read and parse vehicles.ts
const filePath = resolve(__dirname, '../src/data/vehicles.ts');
let fileContent = readFileSync(filePath, 'utf-8');

// Remove TypeScript parts to get pure JS array
fileContent = fileContent.replace(/import.*;\n/g, '');
fileContent = fileContent.replace('export const vehiclesData: Vehicle[] = ', 'const vehiclesData = ');

// Evaluate the array (safe since we control the file)
const fn = new Function(`${fileContent}\nreturn vehiclesData;`);
const vehicles = fn();

console.log(`Found ${vehicles.length} vehicles to upload`);

async function uploadRecord(vehicle, index) {
  const record = {
    equipmentId: vehicle.id,
    driverName: vehicle.driverName || '',
    phone: vehicle.phone || '',
    model: vehicle.model || '',
    plateNumber: vehicle.plateNumber || '',
    ownershipType: vehicle.ownershipType || '',
    supplier: vehicle.supplier || '',
    company: vehicle.company || '',
    currentMileage: vehicle.currentMileage || 0,
    rentValue: vehicle.rentValue || 0,
    startDate: vehicle.startDate || '',
    endDate: vehicle.endDate || '',
    leaseEndDate: vehicle.leaseEndDate || '',
    licenseEndDate: vehicle.licenseEndDate || '',
    lastReportYear: vehicle.lastReportYear || '',
    lastReportMonth: vehicle.lastReportMonth || '',
    monthlyUsage: JSON.stringify(vehicle.monthlyUsage || []),
  };

  const response = await fetch(`${MAKE_API_BASE}/data-stores/${DATA_STORE_ID}/data/${vehicle.id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Token ${MAKE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(record),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`[${index + 1}/${vehicles.length}] FAILED: ${vehicle.driverName} (ID: ${vehicle.id}) - ${err}`);
    return false;
  }

  console.log(`[${index + 1}/${vehicles.length}] OK: ${vehicle.driverName} (ID: ${vehicle.id})`);
  return true;
}

// Upload one at a time to avoid rate limits
let success = 0;
let failed = 0;

for (let i = 0; i < vehicles.length; i++) {
  const result = await uploadRecord(vehicles[i], i);
  if (result) success++;
  else failed++;

  // Delay between requests
  if (i < vehicles.length - 1) {
    await new Promise(r => setTimeout(r, 1500));
  }
}

console.log(`\nDone! Success: ${success}, Failed: ${failed}`);
