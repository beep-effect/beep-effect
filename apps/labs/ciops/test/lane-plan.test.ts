import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema/Sha256";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import { Effect, FileSystem, Layer } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  GateOrderHandoffRef,
  GateOrderHandoffView,
  HandoffLane,
  LaneOrderRule,
  LanePlanProposal,
  LaneScope,
  LaneStep,
  PlanEpisodeInput,
} from "@/projection/Schemas";

// P2 Ruling 2: the lab pins the live 33-lane handoff by digest; counts always come from the decoded bytes.
const pinnedHandoffSha256 = "705f3e754a51c6750529ccec1021293c82fce0994709a18906b863609a0a2198";
const pinnedHandoffPath = "goals/time-to-certainty/research/gate-order-handoff.json";
const fixtureHandoffPath = "test/fixtures/gate-order-handoff-v1.json";
const liveHandoffPath = `../../../${pinnedHandoffPath}`;
const pathFailure = "Handoff paths must be normalized repo-relative paths";

const PlatformLive = Layer.merge(BunFileSystem.layer, BunCrypto.layer);

const decodeHandoffView = S.decodeUnknownEffect(S.fromJsonString(GateOrderHandoffView));
// An independent census of the raw lane array, so the subset view's count is checked against the document.
const decodeRawLaneCensus = S.decodeUnknownEffect(
  S.fromJsonString(S.Struct({ lanes: S.Array(S.Unknown), seed: S.Struct({ lanes: S.Array(S.Unknown) }) }))
);
const digestBytes = S.decodeUnknownEffect(Sha256HexFromBytes);
const decodePlan = S.decodeUnknownEffect(LanePlanProposal);

// One read: the digested bytes are the decoded text, as planEpisode is specified to do.
const readHandoff = Effect.fn("LanePlanTest.readHandoff")(function* (path: string) {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs.readFile(path);
  return { text: new TextDecoder().decode(bytes), sha256: yield* digestBytes(bytes) };
});

const handoffJson = (overrides: Readonly<Record<string, unknown>>): string =>
  JSON.stringify({
    schemaVersion: "gate-order-handoff/v1",
    scope: "pre-push:non-main",
    orderRule: "gate-order-lexicographic/v1",
    lanes: [
      { rank: 0, laneId: "quality:secrets", declarationIndex: 1 },
      { rank: 1, laneId: "fallow:audit", declarationIndex: 0 },
    ],
    ...overrides,
  });

const expectFailure = Effect.fnUntraced(function* <A>(effect: Effect.Effect<A, S.SchemaError>, fragment: string) {
  const failure = yield* Effect.flip(effect);
  assertInstanceOf(failure, S.SchemaError);
  expect(Str.includes(fragment)(failure.message)).toBe(true);
});

const expectDecodeFailure = (text: string, fragment: string) => expectFailure(decodeHandoffView(text), fragment);

const planInputWithPath = (path: string) =>
  S.decodeEffect(PlanEpisodeInput)({
    episodeId: "lane-plan-episode-1",
    repoRoot: "../../..",
    handoff: { path, sha256: pinnedHandoffSha256 },
  });

const encodedPlan = {
  episodeId: "lane-plan-episode-1",
  planId: `lane-plan-${pinnedHandoffSha256}`,
  handoffPath: pinnedHandoffPath,
  handoffSha256: pinnedHandoffSha256,
  orderRule: "gate-order-lexicographic/v1",
  scope: "pre-push:non-main",
  laneSteps: [
    { laneStepIndex: 0, laneId: "quality:secrets" },
    { laneStepIndex: 1, laneId: "fallow:audit" },
  ],
};

it.layer(PlatformLive, { timeout: "10 seconds" })("@beep/ciops lane-plan seam", (it) => {
  it.effect("pins the fixture handoff by sha256 and decodes every lane the document carries", () =>
    Effect.gen(function* () {
      const fixture = yield* readHandoff(fixtureHandoffPath);
      expect(fixture.sha256).toBe(pinnedHandoffSha256);

      const view = yield* decodeHandoffView(fixture.text);
      const census = yield* decodeRawLaneCensus(fixture.text);
      expect(view.lanes.length).toBe(census.lanes.length);
      expect(view.lanes.length).toBe(census.seed.lanes.length);
      expect(A.map(view.lanes, (lane) => lane.rank)).toStrictEqual(A.range(0, view.lanes.length - 1));
      const scope: LaneScope = view.scope;
      const orderRule: LaneOrderRule = view.orderRule;
      expect(LaneScope.is["pre-push:non-main"](scope)).toBe(true);
      expect(LaneOrderRule.is["gate-order-lexicographic/v1"](orderRule)).toBe(true);
    })
  );

  it.effect("detects drift of the live handoff away from the pinned sha256", () =>
    Effect.gen(function* () {
      const live = yield* readHandoff(liveHandoffPath);
      expect(live.sha256).toBe(pinnedHandoffSha256);
    })
  );

  it.effect("fails the subset decode on a duplicate lane id", () =>
    expectDecodeFailure(
      handoffJson({
        lanes: [
          { rank: 0, laneId: "quality:secrets", declarationIndex: 0 },
          { rank: 1, laneId: "quality:secrets", declarationIndex: 1 },
        ],
      }),
      "Handoff lane ids must be unique"
    )
  );

  it.effect("fails the subset decode on an incoherent rank set, a duplicate declaration index or no lanes", () =>
    Effect.gen(function* () {
      const rankFailure = "Handoff lane ranks must be exactly 0..n-1";
      yield* expectDecodeFailure(
        handoffJson({
          lanes: [
            { rank: 0, laneId: "quality:secrets", declarationIndex: 0 },
            { rank: 2, laneId: "fallow:audit", declarationIndex: 1 },
          ],
        }),
        rankFailure
      );
      yield* expectDecodeFailure(
        handoffJson({
          lanes: [
            { rank: 0, laneId: "quality:secrets", declarationIndex: 0 },
            { rank: 0, laneId: "fallow:audit", declarationIndex: 1 },
          ],
        }),
        rankFailure
      );
      yield* expectDecodeFailure(
        handoffJson({ lanes: [{ rank: 5, laneId: "quality:secrets", declarationIndex: 0 }] }),
        rankFailure
      );
      yield* expectDecodeFailure(
        handoffJson({
          lanes: [
            { rank: 0, laneId: "quality:secrets", declarationIndex: 0 },
            { rank: 1, laneId: "fallow:audit", declarationIndex: 0 },
          ],
        }),
        "Handoff declaration indexes must be unique"
      );
      yield* expectDecodeFailure(handoffJson({ lanes: [] }), 'at ["lanes"]');
    })
  );

  it.effect("fails the subset decode on a malformed lane id, version, scope or order rule", () =>
    Effect.gen(function* () {
      yield* expectDecodeFailure(
        handoffJson({ lanes: [{ rank: 0, laneId: "Quality Secrets", declarationIndex: 0 }] }),
        "Lane ids must be lowercase colon-separated segments"
      );
      yield* expectDecodeFailure(
        handoffJson({ lanes: [{ rank: 0, laneId: "secrets", declarationIndex: 0 }] }),
        "Lane ids must be lowercase colon-separated segments"
      );
      yield* expectDecodeFailure(handoffJson({ schemaVersion: "gate-order-handoff/v2" }), 'at ["schemaVersion"]');
      yield* expectDecodeFailure(handoffJson({ scope: "pre-push:main" }), 'at ["scope"]');
      yield* expectDecodeFailure(handoffJson({ orderRule: "gate-order-lexicographic/v2" }), 'at ["orderRule"]');
    })
  );

  it.effect("round-trips the widened planner input and refuses a path that escapes the repo root", () =>
    Effect.gen(function* () {
      const handoff = GateOrderHandoffRef.make({
        path: pinnedHandoffPath,
        sha256: Sha256Hex.make(pinnedHandoffSha256),
      });
      const input = PlanEpisodeInput.make({ episodeId: "lane-plan-episode-1", repoRoot: "../../..", handoff });
      const encoded = yield* S.encodeEffect(PlanEpisodeInput)(input);
      expect(encoded).toStrictEqual({
        episodeId: "lane-plan-episode-1",
        repoRoot: "../../..",
        handoff: { path: pinnedHandoffPath, sha256: pinnedHandoffSha256 },
      });
      expect(yield* S.decodeEffect(PlanEpisodeInput)(encoded)).toStrictEqual(input);

      yield* expectFailure(planInputWithPath("../time-to-certainty/research/gate-order-handoff.json"), pathFailure);
      yield* expectFailure(planInputWithPath(`/${pinnedHandoffPath}`), pathFailure);
      yield* expectFailure(
        planInputWithPath("goals/../time-to-certainty/research/gate-order-handoff.json"),
        pathFailure
      );
      yield* expectFailure(planInputWithPath(`./${pinnedHandoffPath}`), pathFailure);
    })
  );

  it.effect("carries the handoff path in the lane plan and enforces the derived plan id and step positions", () =>
    Effect.gen(function* () {
      const plan = yield* decodePlan(encodedPlan);
      expect(plan.handoffPath).toBe(pinnedHandoffPath);
      expect(yield* S.encodeEffect(LanePlanProposal)(plan)).toStrictEqual(encodedPlan);

      const { handoffPath: _handoffPath, ...pathless } = encodedPlan;
      yield* expectFailure(decodePlan(pathless), 'at ["handoffPath"]');
      yield* expectFailure(
        decodePlan({ ...encodedPlan, planId: `schedule-${pinnedHandoffSha256}` }),
        "Lane plan ids must be lane-plan- followed by the handoff SHA-256"
      );
      yield* expectFailure(
        decodePlan({
          ...encodedPlan,
          laneSteps: [
            { laneStepIndex: 1, laneId: "quality:secrets" },
            { laneStepIndex: 0, laneId: "fallow:audit" },
          ],
        }),
        "Lane step indexes must equal their 0-based positions"
      );
    })
  );

  it.effect.prop(
    "handoff lanes and lane steps round-trip through their codecs",
    [Arbitrary.schema(HandoffLane), Arbitrary.schema(LaneStep)],
    ([lane, step]) =>
      Effect.gen(function* () {
        const laneEncoded = yield* S.encodeEffect(HandoffLane)(lane);
        expect(S.toEquivalence(HandoffLane)(yield* S.decodeEffect(HandoffLane)(laneEncoded), lane)).toBe(true);
        const stepEncoded = yield* S.encodeEffect(LaneStep)(step);
        expect(S.toEquivalence(LaneStep)(yield* S.decodeEffect(LaneStep)(stepEncoded), step)).toBe(true);
      }),
    { arbitrary: fcRuns(64) }
  );
});
