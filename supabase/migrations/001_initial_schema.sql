-- RetainIQ+ initial schema
-- See requirements.md Section 10 for data model documentation

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE gym_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_name TEXT NOT NULL DEFAULT 'RetainIQ+ Demo Gym',
  standard_plan_id TEXT,
  hold_plan_id TEXT,
  loyalty_plan_id TEXT,
  winback_amount_cents INTEGER NOT NULL DEFAULT 4900,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  pinch_payer_id TEXT,
  membership_plan TEXT NOT NULL DEFAULT 'standard',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_members_pinch_payer_id ON members (pinch_payer_id);
CREATE INDEX idx_members_status ON members (status);

CREATE TABLE check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL DEFAULT 'mock'
);

CREATE INDEX idx_check_ins_member_id ON check_ins (member_id);
CREATE INDEX idx_check_ins_checked_in_at ON check_ins (checked_in_at DESC);

CREATE TABLE retention_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  offer_type TEXT NOT NULL CHECK (offer_type IN ('plan_switch', 'payment_link')),
  pinch_plan_id TEXT,
  amount_cents INTEGER,
  target_tier TEXT NOT NULL CHECK (target_tier IN ('healthy', 'slipping', 'critical', 'watch', 'unknown'))
);

CREATE TABLE risk_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  tier TEXT NOT NULL,
  visits_30d INTEGER NOT NULL DEFAULT 0,
  days_since_last_visit INTEGER,
  scored_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_risk_snapshots_member_id ON risk_snapshots (member_id);
CREATE INDEX idx_risk_snapshots_scored_at ON risk_snapshots (scored_at DESC);

CREATE TABLE interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  offer_id UUID NOT NULL REFERENCES retention_offers (id),
  status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'applied', 'failed')),
  pinch_response JSONB,
  created_by TEXT NOT NULL DEFAULT 'demo_owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_interventions_member_id ON interventions (member_id);
CREATE INDEX idx_interventions_created_at ON interventions (created_at DESC);
