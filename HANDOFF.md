# MetalPress Fleet — Handoff Document

**עודכן:** 2026-05-19 (סוף יום עבודה)

---

## 🎯 הקונטקסט

מערכת ניהול צי רכב של MetalPress עברה מ-Make Data Store → Supabase, וה-WhatsApp bot עבר מ-Green API → heyy.io. הסיבה: data model נקי + ניהול הודעות אחיד. **הזרימה המלאה עובדת end-to-end.**

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
  • אם תקין: שומר ל-Supabase (monthly_reports + vehicles.current_mileage)
                  ↓
              מעדכן kilo ב-heyy contact
                  ↓
              שולח ל-Make scenario 4738680 → Priority
                  ↓
              שולח WhatsApp לנהג: "תודה ✅ נרשם <N> ק"מ לרכב <plateNumber>"
  • אם שגיאה: שולח WhatsApp עם הסבר ("המספר נמוך..." / "לא זיהיתי..." / "גבוהה משמעותית...")
  • Idempotent: בקריאות חוזרות עם אותו provider_message_id — מדלג
  • תמיד מחזיר 200 כדי שהוואץ לא יחזור על קריאות
```

### Database — Supabase
- **Project:** `mbodppnsdnmlejdldztp` (metalpress-crm, EU-Central, Postgres 17)
- **Schema:** `fleet` (מבודד מ-`public.professional_*` של ה-CRM)
- **טבלאות:**
  - `fleet.drivers` (109 רשומות, 94 עם טלפון)
  - `fleet.vehicles` (150, מהן 17 מלאי)
  - `fleet.monthly_reports` (1,085+ דיווחים היסטוריים)
  - `fleet.reminder_log`
  - `fleet.inbound_messages` (audit של webhooks מ-heyy)
  - `fleet.sync_log`

### Frontend — Vercel
- **URL:** https://metalpress-fleet.vercel.app
- **קוד:** Vite + React + Supabase JS client (`@supabase/supabase-js`)
- **קורא ישירות מ-Supabase** (`db: { schema: 'fleet' }`)

### Vercel Endpoint — `api/heyy-webhook.ts`
- מקבל POST מ-heyy Channel Webhook (event=`message.received`) **או** מ-flow API node (`{from, text}`) — תומך בשני הפורמטים
- **Vercel env vars (production):**
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - `HEYY_API_KEY`, `HEYY_BASE_URL`, `HEYY_CHANNEL_ID`
  - `MAKE_PRIORITY_WRITE_WEBHOOK`

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

---

## 📋 מה השלמנו בשיחה האחרונה (2026-05-19)

1. ✅ **תיקון אובדן kilo ב-heyy** — סקריפט `scripts/backfill-heyy-kilo.mjs` מילא ל-95 אנשי קשר את current_mileage מ-Supabase
2. ✅ **איתור שורש בעיית "AI מעדכן ערכים פסולים"** — היה auto-save ל-kilo בנוד "שלח תבנית" של heyy
3. ✅ **ניסוי ארכיטקטורה A** — AI Employee מוביל את השיחה, webhook שקט. נכשל כי heyy AI Employee הפעיל "Conversation Resolution" גם על שגיאות
4. ✅ **מעבר לארכיטקטורה B** — webhook עושה הכל (וולידציה + שליחת תשובות)
5. ✅ **הגדרת heyy Channel Webhook** — heyy שולח לנו על כל הודעה נכנסת, לא רק במסגרת אוטומציה
6. ✅ **תיקון בעיית כפילויות** — Idempotency דרך `provider_message_id` + תמיד מחזירים 200
7. ✅ **בדיקה מלאה ב-WhatsApp** — שיחה רב-תורית עובדת:
   - "40" → "נמוך" • "שלום" → "לא זיהיתי" • "150" → "תודה ✅" • kilo→150 ✅

---

## 🔮 מה נשאר לעתיד

### בעדיפות גבוהה
1. **טריגר manual** של האוטומציה ל-94 הנהגים — חודש 5/2026
2. לעקוב אחרי `fleet.inbound_messages` ב-Supabase לראות שכל הדיווחים נכנסים

### בעדיפות בינונית
3. **Delta sync מ-Priority ל-Supabase** — להחליף את סנריו 4646251 שכותב ל-Make Data Store
4. **לכבות סנריו 4602610** (בוט WhatsApp הישן עם Green API) — כבר לא בשימוש
5. **לכבות Make Data Store 83526** אחרי שבוע יציבות

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
| Make scenario — Priority write | 4738680 (active) |
| Make webhook — Priority write | https://hook.us1.make.com/owt4lw57buvry3575yu6vnuk8efgqe3f |
| Make keychain — Priority creds | 85308 (METALPRESSAPI) |
| Priority OData base | https://prio.metalpress.co.il/odata/Priority/tabula.ini/sales |
| heyy channel id | 61171b95-b182-43a9-8ad0-aac17785ac8d |
| heyy tenant id | af9f313b-34d0-4152-b143-ca19c4dcc4cb |
| Test driver (Supabase) | driver_id 109, vehicle 130, phone 0523694547 |
| Test heyy contact id | b062a7fc-ac71-4a02-aa82-6589a1f1d93a |

---

## ⚠️ הערות חשובות

1. **המשתמש מעדיף הסברים בעברית פשוטה עם הפרדה ויזואלית.** לפלואו מורכב — עדיף קובץ HTML עם diagrams.
2. **לא לשתף סיסמאות בצ'אט.** כיוון לעדכון ישירות ב-Vercel env vars.
3. **Priority IP whitelist הוא חסם קשיח.** אל תקרא ישירות — תמיד דרך Make scenario 4738680.
4. **heyy AI Employees הם conversational** — לא לסמוך עליהם להחליט מתי לסיים flow. הפיתרון הוא ארכיטקטורה B (webhook לבד).
5. **דברים שלא לעשות:**
   - לא לגעת ב-`public.professional_*` של ה-CRM
   - לא לכבות סנריואים ישנים ב-Make בלי אישור
   - לא למחוק Make Data Store 83526 עד שבוע יציבות
