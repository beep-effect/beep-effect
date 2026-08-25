/**
 * Typed errors for the cosmos graph driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CosmosId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { P } from "@beep/utils";
import * as S from "effect/Schema";

const $I = $CosmosId.create("Cosmos.errors");

/**
 * Cosmos driver failure reason.
 *
 * **Example** (Assign importFailed reason)
 *
 * ```ts
 * import { CosmosDriverErrorReason } from "@beep/cosmos"
 *
 * const reason: CosmosDriverErrorReason = "importFailed"
 *
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const CosmosDriverErrorReason = LiteralKit(["importFailed", "adapterInvariant", "renderFailed"]).annotate(
  $I.annote("CosmosDriverErrorReason", {
    description: "Failure reason emitted by the cosmos graph driver.",
  })
);

/**
 * Type for {@link CosmosDriverErrorReason}.
 *
 * **Example** (Assign renderFailed reason)
 *
 * ```ts
 * import { CosmosDriverErrorReason } from "@beep/cosmos"
 *
 * const reason: CosmosDriverErrorReason = "renderFailed"
 *
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type CosmosDriverErrorReason = typeof CosmosDriverErrorReason.Type;

/**
 * Typed cosmos driver error.
 *
 * **Example** (Create typed driver error)
 *
 * ```ts
 * import { CosmosDriverError } from "@beep/cosmos"
 *
 * const error = CosmosDriverError.make({
 *   reason: "renderFailed",
 *   message: "Unable to mount the graph renderer."
 * })
 *
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CosmosDriverError extends S.TaggedError<CosmosDriverError>($I`CosmosDriverError`)(
  "CosmosDriverError",
  {
    reason: CosmosDriverErrorReason,
    message: S.String,
  },
  $I.annoteError<CosmosDriverError>("CosmosDriverError", {
    description: "Typed error raised by cosmos and sigma graph render adapters.",
  })
) {
  /** Creates an adapter-invariant failure for an invalid runtime module shape. */
  static readonly adapterInvariant = (message: string): CosmosDriverError =>
    CosmosDriverError.make({
      reason: "adapterInvariant",
      message,
    });

  /** Maps an unknown runtime failure into the driver's typed error channel. */
  static readonly fromUnknown =
    (reason: CosmosDriverErrorReason) =>
    (fallback: string) =>
    (cause: unknown): CosmosDriverError =>
      CosmosDriverError.make({
        reason,
        message: P.hasProperty(cause, "message") && P.isString(cause.message) ? cause.message : fallback,
      });
}
