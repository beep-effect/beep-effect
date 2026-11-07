/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as E from "./SyncItem.events.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";
/**
 * FlagItemDrift vault sync contract.
 *
 * **Example** (Build a command for dispatch)
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync";
 * const command=V.FlagItemDrift.make({});
 * console.log(command._tag);
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class FlagItemDrift extends Domain.Command("FlagItemDrift", {
  target: V.ItemId,
  input: {},
  events: [E.ItemDriftFlagged],
  rejects: [SyncRuleViolation],
}) {}
