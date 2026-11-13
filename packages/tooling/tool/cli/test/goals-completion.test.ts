import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  canonicalJsonText,
  compileCapabilityProjection,
  GOAL_CLOSEOUT_WINDOW_DAYS,
  GoalAcceptanceEvidenceKind,
  GoalAcceptanceEvidenceRef,
  GoalAttributedRedCause,
  GoalAttributedRedFact,
  GoalAttributedRedObservation,
  GoalAttributionConflict,
  GoalClaimSet,
  GoalClaimSource,
  GoalCloseoutRecord,
  GoalCommittedClaimSource,
  GoalCompletionClaims,
  GoalCompletionEvidenceVerdict,
  GoalCompletionEvidenceVerified,
  GoalCompletionGate,
  GoalCompletionIo,
  GoalCompletionObservation,
  GoalCompletionReceipt,
  GoalCompletionReceiptStore,
  GoalCompletionReceiptVersion,
  GoalCompletionVerifier,
  GoalEvidenceCheck,
  GoalHostedEvidenceKind,
  GoalManifest,
  GoalMergeMethod,
  GoalMergeResult,
  GoalMergeTimeInventory,
  GoalMergeTimeRuleSource,
  GoalMergeTimeRuleSourceRecord,
  GoalOperatorRulingClaim,
  GoalPullRequestRef,
  GoalRedAttributionClaim,
  GoalRequiredCheckFact,
  GoalRequiredCheckSnapshot,
  GoalReviewThreadTally,
  goalCloseoutView,
  goalCompletionDeclarationDigest,
  goalCompletionUnknownReasons,
  goalCompletionVerdict,
  goalFinalWithinCloseoutWindow,
  goalPullRequestRefs,
  layerGoalCompletionReceiptStoreMemory,
  readGoalCloseoutViews,
  renderGoalCloseoutRecord,
  renderGoalCloseoutRecordView,
  renderGoalCloseoutView,
  sha256Hex,
} from "@beep/repo-cli/test/Goals";
import { it } from "@beep/test-runner";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import * as TestClock from "effect/testing/TestClock";
import { completionIoFixture } from "./support/CompletionIo.ts";

const decodeGoalCompletionGate = S.decodeEffect(GoalCompletionGate);
const decodeGoalManifest = S.decodeEffect(GoalManifest);
const decodeGoalRequiredCheckSnapshot = S.decodeEffect(GoalRequiredCheckSnapshot);
const decodeGoalCompletionReceiptJson = S.decodeEffect(S.fromJsonString(GoalCompletionReceipt));
const encodeGoalCompletionReceiptJson = S.encodeEffect(S.fromJsonString(GoalCompletionReceipt));
const encodeGoalManifestJson = S.encodeEffect(S.fromJsonString(GoalManifest));
const encodeUnknownJson = S.encodeEffect(S.fromJsonString(S.Unknown));

const time = DateTime.makeUnsafe("2026-10-06T00:55:25Z");
const gate = GoalCompletionGate.make({
  operator: "yeet",
  requiresPullRequest: true,
  requiresMergeable: true,
  statement: "Ship via yeet",
  grandfathered: false,
});
const ref = GoalAcceptanceEvidenceRef.make({ kind: "hosted-required-checks", ref: "required", gating: true });
const threadsRef = GoalAcceptanceEvidenceRef.make({ kind: "hosted-review-threads", ref: "outstanding", gating: true });
const MERGE_COMMIT = "squash-result-not-descended-from-head";
// A complete merge-time inventory: GitHub's merge-push rule suite, bound to the
// merge commit, with a recovered history version for its one required-check ruleset.
const completeInventory = GoalMergeTimeInventory.make({
  source: "repos/{owner}/{repo}/rulesets/rule-suites/1",
  ruleSuiteId: 1,
  ref: "refs/heads/main",
  afterSha: MERGE_COMMIT,
  pushedAt: time,
  result: "pass",
  ruleSources: [
    GoalMergeTimeRuleSource.make({
      sourceType: "ruleset",
      rulesetId: O.some(42),
      name: O.some("main"),
      enforcement: "active",
      requiredStatusChecks: O.some("pass"),
      survives: true,
      version: O.some("repos/{owner}/{repo}/rulesets/42/history/1"),
    }),
  ],
});
const lintFact = GoalRequiredCheckFact.make({
  context: "Lint",
  head: "accepted-head",
  checkRunId: O.some(1),
  conclusion: "success",
  outcome: "verified",
  source: "check-run",
});
const fixture = () =>
  GoalCompletionObservation.make({
    repository: "example/repo",
    packet: "unmentioned-packet",
    declarationDigest: "declaration",
    acceptedDeclarationDigest: O.some("accepted-declaration"),
    requiredChecks: O.some(
      GoalRequiredCheckSnapshot.make({
        contexts: ["Lint"],
        sources: ["repos/{owner}/{repo}/rulesets/42/history/1"],
        effectiveAt: time,
        inventoryComplete: true,
        mergeTimeInventory: O.some(completeInventory),
      })
    ),
    requiredCheckFacts: [lintFact],
    finalPullRequest: 1429,
    acceptedHead: O.some("accepted-head"),
    merged: O.some(true),
    grandfathered: false,
    merge: O.some(
      GoalMergeResult.make({
        mergeCommit: MERGE_COMMIT,
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
      GoalEvidenceCheck.make({
        ref: threadsRef,
        outcome: "verified",
        observedHead: O.some("accepted-head"),
        detail: "No outstanding review thread (0 read when refresh ran).",
      }),
    ],
    reviewThreads: O.some(GoalReviewThreadTally.make({ total: 0, outstanding: 0 })),
    nonRequiredReds: [],
    subClaims: [],
    verifiedAt: time,
  });

describe("goal completion declaration", () => {
  it.effect.prop(
    "normalizes arbitrary explicit PR declarations without changing their roles",
    [Arbitrary.schema(GoalPullRequestRef)],
    Effect.fnUntraced(function* ([reference]) {
      const manifest = yield* decodeGoalManifest({
        initiative: { id: "typed", status: "completed-retained" },
        completionGate: { ...gate, pullRequests: [reference] },
      });
      expect(goalPullRequestRefs(manifest)).toEqual([reference]);
    }),
    { arbitrary: { runs: 32 } }
  );
  it.effect("leaves packets without PR declarations on the legacy citation path", () =>
    Effect.gen(function* () {
      const manifest = yield* decodeGoalManifest({
        initiative: { id: "legacy", status: "completed-retained" },
        completionGate: gate,
      });
      expect(goalPullRequestRefs(manifest)).toEqual([]);
    })
  );
  it.effect("normalizes a singular PR with no plural list", () =>
    Effect.gen(function* () {
      const manifest = yield* decodeGoalManifest({
        initiative: { id: "legacy", status: "completed-retained" },
        completionGate: gate,
        mergedPullRequest: 8,
      });
      expect(goalPullRequestRefs(manifest)).toEqual([{ number: 8, role: "final" }]);
    })
  );
  it.effect("normalizes singular and plural legacy PRs in memory", () =>
    Effect.gen(function* () {
      const manifest = yield* decodeGoalManifest({
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
      const manifest = yield* decodeGoalManifest({
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
      const exit = yield* decodeGoalCompletionGate({
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
      const manifest = yield* decodeGoalManifest({
        initiative: { id: "typed", status: "completed-retained" },
        completionGate: { ...gate, pullRequests: [{ number: 7, role: "supporting" }] },
        mergedPullRequest: 8,
      });
      expect(goalPullRequestRefs(manifest)).toEqual([{ number: 7, role: "supporting" }]);
    })
  );
});

describe("hosted completion schema contracts", () => {
  const claim = GoalRedAttributionClaim.make({
    context: "Lint",
    attribution: "inherited",
    fixPullRequest: 2994,
    decisionFile: "goals/unmentioned-packet/decisions/2026-11-14-final-merged-over-lint.md",
    source: "origin-main",
  });
  const decodeVerdict = S.decodeUnknownEffect(GoalCompletionEvidenceVerdict);
  const decodeFact = S.decodeUnknownEffect(GoalAttributedRedFact);
  const decodeTally = S.decodeUnknownEffect(GoalReviewThreadTally);
  const decodeReceipt = S.decodeUnknownEffect(GoalCompletionReceipt);
  const encodeReceipt = S.encodeEffect(GoalCompletionReceipt);

  it.effect("gates only on the two hosted evidence kinds", () =>
    Effect.sync(() => {
      expect(GoalAcceptanceEvidenceKind.literals).toContain("hosted-review-threads");
      expect(GoalHostedEvidenceKind.literals).toEqual(["hosted-required-checks", "hosted-review-threads"]);
      const isHosted = S.is(GoalHostedEvidenceKind);
      expect(A.filter(GoalAcceptanceEvidenceKind.literals, isHosted)).toEqual([
        "hosted-required-checks",
        "hosted-review-threads",
      ]);
      expect(
        GoalAcceptanceEvidenceRef.make({ kind: "hosted-review-threads", ref: "outstanding", gating: true }).kind
      ).toBe("hosted-review-threads");
    })
  );

  it.effect("names only committed sources and attributable causes", () =>
    Effect.sync(() => {
      expect(GoalClaimSource.literals).toEqual(["origin-main", "head", "working-tree"]);
      expect(A.filter(GoalClaimSource.literals, S.is(GoalCommittedClaimSource))).toEqual(["origin-main", "head"]);
      expect(A.filter(["inherited", "introduced", "mixed", "unknown"], S.is(GoalAttributedRedCause))).toEqual([
        "inherited",
        "introduced",
        "mixed",
      ]);
      expect(GoalAttributedRedObservation.literals).toEqual(["red", "missing"]);
    })
  );

  it.effect("defaults the claim sets to empty", () =>
    Effect.sync(() => {
      const empty = GoalCompletionClaims.make({});
      expect(empty.committed).toEqual(GoalClaimSet.make({}));
      expect(empty.preview).toEqual(GoalClaimSet.make({}));
      expect(empty.committed.redAttributions).toEqual([]);
      expect(empty.committed.operatorRulings).toEqual([]);
      expect(empty.committed.conflicts).toEqual([]);
      const ruling = GoalOperatorRulingClaim.make({
        finalPullRequest: 2080,
        decisionFile: "goals/unmentioned-packet/decisions/2026-11-14-operator-closes-2080.md",
        source: "head",
      });
      const conflict = GoalAttributionConflict.make({
        context: "Lint",
        decisionFiles: ["goals/a/decisions/2026-11-14-a.md", "goals/a/decisions/2026-11-14-b.md"],
      });
      const committed = GoalClaimSet.make({
        redAttributions: [claim],
        operatorRulings: [ruling],
        conflicts: [conflict],
      });
      const claims = GoalCompletionClaims.make({ committed });
      expect(claims.committed.redAttributions).toEqual([claim]);
      expect(claims.preview.operatorRulings).toEqual([]);
    })
  );

  it.effect("a verified verdict defaults to no attributed reds and no bypass on make and decode", () =>
    Effect.gen(function* () {
      const made = GoalCompletionEvidenceVerified.make({ facts: [lintFact] });
      expect(made.attributedReds).toEqual([]);
      expect(made.ruleSuiteBypassed).toBe(false);
      const decoded = yield* decodeVerdict({
        _tag: "verified",
        facts: [{ ...lintFact, checkRunId: 1 }],
      });
      expect(GoalCompletionEvidenceVerdict.guards.verified(decoded)).toBe(true);
      if (GoalCompletionEvidenceVerdict.guards.verified(decoded)) {
        expect(decoded.attributedReds).toEqual([]);
        expect(decoded.ruleSuiteBypassed).toBe(false);
      }
      const red = GoalAttributedRedFact.make({
        context: "Lint",
        checkRunId: O.some(7),
        conclusion: "cancelled",
        observed: "red",
        attribution: claim.attribution,
        fixPullRequest: claim.fixPullRequest,
        decisionFile: claim.decisionFile,
        source: claim.source,
      });
      const bypassed = GoalCompletionEvidenceVerified.make({
        facts: [lintFact],
        attributedReds: [red],
        ruleSuiteBypassed: true,
      });
      expect(bypassed.attributedReds).toEqual([red]);
      expect(bypassed.ruleSuiteBypassed).toBe(true);
    })
  );

  it.effect("an attributed red has a run exactly when it was observed red", () =>
    Effect.gen(function* () {
      const base = {
        context: "Lint",
        conclusion: "unknown",
        attribution: "introduced",
        fixPullRequest: 3107,
        decisionFile: claim.decisionFile,
        source: "head",
      };
      const missing = yield* decodeFact({ ...base, checkRunId: null, observed: "missing" });
      assertNone(missing.checkRunId);
      const red = yield* decodeFact({ ...base, checkRunId: 9, conclusion: "failure", observed: "red" });
      assertSome(red.checkRunId, 9);
      for (const candidate of [
        { ...base, checkRunId: 9, observed: "missing" },
        { ...base, checkRunId: null, observed: "red" },
        { ...base, checkRunId: null, observed: "missing", attribution: "unknown" },
        { ...base, checkRunId: null, observed: "missing", fixPullRequest: 0 },
      ]) {
        expect((yield* decodeFact(candidate).pipe(Effect.exit))._tag).toBe("Failure");
      }
    })
  );

  it.effect("a review-thread tally never counts more outstanding threads than it read", () =>
    Effect.gen(function* () {
      const clean = yield* decodeTally({ total: 0, outstanding: 0 });
      expect(clean).toEqual(GoalReviewThreadTally.make({ total: 0, outstanding: 0 }));
      expect((yield* decodeTally({ total: 4, outstanding: 1 })).outstanding).toBe(1);
      for (const candidate of [
        { total: 1, outstanding: 2 },
        { total: -1, outstanding: 0 },
        { total: 2, outstanding: 0.5 },
      ]) {
        expect((yield* decodeTally(candidate).pipe(Effect.exit))._tag).toBe("Failure");
      }
    })
  );

  it.effect("decodes stored v1 rows and round-trips v2 rows with their hosted facts", () =>
    Effect.gen(function* () {
      const resolved = yield* GoalCompletionVerifier.resolve(fixture());
      const { schemaVersion: _version, ...unversioned } = resolved;
      expect(GoalCompletionReceipt.make(unversioned).schemaVersion).toBe("goal-completion-receipt/v2");
      expect(GoalCompletionReceiptVersion.literals).toEqual([
        "goal-completion-receipt/v1",
        "goal-completion-receipt/v2",
      ]);

      // A v1 row stored before the hosted-only keys existed.
      const encoded = yield* encodeReceipt(
        GoalCompletionReceipt.make({ ...resolved, schemaVersion: "goal-completion-receipt/v1" })
      );
      const { merged: _merged, reviewThreads: _threads, redAttributions: _claims, ...v1Row } = encoded;
      expect(Struct.keys(v1Row)).not.toContain("redAttributions");
      const v1 = yield* decodeReceipt(v1Row);
      expect(v1.schemaVersion).toBe("goal-completion-receipt/v1");
      assertNone(v1.merged);
      assertNone(v1.reviewThreads);
      expect(v1.redAttributions).toEqual([]);
      expect(v1.outcome).toBe(resolved.outcome);

      const tally = GoalReviewThreadTally.make({ total: 2, outstanding: 0 });
      const v2 = GoalCompletionReceipt.make({
        ...resolved,
        schemaVersion: "goal-completion-receipt/v2",
        merged: O.some(true),
        reviewThreads: O.some(tally),
        redAttributions: [claim],
      });
      const text = yield* encodeGoalCompletionReceiptJson(v2);
      const decoded = yield* decodeGoalCompletionReceiptJson(text);
      expect(decoded.schemaVersion).toBe("goal-completion-receipt/v2");
      assertSome(decoded.merged, true);
      assertSome(decoded.reviewThreads, tally);
      expect(decoded.redAttributions).toEqual([claim]);

      const unknownVersion = yield* decodeReceipt({ ...v1Row, schemaVersion: "goal-completion-receipt/v3" }).pipe(
        Effect.exit
      );
      expect(unknownVersion._tag).toBe("Failure");
    })
  );
});

describe("pure goal completion resolver", () => {
  it.effect("a legacy receipt row with a recovered version and no history resolves as gating, like a fresh one", () =>
    Effect.gen(function* () {
      const observation = fixture();
      const snapshot = O.getOrThrow(observation.requiredChecks);
      const deleted = GoalMergeTimeRuleSource.make({
        sourceType: "ruleset",
        rulesetId: O.some(999),
        name: O.none(),
        enforcement: "deleted ruleset",
        requiredStatusChecks: O.some("fail"),
        survives: false,
        version: O.some("repos/{owner}/{repo}/rulesets/999/history/1"),
        history: "gating",
      });
      const receipt = yield* GoalCompletionVerifier.resolve(
        GoalCompletionObservation.make({
          ...observation,
          requiredChecks: O.some(
            GoalRequiredCheckSnapshot.make({
              ...snapshot,
              mergeTimeInventory: O.some(
                GoalMergeTimeInventory.make({
                  ...completeInventory,
                  ruleSources: [...completeInventory.ruleSources, deleted],
                })
              ),
            })
          ),
        })
      );
      // Every required context is green, so the deleted ruleset's failed
      // evaluation is a bypass merge, recorded on the verdict but not a red.
      expect(receipt.outcome).toBe("verified");
      const fresh = goalCompletionVerdict(receipt);
      expect(fresh._tag === "verified" && fresh.ruleSuiteBypassed).toBe(true);
      // Rewrite the stored JSON into the shape written before `history` existed.
      const argument = Str.replace(/,"history":"(gating|unread)"/gu, "");
      const encodedGoalCompletionReceiptJson = yield* encodeGoalCompletionReceiptJson(receipt);
      const legacyText = argument(encodedGoalCompletionReceiptJson);
      expect(Str.includes('"history"')(legacyText)).toBe(false);
      const legacy = yield* decodeGoalCompletionReceiptJson(legacyText);
      const sources = O.getOrThrow(O.flatMap(legacy.requiredChecks, (value) => value.mergeTimeInventory)).ruleSources;
      expect(A.map(sources, (source) => source.history)).toEqual(["gating", "gating"]);
      const reresolved = yield* GoalCompletionVerifier.resolve(
        GoalCompletionObservation.make({ ...legacy, merged: O.some(true), grandfathered: false })
      );
      // Fail closed: the legacy row's version decodes as gating, so it resolves
      // exactly as the fresh row does, bypass included.
      expect(reresolved.outcome).toBe(receipt.outcome);
      expect(goalCompletionVerdict(reresolved)).toEqual(fresh);
      const unversioned = yield* S.decodeEffect(GoalMergeTimeRuleSourceRecord)({
        sourceType: "ruleset",
        rulesetId: 999,
        name: null,
        enforcement: "deleted ruleset",
        requiredStatusChecks: "fail",
        survives: false,
        version: null,
      });
      expect(unversioned.history).toBe("unread");
    })
  );
  it.effect("requires complete historical inventory despite green surviving contexts", () =>
    Effect.gen(function* () {
      const observation = fixture();
      expect(
        (yield* GoalCompletionVerifier.resolve(
          GoalCompletionObservation.make({
            ...observation,
            requiredChecks: O.none(),
          })
        )).outcome
      ).toBe("unknown");
      const snapshot = GoalRequiredCheckSnapshot.make({
        contexts: ["Lint"],
        sources: ["surviving-ruleset/history/1"],
        effectiveAt: time,
        inventoryComplete: false,
      });
      expect(
        (yield* GoalCompletionVerifier.resolve(
          GoalCompletionObservation.make({
            ...observation,
            requiredChecks: O.some(snapshot),
          })
        )).outcome
      ).toBe("unknown");
      // The completeness flag alone never verifies: the stored rule suite must prove it.
      expect(
        (yield* GoalCompletionVerifier.resolve(
          GoalCompletionObservation.make({
            ...observation,
            requiredChecks: O.some(GoalRequiredCheckSnapshot.make({ ...snapshot, inventoryComplete: true })),
          })
        )).outcome
      ).toBe("unknown");
      expect(
        (yield* GoalCompletionVerifier.resolve(
          GoalCompletionObservation.make({
            ...observation,
            requiredChecks: O.some(
              GoalRequiredCheckSnapshot.make({
                ...snapshot,
                inventoryComplete: true,
                mergeTimeInventory: O.some(completeInventory),
              })
            ),
          })
        )).outcome
      ).toBe("verified");
      const legacy = yield* decodeGoalRequiredCheckSnapshot({
        contexts: ["Lint"],
        sources: ["surviving-ruleset/history/1"],
        effectiveAt: "2026-10-06T00:55:25Z",
      });
      expect(legacy.inventoryComplete).toBe(false);
      expect(legacy.rulesetReadsComplete).toBe(true);
      expect(
        (yield* GoalCompletionVerifier.resolve(
          GoalCompletionObservation.make({
            ...observation,
            requiredChecks: O.some(
              GoalRequiredCheckSnapshot.make({ ...snapshot, inventoryComplete: true, rulesetReadsComplete: false })
            ),
          })
        )).outcome
      ).toBe("unknown");
    })
  );
  it.effect("round-trips the persisted JSON boundary including optional head and merge facts", () =>
    Effect.gen(function* () {
      const receipt = yield* GoalCompletionVerifier.resolve(fixture());
      const text = yield* encodeGoalCompletionReceiptJson(receipt);
      const decoded = yield* decodeGoalCompletionReceiptJson(text);
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
  it.effect("verifies only with both hosted kinds and names the one that is missing", () =>
    Effect.gen(function* () {
      const observation = fixture();
      for (const missing of GoalHostedEvidenceKind.literals) {
        const partial = GoalCompletionObservation.make({
          ...observation,
          evidence: A.filter(observation.evidence, (check) => check.ref.kind !== missing),
        });
        expect((yield* GoalCompletionVerifier.resolve(partial)).outcome).toBe("unknown");
        expect(goalCompletionUnknownReasons(partial)).toContain(`no ${missing} evidence`);
      }
      expect(goalCompletionUnknownReasons(observation)).toEqual([]);
    })
  );
  it.effect("an outstanding review thread is unsatisfied and an unread one is unknown", () =>
    Effect.gen(function* () {
      const observation = fixture();
      const withThreads = (outcome: "unsatisfied" | "unknown", detail: string) =>
        GoalCompletionObservation.make({
          ...observation,
          evidence: [
            ...A.filter(observation.evidence, (check) => check.ref.kind !== "hosted-review-threads"),
            GoalEvidenceCheck.make({ ref: threadsRef, outcome, observedHead: O.some("accepted-head"), detail }),
          ],
        });
      const outstanding = withThreads("unsatisfied", "1 of 2 review threads outstanding when refresh ran.");
      expect((yield* GoalCompletionVerifier.resolve(outstanding)).outcome).toBe("unsatisfied");
      const unread = withThreads("unknown", "review threads unreadable");
      expect((yield* GoalCompletionVerifier.resolve(unread)).outcome).toBe("unknown");
      expect(goalCompletionUnknownReasons(unread)).toContain("review threads unreadable");
    })
  );
  it.effect("a declared local Yeet verdict never gates, whatever its outcome", () =>
    Effect.gen(function* () {
      const observation = fixture();
      for (const outcome of ["unsatisfied", "unknown"] as const) {
        const verdict = GoalEvidenceCheck.make({
          ref: GoalAcceptanceEvidenceRef.make({ kind: "yeet-verdict", ref: ".beep/yeet/verdict.json", gating: true }),
          outcome,
          observedHead: O.none(),
          detail: "Local verdict",
        });
        const resolved = yield* GoalCompletionVerifier.resolve(
          GoalCompletionObservation.make({ ...observation, evidence: [...observation.evidence, verdict] })
        );
        expect(resolved.outcome).toBe("verified");
      }
    })
  );
  it.effect("a committed claim turns a required red into a verified, listed attribution", () =>
    Effect.gen(function* () {
      const red = GoalRequiredCheckFact.make({ ...lintFact, conclusion: "cancelled", outcome: "unsatisfied" });
      const claim = GoalRedAttributionClaim.make({
        context: "Lint",
        attribution: "inherited",
        fixPullRequest: 2994,
        decisionFile: "goals/unmentioned-packet/decisions/2026-11-14-final-merged-over-lint.md",
        source: "origin-main",
      });
      const unattributed = GoalCompletionObservation.make({ ...fixture(), requiredCheckFacts: [red] });
      expect((yield* GoalCompletionVerifier.resolve(unattributed)).outcome).toBe("unsatisfied");
      const attributed = yield* GoalCompletionVerifier.resolve(
        GoalCompletionObservation.make({ ...unattributed, redAttributions: [claim] })
      );
      expect(attributed.outcome).toBe("verified");
      expect(attributed.schemaVersion).toBe("goal-completion-receipt/v2");
      expect(attributed.redAttributions).toEqual([claim]);
      assertSome(attributed.reviewThreads, GoalReviewThreadTally.make({ total: 0, outstanding: 0 }));
      assertSome(attributed.merged, true);
      const verdict = goalCompletionVerdict(attributed);
      expect(verdict._tag === "verified" ? A.map(verdict.attributedReds, (fact) => fact.context) : []).toEqual([
        "Lint",
      ]);
    })
  );
  it.effect("an unreadable fix PR check keeps an otherwise verified outcome unknown and names itself", () =>
    Effect.gen(function* () {
      const observation = fixture();
      const pending = GoalCompletionObservation.make({
        ...observation,
        evidence: [
          ...observation.evidence,
          GoalEvidenceCheck.make({
            ref: GoalAcceptanceEvidenceRef.make({
              kind: "hosted-required-checks",
              ref: "fix-pull-requests",
              gating: true,
            }),
            outcome: "unknown",
            observedHead: O.some("accepted-head"),
            detail: "fix PR #2994 unreadable",
          }),
        ],
      });
      expect((yield* GoalCompletionVerifier.resolve(pending)).outcome).toBe("unknown");
      expect(goalCompletionUnknownReasons(pending)).toEqual(["fix PR #2994 unreadable"]);
    })
  );
  it.effect("names a stored v1 row for a rerun of refresh", () =>
    Effect.sync(() => {
      const observation = fixture();
      expect(goalCompletionUnknownReasons({ ...observation, schemaVersion: "goal-completion-receipt/v1" })).toEqual([
        "v1 receipt predates hosted-only rules; rerun refresh",
      ]);
      expect(goalCompletionUnknownReasons({ ...observation, schemaVersion: "goal-completion-receipt/v2" })).toEqual([]);
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

it.layer(
  Layer.mergeAll(
    MemoryFileSystem.layer,
    Path.layer,
    NodeCrypto.layer,
    layerGoalCompletionReceiptStoreMemory,
    ScriptedSpawner.make(() =>
      PlatformError.systemError({
        _tag: "NotFound",
        module: "ChildProcess",
        method: "spawn",
        pathOrDescriptor: "git",
        description: "The fixture has no Git remote.",
      })
    ).layer
  ),
  { timeout: "10 seconds" }
)("committed goal closeout views", (it) => {
  // The declaration digest is canonical JSON over manifest text; a statement
  // holding an unpaired surrogate has none, and the digest fails typed.
  it.effect("fails the declaration digest typed for an unpaired surrogate in the gate", () =>
    Effect.gen(function* () {
      const manifest = yield* decodeGoalManifest({
        initiative: { id: "surrogate", status: "completed-retained" },
        completionGate: { ...gate, statement: "Ship \ud800 via yeet" },
      });
      const failure = yield* Effect.flip(goalCompletionDeclarationDigest(manifest));
      expect(failure.message).toContain('LoneSurrogate at "/completionGate/statement"');
    })
  );
  // The retired proposal shape survives only as a raw JSON key.
  const legacyProposal = { status: "completed-retained", finalPullRequest: 1429 };
  const readiness = GoalAcceptanceEvidenceRef.make({
    kind: "yeet-verdict",
    ref: ".beep/yeet/verdict.json",
    gating: true,
  });
  const declaredGate = GoalCompletionGate.make({ ...gate, acceptanceEvidence: [readiness] });
  const manifest = () =>
    GoalManifest.make({
      initiative: { id: "unmentioned-packet", status: "active" },
      completionGate: declaredGate,
      provides: ["goals/example"],
    });
  const adopted = () => ({
    ...manifest(),
    initiative: { id: "unmentioned-packet", status: "completed-retained" as const },
    closeout: GoalCloseoutRecord.make({ status: "completed-retained", finalPullRequest: 1429 }),
  });
  // A manifest that still carries the retired key decodes with the key stripped.
  const withLegacyProposal = (value: GoalManifest, proposal: unknown = legacyProposal) =>
    S.encodeEffect(GoalManifest)(value).pipe(
      Effect.flatMap((encoded) => S.decodeUnknownEffect(GoalManifest)({ ...encoded, proposedCloseout: proposal }))
    );
  const committed = (id = "unmentioned-packet") =>
    S.decodeEffect(GoalManifest)({ ...adopted(), initiative: { id, status: "completed-retained" } });
  const receiptFor = Effect.fnUntraced(function* (value: GoalManifest, mergedAt: DateTime.Utc = time) {
    const digest = yield* goalCompletionDeclarationDigest(value);
    return yield* GoalCompletionVerifier.resolve(
      GoalCompletionObservation.make({
        ...fixture(),
        packet: value.initiative.id,
        declarationDigest: digest,
        acceptedDeclarationDigest: O.some(digest),
        merge: O.map(fixture().merge, (merge) => GoalMergeResult.make({ ...merge, mergedAt })),
      })
    );
  });
  const receipt = Effect.fnUntraced(function* () {
    const value = yield* committed();
    return yield* receiptFor(value);
  });
  // The memory filesystem is shared by the block, so each test owns its root.
  const writeManifest = Effect.fnUntraced(function* (root: string, value: GoalManifest) {
    const fs = yield* FileSystem.FileSystem;
    const directory = `${root}/goals/${value.initiative.id}/ops`;
    yield* fs.makeDirectory(directory, { recursive: true });
    const text = yield* encodeGoalManifestJson(value);
    yield* fs.writeFileString(`${directory}/manifest.json`, text);
  });
  // Writes the manifest with the retired key the schema can no longer encode.
  const writeLegacyManifest = Effect.fnUntraced(function* (root: string, value: GoalManifest) {
    const fs = yield* FileSystem.FileSystem;
    const directory = `${root}/goals/${value.initiative.id}/ops`;
    yield* fs.makeDirectory(directory, { recursive: true });
    const encoded = yield* S.encodeEffect(GoalManifest)(value);
    const text = yield* encodeUnknownJson({ ...encoded, proposedCloseout: legacyProposal });
    yield* fs.writeFileString(`${directory}/manifest.json`, text);
  });

  it.effect("lists an unverified committed closeout in checkout-local session views", () =>
    Effect.gen(function* () {
      const value = yield* committed();
      yield* writeManifest("/views-unverified", value);
      const views = yield* readGoalCloseoutViews("/views-unverified");
      expect(views).toEqual([
        {
          packet: "unmentioned-packet",
          closeout: GoalCloseoutRecord.make({ status: "completed-retained", finalPullRequest: 1429 }),
          verification: "unverified",
        },
      ]);
      expect(A.map(views, renderGoalCloseoutView)).toEqual(["completed-retained (committed via #1429, unverified)"]);
    })
  );

  it.effect("lists a verified closeout only while its final is inside the closeout window", () =>
    Effect.gen(function* () {
      const now = DateTime.makeUnsafe("2026-11-12T00:00:00Z");
      yield* now.pipe(DateTime.toEpochMillis, TestClock.setTime);
      // Merged 37 days ago and verified: left out. Merged 11 days ago and
      // verified: listed. Merged 37 days ago with no receipt: listed.
      const old = yield* committed("verified-long-ago");
      const recent = yield* committed("verified-recently");
      const pending = yield* committed("never-verified");
      for (const value of [old, recent, pending]) yield* writeManifest("/views-window", value);
      const rows = [
        yield* receiptFor(old, DateTime.makeUnsafe("2026-10-06T00:00:00Z")),
        yield* receiptFor(recent, DateTime.makeUnsafe("2026-11-01T00:00:00Z")),
      ];
      for (const row of rows) expect(row.outcome).toBe("verified");
      const store = yield* GoalCompletionReceiptStore;
      for (const row of rows) yield* store.append(row);
      const views = yield* readGoalCloseoutViews("/views-window").pipe(
        Effect.provideService(
          GoalCompletionIo,
          completionIoFixture({
            manifest: Effect.succeed(""),
            origin: Effect.succeed("git@github.com:example/repo.git"),
            respond: () => Effect.die("session views never read GitHub"),
          })
        )
      );
      expect(A.map(views, (view) => [view.packet, view.verification])).toEqual([
        ["never-verified", "unverified"],
        ["verified-recently", "verified"],
      ]);
      expect(GOAL_CLOSEOUT_WINDOW_DAYS).toBe(28);
      expect(goalFinalWithinCloseoutWindow(DateTime.makeUnsafe("2026-10-15T00:00:00Z"), now)).toBe(true);
      expect(goalFinalWithinCloseoutWindow(DateTime.makeUnsafe("2026-10-14T23:59:59Z"), now)).toBe(false);
      expect(goalFinalWithinCloseoutWindow(now)(DateTime.makeUnsafe("2026-11-13T00:00:00Z"))).toBe(true);
    })
  );

  it.effect("builds the view from the receipt and keeps the manifest status declared", () =>
    Effect.gen(function* () {
      const value = yield* committed();
      const unverified = O.getOrThrow(goalCloseoutView("unmentioned-packet", value, O.none()));
      expect(unverified.verification).toBe("unverified");
      expect(renderGoalCloseoutView(unverified)).toBe("completed-retained (committed via #1429, unverified)");
      const row = yield* receipt();
      const verified = O.getOrThrow(goalCloseoutView(value, O.some(row))("unmentioned-packet"));
      expect(verified.verification).toBe("verified");
      expect(verified.closeout).toEqual(value.closeout);
      expect(renderGoalCloseoutView(verified)).toBe("completed-retained (verified via #1429)");
      const red = GoalCompletionReceipt.make({ ...row, outcome: "unsatisfied" });
      assertSome(
        O.map(goalCloseoutView("unmentioned-packet", value, O.some(red)), (view) => view.verification),
        "unverified"
      );
      expect(value.initiative.status).toBe("completed-retained");
    })
  );

  it.effect("has no closeout view without a committed closeout, a legacy proposal key included", () =>
    Effect.gen(function* () {
      const row = yield* receipt();
      assertNone(goalCloseoutView("unmentioned-packet", manifest(), O.some(row)));
      const legacy = yield* withLegacyProposal(manifest());
      assertNone(goalCloseoutView("unmentioned-packet", legacy, O.some(row)));
      assertNone(
        goalCloseoutView(
          "unmentioned-packet",
          GoalManifest.make({
            initiative: { id: "unmentioned-packet", status: "active" },
            completionGate: declaredGate,
          }),
          O.none()
        )
      );
      yield* writeLegacyManifest("/views-proposal", manifest());
      const views = yield* readGoalCloseoutViews("/views-proposal");
      expect(views).toEqual([]);
    })
  );

  it.effect("projects every packet with its declared status", () =>
    Effect.gen(function* () {
      const value = manifest();
      expect(goalPullRequestRefs(value)).toEqual([]);
      expect(compileCapabilityProjection([value]).packets[0]?.status).toBe("active");
      const record = yield* committed();
      expect(goalPullRequestRefs(record)).toEqual([{ number: 1429, role: "final" }]);
      expect(compileCapabilityProjection([record]).packets[0]?.status).toBe("completed-retained");
    })
  );

  it.effect("strips a legacy proposedCloseout key, which names no final PR and no longer constrains the gate", () =>
    Effect.gen(function* () {
      // Neither the old shape nor a malformed one is read: doctor reports the raw key instead.
      for (const proposal of [legacyProposal, { ...legacyProposal, status: "achieved" }]) {
        const legacy = yield* withLegacyProposal(manifest(), proposal);
        expect(legacy).not.toHaveProperty("proposedCloseout");
        expect(legacy.closeout).toBeUndefined();
        expect(goalPullRequestRefs(legacy)).toEqual([]);
      }
      // An active packet whose declared final differs from the old proposal's still decodes.
      const declared = yield* withLegacyProposal(
        GoalManifest.make({
          ...manifest(),
          completionGate: { ...declaredGate, pullRequests: [{ number: 99, role: "final" }] },
        })
      );
      expect(goalPullRequestRefs(declared)).toEqual([{ number: 99, role: "final" }]);
      // A committed record's final leads the declared supporting refs.
      expect(
        goalPullRequestRefs(
          GoalManifest.make({
            ...adopted(),
            completionGate: { ...declaredGate, pullRequests: [{ number: 10, role: "supporting" }] },
          })
        )
      ).toEqual([
        { number: 1429, role: "final" },
        { number: 10, role: "supporting" },
      ]);
    })
  );
  it.effect("digests the committed closeout under the retired proposedCloseout label", () =>
    Effect.gen(function* () {
      const record = yield* S.decodeEffect(GoalManifest)(adopted());
      const encoded = yield* S.encodeEffect(GoalManifest)(record);
      // The label a proposal used: receipts written before the proposal shape was
      // removed, and before `goals set-status` bound it, keep matching.
      const expected = yield* sha256Hex(
        canonicalJsonText({
          initiative: { id: "unmentioned-packet" },
          completionGate: encoded.completionGate,
          proposedCloseout: legacyProposal,
          pullRequests: [{ number: 1429, role: "final" }],
        })
      );
      const digest = yield* goalCompletionDeclarationDigest(record);
      expect(digest).toBe(expected);
      // A stripped legacy key no longer moves the digest of the packet that carries it.
      const legacy = yield* withLegacyProposal(manifest());
      const legacyDigest = yield* goalCompletionDeclarationDigest(legacy);
      const activeDigest = yield* goalCompletionDeclarationDigest(manifest());
      expect(legacyDigest).toBe(activeDigest);
      expect(legacyDigest).not.toBe(digest);
      const receipt13 = yield* receipt();
      const view = goalCloseoutView("unmentioned-packet", record, O.some(receipt13));
      assertSome(
        O.map(view, (value) => value.verification),
        "verified"
      );
      expect(
        renderGoalCloseoutRecord(GoalCloseoutRecord.make({ status: "completed-retained", finalPullRequest: 7 }))
      ).toBe("completed-retained via #7");
      const closeout = GoalCloseoutRecord.make({ status: "completed-retained", finalPullRequest: 1429 });
      expect(renderGoalCloseoutRecordView(closeout, "verified")).toBe("completed-retained (verified via #1429)");
      expect(renderGoalCloseoutRecordView("unverified")(closeout)).toBe(
        "completed-retained (committed via #1429, unverified)"
      );
    })
  );
  it.effect("rejects a committed closeout record without its status, on another final PR or a grandfathered gate", () =>
    Effect.gen(function* () {
      for (const candidate of [
        { ...adopted(), initiative: { id: "unmentioned-packet", status: "active" } },
        { ...adopted(), completionGate: { ...declaredGate, pullRequests: [{ number: 99, role: "final" }] } },
        { ...adopted(), completionGate: { ...gate, grandfathered: true } },
      ]) {
        expect((yield* S.decodeUnknownEffect(GoalManifest)(candidate).pipe(Effect.exit))._tag).toBe("Failure");
      }
      // A legacy key beside the record is stripped rather than rejected; doctor blocks on it.
      const record = yield* S.decodeEffect(GoalManifest)(adopted());
      const beside = yield* withLegacyProposal(record);
      expect(beside.closeout?.finalPullRequest).toBe(1429);
      expect(beside).not.toHaveProperty("proposedCloseout");
    })
  );
  it.effect("admits a committed closeout whose gate declares no Yeet readiness evidence", () =>
    Effect.gen(function* () {
      const plain = yield* S.decodeEffect(GoalManifest)({ ...adopted(), completionGate: gate });
      expect(plain.closeout?.finalPullRequest).toBe(1429);
      expect(plain.initiative.status).toBe("completed-retained");
      expect(plain.completionGate.acceptanceEvidence).toBeUndefined();
      const named = yield* S.decodeEffect(GoalManifest)({
        ...adopted(),
        completionGate: { ...gate, pullRequests: [{ number: 1429, role: "final" }] },
      });
      expect(goalPullRequestRefs(named)).toEqual([{ number: 1429, role: "final" }]);
    })
  );
});
