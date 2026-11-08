CREATE TABLE "shared_membership" (
	"created_at" bigint NOT NULL,
	"row_version" integer DEFAULT 1 NOT NULL,
	"updated_at" bigint NOT NULL,
	"created_by_principal" jsonb NOT NULL,
	"deleted_at" bigint,
	"deleted_by_principal" jsonb,
	"schema_version" text NOT NULL,
	"source" text NOT NULL,
	"updated_by_principal" jsonb NOT NULL,
	"org_id" integer NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"user_id" integer NOT NULL,
	"entity_type" text NOT NULL,
	"id" serial PRIMARY KEY,
	"public_id" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "shared_membership_source_btree_idx" ON "shared_membership" ("source");--> statement-breakpoint
CREATE INDEX "shared_membership_org_id_btree_idx" ON "shared_membership" ("org_id");--> statement-breakpoint
CREATE INDEX "shared_membership_user_id_btree_idx" ON "shared_membership" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shared_membership_public_id_unique_idx" ON "shared_membership" ("public_id");