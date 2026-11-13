/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as H from "effect/HashMap";
import * as S from "effect/Schema";
import { ScopeDenied } from "./Session.context.ts";
import { Session } from "./Session.middleware.ts";
import { SyncDestination } from "./SyncDestination.aggregate.ts";
import { DestinationState } from "./SyncDestination.command.ts";
import { SyncDestinationSnapshot } from "./SyncDestinationSnapshot.view.ts";
import { ItemState } from "./SyncItem.command.ts";
import { SyncItemSnapshot } from "./SyncItemSnapshot.view.ts";
import { OperationState } from "./SyncOperation.command.ts";
import { SyncOperationSnapshot } from "./SyncOperationSnapshot.view.ts";
import * as V from "./Values.ts";
/**
 * VaultSyncStatus pure read contract; transport authorization is supplied by the hosting Api.
 *
 * **Example** (Inspect read contract)
 * ```ts
 * import { VaultSyncStatus } from "@beep/documents-domain/aggregates/VaultSync";
 * void VaultSyncStatus.definition;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class VaultSyncStatus extends Domain.View("VaultSyncStatus", {
  middleware: [Session],
  rejects: [ScopeDenied],
  from: [SyncDestinationSnapshot, SyncItemSnapshot, SyncOperationSnapshot],
  key: SyncDestination,
  state: S.Struct({
    destination: DestinationState,
    items: S.HashMap(V.ItemId, ItemState),
    operations: S.HashMap(V.OperationId, OperationState),
  }),
  initial: { destination: { _tag: "Unregistered" }, items: H.empty(), operations: H.empty() },
  keyOf: {
    SyncDestinationSnapshot: ({ source }) => SyncDestination.ref(source.id),
    SyncItemSnapshot: ({ state }) =>
      state === null ? undefined : SyncDestination.ref(state.observation.destinationId),
    SyncOperationSnapshot: ({ state }) => (state === null ? undefined : SyncDestination.ref(state.input.destinationId)),
  },
  evolve: {
    SyncDestinationSnapshot: (s, _e, { state }) => (state === null ? s : { ...s, destination: state }),
    SyncItemSnapshot: (s, _e, { source, state }) => ({ ...s, items: H.set(s.items, source.id, state) }),
    SyncOperationSnapshot: (s, _e, { source, state }) => ({ ...s, operations: H.set(s.operations, source.id, state) }),
  },
}) {}
