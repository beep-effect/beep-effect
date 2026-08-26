/**
 * Driver-neutral vectorization models used by NLP retrieval services.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { PositiveNumber, UnitInterval } from "../internal/numbers.ts";
import { DocumentId } from "./Document.ts";

const $I = $NlpId.create("Core/Vectorization");

/**
 * Strictly positive numeric value shared by BM25 hyperparameters.
 *
 * **Example** (Import PositiveNumber schema)
 *
 * ```ts import.meta.vitest name="Import PositiveNumber schema"
 * import { PositiveNumber } from "@beep/nlp/Core/Vectorization"
 *
 * console.log(PositiveNumber)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export { PositiveNumber } from "../internal/numbers.ts";

const BM25NormKit = LiteralKit(["none", "l1", "l2"]).annotate(
  $I.annote("BM25NormKit", {
    description: "LiteralKit backing schema for BM25 normalization modes.",
  })
);

/**
 * BM25 normalization mode used by vectorizer and corpus services.
 *
 * **Example** (Decode BM25Norm value)
 *
 * ```ts import.meta.vitest name="Decode BM25Norm value"
 * import * as S from "effect/Schema"
 * import { BM25Norm } from "@beep/nlp/Core/Vectorization"
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
 * ```ts import.meta.vitest name="Type annotate BM25Norm"
 * import type { BM25Norm } from "@beep/nlp/Core/Vectorization"
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
 * ```ts import.meta.vitest name="Create BM25Config instance"
 * import { UnitInterval } from "@beep/schema/UnitInterval"
 * import { BM25Config } from "@beep/nlp/Core/Vectorization"
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
export class BM25Config extends S.Class<BM25Config>($I`BM25Config`)(
  {
    b: UnitInterval,
    k: PositiveNumber,
    k1: PositiveNumber,
    norm: BM25Norm,
  },
  $I.annote("BM25Config", {
    description: "Resolved BM25 hyperparameters used by vectorization services.",
  })
) {}

/**
 * Default BM25 hyperparameters used by live vectorizers.
 *
 * **Example** (Inspect default BM25 config)
 *
 * ```ts import.meta.vitest name="Inspect default BM25 config"
 * import { DefaultBM25Config } from "@beep/nlp/Core/Vectorization"
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
 * Dense vector representation for a document or query.
 *
 * **Example** (Create DocumentVector instance)
 *
 * ```ts import.meta.vitest name="Create DocumentVector instance"
 * import { DocumentId } from "@beep/nlp/Core/Document"
 * import { DocumentVector } from "@beep/nlp/Core/Vectorization"
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
export class DocumentVector extends S.Class<DocumentVector>($I`DocumentVector`)(
  {
    documentId: DocumentId,
    terms: S.Array(S.String),
    vector: S.Array(S.Finite),
  },
  $I.annote("DocumentVector", {
    description: "Dense vector representation for a document-like input.",
  })
) {}

/**
 * Bag-of-words term-frequency representation for a document or query.
 *
 * **Example** (Create BagOfWords instance)
 *
 * ```ts import.meta.vitest name="Create BagOfWords instance"
 * import { DocumentId } from "@beep/nlp/Core/Document"
 * import { BagOfWords } from "@beep/nlp/Core/Vectorization"
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
export class BagOfWords extends S.Class<BagOfWords>($I`BagOfWords`)(
  {
    bow: S.Record(S.String, S.Finite),
    documentId: DocumentId,
  },
  $I.annote("BagOfWords", {
    description: "Bag-of-words term-frequency representation for a document-like input.",
  })
) {}

/**
 * Term-frequency entry reported for a learned vectorized document.
 *
 * **Example** (Create TermFrequency entry)
 *
 * ```ts import.meta.vitest name="Create TermFrequency entry"
 * import { TermFrequency } from "@beep/nlp/Core/Vectorization"
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
export class TermFrequency extends S.Class<TermFrequency>($I`TermFrequency`)(
  {
    frequency: S.Finite,
    term: S.String,
  },
  $I.annote("TermFrequency", {
    description: "Normalized term contribution for a learned document.",
  })
) {}
