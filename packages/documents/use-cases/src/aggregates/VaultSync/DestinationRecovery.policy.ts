/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
/**
 * DestinationRecovery vault sync orchestration.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { DestinationRecovery } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void DestinationRecovery;
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export class DestinationRecovery extends Domain.Policy("DestinationRecovery", {
  from: V.SyncDestination,
  on: [V.DestinationConnected],
}) {}
