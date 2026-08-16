/**
 * SyncItem concept-local value schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocumentsDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $DocumentsDomainId.create("entities/SyncItem/SyncItem.values");

/**
 * Reconciliation state for one mirrored vault item.
 *
 * **Example** (Check pending sync state)
 *
 * ```ts
 * import { SyncItemState } from "@beep/documents-domain/entities/SyncItem"
 *
 * const state: SyncItemState = SyncItemState.Enum.pending
 * console.log(SyncItemState.is.pending(state))
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const SyncItemState = LiteralKit(["pending", "current", "error", "conflict"]).pipe(
  $I.annoteSchema("SyncItemState", {
    description: "Reconciliation state for one mirrored vault item.",
  })
);

/**
 * Runtime type for {@link SyncItemState}.
 *
 * @category value-objects
 * @since 0.0.0
 */
export type SyncItemState = typeof SyncItemState.Type;
