import * as Domain from "@alchemy.run/domain";
import { AlchemyPostgresPlatform } from "@beep/alchemy-postgres";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { importSyncGenesis, LegacySyncAudit, LegacySyncProjections } from "@beep/documents-server/aggregates/Sync";
import {
  LegacySyncConflict,
  LegacySyncCursor,
  LegacySyncItem,
  LegacySyncOperation,
  VaultSyncModel,
} from "@beep/documents-use-cases/aggregates/VaultSync";
import { PgliteTestLayer } from "@beep/pglite/Pglite.test-layer";
import { BunServices } from "@effect/platform-bun";
import { describe, expect, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";
import * as Scope from "effect/Scope";
import * as SqlClient from "effect/sql/SqlClient";
import {
  assertLegacyColumnContracts,
  createLegacySyncTables,
  diffLegacySyncTables,
} from "./LegacySyncReplay.harness.ts";

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

describe("lossless offline genesis", () => {
  layer(infrastructure, { timeout: "30 seconds", excludeTestServices: true })("synthetic historical rows", (it) => {
    it.effect("imports twice then replays every physical column with zero diff", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* createLegacySyncTables;
        yield* assertLegacyColumnContracts;
        for (const [i, status] of [
          ["pending", 0],
          ["current", 1],
          ["error", 2],
          ["conflict", 3],
        ] as const) {
          const id = (status + 1) * 13;
          yield* sql`INSERT INTO documents_sync_item ${sql.insert({
            ...common("item", id),
            local_rel_path: `folder/synthetic-${id}.txt`,
            item_kind: status === 0 ? "folder" : "file",
            content_digest: status === 0 ? null : `current-${id}`,
            content_size_bytes: status === 0 ? null : id,
            local_generation: 7,
            remote_id: status === 0 ? null : `remote-${id}`,
            remote_name: status === 0 ? null : `old-${id}.txt`,
            remote_parent_id: status === 0 ? null : "root",
            last_pushed_digest: status === 0 ? null : `previous-${id}`,
            last_pushed_generation: status === 0 ? null : 4,
            sync_state: i,
            last_error: status === 2 ? "historical failure" : null,
          })}`;
        }
        let operationId = 100;
        for (const type of ["createFolder", "uploadFile", "uploadFileVersion", "moveItem", "renameItem"]) {
          for (const status of ["queued", "leased", "succeeded", "failed"]) {
            operationId += 7;
            yield* sql`INSERT INTO documents_sync_operation ${sql.insert({
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
            })}`;
          }
        }
        let conflictId = 500;
        for (const kind of [
          "remoteCreate",
          "remoteEdit",
          "remoteMove",
          "remoteRename",
          "remoteDelete",
          "remoteUnknown",
        ]) {
          for (const reviewed of [false, true]) {
            conflictId += 11;
            yield* sql`INSERT INTO documents_sync_conflict ${sql.insert({
              ...common("conflict", conflictId),
              sync_item_id: reviewed ? null : 26,
              conflict_kind: kind,
              local_rel_path: reviewed ? null : "folder/synthetic-26.txt",
              remote_event_id: reviewed ? null : `event-${conflictId}`,
              remote_id: reviewed ? null : `remote-${conflictId}`,
              remote_payload: '{"nested":{"b":2,"a":1},"text":" synthetic  text "}',
              resolution_status: reviewed ? "reviewed" : "open",
            })}`;
          }
        }
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
        const scope = yield* Scope.make();
        const runtime = yield* Layer.buildWithScope(
          ImportModel.layer(Layer.empty).pipe(Layer.provide(AlchemyPostgresPlatform.layer())),
          scope
        );
        const first = yield* importSyncGenesis("synthetic-backup", "beep-vault").pipe(Effect.provide(runtime));
        const second = yield* importSyncGenesis("synthetic-backup", "beep-vault").pipe(Effect.provide(runtime));
        expect(second).toEqual(first);
        expect(first).toMatchObject({ items: 4, operations: 20, conflicts: 12, cursors: 2 });
        const state = yield* Context.get(runtime, V.SyncDestination)
          .state(V.DestinationId.make("legacy-box-workspace-9"))
          .pipe(Effect.provide(runtime));
        expect(state).toMatchObject({ orgId: 17, paused: true, cursor: null });
        yield* Scope.close(scope, Exit.void);
        for (const entity of ["conflict", "operation", "item", "cursor"])
          yield* sql`DELETE FROM ${sql(`documents_sync_${entity}`)}`;
        yield* sql`DELETE FROM documents_sync_legacy_identity`;
        const replay = yield* Layer.build(
          ReplayModel.layer(LegacySyncProjections).pipe(Layer.provide(AlchemyPostgresPlatform.layer()))
        );
        void replay;
        const diffs = yield* diffLegacySyncTables().pipe(
          Effect.repeat({ until: A.isReadonlyArrayEmpty, schedule: Schedule.spaced("20 millis") }),
          Effect.timeout("20 seconds")
        );
        expect(diffs).toEqual([]);
        yield* sql`UPDATE documents_sync_item SET row_version=row_version+1,last_pushed_generation=999 WHERE id=26`;
        const negative = yield* diffLegacySyncTables();
        expect(A.map(negative, (d) => d.column)).toEqual(["last_pushed_generation", "row_version"]);
      })
    );
  });
});
