/** The documents server sync Layer: Model as the only writer, admission at startup, unchanged readers. */
import * as NodeURL from "node:url";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import {
  DmsMirrorFixtureHandle,
  ensureLegacyBoxDestination,
  ensureVaultSyncOwnerMembership,
  LegacySyncReadModel,
  readSyncWriterEpoch,
  VaultSyncMembershipLive,
  VaultSyncMirrorRoot,
  VaultSyncOwnership,
  VaultSyncRpcOrganization,
  VaultSyncRpcsApiLive,
  VaultSyncSessionBinding,
  VaultSyncSessionLive,
  VaultSyncSidecarChannelLive,
  VaultSyncWorkspaceRoots,
} from "@beep/documents-server/aggregates/Sync";
import { DocumentsVaultSyncFixtureLive } from "@beep/documents-server/layer";
import { VaultSyncRpcs } from "@beep/documents-use-cases/public";
import { makeLayer as makePgliteLayer } from "@beep/pglite/PgliteClient.service";
import { makeDrizzle, makeDrizzleLayer, migrate } from "@beep/postgres";
import * as Documents from "@beep/shared-domain/identity/Documents";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { BunServices } from "@effect/platform-bun";
import { describe, expect, layer } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as RpcTest from "effect/rpc/RpcTest";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as SqlClient from "effect/sql/SqlClient";

const migrationsFolder = NodeURL.fileURLToPath(new URL("../../../_internal/db-admin/drizzle", import.meta.url));
const database = makeDrizzleLayer().pipe(
  Layer.provideMerge(Layer.fresh(makePgliteLayer({ extensions: { btree_gist } }))),
  Layer.provideMerge(BunServices.layer)
);
const TOKEN = "runtime-launch-token";
const auth = { headers: { authorization: `Bearer ${TOKEN}` } };
const workspaceId = WorkspaceIdentity.WorkspaceId.make(3);
const hostingFor = (root: string) =>
  Layer.mergeAll(
    Layer.succeed(VaultSyncOwnership, { orgOf: Effect.fn("test.ownership")(() => Effect.succeed(1)) }),
    Layer.succeed(VaultSyncMirrorRoot, { name: "beep-vault" }),
    Layer.succeed(VaultSyncWorkspaceRoots, {
      rootOf: Effect.fn("test.roots")((id: number) => Effect.succeed(id === 3 ? O.some(root) : O.none())),
    })
  );
const binding = Layer.effect(
  VaultSyncSessionBinding,
  Effect.map(
    S.decodeEffect(V.VaultSyncRequest)({
      principal: { kind: "User", userId: 7 },
      actorSourceKind: "User",
      sourceKind: "sidecar",
      orgId: 1,
      workspaceId: 3,
      correlationId: "runtime",
      sessionRef: "desktop-launch",
    }),
    (request) => VaultSyncSessionBinding.of({ request, token: Redacted.make(TOKEN) })
  )
);
// The desktop composition: the RPC adapter over the Api sessions over the hosted Model.
const runtimeFor = (root: string) =>
  VaultSyncRpcsApiLive.pipe(
    Layer.provideMerge(
      VaultSyncSessionLive.pipe(
        Layer.provideMerge(VaultSyncSidecarChannelLive),
        Layer.provideMerge(Layer.mergeAll(binding, VaultSyncMembershipLive))
      )
    ),
    Layer.provideMerge(DocumentsVaultSyncFixtureLive),
    Layer.provide(Layer.mergeAll(hostingFor(root), Layer.succeed(VaultSyncRpcOrganization, { orgId: 1 })))
  );
const eventually = <A, E, R>(effect: Effect.Effect<A, E, R>, until: (a: A) => boolean) =>
  effect.pipe(
    Effect.retry({ schedule: Schedule.spaced("20 millis"), times: 500 }),
    Effect.repeat({ until, schedule: Schedule.spaced("20 millis"), times: 500 })
  );
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
  yield* sql`INSERT INTO workspace_workspace ${sql.insert({
    id: 3,
    public_id: "workspace_workspace_aruntime3",
    entity_type: "WorkspaceWorkspace",
    org_id: 1,
    row_version: 1,
    schema_version: "0.1.0",
    source: "System",
    created_at: 1700000000000,
    updated_at: 1700000000000,
    created_by_principal: principal,
    updated_by_principal: principal,
    fixture_key: "runtime",
    name: "runtime",
    organization_fixture_key: "org-1",
    owner_principal_fixture_key: "user-7",
    vault_root_path: null,
  })}`;
  yield* sql`SELECT setval('documents_sync_item_id_seq', 57, true)`;
  yield* sql`SELECT setval('documents_sync_conflict_id_seq', 88, true)`;
});

describe("documents vault sync runtime", () => {
  layer(database, { timeout: "2 minutes", excludeTestServices: true })("model writer", (it) => {
    it.effect("admits once at startup and serves the desktop RPCs over the projected tables", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        yield* seedLegacyStore;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-vault-runtime-" });
        yield* fs.writeFileString(path.join(root, "fresh.txt"), "fresh synthetic content");

        const scope = yield* Scope.make();
        const context = yield* Layer.buildWithScope(runtimeFor(root), scope);
        const client = yield* RpcTest.makeClient(VaultSyncRpcs).pipe(Effect.provideContext(context));
        const epoch = yield* readSyncWriterEpoch;
        assertSome(
          O.map(epoch, (s) => s.epoch),
          "model"
        );

        // Fail closed until the desktop seeds its owner membership; the seed is idempotent.
        const denied = yield* Effect.flip(client.GetVaultSyncStatus({ workspaceId, forceProbe: false }, auth));
        expect(denied._tag).toBe("VaultSyncActionError");
        yield* ensureVaultSyncOwnerMembership(7, 1);
        yield* ensureVaultSyncOwnerMembership(7, 1);
        const memberships = yield* sql`SELECT count(*)::int AS n FROM shared_membership`;
        expect(memberships).toEqual([{ n: 1 }]);

        // The imported conflict is listed with its D14 numeric identities.
        const status = yield* eventually(
          client.GetVaultSyncStatus({ workspaceId, forceProbe: false }, auth),
          (current) => current.openConflicts === 1
        );
        assertSome(status.cursorPosition, "0");
        const open = yield* client.ListVaultSyncConflicts({ workspaceId }, auth);
        expect(A.map(open, (row) => row.id)).toEqual([88]);
        assertSome(
          O.flatMap(A.head(open), (conflict) => conflict.syncItemId),
          Documents.SyncItemId.make(57)
        );
        const foreign = yield* Effect.flip(
          client.ListVaultSyncConflicts({ workspaceId: WorkspaceIdentity.WorkspaceId.make(4) }, auth)
        );
        expect(foreign._tag).toBe("VaultSyncActionError");
        const reviewed = yield* client.MarkVaultSyncConflictReviewed(
          { conflictId: Documents.SyncConflictId.make(88), workspaceId },
          auth
        );
        expect(reviewed).toMatchObject({ id: 88, resolutionStatus: "reviewed" });
        yield* eventually(
          sql`SELECT resolution_status FROM documents_sync_conflict WHERE id = 88`,
          (rows) => rows[0]?.resolution_status === "reviewed"
        );

        // Trigger answers at acceptance; the saga's pass writes rows that join through D14 ids.
        yield* client.TriggerVaultSync({ workspaceId }, auth);
        const joined = yield* eventually(
          sql`SELECT i.id AS item_id, i.sync_state, o.status FROM documents_sync_item i
            JOIN documents_sync_operation o ON o.sync_item_id = i.id WHERE i.local_rel_path = 'fresh.txt'`,
          (rows) => rows[0]?.status === "succeeded" && rows[0]?.sync_state === "current"
        );
        expect(Number(joined[0]?.item_id)).toBeGreaterThan(57);
        const counts = yield* Context.get(context, DmsMirrorFixtureHandle).counts;
        expect(counts.uploadFile).toBe(1);

        // The read model serves every legacy reader over the projected rows.
        const reads = Context.get(context, LegacySyncReadModel);
        const items = yield* reads.items(workspaceId);
        expect(A.map(items, (item) => item.localRelPath).sort()).toEqual(["fresh.txt", "legacy.txt"]);
        const succeeded = yield* reads.operationsByStatus(workspaceId, "succeeded");
        expect(A.map(succeeded, (operation) => operation.targetRelPath)).toContain("fresh.txt");
        const conflict = yield* reads.conflict(Documents.SyncConflictId.make(88));
        assertSome(
          O.map(conflict, (row) => row.resolutionStatus),
          "reviewed"
        );
        const noConflict = yield* reads.conflict(Documents.SyncConflictId.make(999));
        assertNone(noConflict);
        const cursor = yield* reads.cursor(workspaceId);
        assertSome(
          O.map(cursor, (row) => row.workspaceId),
          workspaceId
        );
        const noCursor = yield* reads.cursor(WorkspaceIdentity.WorkspaceId.make(4));
        assertNone(noCursor);

        // The bootstrap registers a workspace destination once; the imported one is kept.
        const bootstrap = Effect.provide(Layer.merge(hostingFor(root), Layer.succeedContext(context)));
        const imported = yield* ensureLegacyBoxDestination(3).pipe(bootstrap);
        expect(imported).toBe("legacy-box-workspace-3");
        const created = yield* ensureLegacyBoxDestination(5).pipe(bootstrap);
        const recreated = yield* ensureLegacyBoxDestination(5).pipe(bootstrap);
        expect(recreated).toBe(created);

        // The legacy writer is fenced while the Model owns the store.
        const legacy = yield* sql`UPDATE documents_sync_item SET last_error = 'old build'`.pipe(Effect.flip);
        expect(legacy._tag).toBe("SqlError");

        // A restart re-hosts the same store without another genesis import.
        const eventsBefore = yield* sql`SELECT count(*)::int AS n FROM alchemy_aggregate_event
          WHERE tag LIKE '%GenesisImported'`;
        yield* Scope.close(scope, Exit.void);
        const restarted = yield* Layer.build(runtimeFor(root));
        const again = yield* RpcTest.makeClient(VaultSyncRpcs).pipe(Effect.provideContext(restarted));
        const afterRestart = yield* eventually(
          again.GetVaultSyncStatus({ workspaceId, forceProbe: false }, auth),
          (current) => current.openConflicts === 0
        );
        // The review heals legacy.txt, absent from the synthetic vault: a local stale input, never a held Box intent.
        const unsettled = yield* sql`SELECT count(*)::int AS n FROM documents_sync_box_receipt WHERE result IS NULL`;
        expect(unsettled).toEqual([{ n: 0 }]);
        expect(afterRestart.openConflicts).toBe(0);
        const eventsAfter = yield* sql`SELECT count(*)::int AS n FROM alchemy_aggregate_event
          WHERE tag LIKE '%GenesisImported'`;
        expect(eventsAfter).toEqual(eventsBefore);
      })
    );
  });
});
