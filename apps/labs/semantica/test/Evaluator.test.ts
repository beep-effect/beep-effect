// @vitest-environment node

import { SourceTextExtractor } from "@beep/provenance";
import { NonNegativeInt, Sha256Hex } from "@beep/schema";
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
import { GoldFile, GoldRef, GoldSubset } from "@/schema/Gold";
import { DocumentId, ProvenanceEventId } from "@/schema/Ids";
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
          expect(report.unexpectedDegraded).toBe(0);
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
