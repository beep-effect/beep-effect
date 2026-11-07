/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import { Session } from "./Session.middleware.ts";
import * as E from "./SyncDestination.events.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";
/**
 * PauseDestination vault sync contract.
 *
 * **Example** (Build a command for dispatch)
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync";
 * const command=V.PauseDestination.make({});
 * console.log(command._tag);
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class PauseDestination extends Domain.Command("PauseDestination", {
  middleware: [Session],
  target: V.DestinationId,
  input: {},
  events: [E.DestinationPaused],
  rejects: [SyncRuleViolation],
}) {}
