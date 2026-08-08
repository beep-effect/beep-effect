/**
 * NLP AI tools.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import {
  AiAnalysis as AiAnalysisSource,
  AiCorpusConfig as AiCorpusConfigSource,
  AiCorpusIdf as AiCorpusIdfSource,
  AiCorpusMatrixShape as AiCorpusMatrixShapeSource,
  AiCorpusRankedDocument as AiCorpusRankedDocumentSource,
  AiCorpusStats as AiCorpusStatsSource,
  AiCorpusSummary as AiCorpusSummarySource,
  AiDocumentStats as AiDocumentStatsSource,
  AiEntity as AiEntitySource,
  AiKeyword as AiKeywordSource,
  AiNGram as AiNGramSource,
  AiPhoneticMatch as AiPhoneticMatchSource,
  AiRankedText as AiRankedTextSource,
  AiSentenceChunk as AiSentenceChunkSource,
  AiSentence as AiSentenceSource,
  AiToken as AiTokenSource,
  AiToolError as AiToolErrorSource,
} from "./_schemas.ts";
import { Analyze as AnalyzeSource } from "./Analyze.ts";
import { BagOfWords as BagOfWordsSource } from "./BagOfWords.ts";
import { BowCosineSimilarity as BowCosineSimilaritySource } from "./BowCosineSimilarity.ts";
import { ChunkBySentences as ChunkBySentencesSource } from "./ChunkBySentences.ts";
import { CorpusStats as CorpusStatsSource } from "./CorpusStats.ts";
import { CreateCorpus as CreateCorpusSource } from "./CreateCorpus.ts";
import { DeleteCorpus as DeleteCorpusSource } from "./DeleteCorpus.ts";
import { DocumentStats as DocumentStatsSource } from "./DocumentStats.ts";
import { ExtractEntities as ExtractEntitiesSource } from "./ExtractEntities.ts";
import { ExtractKeywords as ExtractKeywordsSource } from "./ExtractKeywords.ts";
import { LearnCorpus as LearnCorpusSource } from "./LearnCorpus.ts";
import { LearnCustomEntities as LearnCustomEntitiesSource } from "./LearnCustomEntities.ts";
import { NGrams as NGramsSource } from "./NGrams.ts";
import { NlpToolkit as NlpToolkitSource, NlpTools as NlpToolsSource } from "./NlpToolkit.ts";
import { Paragraphize as ParagraphizeSource } from "./Paragraphize.ts";
import { PhoneticMatch as PhoneticMatchSource } from "./PhoneticMatch.ts";
import { QueryCorpus as QueryCorpusSource } from "./QueryCorpus.ts";
import { RankByRelevance as RankByRelevanceSource } from "./RankByRelevance.ts";
import { RemoveStopWords as RemoveStopWordsSource } from "./RemoveStopWords.ts";
import { Sentences as SentencesSource } from "./Sentences.ts";
import { Stem as StemSource } from "./Stem.ts";
import { TextSimilarity as TextSimilaritySource } from "./TextSimilarity.ts";
import { Tokenize as TokenizeSource } from "./Tokenize.ts";
import { exportTools as exportToolsSource } from "./ToolExport.ts";
import { TransformText as TransformTextSource } from "./TransformText.ts";
import { TverskySimilarity as TverskySimilaritySource } from "./TverskySimilarity.ts";
import { WordCount as WordCountSource } from "./WordCount.ts";

/**
 * Composite text-analysis result schema exported from the public tools barrel.
 *
 * **Example** (Decode composite analysis schema)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AiAnalysis } from "@beep/nlp-processing/Tools"
 *
 * const analysis = S.decodeUnknownSync(AiAnalysis)({
 *   characterCount: 12,
 *   sentenceCount: 1,
 *   sentences: ["Hello world."],
 *   tokenCount: 1,
 *   tokens: [],
 *   wordCount: 2
 * })
 *
 * analysis.wordCount
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export const AiAnalysis = AiAnalysisSource;
/**
 * Resolved BM25 corpus configuration schema.
 *
 * **Example** (Decode BM25 corpus config)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AiCorpusConfig } from "@beep/nlp-processing/Tools"
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
export const AiCorpusConfig = AiCorpusConfigSource;
/**
 * Inverse-document-frequency entry schema for corpus diagnostics.
 *
 * **Example** (Decode corpus IDF entry)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AiCorpusIdf } from "@beep/nlp-processing/Tools"
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
export const AiCorpusIdf = AiCorpusIdfSource;
/**
 * Document-term matrix dimension schema returned by corpus stats.
 *
 * **Example** (Decode matrix dimensions)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AiCorpusMatrixShape } from "@beep/nlp-processing/Tools"
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
export const AiCorpusMatrixShape = AiCorpusMatrixShapeSource;
/**
 * Ranked corpus document schema returned by query tools.
 *
 * **Example** (Decode ranked corpus document)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AiCorpusRankedDocument } from "@beep/nlp-processing/Tools"
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
export const AiCorpusRankedDocument = AiCorpusRankedDocumentSource;
/**
 * Detailed corpus diagnostic schema including vocabulary and optional matrix data.
 *
 * **Example** (Decode corpus diagnostic stats)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AiCorpusStats } from "@beep/nlp-processing/Tools"
 *
 * const stats = S.decodeUnknownSync(AiCorpusStats)({
 *   averageDocumentLength: 8.5,
 *   corpusId: "support-docs",
 *   idfValues: [{ idf: 2.31, term: "refund" }],
 *   terms: ["refund", "policy"],
 *   totalDocuments: 1,
 *   vocabularySize: 2
 * })
 *
 * stats.vocabularySize
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export const AiCorpusStats = AiCorpusStatsSource;
/**
 * Managed corpus summary schema returned when a corpus is created.
 *
 * **Example** (Decode managed corpus summary)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AiCorpusSummary } from "@beep/nlp-processing/Tools"
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
export const AiCorpusSummary = AiCorpusSummarySource;
/**
 * Document-level statistics schema for word, sentence, and character counts.
 *
 * **Example** (Decode document-level stats)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AiDocumentStats } from "@beep/nlp-processing/Tools"
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
export const AiDocumentStats = AiDocumentStatsSource;
/**
 * Named-entity result schema with offsets, token boundaries, and source labels.
 *
 * **Example** (Decode named entity result)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AiEntity } from "@beep/nlp-processing/Tools"
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
export const AiEntity = AiEntitySource;
/**
 * Ranked keyword schema used by keyword extraction results.
 *
 * **Example** (Decode ranked keyword)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AiKeyword } from "@beep/nlp-processing/Tools"
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
export const AiKeyword = AiKeywordSource;
/**
 * Frequency-counted n-gram schema shared by bag-of-words and n-gram tools.
 *
 * **Example** (Decode frequency n-gram)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AiNGram } from "@beep/nlp-processing/Tools"
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
export const AiNGram = AiNGramSource;
/**
 * Phonetic-overlap result schema for two compared texts.
 *
 * **Example** (Decode phonetic match result)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AiPhoneticMatch } from "@beep/nlp-processing/Tools"
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
export const AiPhoneticMatch = AiPhoneticMatchSource;
/**
 * Relevance-ranked candidate schema with source-array index and score.
 *
 * **Example** (Decode ranked text candidate)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AiRankedText } from "@beep/nlp-processing/Tools"
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
export const AiRankedText = AiRankedTextSource;
/**
 * Sentence result schema with text, offsets, order, and token count.
 *
 * **Example** (Decode sentence result)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AiSentence } from "@beep/nlp-processing/Tools"
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
export const AiSentence = AiSentenceSource;
/**
 * Sentence-aligned chunk schema for bounded text chunks.
 *
 * **Example** (Decode sentence-aligned chunk)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AiSentenceChunk } from "@beep/nlp-processing/Tools"
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
export const AiSentenceChunk = AiSentenceChunkSource;
/**
 * Structured operational failure schema returned by AI-facing NLP tools.
 *
 * **Example** (Construct operational tool error)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { AiToolError } from "@beep/nlp-processing/Tools"
 *
 * const failure = AiToolError.make({
 *   message: "Corpus not found",
 *   operation: "query",
 *   reason: "CorpusNotFound",
 *   retryable: false,
 *   toolName: "QueryCorpus"
 * })
 *
 * strictEqual(failure.retryable, false)
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export const AiToolError = AiToolErrorSource;
/**
 * Token schema carrying linguistic annotations and source offsets.
 *
 * **Example** (Decode annotated token)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AiToken } from "@beep/nlp-processing/Tools"
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
export const AiToken = AiTokenSource;
/**
 * Composite analysis tool contract exposed from the public tools barrel.
 *
 * **Example** (Decode Analyze parameters)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Analyze } from "@beep/nlp-processing/Tools"
 *
 * const parameters = S.decodeUnknownSync(Analyze.parametersSchema)({
 *   text: "The quick brown fox. It was fast."
 * })
 *
 * parameters.text
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const Analyze = AnalyzeSource;
/**
 * Bag-of-words term-frequency tool contract.
 *
 * **Example** (Decode BagOfWords parameters)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { BagOfWords } from "@beep/nlp-processing/Tools"
 *
 * const parameters = S.decodeUnknownSync(BagOfWords.parametersSchema)({
 *   text: "the cat sat on the mat"
 * })
 *
 * parameters.text
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const BagOfWords = BagOfWordsSource;
/**
 * Bag-of-words cosine similarity tool contract.
 *
 * **Example** (Decode cosine similarity parameters)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { BowCosineSimilarity } from "@beep/nlp-processing/Tools"
 *
 * const parameters = S.decodeUnknownSync(BowCosineSimilarity.parametersSchema)({
 *   text1: "shipping refund policy",
 *   text2: "refund and shipping rules"
 * })
 *
 * parameters.text2
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const BowCosineSimilarity = BowCosineSimilaritySource;
/**
 * Sentence-boundary chunking tool contract.
 *
 * **Example** (Decode sentence chunk parameters)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ChunkBySentences } from "@beep/nlp-processing/Tools"
 *
 * const parameters = S.decodeUnknownSync(ChunkBySentences.parametersSchema)({
 *   maxChunkChars: 1200,
 *   text: "First sentence. Second sentence. Third sentence."
 * })
 *
 * parameters.maxChunkChars
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const ChunkBySentences = ChunkBySentencesSource;
/**
 * Corpus diagnostics tool contract for vocabulary, IDF, and matrix inspection.
 *
 * **Example** (Decode corpus stats parameters)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CorpusStats } from "@beep/nlp-processing/Tools"
 *
 * const parameters = S.decodeUnknownSync(CorpusStats.parametersSchema)({
 *   corpusId: "support-docs",
 *   includeIdf: true,
 *   includeMatrix: false,
 *   topIdfTerms: 20
 * })
 *
 * parameters.includeIdf
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const CorpusStats = CorpusStatsSource;
/**
 * Corpus creation tool contract for starting a reusable BM25 session.
 *
 * **Example** (Decode create corpus parameters)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CreateCorpus } from "@beep/nlp-processing/Tools"
 *
 * const parameters = S.decodeUnknownSync(CreateCorpus.parametersSchema)({
 *   bm25Config: { b: 0.75, k: 1, k1: 1.2 },
 *   corpusId: "support-docs"
 * })
 *
 * parameters.corpusId
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const CreateCorpus: typeof CreateCorpusSource = CreateCorpusSource;
/**
 * Corpus deletion tool contract for releasing an in-memory corpus session.
 *
 * **Example** (Decode delete corpus parameters)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DeleteCorpus } from "@beep/nlp-processing/Tools"
 *
 * const parameters = S.decodeUnknownSync(DeleteCorpus.parametersSchema)({
 *   corpusId: "support-docs"
 * })
 *
 * parameters.corpusId
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const DeleteCorpus = DeleteCorpusSource;
/**
 * Document statistics tool contract for sizing and routing text.
 *
 * **Example** (Decode document stats parameters)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DocumentStats } from "@beep/nlp-processing/Tools"
 *
 * const parameters = S.decodeUnknownSync(DocumentStats.parametersSchema)({
 *   text: "One short sentence. Another follows."
 * })
 *
 * parameters.text
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const DocumentStats = DocumentStatsSource;
/**
 * Entity extraction tool contract for built-in and learned custom entities.
 *
 * **Example** (Decode entity extraction parameters)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ExtractEntities } from "@beep/nlp-processing/Tools"
 *
 * const parameters = S.decodeUnknownSync(ExtractEntities.parametersSchema)({
 *   includeCustom: true,
 *   text: "Email john@example.com before 2026-01-15."
 * })
 *
 * parameters.includeCustom
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const ExtractEntities = ExtractEntitiesSource;
/**
 * Keyword extraction tool contract for ranked topical terms.
 *
 * **Example** (Decode keyword extraction parameters)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ExtractKeywords } from "@beep/nlp-processing/Tools"
 *
 * const parameters = S.decodeUnknownSync(ExtractKeywords.parametersSchema)({
 *   text: "Effect provides typed errors and structured concurrency.",
 *   topN: 3
 * })
 *
 * parameters.topN
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const ExtractKeywords = ExtractKeywordsSource;
/**
 * Incremental corpus learning tool contract.
 *
 * **Example** (Decode learn corpus parameters)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { LearnCorpus } from "@beep/nlp-processing/Tools"
 *
 * const parameters = S.decodeUnknownSync(LearnCorpus.parametersSchema)({
 *   corpusId: "support-docs",
 *   dedupeById: true,
 *   documents: [{ id: "refunds", text: "Refund policy details." }]
 * })
 *
 * parameters.documents[0]?.text
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const LearnCorpus = LearnCorpusSource;
/**
 * Custom entity learning tool contract for bracket-token patterns.
 *
 * **Example** (Decode custom entity learning)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { LearnCustomEntities } from "@beep/nlp-processing/Tools"
 *
 * const parameters = S.decodeUnknownSync(LearnCustomEntities.parametersSchema)({
 *   entities: [{ name: "PRODUCT_CODE", patterns: ["[PROPN]", "[CARDINAL]"] }],
 *   groupName: "support-entities",
 *   mode: "append"
 * })
 *
 * parameters.entities[0]?.name
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const LearnCustomEntities = LearnCustomEntitiesSource;
/**
 * Character n-gram extraction tool contract.
 *
 * **Example** (Decode n-gram extraction parameters)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { NGrams } from "@beep/nlp-processing/Tools"
 *
 * const parameters = S.decodeUnknownSync(NGrams.parametersSchema)({
 *   mode: "bag",
 *   size: 3,
 *   text: "natural language processing",
 *   topN: 5
 * })
 *
 * parameters.size
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const NGrams = NGramsSource;
/**
 * Paragraph splitting tool contract.
 *
 * **Example** (Decode paragraphize parameters)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Paragraphize } from "@beep/nlp-processing/Tools"
 *
 * const parameters = S.decodeUnknownSync(Paragraphize.parametersSchema)({
 *   text: "First paragraph.\n\nSecond paragraph."
 * })
 *
 * parameters.text
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const Paragraphize = ParagraphizeSource;
/**
 * Phonetic matching tool contract for similar-sounding text comparison.
 *
 * **Example** (Decode phonetic match parameters)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { PhoneticMatch } from "@beep/nlp-processing/Tools"
 *
 * const parameters = S.decodeUnknownSync(PhoneticMatch.parametersSchema)({
 *   algorithm: "soundex",
 *   minTokenLength: 2,
 *   text1: "Stephen Hawking",
 *   text2: "Steven Hocking"
 * })
 *
 * parameters.algorithm
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const PhoneticMatch = PhoneticMatchSource;
/**
 * Learned-corpus query tool contract.
 *
 * **Example** (Decode query corpus parameters)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { QueryCorpus } from "@beep/nlp-processing/Tools"
 *
 * const parameters = S.decodeUnknownSync(QueryCorpus.parametersSchema)({
 *   corpusId: "support-docs",
 *   includeText: true,
 *   query: "refund policy",
 *   topN: 5
 * })
 *
 * parameters.query
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const QueryCorpus = QueryCorpusSource;
/**
 * One-shot text relevance ranking tool contract.
 *
 * **Example** (Decode relevance ranking parameters)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { RankByRelevance } from "@beep/nlp-processing/Tools"
 *
 * const parameters = S.decodeUnknownSync(RankByRelevance.parametersSchema)({
 *   query: "refund policy",
 *   texts: ["Shipping rules", "Refund policy details"],
 *   topN: 1
 * })
 *
 * parameters.query
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const RankByRelevance = RankByRelevanceSource;
/**
 * Stop-word removal tool contract.
 *
 * **Example** (Decode stop-word removal parameters)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { RemoveStopWords } from "@beep/nlp-processing/Tools"
 *
 * const parameters = S.decodeUnknownSync(RemoveStopWords.parametersSchema)({
 *   text: "the quick brown fox"
 * })
 *
 * parameters.text
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const RemoveStopWords = RemoveStopWordsSource;
/**
 * Sentence segmentation tool contract.
 *
 * **Example** (Decode sentence segmentation parameters)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Sentences } from "@beep/nlp-processing/Tools"
 *
 * const parameters = S.decodeUnknownSync(Sentences.parametersSchema)({
 *   text: "Hello world. How are you?"
 * })
 *
 * parameters.text
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const Sentences = SentencesSource;
/**
 * Word stemming tool contract.
 *
 * **Example** (Decode stemming parameters)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Stem } from "@beep/nlp-processing/Tools"
 *
 * const parameters = S.decodeUnknownSync(Stem.parametersSchema)({
 *   text: "running runners ran"
 * })
 *
 * parameters.text
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const Stem = StemSource;
/**
 * BM25-vector text similarity tool contract.
 *
 * **Example** (Decode text similarity parameters)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TextSimilarity } from "@beep/nlp-processing/Tools"
 *
 * const parameters = S.decodeUnknownSync(TextSimilarity.parametersSchema)({
 *   text1: "Cats are wonderful pets.",
 *   text2: "Felines make great companions."
 * })
 *
 * parameters.text1
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const TextSimilarity = TextSimilaritySource;
/**
 * Linguistic tokenization tool contract.
 *
 * **Example** (Decode tokenize parameters)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Tokenize } from "@beep/nlp-processing/Tools"
 *
 * const parameters = S.decodeUnknownSync(Tokenize.parametersSchema)({
 *   text: "The quick brown fox jumps."
 * })
 *
 * parameters.text
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const Tokenize = TokenizeSource;
/**
 * Ordered text-normalization tool contract.
 *
 * **Example** (Decode text transform parameters)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TransformText } from "@beep/nlp-processing/Tools"
 *
 * const parameters = S.decodeUnknownSync(TransformText.parametersSchema)({
 *   operations: ["trim", "lowercase", "removeExtraSpaces"],
 *   text: "  Refund   POLICY  "
 * })
 *
 * parameters.operations
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const TransformText = TransformTextSource;
/**
 * Asymmetric Tversky similarity tool contract.
 *
 * **Example** (Decode Tversky similarity parameters)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TverskySimilarity } from "@beep/nlp-processing/Tools"
 *
 * const parameters = S.decodeUnknownSync(TverskySimilarity.parametersSchema)({
 *   alpha: 0.7,
 *   beta: 0.3,
 *   text1: "refund policy shipping",
 *   text2: "refund policy"
 * })
 *
 * parameters.alpha
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const TverskySimilarity = TverskySimilaritySource;
/**
 * Word and character counting tool contract.
 *
 * **Example** (Decode word count parameters)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { WordCount } from "@beep/nlp-processing/Tools"
 *
 * const parameters = S.decodeUnknownSync(WordCount.parametersSchema)({
 *   text: "Hello brave new world."
 * })
 *
 * parameters.text
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const WordCount = WordCountSource;

/**
 * Effect AI toolkit containing the full driver-neutral NLP tool set.
 *
 * **Example** (List toolkit tool names)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { NlpToolkit } from "@beep/nlp-processing/Tools"
 *
 * const toolNames = Object.keys(NlpToolkit.tools)
 *
 * strictEqual(toolNames.includes("Tokenize"), true)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const NlpToolkit: typeof NlpToolkitSource = NlpToolkitSource;

/**
 * Stable ordered list of NLP tool contracts used to build the toolkit.
 *
 * **Example** (Map ordered tool names)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { NlpTools } from "@beep/nlp-processing/Tools"
 *
 * const toolNames = NlpTools.map((tool) => tool.name)
 *
 * strictEqual(toolNames.includes("QueryCorpus"), true)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const NlpTools: typeof NlpToolsSource = NlpToolsSource;

/**
 * Effectful adapter that exports toolkit tools as positional descriptors.
 *
 * **Example** (Export toolkit tool names)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { exportTools } from "@beep/nlp-processing/Tools"
 *
 * const exportedNames = exportTools.pipe(
 *   Effect.map((tools) => tools.map((tool) => tool.name))
 * )
 *
 * exportedNames
 * ```
 *
 * @category adapters
 * @since 0.0.0
 */
export const exportTools: typeof exportToolsSource = exportToolsSource;
