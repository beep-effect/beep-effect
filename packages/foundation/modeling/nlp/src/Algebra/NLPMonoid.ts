/**
 * Algebra/NLPMonoid - NLP-specific monoid structures.
 *
 * Defines monoid instances specifically for NLP data structures, building on
 * the general monoid framework in {@link Monoid}. These provide mathematically
 * sound aggregation for:
 * - Tokens (words and their features)
 * - Sentences (sequences of tokens)
 * - Documents (collections of sentences)
 * - Linguistic annotations (POS tags, named entities, etc.)
 *
 * Each monoid satisfies the monoid laws (associativity + left/right identity),
 * except {@link SentenceConcat}, which is a "near-monoid" (identity only) due to
 * punctuation normalization. Laws are verified in test/Algebra/NLPMonoid.test.ts.
 *
 * Effect v4 `@beep/nlp` implementation. Map
 * and set carriers use Effect-native collection semantics at package
 * boundaries.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpId } from "@beep/identity";
import { MutableHashMapFromSelf } from "@beep/schema";
import { HashSet, MutableHashMap } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Monoid from "./Monoid.ts";

const $I = $NlpId.create("Algebra/NLPMonoid");

const NonNegativeCount = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("NonNegativeCount", {
    description: "Non-negative integer count used by NLP aggregation carriers.",
  })
);

const TermNumberMap = MutableHashMapFromSelf({
  key: S.String,
  value: S.Finite,
});

type TermNumberMap = typeof TermNumberMap.Type;
type TokenHashSet = HashSet.HashSet<string>;

const getCount = <K>(map: MutableHashMap.MutableHashMap<K, number>, key: K): number =>
  O.getOrElse(MutableHashMap.get(map, key), () => 0);

const combineNumericMaps = <K>(
  left: MutableHashMap.MutableHashMap<K, number>,
  right: MutableHashMap.MutableHashMap<K, number>
): MutableHashMap.MutableHashMap<K, number> => {
  const result = MutableHashMap.fromIterable(left);
  MutableHashMap.forEach(right, (count, key) => {
    MutableHashMap.set(result, key, getCount(result, key) + count);
  });
  return result;
};

/**
 * Bag-of-words frequency map carrier: term -\> frequency.
 *
 * @example
 * ```ts
 * import * as MutableHashMap from "effect/MutableHashMap"
 * import type * as NLPMonoid from "@beep/nlp/Algebra/NLPMonoid"
 *
 * const bow: NLPMonoid.BagOfWords = MutableHashMap.make(
 *   ["effect", 2],
 *   ["schema", 1]
 * )
 *
 * console.log(Array.from(bow))
 * // [["effect", 2], ["schema", 1]]
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const BagOfWords = TermNumberMap;

/**
 * Runtime type for the {@link BagOfWords} frequency-map carrier.
 *
 * @example
 * ```ts
 * import * as MutableHashMap from "effect/MutableHashMap"
 * import type { BagOfWords } from "@beep/nlp/Algebra/NLPMonoid"
 *
 * const bow: BagOfWords = MutableHashMap.make(["effect", 1])
 *
 * console.log(Array.from(bow))
 * // [["effect", 1]]
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type BagOfWords = typeof BagOfWords.Type;

// =============================================================================
// Token Monoids
// =============================================================================

/**
 * Token concatenation monoid (join with a space).
 *
 * This folds a token sequence back into plain text.
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 * import * as NLPMonoid from "@beep/nlp/Algebra/NLPMonoid"
 *
 * const text = Monoid.fold(NLPMonoid.TokenConcat)(["effect", "schema", "docs"])
 *
 * console.log(text)
 * // "effect schema docs"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const TokenConcat: Monoid.Monoid<string> = Monoid.StringJoin(" ");

/**
 * Token bag-of-words monoid (union with frequency addition).
 *
 * A monoid homomorphism from the free monoid `Token*` to the multiset monoid.
 *
 * @example
 * ```ts
 * import * as MutableHashMap from "effect/MutableHashMap"
 * import * as NLPMonoid from "@beep/nlp/Algebra/NLPMonoid"
 *
 * const left = MutableHashMap.make(["effect", 2])
 * const right = MutableHashMap.make(["effect", 1], ["schema", 1])
 * const counts = NLPMonoid.TokenBagOfWords.combine(left, right)
 *
 * console.log(Array.from(counts))
 * // [["effect", 3], ["schema", 1]]
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const TokenBagOfWords: Monoid.Monoid<BagOfWords> = {
  empty: MutableHashMap.empty(),
  combine: dual(2, combineNumericMaps),
};

/**
 * Token set-union monoid (collect unique tokens; useful for vocabulary).
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 * import * as NLPMonoid from "@beep/nlp/Algebra/NLPMonoid"
 * import * as HashSet from "effect/HashSet"
 *
 * const vocabulary = Monoid.fold(NLPMonoid.TokenSetUnion)([
 *   HashSet.make("effect", "schema"),
 *   HashSet.make("schema", "docs")
 * ])
 *
 * console.log(Array.from(vocabulary).sort())
 * // ["docs", "effect", "schema"]
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const TokenSetUnion: Monoid.Monoid<TokenHashSet> = Monoid.SetUnion<string>();

// =============================================================================
// Sentence Monoids
// =============================================================================

/**
 * Sentence concatenation "near-monoid".
 *
 * Combines sentences with a space and ensures the left sentence ends with
 * terminal punctuation. NOTE: this satisfies the identity laws but NOT strict
 * associativity (punctuation normalization is not associative), so it is a
 * pragmatic near-monoid for text joining.
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 * import * as NLPMonoid from "@beep/nlp/Algebra/NLPMonoid"
 *
 * const paragraph = Monoid.fold(NLPMonoid.SentenceConcat)(["Effect parses text", "Schemas validate output"])
 *
 * console.log(paragraph)
 * // "Effect parses text. Schemas validate output"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const SentenceConcat: Monoid.Monoid<string> = {
  empty: "",
  combine: dual(2, (s1, s2) => {
    if (s1 === "") return s2;
    if (s2 === "") return s1;
    const s1Normalized = /[.!?]$/.test(s1) ? s1 : `${s1}.`;
    return `${s1Normalized} ${s2}`;
  }),
};

/**
 * Sentence array monoid (concatenation; preserves order and boundaries).
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 * import * as NLPMonoid from "@beep/nlp/Algebra/NLPMonoid"
 *
 * const sentences = Monoid.fold(NLPMonoid.SentenceArray)([
 *   ["First sentence."],
 *   ["Second sentence.", "Third sentence."]
 * ])
 *
 * console.log(sentences)
 * // ["First sentence.", "Second sentence.", "Third sentence."]
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const SentenceArray: Monoid.Monoid<ReadonlyArray<string>> = Monoid.ArrayConcat<string>();

// =============================================================================
// Document Monoids
// =============================================================================

/**
 * Document text monoid (join paragraphs with a blank line).
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 * import * as NLPMonoid from "@beep/nlp/Algebra/NLPMonoid"
 *
 * const document = Monoid.fold(NLPMonoid.DocumentText)(["Intro paragraph.", "Details paragraph."])
 *
 * console.log(document)
 * // "Intro paragraph.\n\nDetails paragraph."
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const DocumentText: Monoid.Monoid<string> = Monoid.StringJoin("\n\n");

/**
 * Document statistics carrier.
 *
 * @example
 * ```ts
 * import type * as NLPMonoid from "@beep/nlp/Algebra/NLPMonoid"
 *
 * const stats: NLPMonoid.DocumentStatistics = {
 *   charCount: 42,
 *   sentenceCount: 2,
 *   wordCount: 7
 * }
 *
 * console.log(stats.wordCount)
 * // 7
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class DocumentStatistics extends S.Class<DocumentStatistics>($I`DocumentStatistics`)(
  {
    charCount: NonNegativeCount,
    sentenceCount: NonNegativeCount,
    wordCount: NonNegativeCount,
  },
  $I.annote("DocumentStatistics", {
    description: "Document statistics carrier.",
  })
) {}

/**
 * Document statistics monoid (sum counts component-wise).
 *
 * @example
 * ```ts
 * import * as NLPMonoid from "@beep/nlp/Algebra/NLPMonoid"
 *
 * const totals = NLPMonoid.DocumentStats.combine(
 *   { charCount: 12, sentenceCount: 1, wordCount: 3 },
 *   { charCount: 18, sentenceCount: 2, wordCount: 4 }
 * )
 *
 * console.log(totals)
 * // { wordCount: 7, sentenceCount: 3, charCount: 30 }
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const DocumentStats: Monoid.Monoid<DocumentStatistics> = {
  empty: { wordCount: 0, sentenceCount: 0, charCount: 0 },
  combine: dual(2, (s1, s2) => ({
    wordCount: s1.wordCount + s2.wordCount,
    sentenceCount: s1.sentenceCount + s2.sentenceCount,
    charCount: s1.charCount + s2.charCount,
  })),
};

// =============================================================================
// Linguistic Feature Monoids
// =============================================================================

/**
 * Linguistic annotation monoid (left-biased map merge).
 *
 * On key conflict the first (left) value wins. Useful for combining POS tags,
 * NER labels, dependency parses, etc. keyed by position.
 *
 * @example
 * ```ts
 * import * as MutableHashMap from "effect/MutableHashMap"
 * import * as NLPMonoid from "@beep/nlp/Algebra/NLPMonoid"
 *
 * const Tags = NLPMonoid.AnnotationMap<number, string>()
 * const tags = Tags.combine(MutableHashMap.make([0, "NOUN"]), MutableHashMap.make([0, "PROPN"], [1, "VERB"]))
 *
 * console.log(Array.from(tags))
 * // [[0, "NOUN"], [1, "VERB"]]
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const AnnotationMap = <K, V>(): Monoid.Monoid<MutableHashMap.MutableHashMap<K, V>> => ({
  empty: MutableHashMap.empty(),
  combine: dual(2, (m1, m2) => {
    const result = MutableHashMap.fromIterable(m1);
    MutableHashMap.forEach(m2, (value: V, key: K) => {
      if (!MutableHashMap.has(result, key)) {
        MutableHashMap.set(result, key, value);
      }
    });
    return result;
  }),
});

/**
 * Named entity carrier.
 *
 * @example
 * ```ts
 * import type * as NLPMonoid from "@beep/nlp/Algebra/NLPMonoid"
 *
 * const entity: NLPMonoid.NamedEntity = {
 *   endPos: 13,
 *   startPos: 0,
 *   text: "Effect Schema",
 *   type: "PRODUCT"
 * }
 *
 * console.log(entity.type)
 * // "PRODUCT"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class NamedEntity extends S.Class<NamedEntity>($I`NamedEntity`)(
  {
    endPos: S.Finite,
    startPos: S.Finite,
    text: S.String,
    type: S.String,
  },
  $I.annote("NamedEntity", {
    description: "Named entity carrier.",
  })
) {}

/**
 * Named entity list monoid (concatenation; preserves order, allows duplicates).
 *
 * @example
 * ```ts
 * import * as NLPMonoid from "@beep/nlp/Algebra/NLPMonoid"
 *
 * const entities = NLPMonoid.NamedEntityList.combine(
 *   [{ endPos: 6, startPos: 0, text: "Effect", type: "LIBRARY" }],
 *   [{ endPos: 19, startPos: 7, text: "Schema", type: "MODULE" }]
 * )
 *
 * console.log(entities.map((entity) => entity.text))
 * // ["Effect", "Schema"]
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const NamedEntityList: Monoid.Monoid<ReadonlyArray<NamedEntity>> = Monoid.ArrayConcat<NamedEntity>();

/**
 * Dependency parse edge carrier: a syntactic dependency (head, dependent, relation).
 *
 * @example
 * ```ts
 * import type * as NLPMonoid from "@beep/nlp/Algebra/NLPMonoid"
 *
 * const edge: NLPMonoid.DependencyEdge = {
 *   dependent: 2,
 *   head: 1,
 *   relation: "amod"
 * }
 *
 * console.log(edge.relation)
 * // "amod"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class DependencyEdge extends S.Class<DependencyEdge>($I`DependencyEdge`)(
  {
    dependent: NonNegativeCount,
    head: NonNegativeCount,
    relation: S.String,
  },
  $I.annote("DependencyEdge", {
    description: "Dependency parse edge carrier.",
  })
) {}

/**
 * Dependency parse monoid (concatenate edges).
 *
 * @example
 * ```ts
 * import * as NLPMonoid from "@beep/nlp/Algebra/NLPMonoid"
 *
 * const edges = NLPMonoid.DependencyParse.combine(
 *   [{ dependent: 1, head: 0, relation: "nsubj" }],
 *   [{ dependent: 2, head: 0, relation: "obj" }]
 * )
 *
 * console.log(edges.map((edge) => edge.relation))
 * // ["nsubj", "obj"]
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const DependencyParse: Monoid.Monoid<ReadonlyArray<DependencyEdge>> = Monoid.ArrayConcat<DependencyEdge>();

// =============================================================================
// Corpus Monoids (for large-scale text collections)
// =============================================================================

/**
 * Term frequency monoid (alias of {@link TokenBagOfWords}; semantic distinction).
 *
 * @example
 * ```ts
 * import * as MutableHashMap from "effect/MutableHashMap"
 * import * as NLPMonoid from "@beep/nlp/Algebra/NLPMonoid"
 *
 * const termCounts = NLPMonoid.TermFrequency.combine(
 *   MutableHashMap.make(["effect", 1]),
 *   MutableHashMap.make(["effect", 2], ["docs", 1])
 * )
 *
 * console.log(Array.from(termCounts))
 * // [["effect", 3], ["docs", 1]]
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const TermFrequency: Monoid.Monoid<BagOfWords> = TokenBagOfWords;

/**
 * Document frequency monoid (counts presence across documents; union with addition).
 *
 * @example
 * ```ts
 * import * as MutableHashMap from "effect/MutableHashMap"
 * import * as NLPMonoid from "@beep/nlp/Algebra/NLPMonoid"
 *
 * const frequencies = NLPMonoid.DocumentFrequency.combine(
 *   MutableHashMap.make(["effect", 2], ["schema", 1]),
 *   MutableHashMap.make(["effect", 1], ["nlp", 1])
 * )
 *
 * console.log(Array.from(frequencies))
 * // [["effect", 3], ["schema", 1], ["nlp", 1]]
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const DocumentFrequency: Monoid.Monoid<TermNumberMap> = {
  empty: MutableHashMap.empty(),
  combine: dual(2, combineNumericMaps),
};

/**
 * Vocabulary monoid (unique terms; alias of {@link TokenSetUnion}).
 *
 * @example
 * ```ts
 * import * as NLPMonoid from "@beep/nlp/Algebra/NLPMonoid"
 * import * as HashSet from "effect/HashSet"
 *
 * const vocabulary = NLPMonoid.Vocabulary.combine(
 *   HashSet.make("effect", "schema"),
 *   HashSet.make("schema", "nlp")
 * )
 *
 * console.log(Array.from(vocabulary).sort())
 * // ["effect", "nlp", "schema"]
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const Vocabulary: Monoid.Monoid<TokenHashSet> = TokenSetUnion;

// =============================================================================
// Specialized Aggregation Monoids
// =============================================================================

/**
 * Weighted token monoid (combine weights additively per token).
 *
 * @example
 * ```ts
 * import * as MutableHashMap from "effect/MutableHashMap"
 * import * as NLPMonoid from "@beep/nlp/Algebra/NLPMonoid"
 *
 * const weights = NLPMonoid.WeightedTokens.combine(
 *   MutableHashMap.make(["effect", 0.4], ["schema", 0.8]),
 *   MutableHashMap.make(["effect", 0.3])
 * )
 *
 * console.log(Array.from(weights))
 * // [["effect", 0.7], ["schema", 0.8]]
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const WeightedTokens: Monoid.Monoid<TermNumberMap> = {
  empty: MutableHashMap.empty(),
  combine: dual(2, combineNumericMaps),
};

/**
 * N-gram frequency monoid (bag-of-words over space-joined n-gram keys).
 *
 * @example
 * ```ts
 * import * as MutableHashMap from "effect/MutableHashMap"
 * import * as NLPMonoid from "@beep/nlp/Algebra/NLPMonoid"
 *
 * const ngrams = NLPMonoid.NGramFrequency.combine(
 *   MutableHashMap.make(["effect schema", 2]),
 *   MutableHashMap.make(["effect schema", 1], ["schema docs", 1])
 * )
 *
 * console.log(Array.from(ngrams))
 * // [["effect schema", 3], ["schema docs", 1]]
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const NGramFrequency: Monoid.Monoid<TermNumberMap> = {
  empty: MutableHashMap.empty(),
  combine: dual(2, combineNumericMaps),
};

// =============================================================================
// Composite Monoids for Multi-Feature Analysis
// =============================================================================

/**
 * Combined text analysis carrier (bag-of-words + entities + sentence count + vocabulary).
 *
 * @example
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import * as MutableHashMap from "effect/MutableHashMap"
 * import type * as NLPMonoid from "@beep/nlp/Algebra/NLPMonoid"
 *
 * const analysis: NLPMonoid.TextAnalysis = {
 *   bow: MutableHashMap.make(["effect", 2]),
 *   entities: [{ endPos: 6, startPos: 0, text: "Effect", type: "LIBRARY" }],
 *   sentenceCount: 1,
 *   vocabulary: HashSet.make("effect")
 * }
 *
 * console.log(analysis.sentenceCount)
 * // 1
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class TextAnalysis extends S.Class<TextAnalysis>($I`TextAnalysis`)(
  {
    bow: BagOfWords,
    entities: S.Array(NamedEntity),
    sentenceCount: NonNegativeCount,
    vocabulary: S.HashSet(S.String),
  },
  $I.annote("TextAnalysis", {
    description: "Combined text analysis carrier (bag-of-words + entities + sentence count + vocabulary).",
  })
) {}

/**
 * Text analysis monoid (product monoid over the linguistic features).
 *
 * @example
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import * as MutableHashMap from "effect/MutableHashMap"
 * import * as NLPMonoid from "@beep/nlp/Algebra/NLPMonoid"
 *
 * const combined = NLPMonoid.TextAnalysisMonoid.combine(
 *   {
 *     bow: MutableHashMap.make(["effect", 1]),
 *     entities: [{ endPos: 6, startPos: 0, text: "Effect", type: "LIBRARY" }],
 *     sentenceCount: 1,
 *     vocabulary: HashSet.make("effect")
 *   },
 *   {
 *     bow: MutableHashMap.make(["schema", 2]),
 *     entities: [],
 *     sentenceCount: 2,
 *     vocabulary: HashSet.make("schema")
 *   }
 * )
 *
 * console.log({
 *   bow: Array.from(combined.bow),
 *   sentenceCount: combined.sentenceCount,
 *   vocabulary: Array.from(combined.vocabulary).sort()
 * })
 * // { bow: [["effect", 1], ["schema", 2]], sentenceCount: 3, vocabulary: ["effect", "schema"] }
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const TextAnalysisMonoid: Monoid.Monoid<TextAnalysis> = {
  empty: {
    bow: MutableHashMap.empty(),
    entities: [],
    sentenceCount: 0,
    vocabulary: HashSet.empty(),
  },
  combine: dual(2, (a1, a2) => ({
    bow: TokenBagOfWords.combine(a1.bow, a2.bow),
    entities: NamedEntityList.combine(a1.entities, a2.entities),
    sentenceCount: a1.sentenceCount + a2.sentenceCount,
    vocabulary: TokenSetUnion.combine(a1.vocabulary, a2.vocabulary),
  })),
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert a bag of words to term frequency (each count normalized by the total).
 *
 * @example
 * ```ts
 * import * as MutableHashMap from "effect/MutableHashMap"
 * import * as NLPMonoid from "@beep/nlp/Algebra/NLPMonoid"
 *
 * const tf = NLPMonoid.bagOfWordsToTF(MutableHashMap.make(["effect", 3], ["schema", 1]))
 *
 * console.log(Array.from(tf))
 * // [["effect", 0.75], ["schema", 0.25]]
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const bagOfWordsToTF = (bow: BagOfWords): TermNumberMap => {
  let total = 0;
  MutableHashMap.forEach(bow, (count) => {
    total += count;
  });
  if (total === 0) return MutableHashMap.empty();

  const tf = MutableHashMap.empty<string, number>();
  MutableHashMap.forEach(bow, (count, term) => {
    MutableHashMap.set(tf, term, count / total);
  });
  return tf;
};

/**
 * Compute TF-IDF scores from term frequency and document frequency.
 *
 * `TF-IDF(t, d) = TF(t, d) * log(N / DF(t))`.
 *
 * @example
 * ```ts
 * import * as MutableHashMap from "effect/MutableHashMap"
 * import * as NLPMonoid from "@beep/nlp/Algebra/NLPMonoid"
 *
 * const scores = NLPMonoid.computeTFIDF(
 *   MutableHashMap.make(["effect", 0.5], ["schema", 0.5]),
 *   MutableHashMap.make(["effect", 2], ["schema", 1]),
 *   4
 * )
 *
 * console.log(Array.from(scores))
 * // [["effect", 0.34657359027997264], ["schema", 0.6931471805599453]]
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const computeTFIDF = (tf: TermNumberMap, df: TermNumberMap, totalDocs: number): TermNumberMap => {
  const tfidf = MutableHashMap.empty<string, number>();
  MutableHashMap.forEach(tf, (tfScore, term) => {
    const docFreq = O.getOrElse(MutableHashMap.get(df, term), () => 1);
    const idf = Math.log(totalDocs / docFreq);
    MutableHashMap.set(tfidf, term, tfScore * idf);
  });
  return tfidf;
};

// =============================================================================
// Convenience aggregators
// =============================================================================

/**
 * Aggregate tokens into a bag of words.
 *
 * @example
 * ```ts
 * import * as NLPMonoid from "@beep/nlp/Algebra/NLPMonoid"
 *
 * const counts = NLPMonoid.aggregateTokens(["effect", "schema", "effect"])
 *
 * console.log(Array.from(counts))
 * // [["effect", 2], ["schema", 1]]
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const aggregateTokens = (tokens: ReadonlyArray<string>): BagOfWords =>
  Monoid.fold(TokenBagOfWords)(tokens.map((token) => MutableHashMap.make([token, 1])));

/**
 * Aggregate sentences into a single document string.
 *
 * @example
 * ```ts
 * import * as NLPMonoid from "@beep/nlp/Algebra/NLPMonoid"
 *
 * const text = NLPMonoid.aggregateSentences(["Effect parses text", "Schemas validate output"])
 *
 * console.log(text)
 * // "Effect parses text. Schemas validate output"
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const aggregateSentences = (sentences: ReadonlyArray<string>): string => Monoid.fold(SentenceConcat)(sentences);

/**
 * Aggregate document statistics.
 *
 * @example
 * ```ts
 * import * as NLPMonoid from "@beep/nlp/Algebra/NLPMonoid"
 *
 * const totals = NLPMonoid.aggregateStats([
 *   { charCount: 10, sentenceCount: 1, wordCount: 2 },
 *   { charCount: 25, sentenceCount: 2, wordCount: 5 }
 * ])
 *
 * console.log(totals)
 * // { wordCount: 7, sentenceCount: 3, charCount: 35 }
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const aggregateStats = (stats: ReadonlyArray<DocumentStatistics>): DocumentStatistics =>
  Monoid.fold(DocumentStats)(stats);
