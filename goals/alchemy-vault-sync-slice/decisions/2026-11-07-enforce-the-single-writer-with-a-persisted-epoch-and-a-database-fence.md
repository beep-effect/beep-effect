---
title: "Enforce the single writer with a persisted epoch and a database fence"
date: 2026-11-07
lane: "goals/vault-sync-cutover"
reversal: "Drop the four documents_sync_*_writer_fence triggers, the fence function and documents_sync_writer_epoch, after a reversal has returned the store to the legacy epoch"
---

The migrated store records its writer in `documents_sync_writer_epoch` (legacy, migrating or model, plus a reversal generation and the admitted import id). A statement-level trigger on the four legacy tables reads it: under `migrating` or `model` it refuses any transaction that does not carry the `beep.documents_sync_writer = model` marker, and under `legacy` it refuses the marker. Only the alchemy projections set the marker, inside their checkpoint transactions; the offline backup, restore and reversal procedures use a separate `cutover` marker.

**Why the database, not a startup check.** An older sidecar executable knows nothing about a check added later. It boots, re-runs its bundled drizzle migrations and writes through its repositories; every one of those statements reaches the trigger and fails. `SyncCutoverAdmission.pglite.test.ts` boots the real drizzle migrations, admits, then proves raw SQL, ORM-generated SQL and a re-run of the old migrations all fail, while the Model writer keeps working. New code also guards entry points with `requireSyncWriterEpoch`, which fails with the typed `SyncWriterEpochRejected`.

**Why runtime DDL, not a drizzle migration.** The epoch table, the fence and the D14 identity table are cutover state owned by the documents server, created idempotently at admission like the alchemy driver's own tables. The drizzle target keeps describing the four retained table contracts unchanged (D15), so the desktop migration bundle needs no refresh. The down path is the tested post-admission reversal, which leaves the fence armed under the legacy epoch so the abandoned Model cannot write.
