CREATE TABLE documents_sync_item (
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
