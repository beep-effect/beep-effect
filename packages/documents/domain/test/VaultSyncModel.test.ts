import * as Domain from "@alchemy.run/domain";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { layer } from "@effect/vitest";
import { assertTrue, strictEqual } from "@effect/vitest/utils";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import { constant } from "effect/Function";
import * as H from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Schedule from "effect/Schedule";

class PureVault extends Domain.Model("PureVault", {
  aggregates: [
    V.SyncDestination,
    V.DestinationNameReservation,
    V.SyncItem,
    V.SyncOperation,
    V.SyncConflict,
    V.ConflictEventRegistry,
  ],
  views: [
    V.SyncDestinationSnapshot,
    V.SyncItemSnapshot,
    V.SyncOperationSnapshot,
    V.OpenConflicts,
    V.VaultSyncStatus,
    V.DestinationList,
    V.OperationQueue,
  ],
}) {}
const allowReads = Effect.succeed(constant(Effect.void));
const hosted = PureVault.layer(
  Layer.mergeAll(
    V.DestinationList.toLayer(allowReads),
    V.OpenConflicts.toLayer(allowReads),
    V.OperationQueue.toLayer(allowReads),
    V.VaultSyncStatus.toLayer(allowReads)
  )
).pipe(Layer.provide(Domain.InMemory), Layer.provide(SecureRandom.layerWebCrypto));
const destination = V.DestinationId.make("documents_sync_destination_avaultdomainmodel");
const item = V.ItemId.make("documents_sync_item_a1");
const operation = V.OperationId.make("documents_sync_operation_a1");
const conflict = V.ConflictId.make("documents_sync_conflict_a1");
const path = V.VaultRelPath.make("file.txt");
const remote = V.RemoteItemId.make("box1");
const observation = V.ItemObservation.make({
  destinationId: destination,
  workspaceId: 1,
  path,
  kind: "file",
  digest: "sha:a",
  generation: 1,
  operationId: operation,
  type: "uploadFile",
  parentRequired: false,
});
const input = V.OperationInput.make({
  destinationId: destination,
  itemId: item,
  type: "uploadFile",
  path,
  digest: "sha:a",
  generation: 1,
  parentRequired: false,
  idempotencyKey: operation,
});
const eventually = <A, E, R>(effect: Effect.Effect<A, E, R>, predicate: (a: A) => boolean) =>
  effect.pipe(Effect.repeat({ until: predicate, schedule: Schedule.spaced("5 millis") }), Effect.timeout("5 seconds"));

layer(hosted, { excludeTestServices: true, timeout: "20 seconds" })("pure read contracts", (it) => {
  it.effect("aggregate events reach all read contracts without orchestration or I/O", () =>
    Effect.gen(function* () {
      const destinations = yield* V.SyncDestination;
      const names = yield* V.DestinationNameReservation;
      const items = yield* V.SyncItem;
      const ops = yield* V.SyncOperation;
      const registry = yield* V.ConflictEventRegistry;
      const conflicts = yield* V.SyncConflict;
      const queue = yield* V.OperationQueue;
      const status = yield* V.VaultSyncStatus;
      const open = yield* V.OpenConflicts;
      const list = yield* V.DestinationList;
      const key = V.reservationKey({ orgId: 1, name: "vault" });
      yield* names.send(
        key,
        V.ClaimDestinationName.make({
          claim: { destinationId: destination, orgId: 1, workspaceId: 1, name: "vault", previousName: null },
        })
      );
      yield* destinations.send(destination, V.RegisterDestination.make({ orgId: 1, workspaceId: 1, name: "vault" }));
      yield* destinations.send(
        destination,
        V.RenameDestination.make({ orgId: 1, workspaceId: 1, name: "renamed", previousName: "vault" })
      );
      yield* names.send(key, V.ReleaseDestinationName.make({ destinationId: destination }));
      yield* destinations.send(destination, V.ResolveDestinationRoot.make({ rootId: remote }));
      yield* destinations.send(destination, V.PauseDestination.make({}));
      yield* destinations.send(destination, V.ResumeDestination.make({}));
      yield* destinations.send(destination, V.RecordDestinationPoll.make({ position: "p1", error: null }));
      yield* destinations.send(destination, V.RecordDestinationPoll.make({ position: null, error: "pollEvents" }));
      yield* destinations.send(destination, V.ClaimItemPath.make({ path, itemId: item }));
      yield* destinations.send(destination, V.ReleaseItemPath.make({ path, itemId: item }));
      yield* items.send(item, V.ObserveItem.make({ observation }));
      yield* items.send(item, V.ObserveItem.make({ observation: { ...observation, generation: 2, digest: "sha:b" } }));
      yield* items.send(
        item,
        V.ObserveItem.make({ observation: { ...observation, generation: 3, path: V.VaultRelPath.make("moved.txt") } })
      );
      yield* items.send(item, V.MarkItemPushed.make({ remoteId: remote, generation: 3, operationId: operation }));
      yield* items.send(item, V.FlagItemDrift.make({}));
      yield* items.send(item, V.MarkItemPushFailed.make({ terminal: true, generation: 3 }));
      yield* items.send(item, V.MarkItemPushFailed.make({ terminal: false, generation: 3 }));
      yield* items.send(
        item,
        V.ReturnItemToPending.make({ operationId: V.OperationId.make("documents_sync_operation_aheal") })
      );
      yield* items.send(
        item,
        V.ObserveItem.make({
          observation: {
            ...observation,
            generation: 5,
            kind: "folder",
            digest: null,
            type: "ensureFolder",
            operationId: V.OperationId.make("documents_sync_operation_afolder"),
          },
        })
      );
      yield* ops.send(operation, V.QueueOperation.make({ input }));
      yield* ops.send(operation, V.QueueOperation.make({ input: { ...input, generation: 2 } }));
      yield* ops.send(operation, V.SquashOperation.make({ input: { ...input, generation: 3 } }));
      yield* ops.send(
        operation,
        V.LeaseOperation.make({ holder: "worker", leaseMillis: 1, parentRemoteId: null, itemRemoteId: null })
      );
      yield* Effect.sleep("5 millis");
      yield* ops.send(operation, V.ExpireLease.make({ attempt: 1 }));
      yield* ops.send(
        operation,
        V.LeaseOperation.make({ holder: "worker", leaseMillis: 10000, parentRemoteId: null, itemRemoteId: null })
      );
      yield* ops.send(
        operation,
        V.FailOperation.make({
          holder: "worker",
          attempt: 2,
          retryable: true,
          maxAttempts: 3,
          backoffMillis: 1,
          reason: "uploadFile",
        })
      );
      yield* Effect.sleep("5 millis");
      yield* ops.send(operation, V.RetryOperation.make({ attempt: 2 }));
      yield* ops.send(
        operation,
        V.LeaseOperation.make({ holder: "worker", leaseMillis: 10000, parentRemoteId: null, itemRemoteId: null })
      );
      yield* ops.send(
        operation,
        V.FailOperation.make({
          holder: "worker",
          attempt: 3,
          retryable: false,
          maxAttempts: 3,
          backoffMillis: 1,
          reason: "uploadFileVersion",
        })
      );
      yield* ops.send(operation, V.ReviveOperation.make({}));
      yield* ops.send(
        operation,
        V.LeaseOperation.make({ holder: "worker", leaseMillis: 10000, parentRemoteId: null, itemRemoteId: null })
      );
      yield* ops.send(operation, V.CompleteOperation.make({ holder: "worker", attempt: 4 }));
      const superseded = V.OperationId.make("documents_sync_operation_asuperseded");
      yield* ops.send(superseded, V.QueueOperation.make({ input: { ...input, idempotencyKey: superseded } }));
      yield* ops.send(superseded, V.SupersedeOperation.make({ reason: "kind-replaced" }));
      const record = V.ConflictRecord.make({
        publicId: conflict,
        destinationId: destination,
        workspaceId: 1,
        remoteEventId: "event1",
        itemId: item,
        evidence: "remote rename",
        reviewed: false,
      });
      yield* registry.send(destination, V.RecordConflict.make({ record }));
      yield* conflicts.send(conflict, V.ConfirmConflict.make({ record }));
      yield* eventually(open.get(V.SyncDestination.ref(destination)), (s) => O.isSome(s) && H.size(s.value) === 1);
      // A correction keyed off its own operation id could never queue; review refuses it up front.
      const unreachable = yield* conflicts
        .send(
          conflict,
          V.ReviewConflict.make({
            remoteEventId: "event1",
            workspaceId: 1,
            destinationId: destination,
            correction: { operationId: V.OperationId.make("documents_sync_operation_acorrection"), input },
            healOperationId: V.OperationId.make("documents_sync_operation_aheal2"),
          })
        )
        .pipe(Effect.flip);
      strictEqual(unreachable.rule, "correction-key");
      yield* conflicts.send(
        conflict,
        V.ReviewConflict.make({
          remoteEventId: "event1",
          workspaceId: 1,
          destinationId: destination,
          correction: null,
          healOperationId: V.OperationId.make("documents_sync_operation_aheal2"),
        })
      );
      yield* conflicts.send(
        conflict,
        V.ConfirmConflictReview.make({ remoteEventId: "event1", workspaceId: 1, destinationId: destination })
      );
      yield* eventually(open.get(V.SyncDestination.ref(destination)), (s) => O.isSome(s) && H.size(s.value) === 0);
      yield* eventually(
        queue.get(V.SyncDestination.ref(destination)),
        (s) => O.isSome(s) && O.exists(H.get(s.value, superseded), (v) => v?.status === "superseded")
      );
      yield* eventually(list.get(V.WorkspaceKey.make("1:1")), (s) => O.isSome(s) && H.size(s.value) === 1);
      const summary = yield* eventually(
        status.get(V.SyncDestination.ref(destination)),
        (s) => O.isSome(s) && H.size(s.value.items) === 1 && H.size(s.value.operations) === 2
      );
      const present = O.isSome(summary);
      assertTrue(present);
    })
  );
});
