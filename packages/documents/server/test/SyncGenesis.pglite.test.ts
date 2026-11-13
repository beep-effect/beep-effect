import * as Domain from "@alchemy.run/domain";
import { AlchemyPostgresConfig, AlchemyPostgresPlatform, ProvenanceMapping } from "@beep/alchemy-postgres";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import {
  importSyncGenesis,
  LegacySyncAudit,
  LegacySyncProjections,
  SyncCutoverRejected,
  workspaceDestinationId,
} from "@beep/documents-server/aggregates/Sync";
import {
  LegacySyncConflict,
  LegacySyncCursor,
  LegacySyncItem,
  LegacySyncOperation,
  VaultSyncModel,
  VaultSyncReadAccess,
} from "@beep/documents-use-cases/aggregates/VaultSync";
import { PgliteTestLayer } from "@beep/pglite/Pglite.test-layer";
import { BunServices } from "@effect/platform-bun";
import { describe, expect, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as SqlClient from "effect/sql/SqlClient";
import {
  assertLegacyColumnContracts,
  createLegacySyncTables,
  diffLegacySyncTables,
} from "./LegacySyncReplay.harness.ts";
import type * as Context from "effect/Context";

class ImportModel extends Domain.Model("GenesisAcceptance", { aggregates: VaultSyncModel.aggregates }) {}
class ReplayModel extends Domain.Model("GenesisAcceptance", {
  aggregates: VaultSyncModel.aggregates,
  views: VaultSyncModel.views,
  projections: [LegacySyncItem, LegacySyncOperation, LegacySyncConflict, LegacySyncCursor],
}) {}
const audit = Layer.succeed(LegacySyncAudit, {
  resolve: Effect.fn("test.genesisAudit")(() =>
    Effect.succeed({
      orgId: 17,
      workspaceId: 9,
      principal: '{"_tag":"System","id":"legacy-importer"}',
      source: "Migration",
    })
  ),
});
const infrastructure = Layer.mergeAll(PgliteTestLayer, BunServices.layer, audit);
const common = (entity: string, id: number) => ({
  deleted_at: id % 2 === 0 ? null : 1700000010101,
  deleted_by_principal: id % 2 === 0 ? null : '{"_tag":"System","id":"historical-deleter"}',
  id,
  public_id: `documents_sync_${entity}_asynthetic${id + 9000}`,
  entity_type: `documents_sync_${entity}`,
  org_id: 1,
  workspace_id: 9,
  provider: "box",
  created_at: 1700000000123 + id,
  updated_at: 1700000000999 + id,
  created_by_principal: '{"_tag":"System","id":"historical-creator"}',
  updated_by_principal: '{"_tag":"System","id":"historical-editor"}',
  row_version: id + 27,
  schema_version: "0.1.0",
  source: "Application",
});

const genesisPlatform = AlchemyPostgresPlatform.layer(
  AlchemyPostgresConfig.make({
    provenance: O.some(
      ProvenanceMapping.make({
        contextKey: V.GenesisProvenance.key,
        principalField: "principal",
        sourceKindField: "source",
      })
    ),
  })
);
const ProcessedRows = S.Array(S.Struct({ processed: S.Int }));

const folderItem = { item_kind: "folder", content_digest: null, content_size_bytes: null, remote_id: null };
const unpushed = { remote_name: null, remote_parent_id: null, last_pushed_digest: null, last_pushed_generation: null };
const fileItem = (id: number) => ({
  item_kind: "file",
  content_digest: `current-${id}`,
  content_size_bytes: id,
  remote_id: `remote-${id}`,
});
const pushedFile = (id: number) => ({
  remote_name: `old-${id}.txt`,
  remote_parent_id: "root",
  last_pushed_digest: `previous-${id}`,
  last_pushed_generation: 4,
});
const seedItems = Effect.fnUntraced(function* () {
  const sql = yield* SqlClient.SqlClient;
  const states = ["pending", "current", "error", "conflict"] as const;
  for (const [status, state] of A.map(states, (state, index) => [index, state] as const)) {
    const id = (status + 1) * 13;
    const folder = status === 0;
    yield* sql`INSERT INTO documents_sync_item ${sql.insert({
      ...common("item", id),
      local_rel_path: `folder/synthetic-${id}.txt`,
      ...(folder ? folderItem : fileItem(id)),
      local_generation: 7,
      ...(folder ? unpushed : pushedFile(id)),
      sync_state: state,
      last_error: status === 2 ? "historical failure" : null,
    })}`;
  }
});
const operationRow = (operationId: number, type: string, status: string) => ({
  ...common("operation", operationId),
  sync_item_id: 26,
  operation_type: type,
  target_rel_path: "folder/renamed.txt",
  target_parent_rel_path: "folder",
  target_name: "legacy-target.txt",
  input_generation: 3,
  input_content_digest: status === "queued" ? null : "old-input",
  idempotency_key: `stored-key-${operationId}`,
  status,
  attempt_count: status === "queued" ? 0 : 3,
  last_error: status === "failed" ? "superseded: historical" : null,
});
const seedOperations = Effect.fnUntraced(function* () {
  const sql = yield* SqlClient.SqlClient;
  const types = ["createFolder", "uploadFile", "uploadFileVersion", "moveItem", "renameItem"];
  const statuses = ["queued", "leased", "succeeded", "failed"];
  const pairs = A.flatMap(types, (type) => A.map(statuses, (status) => [type, status] as const));
  for (const [index, [type, status]] of A.map(pairs, (pair, index) => [index, pair] as const))
    yield* sql`INSERT INTO documents_sync_operation ${sql.insert(operationRow(107 + index * 7, type, status))}`;
});
const conflictRow = (conflictId: number, kind: string, reviewed: boolean) => ({
  ...common("conflict", conflictId),
  sync_item_id: reviewed ? null : 26,
  conflict_kind: kind,
  local_rel_path: reviewed ? null : "folder/synthetic-26.txt",
  remote_event_id: reviewed ? null : `event-${conflictId}`,
  remote_id: reviewed ? null : `remote-${conflictId}`,
  remote_payload: '{"nested":{"b":2,"a":1},"text":" synthetic  text "}',
  resolution_status: reviewed ? "reviewed" : "open",
});
const seedConflicts = Effect.fnUntraced(function* () {
  const sql = yield* SqlClient.SqlClient;
  const kinds = ["remoteCreate", "remoteEdit", "remoteMove", "remoteRename", "remoteDelete", "remoteUnknown"];
  const pairs = A.flatMap(kinds, (kind) => A.map([false, true], (reviewed) => [kind, reviewed] as const));
  for (const [index, [kind, reviewed]] of A.map(pairs, (pair, index) => [index, pair] as const))
    yield* sql`INSERT INTO documents_sync_conflict ${sql.insert(conflictRow(511 + index * 11, kind, reviewed))}`;
});
const seedCursors = Effect.fnUntraced(function* () {
  const sql = yield* SqlClient.SqlClient;
  for (const [status, id] of [
    ["active", 701],
    ["error", 709],
  ] as const)
    yield* sql`INSERT INTO documents_sync_cursor ${sql.insert({
      ...common("cursor", id),
      stream_position: `opaque-${id}`,
      last_event_id: status === "active" ? null : "prior-event",
      status,
      last_error: status === "error" ? "poll failed" : null,
    })}`;
  yield* sql`INSERT INTO documents_sync_cursor ${sql.insert({
    ...common("cursor", 719),
    workspace_id: 10,
    stream_position: "selected-old",
    last_event_id: null,
    // Legacy cursor errors were free adapter text; genesis keeps it in the row and maps the state.
    status: "error",
    last_error: "Box answered 503 Service Unavailable (upstream timeout)",
  })}`;
});
// A crash on the fifteenth audit call leaves a half import; the next two runs converge.
const importAfterCrash = Effect.fnUntraced(function* <R>(runtime: Context.Context<R>) {
  const provenance = yield* LegacySyncAudit;
  const calls = yield* Ref.make(0);
  const partial = yield* importSyncGenesis("synthetic-backup", "beep-vault").pipe(
    Effect.provideContext(runtime),
    Effect.provideService(LegacySyncAudit, {
      resolve: Effect.fn("test.interruptedAudit")(function* (stream, seq) {
        const n = yield* Ref.updateAndGet(calls, (n) => n + 1);
        if (n === 15) return yield* Effect.die(SyncCutoverRejected.make({ reason: "synthetic-half-import-crash" }));
        return yield* provenance.resolve(stream, seq);
      }),
    }),
    Effect.exit
  );
  expect(partial._tag).toBe("Failure");
  const first = yield* importSyncGenesis("synthetic-backup", "beep-vault").pipe(Effect.provideContext(runtime));
  const second = yield* importSyncGenesis("synthetic-backup", "beep-vault").pipe(Effect.provideContext(runtime));
  expect(second).toEqual(first);
  expect(first).toMatchObject({ items: 4, operations: 20, conflicts: 12, cursors: 3 });
});
const assertGenesisEvents = Effect.fnUntraced(function* () {
  const sql = yield* SqlClient.SqlClient;
  const events =
    yield* sql`SELECT tag,principal,source_kind,schema_version FROM alchemy_aggregate_event WHERE model='GenesisAcceptance'`;
  expect(events).toHaveLength(41);
  for (const event of events)
    expect(event).toMatchObject({
      principal: '{"_tag":"System","id":"legacy-importer"}',
      source_kind: "Migration",
      schema_version: 1,
    });
});
// D17 F3: genesis binds each workspace to an opaque minted id, stable across re-runs.
const assertBindings = Effect.fnUntraced(function* () {
  const workspace9 = yield* workspaceDestinationId(9);
  const workspace10 = yield* workspaceDestinationId(10);
  expect(S.is(V.DestinationId)(workspace9)).toBe(true);
  expect(workspace9).not.toContain("workspace");
  expect(workspace9).not.toBe(workspace10);
  const rebound = yield* workspaceDestinationId(9);
  expect(rebound).toBe(workspace9);
  const destinations = yield* V.SyncDestination;
  const state = yield* destinations.get(workspace9);
  expect(state).toMatchObject({ orgId: 17, paused: true, cursor: null });
  // The selected legacy error cursor's free text becomes the closed `pollEvents` literal in state.
  const selected = yield* destinations.get(workspace10);
  expect(selected).toMatchObject({ cursor: "selected-old", cursorError: "pollEvents", paused: false });
  return { workspace9, workspace10 };
});
const clearLegacyTables = Effect.fnUntraced(function* () {
  const sql = yield* SqlClient.SqlClient;
  for (const entity of ["conflict", "operation", "item", "cursor"])
    yield* sql`DELETE FROM ${sql(`documents_sync_${entity}`)}`;
  yield* sql`DELETE FROM documents_sync_legacy_identity`;
});
const assertReplayDiffs = Effect.fnUntraced(function* () {
  const sql = yield* SqlClient.SqlClient;
  const diffs = yield* diffLegacySyncTables().pipe(
    Effect.repeat({ until: A.isReadonlyArrayEmpty, schedule: Schedule.spaced("20 millis") }),
    Effect.timeout("20 seconds")
  );
  expect(diffs).toEqual([]);
  yield* sql`UPDATE documents_sync_item SET row_version=row_version+1,last_pushed_generation=999 WHERE id=26`;
  const negative = yield* diffLegacySyncTables();
  expect(A.map(negative, (d) => d.column)).toEqual(["last_pushed_generation", "row_version"]);
});
const assertSelectedCursor = Effect.fnUntraced(function* (workspace10: V.DestinationId) {
  const sql = yield* SqlClient.SqlClient;
  const destinations = yield* V.SyncDestination;
  const selected = yield* destinations.send(
    workspace10,
    V.RecordDestinationPoll.make({ position: "selected-new", lastEventId: "selected-event", error: null })
  );
  yield* LegacySyncCursor.caughtUp(selected);
  const cursor =
    yield* sql`SELECT id,public_id,row_version,created_at,stream_position,last_event_id FROM documents_sync_cursor WHERE workspace_id=10`.pipe(
      Effect.repeat({
        until: (rows) => rows[0]?.stream_position === "selected-new",
        schedule: Schedule.spaced("10 millis"),
      }),
      Effect.timeout("5 seconds")
    );
  expect(cursor).toEqual([
    {
      id: 719,
      public_id: common("cursor", 719).public_id,
      row_version: 747,
      created_at: 1700000000842,
      stream_position: "selected-new",
      last_event_id: "selected-event",
    },
  ]);
});
const awaitCursorProjection = Effect.fnUntraced(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`SELECT processed FROM alchemy_projection_partition WHERE model='GenesisAcceptance' AND projection='LegacySyncCursor'`.pipe(
    Effect.flatMap(S.decodeUnknownEffect(ProcessedRows)),
    Effect.repeat({ until: (rows) => A.some(rows, (r) => r.processed >= 3), schedule: Schedule.spaced("10 millis") }),
    Effect.timeout("5 seconds")
  );
});
// A duplicate cursor workspace stays paused: a poll there leaves its imported rows untouched.
const assertPausedCursorKept = Effect.fnUntraced(function* (workspace9: V.DestinationId) {
  const sql = yield* SqlClient.SqlClient;
  const before = yield* sql`SELECT * FROM documents_sync_cursor WHERE workspace_id=9 ORDER BY id`;
  const destinations = yield* V.SyncDestination;
  const paused = yield* destinations.send(
    workspace9,
    V.RecordDestinationPoll.make({ position: "not-selected", error: null })
  );
  yield* LegacySyncCursor.caughtUp(paused);
  yield* awaitCursorProjection();
  const after = yield* sql`SELECT * FROM documents_sync_cursor WHERE workspace_id=9 ORDER BY id`;
  expect(after).toEqual(before);
});
// A live event on an imported operation keeps the legacy key text; its reason column takes the literal.
const assertImportedKeyKept = Effect.fnUntraced(function* () {
  const sql = yield* SqlClient.SqlClient;
  const operations = yield* V.SyncOperation;
  const publicId = common("operation", 107).public_id;
  const superseded = yield* operations.send(
    V.OperationId.make(publicId),
    V.SupersedeOperation.make({ reason: "kind-replaced" })
  );
  yield* LegacySyncOperation.caughtUp(superseded);
  const rows = yield* sql`SELECT idempotency_key, last_error FROM documents_sync_operation
    WHERE public_id = ${publicId}`.pipe(
    Effect.repeat({
      until: (found) => found[0]?.last_error === "kind-replaced",
      schedule: Schedule.spaced("10 millis"),
    }),
    Effect.timeout("5 seconds")
  );
  expect(rows).toEqual([{ idempotency_key: "stored-key-107", last_error: "kind-replaced" }]);
});
// Redelivering every event from a reset checkpoint changes nothing.
const assertRedeliveryStable = Effect.fnUntraced(function* (replayScope: Scope.Closeable) {
  const sql = yield* SqlClient.SqlClient;
  const before = yield* diffLegacySyncTables();
  yield* Scope.close(replayScope, Exit.void);
  yield* sql`UPDATE alchemy_projection_partition SET processed=0,checkpoints='{}'::jsonb WHERE model='GenesisAcceptance'`;
  yield* Layer.build(
    ReplayModel.layer(Layer.merge(VaultSyncReadAccess, LegacySyncProjections)).pipe(
      Layer.provide(SecureRandom.layerWebCrypto),
      Layer.provide(AlchemyPostgresPlatform.layer())
    )
  );
  yield* awaitCursorProjection();
  const after = yield* diffLegacySyncTables();
  expect(after).toEqual(before);
});

describe("lossless offline genesis", () => {
  layer(infrastructure, { timeout: "30 seconds", excludeTestServices: true })("synthetic historical rows", (it) => {
    it.effect("imports twice then replays every physical column with zero diff", () =>
      Effect.gen(function* () {
        yield* createLegacySyncTables;
        yield* assertLegacyColumnContracts;
        yield* seedItems();
        yield* seedOperations();
        yield* seedConflicts();
        yield* seedCursors();
        const scope = yield* Scope.make();
        const runtime = yield* Layer.buildWithScope(
          ImportModel.layer(Layer.empty).pipe(
            Layer.provide(SecureRandom.layerWebCrypto),
            Layer.provide(genesisPlatform)
          ),
          scope
        );
        yield* importAfterCrash(runtime);
        yield* assertGenesisEvents();
        const { workspace9, workspace10 } = yield* assertBindings().pipe(Effect.provideContext(runtime));
        yield* Scope.close(scope, Exit.void);
        yield* clearLegacyTables();
        const replayScope = yield* Scope.make();
        const replay = yield* Layer.buildWithScope(
          ReplayModel.layer(Layer.merge(VaultSyncReadAccess, LegacySyncProjections)).pipe(
            Layer.provide(SecureRandom.layerWebCrypto),
            Layer.provide(genesisPlatform)
          ),
          replayScope
        );
        yield* assertReplayDiffs();
        yield* assertSelectedCursor(workspace10).pipe(Effect.provideContext(replay));
        yield* assertPausedCursorKept(workspace9).pipe(Effect.provideContext(replay));
        yield* assertImportedKeyKept().pipe(Effect.provideContext(replay));
        yield* assertRedeliveryStable(replayScope);
      })
    );
  });
});
