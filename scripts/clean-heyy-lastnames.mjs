#!/usr/bin/env node
/**
 * ניקוי שדה lastName באנשי הקשר ב-heyy.
 *
 * הרקע (3/7/2026): heyy קולט אוטומטית שם משפחה מפרופיל הוואטסאפ הפרטי של
 * הנהג ("Raz", "🌶️🌶️", "859857"...). תבניות שפונות בשם מלא יוצרות ברכות
 * מוזרות כמו "שלום איריס שרביט רז Raz". השם הפרטי אצלנו כבר מכיל את השם
 * המלא והנכון מפריוריטי — אז שם המשפחה פשוט מיותר ומזוהם.
 *
 * מה הסקריפט עושה:
 *  1. שולף את כל אנשי הקשר מ-heyy
 *  2. שומר גיבוי JSON של כל מי שיש לו lastName (לשחזור אם יהיו תלונות)
 *     → backups/YYYY-MM-DD-heyy-lastnames.json
 *  3. מרוקן את lastName אצל כולם
 *
 * הרצה:  node scripts/clean-heyy-lastnames.mjs          (dry-run, רק מציג)
 *        node scripts/clean-heyy-lastnames.mjs --apply   (מבצע בפועל)
 *
 * שחזור: node scripts/clean-heyy-lastnames.mjs --restore backups/<file>.json
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

const HEYY_KEY = process.env.HEYY_API_KEY;
const HEYY_BASE = process.env.HEYY_BASE_URL || 'https://api.heyy.io/api/v2.0';

if (!HEYY_KEY) {
  console.error('Missing env: HEYY_API_KEY');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const restoreIdx = process.argv.indexOf('--restore');
const RESTORE_FILE = restoreIdx > -1 ? process.argv[restoreIdx + 1] : null;

const headers = {
  Authorization: `Bearer ${HEYY_KEY}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

async function listAllContacts() {
  const all = [];
  const pageSize = 100;
  let page = 0;
  while (true) {
    const url = new URL(`${HEYY_BASE}/contacts`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('pageSize', String(pageSize));
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(`heyy list ${r.status}: ${await r.text()}`);
    const body = await r.json();
    const items = body.data?.contacts || [];
    all.push(...items);
    if (items.length < pageSize) break;
    page++;
    if (page > 50) break; // safety
  }
  return all;
}

async function setLastName(contactId, lastName) {
  // heyy תומך רק ב-PUT לעדכון איש קשר (PATCH מחזיר 404 endpoint_not_found)
  const r = await fetch(`${HEYY_BASE}/contacts/${contactId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ lastName }),
  });
  if (!r.ok) throw new Error(`heyy PUT ${contactId} ${r.status}: ${await r.text()}`);
  return r.json();
}

async function main() {
  // ---- מצב שחזור ----
  if (RESTORE_FILE) {
    const backup = JSON.parse(fs.readFileSync(RESTORE_FILE, 'utf8'));
    console.log(`♻️  משחזר ${backup.length} שמות משפחה מ-${RESTORE_FILE}...`);
    let ok = 0, fail = 0;
    for (const c of backup) {
      try {
        await setLastName(c.id, c.lastName);
        ok++;
      } catch (e) {
        fail++;
        console.error(`  ✗ ${c.firstName} (${c.phoneNumber}): ${e.message}`);
      }
    }
    console.log(`✅ שוחזרו ${ok}, נכשלו ${fail}`);
    return;
  }

  // ---- מצב ניקוי ----
  console.log('🔍 שולף אנשי קשר מ-heyy...');
  const contacts = await listAllContacts();
  const dirty = contacts.filter((c) => (c.lastName || '').trim() !== '');
  console.log(`סה"כ ${contacts.length} אנשי קשר, ${dirty.length} עם lastName לניקוי.`);

  if (dirty.length === 0) {
    console.log('אין מה לנקות.');
    return;
  }

  // גיבוי לפני שינוי — תמיד, גם ב-dry-run
  const backupDir = path.join(process.cwd(), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const backupFile = path.join(backupDir, `${stamp}-heyy-lastnames.json`);
  fs.writeFileSync(
    backupFile,
    JSON.stringify(
      dirty.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        phoneNumber: c.phoneNumber,
      })),
      null,
      2
    )
  );
  console.log(`💾 גיבוי נשמר: ${backupFile}`);

  if (!APPLY) {
    console.log('\n— DRY RUN — לא בוצע שינוי. להרצה אמיתית: --apply\n');
    for (const c of dirty) console.log(`  ${c.firstName} | "${c.lastName}" | ${c.phoneNumber}`);
    return;
  }

  console.log('🧹 מנקה...');
  let ok = 0, fail = 0;
  for (const c of dirty) {
    try {
      await setLastName(c.id, '');
      ok++;
    } catch (e) {
      fail++;
      console.error(`  ✗ ${c.firstName} (${c.phoneNumber}): ${e.message}`);
    }
  }
  console.log(`✅ נוקו ${ok}, נכשלו ${fail}`);
}

main().catch((e) => {
  console.error('שגיאה:', e);
  process.exit(1);
});
