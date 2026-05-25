# סנכרון חשבוניות רכב — Spec ל-Make

מסמך זה מתאר איך להוסיף לסנריו **4646251** ("MetalPress — סנכרון חודשי מלא מפריורטי") שלב נוסף שמסנכרן את **רשימת החשבוניות** מהמסך הנכד `EDPE_CARUSAGEPIVENV` ל-Supabase.

## רקע

המסך `EDPE_CARUSAGEPIVENV` (פירוט שימוש חודשי לרכב → חשבוניות הוצאות רכב - רב חברתי) מכיל **שורה לכל חשבונית** שהוקצתה לרכב — תאריך, ספק, סכום, קטגוריה, חברה.

הסנכרון הקיים מביא **סיכומים** (סכום כביש 6 לחודש, סכום פנגו לחודש וכו'). הסנכרון החדש מביא **את החשבוניות עצמן**.

## שינוי 1 — Priority OData URL

ב-HTTP module שקורא ל-Priority, להחליף את ה-URL מ:

```
https://prio.metalpress.co.il/odata/Priority/tabula.ini/sales/METL_EMPLOYEECARS?$expand=METL_CARUSAGE_SUBFORM
```

ל:

```
https://prio.metalpress.co.il/odata/Priority/tabula.ini/sales/METL_EMPLOYEECARS?$expand=METL_CARUSAGE_SUBFORM($expand=EDPE_CARUSAGEPIVENV_SUBFORM)
```

ההבדל: הוספת `($expand=EDPE_CARUSAGEPIVENV_SUBFORM)` בתוך ה-expand הקיים.

**זה לא ישבור כלום** בסנכרון הקיים — ה-payload פשוט יכלול שדה נוסף בכל רשומה חודשית.

## שינוי 2 — מודול חדש שקורא ל-RPC

אחרי המודול שקורא ל-`sync_vehicle_from_priority` (זה שכותב לרכבים ולדיווחים), להוסיף מודול **Supabase → Call RPC** או **HTTP → Make a request**:

### אופציה A — Supabase module

| שדה | ערך |
|-----|-----|
| Connection | אותו connection של Supabase |
| Schema | `public` |
| Function | `sync_vehicle_invoices` |
| Argument: `p_payload` | אותו payload שמועבר ל-`sync_vehicle_from_priority` (הרכב הנוכחי מהאיטרציה) |

### אופציה B — HTTP module ידני

```
POST https://mbodppnsdnmlejdldztp.supabase.co/rest/v1/rpc/sync_vehicle_invoices
```

**Headers:**
```
apikey: <SERVICE_ROLE_KEY>
Authorization: Bearer <SERVICE_ROLE_KEY>
Content-Type: application/json
```

**Body:**
```json
{
  "p_payload": {{1.value[].current_item}}
}
```

(או איך שמודלים את האיטרציה ב-Make — המטרה היא להעביר אובייקט רכב יחיד מתוך `value[]`)

## פורמט ה-payload

ה-RPC מצפה לאותו אובייקט רכב שמגיע מ-Priority — אין צורך להפוך או לשטח דבר:

```json
{
  "EQUIPMENT_ID": 3,
  "VEHICLENUMCH": "42372702",
  "METL_CARUSAGE_SUBFORM": [
    {
      "GLNAME": "2026",
      "MONTHNUM": 4,
      "EDPE_CARUSAGEPIVENV_SUBFORM": [
        {
          "CARUSAGEPIV": 35,
          "KLINE": 14,
          "IVNUM": "VI26000482",
          "IVDATE": "2026-04-30T00:00:00+03:00",
          "QPRICE": 93.22,
          "SUPNAME": "4204084",
          "SUPDES": "רובנוביץ ולאד",
          "DNAME": "vents",
          "CAREXPENCECODE": "16",
          "CAREXPENCEDES": "שטיפת רכבים",
          "STATDES": "סופית"
        }
      ]
    }
  ]
}
```

ה-RPC מדלג בעצמו על רשומות חודשיות בלי חשבוניות, ועל חשבוניות בלי `CARUSAGEPIV` או `KLINE`.

## Response

הRPC מחזיר:

```json
{
  "vehicle_id": 3,
  "plate_number": "42372702",
  "inserted": 2,
  "updated": 1,
  "skipped": 0
}
```

אם הרכב לא קיים ב-Supabase:

```json
{
  "vehicle_id": 999,
  "skipped_reason": "vehicle_not_found",
  "inserted": 0, "updated": 0, "skipped": 0
}
```

## Idempotency

ה-RPC מבוסס על UNIQUE constraint `(carusagepiv, kline)` — הריצה השנייה תעדכן את אותן שורות בלי לכפול.

## טבלת היעד

`fleet.vehicle_invoices` — כבר נוצרה ב-Supabase, כולל RLS למקרא ב-anon/authenticated. ה-RPC רץ עם `SECURITY DEFINER` אז אין צורך ב-RLS לכתיבה.

## בדיקה ידנית מ-curl

```bash
curl -X POST "https://mbodppnsdnmlejdldztp.supabase.co/rest/v1/rpc/sync_vehicle_invoices" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_payload": { "EQUIPMENT_ID": 3, "VEHICLENUMCH": "42372702", "METL_CARUSAGE_SUBFORM": [] }}'
```

## נראות בדשבורד

החשבוניות מופיעות אוטומטית בדף **הוצאות צי** → drawer של רכב → תחת "טבלת חודשים מפורטת" → סקשן חדש **"חשבוניות הוצאות רכב"** עם:
- תאריך, קטגוריה (צבועה), ספק, חברה, מס׳ חשבונית, סכום
- פילטר חודש
- סה״כ סכום בכותרת
