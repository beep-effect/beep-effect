/**
 * Driver-neutral similarity models used by NLP comparison services.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { UnitInterval } from "../internal/numbers.ts";
import { DocumentId } from "./Document.ts";

const $I = $NlpProcessingId.create("Core/Similarity");

const SimilarityMethodKit = LiteralKit(["vector.cosine", "set.tversky", "bow.cosine"]).pipe(
  $I.annoteSchema("SimilarityMethodKit", {
    description: "LiteralKit backing schema for NLP similarity method identifiers.",
  })
);

/**
 * Similarity method identifiers exposed by NLP comparison services.
 *
 * **Example** (Check vector cosine method)
 *
 * ```ts
 * import { SimilarityMethod } from "@beep/nlp-processing/Core/Similarity"
 *
 * console.log(SimilarityMethod.is["vector.cosine"]("vector.cosine"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SimilarityMethod = SimilarityMethodKit.pipe(
  $I.annoteSchema("SimilarityMethod", {
    description: "Similarity methods exposed by NLP services.",
  }),
  SchemaUtils.withLiteralKitStatics(SimilarityMethodKit)
);

/**
 * Runtime TypeScript union decoded by {@link SimilarityMethod}.
 *
 * **Example** (Assign cosine method literal)
 *
 * ```ts
 * import type { SimilarityMethod } from "@beep/nlp-processing/Core/Similarity"
 *
 * const method: SimilarityMethod = "vector.cosine"
 * console.log(method)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SimilarityMethod = typeof SimilarityMethod.Type;

/**
 * Weights controlling the asymmetric Tversky set similarity index.
 *
 * **Example** (Create weighted Tversky params)
 *
 * ```ts
 * import { UnitInterval } from "@beep/schema/UnitInterval"
 * import { TverskyParams } from "@beep/nlp-processing/Core/Similarity"
 *
 * const params = TverskyParams.make({
 *   alpha: UnitInterval.make(0.7),
 *   beta: UnitInterval.make(0.3)
 * })
 * console.log(params.alpha + params.beta)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TverskyParams extends S.Opaque<TverskyParams, { readonly brand: unique symbol }>()(
  S.Struct({
    alpha: UnitInterval,
    beta: UnitInterval,
  }).pipe(
    $I.annoteSchema("TverskyParams", {
      description: "Weights used when computing the asymmetric Tversky set similarity.",
    })
  )
) {}

/**
 * Normalized terms for one document in set-based similarity comparisons.
 *
 * **Example** (Build document term set)
 *
 * ```ts
 * import { DocumentId } from "@beep/nlp-processing/Core/Document"
 * import { DocumentTermSet } from "@beep/nlp-processing/Core/Similarity"
 *
 * const terms = DocumentTermSet.make({
 *   documentId: DocumentId.make("doc-a"),
 *   terms: ["effect", "schema", "nlp"]
 * })
 *
 * console.log(terms.terms.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocumentTermSet extends S.Opaque<DocumentTermSet, { readonly brand: unique symbol }>()(
  S.Struct({
    documentId: DocumentId,
    terms: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("DocumentTermSet", {
      description: "Normalized term set extracted from a document for set-based similarity.",
    })
  )
) {}

/**
 * Normalized similarity score returned from an NLP comparison.
 *
 * **Example** (Create scored comparison result)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { UnitInterval } from "@beep/schema/UnitInterval"
 * import { DocumentId } from "@beep/nlp-processing/Core/Document"
 * import { SimilarityScore } from "@beep/nlp-processing/Core/Similarity"
 *
 * const score = SimilarityScore.make({
 *   document1Id: DocumentId.make("doc-a"),
 *   document2Id: DocumentId.make("doc-b"),
 *   method: "set.tversky",
 *   parameters: O.some({ alpha: 0.7, beta: 0.3 }),
 *   score: UnitInterval.make(0.8)
 * })
 *
 * console.log(score.method)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SimilarityScore extends S.Opaque<SimilarityScore, { readonly brand: unique symbol }>()(
  S.Struct({
    document1Id: DocumentId,
    document2Id: DocumentId,
    method: SimilarityMethod,
    parameters: S.OptionFromOptionalKey(S.Record(S.String, S.Unknown)).pipe(
      S.withConstructorDefault(Effect.succeedNone)
    ),
    score: UnitInterval,
  }).pipe(
    $I.annoteSchema("SimilarityScore", {
      description: "Similarity score comparing two document-like inputs.",
    })
  )
) {}
