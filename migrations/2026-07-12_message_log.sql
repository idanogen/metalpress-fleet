-- fleet.message_log — יומן הודעות היוצאות לנהגים, פר-נהג פר-חודש.
--
-- הרקע: עד היום ההודעה החודשית נשלחה דרך broadcast חוזר ב-heyy, שהוא קופסה
-- שחורה: ב-1/7/2026 הוא שלח ל-26 מתוך 102 נהגים בלבד, ולאף אחד לא הגיעה הודעה
-- בפועל (whatsappMessageId ריק, כולם isSubscribed=false), בלי שנדע. הטבלה הזו
-- מחליפה את הקופסה השחורה ביומן מפורש: השרת שולח לכל נהג ורושם כאן מה קרה.
--
-- kind:
--   month_open — ההודעה בתחילת החודש (cron ב-1 לחודש)
--   reminder   — תזכורת אמצע-חודש רק לנהגים שעדיין לא דיווחו (cron ב-15 לחודש)
--   manual     — תזכורת ידנית מהדשבורד (שמור לעתיד; היום עובר דרך Make)
--
-- year/month = חודש הדיווח (החודש הקודם, 1-based) — זהה ל-monthly_reports,
-- כדי שאפשר להצליב "למי נשלח" מול "מי דיווח".
--
-- send_status  — התוצאה המיידית מקריאת ה-API של heyy:
--   pending  — נוצרה שורה, טרם נשלח
--   accepted — heyy קיבל את הבקשה (200; אצל תבנית זה מגיע כ-PENDING, זה תקין)
--   failed   — heyy דחה או שגיאת רשת (הסיבה ב-error)
-- delivery_status — נמסר בפועל, מגיע אסינכרונית מאישור מסירה של heyy/Meta:
--   sent | delivered | read | failed | undelivered
create table if not exists fleet.message_log (
  id               bigint generated always as identity primary key,
  kind             text        not null check (kind in ('month_open','reminder','manual')),
  report_year      int         not null,
  report_month     int         not null check (report_month between 1 and 12),
  driver_id        bigint      references fleet.drivers(id) on delete set null,
  vehicle_id       bigint      references fleet.vehicles(id) on delete set null,
  driver_name      text,
  phone            text,                       -- E.164 (+9725...)
  template_id      text,
  send_status      text        not null default 'pending'
                     check (send_status in ('pending','accepted','failed')),
  heyy_message_id  text,                        -- data.id / waMessageId מ-heyy
  delivery_status  text        check (delivery_status in
                     ('sent','delivered','read','failed','undelivered')),
  delivery_error   text,
  error            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- מפתח ייחודי: נהג אחד, חודש דיווח אחד, סוג הודעה אחד → שורה אחת.
-- מאפשר לקרון לרוץ שוב בבטחה (upsert) בלי לשלוח פעמיים.
create unique index if not exists message_log_unique_touch
  on fleet.message_log (report_year, report_month, driver_id, kind);

-- חיפוש מהיר לפי מזהה הודעת heyy כשמגיע אישור מסירה.
create index if not exists message_log_heyy_message_id_idx
  on fleet.message_log (heyy_message_id)
  where heyy_message_id is not null;

-- שליפה לפי תקופת דיווח לדשבורד.
create index if not exists message_log_period_idx
  on fleet.message_log (report_year, report_month);

-- הרשאות — זהה לשאר טבלאות ה-schema (הדשבורד קורא ב-anon).
grant select on fleet.message_log to anon, authenticated;
grant all on fleet.message_log to service_role;
alter table fleet.message_log enable row level security;
drop policy if exists "read message_log" on fleet.message_log;
create policy "read message_log" on fleet.message_log for select using (true);
