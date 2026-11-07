/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
/**
 * ItemOperations vault sync orchestration.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { ItemOperations } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void ItemOperations;
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export class ItemOperations extends Domain.Policy("ItemOperations", {
  from: V.SyncItem,
  on: [V.ItemTracked, V.ItemEdited, V.ItemMoved, V.ItemKindReplaced],
}) {}
