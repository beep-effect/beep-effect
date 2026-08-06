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
CREATE INDEX "law_practice_candor_disposition_org_id_btree_idx" ON "law_practice_candor_disposition" ("org_id");--> statement-breakpoint
CREATE INDEX "law_practice_candor_disposition_source_btree_idx" ON "law_practice_candor_disposition" ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "law_practice_candor_disposition_public_id_unique_idx" ON "law_practice_candor_disposition" ("public_id");--> statement-breakpoint
CREATE INDEX "law_practice_ids_submission_fact_org_id_btree_idx" ON "law_practice_ids_submission_fact" ("org_id");--> statement-breakpoint
CREATE INDEX "law_practice_ids_submission_fact_source_btree_idx" ON "law_practice_ids_submission_fact" ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "law_practice_ids_submission_fact_public_id_unique_idx" ON "law_practice_ids_submission_fact" ("public_id");--> statement-breakpoint
CREATE INDEX "law_practice_patent_citation_event_org_id_btree_idx" ON "law_practice_patent_citation_event" ("org_id");--> statement-breakpoint
CREATE INDEX "law_practice_patent_citation_event_source_btree_idx" ON "law_practice_patent_citation_event" ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "law_practice_patent_citation_event_public_id_unique_idx" ON "law_practice_patent_citation_event" ("public_id");
--> statement-breakpoint
ALTER TABLE "law_practice_candor_disposition"
	ADD CONSTRAINT "law_practice_candor_disposition_org_id_id_unique"
	UNIQUE ("org_id", "id");
--> statement-breakpoint
ALTER TABLE "law_practice_patent_citation_event"
	ADD CONSTRAINT "law_practice_patent_citation_event_org_id_id_unique"
	UNIQUE ("org_id", "id");
--> statement-breakpoint
ALTER TABLE "law_practice_candor_disposition"
	ADD CONSTRAINT "law_practice_candor_disposition_supersedes_fk"
	FOREIGN KEY ("org_id", "supersedes")
	REFERENCES "law_practice_candor_disposition" ("org_id", "id");
--> statement-breakpoint
ALTER TABLE "law_practice_patent_citation_event"
	ADD CONSTRAINT "law_practice_patent_citation_event_possible_duplicate_fk"
	FOREIGN KEY ("org_id", "possible_duplicate_of")
	REFERENCES "law_practice_patent_citation_event" ("org_id", "id");
--> statement-breakpoint
CREATE FUNCTION law_practice_candor_block_mutation() RETURNS trigger
LANGUAGE plpgsql AS $guard$
BEGIN
	RAISE EXCEPTION 'law practice candor records are append-only: % on %', TG_OP, TG_TABLE_NAME;
END;
$guard$;
--> statement-breakpoint
CREATE TRIGGER law_practice_patent_citation_event_append_only
	BEFORE UPDATE OR DELETE ON "law_practice_patent_citation_event"
	FOR EACH ROW EXECUTE FUNCTION law_practice_candor_block_mutation();
--> statement-breakpoint
CREATE TRIGGER law_practice_patent_citation_event_block_truncate
	BEFORE TRUNCATE ON "law_practice_patent_citation_event"
	FOR EACH STATEMENT EXECUTE FUNCTION law_practice_candor_block_mutation();
--> statement-breakpoint
CREATE TRIGGER law_practice_candor_disposition_append_only
	BEFORE UPDATE OR DELETE ON "law_practice_candor_disposition"
	FOR EACH ROW EXECUTE FUNCTION law_practice_candor_block_mutation();
--> statement-breakpoint
CREATE TRIGGER law_practice_candor_disposition_block_truncate
	BEFORE TRUNCATE ON "law_practice_candor_disposition"
	FOR EACH STATEMENT EXECUTE FUNCTION law_practice_candor_block_mutation();
--> statement-breakpoint
CREATE TRIGGER law_practice_ids_submission_fact_append_only
	BEFORE UPDATE OR DELETE ON "law_practice_ids_submission_fact"
	FOR EACH ROW EXECUTE FUNCTION law_practice_candor_block_mutation();
--> statement-breakpoint
CREATE TRIGGER law_practice_ids_submission_fact_block_truncate
	BEFORE TRUNCATE ON "law_practice_ids_submission_fact"
	FOR EACH STATEMENT EXECUTE FUNCTION law_practice_candor_block_mutation();
