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

## טכנולוגיות
Vite 8 + React 19 + TypeScript + Tailwind CSS 4 + Recharts + Framer Motion + React Query v5 + Lucide Icons

## תיאור
דשבורד לניהול צי רכב של MetalPress. מציג סטטיסטיקות, דיווחי ק"מ חודשיים, חריגות,
מעקב תוקף ליסינג/רישוי, תזכורות WhatsApp לנהגים, ומידע מפורט על כל נהג.

## כללי עבודה
- שפה: עברית | כיוון: RTL
- עיצוב: Apple Glass Design (backdrop-blur, glass-card, שקיפויות)
- פלטת צבעים: כחול #007AFF, ירוק #34c759, כתום #ff9500, אדום #ff3b30, אפור #86868b
- ניווט: state-based (אין router) — `ViewType` ב-Sidebar שולט על `currentView` ב-App

---

## מקור נתונים

### Make Data Store
- **Data Store ID:** 83526 (בקובץ `.env`)
- **API:** Make Data Store API (`https://us1.make.com/api/v2`)
- **Proxy בפיתוח:** Vite proxy `/api/make` → Make API (מניעת CORS)
- **Fallback:** אם אין חיבור, נופל לנתונים סטטיים מ-`src/data/vehicles.ts`
- **עימוד:** 10 רשומות בכל קריאה, fetching כל הדפים
- **רענון:** React Query עם `staleTime: 5 דקות`

### משתני סביבה (`.env`)
```
VITE_MAKE_API_TOKEN=<token>
VITE_MAKE_DATA_STORE_ID=83526
```

---

## מבנה דפים (ViewType)

| View | קומפוננטה | תיאור |
|------|-----------|--------|
| `dashboard` | KpiCards, ReportStatus, AnomalyAlerts, FleetCharts, FleetTable | דשבורד ראשי |
| `fleet-management` | FleetManagementPage | מעקב תוקף ליסינג/רישוי עם toggle פנימי |
| `driver-reminders` | DriverRemindersPage | תזכורות WhatsApp לנהגים שלא דיווחו |
| `drivers-detail` | DriversDetailPage | היסטוריית 12 חודשים לכל נהג (אקורדיון) |
| `settings` | — | מושבת (בקרוב) |

---

## לוגיקת חודשים
- **ברירת מחדל:** חודש קודם (נהגים מדווחים בחודש הנוכחי על החודש שעבר)
- **חישוב:** `useFleetData.ts` — `getMonth()` הוא 0-based, אז מרץ=2, חודש קודם=פברואר=2
- **חשוב:** לעולם לא להציג חודש נוכחי כ"לא דווח" — הוא עדיין לא נגמר

---

## Webhooks ואינטגרציות

### תזכורת WhatsApp
- **Webhook URL:** `https://hook.us1.make.com/piugtkez49mveettgmenuepb2v16w7pl`
- **פורמט טלפון Green API:** `0523694547` → `972523694547@c.us`
- **Cooldown:** 48 שעות (localStorage, מפתח: `fleet-reminder-timestamps`)
- **Payload:** JSON עם action, timestamp, reportMonth/Year, driver (id, name, phone, whatsappId), vehicle

---

## מבנה קבצים

```
src/
├── api/fleet.ts              — fetch מ-Make Data Store + מיפוי ל-Vehicle[]
├── hooks/useFleetData.ts     — React Query hook ראשי + חישובים
├── types/fleet.ts            — טיפוסים: Vehicle, MonthlyUsage, FleetStats, ExpirationItem
├── lib/
│   ├── analytics.ts          — getFleetStats, detectAnomalies, hasReported, getDriverAvgUsage
│   ├── fleetDates.ts         — חישובי תאריכי ליסינג/רישוי + דחיפות
│   ├── vehicleImages.ts      — מיפוי דגם רכב → תמונה
│   └── utils.ts              — cn() helper
├── data/vehicles.ts          — נתונים סטטיים (fallback) — 103 רכבים
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx       — ניווט ראשי + ViewType
│   │   └── Header.tsx        — בחירת שנה/חודש + תאריך עדכון
│   ├── dashboard/
│   │   ├── KpiCards.tsx      — 5 כרטיסי KPI
│   │   ├── ReportStatus.tsx  — סטטוס דיווחים
│   │   ├── AnomalyAlerts.tsx — התראות חריגה
│   │   ├── FleetCharts.tsx   — גרפים (Recharts)
│   │   ├── FleetTable.tsx    — טבלת צי מלאה
│   │   └── DriverDetail.tsx  — Drawer פרטי נהג
│   ├── fleet-management/
│   │   └── FleetManagementPage.tsx — מעקב תוקף (toggle ליסינג/רישוי)
│   ├── driver-reminders/
│   │   └── DriverRemindersPage.tsx — תזכורות WhatsApp
│   ├── drivers-detail/
│   │   └── DriversDetailPage.tsx — היסטוריית נהגים מפורטת
│   └── ui/                   — רכיבי shadcn/ui + VehicleImage
└── main.tsx                  — QueryClientProvider + render
```

---

## דגשים חשובים
1. **אין Router** — הניווט מבוסס על state (`currentView`), לא על React Router
2. **RTL** — כל הלייאאוט ב-RTL, הסיידבר בצד ימין, `mr-[300px]` על ה-main
3. **Glass Design** — כל הכרטיסים עם `glass-card` (bg-white/40, backdrop-blur, border-white/60, rounded-[24px])
4. **VehicleImage** — תמונות רכב לפי דגם, fallback לאייקון כללי
5. **Cooldown mechanism** — localStorage-based, מפתח `{vehicleId}-{month}-{year}`, ניקוי אוטומטי של ישנים
