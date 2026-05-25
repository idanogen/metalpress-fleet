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
| 4646251 | MetalPress — סנכרון חודשי מלא מפריורטי | קורא `METL_EMPLOYEECARS` + `METL_CARUSAGE_SUBFORM`, שולח ל-RPC `sync_vehicle_from_priority` ב-Supabase. כולל סנכרון נהגים ל-heyy בסוף. רץ מונת'לי 23:00 ב-1 לחודש |
| 4636689 | עדכון רכבים חדשים מהפריורטי | זיהוי רכבים חדשים בפריוריטי והוספה למסד |
| 4627015 | שליחת הודעה ידנית מטלפרס | webhook מהדשבורד לשליחת תזכורת ידנית לנהג |
| 4646471 | שליחת הודעה ידנית תחילת חודש מטרפלס | webhook נוסף לתזכורות |

#### סנריואים כבויים ⚪

| ID | שם | הערות |
|----|-----|--------|
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
- `sync_vehicle_from_priority(p_payload jsonb)` — הסנריו 4646251 שולח אליו payload פר רכב. עושה upsert לרכב + drivers + monthly_reports. תומך ב-overhead accounts (model='שוטף') שאין להם ק"מ אבל יש עלויות. עדכון בקונפליקט רק כשsource='priority' (לא דורס דיווחי וואטסאפ).
- `sync_vehicle_invoices(p_payload jsonb)` — מקבל את אותו payload כמו `sync_vehicle_from_priority` ושולף ממנו את `METL_CARUSAGE_SUBFORM[].EDPE_CARUSAGEPIVENV_SUBFORM[]` לעדכון `vehicle_invoices`. דורש שה-URL בסנריו יכלול `($expand=EDPE_CARUSAGEPIVENV_SUBFORM)`. ראה `docs/sync-vehicle-invoices-spec.md`.

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

---

## מבנה דפים (ViewType)

| View | קומפוננטה | תיאור |
|------|-----------|--------|
| `dashboard` | KpiCards, ReportStatus, AnomalyAlerts, FleetCharts, FleetTable | דשבורד ראשי |
| `fleet-management` | FleetManagementPage | מעקב תוקף ליסינג/רישוי עם toggle פנימי |
| `inventory` | InventoryPage | רכבי מלאי (driverName === 'מלאי') |
| `driver-reminders` | DriverRemindersPage | תזכורות WhatsApp לנהגים שלא דיווחו |
| `drivers-detail` | DriversDetailPage | היסטוריית 12 חודשים לכל נהג + פרטי חוזה ורישוי |
| `anomalies-review` | AnomaliesReviewPage | סקירת דיווחים חריגים |
| `fuel-expenses` | FuelExpensesPage | הוצאות דלק (ממוקד דלק בלבד) |
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
