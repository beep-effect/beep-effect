---
title: In-memory bundle journal rows mirror drizzle readMigrationFiles field for field
date: 2026-11-26
reversal: Journal bundle migrations with hash "", as drizzle's own no-fs SQLite migrators do.
governs:
  - src/PostgresDrizzle.service.ts#migrationMetaFromBundleEntry
enforcedBy: []
---

`migrationMetaFromBundleEntry` derives each `MigrationMeta` from `{ name, sql }` exactly as drizzle-orm's `readMigrationFiles` (migrator.js) does: `hash` is the sha256 of the raw file content, `folderMillis` comes from the 14-digit name prefix through drizzle's `formatToMillis`, and `sql` is split on the statement-breakpoint marker. Deriving at runtime makes a hash/sql mismatch unrepresentable, and bundle rows stay byte-identical to folder-derived ones.
Reason: the real hash keeps the v0 to v1 journal upgrade viable, since that upgrade matches legacy rows by millis and then hash, and keeps bundle-migrated databases reconcilable with drizzle-kit-migrated ones.
Rejected: `hash: ""`, as drizzle's own no-fs SQLite migrators write, which breaks the legacy-row match.
