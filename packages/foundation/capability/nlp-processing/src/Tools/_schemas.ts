/**
 * AI-facing output models for NLP tools.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { BM25Norm } from "@beep/nlp/Core/Vectorization";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as S from "effect/Schema";

const $I = $NlpProcessingId.create("Tools/_schemas");

const describe = <Schema extends S.Top>(schema: Schema, description: string, extras: Record<string, unknown> = {}) =>
  schema.annotateKey({
    description,
    ...extras,
  });

const AiEntitySourceKit = LiteralKit(["builtin", "custom"]).annotate(
  $I.annote("AiEntitySourceKit", {
    description: "LiteralKit backing schema for AI entity source values.",
  })
);
/**
 * LiteralKit backing schema for AI phonetic algorithm values.
 *
 * @category schemas
 * @since 0.0.0
 */
export const AiPhoneticAlgorithmKit = LiteralKit(["soundex", "phonetize"]).annotate(
  $I.annote("AiPhoneticAlgorithmKit", {
    description: "LiteralKit backing schema for AI phonetic algorithm values.",
  })
);

const AiEntitySource = AiEntitySourceKit.pipe(
  $I.annoteSchema("AiEntitySource", {
    description: "Source used to extract a named entity.",
  }),
  SchemaUtils.withLiteralKitStatics(AiEntitySourceKit)
);

/**
 * Phonetic encoding algorithm used to compare text.
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
 * The model keeps both linguistic annotations and source offsets so callers can
 * map normalized NLP data back to the original text.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { AiToken } from "@beep/nlp-processing/Tools/_schemas"
 *
 * const token = S.decodeUnknownSync(AiToken)({
 *   end: 5,
 *   isPunctuation: false,
 *   isStopWord: false,
 *   lemma: "quick",
 *   pos: "ADJ",
 *   start: 1,
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
export class AiToken extends S.Class<AiToken>($I`AiToken`)(
  {
    end: describe(NonNegativeInt, "Character offset where the token ends in the source text."),
    isPunctuation: describe(S.Boolean, "Whether the token represents punctuation."),
    isStopWord: describe(S.Boolean, "Whether the token is a common stop word."),
    lemma: describe(S.String, "Base or dictionary form of the token."),
    pos: describe(S.String, "Part-of-speech tag such as NOUN, VERB, or ADJ.", {
      examples: ["NOUN", "VERB", "ADJ", "DET", "ADP"],
    }),
    start: describe(NonNegativeInt, "Character offset where the token begins in the source text."),
    stem: describe(S.String, "Stemmed form of the token."),
    text: describe(S.String, "The token text as it appears in the source input."),
  },
  $I.annote("AiToken", {
    description: "A linguistic token with POS, lemma, stemming, and character offsets.",
  })
) {}

/**
 * Output schema for a composite linguistic analysis of a text.
 *
 * The model bundles document-level counts, detected sentence texts, and the
 * full annotated token stream so a single tool call can return the data that
 * tokenization, sentence, and statistics tools would otherwise produce.
 *
 * @example
 * ```ts
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
 *       end: 5,
 *       isPunctuation: false,
 *       isStopWord: false,
 *       lemma: "hello",
 *       pos: "INTJ",
 *       start: 0,
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
export class AiAnalysis extends S.Class<AiAnalysis>($I`AiAnalysis`)(
  {
    characterCount: describe(NonNegativeInt, "Character count of the analyzed text."),
    sentenceCount: describe(NonNegativeInt, "Number of detected sentences."),
    sentences: describe(S.Array(S.String), "Detected sentence texts in document order."),
    tokenCount: describe(NonNegativeInt, "Number of tokens including punctuation."),
    tokens: describe(S.Array(AiToken), "Annotated tokens with POS, lemma, stem, and character offsets."),
    wordCount: describe(NonNegativeInt, "Approximate count of word-like tokens excluding punctuation."),
  },
  $I.annote("AiAnalysis", {
    description: "Composite linguistic analysis of a text: counts, sentences, and annotated tokens.",
  })
) {}

/**
 * Output schema for a detected sentence with source offsets and token count.
 *
 * Use this model when an NLP result needs sentence text plus enough metadata to
 * preserve ordering and trace each sentence back to the source document.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { AiSentence } from "@beep/nlp-processing/Tools/_schemas"
 *
 * const sentence = S.decodeUnknownSync(AiSentence)({
 *   end: 12,
 *   index: 0,
 *   start: 0,
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
export class AiSentence extends S.Class<AiSentence>($I`AiSentence`)(
  {
    end: describe(NonNegativeInt, "Character offset where the sentence ends."),
    index: describe(NonNegativeInt, "Zero-based sentence index in the document."),
    start: describe(NonNegativeInt, "Character offset where the sentence begins."),
    text: describe(S.String, "The sentence text."),
    tokenCount: describe(NonNegativeInt, "Number of tokens contained in the sentence."),
  },
  $I.annote("AiSentence", {
    description: "A sentence with token count and character positions.",
  })
) {}

/**
 * Output schema for a keyword candidate and its importance score.
 *
 * Higher scores represent stronger keyword relevance within the extraction
 * result returned by `ExtractKeywords`.
 *
 * @example
 * ```ts
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
export class AiKeyword extends S.Class<AiKeyword>($I`AiKeyword`)(
  {
    score: describe(S.Finite, "Keyword importance score."),
    term: describe(S.String, "The extracted keyword term."),
  },
  $I.annote("AiKeyword", {
    description: "A keyword term paired with its ranking score.",
  })
) {}

/**
 * Output schema for high-level document statistics.
 *
 * The counts are intended for routing and sizing decisions, such as deciding
 * whether a text should be chunked before retrieval or summarization.
 *
 * @example
 * ```ts
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
export class AiDocumentStats extends S.Class<AiDocumentStats>($I`AiDocumentStats`)(
  {
    avgSentenceLength: describe(S.Finite, "Average number of word-like tokens per sentence."),
    charCount: describe(NonNegativeInt, "Character count of the input text."),
    sentenceCount: describe(NonNegativeInt, "Number of detected sentences."),
    wordCount: describe(NonNegativeInt, "Approximate count of word-like tokens excluding punctuation."),
  },
  $I.annote("AiDocumentStats", {
    description: "High-level statistics describing a text document.",
  })
) {}

/**
 * Output schema for a sentence-aligned text chunk.
 *
 * Chunk boundaries are expressed in sentence indexes so callers can preserve
 * document order and avoid slicing through a sentence.
 *
 * @example
 * ```ts
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
export class AiSentenceChunk extends S.Class<AiSentenceChunk>($I`AiSentenceChunk`)(
  {
    charCount: describe(NonNegativeInt, "Character count of the chunk."),
    endSentenceIndex: describe(NonNegativeInt, "Inclusive sentence index where the chunk ends."),
    sentenceCount: describe(NonNegativeInt, "Number of sentences in the chunk."),
    startSentenceIndex: describe(NonNegativeInt, "Inclusive sentence index where the chunk starts."),
    text: describe(S.String, "Chunk text built from one or more complete sentences."),
  },
  $I.annote("AiSentenceChunk", {
    description: "A sentence-aligned chunk of text with boundary metadata.",
  })
) {}

/**
 * Output schema for one ranked text candidate.
 *
 * The `index` points back to the caller-provided candidate array and `score`
 * ranks the candidate relative to the query.
 *
 * @example
 * ```ts
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
export class AiRankedText extends S.Class<AiRankedText>($I`AiRankedText`)(
  {
    index: describe(NonNegativeInt, "Index of the original input text in the candidate array."),
    score: describe(S.Finite, "Relevance score where higher means more relevant."),
  },
  $I.annote("AiRankedText", {
    description: "A ranked candidate entry for query-to-text relevance scoring.",
  })
) {}

/**
 * Output schema for an extracted named entity.
 *
 * The model carries entity text, type labels, token boundaries, character
 * offsets, and whether the match came from built-in or custom entity logic.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { AiEntity } from "@beep/nlp-processing/Tools/_schemas"
 *
 * const entity = S.decodeUnknownSync(AiEntity)({
 *   end: 20,
 *   endTokenIndex: 2,
 *   source: "builtin",
 *   start: 4,
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
export class AiEntity extends S.Class<AiEntity>($I`AiEntity`)(
  {
    end: describe(NonNegativeInt, "Character offset where the entity ends."),
    endTokenIndex: describe(NonNegativeInt, "Inclusive token index where the entity ends."),
    source: describe(S.optionalKey(AiEntitySource), "Whether the entity came from built-in or custom matching."),
    start: describe(NonNegativeInt, "Character offset where the entity begins."),
    startTokenIndex: describe(NonNegativeInt, "Inclusive token index where the entity begins."),
    type: describe(S.String, "Entity type label such as DATE, MONEY, EMAIL, or URL."),
    value: describe(S.String, "The extracted entity text."),
  },
  $I.annote("AiEntity", {
    description: "A named entity with offsets, token boundaries, and extraction source.",
  })
) {}

/**
 * Output schema for an extracted n-gram and its frequency count.
 *
 * Use this model for entries returned by the `NGrams` tool in bag, edge, or
 * set modes.
 *
 * @example
 * ```ts
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
export class AiNGram extends S.Class<AiNGram>($I`AiNGram`)(
  {
    count: describe(NonNegativeInt, "Number of occurrences for the n-gram."),
    value: describe(S.String, "The n-gram string value."),
  },
  $I.annote("AiNGram", {
    description: "An n-gram value paired with its frequency count.",
  })
) {}

/**
 * Output schema for phonetic overlap between two text inputs.
 *
 * The code arrays show which phonetic keys were generated for each side and
 * which keys contributed to the overlap score.
 *
 * @example
 * ```ts
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
export class AiPhoneticMatch extends S.Class<AiPhoneticMatch>($I`AiPhoneticMatch`)(
  {
    algorithm: describe(AiPhoneticAlgorithm, "The phonetic encoding algorithm that was used."),
    leftCodes: describe(S.Array(S.String), "Sorted unique phonetic codes derived from the first text."),
    rightCodes: describe(S.Array(S.String), "Sorted unique phonetic codes derived from the second text."),
    score: describe(UnitInterval, "Jaccard overlap score over unique phonetic codes."),
    sharedCodes: describe(S.Array(S.String), "Sorted phonetic codes that appear in both texts."),
  },
  $I.annote("AiPhoneticMatch", {
    description: "Phonetic overlap details for two texts.",
  })
) {}

/**
 * Structured failure schema returned by AI-facing NLP tools.
 *
 * Tool implementations should fail with this model for expected operational
 * failures so AI clients can inspect the tool, operation, stable reason, and
 * retry hint without parsing logs or natural-language exception text.
 *
 * @example
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
export class AiToolError extends S.Class<AiToolError>($I`AiToolError`)(
  {
    message: describe(S.String, "Human-readable failure message safe to return to an AI tool caller."),
    operation: describe(S.String, "Driver or tool operation that failed."),
    reason: describe(S.optionalKey(S.String), "Stable failure category or driver error tag."),
    retryable: describe(S.Boolean, "Whether retrying the same tool call may reasonably succeed."),
    toolName: describe(S.String, "Name of the AI tool that returned the failure."),
  },
  $I.annote("AiToolError", {
    description: "Structured AI tool failure with stable routing fields and retry metadata.",
  })
) {}

/**
 * Output schema for the resolved BM25 configuration of a managed corpus.
 *
 * The values reflect the configuration actually used by the corpus after
 * defaults and caller overrides are applied.
 *
 * @example
 * ```ts
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
export class AiCorpusConfig extends S.Class<AiCorpusConfig>($I`AiCorpusConfig`)(
  {
    b: describe(S.Finite, "BM25 document length normalization parameter."),
    k: describe(S.Finite, "BM25 inverse-document-frequency saturation parameter."),
    k1: describe(S.Finite, "BM25 term-frequency saturation parameter."),
    norm: describe(BM25Norm, "Vector normalization mode applied by the BM25 corpus."),
  },
  $I.annote("AiCorpusConfig", {
    description: "Resolved BM25 configuration values for a managed corpus.",
  })
) {}

/**
 * Output schema for a managed corpus session summary.
 *
 * Returned by corpus creation and useful for confirming the stable corpus id,
 * resolved BM25 config, current document count, and vocabulary size.
 *
 * @example
 * ```ts
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
export class AiCorpusSummary extends S.Class<AiCorpusSummary>($I`AiCorpusSummary`)(
  {
    config: AiCorpusConfig,
    corpusId: describe(S.String, "Stable corpus identifier."),
    createdAtMs: describe(S.Finite, "Unix epoch timestamp in milliseconds when the corpus was created."),
    documentCount: describe(NonNegativeInt, "Number of learned documents currently in the corpus."),
    vocabularySize: describe(NonNegativeInt, "Number of unique normalized terms across the corpus."),
  },
  $I.annote("AiCorpusSummary", {
    description: "Summary information describing a managed BM25 corpus session.",
  })
) {}

/**
 * Output schema for one ranked document returned from a corpus query.
 *
 * The optional `text` field is present only when the query requested source
 * text inclusion.
 *
 * @example
 * ```ts
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
export class AiCorpusRankedDocument extends S.Class<AiCorpusRankedDocument>($I`AiCorpusRankedDocument`)(
  {
    id: describe(S.String, "Document identifier."),
    index: describe(NonNegativeInt, "Zero-based index of the learned document inside the corpus."),
    score: describe(S.Finite, "Similarity score assigned to the document."),
    text: describe(S.optionalKey(S.String), "Source document text when the caller requested text inclusion."),
  },
  $I.annote("AiCorpusRankedDocument", {
    description: "A ranked document returned from a corpus query.",
  })
) {}

/**
 * Output schema for an inverse document frequency value in a corpus.
 *
 * IDF entries help explain why specific terms influence retrieval scores.
 *
 * @example
 * ```ts
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
export class AiCorpusIdf extends S.Class<AiCorpusIdf>($I`AiCorpusIdf`)(
  {
    idf: describe(S.Finite, "Inverse document frequency value for the term."),
    term: describe(S.String, "Corpus term associated with the IDF value."),
  },
  $I.annote("AiCorpusIdf", {
    description: "An inverse document frequency entry for a corpus term.",
  })
) {}

/**
 * Output schema for the dimensions of an optional document-term matrix.
 *
 * Rows correspond to learned documents and columns correspond to vocabulary
 * terms in the matrix payload.
 *
 * @example
 * ```ts
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
export class AiCorpusMatrixShape extends S.Class<AiCorpusMatrixShape>($I`AiCorpusMatrixShape`)(
  {
    cols: describe(NonNegativeInt, "Number of columns in the document-term matrix."),
    rows: describe(NonNegativeInt, "Number of rows in the document-term matrix."),
  },
  $I.annote("AiCorpusMatrixShape", {
    description: "Shape metadata for the optional document-term matrix.",
  })
) {}

/**
 * Output schema for detailed corpus diagnostics and retrieval statistics.
 *
 * Use this model for corpus inspection responses that may include vocabulary,
 * IDF values, and the optional document-term matrix.
 *
 * @example
 * ```ts
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
export class AiCorpusStats extends S.Class<AiCorpusStats>($I`AiCorpusStats`)(
  {
    averageDocumentLength: describe(S.Finite, "Average normalized token count per learned document."),
    corpusId: describe(S.String, "Stable corpus identifier."),
    documentTermMatrix: S.optionalKey(
      describe(S.Array(S.Finite).pipe(S.Array), "Optional document-term matrix, one row per learned document.")
    ),
    idfValues: S.optionalKey(describe(S.Array(AiCorpusIdf), "Optional IDF values sorted by descending score.")),
    matrixShape: S.optionalKey(AiCorpusMatrixShape),
    terms: describe(S.Array(S.String), "Learned corpus vocabulary terms in vector order."),
    totalDocuments: describe(NonNegativeInt, "Number of learned documents currently in the corpus."),
    vocabularySize: describe(NonNegativeInt, "Number of unique normalized terms across the corpus."),
  },
  $I.annote("AiCorpusStats", {
    description: "Detailed statistics for a managed corpus session.",
  })
) {}
