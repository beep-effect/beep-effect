/**
 * Wink BM25 vectorizer service and related domain models.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $WinkId } from "@beep/identity";
import { BagOfWords, DefaultBM25Config, DocumentVector, TermFrequency } from "@beep/nlp/Core/Vectorization";
import { Defect, SchemaUtils } from "@beep/schema";
import { A } from "@beep/utils";
import { Chunk, Context, Effect, Inspectable, Layer, pipe, Ref } from "effect";
import * as Bool from "effect/Boolean";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { loadBM25Vectorizer, normalizeTokenText } from "./internal/bm25.ts";
import { WinkStringArray } from "./Wink.models.ts";
import { WinkEngine } from "./Wink.service.ts";
import { observeWinkWorkflow } from "./WinkObservability.ts";
import type { Document, DocumentId } from "@beep/nlp/Core/Document";
import type { BM25Config } from "@beep/nlp/Core/Vectorization";
import type { ItsHelpers } from "wink-nlp";
import type { BM25VectorizerInstance, BM25VectorizerWithBowInstance } from "./internal/bm25.ts";

const $I = $WinkId.create("Wink/WinkVectorizer");

type VectorizerState = {
  readonly documentIds: ReadonlyArray<DocumentId>;
  readonly vectorizer: BM25VectorizerWithBowInstance;
};
type WinkEngineService = typeof WinkEngine.Service;

const appendDocument = (state: VectorizerState, document: Document): VectorizerState => ({
  documentIds: [...state.documentIds, document.id],
  vectorizer: state.vectorizer,
});

const learnDocumentState = (
  state: VectorizerState,
  document: Document,
  tokens: ReadonlyArray<string>
): VectorizerState => {
  state.vectorizer.learn(A.fromIterable(tokens));
  return appendDocument(state, document);
};

/**
 * Isolated vectorizer surface passed to scoped BM25 workflows.
 *
 * **Details**
 *
 * Implementations created by `withFreshInstance` do not mutate the shared live
 * vectorizer state, which makes them useful for one-off ranking and keyword
 * extraction jobs.
 *
 * **Example** (Read scoped document terms)
 *
 * ```ts
 * import { Effect } from "effect"
 * import type { ScopedVectorizer } from "@beep/wink"
 *
 * const readFirstDocumentTerms = (scoped: ScopedVectorizer) =>
 *   scoped.getDocumentTermFrequencies(0).pipe(Effect.map((terms) => terms.length))
 *
 * console.log(typeof readFirstDocumentTerms)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface ScopedVectorizer {
  readonly getDocumentTermFrequencies: (
    docIndex: number
  ) => Effect.Effect<ReadonlyArray<TermFrequency>, VectorizerError>;
  readonly learnDocument: (document: Document) => Effect.Effect<void, VectorizerError>;
  readonly vectorizeDocument: (document: Document) => Effect.Effect<DocumentVector, VectorizerError>;
}

type WinkVectorizerShape = {
  readonly getBagOfWords: (document: Document) => Effect.Effect<BagOfWords, VectorizerError>;
  readonly getConfig: Effect.Effect<BM25Config>;
  readonly getDocumentTermFrequencies: (
    docIndex: number
  ) => Effect.Effect<ReadonlyArray<TermFrequency>, VectorizerError>;
  readonly learnDocument: (document: Document) => Effect.Effect<void, VectorizerError>;
  readonly learnDocuments: (documents: ReadonlyArray<Document>) => Effect.Effect<void, VectorizerError>;
  readonly reset: Effect.Effect<void, VectorizerError>;
  readonly vectorizeDocument: (document: Document) => Effect.Effect<DocumentVector, VectorizerError>;
  readonly withFreshInstance: <A, E, R>(
    f: (isolated: ScopedVectorizer) => Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E | VectorizerError, R>;
};

const toFiniteRecord = (record: Record<string, number>): Record<string, number> =>
  R.fromEntries(A.map(R.toEntries(record), ([key, value]) => [key, P.isNumber(value) ? value : 0] as const));

const TermFrequencyPair = S.Tuple([S.String, S.Finite]).pipe(
  $I.annoteSchema("TermFrequencyPair", {
    description: "Term and finite frequency pair returned by wink vectorizer accessors.",
  })
);
const TermFrequencyPairs = S.Array(TermFrequencyPair).pipe(
  $I.annoteSchema("TermFrequencyPairs", {
    description: "Array of term and frequency pairs returned by wink vectorizer accessors.",
  })
);

const decodeStringArray = (value: unknown, operation: string): Effect.Effect<ReadonlyArray<string>, VectorizerError> =>
  Effect.fromOption(S.decodeUnknownOption(WinkStringArray)(value), () =>
    VectorizerError.fromMessage(`Invalid ${operation} result: expected string[]`, operation)
  );

const decodeTermFrequencyPairs = (
  value: unknown,
  operation: string
): Effect.Effect<ReadonlyArray<readonly [string, number]>, VectorizerError> =>
  Effect.fromOption(S.decodeUnknownOption(TermFrequencyPairs)(value), () =>
    VectorizerError.fromMessage(`Invalid ${operation} result: expected [string, number][]`, operation)
  );

const readNormalizedTokensFromWink = (
  engine: WinkEngineService,
  document: Document,
  its: ItsHelpers
): Effect.Effect<ReadonlyArray<string>, VectorizerError> =>
  engine.getWinkDoc(document.text).pipe(
    Effect.flatMap((winkDoc) => decodeStringArray(winkDoc.tokens().out(its.normal), "readNormalizedTokens")),
    Effect.map(A.fromIterable),
    Effect.mapError(VectorizerError.fromCause("readNormalizedTokens"))
  );

const observeVectorizer = (operation: string) =>
  observeWinkWorkflow({
    metricAttributes: { operation },
    name: `vectorizer.${operation}`,
  });

/**
 * Typed failure for learning documents or querying wink BM25 vector data.
 *
 * **Example** (Create error from message)
 *
 * ```ts
 * import { VectorizerError } from "@beep/wink"
 *
 * const error = VectorizerError.fromMessage("Document index is out of range", "tf")
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VectorizerError extends S.TaggedError<VectorizerError>($I`VectorizerError`)(
  "VectorizerError",
  {
    cause: S.OptionFromOptionalKey(Defect({ includeStack: true })).pipe(SchemaUtils.withNoneDefault),
    message: S.String,
    operation: S.String,
  },
  $I.annoteError<VectorizerError>("VectorizerError", {
    description: "Failure raised while learning or querying wink BM25 vectors.",
  })
) {
  /**
   * Convert an unknown cause into a typed vectorizer error.
   *
   * @param cause - The underlying failure or defect.
   * @param operation - The vectorizer operation that failed.
   * @returns A typed vectorizer error value.
   */
  static readonly fromCause: {
    (cause: unknown, operation: string): VectorizerError;
    (operation: string): (cause: unknown) => VectorizerError;
  } = dual(
    2,
    (cause: unknown, operation: string): VectorizerError =>
      VectorizerError.make({
        cause: O.some(cause),
        message: `Wink vectorizer ${operation} failed: ${Inspectable.toStringUnknown(cause)}`,
        operation,
      })
  );

  /**
   * Create a vectorizer error without an external cause.
   *
   * @param message - The human-readable vectorizer error message.
   * @param operation - The vectorizer operation associated with the failure.
   * @returns A typed vectorizer error value without an external cause.
   */
  static readonly fromMessage: {
    (message: string, operation: string): VectorizerError;
    (message: string): (operation: string) => VectorizerError;
  } = dual(
    2,
    (message: string, operation: string): VectorizerError =>
      VectorizerError.make({
        message,
        operation,
      })
  );
}

const makeWinkVectorizer = Effect.gen(function* () {
  const engine = yield* WinkEngine;
  const its = yield* engine.its;
  const bm25 = yield* Effect.try({
    try: () => loadBM25Vectorizer<BM25VectorizerWithBowInstance>(),
    catch: VectorizerError.fromCause("initialize"),
  });

  const config = DefaultBM25Config;
  const vectorizerRef = yield* Ref.make<VectorizerState>({
    documentIds: [],
    vectorizer: bm25(config),
  });

  const readNormalizedTokens = (document: Document): Effect.Effect<ReadonlyArray<string>, VectorizerError> =>
    Bool.match(document.tokenCount > 0, {
      onFalse: () => readNormalizedTokensFromWink(engine, document, its),
      onTrue: () =>
        Effect.succeed(A.fromIterable(pipe(Chunk.toReadonlyArray(document.tokens), A.map(normalizeTokenText)))),
    });

  const getTerms = (vectorizer: BM25VectorizerInstance): Effect.Effect<ReadonlyArray<string>, VectorizerError> =>
    pipe(
      Effect.try({
        try: () => vectorizer.out(its.terms),
        catch: VectorizerError.fromCause("terms"),
      }),
      Effect.flatMap((output) => decodeStringArray(output, "terms"))
    );

  const getTermFrequencies = (vectorizer: BM25VectorizerInstance, docIndex: number) =>
    pipe(
      Effect.try({
        try: () => vectorizer.doc(docIndex).out(its.tf),
        catch: VectorizerError.fromCause("tf"),
      }),
      Effect.flatMap((output) => decodeTermFrequencyPairs(output, "tf")),
      Effect.map((raw) =>
        A.map(raw, ([term, frequency]) =>
          TermFrequency.make({
            frequency,
            term,
          })
        )
      )
    );

  return WinkVectorizer.of({
    getBagOfWords: Effect.fn("Wink.WinkVectorizer.getBagOfWords")(function* (document: Document) {
      yield* Effect.annotateCurrentSpan({
        document_id: document.id,
        token_count: document.tokenCount,
      });
      const state = yield* Ref.get(vectorizerRef);
      const tokens = yield* readNormalizedTokens(document);

      return BagOfWords.make({
        bow: toFiniteRecord(state.vectorizer.bowOf(A.fromIterable(tokens), true)),
        documentId: document.id,
      });
    }, observeVectorizer("get_bag_of_words")),
    getConfig: Effect.succeed(config),
    getDocumentTermFrequencies: Effect.fn("Wink.WinkVectorizer.getDocumentTermFrequencies")(function* (
      docIndex: number
    ) {
      yield* Effect.annotateCurrentSpan({ doc_index: docIndex });
      const state = yield* Ref.get(vectorizerRef);
      return yield* getTermFrequencies(state.vectorizer, docIndex);
    }, observeVectorizer("get_document_term_frequencies")),
    learnDocument: Effect.fn("Wink.WinkVectorizer.learnDocument")(function* (document: Document) {
      yield* Effect.annotateCurrentSpan({
        document_id: document.id,
        token_count: document.tokenCount,
      });
      const tokens = yield* readNormalizedTokens(document);
      yield* Ref.update(vectorizerRef, (state) => learnDocumentState(state, document, tokens));
    }, observeVectorizer("learn_document")),
    learnDocuments: Effect.fn("Wink.WinkVectorizer.learnDocuments")(function* (documents: ReadonlyArray<Document>) {
      yield* Effect.annotateCurrentSpan({ document_count: documents.length });
      for (const document of documents) {
        const tokens = yield* readNormalizedTokens(document);
        yield* Ref.update(vectorizerRef, (state) => learnDocumentState(state, document, tokens));
      }
    }, observeVectorizer("learn_documents")),
    reset: Ref.set(vectorizerRef, {
      documentIds: [],
      vectorizer: bm25(config),
    }).pipe(Effect.mapError(VectorizerError.fromCause("reset")), observeVectorizer("reset")),
    vectorizeDocument: Effect.fn("Wink.WinkVectorizer.vectorizeDocument")(function* (document: Document) {
      yield* Effect.annotateCurrentSpan({
        document_id: document.id,
        token_count: document.tokenCount,
      });
      const state = yield* Ref.get(vectorizerRef);
      const tokens = yield* readNormalizedTokens(document);
      const terms = yield* getTerms(state.vectorizer);

      return DocumentVector.make({
        documentId: document.id,
        terms,
        vector: state.vectorizer.vectorOf(A.fromIterable(tokens)),
      });
    }, observeVectorizer("vectorize_document")),
    withFreshInstance: Effect.fn("Wink.WinkVectorizer.withFreshInstance")(
      <A, E, R>(f: (isolated: ScopedVectorizer) => Effect.Effect<A, E, R>) => {
        const freshVectorizer = bm25(config);

        const isolated: ScopedVectorizer = {
          getDocumentTermFrequencies: (docIndex) => getTermFrequencies(freshVectorizer, docIndex),
          learnDocument: (document) =>
            pipe(
              readNormalizedTokens(document),
              Effect.flatMap((tokens) => Effect.sync(() => freshVectorizer.learn(A.fromIterable(tokens)))),
              Effect.mapError(VectorizerError.fromCause("freshLearnDocument"))
            ),
          vectorizeDocument: (document) =>
            Effect.flatMap(readNormalizedTokens(document), (tokens) =>
              getTerms(freshVectorizer).pipe(
                Effect.map((terms) =>
                  DocumentVector.make({
                    documentId: document.id,
                    terms,
                    vector: freshVectorizer.vectorOf(A.fromIterable(tokens)),
                  })
                )
              )
            ),
        };

        return f(isolated).pipe(observeVectorizer("with_fresh_instance"));
      }
    ),
  });
}).pipe(observeWinkWorkflow({ name: "vectorizer.make" }));

/**
 * Service for learning documents and producing BM25 vectors, bags, and term frequencies.
 *
 * **Example** (Read vectorizer config)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { WinkEngineLive } from "@beep/wink"
 * import { WinkVectorizer, WinkVectorizerLive } from "@beep/wink"
 *
 * const readConfig = Effect.gen(function* () {
 *   const vectorizer = yield* WinkVectorizer
 *   return yield* vectorizer.getConfig
 * })
 *
 * Effect.runPromise(
 *   readConfig.pipe(Effect.provide(WinkVectorizerLive), Effect.provide(WinkEngineLive))
 * ).then((config) => console.log(config.norm))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class WinkVectorizer extends Context.Service<WinkVectorizer, WinkVectorizerShape>()($I`WinkVectorizer`) {}

/**
 * Live BM25 vectorizer layer that depends on the wink engine.
 *
 * **Example** (Provide live vectorizer layer)
 *
 * ```ts
 * import { Effect, Layer } from "effect"
 * import { WinkEngineLive } from "@beep/wink"
 * import { WinkVectorizer, WinkVectorizerLive } from "@beep/wink"
 *
 * const readDefaultConfig = Effect.gen(function* () {
 *   const vectorizer = yield* WinkVectorizer
 *   return yield* vectorizer.getConfig
 * })
 *
 * Effect.runPromise(
 *   readDefaultConfig.pipe(Effect.provide(WinkVectorizerLive.pipe(Layer.provide(WinkEngineLive))))
 * ).then((config) => console.log(config.k1))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WinkVectorizerLive = Layer.effect(WinkVectorizer, makeWinkVectorizer);
