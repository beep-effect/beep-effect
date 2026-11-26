/**
 * AI-facing output models for NLP tools.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Position } from "@beep/text/OffsetUnit";
import * as S from "effect/Schema";
import { BM25Norm } from "../Core/Vectorization.ts";

const $I = $NlpProcessingId.create("Tools/_schemas");

const describe = <Schema extends S.Top>(schema: Schema, description: string, extras: Record<string, unknown> = {}) =>
  schema.annotateKey({
    description,
    ...extras,
  });

const AiEntitySourceKit = LiteralKit(["builtin", "custom"]).pipe(
  $I.annoteSchema("AiEntitySourceKit", {
    description: "LiteralKit backing schema for AI entity source values.",
  })
);
/**
 * **Example** (Validating soundex membership)
 *
 * ```ts import.meta.vitest name="Validating soundex membership"
 * import { AiPhoneticAlgorithmKit } from "@beep/nlp-processing/Tools/_schemas"
 *
 * AiPhoneticAlgorithmKit.is.soundex("soundex") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AiPhoneticAlgorithmKit = LiteralKit(["soundex", "phonetize"]).pipe(
  $I.annoteSchema("AiPhoneticAlgorithmKit", {
    description: "LiteralKit backing schema for AI phonetic algorithm values.",
  })
);

/**
 * **Example** (Typing a phonetic algorithm)
 *
 * ```ts
 * import type { AiPhoneticAlgorithmKit } from "@beep/nlp-processing/Tools/_schemas"
 *
 * const algorithm: AiPhoneticAlgorithmKit = "soundex"
 * console.log(algorithm)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type AiPhoneticAlgorithmKit = typeof AiPhoneticAlgorithmKit.Type;

const AiEntitySource = AiEntitySourceKit.pipe(
  $I.annoteSchema("AiEntitySource", {
    description: "Source used to extract a named entity.",
  }),
  SchemaUtils.withLiteralKitStatics(AiEntitySourceKit)
);

/**
 * **Example** (Validating phonetize membership)
 *
 * ```ts import.meta.vitest name="Validating phonetize membership"
 * import { AiPhoneticAlgorithm } from "@beep/nlp-processing/Tools/_schemas"
 *
 * AiPhoneticAlgorithm.is.phonetize("phonetize") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AiPhoneticAlgorithm = AiPhoneticAlgorithmKit.pipe(
  $I.annoteSchema("AiPhoneticAlgorithm", {
    description: "Phonetic encoding algorithm used to compare text.",
  }),
  SchemaUtils.withLiteralKitStatics(AiPhoneticAlgorithmKit)
);

/**
 * Output schema for one token emitted by tokenization-oriented tools.
 *
 * **Details**
 *
 * The model keeps both linguistic annotations and source offsets so callers can
 * map normalized NLP data back to the original text.
 *
 * **Example** (Decoding an annotated token)
 *
 * ```ts import.meta.vitest name="Decoding an annotated token"
 * import * as S from "effect/Schema"
 * import { AiToken } from "@beep/nlp-processing/Tools/_schemas"
 *
 * const token = S.decodeUnknownSync(AiToken)({
 *   isPunctuation: false,
 *   isStopWord: false,
 *   lemma: "quick",
 *   pos: "ADJ",
 *   span: { _tag: "Position", unit: "utf16-code-unit", start: 1, end: 5 },
 *   stem: "quick",
 *   text: "quick"
 * })
 *
 * token.lemma
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export class AiToken extends S.Opaque<AiToken, { readonly brand: unique symbol }>()(
  S.Struct({
    isPunctuation: describe(S.Boolean, "Whether the token represents punctuation."),
    isStopWord: describe(S.Boolean, "Whether the token is a common stop word."),
    lemma: describe(S.String, "Base or dictionary form of the token."),
    pos: describe(S.String, "Part-of-speech tag such as NOUN, VERB, or ADJ.", {
      examples: ["NOUN", "VERB", "ADJ", "DET", "ADP"],
    }),
    span: describe(Position, "UTF-16 code-unit span of the token in the source text."),
    stem: describe(S.String, "Stemmed form of the token."),
    text: describe(S.String, "The token text as it appears in the source input."),
  }).pipe(
    $I.annoteSchema("AiToken", {
      description: "A linguistic token with POS, lemma, stemming, and a UTF-16 source span.",
    })
  )
) {}

/**
 * **Details**
 *
 * The model bundles document-level counts, detected sentence texts, and the
 * full annotated token stream so a single tool call can return the data that
 * tokenization, sentence, and statistics tools would otherwise produce.
 *
 * **Example** (Decoding composite analysis)
 *
 * ```ts import.meta.vitest name="Decoding composite analysis"
 * import * as S from "effect/Schema"
 * import { AiAnalysis } from "@beep/nlp-processing/Tools/_schemas"
 *
 * const analysis = S.decodeUnknownSync(AiAnalysis)({
 *   characterCount: 12,
 *   sentenceCount: 1,
 *   sentences: ["Hello world."],
 *   tokenCount: 3,
 *   tokens: [
 *     {
 *       isPunctuation: false,
 *       isStopWord: false,
 *       lemma: "hello",
 *       pos: "INTJ",
 *       span: { _tag: "Position", unit: "utf16-code-unit", start: 0, end: 5 },
 *       stem: "hello",
 *       text: "Hello"
 *     }
 *   ],
 *   wordCount: 2
 * })
 *
 * analysis.tokenCount
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export class AiAnalysis extends S.Opaque<AiAnalysis, { readonly brand: unique symbol }>()(
  S.Struct({
    characterCount: describe(S.Natural, "Character count of the analyzed text."),
    sentenceCount: describe(S.Natural, "Number of detected sentences."),
    sentences: describe(S.Array(S.String), "Detected sentence texts in document order."),
    tokenCount: describe(S.Natural, "Number of tokens including punctuation."),
    tokens: describe(S.Array(AiToken), "Annotated tokens with POS, lemma, stem, and UTF-16 source spans."),
    wordCount: describe(S.Natural, "Approximate count of word-like tokens excluding punctuation."),
  }).pipe(
    $I.annoteSchema("AiAnalysis", {
      description: "Composite linguistic analysis of a text: counts, sentences, and annotated tokens.",
    })
  )
) {}

/**
 * Output schema for a detected sentence with source offsets and token count.
 *
 * **Details**
 *
 * Use this model when an NLP result needs sentence text plus enough metadata to
 * preserve ordering and trace each sentence back to the source document.
 *
 * **Example** (Decoding a sentence)
 *
 * ```ts import.meta.vitest name="Decoding a sentence"
 * import * as S from "effect/Schema"
 * import { AiSentence } from "@beep/nlp-processing/Tools/_schemas"
 *
 * const sentence = S.decodeUnknownSync(AiSentence)({
 *   index: 0,
 *   span: { _tag: "Position", unit: "utf16-code-unit", start: 0, end: 12 },
 *   text: "Hello world.",
 *   tokenCount: 3
 * })
 *
 * sentence.index
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export class AiSentence extends S.Opaque<AiSentence, { readonly brand: unique symbol }>()(
  S.Struct({
    index: describe(S.Natural, "Zero-based sentence index in the document."),
    span: describe(Position, "UTF-16 code-unit span of the sentence in the source text."),
    text: describe(S.String, "The sentence text."),
    tokenCount: describe(S.Natural, "Number of tokens contained in the sentence."),
  }).pipe(
    $I.annoteSchema("AiSentence", {
      description: "A sentence with token count and a UTF-16 source span.",
    })
  )
) {}

/**
 * Output schema for a keyword candidate and its importance score.
 *
 * **Details**
 *
 * Higher scores represent stronger keyword relevance within the extraction
 * result returned by `ExtractKeywords`.
 *
 * **Example** (Decoding a keyword score)
 *
 * ```ts import.meta.vitest name="Decoding a keyword score"
 * import * as S from "effect/Schema"
 * import { AiKeyword } from "@beep/nlp-processing/Tools/_schemas"
 *
 * const keyword = S.decodeUnknownSync(AiKeyword)({
 *   score: 0.87,
 *   term: "structured concurrency"
 * })
 *
 * keyword.score
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export class AiKeyword extends S.Opaque<AiKeyword, { readonly brand: unique symbol }>()(
  S.Struct({
    score: describe(S.Finite, "Keyword importance score."),
    term: describe(S.String, "The extracted keyword term."),
  }).pipe(
    $I.annoteSchema("AiKeyword", {
      description: "A keyword term paired with its ranking score.",
    })
  )
) {}

/**
 * **Details**
 *
 * The counts are intended for routing and sizing decisions, such as deciding
 * whether a text should be chunked before retrieval or summarization.
 *
 * **Example** (Decoding document statistics)
 *
 * ```ts import.meta.vitest name="Decoding document statistics"
 * import * as S from "effect/Schema"
 * import { AiDocumentStats } from "@beep/nlp-processing/Tools/_schemas"
 *
 * const stats = S.decodeUnknownSync(AiDocumentStats)({
 *   avgSentenceLength: 4,
 *   charCount: 31,
 *   sentenceCount: 2,
 *   wordCount: 8
 * })
 *
 * stats.wordCount
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export class AiDocumentStats extends S.Opaque<AiDocumentStats, { readonly brand: unique symbol }>()(
  S.Struct({
    avgSentenceLength: describe(S.Finite, "Average number of word-like tokens per sentence."),
    charCount: describe(S.Natural, "Character count of the input text."),
    sentenceCount: describe(S.Natural, "Number of detected sentences."),
    wordCount: describe(S.Natural, "Approximate count of word-like tokens excluding punctuation."),
  }).pipe(
    $I.annoteSchema("AiDocumentStats", {
      description: "High-level statistics describing a text document.",
    })
  )
) {}

/**
 * **Details**
 *
 * Chunk boundaries are expressed in sentence indexes so callers can preserve
 * document order and avoid slicing through a sentence.
 *
 * **Example** (Decoding a sentence chunk)
 *
 * ```ts import.meta.vitest name="Decoding a sentence chunk"
 * import * as S from "effect/Schema"
 * import { AiSentenceChunk } from "@beep/nlp-processing/Tools/_schemas"
 *
 * const chunk = S.decodeUnknownSync(AiSentenceChunk)({
 *   charCount: 28,
 *   endSentenceIndex: 1,
 *   sentenceCount: 2,
 *   startSentenceIndex: 0,
 *   text: "First sentence. Second one."
 * })
 *
 * chunk.sentenceCount
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export class AiSentenceChunk extends S.Opaque<AiSentenceChunk, { readonly brand: unique symbol }>()(
  S.Struct({
    charCount: describe(S.Natural, "Character count of the chunk."),
    endSentenceIndex: describe(S.Natural, "Inclusive sentence index where the chunk ends."),
    sentenceCount: describe(S.Natural, "Number of sentences in the chunk."),
    startSentenceIndex: describe(S.Natural, "Inclusive sentence index where the chunk starts."),
    text: describe(S.String, "Chunk text built from one or more complete sentences."),
  }).pipe(
    $I.annoteSchema("AiSentenceChunk", {
      description: "A sentence-aligned chunk of text with boundary metadata.",
    })
  )
) {}

/**
 * Output schema for one ranked text candidate.
 *
 * **Details**
 *
 * The `index` points back to the caller-provided candidate array and `score`
 * ranks the candidate relative to the query.
 *
 * **Example** (Decoding ranked text)
 *
 * ```ts import.meta.vitest name="Decoding ranked text"
 * import * as S from "effect/Schema"
 * import { AiRankedText } from "@beep/nlp-processing/Tools/_schemas"
 *
 * const ranked = S.decodeUnknownSync(AiRankedText)({
 *   index: 1,
 *   score: 0.92
 * })
 *
 * ranked.index
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export class AiRankedText extends S.Opaque<AiRankedText, { readonly brand: unique symbol }>()(
  S.Struct({
    index: describe(S.Natural, "Index of the original input text in the candidate array."),
    score: describe(S.Finite, "Relevance score where higher means more relevant."),
  }).pipe(
    $I.annoteSchema("AiRankedText", {
      description: "A ranked candidate entry for query-to-text relevance scoring.",
    })
  )
) {}

/**
 * Output schema for an extracted named entity.
 *
 * **Details**
 *
 * The model carries entity text, type labels, token boundaries, a UTF-16
 * source span, and whether the match came from built-in or custom entity logic.
 *
 * **Example** (Decoding a named entity)
 *
 * ```ts import.meta.vitest name="Decoding a named entity"
 * import * as S from "effect/Schema"
 * import { AiEntity } from "@beep/nlp-processing/Tools/_schemas"
 *
 * const entity = S.decodeUnknownSync(AiEntity)({
 *   endTokenIndex: 2,
 *   source: "builtin",
 *   span: { _tag: "Position", unit: "utf16-code-unit", start: 4, end: 20 },
 *   startTokenIndex: 1,
 *   type: "EMAIL",
 *   value: "john@example.com"
 * })
 *
 * entity.type
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export class AiEntity extends S.Opaque<AiEntity, { readonly brand: unique symbol }>()(
  S.Struct({
    endTokenIndex: describe(S.Natural, "Inclusive token index where the entity ends."),
    source: describe(S.optionalKey(AiEntitySource), "Whether the entity came from built-in or custom matching."),
    span: describe(Position, "UTF-16 code-unit span of the entity in the source text."),
    startTokenIndex: describe(S.Natural, "Inclusive token index where the entity begins."),
    type: describe(S.String, "Entity type label such as DATE, MONEY, EMAIL, or URL."),
    value: describe(S.String, "The extracted entity text."),
  }).pipe(
    $I.annoteSchema("AiEntity", {
      description: "A named entity with a source span, token boundaries, and extraction source.",
    })
  )
) {}

/**
 * Output schema for an extracted n-gram and its frequency count.
 *
 * **Details**
 *
 * Use this model for entries returned by the `NGrams` tool in bag, edge, or
 * set modes.
 *
 * **Example** (Decoding an n-gram)
 *
 * ```ts import.meta.vitest name="Decoding an n-gram"
 * import * as S from "effect/Schema"
 * import { AiNGram } from "@beep/nlp-processing/Tools/_schemas"
 *
 * const ngram = S.decodeUnknownSync(AiNGram)({
 *   count: 2,
 *   value: "ref"
 * })
 *
 * ngram.value
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export class AiNGram extends S.Opaque<AiNGram, { readonly brand: unique symbol }>()(
  S.Struct({
    count: describe(S.Natural, "Number of occurrences for the n-gram."),
    value: describe(S.String, "The n-gram string value."),
  }).pipe(
    $I.annoteSchema("AiNGram", {
      description: "An n-gram value paired with its frequency count.",
    })
  )
) {}

/**
 * Output schema for phonetic overlap between two text inputs.
 *
 * **Details**
 *
 * The code arrays show which phonetic keys were generated for each side and
 * which keys contributed to the overlap score.
 *
 * **Example** (Decoding phonetic match)
 *
 * ```ts import.meta.vitest name="Decoding phonetic match"
 * import * as S from "effect/Schema"
 * import { AiPhoneticMatch } from "@beep/nlp-processing/Tools/_schemas"
 *
 * const match = S.decodeUnknownSync(AiPhoneticMatch)({
 *   algorithm: "soundex",
 *   leftCodes: ["S315"],
 *   rightCodes: ["S315"],
 *   score: 1,
 *   sharedCodes: ["S315"]
 * })
 *
 * match.sharedCodes
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export class AiPhoneticMatch extends S.Opaque<AiPhoneticMatch, { readonly brand: unique symbol }>()(
  S.Struct({
    algorithm: describe(AiPhoneticAlgorithm, "The phonetic encoding algorithm that was used."),
    leftCodes: describe(S.Array(S.String), "Sorted unique phonetic codes derived from the first text."),
    rightCodes: describe(S.Array(S.String), "Sorted unique phonetic codes derived from the second text."),
    score: describe(UnitInterval, "Jaccard overlap score over unique phonetic codes."),
    sharedCodes: describe(S.Array(S.String), "Sorted phonetic codes that appear in both texts."),
  }).pipe(
    $I.annoteSchema("AiPhoneticMatch", {
      description: "Phonetic overlap details for two texts.",
    })
  )
) {}

/**
 * Structured failure schema returned by AI-facing NLP tools.
 *
 * **Details**
 *
 * Tool implementations should fail with this model for expected operational
 * failures so AI clients can inspect the tool, operation, stable reason, and
 * retry hint without parsing logs or natural-language exception text.
 *
 * **Example** (Creating a tool error)
 *
 * ```ts
 * import { AiToolError } from "@beep/nlp-processing/Tools/_schemas"
 *
 * const failure = AiToolError.make({
 *   message: "Corpus not found",
 *   operation: "query",
 *   reason: "CorpusNotFound",
 *   retryable: false,
 *   toolName: "QueryCorpus"
 * })
 *
 * console.log(failure.retryable)
 * // false
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export class AiToolError extends S.Opaque<AiToolError, { readonly brand: unique symbol }>()(
  S.Struct({
    message: describe(S.String, "Human-readable failure message safe to return to an AI tool caller."),
    operation: describe(S.String, "Driver or tool operation that failed."),
    reason: describe(S.optionalKey(S.String), "Stable failure category or driver error tag."),
    retryable: describe(S.Boolean, "Whether retrying the same tool call may reasonably succeed."),
    toolName: describe(S.String, "Name of the AI tool that returned the failure."),
  }).pipe(
    $I.annoteSchema("AiToolError", {
      description: "Structured AI tool failure with stable routing fields and retry metadata.",
    })
  )
) {}

/**
 * **Details**
 *
 * The values reflect the configuration actually used by the corpus after
 * defaults and caller overrides are applied.
 *
 * **Example** (Decoding BM25 configuration)
 *
 * ```ts import.meta.vitest name="Decoding BM25 configuration"
 * import * as S from "effect/Schema"
 * import { AiCorpusConfig } from "@beep/nlp-processing/Tools/_schemas"
 *
 * const config = S.decodeUnknownSync(AiCorpusConfig)({
 *   b: 0.75,
 *   k: 1,
 *   k1: 1.2,
 *   norm: "none"
 * })
 *
 * config.k1
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export class AiCorpusConfig extends S.Opaque<AiCorpusConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    b: describe(S.Finite, "BM25 document length normalization parameter."),
    k: describe(S.Finite, "BM25 inverse-document-frequency saturation parameter."),
    k1: describe(S.Finite, "BM25 term-frequency saturation parameter."),
    norm: describe(BM25Norm, "Vector normalization mode applied by the BM25 corpus."),
  }).pipe(
    $I.annoteSchema("AiCorpusConfig", {
      description: "Resolved BM25 configuration values for a managed corpus.",
    })
  )
) {}

/**
 * **Details**
 *
 * Returned by corpus creation and useful for confirming the stable corpus id,
 * resolved BM25 config, current document count, and vocabulary size.
 *
 * **Example** (Decoding corpus summary)
 *
 * ```ts import.meta.vitest name="Decoding corpus summary"
 * import * as S from "effect/Schema"
 * import { AiCorpusSummary } from "@beep/nlp-processing/Tools/_schemas"
 *
 * const summary = S.decodeUnknownSync(AiCorpusSummary)({
 *   config: { b: 0.75, k: 1, k1: 1.2, norm: "l2" },
 *   corpusId: "support-docs",
 *   createdAtMs: 1_783_000_000_000,
 *   documentCount: 12,
 *   vocabularySize: 480
 * })
 *
 * summary.corpusId
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export class AiCorpusSummary extends S.Opaque<AiCorpusSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    config: AiCorpusConfig,
    corpusId: describe(S.String, "Stable corpus identifier."),
    createdAtMs: describe(S.Finite, "Unix epoch timestamp in milliseconds when the corpus was created."),
    documentCount: describe(S.Natural, "Number of learned documents currently in the corpus."),
    vocabularySize: describe(S.Natural, "Number of unique normalized terms across the corpus."),
  }).pipe(
    $I.annoteSchema("AiCorpusSummary", {
      description: "Summary information describing a managed BM25 corpus session.",
    })
  )
) {}

/**
 * Output schema for one ranked document returned from a corpus query.
 *
 * **Details**
 *
 * The optional `text` field is present only when the query requested source
 * text inclusion.
 *
 * **Example** (Decoding ranked document)
 *
 * ```ts import.meta.vitest name="Decoding ranked document"
 * import * as S from "effect/Schema"
 * import { AiCorpusRankedDocument } from "@beep/nlp-processing/Tools/_schemas"
 *
 * const document = S.decodeUnknownSync(AiCorpusRankedDocument)({
 *   id: "refunds",
 *   index: 0,
 *   score: 0.94,
 *   text: "Refund policy details."
 * })
 *
 * document.score
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export class AiCorpusRankedDocument extends S.Opaque<AiCorpusRankedDocument, { readonly brand: unique symbol }>()(
  S.Struct({
    id: describe(S.String, "Document identifier."),
    index: describe(S.Natural, "Zero-based index of the learned document inside the corpus."),
    score: describe(S.Finite, "Similarity score assigned to the document."),
    text: describe(S.optionalKey(S.String), "Source document text when the caller requested text inclusion."),
  }).pipe(
    $I.annoteSchema("AiCorpusRankedDocument", {
      description: "A ranked document returned from a corpus query.",
    })
  )
) {}

/**
 * **Details**
 *
 * IDF entries help explain why specific terms influence retrieval scores.
 *
 * **Example** (Decoding an IDF entry)
 *
 * ```ts import.meta.vitest name="Decoding an IDF entry"
 * import * as S from "effect/Schema"
 * import { AiCorpusIdf } from "@beep/nlp-processing/Tools/_schemas"
 *
 * const idf = S.decodeUnknownSync(AiCorpusIdf)({
 *   idf: 2.31,
 *   term: "refund"
 * })
 *
 * idf.term
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export class AiCorpusIdf extends S.Opaque<AiCorpusIdf, { readonly brand: unique symbol }>()(
  S.Struct({
    idf: describe(S.Finite, "Inverse document frequency value for the term."),
    term: describe(S.String, "Corpus term associated with the IDF value."),
  }).pipe(
    $I.annoteSchema("AiCorpusIdf", {
      description: "An inverse document frequency entry for a corpus term.",
    })
  )
) {}

/**
 * Output schema for the dimensions of an optional document-term matrix.
 *
 * **Details**
 *
 * Rows correspond to learned documents and columns correspond to vocabulary
 * terms in the matrix payload.
 *
 * **Example** (Decoding matrix dimensions)
 *
 * ```ts import.meta.vitest name="Decoding matrix dimensions"
 * import * as S from "effect/Schema"
 * import { AiCorpusMatrixShape } from "@beep/nlp-processing/Tools/_schemas"
 *
 * const shape = S.decodeUnknownSync(AiCorpusMatrixShape)({
 *   cols: 480,
 *   rows: 12
 * })
 *
 * shape.rows
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export class AiCorpusMatrixShape extends S.Opaque<AiCorpusMatrixShape, { readonly brand: unique symbol }>()(
  S.Struct({
    cols: describe(S.Natural, "Number of columns in the document-term matrix."),
    rows: describe(S.Natural, "Number of rows in the document-term matrix."),
  }).pipe(
    $I.annoteSchema("AiCorpusMatrixShape", {
      description: "Shape metadata for the optional document-term matrix.",
    })
  )
) {}

/**
 * Output schema for detailed corpus diagnostics and retrieval statistics.
 *
 * **Details**
 *
 * Use this model for corpus inspection responses that may include vocabulary,
 * IDF values, and the optional document-term matrix.
 *
 * **Example** (Decoding corpus statistics)
 *
 * ```ts import.meta.vitest name="Decoding corpus statistics"
 * import * as S from "effect/Schema"
 * import { AiCorpusStats } from "@beep/nlp-processing/Tools/_schemas"
 *
 * const stats = S.decodeUnknownSync(AiCorpusStats)({
 *   averageDocumentLength: 8.5,
 *   corpusId: "support-docs",
 *   documentTermMatrix: [[0.2, 0.8]],
 *   idfValues: [{ idf: 2.31, term: "refund" }],
 *   matrixShape: { cols: 2, rows: 1 },
 *   terms: ["refund", "policy"],
 *   totalDocuments: 1,
 *   vocabularySize: 2
 * })
 *
 * stats.terms
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export class AiCorpusStats extends S.Opaque<AiCorpusStats, { readonly brand: unique symbol }>()(
  S.Struct({
    averageDocumentLength: describe(S.Finite, "Average normalized token count per learned document."),
    corpusId: describe(S.String, "Stable corpus identifier."),
    documentTermMatrix: S.optionalKey(
      describe(S.Array(S.Finite).pipe(S.Array), "Optional document-term matrix, one row per learned document.")
    ),
    idfValues: S.optionalKey(describe(S.Array(AiCorpusIdf), "Optional IDF values sorted by descending score.")),
    matrixShape: S.optionalKey(AiCorpusMatrixShape),
    terms: describe(S.Array(S.String), "Learned corpus vocabulary terms in vector order."),
    totalDocuments: describe(S.Natural, "Number of learned documents currently in the corpus."),
    vocabularySize: describe(S.Natural, "Number of unique normalized terms across the corpus."),
  }).pipe(
    $I.annoteSchema("AiCorpusStats", {
      description: "Detailed statistics for a managed corpus session.",
    })
  )
) {}
