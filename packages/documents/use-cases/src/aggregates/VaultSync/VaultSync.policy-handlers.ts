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

// Every `send` fails only with the command's declared `SyncRuleViolation`. A permanent refusal re-raised as a
// defect would redeliver the committed event forever, so each handler either records the refusal or keeps
// `Effect.orDie` only where the refusal is impossible by construction, with the reason beside it.

// An item's operation slots. The caller mints operation ids, so a replayed or corrupted observation can
// name an id another item already holds, or one whose operation has left `queued`; `QueueOperation` then
// refuses with `not-retargetable` on every redelivery (`operation-key` cannot occur: the key is the
// target). That refusal becomes a terminal item failure: the item shows `error` while its slot keeps the
// operation id visible. Such a slot can name another item's operation, so supersession skips operations
// the item does not own; an operation never changes owner, so the read cannot go stale.
const itemOperationSlots = Effect.gen(function* () {
  const operations = yield* V.SyncOperation;
  const items = yield* V.SyncItem;
  const supersede = Effect.fnUntraced(function* (
    itemId: V.ItemId,
    id: V.OperationId,
    reason: V.SupersedeReason,
    commandId: string
  ) {
    const current = yield* operations.state(id);
    if (O.exists(O.fromNullOr(current), (record) => record.input.itemId === itemId))
      yield* operations.send(id, V.SupersedeOperation.make({ reason }), { commandId });
  });
  const queue = Effect.fnUntraced(function* (itemId: V.ItemId, o: V.ItemObservation, commandId: string) {
    yield* operations
      .send(
        o.operationId,
        V.QueueOperation.make({
          input: {
            destinationId: o.destinationId,
            itemId,
            type: o.type,
            path: o.path,
            digest: o.digest,
            generation: o.generation,
            parentRequired: o.parentRequired,
            idempotencyKey: o.operationId,
          },
        }),
        { commandId }
      )
      .pipe(
        Effect.catchTag("SyncRuleViolation", () =>
          items.send(itemId, V.MarkItemPushFailed.make({ terminal: true, generation: o.generation }), {
            commandId: `${commandId}:refused`,
          })
        )
      );
  });
  return { supersede, queue } as const;
});

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
        // `conflict-id` is impossible: the target is the record's own public id.
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
        // `ReleaseDestinationName` never refuses: a claim held by another destination is left untouched.
      }, Effect.orDie);
    })
  ),
  ItemOperations.toLayer(
    Effect.gen(function* () {
      const slots = yield* itemOperationSlots;
      return Effect.fn(function* ({ event, source, envelope }) {
        if (event._tag === "ItemKindReplaced")
          for (const [, id] of event.previousSlots)
            yield* slots.supersede(
              source.id,
              id,
              "kind-replaced",
              `${envelope.stream}:${envelope.seq}:supersede:${id}`
            );
        yield* slots.queue(source.id, event.observation, `${envelope.stream}:${envelope.seq}:queue`);
        // `SupersedeOperation` never refuses, and `MarkItemPushFailed` cannot meet `not-tracked`: the item
        // that emitted this event is tracked.
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
          const queued = yield* operations
            .send(event.correction.operationId, V.QueueOperation.make({ input: event.correction.input }), {
              commandId: `${envelope.stream}:${envelope.seq}:correct`,
            })
            .pipe(
              Effect.as(true),
              Effect.catchTag("SyncRuleViolation", (violation) =>
                Effect.logWarning("vault sync correction refused; the conflict stays open for another review").pipe(
                  Effect.annotateLogs({ conflictId: source.id, rule: violation.rule }),
                  Effect.as(false)
                )
              )
            );
          // A correction whose operation id is held elsewhere leaves the conflict open, and the recorded
          // review request, in `OpenConflicts` for another review instead of closing it unapplied.
          if (!queued) return;
        } else if (event.record.itemId !== null) {
          // An item this slice never tracked has nothing to heal; the review closes, as for an untracked remote item.
          yield* items
            .send(event.record.itemId, V.ReturnItemToPending.make({ operationId: event.healOperationId }), {
              commandId: `${envelope.stream}:${envelope.seq}:heal`,
            })
            .pipe(Effect.catchTag("SyncRuleViolation", () => Effect.void));
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
        // `conflict-not-found` is impossible: the scope comes from the conflict that emitted this event.
      }, Effect.orDie);
    })
  ),
  ItemHealing.toLayer(
    Effect.gen(function* () {
      const slots = yield* itemOperationSlots;
      return Effect.fn(function* ({ event, source, envelope }) {
        for (const [, id] of event.previousSlots)
          if (id !== event.observation.operationId)
            yield* slots.supersede(source.id, id, "review-heal", `${envelope.stream}:${envelope.seq}:supersede:${id}`);
        yield* slots.queue(source.id, event.observation, `${envelope.stream}:${envelope.seq}:heal`);
        // As in `ItemOperations`: supersession never refuses and the emitting item is tracked.
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
      });
    })
  ),
  OperationFailures.toLayer(
    Effect.gen(function* () {
      const items = yield* V.SyncItem;
      return Effect.fn(function* ({ state, envelope }) {
        if (state === null) return;
        // A review correction may queue for an item this slice never tracked; `not-tracked` leaves the
        // failed operation as the only record.
        yield* items
          .send(state.input.itemId, V.MarkItemPushFailed.make({ terminal: true, generation: state.input.generation }), {
            commandId: `${envelope.stream}:${envelope.seq}:error`,
          })
          .pipe(Effect.catchTag("SyncRuleViolation", () => Effect.void));
      });
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
        // `ReviveOperation` never refuses: an operation that is not failed records nothing.
      }, Effect.orDie);
    })
  )
);
