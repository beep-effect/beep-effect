CREATE TABLE workspace_workspace (
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
