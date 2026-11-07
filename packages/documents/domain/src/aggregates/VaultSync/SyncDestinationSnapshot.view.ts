/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import { SyncDestination } from "./SyncDestination.aggregate.ts";
import { DestinationState } from "./SyncDestination.command.ts";
/**
 * SyncDestinationSnapshot pure read contract; transport authorization is supplied by the hosting Api.
 *
 * **Example** (Inspect read contract)
 * ```ts
 * import { SyncDestinationSnapshot } from "@beep/documents-domain/aggregates/VaultSync";
 * void SyncDestinationSnapshot.definition;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class SyncDestinationSnapshot extends Domain.View("SyncDestinationSnapshot", {
  from: [SyncDestination],
  key: SyncDestination,
  state: DestinationState,
  initial: SyncDestination.definition.initial,
  evolve: {
    CursorGenesisImported: (s, e, c) =>
      SyncDestination.definition.evolve.CursorGenesisImported(s, e, { ...c.envelope, id: c.source.id }),
    DestinationGenesisImported: (_s, e) => e.record,
    DestinationRegistered: (s, e, c) =>
      SyncDestination.definition.evolve.DestinationRegistered(s, e, { ...c.envelope, id: c.source.id }),
    DestinationRenamed: (s, e, c) =>
      SyncDestination.definition.evolve.DestinationRenamed(s, e, { ...c.envelope, id: c.source.id }),
    RootFolderResolved: (s, e, c) =>
      SyncDestination.definition.evolve.RootFolderResolved(s, e, { ...c.envelope, id: c.source.id }),
    DestinationPaused: (s, e, c) =>
      SyncDestination.definition.evolve.DestinationPaused(s, e, { ...c.envelope, id: c.source.id }),
    DestinationConnected: (s, e, c) =>
      SyncDestination.definition.evolve.DestinationConnected(s, e, { ...c.envelope, id: c.source.id }),
    CursorAdvanced: (s, e, c) =>
      SyncDestination.definition.evolve.CursorAdvanced(s, e, { ...c.envelope, id: c.source.id }),
    CursorFailed: (s, e, c) => SyncDestination.definition.evolve.CursorFailed(s, e, { ...c.envelope, id: c.source.id }),
    ItemPathClaimed: (s, e, c) =>
      SyncDestination.definition.evolve.ItemPathClaimed(s, e, { ...c.envelope, id: c.source.id }),
    ItemPathReleased: (s, e, c) =>
      SyncDestination.definition.evolve.ItemPathReleased(s, e, { ...c.envelope, id: c.source.id }),
  },
}) {}
