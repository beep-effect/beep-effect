/**
 * Typed technical errors for the OCCT driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OcctId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { O, P } from "@beep/utils";
import { Effect } from "effect";
import * as S from "effect/Schema";

const $I = $OcctId.create("Occt.errors");
const OcctErrorReasonBase = LiteralKit(["kernel-init", "invalid-request", "solid-build", "projection"]);

/**
 * Technical OCCT failure reasons.
 *
 * **Example** (Read the reasons)
 *
 * ```ts
 * import { OcctErrorReason } from "@beep/occt"
 *
 * console.log(OcctErrorReason.literals)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const OcctErrorReason = OcctErrorReasonBase.pipe(
  $I.annoteSchema("OcctErrorReason", {
    description:
      "Where an OCCT driver call failed: kernel load, request validation, solid construction, or projection.",
  }),
  SchemaUtils.withLiteralKitStatics(OcctErrorReasonBase)
);

/**
 * Type for {@link OcctErrorReason}.
 *
 * **Example** (Annotate a reason)
 *
 * ```ts
 * import type { OcctErrorReason } from "@beep/occt"
 *
 * const reason: OcctErrorReason = "projection"
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type OcctErrorReason = typeof OcctErrorReason.Type;

const causeText = (cause: unknown): O.Option<string> =>
  P.isString(cause) ? O.some(cause) : P.isError(cause) ? O.some(cause.message) : O.none();

/**
 * Technical failure raised inside the OCCT driver boundary.
 *
 * **Example** (Create an error from an unknown cause)
 *
 * ```ts
 * import { OcctError } from "@beep/occt"
 *
 * const error = OcctError.fromUnknown("projection", "HLR failed.", new Error("boom"))
 * console.log(error.reason, error.cause)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class OcctError extends S.TaggedError<OcctError>($I`OcctError`)(
  "OcctError",
  {
    reason: OcctErrorReason.annotateKey({ description: "Where the call failed." }),
    message: S.NonEmptyString.annotateKey({ description: "Operator-facing description of the failure." }),
    cause: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Kernel or validation message when one was available." })
    ),
  },
  $I.annote("OcctError", {
    description: "Typed technical failure from the OCCT driver.",
  })
) {
  /**
   * Build an error from a thrown kernel value or schema issue.
   *
   * **Example** (Wrap a kernel exception)
   *
   * ```ts
   * import { OcctError } from "@beep/occt"
   *
   * console.log(OcctError.fromUnknown("solid-build", "Fuse failed.", "BRepAlgoAPI_Fuse: null shape").cause)
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
  static readonly fromUnknown = (reason: OcctErrorReason, message: string, cause: unknown): OcctError =>
    OcctError.make({ reason, message, cause: causeText(cause) });
}
