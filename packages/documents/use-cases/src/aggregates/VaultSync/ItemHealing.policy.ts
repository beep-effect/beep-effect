/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
/**
 * ItemHealing vault sync orchestration.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { ItemHealing } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void ItemHealing;
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export class ItemHealing extends Domain.Policy("ItemHealing", { from: V.SyncItem, on: [V.ItemReturnedToPending] }) {}
