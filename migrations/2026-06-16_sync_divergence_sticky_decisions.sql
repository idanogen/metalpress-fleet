-- ============================================================================
-- Migration: sync_divergence_sticky_decisions
-- Date:      2026-06-16
-- Project:   Supabase mbodppnsdnmlejdldztp (schema: fleet)
-- ----------------------------------------------------------------------------
-- מטרה: החלטת מנהלת על סתירה מול פריוריטי "נדבקת" — הסנכרון השבועי לא פותח
-- מחדש סתירה שכבר טופלה, אלא אם הערך בפריוריטי השתנה מאז ההחלטה.
--
-- הבאג: התנאי שמנע פתיחת סתירה כפולה בדק רק status='pending_review', אז ברגע
-- שהפריט טופל (approved/rejected/dismissed) — בסנכרון הבא נפתח פריט חדש זהה.
-- הוכחה: inbound_messages ids 175–180 ו-185–190 = אותן 6 סתירות, priority_mileage זהה.
--
-- התיקון: התנאי בודק גם פריט priority_sync קודם (בכל סטטוס) שה-priority_mileage
-- שלו זהה לערך הפריוריטי הנוכחי — ואז שותק. נפתח שוב רק כשהערך בפריוריטי שונה.
--
-- ראה: docs/sync-fixes-2026-06-16.md
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_vehicle_from_priority(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_id bigint;
  v_phone_raw text;
  v_phone text;
  v_driver_id bigint;
  v_existing_id bigint;
  v_sname text;
  v_is_deactivated boolean;
  v_drivers_inserted int := 0;
  v_vehicle_inserted boolean := false;
  v_vehicle_updated boolean := false;
  v_reports_inserted int := 0;
  v_reports_updated int := 0;
  v_reports_skipped int := 0;
  v_divergences_flagged int := 0;
  v_report jsonb;
  v_year smallint;
  v_month smallint;
  v_mileage int;
  v_was_insert boolean;
  v_road6 numeric;
  v_road6n numeric;
  v_pango numeric;
  v_carmel numeric;
  v_reports numeric;
  v_maintenance numeric;
  v_insurance numeric;
  v_license numeric;
  v_ituran numeric;
  v_carwash numeric;
  v_tires numeric;
  v_rental numeric;
  v_electric numeric;
  v_fuel_consumption numeric;
  v_fuel_cost numeric;
  v_has_any_cost boolean;
  v_parent_mileage int := 0;
  v_max_sub_mileage int := 0;
  v_last_y smallint;
  v_last_m smallint;
  v_existing_mileage numeric;
  v_existing_source text;
  v_flag_error text;
BEGIN
  v_id := (p_payload->>'EQUIPMENT_ID')::bigint;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'EQUIPMENT_ID is required';
  END IF;

  v_sname := trim(coalesce(p_payload->>'SNAME', ''));

  v_phone_raw := regexp_replace(coalesce(p_payload->>'EDPE_CELLPHONE', ''), '[^0-9]', '', 'g');
  v_phone := CASE
    WHEN v_phone_raw ~ '^972[0-9]{9}$' THEN '0' || substr(v_phone_raw, 4)
    WHEN v_phone_raw ~ '^0[0-9]{9}$'   THEN v_phone_raw
    ELSE NULL
  END;

  -- מושבת = הרכב יצא משימוש. ריק = לא משויך כרגע (גם הוא מושבת בפועל).
  v_is_deactivated := (v_sname = 'מושבת') OR (v_sname = '');

  -- נהג עם שם בפריורטי, גם אם בלי טלפון, הוא נהג אמיתי (טלילה / יצוא / וכו').
  IF NOT v_is_deactivated THEN
    IF v_phone IS NOT NULL THEN
      INSERT INTO fleet.drivers (name, phone)
      VALUES (v_sname, v_phone)
      ON CONFLICT (phone) DO NOTHING;
      GET DIAGNOSTICS v_drivers_inserted = ROW_COUNT;
      SELECT id INTO v_driver_id FROM fleet.drivers WHERE phone = v_phone;
    ELSE
      SELECT id INTO v_driver_id FROM fleet.drivers
      WHERE name = v_sname AND phone IS NULL
      LIMIT 1;
      IF v_driver_id IS NULL THEN
        INSERT INTO fleet.drivers (name, phone) VALUES (v_sname, NULL)
        RETURNING id INTO v_driver_id;
        v_drivers_inserted := 1;
      END IF;
    END IF;
  END IF;

  -- Mileage truth from this payload: the vehicle-card field (parent) plus the
  -- highest/most-recent monthly reading. Parent *should* equal the latest subform
  -- reading, but we take both in case the parent field lags.
  v_parent_mileage := coalesce(round(nullif(p_payload->>'MILEAGE', '')::numeric)::int, 0);
  IF jsonb_typeof(p_payload->'METL_CARUSAGE_SUBFORM') = 'array' THEN
    SELECT coalesce(max(round(nullif(r->>'MILEAGE', '')::numeric)::int), 0)
    INTO v_max_sub_mileage
    FROM jsonb_array_elements(p_payload->'METL_CARUSAGE_SUBFORM') r;

    SELECT (r->>'GLNAME')::smallint, (r->>'MONTHNUM')::smallint
    INTO v_last_y, v_last_m
    FROM jsonb_array_elements(p_payload->'METL_CARUSAGE_SUBFORM') r
    WHERE coalesce(round(nullif(r->>'MILEAGE', '')::numeric)::int, 0) > 0
      AND nullif(r->>'GLNAME', '') IS NOT NULL
      AND nullif(r->>'MONTHNUM', '') IS NOT NULL
    ORDER BY (r->>'GLNAME')::int * 100 + (r->>'MONTHNUM')::int DESC
    LIMIT 1;
  END IF;

  SELECT id INTO v_existing_id FROM fleet.vehicles WHERE id = v_id;

  IF v_existing_id IS NULL THEN
    INSERT INTO fleet.vehicles (
      id, plate_number, model, ownership_type, supplier, company,
      start_date, end_date, lease_end_date, license_end_date,
      rent_value, current_mileage, last_report_year, last_report_month,
      current_driver_id, is_active, last_synced_at
    ) VALUES (
      v_id,
      nullif(p_payload->>'VEHICLENUMCH', ''),
      nullif(p_payload->>'MODEL', ''),
      nullif(p_payload->>'OWNERSHIPTYPE', ''),
      nullif(p_payload->>'SUPPLIER', ''),
      nullif(p_payload->>'DNAMETITLE', ''),
      substring(p_payload->>'STARTDATE' from 1 for 10)::date,
      substring(p_payload->>'ENDDATE' from 1 for 10)::date,
      substring(p_payload->>'RENTENDDATE' from 1 for 10)::date,
      substring(p_payload->>'LICENSEENDDATE' from 1 for 10)::date,
      coalesce(nullif(p_payload->>'RENTVALUE', '')::numeric, 0),
      GREATEST(v_parent_mileage, v_max_sub_mileage),
      v_last_y,
      v_last_m,
      v_driver_id,
      NOT v_is_deactivated,
      now()
    );
    v_vehicle_inserted := true;
  ELSE
    UPDATE fleet.vehicles SET
      plate_number = nullif(p_payload->>'VEHICLENUMCH', ''),
      model = nullif(p_payload->>'MODEL', ''),
      ownership_type = nullif(p_payload->>'OWNERSHIPTYPE', ''),
      supplier = nullif(p_payload->>'SUPPLIER', ''),
      company = nullif(p_payload->>'DNAMETITLE', ''),
      start_date = substring(p_payload->>'STARTDATE' from 1 for 10)::date,
      end_date = substring(p_payload->>'ENDDATE' from 1 for 10)::date,
      lease_end_date = substring(p_payload->>'RENTENDDATE' from 1 for 10)::date,
      license_end_date = substring(p_payload->>'LICENSEENDDATE' from 1 for 10)::date,
      rent_value = coalesce(nullif(p_payload->>'RENTVALUE', '')::numeric, rent_value),
      -- Never lower the odometer: a bot report ahead of Priority survives the sync.
      current_mileage = GREATEST(coalesce(current_mileage, 0), v_parent_mileage, v_max_sub_mileage),
      last_report_year = CASE
        WHEN v_last_y IS NOT NULL
         AND (coalesce(last_report_year, 0) * 100 + coalesce(last_report_month, 0)) < (v_last_y * 100 + v_last_m)
        THEN v_last_y ELSE last_report_year END,
      last_report_month = CASE
        WHEN v_last_y IS NOT NULL
         AND (coalesce(last_report_year, 0) * 100 + coalesce(last_report_month, 0)) < (v_last_y * 100 + v_last_m)
        THEN v_last_m ELSE last_report_month END,
      current_driver_id = CASE
        WHEN v_is_deactivated THEN NULL
        ELSE coalesce(v_driver_id, current_driver_id)
      END,
      is_active = NOT v_is_deactivated,
      last_synced_at = now()
    WHERE id = v_id;
    v_vehicle_updated := true;
  END IF;

  IF jsonb_typeof(p_payload->'METL_CARUSAGE_SUBFORM') = 'array' THEN
    FOR v_report IN SELECT * FROM jsonb_array_elements(p_payload->'METL_CARUSAGE_SUBFORM')
    LOOP
      v_year := nullif(v_report->>'GLNAME', '')::smallint;
      v_month := nullif(v_report->>'MONTHNUM', '')::smallint;
      v_mileage := round(nullif(v_report->>'MILEAGE', '')::numeric)::int;

      -- Parse all cost fields once
      v_road6 := nullif(v_report->>'EDPE_ROAD6PRICE', '')::numeric;
      v_road6n := nullif(v_report->>'EDPE_ROAD6NORTHPRICE', '')::numeric;
      v_pango := nullif(v_report->>'EDPE_PANGOPRICE', '')::numeric;
      v_carmel := nullif(v_report->>'EDPE_CARMELPRICE', '')::numeric;
      v_reports := nullif(v_report->>'EDPE_REPORTSPRICE', '')::numeric;
      v_maintenance := nullif(v_report->>'EDPE_MAINTENANCEPRICE', '')::numeric;
      v_insurance := nullif(v_report->>'EDPE_INSURANCEPRICE', '')::numeric;
      v_license := nullif(v_report->>'EDPE_LICENSEPRICE', '')::numeric;
      v_ituran := nullif(v_report->>'EDPE_ITURANPRICE', '')::numeric;
      v_carwash := nullif(v_report->>'EDPE_CARWASHPRICE', '')::numeric;
      v_tires := nullif(v_report->>'EDPE_TIRESPRICE', '')::numeric;
      v_rental := nullif(v_report->>'EDPE_RENTALPRICE', '')::numeric;
      v_electric := nullif(v_report->>'EDPE_ELECTRPRICE', '')::numeric;
      v_fuel_consumption := nullif(v_report->>'FUELCONSUMPTION', '')::numeric;
      v_fuel_cost := nullif(v_report->>'FUELCOST', '')::numeric;

      -- Check if any cost field has a positive value (for overhead accounts that have no mileage)
      v_has_any_cost := coalesce(v_road6, 0) > 0 OR coalesce(v_road6n, 0) > 0
                    OR coalesce(v_pango, 0) > 0 OR coalesce(v_carmel, 0) > 0
                    OR coalesce(v_reports, 0) > 0 OR coalesce(v_maintenance, 0) > 0
                    OR coalesce(v_insurance, 0) > 0 OR coalesce(v_license, 0) > 0
                    OR coalesce(v_ituran, 0) > 0 OR coalesce(v_carwash, 0) > 0
                    OR coalesce(v_tires, 0) > 0 OR coalesce(v_rental, 0) > 0
                    OR coalesce(v_electric, 0) > 0 OR coalesce(v_fuel_cost, 0) > 0;

      -- Skip rows without year/month, or without ANY data (mileage > 0 OR any cost)
      CONTINUE WHEN v_year IS NULL OR v_month IS NULL;
      CONTINUE WHEN coalesce(v_mileage, 0) <= 0 AND NOT v_has_any_cost;

      INSERT INTO fleet.monthly_reports (
        vehicle_id, driver_id, report_year, report_month, mileage,
        start_date, end_date, days, fuel_consumption, fuel_cost,
        road6_cost, road6_north_cost, pango_cost, carmel_cost, reports_cost,
        maintenance_cost, insurance_cost, license_cost, ituran_cost,
        carwash_cost, tires_cost, rental_cost, electric_cost,
        source, reported_at
      ) VALUES (
        v_id, v_driver_id, v_year, v_month, coalesce(v_mileage, 0),
        substring(v_report->>'SDATE' from 1 for 10)::date,
        substring(v_report->>'EDATE' from 1 for 10)::date,
        round(nullif(v_report->>'DAYS', '')::numeric)::smallint,
        v_fuel_consumption, v_fuel_cost,
        v_road6, v_road6n, v_pango, v_carmel, v_reports,
        v_maintenance, v_insurance, v_license, v_ituran,
        v_carwash, v_tires, v_rental, v_electric,
        'priority', now()
      )
      ON CONFLICT (vehicle_id, report_year, report_month) DO UPDATE SET
        -- Priority is the source of record for its own rows — but an empty/zero km
        -- in Priority must never wipe a real reading that already exists here.
        mileage = CASE WHEN EXCLUDED.mileage > 0
                       THEN EXCLUDED.mileage
                       ELSE fleet.monthly_reports.mileage END,
        road6_cost = EXCLUDED.road6_cost,
        road6_north_cost = EXCLUDED.road6_north_cost,
        pango_cost = EXCLUDED.pango_cost,
        carmel_cost = EXCLUDED.carmel_cost,
        reports_cost = EXCLUDED.reports_cost,
        maintenance_cost = EXCLUDED.maintenance_cost,
        insurance_cost = EXCLUDED.insurance_cost,
        license_cost = EXCLUDED.license_cost,
        ituran_cost = EXCLUDED.ituran_cost,
        carwash_cost = EXCLUDED.carwash_cost,
        tires_cost = EXCLUDED.tires_cost,
        rental_cost = EXCLUDED.rental_cost,
        electric_cost = EXCLUDED.electric_cost,
        fuel_consumption = COALESCE(EXCLUDED.fuel_consumption, fleet.monthly_reports.fuel_consumption),
        fuel_cost = COALESCE(EXCLUDED.fuel_cost, fleet.monthly_reports.fuel_cost),
        days = COALESCE(EXCLUDED.days, fleet.monthly_reports.days)
      WHERE fleet.monthly_reports.source = 'priority'
      RETURNING (xmax = 0) INTO v_was_insert;

      IF FOUND THEN
        IF v_was_insert THEN
          v_reports_inserted := v_reports_inserted + 1;
        ELSE
          v_reports_updated := v_reports_updated + 1;
        END IF;
      ELSE
        -- Conflict hit a protected row (source = bot/manual). Never overwrite it —
        -- but surface disagreements with Priority to the anomalies page instead of
        -- failing silently. Two cases:
        --   1. Priority has a DIFFERENT positive km → divergence, manager decides.
        --   2. Priority has NO km for this month → our report never landed there
        --      (lost write-back). Approving the item re-pushes it to Priority.
        v_reports_skipped := v_reports_skipped + 1;

        SELECT mileage, source INTO v_existing_mileage, v_existing_source
        FROM fleet.monthly_reports
        WHERE vehicle_id = v_id AND report_year = v_year AND report_month = v_month;

        v_flag_error := NULL;
        IF coalesce(v_existing_mileage, 0) > 0 AND v_driver_id IS NOT NULL THEN
          IF coalesce(v_mileage, 0) > 0 AND round(v_existing_mileage)::int <> v_mileage THEN
            v_flag_error := format('סתירה מול פריוריטי לחודש %s/%s: בדשבורד %s ק"מ (מקור: %s), בפריוריטי %s ק"מ. נא לברר מול הנהג איזה ערך נכון. אישור = הערך בדשבורד נשמר ונדחף לפריוריטי. אם הערך בפריוריטי הוא הנכון — נדרש תיקון ידני.',
              v_month, v_year,
              to_char(round(v_existing_mileage), 'FM999,999,999'),
              v_existing_source,
              to_char(v_mileage::numeric, 'FM999,999,999'));
          ELSIF coalesce(v_mileage, 0) = 0 THEN
            v_flag_error := format('דיווח שלא נקלט בפריוריטי לחודש %s/%s: בדשבורד %s ק"מ (מקור: %s), אך בפריוריטי אין קריאת ק"מ לחודש זה. כנראה הכתיבה לפריוריטי נכשלה. אישור = הקריאה תידחף לפריוריטי מחדש.',
              v_month, v_year,
              to_char(round(v_existing_mileage), 'FM999,999,999'),
              v_existing_source);
          END IF;
        END IF;

        -- החלטה של המנהלת "נדבקת": לא פותחים מחדש סתירה שכבר טופלה, אלא אם
        -- הערך בפריוריטי השתנה מאז ההחלטה. raw_payload->>'priority_mileage' שומר
        -- את ערך הפריוריטי שעליו הוחלט; כל עוד הוא זהה לערך הנוכחי — שקט.
        IF v_flag_error IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM fleet.inbound_messages
             WHERE matched_vehicle_id = v_id
               AND parsed_year = v_year
               AND parsed_month = v_month
               AND provider = 'priority_sync'
               AND (
                 status = 'pending_review'
                 OR coalesce((raw_payload->>'priority_mileage')::int, -1) = coalesce(v_mileage, 0)
               )
           )
        THEN
          INSERT INTO fleet.inbound_messages (
            provider, phone, parsed_mileage, parsed_year, parsed_month,
            matched_vehicle_id, matched_driver_id, status, error, raw_payload
          )
          SELECT
            'priority_sync',
            d.phone,
            round(v_existing_mileage)::int,
            v_year,
            v_month,
            v_id,
            v_driver_id,
            'pending_review',
            v_flag_error,
            jsonb_build_object(
              'kind', 'priority_divergence',
              'dashboard_mileage', round(v_existing_mileage)::int,
              'dashboard_source', v_existing_source,
              'priority_mileage', coalesce(v_mileage, 0)
            )
          FROM fleet.drivers d
          WHERE d.id = v_driver_id;

          v_divergences_flagged := v_divergences_flagged + 1;
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'vehicle_id', v_id,
    'driver_inserted', v_drivers_inserted > 0,
    'vehicle_inserted', v_vehicle_inserted,
    'vehicle_updated', v_vehicle_updated,
    'is_deactivated', v_is_deactivated,
    'reports_inserted', v_reports_inserted,
    'reports_updated', v_reports_updated,
    'reports_skipped', v_reports_skipped,
    'divergences_flagged', v_divergences_flagged
  );
END;
$function$;


-- ============================================================================
-- יישורי דאטה חד-פעמיים שבוצעו 2026-06-16 (לתיעוד — כבר הורצו)
-- 6 סתירות ידניות עומדות יושרו לערכי פריוריטי + סומנו source='priority'
-- + הפריטים בדף החריגים נסגרו (status='dismissed').
-- ----------------------------------------------------------------------------
-- update fleet.monthly_reports set mileage = 37900, source = 'priority' where id = 14339; -- טיגו 59858703 4/2026
-- update fleet.monthly_reports set mileage = 1627,  source = 'priority' where id = 17756; -- קפצ'ר 46856704 4/2026
-- update fleet.monthly_reports set mileage = 2420,  source = 'priority' where id = 9780;  -- צ'רי 64015204 5/2026
-- update fleet.monthly_reports set mileage = 29240, source = 'priority' where id = 19711; -- פיקנטו 68893003 5/2026
-- update fleet.monthly_reports set mileage = 20219, source = 'priority' where id = 19728; -- קורולה 21038504 5/2026
-- update fleet.monthly_reports set mileage = 20000, source = 'priority' where id = 19725; -- קורולה 21038504 4/2026
-- update fleet.vehicles set current_mileage = 29240, last_report_year = 2026, last_report_month = 5 where id = 88; -- פיקנטו
-- update fleet.vehicles set current_mileage = 20219, last_report_year = 2026, last_report_month = 5 where id = 92; -- קורולה
-- update fleet.inbound_messages set status = 'dismissed', processed_at = received_at
--   where provider = 'priority_sync' and status = 'pending_review' and received_at >= '2026-06-15'
--     and matched_vehicle_id in (16, 96, 151, 88, 92);
-- ============================================================================
