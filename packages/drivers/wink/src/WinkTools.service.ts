/**
 * Live NLP toolkit composed from wink-backed services and tool definitions.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $WinkId } from "@beep/identity";
import { BracketStringToPatternElement } from "@beep/nlp/Core";
import { DocumentId } from "@beep/nlp/Core/Document";
import { DocumentTermSet, TverskyParams } from "@beep/nlp/Core/Similarity";
import { BagOfWords } from "@beep/nlp/Core/Vectorization";
import { Tokenization } from "@beep/nlp-processing/Core";
import { NlpToolkit } from "@beep/nlp-processing/Tools/NlpToolkit";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A, Str, thunk0, thunkEmptyReadonlyArray, thunkEmptyStr, thunkFalse } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Chunk, Clock, Effect, flow, Inspectable, identity, Layer, Match, Order, pipe } from "effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { ascendingNumber, ascendingString, descendingNumber } from "./internal/order.ts";
import { WinkEngineError } from "./Wink.errors.ts";
import { WinkLayerAllLive } from "./Wink.layer.ts";
import { CustomEntityExample, EntityGroupName, WinkEngineCustomEntities } from "./Wink.models.ts";
import { WinkEngine } from "./Wink.service.ts";
import { CorpusManagerError, WinkCorpusManager } from "./WinkCorpus.service.ts";
import { observeWinkTool, textLengthAttribute } from "./WinkObservability.ts";
import { SimilarityError, WinkSimilarity } from "./WinkSimilarity.service.ts";
import { WinkUtils, WinkUtilsError } from "./WinkUtils.service.ts";
import { VectorizerError, WinkVectorizer } from "./WinkVectorizer.service.ts";
import type { Token } from "@beep/nlp/Core/Token";
import type { BM25Norm } from "@beep/nlp/Core/Vectorization";
import type { AiToolError } from "@beep/nlp-processing/Tools";
import type { Tool } from "effect/unstable/ai";

const $I = $WinkId.create("Tools/NlpToolkit");

const emptyTermBag = R.empty<string, number>();

const unwrapOptionString = O.match<string, string>({
  onNone: thunkEmptyStr,
  onSome: identity,
});

const alphaNumericShape = /[Xxd]/;
const hasAlphaNumericShape = (shape: string): boolean => alphaNumericShape.test(shape);

const isPunctuationToken = (token: Token): boolean =>
  O.match(token.shape, {
    onNone: thunkFalse,
    onSome: P.not(hasAlphaNumericShape),
  });

const isWordLikeToken = (token: Token): boolean => !isPunctuationToken(token) && /[\p{L}\p{N}]/u.test(token.text);

const normalizedTokenText = (token: Token): string => token.normal.pipe(O.getOrElse(() => token.text));

const normalizeTerm = flow(normalizedTokenText, Str.trim);

const optionalEntry = <Key extends string, Value>(
  key: Key,
  value: Value | undefined
): O.Option<readonly [Key, Value]> =>
  pipe(
    value,
    O.fromNullishOr,
    O.map((definedValue): readonly [Key, Value] => [key, definedValue] as const)
  );

const optionalRecord = (entries: ReadonlyArray<O.Option<readonly [string, unknown]>>): Record<string, unknown> =>
  A.reduce(entries, R.empty<string, unknown>(), (record, entry) =>
    O.match(entry, {
      onNone: () => record,
      onSome: ([key, value]) => ({
        ...record,
        [key]: value,
      }),
    })
  );

const buildCreateCorpusParameters = (params: {
  readonly bm25Config?: {
    readonly b?: number;
    readonly k?: number;
    readonly k1?: number;
    readonly norm?: BM25Norm;
  };
  readonly corpusId?: string;
}) =>
  optionalRecord([
    optionalEntry("corpusId", params.corpusId),
    pipe(
      params.bm25Config,
      O.fromNullishOr,
      O.map((bm25Config): readonly ["bm25Config", Record<string, unknown>] => [
        "bm25Config",
        optionalRecord([
          optionalEntry("b", bm25Config.b),
          optionalEntry("k", bm25Config.k),
          optionalEntry("k1", bm25Config.k1),
          optionalEntry("norm", bm25Config.norm),
        ]),
      ])
    ),
  ]);

const tokenBagOfWords: (tokens: ReadonlyArray<Token>) => Record<string, number> = flow(
  A.filter(isWordLikeToken),
  A.reduce(emptyTermBag, (bag, token) => {
    const term = normalizeTerm(token);
    return Str.isEmpty(term)
      ? bag
      : {
          ...bag,
          [term]: (bag[term] ?? 0) + 1,
        };
  })
);

const tokenToAi = (token: Token) => ({
  end: token.end,
  isPunctuation: isPunctuationToken(token),
  isStopWord: O.getOrElse(token.stopWordFlag, thunkFalse),
  lemma: unwrapOptionString(token.lemma),
  pos: unwrapOptionString(token.pos),
  start: token.start,
  stem: unwrapOptionString(token.stem),
  text: token.text,
});

const textPairLengthAttributes = (text1: string, text2: string): Record<string, string> => ({
  ...textLengthAttribute(text1, "text_1"),
  ...textLengthAttribute(text2, "text_2"),
});

const countAttribute = (name: string, count: number): Record<string, string> => ({
  [name]: `${count}`,
});

const observeTool =
  (
    toolName: string,
    operation: string,
    attributes?: Record<string, string>
  ): (<A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, typeof AiToolError.Type, R>) =>
  (effect) =>
    effect.pipe(
      observeWinkTool({
        ...(P.isUndefined(attributes) ? {} : { attributes }),
        operation,
        toolName,
      })
    );

const uniqueNormalizedTerms: (tokens: ReadonlyArray<Token>) => ReadonlyArray<string> = flow(
  A.map(normalizeTerm),
  A.filter(Str.isNonEmpty),
  A.dedupe,
  A.sort(Order.String)
);

const sortStrings: (values: ReadonlyArray<string>) => ReadonlyArray<string> = flow(
  A.filter(Str.isNonEmpty),
  A.dedupe,
  A.sort(Order.String)
);

const setJaccard = (leftValues: ReadonlyArray<string>, rightValues: ReadonlyArray<string>): number => {
  const left = pipe(leftValues, A.dedupe);
  const right = pipe(rightValues, A.dedupe);
  const combined = pipe(left, A.union(right));

  return A.match(combined, {
    onEmpty: thunk0,
    onNonEmpty: () => pipe(left, A.intersection(right), A.length) / A.length(combined),
  });
};

class EntityOutputDetail extends S.Class<EntityOutputDetail>($I`EntityOutputDetail`)(
  {
    type: S.optionalKey(S.Unknown),
    value: S.optionalKey(S.Unknown),
  },
  $I.annote("EntityOutputDetail", {
    description: "Loose detail object returned by wink entity output records.",
  })
) {}

const EntityOutputDetailUnknowns = S.Array(S.Unknown).pipe(
  $I.annoteSchema("EntityOutputDetailUnknowns", {
    description: "Raw wink entity detail array before loose detail-object normalization.",
  })
);
const EntityOutputSpan = S.Array(S.Finite).pipe(
  $I.annoteSchema("EntityOutputSpan", {
    description: "Finite numeric span returned by wink entity output records.",
  })
);
const EntityOutputSpanUnknowns = S.Array(S.Unknown).pipe(
  $I.annoteSchema("EntityOutputSpanUnknowns", {
    description: "Raw wink entity span array before loose span normalization.",
  })
);

const decodeEntityOutputDetails = (value: unknown): ReadonlyArray<EntityOutputDetail> =>
  pipe(
    S.decodeUnknownOption(EntityOutputDetailUnknowns)(value),
    O.map(A.map((detail) => EntityOutputDetail.make(P.isObject(detail) ? detail : R.empty()))),
    O.getOrElse(thunkEmptyReadonlyArray<EntityOutputDetail>())
  );

const decodeEntityOutputSpans = (value: unknown): ReadonlyArray<ReadonlyArray<number>> =>
  pipe(
    S.decodeUnknownOption(EntityOutputSpanUnknowns)(value),
    O.map(
      A.map((span) =>
        pipe(S.decodeUnknownOption(EntityOutputSpan)(span), O.getOrElse(thunkEmptyReadonlyArray<number>()))
      )
    ),
    O.getOrElse(thunkEmptyReadonlyArray<ReadonlyArray<number>>())
  );

const resolveTokenIndex = (
  rawSpan: ReadonlyArray<number> | undefined,
  lowerBound: number,
  tokens: ReadonlyArray<Token>
): number =>
  pipe(
    rawSpan,
    O.fromNullishOr,
    O.match({
      onNone: () => lowerBound,
      onSome: (span) =>
        A.length(span) >= 2 && P.isNumber(span[0])
          ? Math.max(0, Math.min(A.length(tokens) - 1, Math.floor(span[0])))
          : lowerBound,
    })
  );

const resolveTokenEndIndex = (
  rawSpan: ReadonlyArray<number> | undefined,
  startTokenIndex: number,
  tokens: ReadonlyArray<Token>
): number =>
  pipe(
    rawSpan,
    O.fromNullishOr,
    O.match({
      onNone: () => startTokenIndex,
      onSome: (span) =>
        A.length(span) >= 2 && P.isNumber(span[1])
          ? Math.max(startTokenIndex, Math.min(A.length(tokens) - 1, Math.floor(span[1])))
          : startTokenIndex,
    })
  );

const renderEntityValue = (value: unknown): string =>
  Match.type<boolean>().pipe(
    Match.when(true, thunkEmptyStr),
    Match.when(false, () => (P.isString(value) ? value : Inspectable.toStringUnknown(value))),
    Match.exhaustive
  )(P.isUndefined(value));

const mapEntityOutput = (
  details: ReadonlyArray<EntityOutputDetail>,
  spans: ReadonlyArray<ReadonlyArray<number>>,
  tokens: ReadonlyArray<Token>,
  source: "builtin" | "custom"
) =>
  A.map(details, (detail, index) => ({
    end:
      tokens[resolveTokenEndIndex(spans[index], resolveTokenIndex(spans[index], 0, tokens), tokens)]?.end ??
      tokens[resolveTokenIndex(spans[index], 0, tokens)]?.end ??
      Str.length(renderEntityValue(detail.value)),
    endTokenIndex: resolveTokenEndIndex(spans[index], resolveTokenIndex(spans[index], 0, tokens), tokens),
    source,
    start: tokens[resolveTokenIndex(spans[index], 0, tokens)]?.start ?? 0,
    startTokenIndex: resolveTokenIndex(spans[index], 0, tokens),
    type: renderEntityValue(detail.type),
    value: renderEntityValue(detail.value),
  }));

const TransformOperationKit = LiteralKit([
  "lowercase",
  "uppercase",
  "trim",
  "removeHtml",
  "removePunctuation",
  "removeExtraSpaces",
  "removeSpecialChars",
  "retainAlphaNums",
  "removeElisions",
]);
const TransformOperation = TransformOperationKit.pipe(
  $I.annoteSchema("TransformOperation", {
    description: "Valid transformation operations for text manipulation",
  }),
  SchemaUtils.withLiteralKitStatics(TransformOperationKit)
);

type TransformOperation = typeof TransformOperation.Type;

type TransformUtils = {
  readonly lowerCase: (text: string) => Effect.Effect<string, WinkUtilsError>;
  readonly upperCase: (text: string) => Effect.Effect<string, WinkUtilsError>;
  readonly trim: (text: string) => Effect.Effect<string, WinkUtilsError>;
  readonly removeHTMLTags: (text: string) => Effect.Effect<string, WinkUtilsError>;
  readonly removePunctuations: (text: string) => Effect.Effect<string, WinkUtilsError>;
  readonly removeExtraSpaces: (text: string) => Effect.Effect<string, WinkUtilsError>;
  readonly removeSplChars: (text: string) => Effect.Effect<string, WinkUtilsError>;
  readonly retainAlphaNums: (text: string) => Effect.Effect<string, WinkUtilsError>;
  readonly removeElisions: (text: string) => Effect.Effect<string, WinkUtilsError>;
};

const applyTransformOperation = (utils: TransformUtils, operation: TransformOperation, text: string) =>
  TransformOperation.$match(operation, {
    lowercase: () => utils.lowerCase(text),
    uppercase: () => utils.upperCase(text),
    trim: () => utils.trim(text),
    removeHtml: () => utils.removeHTMLTags(text),
    removePunctuation: () => utils.removePunctuations(text),
    removeExtraSpaces: () => utils.removeExtraSpaces(text),
    removeSpecialChars: () => utils.removeSplChars(text),
    retainAlphaNums: () => utils.retainAlphaNums(text),
    removeElisions: () => utils.removeElisions(text),
  });

const WinkNlpToolkitLiveError = S.Union([
  CorpusManagerError,
  SimilarityError,
  VectorizerError,
  WinkEngineError,
  WinkUtilsError,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("WinkNlpToolkitLiveError", {
    description: "Union of errors raised by the live wink NLP toolkit layer.",
  })
);
type WinkNlpToolkitLiveError = typeof WinkNlpToolkitLiveError.Type;

/**
 * Live toolkit handler layer backed by the wink NLP runtime.
 *
 * **Details**
 *
 * Provide this layer to programs that execute `NlpToolkit` tools; it wires
 * tokenization, similarity, vectorization, corpus management, and utility
 * services behind the typed toolkit handlers.
 *
 * **Example** (Provide layer to export tools)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { WinkNlpToolkitLive } from "@beep/wink"
 * import { exportTools } from "@beep/nlp-processing/Tools/ToolExport"
 *
 * const exported = await Effect.runPromise(
 *   exportTools.pipe(Effect.provide(WinkNlpToolkitLive))
 * )
 *
 * exported.some((tool) => tool.name === "Tokenize")
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WinkNlpToolkitLive: Layer.Layer<
  Tool.HandlersFor<typeof NlpToolkit.tools>,
  WinkNlpToolkitLiveError
> = NlpToolkit.toLayer(
  Effect.gen(function* () {
    const corpusManager = yield* WinkCorpusManager;
    const engine = yield* WinkEngine;
    const similarity = yield* WinkSimilarity;
    const tokenization = yield* Tokenization;
    const utils = yield* WinkUtils;
    const vectorizer = yield* WinkVectorizer;

    return {
      Analyze: Effect.fn("WinkNlpToolkit.Analyze")(
        function* ({ text }) {
          yield* Effect.annotateCurrentSpan(textLengthAttribute(text, "text"));
          const document = yield* tokenization.document(text, "analyze");
          const tokens = Chunk.toReadonlyArray(document.tokens);
          const sentences = Chunk.toReadonlyArray(document.sentences);
          return {
            characterCount: Str.length(text),
            sentenceCount: document.sentenceCount,
            sentences: pipe(
              sentences,
              A.map((sentence) => sentence.text)
            ),
            tokenCount: A.length(tokens),
            tokens: pipe(tokens, A.map(tokenToAi)),
            wordCount: pipe(tokens, A.filter(isWordLikeToken), A.length),
          };
        },
        observeTool("Analyze", "analyze")
      ),

      BagOfWords: Effect.fn("WinkNlpToolkit.BagOfWords")(
        function* ({ text }) {
          yield* Effect.annotateCurrentSpan(textLengthAttribute(text, "text"));
          const document = yield* tokenization.document(text, "bag-of-words");
          const terms = pipe(
            R.toEntries(tokenBagOfWords(Chunk.toReadonlyArray(document.tokens))),
            A.map(([value, count]) => ({ count, value })),
            A.sortBy(
              descendingNumber((entry) => entry.count),
              ascendingString((entry) => entry.value)
            )
          );
          return {
            terms,
            totalTerms: pipe(
              terms,
              A.reduce(0, (total, entry) => total + entry.count)
            ),
            uniqueTerms: A.length(terms),
          };
        },
        observeTool("BagOfWords", "bag_of_words")
      ),

      BowCosineSimilarity: Effect.fn("WinkNlpToolkit.BowCosineSimilarity")(
        function* ({ text1, text2 }) {
          yield* Effect.annotateCurrentSpan(textPairLengthAttributes(text1, text2));
          const [doc1, doc2] = yield* Effect.all([
            tokenization.document(text1, "bow-text-1"),
            tokenization.document(text2, "bow-text-2"),
          ]);

          const score = yield* similarity.bowCosine(
            BagOfWords.make({
              bow: tokenBagOfWords(Chunk.toReadonlyArray(doc1.tokens)),
              documentId: doc1.id,
            }),
            BagOfWords.make({
              bow: tokenBagOfWords(Chunk.toReadonlyArray(doc2.tokens)),
              documentId: doc2.id,
            })
          );

          return {
            method: "bow.cosine" as const,
            score: score.score,
          };
        },
        observeTool("BowCosineSimilarity", "similarity.bow_cosine")
      ),

      ChunkBySentences: Effect.fn("WinkNlpToolkit.ChunkBySentences")(
        function* ({ maxChunkChars, text }) {
          yield* Effect.annotateCurrentSpan({
            max_chunk_chars: `${maxChunkChars}`,
            ...textLengthAttribute(text, "text"),
          });
          const document = yield* tokenization.document(text, "sentence-chunks");
          const sentences = pipe(
            Chunk.toReadonlyArray(document.sentences),
            A.map((sentence) => ({
              index: sentence.index,
              text: Str.trim(sentence.text),
            })),
            A.filter((sentence) => Str.isNonEmpty(sentence.text))
          );

          if (A.isArrayEmpty(sentences)) {
            return {
              chunkCount: 0,
              chunks: A.empty(),
              originalSentenceCount: 0,
            };
          }

          const maxChars = maxChunkChars;
          const chunks = A.empty<{
            readonly charCount: number;
            readonly endSentenceIndex: number;
            readonly sentenceCount: number;
            readonly startSentenceIndex: number;
            readonly text: string;
          }>();

          let currentText = "";
          let startSentenceIndex = -1;
          let endSentenceIndex = -1;

          const flush = () => {
            if (startSentenceIndex >= 0 && !Str.isEmpty(currentText)) {
              A.appendInPlace(chunks, {
                charCount: Str.length(currentText),
                endSentenceIndex,
                sentenceCount: endSentenceIndex - startSentenceIndex + 1,
                startSentenceIndex,
                text: currentText,
              });
            }
          };

          for (const sentence of sentences) {
            if (startSentenceIndex < 0) {
              currentText = sentence.text;
              startSentenceIndex = sentence.index;
              endSentenceIndex = sentence.index;
              continue;
            }

            const candidate = `${currentText} ${sentence.text}`;
            if (Str.length(candidate) <= maxChars) {
              currentText = candidate;
              endSentenceIndex = sentence.index;
              continue;
            }

            flush();
            currentText = sentence.text;
            startSentenceIndex = sentence.index;
            endSentenceIndex = sentence.index;
          }

          flush();

          return {
            chunkCount: A.length(chunks),
            chunks,
            originalSentenceCount: A.length(sentences),
          };
        },
        observeTool("ChunkBySentences", "chunk.by_sentences")
      ),

      CorpusStats: Effect.fn("WinkNlpToolkit.CorpusStats")(
        function* (params) {
          yield* Effect.annotateCurrentSpan({
            corpus_id: params.corpusId,
            include_idf: `${params.includeIdf ?? false}`,
            include_matrix: `${params.includeMatrix ?? false}`,
            top_idf_terms: `${params.topIdfTerms ?? "default"}`,
          });
          return yield* corpusManager.getStats(params);
        },
        observeTool("CorpusStats", "corpus.stats")
      ),

      CreateCorpus: Effect.fn("WinkNlpToolkit.CreateCorpus")(
        function* (params) {
          yield* Effect.annotateCurrentSpan({
            corpus_id_requested: params.corpusId ?? "generated",
            has_bm25_config: `${!P.isUndefined(params.bm25Config)}`,
          });
          return yield* corpusManager.createCorpus(buildCreateCorpusParameters(params));
        },
        observeTool("CreateCorpus", "corpus.create")
      ),

      DeleteCorpus: Effect.fn("WinkNlpToolkit.DeleteCorpus")(
        function* ({ corpusId }) {
          yield* Effect.annotateCurrentSpan({ corpus_id: corpusId });
          const deleted = yield* corpusManager.deleteCorpus(corpusId);
          return {
            corpusId,
            deleted,
          };
        },
        observeTool("DeleteCorpus", "corpus.delete")
      ),

      DocumentStats: Effect.fn("WinkNlpToolkit.DocumentStats")(
        function* ({ text }) {
          yield* Effect.annotateCurrentSpan(textLengthAttribute(text, "text"));
          const document = yield* tokenization.document(text, "document-stats");
          const tokens = Chunk.toReadonlyArray(document.tokens);
          const wordCount = pipe(tokens, A.filter(isWordLikeToken), A.length);

          return {
            avgSentenceLength: A.match(Chunk.toReadonlyArray(document.sentences), {
              onEmpty: thunk0,
              onNonEmpty: () => wordCount / document.sentenceCount,
            }),
            charCount: Str.length(text),
            sentenceCount: document.sentenceCount,
            wordCount,
          };
        },
        observeTool("DocumentStats", "document.stats")
      ),

      ExtractEntities: Effect.fn("WinkNlpToolkit.ExtractEntities")(
        function* ({ includeCustom, text }) {
          yield* Effect.annotateCurrentSpan({
            include_custom: `${includeCustom ?? true}`,
            ...textLengthAttribute(text, "text"),
          });
          const [document, its, winkDoc] = yield* Effect.all([
            tokenization.document(text, "entities"),
            engine.its,
            engine.getWinkDoc(text),
          ]);
          const tokens = Chunk.toReadonlyArray(document.tokens);
          const builtinEntities = mapEntityOutput(
            decodeEntityOutputDetails(winkDoc.entities().out(its.detail)),
            decodeEntityOutputSpans(winkDoc.entities().out(its.span)),
            tokens,
            "builtin"
          );
          const customEntities = Match.type<boolean>().pipe(
            Match.when(true, () =>
              mapEntityOutput(
                decodeEntityOutputDetails(winkDoc.customEntities().out(its.detail)),
                decodeEntityOutputSpans(winkDoc.customEntities().out(its.span)),
                tokens,
                "custom"
              )
            ),
            Match.when(false, thunkEmptyReadonlyArray<ReturnType<typeof mapEntityOutput>[number]>()),
            Match.exhaustive
          )(includeCustom ?? true);
          const allEntities = pipe(
            builtinEntities,
            A.appendAll(customEntities),
            A.sortBy(
              ascendingNumber((entity) => entity.start),
              ascendingNumber((entity) => entity.end),
              ascendingNumber((entity) => entity.startTokenIndex)
            )
          );

          return {
            allEntities,
            allEntityCount: A.length(allEntities),
            customEntities,
            customEntityCount: A.length(customEntities),
            customEntityTypes: sortStrings(
              pipe(
                customEntities,
                A.map((entity) => entity.type)
              )
            ),
            entities: builtinEntities,
            entityCount: A.length(builtinEntities),
            entityTypes: sortStrings(
              pipe(
                builtinEntities,
                A.map((entity) => entity.type)
              )
            ),
          };
        },
        observeTool("ExtractEntities", "entities.extract")
      ),

      ExtractKeywords: Effect.fn("WinkNlpToolkit.ExtractKeywords")(
        function* ({ text, topN }) {
          yield* Effect.annotateCurrentSpan({
            top_n: `${topN ?? 10}`,
            ...textLengthAttribute(text, "text"),
          });
          return yield* vectorizer.withFreshInstance(
            Effect.fn(function* (isolated) {
              const document = yield* tokenization.document(text, "keywords");
              yield* isolated.learnDocument(document);
              const frequencies = yield* isolated.getDocumentTermFrequencies(0);
              const limit = topN ?? 10;

              return {
                keywords: pipe(
                  frequencies,
                  A.sortBy(
                    descendingNumber((frequency) => frequency.frequency),
                    ascendingString((frequency) => frequency.term)
                  ),
                  A.take(limit),
                  A.map((frequency) => ({
                    score: frequency.frequency,
                    term: frequency.term,
                  }))
                ),
              };
            })
          );
        },
        observeTool("ExtractKeywords", "keywords.extract")
      ),

      LearnCorpus: Effect.fn("WinkNlpToolkit.LearnCorpus")(
        function* ({ corpusId, dedupeById, documents }) {
          yield* Effect.annotateCurrentSpan({
            corpus_id: corpusId,
            dedupe_by_id: `${dedupeById ?? false}`,
            ...countAttribute("document_count", A.length(documents)),
          });
          const nowMs = yield* Clock.currentTimeMillis;
          const resolvedDocuments = yield* Effect.forEach(documents, (document, index) =>
            tokenization.document(document.text, document.id ?? `${corpusId}-doc-${nowMs}-${index}`)
          );
          return yield* corpusManager.learnDocuments({
            corpusId,
            documents: resolvedDocuments,
            ...O.getSomesStruct({ dedupeById: O.fromUndefinedOr(dedupeById) }),
          });
        },
        observeTool("LearnCorpus", "corpus.learn")
      ),

      LearnCustomEntities: Effect.fn("WinkNlpToolkit.LearnCustomEntities")(
        function* ({ entities, groupName, mode }) {
          yield* Effect.annotateCurrentSpan({
            group_name: groupName ?? "custom-entities",
            mode: mode ?? "append",
            ...countAttribute("entity_definition_count", A.length(entities)),
          });
          yield* S.decodeEffect(S.NonEmptyArray(BracketStringToPatternElement))(
            pipe(
              entities,
              A.flatMap((entity) => entity.patterns)
            )
          );

          const incoming = WinkEngineCustomEntities.make({
            name: EntityGroupName.make(groupName ?? "custom-entities"),
            patterns: pipe(
              entities,
              A.map((entity) =>
                CustomEntityExample.make({
                  mark: O.fromUndefinedOr(entity.mark),
                  name: entity.name,
                  patterns: entity.patterns,
                })
              )
            ),
          });

          const resolvedMode = mode ?? "append";
          const currentCustomEntities = yield* engine.getCurrentCustomEntities;
          const nextEntities = Match.type<"append" | "replace">().pipe(
            Match.when("append", () =>
              O.match(currentCustomEntities, {
                onNone: () => incoming,
                onSome: (existing) => existing.merge(incoming, incoming.name),
              })
            ),
            Match.when("replace", () => incoming),
            Match.exhaustive
          )(resolvedMode);

          yield* engine.learnCustomEntities(nextEntities);

          return {
            entityNames: sortStrings(
              pipe(
                nextEntities.toArray(),
                A.map((entity) => entity.name)
              )
            ),
            groupName: nextEntities.name,
            learnedEntityCount: incoming.size(),
            mode: resolvedMode,
            totalEntityCount: nextEntities.size(),
          };
        },
        observeTool("LearnCustomEntities", "entities.learn_custom")
      ),

      NGrams: Effect.fn("WinkNlpToolkit.NGrams")(
        function* ({ mode, size, text, topN }) {
          yield* Effect.annotateCurrentSpan({
            mode: mode ?? "bag",
            size: `${size}`,
            top_n: `${topN ?? "default"}`,
            ...textLengthAttribute(text, "text"),
          });
          const resolvedMode = mode ?? "bag";
          const resolvedSize = size;
          const result = yield* Match.type<"bag" | "edge" | "set">().pipe(
            Match.when("bag", () => utils.bagOfNGrams(text, resolvedSize)),
            Match.when("edge", () => utils.edgeNGrams(text, resolvedSize)),
            Match.when("set", () => utils.setOfNGrams(text, resolvedSize)),
            Match.exhaustive
          )(resolvedMode);

          const limit = topN ?? result.uniqueNGrams;
          const ngrams = pipe(
            result.ngrams,
            R.toEntries,
            A.map(([value, count]) => ({
              count,
              value,
            })),
            A.sortBy(
              descendingNumber((entry) => entry.count),
              ascendingString((entry) => entry.value)
            ),
            A.take(limit)
          );

          return {
            mode: resolvedMode,
            ngrams,
            size: resolvedSize,
            totalNGrams: result.totalNGrams,
            uniqueNGrams: result.uniqueNGrams,
          };
        },
        observeTool("NGrams", "ngrams.extract")
      ),

      Paragraphize: Effect.fn("WinkNlpToolkit.Paragraphize")(
        function* ({ text }) {
          yield* Effect.annotateCurrentSpan(textLengthAttribute(text, "text"));
          const paragraphs = pipe(text.split(/\n\s*\n/), A.map(Str.trim), A.filter(Str.isNonEmpty));
          return {
            count: A.length(paragraphs),
            paragraphs,
          };
        },
        observeTool("Paragraphize", "paragraphize")
      ),

      PhoneticMatch: Effect.fn("WinkNlpToolkit.PhoneticMatch")(
        function* ({ algorithm, minTokenLength, text1, text2 }) {
          const resolvedAlgorithm = algorithm ?? "soundex";
          const minimumLength = minTokenLength ?? 2;
          yield* Effect.annotateCurrentSpan({
            algorithm: resolvedAlgorithm,
            min_token_length: `${minimumLength}`,
            ...textPairLengthAttributes(text1, text2),
          });
          const encode = (tokens: ReadonlyArray<string>) =>
            Match.type<"soundex" | "phonetize">().pipe(
              Match.when("soundex", () => utils.soundex(tokens)),
              Match.when("phonetize", () => utils.phonetize(tokens)),
              Match.exhaustive
            )(resolvedAlgorithm);
          const toCandidateTokens = flow(
            A.filter<Token>(isWordLikeToken),
            A.map(flow(normalizedTokenText, Str.trim, Str.toLowerCase)),
            A.filter((token) => Str.length(token) >= minimumLength)
          );

          const [leftTokens, rightTokens] = yield* Effect.all([
            tokenization.tokenize(text1),
            tokenization.tokenize(text2),
          ]);
          const [leftCodes, rightCodes] = yield* Effect.all([
            encode(toCandidateTokens(leftTokens)),
            encode(toCandidateTokens(rightTokens)),
          ]);
          const sortedLeft = sortStrings(pipe(leftCodes, A.map(Str.trim), A.filter(Str.isNonEmpty)));
          const sortedRight = sortStrings(pipe(rightCodes, A.map(Str.trim), A.filter(Str.isNonEmpty)));

          return {
            algorithm: resolvedAlgorithm,
            leftCodes: sortedLeft,
            rightCodes: sortedRight,
            score: setJaccard(sortedLeft, sortedRight),
            sharedCodes: pipe(sortedLeft, A.intersection(sortedRight)),
          };
        },
        observeTool("PhoneticMatch", "phonetic.match")
      ),
      QueryCorpus: Effect.fn("WinkNlpToolkit.QueryCorpus")(
        function* (params) {
          yield* Effect.annotateCurrentSpan({
            corpus_id: params.corpusId,
            include_text: `${params.includeText ?? false}`,
            top_n: `${params.topN ?? "default"}`,
            ...textLengthAttribute(params.query, "query"),
          });
          return yield* corpusManager.query(params);
        },
        observeTool("QueryCorpus", "corpus.query")
      ),

      RankByRelevance: Effect.fn("WinkNlpToolkit.RankByRelevance")(
        function* ({ query, texts, topN }) {
          yield* Effect.annotateCurrentSpan({
            top_n: `${topN ?? "default"}`,
            ...countAttribute("candidate_text_count", A.length(texts)),
            ...textLengthAttribute(query, "query"),
          });
          return yield* vectorizer.withFreshInstance(
            Effect.fn(function* (isolated) {
              return yield* A.match(texts, {
                onEmpty: () =>
                  Effect.succeed({
                    ranked: A.empty(),
                    returned: 0,
                    totalTexts: 0,
                  }),
                onNonEmpty: Effect.fn("Wink.NlpToolkit.RankByRelevance.onNonEmpty")(function* () {
                  const documents = yield* Effect.forEach(texts, (text, index) =>
                    tokenization.document(text, `rank-${index}`)
                  );
                  yield* Effect.forEach(documents, isolated.learnDocument, { discard: true });

                  const queryDocument = yield* tokenization.document(query, "rank-query");
                  const queryVector = yield* isolated.vectorizeDocument(queryDocument);
                  const scores = yield* Effect.forEach(
                    documents,

                    Effect.fn(function* (document, index) {
                      const candidateVector = yield* isolated.vectorizeDocument(document);
                      const score = yield* similarity.vectorCosine(queryVector, candidateVector);
                      return {
                        index,
                        score: score.score,
                      };
                    })
                  );

                  const limit = topN ?? A.length(texts);
                  const ranked = pipe(
                    scores,
                    A.sortBy(
                      descendingNumber((score) => score.score),
                      ascendingNumber((score) => score.index)
                    ),
                    A.take(limit)
                  );

                  return {
                    ranked,
                    returned: A.length(ranked),
                    totalTexts: A.length(texts),
                  };
                }),
              });
            })
          );
        },
        observeTool("RankByRelevance", "relevance.rank")
      ),

      RemoveStopWords: Effect.fn("WinkNlpToolkit.RemoveStopWords")(
        function* ({ text }) {
          yield* Effect.annotateCurrentSpan(textLengthAttribute(text, "text"));
          const document = yield* tokenization.document(text, "remove-stop-words");
          const wordLike = pipe(Chunk.toReadonlyArray(document.tokens), A.filter(isWordLikeToken));
          const tokens = pipe(
            wordLike,
            A.filter((token) => !O.getOrElse(token.stopWordFlag, thunkFalse)),
            A.map((token) => token.text)
          );
          return {
            count: A.length(tokens),
            removedCount: A.length(wordLike) - A.length(tokens),
            tokens,
          };
        },
        observeTool("RemoveStopWords", "remove_stop_words")
      ),

      Sentences: Effect.fn("WinkNlpToolkit.Sentences")(
        function* ({ text }) {
          yield* Effect.annotateCurrentSpan(textLengthAttribute(text, "text"));
          const document = yield* tokenization.document(text, "sentences");
          const sentences = pipe(
            Chunk.toReadonlyArray(document.sentences),
            A.map((sentence) => {
              const tokens = Chunk.toReadonlyArray(sentence.tokens);

              return {
                end: pipe(
                  A.last(tokens),
                  O.map((token) => token.end),
                  O.getOrElse(thunk0)
                ),
                index: sentence.index,
                start: pipe(
                  A.head(tokens),
                  O.map((token) => token.start),
                  O.getOrElse(thunk0)
                ),
                text: sentence.text,
                tokenCount: A.length(tokens),
              };
            })
          );

          return {
            sentenceCount: A.length(sentences),
            sentences,
          };
        },
        observeTool("Sentences", "sentences.extract")
      ),

      Stem: Effect.fn("WinkNlpToolkit.Stem")(
        function* ({ text }) {
          yield* Effect.annotateCurrentSpan(textLengthAttribute(text, "text"));
          const document = yield* tokenization.document(text, "stem");
          const stems = pipe(
            Chunk.toReadonlyArray(document.tokens),
            A.filter(isWordLikeToken),
            A.map((token) => unwrapOptionString(token.stem)),
            A.filter(Str.isNonEmpty)
          );
          return {
            count: A.length(stems),
            stems,
          };
        },
        observeTool("Stem", "stem")
      ),

      TextSimilarity: Effect.fn("WinkNlpToolkit.TextSimilarity")(
        function* ({ text1, text2 }) {
          yield* Effect.annotateCurrentSpan(textPairLengthAttributes(text1, text2));
          return yield* vectorizer.withFreshInstance(
            Effect.fn(function* (isolated) {
              const [doc1, doc2] = yield* Effect.all([
                tokenization.document(text1, "text-similarity-1"),
                tokenization.document(text2, "text-similarity-2"),
              ]);

              yield* Effect.forEach([doc1, doc2], (document) => isolated.learnDocument(document), { discard: true });
              const [leftVector, rightVector] = yield* Effect.all([
                isolated.vectorizeDocument(doc1),
                isolated.vectorizeDocument(doc2),
              ]);
              const score = yield* similarity.vectorCosine(leftVector, rightVector);

              return {
                method: "vector.cosine" as const,
                score: score.score,
              };
            })
          );
        },
        observeTool("TextSimilarity", "similarity.vector_cosine")
      ),

      Tokenize: Effect.fn("WinkNlpToolkit.Tokenize")(
        function* ({ text }) {
          yield* Effect.annotateCurrentSpan(textLengthAttribute(text, "text"));
          const tokens = yield* tokenization.tokenize(text);
          return {
            tokenCount: A.length(tokens),
            tokens: pipe(tokens, A.map(tokenToAi)),
          };
        },
        observeTool("Tokenize", "tokenize")
      ),

      TransformText: Effect.fn("Wink.NlpToolkit.TransformText")(
        function* ({ operations, text }) {
          yield* Effect.annotateCurrentSpan({
            ...countAttribute("operation_count", A.length(operations)),
            ...textLengthAttribute(text, "text"),
          });
          let current = text;
          const operationsApplied = A.empty<string>();

          for (const operation of operations) {
            current = yield* applyTransformOperation(utils, operation, current);
            A.appendInPlace(operationsApplied, operation);
          }

          return {
            operationsApplied,
            result: current,
          };
        },
        observeTool("TransformText", "text.transform")
      ),

      TverskySimilarity: Effect.fn("WinkNlpToolkit.TverskySimilarity")(
        function* ({ alpha, beta, text1, text2 }) {
          yield* Effect.annotateCurrentSpan({
            alpha: `${alpha}`,
            beta: `${beta}`,
            ...textPairLengthAttributes(text1, text2),
          });
          const [leftTokens, rightTokens] = yield* Effect.all([
            tokenization.tokenize(text1),
            tokenization.tokenize(text2),
          ]);
          const params = TverskyParams.make({
            alpha,
            beta,
          });
          const score = yield* similarity.setTversky(
            DocumentTermSet.make({
              documentId: DocumentId.make("tversky-left"),
              terms: uniqueNormalizedTerms(leftTokens),
            }),
            DocumentTermSet.make({
              documentId: DocumentId.make("tversky-right"),
              terms: uniqueNormalizedTerms(rightTokens),
            }),
            params
          );

          return {
            alpha: params.alpha,
            beta: params.beta,
            method: "set.tversky" as const,
            score: score.score,
          };
        },
        observeTool("TverskySimilarity", "similarity.tversky")
      ),

      WordCount: Effect.fn("WinkNlpToolkit.WordCount")(
        function* ({ text }) {
          yield* Effect.annotateCurrentSpan(textLengthAttribute(text, "text"));
          const document = yield* tokenization.document(text, "word-count");
          const tokens = Chunk.toReadonlyArray(document.tokens);
          return {
            characterCount: Str.length(text),
            wordCount: pipe(tokens, A.filter(isWordLikeToken), A.length),
          };
        },
        observeTool("WordCount", "word_count")
      ),
    };
  })
).pipe(Layer.provide(WinkLayerAllLive));
