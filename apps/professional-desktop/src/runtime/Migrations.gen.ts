/**
 * Generated from `packages/_internal/db-admin/drizzle` by
 * `scripts/sync-migration-bundle.ts`. Do not edit; refresh with
 * `bun run --cwd apps/professional-desktop codegen`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
/* cspell:disable */
import type { MigrationBundleEntry } from "@beep/postgres";

/**
 * Professional Desktop sidecar migration bundle, synced byte-exactly from
 * the db-admin drizzle migration folders.
 *
 * @example
 * ```ts
 * import { migrationBundle } from "@/runtime/Migrations.gen"
 *
 * console.log(migrationBundle.length)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const migrationBundle: ReadonlyArray<MigrationBundleEntry> = [
  {
    name: "20260512000000_architecture_lab_work_item",
    sql: `CREATE TABLE architecture_lab_work_item (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  assignee TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`,
  },
  {
    name: "20260512001000_architecture_lab_worker_archetype",
    sql: `CREATE TABLE architecture_lab_worker (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  display_name TEXT NOT NULL,
  public_id TEXT NOT NULL,
  status TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
);

CREATE UNIQUE INDEX architecture_lab_worker_public_id_unique_idx
  ON architecture_lab_worker (public_id);

ALTER TABLE architecture_lab_work_item
  ADD COLUMN assignee_id INTEGER,
  ADD COLUMN priority TEXT,
  DROP COLUMN assignee;
`,
  },
  {
    name: "20260613000000_workspace_thread_domain",
    sql: `CREATE TABLE workspace_thread (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  public_id TEXT NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  title TEXT NOT NULL,
  workspace_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
);

CREATE UNIQUE INDEX workspace_thread_public_id_unique_idx
  ON workspace_thread (public_id);

CREATE TABLE workspace_turn (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  public_id TEXT NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  items JSONB NOT NULL,
  parent_turn_id INTEGER,
  thread_id INTEGER NOT NULL,
  turn_index INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
);

CREATE UNIQUE INDEX workspace_turn_public_id_unique_idx
  ON workspace_turn (public_id);

CREATE TABLE workspace_message (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  public_id TEXT NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  content JSONB NOT NULL,
  role TEXT NOT NULL,
  thread_id INTEGER NOT NULL,
  turn_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
);

CREATE UNIQUE INDEX workspace_message_public_id_unique_idx
  ON workspace_message (public_id);
`,
  },
  {
    name: "20260613000010_epistemic_usage_record",
    sql: `CREATE TABLE epistemic_usage_record (
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
`,
  },
  {
    name: "20260708000000_workspace_vault_config",
    sql: `CREATE TABLE workspace_workspace (
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
  name TEXT NOT NULL,
  organization_fixture_key TEXT NOT NULL,
  owner_principal_fixture_key TEXT NOT NULL,
  vault_root_path TEXT,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
);

CREATE UNIQUE INDEX workspace_workspace_public_id_unique_idx
  ON workspace_workspace (public_id);
`,
  },
  {
    name: "20260711000000_documents_sync_state",
    sql: `CREATE TABLE documents_sync_item (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  public_id TEXT NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  content_digest TEXT,
  content_size_bytes INTEGER,
  item_kind TEXT NOT NULL,
  last_error TEXT,
  last_pushed_digest TEXT,
  last_pushed_generation INTEGER,
  local_generation INTEGER NOT NULL,
  local_rel_path TEXT NOT NULL,
  provider TEXT NOT NULL,
  remote_id TEXT,
  remote_name TEXT,
  remote_parent_id TEXT,
  sync_state TEXT NOT NULL,
  workspace_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
);

CREATE UNIQUE INDEX documents_sync_item_public_id_unique_idx
  ON documents_sync_item (public_id);

CREATE INDEX documents_sync_item_local_rel_path_lookup_idx
  ON documents_sync_item (local_rel_path);

CREATE INDEX documents_sync_item_remote_id_lookup_idx
  ON documents_sync_item (remote_id);

CREATE INDEX documents_sync_item_sync_state_lookup_idx
  ON documents_sync_item (sync_state);

CREATE INDEX documents_sync_item_workspace_id_btree_idx
  ON documents_sync_item (workspace_id);

CREATE TABLE documents_sync_operation (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  public_id TEXT NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  attempt_count INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL,
  input_content_digest TEXT,
  input_generation INTEGER NOT NULL,
  last_error TEXT,
  operation_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  sync_item_id INTEGER NOT NULL,
  target_name TEXT NOT NULL,
  target_parent_rel_path TEXT,
  target_rel_path TEXT NOT NULL,
  workspace_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
);

CREATE UNIQUE INDEX documents_sync_operation_public_id_unique_idx
  ON documents_sync_operation (public_id);

CREATE UNIQUE INDEX documents_sync_operation_idempotency_key_unique_idx
  ON documents_sync_operation (idempotency_key);

CREATE INDEX documents_sync_operation_status_lookup_idx
  ON documents_sync_operation (status);

CREATE INDEX documents_sync_operation_sync_item_id_lookup_idx
  ON documents_sync_operation (sync_item_id);

CREATE INDEX documents_sync_operation_workspace_id_btree_idx
  ON documents_sync_operation (workspace_id);

CREATE TABLE documents_sync_cursor (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  public_id TEXT NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  last_error TEXT,
  last_event_id TEXT,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  stream_position TEXT NOT NULL,
  workspace_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
);

CREATE UNIQUE INDEX documents_sync_cursor_public_id_unique_idx
  ON documents_sync_cursor (public_id);

CREATE INDEX documents_sync_cursor_workspace_id_btree_idx
  ON documents_sync_cursor (workspace_id);

CREATE TABLE documents_sync_conflict (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  public_id TEXT NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  conflict_kind TEXT NOT NULL,
  local_rel_path TEXT,
  provider TEXT NOT NULL,
  remote_event_id TEXT,
  remote_id TEXT,
  remote_payload JSONB NOT NULL,
  resolution_status TEXT NOT NULL,
  sync_item_id INTEGER,
  workspace_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
);

CREATE UNIQUE INDEX documents_sync_conflict_public_id_unique_idx
  ON documents_sync_conflict (public_id);

CREATE INDEX documents_sync_conflict_conflict_kind_lookup_idx
  ON documents_sync_conflict (conflict_kind);

CREATE INDEX documents_sync_conflict_remote_event_id_lookup_idx
  ON documents_sync_conflict (remote_event_id);

CREATE INDEX documents_sync_conflict_resolution_status_lookup_idx
  ON documents_sync_conflict (resolution_status);

CREATE INDEX documents_sync_conflict_workspace_id_btree_idx
  ON documents_sync_conflict (workspace_id);
`,
  },
  {
    name: "20260725222615_baseline",
    sql: `-- baseline 2026-07-25: snapshot anchor for drizzle-kit generate.
-- The six hand-authored migrations before this folder created all tables,
-- constraints, and lookup indexes but omitted the entity-archetype and
-- domain indexes declared by the table definitions. This migration backfills
-- exactly that delta so deployed databases converge on the snapshot state.
CREATE INDEX "architecture_lab_worker_org_id_btree_idx" ON "architecture_lab_worker" ("org_id");
--> statement-breakpoint
CREATE INDEX "architecture_lab_worker_source_btree_idx" ON "architecture_lab_worker" ("source");
--> statement-breakpoint
CREATE INDEX "architecture_lab_worker_status_lookup_idx" ON "architecture_lab_worker" ("status");
--> statement-breakpoint
CREATE INDEX "documents_sync_conflict_org_id_btree_idx" ON "documents_sync_conflict" ("org_id");
--> statement-breakpoint
CREATE INDEX "documents_sync_conflict_source_btree_idx" ON "documents_sync_conflict" ("source");
--> statement-breakpoint
CREATE INDEX "documents_sync_cursor_org_id_btree_idx" ON "documents_sync_cursor" ("org_id");
--> statement-breakpoint
CREATE INDEX "documents_sync_cursor_source_btree_idx" ON "documents_sync_cursor" ("source");
--> statement-breakpoint
CREATE INDEX "documents_sync_item_org_id_btree_idx" ON "documents_sync_item" ("org_id");
--> statement-breakpoint
CREATE INDEX "documents_sync_item_source_btree_idx" ON "documents_sync_item" ("source");
--> statement-breakpoint
CREATE INDEX "documents_sync_operation_org_id_btree_idx" ON "documents_sync_operation" ("org_id");
--> statement-breakpoint
CREATE INDEX "documents_sync_operation_source_btree_idx" ON "documents_sync_operation" ("source");
--> statement-breakpoint
CREATE INDEX "epistemic_usage_record_org_id_btree_idx" ON "epistemic_usage_record" ("org_id");
--> statement-breakpoint
CREATE INDEX "epistemic_usage_record_source_btree_idx" ON "epistemic_usage_record" ("source");
--> statement-breakpoint
CREATE INDEX "workspace_message_org_id_btree_idx" ON "workspace_message" ("org_id");
--> statement-breakpoint
CREATE INDEX "workspace_message_role_lookup_idx" ON "workspace_message" ("role");
--> statement-breakpoint
CREATE INDEX "workspace_message_source_btree_idx" ON "workspace_message" ("source");
--> statement-breakpoint
CREATE INDEX "workspace_message_thread_id_btree_idx" ON "workspace_message" ("thread_id");
--> statement-breakpoint
CREATE INDEX "workspace_message_turn_id_btree_idx" ON "workspace_message" ("turn_id");
--> statement-breakpoint
CREATE INDEX "workspace_thread_org_id_btree_idx" ON "workspace_thread" ("org_id");
--> statement-breakpoint
CREATE INDEX "workspace_thread_source_btree_idx" ON "workspace_thread" ("source");
--> statement-breakpoint
CREATE INDEX "workspace_thread_workspace_id_btree_idx" ON "workspace_thread" ("workspace_id");
--> statement-breakpoint
CREATE INDEX "workspace_turn_org_id_btree_idx" ON "workspace_turn" ("org_id");
--> statement-breakpoint
CREATE INDEX "workspace_turn_parent_turn_id_btree_idx" ON "workspace_turn" ("parent_turn_id");
--> statement-breakpoint
CREATE INDEX "workspace_turn_source_btree_idx" ON "workspace_turn" ("source");
--> statement-breakpoint
CREATE INDEX "workspace_turn_thread_id_btree_idx" ON "workspace_turn" ("thread_id");
--> statement-breakpoint
CREATE INDEX "workspace_turn_turn_index_btree_idx" ON "workspace_turn" ("turn_index");
--> statement-breakpoint
CREATE INDEX "workspace_workspace_org_id_btree_idx" ON "workspace_workspace" ("org_id");
--> statement-breakpoint
CREATE INDEX "workspace_workspace_source_btree_idx" ON "workspace_workspace" ("source");
`,
  },
  {
    name: "20260726000000_epistemic_bitemporal_edge",
    sql: `CREATE EXTENSION IF NOT EXISTS btree_gist;

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
`,
  },
  {
    name: "20260726210000_epistemic_execution_ledger",
    sql: `CREATE TABLE epistemic_execution_decision (
  run_key TEXT NOT NULL,
  seq INTEGER NOT NULL,
  prev_hash TEXT,
  hash TEXT NOT NULL,
  verdict TEXT NOT NULL,
  reason TEXT,
  operation_digest TEXT NOT NULL,
  sink_class TEXT NOT NULL,
  audience TEXT NOT NULL,
  destination_digest TEXT NOT NULL,
  grant_set_digest TEXT NOT NULL,
  policy_revision TEXT NOT NULL,
  decided_at BIGINT NOT NULL,
  CONSTRAINT epistemic_execution_decision_pk PRIMARY KEY (run_key, seq),
  CONSTRAINT epistemic_execution_decision_hash_unique UNIQUE (hash),
  CONSTRAINT epistemic_execution_decision_run_hash_unique UNIQUE (run_key, hash),
  CONSTRAINT epistemic_execution_decision_hash_verdict_unique UNIQUE (hash, verdict),
  CONSTRAINT epistemic_execution_decision_seq_nonnegative CHECK (seq >= 0),
  CONSTRAINT epistemic_execution_decision_genesis_prev CHECK ((seq = 0) = (prev_hash IS NULL)),
  CONSTRAINT epistemic_execution_decision_verdict_bounded CHECK (verdict IN ('allowed', 'denied')),
  CONSTRAINT epistemic_execution_decision_reason_iff_denied CHECK ((verdict = 'denied') = (reason IS NOT NULL)),
  CONSTRAINT epistemic_execution_decision_reason_bounded CHECK (
    reason IS NULL OR reason IN (
      'no-grant-in-scope',
      'grant-set-digest-mismatch',
      'operation-not-granted',
      'sink-class-not-granted',
      'audience-not-granted',
      'destination-not-granted',
      'grant-expired',
      'policy-revision-mismatch',
      'ledger-unavailable'
    )
  ),
  CONSTRAINT epistemic_execution_decision_sink_class_bounded CHECK (sink_class IN ('network-egress', 'mcp-write')),
  CONSTRAINT epistemic_execution_decision_audience_bounded CHECK (
    audience IN ('local-workspace', 'external-network')
  )
);

CREATE TABLE epistemic_execution_outcome (
  run_key TEXT NOT NULL,
  decision_hash TEXT NOT NULL,
  decision_verdict TEXT NOT NULL DEFAULT 'allowed',
  settlement TEXT NOT NULL,
  recorded_at BIGINT NOT NULL,
  hash TEXT NOT NULL,
  CONSTRAINT epistemic_execution_outcome_pk PRIMARY KEY (decision_hash),
  CONSTRAINT epistemic_execution_outcome_decision_fk FOREIGN KEY (run_key, decision_hash)
    REFERENCES epistemic_execution_decision (run_key, hash),
  CONSTRAINT epistemic_execution_outcome_decision_verdict_fk FOREIGN KEY (decision_hash, decision_verdict)
    REFERENCES epistemic_execution_decision (hash, verdict),
  CONSTRAINT epistemic_execution_outcome_settles_allowed CHECK (decision_verdict = 'allowed'),
  CONSTRAINT epistemic_execution_outcome_hash_unique UNIQUE (hash),
  CONSTRAINT epistemic_execution_outcome_settlement_bounded CHECK (
    settlement IN ('completed', 'failed', 'interrupted')
  )
);

CREATE FUNCTION epistemic_execution_ledger_block_mutation() RETURNS trigger
LANGUAGE plpgsql AS $guard$
BEGIN
  RAISE EXCEPTION 'epistemic execution ledger is append-only: % on %', TG_OP, TG_TABLE_NAME;
END;
$guard$;

CREATE TRIGGER epistemic_execution_decision_append_only
  BEFORE UPDATE OR DELETE ON epistemic_execution_decision
  FOR EACH ROW EXECUTE FUNCTION epistemic_execution_ledger_block_mutation();

CREATE TRIGGER epistemic_execution_outcome_append_only
  BEFORE UPDATE OR DELETE ON epistemic_execution_outcome
  FOR EACH ROW EXECUTE FUNCTION epistemic_execution_ledger_block_mutation();

CREATE TRIGGER epistemic_execution_decision_block_truncate
  BEFORE TRUNCATE ON epistemic_execution_decision
  FOR EACH STATEMENT EXECUTE FUNCTION epistemic_execution_ledger_block_mutation();

CREATE TRIGGER epistemic_execution_outcome_block_truncate
  BEFORE TRUNCATE ON epistemic_execution_outcome
  FOR EACH STATEMENT EXECUTE FUNCTION epistemic_execution_ledger_block_mutation();
`,
  },
];
