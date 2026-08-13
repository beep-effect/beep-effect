/**
 * Service: NLP Services
 *
 * Stateless NLP operations using wink-nlp.
 * Provides tokenization, BM25 search, and text chunking.
 *
 * @since 2.0.0
 * @module Service/Nlp
 */

import { $ScratchpadId } from "@beep/identity";
import { Context, Data, Duration, Effect, Layer, Order, Schedule } from "effect";
import * as A from "effect/Array";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import winkBM25 from "wink-bm25-text-search";
import model from "wink-eng-lite-web-model";
import winkNLP from "wink-nlp";
import type { ClassDefinition, OntologyContext, PropertyDefinition } from "../Domain/Model/Ontology.ts";
import type { OntologyEmbeddings } from "../Domain/Model/OntologyEmbeddings.ts";
import { IRI } from "../Domain/Model/shared.ts";
import type { ChunkingStrategy } from "../Domain/Schema/DocumentMetadata.ts";
import { defaultChunkingParams } from "../Domain/Schema/DocumentMetadata.ts";
import { enhanceTextForSearch, generateNGrams } from "../Utils/Text.ts";
import { EmbeddingService, EmbeddingServiceDefault } from "./Embedding.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Nlp");

/**
 * Tokenization result
 */
export interface TokenizeResult {
  readonly tokens: ReadonlyArray<string>;
  readonly sentences: ReadonlyArray<string>;
  readonly entities: ReadonlyArray<string>;
}

/**
 * BM25 similarity result
 */
export interface SimilarityResult {
  readonly doc: string;
  readonly score: number;
  readonly index: number;
}

/**
 * Text chunk with offset information
 */
export interface TextChunk {
  readonly index: number;
  readonly text: string;
  readonly startOffset: number;
  readonly endOffset: number;
}

/**
 * Chunking options
 */
export interface ChunkOptions {
  readonly preserveSentences?: boolean;
  readonly maxChunkSize?: number;
  /**
   * Number of sentences to overlap between consecutive chunks.
   * Default: 2 (good balance for context preservation)
   * Set to 0 for no overlap.
   */
  readonly overlapSentences?: number;
  /**
   * Chunking strategy for adaptive document processing.
   * Each strategy optimizes for different document structures:
   * - standard: Default ~500 chars, 2 sentence overlap
   * - fine_grained: Dense content ~300 chars, 3 sentence overlap
   * - high_overlap: Complex content ~400 chars, 4 sentence overlap
   * - section_aware: Contracts/reports - respect section headers
   * - speaker_aware: Transcripts - respect speaker turns
   * - paragraph_based: Articles - use natural paragraph breaks
   *
   * If provided, overrides maxChunkSize, overlapSentences, preserveSentences
   * with strategy-specific defaults.
   */
  readonly strategy?: ChunkingStrategy;
}

/**
 * BM25 configuration parameters
 */
export interface BM25Config {
  /**
   * Term frequency saturation parameter (default: 1.2)
   */
  readonly k1?: number;
  /**
   * Length normalization parameter (default: 0.75)
   */
  readonly b?: number;
  /**
   * Query term frequency normalization (default: 1)
   */
  readonly k?: number;
}

/**
 * Opaque BM25 index for ontology search
 */
export interface OntologyBM25Index {
  readonly _tag: "OntologyBM25Index";
  readonly documentCount: number;
  readonly _engine: ReturnType<typeof winkBM25>;
  readonly _domainModelMap: MutableHashMap.MutableHashMap<string, ClassDefinition | PropertyDefinition>;
  readonly _ontology: OntologyContext;
}

/**
 * Opaque semantic index for ontology search
 */
export interface OntologySemanticIndex {
  readonly _tag: "OntologySemanticIndex";
  readonly documentCount: number;
  readonly _embeddingMap: MutableHashMap.MutableHashMap<string, ReadonlyArray<number>>;
  readonly _domainModelMap: MutableHashMap.MutableHashMap<string, ClassDefinition | PropertyDefinition>;
  readonly _ontology: OntologyContext;
}

/**
 * Indicates that an ontology search received an invalid opaque index.
 *
 * @since 2.0.0
 * @category Errors
 */
export class NlpIndexError extends Data.TaggedError("NlpIndexError")<{
  readonly indexKind: "bm25" | "semantic";
  readonly message: string;
}> {}

/**
 * Search result from ontology BM25 index
 */
export interface OntologySearchResult {
  /**
   * IRI of the matched class or property
   */
  readonly iri: string;
  /**
   * BM25 relevance score
   */
  readonly score: number;
  /**
   * Class definition if result is a class
   */
  readonly class?: ClassDefinition;
  /**
   * Property definition if result is a property
   */
  readonly property?: PropertyDefinition;
}

/**
 * NlpService - Stateless NLP operations
 *
 * Mode: sync (synchronous operations, no async init)
 * Dependencies: None
 *
 * Capabilities:
 * - tokenize: Extract tokens, sentences, entities
 * - searchSimilar: BM25 ranking over documents
 * - chunkText: Sentence-aware text chunking
 *
 * @example
 * ```typescript
 * Effect.gen(function*() {
 *   const result = yield* NlpService.tokenize("Hello world")
 *   console.log(result.tokens)  // ["hello", "world"]
 * }).pipe(Effect.provide(NlpService.Default))
 * ```
 *
 * @since 2.0.0
 * @category Services
 */
/**
 * Prepare text for BM25 indexing with enhanced preprocessing
 *
 * Tokenizes text, removes stopwords, handles camelCase splitting, and generates n-grams.
 * This creates a richer representation for better search matching.
 *
 * Steps:
 * 1. Split camelCase identifiers into words
 * 2. Tokenize using wink-nlp (normalized, lowercase)
 * 3. Remove stopwords and non-word tokens
 * 4. Generate bigrams for multi-word phrase matching
 *
 * @param text - Input text to prepare
 * @param nlp - wink-nlp instance
 * @returns Array of tokens ready for BM25 indexing
 */
const prepareText = (text: string, nlp: ReturnType<typeof winkNLP>): Array<string> => {
  // First, enhance text by splitting camelCase and adding n-grams
  const enhancedText = enhanceTextForSearch(text, 2);

  // Tokenize the enhanced text
  const doc = nlp.readDoc(enhancedText);

  // Extract lemmas for better morphological matching
  // "running" → "run", "players" → "player", etc.
  const tokens: Array<string> = [];
  doc.tokens().each((token: any) => {
    // Skip stopwords and non-words (punctuation)
    if (P.isTruthy(token.out(nlp.its.stopWordFlag))) return;
    if (token.out(nlp.its.type) !== "word") return;
    // Use lemma form for improved recall on morphological variants
    tokens.push(token.out(nlp.its.lemma) as string);
  });

  // Generate additional bigrams from the lemmatized tokens for phrase matching
  const bigrams = generateNGrams(tokens, 2);

  // Combine tokens and bigrams for richer representation
  return [...tokens, ...bigrams];
};

/**
 * Retry schedule for embedding calls
 * - Exponential backoff starting at 1 second
 * - Max 3 retries
 * - Jittered to avoid thundering herd
 * - 10 second timeout per attempt
 */
const embeddingRetrySchedule = Schedule.max([Schedule.exponential(Duration.seconds(1)), Schedule.recurs(3)]).pipe(
  Schedule.jittered
);

// =============================================================================
// Strategy-Specific Chunking Helpers
// =============================================================================

/**
 * Section header pattern: Markdown headers (##, ###) or numbered sections (1., 1.1, etc.)
 */
const SECTION_HEADER_PATTERN = /^(?:#{1,6}\s+.+|(?:\d+\.)+\s+.+|[A-Z][A-Z\s]+:?\s*$)/gm;

/**
 * Speaker turn pattern: "Name:", "SPEAKER 1:", "[Speaker]:", etc.
 */
const SPEAKER_TURN_PATTERN = /^(?:\[?[A-Z][a-zA-Z\s]+\]?:|[A-Z]{2,}(?:\s+\d+)?:)/gm;

/**
 * Paragraph separator: Two or more newlines
 */
const PARAGRAPH_SEPARATOR = /\n{2,}/;

/**
 * Chunk text by section headers
 *
 * Splits on markdown headers (##, ###) or numbered sections (1., 1.1).
 * Each section becomes a chunk, with overflow split by sentences.
 */
function chunkBySections(text: string, maxChunkSize: number, _overlapSentences: number): Array<TextChunk> {
  const chunks: Array<TextChunk> = [];
  let chunkIndex = 0;

  // Find all section header positions
  const headerMatches: Array<{ index: number; match: string }> = [];
  let match: RegExpExecArray | null;

  const pattern = new RegExp(SECTION_HEADER_PATTERN.source, "gm");
  while ((match = pattern.exec(text)) !== null) {
    headerMatches.push({ index: match.index, match: match[0] });
  }

  // If no headers found, fall back to simple chunking
  if (headerMatches.length === 0) {
    return chunkBySize(text, maxChunkSize, chunkIndex);
  }

  // Process text before first header
  if (headerMatches[0].index > 0) {
    const preText = text.slice(0, headerMatches[0].index).trim();
    if (preText.length > 0) {
      const preChunks = chunkBySize(preText, maxChunkSize, chunkIndex);
      for (const chunk of preChunks) {
        chunks.push(chunk);
      }
      chunkIndex += preChunks.length;
    }
  }

  // Process each section
  for (let i = 0; i < headerMatches.length; i++) {
    const start = headerMatches[i].index;
    const end = i < headerMatches.length - 1 ? headerMatches[i + 1].index : text.length;
    const sectionText = text.slice(start, end).trim();

    if (sectionText.length === 0) continue;

    if (sectionText.length <= maxChunkSize) {
      chunks.push({
        index: chunkIndex++,
        text: sectionText,
        startOffset: start,
        endOffset: end,
      });
    } else {
      // Section too large - split by sentences within section
      const sectionChunks = chunkBySize(sectionText, maxChunkSize, chunkIndex);
      // Adjust offsets relative to section start
      for (const chunk of sectionChunks) {
        chunks.push({
          ...chunk,
          index: chunkIndex++,
          startOffset: start + chunk.startOffset,
          endOffset: start + chunk.endOffset,
        });
      }
    }
  }

  return chunks;
}

/**
 * Chunk text by speaker turns
 *
 * Splits on speaker patterns like "Name:", "SPEAKER 1:", "[Interviewer]:".
 * Each speaker turn becomes a chunk, with overflow split by sentences.
 */
function chunkBySpeakerTurns(text: string, maxChunkSize: number, _overlapSentences: number): Array<TextChunk> {
  const chunks: Array<TextChunk> = [];
  let chunkIndex = 0;

  // Find all speaker turn positions
  const turnMatches: Array<{ index: number; match: string }> = [];
  let match: RegExpExecArray | null;

  const pattern = new RegExp(SPEAKER_TURN_PATTERN.source, "gm");
  while ((match = pattern.exec(text)) !== null) {
    turnMatches.push({ index: match.index, match: match[0] });
  }

  // If no speaker turns found, fall back to simple chunking
  if (turnMatches.length === 0) {
    return chunkBySize(text, maxChunkSize, chunkIndex);
  }

  // Process text before first speaker turn
  if (turnMatches[0].index > 0) {
    const preText = text.slice(0, turnMatches[0].index).trim();
    if (preText.length > 0) {
      const preChunks = chunkBySize(preText, maxChunkSize, chunkIndex);
      for (const chunk of preChunks) {
        chunks.push(chunk);
      }
      chunkIndex += preChunks.length;
    }
  }

  // Process each speaker turn
  for (let i = 0; i < turnMatches.length; i++) {
    const start = turnMatches[i].index;
    const end = i < turnMatches.length - 1 ? turnMatches[i + 1].index : text.length;
    const turnText = text.slice(start, end).trim();

    if (turnText.length === 0) continue;

    if (turnText.length <= maxChunkSize) {
      chunks.push({
        index: chunkIndex++,
        text: turnText,
        startOffset: start,
        endOffset: end,
      });
    } else {
      // Turn too large - split by sentences
      const turnChunks = chunkBySize(turnText, maxChunkSize, chunkIndex);
      for (const chunk of turnChunks) {
        chunks.push({
          ...chunk,
          index: chunkIndex++,
          startOffset: start + chunk.startOffset,
          endOffset: start + chunk.endOffset,
        });
      }
    }
  }

  return chunks;
}

/**
 * Chunk text by paragraphs
 *
 * Splits on double newlines (paragraph breaks).
 * Each paragraph becomes a chunk, with overflow split by sentences.
 */
function chunkByParagraphs(text: string, maxChunkSize: number, _overlapSentences: number): Array<TextChunk> {
  const chunks: Array<TextChunk> = [];
  let chunkIndex = 0;
  let currentOffset = 0;

  // Split by paragraph separators
  const paragraphs = text.split(PARAGRAPH_SEPARATOR);

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    if (trimmedParagraph.length === 0) {
      // Skip empty paragraphs but track offset
      currentOffset += paragraph.length + 2; // +2 for the \n\n
      continue;
    }

    // Find actual position in original text
    const startOffset = text.indexOf(trimmedParagraph, currentOffset);
    const endOffset = startOffset + trimmedParagraph.length;

    if (trimmedParagraph.length <= maxChunkSize) {
      chunks.push({
        index: chunkIndex++,
        text: trimmedParagraph,
        startOffset: startOffset >= 0 ? startOffset : currentOffset,
        endOffset: startOffset >= 0 ? endOffset : currentOffset + trimmedParagraph.length,
      });
    } else {
      // Paragraph too large - split by sentences
      const paraChunks = chunkBySize(trimmedParagraph, maxChunkSize, chunkIndex);
      for (const chunk of paraChunks) {
        const chunkStart = startOffset >= 0 ? startOffset + chunk.startOffset : currentOffset + chunk.startOffset;
        chunks.push({
          ...chunk,
          index: chunkIndex++,
          startOffset: chunkStart,
          endOffset: chunkStart + chunk.text.length,
        });
      }
    }

    currentOffset = endOffset + 2; // +2 for the \n\n separator
  }

  return chunks;
}

/**
 * Simple size-based chunking helper
 *
 * Splits text into chunks of approximately maxChunkSize characters,
 * trying to break at sentence boundaries when possible.
 */
function chunkBySize(text: string, maxChunkSize: number, startIndex: number): Array<TextChunk> {
  const chunks: Array<TextChunk> = [];
  let chunkIndex = startIndex;
  let currentChunk = "";
  let startOffset = 0;
  let currentOffset = 0;

  // Simple sentence split (approximation without wink-nlp)
  const sentencePattern = /[.!?]+\s+/g;
  const sentences: Array<string> = [];
  let lastEnd = 0;
  let sentenceMatch: RegExpExecArray | null;

  while ((sentenceMatch = sentencePattern.exec(text)) !== null) {
    sentences.push(text.slice(lastEnd, sentenceMatch.index + sentenceMatch[0].length));
    lastEnd = sentenceMatch.index + sentenceMatch[0].length;
  }
  // Add remaining text as last sentence
  if (lastEnd < text.length) {
    sentences.push(text.slice(lastEnd));
  }

  // If no sentences found, treat whole text as one
  if (sentences.length === 0) {
    sentences.push(text);
  }

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push({
        index: chunkIndex++,
        text: currentChunk.trim(),
        startOffset,
        endOffset: currentOffset,
      });
      startOffset = currentOffset;
      currentChunk = "";
    }
    currentChunk += sentence;
    currentOffset += sentence.length;
  }

  // Add final chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      index: chunkIndex++,
      text: currentChunk.trim(),
      startOffset,
      endOffset: currentOffset,
    });
  }

  return chunks;
}

const EMBEDDING_TIMEOUT_MS = 10_000;

export class NlpService extends Context.Service<NlpService>()($I`NlpService`, {
  make: Effect.gen(function* () {
    const embedding = yield* EmbeddingService;

    // Initialize wink-nlp with model, pipes (sbd+pos for embeddings)
    // sbd = sentence boundary detection, pos = part-of-speech (required for lemmas/contextual vectors)
    const nlp = winkNLP(model, ["sbd", "pos"]);
    const its = nlp.its;

    return {
      tokenize: Effect.fn("NlpService.tokenize")((text: string) =>
        Effect.sync(() => {
          const doc = nlp.readDoc(text);
          return {
            tokens: doc.tokens().out(its.normal) as Array<string>,
            sentences: doc.sentences().out() as Array<string>,
            entities: doc.entities().out() as Array<string>,
          };
        })
      ),
      searchSimilar: Effect.fn("NlpService.searchSimilar")(
        (query: string, docs: ReadonlyArray<string>, k: number = 5) =>
          Effect.sync(() => {
            const engine = winkBM25();
            engine.defineConfig({
              fldWeights: { text: 1 },
            });
            engine.definePrepTasks([(text: string) => prepareText(text, nlp)]);
            docs.forEach((doc, index) => {
              engine.addDoc({ text: doc }, index.toString());
            });
            engine.consolidate();
            const rawResults = engine.search(query, k);
            return rawResults.map((result: any) => {
              const [id, score] = result;
              const index = Number.parseInt(id, 10);
              return {
                doc: docs[index],
                index,
                score,
              };
            });
          })
      ),
      searchSemantic: Effect.fn("NlpService.searchSemantic")(function* (
        query: string,
        docs: ReadonlyArray<string>,
        k: number = 5
      ) {
        const queryVector = yield* embedding
          .embed(query, "search_query")
          .pipe(Effect.retry(embeddingRetrySchedule), Effect.timeout(Duration.millis(EMBEDDING_TIMEOUT_MS)));
        const docEmbeddings = yield* Effect.all(
          docs.map((doc, index) =>
            embedding.embed(doc, "search_document").pipe(
              Effect.retry(embeddingRetrySchedule),
              Effect.timeout(Duration.millis(EMBEDDING_TIMEOUT_MS)),
              Effect.map((docVector) => ({ doc, index, embedding: docVector })),
              Effect.tapError((error) =>
                Effect.logWarning("Embedding failed after retries", {
                  docPreview: doc.slice(0, 100),
                  error: String(error),
                })
              ),
              Effect.orElseSucceed(() => null)
            )
          ),
          { concurrency: 5 }
        );
        const results = docEmbeddings
          .filter((item): item is NonNullable<typeof item> => item !== null)
          .map(({ doc, embedding: docVector, index }) => {
            const score = embedding.cosineSimilarity(queryVector, docVector);
            return { doc, index, score };
          })
          .filter((r) => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, k);
        return results;
      }),
      chunkText: Effect.fn("NlpService.chunkText")((text: string, options?: ChunkOptions) =>
        Effect.sync(() => {
          const strategy = options?.strategy;
          const strategyDefaults = P.isNotUndefined(strategy) ? defaultChunkingParams[strategy] : undefined;
          const maxChunkSize = options?.maxChunkSize ?? strategyDefaults?.chunkSize ?? 500;
          const overlapSentences = options?.overlapSentences ?? strategyDefaults?.overlapSentences ?? 2;
          const preserveSentences = options?.preserveSentences ?? strategyDefaults?.preserveSentences ?? true;
          if (strategy === "section_aware") {
            return chunkBySections(text, maxChunkSize, overlapSentences);
          }
          if (strategy === "speaker_aware") {
            return chunkBySpeakerTurns(text, maxChunkSize, overlapSentences);
          }
          if (strategy === "paragraph_based") {
            return chunkByParagraphs(text, maxChunkSize, overlapSentences);
          }
          const doc = nlp.readDoc(text);
          const sentences = doc.sentences().out() as Array<string>;
          if (sentences.length === 0) {
            return [];
          }
          if (!preserveSentences) {
            const chunks: Array<TextChunk> = [];
            let currentChunk = "";
            let startOffset = 0;
            for (const sentence of sentences) {
              if (currentChunk.length + sentence.length > maxChunkSize && P.isTruthy(currentChunk)) {
                chunks.push({
                  index: chunks.length,
                  text: currentChunk.trim(),
                  startOffset,
                  endOffset: startOffset + currentChunk.length,
                });
                startOffset += currentChunk.length;
                currentChunk = "";
              }
              currentChunk += `${sentence} `;
            }
            if (P.isTruthy(currentChunk)) {
              chunks.push({
                index: chunks.length,
                text: currentChunk.trim(),
                startOffset,
                endOffset: startOffset + currentChunk.length,
              });
            }
            return chunks;
          }
          const sentenceCollection = doc.sentences();
          const sentenceIndex: Array<{
            text: string;
            startOffset: number;
            endOffset: number;
          }> = [];
          let searchOffset = 0;
          sentenceCollection.each((sentence: any) => {
            const sentenceText = sentence.out();
            const startOffset = text.indexOf(sentenceText, searchOffset);
            const endOffset = startOffset + sentenceText.length;
            sentenceIndex.push({
              text: sentenceText,
              startOffset: startOffset >= 0 ? startOffset : searchOffset,
              endOffset: startOffset >= 0 ? endOffset : searchOffset + sentenceText.length,
            });
            searchOffset = startOffset >= 0 ? endOffset : searchOffset + sentenceText.length;
          });
          const chunks: Array<TextChunk> = [];
          const overlap = Math.max(0, overlapSentences);
          let i = 0;
          let chunkIndex = 0;
          while (i < sentences.length) {
            const chunkSentences: Array<string> = [];
            let chunkSize = 0;
            for (let j = i; j < sentences.length; j++) {
              const sentence = sentences[j];
              const sentenceLength = sentence.length + (j > i ? 1 : 0);
              if (chunkSize + sentenceLength > maxChunkSize && chunkSentences.length > 0) {
                break;
              }
              chunkSentences.push(sentence);
              chunkSize += sentenceLength;
            }
            if (chunkSentences.length > 0) {
              const chunkText = chunkSentences.join(" ");
              const chunkStartOffset = sentenceIndex[i]?.startOffset ?? 0;
              const lastSentenceIdx = i + chunkSentences.length - 1;
              const chunkEndOffset = sentenceIndex[lastSentenceIdx]?.endOffset ?? chunkStartOffset + chunkText.length;
              chunks.push({
                index: chunkIndex++,
                text: chunkText,
                startOffset: chunkStartOffset,
                endOffset: chunkEndOffset,
              });
              const step = Math.max(1, chunkSentences.length - overlap);
              i += step;
              if (i >= sentences.length) {
                break;
              }
            } else {
              const sentence = sentences[i];
              const chunkStartOffset = sentenceIndex[i]?.startOffset ?? 0;
              const chunkEndOffset = sentenceIndex[i]?.endOffset ?? chunkStartOffset + sentence.length;
              chunks.push({
                index: chunkIndex++,
                text: sentence,
                startOffset: chunkStartOffset,
                endOffset: chunkEndOffset,
              });
              i += 1;
            }
          }
          return chunks;
        })
      ),
      createOntologyIndex: (ontology: OntologyContext, config?: BM25Config): Effect.Effect<OntologyBM25Index> =>
        Effect.sync(() => {
          const engine = winkBM25();
          const bm25Params = {
            k1: config?.k1 ?? 1.2,
            b: config?.b ?? 0.75,
            k: config?.k ?? 1,
          };
          engine.defineConfig({
            fldWeights: { text: 1 },
            bm25Params,
          });
          engine.definePrepTasks([(text: string) => prepareText(text, nlp)]);
          const documents = ontology.toDocuments();
          const domainModelMap = MutableHashMap.empty<string, ClassDefinition | PropertyDefinition>();
          for (const [iri, document] of documents) {
            engine.addDoc(
              {
                text: document,
              },
              iri
            );
            const classDef = ontology.getClass(iri);
            const propertyDef = ontology.getProperty(iri);
            if (O.isSome(classDef)) {
              MutableHashMap.set(domainModelMap, iri, classDef.value);
            } else if (O.isSome(propertyDef)) {
              MutableHashMap.set(domainModelMap, iri, propertyDef.value);
            }
          }
          engine.consolidate();
          const index: OntologyBM25Index = {
            _tag: "OntologyBM25Index",
            documentCount: documents.length,
            _engine: engine,
            _domainModelMap: domainModelMap,
            _ontology: ontology,
          };
          return index;
        }),
      searchOntologyIndex: (
        index: OntologyBM25Index,
        query: string,
        limit: number = 10
      ): Effect.Effect<ReadonlyArray<OntologySearchResult>, NlpIndexError> =>
        Effect.gen(function* () {
          const engine = index._engine;
          const domainModelMap = index._domainModelMap;
          const ontology = index._ontology;
          if (P.not(P.isTruthy)(engine) || P.not(P.isTruthy)(domainModelMap) || P.not(P.isTruthy)(ontology)) {
            return yield* new NlpIndexError({
              indexKind: "bm25",
              message: "Invalid BM25 index reference",
            });
          }
          const rawResults = engine.search(query, limit);
          const results: Array<OntologySearchResult> = [];
          for (const result of rawResults) {
            const [iri, score] = result as [string, number];
            const domainModel = MutableHashMap.get(domainModelMap, iri);
            if (O.isSome(domainModel)) {
              const iriValue = IRI.fromUnknown(iri);
              const classDef = ontology.getClass(iriValue);
              const propertyDef = ontology.getProperty(iriValue);
              results.push({
                iri,
                score,
                ...(O.isSome(classDef) ? { class: classDef.value } : {}),
                ...(O.isSome(propertyDef) ? { property: propertyDef.value } : {}),
              });
            }
          }
          return results;
        }),
      createOntologySemanticIndex: (ontology: OntologyContext): Effect.Effect<OntologySemanticIndex> =>
        Effect.gen(function* () {
          const documents = ontology.toDocuments();
          const embeddingMap = MutableHashMap.empty<string, ReadonlyArray<number>>();
          const domainModelMap = MutableHashMap.empty<string, ClassDefinition | PropertyDefinition>();
          const iris = documents.map(([iri]) => iri);
          const texts = documents.map(([, document]) => document);
          const embeddings = yield* embedding.embedBatch(texts, "search_document").pipe(
            Effect.retry(embeddingRetrySchedule),
            Effect.timeout(Duration.millis(EMBEDDING_TIMEOUT_MS * texts.length)),
            Effect.orElseSucceed(() => [] as ReadonlyArray<ReadonlyArray<number>>)
          );
          for (let i = 0; i < iris.length && i < embeddings.length; i++) {
            const iri = iris[i];
            const emb = embeddings[i];
            MutableHashMap.set(embeddingMap, iri, emb);
            const classDef = ontology.getClass(iri);
            const propertyDef = ontology.getProperty(iri);
            if (O.isSome(classDef)) {
              MutableHashMap.set(domainModelMap, iri, classDef.value);
            } else if (O.isSome(propertyDef)) {
              MutableHashMap.set(domainModelMap, iri, propertyDef.value);
            }
          }
          const index: OntologySemanticIndex = {
            _tag: "OntologySemanticIndex",
            documentCount: MutableHashMap.size(embeddingMap),
            _embeddingMap: embeddingMap,
            _domainModelMap: domainModelMap,
            _ontology: ontology,
          };
          return index;
        }),
      createOntologySemanticIndexFromPrecomputed: (
        ontology: OntologyContext,
        embeddings: OntologyEmbeddings
      ): Effect.Effect<OntologySemanticIndex> =>
        Effect.gen(function* () {
          const embeddingMap = MutableHashMap.empty<string, ReadonlyArray<number>>();
          const domainModelMap = MutableHashMap.empty<string, ClassDefinition | PropertyDefinition>();
          for (const classEmb of embeddings.classes) {
            MutableHashMap.set(embeddingMap, classEmb.iri, classEmb.embedding);
            const classDef = ontology.getClass(classEmb.iri);
            if (O.isSome(classDef)) {
              MutableHashMap.set(domainModelMap, classEmb.iri, classDef.value);
            }
          }
          for (const propEmb of embeddings.properties) {
            MutableHashMap.set(embeddingMap, propEmb.iri, propEmb.embedding);
            const propDef = ontology.getProperty(propEmb.iri);
            if (O.isSome(propDef)) {
              MutableHashMap.set(domainModelMap, propEmb.iri, propDef.value);
            }
          }
          yield* Effect.logInfo("Created semantic index from pre-computed embeddings", {
            classCount: embeddings.classes.length,
            propertyCount: embeddings.properties.length,
            indexedCount: MutableHashMap.size(embeddingMap),
          });
          const index: OntologySemanticIndex = {
            _tag: "OntologySemanticIndex",
            documentCount: MutableHashMap.size(embeddingMap),
            _embeddingMap: embeddingMap,
            _domainModelMap: domainModelMap,
            _ontology: ontology,
          };
          return index;
        }),
      searchOntologySemanticIndex: Effect.fn("NlpService.searchOntologySemanticIndex")(function* (
        index: OntologySemanticIndex,
        query: string,
        limit: number = 10
      ) {
          const embeddingMap = index._embeddingMap;
          const domainModelMap = index._domainModelMap;
          const ontology = index._ontology;
          if (P.not(P.isTruthy)(embeddingMap) || P.not(P.isTruthy)(domainModelMap) || P.not(P.isTruthy)(ontology)) {
            return yield* new NlpIndexError({
              indexKind: "semantic",
              message: "Invalid semantic index reference",
            });
          }
          const queryEmbedding = yield* embedding
            .embed(query, "search_query")
            .pipe(Effect.retry(embeddingRetrySchedule), Effect.timeout(Duration.millis(EMBEDDING_TIMEOUT_MS)));
          const results: Array<
            OntologySearchResult & {
              score: number;
            }
          > = [];
          for (const [iri, docEmbedding] of embeddingMap) {
            const score = embedding.cosineSimilarity(queryEmbedding, docEmbedding);
            if (score > 0) {
              const domainModel = MutableHashMap.get(domainModelMap, iri);
              if (O.isSome(domainModel)) {
                const iriValue = IRI.fromUnknown(iri);
                const classDef = ontology.getClass(iriValue);
                const propertyDef = ontology.getProperty(iriValue);
                results.push({
                  iri,
                  score,
                  ...(O.isSome(classDef) ? { class: classDef.value } : {}),
                  ...(O.isSome(propertyDef) ? { property: propertyDef.value } : {}),
                });
              }
            }
          }
          return A.take(
            A.sortWith(results, (result) => -result.score, Order.Number),
            limit
          );
      }),
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make).pipe(
    Layer.provide([
      // EmbeddingServiceDefault requires EmbeddingProvider | EmbeddingCache | MetricsService
      // Provider selection (Nomic vs Voyage) is handled by runtime layer composition
      // This ensures NlpService uses the same provider as the rest of the system
      EmbeddingServiceDefault,
    ])
  );
}
