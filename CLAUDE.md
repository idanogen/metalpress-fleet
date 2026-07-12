# MetalPress Fleet — דשבורד ניהול צי רכב

## זיהוי פרויקט
- **פרויקט:** MetalPress Fleet Dashboard
- **נתיב:** `/Users/idanogen/antigravity/metalpress-fleet`
- **סוג:** פנימי (MetalPress)
- **אתה עובד רק על הפרויקט הזה.**
- **אסור לשנות קבצים מחוץ לתיקייה הזו.**

---

## הפעלה
```bash
npm run dev
```
**פורט:** 5173

## פריסה
- **פלטפורמה:** Vercel
- **פריסה:** `npx vercel deploy --prod --yes`
- **כתובת פרודקשן:** https://metalpress-fleet.vercel.app

## טכנולוגיות
Vite 8 + React 19 + TypeScript + Tailwind CSS 4 + Recharts + Framer Motion + React Query v5 + Lucide Icons + Supabase JS

## תיאור
דשבורד לניהול צי רכב של MetalPress. מציג סטטיסטיקות, דיווחי ק"מ חודשיים, חריגות,
מעקב תוקף ליסינג/רישוי, תזכורות WhatsApp לנהגים, הוצאות צי לפי קטגוריה, הוצאות
כלליות ברמת חברה, ומידע מפורט על כל נהג.

## כללי עבודה
- שפה: עברית | כיוון: RTL
- עיצוב: Apple Glass Design (backdrop-blur, glass-card, שקיפויות)
- פלטת צבעים: כחול #007AFF, ירוק #34c759, כתום #ff9500, אדום #ff3b30, אפור #86868b
- ניווט: state-based (אין router) — `ViewType` ב-Sidebar שולט על `currentView` ב-App

---

## מקור נתונים

### Supabase (מקור אמת)
- **Project ID:** `mbodppnsdnmlejdldztp`
- **URL:** `https://mbodppnsdnmlejdldztp.supabase.co`
- **Schema:** `fleet`
- **טבלאות:**
  - `vehicles` — צי הרכב (כולל `is_active`, `is_inventory`, `current_driver_id`, `last_synced_at`)
  - `drivers` — נהגים (name, phone, whatsapp_id)
  - `monthly_reports` — דיווחים חודשיים (ק"מ, דלק, 13 קטגוריות עלות, source)
  - `vehicle_invoices` — חשבוניות פר שורה מהמסך הנכד `EDPE_CARUSAGEPIVENV` בפריוריטי (תאריך, ספק, סכום, קטגוריה, חברה). PK חיצוני: `(carusagepiv, kline)`

### עמודות עלות ב-`monthly_reports`
14 קטגוריות הוצאה מסונכרנות מפריוריטי (`METL_CARUSAGE_SUBFORM`):
`fuel_cost`, `road6_cost`, `road6_north_cost`, `pango_cost`, `carmel_cost`,
`reports_cost`, `maintenance_cost`, `insurance_cost`, `license_cost`,
`ituran_cost`, `carwash_cost`, `tires_cost`, `rental_cost`, `electric_cost`.

### שדה `source` ב-`monthly_reports`
- `priority` — דיווח שהגיע דרך הסנכרון השבועי מפריוריטי
- `whatsapp_bot` — דיווח שנהג שלח דרך WhatsApp (heyy)
- `manual` — הזנה ידנית

### משתני סביבה (`.env`)
```
VITE_SUPABASE_URL=https://mbodppnsdnmlejdldztp.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

### Make — מיפוי מלא

**ארגון:** עוגן הזהר (ID: 195344) | **Zone:** us1.make.com
**צוות:** My Team (ID: 77940)
**תיקיית MetalPress:** folder 310958

#### סנריואים פעילים 🟢

| ID | שם | תיאור |
|----|-----|--------|
| 4646251 | MetalPress — סנכרון שבועי מלא מפריורטי | קורא `METL_EMPLOYEECARS` + `METL_CARUSAGE_SUBFORM` (+חשבוניות נכד), שולח לכל רכב את `sync_vehicle_from_priority` **וגם** `sync_vehicle_invoices` (חווט 12/6/2026), סנכרון נהגים ל-heyy, ואז `sync_health_report` שתוצאתו במייל הסיכום. **רץ שבועי — יום שני 23:00** (שונה מחודשי ב-10/6/2026) |
| 4738680 | MetalPress — Priority Write Mileage | webhook → PATCH ק"מ לפריוריטי במפתח (GLNAME,MONTHNUM), מחזיר סטטוס אמיתי |
| 4627015 | שליחת הודעה ידנית מטלפרס | webhook מהדשבורד לשליחת תזכורת ידנית לנהג |
| 4646471 | שליחת הודעה ידנית תחילת חודש מטרפלס | webhook נוסף לתזכורות |

#### סנריואים כבויים ⚪

| ID | שם | הערות |
|----|-----|--------|
| 4636689 | עדכון רכבים חדשים מהפריורטי | **כבוי ולא תקין** (isinvalid) — רכבים חדשים נקלטים בסנכרון השבועי 4646251 (עיכוב מרבי: שבוע) |
| 4602610 | מטלפרס קבלת הודעות מווצאפ | **הוחלף** — בוט WhatsApp עבר מ-Green API/Make ל-heyy + Vercel endpoint `/api/heyy-webhook` |
| 4626788 | MetalPress Dashboard Webhook | ישן |
| 4626827 | MetalPress Sync Priority → Data Store | הוחלף ע"י 4646251 (סנכרון ל-Supabase) |
| 4615781 | מטלפרס שליחת הודעות תחילת חודש | שליחה אוטומטית לכל הנהגים |

#### Priority API
- **Base URL:** `https://prio.metalpress.co.il/odata/Priority/tabula.ini/sales`
- **טבלת רכבים:** `METL_EMPLOYEECARS`
- **טבלת שימוש חודשי:** `METL_CARUSAGE_SUBFORM` (מסך בן)
- **אותנטיקציה:** Basic Auth (connection: "METALPRESSAPI", keychain 85308 ב-Make)

#### RPC ב-Supabase
- `sync_vehicle_from_priority(p_payload jsonb)` — הסנריו 4646251 שולח אליו payload פר רכב. עושה upsert לרכב + drivers + monthly_reports. תומך ב-overhead accounts (model='שוטף') שאין להם ק"מ אבל יש עלויות. מ-3/7/2026 ההגנה על דיווחי וואטסאפ היא **ברמת שדה הק"מ בלבד**: בקונפליקט, 14 עמודות העלות מתעדכנות מפריוריטי תמיד (גם בשורות בוט/ידני — פריוריטי הוא מקור האמת היחיד לעלויות), ו-`mileage` מוגן ב-CASE (שורת בוט/ידני שומרת את קריאת הנהג; בשורת פריוריטי 0 לא דורס קריאה אמיתית). לפני כן ההגנה היתה ברמת שורה (`WHERE source='priority'`) וחסמה גם את העלויות — באג שהשאיר ~2/3 מהוצאות מאי 2026 מחוץ לדשבורד (ראה `migrations/2026-07-03_costs_always_sync_on_protected_rows.sql`). מ-12/6/2026: מרענן `current_mileage` ברכב קיים (GREATEST — לא יורד לעולם), וכששורה מוגנת (בוט/ידני) סותרת את פריוריטי — יוצר פריט `pending_review` ב-`inbound_messages` (provider='priority_sync') שמופיע בדף הדיווחים החריגים.
- `sync_vehicle_invoices(p_payload jsonb)` — מקבל את אותו payload כמו `sync_vehicle_from_priority` ושולף ממנו את `METL_CARUSAGE_SUBFORM[].EDPE_CARUSAGEPIVENV_SUBFORM[]` לעדכון `vehicle_invoices`. דורש שה-URL בסנריו יכלול `($expand=EDPE_CARUSAGEPIVENV_SUBFORM)`. ראה `docs/sync-vehicle-invoices-spec.md`. **חווט לסנריו 4646251 רק ב-12/6/2026** — לפני כן לא נקרא ע"י אף סנריו והחשבוניות קפאו על 25/5.
- `sync_health_report()` — בדיקת תקינות הסנכרון: רכבים שלא סונכרנו 8+ ימים (=כשל RPC שקט ב-Make), פערי ק"מ פנימיים, דיווחים ממתינים, כשלי כתיבה לפריוריטי, גיל החשבוניות. נקרא בסוף הסנריו השבועי ומוטמע במייל הסיכום; כותב היסטוריה ל-`fleet.sync_log`.

---

## בוט WhatsApp (heyy)
- **Provider:** heyy.io (לא Green API, לא Make)
- **Endpoint:** `POST /api/heyy-webhook` (Vercel serverless function)
- **זרימה:** נהג שולח ק"מ → heyy webhook → endpoint מאמת → מעדכן `current_mileage` ב-Supabase + `kilo` ב-heyy + שולח ל-Make לכתיבה לפריוריטי
- **Idempotency:** דרך `provider_message_id`
- **תיעוד מלא:** `docs/heyy-flow-architecture.md`

### Webhook לתזכורות ידניות
- **URL:** `https://hook.us1.make.com/piugtkez49mveettgmenuepb2v16w7pl` (סנריו 4627015)
- **פורמט טלפון:** `0523694547` → `972523694547@c.us`
- **Cooldown:** 48 שעות (localStorage, מפתח: `fleet-reminder-timestamps`)

### שליחה חודשית אוטומטית מהשרת (החליף את ה-broadcast של heyy ב-12/7/2026)
עד 12/7/2026 ההודעה החודשית נשלחה דרך broadcast חוזר ב-heyy (`ae7cf40b-...`). התגלה
שהוא קופסה שחורה שכשלה בשקט: ב-1/7/2026 הוא כלל **26 מתוך 102** נהגים בלבד, וכולם
`isSubscribed=false` כך שלאף אחד לא נמסרה הודעה — בלי שנדע. הוחלף במנגנון שרת מלא:

- **`/api/send-monthly-open`** — Vercel Cron ב-1 לחודש 05:00 UTC. עובר על **כל** הנהגים
  הפעילים מ-Supabase (מקור האמת) ושולח לכל אחד את תבנית "הודעה בתחילת חודש"
  (`95c9ac60-...`) ישירות דרך `POST /whatsapp_messages/send` (מסלול שעוקף את בעיית
  ה-subscribe של broadcasts).
- **`/api/send-monthly-reminder`** — Vercel Cron ב-15 לחודש 05:00 UTC. שולח את תבנית
  "תזכורת" (`9224835e-...`) **רק** לנהגים שעדיין לא דיווחו ק"מ לחודש הקודם.
- **מנוע משותף:** `api/_lib/monthly-messaging.ts` (הסינון זהה ל-useFleetData: ללא
  overhead/מלאי/מושבת/בלי טלפון). אידמפוטנטי — נהג עם שורת 'accepted' מדולג.
- **יומן:** כל שליחה נרשמת ל-`fleet.message_log` (kind, report_year/month, driver,
  send_status, heyy_message_id, delivery_status, error). unique(year,month,driver,kind).
- **אישורי מסירה:** ענף status ב-`api/heyy-webhook.ts` (`recordDeliveryStatus`) מעדכן
  `delivery_status` (נמסר/נקרא/נכשל) לפי `heyy_message_id`. דורמנטי עד ש-heyy יוגדר
  לשלוח אירועי status ל-webhook.
- **דשבורד:** דף `message-tracking` ("מעקב הודעות") מציג פר-נהג מי קיבל/לא קיבל + סיכום.
- **אבטחה:** `Bearer CRON_SECRET` (Vercel מוסיף לקרונים) או `x-sync-secret` להרצה ידנית.
- **ה-broadcast הישן** (`ae7cf40b-...`, workflow `c7e11410`) **כובה** ב-12/7/2026
  (recurrence הוסר) כדי למנוע כפל שליחה. שמור לשחזור אם צריך.
- **פניה בשם:** תבניות "הודעה בתחילת חודש"/"תזכורת" הן טקסט סטטי בלי משתנה שם
  (`whatsappComponents: []`), אז השליחה עם `variables: []`. ניקוי ה-`lastName` המזוהם
  עדיין רץ (`/api/clean-heyy-lastnames`, cron 1 לחודש 03:00 UTC) כי הוא משפיע על
  התצוגה ב-heyy ועל שיחות עתידיות.
- **מלכודת API:** עדכון איש קשר/broadcast ב-heyy = **PUT** (PATCH מחזיר 404). עדכון
  broadcast חייב לכלול `isReoccurring: true` יחד עם `recurrenceRules`, אחרת החזרתיות נמחקת

---

## מבנה דפים (ViewType)

| View | קומפוננטה | תיאור |
|------|-----------|--------|
| `dashboard` | KpiCards, ReportStatus, AnomalyAlerts, FleetCharts, FleetTable | דשבורד ראשי |
| `fleet-management` | FleetManagementPage | מעקב תוקף ליסינג/רישוי עם toggle פנימי |
| `inventory` | InventoryPage | רכבי מלאי (driverName === 'מלאי') |
| `driver-reminders` | DriverRemindersPage | תזכורות WhatsApp לנהגים שלא דיווחו |
| `message-tracking` | MessageTrackingPage | מעקב מי קיבל את ההודעה החודשית/תזכורת (מ-`message_log`) |
| `drivers-detail` | DriversDetailPage | היסטוריית 12 חודשים לכל נהג + פרטי חוזה ורישוי |
| `anomalies-review` | AnomaliesReviewPage | סקירת דיווחים חריגים |
| `fuel-expenses` | FuelExpensesPage | הוצאות דלק (ממוקד דלק בלבד) + מדד ק"מ/ליטר פר רכב ופר חודש (`lib/fuelEfficiency.ts`) |
| `fleet-expenses` | FleetExpensesPage | הוצאות צי — 14 קטגוריות, פילטרים, גרפים, drawer לרכב עם **טבלת חשבוניות מפורטות** (`vehicle_invoices`) |
| `overhead-expenses` | OverheadExpensesPage | 7 חשבונות פיקטיביים (model='שוטף') — הוצאות כלליות לפי חברה |
| `reports` | ReportsPage | דוחות + ייצוא Excel |
| `settings` | SettingsPage | הגדרות (anomaly threshold וכו') |

---

## סינון רכבים ב-`useFleetData.ts`

`useQuery` קורא ל-`fetchFleetData()` ואז עובר 3 שלבי סינון לפני שמגיע לדפים:

1. **React Query `select`:** מסנן `driverName === 'מושבת'` (Priority "מושבת" = רכב לא פעיל)
2. **`allVehicles`:** מסנן גם `model === 'שוטף'` (חשבונות פיקטיביים) — מחוץ לצי הרגיל
3. **`vehicles`:** מ-`allVehicles` ללא `driverName === 'מלאי'`
4. **`inventoryVehicles`:** רק `driverName === 'מלאי'`
5. **`overheadAccounts`:** רק `model === 'שוטף'` (לדף הוצאות כלליות)

בנוסף — `is_active = true` בלבד ברמת ה-API (מסונן ב-Supabase select).

---

## לוגיקת חודשים
- **ברירת מחדל:** חודש קודם (נהגים מדווחים בחודש הנוכחי על החודש שעבר)
- **חישוב:** `useFleetData.ts` — `getMonth()` הוא 0-based, אז מרץ=2, חודש קודם=פברואר=2
- **חשוב:** לעולם לא להציג חודש נוכחי כ"לא דווח" — הוא עדיין לא נגמר

---

## חשבונות הוצאה פיקטיביים ("שוטף")

7 רכבי `model='שוטף'` (לוחיות 11223344 עד 55996688) מייצגים **חשבונות הוצאה** שמנהלות חשבונות בכל חברה הקימו לרכז הוצאות שלא מיוחסות לרכב ספציפי (דמי מנוי פנגו של החברה, ביטוחים כלליים, וכו'). לכל חשבון נהג פיקטיבי בשם החברה (שירות, פתרונות, ניהול עשן, כוכב, דלתות, מיגון, יצוא).

הם **מוסרים מהצי הרגיל** ב-`useFleetData` ומוצגים רק בדף `overhead-expenses`.

---

## מבנה קבצים

```
src/
├── api/fleet.ts              — fetch מ-Supabase + מיפוי ל-Vehicle[] + 14 קטגוריות עלות
├── lib/supabase.ts           — supabase client (schema: 'fleet')
├── lib/anomalies.ts          — fetchPendingAnomalies וכו'
├── hooks/useFleetData.ts     — React Query hook ראשי + חישובים + פילטרים
├── types/fleet.ts            — Vehicle, MonthlyUsage, FleetStats, EXPENSE_CATEGORIES (14)
├── lib/
│   ├── analytics.ts          — getFleetStats, detectAnomalies, hasReported, isApplicableForMonth
│   ├── fleetDates.ts         — חישובי תאריכי ליסינג/רישוי + דחיפות
│   ├── vehicleImages.ts      — מיפוי דגם רכב → תמונה
│   └── utils.ts              — cn() helper
├── components/
│   ├── layout/               — Sidebar (ViewType), Header
│   ├── dashboard/            — KpiCards, ReportStatus, AnomalyAlerts, FleetCharts, FleetTable, DriverDetail
│   ├── fleet-management/     — FleetManagementPage
│   ├── inventory/            — InventoryPage
│   ├── driver-reminders/     — DriverRemindersPage (cooldown localStorage)
│   ├── drivers-detail/       — DriversDetailPage (אקורדיון + 12 חודשים + חוזה ורישוי)
│   ├── anomalies-review/     — AnomaliesReviewPage
│   ├── fuel-expenses/        — FuelExpensesPage (ממוקד דלק) + VehicleFuelDetail
│   ├── fleet-expenses/       — FleetExpensesPage (14 קטגוריות) + VehicleExpenseDetail (drawer)
│   ├── overhead-expenses/    — OverheadExpensesPage (חשבונות פיקטיביים לפי חברה)
│   ├── reports/              — ReportsPage + Excel export
│   ├── settings/             — SettingsPage (anomaly threshold, loadSettings)
│   └── ui/                   — רכיבי shadcn/ui + VehicleImage
├── api/heyy-webhook.ts       — Vercel function — בוט WhatsApp דרך heyy
└── main.tsx                  — QueryClientProvider + render

scripts/
├── sync-drivers-to-heyy.mjs  — סנכרון Supabase → heyy contacts
└── backfill-heyy-kilo.mjs    — מילוי attribute kilo ב-heyy מ-Supabase

docs/
├── heyy-flow-architecture.md — ארכיטקטורת זרימת הבוט
└── heyy-ai-prompt-current.md — prompt ישן של Julie (לא בשימוש)
```

---

## דגשים חשובים
1. **אין Router** — הניווט מבוסס על state (`currentView`), לא על React Router
2. **RTL** — כל הלייאאוט ב-RTL, הסיידבר בצד ימין, `mr-[300px]` על ה-main
3. **Glass Design** — כל הכרטיסים עם `glass-card` (bg-white/40, backdrop-blur, border-white/60, rounded-[24px])
4. **VehicleImage** — תמונות רכב לפי דגם, fallback לאייקון כללי
5. **Cooldown mechanism** — localStorage-based, מפתח `{vehicleId}-{month}-{year}`, ניקוי אוטומטי של ישנים
6. **מיגרציה ל-Supabase** — בוצעה ב-19/5/2026, החליפה את Make Data Store. אין יותר fallback לקובץ סטטי

---

## 🔵 רוני — חלק מצוות הפרויקט הזה
הפרויקט נוגע ב-Priority ERP → רוני בצוות כאן בכל סשן (סקיל גלובלי `roni-priority`).
- **לפני כיוון/שינוי שנוגע בפריוריטי** → היוועץ בבית הידע: `~/Idan-HQ/knowledge/priority/`
- **כל לקח חדש על פריוריטי** → חזרה לבית הידע (learnings.md / clients.md / projects-map.md)
- **הקשר הפרויקט:** סביבת MetalPress: prio.metalpress.co.il · מסך מותאם ידוע: METL_EMPLOYEECARS
