-- MP-2, 02/11/2026: since the single sign-in (22/10) the dashboard writes reminder_log as `authenticated`,
-- but that role had no table grant and no sequence usage, so every manual reminder went unlogged (error only in console).
-- Row access stays with the existing policies (hub_can_open on the fleet card).
grant select, insert on fleet.reminder_log to authenticated;
grant usage on sequence fleet.reminder_log_id_seq to authenticated;
-- same gap on inbound_messages: the anomalies page reads it as `authenticated` (SELECT policy exists, grant was missing).
grant select on fleet.inbound_messages to authenticated;
