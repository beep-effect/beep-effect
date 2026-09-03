/**
 * Stateful corpus management built on wink BM25 vectorization.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $WinkId } from "@beep/identity";
import { Document, DocumentId } from "@beep/nlp/Core/Document";
import { BM25Config, BM25Norm, DefaultBM25Config, DocumentVector, PositiveNumber } from "@beep/nlp/Core/Vectorization";
import { Defect, NonNegativeInt, PosInt, SchemaUtils } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { A, thunk0, thunkEffectVoid } from "@beep/utils";
import { Chunk, Clock, Context, Effect, HashMap, HashSet, Layer, pipe, Ref } from "effect";
import * as Bool from "effect/Boolean";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { loadBM25Vectorizer, normalizeTokenText } from "./internal/bm25.ts";
import { ascendingNumber, ascendingString, descendingNumber } from "./internal/order.ts";
import { WinkStringArray } from "./Wink.models.ts";
import { WinkEngine } from "./Wink.service.ts";
import { observeWinkWorkflow, textLengthAttribute } from "./WinkObservability.ts";
import { WinkSimilarity } from "./WinkSimilarity.service.ts";
import type { BM25VectorizerInstance } from "./internal/bm25.ts";

const $I = $WinkId.create("Wink/WinkCorpusManager");

class CreateCorpusBM25Config extends S.Class<CreateCorpusBM25Config>($I`CreateCorpusBM25Config`)(
  {
    b: UnitInterval.pipe(SchemaUtils.withKeyDefaults(DefaultBM25Config.b)),
    k: PositiveNumber.pipe(SchemaUtils.withKeyDefaults(DefaultBM25Config.k)),
    k1: PositiveNumber.pipe(SchemaUtils.withKeyDefaults(DefaultBM25Config.k1)),
    norm: BM25Norm.pipe(SchemaUtils.withKeyDefaults(DefaultBM25Config.norm)),
  },
  $I.annote("CreateCorpusBM25Config", {
    description: "Optional BM25 hyperparameter overrides used when creating a managed corpus.",
  })
) {}

class CreateCorpusParams extends S.Class<CreateCorpusParams>($I`CreateCorpusParams`)(
  {
    bm25Config: CreateCorpusBM25Config.pipe(SchemaUtils.withKeyDefaults(CreateCorpusBM25Config.make({}))),
    corpusId: S.String.pipe(S.UndefinedOr, S.optionalKey),
  },
  $I.annote("CreateCorpusParams", {
    description: "Parameters for creating a managed Wink BM25 corpus session.",
  })
) {}

class LearnCorpusParams extends S.Class<LearnCorpusParams>($I`LearnCorpusParams`)(
  {
    corpusId: S.String,
    dedupeById: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
    documents: S.Array(Document),
  },
  $I.annote("LearnCorpusParams", {
    description: "Parameters for learning a corpus with Wink.",
  })
) {}

class QueryCorpusParams extends S.Class<QueryCorpusParams>($I`QueryCorpusParams`)(
  {
    corpusId: S.String,
    includeText: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    query: S.String,
    topN: S.optionalKey(PosInt),
  },
  $I.annote("QueryCorpusParams", {
    description: "Parameters for querying a managed Wink BM25 corpus session.",
  })
) {}

class CorpusStatsParams extends S.Class<CorpusStatsParams>($I`CorpusStatsParams`)(
  {
    corpusId: S.String,
    includeIdf: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    includeMatrix: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    topIdfTerms: S.optionalKey(PosInt),
  },
  $I.annote("CorpusStatsParams", {
    description: "Parameters for retrieving corpus statistics with Wink.",
  })
) {}

class CorpusSummary extends S.Class<CorpusSummary>($I`CorpusSummary`)(
  {
    config: BM25Config,
    corpusId: S.String,
    createdAtMs: NonNegativeInt,
    documentCount: NonNegativeInt,
    vocabularySize: NonNegativeInt,
  },
  $I.annote("CorpusSummary", {
    description: "Summary of a corpus learned with Wink.",
  })
) {}

class LearnCorpusResult extends S.Class<LearnCorpusResult>($I`LearnCorpusResult`)(
  {
    corpusId: S.String,
    learnedCount: NonNegativeInt,
    reindexRequired: S.Boolean,
    skippedCount: NonNegativeInt,
    totalDocuments: NonNegativeInt,
    vocabularySize: NonNegativeInt,
  },
  $I.annote("LearnCorpusResult", {
    description: "Result metadata returned after learning documents into a managed corpus.",
  })
) {}

class RankedCorpusDocument extends S.Class<RankedCorpusDocument>($I`RankedCorpusDocument`)(
  {
    id: S.String,
    index: NonNegativeInt,
    score: UnitInterval,
    text: S.optionalKey(S.String),
  },
  $I.annote("RankedCorpusDocument", {
    description: "Single ranked corpus document returned from a corpus query.",
  })
) {}

class QueryCorpusResult extends S.Class<QueryCorpusResult>($I`QueryCorpusResult`)(
  {
    corpusId: S.String,
    method: S.Literal("vector.cosine"),
    query: S.String,
    ranked: S.Array(RankedCorpusDocument),
    returned: NonNegativeInt,
    totalDocuments: NonNegativeInt,
  },
  $I.annote("QueryCorpusResult", {
    description: "Ranked corpus query results and result-count metadata.",
  })
) {}

class CorpusIdfValue extends S.Class<CorpusIdfValue>($I`CorpusIdfValue`)(
  {
    idf: S.Finite,
    term: S.String,
  },
  $I.annote("CorpusIdfValue", {
    description: "Inverse document frequency value for a corpus term.",
  })
) {}

class CorpusMatrixShape extends S.Class<CorpusMatrixShape>($I`CorpusMatrixShape`)(
  {
    cols: NonNegativeInt,
    rows: NonNegativeInt,
  },
  $I.annote("CorpusMatrixShape", {
    description: "Shape metadata for a corpus document-term matrix.",
  })
) {}

class CorpusStatsResult extends S.Class<CorpusStatsResult>($I`CorpusStatsResult`)(
  {
    averageDocumentLength: S.Finite,
    corpusId: S.String,
    documentTermMatrix: S.Array(S.Finite).pipe(S.Array),
    idfValues: S.Array(CorpusIdfValue),
    matrixShape: CorpusMatrixShape,
    terms: S.Array(S.String),
    totalDocuments: NonNegativeInt,
    vocabularySize: NonNegativeInt,
  },
  $I.annote("CorpusStatsResult", {
    description: "Detailed statistics for a managed Wink BM25 corpus session.",
  })
) {}

type CompiledCorpus = {
  readonly documentVectors: ReadonlyArray<ReadonlyArray<number>>;
  readonly terms: ReadonlyArray<string>;
  readonly vectorizer: BM25VectorizerInstance;
};

type CorpusSessionState = {
  readonly compiled: O.Option<CompiledCorpus>;
  readonly config: BM25Config;
  readonly corpusId: string;
  readonly createdAtMs: number;
  readonly documents: ReadonlyArray<Document>;
  readonly totalTokenCount: number;
  readonly updatedAtMs: number;
  readonly vocabulary: HashSet.HashSet<string>;
};

type CreateCorpusParamsInput = Exclude<(typeof CreateCorpusParams)["~type.make.in"], void>;
type LearnCorpusParamsInput = Exclude<(typeof LearnCorpusParams)["~type.make.in"], void>;
type QueryCorpusParamsInput = Exclude<(typeof QueryCorpusParams)["~type.make.in"], void>;
type CorpusStatsParamsInput = Exclude<(typeof CorpusStatsParams)["~type.make.in"], void>;

type WinkCorpusManagerShape = {
  readonly createCorpus: (
    request?: CreateCorpusParamsInput | undefined
  ) => Effect.Effect<CorpusSummary, CorpusManagerError>;
  readonly deleteCorpus: (corpusId: string) => Effect.Effect<boolean>;
  readonly getStats: (request: CorpusStatsParamsInput) => Effect.Effect<CorpusStatsResult, CorpusManagerError>;
  readonly learnDocuments: (request: LearnCorpusParamsInput) => Effect.Effect<LearnCorpusResult, CorpusManagerError>;
  readonly query: (request: QueryCorpusParamsInput) => Effect.Effect<QueryCorpusResult, CorpusManagerError>;
};

type CorpusInsertResult = readonly [boolean, HashMap.HashMap<string, CorpusSessionState>];
type WinkEngineService = typeof WinkEngine.Service;

const sanitizeLimit = (value: number | undefined, fallback: number): number =>
  pipe(
    O.fromNullishOr(value),
    O.filter(P.isNumber),
    O.match({
      onNone: () => fallback,
      onSome: (limit) => Math.max(1, Math.min(fallback, Math.floor(limit))),
    })
  );

const toCorpusIdOption = (corpusId: string | undefined): O.Option<string> => O.fromNullishOr(corpusId);

const WinkNumberArray = S.Array(S.Finite).pipe(
  $I.annoteSchema("WinkNumberArray", {
    description: "Array of finite numeric values returned by wink vectorizer accessors.",
  })
);
const TermScorePair = S.Tuple([S.String, S.Finite]).pipe(
  $I.annoteSchema("TermScorePair", {
    description: "Term and finite score pair returned by wink vectorizer accessors.",
  })
);
const TermScorePairs = S.Array(TermScorePair).pipe(
  $I.annoteSchema("TermScorePairs", {
    description: "Array of term and score pairs returned by wink vectorizer accessors.",
  })
);

const makeCorpusSessionState = (corpusId: string, config: BM25Config, nowMs: number): CorpusSessionState => ({
  compiled: O.none(),
  config,
  corpusId,
  createdAtMs: nowMs,
  documents: [],
  totalTokenCount: 0,
  updatedAtMs: nowMs,
  vocabulary: HashSet.empty<string>(),
});

const decodeStringArray = (
  value: unknown,
  context: string,
  corpusId: string
): Effect.Effect<ReadonlyArray<string>, CorpusManagerError> =>
  Effect.fromOption(S.decodeUnknownOption(WinkStringArray)(value), () =>
    CorpusManagerError.fromMessage(`Invalid ${context}: expected string[]`, corpusId)
  );

const decodeNumberArray = (
  value: unknown,
  context: string,
  corpusId: string
): Effect.Effect<ReadonlyArray<number>, CorpusManagerError> =>
  Effect.fromOption(S.decodeUnknownOption(WinkNumberArray)(value), () =>
    CorpusManagerError.fromMessage(`Invalid ${context}: expected number[]`, corpusId)
  );

const decodeTermScorePairs = (
  value: unknown,
  context: string,
  corpusId: string
): Effect.Effect<ReadonlyArray<readonly [string, number]>, CorpusManagerError> =>
  Effect.fromOption(S.decodeUnknownOption(TermScorePairs)(value), () =>
    CorpusManagerError.fromMessage(`Invalid ${context}: expected [string, number][]`, corpusId)
  );

const readNormalizedTokensFromWink = Effect.fn("Wink.WinkCorpusManager.readNormalizedTokensFromWink")(function* (
  engine: WinkEngineService,
  document: Document,
  corpusId: string
): Effect.fn.Return<ReadonlyArray<string>, CorpusManagerError> {
  yield* Effect.annotateCurrentSpan({
    corpus_id: corpusId,
    document_id: document.id,
    ...textLengthAttribute(document.text, "document_text"),
  });
  const its = yield* engine.its.pipe(
    Effect.mapError((cause) => CorpusManagerError.fromCause(cause, "Failed to access wink helpers", { corpusId }))
  );
  const winkDoc = yield* engine
    .getWinkDoc(document.text)
    .pipe(
      Effect.mapError((cause) => CorpusManagerError.fromCause(cause, "Failed to tokenize document text", { corpusId }))
    );
  return yield* decodeStringArray(winkDoc.tokens().out(its.normal), "normalized token output", corpusId);
});

const observeCorpus = (operation: string) =>
  observeWinkWorkflow({
    metricAttributes: { operation },
    name: `corpus.${operation}`,
  });

const removeCorpusSession = (
  sessions: HashMap.HashMap<string, CorpusSessionState>,
  corpusId: string
): readonly [boolean, HashMap.HashMap<string, CorpusSessionState>] => {
  const exists = HashMap.has(sessions, corpusId);
  return [exists, HashMap.remove(sessions, corpusId)];
};

/**
 * Typed failure for creating, learning, querying, or inspecting a managed corpus.
 *
 * **Example** (Create error from message)
 *
 * ```ts
 * import { CorpusManagerError } from "@beep/wink"
 *
 * const error = CorpusManagerError.fromMessage("Corpus does not exist", "support-docs")
 * console.log(error.corpusId._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CorpusManagerError extends S.TaggedError<CorpusManagerError>($I`CorpusManagerError`)(
  "CorpusManagerError",
  {
    cause: S.OptionFromOptionalKey(Defect({ includeStack: true })).pipe(SchemaUtils.withNoneDefault),
    corpusId: S.OptionFromOptionalKey(S.String),
    message: S.String,
  },
  $I.annoteError<CorpusManagerError>("CorpusManagerError", {
    description: "Failure raised while managing a stateful wink BM25 corpus.",
  })
) {
  /**
   * Convert an unknown cause into a typed corpus-manager error.
   *
   * @param cause - The underlying failure or defect.
   * @param message - The human-readable corpus-manager error message.
   * @param options - Additional corpus-manager error detail.
   * @returns A typed corpus-manager error value.
   */
  static readonly fromCause: {
    (cause: unknown, message: string, options: { readonly corpusId?: string | undefined }): CorpusManagerError;
    (message: string, options: { readonly corpusId?: string | undefined }): (cause: unknown) => CorpusManagerError;
  } = dual(
    3,
    (cause: unknown, message: string, options: { readonly corpusId?: string | undefined }): CorpusManagerError =>
      CorpusManagerError.make({
        cause: O.some(cause),
        corpusId: toCorpusIdOption(options.corpusId),
        message,
      })
  );

  /**
   * Create a corpus-manager error without an external cause.
   *
   * @param message - The human-readable corpus-manager error message.
   * @param corpusId - The affected corpus identifier, when known.
   * @returns A typed corpus-manager error value without an external cause.
   */
  static fromMessage(message: string, corpusId?: string): CorpusManagerError {
    return CorpusManagerError.make({
      corpusId: toCorpusIdOption(corpusId),
      message,
    });
  }
}

const makeWinkCorpusManager = Effect.gen(function* () {
  const engine = yield* WinkEngine;
  const similarity = yield* WinkSimilarity;
  const bm25 = yield* Effect.try({
    try: loadBM25Vectorizer,
    catch: CorpusManagerError.fromCause("Failed to initialize BM25 vectorizer", {}),
  });
  const sessionsRef = yield* Ref.make(HashMap.empty<string, CorpusSessionState>());
  const idCounterRef = yield* Ref.make(0);

  const makeGeneratedId = pipe(
    Ref.updateAndGet(idCounterRef, (current) => current + 1),
    Effect.flatMap(
      Effect.fnUntraced(function* (counter) {
        return yield* Effect.map(Clock.currentTimeMillis, (nowMs) => `corpus-${nowMs}-${counter}`);
      })
    )
  );

  const getState = (corpusId: string): Effect.Effect<CorpusSessionState, CorpusManagerError> =>
    pipe(
      Ref.get(sessionsRef),
      Effect.flatMap(
        Effect.fnUntraced(function* (sessions) {
          return yield* Effect.fromOption(HashMap.get(sessions, corpusId), () =>
            CorpusManagerError.fromMessage(`Corpus "${corpusId}" does not exist`, corpusId)
          );
        })
      )
    );

  const setState = (state: CorpusSessionState): Effect.Effect<void> =>
    Ref.update(sessionsRef, (sessions) => HashMap.set(sessions, state.corpusId, state));

  const readNormalizedTokens = (
    document: Document,
    corpusId: string
  ): Effect.Effect<ReadonlyArray<string>, CorpusManagerError> =>
    Bool.match(document.tokenCount > 0, {
      onFalse: () => readNormalizedTokensFromWink(engine, document, corpusId),
      onTrue: () => Effect.succeed(pipe(Chunk.toReadonlyArray(document.tokens), A.map(normalizeTokenText))),
    });

  const compileState = Effect.fnUntraced(function* (
    state: CorpusSessionState
  ): Effect.fn.Return<CompiledCorpus, CorpusManagerError> {
    const its = yield* engine.its.pipe(
      Effect.mapError(CorpusManagerError.fromCause("Failed to access wink helpers", { corpusId: state.corpusId }))
    );
    const vectorizer = bm25(state.config);

    for (const document of state.documents) {
      const tokens = yield* readNormalizedTokens(document, state.corpusId);
      yield* Effect.try({
        try: () => {
          vectorizer.learn(A.fromIterable(tokens));
        },
        catch: (cause) =>
          CorpusManagerError.fromCause(cause, "Failed to learn a document into the compiled corpus", {
            corpusId: state.corpusId,
          }),
      });
    }

    const terms = yield* Effect.try({
      try: () => vectorizer.out(its.terms),
      catch: CorpusManagerError.fromCause("Failed to compute corpus terms", { corpusId: state.corpusId }),
    }).pipe(
      Effect.flatMap(
        Effect.fnUntraced(function* (raw) {
          return yield* decodeStringArray(raw, "corpus term output", state.corpusId);
        })
      )
    );

    const documentVectors = yield* Effect.forEach(state.documents, (_document, index) =>
      Effect.try({
        try: () => vectorizer.doc(index).out(its.vector),
        catch: (cause) =>
          CorpusManagerError.fromCause(cause, "Failed to compute document vector", { corpusId: state.corpusId }),
      }).pipe(
        Effect.flatMap(
          Effect.fnUntraced(function* (raw) {
            return yield* decodeNumberArray(raw, "document vector output", state.corpusId);
          })
        )
      )
    );

    return {
      documentVectors,
      terms,
      vectorizer,
    };
  });

  const ensureCompiled = (
    state: CorpusSessionState
  ): Effect.Effect<
    {
      readonly compiled: CompiledCorpus;
      readonly state: CorpusSessionState;
    },
    CorpusManagerError
  > =>
    O.match(state.compiled, {
      onNone: () =>
        compileState(state).pipe(
          Effect.flatMap(
            Effect.fnUntraced(function* (compiled) {
              return yield* Effect.map(
                setState({
                  ...state,
                  compiled: O.some(compiled),
                }),
                () => ({
                  compiled,
                  state: {
                    ...state,
                    compiled: O.some(compiled),
                  },
                })
              );
            })
          )
        ),
      onSome: (compiled) => Effect.succeed({ compiled, state }),
    });

  return WinkCorpusManager.of({
    createCorpus: Effect.fn("Wink.WinkCorpusManager.createCorpus")(function* (request?: CreateCorpusParamsInput) {
      const params = CreateCorpusParams.make(request ?? {});
      const requestedId = params.corpusId;
      const corpusId = requestedId ?? (yield* makeGeneratedId);
      yield* Effect.annotateCurrentSpan({
        corpus_id: corpusId,
        corpus_id_generated: `${P.isUndefined(requestedId)}`,
        has_bm25_config: `${!P.isUndefined(request?.bm25Config)}`,
      });
      const nowMs = yield* Clock.currentTimeMillis;
      const config = BM25Config.make({
        b: params.bm25Config.b,
        k: params.bm25Config.k,
        k1: params.bm25Config.k1,
        norm: params.bm25Config.norm,
      });
      const inserted = yield* Ref.modify(
        sessionsRef,
        (current): CorpusInsertResult =>
          Bool.match(HashMap.has(current, corpusId), {
            onFalse: () => [true, HashMap.set(current, corpusId, makeCorpusSessionState(corpusId, config, nowMs))],
            onTrue: () => [false, current],
          })
      );

      yield* Bool.match(inserted, {
        onFalse: () => CorpusManagerError.fromMessage(`Corpus "${corpusId}" already exists`, corpusId),
        onTrue: thunkEffectVoid,
      });

      return {
        config,
        corpusId,
        createdAtMs: NonNegativeInt.make(nowMs),
        documentCount: NonNegativeInt.make(0),
        vocabularySize: NonNegativeInt.make(0),
      };
    }, observeCorpus("create")),

    deleteCorpus: Effect.fn("Wink.WinkCorpusManager.deleteCorpus")(function* (corpusId: string) {
      yield* Effect.annotateCurrentSpan({ corpus_id: corpusId });
      return yield* Ref.modify(sessionsRef, (sessions) => removeCorpusSession(sessions, corpusId));
    }, observeCorpus("delete")),

    getStats: Effect.fn("Wink.WinkCorpusManager.getStats")(function* (request: CorpusStatsParamsInput) {
      const params = CorpusStatsParams.make(request);
      yield* Effect.annotateCurrentSpan({
        corpus_id: params.corpusId,
        include_idf: `${params.includeIdf}`,
        include_matrix: `${params.includeMatrix}`,
        top_idf_terms: `${params.topIdfTerms ?? "default"}`,
      });
      const state = yield* getState(params.corpusId);
      const { compiled, state: compiledState } = yield* ensureCompiled(state);

      if (compiledState.documents.length === 0) {
        return {
          averageDocumentLength: 0,
          corpusId: params.corpusId,
          documentTermMatrix: [],
          idfValues: [],
          matrixShape: { cols: NonNegativeInt.make(0), rows: NonNegativeInt.make(0) },
          terms: [],
          totalDocuments: NonNegativeInt.make(0),
          vocabularySize: NonNegativeInt.make(0),
        };
      }

      const its = yield* engine.its.pipe(
        Effect.mapError(CorpusManagerError.fromCause("Failed to access wink helpers", { corpusId: params.corpusId }))
      );

      const idfValues = yield* Bool.match(params.includeIdf, {
        onFalse: () => Effect.succeed(A.empty()),
        onTrue: Effect.fn("Wink.WinkCorpusManager.getStats.idfValues")(function* () {
          const raw = yield* Effect.try({
            try: () => compiled.vectorizer.out(its.idf),
            catch: CorpusManagerError.fromCause("Failed to compute corpus idf values", {
              corpusId: params.corpusId,
            }),
          });
          const decoded = yield* decodeTermScorePairs(raw, "corpus idf output", params.corpusId);
          return pipe(
            decoded,
            A.sortBy(
              descendingNumber(([, idf]) => idf),
              ascendingString(([term]) => term)
            ),
            A.take(sanitizeLimit(params.topIdfTerms, A.length(decoded))),
            A.map(([term, idf]) => ({
              idf,
              term,
            }))
          );
        }),
      });

      const documentTermMatrix = yield* Bool.match(params.includeMatrix, {
        onFalse: () => Effect.succeed(A.empty()),
        onTrue: Effect.fn("Wink.WinkCorpusManager.getStats.documentTermMatrix")(function* () {
          const raw = yield* Effect.try({
            try: () => compiled.vectorizer.out(its.docTermMatrix),
            catch: CorpusManagerError.fromCause("Failed to compute corpus matrix", { corpusId: params.corpusId }),
          });

          if (!A.isArray(raw)) {
            return yield* CorpusManagerError.fromMessage("Invalid document-term matrix output", params.corpusId);
          }

          return yield* Effect.forEach(raw, (row) =>
            decodeNumberArray(row, "document-term matrix row", params.corpusId)
          );
        }),
      });

      return {
        averageDocumentLength: Bool.match(compiledState.documents.length === 0, {
          onFalse: () => compiledState.totalTokenCount / compiledState.documents.length,
          onTrue: thunk0,
        }),
        corpusId: params.corpusId,
        documentTermMatrix,
        idfValues,
        matrixShape: {
          cols: NonNegativeInt.make(compiled.terms.length),
          rows: Bool.match(params.includeMatrix, {
            onFalse: () => NonNegativeInt.make(compiledState.documents.length),
            onTrue: () => NonNegativeInt.make(documentTermMatrix.length),
          }),
        },
        terms: compiled.terms,
        totalDocuments: NonNegativeInt.make(compiledState.documents.length),
        vocabularySize: NonNegativeInt.make(HashSet.size(compiledState.vocabulary)),
      };
    }, observeCorpus("stats")),

    learnDocuments: Effect.fn("Wink.WinkCorpusManager.learnDocuments")(function* (request: LearnCorpusParamsInput) {
      const params = LearnCorpusParams.make(request);
      yield* Effect.annotateCurrentSpan({
        corpus_id: params.corpusId,
        dedupe_by_id: `${params.dedupeById}`,
        document_count: params.documents.length,
      });
      const state = yield* getState(params.corpusId);
      const dedupeById = params.dedupeById;
      let existingIds = HashSet.fromIterable(
        pipe(
          state.documents,
          A.map((document) => document.id)
        )
      );
      let vocabulary = state.vocabulary;
      const learnedDocuments = A.empty<Document>();
      let skippedCount = 0;
      let totalTokenCount = state.totalTokenCount;

      for (const document of params.documents) {
        if (dedupeById && HashSet.has(existingIds, document.id)) {
          skippedCount += 1;
          continue;
        }

        const tokens = yield* readNormalizedTokens(document, params.corpusId);
        for (const token of tokens) {
          vocabulary = HashSet.add(vocabulary, token);
        }
        existingIds = HashSet.add(existingIds, document.id);
        A.appendInPlace(learnedDocuments, document);
        totalTokenCount += A.length(tokens);
      }

      const updatedState: CorpusSessionState = {
        ...state,
        compiled: O.none(),
        documents: A.appendAll(state.documents, learnedDocuments),
        totalTokenCount,
        updatedAtMs: yield* Clock.currentTimeMillis,
        vocabulary,
      };

      yield* setState(updatedState);

      return {
        corpusId: params.corpusId,
        learnedCount: NonNegativeInt.make(learnedDocuments.length),
        reindexRequired: true,
        skippedCount: NonNegativeInt.make(skippedCount),
        totalDocuments: NonNegativeInt.make(updatedState.documents.length),
        vocabularySize: NonNegativeInt.make(HashSet.size(updatedState.vocabulary)),
      };
    }, observeCorpus("learn_documents")),

    query: Effect.fn("Wink.WinkCorpusManager.query")(function* (request: QueryCorpusParamsInput) {
      const params = QueryCorpusParams.make(request);
      yield* Effect.annotateCurrentSpan({
        corpus_id: params.corpusId,
        include_text: `${params.includeText}`,
        top_n: `${params.topN ?? "default"}`,
        ...textLengthAttribute(params.query, "query"),
      });
      const state = yield* getState(params.corpusId);
      const { compiled, state: compiledState } = yield* ensureCompiled(state);

      if (compiledState.documents.length === 0) {
        return {
          corpusId: params.corpusId,
          method: "vector.cosine" as const,
          query: params.query,
          ranked: [],
          returned: NonNegativeInt.make(0),
          totalDocuments: NonNegativeInt.make(0),
        };
      }

      const its = yield* engine.its.pipe(
        Effect.mapError(CorpusManagerError.fromCause("Failed to access wink helpers", { corpusId: params.corpusId }))
      );
      const queryDoc = yield* engine
        .getWinkDoc(params.query)
        .pipe(
          Effect.mapError(CorpusManagerError.fromCause("Failed to tokenize query text", { corpusId: params.corpusId }))
        );
      const queryTokens = yield* decodeStringArray(
        queryDoc.tokens().out(its.normal),
        "query token output",
        params.corpusId
      );
      const nowMs = yield* Clock.currentTimeMillis;
      const queryVector = DocumentVector.make({
        documentId: DocumentId.make(`${params.corpusId}-query-${nowMs}`),
        terms: compiled.terms,
        vector: compiled.vectorizer.vectorOf(A.fromIterable(queryTokens)),
      });

      const scored = yield* Effect.forEach(
        compiledState.documents,
        Effect.fnUntraced(function* (document, index) {
          const candidateVector = DocumentVector.make({
            documentId: document.id,
            terms: compiled.terms,
            vector: compiled.documentVectors[index] ?? [],
          });
          const score = yield* similarity.vectorCosine(queryVector, candidateVector).pipe(
            Effect.mapError(
              CorpusManagerError.fromCause("Failed to compute query similarity", {
                corpusId: params.corpusId,
              })
            )
          );

          return yield* Bool.match(params.includeText, {
            onFalse: () =>
              Effect.succeed({
                id: document.id,
                index: NonNegativeInt.make(index),
                score: score.score,
              }),
            onTrue: () =>
              Effect.succeed({
                id: document.id,
                index: NonNegativeInt.make(index),
                score: score.score,
                text: document.text,
              }),
          });
        })
      );

      const ranked = pipe(
        scored,
        A.sortBy(
          descendingNumber((entry) => entry.score),
          ascendingNumber((entry) => entry.index)
        ),
        A.take(sanitizeLimit(params.topN, A.length(scored)))
      );

      return {
        corpusId: params.corpusId,
        method: "vector.cosine" as const,
        query: params.query,
        ranked,
        returned: NonNegativeInt.make(A.length(ranked)),
        totalDocuments: NonNegativeInt.make(A.length(compiledState.documents)),
      };
    }, observeCorpus("query")),
  });
}).pipe(observeWinkWorkflow({ name: "corpus.make" }));

/**
 * Service for managing stateful BM25 corpora and query sessions.
 *
 * **Details**
 *
 * Each corpus is stored in memory by `corpusId`. Learning documents invalidates
 * the compiled vector index; the next stats or query call recompiles it.
 *
 * **Example** (Create corpus via service)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { WinkLayerAllLive } from "@beep/wink"
 * import { WinkCorpusManager } from "@beep/wink"
 *
 * const createCorpus = Effect.gen(function* () {
 *   const manager = yield* WinkCorpusManager
 *   return yield* manager.createCorpus({ corpusId: "support-docs" })
 * })
 *
 * Effect.runPromise(createCorpus.pipe(Effect.provide(WinkLayerAllLive))).then((summary) =>
 *   console.log(summary.documentCount)
 * )
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class WinkCorpusManager extends Context.Service<WinkCorpusManager, WinkCorpusManagerShape>()(
  $I`WinkCorpusManager`
) {}

/**
 * Live corpus manager layer requiring the wink engine and similarity services.
 *
 * **Example** (Provide with dependency layers)
 *
 * ```ts
 * import { Effect, Layer } from "effect"
 * import { WinkEngineLive } from "@beep/wink"
 * import { WinkSimilarityLive } from "@beep/wink"
 * import { WinkCorpusManager, WinkCorpusManagerLive } from "@beep/wink"
 *
 * const createCorpus = Effect.gen(function* () {
 *   const manager = yield* WinkCorpusManager
 *   return yield* manager.createCorpus({ corpusId: "support-docs" })
 * })
 *
 * Effect.runPromise(
 *   createCorpus.pipe(
 *     Effect.provide(WinkCorpusManagerLive.pipe(Layer.provideMerge(Layer.mergeAll(WinkEngineLive, WinkSimilarityLive))))
 *   )
 * ).then((summary) => console.log(summary.corpusId))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WinkCorpusManagerLive = Layer.effect(WinkCorpusManager, makeWinkCorpusManager);
