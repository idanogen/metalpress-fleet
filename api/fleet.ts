import type { VercelRequest, VercelResponse } from '@vercel/node';

const MAKE_API_TOKEN = process.env.MAKE_API_TOKEN || '';
const DATA_STORE_ID = process.env.MAKE_DATA_STORE_ID || '83526';
const MAKE_API_BASE = 'https://us1.make.com/api/v2';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!MAKE_API_TOKEN) {
    return res.status(500).json({ error: 'Missing MAKE_API_TOKEN' });
  }

  try {
    const allRecords: unknown[] = [];
    let offset = 0;
    const pageSize = 100;

    while (true) {
      const url = `${MAKE_API_BASE}/data-stores/${DATA_STORE_ID}/data?pg%5Blimit%5D=${pageSize}&pg%5Boffset%5D=${offset}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Token ${MAKE_API_TOKEN}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Make API ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data?.records || data.records.length === 0) break;

      allRecords.push(...data.records);

      if (data.records.length < pageSize) break;
      offset += data.records.length;
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json({ records: allRecords, count: allRecords.length });
  } catch (error) {
    console.error('Fleet API error:', error);
    return res.status(500).json({ error: 'Failed to fetch fleet data' });
  }
}
