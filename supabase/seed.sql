-- RetainIQ+ seed data (~100 members, 90 days check-in history)
-- Replace pinch_payer_id placeholders with real Pinch sandbox payer IDs before live demo.

INSERT INTO gym_config (gym_name, standard_plan_id, hold_plan_id, loyalty_plan_id, winback_amount_cents)
VALUES (
  'RetainIQ+ Demo Gym',
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
      FOR visit_day IN 0..29 BY 3 LOOP
        IF (visit_day + i) % 4 = 0 THEN
          checkin_time := now() - (interval '1 day' * visit_day) + (interval '1 hour' * (8 + (i % 10)));
          INSERT INTO check_ins (member_id, checked_in_at, source) VALUES (member_uuid, checkin_time, 'mock');
        END IF;
      END LOOP;
    ELSE
      checkin_time := now() - (interval '1 day' * last_visit_offset) + interval '9 hours';
      INSERT INTO check_ins (member_id, checked_in_at, source) VALUES (member_uuid, checkin_time, 'mock');

      FOR visit_day IN 30..80 BY 7 LOOP
        checkin_time := now() - (interval '1 day' * (last_visit_offset + visit_day)) + interval '10 hours';
        IF checkin_time > joined THEN
          INSERT INTO check_ins (member_id, checked_in_at, source) VALUES (member_uuid, checkin_time, 'mock');
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- Sarah Chen: Critical — 24 days inactive, was active in May/June
INSERT INTO check_ins (member_id, checked_in_at, source)
SELECT '11111111-1111-1111-1111-111111111101', d, 'mock'
FROM generate_series(
  now() - interval '75 days',
  now() - interval '55 days',
  interval '2 days'
) AS d;

INSERT INTO check_ins (member_id, checked_in_at, source)
VALUES ('11111111-1111-1111-1111-111111111101', now() - interval '24 days', 'mock');

-- Marcus Webb: Slipping — 16 days inactive
INSERT INTO check_ins (member_id, checked_in_at, source)
SELECT '11111111-1111-1111-1111-111111111102', d, 'mock'
FROM generate_series(
  now() - interval '60 days',
  now() - interval '30 days',
  interval '5 days'
) AS d;

INSERT INTO check_ins (member_id, checked_in_at, source)
VALUES ('11111111-1111-1111-1111-111111111102', now() - interval '16 days', 'mock');

-- Jamie Torres: Healthy — 12+ visits in last 30 days
INSERT INTO check_ins (member_id, checked_in_at, source)
SELECT '11111111-1111-1111-1111-111111111103', now() - (interval '1 day' * n) + interval '8 hours', 'mock'
FROM generate_series(0, 27, 2) AS n;
