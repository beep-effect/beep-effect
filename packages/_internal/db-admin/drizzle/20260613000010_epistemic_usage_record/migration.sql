CREATE TABLE epistemic_usage_record (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  public_id TEXT NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  activity_id INTEGER NOT NULL,
  actor JSONB NOT NULL,
  cost_usd_approx_micros INTEGER,
  credential_reference TEXT,
  input_tokens INTEGER,
  latency_millis INTEGER,
  metadata JSONB NOT NULL,
  model TEXT NOT NULL,
  output_tokens INTEGER,
  provider TEXT NOT NULL,
  total_tokens INTEGER,
  unit_count INTEGER,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
);

CREATE UNIQUE INDEX epistemic_usage_record_public_id_unique_idx
  ON epistemic_usage_record (public_id);
