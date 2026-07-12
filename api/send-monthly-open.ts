import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAuthorized, envReady, runMonthlySend } from './_lib/monthly-messaging';

/**
 * ההודעה בתחילת החודש — נשלחת מהשרת לכל הנהגים הפעילים.
 * מחליף את ה-broadcast החוזר של heyy (שהיה קופסה שחורה ושלח ל-26/102 בלבד).
 *
 * תזמון: Vercel Cron — 1 לחודש 05:00 UTC (08:00 קיץ / 07:00 חורף בישראל),
 * אחרי ניקוי ה-lastName ב-03:00. ראה vercel.json.
 * אבטחה: Bearer CRON_SECRET או x-sync-secret להרצה ידנית.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAuthorized(req)) return res.status(401).json({ error: 'unauthorized' });
  const envErr = envReady();
  if (envErr) return res.status(500).json({ error: envErr });
  try {
    const summary = await runMonthlySend('month_open');
    console.log('monthly_open sent:', JSON.stringify(summary));
    return res.status(200).json({ ok: summary.failed === 0, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('send-monthly-open failed:', message);
    return res.status(500).json({ error: message });
  }
}
