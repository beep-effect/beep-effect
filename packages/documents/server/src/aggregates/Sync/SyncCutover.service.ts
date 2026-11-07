/**
 * Offline backup and reversal primitives for the vault-sync writer transition.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $DocumentsServerId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { markSyncCutoverWriter } from "./SyncWriterEpoch.service.ts";

const $I = $DocumentsServerId.create("aggregates/Sync/SyncCutover.service");
const entities = ["item", "operation", "conflict", "cursor"] as const;
const State = S.Array(S.Struct({ phase: S.Literals(["backed-up", "restored"]), import_id: S.String }));
/**
 * Rejects a mismatched import or a reversal without a verified backup.
 *
 * **Example** (Inspect a refusal)
 * ```ts
 * import { SyncCutoverRejected } from "@beep/documents-server/aggregates/Sync";
 * const refusal = SyncCutoverRejected.make({ reason: "backup-required" });
 * console.log(refusal.reason);
 * ```
 * @category errors
 * @since 0.0.0
 */
export class SyncCutoverRejected extends S.TaggedError<SyncCutoverRejected, { readonly brand: unique symbol }>()(
  "SyncCutoverRejected",
  {
    reason: S.String,
  },
  $I.annote("SyncCutoverRejected", { description: "An offline sync backup or reversal precondition was not met." })
) {}

/**
 * Captures all four tables and sequence positions atomically before any importer runs.
 *
 * **Details**
 * The caller must own the offline store. The database locks exclude concurrent SQL
 * writes during the snapshot. A rerun retains the first backup; another import id
 * is refused. Backups live in the same protected database and contain private data.
 * This primitive does not activate the Model or authorize automatic rollback after admission.
 *
 * **Example** (Prepare an offline backup)
 * ```ts
 * import { backupSyncTables } from "@beep/documents-server/aggregates/Sync";
 * const backup = backupSyncTables("synthetic-import-v1");
 * void backup;
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const backupSyncTables = Effect.fn($I`backupSyncTables`)(function* (importId: string) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql.withTransaction(
    Effect.gen(function* () {
      yield* sql`CREATE TABLE IF NOT EXISTS documents_sync_cutover_backup (
      singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton), import_id text NOT NULL,
      phase text NOT NULL CHECK (phase IN ('backed-up', 'restored')))`;
      yield* sql`LOCK TABLE documents_sync_cutover_backup IN ACCESS EXCLUSIVE MODE`;
      const state = yield* sql`SELECT phase, import_id FROM documents_sync_cutover_backup`.pipe(
        Effect.flatMap(S.decodeUnknownEffect(State))
      );
      if (A.isReadonlyArrayNonEmpty(state)) {
        if (state[0].import_id !== importId || state[0].phase !== "backed-up")
          return yield* SyncCutoverRejected.make({ reason: "backup-belongs-to-another-import-or-was-restored" });
        return;
      }
      for (const entity of entities) yield* sql`LOCK TABLE ${sql(`documents_sync_${entity}`)} IN ACCESS EXCLUSIVE MODE`;
      yield* sql`CREATE TABLE documents_sync_cutover_sequence_backup (entity text PRIMARY KEY, last_value bigint NOT NULL, is_called boolean NOT NULL)`;
      for (const entity of entities) {
        const table = `documents_sync_${entity}`;
        yield* sql`CREATE TABLE ${sql(`${table}_cutover_backup`)} AS TABLE ${sql(table)}`;
        yield* sql`INSERT INTO documents_sync_cutover_sequence_backup SELECT ${entity}, last_value, is_called FROM ${sql(`${table}_id_seq`)}`;
      }
      yield* sql`INSERT INTO documents_sync_cutover_backup (import_id, phase) VALUES (${importId}, 'backed-up')`;
    })
  );
});

/**
 * Restores the pre-admission tables and their original sequence positions atomically.
 *
 * **Gotchas**
 * Call only while all writers and workers are stopped and before new commands have
 * been admitted. Post-admission reversal requires a new current-state backup and
 * event high-water reconciliation; restoring this snapshot would lose accepted work.
 * The preserved backup remains available for diagnosis after restoration.
 *
 * **Example** (Reverse an offline import)
 * ```ts
 * import { restoreSyncTables } from "@beep/documents-server/aggregates/Sync";
 * const reversal = restoreSyncTables("synthetic-import-v1");
 * void reversal;
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const restoreSyncTables = Effect.fn($I`restoreSyncTables`)(function* (importId: string) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql.withTransaction(
    Effect.gen(function* () {
      const exists = yield* sql`SELECT to_regclass('documents_sync_cutover_backup') AS name`;
      if (exists[0]?.name === null) return yield* SyncCutoverRejected.make({ reason: "backup-required" });
      yield* sql`LOCK TABLE documents_sync_cutover_backup IN ACCESS EXCLUSIVE MODE`;
      const state = yield* sql`SELECT phase, import_id FROM documents_sync_cutover_backup`.pipe(
        Effect.flatMap(S.decodeUnknownEffect(State))
      );
      if (!A.isReadonlyArrayNonEmpty(state) || state[0].import_id !== importId)
        return yield* SyncCutoverRejected.make({ reason: "backup-required" });
      if (state[0].phase === "restored") return;
      yield* markSyncCutoverWriter;
      for (const entity of entities) yield* sql`LOCK TABLE ${sql(`documents_sync_${entity}`)} IN ACCESS EXCLUSIVE MODE`;
      // DELETE retains the table contract, indexes, constraints, and dependent readers.
      for (const entity of ["conflict", "operation", "cursor", "item"])
        yield* sql`DELETE FROM ${sql(`documents_sync_${entity}`)}`;
      for (const entity of entities) {
        const table = `documents_sync_${entity}`;
        yield* sql`INSERT INTO ${sql(table)} SELECT * FROM ${sql(`${table}_cutover_backup`)}`;
        yield* sql`SELECT setval(${`${table}_id_seq`}::regclass, last_value, is_called)
        FROM documents_sync_cutover_sequence_backup WHERE entity = ${entity}`;
      }
      yield* sql`UPDATE documents_sync_cutover_backup SET phase = 'restored' WHERE import_id = ${importId}`;
    })
  );
});
