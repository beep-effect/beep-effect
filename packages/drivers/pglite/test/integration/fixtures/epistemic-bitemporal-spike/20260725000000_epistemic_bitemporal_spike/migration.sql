CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE spike_claim (
  id SERIAL PRIMARY KEY,
  payload JSONB NOT NULL
);

CREATE TABLE spike_evidence (
  id SERIAL PRIMARY KEY,
  payload JSONB NOT NULL
);

CREATE TABLE spike_edge_version (
  id SERIAL PRIMARY KEY,
  logical_key TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_claim_id INTEGER CONSTRAINT spike_edge_source_claim_fk REFERENCES spike_claim (id),
  source_evidence_id INTEGER CONSTRAINT spike_edge_source_evidence_fk REFERENCES spike_evidence (id),
  source_entity_ref TEXT,
  source_observation_ref TEXT,
  target_kind TEXT NOT NULL,
  target_claim_id INTEGER CONSTRAINT spike_edge_target_claim_fk REFERENCES spike_claim (id),
  target_evidence_id INTEGER CONSTRAINT spike_edge_target_evidence_fk REFERENCES spike_evidence (id),
  target_entity_ref TEXT,
  target_observation_ref TEXT,
  relation TEXT NOT NULL,
  org_scope TEXT NOT NULL,
  matter_scope TEXT,
  qualifiers JSONB NOT NULL,
  evidence_scope TEXT,
  fact JSONB NOT NULL,
  version INTEGER NOT NULL,
  supersedes_id INTEGER CONSTRAINT spike_edge_supersedes_fk REFERENCES spike_edge_version (id),
  valid_from BIGINT NOT NULL,
  valid_to BIGINT,
  recorded_at BIGINT NOT NULL,
  expired_at BIGINT,
  CONSTRAINT spike_edge_valid_ordered CHECK (valid_to IS NULL OR valid_from < valid_to),
  CONSTRAINT spike_edge_txn_ordered CHECK (expired_at IS NULL OR recorded_at < expired_at),
  CONSTRAINT spike_edge_no_self_supersede CHECK (supersedes_id IS NULL OR supersedes_id <> id),
  CONSTRAINT spike_edge_source_bounded CHECK (
    source_kind IN ('claim', 'evidence', 'entity', 'observation')
    AND ((source_kind = 'claim') = (source_claim_id IS NOT NULL))
    AND ((source_kind = 'evidence') = (source_evidence_id IS NOT NULL))
    AND ((source_kind = 'entity') = (source_entity_ref IS NOT NULL))
    AND ((source_kind = 'observation') = (source_observation_ref IS NOT NULL))
  ),
  CONSTRAINT spike_edge_target_bounded CHECK (
    target_kind IN ('claim', 'evidence', 'entity', 'observation')
    AND ((target_kind = 'claim') = (target_claim_id IS NOT NULL))
    AND ((target_kind = 'evidence') = (target_evidence_id IS NOT NULL))
    AND ((target_kind = 'entity') = (target_entity_ref IS NOT NULL))
    AND ((target_kind = 'observation') = (target_observation_ref IS NOT NULL))
  ),
  CONSTRAINT spike_edge_logical_version_unique UNIQUE (logical_key, version),
  CONSTRAINT spike_edge_no_overlap EXCLUDE USING gist (
    logical_key WITH =,
    int8range(valid_from, valid_to, '[)') WITH &&
  ) WHERE (expired_at IS NULL)
);

CREATE UNIQUE INDEX spike_edge_open_head_idx
  ON spike_edge_version (logical_key)
  WHERE valid_to IS NULL AND expired_at IS NULL;

CREATE INDEX spike_edge_asof_idx ON spike_edge_version (logical_key, valid_from, recorded_at);

CREATE INDEX spike_edge_qualifiers_gin_idx ON spike_edge_version USING gin (qualifiers);

CREATE TABLE spike_claim_disposition (
  id SERIAL PRIMARY KEY,
  claim_id INTEGER NOT NULL CONSTRAINT spike_disposition_claim_fk REFERENCES spike_claim (id),
  disposition TEXT NOT NULL CONSTRAINT spike_disposition_bounded CHECK (
    disposition IN ('active', 'rejected', 'superseded')
  ),
  reason TEXT NOT NULL,
  violations JSONB NOT NULL,
  resolved_at BIGINT NOT NULL
);
