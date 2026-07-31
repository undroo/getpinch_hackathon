-- RetainIQ+ seed data (~100 members, 90 days check-in history)
-- Replace pinch_payer_id placeholders with real Pinch sandbox payer IDs before live demo.

INSERT INTO gym_config (gym_name, standard_plan_id, hold_plan_id, loyalty_plan_id, winback_amount_cents)
VALUES (
  'GymPlus',
  'REPLACE_STANDARD_PLAN_ID',
  'REPLACE_HOLD_PLAN_ID',
  'REPLACE_LOYALTY_PLAN_ID',
  4900
);

INSERT INTO retention_offers (slug, name, description, offer_type, pinch_plan_id, amount_cents, target_tier) VALUES
  (
    'hold_plan',
    'Hold / Pause',
    'Reduce membership to $10/mo while the member pauses — keeps them from cancelling.',
    'plan_switch',
    'REPLACE_HOLD_PLAN_ID',
    NULL,
    'critical'
  ),
  (
    'winback_link',
    'Win-back',
    'One-click hosted payment link for a discounted comeback month ($49).',
    'payment_link',
    NULL,
    4900,
    'slipping'
  ),
  (
    'loyalty_plan',
    'Loyalty Discount',
    'Switch to a loyalty plan with 40% off for highly engaged members.',
    'plan_switch',
    'REPLACE_LOYALTY_PLAN_ID',
    NULL,
    'healthy'
  );

-- Demo personas (pinch_payer_id = REPLACE_* for sandbox setup)
INSERT INTO members (id, name, email, phone, pinch_payer_id, membership_plan, status, joined_at) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Sarah Chen', 'sarah.chen@example.com', '+61400101001', 'REPLACE_PAYER_SARAH', 'standard', 'active', now() - interval '180 days'),
  ('11111111-1111-1111-1111-111111111102', 'Marcus Webb', 'marcus.webb@example.com', '+61400101002', 'REPLACE_PAYER_MARCUS', 'standard', 'active', now() - interval '120 days'),
  ('11111111-1111-1111-1111-111111111103', 'Jamie Torres', 'jamie.torres@example.com', '+61400101003', 'REPLACE_PAYER_JAMIE', 'standard', 'active', now() - interval '200 days');

DO $$
DECLARE
  i INT;
  member_uuid UUID;
  tier_roll INT;
  joined TIMESTAMPTZ;
  last_visit_offset INT;
  visit_day INT;
  checkin_time TIMESTAMPTZ;
  hour_of_day INT;
  minute_of_hour INT;
  day_date DATE;
  roll INT;
  should_visit BOOLEAN;
  -- Evening heavily weighted to 19 (7pm) so peak-hours headline lands there.
  peak_hours INT[] := ARRAY[7, 8, 9, 17, 18, 19, 19, 19, 19, 20];
  off_peak_hours INT[] := ARRAY[11, 12, 13, 14, 15, 16];
  first_names TEXT[] := ARRAY['Alex','Jordan','Taylor','Casey','Riley','Morgan','Quinn','Avery','Blake','Cameron','Drew','Elliot','Finley','Gray','Harper','Indigo','Jesse','Kai','Logan','Micah','Noah','Oakley','Parker','Reese','Sage','Tatum','Uma','Vale','Winter','Xander','Yael','Zion'];
  last_names TEXT[] := ARRAY['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Lee','Walker','Hall','Allen','Young','King','Wright','Scott','Green','Baker'];
BEGIN
  FOR i IN 4..100 LOOP
    member_uuid := gen_random_uuid();
    tier_roll := (i % 20);
    joined := now() - (interval '1 day' * (60 + (i % 300)));

    IF tier_roll <= 11 THEN
      last_visit_offset := 1 + (i % 10);
    ELSIF tier_roll <= 16 THEN
      last_visit_offset := 14 + (i % 7);
    ELSIF tier_roll <= 19 THEN
      last_visit_offset := 21 + (i % 14);
    ELSE
      last_visit_offset := NULL;
    END IF;

    INSERT INTO members (id, name, email, phone, pinch_payer_id, membership_plan, status, joined_at)
    VALUES (
      member_uuid,
      first_names[1 + (i % array_length(first_names, 1))] || ' ' || last_names[1 + (i % array_length(last_names, 1))],
      'member' || i || '@demo.retainplus.app',
      '+61400' || lpad(i::text, 6, '0'),
      CASE WHEN i <= 14 THEN 'REPLACE_PAYER_' || i ELSE NULL END,
      'standard',
      'active',
      joined
    );

    IF tier_roll = 20 THEN
      CONTINUE;
    END IF;

    IF last_visit_offset IS NULL THEN
      CONTINUE;
    END IF;

    IF tier_roll <= 11 THEN
      -- Weekday/weekend cadence so ADU chart varies; yesterday stays non-zero.
      FOR visit_day IN 0..29 LOOP
        day_date := (now() AT TIME ZONE 'UTC')::date - visit_day;
        roll := (i * 17 + visit_day) % 10;
        -- Match Python _healthy_visits_on_day
        IF visit_day = 1 AND i % 10 < 8 THEN
          should_visit := TRUE;
        ELSIF EXTRACT(ISODOW FROM day_date) >= 6 THEN
          should_visit := roll < 4;
        ELSE
          should_visit := roll < 7;
        END IF;
        IF NOT should_visit THEN
          CONTINUE;
        END IF;
        IF (i + visit_day) % 10 < 7 THEN
          hour_of_day := peak_hours[1 + ((i + visit_day) % array_length(peak_hours, 1))];
        ELSE
          hour_of_day := off_peak_hours[1 + ((i + visit_day) % array_length(off_peak_hours, 1))];
        END IF;
        minute_of_hour := (i * 7 + visit_day * 3) % 60;
        checkin_time := (day_date + make_time(hour_of_day, minute_of_hour, 0)) AT TIME ZONE 'UTC';
        IF checkin_time > joined THEN
          INSERT INTO check_ins (member_id, checked_in_at, source) VALUES (member_uuid, checkin_time, 'mock');
        END IF;
      END LOOP;
      -- Sparse history to ~180d so 6-month avg is lower than recent 30d.
      FOR visit_day IN 30..179 BY 3 LOOP
        day_date := (now() AT TIME ZONE 'UTC')::date - visit_day;
        roll := (i * 17 + visit_day) % 10;
        IF EXTRACT(ISODOW FROM day_date) >= 6 THEN
          should_visit := roll < 4;
        ELSE
          should_visit := roll < 7;
        END IF;
        IF NOT should_visit THEN
          CONTINUE;
        END IF;
        IF (i + visit_day) % 10 < 7 THEN
          hour_of_day := peak_hours[1 + ((i + visit_day) % array_length(peak_hours, 1))];
        ELSE
          hour_of_day := off_peak_hours[1 + ((i + visit_day) % array_length(off_peak_hours, 1))];
        END IF;
        minute_of_hour := (i * 7 + visit_day * 3) % 60;
        checkin_time := (day_date + make_time(hour_of_day, minute_of_hour, 0)) AT TIME ZONE 'UTC';
        IF checkin_time > joined THEN
          INSERT INTO check_ins (member_id, checked_in_at, source) VALUES (member_uuid, checkin_time, 'mock');
        END IF;
      END LOOP;
    ELSE
      day_date := (now() AT TIME ZONE 'UTC')::date - last_visit_offset;
      IF (i + last_visit_offset) % 10 < 7 THEN
        hour_of_day := peak_hours[1 + ((i + last_visit_offset) % array_length(peak_hours, 1))];
      ELSE
        hour_of_day := off_peak_hours[1 + ((i + last_visit_offset) % array_length(off_peak_hours, 1))];
      END IF;
      minute_of_hour := (i * 7 + last_visit_offset * 3) % 60;
      checkin_time := (day_date + make_time(hour_of_day, minute_of_hour, 0)) AT TIME ZONE 'UTC';
      INSERT INTO check_ins (member_id, checked_in_at, source) VALUES (member_uuid, checkin_time, 'mock');

      FOR visit_day IN 30..80 BY 7 LOOP
        day_date := (now() AT TIME ZONE 'UTC')::date - (last_visit_offset + visit_day);
        IF (i + last_visit_offset + visit_day) % 10 < 7 THEN
          hour_of_day := peak_hours[1 + ((i + last_visit_offset + visit_day) % array_length(peak_hours, 1))];
        ELSE
          hour_of_day := off_peak_hours[1 + ((i + last_visit_offset + visit_day) % array_length(off_peak_hours, 1))];
        END IF;
        minute_of_hour := (i * 7 + (last_visit_offset + visit_day) * 3) % 60;
        checkin_time := (day_date + make_time(hour_of_day, minute_of_hour, 0)) AT TIME ZONE 'UTC';
        IF checkin_time > joined THEN
          INSERT INTO check_ins (member_id, checked_in_at, source) VALUES (member_uuid, checkin_time, 'mock');
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- Sarah Chen: Critical — 24 days inactive, was active in May/June
INSERT INTO check_ins (member_id, checked_in_at, source)
SELECT
  '11111111-1111-1111-1111-111111111101',
  (((now() AT TIME ZONE 'UTC')::date - n) + time '19:15') AT TIME ZONE 'UTC',
  'mock'
FROM generate_series(55, 75, 2) AS n;

INSERT INTO check_ins (member_id, checked_in_at, source)
VALUES (
  '11111111-1111-1111-1111-111111111101',
  (((now() AT TIME ZONE 'UTC')::date - 24) + time '18:30') AT TIME ZONE 'UTC',
  'mock'
);

-- Marcus Webb: Slipping — 16 days inactive
INSERT INTO check_ins (member_id, checked_in_at, source)
SELECT
  '11111111-1111-1111-1111-111111111102',
  (((now() AT TIME ZONE 'UTC')::date - n) + time '17:45') AT TIME ZONE 'UTC',
  'mock'
FROM generate_series(30, 60, 5) AS n;

INSERT INTO check_ins (member_id, checked_in_at, source)
VALUES (
  '11111111-1111-1111-1111-111111111102',
  (((now() AT TIME ZONE 'UTC')::date - 16) + time '08:10') AT TIME ZONE 'UTC',
  'mock'
);

-- Jamie Torres: Healthy — daily last 30d, then every 2 days to ~60d
INSERT INTO check_ins (member_id, checked_in_at, source)
SELECT
  '11111111-1111-1111-1111-111111111103',
  (((now() AT TIME ZONE 'UTC')::date - n) + time '08:00') AT TIME ZONE 'UTC',
  'mock'
FROM generate_series(0, 29, 1) AS n;

INSERT INTO check_ins (member_id, checked_in_at, source)
SELECT
  '11111111-1111-1111-1111-111111111103',
  (((now() AT TIME ZONE 'UTC')::date - n) + time '08:00') AT TIME ZONE 'UTC',
  'mock'
FROM generate_series(30, 60, 2) AS n;
