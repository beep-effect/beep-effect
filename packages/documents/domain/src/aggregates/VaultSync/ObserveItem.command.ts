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
 * ObserveItem vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ObserveItem } from "@beep/documents-domain/aggregates/VaultSync";
 * void ObserveItem;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ObserveItem extends Domain.Command("ObserveItem", {
  target: V.ItemId,
  input: { observation: E.ItemObservation },
  events: [E.ItemTracked, E.ItemEdited, E.ItemMoved, E.ItemKindReplaced],
  rejects: [SyncRuleViolation],
}) {}
