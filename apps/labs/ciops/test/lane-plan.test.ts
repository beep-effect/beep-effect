import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema/Sha256";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import { assertExitFailure, assertInstanceOf } from "@effect/vitest/utils";
import { Cause, Crypto, Effect, Exit, FileSystem, HashSet, Layer, Order, PlatformError, pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CiOpsProjection, CiOpsProjectionLive } from "@/projection/CiOpsProjection";
import { decodeHandoffView as decodeHandoffSubset, LanePrecedence, planLanes, rankChain } from "@/projection/LanePlan";
import {
  CyclicPlanError,
  GateOrderHandoffRef,
  GateOrderHandoffView,
  HandoffDecodeError,
  HandoffDigestMismatchError,
  HandoffLane,
  HandoffReadError,
  LaneOrderRule,
  LanePlanProposal,
  LaneScope,
  LaneStep,
  PendingRequest,
  PlanEpisodeInput,
  ScheduleProposal,
  ScheduleStep,
} from "@/projection/Schemas";
import { emitLanePlan, emitScheduleAbox } from "@/projection/Turtle";
import type { CiOpsProjectionShape } from "@/projection/CiOpsProjection";

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

const lanePlanGoldenPath = "test/fixtures/lane-plan-v1.ttl";
const admissionGoldenPath = "test/fixtures/emission-v2.ttl";
const goldenEpisodeId = "lane-plan-golden-1";

const fixtureInput = (sha256: string, path: string = fixtureHandoffPath) =>
  PlanEpisodeInput.make({
    episodeId: goldenEpisodeId,
    repoRoot: ".",
    handoff: GateOrderHandoffRef.make({ path, sha256: Sha256Hex.make(sha256) }),
  });

const readFixtureView = Effect.fn("LanePlanTest.readFixtureView")(function* () {
  const fixture = yield* readHandoff(fixtureHandoffPath);
  return yield* decodeHandoffView(fixture.text);
});

const rankedLaneIds = (lanes: ReadonlyArray<HandoffLane>): ReadonlyArray<string> =>
  A.map(
    A.sort(
      lanes,
      Order.mapInput(Order.Number, (lane: HandoffLane) => lane.rank)
    ),
    (lane) => lane.laneId
  );

// A permutation from arbitrary sort keys: position i sorts by (keys[i] or 0, i), so every order is reachable.
type PermutationEntry<T> = { readonly key: number; readonly index: number; readonly item: T };
const byPermutationKey: Order.Order<PermutationEntry<unknown>> = Order.combine(
  Order.mapInput(Order.Number, (entry: PermutationEntry<unknown>) => entry.key),
  Order.mapInput(Order.Number, (entry: PermutationEntry<unknown>) => entry.index)
);
const permute = <T>(items: ReadonlyArray<T>, keys: ReadonlyArray<number>): ReadonlyArray<T> =>
  pipe(
    A.map(
      items,
      (item, index): PermutationEntry<T> => ({ key: O.getOrElse(A.get(keys, index), () => 0), index, item })
    ),
    A.sort(byPermutationKey),
    A.map((entry) => entry.item)
  );

const lane = (laneId: string, rank: number): HandoffLane =>
  HandoffLane.make({ rank: S.Natural.make(rank), laneId, declarationIndex: S.Natural.make(rank) });
const precedence = (beforeLaneId: string, afterLaneId: string) => LanePrecedence.make({ beforeLaneId, afterLaneId });
const threeLanes = [lane("lane:a", 0), lane("lane:b", 1), lane("lane:c", 2)];
const declaredLane = (laneId: string, rank: number, declarationIndex: number): HandoffLane =>
  HandoffLane.make({ rank: S.Natural.make(rank), laneId, declarationIndex: S.Natural.make(declarationIndex) });

// A platform digest that always fails, so planEpisode's digest step is observed failing typed.
const failingDigestCrypto = Crypto.make({
  randomBytes: (size) => new Uint8Array(size),
  digest: () =>
    Effect.fail(
      PlatformError.systemError({
        _tag: "Unknown",
        module: "Crypto",
        method: "digest",
        description: "digest unavailable",
      })
    ),
});
const FailingDigestProjectionLive = CiOpsProjectionLive.pipe(
  Layer.provide(Layer.succeed(Crypto.Crypto, failingDigestCrypto))
);

// Contract §8.3: none of these may touch a lane plan, in either namespace.
const forbiddenLanePlanTerms = [
  "hasCurrentProposal",
  "hasProjectionSpecification",
  "hasStep",
  "hasScopeTag",
  "stepIndex",
  "ScheduleStep",
  "ScheduleProposal",
  "VerificationLane",
  "schedulesWorkUnit",
  "hasScope",
  "Scope",
  "hasCurrentLanePlan",
  "scheduledLaneRef",
];

const episodeNodes = (content: string): HashSet.HashSet<string> =>
  HashSet.fromIterable(A.filter(Str.split(content, /\s+/), Str.startsWith("ciops-prov:episode-")));

// The admission golden's proposal, built by hand so the regression does not depend on the policy A-Box.
const admissionRequest = (nonce: string, enqueuedAtMillis: number) =>
  PendingRequest.make({
    nonce,
    kind: "merged-preview",
    priority: "verify",
    weightTokens: 5,
    originKey: "origin-test",
    enqueuedAtMillis: S.Natural.make(enqueuedAtMillis),
  });
const admissionGoldenProposal = ScheduleProposal.make({
  episodeId: "verification-1",
  proposalId: "schedule-policy-digest-journal-prefix-digest-1000",
  projectionInstantMillis: S.Natural.make(1_000),
  steps: A.map(["admitted-a", "admitted-b"], (nonce, index) =>
    ScheduleStep.make({
      stepIndex: S.Natural.make(index),
      scheduledUnitRef: nonce,
      scope: "admission",
      request: admissionRequest(nonce, index),
      activeTokenTotalAfter: S.Natural.make(5 * (index + 1)),
    })
  ),
  deferredTail: [admissionRequest("deferred-c", 2)],
  policyDigest: "policy-digest",
  journalPrefixDigest: "journal-prefix-digest",
});

// Rebuild Die reasons without annotations so the defect is compared structurally.
const dieReasons = <A, E>(exit: Exit.Exit<A, E>): Exit.Exit<A, E> =>
  Exit.match(exit, {
    onSuccess: Exit.succeed,
    onFailure: (cause) =>
      Exit.failCause(
        Cause.fromReasons(
          A.map(cause.reasons, (reason) => (Cause.isDieReason(reason) ? Cause.makeDieReason(reason.defect) : reason))
        )
      ),
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

  it.effect("chains lanes by rank and plans them in rank order although nodes go in by declaration", () =>
    Effect.gen(function* () {
      const view = yield* readFixtureView();
      const ranked = rankedLaneIds(view.lanes);
      const chain = rankChain(view.lanes);
      expect(chain.length).toBe(view.lanes.length - 1);
      expect(A.map(chain, (edge) => [edge.beforeLaneId, edge.afterLaneId])).toStrictEqual(
        A.zip(ranked, A.drop(ranked, 1))
      );
      // The fixture's declaration order differs from its rank order, so topo agreeing with rank is not insertion order.
      const declared = A.map(
        A.sort(
          view.lanes,
          Order.mapInput(Order.Number, (entry: HandoffLane) => entry.declarationIndex)
        ),
        (entry) => entry.laneId
      );
      expect(declared).not.toStrictEqual(ranked);

      const steps = yield* planLanes(view.lanes, chain);
      expect(steps.length).toBe(view.lanes.length);
      expect(A.map(steps, (step) => step.laneId)).toStrictEqual(ranked);
      expect(A.map(steps, (step) => step.laneStepIndex)).toStrictEqual(A.range(0, view.lanes.length - 1));
      expect(HashSet.size(HashSet.fromIterable(A.map(steps, (step) => step.laneId)))).toBe(view.lanes.length);
    })
  );

  it.effect("fails a cyclic precedence set typed, with the cycle witness's lane ids once each", () =>
    Effect.gen(function* () {
      const cycle = yield* Effect.flip(
        planLanes(threeLanes, [
          precedence("lane:a", "lane:b"),
          precedence("lane:b", "lane:c"),
          precedence("lane:c", "lane:a"),
        ])
      );
      assertInstanceOf(cycle, CyclicPlanError);
      expect(cycle.cycleNodes).toStrictEqual(["lane:a", "lane:b", "lane:c"]);

      const selfLoop = yield* Effect.flip(
        planLanes(threeLanes, [precedence("lane:a", "lane:b"), precedence("lane:b", "lane:b")])
      );
      assertInstanceOf(selfLoop, CyclicPlanError);
      expect(selfLoop.cycleNodes).toStrictEqual(["lane:b"]);
    })
  );

  it.effect("dies on an acyclic precedence list that forces an order other than the rank order", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(planLanes(threeLanes, [precedence("lane:c", "lane:a")]));
      assertExitFailure(
        dieReasons(exit),
        Cause.die(
          "Lane plan self-check failed: topological order [lane:b, lane:c, lane:a] disagrees with rank order [lane:a, lane:b, lane:c]."
        )
      );
    })
  );

  it.effect("inserts nodes in declaration order, distinct from both the array order and the rank order", () =>
    Effect.gen(function* () {
      // Array order [z, x, y], rank order [x, y, z], declaration order [y, z, x]. With no edges, topo follows
      // node insertion, so the self-check's die message reveals the insertion order.
      const lanes = [declaredLane("lane:z", 2, 1), declaredLane("lane:x", 0, 2), declaredLane("lane:y", 1, 0)];
      const exit = yield* Effect.exit(planLanes(lanes, []));
      assertExitFailure(
        dieReasons(exit),
        Cause.die(
          "Lane plan self-check failed: topological order [lane:y, lane:z, lane:x] disagrees with rank order [lane:x, lane:y, lane:z]."
        )
      );
    })
  );

  it.effect("dies on a precedence naming a lane outside the plan and on a repeated lane id, never a cycle", () =>
    Effect.gen(function* () {
      const unknown = yield* Effect.exit(planLanes(threeLanes, [precedence("lane:a", "lane:zz")]));
      assertExitFailure(
        dieReasons(unknown),
        Cause.die("Lane precedence lane:a -> lane:zz names a lane outside the plan.")
      );

      const repeated = [lane("lane:a", 0), lane("lane:b", 1), lane("lane:a", 2)];
      const duplicate = yield* Effect.exit(planLanes(repeated, rankChain(repeated)));
      assertExitFailure(
        dieReasons(duplicate),
        Cause.die("Lane plan input carries 3 lanes but only 2 distinct lane ids.")
      );
    })
  );

  it.effect.prop(
    "emits byte-equal Turtle for any permutation of the decoded lane array under a fixed digest",
    [Arbitrary.schema(S.Int.pipe(S.Array))],
    ([keys]) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const view = yield* readFixtureView();
        const permuted = permute(view.lanes, keys);
        const laneSteps = yield* planLanes(permuted, rankChain(permuted));
        const plan = LanePlanProposal.make({
          episodeId: goldenEpisodeId,
          planId: `lane-plan-${pinnedHandoffSha256}`,
          handoffPath: fixtureHandoffPath,
          handoffSha256: Sha256Hex.make(pinnedHandoffSha256),
          orderRule: view.orderRule,
          scope: view.scope,
          laneSteps,
        });
        const document = yield* emitLanePlan(plan);
        expect(document.content).toBe(yield* fs.readFileString(lanePlanGoldenPath));
      }),
    { arbitrary: fcRuns(32) }
  );

  it.effect("rejects a schedule- plan id and a misplaced lane step index at make", () =>
    Effect.gen(function* () {
      const handoffSha256 = Sha256Hex.make(pinnedHandoffSha256);
      const fields = {
        episodeId: goldenEpisodeId,
        planId: `lane-plan-${handoffSha256}`,
        handoffPath: pinnedHandoffPath,
        handoffSha256,
        orderRule: LaneOrderRule.Enum["gate-order-lexicographic/v1"],
        scope: LaneScope.Enum["pre-push:non-main"],
        laneSteps: [LaneStep.make({ laneStepIndex: S.Natural.make(0), laneId: "quality:secrets" })],
      };
      expect(LanePlanProposal.make(fields).planId).toBe(`lane-plan-${handoffSha256}`);
      expect(() => LanePlanProposal.make({ ...fields, planId: `schedule-${handoffSha256}` })).toThrow(
        "Schema validation failed"
      );
      const scheduleId = yield* Effect.flip(
        LanePlanProposal.makeEffect({ ...fields, planId: `schedule-${handoffSha256}` })
      );
      expect(new S.SchemaError(scheduleId).message).toContain(
        "Lane plan ids must be lane-plan- followed by the handoff SHA-256"
      );
      const misplaced = yield* Effect.flip(
        LanePlanProposal.makeEffect({
          ...fields,
          laneSteps: [LaneStep.make({ laneStepIndex: S.Natural.make(1), laneId: "quality:secrets" })],
        })
      );
      expect(new S.SchemaError(misplaced).message).toContain("Lane step indexes must equal their 0-based positions");
    })
  );

  it.effect("maps a subset-decode failure to HandoffDecodeError naming the path", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(decodeHandoffSubset(pinnedHandoffPath, handoffJson({ lanes: [] })));
      assertInstanceOf(failure, HandoffDecodeError);
      expect(failure.path).toBe(pinnedHandoffPath);
      expect(Str.includes('at ["lanes"]')(failure.message)).toBe(true);
    })
  );

  it.effect("keeps the admission golden byte-equal and its episode node disjoint from a lane plan's", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const admission = yield* emitScheduleAbox(admissionGoldenProposal);
      expect(admission.content).toBe(yield* fs.readFileString(admissionGoldenPath));

      const lanePlan = yield* fs.readFileString(lanePlanGoldenPath);
      const admissionEpisodes = episodeNodes(admission.content);
      const laneEpisodes = episodeNodes(lanePlan);
      expect(HashSet.size(admissionEpisodes)).toBe(1);
      expect(HashSet.size(laneEpisodes)).toBe(1);
      expect(HashSet.size(HashSet.intersection(admissionEpisodes, laneEpisodes))).toBe(0);
    })
  );

  it.effect("emits only the provisional lane-plan vocabulary and the consecutive precedence chain", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const view = yield* readFixtureView();
      const golden = yield* fs.readFileString(lanePlanGoldenPath);
      expect(A.filter(forbiddenLanePlanTerms, (term) => Str.includes(term)(golden))).toStrictEqual([]);
      // No ratified `ciops:` term is used; only the prefix declaration names the namespace.
      expect(/(^|\s)ciops:\w/.test(golden)).toBe(false);
      const count = (term: string) => A.length(A.filter(Str.split(golden, "\n"), Str.includes(` ciops-prov:${term} `)));
      expect(count("hasLaneStep")).toBe(view.lanes.length);
      expect(count("laneStepIndex")).toBe(view.lanes.length);
      expect(count("laneIdRef")).toBe(view.lanes.length);
      expect(count("precedesLaneStep")).toBe(view.lanes.length - 1);
      expect(count("hasLanePlan")).toBe(1);
      expect(count("hasLanePlanSpecification")).toBe(1);
      expect(Str.includes(`ciops-prov:handoffDigest "${pinnedHandoffSha256}"^^xsd:string .`)(golden)).toBe(true);
      expect(Str.includes('ciops-prov:laneOrderRule "gate-order-lexicographic/v1"^^xsd:string .')(golden)).toBe(true);
    })
  );

  it.layer(CiOpsProjectionLive, { timeout: "10 seconds" })((it) => {
    it.effect("plans the pinned fixture end to end through the service and reproduces the golden", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const service: CiOpsProjectionShape = yield* CiOpsProjection;
        const view = yield* readFixtureView();
        const plan = yield* service.planEpisode(fixtureInput(pinnedHandoffSha256));

        expect(plan.planId).toBe(`lane-plan-${pinnedHandoffSha256}`);
        expect(plan.handoffPath).toBe(fixtureHandoffPath);
        expect(A.map(plan.laneSteps, (step) => step.laneId)).toStrictEqual(rankedLaneIds(view.lanes));
        const document = yield* service.emitLanePlan(plan);
        expect(document.content).toBe(yield* fs.readFileString(lanePlanGoldenPath));
      })
    );

    it.effect("fails typed on an unreadable handoff, a digest mismatch, and undecodable pinned bytes", () =>
      Effect.gen(function* () {
        const service: CiOpsProjectionShape = yield* CiOpsProjection;
        const missingPath = "test/fixtures/missing-gate-order-handoff.json";
        const unread = yield* Effect.flip(service.planEpisode(fixtureInput(pinnedHandoffSha256, missingPath)));
        assertInstanceOf(unread, HandoffReadError);
        expect(unread.path).toBe(missingPath);

        const emptySha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        const drifted = yield* Effect.flip(service.planEpisode(fixtureInput(emptySha256)));
        assertInstanceOf(drifted, HandoffDigestMismatchError);
        expect([drifted.path, drifted.expectedSha256, drifted.actualSha256]).toStrictEqual([
          fixtureHandoffPath,
          emptySha256,
          pinnedHandoffSha256,
        ]);

        const turtle = yield* readHandoff(admissionGoldenPath);
        const undecodable = yield* Effect.flip(service.planEpisode(fixtureInput(turtle.sha256, admissionGoldenPath)));
        assertInstanceOf(undecodable, HandoffDecodeError);
        expect(undecodable.path).toBe(admissionGoldenPath);

        // Undecodable bytes under a wrong pin: the digest is compared before any decode, so this is a mismatch.
        const digestFirst = yield* Effect.flip(
          service.planEpisode(fixtureInput(pinnedHandoffSha256, admissionGoldenPath))
        );
        assertInstanceOf(digestFirst, HandoffDigestMismatchError);
        expect([digestFirst.expectedSha256, digestFirst.actualSha256]).toStrictEqual([
          pinnedHandoffSha256,
          turtle.sha256,
        ]);
      })
    );
  });

  it.layer(FailingDigestProjectionLive, { timeout: "10 seconds" })((it) => {
    it.effect("fails a platform digest failure typed as HandoffReadError, never a defect", () =>
      Effect.gen(function* () {
        const service: CiOpsProjectionShape = yield* CiOpsProjection;
        const failure = yield* Effect.flip(service.planEpisode(fixtureInput(pinnedHandoffSha256)));
        assertInstanceOf(failure, HandoffReadError);
        expect(failure.path).toBe(fixtureHandoffPath);
        expect(Str.includes("SHA-256 digest failed")(failure.message)).toBe(true);
      })
    );
  });
});
