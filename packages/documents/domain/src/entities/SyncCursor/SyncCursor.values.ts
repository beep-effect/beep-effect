/**
 * SyncCursor concept-local value schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocumentsDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $DocumentsDomainId.create("entities/SyncCursor/SyncCursor.values");

/**
 * Health status for a remote-event stream cursor.
 *
 * **Example** (Assert active SyncCursorStatus)
 *
 * ```ts
 * import { SyncCursorStatus } from "@beep/documents-domain/entities/SyncCursor"
 *
 * const status: SyncCursorStatus = SyncCursorStatus.Enum.active
 *
 * if (!SyncCursorStatus.is.active(status)) {
 *   throw new Error("expected active cursor status")
 * }
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const SyncCursorStatus = LiteralKit(["active", "error"]).pipe(
  $I.annoteSchema("SyncCursorStatus", {
    description: "Health status for a remote-event stream cursor.",
  })
);

/**
 * Runtime type for {@link SyncCursorStatus}.
 *
 * @category value-objects
 * @since 0.0.0
 */
export type SyncCursorStatus = typeof SyncCursorStatus.Type;
