import { $SemanticaId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, PosInt, Sha256Hex } from "@beep/schema";
import { Equal, identity, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CorpusPaperId } from "@/corpus/Manifest";
import { digestOmittingSync } from "@/schema/Digest";
import { EvalReport } from "@/schema/Eval";
import { ChunkId, RunId } from "@/schema/Ids";
import { ModelIdentity } from "@/schema/Model";

const $I = $SemanticaId.create("schema/Projection");
const ProjectionMode = LiteralKit(["live", "replay"]);

/**
 * Frozen exact-neighbour assertion for the C1 projection gate.
 *
 * **Example** (Inspect the expected rank)
 *
 * ```ts
 * import { KnnExpectation } from "@/schema/Projection"
 *
 * console.log(KnnExpectation.fields.rank !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnnExpectation extends S.Class<KnnExpectation>($I`KnnExpectation`)(
  {
    neighborChunk: ChunkId,
    queryChunk: ChunkId,
    rank: PosInt,
  },
  $I.annote("KnnExpectation", {
    description: "Known query and neighbour chunk ids with the expected exact-SQL rank.",
  })
) {}

/**
 * Frozen SPARQL query and expected non-empty binding count.
 *
 * **Example** (Inspect the query field)
 *
 * ```ts
 * import { SparqlExpectation } from "@/schema/Projection"
 *
 * console.log(SparqlExpectation.fields.query !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SparqlExpectation extends S.Class<SparqlExpectation>($I`SparqlExpectation`)(
  {
    expectedCount: PosInt,
    id: S.NonEmptyString,
    query: S.NonEmptyString,
  },
  $I.annote("SparqlExpectation", {
    description: "Named C1 SPARQL SELECT expectation whose binding count must match exactly and remain non-empty.",
  })
) {}

/**
 * Committed G-projection contract checked before C1 rebuild identity.
 *
 * **Details**
 *
 * The fixture freezes the OpenAI model identity and dimension together with
 * one exact kNN witness and non-empty SPARQL result counts over F1 plus one
 * relation-gold paper.
 *
 * **Example** (Inspect the fixed schema version)
 *
 * ```ts
 * import { GProjectionExpectation } from "@/schema/Projection"
 *
 * console.log(GProjectionExpectation.fields.schemaVersion.literals[0]) // "g-projection/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GProjectionExpectation extends S.Class<GProjectionExpectation>($I`GProjectionExpectation`)(
  {
    schemaVersion: S.Literal("g-projection/v1"),
    model: ModelIdentity,
    paper: CorpusPaperId,
    knn: KnnExpectation,
    sparql: S.NonEmptyArray(SparqlExpectation),
  },
  $I.annote("GProjectionExpectation", {
    description: "Frozen C1 projection expectations evaluated before any rebuild-identity assertion.",
  })
) {}

/**
 * Exact canonical chunk text submitted to the embedding provider.
 *
 * **Example** (Inspect the chunk field)
 *
 * ```ts
 * import { EmbeddingInput } from "@/schema/Projection"
 *
 * console.log(EmbeddingInput.fields.chunk !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EmbeddingInput extends S.Class<EmbeddingInput>($I`EmbeddingInput`)(
  { chunk: ChunkId, text: S.NonEmptyString },
  $I.annote("EmbeddingInput", {
    description: "Content-addressed chunk id and its exact non-empty canonical text slice.",
  })
) {}

const EmbeddingVectorFields = S.Struct({
  chunk: ChunkId,
  model: ModelIdentity,
  values: S.NonEmptyArray(S.Finite),
});

const EmbeddingVectorDimensionCheck = S.makeFilter(
  (vector: typeof EmbeddingVectorFields.Type) =>
    vector.model.taskType === "embedding" &&
    O.exists(vector.model.dimension, (dimension) => Equal.equals(dimension, A.length(vector.values))),
  {
    identifier: $I`EmbeddingVectorDimensionCheck`,
    title: "Embedding vector dimension",
    description: "Requires an embedding model identity whose positive dimension equals the vector width.",
    message: "EmbeddingVector values must exactly match model.dimension.",
  }
);

/**
 * Provider vector inseparably paired with its chunk and model identity.
 *
 * **Example** (Inspect the values field)
 *
 * ```ts
 * import { EmbeddingVector } from "@/schema/Projection"
 *
 * console.log(EmbeddingVector.fields.values !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EmbeddingVector extends S.Class<EmbeddingVector>($I`EmbeddingVector`)(
  EmbeddingVectorFields.mapFields(identity).check(EmbeddingVectorDimensionCheck),
  $I.annote("EmbeddingVector", {
    description: "Finite embedding values bound to a full chunk id and dimension-carrying model identity.",
  })
) {}

/**
 * Stable causes for the only legal C1 embedding degradation state.
 *
 * **Example** (Check an offline cache miss)
 *
 * ```ts
 * import { DegradedEmbeddingReason } from "@/schema/Projection"
 *
 * console.log(DegradedEmbeddingReason.is["cache-miss"]("cache-miss")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DegradedEmbeddingReason = LiteralKit([
  "cache-corrupt",
  "cache-miss",
  "dimension-mismatch",
  "provider-failed",
  "response-invalid",
]).pipe(
  $I.annoteSchema("DegradedEmbeddingReason", {
    description: "Cache, provider, and response failures that may prevent one chunk embedding.",
  })
);

/**
 * A chunk embedding that failed closed instead of fabricating a vector.
 *
 * **Example** (Inspect the fixed outcome tag)
 *
 * ```ts
 * import { DegradedEmbedding } from "@/schema/Projection"
 *
 * console.log(DegradedEmbedding.fields.outcome.ast !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DegradedEmbedding extends S.TaggedClass<DegradedEmbedding>($I`DegradedEmbedding`)(
  "DegradedEmbedding",
  {
    chunk: ChunkId,
    detail: S.NonEmptyString,
    model: ModelIdentity,
    reason: DegradedEmbeddingReason,
  },
  $I.annote("DegradedEmbedding", {
    description: "Typed fail-closed embedding degradation that never carries substitute vector values.",
  })
) {}

/**
 * Ordered successful and degraded results for one embedding request set.
 *
 * **Example** (Inspect the degradation field)
 *
 * ```ts
 * import { EmbeddingBatch } from "@/schema/Projection"
 *
 * console.log(EmbeddingBatch.fields.degraded !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EmbeddingBatch extends S.Class<EmbeddingBatch>($I`EmbeddingBatch`)(
  {
    degraded: S.Array(DegradedEmbedding),
    vectors: S.Array(EmbeddingVector),
  },
  $I.annote("EmbeddingBatch", {
    description: "Embedding results split into actual vectors and the sole legal typed degradation state.",
  })
) {}

/**
 * One exact-SQL nearest neighbour with deterministic rank.
 *
 * **Example** (Inspect the rank field)
 *
 * ```ts
 * import { KnnNeighbor } from "@/schema/Projection"
 *
 * console.log(KnnNeighbor.fields.rank !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnnNeighbor extends S.Class<KnnNeighbor>($I`KnnNeighbor`)(
  { chunk: ChunkId, distance: S.Finite, rank: PosInt },
  $I.annote("KnnNeighbor", {
    description: "Chunk id, cosine distance, and one-based deterministic exact-kNN rank.",
  })
) {}

/**
 * Exact-SQL neighbour result scoped by model identity and dimension.
 *
 * **Example** (Inspect the neighbour field)
 *
 * ```ts
 * import { KnnQueryResult } from "@/schema/Projection"
 *
 * console.log(KnnQueryResult.fields.neighbors !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnnQueryResult extends S.Class<KnnQueryResult>($I`KnnQueryResult`)(
  {
    dimension: PosInt,
    modelKey: Sha256Hex,
    neighbors: S.Array(KnnNeighbor),
    queryChunk: ChunkId,
  },
  $I.annote("KnnQueryResult", {
    description: "Dimension-keyed exact neighbour query result with stable distance and id ordering.",
  })
) {}

const SparqlResultWitnessFields = S.Struct({
  count: NonNegativeInt,
  id: S.NonEmptyString,
  rows: S.Array(S.Record(S.String, S.NonEmptyString)),
});

const SparqlResultWitnessCountCheck = S.makeFilter(
  (witness: typeof SparqlResultWitnessFields.Type) => Equal.equals(witness.count, A.length(witness.rows)),
  {
    identifier: $I`SparqlResultWitnessCountCheck`,
    title: "SPARQL witness row count",
    description: "Requires the persisted count to equal the number of canonical SELECT binding rows.",
    message: "SparqlResultWitness count must equal rows.length.",
  }
);

/**
 * Canonicalized SPARQL SELECT bindings retained in the C1 report.
 *
 * **Example** (Inspect the rows field)
 *
 * ```ts
 * import { SparqlResultWitness } from "@/schema/Projection"
 *
 * console.log(SparqlResultWitness.fields.rows !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SparqlResultWitness extends S.Class<SparqlResultWitness>($I`SparqlResultWitness`)(
  SparqlResultWitnessFields.mapFields(identity).check(SparqlResultWitnessCountCheck),
  $I.annote("SparqlResultWitness", {
    description: "Named SELECT result represented as canonical RDF-term strings and an exact row count.",
  })
) {}

/**
 * Added and removed canonical quads between two ledger rebuilds.
 *
 * **Example** (Inspect the added field)
 *
 * ```ts
 * import { QuadDelta } from "@/schema/Projection"
 *
 * console.log(QuadDelta.fields.added !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QuadDelta extends S.Class<QuadDelta>($I`QuadDelta`)(
  { added: S.Array(S.NonEmptyString), removed: S.Array(S.NonEmptyString) },
  $I.annote("QuadDelta", {
    description: "Canonical quad additions and removals used solely as the C1 rebuild-identity witness.",
  })
) {}

/**
 * Committed expectation results evaluated before destructive rebuild proof.
 *
 * **Example** (Inspect the kNN witness field)
 *
 * ```ts
 * import { GProjectionWitness } from "@/schema/Projection"
 *
 * console.log(GProjectionWitness.fields.knn !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GProjectionWitness extends S.Class<GProjectionWitness>($I`GProjectionWitness`)(
  {
    expectationDigest: Sha256Hex,
    knn: KnnQueryResult,
    sparql: S.NonEmptyArray(SparqlResultWitness),
  },
  $I.annote("GProjectionWitness", {
    description: "Exact kNN and non-empty SPARQL evidence checked against committed G-projection gold.",
  })
) {}

/**
 * Full-selection query state proven identical after projection drop and rebuild.
 *
 * **Example** (Inspect the quad-delta field)
 *
 * ```ts
 * import { RebuildIdentityWitness } from "@/schema/Projection"
 *
 * console.log(RebuildIdentityWitness.fields.quadDelta !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RebuildIdentityWitness extends S.Class<RebuildIdentityWitness>($I`RebuildIdentityWitness`)(
  {
    knn: KnnQueryResult,
    quadDelta: QuadDelta,
    sparql: S.NonEmptyArray(SparqlResultWitness),
  },
  $I.annote("RebuildIdentityWitness", {
    description: "Full-selection query results and empty quad delta retained after identical projection rebuild.",
  })
) {}

/**
 * Replay-stable C1 projection payload embedded in the evaluation report.
 *
 * **Example** (Inspect the embedded-count field)
 *
 * ```ts
 * import { ProjectionWitness } from "@/schema/Projection"
 *
 * console.log(ProjectionWitness.fields.embeddedCount !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProjectionWitness extends S.Class<ProjectionWitness>($I`ProjectionWitness`)(
  {
    degraded: S.Array(DegradedEmbedding),
    embeddedCount: PosInt,
    gProjection: GProjectionWitness,
    model: ModelIdentity,
    quadCount: PosInt,
    rebuild: RebuildIdentityWitness,
  },
  $I.annote("ProjectionWitness", {
    description: "Embedding, G-projection, RDF, and rebuild-identity evidence for one C1 execution.",
  })
) {}

const C1EvalReportFields = S.Struct({
  schemaVersion: S.Literal("c1-eval-report/v1"),
  base: EvalReport,
  projection: ProjectionWitness,
  reportDigest: Sha256Hex,
  stage: S.Literal("c1"),
});

const C1EvalReportChecks = S.makeFilterGroup([
  S.makeFilter(
    (report: typeof C1EvalReportFields.Type) =>
      Equal.equals(report.base.unexpectedDegraded, 0) &&
      A.isReadonlyArrayEmpty(report.projection.degraded) &&
      A.isReadonlyArrayNonEmpty(report.projection.gProjection.knn.neighbors) &&
      A.every(report.projection.gProjection.sparql, (witness) => witness.count > 0) &&
      A.isReadonlyArrayEmpty(report.projection.rebuild.quadDelta.added) &&
      A.isReadonlyArrayEmpty(report.projection.rebuild.quadDelta.removed),
    {
      identifier: $I`C1EvalReportProjectionChecks`,
      title: "C1 projection pass evidence",
      description: "Requires zero unexpected degradation, non-empty G-projection results, and an empty rebuild delta.",
      message: "C1EvalReport must retain only passing projection evidence.",
    }
  ),
  S.makeFilter(
    (report: typeof C1EvalReportFields.Type) =>
      digestOmittingSync(
        C1EvalReportFields,
        "reportDigest"
      )(report).pipe(
        Result.match({
          onFailure: () => false,
          onSuccess: (digest) => Str.Equivalence(digest, report.reportDigest),
        })
      ),
    {
      identifier: $I`C1EvalReportDigestCheck`,
      title: "C1 evaluation report digest",
      description: "Requires reportDigest to hash the canonical C1 report after omitting only itself.",
      message: "C1EvalReport reportDigest must match its canonical body.",
    }
  ),
]);

/**
 * Content-addressed C1 report containing C0 truth and derived projection proof.
 *
 * **Example** (Inspect the self-digest field)
 *
 * ```ts
 * import { C1EvalReport } from "@/schema/Projection"
 *
 * console.log(C1EvalReport.fields.reportDigest !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class C1EvalReport extends S.Class<C1EvalReport>($I`C1EvalReport`)(
  C1EvalReportFields.mapFields(identity).check(C1EvalReportChecks),
  $I.annote("C1EvalReport", {
    description: "Replay-stable C1 evaluation report with base C0 evidence and rebuildable projection witnesses.",
  })
) {}

/**
 * Non-replay-stable C1 projection timing sidecar excluded from report identity.
 *
 * **Example** (Inspect the vector timing field)
 *
 * ```ts
 * import { C1EvalTelemetry } from "@/schema/Projection"
 *
 * console.log(C1EvalTelemetry.fields.vectorRebuildMs !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class C1EvalTelemetry extends S.Class<C1EvalTelemetry>($I`C1EvalTelemetry`)(
  {
    schemaVersion: S.Literal("c1-eval-telemetry/v1"),
    embeddingMs: NonNegativeInt,
    mode: ProjectionMode,
    rdfRebuildMs: NonNegativeInt,
    reportDigest: Sha256Hex,
    runId: RunId,
    startedAt: S.DateTimeUtcFromString,
    vectorRebuildMs: NonNegativeInt,
    wallClockMs: NonNegativeInt,
  },
  $I.annote("C1EvalTelemetry", {
    description: "Embedding and rebuild costs kept outside the replay-stable C1 report digest.",
  })
) {}
