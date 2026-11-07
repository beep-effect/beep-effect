import * as Domain from "@alchemy.run/domain";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { VaultSyncModel, VaultSyncPolicies } from "@beep/documents-use-cases/aggregates/VaultSync";
import { describe, expect, it, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as H from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Schedule from "effect/Schedule";
import * as Str from "effect/String";
import type * as Platform from "@alchemy.run/domain/Platform";

const destination = V.DestinationId.make("vault-main");
const itemId = (n: string) => V.ItemId.make(`documents_sync_item_a${n}`);
const opId = (n: string) => V.OperationId.make(`documents_sync_operation_a${Str.toLowerCase(n)}`);
const path = V.VaultRelPath.make("folder/file.txt");
const remote = V.RemoteItemId.make("box-1");
const input = (n: string, type: V.OperationType = "uploadFile"): V.OperationInput => ({
  destinationId: destination,
  itemId: itemId(n),
  type,
  path,
  digest: "sha256:a",
  generation: 1,
  parentRequired: true,
  idempotencyKey: opId(n),
});
const observe = (n: string): V.ItemObservation => ({
  destinationId: destination,
  workspaceId: 1,
  path: V.VaultRelPath.make(`folder/${n}.txt`),
  kind: "file",
  digest: "sha256:a",
  generation: 1,
  operationId: opId(n),
  type: "uploadFile",
  parentRequired: true,
});
const eventually = <A, E, R>(effect: Effect.Effect<A, E, R>, predicate: (a: A) => boolean) =>
  effect.pipe(Effect.repeat({ until: predicate, schedule: Schedule.spaced("10 millis") }), Effect.timeout("5 seconds"));

export const scenarios = <E>({
  name,
  platform,
}: {
  readonly name: string;
  readonly platform: Layer.Layer<Platform.Platform, E>;
}) => {
  const hosted = VaultSyncModel.layer(VaultSyncPolicies).pipe(Layer.provide(platform));
  describe(name, () => {
    it("declarations are valid", () => expect(Domain.verify(VaultSyncModel)).toEqual([]));
    layer(hosted, { excludeTestServices: true, concurrent: false, timeout: "20 seconds" })("vault sync", (it) => {
      it.effect("name reservation serializes competing claims and releases the old name after rename", () =>
        Effect.gen(function* () {
          const names = yield* V.DestinationNameReservation;
          const destinations = yield* V.SyncDestination;
          const key = V.ReservationKey.make("1:beep-vault");
          yield* names.send(
            key,
            V.ClaimDestinationName.make({
              claim: { destinationId: destination, orgId: 1, workspaceId: 1, name: "Beep-Vault", previousName: null },
            })
          );
          yield* eventually(destinations.state(destination), (s) => s._tag === "Registered");
          const rejected = yield* names
            .send(
              key,
              V.ClaimDestinationName.make({
                claim: {
                  destinationId: V.DestinationId.make("other"),
                  orgId: 1,
                  workspaceId: 2,
                  name: "beep-vault",
                  previousName: null,
                },
              })
            )
            .pipe(Effect.flip);
          expect(rejected.rule).toBe("name-held");
          yield* names.send(
            V.ReservationKey.make("1:renamed"),
            V.ClaimDestinationName.make({
              claim: {
                destinationId: destination,
                orgId: 1,
                workspaceId: 1,
                name: "renamed",
                previousName: "Beep-Vault",
              },
            })
          );
          yield* eventually(names.state(key), (s) => s === null);
          const actual1 = yield* destinations.state(destination);
          expect(actual1).toMatchObject({ name: "renamed" });
        })
      );
      it.effect(
        "cursor failures retain the durable position, pause/resume is explicit, and paths have one owner (I6,I7,I21)",
        () =>
          Effect.gen(function* () {
            const destinations = yield* V.SyncDestination;
            yield* destinations.send(destination, V.RecordDestinationPoll.make({ position: "p1", error: null }));
            yield* destinations.send(destination, V.RecordDestinationPoll.make({ position: "p2", error: "offline" }));
            yield* destinations.send(destination, V.PauseDestination.make({}));
            const actual2 = yield* destinations.state(destination);
            expect(actual2).toMatchObject({
              cursor: "p1",
              cursorError: "offline",
              paused: true,
            });
            yield* destinations.send(destination, V.ResolveDestinationRoot.make({ rootId: remote }));
            yield* destinations.send(destination, V.ClaimItemPath.make({ path, itemId: itemId("path1") }));
            const rejected = yield* destinations
              .send(destination, V.ClaimItemPath.make({ path, itemId: itemId("path2") }))
              .pipe(Effect.flip);
            expect(rejected.rule).toBe("path-held");
            yield* destinations.send(destination, V.ReleaseItemPath.make({ path, itemId: itemId("path2") }));
            const state = yield* destinations.state(destination);
            expect(state._tag === "Registered" && H.size(state.paths)).toBe(1);
          })
      );
      it.effect("observations queue and retarget the same public operation, and protect one slot (I3,I4,I5)", () =>
        Effect.gen(function* () {
          const items = yield* V.SyncItem;
          const operations = yield* V.SyncOperation;
          yield* items.send(itemId("queue"), V.ObserveItem.make({ observation: observe("queue") }));
          yield* eventually(operations.state(opId("queue")), (s) => s !== null);
          yield* items.send(
            itemId("queue"),
            V.ObserveItem.make({ observation: { ...observe("queue"), generation: 2, digest: "sha256:b" } })
          );
          yield* eventually(operations.state(opId("queue")), (s) => s?.input.generation === 2);
          const actual3 = yield* operations.state(opId("queue"));
          expect(actual3).toMatchObject({
            input: { idempotencyKey: opId("queue"), digest: "sha256:b" },
          });
          const rejected = yield* items
            .send(
              itemId("queue"),
              V.ObserveItem.make({ observation: { ...observe("queue"), generation: 3, operationId: opId("other") } })
            )
            .pipe(Effect.flip);
          expect(rejected.rule).toBe("operation-slot-held");
        })
      );
      it.effect("missing parent and remote ids leave operations queued without an attempt (I9,I10)", () =>
        Effect.gen(function* () {
          const ops = yield* V.SyncOperation;
          for (const type of V.OperationType.literals) {
            const id = opId(`gate${type}`);
            yield* ops.send(id, V.QueueOperation.make({ input: { ...input("gate", type), idempotencyKey: id } }));
            const parent = yield* ops
              .send(
                id,
                V.LeaseOperation.make({
                  holder: "worker",
                  leaseMillis: 10000,
                  parentRemoteId: null,
                  itemRemoteId: null,
                })
              )
              .pipe(Effect.flip);
            expect(parent.rule).toBe("parent-remote-id");
            if (type !== "ensureFolder" && type !== "uploadFile") {
              const missing = yield* ops
                .send(
                  id,
                  V.LeaseOperation.make({
                    holder: "worker",
                    leaseMillis: 10000,
                    parentRemoteId: remote,
                    itemRemoteId: null,
                  })
                )
                .pipe(Effect.flip);
              expect(missing.rule).toBe("item-remote-id");
            }
            const actual4 = yield* ops.state(id);
            expect(actual4).toMatchObject({ status: "queued", attempts: 0 });
          }
        })
      );
      it.effect("lease expiry requeues and a stale holder cannot complete (I2,I18)", () =>
        Effect.gen(function* () {
          const ops = yield* V.SyncOperation;
          const id = opId("expiry");
          yield* ops.send(id, V.QueueOperation.make({ input: input("expiry") }));
          yield* ops.send(
            id,
            V.LeaseOperation.make({ holder: "first", leaseMillis: 60, parentRemoteId: remote, itemRemoteId: null })
          );
          const busy = yield* ops
            .send(
              id,
              V.LeaseOperation.make({ holder: "other", leaseMillis: 60, parentRemoteId: remote, itemRemoteId: null })
            )
            .pipe(Effect.flip);
          expect(busy.rule).toBe("not-queued");
          yield* eventually(ops.state(id), (s) => s?.status === "queued");
          yield* ops.send(
            id,
            V.LeaseOperation.make({ holder: "second", leaseMillis: 10000, parentRemoteId: remote, itemRemoteId: null })
          );
          const stale = yield* ops
            .send(id, V.CompleteOperation.make({ holder: "first", attempt: 1 }))
            .pipe(Effect.flip);
          expect(stale.rule).toBe("stale-lease");
          yield* ops.send(id, V.ExpireLease.make({ attempt: 1 }));
          const actual5 = yield* ops.state(id);
          expect(actual5).toMatchObject({ status: "leased", attempts: 2 });
          yield* ops.send(id, V.CompleteOperation.make({ holder: "second", attempt: 2 }));
        })
      );
      it.effect(
        "retryable errors schedule backoff, terminal errors fail immediately, superseded ops never revive (I16)",
        () =>
          Effect.gen(function* () {
            const ops = yield* V.SyncOperation;
            for (const n of ["retry", "terminal", "budget"]) {
              yield* ops.send(opId(n), V.QueueOperation.make({ input: input(n) }));
              yield* ops.send(
                opId(n),
                V.LeaseOperation.make({
                  holder: "worker",
                  leaseMillis: 10000,
                  parentRemoteId: remote,
                  itemRemoteId: null,
                })
              );
              yield* ops.send(
                opId(n),
                V.FailOperation.make({
                  holder: "worker",
                  attempt: 1,
                  retryable: n !== "terminal",
                  maxAttempts: n === "budget" ? 1 : 3,
                  backoffMillis: 60,
                  reason: "vendor",
                })
              );
            }
            const actual6 = yield* ops.state(opId("retry"));
            expect(actual6).toMatchObject({ status: "retrying" });
            const actual7 = yield* ops.state(opId("terminal"));
            expect(actual7).toMatchObject({ status: "failed" });
            const actual8 = yield* ops.state(opId("budget"));
            expect(actual8).toMatchObject({ status: "failed" });
            yield* eventually(ops.state(opId("retry")), (s) => s?.status === "queued");
            yield* ops.send(opId("terminal"), V.ReviveOperation.make({}));
            yield* ops.send(opId("terminal"), V.SupersedeOperation.make({ reason: "replacement" }));
            yield* ops.send(opId("terminal"), V.ReviveOperation.make({}));
            const actual9 = yield* ops.state(opId("terminal"));
            expect(actual9).toMatchObject({ status: "superseded" });
          })
      );
      it.effect("kind replacement supersedes prior operation slots", () =>
        Effect.gen(function* () {
          const items = yield* V.SyncItem;
          const ops = yield* V.SyncOperation;
          yield* items.send(itemId("kind"), V.ObserveItem.make({ observation: observe("kind") }));
          yield* eventually(ops.state(opId("kind")), (s) => s !== null);
          yield* items.send(
            itemId("kind"),
            V.ObserveItem.make({
              observation: {
                ...observe("kind"),
                kind: "folder",
                digest: null,
                type: "ensureFolder",
                generation: 2,
                operationId: opId("folder"),
              },
            })
          );
          yield* eventually(ops.state(opId("kind")), (s) => s?.status === "superseded");
          yield* eventually(ops.state(opId("folder")), (s) => s?.input.type === "ensureFolder");
        })
      );
      it.effect(
        "remote event dedupe and workspace review scope hold; correction queues before closure (I8,I12,I13,I14)",
        () =>
          Effect.gen(function* () {
            const conflicts = yield* V.SyncConflict;
            const registry = yield* V.ConflictEventRegistry;
            const ops = yield* V.SyncOperation;
            const record: V.ConflictRecord = {
              publicId: V.ConflictId.make("documents_sync_conflict_a1"),
              destinationId: destination,
              workspaceId: 1,
              remoteEventId: "event-1",
              itemId: itemId("review"),
              evidence: "remote moved",
              reviewed: false,
            };
            yield* registry.send(destination, V.RecordConflict.make({ record }));
            yield* registry.send(
              destination,
              V.RecordConflict.make({
                record: { ...record, publicId: V.ConflictId.make("documents_sync_conflict_a2") },
              })
            );
            const reserved = yield* registry.state(destination);
            expect(H.size(reserved)).toBe(1);
            yield* eventually(conflicts.state(record.publicId), (s) => s !== null);
            const foreign = yield* conflicts
              .send(
                record.publicId,
                V.ReviewConflict.make({
                  remoteEventId: "event-1",
                  workspaceId: 2,
                  destinationId: destination,
                  healOperationId: opId("heal"),
                  correction: null,
                })
              )
              .pipe(Effect.flip);
            expect(foreign.rule).toBe("conflict-not-found");
            yield* conflicts.send(
              record.publicId,
              V.ReviewConflict.make({
                remoteEventId: "event-1",
                workspaceId: 1,
                destinationId: destination,
                healOperationId: opId("heal"),
                correction: { operationId: opId("review"), input: input("review", "moveItem") },
              })
            );
            yield* eventually(conflicts.state(record.publicId), (s) => s?.reviewed === true);
            const actual10 = yield* ops.state(opId("review"));
            expect(actual10).toMatchObject({ status: "queued" });
          })
      );

      it.effect("terminal failures mark the item error and reconnect revives only failed operations", () =>
        Effect.gen(function* () {
          const items = yield* V.SyncItem;
          const ops = yield* V.SyncOperation;
          const destinations = yield* V.SyncDestination;
          const queue = yield* V.OperationQueue;
          yield* items.send(itemId("recovery"), V.ObserveItem.make({ observation: observe("recovery") }));
          yield* eventually(ops.state(opId("recovery")), (s) => s !== null);
          yield* ops.send(
            opId("recovery"),
            V.LeaseOperation.make({ holder: "worker", leaseMillis: 10000, parentRemoteId: remote, itemRemoteId: null })
          );
          yield* ops.send(
            opId("recovery"),
            V.FailOperation.make({
              holder: "worker",
              attempt: 1,
              retryable: false,
              maxAttempts: 3,
              backoffMillis: 10,
              reason: "auth",
            })
          );
          yield* eventually(items.state(itemId("recovery")), (s) => s?.status === "error");
          yield* eventually(
            queue.query(V.SyncDestination.ref(destination)),
            (s) => O.isSome(s) && O.exists(H.get(s.value, opId("recovery")), (r) => r?.status === "failed")
          );
          yield* destinations.send(destination, V.ResumeDestination.make({}));
          yield* eventually(ops.state(opId("recovery")), (s) => s?.status === "queued" && s.attempts === 0);
          yield* ops.send(
            opId("recovery"),
            V.LeaseOperation.make({ holder: "next", leaseMillis: 10000, parentRemoteId: remote, itemRemoteId: null })
          );
          yield* ops.send(opId("recovery"), V.ExpireLease.make({ attempt: 1 }));
          const recovered = yield* ops.state(opId("recovery"));
          expect(recovered).toMatchObject({ status: "leased", attempts: 1, leaseEpoch: 2 });
        })
      );
      it.effect("review without correction returns the item to pending and queues a fresh healing operation", () =>
        Effect.gen(function* () {
          const items = yield* V.SyncItem;
          const conflicts = yield* V.SyncConflict;
          const registry = yield* V.ConflictEventRegistry;
          const ops = yield* V.SyncOperation;
          yield* items.send(itemId("healed"), V.ObserveItem.make({ observation: observe("healed") }));
          yield* eventually(ops.state(opId("healed")), (s) => s !== null);
          yield* items.send(itemId("healed"), V.FlagItemDrift.make({}));
          const publicId = V.ConflictId.make("documents_sync_conflict_aheal");
          yield* registry.send(
            destination,
            V.RecordConflict.make({
              record: {
                publicId,
                destinationId: destination,
                workspaceId: 1,
                remoteEventId: "heal-event",
                itemId: itemId("healed"),
                evidence: "remote edit",
                reviewed: false,
              },
            })
          );
          yield* eventually(conflicts.state(publicId), (s) => s !== null);
          yield* conflicts.send(
            publicId,
            V.ReviewConflict.make({
              remoteEventId: "heal-event",
              destinationId: destination,
              workspaceId: 1,
              correction: null,
              healOperationId: opId("healfresh"),
            })
          );
          yield* eventually(ops.state(opId("healfresh")), (s) => s?.status === "queued");
          yield* eventually(conflicts.state(publicId), (s) => s?.reviewed === true);
          const healed = yield* items.state(itemId("healed"));
          expect(healed).toMatchObject({ status: "pending", observation: { operationId: opId("healfresh") } });
        })
      );
      it.effect("read contracts route org/destination state without exposing a transport", () =>
        Effect.gen(function* () {
          const list = yield* V.DestinationList;
          const queue = yield* V.OperationQueue;
          const status = yield* V.VaultSyncStatus;
          yield* eventually(list.query(V.OrgKey.make("1")), O.isSome);
          const rows = yield* eventually(queue.query(V.SyncDestination.ref(destination)), O.isSome);
          expect(O.isSome(rows) && H.size(rows.value)).toBeGreaterThan(0);
          yield* eventually(status.query(V.SyncDestination.ref(destination)), O.isSome);
        })
      );
    });
  });
};
