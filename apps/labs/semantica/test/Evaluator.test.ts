// @vitest-environment node

import { Confidence } from "@beep/epistemic-domain";
import {
  SourceTextDigest,
  SourceTextExtractor,
  SourceTextIdentity,
  TextAnchor,
  TextAnchorVerificationReceipt,
} from "@beep/provenance";
import { NonNegativeInt, Sha256Hex } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, Layer, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { describe, expect, it } from "vitest";
import { CorpusPaperId } from "@/corpus/Manifest";
import { F1FixtureId } from "@/fixtures/F1";
import { bCubedF1, EvaluatorLive, exactF1, pairwiseF1 } from "@/layers/EvaluatorLive";
import { PATTERN_MODEL_IDENTITY } from "@/layers/ExtractorLive";
import { AnthropicExtractionModelIdentity } from "@/layers/LanguageModelLive";
import { FixtureDeclaration, Origin, SourceDocument } from "@/schema/Document";
import { EvalRun, EvalSelection, makeRunId } from "@/schema/Eval";
import { ClaimBody, EvidenceBatch, EvidenceClaim, ExtractOutcome, makeBatchId, makeClaimId } from "@/schema/Evidence";
import { GoldEntityLabel, GoldFile, GoldRef, GoldRelationLabel, GoldSubset } from "@/schema/Gold";
import { ChunkId, DocumentId, ProvenanceEventId } from "@/schema/Ids";
import { LedgerDocumentSnapshot, LedgerSnapshot } from "@/schema/Ledger";
import { ModelIdentity } from "@/schema/Model";
import { ParseOutcome } from "@/schema/Text";
import { Evaluator } from "@/services/Evaluator";
import { GoldSource } from "@/services/GoldSource";

const paperIds = A.make(
  CorpusPaperId.make("000000000001"),
  CorpusPaperId.make("000000000002"),
  CorpusPaperId.make("000000000003"),
  CorpusPaperId.make("000000000004"),
  CorpusPaperId.make("000000000005"),
  CorpusPaperId.make("000000000006"),
  CorpusPaperId.make("000000000007"),
  CorpusPaperId.make("000000000008"),
  CorpusPaperId.make("000000000009"),
  CorpusPaperId.make("00000000000a")
);
const paperId = A.headNonEmpty(paperIds);
const proposer = ModelIdentity.make({
  artifactHash: Sha256Hex.make(Str.repeat(64)("1")),
  name: "stub-gold-20260826",
  provider: "xai",
  revision: "stub-gold-20260826",
  taskType: "gold-proposal",
});
const gold = GoldRef.make({
  digest: Sha256Hex.make(Str.repeat(64)("2")),
  proposer,
  spotCheckedFraction: UnitInterval.make(0),
  subsets: GoldSubset.make({
    entity: A.take(paperIds, 5),
    relation: A.take(paperIds, 3),
    structure: paperIds,
  }),
  version: "gold/v1",
});
const hosted = Effect.runSync(
  AnthropicExtractionModelIdentity({
    artifactHash: Sha256Hex.make(Str.repeat(64)("3")),
    model: "stub-extractor-20260826",
  })
);
const selection = EvalSelection.make({ f1: [F1FixtureId.make("md-structure")], w1: [] });
const runBody = {
  corpusHash: Sha256Hex.make(Str.repeat(64)("4")),
  extractor: hosted,
  fixtureIndexDigest: Sha256Hex.make(Str.repeat(64)("5")),
  gold,
  patternLane: PATTERN_MODEL_IDENTITY,
  selection,
  stage: "c0" as const,
};
const run = EvalRun.make({ ...runBody, id: Result.getOrThrow(makeRunId(runBody)) });
const documentId = DocumentId.make(Str.repeat(64)("6"));
const document = SourceDocument.make({
  acquired: ProvenanceEventId.make(Str.repeat(64)("7")),
  bytes: NonNegativeInt.make(12),
  id: documentId,
  mediaType: "text/markdown",
  origin: Origin.cases.Fixture.make({
    declared: FixtureDeclaration.make({ degradedKind: O.none(), expectation: "parses" }),
    fixtureId: F1FixtureId.make("md-structure"),
    kind: "Fixture",
    relativePath: "documents/md-structure.md",
  }),
  sha256: documentId,
});
const parsed = ParseOutcome.cases.Parsed.make({
  document: document.id,
  extractor: SourceTextExtractor.make({ name: "evaluator-test", version: "0.0.0" }),
  outcome: "Parsed",
  text: "Miniature gold text.",
});
const snapshot = LedgerSnapshot.make({
  batches: [],
  documents: [LedgerDocumentSnapshot.make({ canonical: O.none(), chunks: [], document, outcome: parsed })],
  events: [],
  run: run.id,
});
const files = [
  GoldFile.make({ labels: [], paperId, proposer, subset: "structure", version: "gold/v1" }),
  GoldFile.make({ labels: [], paperId, proposer, subset: "entity", version: "gold/v1" }),
  GoldFile.make({ labels: [], paperId, proposer, subset: "relation", version: "gold/v1" }),
];

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

type EntityMetricSpec = {
  readonly cluster: string;
  readonly endChar: number;
  readonly quote: string;
  readonly startChar: number;
};

const metricRun = (w1: ReadonlyArray<CorpusPaperId>): EvalRun => {
  const body = {
    ...runBody,
    selection: EvalSelection.make({ f1: selection.f1, w1 }),
  };
  return EvalRun.make({ ...body, id: Result.getOrThrow(makeRunId(body)) });
};

const w1Document = (id: DocumentId, paper: CorpusPaperId): SourceDocument =>
  SourceDocument.make({
    acquired: ProvenanceEventId.make(id),
    bytes: NonNegativeInt.make(32),
    id,
    mediaType: "application/pdf",
    origin: Origin.cases.W1Paper.make({
      corpusId: "academia-2026-07",
      paperId: paper,
      relativePath: `${paper}.pdf`,
    }),
    sha256: id,
  });

const w1Snapshot = (source: SourceDocument): LedgerDocumentSnapshot =>
  LedgerDocumentSnapshot.make({
    canonical: O.none(),
    chunks: [],
    document: source,
    outcome: ParseOutcome.cases.Parsed.make({
      document: source.id,
      extractor: SourceTextExtractor.make({ name: "evaluator-test", version: "0.0.0" }),
      outcome: "Parsed",
      text: "Ada uses Engine. Ada repeats.",
    }),
  });

const hostedOutcome = (
  source: SourceDocument,
  chunk: ChunkId,
  entities: readonly [EntityMetricSpec, EntityMetricSpec, ...ReadonlyArray<EntityMetricSpec>],
  predicate: string
) => {
  const identity = SourceTextIdentity.make({
    extractor: SourceTextExtractor.make({ name: "evaluator-test", version: "0.0.0" }),
    locator: PosixPath.make(source.origin.relativePath),
    normalizationVersion: "raw/1",
    scopeRef: "semantica-canary",
    sourceDigest: SourceTextDigest.make(`sha256:${source.id}`),
    sourceRef: source.id,
    textDigest: SourceTextDigest.make(`sha256:${source.id}`),
  });
  const entityClaims = A.map(entities, (entity) => {
    const body = ClaimBody.cases.Entity.make({
      cluster: O.some(entity.cluster),
      endChar: NonNegativeInt.make(entity.endChar),
      entityType: "entity",
      kind: "Entity",
      label: entity.quote,
      quote: entity.quote,
      startChar: NonNegativeInt.make(entity.startChar),
    });
    const id = Result.getOrThrow(
      makeClaimId({ body, chunk, document: source.id, method: "hosted-langextract", model: hosted })
    );
    return EvidenceClaim.make({
      body,
      cacheKey: O.none(),
      chunk,
      confidence: Confidence.make(1),
      document: source.id,
      id,
      method: "hosted-langextract",
      model: hosted,
      receipt: TextAnchorVerificationReceipt.make({ anchor: TextAnchor.make(body), source: identity }),
    });
  });
  const subject = A.getUnsafe(entityClaims, 0);
  const object = A.getUnsafe(entityClaims, 1);
  const relationEntity = A.headNonEmpty(entities);
  const relationBody = ClaimBody.cases.Relation.make({
    endChar: NonNegativeInt.make(relationEntity.endChar),
    kind: "Relation",
    object: object.id,
    predicate,
    quote: relationEntity.quote,
    startChar: NonNegativeInt.make(relationEntity.startChar),
    subject: subject.id,
  });
  const relationId = Result.getOrThrow(
    makeClaimId({ body: relationBody, chunk, document: source.id, method: "hosted-langextract", model: hosted })
  );
  const relation = EvidenceClaim.make({
    body: relationBody,
    cacheKey: O.none(),
    chunk,
    confidence: Confidence.make(1),
    document: source.id,
    id: relationId,
    method: "hosted-langextract",
    model: hosted,
    receipt: TextAnchorVerificationReceipt.make({ anchor: TextAnchor.make(relationBody), source: identity }),
  });
  const inputs = [chunk] as const;
  const batchId = Result.getOrThrow(
    makeBatchId({ document: source.id, inputs, method: "hosted-langextract", model: hosted })
  );
  return ExtractOutcome.cases.Extracted.make({
    batch: EvidenceBatch.make({
      claims: A.append(entityClaims, relation),
      degraded: [],
      document: source.id,
      id: batchId,
      inputs,
      lossy: [],
      method: "hosted-langextract",
      model: hosted,
    }),
    outcome: "Extracted",
  });
};

const goldFiles = (
  paper: CorpusPaperId,
  entities: readonly [EntityMetricSpec, EntityMetricSpec, ...ReadonlyArray<EntityMetricSpec>],
  predicate: string
) => [
  GoldFile.make({ labels: [], paperId: paper, proposer, subset: "structure", version: "gold/v1" }),
  GoldFile.make({
    labels: A.map(entities, (entity) =>
      GoldEntityLabel.make({
        cluster: entity.cluster,
        endChar: NonNegativeInt.make(entity.endChar),
        entityType: "entity",
        label: entity.quote,
        quote: entity.quote,
        startChar: NonNegativeInt.make(entity.startChar),
        verified: true,
      })
    ),
    paperId: paper,
    proposer,
    subset: "entity",
    version: "gold/v1",
  }),
  GoldFile.make({
    labels: [
      GoldRelationLabel.make({
        endChar: NonNegativeInt.make(A.headNonEmpty(entities).endChar),
        object: A.getUnsafe(entities, 1).quote,
        predicate,
        quote: A.headNonEmpty(entities).quote,
        startChar: NonNegativeInt.make(A.headNonEmpty(entities).startChar),
        subject: A.headNonEmpty(entities).quote,
        verified: true,
      }),
    ],
    paperId: paper,
    proposer,
    subset: "relation",
    version: "gold/v1",
  }),
];

const fixtureHostedDegraded = ExtractOutcome.cases.Degraded.make({
  detail: "The fixture provider response is unavailable.",
  document: document.id,
  kind: "provider-unavailable",
  lane: "hosted",
  outcome: "Degraded",
});

describe("C0 evaluator metric math", () => {
  it("matches hand-computed exact, pairwise, and B-Cubed F1 values", () => {
    const predicted = [
      ["a", "left"],
      ["b", "left"],
      ["c", "right"],
    ] as const;
    const expected = [
      ["a", "one"],
      ["b", "two"],
      ["c", "two"],
    ] as const;

    expect(exactF1(["a", "b"], ["a", "c"])).toBe(0.5);
    expect(pairwiseF1(predicted, expected)).toBe(0);
    expect(
      pairwiseF1(
        [
          ["a", "left"],
          ["b", "left"],
        ],
        [
          ["b", "right"],
          ["a", "right"],
        ]
      )
    ).toBe(1);
    expect(bCubedF1(predicted, expected)).toBeCloseTo(2 / 3);
  });

  it("keeps identical relation text in different documents as distinct metric keys", () => {
    const papers = A.take(paperIds, 2);
    const firstPaper = A.getUnsafe(papers, 0);
    const secondPaper = A.getUnsafe(papers, 1);
    const first = w1Document(DocumentId.make(Str.repeat(64)("a")), firstPaper);
    const second = w1Document(DocumentId.make(Str.repeat(64)("b")), secondPaper);
    const entities = [
      { cluster: "person-ada", endChar: 3, quote: "Ada", startChar: 0 },
      { cluster: "method-engine", endChar: 14, quote: "Engine", startChar: 8 },
    ] as const;
    const scenarioFiles = A.appendAll(
      goldFiles(firstPaper, entities, "uses"),
      goldFiles(secondPaper, entities, "uses")
    );
    const selectedRun = metricRun(papers);
    const selectedSnapshot = LedgerSnapshot.make({
      batches: [],
      documents: [w1Snapshot(first), w1Snapshot(second), ...snapshot.documents],
      events: [],
      run: selectedRun.id,
    });
    const outcomes = [
      hostedOutcome(first, ChunkId.make(Str.repeat(64)("c")), entities, "uses"),
      hostedOutcome(second, ChunkId.make(Str.repeat(64)("d")), entities, "differs"),
      fixtureHostedDegraded,
    ];
    const goldSource = Layer.succeed(
      GoldSource,
      GoldSource.of({ load: Effect.fn("GoldSource.relationIdentity")(() => Effect.succeed(scenarioFiles)) })
    );
    const evaluator = EvaluatorLive.pipe(Layer.provide(goldSource));

    return Effect.runPromise(
      provideScopedLayer(Layer.merge(BunServices.layer, evaluator))(
        Effect.gen(function* () {
          const service = yield* Evaluator;
          const report = yield* service.score(selectedRun, selectedSnapshot, outcomes);
          const relation = A.findFirst(
            report.metrics,
            (metric) => metric.name === "rebel-end-to-end-triple-f1" && metric.lane === "hosted"
          );

          expect(O.map(relation, (metric) => metric.value)).toEqual(O.some(0.5));
        })
      )
    );
  });

  it("scores provider cluster assignments instead of normalized entity surfaces", () => {
    const selectedRun = metricRun([paperId]);
    const source = w1Document(DocumentId.make(Str.repeat(64)("a")), paperId);
    const predictedEntities = [
      { cluster: "mention-one", endChar: 3, quote: "Ada", startChar: 0 },
      { cluster: "mention-two", endChar: 11, quote: "Ada", startChar: 8 },
    ] as const;
    const goldEntities = [
      { cluster: "person-ada", endChar: 3, quote: "Ada", startChar: 0 },
      { cluster: "person-ada", endChar: 11, quote: "Ada", startChar: 8 },
    ] as const;
    const selectedSnapshot = LedgerSnapshot.make({
      batches: [],
      documents: [w1Snapshot(source), ...snapshot.documents],
      events: [],
      run: selectedRun.id,
    });
    const scenarioFiles = goldFiles(paperId, goldEntities, "references");
    const outcomes = [
      hostedOutcome(source, ChunkId.make(Str.repeat(64)("c")), predictedEntities, "references"),
      fixtureHostedDegraded,
    ];
    const goldSource = Layer.succeed(
      GoldSource,
      GoldSource.of({ load: Effect.fn("GoldSource.coreference")(() => Effect.succeed(scenarioFiles)) })
    );
    const evaluator = EvaluatorLive.pipe(Layer.provide(goldSource));

    return Effect.runPromise(
      provideScopedLayer(Layer.merge(BunServices.layer, evaluator))(
        Effect.gen(function* () {
          const service = yield* Evaluator;
          const report = yield* service.score(selectedRun, selectedSnapshot, outcomes);
          const pairwise = A.findFirst(
            report.metrics,
            (metric) => metric.name === "pairwise-f1" && metric.lane === "hosted"
          );
          const bCubed = A.findFirst(report.metrics, (metric) => metric.name === "b-cubed" && metric.lane === "hosted");

          expect(O.map(pairwise, (metric) => metric.value)).toEqual(O.some(0));
          expect(O.map(bCubed, (metric) => metric.value)).toEqual(O.some(2 / 3));
        })
      )
    );
  });

  it("counts hosted degradation on a fixture declared parseable", () => {
    const goldSource = Layer.succeed(
      GoldSource,
      GoldSource.of({ load: Effect.fn("GoldSource.fixtureDegraded")(() => Effect.succeed(files)) })
    );
    const evaluator = EvaluatorLive.pipe(Layer.provide(goldSource));

    return Effect.runPromise(
      provideScopedLayer(Layer.merge(BunServices.layer, evaluator))(
        Effect.gen(function* () {
          const service = yield* Evaluator;
          const report = yield* service.score(run, snapshot, [fixtureHostedDegraded]);

          expect(A.headNonEmpty(report.documents).extraction.hosted).toBe("provider-unavailable");
          expect(report.unexpectedDegraded).toBe(1);
        })
      )
    );
  });

  it("loads injected F1-only gold and emits all ten C0 coordinates", () => {
    const goldSource = Layer.succeed(
      GoldSource,
      GoldSource.of({ load: Effect.fn("GoldSource.stub")(() => Effect.succeed(files)) })
    );
    const evaluator = EvaluatorLive.pipe(Layer.provide(goldSource));

    return Effect.runPromise(
      provideScopedLayer(Layer.merge(BunServices.layer, evaluator))(
        Effect.gen(function* () {
          const service = yield* Evaluator;
          const report = yield* service.score(run, snapshot, []);

          expect(report.metrics).toHaveLength(10);
          expect(report.documents).toHaveLength(1);
          expect(report.unexpectedDegraded).toBe(1);
          expect(A.filter(report.metrics, (metric) => metric.status === "unsupported")).toHaveLength(2);
          expect(
            A.every(
              A.filter(report.metrics, (metric) => metric.status === "scored"),
              (metric) => metric.support === 1 && metric.value === 1
            )
          ).toBe(true);
        })
      )
    );
  });
});
