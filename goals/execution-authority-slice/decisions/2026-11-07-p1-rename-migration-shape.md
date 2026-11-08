---
title: "Rename migration covers named NOT NULL constraints; guard body unchanged; down.sql sits beside migration.sql"
date: 2026-11-07
lane: "feat/execution-authority-slice"
reversal: "Run drizzle/20261107032821_execution_authority_rename/down.sql, then delete the folder and re-sync the desktop bundle"
---

The forward migration renames both tables, every constraint through one DO block (PostgreSQL 18 names NOT NULL constraints, which ALTER TABLE RENAME leaves alone; the block is a single line, safe for the LegacyStatementBoundary splitter), the four triggers and the guard function. The function body and its RAISE text are unchanged, so behavior stays byte-identical. down.sql is the exact inverse. The drizzle migrator and the desktop bundler read only migration.sql, so down.sql is never applied automatically. ExecutionAuthorityLedgerMigration.pglite.test.ts seeds a pre-move database with an allowed-denied-allowed chain and two outcomes, migrates it forward, verifies the chain and outcome bindings, runs down.sql and checks that the old names and row counts are back. The db-admin target is renamed to execution-authority-ledger with schemaName execution_authority.
