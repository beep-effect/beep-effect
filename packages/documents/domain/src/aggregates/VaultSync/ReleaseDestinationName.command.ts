/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as E from "./DestinationNameReservation.events.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";
/**
 * ReleaseDestinationName vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ReleaseDestinationName } from "@beep/documents-domain/aggregates/VaultSync";
 * void ReleaseDestinationName;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ReleaseDestinationName extends Domain.Command("ReleaseDestinationName", {
  target: V.ReservationKey,
  input: { destinationId: V.DestinationId },
  events: [E.DestinationNameReleased],
  rejects: [SyncRuleViolation],
}) {}
