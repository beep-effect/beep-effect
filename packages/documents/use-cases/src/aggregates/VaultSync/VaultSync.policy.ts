import * as Domain from "@alchemy.run/domain";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Str from "effect/String";
/**
 * DestinationNames vault sync orchestration.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { DestinationNames } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void DestinationNames;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class DestinationNames extends Domain.Policy("DestinationNames", {
  from: V.DestinationNameReservation,
  on: [V.DestinationNameClaimed],
}) {}
/**
 * ItemOperations vault sync orchestration.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { ItemOperations } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void ItemOperations;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class ItemOperations extends Domain.Policy("ItemOperations", {
  from: V.SyncItem,
  on: [V.ItemTracked, V.ItemEdited, V.ItemMoved, V.ItemKindReplaced],
}) {}
/**
 * ConflictReviews vault sync orchestration.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { ConflictReviews } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void ConflictReviews;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class ConflictReviews extends Domain.Policy("ConflictReviews", {
  from: V.SyncConflict,
  on: [V.ConflictReviewRequested],
}) {}
/**
 * ItemHealing vault sync orchestration.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { ItemHealing } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void ItemHealing;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class ItemHealing extends Domain.Policy("ItemHealing", { from: V.SyncItem, on: [V.ItemReturnedToPending] }) {}
/**
 * OperationDeadlines vault sync orchestration.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { OperationDeadlines } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void OperationDeadlines;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class OperationDeadlines extends Domain.Policy("OperationDeadlines", {
  from: V.SyncOperation,
  on: [V.OperationLeased, V.OperationRetryScheduled],
}) {}
/**
 * OperationFailures vault sync orchestration.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { OperationFailures } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void OperationFailures;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class OperationFailures extends Domain.Policy("OperationFailures", {
  from: V.SyncOperationSnapshot,
  on: [V.OperationFailed],
}) {}
/**
 * DestinationRecovery vault sync orchestration.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { DestinationRecovery } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void DestinationRecovery;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class DestinationRecovery extends Domain.Policy("DestinationRecovery", {
  from: V.SyncDestination,
  on: [V.DestinationConnected],
}) {}
/**
 * Pure aggregate-dispatch handlers; no Box or filesystem adapter is called here.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { VaultSyncPolicies } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void VaultSyncPolicies;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export const VaultSyncPolicies = Layer.mergeAll(
  DestinationNames.toLayer(
    Effect.gen(function* () {
      const destinations = yield* V.SyncDestination;
      const claims = yield* V.DestinationNameReservation;
      return Effect.fn(function* ({ event, envelope }) {
        const c = event.claim;
        const options = { commandId: `${envelope.stream}:${envelope.seq}:destination` };
        if (c.previousName === null)
          yield* destinations.send(
            c.destinationId,
            V.RegisterDestination.make({ orgId: c.orgId, workspaceId: c.workspaceId, name: c.name }),
            options
          );
        else {
          yield* destinations.send(
            c.destinationId,
            V.RenameDestination.make({ name: c.name, previousName: c.previousName }),
            options
          );
          const old = V.ReservationKey.make(`${c.orgId}:${Str.toLowerCase(Str.trim(c.previousName))}`);
          if (old !== V.ReservationKey.make(`${c.orgId}:${Str.toLowerCase(Str.trim(c.name))}`))
            yield* claims.send(old, V.ReleaseDestinationName.make({ destinationId: c.destinationId }), {
              commandId: `${envelope.stream}:${envelope.seq}:release`,
            });
        }
      }, Effect.orDie);
    })
  ),
  ItemOperations.toLayer(
    Effect.gen(function* () {
      const operations = yield* V.SyncOperation;
      return Effect.fn(function* ({ event, source, envelope }) {
        if (event._tag === "ItemKindReplaced")
          for (const [, id] of event.previousSlots) {
            yield* operations.send(id, V.SupersedeOperation.make({ reason: "kind-replaced" }), {
              commandId: `${envelope.stream}:${envelope.seq}:supersede:${id}`,
            });
          }
        const o = event.observation;
        yield* operations.send(
          o.operationId,
          V.QueueOperation.make({
            input: {
              destinationId: o.destinationId,
              itemId: source.id,
              type: o.type,
              path: o.path,
              digest: o.digest,
              generation: o.generation,
              parentRequired: o.parentRequired,
              idempotencyKey: o.operationId,
            },
          }),
          { commandId: `${envelope.stream}:${envelope.seq}:queue` }
        );
      }, Effect.orDie);
    })
  ),
  ConflictReviews.toLayer(
    Effect.gen(function* () {
      const operations = yield* V.SyncOperation;
      const conflicts = yield* V.SyncConflict;
      const items = yield* V.SyncItem;
      return Effect.fn(function* ({ event, source, envelope }) {
        if (event.correction !== null) {
          yield* operations.send(
            event.correction.operationId,
            V.QueueOperation.make({ input: event.correction.input }),
            { commandId: `${envelope.stream}:${envelope.seq}:correct` }
          );
        } else if (event.record.itemId !== null) {
          yield* items.send(event.record.itemId, V.ReturnItemToPending.make({}), {
            commandId: `${envelope.stream}:${envelope.seq}:heal`,
          });
        }
        yield* conflicts.send(
          source.id,
          V.ConfirmConflictReview.make({
            remoteEventId: event.record.remoteEventId,
            workspaceId: event.record.workspaceId,
          }),
          { commandId: `${envelope.stream}:${envelope.seq}:close` }
        );
      }, Effect.orDie);
    })
  ),
  ItemHealing.toLayer(
    Effect.gen(function* () {
      const items = yield* V.SyncItem;
      const operations = yield* V.SyncOperation;
      return Effect.fn(function* ({ source, envelope }) {
        const s = yield* items.state(source.id);
        if (s === null) return;
        yield* operations.send(s.observation.operationId, V.ReviveOperation.make({}), {
          commandId: `${envelope.stream}:${envelope.seq}:revive`,
        });
      }, Effect.orDie);
    })
  ),
  OperationDeadlines.toLayer(
    Effect.gen(function* () {
      const operations = yield* V.SyncOperation;
      return Effect.fn(function* ({ event, source, envelope }) {
        const expiry = event._tag === "OperationLeased";
        const at = DateTime.makeUnsafe(expiry ? event.expiresAt : event.retryAt);
        yield* operations
          .schedule(
            source.id,
            expiry ? V.ExpireLease.make({ attempt: event.attempt }) : V.RetryOperation.make({ attempt: event.attempt }),
            { at, commandId: `${envelope.stream}:${envelope.seq}:deadline` }
          )
          .pipe(Effect.catchTag("AlreadyExecuted", () => Effect.void));
      }, Effect.orDie);
    })
  ),
  OperationFailures.toLayer(
    Effect.gen(function* () {
      const items = yield* V.SyncItem;
      return Effect.fn(function* ({ state, envelope }) {
        if (state === null) return;
        yield* items.send(state.input.itemId, V.MarkItemPushFailed.make({ terminal: true }), {
          commandId: `${envelope.stream}:${envelope.seq}:error`,
        });
      }, Effect.orDie);
    })
  ),
  DestinationRecovery.toLayer(
    Effect.gen(function* () {
      const queue = yield* V.OperationQueue;
      const operations = yield* V.SyncOperation;
      return Effect.fn(function* ({ source, envelope }) {
        const rows = yield* queue.query(source);
        if (O.isNone(rows)) return;
        for (const [id, s] of rows.value)
          if (s?.status === "failed")
            yield* operations.send(id, V.ReviveOperation.make({}), {
              commandId: `${envelope.stream}:${envelope.seq}:revive:${id}`,
            });
      }, Effect.orDie);
    })
  )
);
