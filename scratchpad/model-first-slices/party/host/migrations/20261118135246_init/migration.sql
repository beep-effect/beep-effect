CREATE TABLE "party_directory_active" (
	"slot" integer PRIMARY KEY,
	"generation" integer NOT NULL,
	CONSTRAINT "party_directory_active_single_row" CHECK ("slot" = 1)
);
--> statement-breakpoint
CREATE TABLE "party_directory_positions" (
	"generation" integer,
	"stream" text,
	"seq" integer NOT NULL,
	CONSTRAINT "party_directory_positions_pk" PRIMARY KEY("generation","stream")
);
--> statement-breakpoint
CREATE TABLE "party_directory_rows_v_0" (
	"party_id" text PRIMARY KEY,
	"org" text NOT NULL,
	"name" text NOT NULL,
	"absorbed" text[] NOT NULL
);
--> statement-breakpoint
CREATE INDEX "party_directory_rows_v_0_org_btree_idx" ON "party_directory_rows_v_0" ("org");