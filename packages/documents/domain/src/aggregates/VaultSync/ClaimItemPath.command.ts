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
 * ClaimItemPath vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ClaimItemPath } from "@beep/documents-domain/aggregates/VaultSync";
 * void ClaimItemPath;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ClaimItemPath extends Domain.Command("ClaimItemPath", {
  target: V.DestinationId,
  input: { path: V.VaultRelPath, itemId: V.ItemId },
  events: [E.ItemPathClaimed],
  rejects: [SyncRuleViolation],
}) {}
