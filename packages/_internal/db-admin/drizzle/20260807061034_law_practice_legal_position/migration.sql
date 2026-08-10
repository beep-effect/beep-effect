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
CREATE INDEX "law_practice_act_frame_org_id_btree_idx" ON "law_practice_act_frame" ("org_id");--> statement-breakpoint
CREATE INDEX "law_practice_act_frame_source_btree_idx" ON "law_practice_act_frame" ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "law_practice_act_frame_public_id_unique_idx" ON "law_practice_act_frame" ("public_id");--> statement-breakpoint
CREATE INDEX "law_practice_correction_delta_org_id_btree_idx" ON "law_practice_correction_delta" ("org_id");--> statement-breakpoint
CREATE INDEX "law_practice_correction_delta_source_btree_idx" ON "law_practice_correction_delta" ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "law_practice_correction_delta_public_id_unique_idx" ON "law_practice_correction_delta" ("public_id");--> statement-breakpoint
CREATE INDEX "law_practice_legal_opposition_candidate_org_id_btree_idx" ON "law_practice_legal_opposition_candidate" ("org_id");--> statement-breakpoint
CREATE INDEX "law_practice_legal_opposition_candidate_source_btree_idx" ON "law_practice_legal_opposition_candidate" ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "law_practice_legal_opposition_candidate_public_id_unique_idx" ON "law_practice_legal_opposition_candidate" ("public_id");--> statement-breakpoint
CREATE INDEX "law_practice_legal_position_relator_org_id_btree_idx" ON "law_practice_legal_position_relator" ("org_id");--> statement-breakpoint
CREATE INDEX "law_practice_legal_position_relator_source_btree_idx" ON "law_practice_legal_position_relator" ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "law_practice_legal_position_relator_public_id_unique_idx" ON "law_practice_legal_position_relator" ("public_id");--> statement-breakpoint
CREATE INDEX "law_practice_power_exercise_org_id_btree_idx" ON "law_practice_power_exercise" ("org_id");--> statement-breakpoint
CREATE INDEX "law_practice_power_exercise_source_btree_idx" ON "law_practice_power_exercise" ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "law_practice_power_exercise_public_id_unique_idx" ON "law_practice_power_exercise" ("public_id");
--> statement-breakpoint
CREATE FUNCTION law_practice_legal_position_block_mutation() RETURNS trigger
LANGUAGE plpgsql AS $guard$
BEGIN
	RAISE EXCEPTION 'law practice legal position records are append-only: % on %', TG_OP, TG_TABLE_NAME;
END;
$guard$;
--> statement-breakpoint
CREATE TRIGGER law_practice_legal_position_relator_append_only
	BEFORE UPDATE OR DELETE ON "law_practice_legal_position_relator"
	FOR EACH ROW EXECUTE FUNCTION law_practice_legal_position_block_mutation();
--> statement-breakpoint
CREATE TRIGGER law_practice_legal_position_relator_block_truncate
	BEFORE TRUNCATE ON "law_practice_legal_position_relator"
	FOR EACH STATEMENT EXECUTE FUNCTION law_practice_legal_position_block_mutation();
--> statement-breakpoint
CREATE TRIGGER law_practice_act_frame_append_only
	BEFORE UPDATE OR DELETE ON "law_practice_act_frame"
	FOR EACH ROW EXECUTE FUNCTION law_practice_legal_position_block_mutation();
--> statement-breakpoint
CREATE TRIGGER law_practice_act_frame_block_truncate
	BEFORE TRUNCATE ON "law_practice_act_frame"
	FOR EACH STATEMENT EXECUTE FUNCTION law_practice_legal_position_block_mutation();
--> statement-breakpoint
CREATE TRIGGER law_practice_power_exercise_append_only
	BEFORE UPDATE OR DELETE ON "law_practice_power_exercise"
	FOR EACH ROW EXECUTE FUNCTION law_practice_legal_position_block_mutation();
--> statement-breakpoint
CREATE TRIGGER law_practice_power_exercise_block_truncate
	BEFORE TRUNCATE ON "law_practice_power_exercise"
	FOR EACH STATEMENT EXECUTE FUNCTION law_practice_legal_position_block_mutation();
--> statement-breakpoint
CREATE TRIGGER law_practice_correction_delta_append_only
	BEFORE UPDATE OR DELETE ON "law_practice_correction_delta"
	FOR EACH ROW EXECUTE FUNCTION law_practice_legal_position_block_mutation();
--> statement-breakpoint
CREATE TRIGGER law_practice_correction_delta_block_truncate
	BEFORE TRUNCATE ON "law_practice_correction_delta"
	FOR EACH STATEMENT EXECUTE FUNCTION law_practice_legal_position_block_mutation();
--> statement-breakpoint
CREATE TRIGGER law_practice_legal_opposition_candidate_append_only
	BEFORE UPDATE OR DELETE ON "law_practice_legal_opposition_candidate"
	FOR EACH ROW EXECUTE FUNCTION law_practice_legal_position_block_mutation();
--> statement-breakpoint
CREATE TRIGGER law_practice_legal_opposition_candidate_block_truncate
	BEFORE TRUNCATE ON "law_practice_legal_opposition_candidate"
	FOR EACH STATEMENT EXECUTE FUNCTION law_practice_legal_position_block_mutation();
