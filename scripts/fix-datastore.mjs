/**
 * Fix Data Store: Correct off-by-one mileage shift and remove current month.
 *
 * Problem: Each month's mileage was shifted by one — month N had month N-1's value.
 * Fix: Shift mileage back down (each entry gets the value from the newer entry),
 *      then remove the current month (incomplete).
 */

const MAKE_API_TOKEN = 'a762d75e-2017-427c-af83-6d8f6ba9a233';
const DATA_STORE_ID = 83526;
const MAKE_API_BASE = 'https://us1.make.com/api/v2';

const now = new Date();
const currentYear = String(now.getFullYear());
const currentMonth = now.getMonth() + 1;

async function fetchAllRecords() {
  const allRecords = [];
  for (let offset = 0; ; offset += 100) {
    const url = `${MAKE_API_BASE}/data-stores/${DATA_STORE_ID}/data?pg%5Blimit%5D=100&pg%5Boffset%5D=${offset}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Token ${MAKE_API_TOKEN}`, 'Accept': 'application/json' },
    });
    const data = await res.json();
    if (!data.records || data.records.length === 0) break;
    allRecords.push(...data.records);
    if (data.records.length < 100) break;
  }
  return allRecords;
}

function fixMonthlyUsage(monthlyUsageStr) {
  let usage;
  try {
    usage = JSON.parse(monthlyUsageStr || '[]');
  } catch {
    return null;
  }
  if (!Array.isArray(usage) || usage.length === 0) return null;

  // Sort newest first
  usage.sort((a, b) => {
    if (a.year !== b.year) return b.year.localeCompare(a.year);
    return b.monthNum - a.monthNum;
  });

  // Shift mileage down: each entry gets mileage from the newer entry (i-1)
  for (let i = usage.length - 1; i > 0; i--) {
    usage[i].mileage = usage[i - 1].mileage;
  }
  usage[0].mileage = 0;

  // Remove current month (incomplete)
  usage = usage.filter(m => !(m.year === currentYear && m.monthNum === currentMonth));

  return JSON.stringify(usage);
}

async function main() {
  console.log(`Fixing Data Store... (current month to remove: ${currentMonth}/${currentYear})`);
  const records = await fetchAllRecords();
  console.log(`Fetched ${records.length} records`);

  let fixed = 0, skipped = 0, failed = 0;

  for (const record of records) {
    const { key, data } = record;
    const name = data.driverName || 'unknown';

    const fixedUsage = fixMonthlyUsage(data.monthlyUsage);
    if (fixedUsage === null) {
      skipped++;
      continue;
    }

    const updatedData = { ...data, monthlyUsage: fixedUsage };
    const url = `${MAKE_API_BASE}/data-stores/${DATA_STORE_ID}/data/${key}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Authorization': `Token ${MAKE_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData),
    });

    if (res.ok) {
      console.log(`  ✓ ${name} (${key})`);
      fixed++;
    } else {
      console.error(`  ✗ ${name} (${key}) — ${await res.text()}`);
      failed++;
    }

    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\nDone! Fixed: ${fixed}, Skipped: ${skipped}, Failed: ${failed}`);
}

main().catch(console.error);
