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
CREATE INDEX "epistemic_evidence_verification_org_id_btree_idx" ON "epistemic_evidence_verification" ("org_id");--> statement-breakpoint
CREATE INDEX "epistemic_evidence_verification_source_btree_idx" ON "epistemic_evidence_verification" ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "epistemic_evidence_verification_public_id_unique_idx" ON "epistemic_evidence_verification" ("public_id");--> statement-breakpoint
CREATE INDEX "epistemic_evidence_verification_as_of_idx"
	ON "epistemic_evidence_verification" ("org_id", "evidence_id", "created_at", "id");--> statement-breakpoint
ALTER TABLE "epistemic_evidence"
	ADD CONSTRAINT "epistemic_evidence_org_id_id_unique"
	UNIQUE ("org_id", "id");--> statement-breakpoint
ALTER TABLE "epistemic_evidence_verification"
	ADD CONSTRAINT "epistemic_evidence_verification_evidence_fk"
	FOREIGN KEY ("org_id", "evidence_id")
	REFERENCES "epistemic_evidence" ("org_id", "id");--> statement-breakpoint
ALTER TABLE "epistemic_evidence_verification"
	ADD CONSTRAINT "epistemic_evidence_verification_manifestation_unique"
	UNIQUE ("org_id", "manifestation_key");--> statement-breakpoint
ALTER TABLE "epistemic_evidence_verification"
	ADD CONSTRAINT "epistemic_evidence_verification_manifestation_sha256"
	CHECK ("manifestation_key" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
CREATE FUNCTION epistemic_evidence_verification_block_mutation() RETURNS trigger
LANGUAGE plpgsql AS $guard$
BEGIN
	RAISE EXCEPTION 'epistemic evidence verification records are append-only: % on %', TG_OP, TG_TABLE_NAME;
END;
$guard$;--> statement-breakpoint
CREATE TRIGGER epistemic_evidence_verification_append_only
	BEFORE UPDATE OR DELETE ON "epistemic_evidence_verification"
	FOR EACH ROW EXECUTE FUNCTION epistemic_evidence_verification_block_mutation();--> statement-breakpoint
CREATE TRIGGER epistemic_evidence_verification_block_truncate
	BEFORE TRUNCATE ON "epistemic_evidence_verification"
	FOR EACH STATEMENT EXECUTE FUNCTION epistemic_evidence_verification_block_mutation();
