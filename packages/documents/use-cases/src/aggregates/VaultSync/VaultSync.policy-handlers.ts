/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import {
  ConflictRegistration,
  ConflictReviews,
  DestinationNames,
  DestinationRecovery,
  ItemHealing,
  ItemOperations,
  OperationDeadlines,
  OperationFailures,
} from "./VaultSync.policy.ts";

/**
 * Pure aggregate-dispatch handlers; no Box or filesystem adapter is called here.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { VaultSyncPolicies } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void VaultSyncPolicies;
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const VaultSyncPolicies = Layer.mergeAll(
  ConflictRegistration.toLayer(
    Effect.gen(function* () {
      const conflicts = yield* V.SyncConflict;
      return Effect.fn(function* ({ event, envelope }) {
        yield* conflicts.send(event.record.publicId, V.ConfirmConflict.make({ record: event.record }), {
          commandId: `${envelope.stream}:${envelope.seq}:record`,
        });
      }, Effect.orDie);
    })
  ),

  DestinationNames.toLayer(
    Effect.gen(function* () {
      const destinations = yield* V.SyncDestination;
      const claims = yield* V.DestinationNameReservation;
      return Effect.fn(function* ({ event, source, envelope }) {
        const c = event.claim;
        const options = { commandId: `${envelope.stream}:${envelope.seq}:destination` };
        const command =
          c.previousName === null
            ? V.RegisterDestination.make({ orgId: c.orgId, workspaceId: c.workspaceId, name: c.name })
            : V.RenameDestination.make({
                orgId: c.orgId,
                workspaceId: c.workspaceId,
                name: c.name,
                previousName: c.previousName,
              });
        const accepted = yield* destinations.send(c.destinationId, command, options).pipe(
          Effect.matchEffect({
            onSuccess: () => Effect.succeed(true),
            onFailure: Effect.fnUntraced(function* () {
              const current = yield* destinations.state(c.destinationId);
              const currentKey = current._tag === "Registered" ? V.reservationKey(current) : null;
              if (currentKey !== source.id)
                yield* claims.send(source.id, V.ReleaseDestinationName.make({ destinationId: c.destinationId }), {
                  commandId: `${envelope.stream}:${envelope.seq}:release-rejected`,
                });
              return false;
            }),
          })
        );
        if (!accepted || c.previousName === null) return;
        const old = V.reservationKey({ orgId: c.orgId, name: c.previousName });
        if (old !== source.id)
          yield* claims.send(old, V.ReleaseDestinationName.make({ destinationId: c.destinationId }), {
            commandId: `${envelope.stream}:${envelope.seq}:release`,
          });
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
          yield* items.send(event.record.itemId, V.ReturnItemToPending.make({ operationId: event.healOperationId }), {
            commandId: `${envelope.stream}:${envelope.seq}:heal`,
          });
        }
        yield* conflicts.send(
          source.id,
          V.ConfirmConflictReview.make({
            remoteEventId: event.record.remoteEventId,
            workspaceId: event.record.workspaceId,
            destinationId: event.record.destinationId,
          }),
          { commandId: `${envelope.stream}:${envelope.seq}:close` }
        );
      }, Effect.orDie);
    })
  ),
  ItemHealing.toLayer(
    Effect.gen(function* () {
      const operations = yield* V.SyncOperation;
      return Effect.fn(function* ({ event, source, envelope }) {
        for (const [, id] of event.previousSlots)
          if (id !== event.observation.operationId)
            yield* operations.send(id, V.SupersedeOperation.make({ reason: "review-heal" }), {
              commandId: `${envelope.stream}:${envelope.seq}:supersede:${id}`,
            });
        const o = event.observation;
        yield* operations.send(
          o.operationId,
          V.QueueOperation.make({
            input: {
              destinationId: o.destinationId,
              itemId: source.id,
              path: o.path,
              type: o.type,
              digest: o.digest,
              generation: o.generation,
              parentRequired: o.parentRequired,
              idempotencyKey: o.operationId,
            },
          }),
          { commandId: `${envelope.stream}:${envelope.seq}:heal` }
        );
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
        yield* items.send(
          state.input.itemId,
          V.MarkItemPushFailed.make({ terminal: true, generation: state.input.generation }),
          {
            commandId: `${envelope.stream}:${envelope.seq}:error`,
          }
        );
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
