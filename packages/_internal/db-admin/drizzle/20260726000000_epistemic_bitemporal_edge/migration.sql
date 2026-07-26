CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE epistemic_candidate_claim (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  public_id TEXT NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  fixture_key TEXT NOT NULL,
  lifecycle TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
);

CREATE UNIQUE INDEX epistemic_candidate_claim_public_id_unique_idx
  ON epistemic_candidate_claim (public_id);

CREATE TABLE epistemic_evidence (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  public_id TEXT NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  artifact_fixture_key TEXT NOT NULL,
  span JSONB NOT NULL,
  span_fixture_key TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
);

CREATE UNIQUE INDEX epistemic_evidence_public_id_unique_idx
  ON epistemic_evidence (public_id);

CREATE TABLE epistemic_edge_version (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  public_id TEXT NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  evidence_scope TEXT,
  expired_at BIGINT,
  fact JSONB NOT NULL,
  logical_key TEXT NOT NULL,
  matter_scope TEXT,
  qualifiers JSONB NOT NULL,
  recorded_at BIGINT NOT NULL,
  relation TEXT NOT NULL,
  source_claim_id INTEGER CONSTRAINT epistemic_edge_source_claim_fk REFERENCES epistemic_candidate_claim (id),
  source_entity_ref TEXT,
  source_evidence_id INTEGER CONSTRAINT epistemic_edge_source_evidence_fk REFERENCES epistemic_evidence (id),
  source_kind TEXT NOT NULL,
  source_observation_ref TEXT,
  supersedes_id INTEGER CONSTRAINT epistemic_edge_supersedes_fk REFERENCES epistemic_edge_version (id),
  target_claim_id INTEGER CONSTRAINT epistemic_edge_target_claim_fk REFERENCES epistemic_candidate_claim (id),
  target_entity_ref TEXT,
  target_evidence_id INTEGER CONSTRAINT epistemic_edge_target_evidence_fk REFERENCES epistemic_evidence (id),
  target_kind TEXT NOT NULL,
  target_observation_ref TEXT,
  valid_from BIGINT NOT NULL,
  valid_to BIGINT,
  version INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY,
  CONSTRAINT epistemic_edge_valid_ordered CHECK (valid_to IS NULL OR valid_from < valid_to),
  CONSTRAINT epistemic_edge_txn_ordered CHECK (expired_at IS NULL OR recorded_at < expired_at),
  CONSTRAINT epistemic_edge_no_self_supersede CHECK (supersedes_id IS NULL OR supersedes_id <> id),
  CONSTRAINT epistemic_edge_source_bounded CHECK (
    source_kind IN ('claim', 'evidence', 'entity', 'observation')
    AND ((source_kind = 'claim') = (source_claim_id IS NOT NULL))
    AND ((source_kind = 'evidence') = (source_evidence_id IS NOT NULL))
    AND ((source_kind = 'entity') = (source_entity_ref IS NOT NULL))
    AND ((source_kind = 'observation') = (source_observation_ref IS NOT NULL))
  ),
  CONSTRAINT epistemic_edge_target_bounded CHECK (
    target_kind IN ('claim', 'evidence', 'entity', 'observation')
    AND ((target_kind = 'claim') = (target_claim_id IS NOT NULL))
    AND ((target_kind = 'evidence') = (target_evidence_id IS NOT NULL))
    AND ((target_kind = 'entity') = (target_entity_ref IS NOT NULL))
    AND ((target_kind = 'observation') = (target_observation_ref IS NOT NULL))
  ),
  CONSTRAINT epistemic_edge_logical_version_unique UNIQUE (logical_key, version),
  CONSTRAINT epistemic_edge_no_overlap EXCLUDE USING gist (
    logical_key WITH =,
    int8range(valid_from, valid_to, '[)') WITH &&
  ) WHERE (expired_at IS NULL)
);

CREATE UNIQUE INDEX epistemic_edge_version_public_id_unique_idx
  ON epistemic_edge_version (public_id);

CREATE UNIQUE INDEX epistemic_edge_open_head_idx
  ON epistemic_edge_version (logical_key)
  WHERE valid_to IS NULL AND expired_at IS NULL;

CREATE INDEX epistemic_edge_asof_idx
  ON epistemic_edge_version (logical_key, valid_from, recorded_at);

CREATE INDEX epistemic_edge_qualifiers_gin_idx
  ON epistemic_edge_version USING gin (qualifiers);

CREATE TABLE epistemic_claim_disposition (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  public_id TEXT NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  claim_id INTEGER NOT NULL CONSTRAINT epistemic_claim_disposition_claim_fk REFERENCES epistemic_candidate_claim (id),
  reason TEXT NOT NULL,
  resolved_at BIGINT NOT NULL,
  resolved_by JSONB NOT NULL,
  status TEXT NOT NULL CONSTRAINT epistemic_claim_disposition_bounded CHECK (
    status IN ('active', 'rejected', 'superseded')
  ),
  violations JSONB NOT NULL,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
);

CREATE UNIQUE INDEX epistemic_claim_disposition_public_id_unique_idx
  ON epistemic_claim_disposition (public_id);
