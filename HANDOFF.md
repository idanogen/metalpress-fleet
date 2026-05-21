# MetalPress Fleet — Handoff Document

**עודכן:** 2026-05-21 (סוף יום עבודה)

---

## 🎯 הקונטקסט

מערכת ניהול צי רכב של MetalPress עברה מ-Make Data Store → Supabase, וה-WhatsApp bot עבר מ-Green API → heyy.io. הסיבה: data model נקי + ניהול הודעות אחיד. **הזרימה המלאה עובדת end-to-end, כולל הסנכרון השבועי מפריורטי שהתבסס היום.**

---

## ✅ מצב נוכחי — הכל עובד

### זרימת WhatsApp (מלאה)
```
נהג שולח WhatsApp לערוץ Metalpress של heyy
        ↓
heyy Channel Webhook → POST https://metalpress-fleet.vercel.app/api/heyy-webhook
        ↓
ה-webhook:
  • מאמת (מספר תקין? גדול מ-current? פער ≤ 5000?)
  • חוסם דיווח כפול (existing row in monthly_reports for vehicle+year+month, any source)
  • אם תקין: שומר ל-Supabase (monthly_reports + vehicles.current_mileage)
                  ↓
              מעדכן kilo ב-heyy contact
                  ↓
              שולח ל-Make scenario 4738680 → Priority
                  ↓
              שולח WhatsApp לנהג: "תודה ✅ נרשם <N> ק"מ לרכב <plateNumber>"
  • אם שגיאה: שולח WhatsApp עם הסבר ("נמוך" / "לא זיהיתי" / "גבוהה מדי" / "כבר קיבלנו דיווח")
  • Idempotent: בקריאות חוזרות עם אותו provider_message_id — מדלג
  • תמיד מחזיר 200 כדי שהוואץ לא יחזור על קריאות
```

### זרימת סנכרון שבועי Priority → Supabase (חדש 2026-05-21)
```
Make scenario 4646251 (Sunday 23:00 IL)
        ↓
M1: HTTP GET METL_EMPLOYEECARS?$expand=METL_CARUSAGE_SUBFORM (keychain 85308)
        ↓
M2: Iterator על {{1.data.value}}
        ↓
M3: json:TransformToJSON עם field map מפורש לכל רכב
    (כולל METL_CARUSAGE_SUBFORM כ-array reference)
        ↓
M4: supabase:makeAnApiCall
    POST /rest/v1/rpc/sync_vehicle_from_priority
    Content-Type: application/x-www-form-urlencoded
    body: p_payload={{encodeURL(3.json)}}
        ↓
RPC public.sync_vehicle_from_priority(p_payload jsonb):
  • phone normalization (regex 972XXXXXXXXX → 0XXXXXXXXX)
  • upsert driver by phone (ON CONFLICT DO NOTHING)
  • upsert vehicle by id — חדש: insert מלא | קיים: UPDATE רק על מטא-דאטה + current_driver_id
    (לא נוגע ב-current_mileage, is_active, is_inventory, last_report_*)
  • iterate METL_CARUSAGE_SUBFORM, INSERT monthly_reports עם
    source='priority' ON CONFLICT (vehicle_id,year,month) DO NOTHING
        ↓
Supabase fleet.*
```
**אומת ב-21/05:** 152/152 רכבים נסנכרנו, כולל כל המקרים עם `"` ב-`בע"מ` ו-`ארה"ב`.

### Database — Supabase
- **Project:** `mbodppnsdnmlejdldztp` (metalpress-crm, EU-Central, Postgres 17)
- **Schema:** `fleet` (מבודד מ-`public.professional_*` של ה-CRM)
- **טבלאות:**
  - `fleet.drivers` (110 רשומות)
  - `fleet.vehicles` (152)
  - `fleet.monthly_reports` (1,085+ דיווחים היסטוריים)
  - `fleet.reminder_log`
  - `fleet.inbound_messages` (audit של webhooks מ-heyy)
  - `fleet.sync_log`
- **פונקציות:**
  - `public.sync_vehicle_from_priority(p_payload jsonb)` — RPC עבור הסנכרון השבועי (SECURITY DEFINER, פועלת על fleet.*)

### Frontend — Vercel
- **URL:** https://metalpress-fleet.vercel.app
- **קוד:** Vite + React + Supabase JS client (`@supabase/supabase-js`)
- **קורא ישירות מ-Supabase** (`db: { schema: 'fleet' }`)

### Vercel Endpoints
- `api/heyy-webhook.ts` — בוט WhatsApp (פעיל, קריטי)
- `api/priority-sync.ts` — endpoint שהוקם לסנכרון מפריורטי אבל **בסופו של דבר לא בשימוש** (Make מדבר ישירות עם Supabase RPC).
  אפשר למחוק או להשאיר כ-fallback.

**Vercel env vars (production):**
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `HEYY_API_KEY`, `HEYY_BASE_URL`, `HEYY_CHANNEL_ID`
- `MAKE_PRIORITY_WRITE_WEBHOOK`
- `PRIORITY_SYNC_SECRET` — (נוצר היום, לא בשימוש כעת)

### heyy.io
- **Channel:** Metalpress (WhatsApp), id `61171b95-b182-43a9-8ad0-aac17785ac8d`
- **Workspace tenant id:** `af9f313b-34d0-4152-b143-ca19c4dcc4cb`
- **Contacts:** 94 נהגים סונכרנו דרך `scripts/sync-drivers-to-heyy.mjs`
- **Custom attributes:** `kilo`, `vehicleId`, `plateNumber`, `vehicleModel`
- **AI Employee:** Julie — **לא בשימוש בזרימה הנוכחית** (קיים אבל מנותק)
- **Channel Webhook (Settings → Webhooks):** מוגדר ל-`https://metalpress-fleet.vercel.app/api/heyy-webhook` עם event `WhatsApp Message Received`
- **אוטומציה "מילוי קלימוטרז חודשי":** משמשת רק לשליחת הודעה ראשונית בתחילת חודש. **לא מחכה לתגובה, לא קוראת ל-API.**

### Make.com — bridge ל-Priority
- **Priority חוסם IPs לא רשומים** → קוראים דרך Make כ-proxy
- **סנריו 4738680 — `MetalPress — Priority Write Mileage`** (פעיל)
  - Webhook: `https://hook.us1.make.com/owt4lw57buvry3575yu6vnuk8efgqe3f`
  - כותב ל-`METL_EMPLOYEECARS({vehicleId})/METL_CARUSAGE_SUBFORM`
  - הופעל ע"י `api/heyy-webhook.ts` בסיום דיווח WhatsApp
- **סנריו 4646251 — `MetalPress — סנכרון שבועי מפריורטי`** (פעיל, נכתב מחדש 21/05)
  - 4 modules: GET Priority → Iterator → TransformToJSON → Supabase makeAnApiCall (form-encoded)
  - Cron: ראשון 23:00 IL
  - Connection: 4778142 ("metalpress DB") עם service_role key
- **סנריו 4602610 — בוט WhatsApp הישן עם Green API** (עדיין פעיל אך לא בשימוש — לכבות בבוא העת)

---

## 📋 מה השלמנו ב-2026-05-21

1. ✅ **חסימת דיווחים כפולים** ב-`api/heyy-webhook.ts`: אם יש כבר רשומת monthly_report לאותו (vehicle, year, month) — שולח "כבר קיבלנו" ולא דורס
2. ✅ **בניית סנכרון מפריורטי ל-Supabase** — סנריו 4646251 שוכתב מאפס, פעיל
3. ✅ **RPC `public.sync_vehicle_from_priority`** ב-Postgres עם SECURITY DEFINER — חוצה schemas, מטפל בכל הלוגיקה
4. ✅ **152/152 רכבים נסנכרנו** בריצה הידנית הראשונה, כולל edge cases (`בע"מ`, `ארה"ב`)
5. ✅ **שדות מוגנים** (`current_mileage`, `is_active`, `is_inventory`, `last_report_*`) — לא נדרסים בסנכרון
6. ✅ **מדיניות חסימת דיווחים קיימים** — מקור לא משנה, אם יש דיווח לחודש זה נעול
7. ✅ **תיעוד** — HANDOFF.md, memory files חדשים (`project_priority_sync.md`, `reference_make_quirks.md`, `feedback_quality_bar.md`)

---

## 🔮 מה נשאר לעתיד

### בעדיפות גבוהה
1. **טריגר manual** של האוטומציה ל-94 הנהגים — חודש 5/2026
2. לעקוב אחרי `fleet.inbound_messages` ב-Supabase לראות שכל הדיווחים נכנסים

### בעדיפות בינונית
3. **לכבות סנריו 4602610** (בוט WhatsApp הישן עם Green API) — כבר לא בשימוש
4. **לכבות Make Data Store 83526** אחרי שבוע יציבות
5. למחוק `api/priority-sync.ts` ו-`PRIORITY_SYNC_SECRET` env var (לא בשימוש, רק מבלבל)

### ניקוי
- `data/professionals/` — 10 קבצי JSON dumps מפריורטי, אפשר למחוק (כפילות עם `public.professionals`)
- שלב סופי: לבדוק שכל הנהגים קיבלו הודעה ב-5/2026 וה-current_mileage התעדכן

---

## 🔗 כתובות / IDs חשובים

| מה | איפה / מה |
|---|---|
| Production URL | https://metalpress-fleet.vercel.app |
| Webhook URL | https://metalpress-fleet.vercel.app/api/heyy-webhook |
| Supabase project | `mbodppnsdnmlejdldztp` (metalpress-crm) |
| Vercel project | `prj_ZvE5Jd7cKv0F4dNpn04K9iyt5J3D` |
| Make team | 77940 ("My Team") |
| Make folder | 310958 (MetalPress) |
| Make scenario — Priority write (WhatsApp → Priority) | 4738680 (active) |
| Make scenario — Sync Priority → Supabase | 4646251 (active, weekly) |
| Make webhook — Priority write | https://hook.us1.make.com/owt4lw57buvry3575yu6vnuk8efgqe3f |
| Make keychain — Priority creds | 85308 (METALPRESSAPI) |
| Make connection — metalpress DB (Supabase) | 4778142 |
| Postgres RPC for sync | `public.sync_vehicle_from_priority(p_payload jsonb)` |
| Priority OData base | https://prio.metalpress.co.il/odata/Priority/tabula.ini/sales |
| heyy channel id | 61171b95-b182-43a9-8ad0-aac17785ac8d |
| heyy tenant id | af9f313b-34d0-4152-b143-ca19c4dcc4cb |
| Test driver (Supabase) | driver_id 109, vehicle 130, phone 0523694547 |
| Test heyy contact id | b062a7fc-ac71-4a02-aa82-6589a1f1d93a |

---

## ⚠️ הערות חשובות

1. **המשתמש מעדיף הסברים בעברית פשוטה עם הפרדה ויזואלית.** לפלואו מורכב — עדיף קובץ HTML עם diagrams.
2. **לא לשתף סיסמאות בצ'אט.** כיוון לעדכון ישירות ב-Vercel env vars.
3. **Priority IP whitelist הוא חסם קשיח.** אל תקרא ישירות — תמיד דרך Make scenario 4738680 או 4646251.
4. **heyy AI Employees הם conversational** — לא לסמוך עליהם להחליט מתי לסיים flow. הפיתרון הוא ארכיטקטורה B (webhook לבד).
5. **זה מוצר ללקוח** — אסור לדלג על שדות בעייתיים או רכבים. הפתרון תמיד צריך לתמוך ב-100% מהנתונים.
6. **דברים שלא לעשות:**
   - לא לגעת ב-`public.professional_*` של ה-CRM
   - לא לכבות סנריואים ישנים ב-Make בלי אישור
   - לא למחוק Make Data Store 83526 עד שבוע יציבות
   - לא לשנות את ה-RPC `sync_vehicle_from_priority` בלי הבנת הלוגיקה של "אל תדרוס" (current_mileage וכו')

---

## 🔧 איך לתחזק את הסנכרון

**אם הסנריו 4646251 כושל:**
1. בדוק את Make execution log לראות איזה module
2. אם זה M4 (Supabase API Call) עם 400 — בדוק את ה-body שנשלח: `p_payload=...`. URL-decode וודא שהוא JSON תקין
3. אם זה M3 (TransformToJSON) — בדוק שהאובייקט מקבל את כל השדות. אסור ש-`{{2}}` יחזור כ-number
4. RPC עצמה — בדוק `fleet.sync_log` או הרץ ידנית ב-SQL editor:
   ```sql
   SELECT public.sync_vehicle_from_priority('{"EQUIPMENT_ID":1,"VEHICLENUMCH":"TEST",...}'::jsonb);
   ```

**להוסיף שדה חדש מפריורטי:**
1. ודא שהשדה ב-METL_CARUSAGE_SUBFORM או ב-METL_EMPLOYEECARS
2. בעריכת M3 (TransformToJSON), הוסף שדה חדש למפה: `"NEWFIELD": "{{2.NEWFIELD}}"`
3. ערוך את RPC ב-Postgres להוצאת השדה מ-p_payload ולהכנסתו לטבלה הרצויה
