import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';

/**
 * ניקוי חודשי של lastName באנשי הקשר ב-heyy.
 *
 * heyy מזהם lastName אוטומטית מפרופיל הוואטסאפ של הנהג ("Raz", אימוג'ים,
 * מספרים), ותבנית התזכורת החודשית פונה בשם מלא — מה שיוצר ברכות כמו
 * "שלום איריס שרביט רז Raz". הפונקציה מרוקנת את lastName אצל כולם.
 *
 * תזמון: Vercel Cron — 1 לחודש 03:00 UTC, שעתיים לפני שידור התזכורת
 * (05:00 UTC). ראה vercel.json.
 *
 * גיבוי: כל ניקוי נרשם ל-fleet.sync_log (source='heyy_lastname_cleanup')
 * עם הזוגות שנמחקו ב-metadata — לשחזור אם יהיו תלונות.
 * שחזור ידני: scripts/clean-heyy-lastnames.mjs --restore <backup.json>
 *
 * אבטחה: Authorization: Bearer <CRON_SECRET> (Vercel מוסיף אוטומטית לקרונים)
 * או x-sync-secret: <HEYY_SYNC_SECRET> (להרצה ידנית, כמו sync-drivers-to-heyy).
 */

const HEYY_API_KEY = process.env.HEYY_API_KEY;
const HEYY_BASE_URL = process.env.HEYY_BASE_URL || 'https://api.heyy.io/api/v2.0';
const CRON_SECRET = process.env.CRON_SECRET;
const SYNC_SECRET = process.env.HEYY_SYNC_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function isAuthorized(req: VercelRequest): boolean {
  const auth = req.headers.authorization;
  if (CRON_SECRET && typeof auth === 'string' && safeCompare(auth, `Bearer ${CRON_SECRET}`)) {
    return true;
  }
  const syncHeader = req.headers['x-sync-secret'];
  if (SYNC_SECRET && typeof syncHeader === 'string' && safeCompare(syncHeader, SYNC_SECRET)) {
    return true;
  }
  return false;
}

interface HeyyContact {
  id: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
}

const heyyHeaders = {
  Authorization: `Bearer ${HEYY_API_KEY}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

async function listAllContacts(): Promise<HeyyContact[]> {
  const all: HeyyContact[] = [];
  const pageSize = 100;
  for (let page = 0; page <= 50; page++) {
    const url = new URL(`${HEYY_BASE_URL}/contacts`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('pageSize', String(pageSize));
    const r = await fetch(url, { headers: heyyHeaders });
    if (!r.ok) throw new Error(`heyy list contacts ${r.status}: ${await r.text()}`);
    const body = (await r.json()) as { data?: { contacts?: HeyyContact[] } };
    const items = body.data?.contacts ?? [];
    all.push(...items);
    if (items.length < pageSize) break;
  }
  return all;
}

async function clearLastName(contactId: string): Promise<void> {
  // heyy תומך רק ב-PUT (PATCH מחזיר 404); PUT מתנהג כעדכון חלקי
  const r = await fetch(`${HEYY_BASE_URL}/contacts/${contactId}`, {
    method: 'PUT',
    headers: heyyHeaders,
    body: JSON.stringify({ lastName: '' }),
  });
  if (!r.ok) throw new Error(`heyy PUT ${contactId} ${r.status}: ${await r.text()}`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (!HEYY_API_KEY) {
    return res.status(500).json({ error: 'HEYY_API_KEY not configured' });
  }

  const startedAt = new Date().toISOString();
  try {
    const contacts = await listAllContacts();
    const dirty = contacts.filter((c) => (c.lastName ?? '').trim() !== '');

    const cleaned: Array<{ id: string; firstName: string; lastName: string; phoneNumber: string }> = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const c of dirty) {
      try {
        await clearLastName(c.id);
        cleaned.push({
          id: c.id,
          firstName: c.firstName ?? '',
          lastName: c.lastName ?? '',
          phoneNumber: c.phoneNumber ?? '',
        });
      } catch (err) {
        failed.push({ id: c.id, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // גיבוי הזוגות שנמחקו ליומן הסנכרון — זה ה"ביטוח" לשחזור אם יהיו תלונות
    if (SUPABASE_URL && SERVICE_KEY && (cleaned.length > 0 || failed.length > 0)) {
      const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
        db: { schema: 'fleet' },
        auth: { persistSession: false },
      });
      const { error: logError } = await supabase.from('sync_log').insert({
        source: 'heyy_lastname_cleanup',
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        success: failed.length === 0,
        records_total: contacts.length,
        records_updated: cleaned.length,
        records_failed: failed.length,
        metadata: { cleaned, failed },
      });
      if (logError) console.error('sync_log insert failed:', logError.message);
    }

    console.log(`heyy lastName cleanup: ${cleaned.length} cleaned, ${failed.length} failed, ${contacts.length} total`);
    return res.status(200).json({
      ok: failed.length === 0,
      totalContacts: contacts.length,
      cleaned: cleaned.length,
      failed: failed.length,
      cleanedNames: cleaned.map((c) => `${c.firstName} | ${c.lastName}`),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('heyy lastName cleanup failed:', message);
    return res.status(500).json({ error: message });
  }
}
