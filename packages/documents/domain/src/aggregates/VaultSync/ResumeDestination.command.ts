/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as E from "./SyncDestination.events.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";
/**
 * ResumeDestination vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ResumeDestination } from "@beep/documents-domain/aggregates/VaultSync";
 * void ResumeDestination;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ResumeDestination extends Domain.Command("ResumeDestination", {
  target: V.DestinationId,
  input: {},
  events: [E.DestinationConnected],
  rejects: [SyncRuleViolation],
}) {}
