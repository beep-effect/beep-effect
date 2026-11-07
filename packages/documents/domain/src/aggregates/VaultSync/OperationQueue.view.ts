/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as H from "effect/HashMap";
import * as S from "effect/Schema";
import { SyncDestination } from "./SyncDestination.aggregate.ts";
import { OperationState } from "./SyncOperation.command.ts";
import { SyncOperationSnapshot } from "./SyncOperationSnapshot.view.ts";
import * as V from "./Values.ts";
/**
 * OperationQueue pure read contract; transport authorization is supplied by the hosting Api.
 *
 * **Example** (Inspect read contract)
 * ```ts
 * import { OperationQueue } from "@beep/documents-domain/aggregates/VaultSync";
 * void OperationQueue.definition;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class OperationQueue extends Domain.View("OperationQueue", {
  from: [SyncOperationSnapshot],
  key: SyncDestination,
  state: S.HashMap(V.OperationId, OperationState),
  initial: H.empty(),
  keyOf: {
    SyncOperationSnapshot: ({ state }) => (state === null ? undefined : SyncDestination.ref(state.input.destinationId)),
  },
  evolve: { SyncOperationSnapshot: (s, _e, { source, state }) => H.set(s, source.id, state) },
}) {}
