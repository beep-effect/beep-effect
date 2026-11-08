import * as Domain from "@alchemy.run/domain";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import {
  DestinationNames,
  DestinationRecovery,
  OperationDeadlines,
  OperationFailures,
  VaultSyncModel,
  VaultSyncPolicies,
} from "@beep/documents-use-cases/aggregates/VaultSync";
import { describe, expect, it, layer } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as H from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type * as Platform from "@alchemy.run/domain/Platform";

const destination = V.DestinationId.make("documents_sync_destination_avaultmain");
const itemId = (n: string) => V.ItemId.make(`documents_sync_item_a${n}`);
const opId = (n: string) => V.OperationId.make(`documents_sync_operation_a${Str.toLowerCase(n)}`);
const path = V.VaultRelPath.make("folder/file.txt");
const remote = V.RemoteItemId.make("box-1");
const input = (n: string, type: V.OperationType = "uploadFile"): V.OperationInput =>
  V.OperationInput.make({
    destinationId: destination,
    itemId: itemId(n),
    type,
    path,
    digest: "sha256:a",
    generation: 1,
    parentRequired: true,
    idempotencyKey: opId(n),
  });
const observe = (n: string): V.ItemObservation =>
  V.ItemObservation.make({
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
    layer(VaultSyncPolicies.pipe(Layer.provideMerge(hosted)), {
      excludeTestServices: true,
      concurrent: false,
      timeout: "20 seconds",
    })("vault sync", (it) => {
      it.effect("name reservation serializes competing claims and releases the old name after rename", () =>
        Effect.gen(function* () {
          const names = yield* V.DestinationNameReservation;
          const destinations = yield* V.SyncDestination;
          const key = V.reservationKey({ orgId: 1, name: "beep-vault" });
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
                  destinationId: V.DestinationId.make("documents_sync_destination_other1"),
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
            V.reservationKey({ orgId: 1, name: "renamed" }),
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
        "stale and cross-org renames release only the rejected claim; case-only renames keep their reservation",
        () =>
          Effect.gen(function* () {
            const names = yield* V.DestinationNameReservation;
            const destinations = yield* V.SyncDestination;
            const id = V.DestinationId.make("documents_sync_destination_avaultrace");
            const old = V.reservationKey({ orgId: 1, name: "raceold" });
            yield* names.send(
              old,
              V.ClaimDestinationName.make({
                claim: { destinationId: id, orgId: 1, workspaceId: 1, name: "raceold", previousName: null },
              })
            );
            yield* eventually(destinations.state(id), (s) => s._tag === "Registered");
            const rejected = V.reservationKey({ orgId: 1, name: "racenew" });
            yield* names.send(
              rejected,
              V.ClaimDestinationName.make({
                claim: { destinationId: id, orgId: 1, workspaceId: 1, name: "racenew", previousName: "stale" },
              })
            );
            yield* eventually(names.state(rejected), (s) => s === null);
            yield* names.send(
              old,
              V.ClaimDestinationName.make({
                claim: { destinationId: id, orgId: 1, workspaceId: 1, name: "RACEOLD", previousName: "raceold" },
              })
            );
            yield* eventually(destinations.state(id), (s) => s._tag === "Registered" && s.name === "RACEOLD");
            const otherOrg = V.reservationKey({ orgId: 2, name: "foreign" });
            yield* names.send(
              otherOrg,
              V.ClaimDestinationName.make({
                claim: { destinationId: id, orgId: 2, workspaceId: 1, name: "foreign", previousName: "RACEOLD" },
              })
            );
            yield* eventually(names.state(otherOrg), (s) => s === null);
            const state = yield* destinations.state(id);
            const reservation = yield* names.state(old);
            expect(state).toMatchObject({ name: "RACEOLD", orgId: 1 });
            expect(reservation).not.toBe(null);
          })
      );
      it.effect(
        "cursor failures retain the durable position, pause/resume is explicit, and paths have one owner (I6,I7,I21)",
        () =>
          Effect.gen(function* () {
            const destinations = yield* V.SyncDestination;
            yield* destinations.send(destination, V.RecordDestinationPoll.make({ position: "p1", error: null }));
            yield* destinations.send(
              destination,
              V.RecordDestinationPoll.make({ position: "p2", error: "pollEvents" })
            );
            yield* destinations.send(destination, V.PauseDestination.make({}));
            const actual2 = yield* destinations.state(destination);
            expect(actual2).toMatchObject({
              cursor: "p1",
              cursorError: "pollEvents",
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
            V.LeaseOperation.make({ holder: "first", leaseMillis: 750, parentRemoteId: remote, itemRemoteId: null })
          );
          const busy = yield* ops
            .send(
              id,
              V.LeaseOperation.make({ holder: "other", leaseMillis: 750, parentRemoteId: remote, itemRemoteId: null })
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
            const expected = { retry: "retrying", terminal: "failed", budget: "failed" } as const;
            for (const n of ["retry", "terminal", "budget"] as const) {
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
                  backoffMillis: 750,
                  reason: "uploadFile",
                })
              );
              // Read each state right after its own failure, well before the 750 ms retry deadline fires.
              const failed = yield* ops.state(opId(n));
              expect(failed).toMatchObject({ status: expected[n] });
            }
            yield* eventually(ops.state(opId("retry")), (s) => s?.status === "queued");
            yield* ops.send(opId("terminal"), V.ReviveOperation.make({}));
            yield* ops.send(opId("terminal"), V.SupersedeOperation.make({ reason: "kind-replaced" }));
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
            const record = V.ConflictRecord.make({
              publicId: V.ConflictId.make("documents_sync_conflict_a1"),
              destinationId: destination,
              workspaceId: 1,
              remoteEventId: "event-1",
              itemId: itemId("review"),
              evidence: "remote moved",
              reviewed: false,
            });
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

      it.effect("a reviewed remote rename of a tracked item takes the corrective slot (I14)", () =>
        Effect.gen(function* () {
          const items = yield* V.SyncItem;
          const ops = yield* V.SyncOperation;
          const conflicts = yield* V.SyncConflict;
          const registry = yield* V.ConflictEventRegistry;
          const renamed = itemId("renamed");
          yield* items.send(
            renamed,
            V.ObserveItem.make({ observation: { ...observe("renamed"), parentRequired: false } })
          );
          yield* eventually(ops.state(opId("renamed")), (s) => s !== null);
          yield* items.send(
            renamed,
            V.MarkItemPushed.make({
              remoteId: V.RemoteItemId.make("remote-renamed"),
              generation: 1,
              operationId: opId("renamed"),
            })
          );
          const record = V.ConflictRecord.make({
            publicId: V.ConflictId.make("documents_sync_conflict_arenamed"),
            destinationId: destination,
            workspaceId: 1,
            remoteEventId: "event-renamed",
            itemId: renamed,
            evidence: "remote rename",
            kind: "remoteRename",
            reviewed: false,
          });
          yield* registry.send(destination, V.RecordConflict.make({ record }));
          yield* eventually(conflicts.state(record.publicId), (s) => s !== null);
          const item = yield* eventually(items.state(renamed), (s) => s?.remoteId !== null);
          const correction = yield* Effect.fromOption(V.reviewCorrection({ record, item }));
          expect(correction.input.type).toBe("renameItem");
          yield* conflicts.send(
            record.publicId,
            V.ReviewConflict.make({
              remoteEventId: record.remoteEventId,
              workspaceId: 1,
              destinationId: destination,
              healOperationId: opId("renamedheal"),
              correction,
            })
          );
          yield* eventually(conflicts.state(record.publicId), (s) => s?.reviewed === true);
          const slotted = yield* eventually(items.state(renamed), (s) => H.has(s?.slots ?? H.empty(), "renameItem"));
          expect(slotted === null ? null : O.getOrNull(H.get(slotted.slots, "renameItem"))).toBe(
            correction.operationId
          );
          const queued = yield* ops.state(correction.operationId);
          expect(queued).toMatchObject({ status: "queued", input: { type: "renameItem", generation: 2 } });
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
              reason: "uploadFile",
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

      it.effect("rejected first registration and rename-before-registration release their new claims", () =>
        Effect.gen(function* () {
          const names = yield* V.DestinationNameReservation;
          const destinations = yield* V.SyncDestination;
          const existing = V.DestinationId.make("documents_sync_destination_avaultrace");
          const duplicate = V.reservationKey({ orgId: 1, name: "duplicate" });
          yield* names.send(
            duplicate,
            V.ClaimDestinationName.make({
              claim: { destinationId: existing, orgId: 1, workspaceId: 1, name: "duplicate", previousName: null },
            })
          );
          yield* eventually(names.state(duplicate), (s) => s === null);
          const absent = V.DestinationId.make("documents_sync_destination_avaultabsent");
          const missing = V.reservationKey({ orgId: 1, name: "missing" });
          yield* names.send(
            missing,
            V.ClaimDestinationName.make({
              claim: {
                destinationId: absent,
                orgId: 1,
                workspaceId: 1,
                name: "missing",
                previousName: "never-registered",
              },
            })
          );
          yield* eventually(names.state(missing), (s) => s === null);
          const unchanged = yield* destinations.state(absent);
          expect(unchanged).toEqual({ _tag: "Unregistered" });
          const old = V.reservationKey({ orgId: 1, name: "raceold" });
          const claim = V.NameClaim.make({
            destinationId: existing,
            orgId: 1,
            workspaceId: 2,
            name: "RaceOld",
            previousName: "RACEOLD",
          });
          const receipt = yield* names.send(old, V.ClaimDestinationName.make({ claim }));
          const handler = yield* DestinationNames;
          const ref = V.DestinationNameReservation.ref(old);
          // At-least-once replay must finish the rejected rename and retain the current name's claim.
          yield* handler({
            key: ref,
            source: ref,
            route: undefined,
            event: V.DestinationNameClaimed.make({ claim }),
            state: undefined,
            envelope: {
              id: old,
              stream: receipt.stream,
              seq: receipt.version,
              at: DateTime.makeUnsafe(1000),
              commandId: "claim-replay",
              correlationId: "claim-replay",
            },
          });
          const retained = yield* names.state(old);
          expect(retained).not.toBe(null);
        })
      );
      it.effect("connection recovery with an empty operation queue is an idempotent no-op", () =>
        Effect.gen(function* () {
          const destinations = yield* V.SyncDestination;
          const queue = yield* V.OperationQueue;
          const id = V.DestinationId.make("documents_sync_destination_aemptyrecovery");
          const ref = V.SyncDestination.ref(id);
          yield* destinations.send(id, V.RegisterDestination.make({ orgId: 1, workspaceId: 1, name: "empty" }));
          const receipt = yield* destinations.send(id, V.ResumeDestination.make({}));
          const handler = yield* DestinationRecovery;
          const trigger = {
            key: ref,
            source: ref,
            route: undefined,
            event: V.DestinationConnected.make({}),
            state: undefined,
            envelope: {
              id,
              stream: receipt.stream,
              seq: receipt.version,
              at: DateTime.makeUnsafe(1000),
              commandId: "empty-replay",
              correlationId: "empty-replay",
            },
          };
          yield* handler(trigger);
          yield* handler(trigger);
          const rows = yield* queue.query(ref);
          assertNone(rows);
        })
      );
      it.effect("reviewing an untracked remote item closes the conflict without a local item command", () =>
        Effect.gen(function* () {
          const registry = yield* V.ConflictEventRegistry;
          const conflicts = yield* V.SyncConflict;
          const id = V.ConflictId.make("documents_sync_conflict_aorphan");
          yield* registry.send(
            destination,
            V.RecordConflict.make({
              record: {
                publicId: id,
                destinationId: destination,
                workspaceId: 1,
                remoteEventId: "orphan",
                itemId: null,
                evidence: "untracked remote item",
                reviewed: false,
              },
            })
          );
          yield* eventually(conflicts.state(id), (s) => s !== null);
          yield* conflicts.send(
            id,
            V.ReviewConflict.make({
              remoteEventId: "orphan",
              destinationId: destination,
              workspaceId: 1,
              correction: null,
              healOperationId: opId("unused"),
            })
          );
          yield* eventually(conflicts.state(id), (s) => s?.reviewed === true);
        })
      );
      it.effect("healing an already queued operation retargets it without superseding its stable id", () =>
        Effect.gen(function* () {
          const items = yield* V.SyncItem;
          const ops = yield* V.SyncOperation;
          const id = itemId("queuedheal");
          const operation = opId("queuedheal");
          yield* items.send(id, V.ObserveItem.make({ observation: observe("queuedheal") }));
          yield* eventually(ops.state(operation), (s) => s?.status === "queued");
          yield* items.send(id, V.ReturnItemToPending.make({ operationId: operation }));
          yield* eventually(ops.state(operation), (s) => s?.input.generation === 2);
          const state = yield* ops.state(operation);
          expect(state).toMatchObject({ status: "queued", attempts: 0 });
        })
      );
      it.effect(
        "redelivering an executed stale deadline after success is idempotent and absent failure snapshots do nothing",
        () =>
          Effect.gen(function* () {
            const ops = yield* V.SyncOperation;
            const deadline = yield* OperationDeadlines;
            const failures = yield* OperationFailures;
            const id = opId("deadlinereplay");
            const ref = V.SyncOperation.ref(id);
            yield* ops.send(id, V.QueueOperation.make({ input: { ...input("deadlinereplay"), idempotencyKey: id } }));
            const receipt = yield* ops.send(
              id,
              V.LeaseOperation.make({
                holder: "worker",
                leaseMillis: 60000,
                parentRemoteId: remote,
                itemRemoteId: null,
              })
            );
            const event = yield* Effect.fromOption(A.findFirst(receipt.events, S.is(V.OperationLeased)));
            const envelope = {
              id,
              stream: receipt.stream,
              seq: receipt.version,
              at: DateTime.makeUnsafe(event.expiresAt - 60000),
              commandId: "lease-replay",
              correlationId: "lease-replay",
            };
            yield* ops.send(id, V.CompleteOperation.make({ holder: "worker", attempt: event.attempt }));
            // A late timer is already irrelevant after success. Execute its real command id,
            // then redeliver the original lease event through the policy.
            const expired = yield* ops.send(id, V.ExpireLease.make({ attempt: event.attempt }), {
              commandId: `${receipt.stream}:${receipt.version}:deadline`,
            });
            expect(expired.events).toEqual([]);
            yield* deadline({ key: ref, source: ref, route: undefined, event, state: undefined, envelope });
            const state = yield* ops.state(id);
            expect(state).toMatchObject({ status: "succeeded", attempts: 1 });
            yield* failures({
              key: ref,
              source: ref,
              route: undefined,
              event: V.OperationFailed.make({ reason: "uploadFile" }),
              state: null,
              envelope,
            });
            const retained = yield* ops.state(id);
            expect(retained).toEqual(state);
          })
      );
      it.effect("a foreign operation id records a terminal item failure and later deliveries keep flowing", () =>
        Effect.gen(function* () {
          const items = yield* V.SyncItem;
          const ops = yield* V.SyncOperation;
          const owner = itemId("owner");
          const intruder = itemId("intruder");
          const held = opId("owner");
          yield* items.send(owner, V.ObserveItem.make({ observation: observe("owner") }));
          yield* eventually(ops.state(held), (s) => s !== null);
          // A replayed observation names an operation another item owns: QueueOperation refuses it permanently.
          yield* items.send(
            intruder,
            V.ObserveItem.make({ observation: { ...observe("intruder"), operationId: held } })
          );
          yield* eventually(items.state(intruder), (s) => s?.status === "error");
          yield* items.send(
            intruder,
            V.ObserveItem.make({
              observation: { ...observe("intruder"), operationId: held, generation: 2, digest: "sha256:b" },
            })
          );
          yield* eventually(items.state(intruder), (s) => s?.observation.generation === 2 && s.status === "error");
          const failed = yield* items.state(intruder);
          expect(failed?.slots.pipe(H.get("uploadFile"))).toEqual(O.some(held));
          // Healing the intruder queues a fresh operation and leaves the owner's operation alone.
          yield* items.send(intruder, V.ReturnItemToPending.make({ operationId: opId("intruderheal") }));
          yield* eventually(ops.state(opId("intruderheal")), (s) => s?.status === "queued");
          const owned = yield* ops.state(held);
          expect(owned).toMatchObject({ status: "queued", input: { itemId: owner, generation: 1 } });
        })
      );
      it.effect("a correction refused by its operation keeps the conflict open for another review", () =>
        Effect.gen(function* () {
          const registry = yield* V.ConflictEventRegistry;
          const conflicts = yield* V.SyncConflict;
          const ops = yield* V.SyncOperation;
          const id = V.ConflictId.make("documents_sync_conflict_arefused");
          const held = opId("refusedheld");
          yield* ops.send(held, V.QueueOperation.make({ input: input("refusedheld") }));
          yield* registry.send(
            destination,
            V.RecordConflict.make({
              record: {
                publicId: id,
                destinationId: destination,
                workspaceId: 1,
                remoteEventId: "refused-event",
                itemId: itemId("refusedreview"),
                evidence: "remote moved",
                reviewed: false,
              },
            })
          );
          yield* eventually(conflicts.state(id), (s) => s !== null);
          const review = (operationId: V.OperationId) =>
            conflicts.send(
              id,
              V.ReviewConflict.make({
                remoteEventId: "refused-event",
                destinationId: destination,
                workspaceId: 1,
                healOperationId: opId("refusedunused"),
                correction: {
                  operationId,
                  input: { ...input("refusedreview", "moveItem"), idempotencyKey: operationId },
                },
              })
            );
          yield* review(held);
          // The second review only applies if the refused first one left the conflict open.
          yield* review(opId("refusedfresh"));
          yield* eventually(conflicts.state(id), (s) => s?.reviewed === true);
          const fresh = yield* ops.state(opId("refusedfresh"));
          expect(fresh).toMatchObject({ status: "queued", input: { itemId: itemId("refusedreview") } });
          const untouched = yield* ops.state(held);
          expect(untouched).toMatchObject({ status: "queued", input: { itemId: itemId("refusedheld") } });
        })
      );
      it.effect("healing an item the slice never tracked closes the review without a stalled delivery", () =>
        Effect.gen(function* () {
          const registry = yield* V.ConflictEventRegistry;
          const conflicts = yield* V.SyncConflict;
          const items = yield* V.SyncItem;
          const id = V.ConflictId.make("documents_sync_conflict_auntrackedheal");
          yield* registry.send(
            destination,
            V.RecordConflict.make({
              record: {
                publicId: id,
                destinationId: destination,
                workspaceId: 1,
                remoteEventId: "untracked-heal",
                itemId: itemId("untrackedheal"),
                evidence: "remote edit",
                reviewed: false,
              },
            })
          );
          yield* eventually(conflicts.state(id), (s) => s !== null);
          yield* conflicts.send(
            id,
            V.ReviewConflict.make({
              remoteEventId: "untracked-heal",
              destinationId: destination,
              workspaceId: 1,
              correction: null,
              healOperationId: opId("untrackedheal"),
            })
          );
          yield* eventually(conflicts.state(id), (s) => s?.reviewed === true);
          const untracked = yield* items.state(itemId("untrackedheal"));
          expect(untracked).toBe(null);
        })
      );
      it.effect("a failed operation for an untracked item completes its failure delivery", () =>
        Effect.gen(function* () {
          const ops = yield* V.SyncOperation;
          const items = yield* V.SyncItem;
          const failures = yield* OperationFailures;
          const id = opId("untrackedfail");
          const ref = V.SyncOperation.ref(id);
          const receipt = yield* ops.send(id, V.QueueOperation.make({ input: input("untrackedfail") }));
          const state = yield* ops.state(id);
          yield* failures({
            key: ref,
            source: ref,
            route: undefined,
            event: V.OperationFailed.make({ reason: "uploadFile" }),
            state,
            envelope: {
              id,
              stream: receipt.stream,
              seq: receipt.version,
              at: DateTime.makeUnsafe(1000),
              commandId: "failure-replay",
              correlationId: "failure-replay",
            },
          });
          const untracked = yield* items.state(itemId("untrackedfail"));
          expect(untracked).toBe(null);
        })
      );
      it.effect("read contracts route org/destination state without exposing a transport", () =>
        Effect.gen(function* () {
          const list = yield* V.DestinationList;
          const queue = yield* V.OperationQueue;
          const status = yield* V.VaultSyncStatus;
          yield* eventually(list.query(V.WorkspaceKey.make("1:1")), O.isSome);
          const rows = yield* eventually(queue.query(V.SyncDestination.ref(destination)), O.isSome);
          expect(O.isSome(rows) && H.size(rows.value)).toBeGreaterThan(0);
          yield* eventually(status.query(V.SyncDestination.ref(destination)), O.isSome);
        })
      );
    });
  });
};
