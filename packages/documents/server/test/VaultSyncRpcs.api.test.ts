import * as Domain from "@alchemy.run/domain";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { SyncConflict } from "@beep/documents-domain/entities/SyncConflict";
import {
  VaultSyncMembershipLive,
  VaultSyncRpcOrganization,
  VaultSyncRpcsApiLive,
  VaultSyncSessionBinding,
  VaultSyncSessionLive,
  VaultSyncSidecarChannelLive,
} from "@beep/documents-server/aggregates/Sync";
import { DmsMirrorAvailability, DmsMirrorProbe } from "@beep/documents-use-cases/aggregates/Sync/server";
import { VaultSyncModel, VaultSyncPolicies } from "@beep/documents-use-cases/aggregates/VaultSync";
import { SyncConflictRepository } from "@beep/documents-use-cases/entities/SyncConflict/server";
import { VaultSyncRpcs } from "@beep/documents-use-cases/public";
import { PgliteTestLayer } from "@beep/pglite/Pglite.test-layer";
import { describe, expect, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as RpcTest from "effect/rpc/RpcTest";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as SqlClient from "effect/sql/SqlClient";
import * as TestClock from "effect/testing/TestClock";

const TOKEN = "compat-launch-token";
const own = V.DestinationId.make("documents_sync_destination_acompat");
const conflictId = V.ConflictId.make("documents_sync_conflict_c1");

const legacyRowInput = {
  conflictKind: "remoteEdit",
  createdAt: 1,
  createdByPrincipal: { kind: "System", component: "Runtime" },
  entityType: "DocumentsSyncConflict",
  id: 41,
  localRelPath: "matters/synthetic/file.txt",
  orgId: 1,
  provider: "box",
  publicId: conflictId,
  remoteEventId: "event-c1",
  remoteId: "remote-1",
  remotePayload: { eventType: "ITEM_MODIFY" },
  resolutionStatus: "open",
  rowVersion: 1,
  schemaVersion: "0.0.0",
  source: "System",
  syncItemId: 1,
  updatedAt: 1,
  updatedByPrincipal: { kind: "System", component: "Runtime" },
  workspaceId: 1,
} as const;
const moveId = V.ConflictId.make("documents_sync_conflict_m1");
// One decode of both legacy rows: the open edit (41) and the open remote move (43).
const decodeLegacyRows = S.decodeEffect(S.Tuple([SyncConflict, SyncConflict]))([
  legacyRowInput,
  { ...legacyRowInput, id: 43, publicId: moveId, conflictKind: "remoteMove", remoteEventId: "event-m1" },
]);

const binding = Layer.effect(
  VaultSyncSessionBinding,
  Effect.map(
    S.decodeEffect(V.VaultSyncRequest)({
      principal: { kind: "User", userId: 7 },
      principalKey: "User:7",
      actorSourceKind: "User",
      sourceKind: "sidecar",
      orgId: 1,
      workspaceId: 1,
      correlationId: "bound",
      sessionRef: "desktop-launch",
    }),
    (request) => VaultSyncSessionBinding.of({ request, token: Redacted.make(TOKEN) })
  )
);

const probe = DmsMirrorProbe.make({ connected: true, provider: "box" });

const setup = Effect.fn("VaultSyncRpcsTest.setup")(function* (extraRows: ReadonlyArray<SyncConflict> = []) {
  const [legacyRow] = yield* decodeLegacyRows;
  // A legacy row with no matching authorized View record must never be returned.
  const unrelatedRow = SyncConflict.make({
    ...legacyRow,
    id: 42 as never,
    publicId: "documents_sync_conflict_zz" as never,
  });
  const refreshed = yield* Ref.make(0);
  const availability = Layer.succeed(
    DmsMirrorAvailability,
    DmsMirrorAvailability.of({
      probe: Effect.succeed(probe),
      refresh: Effect.as(
        Ref.update(refreshed, (n) => n + 1),
        probe
      ),
    })
  );
  const legacy = Layer.succeed(
    SyncConflictRepository,
    SyncConflictRepository.of({
      listOpen: Effect.fn("legacy.listOpen")(() => Effect.succeed([legacyRow, unrelatedRow, ...extraRows])),
      markReviewed: Effect.fn("legacy.markReviewed")(() => Effect.die("the adapter never writes legacy rows")),
      record: Effect.fn("legacy.record")(() => Effect.die("the adapter never writes legacy rows")),
    })
  );
  const host = VaultSyncSessionLive.pipe(
    Layer.provideMerge(VaultSyncSidecarChannelLive),
    Layer.provideMerge(VaultSyncModel.layer(VaultSyncPolicies).pipe(Layer.provide(Domain.InMemory))),
    Layer.provideMerge(Layer.mergeAll(binding, VaultSyncMembershipLive)),
    Layer.provideMerge(Layer.fresh(PgliteTestLayer))
  );
  const context = yield* Layer.build(
    VaultSyncRpcsApiLive.pipe(
      Layer.provideMerge(host),
      Layer.provide(Layer.mergeAll(availability, legacy, Layer.succeed(VaultSyncRpcOrganization, { orgId: 1 })))
    )
  );
  const sql = Context.get(context, SqlClient.SqlClient);
  yield* sql`CREATE TABLE workspace_workspace (id integer PRIMARY KEY, org_id integer NOT NULL)`;
  yield* sql`CREATE TABLE shared_membership (id serial PRIMARY KEY, org_id integer NOT NULL, role text NOT NULL,
    status text NOT NULL, user_id integer NOT NULL, deleted_at bigint)`;
  yield* sql`INSERT INTO workspace_workspace (id, org_id) VALUES (1, 1)`;
  const destinations = Context.get(context, V.SyncDestination);
  yield* destinations.send(own, V.RegisterDestination.make({ orgId: 1, workspaceId: 1, name: "compat" }));
  const registry = Context.get(context, V.ConflictEventRegistry);
  yield* registry.send(
    own,
    V.RecordConflict.make({
      record: V.ConflictRecord.make({
        publicId: conflictId,
        destinationId: own,
        workspaceId: 1,
        remoteEventId: "event-c1",
        itemId: null,
        evidence: "remote edit",
        reviewed: false,
      }),
    })
  );
  const client = yield* RpcTest.makeClient(VaultSyncRpcs).pipe(Effect.provideContext(context));
  return { client, context, refreshed, sql };
});

const workspaceId = 1 as never;
const headers = { headers: { authorization: `Bearer ${TOKEN}` } };

describe("desktop VaultSyncRpcs served through the vault-sync Api", () => {
  it.effect("denies every legacy RPC without a live membership, then serves the legacy wire", () =>
    Effect.gen(function* () {
      const { client, refreshed, sql } = yield* setup();
      const denied = yield* Effect.flip(client.GetVaultSyncStatus({ workspaceId, forceProbe: false }, headers));
      expect(denied._tag).toBe("VaultSyncActionError");
      yield* sql`INSERT INTO shared_membership (org_id, role, status, user_id) VALUES (1, 'member', 'active', 7)`;
      // Views project asynchronously: retry until the destination and its conflict are visible.
      const status = yield* client.GetVaultSyncStatus({ workspaceId, forceProbe: false }, headers).pipe(
        Effect.retry({ schedule: Schedule.spaced("10 millis"), times: 300 }),
        Effect.repeat({
          until: (current) => current.openConflicts === 1,
          schedule: Schedule.spaced("10 millis"),
          times: 300,
        })
      );
      expect(status.connected).toBe(true);
      expect(status.provider).toBe("box");
      const conflicts = yield* client.ListVaultSyncConflicts({ workspaceId }, headers);
      expect(A.map(conflicts, (row) => row.id)).toEqual([41]);
      yield* client.GetVaultSyncStatus({ workspaceId, forceProbe: true }, headers);
      const refreshes = yield* Ref.get(refreshed);
      expect(refreshes).toBe(1);
      const triggered = yield* client.TriggerVaultSync({ workspaceId }, headers);
      expect(triggered.provider).toBe("box");
      const reviewed = yield* client.MarkVaultSyncConflictReviewed({ conflictId: 41 as never, workspaceId }, headers);
      expect(reviewed.resolutionStatus).toBe("reviewed");
      const unknown = yield* Effect.flip(
        client.MarkVaultSyncConflictReviewed({ conflictId: 42 as never, workspaceId }, headers)
      );
      expect(unknown._tag).toBe("VaultSyncActionError");
      const foreignWorkspace = yield* Effect.flip(client.ListVaultSyncConflicts({ workspaceId: 2 as never }, headers));
      expect(foreignWorkspace._tag).toBe("VaultSyncActionError");
      yield* sql`UPDATE shared_membership SET deleted_at = 1`;
      const revoked = yield* Effect.flip(client.TriggerVaultSync({ workspaceId }, headers));
      expect(revoked._tag).toBe("VaultSyncActionError");
    }).pipe(TestClock.withLive)
  );

  it.effect("reviewing a remote move queues the corrective move before the review closes (I14)", () =>
    Effect.gen(function* () {
      const [, moveRow] = yield* decodeLegacyRows;
      const { client, context, sql } = yield* setup([moveRow]);
      yield* sql`INSERT INTO shared_membership (org_id, role, status, user_id) VALUES (1, 'member', 'active', 7)`;
      const items = Context.get(context, V.SyncItem);
      const itemId = V.ItemId.make("documents_sync_item_amoved");
      const pushOperation = V.OperationId.make("documents_sync_operation_amovedpush");
      const path = V.VaultRelPath.make("matters/synthetic/file.txt");
      yield* items.send(
        itemId,
        V.ObserveItem.make({
          observation: {
            destinationId: own,
            workspaceId: 1,
            path,
            kind: "file",
            digest: "d1",
            generation: 1,
            operationId: pushOperation,
            type: "uploadFile",
            parentRequired: true,
          },
        })
      );
      yield* items.send(
        itemId,
        V.MarkItemPushed.make({
          remoteId: V.RemoteItemId.make("remote-moved"),
          generation: 1,
          operationId: pushOperation,
        })
      );
      const registry = Context.get(context, V.ConflictEventRegistry);
      yield* registry.send(
        own,
        V.RecordConflict.make({
          record: V.ConflictRecord.make({
            publicId: moveId,
            destinationId: own,
            workspaceId: 1,
            remoteEventId: "event-m1",
            itemId,
            evidence: "remote move",
            kind: "remoteMove",
            remoteId: V.RemoteItemId.make("remote-moved"),
            reviewed: false,
          }),
        })
      );
      // Wait until the View shows both the pushed item and the open move conflict.
      yield* client
        .ListVaultSyncConflicts({ workspaceId }, headers)
        .pipe(
          Effect.retry({ schedule: Schedule.spaced("10 millis"), times: 300 }),
          Effect.repeat({ until: (rows) => A.length(rows) === 2, schedule: Schedule.spaced("10 millis"), times: 300 })
        );
      const reviewed = yield* client.MarkVaultSyncConflictReviewed({ conflictId: 43 as never, workspaceId }, headers);
      expect(reviewed.resolutionStatus).toBe("reviewed");
      const conflicts = Context.get(context, V.SyncConflict);
      const closed = yield* conflicts.state(moveId).pipe(
        Effect.repeat({
          until: (state) => state?.reviewed === true,
          schedule: Schedule.spaced("10 millis"),
          times: 300,
        })
      );
      expect(closed?.reviewed).toBe(true);
      const item = yield* items.state(itemId);
      const slot = item === null ? undefined : A.fromIterable(item.slots)[0];
      expect(slot?.[0]).toBe("moveItem");
      const operations = Context.get(context, V.SyncOperation);
      const correction = slot === undefined ? null : yield* operations.state(slot[1]);
      expect(correction?.status).toBe("queued");
      expect(correction?.input).toMatchObject({ type: "moveItem", path, itemId, generation: 2 });
    }).pipe(TestClock.withLive)
  );

  it.effect("streams status frames through the Api gate and updates when the View changes", () =>
    Effect.gen(function* () {
      const { client, context, sql } = yield* setup();
      const denied = yield* client.WatchVaultSyncStatus({ workspaceId }, headers).pipe(Stream.runDrain, Effect.flip);
      expect(denied._tag).toBe("VaultSyncActionError");
      yield* sql`INSERT INTO shared_membership (org_id, role, status, user_id) VALUES (1, 'member', 'active', 7)`;
      const frames = yield* Ref.make<ReadonlyArray<number>>([]);
      const watching = yield* client.WatchVaultSyncStatus({ workspaceId }, headers).pipe(
        Stream.tap((frame) => Ref.update(frames, A.append(frame.pendingItems))),
        Stream.takeUntil((frame) => frame.pendingItems === 1),
        Stream.runDrain,
        Effect.retry({ schedule: Schedule.spaced("10 millis"), times: 300 }),
        Effect.forkChild
      );
      const items = Context.get(context, V.SyncItem);
      yield* Ref.get(frames).pipe(
        Effect.repeat({ until: (seen) => A.isReadonlyArrayNonEmpty(seen), schedule: Schedule.spaced("10 millis") }),
        Effect.timeout("10 seconds")
      );
      yield* items.send(
        V.ItemId.make("documents_sync_item_awatched"),
        V.ObserveItem.make({
          observation: {
            destinationId: own,
            workspaceId: 1,
            path: V.VaultRelPath.make("watched.txt"),
            kind: "file",
            digest: "d1",
            generation: 1,
            operationId: V.OperationId.make("documents_sync_operation_awatched"),
            type: "uploadFile",
            parentRequired: false,
          },
        })
      );
      yield* Fiber.join(watching).pipe(Effect.timeout("10 seconds"));
      const seen = yield* Ref.get(frames);
      expect(seen[0]).toBe(0);
      assertSome(A.last(seen), 1);
    }).pipe(TestClock.withLive)
  );
});
