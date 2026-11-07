/** Writer-epoch fence, startup admission and post-admission reversal over a drizzle-migrated store. */
import * as NodeURL from "node:url";
import * as Domain from "@alchemy.run/domain";
import { AlchemyPostgresPlatform } from "@beep/alchemy-postgres";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import {
  diffSyncCutoverSnapshot,
  ensureSyncCutover,
  LegacySyncAudit,
  LegacySyncProjections,
  readSyncWriterEpoch,
  requireSyncWriterEpoch,
  reverseSyncCutover,
  SyncAdmissionOptions,
} from "@beep/documents-server/aggregates/Sync";
import { syncItemTable } from "@beep/documents-tables/entities/SyncItem";
import {
  LegacySyncConflict,
  LegacySyncCursor,
  LegacySyncItem,
  LegacySyncOperation,
  VaultSyncModel,
} from "@beep/documents-use-cases/aggregates/VaultSync";
import { makeLayer as makePgliteLayer } from "@beep/pglite/PgliteClient.service";
import { makeDrizzle, makeDrizzleLayer, migrate, PostgresDrizzle } from "@beep/postgres";
import { BunServices } from "@effect/platform-bun";
import { describe, expect, layer } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Schedule from "effect/Schedule";
import * as Scope from "effect/Scope";
import * as SqlClient from "effect/sql/SqlClient";

class CutoverModel extends Domain.Model("VaultSync", {
  aggregates: VaultSyncModel.aggregates,
  views: VaultSyncModel.views,
  projections: [LegacySyncItem, LegacySyncOperation, LegacySyncConflict, LegacySyncCursor],
}) {}

const migrationsFolder = NodeURL.fileURLToPath(new URL("../../../_internal/db-admin/drizzle", import.meta.url));
const audit = Layer.succeed(LegacySyncAudit, {
  resolve: Effect.fn("test.cutoverAudit")(() =>
    Effect.succeed({ orgId: 1, workspaceId: 3, principal: '{"kind":"System","component":"Sync"}', source: "System" })
  ),
});
const database = makeDrizzleLayer().pipe(
  Layer.provideMerge(Layer.fresh(makePgliteLayer({ extensions: { btree_gist } }))),
  Layer.provideMerge(Layer.mergeAll(BunServices.layer, audit))
);
const runtimeLayer = CutoverModel.layer(LegacySyncProjections).pipe(Layer.provide(AlchemyPostgresPlatform.layer()));
const options = SyncAdmissionOptions.make({ mirrorRootName: "synthetic-vault" });

/** What an older sidecar executable does on boot: run its bundled drizzle migrations. */
const bootLegacyExecutable = Effect.gen(function* () {
  const db = yield* makeDrizzle();
  yield* migrate(db, { migrationsFolder, migrationsSchema: "drizzle" });
});

const legacyRow = (id: number, publicId: string) => ({
  id,
  public_id: publicId,
  entity_type: "documents_sync_item",
  org_id: 1,
  workspace_id: 3,
  provider: "box",
  row_version: 5,
  schema_version: "0.1.0",
  source: "System",
  created_at: 1700000000000 + id,
  updated_at: 1700000000500 + id,
  created_by_principal: '{"kind":"System","component":"Sync"}',
  updated_by_principal: '{"kind":"System","component":"Sync"}',
  local_rel_path: `legacy-${id}.txt`,
  item_kind: "file",
  content_digest: `digest-${id}`,
  content_size_bytes: id,
  local_generation: 2,
  remote_id: null,
  remote_name: null,
  remote_parent_id: null,
  last_pushed_digest: null,
  last_pushed_generation: null,
  sync_state: "pending",
  last_error: null,
});

describe("vault-sync single-writer cutover", () => {
  layer(database, { timeout: "2 minutes", excludeTestServices: true })("drizzle-migrated store", (it) => {
    it.effect("fences legacy writers after admission and reverses accepted Model work", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* bootLegacyExecutable;
        // Before the cutover the legacy writer owns the tables.
        yield* sql`INSERT INTO documents_sync_item ${sql.insert(legacyRow(41, "documents_sync_item_asynthetic41"))}`;
        yield* sql`SELECT setval('documents_sync_item_id_seq', 41, true)`;
        const before = yield* readSyncWriterEpoch;
        assertNone(before);

        const scope = yield* Scope.make();
        const runtime = yield* Layer.buildWithScope(runtimeLayer, scope);
        const admitted = yield* ensureSyncCutover(options).pipe(Effect.provide(runtime));
        expect(admitted.admitted).toBe("admitted");
        const again = yield* ensureSyncCutover(options).pipe(Effect.provide(runtime));
        expect(again).toEqual({ admitted: "already-admitted", importId: admitted.importId });
        const epoch = yield* readSyncWriterEpoch;
        assertSome(
          O.map(epoch, (s) => s.epoch),
          "model"
        );
        const genesisDiff = yield* diffSyncCutoverSnapshot("cutover_backup");
        expect(genesisDiff).toEqual([]);

        // Every legacy entry point is refused: the epoch guard, raw SQL and ORM-generated SQL.
        const guarded = yield* requireSyncWriterEpoch("legacy").pipe(Effect.flip);
        expect(guarded).toMatchObject({ _tag: "SyncWriterEpochRejected", epoch: "model", writer: "legacy" });
        yield* requireSyncWriterEpoch("model");
        const rawLegacy = yield* sql`UPDATE documents_sync_item SET last_error = 'old build'`.pipe(Effect.flip);
        expect(rawLegacy._tag).toBe("SqlError");
        const db = yield* PostgresDrizzle;
        // Effect.flip fails the test if the ORM update were admitted.
        yield* db.update(syncItemTable).set({ lastError: "old build" }).pipe(Effect.flip);
        // A re-run of the old executable's migrations does not disarm the fence.
        yield* bootLegacyExecutable;
        const afterReboot = yield* sql`DELETE FROM documents_sync_item`.pipe(Effect.flip);
        expect(afterReboot._tag).toBe("SqlError");

        // The admitted Model writer works.
        const destinationId = V.DestinationId.make("documents_sync_destination_acutover");
        const itemId = V.ItemId.make("documents_sync_item_amodel1");
        const operationId = V.OperationId.make("documents_sync_operation_amodel1");
        yield* Context.get(runtime, V.SyncDestination).send(
          destinationId,
          V.RegisterDestination.make({ orgId: 1, workspaceId: 3, name: "cutover" })
        );
        const path = V.VaultRelPath.make("model.txt");
        yield* Context.get(runtime, V.SyncItem).send(
          itemId,
          V.ObserveItem.make({
            observation: {
              destinationId,
              workspaceId: 3,
              path,
              kind: V.SyncItemKind.Enum.file,
              digest: "model-digest",
              contentSizeBytes: 5,
              generation: 1,
              operationId,
              type: V.OperationType.Enum.uploadFile,
              parentRequired: false,
            },
          })
        );
        const operations = Context.get(runtime, V.SyncOperation);
        yield* operations.send(
          operationId,
          V.QueueOperation.make({
            input: {
              destinationId,
              itemId,
              type: "uploadFile",
              path,
              digest: "model-digest",
              generation: 1,
              parentRequired: false,
              idempotencyKey: operationId,
            },
          })
        );
        yield* operations.send(
          operationId,
          V.LeaseOperation.make({ holder: "pass-1", leaseMillis: 30000, parentRemoteId: null, itemRemoteId: null })
        );
        const projected =
          yield* sql`SELECT id, status FROM documents_sync_operation WHERE public_id = ${operationId}`.pipe(
            Effect.repeat({ until: (rows) => rows[0]?.status === "leased", schedule: Schedule.spaced("10 millis") }),
            Effect.timeout("20 seconds")
          );
        const leasedId = projected[0]?.id;
        yield* sql`SELECT 1 FROM documents_sync_item WHERE public_id = ${itemId}`.pipe(
          Effect.repeat({ until: (rows) => rows.length === 1, schedule: Schedule.spaced("10 millis") }),
          Effect.timeout("20 seconds")
        );

        // Stop the Model runtime and its workers before reversing.
        yield* Scope.close(scope, Exit.void);
        yield* sql`CREATE TABLE IF NOT EXISTS documents_sync_box_receipt (
        operation_id text PRIMARY KEY, fingerprint text NOT NULL, result text)`;
        yield* sql`INSERT INTO documents_sync_box_receipt (operation_id, fingerprint) VALUES ('held/1', 'f')`;
        const uncertain = yield* reverseSyncCutover("VaultSync").pipe(Effect.flip);
        expect(uncertain).toMatchObject({ reason: "uncertain-remote-outcome" });
        yield* sql`UPDATE documents_sync_box_receipt SET result = 'settled-by-evidence'`;

        const receipt = yield* reverseSyncCutover("VaultSync");
        expect(receipt.generation).toBe(1);
        expect(receipt.requeued).toEqual([leasedId]);
        expect(receipt.events).toBeGreaterThan(0);
        // The legacy tables equal the projected state except the recorded lease rollback.
        const differences = yield* diffSyncCutoverSnapshot("reversal_backup");
        expect(differences).toEqual([
          { table: "documents_sync_operation", id: leasedId, column: "row_version" },
          { table: "documents_sync_operation", id: leasedId, column: "status" },
          { table: "documents_sync_operation", id: leasedId, column: "updated_at" },
        ]);
        const rows = yield* sql`SELECT public_id FROM documents_sync_item ORDER BY id`;
        expect(rows).toEqual([{ public_id: "documents_sync_item_asynthetic41" }, { public_id: itemId }]);

        // The legacy writer works again and its sequence clears every Model-allocated id.
        const next = yield* sql`SELECT nextval('documents_sync_item_id_seq')::int AS id`;
        const maxId = yield* sql`SELECT MAX(id)::int AS id FROM documents_sync_item`;
        expect(Number(next[0]?.id)).toBeGreaterThan(Number(maxId[0]?.id));
        yield* sql`INSERT INTO documents_sync_item ${sql.insert(legacyRow(Number(next[0]?.id), "documents_sync_item_alegacy2"))}`;
        yield* db.update(syncItemTable).set({ lastError: "legacy again" });
        const legacyAgain = yield* requireSyncWriterEpoch("legacy");
        assertSome(
          O.map(legacyAgain, (state) => [state.epoch, state.generation] as const),
          ["legacy", 1] as const
        );

        // The abandoned Model can neither resume nor write.
        const resumed = yield* Layer.build(runtimeLayer).pipe(
          Effect.flatMap((context) => ensureSyncCutover(options).pipe(Effect.provide(context))),
          Effect.flip
        );
        expect(resumed).toMatchObject({
          _tag: "SyncWriterEpochRejected",
          reason: "reversed-store-requires-fresh-import",
        });
        const staleModel = yield* sql
          .withTransaction(
            sql`SELECT set_config('beep.documents_sync_writer', 'model', true)`.pipe(
              Effect.andThen(sql`UPDATE documents_sync_item SET last_error = 'stale model'`)
            )
          )
          .pipe(Effect.flip);
        expect(staleModel._tag).toBe("SqlError");
        const again2 = yield* reverseSyncCutover("VaultSync").pipe(Effect.flip);
        expect(again2).toMatchObject({ reason: "not-admitted" });
      })
    );
  });
});
