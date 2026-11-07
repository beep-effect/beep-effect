-- Down path for 20261107120500_shared_membership. drizzle-kit is forward-only; this file is not
-- part of the migration bundle and is applied only by an explicit rollback (see the integration test).
DROP INDEX IF EXISTS "shared_membership_public_id_unique_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "shared_membership_user_id_btree_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "shared_membership_org_id_btree_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "shared_membership_source_btree_idx";--> statement-breakpoint
DROP TABLE IF EXISTS "shared_membership";--> statement-breakpoint
DELETE FROM "drizzle"."__drizzle_migrations" WHERE "name" = '20261107120500_shared_membership';
