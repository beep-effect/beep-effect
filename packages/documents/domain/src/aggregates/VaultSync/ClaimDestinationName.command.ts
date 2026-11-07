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
 * ClaimDestinationName vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ClaimDestinationName } from "@beep/documents-domain/aggregates/VaultSync";
 * void ClaimDestinationName;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ClaimDestinationName extends Domain.Command("ClaimDestinationName", {
  target: V.ReservationKey,
  input: { claim: E.NameClaim },
  events: [E.DestinationNameClaimed],
  rejects: [SyncRuleViolation],
}) {}
