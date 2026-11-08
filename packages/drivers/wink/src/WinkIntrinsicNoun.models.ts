/**
 * Exact-form intrinsic lexical membership data owned by the pinned Wink driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $WinkId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import type * as Effect from "effect/Effect";
import type { WinkIntrinsicNounError } from "./WinkIntrinsicNoun.errors.ts";

const $I = $WinkId.create("Wink/WinkIntrinsicNoun");
/**
 * Bounds the remaining work carried forward from one source inspection.
 *
 * **Example** (Decode a shared remainder)
 *
 * ```ts
 * import { WinkIntrinsicSourceWork } from "@beep/wink"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 *
 * const remainder = S.decodeResult(WinkIntrinsicSourceWork)(262_144)
 * console.log(Result.isSuccess(remainder)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const WinkIntrinsicSourceWork = S.Int.check(S.isBetween({ minimum: 0, maximum: 262_144 })).pipe(
  $I.annoteSchema("WinkIntrinsicSourceWork", {
    description: "A remaining portion of the caller's existing bounded source allowance.",
  })
);
/**
 * Runtime value accepted by {@link WinkIntrinsicSourceWork}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type WinkIntrinsicSourceWork = typeof WinkIntrinsicSourceWork.Type;
/**
 * Carries an unchanged source form and its existing work allowance to the owner.
 *
 * **Details**
 *
 * The query uses the exact form rather than its lemma. Its work reservation is paid
 * before the private membership lookup; callers carry the returned remainder forward.
 *
 * **Example** (Prepare an exact-form query)
 *
 * ```ts
 * import { WinkIntrinsicNounRequest } from "@beep/wink"
 *
 * const request = WinkIntrinsicNounRequest.make({ rawForm: "joint", remainingWork: 2_000 })
 * console.log(request.rawForm) // joint
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WinkIntrinsicNounRequest extends S.Opaque<WinkIntrinsicNounRequest, { readonly brand: unique symbol }>()(
  S.Struct({ rawForm: S.NonEmptyString.check(S.isMaxLength(32_768)), remainingWork: WinkIntrinsicSourceWork }).pipe(
    $I.annoteSchema("WinkIntrinsicNounRequest", {
      description: "No normalization or lemma substitution; reservation precedes the private lookup.",
    })
  )
) {}
/**
 * Distinguishes a paid lexical observation from a refusal for insufficient work.
 *
 * **Gotchas**
 *
 * False membership does not prove that a source phrase is non-nominal. A known result
 * records base lexeme membership and OOV status without changing the contextual POS.
 *
 * **Example** (Record a paid observation)
 *
 * ```ts
 * import { WinkIntrinsicNounResult } from "@beep/wink"
 *
 * const result = WinkIntrinsicNounResult.cases.known.make({
 *   rawForm: "joint", baseNoun: true, oov: false, workDebit: 316, remainingWork: 1_684,
 * })
 * console.log(result.status) // known
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const WinkIntrinsicNounResult = LiteralKit(["known", "work-limit"])
  .toTaggedUnion("status")({
    known: {
      rawForm: S.NonEmptyString,
      baseNoun: S.Boolean,
      oov: S.Boolean,
      workDebit: WinkIntrinsicSourceWork,
      remainingWork: WinkIntrinsicSourceWork,
    },
    "work-limit": { rawForm: S.NonEmptyString, workDebit: S.tag(0), remainingWork: WinkIntrinsicSourceWork },
  })
  .pipe(
    $I.annoteSchema("WinkIntrinsicNounResult", {
      description: "The caller carries the paid debit forward exactly once; an insufficient budget performs no lookup.",
    })
  );
/**
 * Runtime value described by {@link WinkIntrinsicNounResult}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type WinkIntrinsicNounResult = typeof WinkIntrinsicNounResult.Type;
/**
 * Computes the reservation for both pinned lookup paths and result construction.
 *
 * **Details**
 *
 * The charge uses UTF-16 string length and is deducted from the caller's source work.
 * Computing this value does not perform a query or allocate a new work allowance.
 *
 * **Example** (Reserve one exact-form lookup)
 *
 * ```ts
 * import { winkIntrinsicNounQueryCost } from "@beep/wink"
 *
 * console.log(winkIntrinsicNounQueryCost("joint")) // 316
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const winkIntrinsicNounQueryCost = (rawForm: string): number => 256 + rawForm.length * 12;

/**
 * Queries the captured engine owner without exposing its cache, core or documents.
 *
 * @category services
 * @since 0.0.0
 */
export interface WinkIntrinsicNounShape {
  readonly provider: string;
  readonly query: (request: WinkIntrinsicNounRequest) => Effect.Effect<WinkIntrinsicNounResult, WinkIntrinsicNounError>;
}
