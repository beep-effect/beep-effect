/**
 * Startup admission and post-admission reversal for the single vault-sync writer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $DocumentsServerId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { SyncCutoverRejected } from "./SyncCutover.service.ts";
import { importSyncGenesis } from "./SyncGenesis.service.ts";
import {
  installSyncWriterFence,
  markSyncCutoverWriter,
  readSyncWriterEpoch,
  SyncWriterEpochRejected,
  SyncWriterEpochState,
  writeSyncWriterEpoch,
} from "./SyncWriterEpoch.service.ts";

const $I = $DocumentsServerId.create("aggregates/Sync/SyncAdmission.service");
const entities = ["item", "operation", "conflict", "cursor"] as const;

/**
 * The fixed backup id the startup state machine imports from.
 *
 * **Example** (Name the cutover backup)
 *
 * ```ts
 * import { SyncCutoverBackupId } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(SyncCutoverBackupId) // "vault-sync-cutover-v1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SyncCutoverBackupId = "vault-sync-cutover-v1";

/**
 * Options for the startup state machine.
 *
 * **Example** (Construct admission options)
 *
 * ```ts
 * import { SyncAdmissionOptions } from "@beep/documents-server/aggregates/Sync"
 *
 * const options = SyncAdmissionOptions.make({ mirrorRootName: "beep-vault" })
 * console.log(options.modelName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SyncAdmissionOptions extends S.Opaque<SyncAdmissionOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    mirrorRootName: S.NonEmptyString.annotateKey({ description: "Configured Box mirror root folder name." }),
    modelName: S.NonEmptyString.pipe(S.withConstructorDefault(Effect.succeed("VaultSync"))).annotateKey({
      description: "Alchemy model name whose event store hosts the vault-sync aggregates.",
    }),
    catchUpTimeout: S.Duration.pipe(S.withConstructorDefault(Effect.succeed(Duration.seconds(60)))).annotateKey({
      description: "Longest wait for the legacy projections to process every accepted event.",
    }),
  }).pipe($I.annoteSchema("SyncAdmissionOptions", { description: "Options for the vault-sync startup state machine." }))
) {}

/**
 * One column that differs between the cutover backup and the live table.
 *
 * **Example** (Construct a difference)
 *
 * ```ts
 * import { SyncCutoverDifference } from "@beep/documents-server/aggregates/Sync"
 *
 * const difference = SyncCutoverDifference.make({ table: "documents_sync_item", id: 1, column: "row_version" })
 * console.log(difference.column)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SyncCutoverDifference extends S.Opaque<SyncCutoverDifference, { readonly brand: unique symbol }>()(
  S.Struct({
    table: S.String,
    id: S.Int,
    column: S.String,
  }).pipe(
    $I.annoteSchema("SyncCutoverDifference", {
      description: "One column that differs between a cutover snapshot and the live legacy table.",
    })
  )
) {}

/**
 * Outcome of one startup admission run.
 *
 * **Example** (Construct an admission outcome)
 *
 * ```ts
 * import { SyncAdmissionOutcome } from "@beep/documents-server/aggregates/Sync"
 *
 * const outcome = SyncAdmissionOutcome.make({ admitted: "already-admitted", importId: "v1-abc" })
 * console.log(outcome.admitted)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SyncAdmissionOutcome extends S.Opaque<SyncAdmissionOutcome, { readonly brand: unique symbol }>()(
  S.Struct({
    admitted: S.Literals(["admitted", "already-admitted"]),
    importId: S.String,
  }).pipe($I.annoteSchema("SyncAdmissionOutcome", { description: "Outcome of one vault-sync startup admission run." }))
) {}

/**
 * Receipt of a completed post-admission reversal.
 *
 * **Example** (Construct a reversal receipt)
 *
 * ```ts
 * import { SyncReversalReceipt } from "@beep/documents-server/aggregates/Sync"
 *
 * const receipt = SyncReversalReceipt.make({ generation: 1, events: 4, requeued: [7] })
 * console.log(receipt.requeued)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SyncReversalReceipt extends S.Opaque<SyncReversalReceipt, { readonly brand: unique symbol }>()(
  S.Struct({
    generation: S.Int.annotateKey({ description: "Epoch generation recorded by this reversal." }),
    events: S.Int.annotateKey({ description: "Event high-water count the four tables were verified against." }),
    requeued: S.Array(S.Int).annotateKey({
      description: "Leased operation ids returned to queued by the recorded rollback procedure.",
    }),
  }).pipe($I.annoteSchema("SyncReversalReceipt", { description: "Receipt of a completed post-admission reversal." }))
) {}

const Count = S.Tuple([S.Struct({ pending: S.Int, unprocessed: S.Int })]);

/**
 * Reports whether the four legacy projections have processed every accepted event.
 *
 * **Details**
 *
 * True when no outbox delivery targets them and every accepted input is processed.
 *
 * **Example** (Check projection catch-up)
 *
 * ```ts
 * import { legacyProjectionsCaughtUp } from "@beep/documents-server/aggregates/Sync"
 *
 * void legacyProjectionsCaughtUp("VaultSync")
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const legacyProjectionsCaughtUp = Effect.fn($I`legacyProjectionsCaughtUp`)(function* (modelName: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql`SELECT
    (SELECT count(*)::int FROM alchemy_delivery WHERE model = ${modelName} AND status = 'pending'
      AND target_kind = 'projection' AND target_name LIKE 'LegacySync%') AS pending,
    (SELECT count(*)::int FROM alchemy_consumer_input i WHERE i.model = ${modelName}
      AND i.consumer LIKE 'projection:LegacySync%'
      AND i.position > COALESCE((SELECT p.processed FROM alchemy_projection_partition p
        WHERE p.model = i.model AND 'projection:' || p.projection = i.consumer AND p.key = i.key), 0)) AS unprocessed`.pipe(
    Effect.flatMap(S.decodeUnknownEffect(Count))
  );
  return rows[0].pending === 0 && rows[0].unprocessed === 0;
});

const awaitCaughtUp = Effect.fnUntraced(function* (options: SyncAdmissionOptions) {
  yield* legacyProjectionsCaughtUp(options.modelName).pipe(
    Effect.repeat({ until: (done) => done, schedule: Schedule.spaced(Duration.millis(25)) }),
    Effect.timeoutOrElse({
      duration: options.catchUpTimeout,
      orElse: () => Effect.fail(SyncCutoverRejected.make({ reason: "projection-catch-up-timeout" })),
    })
  );
});

const Differences = S.Array(SyncCutoverDifference);

/**
 * Compares every physical column of the four live tables with a snapshot set.
 *
 * **Details**
 *
 * JSONB comparison normalizes object key order only; a full outer join reports
 * missing and extra rows. `suffix` names the snapshot tables, such as
 * `cutover_backup` or `reversal_backup`.
 *
 * **Example** (Diff against the cutover backup)
 *
 * ```ts
 * import { diffSyncCutoverSnapshot } from "@beep/documents-server/aggregates/Sync"
 *
 * void diffSyncCutoverSnapshot("cutover_backup")
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const diffSyncCutoverSnapshot = Effect.fn($I`diffSyncCutoverSnapshot`)(function* (suffix: string) {
  const sql = yield* SqlClient.SqlClient;
  return yield* Effect.forEach(
    entities,
    Effect.fnUntraced(function* (entity) {
      const table = `documents_sync_${entity}`;
      return yield* sql`WITH expected AS (SELECT id, to_jsonb(t) AS row FROM ${sql(`${table}_${suffix}`)} t),
      actual AS (SELECT id, to_jsonb(t) AS row FROM ${sql(table)} t)
      SELECT ${table} AS "table", COALESCE(e.id, a.id)::int AS id, c.key AS column
      FROM expected e FULL OUTER JOIN actual a ON e.id = a.id
      CROSS JOIN LATERAL (SELECT key FROM jsonb_each(COALESCE(e.row, '{}'::jsonb))
        UNION SELECT key FROM jsonb_each(COALESCE(a.row, '{}'::jsonb))) c
      WHERE (e.row -> c.key) IS DISTINCT FROM (a.row -> c.key)
      ORDER BY id, c.key`.pipe(Effect.flatMap(S.decodeUnknownEffect(Differences)));
    }),
    { concurrency: 1 }
  ).pipe(Effect.map(A.flatten));
});

const migrate = Effect.fnUntraced(function* (options: SyncAdmissionOptions, generation: number) {
  const sql = yield* SqlClient.SqlClient;
  const at = yield* Clock.currentTimeMillis;
  // The epoch moves before the snapshot so no older writer can slip in between.
  yield* sql.withTransaction(
    Effect.gen(function* () {
      yield* installSyncWriterFence;
      yield* writeSyncWriterEpoch(SyncWriterEpochState.make({ epoch: "migrating", generation, importId: null }), at);
    })
  );
  const imported = yield* importSyncGenesis(SyncCutoverBackupId, options.mirrorRootName);
  yield* awaitCaughtUp(options);
  const differences = yield* diffSyncCutoverSnapshot("cutover_backup");
  if (A.isReadonlyArrayNonEmpty(differences)) {
    yield* Effect.logError("vault-sync genesis replay differs from the backup; staying in maintenance").pipe(
      Effect.annotateLogs({ differences: A.length(differences) })
    );
    return yield* SyncCutoverRejected.make({ reason: "genesis-replay-differs" });
  }
  const admittedAt = yield* Clock.currentTimeMillis;
  yield* writeSyncWriterEpoch(
    SyncWriterEpochState.make({ epoch: "model", generation, importId: imported.importId }),
    admittedAt
  );
  yield* Effect.logInfo("vault-sync Model admitted as the single writer").pipe(
    Effect.annotateLogs({ importId: imported.importId, rows: imported.items + imported.operations })
  );
  return SyncAdmissionOutcome.make({ admitted: "admitted", importId: imported.importId });
});

/**
 * Runs genesis and admission once; later starts are no-ops.
 *
 * **Details**
 *
 * A store with no epoch, or still `migrating` after a crash, resumes the
 * idempotent genesis import, waits for the projections, requires a zero diff
 * and records the `model` epoch. An admitted store returns immediately. A
 * reversed store stays legacy: a recutover needs a fresh import, so startup
 * refuses with {@link SyncWriterEpochRejected} instead of resuming the
 * abandoned event store.
 *
 * **Example** (Prepare startup admission)
 *
 * ```ts
 * import { SyncAdmissionOptions, ensureSyncCutover } from "@beep/documents-server/aggregates/Sync"
 *
 * void ensureSyncCutover(SyncAdmissionOptions.make({ mirrorRootName: "beep-vault" }))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const ensureSyncCutover = Effect.fn($I`ensureSyncCutover`)(function* (options: SyncAdmissionOptions) {
  const state = yield* readSyncWriterEpoch;
  return yield* O.match(state, {
    onNone: () => migrate(options, 0),
    onSome: (current) =>
      Match.value(current.epoch).pipe(
        Match.when("model", () =>
          Effect.succeed(SyncAdmissionOutcome.make({ admitted: "already-admitted", importId: current.importId ?? "" }))
        ),
        Match.when("migrating", () => migrate(options, current.generation)),
        Match.when("legacy", () =>
          current.generation > 0
            ? Effect.fail(
                SyncWriterEpochRejected.make({
                  epoch: "legacy",
                  writer: "model",
                  reason: "reversed-store-requires-fresh-import",
                })
              )
            : migrate(options, current.generation)
        ),
        Match.exhaustive
      ),
  });
});

const HighWater = S.Tuple([S.Struct({ events: S.Int })]);
const Ids = S.Array(S.Struct({ id: S.Int }));
const decodePresence = S.decodeUnknownEffect(S.Tuple([S.Struct({ present: S.Boolean })]));
const decodePendingReceipts = S.decodeUnknownEffect(S.Tuple([S.Struct({ pending: S.Int })]));
const encodeRequeuedIds = S.encodeEffect(S.Int.pipe(S.Array, S.fromJsonString));

/**
 * Returns an admitted store to the legacy writer without losing accepted work.
 *
 * **Details**
 *
 * Call with the Model runtime and every worker stopped. Refuses while an
 * uncertain Box mutation is unsettled or a projection is behind its accepted
 * events, because either would hand the legacy writer a stale view. The four
 * tables already hold the projected state; the procedure snapshots them to
 * `*_reversal_backup`, verifies the snapshot, returns leased operations to
 * queued (recording their ids), moves each table sequence beyond every id the
 * D14 allocator handed out, and records the `legacy` epoch with the next
 * generation. The event and workflow store stays in place, read-only: the
 * fence refuses the Model writer and {@link ensureSyncCutover} refuses to
 * resume it. Box uploads are never compensated.
 *
 * **Example** (Prepare a reversal)
 *
 * ```ts
 * import { reverseSyncCutover } from "@beep/documents-server/aggregates/Sync"
 *
 * void reverseSyncCutover("VaultSync")
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const reverseSyncCutover = Effect.fn($I`reverseSyncCutover`)(function* (modelName: string) {
  const sql = yield* SqlClient.SqlClient;
  const state = yield* readSyncWriterEpoch;
  const current = yield* O.match(state, {
    onNone: () => Effect.fail(SyncCutoverRejected.make({ reason: "not-admitted" })),
    onSome: (s) =>
      s.epoch === "model" ? Effect.succeed(s) : Effect.fail(SyncCutoverRejected.make({ reason: "not-admitted" })),
  });
  const receipts = yield* sql`SELECT to_regclass('documents_sync_box_receipt') IS NOT NULL AS present`.pipe(
    Effect.flatMap(decodePresence)
  );
  const uncertain = receipts[0].present
    ? yield* sql`SELECT count(*)::int AS pending FROM documents_sync_box_receipt WHERE result IS NULL`.pipe(
        Effect.flatMap(decodePendingReceipts),
        Effect.map((rows) => rows[0].pending)
      )
    : 0;
  if (uncertain > 0) return yield* SyncCutoverRejected.make({ reason: "uncertain-remote-outcome" });
  if (!(yield* legacyProjectionsCaughtUp(modelName)))
    return yield* SyncCutoverRejected.make({ reason: "projection-behind" });
  const highWater = yield* sql`SELECT count(*)::int AS events FROM alchemy_aggregate_event
    WHERE model = ${modelName}`.pipe(Effect.flatMap(S.decodeUnknownEffect(HighWater)));
  const at = yield* Clock.currentTimeMillis;
  const generation = current.generation + 1;
  const requeued = yield* sql.withTransaction(
    Effect.gen(function* () {
      yield* markSyncCutoverWriter;
      yield* Effect.forEach(
        entities,
        Effect.fnUntraced(function* (entity) {
          const table = `documents_sync_${entity}`;
          yield* sql`LOCK TABLE ${sql(table)} IN ACCESS EXCLUSIVE MODE`;
          yield* sql`DROP TABLE IF EXISTS ${sql(`${table}_reversal_backup`)}`;
          yield* sql`CREATE TABLE ${sql(`${table}_reversal_backup`)} AS TABLE ${sql(table)}`;
        }),
        { discard: true }
      );
      const differences = yield* diffSyncCutoverSnapshot("reversal_backup");
      if (A.isReadonlyArrayNonEmpty(differences))
        return yield* SyncCutoverRejected.make({ reason: "reversal-snapshot-differs" });
      // Leases belong to Model workflows that will never resume; the legacy writer only knows queued work.
      const leased = yield* sql`UPDATE documents_sync_operation
        SET status = 'queued', row_version = row_version + 1, updated_at = ${at}
        WHERE status = 'leased' RETURNING id`.pipe(Effect.flatMap(S.decodeUnknownEffect(Ids)));
      yield* Effect.forEach(
        entities,
        (entity) => {
          const table = `documents_sync_${entity}`;
          return sql`SELECT setval(${`${table}_id_seq`}::regclass, GREATEST(1,
            (SELECT COALESCE(MAX(id), 0) FROM ${sql(table)}),
            (SELECT COALESCE(MAX(id), 0) FROM documents_sync_legacy_identity WHERE entity = ${entity}),
            (SELECT last_value FROM ${sql(`${table}_id_seq`)})), true)`;
        },
        { discard: true }
      );
      const ids = A.map(leased, (row) => row.id);
      const encoded = yield* encodeRequeuedIds(ids);
      yield* sql`CREATE TABLE IF NOT EXISTS documents_sync_cutover_reversal (
        generation integer PRIMARY KEY, events integer NOT NULL, requeued jsonb NOT NULL, reversed_at bigint NOT NULL)`;
      yield* sql`INSERT INTO documents_sync_cutover_reversal (generation, events, requeued, reversed_at)
        VALUES (${generation}, ${highWater[0].events}, ${encoded}::jsonb, ${at})`;
      yield* writeSyncWriterEpoch(
        SyncWriterEpochState.make({ epoch: "legacy", generation, importId: current.importId }),
        at
      );
      return ids;
    })
  );
  yield* Effect.logWarning("vault-sync store reversed to the legacy writer").pipe(
    Effect.annotateLogs({ generation, events: highWater[0].events, requeued: A.length(requeued) })
  );
  return SyncReversalReceipt.make({ generation, events: highWater[0].events, requeued });
});
