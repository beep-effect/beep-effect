/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as E from "./DestinationNameReservation.events.ts";
import { Session } from "./Session.middleware.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";
/**
 * ClaimDestinationName vault sync contract.
 *
 * **Example** (Build a command for dispatch)
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync";
 * const command=V.ClaimDestinationName.make({claim:{destinationId:V.DestinationId.make("vault"),orgId:1,workspaceId:1,name:"vault",previousName:null}});
 * console.log(command._tag);
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ClaimDestinationName extends Domain.Command("ClaimDestinationName", {
  middleware: [Session],
  target: V.ReservationKey,
  input: { claim: E.NameClaim },
  events: [E.DestinationNameClaimed],
  rejects: [SyncRuleViolation],
}) {}
