CREATE TABLE "runs_inbox_checkpoints" (
	"producer" text PRIMARY KEY,
	"seq" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs_inbox_seen" (
	"key" text PRIMARY KEY
);
