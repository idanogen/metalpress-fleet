# heyy.io — מדריך אינטגרציה נייד (Portable Reference)

> מסמך עצמאי שמסכם את **כל** הידע המעשי שצברנו על heyy.io בפרויקט MetalPress Fleet.
> נכתב כדי להעתיק אותו כמו-שהוא לפרויקט אחר. כולל: מהי המערכת, ה-API, גוצ'אס,
> ודפוסי קוד מוכנים. לא תלוי ב-MetalPress — כל מה שספציפי מסומן כדוגמה.

---

## 1. מה זה heyy.io

- **ספק WhatsApp Business API רשמי (BSP)** — כמו Twilio / 360dialog / Green API, אבל רשמי דרך Meta.
- כתובת הניהול: `https://app.heyy.io/`
- כתובת ה-API: `https://api.heyy.io/api/v2.0`
- נותן:
  - **Contacts** — אנשי קשר עם **custom attributes** (שדות מותאמים אישית, "תכונות איש קשר")
  - **WhatsApp messages** — שליחת/קבלת הודעות (טקסט חופשי + templates)
  - **Channels** — ערוץ WhatsApp אחד או יותר (לכל ערוץ יש `channelId`)
  - **Webhooks** — heyy שולח אליך POST כשהודעה נכנסת
  - **AI Employee** — בוט שיחתי מובנה (אנחנו **לא** משתמשים בו, ראה סעיף 7)
  - **Flows / Automations** — בילדר אוטומציות ויזואלי בתוך heyy

### העיקרון הארכיטקטוני שאימצנו (הכי חשוב)
> **heyy = שלד תזרים בלבד. הלוגיקה והאמת — בשרת שלך.**

- heyy שולח template, מקבל תגובה, ומעביר ל-webhook.
- ה-webhook שלך (Vercel serverless / כל שרת) עושה את **כל** הוולידציה ועדכוני המערכות.
- ה-webhook גם שולח את התשובה למשתמש ישירות דרך heyy API.
- **לא** מסתמכים על ה-AI Employee של heyy ללוגיקה — הוא לא דטרמיניסטי וקשה לתחזק.

למה זה עדיף:
1. ולידציה דטרמיניסטית בקוד, לא ב-LLM — אין טעויות.
2. חיסכון — אין קריאות LLM על כל הודעה.
3. מקור אמת אחד — כל התשובות נשלחות מקובץ אחד בקוד.
4. תחזוקה = git commit, לא ניסוי-וטעייה בפרומפט.

---

## 2. אותנטיקציה ומשתני סביבה

כל הקריאות ל-API דורשות:
```
Authorization: Bearer <HEYY_API_KEY>
Content-Type: application/json
Accept: application/json
```

משתני סביבה שצריך (התאם שמות לפרויקט):
```
HEYY_API_KEY=<מפתח ה-API מ-heyy>
HEYY_BASE_URL=https://api.heyy.io/api/v2.0     # ברירת מחדל
HEYY_CHANNEL_ID=<ה-channelId של ערוץ הוואטסאפ>
HEYY_WEBHOOK_SECRET=<אופציונלי — לאימות שה-webhook באמת מ-heyy>
```

> **אבטחת סודות:** אל תשים מפתחות בקוד. ב-Vercel — הגדר אותם ב-Project Settings → Environment Variables.

---

## 3. ה-REST API — נקודות הקצה שאנחנו מכירים

Base: `https://api.heyy.io/api/v2.0`

### Contacts

**רשימת אנשי קשר (paginated):**
```
GET /contacts?page=0&pageSize=100
GET /contacts?search=<E164phone>&pageSize=5&page=0      # חיפוש לפי טלפון/שם
```
מבנה תגובה: `body.data.contacts[]` (לפעמים `body.data[]` — תמיד תבדוק את שניהם).
כל contact: `{ id, firstName, phoneNumber, attributes: [...] }`.

> **טלפון תמיד בפורמט E.164:** `+972523694547` (לא `0523...`).

**יצירת איש קשר:**
```
POST /contacts
{
  "firstName": "שם",
  "phoneNumber": "+972523694547",
  "attributes": [
    { "externalId": "kilo", "value": "12345" },
    { "externalId": "plateNumber", "value": "123-45-678" }
  ]
}
```

**עדכון תכונה (custom attribute) של איש קשר:**
```
POST /contacts/{contactId}/attributes
{ "externalId": "kilo", "value": "12345" }
```
- `externalId` = ה-ID הקבוע של התכונה שהגדרת ב-heyy UI (לא ה-display name).
- כל הערכים נשמרים כ-**string**.
- קריאת ערך תכונה מ-contact: `contact.attributes[].value`, כשהזיהוי דרך
  `attribute.externalId` **או** `externalId` (ה-API לא עקבי — תמיד תבדוק את שניהם):
  ```js
  const val = (c.attributes || []).find(
    a => (a.attribute?.externalId ?? a.externalId) === 'kilo'
  )?.value;
  ```

### WhatsApp messages

**שליחת טקסט חופשי** (רק בתוך חלון 24h — ראה סעיף 5):
```
POST /{channelId}/whatsapp_messages/send
{ "phoneNumber": "+972523694547", "type": "TEXT", "bodyText": "ההודעה" }
```

**שליחת template** (תמיד מותר, חובה מחוץ לחלון 24h):
```
POST /{channelId}/whatsapp_messages/send
{ "phoneNumber": "+972523694547", "type": "TEMPLATE", "templateId": "<id>", ... }
```

> **סימן ש-template לא נשלח באמת:** תגובה 200 עם `status: "PENDING"` ו-`waMessageId: ""` ריק
> → ההודעה נוצרה ב-heyy אבל לא יצאה ל-WhatsApp (בד"כ template לא מאושר/חלון סגור).

---

## 4. Webhook — קבלת הודעות נכנסות

ב-heyy: **Settings → Webhooks → WhatsApp Message Received**, מגדירים URL של ה-endpoint שלך.

heyy שולח POST בשני פורמטים אפשריים (תכין parser שמטפל בשניהם):

**פורמט A — Channel webhook (החדש):**
```json
{
  "event": "message.received",
  "data": {
    "id": "<provider_message_id>",
    "sender": "inbound",
    "content": { "body": "הטקסט שהמשתמש שלח" },
    "contact": { "phoneNumber": "+972523694547" },
    "handle": { "value": "+972523694547" }
  }
}
```

**פורמט B — Automation/Flow API call (ישן/חלופי):**
```json
{ "from": "972523694547", "text": "הטקסט", "id": "<msgId>" }
```

נקודות קריטיות:
- **התעלם מהודעות יוצאות (echo):** אם `event !== "message.received"` או
  `data.sender === "outbound"` → החזר 200 והתעלם, אחרת תיכנס ללופ של עיבוד התשובות של עצמך.
- **Idempotency:** heyy עושה retry על אותה הודעה. שמור `provider_message_id`
  ואם כבר עיבדת אותו — short-circuit (אחרת תשלח תשובה כפולה).
- **תמיד החזר 200** על שגיאות ולידציה (לא 400/500) — אחרת heyy ינסה שוב ושוב.
  שמור את השגיאה ב-DB שלך במקום.
- אבטחה אופציונלית: heyy שולח header סוד אם הגדרת. בדוק `x-heyy-secret`
  (השווה ב-`timingSafeEqual` כדי למנוע timing attacks).

---

## 5. גוצ'אס קריטיים (Meta / WhatsApp)

### 5.1 חלון 24 שעות + templates ⚠️ הכי חשוב
WhatsApp Business API מבדיל בין שני סוגי הודעות יוצאות:
1. **טקסט חופשי** — מותר **רק** עד 24 שעות אחרי הודעה נכנסת מהמשתמש.
2. **Template מאושר** — מותר תמיד, אבל חייב פורמט קבוע שאושר ע"י Meta מראש (24-48h לאישור).

לכן:
- תשובה ל-משתמש ששלח עכשיו הודעה → טקסט חופשי בסדר (אתה בתוך החלון).
- פנייה **ראשונה** למשתמש (תזכורת, קמפיין, onboarding) → **חייב template**.
- אם תנסה לשלוח טקסט חופשי מחוץ לחלון → Meta חוסם בשקט.

> אם הספק הקודם שלך היה Green API / WhatsApp לא-רשמי — שם זה עקף את הכלל.
> ב-heyy (רשמי) **אי אפשר לעקוף**. תכנן את ה-flow בהתאם.

### 5.2 UI quirk: צ'אטים של template-only נסתרים עד שעונים
כששולחים template ראשון, heyy יוצר את הצ'אט אבל **לא מציג אותו** ברשימת השיחות.
רק כשהמשתמש עונה, הצ'אט "נפתח" ומופיע. → אל תניח שההודעה לא נשלחה רק כי
אתה לא רואה צ'אט. תאמת מול תגובת ה-API (200 + `waMessageId` לא ריק).

### 5.3 ה-AI Employee מעדכן attributes באגרסיביות
אם בכל זאת משתמשים ב-AI Employee: הוא יעדכן contact attributes גם כשהפרומפט אומר
מפורשות "אל תעדכן את X". **הוראות שליליות חלשות.** הפתרון: לא לתת ל-AI את היכולת
מלכתחילה, ולעשות עדכונים ב-node/קוד חיצוני אחרי ולידציה.

### 5.4 ה-AI Employee הוא conversational בלבד
כל מה שה-AI מחזיר נשלח **ישירות** כהודעת WhatsApp. אין "structured output",
אין "auto-reply off", אין הפרדה בין תשובה פנימית לתשובת צ'אט. אם צריך data
מובנה — לפרסר את הטקסט ב-node אחר אחריו. (עוד סיבה להעדיף webhook על AI.)

---

## 6. דפוסי קוד מוכנים (JS/TS, fetch בלבד)

### 6.1 המרת טלפון ל-E.164 (heyy דורש את זה תמיד)
```js
function toE164(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('972')) return '+' + digits;
  if (digits.startsWith('0'))   return '+972' + digits.slice(1);  // התאם לקידומת מדינה
  return '+' + digits;
}
```

### 6.2 שליחת טקסט חופשי (בתוך חלון 24h)
```js
async function sendHeyyText(e164Phone, bodyText) {
  if (!HEYY_API_KEY || !HEYY_CHANNEL_ID) return;
  try {
    await fetch(`${HEYY_BASE_URL}/${HEYY_CHANNEL_ID}/whatsapp_messages/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${HEYY_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: e164Phone, type: 'TEXT', bodyText }),
    });
  } catch { /* best-effort — שליחת הודעה לא קריטית כמו כתיבת הנתונים */ }
}
```

### 6.3 חיפוש contact לפי טלפון + עדכון attribute
```js
async function updateContactAttribute(localPhone, externalId, value) {
  const e164 = toE164(localPhone);
  const search = await fetch(
    `${HEYY_BASE_URL}/contacts?search=${encodeURIComponent(e164)}&pageSize=5&page=0`,
    { headers: { Authorization: `Bearer ${HEYY_API_KEY}`, Accept: 'application/json' } }
  );
  if (!search.ok) return false;
  const body = await search.json();
  const contact = (body?.data?.contacts ?? []).find(c => c.phoneNumber === e164);
  if (!contact?.id) return false;
  const upd = await fetch(`${HEYY_BASE_URL}/contacts/${contact.id}/attributes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${HEYY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ externalId, value: String(value) }),
  });
  return upd.ok;
}
```

### 6.4 רשימת כל אנשי הקשר (pagination)
```js
async function listAllContacts() {
  const all = [];
  const pageSize = 100;
  let page = 0;
  while (true) {
    const url = new URL(`${HEYY_BASE_URL}/contacts`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('pageSize', String(pageSize));
    const r = await fetch(url, { headers: {
      Authorization: `Bearer ${HEYY_API_KEY}`, Accept: 'application/json',
    }});
    if (!r.ok) break;
    const body = await r.json();
    const items = body.data?.contacts || body.data || [];
    all.push(...items);
    if (items.length < pageSize) break;
    page++;
    if (page > 50) break; // safety valve
  }
  return all;
}
```
> **rate-limit:** היה עדין — `await sleep(80ms)` בין כתיבות ברצף.

### 6.5 שלד webhook handler (Vercel serverless)
```js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const payload = req.body || {};

  // 1. התעלם מ-echo של הודעות יוצאות
  if (payload.event && payload.event !== 'message.received')
    return res.status(200).json({ ok: true, ignored: payload.event });
  if (payload.data?.sender === 'outbound')
    return res.status(200).json({ ok: true, ignored: 'outbound' });

  // 2. חלץ טלפון/טקסט/id משני הפורמטים
  const data = payload.data;
  const rawPhone = data?.contact?.phoneNumber || data?.handle?.value || payload.from;
  const rawText  = data?.content?.body || payload.text || payload.body;
  const providerId = data?.id || payload.id || null;

  // 3. Idempotency — אם כבר עיבדת את providerId, החזר מוקדם
  // 4. ולידציה דטרמיניסטית בקוד
  // 5. עדכן את ה-DB שלך (מקור האמת)
  // 6. עדכן attribute ב-heyy אם צריך (6.3)
  // 7. שלח תשובה למשתמש (6.2)
  // 8. תמיד 200 — גם על כשל ולידציה (כדי ש-heyy לא יעשה retry)

  return res.status(200).json({ ok: true });
}
```

---

## 7. מתי כן/לא להשתמש ב-AI Employee של heyy

| תרחיש | המלצה |
|---|---|
| לוגיקה דטרמיניסטית (פרסור מספר, ולידציה, עדכון DB) | **webhook + קוד.** אל תשתמש ב-AI. |
| שיחה חופשית רב-שלבית, FAQ, שירות לקוחות | אפשר AI Employee |
| צריך data מובנה מהתשובה | webhook (או לפרסר את טקסט ה-AI ב-node אחר) |

אם בכל זאת בונים flow עם AI:
- אי אפשר "להחביא" את ה-output — כל פלט נשלח כהודעה.
- אל תיתן הוראות "אל תעשה X" — במקום, פשוט **אל תאפשר** ל-AI לעשות X.
- Conversation Resolution = תנאי היציאה; הפעל אותו רק על מסלול ההצלחה.

---

## 8. צ'קליסט הקמה בפרויקט חדש

1. [ ] צור חשבון/ערוץ ב-heyy, קבל `HEYY_API_KEY` ו-`HEYY_CHANNEL_ID`.
2. [ ] הגדר custom attributes לאנשי הקשר ב-heyy UI (שים לב ל-`externalId` של כל אחד).
3. [ ] שים את משתני הסביבה ב-Vercel (לא בקוד).
4. [ ] כתוב את ה-webhook endpoint (שלד בסעיף 6.5) — עם idempotency + always-200.
5. [ ] חבר ב-heyy: Settings → Webhooks → WhatsApp Message Received → ה-URL שלך.
6. [ ] אם צריך פניות יזומות (תזכורות/קמפיינים) — צור templates ושלח לאישור Meta (24-48h).
7. [ ] טסט: שלח הודעה נכנסת, ודא שה-webhook מקבל, מעבד, ועונה תוך חלון 24h.
8. [ ] (אופציונלי) הגדר `HEYY_WEBHOOK_SECRET` ואמת אותו ב-handler (fail-closed).

---

## 9. קבצים מקוריים לעיון (בפרויקט MetalPress)

אם תרצה לראות מימוש מלא ועובד:
- `api/heyy-webhook.ts` — handler production מלא (idempotency, ולידציה, floors, תשובות)
- `scripts/sync-drivers-to-heyy.mjs` — סנכרון DB → heyy contacts (יצירה, dedup, skip קיימים)
- `scripts/backfill-heyy-kilo.mjs` — מילוי attribute מ-DB (dry-run + --apply)
- `docs/heyy-flow-architecture.md` — הסבר הארכיטקטורה והחלטות
- `docs/heyy-ai-prompt-current.md` — פרומפט מלא ל-AI Employee (אם בכל זאת רוצים AI)
