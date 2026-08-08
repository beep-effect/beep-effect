/**
 * Wink similarity services and domain models.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { createRequire } from "node:module";
import { $WinkId } from "@beep/identity";
import { SimilarityScore } from "@beep/nlp/Core/Similarity";
import { TaggedErrorClass } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Context, Effect, Inspectable, Layer } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { observeWinkWorkflow } from "./WinkObservability.ts";
import type { DocumentTermSet, TverskyParams } from "@beep/nlp/Core/Similarity";
import type { BagOfWords, DocumentVector } from "@beep/nlp/Core/Vectorization";

const $I = $WinkId.create("Wink/WinkSimilarity");
const require = createRequire(import.meta.url);

type BowSimilarity = {
  readonly cosine: (left: Record<string, number>, right: Record<string, number>) => number;
};

type SetSimilarity = {
  readonly tversky: (left: Set<string>, right: Set<string>, alpha: number, beta: number) => number;
};

type VectorSimilarity = {
  readonly cosine: (left: ReadonlyArray<number>, right: ReadonlyArray<number>) => number;
};

// The wink-nlp similarity module's `bow`, `set`, and `vector` namespaces are
// in-process native function handles, never decoded from external input;
// structural `S.declare`s carry them through the runtime schema.
const BowSimilarityFromSelf = S.declare((u: unknown): u is BowSimilarity => P.isObject(u)).pipe(
  $I.annoteSchema("BowSimilarityFromSelf", {
    description: "In-process wink-nlp bag-of-words cosine similarity handle carried through the service runtime.",
  })
);

const SetSimilarityFromSelf = S.declare((u: unknown): u is SetSimilarity => P.isObject(u)).pipe(
  $I.annoteSchema("SetSimilarityFromSelf", {
    description: "In-process wink-nlp set Tversky similarity handle carried through the service runtime.",
  })
);

const VectorSimilarityFromSelf = S.declare((u: unknown): u is VectorSimilarity => P.isObject(u)).pipe(
  $I.annoteSchema("VectorSimilarityFromSelf", {
    description: "In-process wink-nlp vector cosine similarity handle carried through the service runtime.",
  })
);

class SimilarityRuntime extends S.Class<SimilarityRuntime>($I`SimilarityRuntime`)(
  {
    bow: BowSimilarityFromSelf,
    set: SetSimilarityFromSelf,
    vector: VectorSimilarityFromSelf,
  },
  $I.annote("SimilarityRuntime", {
    description:
      "In-process wink-nlp native similarity function bag: bag-of-words cosine, set Tversky, and vector cosine handles.",
  })
) {}

type WinkSimilarityShape = {
  readonly bowCosine: (left: BagOfWords, right: BagOfWords) => Effect.Effect<SimilarityScore, SimilarityError>;
  readonly setTversky: (
    left: DocumentTermSet,
    right: DocumentTermSet,
    params: TverskyParams
  ) => Effect.Effect<SimilarityScore, SimilarityError>;
  readonly vectorCosine: (
    left: DocumentVector,
    right: DocumentVector
  ) => Effect.Effect<SimilarityScore, SimilarityError>;
};

const loadSimilarityRuntime = (): SimilarityRuntime => SimilarityRuntime.make(require("wink-nlp/utilities/similarity"));

// effect-native-migration: WONTFIX (wink-nlp FFI requires native Set)
const toNativeTermSet = (terms: ReadonlyArray<string>): Set<string> => new Set(terms);

/**
 * Typed failure for wink-backed vector, set, or bag-of-words similarity.
 *
 * **Example** (Create from cause)
 *
 * ```ts
 * import { SimilarityError } from "@beep/wink"
 *
 * const error = SimilarityError.fromCause(new Error("bad vector"), "vectorCosine")
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SimilarityError extends TaggedErrorClass<SimilarityError>($I`SimilarityError`)(
  "SimilarityError",
  {
    cause: S.Defect({ includeStack: true }),
    message: S.String,
    operation: S.String,
  },
  $I.annote("SimilarityError", {
    description: "Failure raised while computing wink-backed similarity scores.",
  })
) {
  /**
   * Convert an unknown cause into a typed similarity error.
   *
   * @param cause - The underlying failure or defect.
   * @param operation - The similarity operation that failed.
   * @returns A typed similarity error value.
   */
  static readonly fromCause: {
    (cause: unknown, operation: string): SimilarityError;
    (operation: string): (cause: unknown) => SimilarityError;
  } = dual(
    2,
    (cause: unknown, operation: string): SimilarityError =>
      SimilarityError.make({
        cause,
        message: `Wink similarity ${operation} failed: ${Inspectable.toStringUnknown(cause)}`,
        operation,
      })
  );
}

const sanitizeScore = (score: number): UnitInterval => {
  if (!Number.isFinite(score)) {
    return UnitInterval.make(0);
  }

  if (score < 0) {
    return UnitInterval.make(0);
  }

  if (score > 1) {
    return UnitInterval.make(1);
  }

  return UnitInterval.make(score);
};

const sanitizeScoreEffect = (score: number, operation: string): Effect.Effect<UnitInterval> => {
  const sanitized = sanitizeScore(score);

  if (Object.is(score, sanitized)) {
    return Effect.succeed(sanitized);
  }

  return Effect.logWarning("wink similarity score sanitized").pipe(
    Effect.annotateLogs({
      operation,
      rawScore: `${score}`,
      sanitizedScore: `${sanitized}`,
    }),
    Effect.andThen(
      Effect.annotateCurrentSpan({
        raw_similarity_score: score,
        sanitized_similarity_score: sanitized,
        similarity_score_sanitized: true,
      })
    ),
    Effect.as(sanitized)
  );
};

const observeSimilarity = (operation: string) =>
  observeWinkWorkflow({
    metricAttributes: { operation },
    name: `similarity.${operation}`,
  });

const makeWinkSimilarity = Effect.gen(function* () {
  const similarity = yield* Effect.try({
    try: loadSimilarityRuntime,
    catch: SimilarityError.fromCause("initialize"),
  });

  return WinkSimilarity.of({
    bowCosine: Effect.fn("Wink.WinkSimilarity.bowCosine")(function* (left: BagOfWords, right: BagOfWords) {
      yield* Effect.annotateCurrentSpan({
        document_1_id: left.documentId,
        document_2_id: right.documentId,
      });
      const rawScore = yield* Effect.try({
        try: () => similarity.bow.cosine(left.bow, right.bow),
        catch: SimilarityError.fromCause("bowCosine"),
      });
      const score = yield* sanitizeScoreEffect(rawScore, "bowCosine");

      return SimilarityScore.make({
        document1Id: left.documentId,
        document2Id: right.documentId,
        method: "bow.cosine",
        parameters: O.none(),
        score,
      });
    }, observeSimilarity("bow_cosine")),
    setTversky: Effect.fn("Wink.WinkSimilarity.setTversky")(function* (
      left: DocumentTermSet,
      right: DocumentTermSet,
      params: TverskyParams
    ) {
      yield* Effect.annotateCurrentSpan({
        alpha: params.alpha,
        beta: params.beta,
        document_1_id: left.documentId,
        document_2_id: right.documentId,
        left_term_count: left.terms.length,
        right_term_count: right.terms.length,
      });
      const rawScore = yield* Effect.try({
        try: () =>
          similarity.set.tversky(toNativeTermSet(left.terms), toNativeTermSet(right.terms), params.alpha, params.beta),
        catch: SimilarityError.fromCause("setTversky"),
      });
      const score = yield* sanitizeScoreEffect(rawScore, "setTversky");

      return SimilarityScore.make({
        document1Id: left.documentId,
        document2Id: right.documentId,
        method: "set.tversky",
        parameters: O.some({
          alpha: params.alpha,
          beta: params.beta,
        }),
        score,
      });
    }, observeSimilarity("set_tversky")),
    vectorCosine: Effect.fn("Wink.WinkSimilarity.vectorCosine")(function* (
      left: DocumentVector,
      right: DocumentVector
    ) {
      yield* Effect.annotateCurrentSpan({
        document_1_id: left.documentId,
        document_2_id: right.documentId,
        left_vector_length: left.vector.length,
        right_vector_length: right.vector.length,
      });
      const rawScore = yield* Effect.try({
        try: () => similarity.vector.cosine(left.vector, right.vector),
        catch: SimilarityError.fromCause("vectorCosine"),
      });
      const score = yield* sanitizeScoreEffect(rawScore, "vectorCosine");

      return SimilarityScore.make({
        document1Id: left.documentId,
        document2Id: right.documentId,
        method: "vector.cosine",
        parameters: O.none(),
        score,
      });
    }, observeSimilarity("vector_cosine")),
  });
}).pipe(observeWinkWorkflow({ name: "similarity.make" }));

/**
 * Service for computing cosine and Tversky scores using wink similarity helpers.
 *
 * **Example** (Compute set Tversky score)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { UnitInterval } from "@beep/schema/UnitInterval"
 * import { DocumentId } from "@beep/nlp/Core/Document"
 * import { DocumentTermSet, TverskyParams } from "@beep/nlp/Core/Similarity"
 * import { WinkSimilarity, WinkSimilarityLive } from "@beep/wink"
 *
 * const compare = Effect.gen(function* () {
 *   const similarity = yield* WinkSimilarity
 *   return yield* similarity.setTversky(
 *     DocumentTermSet.make({ documentId: DocumentId.make("doc-a"), terms: ["effect", "schema"] }),
 *     DocumentTermSet.make({ documentId: DocumentId.make("doc-b"), terms: ["effect", "docs"] }),
 *     TverskyParams.make({
 *       alpha: UnitInterval.make(0.5),
 *       beta: UnitInterval.make(0.5)
 *     })
 *   )
 * })
 *
 * Effect.runPromise(compare.pipe(Effect.provide(WinkSimilarityLive))).then((score) =>
 *   console.log(score.score)
 * )
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class WinkSimilarity extends Context.Service<WinkSimilarity, WinkSimilarityShape>()($I`WinkSimilarity`) {}

/**
 * Live layer for wink similarity utilities.
 *
 * **Example** (Provide live layer)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { UnitInterval } from "@beep/schema/UnitInterval"
 * import { DocumentId } from "@beep/nlp/Core/Document"
 * import { DocumentTermSet, TverskyParams } from "@beep/nlp/Core/Similarity"
 * import { WinkSimilarity, WinkSimilarityLive } from "@beep/wink"
 *
 * const program = Effect.gen(function* () {
 *   const similarity = yield* WinkSimilarity
 *   return yield* similarity.setTversky(
 *     DocumentTermSet.make({ documentId: DocumentId.make("left"), terms: ["nlp"] }),
 *     DocumentTermSet.make({ documentId: DocumentId.make("right"), terms: ["nlp", "search"] }),
 *     TverskyParams.make({
 *       alpha: UnitInterval.make(0.5),
 *       beta: UnitInterval.make(0.5)
 *     })
 *   )
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(WinkSimilarityLive))).then((score) =>
 *   console.log(score.method)
 * )
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WinkSimilarityLive = Layer.effect(WinkSimilarity, makeWinkSimilarity);
