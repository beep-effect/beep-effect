/**
 * Service: NLP Services
 *
 * Stateless NLP operations using wink-nlp.
 * Provides tokenization, BM25 search, and text chunking.
 *
 * @since 2.0.0
 * @module Service/Nlp
 */

import { Context, Duration, Effect, Layer, Order, Schedule } from "effect"
import * as A from "effect/Array"
import * as MutableHashMap from "effect/MutableHashMap"
import * as O from "effect/Option"
import model from "wink-eng-lite-web-model"
import winkNLP from "wink-nlp"

import winkBM25 from "wink-bm25-text-search"
import type { ClassDefinition, OntologyContext, PropertyDefinition } from "../Domain/Model/Ontology.ts"
import type { OntologyEmbeddings } from "../Domain/Model/OntologyEmbeddings.ts"
import { type ChunkingStrategy, defaultChunkingParams } from "../Domain/Schema/DocumentMetadata.ts"
import { IRI } from "../Domain/Model/shared.ts"
import { enhanceTextForSearch, generateNGrams } from "../Utils/Text.ts"
import { EmbeddingService, EmbeddingServiceDefault } from "./Embedding.ts"
import { $ScratchpadId } from "@beep/identity";
const $I = $ScratchpadId.create("effect-ontology/Service/Nlp");

/**
 * Tokenization result
 */
export interface TokenizeResult {
  readonly tokens: ReadonlyArray<string>
  readonly sentences: ReadonlyArray<string>
  readonly entities: ReadonlyArray<string>
}

/**
 * BM25 similarity result
 */
export interface SimilarityResult {
  readonly doc: string
  readonly score: number
  readonly index: number
}

/**
 * Text chunk with offset information
 */
export interface TextChunk {
  readonly index: number
  readonly text: string
  readonly startOffset: number
  readonly endOffset: number
}

/**
 * Chunking options
 */
export interface ChunkOptions {
  readonly preserveSentences?: boolean
  readonly maxChunkSize?: number
  /**
   * Number of sentences to overlap between consecutive chunks.
   * Default: 2 (good balance for context preservation)
   * Set to 0 for no overlap.
   */
  readonly overlapSentences?: number
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
  readonly strategy?: ChunkingStrategy
}

/**
 * BM25 configuration parameters
 */
export interface BM25Config {
  /**
   * Term frequency saturation parameter (default: 1.2)
   */
  readonly k1?: number
  /**
   * Length normalization parameter (default: 0.75)
   */
  readonly b?: number
  /**
   * Query term frequency normalization (default: 1)
   */
  readonly k?: number
}

/**
 * Opaque BM25 index for ontology search
 */
export interface OntologyBM25Index {
  readonly _tag: "OntologyBM25Index"
  readonly documentCount: number
  readonly _engine: ReturnType<typeof winkBM25>
  readonly _domainModelMap: MutableHashMap.MutableHashMap<string, ClassDefinition | PropertyDefinition>
  readonly _ontology: OntologyContext
}

/**
 * Opaque semantic index for ontology search
 */
export interface OntologySemanticIndex {
  readonly _tag: "OntologySemanticIndex"
  readonly documentCount: number
  readonly _embeddingMap: MutableHashMap.MutableHashMap<string, ReadonlyArray<number>>
  readonly _domainModelMap: MutableHashMap.MutableHashMap<string, ClassDefinition | PropertyDefinition>
  readonly _ontology: OntologyContext
}

/**
 * Search result from ontology BM25 index
 */
export interface OntologySearchResult {
  /**
   * IRI of the matched class or property
   */
  readonly iri: string
  /**
   * BM25 relevance score
   */
  readonly score: number
  /**
   * Class definition if result is a class
   */
  readonly class?: ClassDefinition
  /**
   * Property definition if result is a property
   */
  readonly property?: PropertyDefinition
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
  const enhancedText = enhanceTextForSearch(text, 2)

  // Tokenize the enhanced text
  const doc = nlp.readDoc(enhancedText)

  // Extract lemmas for better morphological matching
  // "running" → "run", "players" → "player", etc.
  const tokens: Array<string> = []
  doc.tokens().each((token: any) => {
    // Skip stopwords and non-words (punctuation)
    if (token.out(nlp.its.stopWordFlag)) return
    if (token.out(nlp.its.type) !== "word") return
    // Use lemma form for improved recall on morphological variants
    tokens.push(token.out(nlp.its.lemma) as string)
  })

  // Generate additional bigrams from the lemmatized tokens for phrase matching
  const bigrams = generateNGrams(tokens, 2)

  // Combine tokens and bigrams for richer representation
  return [...tokens, ...bigrams]
}

/**
 * Retry schedule for embedding calls
 * - Exponential backoff starting at 1 second
 * - Max 3 retries
 * - Jittered to avoid thundering herd
 * - 10 second timeout per attempt
 */
const embeddingRetrySchedule = Schedule.max([Schedule.exponential(Duration.seconds(1)), Schedule.recurs(3)]).pipe(
  Schedule.jittered
)

// =============================================================================
// Strategy-Specific Chunking Helpers
// =============================================================================

/**
 * Section header pattern: Markdown headers (##, ###) or numbered sections (1., 1.1, etc.)
 */
const SECTION_HEADER_PATTERN = /^(?:#{1,6}\s+.+|(?:\d+\.)+\s+.+|[A-Z][A-Z\s]+:?\s*$)/gm

/**
 * Speaker turn pattern: "Name:", "SPEAKER 1:", "[Speaker]:", etc.
 */
const SPEAKER_TURN_PATTERN = /^(?:\[?[A-Z][a-zA-Z\s]+\]?:|[A-Z]{2,}(?:\s+\d+)?:)/gm

/**
 * Paragraph separator: Two or more newlines
 */
const PARAGRAPH_SEPARATOR = /\n{2,}/

/**
 * Chunk text by section headers
 *
 * Splits on markdown headers (##, ###) or numbered sections (1., 1.1).
 * Each section becomes a chunk, with overflow split by sentences.
 */
function chunkBySections(
  text: string,
  maxChunkSize: number,
  _overlapSentences: number
): Array<TextChunk> {
  const chunks: Array<TextChunk> = []
  let chunkIndex = 0

  // Find all section header positions
  const headerMatches: Array<{ index: number; match: string }> = []
  let match: RegExpExecArray | null

  const pattern = new RegExp(SECTION_HEADER_PATTERN.source, "gm")
  while ((match = pattern.exec(text)) !== null) {
    headerMatches.push({ index: match.index, match: match[0] })
  }

  // If no headers found, fall back to simple chunking
  if (headerMatches.length === 0) {
    return chunkBySize(text, maxChunkSize, chunkIndex)
  }

  // Process text before first header
  if (headerMatches[0].index > 0) {
    const preText = text.slice(0, headerMatches[0].index).trim()
    if (preText.length > 0) {
      const preChunks = chunkBySize(preText, maxChunkSize, chunkIndex)
      for (const chunk of preChunks) {
        chunks.push(chunk)
      }
      chunkIndex += preChunks.length
    }
  }

  // Process each section
  for (let i = 0; i < headerMatches.length; i++) {
    const start = headerMatches[i].index
    const end = i < headerMatches.length - 1 ? headerMatches[i + 1].index : text.length
    const sectionText = text.slice(start, end).trim()

    if (sectionText.length === 0) continue

    if (sectionText.length <= maxChunkSize) {
      chunks.push({
        index: chunkIndex++,
        text: sectionText,
        startOffset: start,
        endOffset: end
      })
    } else {
      // Section too large - split by sentences within section
      const sectionChunks = chunkBySize(sectionText, maxChunkSize, chunkIndex)
      // Adjust offsets relative to section start
      for (const chunk of sectionChunks) {
        chunks.push({
          ...chunk,
          index: chunkIndex++,
          startOffset: start + chunk.startOffset,
          endOffset: start + chunk.endOffset
        })
      }
    }
  }

  return chunks
}

/**
 * Chunk text by speaker turns
 *
 * Splits on speaker patterns like "Name:", "SPEAKER 1:", "[Interviewer]:".
 * Each speaker turn becomes a chunk, with overflow split by sentences.
 */
function chunkBySpeakerTurns(
  text: string,
  maxChunkSize: number,
  _overlapSentences: number
): Array<TextChunk> {
  const chunks: Array<TextChunk> = []
  let chunkIndex = 0

  // Find all speaker turn positions
  const turnMatches: Array<{ index: number; match: string }> = []
  let match: RegExpExecArray | null

  const pattern = new RegExp(SPEAKER_TURN_PATTERN.source, "gm")
  while ((match = pattern.exec(text)) !== null) {
    turnMatches.push({ index: match.index, match: match[0] })
  }

  // If no speaker turns found, fall back to simple chunking
  if (turnMatches.length === 0) {
    return chunkBySize(text, maxChunkSize, chunkIndex)
  }

  // Process text before first speaker turn
  if (turnMatches[0].index > 0) {
    const preText = text.slice(0, turnMatches[0].index).trim()
    if (preText.length > 0) {
      const preChunks = chunkBySize(preText, maxChunkSize, chunkIndex)
      for (const chunk of preChunks) {
        chunks.push(chunk)
      }
      chunkIndex += preChunks.length
    }
  }

  // Process each speaker turn
  for (let i = 0; i < turnMatches.length; i++) {
    const start = turnMatches[i].index
    const end = i < turnMatches.length - 1 ? turnMatches[i + 1].index : text.length
    const turnText = text.slice(start, end).trim()

    if (turnText.length === 0) continue

    if (turnText.length <= maxChunkSize) {
      chunks.push({
        index: chunkIndex++,
        text: turnText,
        startOffset: start,
        endOffset: end
      })
    } else {
      // Turn too large - split by sentences
      const turnChunks = chunkBySize(turnText, maxChunkSize, chunkIndex)
      for (const chunk of turnChunks) {
        chunks.push({
          ...chunk,
          index: chunkIndex++,
          startOffset: start + chunk.startOffset,
          endOffset: start + chunk.endOffset
        })
      }
    }
  }

  return chunks
}

/**
 * Chunk text by paragraphs
 *
 * Splits on double newlines (paragraph breaks).
 * Each paragraph becomes a chunk, with overflow split by sentences.
 */
function chunkByParagraphs(
  text: string,
  maxChunkSize: number,
  _overlapSentences: number
): Array<TextChunk> {
  const chunks: Array<TextChunk> = []
  let chunkIndex = 0
  let currentOffset = 0

  // Split by paragraph separators
  const paragraphs = text.split(PARAGRAPH_SEPARATOR)

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim()
    if (trimmedParagraph.length === 0) {
      // Skip empty paragraphs but track offset
      currentOffset += paragraph.length + 2 // +2 for the \n\n
      continue
    }

    // Find actual position in original text
    const startOffset = text.indexOf(trimmedParagraph, currentOffset)
    const endOffset = startOffset + trimmedParagraph.length

    if (trimmedParagraph.length <= maxChunkSize) {
      chunks.push({
        index: chunkIndex++,
        text: trimmedParagraph,
        startOffset: startOffset >= 0 ? startOffset : currentOffset,
        endOffset: startOffset >= 0 ? endOffset : currentOffset + trimmedParagraph.length
      })
    } else {
      // Paragraph too large - split by sentences
      const paraChunks = chunkBySize(trimmedParagraph, maxChunkSize, chunkIndex)
      for (const chunk of paraChunks) {
        const chunkStart = startOffset >= 0 ? startOffset + chunk.startOffset : currentOffset + chunk.startOffset
        chunks.push({
          ...chunk,
          index: chunkIndex++,
          startOffset: chunkStart,
          endOffset: chunkStart + chunk.text.length
        })
      }
    }

    currentOffset = endOffset + 2 // +2 for the \n\n separator
  }

  return chunks
}

/**
 * Simple size-based chunking helper
 *
 * Splits text into chunks of approximately maxChunkSize characters,
 * trying to break at sentence boundaries when possible.
 */
function chunkBySize(
  text: string,
  maxChunkSize: number,
  startIndex: number
): Array<TextChunk> {
  const chunks: Array<TextChunk> = []
  let chunkIndex = startIndex
  let currentChunk = ""
  let startOffset = 0
  let currentOffset = 0

  // Simple sentence split (approximation without wink-nlp)
  const sentencePattern = /[.!?]+\s+/g
  const sentences: Array<string> = []
  let lastEnd = 0
  let sentenceMatch: RegExpExecArray | null

  while ((sentenceMatch = sentencePattern.exec(text)) !== null) {
    sentences.push(text.slice(lastEnd, sentenceMatch.index + sentenceMatch[0].length))
    lastEnd = sentenceMatch.index + sentenceMatch[0].length
  }
  // Add remaining text as last sentence
  if (lastEnd < text.length) {
    sentences.push(text.slice(lastEnd))
  }

  // If no sentences found, treat whole text as one
  if (sentences.length === 0) {
    sentences.push(text)
  }

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push({
        index: chunkIndex++,
        text: currentChunk.trim(),
        startOffset,
        endOffset: currentOffset
      })
      startOffset = currentOffset
      currentChunk = ""
    }
    currentChunk += sentence
    currentOffset += sentence.length
  }

  // Add final chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      index: chunkIndex++,
      text: currentChunk.trim(),
      startOffset,
      endOffset: currentOffset
    })
  }

  return chunks
}

const EMBEDDING_TIMEOUT_MS = 10_000

export class NlpService extends Context.Service<NlpService>()(
  $I`NlpService`,
  {
    make: Effect.gen(function*() {
      const embedding = yield* EmbeddingService

      // Initialize wink-nlp with model, pipes (sbd+pos for embeddings)
      // sbd = sentence boundary detection, pos = part-of-speech (required for lemmas/contextual vectors)
      const nlp = winkNLP(model, ["sbd", "pos"])
      const its = nlp.its

      return {
        /**
         * Tokenize text into tokens, sentences, and entities
         *
         * Uses wink-nlp's normalized tokens (lowercase, no punctuation)
         *
         * @param text - Input text to tokenize
         * @returns Tokenization result with tokens, sentences, entities
         */
        tokenize: (text: string) =>
          Effect.sync(() => {
            const doc = nlp.readDoc(text)

            return {
              tokens: doc.tokens().out(its.normal) as Array<string>,
              sentences: doc.sentences().out() as Array<string>,
              entities: doc.entities().out() as Array<string>
            }
          }),

        /**
         * Search similar documents using BM25
         *
         * Uses BM25 algorithm with default parameters (k1=1.2, b=0.75, k=1)
         *
         * @param query - Search query
         * @param docs - Document collection to search
         * @param k - Number of top results to return
         * @returns Top-k similar documents with scores
         */
        searchSimilar: (
          query: string,
          docs: ReadonlyArray<string>,
          k: number = 5
        ) =>
          Effect.sync(() => {
            // Create BM25 search engine
            const engine = winkBM25()

            // Configure (must come before definePrepTasks)
            engine.defineConfig({
              fldWeights: { text: 1 }
            })

            // Define text preparation pipeline with lemmatization
            engine.definePrepTasks([(text: string) => prepareText(text, nlp)])

            // Add documents to index
            docs.forEach((doc, index) => {
              engine.addDoc({ text: doc }, index.toString())
            })

            // Consolidate index
            engine.consolidate()

            // Search
            const rawResults = engine.search(query, k)

            // Map results
            return rawResults.map((result: any) => {
              const [id, score] = result
              const index = Number.parseInt(id)
              return {
                doc: docs[index],
                index,
                score
              }
            })
          }),

        /**
         * Search similar documents using embeddings (semantic search)
         *
         * Uses Nomic embeddings for semantic similarity.
         * More robust to paraphrasing than BM25.
         *
         * @param query - Search query
         * @param docs - Document collection to search
         * @param k - Number of top results to return
         * @returns Top-k semantically similar documents with scores
         */
        searchSemantic: (
          query: string,
          docs: ReadonlyArray<string>,
          k: number = 5
        ) =>
          Effect.gen(function*() {
            // Get query vector using provider-agnostic EmbeddingService
            const queryVector = yield* embedding.embed(query, "search_query").pipe(
              Effect.retry(embeddingRetrySchedule),
              Effect.timeout(Duration.millis(EMBEDDING_TIMEOUT_MS))
            )

            // Compute embeddings for all docs (in parallel with concurrency limit)
            const docEmbeddings = yield* Effect.all(
              docs.map((doc, index) =>
                embedding.embed(doc, "search_document").pipe(
                  Effect.retry(embeddingRetrySchedule),
                  Effect.timeout(Duration.millis(EMBEDDING_TIMEOUT_MS)),
                  Effect.map((docVector) => ({ doc, index, embedding: docVector })),
                  Effect.tapError((error) =>
                    Effect.logWarning("Embedding failed after retries", {
                      docPreview: doc.slice(0, 100),
                      error: String(error)
                    })
                  ),
                  Effect.catch(() => Effect.succeed(null))
                )
              ),
              { concurrency: 5 }
            )

            // Compute cosine similarity for each document
            const results = docEmbeddings
              .filter((item): item is NonNullable<typeof item> => item !== null)
              .map(({ doc, embedding: docVector, index }) => {
                const score = embedding.cosineSimilarity(queryVector, docVector)
                return { doc, index, score }
              })
              .filter((r) => r.score > 0)
              .sort((a, b) => b.score - a.score)
              .slice(0, k)

            return results
          }),

        /**
         * Chunk text while preserving sentence boundaries with optional overlap
         *
         * Uses wink-nlp's sentence segmentation to create context-preserving chunks.
         * Supports overlapping chunks via sliding window approach for better context
         * preservation across chunk boundaries.
         *
         * @param text - Text to chunk
         * @param options - Chunking options
         * @returns Array of text chunks with offsets
         *
         * @example
         * ```typescript
         * // Chunk with 2 sentence overlap
         * const chunks = yield* nlp.chunkText(text, {
         *   maxChunkSize: 500,
         *   preserveSentences: true,
         *   overlapSentences: 2
         * })
         * ```
         */
        chunkText: (
          text: string,
          options?: ChunkOptions
        ) =>
          Effect.sync(() => {
            // Apply strategy-specific defaults if strategy is provided
            const strategy = options?.strategy
            const strategyDefaults = strategy ? defaultChunkingParams[strategy] : undefined

            const maxChunkSize = options?.maxChunkSize ?? strategyDefaults?.chunkSize ?? 500
            const overlapSentences = options?.overlapSentences ?? strategyDefaults?.overlapSentences ?? 2
            const preserveSentences = options?.preserveSentences ?? strategyDefaults?.preserveSentences ?? true

            // Handle special chunking strategies
            if (strategy === "section_aware") {
              return chunkBySections(text, maxChunkSize, overlapSentences)
            }

            if (strategy === "speaker_aware") {
              return chunkBySpeakerTurns(text, maxChunkSize, overlapSentences)
            }

            if (strategy === "paragraph_based") {
              return chunkByParagraphs(text, maxChunkSize, overlapSentences)
            }

            // Standard sentence-aware chunking (standard, fine_grained, high_overlap)
            const doc = nlp.readDoc(text)
            const sentences = doc.sentences().out() as Array<string>

            if (sentences.length === 0) {
              return []
            }

            if (!preserveSentences) {
              // Simple character-based chunking (no overlap support)
              const chunks: Array<TextChunk> = []
              let currentChunk = ""
              let startOffset = 0

              for (const sentence of sentences) {
                if (currentChunk.length + sentence.length > maxChunkSize && currentChunk) {
                  chunks.push({
                    index: chunks.length,
                    text: currentChunk.trim(),
                    startOffset,
                    endOffset: startOffset + currentChunk.length
                  })
                  startOffset += currentChunk.length
                  currentChunk = ""
                }
                currentChunk += sentence + " "
              }

              if (currentChunk) {
                chunks.push({
                  index: chunks.length,
                  text: currentChunk.trim(),
                  startOffset,
                  endOffset: startOffset + currentChunk.length
                })
              }

              return chunks
            }

            // Sentence-aware chunking with overlap support
            // Calculate sentence positions manually since wink-nlp doesn't provide span() method
            const sentenceCollection = doc.sentences()
            const sentenceIndex: Array<{ text: string; startOffset: number; endOffset: number }> = []

            // Build sentence index by finding each sentence in the original text sequentially
            let searchOffset = 0
            sentenceCollection.each((sentence: any) => {
              const sentenceText = sentence.out()
              // Find sentence position in original text starting from last position
              // This ensures we get the correct position even if sentence text appears multiple times
              const startOffset = text.indexOf(sentenceText, searchOffset)
              const endOffset = startOffset + sentenceText.length

              sentenceIndex.push({
                text: sentenceText,
                startOffset: startOffset >= 0 ? startOffset : searchOffset,
                endOffset: startOffset >= 0 ? endOffset : searchOffset + sentenceText.length
              })

              // Update search offset to continue from end of this sentence
              searchOffset = startOffset >= 0 ? endOffset : searchOffset + sentenceText.length
            })

            const chunks: Array<TextChunk> = []
            const overlap = Math.max(0, overlapSentences)

            // Sliding window approach with overlap
            // Step size = window size - overlap (ensures overlap sentences are included in next chunk)
            let i = 0
            let chunkIndex = 0

            while (i < sentences.length) {
              // Build chunk by collecting sentences until we reach maxChunkSize
              const chunkSentences: Array<string> = []
              let chunkSize = 0

              // Collect sentences for this chunk
              for (let j = i; j < sentences.length; j++) {
                const sentence = sentences[j]
                const sentenceLength = sentence.length + (j > i ? 1 : 0) // +1 for space separator (except first)

                // Check if adding this sentence would exceed max size
                if (chunkSize + sentenceLength > maxChunkSize && chunkSentences.length > 0) {
                  break
                }

                chunkSentences.push(sentence)
                chunkSize += sentenceLength
              }

              if (chunkSentences.length > 0) {
                const chunkText = chunkSentences.join(" ")
                const chunkStartOffset = sentenceIndex[i]?.startOffset ?? 0
                const lastSentenceIdx = i + chunkSentences.length - 1
                const chunkEndOffset = sentenceIndex[lastSentenceIdx]?.endOffset ?? chunkStartOffset + chunkText.length

                chunks.push({
                  index: chunkIndex++,
                  text: chunkText,
                  startOffset: chunkStartOffset,
                  endOffset: chunkEndOffset
                })

                // Calculate step size: move forward by (chunk size - overlap)
                // This ensures the next chunk starts with `overlap` sentences from the previous chunk
                const step = Math.max(1, chunkSentences.length - overlap)
                i += step

                // If we've processed all sentences, break
                if (i >= sentences.length) {
                  break
                }
              } else {
                // Edge case: single sentence exceeds maxChunkSize - include it anyway
                const sentence = sentences[i]
                const chunkStartOffset = sentenceIndex[i]?.startOffset ?? 0
                const chunkEndOffset = sentenceIndex[i]?.endOffset ?? chunkStartOffset + sentence.length

                chunks.push({
                  index: chunkIndex++,
                  text: sentence,
                  startOffset: chunkStartOffset,
                  endOffset: chunkEndOffset
                })

                i += 1
              }
            }

            return chunks
          }),

        /**
         * Create BM25 search index from ontology context
         *
         * Builds an in-memory full-text search index using BM25 algorithm
         * from the ontology's classes and properties. The index maps IRIs
         * to domain models for retrieval after search.
         *
         * @param ontology - Ontology context to index
         * @param config - Optional BM25 parameters (k1, b, k)
         * @returns Effect yielding opaque OntologyBM25Index
         *
         * @example
         * ```typescript
         * const index = yield* nlp.createOntologyIndex(ontology)
         * ```
         */
        createOntologyIndex: (
          ontology: OntologyContext,
          config?: BM25Config
        ): Effect.Effect<OntologyBM25Index, Error> =>
          Effect.sync(() => {
            // Create BM25 search engine
            const engine = winkBM25()

            // Configure BM25 parameters
            const bm25Params = {
              k1: config?.k1 ?? 1.2,
              b: config?.b ?? 0.75,
              k: config?.k ?? 1
            }

            // Define configuration
            engine.defineConfig({
              fldWeights: { text: 1 }, // Field weights (text field has weight 1)
              bm25Params
            })

            // Define text preparation pipeline
            engine.definePrepTasks([(text: string) => prepareText(text, nlp)])

            // Get documents from ontology (returns [IRI, document] tuples)
            const documents = ontology.toDocuments()

            // Create mapping from IRI to domain model
            const domainModelMap = MutableHashMap.empty<string, ClassDefinition | PropertyDefinition>()

            // Add documents to index
            for (const [iri, document] of documents) {
              // Add document to BM25 index with IRI as ID
              engine.addDoc(
                {
                  text: document
                },
                iri
              )

              // Map IRI to domain model for later retrieval
              const classDef = ontology.getClass(iri)
              const propertyDef = ontology.getProperty(iri)
              if (O.isSome(classDef)) {
                MutableHashMap.set(domainModelMap, iri, classDef.value)
              } else if (O.isSome(propertyDef)) {
                MutableHashMap.set(domainModelMap, iri, propertyDef.value)
              }
            }

            // Consolidate index (required after adding docs)
            engine.consolidate()

            // Create opaque index reference
            const index: OntologyBM25Index = {
              _tag: "OntologyBM25Index",
              documentCount: documents.length,
              _engine: engine,
              _domainModelMap: domainModelMap,
              _ontology: ontology
            }

            return index
          }),

        /**
         * Search ontology BM25 index with query string
         *
         * Returns top-k ontology entities (classes/properties) ranked by BM25
         * relevance score. Results include the actual domain models for direct use.
         *
         * @param index - BM25 index created by createOntologyIndex
         * @param query - Search query string
         * @param limit - Maximum number of results (default: 10)
         * @returns Effect yielding ranked search results with domain models
         *
         * @example
         * ```typescript
         * const results = yield* nlp.searchOntologyIndex(index, "person entity", 5)
         * // Returns top 5 matching classes/properties
         * ```
         */
        searchOntologyIndex: (
          index: OntologyBM25Index,
          query: string,
          limit: number = 10
        ): Effect.Effect<ReadonlyArray<OntologySearchResult>, Error> =>
          Effect.gen(function*() {
            const engine = index._engine
            const domainModelMap = index._domainModelMap
            const ontology = index._ontology

            if (!engine || !domainModelMap || !ontology) {
              return yield* Effect.fail(new Error("Invalid BM25 index reference"))
            }

            // Search with query
            const rawResults = engine.search(query, limit)

            // Map results to OntologySearchResult format
            // wink-bm25 returns array of [id, score] tuples
            const results: Array<OntologySearchResult> = []
            for (const result of rawResults) {
              const [iri, score] = result as [string, number]
              const domainModel = MutableHashMap.get(domainModelMap, iri)

              if (O.isSome(domainModel)) {
                // Determine if it's a class or property
                const iriValue = IRI.fromUnknown(iri)
                const classDef = ontology.getClass(iriValue)
                const propertyDef = ontology.getProperty(iriValue)

                results.push({
                  iri,
                  score,
                  ...(O.isSome(classDef) ? { class: classDef.value } : {}),
                  ...(O.isSome(propertyDef) ? { property: propertyDef.value } : {})
                })
              }
            }

            return results
          }),

        /**
         * Create semantic search index from ontology context
         *
         * Builds an in-memory semantic index using Nomic embeddings from the ontology's
         * classes and properties. The index maps IRIs to domain models for retrieval.
         *
         * @param ontology - Ontology context to index
         * @returns Effect yielding opaque OntologySemanticIndex
         *
         * @example
         * ```typescript
         * const index = yield* nlp.createOntologySemanticIndex(ontology)
         * ```
         */
        createOntologySemanticIndex: (
          ontology: OntologyContext
        ): Effect.Effect<OntologySemanticIndex, Error> =>
          Effect.gen(function*() {
            // Get documents from ontology (returns [IRI, document] tuples)
            const documents = ontology.toDocuments()

            // Create mapping from IRI to embedding and domain model
            const embeddingMap = MutableHashMap.empty<string, ReadonlyArray<number>>()
            const domainModelMap = MutableHashMap.empty<string, ClassDefinition | PropertyDefinition>()

            // Extract document texts for batch embedding
            const iris = documents.map(([iri]) => iri)
            const texts = documents.map(([, document]) => document)

            // Use EmbeddingService.embedBatch for cached embedding computation
            // This checks the cache first, only computes embeddings for cache misses,
            // and stores new embeddings in the cache for future use
            const embeddings = yield* embedding.embedBatch(texts, "search_document").pipe(
              Effect.retry(embeddingRetrySchedule),
              Effect.timeout(Duration.millis(EMBEDDING_TIMEOUT_MS * texts.length)),
              Effect.catch(() => Effect.succeed([] as ReadonlyArray<ReadonlyArray<number>>))
            )

            // Store embeddings with their corresponding IRIs
            for (let i = 0; i < iris.length && i < embeddings.length; i++) {
              const iri = iris[i]
              const emb = embeddings[i]

              MutableHashMap.set(embeddingMap, iri, emb)

              // Map IRI to domain model for later retrieval
              const classDef = ontology.getClass(iri)
              const propertyDef = ontology.getProperty(iri)
              if (O.isSome(classDef)) {
                MutableHashMap.set(domainModelMap, iri, classDef.value)
              } else if (O.isSome(propertyDef)) {
                MutableHashMap.set(domainModelMap, iri, propertyDef.value)
              }
            }

            // Create opaque index reference
            const index: OntologySemanticIndex = {
              _tag: "OntologySemanticIndex",
              documentCount: MutableHashMap.size(embeddingMap),
              _embeddingMap: embeddingMap,
              _domainModelMap: domainModelMap,
              _ontology: ontology
            }

            return index
          }),

        /**
         * Create semantic search index from pre-computed embeddings
         *
         * Uses pre-computed embeddings (from OntologyEmbeddings blob) instead of
         * computing embeddings on-the-fly. Significantly faster for repeated workflows
         * against the same ontology.
         *
         * @param ontology - Ontology context to index
         * @param embeddings - Pre-computed embeddings blob
         * @returns Effect yielding opaque OntologySemanticIndex
         *
         * @example
         * ```typescript
         * const embeddings = yield* loadOntologyEmbeddings(embeddingsUri)
         * const index = yield* nlp.createOntologySemanticIndexFromPrecomputed(ontology, embeddings)
         * ```
         */
        createOntologySemanticIndexFromPrecomputed: (
          ontology: OntologyContext,
          embeddings: OntologyEmbeddings
        ): Effect.Effect<OntologySemanticIndex, Error> =>
          Effect.gen(function*() {
            const embeddingMap = MutableHashMap.empty<string, ReadonlyArray<number>>()
            const domainModelMap = MutableHashMap.empty<string, ClassDefinition | PropertyDefinition>()

            // Load class embeddings
            for (const classEmb of embeddings.classes) {
              MutableHashMap.set(embeddingMap, classEmb.iri, classEmb.embedding)
              const classDef = ontology.getClass(classEmb.iri)
              if (O.isSome(classDef)) {
                MutableHashMap.set(domainModelMap, classEmb.iri, classDef.value)
              }
            }

            // Load property embeddings
            for (const propEmb of embeddings.properties) {
              MutableHashMap.set(embeddingMap, propEmb.iri, propEmb.embedding)
              const propDef = ontology.getProperty(propEmb.iri)
              if (O.isSome(propDef)) {
                MutableHashMap.set(domainModelMap, propEmb.iri, propDef.value)
              }
            }

            yield* Effect.logInfo("Created semantic index from pre-computed embeddings", {
              classCount: embeddings.classes.length,
              propertyCount: embeddings.properties.length,
              indexedCount: MutableHashMap.size(embeddingMap)
            })

            const index: OntologySemanticIndex = {
              _tag: "OntologySemanticIndex",
              documentCount: MutableHashMap.size(embeddingMap),
              _embeddingMap: embeddingMap,
              _domainModelMap: domainModelMap,
              _ontology: ontology
            }

            return index
          }),

        /**
         * Search ontology semantic index with query string
         *
         * Returns top-k ontology entities (classes/properties) ranked by cosine similarity
         * of their embeddings to the query embedding. Results include the actual domain models
         * for direct use. More robust to paraphrasing than BM25.
         *
         * @param index - Semantic index created by createOntologySemanticIndex
         * @param query - Search query string
         * @param limit - Maximum number of results (default: 10)
         * @returns Effect yielding ranked search results with domain models
         *
         * @example
         * ```typescript
         * const results = yield* nlp.searchOntologySemanticIndex(index, "athlete person", 5)
         * // Returns top 5 semantically similar classes/properties
         * ```
         */
        searchOntologySemanticIndex: (
          index: OntologySemanticIndex,
          query: string,
          limit: number = 10
        ): Effect.Effect<ReadonlyArray<OntologySearchResult>, Error> =>
          Effect.gen(function*() {
            const embeddingMap = index._embeddingMap
            const domainModelMap = index._domainModelMap
            const ontology = index._ontology

            if (!embeddingMap || !domainModelMap || !ontology) {
              return yield* Effect.fail(new Error("Invalid semantic index reference"))
            }

            // Compute query embedding using provider-agnostic EmbeddingService
            const queryEmbedding = yield* embedding.embed(query, "search_query").pipe(
              Effect.retry(embeddingRetrySchedule),
              Effect.timeout(Duration.millis(EMBEDDING_TIMEOUT_MS))
            )

            // Compute cosine similarity for each document
            const results: Array<OntologySearchResult & { score: number }> = []
            for (const [iri, docEmbedding] of embeddingMap) {
              const score = embedding.cosineSimilarity(queryEmbedding, docEmbedding)

              if (score > 0) {
                const domainModel = MutableHashMap.get(domainModelMap, iri)
                if (O.isSome(domainModel)) {
                  // Determine if it's a class or property
                  const iriValue = IRI.fromUnknown(iri)
                  const classDef = ontology.getClass(iriValue)
                  const propertyDef = ontology.getProperty(iriValue)

                  results.push({
                    iri,
                    score,
                    ...(O.isSome(classDef) ? { class: classDef.value } : {}),
                    ...(O.isSome(propertyDef) ? { property: propertyDef.value } : {})
                  })
                }
              }
            }

            // Sort by score descending and take top-k
            return A.take(A.sortWith(results, (result) => -result.score, Order.Number), limit)
          })
      }
    }),
  }
) {
    static readonly Default = Layer.effect(this, this.make).pipe(Layer.provide([
              // EmbeddingServiceDefault requires EmbeddingProvider | EmbeddingCache | MetricsService
              // Provider selection (Nomic vs Voyage) is handled by runtime layer composition
              // This ensures NlpService uses the same provider as the rest of the system
              EmbeddingServiceDefault
            ]));
}
