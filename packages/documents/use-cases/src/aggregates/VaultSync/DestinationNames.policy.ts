/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
/**
 * DestinationNames vault sync orchestration.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { DestinationNames } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void DestinationNames;
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export class DestinationNames extends Domain.Policy("DestinationNames", {
  from: V.DestinationNameReservation,
  on: [V.DestinationNameClaimed],
}) {}
