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
CREATE INDEX "epistemic_contradiction_candidate_org_id_btree_idx" ON "epistemic_contradiction_candidate" ("org_id");--> statement-breakpoint
CREATE INDEX "epistemic_contradiction_candidate_source_btree_idx" ON "epistemic_contradiction_candidate" ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "epistemic_contradiction_candidate_org_key_unique_idx" ON "epistemic_contradiction_candidate" ("org_id", "candidate_key");--> statement-breakpoint
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
CREATE UNIQUE INDEX "epistemic_contradiction_receipt_org_id_receipt_key_unique_idx" ON "epistemic_contradiction_receipt" ("org_id", "receipt_key");--> statement-breakpoint
CREATE UNIQUE INDEX "epistemic_contradiction_receipt_public_id_unique_idx" ON "epistemic_contradiction_receipt" ("public_id");--> statement-breakpoint
ALTER TABLE "epistemic_contradiction_candidate"
	ADD CONSTRAINT "epistemic_contradiction_candidate_valid_interval_ordered"
	CHECK ("valid_to" IS NULL OR "valid_from" < "valid_to");--> statement-breakpoint
ALTER TABLE "epistemic_contradiction_candidate"
	ADD CONSTRAINT "epistemic_contradiction_candidate_key_sha256"
	CHECK ("candidate_key" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "epistemic_contradiction_candidate"
	ADD CONSTRAINT "epistemic_contradiction_candidate_digest_sha256"
	CHECK ("candidate_digest" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "epistemic_contradiction_receipt"
	ADD CONSTRAINT "epistemic_contradiction_receipt_key_sha256"
	CHECK ("receipt_key" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "epistemic_contradiction_candidate"
	ADD CONSTRAINT "epistemic_contradiction_candidate_org_id_id_unique"
	UNIQUE ("org_id", "id");--> statement-breakpoint
ALTER TABLE "epistemic_contradiction_receipt"
	ADD CONSTRAINT "epistemic_contradiction_receipt_candidate_fk"
	FOREIGN KEY ("org_id", "candidate_id")
	REFERENCES "epistemic_contradiction_candidate" ("org_id", "id");--> statement-breakpoint
ALTER TABLE "epistemic_contradiction_disposition"
	ADD CONSTRAINT "epistemic_contradiction_disposition_candidate_fk"
	FOREIGN KEY ("org_id", "candidate_id")
	REFERENCES "epistemic_contradiction_candidate" ("org_id", "id");--> statement-breakpoint
ALTER TABLE "epistemic_contradiction_disposition"
	ADD CONSTRAINT "epistemic_contradiction_disposition_decision_valid"
	CHECK (
		jsonb_typeof("decision") = 'object'
		AND "decision" ? 'status'
		AND jsonb_typeof("decision" -> 'status') = 'string'
		AND "decision" ->> 'status' IN ('rejected', 'superseded')
		AND "decision" ? 'reason'
		AND jsonb_typeof("decision" -> 'reason') = 'string'
		AND char_length("decision" ->> 'reason') BETWEEN 1 AND 2000
		AND "decision" ->> 'reason' ~ '[^[:space:]]'
		AND CASE "decision" ->> 'status'
			WHEN 'rejected' THEN TRUE
			WHEN 'superseded' THEN
				"decision" ? 'formerEdgeVersionId'
				AND jsonb_typeof("decision" -> 'formerEdgeVersionId') = 'number'
				AND "decision" ->> 'formerEdgeVersionId' ~ '^[1-9][0-9]*$'
				AND "decision" ? 'proposalDigest'
				AND jsonb_typeof("decision" -> 'proposalDigest') = 'string'
				AND "decision" ->> 'proposalDigest' ~ '^[0-9a-f]{64}$'
				AND "decision" ? 'proposalId'
				AND jsonb_typeof("decision" -> 'proposalId') = 'string'
				AND "decision" ->> 'proposalId' ~ '^[0-9a-f]{64}$'
				AND "decision" ? 'replacementEdgeVersionId'
				AND jsonb_typeof("decision" -> 'replacementEdgeVersionId') = 'number'
				AND "decision" ->> 'replacementEdgeVersionId' ~ '^[1-9][0-9]*$'
			ELSE FALSE
		END
	);--> statement-breakpoint
CREATE FUNCTION epistemic_contradiction_block_mutation() RETURNS trigger
LANGUAGE plpgsql AS $guard$
BEGIN
	RAISE EXCEPTION 'epistemic contradiction records are append-only: % on %', TG_OP, TG_TABLE_NAME;
END;
$guard$;--> statement-breakpoint
CREATE TRIGGER epistemic_contradiction_candidate_append_only
	BEFORE UPDATE OR DELETE ON "epistemic_contradiction_candidate"
	FOR EACH ROW EXECUTE FUNCTION epistemic_contradiction_block_mutation();--> statement-breakpoint
CREATE TRIGGER epistemic_contradiction_receipt_append_only
	BEFORE UPDATE OR DELETE ON "epistemic_contradiction_receipt"
	FOR EACH ROW EXECUTE FUNCTION epistemic_contradiction_block_mutation();--> statement-breakpoint
CREATE TRIGGER epistemic_contradiction_disposition_append_only
	BEFORE UPDATE OR DELETE ON "epistemic_contradiction_disposition"
	FOR EACH ROW EXECUTE FUNCTION epistemic_contradiction_block_mutation();--> statement-breakpoint
CREATE TRIGGER epistemic_contradiction_candidate_block_truncate
	BEFORE TRUNCATE ON "epistemic_contradiction_candidate"
	FOR EACH STATEMENT EXECUTE FUNCTION epistemic_contradiction_block_mutation();--> statement-breakpoint
CREATE TRIGGER epistemic_contradiction_receipt_block_truncate
	BEFORE TRUNCATE ON "epistemic_contradiction_receipt"
	FOR EACH STATEMENT EXECUTE FUNCTION epistemic_contradiction_block_mutation();--> statement-breakpoint
CREATE TRIGGER epistemic_contradiction_disposition_block_truncate
	BEFORE TRUNCATE ON "epistemic_contradiction_disposition"
	FOR EACH STATEMENT EXECUTE FUNCTION epistemic_contradiction_block_mutation();
