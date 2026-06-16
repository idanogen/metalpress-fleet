# MetalPress Fleet — Handoff Document

**עודכן:** 2026-05-21 (סוף יום עבודה)

---

## 🔄 עדכון 2026-06-16 — ייצוב נתוני סנכרון פריוריטי

- **6 סתירות ידניות עומדות** יושרו לערכי פריוריטי (טיגו/קפצ'ר/צ'רי/פיקנטו/קורולה) + נסגרו בדף החריגים.
- **באג "החלטות נדבקות" תוקן** (migration `sync_divergence_sticky_decisions`): סתירה שטופלה לא נפתחת מחדש בכל סנכרון — אלא אם הערך בפריוריטי השתנה.
- **ביקורת צי מלאה:** שגיאה אמיתית אחת — יונס יאסין (86902803) מציג מאי 172,896 (היה 13,108) = טעות הקלדה בפריוריטי, צריך תיקון שם. דגל רך: טסלה עקול (31009603) מספרים שנראים placeholder.
- תיעוד מלא: `docs/sync-fixes-2026-06-16.md` | SQL: `migrations/2026-06-16_sync_divergence_sticky_decisions.sql`

---

## 🎯 הקונטקסט

מערכת ניהול צי רכב של MetalPress. הסטאק:
- **Frontend:** Vite + React + Supabase JS, פרוס ב-Vercel (https://metalpress-fleet.vercel.app)
- **DB:** Supabase project `mbodppnsdnmlejdldztp`, schema `fleet`
- **WhatsApp:** heyy.io (WhatsApp Business API רשמי) — channel "Metalpress"
- **Priority bridge:** Make.com — Priority חוסם IPs לא רשומים, אז Make משמש כ-proxy

**מצב היום:** end-to-end עובד. WhatsApp inbound + outbound, סנכרון יומי לרכבים חדשים, סנכרון חודשי מלא, monitoring, חסימת דיווחים כפולים, template מאושר ע"י Meta לכפתור הידני.

---

## ✅ זרימות פעילות

### A. דיווח נכנס מנהג (WhatsApp → Supabase + Priority)
```
נהג שולח מספר ק"מ ל-WhatsApp Metalpress
        ↓
heyy Channel Webhook → POST https://metalpress-fleet.vercel.app/api/heyy-webhook
        ↓
ה-webhook:
  • מאמת מספר תקין, > current_mileage, פער ≤ 5000
  • חוסם דיווח כפול: אם קיים monthly_report ל-(vehicle, year, month) — שולח "כבר קיבלנו"
  • שומר ל-fleet.monthly_reports + מעדכן vehicles.current_mileage
  • מעדכן heyy contact attribute "kilo"
  • שולח ל-Make 4738680 → Priority METL_CARUSAGE_SUBFORM
  • עונה לנהג ב-heyy: "תודה ✅ נרשם N ק"מ"
  • idempotent (provider_message_id ב-fleet.inbound_messages)
  • מחזיר 200 תמיד כדי שלא יהיו רטריים
```

### B. סנכרון יומי לרכבים חדשים (Make scenario 4636689, יום-יום 21:00)
```
M1: GET Priority METL_EMPLOYEECARS?$expand=METL_CARUSAGE_SUBFORM
M2: POST Supabase /rpc/get_existing_vehicle_ids → מערך [1,2,3,...]
M4: Iterator על רכבי Priority
  M5: Filter — contains(2.body; EQUIPMENT_ID)=false → רק רכבים חדשים
  M6: Supabase RPC sync_vehicle_from_priority
M7: Aggregator
M8: אם length>0 → POST /api/sync-drivers-to-heyy (עם onerror email)
M9: אם length>0 → Gmail summary "🆕 X רכבים חדשים נוספו"
```
**Ops צפויים:** ~4-9/יום (בד"כ 0 חדשים → 4 ops)

### C. סנכרון חודשי מלא (Make scenario 4646251, 1 לחודש 23:00)
```
M1: GET Priority METL_EMPLOYEECARS?$expand=METL_CARUSAGE_SUBFORM
M2: Iterator על 152 רכבים
  M3: TransformToJSON
  M4: Supabase RPC sync_vehicle_from_priority (לכל רכב)
M5: Aggregator
M6: POST /api/sync-drivers-to-heyy (עם onerror email)
M7: Gmail summary "✅ סנכרון הושלם" עם סטטיסטיקות
```
**Ops צפויים:** ~310/חודש

### D. כפתור "תזכורות לנהגים" (Make 4627015 + template)
```
Dashboard ← לחיצה "שלח" על נהג ספציפי
        ↓ webhook hook.us1.make.com/piugtkez49mveettgmenuepb2v16w7pl
Make 4627015:
  M1: webhook
  M20: TransformToJSON
       { phoneNumber, type:"TEMPLATE",
         messageTemplateId:"9224835e-e2a8-4818-b7ff-18250db2fac0",
         variables:[{name:"first_name", value:driver.name}] }
  M21: POST heyy /whatsapp_messages/send עם Bearer
        ↓
WhatsApp → נהג
```
**עובד גם לנהגים חדשים** (template מאושר ע"י Meta, לא תלוי בחלון 24h)

### E. תחילת חודש אוטומטי
**לא Make!** קמפיין ב-heyy עצמו (Settings → Campaigns) שולח את אותו template ב-1 לחודש לכל ה-contacts. heyy סוגרת הכל בעצמה.

### F. סנכרון נהגים Supabase → heyy
endpoint `api/sync-drivers-to-heyy.ts` ב-Vercel:
- POST פותח, idempotent
- קורא את כל הנהגים הפעילים מ-`fleet.vehicles`
- Dedupe לפי טלפון
- עבור כל אחד: create אם לא קיים ב-heyy, update אם מטא-דאטה שונה, skip אחרת
- retry-on-429 שמכבד את `X-RateLimit-Reset`
- מוגן רק בידי מי שיודע את ה-URL (אין secret מוגדר)
- נקרא מ-4636689 וגם מ-4646251

---

## 🟢 מצב סנריו ב-Make

### פעילים (4)
| ID | שם | תפקיד |
|---|---|---|
| 4738680 | MetalPress — Priority Write Mileage | webhook ק"מ → Priority |
| 4636689 | MetalPress — רכבים חדשים יומי | יומי 21:00 — חדשים בלבד |
| 4646251 | MetalPress — סנכרון חודשי מלא מפריורטי | חודשי 1 ב-23:00 — מלא + monitoring |
| 4627015 | תזכורת ידנית heyy (TEMPLATE) | webhook מדשבורד → heyy |

### מושבתים — מוכנים למחיקה (5)
- 4626788 — MetalPress Dashboard Webhook (ישן)
- 4626827 — MetalPress Sync Priority → Data Store (הוחלף ב-4646251)
- 4602610 — מטלפרס קבלת הודעות מווצאפ (Green API, הוחלף ב-heyy webhook)
- 4615781 — מטלפרס שליחת הודעות תחילת חודש (Green API, הוחלף בקמפיין heyy)
- 4646471 — שליחת הודעה ידנית תחילת חודש (Green, הוחלף בקמפיין heyy + הסרת הדף מהדשבורד)

---

## 💾 Database

**Project:** `mbodppnsdnmlejdldztp` (metalpress-crm, EU-Central, Postgres 17)
**Schema:** `fleet` (מבודד מ-`public.professional_*` של ה-CRM)

### טבלאות
- `fleet.drivers` (110 רשומות)
- `fleet.vehicles` (152)
- `fleet.monthly_reports` (1,085+ דיווחים)
- `fleet.reminder_log`
- `fleet.inbound_messages` (audit של webhooks מ-heyy)
- `fleet.sync_log`

### פונקציות (Public RPCs)
- `public.sync_vehicle_from_priority(p_payload jsonb)` — upsert vehicle + monthly_reports
- `public.get_existing_vehicle_ids()` — `int[]` של IDs קיימים (לסנון רכבים חדשים)
- `public.get_existing_vehicle_ids_csv()` — `text` (לא בשימוש כרגע — שאריות מ-debug)

---

## 🔌 Vercel

**Project:** `prj_ZvE5Jd7cKv0F4dNpn04K9iyt5J3D`
**URL:** https://metalpress-fleet.vercel.app

### Endpoints (קבצים ב-`api/`)
- `api/heyy-webhook.ts` — בוט WhatsApp (קריטי)
- `api/sync-drivers-to-heyy.ts` — סנכרון Supabase → heyy

### Env vars (production)
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `HEYY_API_KEY`, `HEYY_BASE_URL`, `HEYY_CHANNEL_ID`
- `MAKE_PRIORITY_WRITE_WEBHOOK`

---

## 📱 heyy.io

- **Channel:** Metalpress (id `61171b95-b182-43a9-8ad0-aac17785ac8d`)
- **Tenant:** `af9f313b-34d0-4152-b143-ca19c4dcc4cb`
- **Contacts:** ~96 פעילים, מסונכרנים אוטומטית מ-Supabase
- **Custom attributes:** `kilo`, `vehicleId`, `plateNumber`, `vehicleModel`
- **Template:** `תזכורת` (id `9224835e-e2a8-4818-b7ff-18250db2fac0`) — מאושר ע"י Meta, פעיל
- **קמפיין חודשי:** מטריגר אוטומטי ב-1 לחודש לכל ה-contacts עם ה-template הזה
- **AI Employee "Julie":** קיים אבל מנותק מהזרימה הנוכחית

---

## 📋 מה השלמנו ב-2026-05-21

1. ✅ **מעבר מ-Green API ל-heyy** לכל ההודעות היוצאות (סנריו 4627015)
2. ✅ **endpoint חדש `api/sync-drivers-to-heyy.ts`** עם retry-on-429
3. ✅ **שינוי 4646251 משבועי לחודשי** (לחיסכון ב-ops)
4. ✅ **שכתוב 4636689** מ-Data Store הישן ל-Supabase + heyy sync + monitoring
5. ✅ **Monitoring** ב-4646251 — מייל הצלחה + מייל ספציפי בכשל
6. ✅ **RPC `get_existing_vehicle_ids()`** ב-Postgres ל-filter יומי
7. ✅ **Template `תזכורת`** הוטמע בסנריו הדשבורד — עובד גם לנהגים חדשים
8. ✅ **הסרת דף "הודעה ראשונה"** מהדשבורד (כפילות עם קמפיין heyy)
9. ✅ **כיבוי 4 סנריו ישנים** (4602610, 4615781, 4626788, 4626827, 4646471)
10. ✅ **ניקוי קוד מת** — `api/priority-sync.ts`, סקריפטי Data Store, `data/professionals/`, scratch HTML
11. ✅ **תיעוד הגוצ'ה** — `supabase:makeAnApiCall` חושף את ה-response ב-`{{N.body}}` ולא ב-`{{N.data}}`

---

## 🔮 משימות פתוחות

### בעדיפות גבוהה
- **בדיקה ידנית של הכפתור הידני** — לחיצה על איריס שרביט רז (driver_id 109? אחר) מהדשבורד, לוודא ש-template מגיע
- **לעדכן HANDOFF.md** ← בדיוק זה, הסשן הזה

### בעדיפות בינונית
- **למחוק 5 סנריו מושבתים** ב-Make (היגיינה)
- **לנקות `whatsappId: @c.us`** מ-`DriverRemindersPage.tsx` (dead field, Make לא קורא אותו)
- **לכבות Make Data Store 83526** — שבוע יציבות מסתיים 28/05/2026
- **לוודא שהקמפיין ב-heyy** מצביע על template `9224835e-e2a8-4818-b7ff-18250db2fac0`

### ניקוי
- `data/` — קבצי seed מ-2026-05-18 (לא ב-git, רק בדיסק המקומי): `fleet-seed-*.sql`, `make-snapshot.json`, `reports-arr-*.json`

---

## 🔗 כתובות / IDs חשובים

| מה | איפה / מה |
|---|---|
| Production URL | https://metalpress-fleet.vercel.app |
| Webhook (inbound WhatsApp) | https://metalpress-fleet.vercel.app/api/heyy-webhook |
| Sync drivers endpoint | https://metalpress-fleet.vercel.app/api/sync-drivers-to-heyy |
| Supabase project | `mbodppnsdnmlejdldztp` |
| Vercel project | `prj_ZvE5Jd7cKv0F4dNpn04K9iyt5J3D` |
| Make team | 77940 (My Team) |
| Make folder | 310958 (MetalPress) |
| Make 4738680 — Priority Write Mileage | https://hook.us1.make.com/owt4lw57buvry3575yu6vnuk8efgqe3f |
| Make 4627015 — Dashboard manual reminder | https://hook.us1.make.com/piugtkez49mveettgmenuepb2v16w7pl |
| Make 4636689 — Daily new vehicles | cron 21:00 IL |
| Make 4646251 — Monthly full sync | cron 1st of month 23:00 IL |
| Make keychain — Priority creds | 85308 (METALPRESSAPI) |
| Make connection — Supabase | 4778142 ("metalpress DB") |
| Make connection — Gmail | 4509533 / 4660042 |
| heyy channel id | 61171b95-b182-43a9-8ad0-aac17785ac8d |
| heyy tenant id | af9f313b-34d0-4152-b143-ca19c4dcc4cb |
| heyy template id (תזכורת) | 9224835e-e2a8-4818-b7ff-18250db2fac0 |
| Priority OData base | https://prio.metalpress.co.il/odata/Priority/tabula.ini/sales |
| Test driver | driver_id 109, vehicle 130, phone 0523694547 |

---

## ⚠️ הערות חשובות / לקחים

1. **WhatsApp Template חובה לנהג מחוץ ל-24h** — Meta חוסם טקסט חופשי. הזרימה הנכנסת מהבוט (תוך 24h של דיווח) יכולה לענות חופשי. כל הודעה ראשונה לנהג שלא דיווח לאחרונה — חייבת template.
2. **Priority IP whitelist** — אסור לקרוא ישירות. תמיד דרך Make scenarios 4738680 / 4636689 / 4646251.
3. **`supabase:makeAnApiCall` חושף את ה-response ב-`{{N.body}}` ולא ב-`{{N.data}}`** — שונה מ-http:ActionSendData. גוצ'ה ששורף ~600 ops לזהות.
4. **Supabase Make module pinned ל-public schema** — לקריאת נתונים מ-`fleet.*` חייב RPC ציבורי שעוטף.
5. **זה מוצר ללקוח** — אסור לדלג על שדות בעייתיים או רכבים. הפתרון תמיד צריך לתמוך ב-100% מהנתונים.
6. **דברים שלא לעשות:**
   - לא לגעת ב-`public.professional_*` של ה-CRM
   - לא לכבות סנריואים פעילים ב-Make בלי אישור
   - לא לשנות את ה-RPC `sync_vehicle_from_priority` בלי הבנת הלוגיקה של "אל תדרוס" (current_mileage וכו')
   - אסור לשלוח טקסט חופשי לנהגים חדשים — חייב template

---

## 🔧 איך לתחזק

### אם 4636689 כושל (יומי)
1. Make execution log → איזה module
2. אם M5+ — בדוק שה-RPC `get_existing_vehicle_ids` עובד: `SELECT public.get_existing_vehicle_ids();`
3. אם M8 (HTTP heyy sync) — הוא ידידותי לכשלים, יישלח מייל

### אם 4646251 כושל (חודשי)
1. בדוק M4 (Supabase RPC) — אם 400 → בדוק ב-`fleet.sync_log` או הרץ SQL ידני:
   ```sql
   SELECT public.sync_vehicle_from_priority('{"EQUIPMENT_ID":1,"VEHICLENUMCH":"TEST",...}'::jsonb);
   ```
2. אם M6 (heyy sync) — מייל אוטומטי יישלח עם פרטים

### להוסיף שדה חדש מ-Priority
1. ודא שהשדה ב-METL_CARUSAGE_SUBFORM או ב-METL_EMPLOYEECARS
2. בעריכת M3 (TransformToJSON) של 4646251 ושל 4636689, הוסף שדה: `"NEWFIELD": "{{2.NEWFIELD}}"`
3. ערוך את RPC `sync_vehicle_from_priority` להוצאת השדה מ-`p_payload`
