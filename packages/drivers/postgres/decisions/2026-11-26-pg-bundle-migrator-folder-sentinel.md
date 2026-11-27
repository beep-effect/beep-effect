---
title: migrateBundle hands the pg session migrator a sentinel migrations folder
date: 2026-11-26
reversal: Write the bundle to a temporary migrations folder and run the folder migrator on it.
governs:
  - src/PostgresDrizzle.service.ts#runPgEffectMigrations
  - src/PostgresDrizzle.service.ts#InMemoryBundleFolderSentinel
enforcedBy: []
---

The pg Effect session migrator reads only `migrationsTable`, `migrationsSchema` and `init` from its config and never dereferences `migrationsFolder`, so `migrateBundle` passes `InMemoryBundleFolderSentinel` instead of a real folder. `runPgEffectMigrations` casts `PgEffectSessionMigrator.migrate` because the Effect migrator and session surface of drizzle-orm 1.0.0-rc.5 is still RC-shaped.
Rejected: materializing the bundle into a temporary migrations folder, which adds filesystem writes and cleanup to a path whose input is already in memory.
Accepted limit: transitional. Drop the sentinel once the pg session migrator takes `Omit<MigrationConfig, "migrationsFolder">`, as drizzle's SQLite session migrators already do, and revisit the casts when drizzle's final Effect integration API ships.
