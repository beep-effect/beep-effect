/** The documents server sync Layer: Model as the only writer, admission at startup, unchanged readers. */
import * as NodeURL from "node:url";
import {
  DmsMirrorFixtureHandle,
  readSyncWriterEpoch,
  VaultSyncMirrorRoot,
  VaultSyncOwnership,
} from "@beep/documents-server/aggregates/Sync";
import { DocumentsVaultSyncFixtureLive } from "@beep/documents-server/layer";
import {
  ListOpenConflictsInput,
  MarkConflictReviewedInput,
  SyncOnceInput,
  VaultSyncEngine,
  VaultSyncStatusInput,
} from "@beep/documents-use-cases/aggregates/Sync/server";
import { makeLayer as makePgliteLayer } from "@beep/pglite/PgliteClient.service";
import { makeDrizzle, makeDrizzleLayer, migrate } from "@beep/postgres";
import * as Documents from "@beep/shared-domain/identity/Documents";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { BunServices } from "@effect/platform-bun";
import { describe, expect, layer } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Scope from "effect/Scope";
import * as SqlClient from "effect/sql/SqlClient";

const migrationsFolder = NodeURL.fileURLToPath(new URL("../../../_internal/db-admin/drizzle", import.meta.url));
const database = makeDrizzleLayer().pipe(
  Layer.provideMerge(Layer.fresh(makePgliteLayer({ extensions: { btree_gist } }))),
  Layer.provideMerge(BunServices.layer)
);
const hosting = Layer.mergeAll(
  Layer.succeed(VaultSyncOwnership, { orgOf: Effect.fn("test.ownership")(() => Effect.succeed(1)) }),
  Layer.succeed(VaultSyncMirrorRoot, { name: "beep-vault" })
);
const workspaceId = WorkspaceIdentity.WorkspaceId.make(3);
const principal = '{"kind":"System","component":"Sync"}';
const entityTypes = {
  item: Documents.SyncItemId.entityType,
  conflict: Documents.SyncConflictId.entityType,
  cursor: Documents.SyncCursorId.entityType,
};
const common = (entity: keyof typeof entityTypes, id: number) => ({
  id,
  public_id: `documents_sync_${entity}_alegacy${id}`,
  entity_type: entityTypes[entity],
  org_id: 1,
  workspace_id: 3,
  provider: "box",
  row_version: 4,
  schema_version: "0.1.0",
  source: "System",
  created_at: 1700000000000 + id,
  updated_at: 1700000000500 + id,
  created_by_principal: principal,
  updated_by_principal: principal,
});

const seedLegacyStore = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const db = yield* makeDrizzle();
  yield* migrate(db, { migrationsFolder, migrationsSchema: "drizzle" });
  yield* sql`INSERT INTO documents_sync_item ${sql.insert({
    ...common("item", 57),
    local_rel_path: "legacy.txt",
    item_kind: "file",
    content_digest: "legacy-digest",
    content_size_bytes: 6,
    local_generation: 3,
    remote_id: "remote-legacy",
    remote_name: "legacy.txt",
    remote_parent_id: null,
    last_pushed_digest: "legacy-digest",
    last_pushed_generation: 3,
    sync_state: "conflict",
    last_error: null,
  })}`;
  yield* sql`INSERT INTO documents_sync_conflict ${sql.insert({
    ...common("conflict", 88),
    sync_item_id: 57,
    conflict_kind: "remoteEdit",
    local_rel_path: "legacy.txt",
    remote_event_id: "legacy-event",
    remote_id: "remote-legacy",
    remote_payload: '{"synthetic":true}',
    resolution_status: "open",
  })}`;
  yield* sql`INSERT INTO documents_sync_cursor ${sql.insert({
    ...common("cursor", 9),
    stream_position: "0",
    last_event_id: null,
    status: "active",
    last_error: null,
  })}`;
  yield* sql`SELECT setval('documents_sync_item_id_seq', 57, true)`;
  yield* sql`SELECT setval('documents_sync_conflict_id_seq', 88, true)`;
});

const runtime = DocumentsVaultSyncFixtureLive.pipe(Layer.provide(hosting));

describe("documents vault sync runtime", () => {
  layer(database, { timeout: "2 minutes", excludeTestServices: true })("model writer", (it) => {
    it.effect("admits once at startup and serves unchanged readers over the projected tables", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        yield* seedLegacyStore;

        const scope = yield* Scope.make();
        const context = yield* Layer.buildWithScope(runtime, scope);
        const engine = Context.get(context, VaultSyncEngine);
        const epoch = yield* readSyncWriterEpoch;
        assertSome(
          O.map(epoch, (s) => s.epoch),
          "model"
        );

        // Readers see the legacy entities with their numeric D14 identities.
        const status = yield* engine.status(VaultSyncStatusInput.make({ workspaceId }));
        expect(status).toMatchObject({ conflictItems: 1, openConflicts: 1, queuedOperations: 0 });
        assertSome(status.cursorPosition, "0");
        const open = yield* engine.listOpenConflicts(ListOpenConflictsInput.make({ workspaceId }));
        expect(open).toHaveLength(1);
        expect(open[0]).toMatchObject({ id: 88, publicId: "documents_sync_conflict_alegacy88" });
        assertSome(
          O.flatMap(A.head(open), (conflict) => conflict.syncItemId),
          Documents.SyncItemId.make(57)
        );

        // A numeric review id from another workspace is not found.
        const foreign = yield* engine
          .markConflictReviewed(
            MarkConflictReviewedInput.make({
              conflictId: Documents.SyncConflictId.make(88),
              workspaceId: WorkspaceIdentity.WorkspaceId.make(4),
            })
          )
          .pipe(Effect.flip);
        expect(foreign._tag).toBe("VaultSyncConflictNotFound");
        const reviewed = yield* engine.markConflictReviewed(
          MarkConflictReviewedInput.make({ conflictId: Documents.SyncConflictId.make(88), workspaceId })
        );
        expect(reviewed).toMatchObject({ id: 88, resolutionStatus: "reviewed" });
        const afterReview = yield* engine.listOpenConflicts(ListOpenConflictsInput.make({ workspaceId }));
        expect(afterReview).toEqual([]);

        // A pass through the Model writes new rows that join through D14 numeric ids.
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-vault-runtime-" });
        yield* fs.writeFileString(path.join(root, "fresh.txt"), "fresh synthetic content");
        const synced = yield* engine.syncOnce(SyncOnceInput.make({ vaultRootPath: root, workspaceId }));
        expect(synced.queuedOperations).toBe(0);
        expect(synced.failedOperations).toBe(0);
        const fixture = Context.get(context, DmsMirrorFixtureHandle);
        const counts = yield* fixture.counts;
        expect(counts.uploadFile).toBe(1);
        const joined = yield* sql`SELECT i.id AS item_id, i.sync_state, o.status, o.sync_item_id
          FROM documents_sync_item i JOIN documents_sync_operation o ON o.sync_item_id = i.id
          WHERE i.local_rel_path = 'fresh.txt'`;
        expect(joined).toHaveLength(1);
        expect(joined[0]).toMatchObject({ sync_state: "current", status: "succeeded" });
        expect(Number(joined[0]?.item_id)).toBeGreaterThan(57);

        // The legacy writer is fenced while the Model owns the store.
        const legacy = yield* sql`UPDATE documents_sync_item SET last_error = 'old build'`.pipe(Effect.flip);
        expect(legacy._tag).toBe("SqlError");

        // A restart re-hosts the same store without another genesis import.
        const eventsBefore = yield* sql`SELECT count(*)::int AS n FROM alchemy_aggregate_event`;
        yield* Scope.close(scope, Exit.void);
        const restarted = yield* Layer.build(runtime);
        const again = yield* Context.get(restarted, VaultSyncEngine).status(VaultSyncStatusInput.make({ workspaceId }));
        expect(again).toMatchObject({ openConflicts: 0, failedOperations: 0 });
        const eventsAfter = yield* sql`SELECT count(*)::int AS n FROM alchemy_aggregate_event`;
        expect(eventsAfter).toEqual(eventsBefore);
      })
    );
  });
});
