ALTER TABLE "epistemic_usage_record" ALTER COLUMN "activity_id" DROP NOT NULL;
--> statement-breakpoint
UPDATE "epistemic_usage_record" SET "activity_id" = NULL WHERE "activity_id" IS NOT NULL;
