/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import { SyncOperation } from "./SyncOperation.aggregate.ts";
import { OperationState } from "./SyncOperation.command.ts";
/**
 * SyncOperationSnapshot pure read contract; transport authorization is supplied by the hosting Api.
 *
 * **Example** (Inspect read contract)
 * ```ts
 * import { SyncOperationSnapshot } from "@beep/documents-domain/aggregates/VaultSync";
 * void SyncOperationSnapshot.definition;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class SyncOperationSnapshot extends Domain.View("SyncOperationSnapshot", {
  from: [SyncOperation],
  key: SyncOperation,
  state: OperationState,
  initial: SyncOperation.definition.initial,
  evolve: {
    OperationGenesisImported: (_s, e) => e.record,
    OperationQueued: (s, e, c) =>
      SyncOperation.definition.evolve.OperationQueued(s, e, { ...c.envelope, id: c.source.id }),
    OperationRetargeted: (s, e, c) =>
      SyncOperation.definition.evolve.OperationRetargeted(s, e, { ...c.envelope, id: c.source.id }),
    OperationSquashed: (s, e, c) =>
      SyncOperation.definition.evolve.OperationSquashed(s, e, { ...c.envelope, id: c.source.id }),
    OperationLeased: (s, e, c) =>
      SyncOperation.definition.evolve.OperationLeased(s, e, { ...c.envelope, id: c.source.id }),
    OperationLeaseExpired: (s, e, c) =>
      SyncOperation.definition.evolve.OperationLeaseExpired(s, e, { ...c.envelope, id: c.source.id }),
    OperationSucceeded: (s, e, c) =>
      SyncOperation.definition.evolve.OperationSucceeded(s, e, { ...c.envelope, id: c.source.id }),
    OperationRetryScheduled: (s, e, c) =>
      SyncOperation.definition.evolve.OperationRetryScheduled(s, e, { ...c.envelope, id: c.source.id }),
    OperationFailed: (s, e, c) =>
      SyncOperation.definition.evolve.OperationFailed(s, e, { ...c.envelope, id: c.source.id }),
    OperationSuperseded: (s, e, c) =>
      SyncOperation.definition.evolve.OperationSuperseded(s, e, { ...c.envelope, id: c.source.id }),
    OperationRevived: (s, e, c) =>
      SyncOperation.definition.evolve.OperationRevived(s, e, { ...c.envelope, id: c.source.id }),
    OperationRequeued: (s, e, c) =>
      SyncOperation.definition.evolve.OperationRequeued(s, e, { ...c.envelope, id: c.source.id }),
  },
}) {}
