/**
 * shacl-engine driver typed errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ShaclId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $ShaclId.create("Shacl.errors");

/**
 * shacl-engine driver failure reason.
 *
 * **Example** (Assign validationFailed reason)
 *
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
 * **Example** (Assign importFailed reason)
 *
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

const ShaclEngineErrorFields = {
  reason: ShaclEngineErrorReason,
  message: S.String,
} satisfies S.Struct.Fields;
const sameShaclEngineErrorFields = S.toEquivalence(S.TaggedStruct("ShaclEngineError", ShaclEngineErrorFields));
const sameShaclEngineError = (self: ShaclEngineError, that: ShaclEngineError): boolean =>
  sameShaclEngineErrorFields(self, that);

/**
 * Typed shacl-engine driver error.
 *
 * **Example** (Make validationFailed error)
 *
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
export class ShaclEngineError extends S.TaggedError<ShaclEngineError>($I`ShaclEngineError`)(
  "ShaclEngineError",
  ShaclEngineErrorFields,
  $I.annoteClass<
    S.declare<ShaclEngineError>,
    readonly [S.TaggedStruct<"ShaclEngineError", typeof ShaclEngineErrorFields>]
  >("ShaclEngineError", {
    description: "Typed shacl-engine driver error.",
    toEquivalence: () => sameShaclEngineError,
  })
) {}
