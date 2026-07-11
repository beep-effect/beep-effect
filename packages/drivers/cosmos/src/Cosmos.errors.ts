/**
 * Typed errors for the cosmos graph driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { make as makeIdentity } from "@beep/identity";
import { LiteralKit, TaggedErrorClass } from "@beep/schema";
import * as S from "effect/Schema";

const { $CosmosId } = makeIdentity("cosmos");
const $I = $CosmosId.create("Cosmos.errors");

/**
 * Cosmos driver failure reason.
 *
 * @example
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
export const CosmosDriverErrorReason = LiteralKit(["importFailed", "adapterInvariant", "renderFailed"]).pipe(
  $I.annoteSchema("CosmosDriverErrorReason", {
    description: "Failure reason emitted by the cosmos graph driver.",
  })
);

/**
 * Type for {@link CosmosDriverErrorReason}.
 *
 * @example
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
 * @example
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
export class CosmosDriverError extends TaggedErrorClass<CosmosDriverError>($I`CosmosDriverError`)(
  "CosmosDriverError",
  {
    reason: CosmosDriverErrorReason,
    message: S.String,
  },
  $I.annote("CosmosDriverError", {
    description: "Typed error raised by cosmos and sigma graph render adapters.",
  })
) {}
