/**
 * Recall queries, budgets, fusion weights, candidates and results.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as Effect from "effect/Effect";
import * as Num from "effect/Number";
import * as S from "effect/Schema";
import { MemoryGateViolation } from "./Admission.models.ts";
import { MemoryFilePath, NodeId, NodeKind, RevisionId } from "./NodeIdentity.models.ts";
import { ScipSymbol } from "./Scip.models.ts";
import { StatusValue } from "./StatusLifecycle.models.ts";

const $I = $AgentMemoryStoreId.create("Recall.models");

const RecallFilterKind = LiteralKit(["path", "kind", "status", "symbol"]).pipe(
  $I.annoteSchema("RecallFilterKind", {
    description: "Internal literal vocabulary used to build RecallFilter.",
  })
);

/**
 * Authoritative recall filter, discriminated on `filter`.
 *
 * **Details**
 *
 * Filters run before fusion and narrow the candidate pool exactly: recall
 * passes them to each index inside {@link IndexSearch}, and the index applies
 * them before its limit. `symbol` is the typed identity lookup.
 *
 * **Example** (Filter by node kind)
 *
 * ```ts
 * import { RecallFilter } from "@beep/agent-memory-store"
 *
 * const filter = RecallFilter.cases.kind.make({ kind: "listItem" })
 * console.log(filter.filter)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RecallFilter = RecallFilterKind.toTaggedUnion("filter")({
  path: {
    path: MemoryFilePath.annotateKey({ description: "Memory file the candidates must come from." }),
  },
  kind: {
    kind: NodeKind.annotateKey({ description: "Node kind the candidates must have." }),
  },
  status: {
    field: S.NonEmptyString.annotateKey({ description: "Typed status field to match." }),
    value: StatusValue.annotateKey({ description: "Status value the field must hold." }),
  },
  symbol: {
    symbol: ScipSymbol.annotateKey({ description: "Code symbol the candidates must reference." }),
  },
}).pipe(
  $I.annoteSchema("RecallFilter", {
    description: "Authoritative recall filter, discriminated on filter.",
  })
);

/**
 * Runtime type for {@link RecallFilter}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RecallFilter = typeof RecallFilter.Type;

/**
 * Size limits applied at the end of recall.
 *
 * **Details**
 *
 * `maxCandidates` defaults to 50 and `maxAccepted` to 5 when omitted, both at
 * construction and at decode.
 *
 * **Example** (Apply the budget defaults)
 *
 * ```ts
 * import { RecallBudget } from "@beep/agent-memory-store"
 *
 * const budget = RecallBudget.make({ maxTokens: 2000 })
 * console.log(budget.maxCandidates, budget.maxAccepted) // 50 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RecallBudget extends S.Opaque<RecallBudget, { readonly brand: unique symbol }>()(
  S.Struct({
    maxCandidates: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(50)),
      S.withDecodingDefaultKey(Effect.succeed(50))
    ).annotateKey({ description: "Most candidates fusion may pass to the reranker; defaults to 50." }),
    maxAccepted: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(5)),
      S.withDecodingDefaultKey(Effect.succeed(5))
    ).annotateKey({ description: "Most candidates recall may accept; defaults to 5." }),
    maxTokens: S.Natural.annotateKey({ description: "Token budget for the accepted candidates' text." }),
  }).pipe(
    $I.annoteSchema("RecallBudget", {
      description: "Size limits applied at the end of recall.",
    })
  )
) {}

/**
 * One search request against a single index: query text, authoritative
 * filters and a result limit.
 *
 * **Details**
 *
 * Decision `index-search-applies-filters-and-embedder-port`: the filters go
 * to the index with the query, so the index narrows the pool before it
 * applies `limit`. Filtering after the limit would drop matching nodes that
 * ranked below unrelated ones.
 *
 * **Example** (Search list items only)
 *
 * ```ts
 * import { IndexSearch, RecallFilter } from "@beep/agent-memory-store"
 *
 * const search = IndexSearch.make({
 *   text: "sqlite driver",
 *   filters: [RecallFilter.cases.kind.make({ kind: "listItem" })],
 *   limit: 50,
 * })
 * console.log(search.limit)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IndexSearch extends S.Opaque<IndexSearch, { readonly brand: unique symbol }>()(
  S.Struct({
    text: S.NonEmptyString.annotateKey({ description: "Query text." }),
    filters: S.Array(RecallFilter).annotateKey({
      description: "Authoritative filters the index applies before the limit.",
    }),
    limit: S.Natural.annotateKey({ description: "Most hits the index may return." }),
  }).pipe(
    $I.annoteSchema("IndexSearch", {
      description: "One search request against a single index.",
    })
  )
) {}

/**
 * One hit from a single index, with that index's own score.
 *
 * **Details**
 *
 * A hit is what one index knows: fusion has not run, so it carries no fused
 * or reranked score. Recall builds {@link Candidate} values from the hits of
 * both indexes.
 *
 * **Example** (Construct a text index hit)
 *
 * ```ts
 * import { IndexHit, NodeId, RevisionId } from "@beep/agent-memory-store"
 *
 * const hit = IndexHit.make({
 *   nodeId: NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e7f"),
 *   revisionId: RevisionId.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   text: "Use the sqlite driver.",
 *   score: 4.2,
 * })
 * console.log(hit.score)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IndexHit extends S.Opaque<IndexHit, { readonly brand: unique symbol }>()(
  S.Struct({
    nodeId: NodeId.annotateKey({ description: "Node the index returned." }),
    revisionId: RevisionId.annotateKey({ description: "Revision the indexed text comes from." }),
    text: S.String.annotateKey({ description: "Indexed node text." }),
    score: S.Finite.annotateKey({ description: "Score in the index's own scale." }),
  }).pipe(
    $I.annoteSchema("IndexHit", {
      description: "One hit from a single index, with that index's own score.",
    })
  )
) {}

/**
 * Name of the embedding model a vector was produced by.
 *
 * **Example** (Brand an embedding model name)
 *
 * ```ts
 * import { EmbeddingModel } from "@beep/agent-memory-store"
 *
 * console.log(EmbeddingModel.make("bge-small-en-v1.5"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EmbeddingModel = S.NonEmptyString.pipe(
  S.brand("EmbeddingModel"),
  $I.annoteSchema("EmbeddingModel", {
    description: "Name of the embedding model a vector was produced by.",
  })
);

/**
 * Runtime type for {@link EmbeddingModel}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type EmbeddingModel = typeof EmbeddingModel.Type;

/**
 * One embedding vector with the model that produced it.
 *
 * **Details**
 *
 * Vectors from different models are not comparable, so the model name travels
 * with the values and the vector index rebuilds when it changes.
 *
 * **Example** (Construct an embedding)
 *
 * ```ts
 * import { Embedding, EmbeddingModel } from "@beep/agent-memory-store"
 *
 * const embedding = Embedding.make({
 *   model: EmbeddingModel.make("bge-small-en-v1.5"),
 *   values: [0.1, -0.2, 0.3],
 * })
 * console.log(embedding.values.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Embedding extends S.Opaque<Embedding, { readonly brand: unique symbol }>()(
  S.Struct({
    model: EmbeddingModel.annotateKey({ description: "Model that produced the vector." }),
    values: S.NonEmptyArray(S.Finite).annotateKey({ description: "Vector components." }),
  }).pipe(
    $I.annoteSchema("Embedding", {
      description: "One embedding vector with the model that produced it.",
    })
  )
) {}

const FUSION_WEIGHT_TOLERANCE = 1e-9;

const sumsToOne = Num.between({ minimum: 1 - FUSION_WEIGHT_TOLERANCE, maximum: 1 + FUSION_WEIGHT_TOLERANCE });

/**
 * Convex fusion weights for BM25 and vector scores.
 *
 * **Details**
 *
 * The two weights must sum to 1. See {@link defaultFusionWeights} for the
 * BM25-leaning starting point.
 *
 * **Example** (Weigh BM25 and vector scores)
 *
 * ```ts
 * import { FusionWeights } from "@beep/agent-memory-store"
 * import { UnitInterval } from "@beep/schema/UnitInterval"
 *
 * const weights = FusionWeights.make({ bm25: UnitInterval.make(0.6), vector: UnitInterval.make(0.4) })
 * console.log(weights.bm25)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FusionWeights extends S.Opaque<FusionWeights, { readonly brand: unique symbol }>()(
  S.Struct({
    bm25: UnitInterval.annotateKey({ description: "Weight of the normalized BM25 score." }),
    vector: UnitInterval.annotateKey({ description: "Weight of the normalized vector score." }),
  })
    .check(
      S.makeFilter(
        (weights) => sumsToOne(weights.bm25 + weights.vector),
        $I.annote("FusionWeightsSumCheck", {
          title: "Fusion Weights Sum",
          description: "Convex fusion weights sum to 1.",
          message: "Expected the BM25 and vector weights to sum to 1.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("FusionWeights", {
        description: "Convex fusion weights for BM25 and vector scores.",
      })
    )
) {}

/**
 * Default BM25-leaning fusion weights: 0.7 BM25, 0.3 vector.
 *
 * **Details**
 *
 * S7 measured BM25-leaning convex fusion at 64/71 recall at 5 against RRF's
 * 59/71. These are starting weights; AC-6 re-measures them against the convex
 * pool and a decision file records any change.
 *
 * **Example** (Read the default weights)
 *
 * ```ts
 * import { defaultFusionWeights } from "@beep/agent-memory-store"
 *
 * console.log(defaultFusionWeights.bm25, defaultFusionWeights.vector) // 0.7 0.3
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const defaultFusionWeights: FusionWeights = FusionWeights.make({
  bm25: UnitInterval.make(0.7),
  vector: UnitInterval.make(0.3),
});

/**
 * A recall request: query text, authoritative filters and budgets.
 *
 * **Example** (Ask for list items about a decision)
 *
 * ```ts
 * import { RecallBudget, RecallFilter, RecallQuery } from "@beep/agent-memory-store"
 *
 * const query = RecallQuery.make({
 *   text: "sqlite driver decision",
 *   filters: [RecallFilter.cases.kind.make({ kind: "listItem" })],
 *   budget: RecallBudget.make({ maxTokens: 2000 }),
 * })
 * console.log(query.filters.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RecallQuery extends S.Opaque<RecallQuery, { readonly brand: unique symbol }>()(
  S.Struct({
    text: S.NonEmptyString.annotateKey({ description: "Query text." }),
    filters: S.Array(RecallFilter).annotateKey({ description: "Authoritative filters applied before fusion." }),
    budget: RecallBudget.annotateKey({ description: "Size limits applied at the end of recall." }),
  }).pipe(
    $I.annoteSchema("RecallQuery", {
      description: "A recall request: query text, authoritative filters and budgets.",
    })
  )
) {}

/**
 * One recall candidate with the score from each stage that saw it.
 *
 * **Details**
 *
 * `bm25` and `vector` are absent when that index did not return the node;
 * `reranked` is absent until a reranker scores it.
 *
 * **Example** (Construct a fused candidate)
 *
 * ```ts
 * import { Candidate, NodeId, RevisionId } from "@beep/agent-memory-store"
 * import * as O from "effect/Option"
 *
 * const candidate = Candidate.make({
 *   nodeId: NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e7f"),
 *   revisionId: RevisionId.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   text: "Use the sqlite driver.",
 *   bm25: O.some(0.8),
 *   vector: O.none(),
 *   fused: 0.56,
 *   reranked: O.none(),
 * })
 * console.log(candidate.fused)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Candidate extends S.Opaque<Candidate, { readonly brand: unique symbol }>()(
  S.Struct({
    nodeId: NodeId.annotateKey({ description: "Candidate node." }),
    revisionId: RevisionId.annotateKey({ description: "Revision the candidate text comes from." }),
    text: S.String.annotateKey({ description: "Candidate node text." }),
    bm25: S.OptionFromOptionalKey(S.Finite).annotateKey({ description: "BM25 score, when the text index hit." }),
    vector: S.OptionFromOptionalKey(S.Finite).annotateKey({
      description: "Vector similarity, when the vector index hit.",
    }),
    fused: S.Finite.annotateKey({ description: "Convex fusion score." }),
    reranked: S.OptionFromOptionalKey(S.Finite).annotateKey({ description: "Reranker score, when one ran." }),
  }).pipe(
    $I.annoteSchema("Candidate", {
      description: "One recall candidate with the score from each stage that saw it.",
    })
  )
) {}

const RecallResultKind = LiteralKit(["answered", "abstained"]).pipe(
  $I.annoteSchema("RecallResultKind", {
    description: "Internal literal vocabulary used to build RecallResult.",
  })
);

/**
 * Outcome of one recall, discriminated on `result`.
 *
 * **Details**
 *
 * - `answered`: the admissibility gate accepted at least one candidate;
 *   `accepted` is in final order.
 * - `abstained`: the gate accepted nothing, so recall declined to answer.
 *
 * In both cases `violations` holds the typed findings that explain each
 * rejected or flagged candidate. An abstention can never carry accepted
 * candidates.
 *
 * **Example** (Construct an abstaining result)
 *
 * ```ts
 * import { RecallResult } from "@beep/agent-memory-store"
 *
 * const result = RecallResult.cases.abstained.make({ violations: [] })
 * console.log(result.result) // "abstained"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RecallResult = RecallResultKind.toTaggedUnion("result")({
  answered: {
    accepted: S.NonEmptyArray(Candidate).annotateKey({
      description: "Candidates the gate accepted, in final order.",
    }),
    violations: S.Array(MemoryGateViolation).annotateKey({ description: "Typed findings from the gate." }),
  },
  abstained: {
    violations: S.Array(MemoryGateViolation).annotateKey({ description: "Typed findings from the gate." }),
  },
}).pipe(
  $I.annoteSchema("RecallResult", {
    description: "Outcome of one recall, discriminated on result.",
  })
);

/**
 * Runtime type for {@link RecallResult}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RecallResult = typeof RecallResult.Type;
