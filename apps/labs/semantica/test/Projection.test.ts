// @vitest-environment node

import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { Confidence } from "@beep/epistemic-domain";
import { OxigraphSparqlQueryServiceLive } from "@beep/oxigraph";
import {
  SourceTextDigest,
  SourceTextExtractor,
  SourceTextIdentity,
  TextAnchor,
  TextAnchorVerificationReceipt,
} from "@beep/provenance";
import { NonNegativeInt, PosInt, Sha256Hex } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { Duration, Effect, Equal, Layer, Option, Ref, Result } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as EmbeddingModel from "effect/unstable/ai/EmbeddingModel";
import { describe, expect, it } from "vitest";
import { CorpusPaperId } from "@/corpus/Manifest";
import { verifyGNeighbors, verifyGSparql } from "@/layers/CanaryC1Live";
import { ActiveEmbeddingIdentityLive, EmbedderRuntimeLive } from "@/layers/EmbedderLive";
import { RdfProjectionLive } from "@/layers/RdfProjectionLive";
import { VectorProjectionLive } from "@/layers/VectorProjectionLive";
import { LabConfig } from "@/runtime/Config";
import { ClaimBody, EvidenceBatch, EvidenceClaim, ExtractOutcome, makeBatchId, makeClaimId } from "@/schema/Evidence";
import { ChunkId, DocumentId, RunId } from "@/schema/Ids";
import { LedgerSnapshot } from "@/schema/Ledger";
import { ModelIdentity } from "@/schema/Model";
import {
  EmbeddingInput,
  EmbeddingVector,
  GProjectionExpectation,
  KnnNeighbor,
  KnnQueryResult,
  SparqlExpectation,
  SparqlResultWitness,
} from "@/schema/Projection";
import { ProviderCacheKey } from "@/schema/ProviderCache";
import { Embedder } from "@/services/Embedder";
import { ProviderCache } from "@/services/ProviderCache";
import { RdfProjection } from "@/services/RdfProjection";
import { VectorProjection } from "@/services/VectorProjection";
import type { ProviderCacheEntry } from "@/schema/ProviderCache";

const sha = (digit: string): Sha256Hex => Sha256Hex.make(Str.repeat(64)(digit));
const chunkId = (digit: string): ChunkId => ChunkId.make(Str.repeat(64)(digit));
const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const embeddingModel = (dimension: PosInt) =>
  ModelIdentity.make({
    artifactHash: sha("a"),
    dimension: Option.some(dimension),
    name: "stub-embedding-v1",
    provider: "openai",
    revision: "stub-embedding-v1",
    taskType: "embedding",
  });

const vector = (model: ModelIdentity, chunk: ChunkId, values: A.NonEmptyReadonlyArray<number>) =>
  S.decodeSync(S.toType(EmbeddingVector))(EmbeddingVector.make({ chunk, model, values }));

const config = Layer.succeed(
  LabConfig,
  LabConfig.of({
    corpusRoot: Option.none(),
    embeddingDimension: PosInt.make(1536),
    embeddingModel: "text-embedding-3-small",
    embeddingRevision: "text-embedding-3-small@2024-01-25",
    extractionTimeout: Duration.minutes(15),
    extractorModel: "stub-extractor-20260826",
    goldDirectory: "fixtures/gold/v1",
    goldGenerationTimeout: Duration.minutes(45),
    goldModel: "stub-gold-20260826",
    ledgerRoot: ".beep/semantica/ledger",
    mode: "replay",
    offline: true,
    projectionTimeout: Duration.seconds(30),
    providerCacheDirectory: ".beep/semantica/provider-cache",
  })
);

describe("C1 vector projection", () => {
  it("co-locates alternate dimensions and scopes exact kNN by full model identity", () =>
    Effect.runPromise(
      provideScopedLayer(
        VectorProjectionLive.pipe(
          Layer.provide(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" }))),
          Layer.provide(BunCrypto.layer)
        )
      )(
        Effect.gen(function* () {
          const projection = yield* VectorProjection;
          const model3 = embeddingModel(PosInt.make(3));
          const model4 = embeddingModel(PosInt.make(4));
          const queryId = chunkId("1");
          const neighborId = chunkId("2");
          const vectors = [
            vector(model3, queryId, [1, 0, 0]),
            vector(model3, neighborId, [0.9, 0.1, 0]),
            vector(model4, queryId, [1, 0, 0, 0]),
            vector(model4, neighborId, [0.8, 0.2, 0, 0]),
          ];

          yield* projection.rebuild(vectors);
          const neighbors3 = yield* projection.neighbors(A.getUnsafe(vectors, 0), PosInt.make(3));
          const neighbors4 = yield* projection.neighbors(A.getUnsafe(vectors, 2), PosInt.make(3));

          expect(neighbors3.dimension).toBe(3);
          expect(neighbors4.dimension).toBe(4);
          expect(neighbors3.modelKey).not.toBe(neighbors4.modelKey);
          expect(A.map(neighbors3.neighbors, (neighbor) => neighbor.chunk)).toEqual([neighborId]);
          expect(A.map(neighbors4.neighbors, (neighbor) => neighbor.chunk)).toEqual([neighborId]);
        })
      )
    ));
});

describe("C1 committed projection gate", () => {
  it("fails typed on empty and mismatched G-projection witnesses", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const model = embeddingModel(PosInt.make(3));
        const queryChunk = chunkId("1");
        const neighborChunk = chunkId("2");
        const expectation = GProjectionExpectation.make({
          knn: { neighborChunk, queryChunk, rank: PosInt.make(1) },
          model,
          paper: CorpusPaperId.make("057e356e94f8"),
          schemaVersion: "g-projection/v1",
          sparql: [
            SparqlExpectation.make({
              expectedCount: PosInt.make(1),
              id: "claims",
              query: "SELECT ?claim WHERE { ?claim ?p ?o }",
            }),
          ],
        });
        const emptyKnn = KnnQueryResult.make({
          dimension: PosInt.make(3),
          modelKey: sha("b"),
          neighbors: [],
          queryChunk,
        });
        const wrongKnn = KnnQueryResult.make({
          ...emptyKnn,
          neighbors: [KnnNeighbor.make({ chunk: chunkId("3"), distance: 0.1, rank: PosInt.make(1) })],
        });
        const wrongSparql = [SparqlResultWitness.make({ count: NonNegativeInt.make(0), id: "claims", rows: [] })];

        const emptyFailure = yield* verifyGNeighbors(expectation)(emptyKnn).pipe(Effect.flip);
        const mismatchFailure = yield* verifyGNeighbors(expectation)(wrongKnn).pipe(Effect.flip);
        const sparqlFailure = yield* verifyGSparql(expectation)(wrongSparql).pipe(Effect.flip);

        expect(emptyFailure.reason).toBe("expectation-mismatch");
        expect(mismatchFailure.reason).toBe("expectation-mismatch");
        expect(sparqlFailure.reason).toBe("expectation-mismatch");
      })
    ));
});

describe("C1 embedding cache", () => {
  it("writes actual provider vectors live, replays them offline, and degrades only cache misses", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const model = embeddingModel(PosInt.make(3));
        const providerCalls = yield* Ref.make(0);
        const entries = yield* Ref.make<ReadonlyArray<ProviderCacheEntry>>([]);
        const keyEquivalence = S.toEquivalence(ProviderCacheKey);
        const cache = ProviderCache.of({
          lookup: Effect.fn("ProviderCache.lookup")((key) =>
            Ref.get(entries).pipe(
              Effect.map((stored) => A.findFirst(stored, (entry) => keyEquivalence(entry.key, key)))
            )
          ),
          store: Effect.fn("ProviderCache.store")((entry) => Ref.update(entries, (stored) => A.append(stored, entry))),
        });
        const liveModel = Layer.merge(
          Layer.effect(
            EmbeddingModel.EmbeddingModel,
            EmbeddingModel.make({
              embedMany: ({ inputs }) =>
                Ref.update(providerCalls, (count) => count + 1).pipe(
                  Effect.as({
                    results: A.map(inputs, (input) => [Str.length(input), 1, 0]),
                    usage: { inputTokens: A.length(inputs) },
                  })
                ),
            })
          ),
          Layer.succeed(EmbeddingModel.Dimensions, 3)
        );
        const liveConfig = LabConfig.of({
          corpusRoot: Option.none(),
          embeddingDimension: PosInt.make(3),
          embeddingModel: model.name,
          embeddingRevision: model.revision,
          extractionTimeout: Duration.minutes(15),
          extractorModel: "stub-extractor-20260826",
          goldDirectory: "fixtures/gold/v1",
          goldGenerationTimeout: Duration.minutes(45),
          goldModel: "stub-gold-20260826",
          ledgerRoot: ".beep/semantica/ledger",
          mode: "live",
          offline: false,
          projectionTimeout: Duration.seconds(30),
          providerCacheDirectory: ".beep/semantica/provider-cache",
        });
        const input = EmbeddingInput.make({ chunk: chunkId("8"), text: "semantic projection" });
        const miss = EmbeddingInput.make({ chunk: chunkId("9"), text: "offline miss" });
        const support = (selected: typeof liveConfig) =>
          Layer.mergeAll(
            ActiveEmbeddingIdentityLive(model),
            BunCrypto.layer,
            Layer.succeed(LabConfig, selected),
            Layer.succeed(ProviderCache, cache)
          );
        const live = EmbedderRuntimeLive(liveModel).pipe(Layer.provide(support(liveConfig)));
        const liveBatch = yield* provideScopedLayer(live)(
          Embedder.pipe(Effect.flatMap((service) => service.embed([input])))
        );

        const replayConfig = LabConfig.of({ ...liveConfig, mode: "replay", offline: true });
        const poisonProvider = Layer.merge(
          Layer.effect(EmbeddingModel.EmbeddingModel, Effect.die("replay acquired the live provider")),
          Layer.succeed(EmbeddingModel.Dimensions, 3)
        );
        const replay = EmbedderRuntimeLive(poisonProvider).pipe(Layer.provide(support(replayConfig)));
        const replayBatch = yield* provideScopedLayer(replay)(
          Embedder.pipe(Effect.flatMap((service) => service.embed([input, miss])))
        );

        expect(yield* Ref.get(providerCalls)).toBe(1);
        expect(liveBatch.vectors).toHaveLength(1);
        expect(liveBatch.degraded).toHaveLength(0);
        expect(replayBatch.vectors).toEqual(liveBatch.vectors);
        expect(replayBatch.degraded).toHaveLength(1);
        expect(A.getUnsafe(replayBatch.degraded, 0).reason).toBe("cache-miss");
      })
    ));
});

const document = DocumentId.make(Str.repeat(64)("3"));
const hostedModel = ModelIdentity.make({
  artifactHash: sha("4"),
  name: "stub-extractor-20260826",
  provider: "anthropic",
  revision: "stub-extractor-20260826",
  taskType: "extraction",
});
const sourceIdentity = SourceTextIdentity.make({
  extractor: SourceTextExtractor.make({ name: "identity-utf8", version: "1" }),
  locator: PosixPath.make("documents/projection.md"),
  normalizationVersion: "raw/1",
  scopeRef: "semantica-canary",
  sourceDigest: SourceTextDigest.make(`sha256:${document}`),
  sourceRef: document,
  textDigest: SourceTextDigest.make(`sha256:${sha("5")}`),
});
const anchor = TextAnchor.make({ endChar: NonNegativeInt.make(6), quote: "Effect", startChar: NonNegativeInt.make(0) });
const receipt = TextAnchorVerificationReceipt.make({ anchor, source: sourceIdentity });
const claimChunk = chunkId("6");
const entityBody = ClaimBody.cases.Entity.make({
  cluster: Option.none(),
  endChar: anchor.endChar,
  entityType: "software",
  kind: "Entity",
  label: "Effect",
  quote: anchor.quote,
  startChar: anchor.startChar,
});
const otherBody = ClaimBody.cases.Entity.make({ ...entityBody, entityType: "concept", label: "Schema" });
const entityId = Result.getOrThrow(
  makeClaimId({ body: entityBody, chunk: claimChunk, document, method: "hosted-langextract", model: hostedModel })
);
const otherId = Result.getOrThrow(
  makeClaimId({ body: otherBody, chunk: claimChunk, document, method: "hosted-langextract", model: hostedModel })
);
const relationBody = ClaimBody.cases.Relation.make({
  endChar: anchor.endChar,
  kind: "Relation",
  object: otherId,
  predicate: "uses",
  quote: anchor.quote,
  startChar: anchor.startChar,
  subject: entityId,
});
const relationId = Result.getOrThrow(
  makeClaimId({ body: relationBody, chunk: claimChunk, document, method: "hosted-langextract", model: hostedModel })
);
const makeEvidenceClaim = (id: typeof entityId, body: typeof entityBody | typeof relationBody) =>
  EvidenceClaim.make({
    body,
    cacheKey: Option.none(),
    chunk: claimChunk,
    confidence: Confidence.make(0.9),
    document,
    id,
    method: "hosted-langextract",
    model: hostedModel,
    receipt,
  });
const claims = [
  makeEvidenceClaim(entityId, entityBody),
  makeEvidenceClaim(otherId, otherBody),
  makeEvidenceClaim(relationId, relationBody),
];
const batch = EvidenceBatch.make({
  claims,
  degraded: [],
  document,
  id: Result.getOrThrow(
    makeBatchId({ document, inputs: [claimChunk], method: "hosted-langextract", model: hostedModel })
  ),
  inputs: [claimChunk],
  lossy: [],
  method: "hosted-langextract",
  model: hostedModel,
});
const snapshot = LedgerSnapshot.make({
  batches: [ExtractOutcome.cases.Extracted.make({ batch, outcome: "Extracted" })],
  documents: [],
  events: [],
  run: RunId.make(Str.repeat(64)("7")),
});

describe("C1 RDF projection", () => {
  it("rebuilds ledger claims into non-empty timeout-bounded SPARQL results identically", () =>
    Effect.runPromise(
      provideScopedLayer(RdfProjectionLive.pipe(Layer.provide(OxigraphSparqlQueryServiceLive), Layer.provide(config)))(
        Effect.gen(function* () {
          const projection = yield* RdfProjection;
          const expectations = [
            SparqlExpectation.make({
              expectedCount: PosInt.make(3),
              id: "all",
              query:
                "SELECT ?claim WHERE { ?claim a <https://beep.sh/semantica/ontology/EvidenceClaim> } ORDER BY ?claim",
            }),
            SparqlExpectation.make({
              expectedCount: PosInt.make(1),
              id: "relations",
              query:
                "SELECT ?claim WHERE { ?claim a <https://beep.sh/semantica/ontology/RelationClaim> } ORDER BY ?claim",
            }),
          ];
          const first = yield* projection.rebuild(snapshot);
          const firstResults = yield* projection.query(first, expectations);
          const second = yield* projection.rebuild(snapshot);
          const secondResults = yield* projection.query(second, expectations);

          expect(A.map(firstResults, (result) => result.count)).toEqual([3, 1]);
          expect(first.serializedQuads.length).toBeGreaterThan(0);
          expect(Equal.equals(first.serializedQuads, second.serializedQuads)).toBe(true);
          expect(Equal.equals(firstResults, secondResults)).toBe(true);
        })
      )
    ));
});
