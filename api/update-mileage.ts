import type { VercelRequest, VercelResponse } from '@vercel/node';

const MAKE_API_TOKEN = process.env.MAKE_API_TOKEN || '';
const DATA_STORE_ID = process.env.MAKE_DATA_STORE_ID || '83526';
const MAKE_API_BASE = 'https://us1.make.com/api/v2';

interface MonthlyUsage {
  year: string;
  monthNum: number;
  monthName?: string;
  mileage: number;
  startDate?: string;
  endDate?: string;
  days?: number;
  fuelConsumption?: number;
  fuelCost?: number;
  carUsage?: number;
}

const MONTH_NAMES: Record<number, string> = {
  1: 'ינו', 2: 'פבר', 3: 'מרץ', 4: 'אפר', 5: 'מאי', 6: 'יונ',
  7: 'יול', 8: 'אוג', 9: 'ספט', 10: 'אוק', 11: 'נוב', 12: 'דצמ',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow POST only
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  if (!MAKE_API_TOKEN) {
    return res.status(500).json({ error: 'Missing MAKE_API_TOKEN' });
  }

  const { vehicleId, mileage, month, year } = req.body || {};

  if (!vehicleId || mileage === undefined || !month || !year) {
    return res.status(400).json({
      error: 'Missing fields',
      required: { vehicleId: 'number', mileage: 'number', month: 'number (1-12)', year: 'string' },
    });
  }

  try {
    // Step 1: Read existing record from Data Store
    const getUrl = `${MAKE_API_BASE}/data-stores/${DATA_STORE_ID}/data/${vehicleId}`;
    const getRes = await fetch(getUrl, {
      headers: {
        'Authorization': `Token ${MAKE_API_TOKEN}`,
        'Accept': 'application/json',
      },
    });

    if (!getRes.ok) {
      return res.status(404).json({ error: `Vehicle ${vehicleId} not found in Data Store` });
    }

    const record = await getRes.json();
    const data = record.data || record;

    // Step 2: Parse existing monthlyUsage
    let usage: MonthlyUsage[] = [];
    try {
      const raw = data.monthlyUsage || '[]';
      usage = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw));
      if (!Array.isArray(usage)) usage = [];
    } catch {
      usage = [];
    }

    // Step 3: Add or update the month entry
    const monthNum = Number(month);
    const yearStr = String(year);
    const mileageNum = Number(mileage);

    const existingIndex = usage.findIndex(
      (m) => m.year === yearStr && m.monthNum === monthNum
    );

    const newEntry: MonthlyUsage = {
      year: yearStr,
      monthNum,
      monthName: MONTH_NAMES[monthNum] || '',
      mileage: mileageNum,
    };

    if (existingIndex >= 0) {
      // Update existing — keep other fields, update mileage
      usage[existingIndex] = { ...usage[existingIndex], mileage: mileageNum };
    } else {
      // Add new entry
      usage.push(newEntry);
    }

    // Sort newest first
    usage.sort((a, b) => {
      if (a.year !== b.year) return b.year.localeCompare(a.year);
      return b.monthNum - a.monthNum;
    });

    // Step 4: Write back to Data Store
    const updatedData = {
      ...data,
      monthlyUsage: JSON.stringify(usage),
      currentMileage: mileageNum,
      lastReportYear: yearStr,
      lastReportMonth: String(monthNum),
    };

    const putUrl = `${MAKE_API_BASE}/data-stores/${DATA_STORE_ID}/data/${vehicleId}`;
    const putRes = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Token ${MAKE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedData),
    });

    if (!putRes.ok) {
      const err = await putRes.text();
      return res.status(500).json({ error: 'Failed to update Data Store', details: err });
    }

    return res.status(200).json({
      success: true,
      vehicleId,
      month: monthNum,
      year: yearStr,
      mileage: mileageNum,
      totalMonths: usage.length,
    });
  } catch (error) {
    console.error('Update mileage error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
