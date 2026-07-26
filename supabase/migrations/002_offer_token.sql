-- Send-offer flow: offered status + tokenized member offer links

ALTER TABLE interventions
  DROP CONSTRAINT IF EXISTS interventions_status_check;

ALTER TABLE interventions
  ADD CONSTRAINT interventions_status_check
  CHECK (status IN ('suggested', 'offered', 'applied', 'failed'));

ALTER TABLE interventions
  ADD COLUMN IF NOT EXISTS offer_token TEXT,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_interventions_offer_token
  ON interventions (offer_token)
  WHERE offer_token IS NOT NULL;
