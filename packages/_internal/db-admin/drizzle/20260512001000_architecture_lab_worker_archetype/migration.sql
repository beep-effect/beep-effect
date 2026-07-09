CREATE TABLE architecture_lab_worker (
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
