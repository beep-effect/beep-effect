import {
  GoalAcceptanceEvidenceRef,
  GoalCompletionGate,
  GoalCompletionObservation,
  GoalCompletionReceipt,
  GoalCompletionVerifier,
  GoalEvidenceCheck,
  GoalManifest,
  GoalMergeMethod,
  GoalMergeResult,
  GoalPullRequestRef,
  goalPullRequestRefs,
} from "@beep/repo-cli/test/Goals";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const time = DateTime.makeUnsafe("2026-10-06T00:55:25Z");
const gate = GoalCompletionGate.make({
  operator: "yeet",
  requiresPullRequest: true,
  requiresMergeable: true,
  statement: "Ship via yeet",
  grandfathered: false,
});
const ref = GoalAcceptanceEvidenceRef.make({ kind: "hosted-required-checks", ref: "required", gating: true });
const fixture = () =>
  GoalCompletionObservation.make({
    repository: "example/repo",
    packet: "unmentioned-packet",
    declarationDigest: "declaration",
    acceptedDeclarationDigest: O.some("accepted-declaration"),
    finalPullRequest: 1429,
    acceptedHead: O.some("accepted-head"),
    merged: O.some(true),
    grandfathered: false,
    merge: O.some(
      GoalMergeResult.make({
        mergeCommit: "squash-result-not-descended-from-head",
        tree: "merge-tree",
        mergedAt: time,
        method: O.some("squash"),
        baseRef: "main",
      })
    ),
    evidence: [
      GoalEvidenceCheck.make({
        ref,
        outcome: "verified",
        observedHead: O.some("accepted-head"),
        detail: "Green required lanes at accepted head",
      }),
    ],
    nonRequiredReds: [],
    subClaims: [],
    verifiedAt: time,
  });

describe("goal completion declaration", () => {
  it.effect.prop(
    "normalizes arbitrary explicit PR declarations without changing their roles",
    [Arbitrary.schema(GoalPullRequestRef)],
    Effect.fnUntraced(function* ([reference]) {
      const manifest = yield* S.decodeEffect(GoalManifest)({
        initiative: { id: "typed", status: "completed-retained" },
        completionGate: { ...gate, pullRequests: [reference] },
      });
      expect(goalPullRequestRefs(manifest)).toEqual([reference]);
    }),
    { arbitrary: { runs: 32 } }
  );
  it.effect("leaves packets without PR declarations on the legacy citation path", () =>
    Effect.gen(function* () {
      const manifest = yield* S.decodeEffect(GoalManifest)({
        initiative: { id: "legacy", status: "completed-retained" },
        completionGate: gate,
      });
      expect(goalPullRequestRefs(manifest)).toEqual([]);
    })
  );
  it.effect("normalizes a singular PR with no plural list", () =>
    Effect.gen(function* () {
      const manifest = yield* S.decodeEffect(GoalManifest)({
        initiative: { id: "legacy", status: "completed-retained" },
        completionGate: gate,
        mergedPullRequest: 8,
      });
      expect(goalPullRequestRefs(manifest)).toEqual([{ number: 8, role: "final" }]);
    })
  );
  it.effect("normalizes singular and plural legacy PRs in memory", () =>
    Effect.gen(function* () {
      const manifest = yield* S.decodeEffect(GoalManifest)({
        initiative: { id: "legacy", status: "completed-retained" },
        completionGate: gate,
        mergedPullRequest: 168,
        mergedPullRequests: [167, 168],
      });
      expect(goalPullRequestRefs(manifest)).toEqual([
        { number: 168, role: "final" },
        { number: 167, role: "supporting" },
      ]);
      expect(manifest.completionGate.pullRequests).toBeUndefined();
    })
  );
  it.effect("uses the last plural PR as final without a singular reference", () =>
    Effect.gen(function* () {
      const manifest = yield* S.decodeEffect(GoalManifest)({
        initiative: { id: "legacy", status: "completed-retained" },
        completionGate: gate,
        mergedPullRequests: [167, 168],
      });
      expect(goalPullRequestRefs(manifest)).toEqual([
        { number: 168, role: "final" },
        { number: 167, role: "supporting" },
      ]);
    })
  );
  it.effect("rejects multiple final PRs", () =>
    Effect.gen(function* () {
      const exit = yield* S.decodeEffect(GoalCompletionGate)({
        ...gate,
        pullRequests: [
          { number: 1, role: "final" },
          { number: 2, role: "final" },
        ],
      }).pipe(Effect.exit);
      expect(exit._tag).toBe("Failure");
    })
  );
  it.effect("explicit supporting-only references do not invent a final PR", () =>
    Effect.gen(function* () {
      const manifest = yield* S.decodeEffect(GoalManifest)({
        initiative: { id: "typed", status: "completed-retained" },
        completionGate: { ...gate, pullRequests: [{ number: 7, role: "supporting" }] },
        mergedPullRequest: 8,
      });
      expect(goalPullRequestRefs(manifest)).toEqual([{ number: 7, role: "supporting" }]);
    })
  );
});

describe("pure goal completion resolver", () => {
  it.effect("round-trips the persisted JSON boundary including optional head and merge facts", () =>
    Effect.gen(function* () {
      const receipt = yield* GoalCompletionVerifier.resolve(fixture());
      const text = yield* S.encodeEffect(S.fromJsonString(GoalCompletionReceipt))(receipt);
      const decoded = yield* S.decodeEffect(S.fromJsonString(GoalCompletionReceipt))(text);
      expect(decoded.outcome).toBe("verified");
      assertSome(decoded.acceptedHead, "accepted-head");
      assertSome(
        O.map(decoded.merge, (merge) => merge.method),
        O.some("squash")
      );
    })
  );

  it.effect("verifies a merged PR with no packet-name commit and a non-ancestor squash head", () =>
    Effect.gen(function* () {
      const receipt = yield* GoalCompletionVerifier.resolve(fixture());
      expect(receipt.outcome).toBe("verified");
      assertSome(
        O.map(receipt.merge, (merge) => merge.method),
        O.some("squash")
      );
    })
  );
  for (const method of GoalMergeMethod.literals) {
    it.effect(`verifies GitHub-bound ${method} results`, () =>
      Effect.gen(function* () {
        const observation = fixture();
        const merge = O.getOrThrow(observation.merge);
        const parsed = GoalMergeResult.make({ ...merge, method: O.some(method) });
        expect(
          (yield* GoalCompletionVerifier.resolve(
            GoalCompletionObservation.make({ ...observation, merge: O.some(parsed) })
          )).outcome
        ).toBe("verified");
      })
    );
  }
  it.effect("unmerged or closed PR gives positive unsatisfaction", () =>
    Effect.gen(function* () {
      expect(
        (yield* GoalCompletionVerifier.resolve(
          GoalCompletionObservation.make({ ...fixture(), merged: O.some(false), merge: O.none() })
        )).outcome
      ).toBe("unsatisfied");
    })
  );
  it.effect("network failure and rate limit give unknown", () =>
    Effect.gen(function* () {
      expect(
        (yield* GoalCompletionVerifier.resolve(
          GoalCompletionObservation.make({ ...fixture(), merged: O.none(), merge: O.none(), evidence: [] })
        )).outcome
      ).toBe("unknown");
    })
  );
  it.effect("stale-head evidence cannot satisfy completion", () =>
    Effect.gen(function* () {
      const evidence = GoalEvidenceCheck.make({
        ref,
        outcome: "verified",
        observedHead: O.some("old-head"),
        detail: "Stale",
      });
      expect(
        (yield* GoalCompletionVerifier.resolve(GoalCompletionObservation.make({ ...fixture(), evidence: [evidence] })))
          .outcome
      ).toBe("unsatisfied");
    })
  );
  it.effect("red required checks are unsatisfied", () =>
    Effect.gen(function* () {
      const evidence = GoalEvidenceCheck.make({
        ref,
        outcome: "unsatisfied",
        observedHead: O.some("accepted-head"),
        detail: "Red required context",
      });
      expect(
        (yield* GoalCompletionVerifier.resolve(GoalCompletionObservation.make({ ...fixture(), evidence: [evidence] })))
          .outcome
      ).toBe("unsatisfied");
    })
  );
  it.effect("missing evidence is unknown", () =>
    Effect.gen(function* () {
      const evidence = GoalEvidenceCheck.make({ ref, outcome: "unknown", observedHead: O.none(), detail: "Missing" });
      expect(
        (yield* GoalCompletionVerifier.resolve(GoalCompletionObservation.make({ ...fixture(), evidence: [evidence] })))
          .outcome
      ).toBe("unknown");
    })
  );
  it.effect("grandfathered packets short-circuit unavailable observations", () =>
    Effect.gen(function* () {
      expect(
        (yield* GoalCompletionVerifier.resolve(
          GoalCompletionObservation.make({
            ...fixture(),
            grandfathered: true,
            merged: O.none(),
            merge: O.none(),
            evidence: [],
          })
        )).outcome
      ).toBe("verified");
    })
  );
  it.effect("non-gating historical window failure does not reset completion", () =>
    Effect.gen(function* () {
      const check = GoalEvidenceCheck.make({
        ref: GoalAcceptanceEvidenceRef.make({ kind: "packet-history", ref: "window", gating: false }),
        outcome: "unsatisfied",
        observedHead: O.some("accepted-head"),
        detail: "Seven seconds",
      });
      expect(
        (yield* GoalCompletionVerifier.resolve(GoalCompletionObservation.make({ ...fixture(), subClaims: [check] })))
          .outcome
      ).toBe("verified");
    })
  );
});
