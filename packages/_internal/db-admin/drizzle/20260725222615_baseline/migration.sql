-- baseline 2026-07-25: snapshot anchor for drizzle-kit generate.
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
