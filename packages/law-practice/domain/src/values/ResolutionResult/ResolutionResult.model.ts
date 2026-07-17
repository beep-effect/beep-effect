/**
 * Resolution-result value object: the outcome of resolving a short-form
 * citation to its antecedent authority, ported from the eyecite
 * `ResolutionResult` interface.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationId } from "../CitationId/index.ts";

const $I = $LawPracticeDomainId.create("values/ResolutionResult/ResolutionResult.model");

/**
 * Result of resolving a short-form citation.
 *
 * Pairs the target citation (by both fragile array index and stable
 * {@link CitationId}) with the antecedent authority, a resolution `confidence`
 * score, and optional diagnostics — the `failureReason` and `warnings` emitted
 * when resolution is uncertain or fails.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { ResolutionResult } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const result = ResolutionResult.make({
 *   resolvedTo: O.some(NonNegativeInt.make(2)),
 *   antecedentIndex: O.some(NonNegativeInt.make(2)),
 *   confidence: 0.92,
 * })
 *
 * console.log(result.confidence) // 0.92
 * console.log(O.isNone(result.failureReason)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResolutionResult extends S.Class<ResolutionResult>($I`ResolutionResult`)(
  {
    resolvedTo: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Index of the citation this resolves to. undefined if resolution failed.",
      })
    ),
    antecedentIndex: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Index of this short-form's antecedent. On success mirrors resolvedTo; on the unresolved/fallback path points at the immediately preceding cited authority (Bluebook Rule 4.1). Records the immediate predecessor only.",
      })
    ),
    resolvedToId: CitationId.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Stable id of the resolvedTo citation (#860). Mirrors resolvedTo but survives filter/sort/map. Undefined when resolvedTo is.",
      })
    ),
    antecedentId: CitationId.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Stable id of the antecedentIndex citation (#860).",
      })
    ),
    failureReason: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Reason for resolution failure (if any).",
      })
    ),
    warnings: S.Array(S.String).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Warnings about ambiguous or uncertain resolutions.",
      })
    ),
    confidence: S.Finite.annotateKey({
      description:
        "Confidence in the resolution (0-1). Factors: party name similarity, scope boundary, citation type match.",
    }),
  },
  $I.annote("ResolutionResult", {
    description: "Result of resolving a short-form citation.",
  })
) {}

/**
 * Companion namespace for `ResolutionResult`.
 *
 * @example
 * ```ts
 * import type { ResolutionResult } from "@beep/law-practice-domain"
 *
 * type ResolutionResultWire = ResolutionResult.Encoded
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ResolutionResult {
  /**
   * Wire-encoded representation of a decoded {@link ResolutionResult}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { ResolutionResult } from "@beep/law-practice-domain"
   *
   * type Wire = ResolutionResult.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof ResolutionResult.Encoded;
}
