import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAuthorized, envReady, runMonthlySend } from './_lib/monthly-messaging';

/**
 * תזכורת אמצע-חודש — נשלחת מהשרת רק לנהגים שעדיין לא דיווחו ק"מ לחודש הקודם.
 * לא היה קיים אוטומטית עד היום (רק תזכורת ידנית מהדשבורד).
 *
 * תזמון: Vercel Cron — 15 לחודש 05:00 UTC. ראה vercel.json.
 * אבטחה: Bearer CRON_SECRET או x-sync-secret להרצה ידנית.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAuthorized(req)) return res.status(401).json({ error: 'unauthorized' });
  const envErr = envReady();
  if (envErr) return res.status(500).json({ error: envErr });
  try {
    const summary = await runMonthlySend('reminder');
    console.log('monthly_reminder sent:', JSON.stringify(summary));
    return res.status(200).json({ ok: summary.failed === 0, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('send-monthly-reminder failed:', message);
    return res.status(500).json({ error: message });
  }
}
