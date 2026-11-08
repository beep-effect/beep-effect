-- Down: restore the epistemic_execution_ names. Not applied by the migrator; db-admin test ExecutionAuthorityLedgerMigration runs it to prove the reversal.
-- Table names, constraint names (including PostgreSQL 18's named NOT NULL
-- constraints and the indexes behind PRIMARY KEY and UNIQUE), trigger names and
-- the append-only guard function move together. Rows, columns, hash inputs and
-- the guard function body are unchanged. RENAME is DDL, so the append-only
-- triggers, which fire on row UPDATE, DELETE and TRUNCATE only, do not block it.
ALTER TABLE "execution_authority_decision" RENAME TO "epistemic_execution_decision";--> statement-breakpoint
ALTER TABLE "execution_authority_outcome" RENAME TO "epistemic_execution_outcome";--> statement-breakpoint
DO $rename$ DECLARE c record; BEGIN FOR c IN SELECT conrelid::regclass::text AS rel, conname FROM pg_constraint WHERE conrelid IN ('"epistemic_execution_decision"'::regclass, '"epistemic_execution_outcome"'::regclass) AND starts_with(conname, 'execution_authority_') ORDER BY conname LOOP EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I', c.rel, c.conname, 'epistemic_execution_' || substr(c.conname, 21)); END LOOP; END $rename$;--> statement-breakpoint
ALTER TRIGGER "execution_authority_decision_append_only" ON "epistemic_execution_decision" RENAME TO "epistemic_execution_decision_append_only";--> statement-breakpoint
ALTER TRIGGER "execution_authority_decision_block_truncate" ON "epistemic_execution_decision" RENAME TO "epistemic_execution_decision_block_truncate";--> statement-breakpoint
ALTER TRIGGER "execution_authority_outcome_append_only" ON "epistemic_execution_outcome" RENAME TO "epistemic_execution_outcome_append_only";--> statement-breakpoint
ALTER TRIGGER "execution_authority_outcome_block_truncate" ON "epistemic_execution_outcome" RENAME TO "epistemic_execution_outcome_block_truncate";--> statement-breakpoint
ALTER FUNCTION execution_authority_ledger_block_mutation() RENAME TO epistemic_execution_ledger_block_mutation;
