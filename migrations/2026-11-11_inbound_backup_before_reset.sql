-- 11/11/2026: איפוס עמוד הדיווחים החריגים לבקשת מעיין (מייל 04/11) וסגירת שמונה
-- כתיבות לפריוריטי שנכשלו (יולי עד אוקטובר) ולא יישלחו שוב. הוחל ישירות בפרודקשן.
-- 19 השורות המקוריות שמורות בטבלת הגיבוי, לשחזור: update לפי id מתוך הגיבוי.
create table if not exists fleet._inbound_backup_20261111 as
  select * from fleet.inbound_messages where status in ('pending_review','priority_failed');
alter table fleet._inbound_backup_20261111 enable row level security;

update fleet.inbound_messages
  set status = 'dismissed', processed_at = now(),
      error = coalesce(error,'') || ' | נסגר 11/11: איפוס עמוד החריגים לבקשת מעיין (מייל 04/11), בלי הודעה לנהג.'
  where status = 'pending_review';

update fleet.inbound_messages
  set status = 'dismissed', processed_at = now(),
      error = coalesce(error,'') || ' | נסגר 11/11: כתיבה לפריוריטי שנכשלה ולא תישלח שוב, הק"מ להשלמה ידנית בפריוריטי (הכרעת עידן).'
  where status = 'priority_failed';
