/**
 * Service: NLP Services
 *
 * **Details**
 *
 * Stateless NLP operations using wink-nlp.
 * Provides tokenization, BM25 search, and text chunking.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import type { BM25Config } from "@beep/nlp/Core/Vectorization";
import { DefaultBM25Config } from "@beep/nlp/Core/Vectorization";
import { Tokenization } from "@beep/nlp-processing/Core";
import { IRI } from "@beep/rdf";
import { LiteralKit } from "@beep/schema";
import { NonNegativeInt, PosInt } from "@beep/schema/Int";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { WinkTokenizationError } from "@beep/wink/Wink.errors";
import { WinkLayerAllLive } from "@beep/wink/Wink.layer";
import { WinkStringArray } from "@beep/wink/Wink.models";
import { WinkEngine } from "@beep/wink/Wink.service";
import { WinkCorpusManager } from "@beep/wink/WinkCorpus.service";
import {
  Context,
  Duration,
  Effect,
  Inspectable,
  Layer,
  Match,
  MutableHashMap,
  Order,
  pipe,
  Schedule,
  SchemaGetter,
  Tuple,
} from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { OntologyContext } from "../Domain/Model/Ontology.ts";
import { ClassDefinition, PropertyDefinition } from "../Domain/Model/Ontology.ts";
import type { OntologyEmbeddings } from "../Domain/Model/OntologyEmbeddings.ts";
import { ChunkingParams, ChunkingStrategy } from "../Domain/Schema/DocumentMetadata.ts";
import { enhanceTextForSearch } from "../Utils/Text.ts";
import { EmbeddingService, EmbeddingServiceDefault } from "./Embedding.ts";

const SimilaritySearchResultOrder = Order.mapInput(
  Order.flip(Order.Number),
  (result: { readonly score: number }) => result.score
);

const $I = $ScratchpadId.create("effect-ontology/Service/Nlp");
const NlpIndexKind = LiteralKit(["bm25", "semantic"]).pipe(
  $I.annoteSchema("NlpIndexKind", {
    description: "Opaque ontology index implementations accepted by the NLP search service.",
  })
);

/**
 * Tokenization result
 *
 * **Example** (Represent tokenized text)
 *
 * ```ts
 * import { TokenizeResult } from "@effect-ontology/Service/Nlp"
 *
 * const result = TokenizeResult.make({ tokens: ["ada"], sentences: ["Ada."], entities: ["Ada"] })
 * console.log(result.tokens[0]) // "ada"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TokenizeResult extends S.Class<TokenizeResult>($I`TokenizeResult`)(
  {
    tokens: S.Array(S.String),
    sentences: S.Array(S.String),
    entities: S.Array(S.String),
  },
  $I.annote("TokenizeResult", {
    description: "Token, sentence, and named-entity text emitted by one tokenization pass.",
  })
) {}

/**
 * BM25 similarity result
 *
 * **Example** (Represent a ranked document)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { SimilarityResult } from "@effect-ontology/Service/Nlp"
 *
 * const result = SimilarityResult.make({ doc: "semantic graph", score: 0.9, index: NonNegativeInt.make(0) })
 * console.log(result.score) // 0.9
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SimilarityResult extends S.Class<SimilarityResult>($I`SimilarityResult`)(
  {
    doc: S.String,
    score: S.Finite,
    index: NonNegativeInt,
  },
  $I.annote("SimilarityResult", {
    description: "Source document, finite similarity score, and stable input position for one ranked match.",
  })
) {}

class TextChunkModel extends S.Class<TextChunkModel>($I`TextChunkModel`)(
  {
    index: NonNegativeInt,
    text: S.String,
    startOffset: NonNegativeInt,
    endOffset: NonNegativeInt,
  },
  $I.annote("TextChunkModel", {
    description: "Zero-based source-aligned text chunk with non-negative UTF-16 offsets.",
  })
) {}

const TextChunkDefinition = TextChunkModel.check(
  S.makeFilter(({ endOffset, startOffset }) => endOffset >= startOffset, {
    identifier: $I`TextChunkOffsetOrderCheck`,
    title: "Text Chunk Offset Order",
    description: "Checks that a text chunk ends at or after its source start offset.",
    message: "Expected endOffset to be greater than or equal to startOffset.",
  })
);

/**
 * Source-aligned text chunk with ordered UTF-16 offsets.
 *
 * **Example** (Represent a source-aligned chunk)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { TextChunk } from "@effect-ontology/Service/Nlp"
 *
 * const chunk = TextChunk.make({
 *   index: NonNegativeInt.make(0),
 *   text: "Ada.",
 *   startOffset: NonNegativeInt.make(0),
 *   endOffset: NonNegativeInt.make(4)
 * })
 * console.log(chunk.endOffset - chunk.startOffset) // 4
 * ```
 *
 * @invariant `endOffset` is greater than or equal to `startOffset`.
 * @category models
 * @since 0.0.0
 */
export const TextChunk = TextChunkDefinition.pipe(
  $I.annoteSchema("TextChunk", {
    description: "Zero-based source-aligned text chunk whose UTF-16 offsets are non-negative and ordered.",
    toArbitrary: () => (fc) => S.toArbitrary(TextChunkModel)(fc).filter(S.is(TextChunkDefinition)),
  })
);

/**
 * Decoded source-aligned chunk produced by {@link TextChunk}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type TextChunk = typeof TextChunk.Type;

class ChunkOptionsInput extends S.Class<ChunkOptionsInput>($I`ChunkOptionsInput`)(
  {
    preserveSentences: S.OptionFromOptionalKey(ChunkingParams.fields.preserveSentences),
    maxChunkSize: S.OptionFromOptionalKey(ChunkingParams.fields.chunkSize),
    overlapSentences: S.OptionFromOptionalKey(ChunkingParams.fields.overlapSentences),
    strategy: S.OptionFromOptionalKey(ChunkingStrategy),
  },
  $I.annote("ChunkOptionsInput", {
    description: "Optional overrides derived from the canonical chunk-parameter domains and strategy registry.",
  })
) {}

class ResolvedChunkOptions extends S.Class<ResolvedChunkOptions>($I`ResolvedChunkOptions`)(
  {
    strategy: ChunkingStrategy,
    params: ChunkingParams,
  },
  $I.annote("ResolvedChunkOptions", {
    description: "Selected chunking strategy paired with one complete canonical parameter set.",
  })
) {}

const resolveChunkOptions = (options: ChunkOptionsInput): ResolvedChunkOptions => {
  const strategy = O.getOrElse(options.strategy, () => ChunkingStrategy.Enum.standard);
  const defaults = ChunkingStrategy.parameters(strategy);
  return ResolvedChunkOptions.make({
    strategy,
    params: ChunkingParams.make({
      chunkSize: O.getOrElse(options.maxChunkSize, () => defaults.chunkSize),
      overlapSentences: O.getOrElse(options.overlapSentences, () => defaults.overlapSentences),
      preserveSentences: O.getOrElse(options.preserveSentences, () => defaults.preserveSentences),
    }),
  });
};

const encodeChunkOptions = (options: ResolvedChunkOptions): ChunkOptionsInput =>
  ChunkOptionsInput.make({
    strategy: O.some(options.strategy),
    maxChunkSize: O.some(options.params.chunkSize),
    overlapSentences: O.some(options.params.overlapSentences),
    preserveSentences: O.some(options.params.preserveSentences),
  });

/**
 * Optional chunking overrides decoded to a complete canonical strategy configuration.
 *
 * **Example** (Resolve fine-grained defaults)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ChunkOptions } from "@effect-ontology/Service/Nlp"
 *
 * const options = S.decodeOption(ChunkOptions)({ strategy: "fine_grained" })
 * console.log(O.map(options, (value) => value.params.chunkSize)) // Some(300)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const ChunkOptions = ChunkOptionsInput.pipe(
  S.decodeTo(S.toType(ResolvedChunkOptions), {
    decode: SchemaGetter.transform(resolveChunkOptions),
    encode: SchemaGetter.transform(encodeChunkOptions),
  }),
  SchemaUtils.withCodecStatics(["decodeEffect"]),
  $I.annoteSchema("ChunkOptions", {
    description: "Optional chunk overrides decoded to one complete canonical strategy parameter set.",
    toArbitrary: () => (fc) => S.toArbitrary(ResolvedChunkOptions)(fc),
  })
);

/**
 * Complete chunking configuration decoded by {@link ChunkOptions}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ChunkOptions = typeof ChunkOptions.Type;

/**
 * Opaque BM25 index handle for ontology search.
 *
 * **Details**
 *
 * This remains a type-level handle because it owns live mutable hash maps and
 * an in-memory ontology reference; it is not serializable boundary data.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface OntologyBM25Index {
  readonly _tag: "OntologyBM25Index";
  readonly documentCount: number;
  readonly _corpusId: string;
  readonly _domainModelMap: MutableHashMap.MutableHashMap<string, ClassDefinition | PropertyDefinition>;
  readonly _ontology: OntologyContext;
}

/**
 * Opaque semantic index handle for ontology search.
 *
 * **Details**
 *
 * This remains a type-level handle because it owns mutable embedding and
 * domain-model maps plus an in-memory ontology reference.
 *
 * @category type-level
 * @since 0.0.0
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
 * **Example** (Identify an invalid BM25 index)
 *
 * ```ts
 * import { NlpIndexError } from "@effect-ontology/Service/Nlp"
 * import * as O from "effect/Option"
 *
 * const error = NlpIndexError.make({
 *   indexKind: "bm25",
 *   message: "Invalid BM25 index reference",
 *   cause: O.none()
 * })
 * console.log(error._tag) // "NlpIndexError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class NlpIndexError extends S.TaggedError<NlpIndexError>($I`NlpIndexError`)(
  "NlpIndexError",
  {
    indexKind: NlpIndexKind,
    message: S.String,
    cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true })),
  },
  $I.annote("NlpIndexError", {
    description: "Failure caused by an invalid ontology index or its backing canonical Wink query.",
  })
) {}

const decodeWinkStrings = (value: unknown, operation: string, text: string) =>
  WinkStringArray.decodeUnknownEffect(value).pipe(
    Effect.mapError((cause) => WinkTokenizationError.fromCause(cause, operation, { text }))
  );

const OntologySearchResultKind = LiteralKit(["class", "property"]).pipe(
  $I.annoteSchema("OntologySearchResultKind", {
    description: "Ontology definition kinds returned by text and semantic search.",
  })
);

class OntologySearchResultBase extends S.Class<OntologySearchResultBase>($I`OntologySearchResultBase`)(
  {
    iri: IRI,
    score: S.Finite,
  },
  $I.annote("OntologySearchResultBase", {
    description: "IRI and finite relevance score shared by every ontology search hit.",
  })
) {}

class ClassOntologySearchResult extends OntologySearchResultBase.extend<ClassOntologySearchResult>(
  $I`ClassOntologySearchResult`
)(
  {
    kind: S.tag(OntologySearchResultKind.Enum.class),
    definition: ClassDefinition,
  },
  $I.annote("ClassOntologySearchResult", {
    description: "Ontology search hit carrying a class definition.",
  })
) {}

class PropertyOntologySearchResult extends OntologySearchResultBase.extend<PropertyOntologySearchResult>(
  $I`PropertyOntologySearchResult`
)(
  {
    kind: S.tag(OntologySearchResultKind.Enum.property),
    definition: PropertyDefinition,
  },
  $I.annote("PropertyOntologySearchResult", {
    description: "Ontology search hit carrying a property definition.",
  })
) {}

/**
 * Finite-scored ontology search hit discriminated as a class or property definition.
 *
 * **Example** (Represent a class search hit)
 *
 * ```ts
 * import { IRI } from "@beep/rdf"
 * import { ClassDefinition } from "@effect-ontology/Model/Ontology"
 * import { OntologySearchResult } from "@effect-ontology/Service/Nlp"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const iri = IRI.make("https://schema.org/Person")
 * const result = O.map(
 *   S.decodeOption(ClassDefinition)({ id: iri, label: "Person" }),
 *   (definition) => OntologySearchResult.cases.class.make({ iri, score: 0.8, definition })
 * )
 * console.log(O.map(result, OntologySearchResult.guards.class)) // Some(true)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OntologySearchResult = OntologySearchResultKind.mapMembers(
  Tuple.evolve([() => ClassOntologySearchResult, () => PropertyOntologySearchResult])
).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("OntologySearchResult", {
    description: "Finite-scored ontology search hit discriminated as a class or property definition.",
  })
);

/**
 * Class or property search hit decoded by {@link OntologySearchResult}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type OntologySearchResult = typeof OntologySearchResult.Type;

const isClassDefinition = S.is(ClassDefinition);

const ontologySearchResultCase = Match.type<ClassDefinition | PropertyDefinition>().pipe(
  Match.when(
    isClassDefinition,
    (definition) => (iri: IRI, score: number) => OntologySearchResult.cases.class.make({ iri, score, definition })
  ),
  Match.orElse(
    (definition) => (iri: IRI, score: number) => OntologySearchResult.cases.property.make({ iri, score, definition })
  )
);

const makeOntologySearchResult = (
  iri: IRI,
  score: number,
  definition: ClassDefinition | PropertyDefinition
): OntologySearchResult => ontologySearchResultCase(definition)(iri, score);

const makeTextChunk = (index: number, text: string, startOffset: number, endOffset: number): TextChunk =>
  TextChunk.make({
    index: NonNegativeInt.make(index),
    text,
    startOffset: NonNegativeInt.make(startOffset),
    endOffset: NonNegativeInt.make(endOffset),
  });

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

const makePatternChunker =
  (boundaryPattern: RegExp) =>
  (text: string, maxChunkSize: number, _overlapSentences: number): Array<TextChunk> => {
    const chunks: Array<TextChunk> = [];
    let chunkIndex = 0;

    const boundaryOffsets: Array<number> = [];
    const pattern = new RegExp(boundaryPattern.source, boundaryPattern.flags);
    let match = pattern.exec(text);
    while (P.isNotNull(match)) {
      boundaryOffsets.push(match.index);
      match = pattern.exec(text);
    }

    if (A.isReadonlyArrayEmpty(boundaryOffsets)) {
      return chunkBySize(text, maxChunkSize, chunkIndex);
    }

    const firstBoundaryOffset = boundaryOffsets[0];
    if (firstBoundaryOffset > 0) {
      const preText = Str.trim(Str.slice(0, firstBoundaryOffset)(text));
      if (preText.length > 0) {
        const preChunks = chunkBySize(preText, maxChunkSize, chunkIndex);
        for (const chunk of preChunks) {
          chunks.push(chunk);
        }
        chunkIndex += preChunks.length;
      }
    }

    for (let index = 0; index < boundaryOffsets.length; index++) {
      const startOffset = boundaryOffsets[index];
      const endOffset = boundaryOffsets[index + 1] ?? text.length;
      const boundaryText = Str.trim(Str.slice(startOffset, endOffset)(text));

      if (Str.isEmpty(boundaryText)) continue;

      if (boundaryText.length <= maxChunkSize) {
        chunks.push(makeTextChunk(chunkIndex++, boundaryText, startOffset, endOffset));
      } else {
        const boundaryChunks = chunkBySize(boundaryText, maxChunkSize, chunkIndex);
        for (const chunk of boundaryChunks) {
          chunks.push(
            makeTextChunk(chunkIndex++, chunk.text, startOffset + chunk.startOffset, startOffset + chunk.endOffset)
          );
        }
      }
    }

    return chunks;
  };

/**
 * Chunk text by section headers
 *
 * Splits on markdown headers (##, ###) or numbered sections (1., 1.1).
 * Each section becomes a chunk, with overflow split by sentences.
 */
const chunkBySections = makePatternChunker(SECTION_HEADER_PATTERN);

/**
 * Chunk text by speaker turns
 *
 * Splits on speaker patterns like "Name:", "SPEAKER 1:", "[Interviewer]:".
 * Each speaker turn becomes a chunk, with overflow split by sentences.
 */
const chunkBySpeakerTurns = makePatternChunker(SPEAKER_TURN_PATTERN);

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
  const paragraphs = Str.split(PARAGRAPH_SEPARATOR)(text);

  for (const paragraph of paragraphs) {
    const trimmedParagraph = Str.trim(paragraph);
    if (trimmedParagraph.length === 0) {
      // Skip empty paragraphs but track offset
      currentOffset += paragraph.length + 2; // +2 for the \n\n
      continue;
    }

    // Find actual position in original text
    const startOffset = text.indexOf(trimmedParagraph, currentOffset);
    const endOffset = startOffset + trimmedParagraph.length;

    if (trimmedParagraph.length <= maxChunkSize) {
      chunks.push(
        makeTextChunk(
          chunkIndex++,
          trimmedParagraph,
          startOffset >= 0 ? startOffset : currentOffset,
          startOffset >= 0 ? endOffset : currentOffset + trimmedParagraph.length
        )
      );
    } else {
      // Paragraph too large - split by sentences
      const paraChunks = chunkBySize(trimmedParagraph, maxChunkSize, chunkIndex);
      for (const chunk of paraChunks) {
        const chunkStart = startOffset >= 0 ? startOffset + chunk.startOffset : currentOffset + chunk.startOffset;
        chunks.push(makeTextChunk(chunkIndex++, chunk.text, chunkStart, chunkStart + chunk.text.length));
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
  let sentenceMatch = sentencePattern.exec(text);
  while (P.isNotNull(sentenceMatch)) {
    sentences.push(text.slice(lastEnd, sentenceMatch.index + sentenceMatch[0].length));
    lastEnd = sentenceMatch.index + sentenceMatch[0].length;
    sentenceMatch = sentencePattern.exec(text);
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
      chunks.push(makeTextChunk(chunkIndex++, Str.trim(currentChunk), startOffset, currentOffset));
      startOffset = currentOffset;
      currentChunk = "";
    }
    currentChunk += sentence;
    currentOffset += sentence.length;
  }

  // Add final chunk
  if (Str.length(Str.trim(currentChunk)) > 0) {
    chunks.push(makeTextChunk(chunkIndex++, Str.trim(currentChunk), startOffset, currentOffset));
  }

  return chunks;
}

type SpecializedChunker = (text: string, maxChunkSize: number, overlapSentences: number) => Array<TextChunk>;

const chunkerForStrategy = ChunkingStrategy.$match({
  standard: O.none<SpecializedChunker>,
  fine_grained: O.none<SpecializedChunker>,
  high_overlap: O.none<SpecializedChunker>,
  section_aware: () => O.some(chunkBySections),
  speaker_aware: () => O.some(chunkBySpeakerTurns),
  paragraph_based: () => O.some(chunkByParagraphs),
});

const EMBEDDING_TIMEOUT = Duration.seconds(10);

type WinkSentenceView = {
  readonly out: () => string;
};

/**
 * Provides the nlp service service capability.
 *
 * **Example** (Tokenize through the service)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { NlpService } from "@effect-ontology/Service/Nlp"
 *
 * const program = Effect.gen(function* () {
 *   const nlp = yield* NlpService
 *   return yield* nlp.tokenize("Ada founded Acme.")
 * }).pipe(Effect.provide(NlpService.Default))
 *
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class NlpService extends Context.Service<NlpService>()($I`NlpService`, {
  make: Effect.gen(function* () {
    const embedding = yield* EmbeddingService;
    const tokenization = yield* Tokenization;
    const winkEngine = yield* WinkEngine;
    const corpora = yield* WinkCorpusManager;

    return {
      tokenize: Effect.fn("NlpService.tokenize")(function* (text: string) {
        const doc = yield* winkEngine.getWinkDoc(text);
        const its = yield* winkEngine.its;
        const [tokens, sentences, entities] = yield* Effect.all(
          [
            decodeWinkStrings(doc.tokens().out(its.normal), "normalizedTokens", text),
            decodeWinkStrings(doc.sentences().out(), "sentences", text),
            decodeWinkStrings(doc.entities().out(), "entities", text),
          ],
          { concurrency: 3 }
        );
        return TokenizeResult.make({ tokens, sentences, entities });
      }),
      searchSimilar: Effect.fn("NlpService.searchSimilar")(function* (
        query: string,
        docs: ReadonlyArray<string>,
        k: PosInt = PosInt.make(5)
      ) {
        const corpus = yield* corpora.createCorpus();
        return yield* Effect.gen(function* () {
          const documents = yield* Effect.all(
            A.map(docs, (text, index) =>
              tokenization.document(enhanceTextForSearch(text, 2), `${corpus.corpusId}-${index}`)
            )
          );
          yield* corpora.learnDocuments({ corpusId: corpus.corpusId, documents });
          const queryResult = yield* corpora.query({ corpusId: corpus.corpusId, query, topN: k });
          return A.map(queryResult.ranked, (result): SimilarityResult => {
            const index = Number.parseInt(result.id.slice(result.id.lastIndexOf("-") + 1), 10);
            return SimilarityResult.make({ doc: docs[index], index: NonNegativeInt.make(index), score: result.score });
          });
        }).pipe(Effect.ensuring(corpora.deleteCorpus(corpus.corpusId)));
      }),
      searchSemantic: Effect.fn("NlpService.searchSemantic")(function* (
        query: string,
        docs: ReadonlyArray<string>,
        k: PosInt = PosInt.make(5)
      ) {
        const queryVector = yield* embedding
          .embed(query, "search_query")
          .pipe(Effect.retry(embeddingRetrySchedule), Effect.timeout(EMBEDDING_TIMEOUT));
        const docEmbeddings = yield* Effect.forEach(docs, (doc, index) => embedding.embed(doc, "search_document").pipe(Effect.retry(embeddingRetrySchedule), Effect.timeout(EMBEDDING_TIMEOUT), Effect.map(docVector => O.some({ doc, index, embedding: docVector })), Effect.tapError(error => Effect.logWarning("Embedding failed after retries", {
    docPreview: doc.slice(0, 100),
    error: Inspectable.toStringUnknown(error),
})), Effect.orElseSucceed(O.none)), { concurrency: 5 });

        return pipe(
          A.getSomes(docEmbeddings),
          A.map(({ doc, embedding: docVector, index }) => {
            const score = embedding.cosineSimilarity(queryVector, docVector);
            return SimilarityResult.make({
              doc,
              index: NonNegativeInt.make(index),
              score,
            });
          }),
          A.filter((result) => result.score > 0),
          A.sort(SimilaritySearchResultOrder),
          A.take(k)
        );
      }),
      chunkText: Effect.fn("NlpService.chunkText")(function* (text: string, options: typeof ChunkOptions.Encoded = {}) {
        const decodedOptions = yield* ChunkOptions.decodeEffect(options);
        const { params, strategy } = decodedOptions;
        const maxChunkSize = params.chunkSize;
        const overlapSentences = params.overlapSentences;
        const preserveSentences = params.preserveSentences;
        const specializedChunker = chunkerForStrategy(strategy);
        if (O.isSome(specializedChunker)) {
          return specializedChunker.value(text, maxChunkSize, overlapSentences);
        }
        const doc = yield* winkEngine.getWinkDoc(text);
        const sentences = yield* decodeWinkStrings(doc.sentences().out(), "sentences", text);
        if (sentences.length === 0) {
          return [];
        }
        if (!preserveSentences) {
          const chunks: Array<TextChunk> = [];
          let currentChunk = "";
          let startOffset = 0;
          for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > maxChunkSize && P.isTruthy(currentChunk)) {
              chunks.push(
                makeTextChunk(chunks.length, Str.trim(currentChunk), startOffset, startOffset + currentChunk.length)
              );
              startOffset += currentChunk.length;
              currentChunk = "";
            }
            currentChunk += `${sentence} `;
          }
          if (P.isTruthy(currentChunk)) {
            chunks.push(
              makeTextChunk(chunks.length, Str.trim(currentChunk), startOffset, startOffset + currentChunk.length)
            );
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
        sentenceCollection.each((sentence: WinkSentenceView) => {
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
            chunks.push(makeTextChunk(chunkIndex++, chunkText, chunkStartOffset, chunkEndOffset));
            const step = Math.max(1, chunkSentences.length - overlap);
            i += step;
            if (i >= sentences.length) {
              break;
            }
          } else {
            const sentence = sentences[i];
            const chunkStartOffset = sentenceIndex[i]?.startOffset ?? 0;
            const chunkEndOffset = sentenceIndex[i]?.endOffset ?? chunkStartOffset + sentence.length;
            chunks.push(makeTextChunk(chunkIndex++, sentence, chunkStartOffset, chunkEndOffset));
            i += 1;
          }
        }
        return chunks;
      }),
      createOntologyIndex: Effect.fn("NlpService.createOntologyIndex")(function* (
        ontology: OntologyContext,
        config: BM25Config = DefaultBM25Config
      ) {
        const documents = ontology.toDocuments();
        const domainModelMap = MutableHashMap.empty<string, ClassDefinition | PropertyDefinition>();
        const corpus = yield* corpora.createCorpus({ bm25Config: config });
        const corpusDocuments = yield* Effect.all(
          A.map(documents, ([iri, document]) => tokenization.document(enhanceTextForSearch(document, 2), iri))
        );
        yield* corpora.learnDocuments({ corpusId: corpus.corpusId, documents: corpusDocuments });
        for (const [iri] of documents) {
          const classDef = ontology.getClass(iri);
          const propertyDef = ontology.getProperty(iri);
          if (O.isSome(classDef)) {
            MutableHashMap.set(domainModelMap, iri, classDef.value);
          } else if (O.isSome(propertyDef)) {
            MutableHashMap.set(domainModelMap, iri, propertyDef.value);
          }
        }
        const index: OntologyBM25Index = {
          _tag: "OntologyBM25Index",
          documentCount: documents.length,
          _corpusId: corpus.corpusId,
          _domainModelMap: domainModelMap,
          _ontology: ontology,
        };
        return index;
      }),
      searchOntologyIndex: Effect.fn("NlpService.searchOntologyIndex")(function* (
        index: OntologyBM25Index,
        query: string,
        limit: PosInt = PosInt.make(10)
      ): Effect.fn.Return<ReadonlyArray<OntologySearchResult>, NlpIndexError> {
          const corpusId = index._corpusId;
          const domainModelMap = index._domainModelMap;
          const ontology = index._ontology;
          if (P.not(P.isTruthy)(corpusId) || P.not(P.isTruthy)(domainModelMap) || P.not(P.isTruthy)(ontology)) {
            return yield* NlpIndexError.make({
              indexKind: "bm25",
              message: "Invalid BM25 index reference",
              cause: O.none(),
            });
          }
          const queryResult = yield* corpora.query({ corpusId, query, topN: limit }).pipe(
            Effect.mapError((cause) =>
              NlpIndexError.make({
                indexKind: "bm25",
                message: `Canonical Wink corpus query failed: ${cause.message}`,
                cause: O.some(cause),
              })
            )
          );
          const results: Array<OntologySearchResult> = [];
          for (const result of queryResult.ranked) {
            const iri = result.id;
            const domainModel = MutableHashMap.get(domainModelMap, iri);
            if (O.isSome(domainModel)) {
              const iriValue = IRI.decodeUnknownSync(iri);
              results.push(makeOntologySearchResult(iriValue, result.score, domainModel.value));
            }
          }
        return results;
      }),
      createOntologySemanticIndex: Effect.fn("NlpService.createOntologySemanticIndex")(function* (
        ontology: OntologyContext
      ) {
        const documents = ontology.toDocuments();
        const embeddingMap = MutableHashMap.empty<string, ReadonlyArray<number>>();
        const domainModelMap = MutableHashMap.empty<string, ClassDefinition | PropertyDefinition>();
        const iris = documents.map(([iri]) => iri);
        const texts = documents.map(([, document]) => document);
        const embeddings = yield* embedding.embedBatch(texts, "search_document").pipe(
          Effect.retry(embeddingRetrySchedule),
          Effect.timeout(Duration.times(EMBEDDING_TIMEOUT, texts.length)),
          Effect.tapError((cause) =>
            Effect.logWarning("Ontology semantic index embedding failed", {
              documentCount: texts.length,
              cause,
            })
          )
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
      createOntologySemanticIndexFromPrecomputed: Effect.fn("NlpService.createOntologySemanticIndexFromPrecomputed")(
        function* (
        ontology: OntologyContext,
        embeddings: OntologyEmbeddings
        ): Effect.fn.Return<OntologySemanticIndex> {
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
        }
      ),
      searchOntologySemanticIndex: Effect.fn("NlpService.searchOntologySemanticIndex")(function* (
        index: OntologySemanticIndex,
        query: string,
        limit: PosInt = PosInt.make(10)
      ) {
        const embeddingMap = index._embeddingMap;
        const domainModelMap = index._domainModelMap;
        const ontology = index._ontology;
        if (P.not(P.isTruthy)(embeddingMap) || P.not(P.isTruthy)(domainModelMap) || P.not(P.isTruthy)(ontology)) {
          return yield* NlpIndexError.make({
            indexKind: "semantic",
            message: "Invalid semantic index reference",
            cause: O.none(),
          });
        }
        const queryEmbedding = yield* embedding
          .embed(query, "search_query")
          .pipe(Effect.retry(embeddingRetrySchedule), Effect.timeout(EMBEDDING_TIMEOUT));
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
              const iriValue = IRI.decodeUnknownSync(iri);
              results.push(makeOntologySearchResult(iriValue, score, domainModel.value));
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
      WinkLayerAllLive,
    ])
  );
}
