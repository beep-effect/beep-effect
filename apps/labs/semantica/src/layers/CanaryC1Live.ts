import { NonNegativeInt, PosInt, Sha256Hex } from "@beep/schema";
import { Clock, Console, Crypto, Effect, Equal, FileSystem, HashSet, Layer, Number as N, Order, Path } from "effect";
import * as A from "effect/Array";
import { flow } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { writeJsonArtifact } from "@/canary/Artifact";
import { CanaryOptions } from "@/canary/Command";
import { EmbedderRuntimeLive } from "@/layers/EmbedderLive";
import { LabConfig } from "@/runtime/Config";
import { contentDigest, digestOmitting } from "@/schema/Digest";
import { Origin } from "@/schema/Document";
import { ProjectionFailed } from "@/schema/Errors";
import { ExtractOutcome } from "@/schema/Evidence";
import { C1ExecutionResult } from "@/schema/Execution";
import { LedgerSnapshot } from "@/schema/Ledger";
import { ModelIdentity } from "@/schema/Model";
import {
  C1EvalReport,
  C1EvalTelemetry,
  EmbeddingInput,
  GProjectionExpectation,
  GProjectionWitness,
  KnnQueryResult,
  ProjectionWitness,
  QuadDelta,
  RebuildIdentityWitness,
  SparqlResultWitness,
} from "@/schema/Projection";
import { CanaryC0 } from "@/services/CanaryC0";
import { CanaryC1 } from "@/services/CanaryC1";
import { ActiveEmbeddingIdentity, Embedder } from "@/services/Embedder";
import { ProviderCache } from "@/services/ProviderCache";
import { RdfProjection } from "@/services/RdfProjection";
import { VectorProjection } from "@/services/VectorProjection";
import type * as EmbeddingModel from "effect/unstable/ai/EmbeddingModel";
import type { ChunkId, DocumentId } from "@/schema/Ids";
import type { EmbeddingVector } from "@/schema/Projection";

const GProjectionExpectationJson = S.fromJsonString(GProjectionExpectation);
const C1EvalReportJson = S.fromJsonString(C1EvalReport, { space: 2 });
const C1EvalTelemetryJson = S.fromJsonString(C1EvalTelemetry, { space: 2 });
const modelEquivalence = S.toEquivalence(ModelIdentity);
const knnEquivalence = S.toEquivalence(KnnQueryResult);
const sparqlEquivalence = S.toEquivalence(S.Array(SparqlResultWitness));
const stringOrder = Order.String;

const failed = (reason: ProjectionFailed["reason"], message: string): ProjectionFailed =>
  ProjectionFailed.make({ message, reason });

const extractedClaims = (snapshot: LedgerSnapshot) =>
  A.flatMap(snapshot.batches, (outcome) =>
    ExtractOutcome.match(outcome, {
      Degraded: () => [],
      Extracted: ({ batch }) => batch.claims,
    })
  );

const claimedChunkIds = (snapshot: LedgerSnapshot): HashSet.HashSet<ChunkId> =>
  HashSet.fromIterable(A.map(extractedClaims(snapshot), (claim) => claim.chunk));

const embeddingInputs = Effect.fn("CanaryC1.embeddingInputs")(function* (
  snapshot: LedgerSnapshot
): Effect.fn.Return<ReadonlyArray<EmbeddingInput>, ProjectionFailed> {
  const claimed = claimedChunkIds(snapshot);
  const inputs = A.sort(
    A.flatMap(snapshot.documents, (document) =>
      O.match(document.canonical, {
        onNone: () => [],
        onSome: (canonical) =>
          A.getSomes(
            A.map(document.chunks, (chunk) => {
              if (!HashSet.has(claimed, chunk.id)) {
                return O.none<EmbeddingInput>();
              }
              const text = Str.slice(chunk.anchor.startChar, chunk.anchor.endChar)(canonical.text);
              return Str.isNonEmpty(text)
                ? O.some(EmbeddingInput.make({ chunk: chunk.id, text }))
                : O.none<EmbeddingInput>();
            })
          ),
      })
    ),
    Order.mapInput(stringOrder, (input: EmbeddingInput) => input.chunk)
  );
  if (HashSet.size(claimed) === 0 || A.isReadonlyArrayEmpty(inputs)) {
    return yield* failed("no-embedding-inputs", "The C1 ledger has no claim-bearing canonical chunks to embed.");
  }
  if (!Equal.equals(HashSet.size(claimed), A.length(inputs))) {
    return yield* failed(
      "no-embedding-inputs",
      "The C1 ledger does not retain exactly one canonical text slice for every claim-bearing chunk."
    );
  }
  return inputs;
});

const isGDocument = (expectation: GProjectionExpectation) => (snapshot: LedgerSnapshot["documents"][number]) =>
  Origin.match(snapshot.document.origin, {
    Fixture: () => true,
    W1Paper: (origin) => Str.Equivalence(origin.paperId, expectation.paper),
  });

const outcomeDocument = (outcome: LedgerSnapshot["batches"][number]): DocumentId =>
  ExtractOutcome.match(outcome, {
    Degraded: ({ document }) => document,
    Extracted: ({ batch }) => batch.document,
  });

const gSnapshot = (snapshot: LedgerSnapshot, expectation: GProjectionExpectation): LedgerSnapshot => {
  const documents = A.filter(snapshot.documents, isGDocument(expectation));
  const documentIds = HashSet.fromIterable(A.map(documents, (document) => document.document.id));
  return LedgerSnapshot.make({
    batches: A.filter(snapshot.batches, (outcome) => HashSet.has(documentIds, outcomeDocument(outcome))),
    documents,
    events: [],
    run: snapshot.run,
  });
};

const vectorsFor = (snapshot: LedgerSnapshot, vectors: ReadonlyArray<EmbeddingVector>) => {
  const claimed = claimedChunkIds(snapshot);
  return A.filter(vectors, (vector) => HashSet.has(claimed, vector.chunk));
};

const requiredVector = (
  vectors: ReadonlyArray<EmbeddingVector>,
  chunk: ChunkId,
  message: string
): Effect.Effect<EmbeddingVector, ProjectionFailed> =>
  A.findFirst(vectors, (vector) => Str.Equivalence(vector.chunk, chunk)).pipe(
    Effect.fromOption(() => failed("expectation-mismatch", message))
  );

/**
 * Verifies the committed exact-rank kNN witness before any rebuild-identity check.
 *
 * **Example** (Inspect the curried verifier)
 *
 * ```ts
 * import { verifyGNeighbors } from "@/layers/CanaryC1Live"
 *
 * console.log(typeof verifyGNeighbors) // "function"
 * ```
 *
 * @param expectation - Committed G-projection model, query, neighbour, and rank.
 * @returns A verifier for one exact DuckDB kNN result.
 * @category validation
 * @since 0.0.0
 */
export const verifyGNeighbors =
  (expectation: GProjectionExpectation) =>
  (result: KnnQueryResult): Effect.Effect<void, ProjectionFailed> =>
    A.findFirst(result.neighbors, (neighbor) => Equal.equals(neighbor.rank, expectation.knn.rank)).pipe(
      O.match({
        onNone: () => Effect.fail(failed("expectation-mismatch", "The committed G-projection kNN rank was absent.")),
        onSome: (neighbor) =>
          Str.Equivalence(neighbor.chunk, expectation.knn.neighborChunk)
            ? Effect.void
            : Effect.fail(
                failed("expectation-mismatch", "The committed G-projection kNN neighbour did not match its exact rank.")
              ),
      })
    );

/**
 * Verifies every committed non-empty exact-count SPARQL witness before rebuild identity.
 *
 * **Example** (Inspect the curried verifier)
 *
 * ```ts
 * import { verifyGSparql } from "@/layers/CanaryC1Live"
 *
 * console.log(typeof verifyGSparql) // "function"
 * ```
 *
 * @param expectation - Committed named SPARQL queries and exact non-empty counts.
 * @returns A verifier for canonical Oxigraph SELECT witnesses.
 * @category validation
 * @since 0.0.0
 */
export const verifyGSparql =
  (expectation: GProjectionExpectation) =>
  (results: ReadonlyArray<SparqlResultWitness>): Effect.Effect<void, ProjectionFailed> => {
    const matches =
      Equal.equals(A.length(results), A.length(expectation.sparql)) &&
      A.every(expectation.sparql, (expected) =>
        A.findFirst(results, (result) => Str.Equivalence(result.id, expected.id)).pipe(
          O.exists((result) => result.count > 0 && Equal.equals(result.count, expected.expectedCount))
        )
      );
    return matches
      ? Effect.void
      : Effect.fail(
          failed(
            "expectation-mismatch",
            "The committed G-projection SPARQL counts were empty or did not match exactly."
          )
        );
  };

const quadDelta = (before: ReadonlyArray<string>, after: ReadonlyArray<string>): QuadDelta => {
  const beforeSet = HashSet.fromIterable(before);
  const afterSet = HashSet.fromIterable(after);
  return QuadDelta.make({
    added: A.sort(A.fromIterable(HashSet.difference(afterSet, beforeSet)), stringOrder),
    removed: A.sort(A.fromIterable(HashSet.difference(beforeSet, afterSet)), stringOrder),
  });
};

const makeCanaryC1 = Effect.fn("CanaryC1.make")(function* <E>(
  embeddingProvider: Layer.Layer<EmbeddingModel.EmbeddingModel | EmbeddingModel.Dimensions, E, never>
) {
  const activeEmbeddingIdentity = yield* ActiveEmbeddingIdentity;
  const c0 = yield* CanaryC0;
  const config = yield* LabConfig;
  const crypto = yield* Crypto.Crypto;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const providerCache = yield* ProviderCache;
  const rdf = yield* RdfProjection;
  const vector = yield* VectorProjection;

  const runWithSnapshot = Effect.fn("CanaryC1.runWithSnapshot")(function* (options: CanaryOptions) {
    const startedAt = yield* Clock.currentTimeMillis;
    const base = yield* c0.runWithSnapshot(CanaryOptions.make({ ...options, out: O.none() }));
    const expectationPath = path.join(config.goldDirectory, "g-projection.json");
    const expectation = yield* fs.readFileString(expectationPath).pipe(
      Effect.flatMap(S.decodeEffect(GProjectionExpectationJson)),
      Effect.mapError(() =>
        failed("expectation-unavailable", "The committed G-projection expectation could not be decoded.")
      )
    );
    if (!modelEquivalence(activeEmbeddingIdentity, expectation.model)) {
      return yield* failed(
        "model-mismatch",
        "The active OpenAI embedding identity differs from the committed G-projection identity."
      );
    }

    const inputs = yield* embeddingInputs(base.snapshot);
    const mode = base.telemetry.mode;
    const selectedConfig = LabConfig.of({ ...config, mode, offline: mode === "replay" });
    const embeddingLayer = EmbedderRuntimeLive(embeddingProvider).pipe(
      Layer.provide(Layer.succeed(ActiveEmbeddingIdentity, activeEmbeddingIdentity)),
      Layer.provide(Layer.succeed(Crypto.Crypto, crypto)),
      Layer.provide(Layer.succeed(LabConfig, selectedConfig)),
      Layer.provide(Layer.succeed(ProviderCache, providerCache))
    );
    const embeddingStartedAt = yield* Clock.currentTimeMillis;
    const embedded = yield* Effect.scoped(
      Layer.build(embeddingLayer).pipe(
        Effect.flatMap((context) =>
          Embedder.pipe(
            Effect.flatMap((service) => service.embed(inputs)),
            Effect.provide(context)
          )
        )
      )
    ).pipe(Effect.mapError(() => failed("embedding-degraded", "The live OpenAI embedding provider was unavailable.")));
    const embeddingEndedAt = yield* Clock.currentTimeMillis;
    if (A.isReadonlyArrayNonEmpty(embedded.degraded)) {
      return yield* failed(
        "embedding-degraded",
        `C1 failed closed because ${A.length(embedded.degraded)} claim-bearing chunks did not produce actual vectors.`
      );
    }
    if (!Equal.equals(A.length(embedded.vectors), A.length(inputs))) {
      return yield* failed("embedding-degraded", "C1 did not receive one actual vector for every embedding input.");
    }

    const selectedGSnapshot = gSnapshot(base.snapshot, expectation);
    const gVectors = vectorsFor(selectedGSnapshot, embedded.vectors);
    const gQuery = yield* requiredVector(
      gVectors,
      expectation.knn.queryChunk,
      "The committed G-projection query chunk was absent from the selected ledger projection."
    );
    const vectorStartedAt = yield* Clock.currentTimeMillis;
    yield* vector.rebuild(gVectors);
    const gKnn = yield* vector.neighbors(gQuery, expectation.knn.rank);
    yield* verifyGNeighbors(expectation)(gKnn);
    const vectorGEndedAt = yield* Clock.currentTimeMillis;

    const rdfStartedAt = yield* Clock.currentTimeMillis;
    const gRdf = yield* rdf.rebuild(selectedGSnapshot);
    if (A.isReadonlyArrayEmpty(gRdf.serializedQuads)) {
      return yield* failed("expectation-mismatch", "The committed G-projection RDF rebuild was empty.");
    }
    const gSparql = yield* rdf.query(gRdf, expectation.sparql);
    yield* verifyGSparql(expectation)(gSparql);
    const rdfGEndedAt = yield* Clock.currentTimeMillis;
    const nonEmptyGSparql = yield* A.match(gSparql, {
      onEmpty: () =>
        Effect.fail(failed("expectation-mismatch", "The committed G-projection retained no SPARQL witnesses.")),
      onNonEmpty: Effect.succeed,
    });
    const expectationDigest = yield* contentDigest(GProjectionExpectation)(expectation).pipe(
      Effect.provideService(Crypto.Crypto, crypto),
      Effect.mapError(() => failed("expectation-unavailable", "The G-projection expectation digest failed."))
    );
    const gWitness = GProjectionWitness.make({
      expectationDigest,
      knn: gKnn,
      sparql: nonEmptyGSparql,
    });

    const fullQuery = yield* requiredVector(
      embedded.vectors,
      expectation.knn.queryChunk,
      "The full-selection rebuild query chunk was absent."
    );
    const fullVectorStartedAt = yield* Clock.currentTimeMillis;
    yield* vector.rebuild(embedded.vectors);
    const firstKnn = yield* vector.neighbors(fullQuery, PosInt.make(10));
    yield* vector.drop;
    yield* vector.rebuild(embedded.vectors);
    const secondKnn = yield* vector.neighbors(fullQuery, PosInt.make(10));
    const vectorEndedAt = yield* Clock.currentTimeMillis;
    if (!knnEquivalence(firstKnn, secondKnn)) {
      return yield* failed("rebuild-mismatch", "DuckDB exact-kNN results changed after drop and rebuild.");
    }

    const fullRdfStartedAt = yield* Clock.currentTimeMillis;
    const firstRdf = yield* rdf.rebuild(base.snapshot);
    const firstSparql = yield* rdf.query(firstRdf, expectation.sparql);
    const secondRdf = yield* rdf.rebuild(base.snapshot);
    const secondSparql = yield* rdf.query(secondRdf, expectation.sparql);
    const rdfEndedAt = yield* Clock.currentTimeMillis;
    const delta = quadDelta(firstRdf.serializedQuads, secondRdf.serializedQuads);
    if (
      A.isReadonlyArrayNonEmpty(delta.added) ||
      A.isReadonlyArrayNonEmpty(delta.removed) ||
      !sparqlEquivalence(firstSparql, secondSparql)
    ) {
      return yield* failed("rebuild-mismatch", "Oxigraph query state changed after discard and ledger rebuild.");
    }
    const nonEmptySparql = yield* A.match(secondSparql, {
      onEmpty: () => Effect.fail(failed("rebuild-mismatch", "The full RDF rebuild retained no SPARQL witnesses.")),
      onNonEmpty: Effect.succeed,
    });
    const quadCount = yield* A.match(secondRdf.serializedQuads, {
      onEmpty: () => Effect.fail(failed("rebuild-mismatch", "The full RDF rebuild retained no canonical quads.")),
      onNonEmpty: (quads) => Effect.succeed(PosInt.make(A.length(quads))),
    });
    const projection = ProjectionWitness.make({
      degraded: embedded.degraded,
      embeddedCount: PosInt.make(A.length(embedded.vectors)),
      gProjection: gWitness,
      model: activeEmbeddingIdentity,
      quadCount,
      rebuild: RebuildIdentityWitness.make({ knn: secondKnn, quadDelta: delta, sparql: nonEmptySparql }),
    });
    const provisional = {
      base: base.report,
      projection,
      reportDigest: Sha256Hex.make(Str.repeat(64)("0")),
      schemaVersion: "c1-eval-report/v1" as const,
      stage: "c1" as const,
    };
    const reportDigest = yield* digestOmitting(
      S.Struct(C1EvalReport.fields),
      "reportDigest"
    )(provisional).pipe(
      Effect.provideService(Crypto.Crypto, crypto),
      Effect.mapError(() => failed("report-invalid", "The C1 report digest preimage did not encode."))
    );
    const report = yield* C1EvalReport.makeEffect({ ...provisional, reportDigest }).pipe(
      Effect.mapError(() => failed("report-invalid", "The completed C1 report violates its schema contract."))
    );
    const endedAt = yield* Clock.currentTimeMillis;
    const outputDirectory = options.out.pipe(
      O.getOrElse(() => path.join(".beep/semantica/runs", base.report.run.id, mode, "c1"))
    );
    yield* fs
      .makeDirectory(outputDirectory, { recursive: true })
      .pipe(Effect.mapError(() => failed("report-invalid", "The C1 output directory could not be created.")));
    const telemetry = C1EvalTelemetry.make({
      embeddingMs: NonNegativeInt.make(N.max(0, embeddingEndedAt - embeddingStartedAt)),
      mode,
      rdfRebuildMs: NonNegativeInt.make(N.max(0, rdfGEndedAt - rdfStartedAt) + N.max(0, rdfEndedAt - fullRdfStartedAt)),
      reportDigest,
      runId: base.report.run.id,
      schemaVersion: "c1-eval-telemetry/v1",
      startedAt: base.telemetry.startedAt,
      vectorRebuildMs: NonNegativeInt.make(
        N.max(0, vectorGEndedAt - vectorStartedAt) + N.max(0, vectorEndedAt - fullVectorStartedAt)
      ),
      wallClockMs: NonNegativeInt.make(N.max(0, endedAt - startedAt)),
    });
    const artifactFailure = {
      encode: failed("report-invalid", "A C1 output artifact did not encode."),
      write: failed("report-invalid", "A C1 output artifact could not be written."),
    };
    yield* writeJsonArtifact(
      fs,
      C1EvalReportJson,
      path.join(outputDirectory, "eval-report.json"),
      report,
      artifactFailure
    );
    yield* writeJsonArtifact(
      fs,
      C1EvalTelemetryJson,
      path.join(outputDirectory, "eval-telemetry.json"),
      telemetry,
      artifactFailure
    );
    yield* Console.log(report.reportDigest);
    return C1ExecutionResult.make({
      baseTelemetry: base.telemetry,
      report,
      snapshot: base.snapshot,
      telemetry,
    });
  });

  return CanaryC1.of({
    run: flow(
      runWithSnapshot,
      Effect.map((result) => result.report)
    ),
    runWithSnapshot,
  });
});

/**
 * C1 orchestration Layer over C0 truth, cached OpenAI embeddings, DuckDB, and Oxigraph.
 *
 * **Example** (Inspect the C1 Layer constructor)
 *
 * ```ts
 * import { CanaryC1Live } from "@/layers/CanaryC1Live"
 *
 * console.log(typeof CanaryC1Live) // "function"
 * ```
 *
 * @param embeddingProvider - Live OpenAI Layer deferred until a non-replay invocation.
 * @returns A Layer providing the complete headless C1 workflow.
 * @category layers
 * @since 0.0.0
 */
export const CanaryC1Live = <E>(
  embeddingProvider: Layer.Layer<EmbeddingModel.EmbeddingModel | EmbeddingModel.Dimensions, E, never>
) => Layer.effect(CanaryC1, makeCanaryC1(embeddingProvider));
