CREATE TABLE "architecture_lab_work_item" (
	"id" text PRIMARY KEY,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"assignee_id" integer,
	"priority" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "architecture_lab_worker" (
	"created_at" bigint NOT NULL,
	"created_by_principal" jsonb NOT NULL,
	"org_id" integer NOT NULL,
	"row_version" integer NOT NULL,
	"schema_version" text NOT NULL,
	"source" text NOT NULL,
	"updated_at" bigint NOT NULL,
	"updated_by_principal" jsonb NOT NULL,
	"display_name" text NOT NULL,
	"status" text NOT NULL,
	"entity_type" text NOT NULL,
	"id" serial PRIMARY KEY,
	"public_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents_sync_conflict" (
	"created_at" bigint NOT NULL,
	"created_by_principal" jsonb NOT NULL,
	"org_id" integer NOT NULL,
	"row_version" integer NOT NULL,
	"schema_version" text NOT NULL,
	"source" text NOT NULL,
	"updated_at" bigint NOT NULL,
	"updated_by_principal" jsonb NOT NULL,
	"conflict_kind" text NOT NULL,
	"local_rel_path" text,
	"provider" text NOT NULL,
	"remote_event_id" text,
	"remote_id" text,
	"remote_payload" jsonb NOT NULL,
	"resolution_status" text NOT NULL,
	"sync_item_id" integer,
	"workspace_id" integer NOT NULL,
	"entity_type" text NOT NULL,
	"id" serial PRIMARY KEY,
	"public_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents_sync_cursor" (
	"created_at" bigint NOT NULL,
	"created_by_principal" jsonb NOT NULL,
	"org_id" integer NOT NULL,
	"row_version" integer NOT NULL,
	"schema_version" text NOT NULL,
	"source" text NOT NULL,
	"updated_at" bigint NOT NULL,
	"updated_by_principal" jsonb NOT NULL,
	"last_error" text,
	"last_event_id" text,
	"provider" text NOT NULL,
	"status" text NOT NULL,
	"stream_position" text NOT NULL,
	"workspace_id" integer NOT NULL,
	"entity_type" text NOT NULL,
	"id" serial PRIMARY KEY,
	"public_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents_sync_item" (
	"created_at" bigint NOT NULL,
	"created_by_principal" jsonb NOT NULL,
	"org_id" integer NOT NULL,
	"row_version" integer NOT NULL,
	"schema_version" text NOT NULL,
	"source" text NOT NULL,
	"updated_at" bigint NOT NULL,
	"updated_by_principal" jsonb NOT NULL,
	"content_digest" text,
	"content_size_bytes" integer,
	"item_kind" text NOT NULL,
	"last_error" text,
	"last_pushed_digest" text,
	"last_pushed_generation" integer,
	"local_generation" integer NOT NULL,
	"local_rel_path" text NOT NULL,
	"provider" text NOT NULL,
	"remote_id" text,
	"remote_name" text,
	"remote_parent_id" text,
	"sync_state" text NOT NULL,
	"workspace_id" integer NOT NULL,
	"entity_type" text NOT NULL,
	"id" serial PRIMARY KEY,
	"public_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents_sync_operation" (
	"created_at" bigint NOT NULL,
	"created_by_principal" jsonb NOT NULL,
	"org_id" integer NOT NULL,
	"row_version" integer NOT NULL,
	"schema_version" text NOT NULL,
	"source" text NOT NULL,
	"updated_at" bigint NOT NULL,
	"updated_by_principal" jsonb NOT NULL,
	"attempt_count" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"input_content_digest" text,
	"input_generation" integer NOT NULL,
	"last_error" text,
	"operation_type" text NOT NULL,
	"provider" text NOT NULL,
	"status" text NOT NULL,
	"sync_item_id" integer NOT NULL,
	"target_name" text NOT NULL,
	"target_parent_rel_path" text,
	"target_rel_path" text NOT NULL,
	"workspace_id" integer NOT NULL,
	"entity_type" text NOT NULL,
	"id" serial PRIMARY KEY,
	"public_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "epistemic_contradiction_candidate" (
	"created_at" bigint NOT NULL,
	"created_by_principal" jsonb NOT NULL,
	"org_id" integer NOT NULL,
	"row_version" integer NOT NULL,
	"schema_version" text NOT NULL,
	"source" text NOT NULL,
	"updated_at" bigint NOT NULL,
	"updated_by_principal" jsonb NOT NULL,
	"candidate_key" text NOT NULL,
	"candidate_digest" text NOT NULL,
	"assessment" jsonb NOT NULL,
	"match_basis" jsonb NOT NULL,
	"belief_pair" jsonb NOT NULL,
	"recorded_at" bigint NOT NULL,
	"valid_from" bigint NOT NULL,
	"valid_to" bigint,
	"entity_type" text NOT NULL,
	"id" serial PRIMARY KEY,
	"public_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "epistemic_contradiction_disposition" (
	"created_at" bigint NOT NULL,
	"created_by_principal" jsonb NOT NULL,
	"org_id" integer NOT NULL,
	"row_version" integer NOT NULL,
	"schema_version" text NOT NULL,
	"source" text NOT NULL,
	"updated_at" bigint NOT NULL,
	"updated_by_principal" jsonb NOT NULL,
	"candidate_id" integer NOT NULL,
	"decision" jsonb NOT NULL,
	"resolved_at" bigint NOT NULL,
	"resolved_by" jsonb NOT NULL,
	"entity_type" text NOT NULL,
	"id" serial PRIMARY KEY,
	"public_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "epistemic_contradiction_receipt" (
	"created_at" bigint NOT NULL,
	"created_by_principal" jsonb NOT NULL,
	"org_id" integer NOT NULL,
	"row_version" integer NOT NULL,
	"schema_version" text NOT NULL,
	"source" text NOT NULL,
	"updated_at" bigint NOT NULL,
	"updated_by_principal" jsonb NOT NULL,
	"candidate_id" integer NOT NULL,
	"receipt_key" text NOT NULL,
	"received_at" bigint NOT NULL,
	"received_by" jsonb NOT NULL,
	"entity_type" text NOT NULL,
	"id" serial PRIMARY KEY,
	"public_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "epistemic_evidence_verification" (
	"created_at" bigint NOT NULL,
	"created_by_principal" jsonb NOT NULL,
	"org_id" integer NOT NULL,
	"row_version" integer NOT NULL,
	"schema_version" text NOT NULL,
	"source" text NOT NULL,
	"updated_at" bigint NOT NULL,
	"updated_by_principal" jsonb NOT NULL,
	"evidence_id" integer NOT NULL,
	"manifestation_key" text NOT NULL,
	"verified_anchor" jsonb NOT NULL,
	"entity_type" text NOT NULL,
	"id" serial PRIMARY KEY,
	"public_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "epistemic_usage_record" (
	"created_at" bigint NOT NULL,
	"created_by_principal" jsonb NOT NULL,
	"org_id" integer NOT NULL,
	"row_version" integer NOT NULL,
	"schema_version" text NOT NULL,
	"source" text NOT NULL,
	"updated_at" bigint NOT NULL,
	"updated_by_principal" jsonb NOT NULL,
	"activity_id" integer,
	"actor" jsonb NOT NULL,
	"cost_usd_approx_micros" integer,
	"credential_reference" text,
	"input_tokens" integer,
	"latency_millis" integer,
	"metadata" jsonb NOT NULL,
	"model" text NOT NULL,
	"output_tokens" integer,
	"provider" text NOT NULL,
	"total_tokens" integer,
	"unit_count" integer,
	"entity_type" text NOT NULL,
	"id" serial PRIMARY KEY,
	"public_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "law_practice_act_frame" (
	"created_at" bigint NOT NULL,
	"created_by_principal" jsonb NOT NULL,
	"org_id" integer NOT NULL,
	"row_version" integer NOT NULL,
	"schema_version" text NOT NULL,
	"source" text NOT NULL,
	"updated_at" bigint NOT NULL,
	"updated_by_principal" jsonb NOT NULL,
	"act" jsonb NOT NULL,
	"creates" jsonb NOT NULL,
	"derivation_kind" jsonb NOT NULL,
	"interpreter" jsonb NOT NULL,
	"preconditions" jsonb NOT NULL,
	"slots" jsonb NOT NULL,
	"source_norm" jsonb NOT NULL,
	"terminates" jsonb NOT NULL,
	"entity_type" text NOT NULL,
	"id" serial PRIMARY KEY,
	"public_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "law_practice_candor_disposition" (
	"created_at" bigint NOT NULL,
	"created_by_principal" jsonb NOT NULL,
	"org_id" integer NOT NULL,
	"row_version" integer NOT NULL,
	"schema_version" text NOT NULL,
	"source" text NOT NULL,
	"updated_at" bigint NOT NULL,
	"updated_by_principal" jsonb NOT NULL,
	"citing_application" jsonb NOT NULL,
	"decided_at" bigint NOT NULL,
	"disposes" jsonb NOT NULL,
	"lifecycle" text NOT NULL,
	"litigation_frame_judgment" text,
	"rule56_judgment" text,
	"supersedes" integer,
	"entity_type" text NOT NULL,
	"id" serial PRIMARY KEY,
	"public_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "law_practice_correction_delta" (
	"created_at" bigint NOT NULL,
	"created_by_principal" jsonb NOT NULL,
	"org_id" integer NOT NULL,
	"row_version" integer NOT NULL,
	"schema_version" text NOT NULL,
	"source" text NOT NULL,
	"updated_at" bigint NOT NULL,
	"updated_by_principal" jsonb NOT NULL,
	"candidate_routing" text NOT NULL,
	"corrected_elements" jsonb NOT NULL,
	"frame" integer NOT NULL,
	"reviewer" jsonb NOT NULL,
	"reviewer_action" text NOT NULL,
	"stage" text NOT NULL,
	"supersedes" integer,
	"validator_report" jsonb NOT NULL,
	"entity_type" text NOT NULL,
	"id" serial PRIMARY KEY,
	"public_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "law_practice_ids_submission_fact" (
	"created_at" bigint NOT NULL,
	"created_by_principal" jsonb NOT NULL,
	"org_id" integer NOT NULL,
	"row_version" integer NOT NULL,
	"schema_version" text NOT NULL,
	"source" text NOT NULL,
	"updated_at" bigint NOT NULL,
	"updated_by_principal" jsonb NOT NULL,
	"candidate_window" jsonb NOT NULL,
	"citing_application" jsonb NOT NULL,
	"content" jsonb NOT NULL,
	"fees" jsonb NOT NULL,
	"modeled_from" jsonb NOT NULL,
	"office_treatment" jsonb,
	"operative_date" bigint NOT NULL,
	"statement" jsonb NOT NULL,
	"submission_kind" text NOT NULL,
	"entity_type" text NOT NULL,
	"id" serial PRIMARY KEY,
	"public_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "law_practice_legal_opposition_candidate" (
	"created_at" bigint NOT NULL,
	"created_by_principal" jsonb NOT NULL,
	"org_id" integer NOT NULL,
	"row_version" integer NOT NULL,
	"schema_version" text NOT NULL,
	"source" text NOT NULL,
	"updated_at" bigint NOT NULL,
	"updated_by_principal" jsonb NOT NULL,
	"candidate" jsonb NOT NULL,
	"priority_basis" jsonb,
	"verdict_family" jsonb,
	"entity_type" text NOT NULL,
	"id" serial PRIMARY KEY,
	"public_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "law_practice_legal_position_relator" (
	"created_at" bigint NOT NULL,
	"created_by_principal" jsonb NOT NULL,
	"org_id" integer NOT NULL,
	"row_version" integer NOT NULL,
	"schema_version" text NOT NULL,
	"source" text NOT NULL,
	"updated_at" bigint NOT NULL,
	"updated_by_principal" jsonb NOT NULL,
	"asserting_interpreter" jsonb NOT NULL,
	"bearer" jsonb NOT NULL,
	"content" jsonb NOT NULL,
	"counterparty" jsonb NOT NULL,
	"grounding" jsonb NOT NULL,
	"position_kind" text NOT NULL,
	"scope" jsonb NOT NULL,
	"source_norm" jsonb NOT NULL,
	"entity_type" text NOT NULL,
	"id" serial PRIMARY KEY,
	"public_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "law_practice_patent_citation_event" (
	"created_at" bigint NOT NULL,
	"created_by_principal" jsonb NOT NULL,
	"org_id" integer NOT NULL,
	"row_version" integer NOT NULL,
	"schema_version" text NOT NULL,
	"source" text NOT NULL,
	"updated_at" bigint NOT NULL,
	"updated_by_principal" jsonb NOT NULL,
	"actor" text NOT NULL,
	"citing_application" jsonb NOT NULL,
	"discovery" jsonb NOT NULL,
	"grounding" jsonb NOT NULL,
	"observed_at" bigint NOT NULL,
	"possible_duplicate_of" integer,
	"quarantine" jsonb,
	"reference" jsonb NOT NULL,
	"supersedes" jsonb,
	"entity_type" text NOT NULL,
	"id" serial PRIMARY KEY,
	"public_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "law_practice_power_exercise" (
	"created_at" bigint NOT NULL,
	"created_by_principal" jsonb NOT NULL,
	"org_id" integer NOT NULL,
	"row_version" integer NOT NULL,
	"schema_version" text NOT NULL,
	"source" text NOT NULL,
	"updated_at" bigint NOT NULL,
	"updated_by_principal" jsonb NOT NULL,
	"attempted_at" bigint NOT NULL,
	"authority_basis" jsonb NOT NULL,
	"frame" integer NOT NULL,
	"precondition_assertions" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"slot_assignments" jsonb NOT NULL,
	"entity_type" text NOT NULL,
	"id" serial PRIMARY KEY,
	"public_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_message" (
	"created_at" bigint NOT NULL,
	"created_by_principal" jsonb NOT NULL,
	"org_id" integer NOT NULL,
	"row_version" integer NOT NULL,
	"schema_version" text NOT NULL,
	"source" text NOT NULL,
	"updated_at" bigint NOT NULL,
	"updated_by_principal" jsonb NOT NULL,
	"content" jsonb NOT NULL,
	"role" text NOT NULL,
	"thread_id" integer NOT NULL,
	"turn_id" integer NOT NULL,
	"entity_type" text NOT NULL,
	"id" serial PRIMARY KEY,
	"public_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_thread" (
	"created_at" bigint NOT NULL,
	"created_by_principal" jsonb NOT NULL,
	"org_id" integer NOT NULL,
	"row_version" integer NOT NULL,
	"schema_version" text NOT NULL,
	"source" text NOT NULL,
	"updated_at" bigint NOT NULL,
	"updated_by_principal" jsonb NOT NULL,
	"title" text NOT NULL,
	"workspace_id" integer NOT NULL,
	"entity_type" text NOT NULL,
	"id" serial PRIMARY KEY,
	"public_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_turn" (
	"created_at" bigint NOT NULL,
	"created_by_principal" jsonb NOT NULL,
	"org_id" integer NOT NULL,
	"row_version" integer NOT NULL,
	"schema_version" text NOT NULL,
	"source" text NOT NULL,
	"updated_at" bigint NOT NULL,
	"updated_by_principal" jsonb NOT NULL,
	"items" jsonb NOT NULL,
	"parent_turn_id" integer,
	"thread_id" integer NOT NULL,
	"turn_index" integer NOT NULL,
	"entity_type" text NOT NULL,
	"id" serial PRIMARY KEY,
	"public_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_workspace" (
	"created_at" bigint NOT NULL,
	"created_by_principal" jsonb NOT NULL,
	"org_id" integer NOT NULL,
	"row_version" integer NOT NULL,
	"schema_version" text NOT NULL,
	"source" text NOT NULL,
	"updated_at" bigint NOT NULL,
	"updated_by_principal" jsonb NOT NULL,
	"fixture_key" text NOT NULL,
	"name" text NOT NULL,
	"organization_fixture_key" text NOT NULL,
	"owner_principal_fixture_key" text NOT NULL,
	"vault_root_path" text,
	"entity_type" text NOT NULL,
	"id" serial PRIMARY KEY,
	"public_id" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "architecture_lab_worker_org_id_btree_idx" ON "architecture_lab_worker" ("org_id");--> statement-breakpoint
CREATE INDEX "architecture_lab_worker_source_btree_idx" ON "architecture_lab_worker" ("source");--> statement-breakpoint
CREATE INDEX "architecture_lab_worker_status_lookup_idx" ON "architecture_lab_worker" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "architecture_lab_worker_public_id_unique_idx" ON "architecture_lab_worker" ("public_id");--> statement-breakpoint
CREATE INDEX "documents_sync_conflict_org_id_btree_idx" ON "documents_sync_conflict" ("org_id");--> statement-breakpoint
CREATE INDEX "documents_sync_conflict_source_btree_idx" ON "documents_sync_conflict" ("source");--> statement-breakpoint
CREATE INDEX "documents_sync_conflict_conflict_kind_lookup_idx" ON "documents_sync_conflict" ("conflict_kind");--> statement-breakpoint
CREATE INDEX "documents_sync_conflict_remote_event_id_lookup_idx" ON "documents_sync_conflict" ("remote_event_id");--> statement-breakpoint
CREATE INDEX "documents_sync_conflict_resolution_status_lookup_idx" ON "documents_sync_conflict" ("resolution_status");--> statement-breakpoint
CREATE INDEX "documents_sync_conflict_workspace_id_btree_idx" ON "documents_sync_conflict" ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_sync_conflict_public_id_unique_idx" ON "documents_sync_conflict" ("public_id");--> statement-breakpoint
CREATE INDEX "documents_sync_cursor_org_id_btree_idx" ON "documents_sync_cursor" ("org_id");--> statement-breakpoint
CREATE INDEX "documents_sync_cursor_source_btree_idx" ON "documents_sync_cursor" ("source");--> statement-breakpoint
CREATE INDEX "documents_sync_cursor_workspace_id_btree_idx" ON "documents_sync_cursor" ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_sync_cursor_public_id_unique_idx" ON "documents_sync_cursor" ("public_id");--> statement-breakpoint
CREATE INDEX "documents_sync_item_org_id_btree_idx" ON "documents_sync_item" ("org_id");--> statement-breakpoint
CREATE INDEX "documents_sync_item_source_btree_idx" ON "documents_sync_item" ("source");--> statement-breakpoint
CREATE INDEX "documents_sync_item_local_rel_path_lookup_idx" ON "documents_sync_item" ("local_rel_path");--> statement-breakpoint
CREATE INDEX "documents_sync_item_remote_id_lookup_idx" ON "documents_sync_item" ("remote_id");--> statement-breakpoint
CREATE INDEX "documents_sync_item_sync_state_lookup_idx" ON "documents_sync_item" ("sync_state");--> statement-breakpoint
CREATE INDEX "documents_sync_item_workspace_id_btree_idx" ON "documents_sync_item" ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_sync_item_public_id_unique_idx" ON "documents_sync_item" ("public_id");--> statement-breakpoint
CREATE INDEX "documents_sync_operation_org_id_btree_idx" ON "documents_sync_operation" ("org_id");--> statement-breakpoint
CREATE INDEX "documents_sync_operation_source_btree_idx" ON "documents_sync_operation" ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_sync_operation_idempotency_key_unique_idx" ON "documents_sync_operation" ("idempotency_key");--> statement-breakpoint
CREATE INDEX "documents_sync_operation_status_lookup_idx" ON "documents_sync_operation" ("status");--> statement-breakpoint
CREATE INDEX "documents_sync_operation_sync_item_id_lookup_idx" ON "documents_sync_operation" ("sync_item_id");--> statement-breakpoint
CREATE INDEX "documents_sync_operation_workspace_id_btree_idx" ON "documents_sync_operation" ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_sync_operation_public_id_unique_idx" ON "documents_sync_operation" ("public_id");--> statement-breakpoint
CREATE INDEX "epistemic_contradiction_candidate_org_id_btree_idx" ON "epistemic_contradiction_candidate" ("org_id");--> statement-breakpoint
CREATE INDEX "epistemic_contradiction_candidate_source_btree_idx" ON "epistemic_contradiction_candidate" ("source");--> statement-breakpoint
CREATE INDEX "epistemic_contradiction_candidate_recorded_at_btree_idx" ON "epistemic_contradiction_candidate" ("recorded_at");--> statement-breakpoint
CREATE INDEX "epistemic_contradiction_candidate_valid_from_btree_idx" ON "epistemic_contradiction_candidate" ("valid_from");--> statement-breakpoint
CREATE UNIQUE INDEX "epistemic_contradiction_candidate_public_id_unique_idx" ON "epistemic_contradiction_candidate" ("public_id");--> statement-breakpoint
CREATE INDEX "epistemic_contradiction_disposition_org_id_btree_idx" ON "epistemic_contradiction_disposition" ("org_id");--> statement-breakpoint
CREATE INDEX "epistemic_contradiction_disposition_source_btree_idx" ON "epistemic_contradiction_disposition" ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "epistemic_contradiction_disposition_candidate_id_unique_idx" ON "epistemic_contradiction_disposition" ("candidate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "epistemic_contradiction_disposition_public_id_unique_idx" ON "epistemic_contradiction_disposition" ("public_id");--> statement-breakpoint
CREATE INDEX "epistemic_contradiction_receipt_org_id_btree_idx" ON "epistemic_contradiction_receipt" ("org_id");--> statement-breakpoint
CREATE INDEX "epistemic_contradiction_receipt_source_btree_idx" ON "epistemic_contradiction_receipt" ("source");--> statement-breakpoint
CREATE INDEX "epistemic_contradiction_receipt_candidate_id_btree_idx" ON "epistemic_contradiction_receipt" ("candidate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "epistemic_contradiction_receipt_public_id_unique_idx" ON "epistemic_contradiction_receipt" ("public_id");--> statement-breakpoint
CREATE INDEX "epistemic_evidence_verification_org_id_btree_idx" ON "epistemic_evidence_verification" ("org_id");--> statement-breakpoint
CREATE INDEX "epistemic_evidence_verification_source_btree_idx" ON "epistemic_evidence_verification" ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "epistemic_evidence_verification_public_id_unique_idx" ON "epistemic_evidence_verification" ("public_id");--> statement-breakpoint
CREATE INDEX "epistemic_usage_record_org_id_btree_idx" ON "epistemic_usage_record" ("org_id");--> statement-breakpoint
CREATE INDEX "epistemic_usage_record_source_btree_idx" ON "epistemic_usage_record" ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "epistemic_usage_record_public_id_unique_idx" ON "epistemic_usage_record" ("public_id");--> statement-breakpoint
CREATE INDEX "law_practice_act_frame_org_id_btree_idx" ON "law_practice_act_frame" ("org_id");--> statement-breakpoint
CREATE INDEX "law_practice_act_frame_source_btree_idx" ON "law_practice_act_frame" ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "law_practice_act_frame_public_id_unique_idx" ON "law_practice_act_frame" ("public_id");--> statement-breakpoint
CREATE INDEX "law_practice_candor_disposition_org_id_btree_idx" ON "law_practice_candor_disposition" ("org_id");--> statement-breakpoint
CREATE INDEX "law_practice_candor_disposition_source_btree_idx" ON "law_practice_candor_disposition" ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "law_practice_candor_disposition_public_id_unique_idx" ON "law_practice_candor_disposition" ("public_id");--> statement-breakpoint
CREATE INDEX "law_practice_correction_delta_org_id_btree_idx" ON "law_practice_correction_delta" ("org_id");--> statement-breakpoint
CREATE INDEX "law_practice_correction_delta_source_btree_idx" ON "law_practice_correction_delta" ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "law_practice_correction_delta_public_id_unique_idx" ON "law_practice_correction_delta" ("public_id");--> statement-breakpoint
CREATE INDEX "law_practice_ids_submission_fact_org_id_btree_idx" ON "law_practice_ids_submission_fact" ("org_id");--> statement-breakpoint
CREATE INDEX "law_practice_ids_submission_fact_source_btree_idx" ON "law_practice_ids_submission_fact" ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "law_practice_ids_submission_fact_public_id_unique_idx" ON "law_practice_ids_submission_fact" ("public_id");--> statement-breakpoint
CREATE INDEX "law_practice_legal_opposition_candidate_org_id_btree_idx" ON "law_practice_legal_opposition_candidate" ("org_id");--> statement-breakpoint
CREATE INDEX "law_practice_legal_opposition_candidate_source_btree_idx" ON "law_practice_legal_opposition_candidate" ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "law_practice_legal_opposition_candidate_public_id_unique_idx" ON "law_practice_legal_opposition_candidate" ("public_id");--> statement-breakpoint
CREATE INDEX "law_practice_legal_position_relator_org_id_btree_idx" ON "law_practice_legal_position_relator" ("org_id");--> statement-breakpoint
CREATE INDEX "law_practice_legal_position_relator_source_btree_idx" ON "law_practice_legal_position_relator" ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "law_practice_legal_position_relator_public_id_unique_idx" ON "law_practice_legal_position_relator" ("public_id");--> statement-breakpoint
CREATE INDEX "law_practice_patent_citation_event_org_id_btree_idx" ON "law_practice_patent_citation_event" ("org_id");--> statement-breakpoint
CREATE INDEX "law_practice_patent_citation_event_source_btree_idx" ON "law_practice_patent_citation_event" ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "law_practice_patent_citation_event_public_id_unique_idx" ON "law_practice_patent_citation_event" ("public_id");--> statement-breakpoint
CREATE INDEX "law_practice_power_exercise_org_id_btree_idx" ON "law_practice_power_exercise" ("org_id");--> statement-breakpoint
CREATE INDEX "law_practice_power_exercise_source_btree_idx" ON "law_practice_power_exercise" ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "law_practice_power_exercise_public_id_unique_idx" ON "law_practice_power_exercise" ("public_id");--> statement-breakpoint
CREATE INDEX "workspace_message_org_id_btree_idx" ON "workspace_message" ("org_id");--> statement-breakpoint
CREATE INDEX "workspace_message_source_btree_idx" ON "workspace_message" ("source");--> statement-breakpoint
CREATE INDEX "workspace_message_role_lookup_idx" ON "workspace_message" ("role");--> statement-breakpoint
CREATE INDEX "workspace_message_thread_id_btree_idx" ON "workspace_message" ("thread_id");--> statement-breakpoint
CREATE INDEX "workspace_message_turn_id_btree_idx" ON "workspace_message" ("turn_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_message_public_id_unique_idx" ON "workspace_message" ("public_id");--> statement-breakpoint
CREATE INDEX "workspace_thread_org_id_btree_idx" ON "workspace_thread" ("org_id");--> statement-breakpoint
CREATE INDEX "workspace_thread_source_btree_idx" ON "workspace_thread" ("source");--> statement-breakpoint
CREATE INDEX "workspace_thread_workspace_id_btree_idx" ON "workspace_thread" ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_thread_public_id_unique_idx" ON "workspace_thread" ("public_id");--> statement-breakpoint
CREATE INDEX "workspace_turn_org_id_btree_idx" ON "workspace_turn" ("org_id");--> statement-breakpoint
CREATE INDEX "workspace_turn_source_btree_idx" ON "workspace_turn" ("source");--> statement-breakpoint
CREATE INDEX "workspace_turn_parent_turn_id_btree_idx" ON "workspace_turn" ("parent_turn_id");--> statement-breakpoint
CREATE INDEX "workspace_turn_thread_id_btree_idx" ON "workspace_turn" ("thread_id");--> statement-breakpoint
CREATE INDEX "workspace_turn_turn_index_btree_idx" ON "workspace_turn" ("turn_index");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_turn_public_id_unique_idx" ON "workspace_turn" ("public_id");--> statement-breakpoint
CREATE INDEX "workspace_workspace_org_id_btree_idx" ON "workspace_workspace" ("org_id");--> statement-breakpoint
CREATE INDEX "workspace_workspace_source_btree_idx" ON "workspace_workspace" ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_workspace_public_id_unique_idx" ON "workspace_workspace" ("public_id");