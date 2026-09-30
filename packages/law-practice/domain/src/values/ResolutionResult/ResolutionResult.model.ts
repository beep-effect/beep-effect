/**
 * Resolution-result value object: the outcome of resolving a short-form
 * citation to its antecedent authority, ported from the eyecite
 * `ResolutionResult` interface.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { CitationId } from "../CitationId/index.ts";

const $I = $LawPracticeDomainId.create("values/ResolutionResult/ResolutionResult.model");

const resolutionResultWarningsDefault = A.empty<string>();
/**
 * Result of resolving a short-form citation.
 *
 * **Details**
 *
 * Pairs the target citation (by both fragile array index and stable
 * {@link CitationId}) with the antecedent authority, a resolution `confidence`
 * score, and diagnostics — the optional `failureReason` and zero-or-more
 * `warnings` emitted when resolution is uncertain or fails.
 *
 * **Example** (Make a resolution result)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ResolutionResult } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const result = ResolutionResult.make({
 *   resolvedTo: O.some(S.Natural.make(2)),
 *   antecedentIndex: O.some(S.Natural.make(2)),
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
    resolvedTo: S.Natural.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Index of the citation this resolves to. undefined if resolution failed.",
      })
    ),
    antecedentIndex: S.Natural.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "Index of this short-form's antecedent. On success mirrors resolvedTo; on the unresolved/fallback path points at the immediately preceding cited authority (Bluebook Rule 4.1). Records the immediate predecessor only.",
      })
    ),
    resolvedToId: CitationId.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "Stable id of the resolvedTo citation (#860). Mirrors resolvedTo but survives filter/sort/map. Undefined when resolvedTo is.",
      })
    ),
    antecedentId: CitationId.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Stable id of the antecedentIndex citation (#860).",
      })
    ),
    failureReason: S.String.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Reason for resolution failure (if any).",
      })
    ),
    warnings: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(resolutionResultWarningsDefault)),
      S.withDecodingDefaultType(Effect.succeed(resolutionResultWarningsDefault)),
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
 * **Example** (Alias the Encoded type)
 *
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
   * **Example** (Reference Encoded wire type)
   *
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
