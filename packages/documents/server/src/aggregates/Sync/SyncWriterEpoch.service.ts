/**
 * Persisted single-writer epoch for the four legacy vault-sync tables.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $DocumentsServerId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

const $I = $DocumentsServerId.create("aggregates/Sync/SyncWriterEpoch.service");

/**
 * Lifecycle of the store's single writer.
 *
 * **Details**
 *
 * `legacy` admits only the drizzle-era writer, `migrating` admits only the
 * genesis import and its projections, and `model` admits only the alchemy
 * Model's projections. A store without an epoch row predates the cutover and
 * behaves as `legacy`.
 *
 * **Example** (Check an epoch)
 *
 * ```ts
 * import { SyncWriterEpoch } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(SyncWriterEpoch.is.model("model"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SyncWriterEpoch = LiteralKit(["legacy", "migrating", "model"]).pipe(
  $I.annoteSchema("SyncWriterEpoch", {
    description: "Lifecycle of the single writer admitted to the legacy vault-sync tables.",
  })
);

/**
 * Runtime type for {@link SyncWriterEpoch}.
 *
 * @category models
 * @since 0.0.0
 */
export type SyncWriterEpoch = typeof SyncWriterEpoch.Type;

/**
 * Writer identity that asks the epoch for admission.
 *
 * **Example** (Check a writer)
 *
 * ```ts
 * import { SyncWriter } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(SyncWriter.is.legacy("legacy"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SyncWriter = LiteralKit(["legacy", "model"]).pipe(
  $I.annoteSchema("SyncWriter", {
    description: "Writer identity that asks the persisted epoch for admission.",
  })
);

/**
 * Runtime type for {@link SyncWriter}.
 *
 * @category models
 * @since 0.0.0
 */
export type SyncWriter = typeof SyncWriter.Type;

/**
 * Persisted epoch row of one migrated store.
 *
 * **Example** (Construct an epoch state)
 *
 * ```ts
 * import { SyncWriterEpochState } from "@beep/documents-server/aggregates/Sync"
 *
 * const state = SyncWriterEpochState.make({ epoch: "model", generation: 0, importId: "v1-abc" })
 * console.log(state.epoch)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SyncWriterEpochState extends S.Opaque<SyncWriterEpochState, { readonly brand: unique symbol }>()(
  S.Struct({
    epoch: SyncWriterEpoch,
    generation: S.Int.annotateKey({ description: "Number of completed post-admission reversals." }),
    importId: S.NullOr(S.String).annotateKey({ description: "Genesis import admitted by this epoch, if any." }),
  }).pipe(
    $I.annoteSchema("SyncWriterEpochState", {
      description: "Persisted epoch row of one migrated vault-sync store.",
    })
  )
) {}

/**
 * A writer asked for admission under an epoch that does not admit it.
 *
 * **Example** (Inspect a refusal)
 *
 * ```ts
 * import { SyncWriterEpochRejected } from "@beep/documents-server/aggregates/Sync"
 *
 * const refusal = SyncWriterEpochRejected.make({ epoch: "model", writer: "legacy", reason: "writer-epoch" })
 * console.log(refusal.writer)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SyncWriterEpochRejected extends S.TaggedError<
  SyncWriterEpochRejected,
  { readonly brand: unique symbol }
>()(
  "SyncWriterEpochRejected",
  {
    epoch: SyncWriterEpoch,
    writer: SyncWriter,
    reason: S.String,
  },
  $I.annote("SyncWriterEpochRejected", {
    description: "A vault-sync writer asked for admission under an epoch that does not admit it.",
  })
) {}

const Rows = S.Array(S.Struct({ epoch: SyncWriterEpoch, generation: S.Int, import_id: S.NullOr(S.String) }));

/**
 * Session setting that identifies the writer of the current transaction.
 *
 * **Details**
 *
 * The fence trigger reads it with `current_setting`. Older executables never
 * set it, so every statement they issue against a migrated store is refused.
 *
 * @category constants
 * @since 0.0.0
 */
export const SyncWriterSetting = "beep.documents_sync_writer";

const fenceFunction = `CREATE OR REPLACE FUNCTION documents_sync_writer_fence() RETURNS trigger
LANGUAGE plpgsql AS $fence$
DECLARE
  current_epoch text;
  writer text := current_setting('${SyncWriterSetting}', true);
BEGIN
  SELECT epoch INTO current_epoch FROM documents_sync_writer_epoch;
  IF writer = 'cutover' THEN
    RETURN NULL;
  END IF;
  IF current_epoch IS NULL OR current_epoch = 'legacy' THEN
    IF writer = 'model' THEN
      RAISE EXCEPTION 'documents_sync_writer_epoch refused the model writer under epoch %',
        COALESCE(current_epoch, 'legacy') USING ERRCODE = 'P0001';
    END IF;
  ELSIF writer IS DISTINCT FROM 'model' THEN
    RAISE EXCEPTION 'documents_sync_writer_epoch refused a legacy writer under epoch %', current_epoch
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NULL;
END
$fence$`;

const fencedTables = ["item", "operation", "conflict", "cursor"] as const;

/**
 * Creates the epoch row table and the statement-level fence on the four tables.
 *
 * **Details**
 *
 * Idempotent. The fence is enforced by the database, so it also refuses an
 * older sidecar executable that knows nothing about epochs. The cutover
 * procedures mark their own transactions with {@link markSyncCutoverWriter}.
 *
 * **Example** (Prepare the fence)
 *
 * ```ts
 * import { installSyncWriterFence } from "@beep/documents-server/aggregates/Sync"
 *
 * void installSyncWriterFence
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const installSyncWriterFence = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`CREATE TABLE IF NOT EXISTS documents_sync_writer_epoch (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    epoch text NOT NULL CHECK (epoch IN ('legacy', 'migrating', 'model')),
    generation integer NOT NULL DEFAULT 0,
    import_id text,
    changed_at bigint NOT NULL
  )`;
  yield* sql.unsafe(fenceFunction);
  yield* Effect.forEach(
    fencedTables,
    (entity) =>
      sql.unsafe(`DO $install$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'documents_sync_${entity}_writer_fence') THEN
          CREATE TRIGGER documents_sync_${entity}_writer_fence
            BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON documents_sync_${entity}
            FOR EACH STATEMENT EXECUTE FUNCTION documents_sync_writer_fence();
        END IF;
      END $install$`),
    { discard: true }
  );
}).pipe(Effect.withSpan("SyncWriterEpoch.installFence"));

/**
 * Reads the persisted epoch; none means the store predates the cutover.
 *
 * **Example** (Read the epoch)
 *
 * ```ts
 * import { readSyncWriterEpoch } from "@beep/documents-server/aggregates/Sync"
 *
 * void readSyncWriterEpoch
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const readSyncWriterEpoch = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const exists = yield* sql`SELECT to_regclass('documents_sync_writer_epoch') IS NOT NULL AS present`.pipe(
    Effect.flatMap(S.decodeUnknownEffect(S.Tuple([S.Struct({ present: S.Boolean })])))
  );
  if (!exists[0].present) return O.none<SyncWriterEpochState>();
  const rows = yield* sql`SELECT epoch, generation, import_id FROM documents_sync_writer_epoch`.pipe(
    Effect.flatMap(S.decodeUnknownEffect(Rows))
  );
  return A.head(rows).pipe(
    O.map((row) => SyncWriterEpochState.make({ epoch: row.epoch, generation: row.generation, importId: row.import_id }))
  );
}).pipe(Effect.withSpan("SyncWriterEpoch.read"));

/**
 * Writes the epoch row inside the caller's cutover transaction.
 *
 * **Example** (Prepare an epoch transition)
 *
 * ```ts
 * import { SyncWriterEpochState, writeSyncWriterEpoch } from "@beep/documents-server/aggregates/Sync"
 *
 * void writeSyncWriterEpoch(SyncWriterEpochState.make({ epoch: "model", generation: 0, importId: null }), 0)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const writeSyncWriterEpoch = Effect.fn($I`writeSyncWriterEpoch`)(function* (
  state: SyncWriterEpochState,
  at: number
) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`INSERT INTO documents_sync_writer_epoch (epoch, generation, import_id, changed_at)
    VALUES (${state.epoch}, ${state.generation}, ${state.importId}, ${at})
    ON CONFLICT (singleton) DO UPDATE SET epoch = EXCLUDED.epoch, generation = EXCLUDED.generation,
      import_id = EXCLUDED.import_id, changed_at = EXCLUDED.changed_at`;
});

/**
 * Marks the current transaction as the alchemy Model's projection writer.
 *
 * **Gotchas**
 *
 * The setting is transaction-local; call it inside the same transaction as the writes.
 *
 * **Example** (Mark a projection transaction)
 *
 * ```ts
 * import { markSyncModelWriter } from "@beep/documents-server/aggregates/Sync"
 *
 * void markSyncModelWriter
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const markSyncModelWriter = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`SELECT set_config(${SyncWriterSetting}, 'model', true)`;
});

/**
 * Marks the current transaction as an offline cutover procedure.
 *
 * **Gotchas**
 *
 * Only backup, restore and reversal procedures, run with every writer stopped,
 * may use this marker.
 *
 * **Example** (Mark a cutover transaction)
 *
 * ```ts
 * import { markSyncCutoverWriter } from "@beep/documents-server/aggregates/Sync"
 *
 * void markSyncCutoverWriter
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const markSyncCutoverWriter = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`SELECT set_config(${SyncWriterSetting}, 'cutover', true)`;
});

const admits = (writer: SyncWriter, epoch: SyncWriterEpoch): boolean =>
  SyncWriter.is.legacy(writer) ? SyncWriterEpoch.is.legacy(epoch) : SyncWriterEpoch.is.model(epoch);

/**
 * Refuses a writer the persisted epoch does not admit.
 *
 * **Details**
 *
 * A store with no epoch row admits only the legacy writer. The Model writer is
 * admitted only after admission recorded the `model` epoch.
 *
 * **Example** (Guard a writer entry point)
 *
 * ```ts
 * import { requireSyncWriterEpoch } from "@beep/documents-server/aggregates/Sync"
 *
 * void requireSyncWriterEpoch("model")
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const requireSyncWriterEpoch = Effect.fn($I`requireSyncWriterEpoch`)(function* (writer: SyncWriter) {
  const state = yield* readSyncWriterEpoch;
  const epoch = state.pipe(
    O.map((s) => s.epoch),
    O.getOrElse((): SyncWriterEpoch => "legacy")
  );
  if (!admits(writer, epoch)) return yield* SyncWriterEpochRejected.make({ epoch, writer, reason: "writer-epoch" });
  return state;
});
