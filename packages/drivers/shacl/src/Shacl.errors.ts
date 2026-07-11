/**
 * shacl-engine driver typed errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ShaclId } from "@beep/identity/packages";
import { LiteralKit, TaggedErrorClass } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $ShaclId.create("Shacl.errors");

/**
 * shacl-engine driver failure reason.
 *
 * @example
 * ```ts
 * import { ShaclEngineErrorReason } from "@beep/shacl"
 *
 * const reason: ShaclEngineErrorReason = "validationFailed"
 *
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ShaclEngineErrorReason = LiteralKit([
  "importFailed",
  "adapterInvariant",
  "datasetLoadFailed",
  "validationFailed",
]).pipe(
  $I.annoteSchema("ShaclEngineErrorReason", {
    description: "shacl-engine driver failure reason.",
  })
);

/**
 * Type for {@link ShaclEngineErrorReason}.
 *
 * @example
 * ```ts
 * import { ShaclEngineErrorReason } from "@beep/shacl"
 *
 * const reason: ShaclEngineErrorReason = "importFailed"
 *
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type ShaclEngineErrorReason = typeof ShaclEngineErrorReason.Type;

/**
 * Typed shacl-engine driver error.
 *
 * @example
 * ```ts
 * import { ShaclEngineError } from "@beep/shacl"
 *
 * const error = ShaclEngineError.make({
 *   reason: "validationFailed",
 *   message: "The SHACL engine rejected the shapes graph."
 * })
 *
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ShaclEngineError extends TaggedErrorClass<ShaclEngineError>($I`ShaclEngineError`)(
  "ShaclEngineError",
  {
    reason: ShaclEngineErrorReason,
    message: S.String,
  },
  $I.annote("ShaclEngineError", {
    description: "Typed shacl-engine driver error.",
  })
) {}
