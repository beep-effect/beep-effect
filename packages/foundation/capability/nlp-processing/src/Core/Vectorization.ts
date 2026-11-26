/**
 * Driver-neutral vectorization models used by NLP retrieval services.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { PositiveNumber, UnitInterval } from "../internal/numbers.ts";
import { DocumentId } from "./Document.ts";

const $I = $NlpProcessingId.create("Core/Vectorization");

/**
 * Strictly positive numeric value shared by BM25 hyperparameters.
 *
 * **Example** (Import PositiveNumber schema)
 *
 * ```ts
 * import { PositiveNumber } from "@beep/nlp-processing/Core/Vectorization"
 *
 * console.log(PositiveNumber)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export { PositiveNumber } from "../internal/numbers.ts";

const BM25NormKit = LiteralKit(["none", "l1", "l2"]).pipe(
  $I.annoteSchema("BM25NormKit", {
    description: "LiteralKit backing schema for BM25 normalization modes.",
  })
);

/**
 * BM25 normalization mode used by vectorizer and corpus services.
 *
 * **Example** (Decode BM25Norm value)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { BM25Norm } from "@beep/nlp-processing/Core/Vectorization"
 *
 * const norm = S.decodeSync(BM25Norm)("l2")
 * console.log(norm)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const BM25Norm = BM25NormKit.pipe(
  $I.annoteSchema("BM25Norm", {
    description: "Vector normalization mode used by BM25-compatible vectorizers.",
  }),
  SchemaUtils.withLiteralKitStatics(BM25NormKit)
);

/**
 * Runtime TypeScript union decoded by {@link BM25Norm}.
 *
 * **Example** (Type annotate BM25Norm)
 *
 * ```ts
 * import type { BM25Norm } from "@beep/nlp-processing/Core/Vectorization"
 *
 * const norm: BM25Norm = "l2"
 * console.log(norm)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BM25Norm = typeof BM25Norm.Type;

/**
 * Resolved BM25 hyperparameters used by vectorization and corpus management.
 *
 * **Example** (Create BM25Config instance)
 *
 * ```ts
 * import { UnitInterval } from "@beep/schema/UnitInterval"
 * import { BM25Config } from "@beep/nlp-processing/Core/Vectorization"
 *
 * const config = BM25Config.make({
 *   b: UnitInterval.make(0.75),
 *   k: 1,
 *   k1: 1.2,
 *   norm: "none"
 * })
 *
 * console.log(config.k1)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BM25Config extends S.Opaque<BM25Config, { readonly brand: unique symbol }>()(
  S.Struct({
    b: UnitInterval,
    k: PositiveNumber,
    k1: PositiveNumber,
    norm: BM25Norm,
  }).pipe(
    $I.annoteSchema("BM25Config", {
      description: "Resolved BM25 hyperparameters used by vectorization services.",
    })
  )
) {}

/**
 * Default BM25 hyperparameters used by live vectorizers.
 *
 * **Example** (Inspect default BM25 config)
 *
 * ```ts
 * import { DefaultBM25Config } from "@beep/nlp-processing/Core/Vectorization"
 *
 * console.log(DefaultBM25Config.norm)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const DefaultBM25Config = BM25Config.make({
  b: UnitInterval.make(0.75),
  k: 1,
  k1: 1.2,
  norm: "none",
});

/**
 * **Example** (Create DocumentVector instance)
 *
 * ```ts
 * import { DocumentId } from "@beep/nlp-processing/Core/Document"
 * import { DocumentVector } from "@beep/nlp-processing/Core/Vectorization"
 *
 * const vector = DocumentVector.make({
 *   documentId: DocumentId.make("doc-a"),
 *   terms: ["effect", "schema"],
 *   vector: [0.7, 0.3]
 * })
 *
 * console.log(vector.vector.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocumentVector extends S.Opaque<DocumentVector, { readonly brand: unique symbol }>()(
  S.Struct({
    documentId: DocumentId,
    terms: S.Array(S.String),
    vector: S.Array(S.Finite),
  }).pipe(
    $I.annoteSchema("DocumentVector", {
      description: "Dense vector representation for a document-like input.",
    })
  )
) {}

/**
 * **Example** (Create BagOfWords instance)
 *
 * ```ts
 * import { DocumentId } from "@beep/nlp-processing/Core/Document"
 * import { BagOfWords } from "@beep/nlp-processing/Core/Vectorization"
 *
 * const bow = BagOfWords.make({
 *   bow: { effect: 2, schema: 1 },
 *   documentId: DocumentId.make("doc-a")
 * })
 *
 * console.log(bow.bow.effect)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BagOfWords extends S.Opaque<BagOfWords, { readonly brand: unique symbol }>()(
  S.Struct({
    bow: S.Record(S.String, S.Finite),
    documentId: DocumentId,
  }).pipe(
    $I.annoteSchema("BagOfWords", {
      description: "Bag-of-words term-frequency representation for a document-like input.",
    })
  )
) {}

/**
 * Term-frequency entry reported for a learned vectorized document.
 *
 * **Example** (Create TermFrequency entry)
 *
 * ```ts
 * import { TermFrequency } from "@beep/nlp-processing/Core/Vectorization"
 *
 * const tf = TermFrequency.make({
 *   frequency: 3,
 *   term: "effect"
 * })
 *
 * console.log(`${tf.term}:${tf.frequency}`)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TermFrequency extends S.Opaque<TermFrequency, { readonly brand: unique symbol }>()(
  S.Struct({
    frequency: S.Finite,
    term: S.String,
  }).pipe(
    $I.annoteSchema("TermFrequency", {
      description: "Normalized term contribution for a learned document.",
    })
  )
) {}
