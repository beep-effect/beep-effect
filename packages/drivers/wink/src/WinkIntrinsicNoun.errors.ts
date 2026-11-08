/**
 * Typed boundaries of the driver-local intrinsic membership capability.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $WinkId } from "@beep/identity";
import * as S from "effect/Schema";
import { WinkIntrinsicSourceWork } from "./WinkIntrinsicNoun.models.ts";

const $I = $WinkId.create("Wink/WinkIntrinsicNounErrors");
/**
 * Preserves a failed query's paid debit and remaining source allowance.
 *
 * **Example** (Retain the debit after a query failure)
 *
 * ```ts
 * import { WinkIntrinsicNounError } from "@beep/wink"
 *
 * const error = WinkIntrinsicNounError.make({
 *   reason: "query-failed", cause: "membership unavailable", workDebit: 316, remainingWork: 1_684,
 * })
 * console.log(error.workDebit) // 316
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WinkIntrinsicNounError extends S.TaggedError<WinkIntrinsicNounError, { readonly brand: unique symbol }>(
  $I`WinkIntrinsicNounError`
)(
  "WinkIntrinsicNounError",
  {
    reason: S.Literals(["invalid-request", "released", "engine-replaced", "query-failed"]),
    cause: S.Defect({ includeStack: true }),
    workDebit: WinkIntrinsicSourceWork,
    remainingWork: WinkIntrinsicSourceWork,
  },
  $I.annoteError<WinkIntrinsicNounError>("WinkIntrinsicNounError", {
    description: "Expected local query failure without hiding defects/interruption or restoring source credit.",
  })
) {}
/**
 * Refuses activation when the fixed private API, version or core owner differs.
 *
 * **Example** (Represent a version refusal)
 *
 * ```ts
 * import { WinkIntrinsicNounActivationError } from "@beep/wink"
 *
 * const error = WinkIntrinsicNounActivationError.make({ reason: "version", cause: "unsupported engine version" })
 * console.log(error.reason) // version
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WinkIntrinsicNounActivationError extends S.TaggedError<
  WinkIntrinsicNounActivationError,
  { readonly brand: unique symbol }
>($I`WinkIntrinsicNounActivationError`)(
  "WinkIntrinsicNounActivationError",
  { cause: S.Defect({ includeStack: true }), reason: S.Literals(["private-api", "version", "core-owner"]) },
  $I.annoteError<WinkIntrinsicNounActivationError>("WinkIntrinsicNounActivationError", {
    description: "A fixed-asset or owner mismatch cannot masquerade as negative lexical membership.",
  })
) {}
