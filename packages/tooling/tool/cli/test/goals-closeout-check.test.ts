import {
  classifyGoalCloseout,
  GoalCloseoutCheck,
  GoalCloseoutCheckBlocking,
  GoalCloseoutChecker,
  GoalCloseoutCheckerLive,
  GoalCloseoutCheckOutcome,
  GoalCloseoutClassificationInput,
  goalCompletionTransient,
  readGoalCloseoutCheck,
} from "@beep/repo-cli/commands/Goals/CloseoutCheck";
import { GoalCompletionClaimsReader } from "@beep/repo-cli/commands/Goals/RedAttribution";
import {
  GoalAcceptanceEvidenceRef,
  GoalAttributionConflict,
  GoalClaimSet,
  GoalCloseoutShardUpdate,
  GoalCompletionClaims,
  GoalCompletionEvidenceGap,
  GoalCompletionIo,
  GoalCompletionObservation,
  GoalCompletionPull,
  GoalCompletionReceipt,
  GoalCompletionReceiptStore,
  GoalCompletionVerifier,
  GoalEvidenceCheck,
  GoalManifest,
  GoalMergeResult,
  GoalMergeTimeInventory,
  GoalMergeTimeRuleSource,
  GoalOperatorRulingClaim,
  GoalRedAttributionClaim,
  GoalRequiredCheckFact,
  GoalRequiredCheckSnapshot,
  GoalReviewThreadTally,
  goalCloseoutRefreshCommand,
  goalCloseoutShard,
  goalCompletionDeclarationDigest,
  layerGoalCompletionReceiptStoreMemory,
  updateGoalCloseoutShards,
  withGoalCompletionIo,
} from "@beep/repo-cli/test/Goals";
import {
  loadYeetInboxView,
  recordYeetLocalShardOutcome,
  YeetCommandError,
  YeetLocalShardOutcome,
} from "@beep/repo-cli/test/Yeet";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import { NodeTestLayer, temporaryWorkingDirectory } from "./support/CommandTest.ts";
import { completionIoFixture } from "./support/CompletionIo.ts";

const encode = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);

const NOW = DateTime.makeUnsafe("2026-11-12T00:00:00Z");
const RECENT = DateTime.makeUnsafe("2026-11-01T00:00:00Z");
const LONG_AGO = DateTime.makeUnsafe("2026-10-06T00:00:00Z");
const FINAL = 7;
const DECISION = "goals/demo/decisions/2026-11-14-final-merged-over-lint.md";
const RULING = "goals/demo/decisions/2026-11-14-operator-ruling.md";

const pull = (overrides: Partial<{ state: "open" | "closed"; merged: boolean; mergedAt: O.Option<DateTime.Utc> }>) =>
  GoalCompletionPull.make({
    created_at: DateTime.makeUnsafe("2026-09-01T00:00:00Z"),
    number: FINAL,
    state: overrides.state ?? "closed",
    merged: overrides.merged ?? true,
    merged_at: overrides.mergedAt ?? O.some(RECENT),
    merge_commit_sha: O.some("merge-result"),
    head: { sha: "accepted-head" },
    base: { ref: "main", repo: { full_name: "example/repo" } },
  });

const inventory = (afterSha = "merge-result") =>
  GoalMergeTimeInventory.make({
    source: "repos/{owner}/{repo}/rulesets/rule-suites/1",
    ruleSuiteId: 1,
    ref: "refs/heads/main",
    afterSha,
    pushedAt: RECENT,
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
const snapshot = (patch: Partial<Pick<GoalRequiredCheckSnapshot, "gaps" | "rulesetReadsComplete">> = {}) =>
  GoalRequiredCheckSnapshot.make({
    contexts: ["Lint"],
    sources: ["repos/{owner}/{repo}/rulesets/42/history/1"],
    effectiveAt: RECENT,
    inventoryComplete: true,
    mergeTimeInventory: O.some(inventory()),
    ...patch,
  });
const lint = (patch: Partial<Pick<GoalRequiredCheckFact, "checkRunId" | "conclusion" | "outcome">> = {}) =>
  GoalRequiredCheckFact.make({
    context: "Lint",
    head: "accepted-head",
    checkRunId: O.some(1),
    conclusion: "success",
    outcome: "verified",
    source: "check-run",
    ...patch,
  });
const evidence = (
  kind: "hosted-required-checks" | "hosted-review-threads",
  ref: string,
  outcome: GoalEvidenceCheck["outcome"],
  detail = "Recorded"
) =>
  GoalEvidenceCheck.make({
    ref: GoalAcceptanceEvidenceRef.make({ kind, ref, gating: true }),
    outcome,
    observedHead: O.some("accepted-head"),
    detail,
  });
const observation = (patch: Partial<GoalCompletionObservation> = {}) =>
  GoalCompletionObservation.make({
    repository: "example/repo",
    packet: "demo",
    declarationDigest: "declaration",
    acceptedDeclarationDigest: O.none(),
    requiredChecks: O.some(snapshot()),
    requiredCheckFacts: [lint()],
    finalPullRequest: FINAL,
    acceptedHead: O.some("accepted-head"),
    merged: O.some(true),
    merge: O.some(
      GoalMergeResult.make({
        mergeCommit: "merge-result",
        tree: "merge-tree",
        mergedAt: RECENT,
        method: O.none(),
        baseRef: "main",
      })
    ),
    grandfathered: false,
    evidence: [
      evidence("hosted-required-checks", "required", "verified"),
      evidence("hosted-review-threads", "outstanding", "verified"),
    ],
    reviewThreads: O.some(GoalReviewThreadTally.make({ total: 0, outstanding: 0 })),
    nonRequiredReds: [],
    subClaims: [],
    verifiedAt: RECENT,
    ...patch,
  });
const resolve = (patch: Partial<GoalCompletionObservation> = {}) => GoalCompletionVerifier.resolve(observation(patch));

const lintClaim = (context = "Lint") =>
  GoalRedAttributionClaim.make({
    context,
    attribution: "inherited",
    fixPullRequest: 2994,
    decisionFile: DECISION,
    source: "origin-main",
  });
const ruling = (finalPullRequest = FINAL) =>
  GoalOperatorRulingClaim.make({ finalPullRequest, decisionFile: RULING, source: "origin-main" });

const classify = (
  input: Partial<{
    pull: O.Option<GoalCompletionPull>;
    now: DateTime.Utc;
    receipt: O.Option<GoalCompletionReceipt>;
    claims: GoalClaimSet;
  }>
) =>
  classifyGoalCloseout(
    GoalCloseoutClassificationInput.make({
      packet: "demo",
      finalPullRequest: FINAL,
      pull: input.pull ?? O.some(pull({})),
      now: input.now ?? NOW,
      receipt: input.receipt ?? O.none(),
      claims: input.claims ?? GoalClaimSet.make({}),
    })
  );

const gate = {
  operator: "yeet",
  requiresPullRequest: true,
  requiresMergeable: true,
  statement: "Ship via yeet.",
  grandfathered: false,
} as const;
const closeoutManifest = GoalManifest.make({
  initiative: { id: "demo", status: "completed-retained" },
  completionGate: gate,
  closeout: { status: "completed-retained", finalPullRequest: FINAL },
});

describe("goal closeout outcomes", () => {
  it("blocks only on unverified and names the shard after the packet and final", () => {
    expect(GoalCloseoutCheckOutcome.literals).toEqual([
      "final-open",
      "verified",
      "operator-ruling",
      "beyond-window",
      "transient",
      "unverified",
    ]);
    expect(A.filter(GoalCloseoutCheckOutcome.literals, S.is(GoalCloseoutCheckBlocking))).toEqual(["unverified"]);
    expect(goalCloseoutShard("demo", FINAL)).toBe("goal-closeout:demo#7");
    expect(goalCloseoutShard(FINAL)("demo")).toBe("goal-closeout:demo#7");
    expect(goalCloseoutRefreshCommand("demo")).toBe("bun run beep goals completion refresh --slug demo");
  });

  it.effect("decodes a stored check without its optional keys", () =>
    Effect.gen(function* () {
      const decoded = yield* S.decodeEffect(GoalCloseoutCheck)({
        packet: "demo",
        finalPullRequest: FINAL,
        outcome: "transient",
      });
      expect(decoded.reasons).toEqual([]);
      expect(decoded.attributedReds).toEqual([]);
      assertNone(decoded.rulingFile);
    })
  );
});

describe("classifyGoalCloseout", () => {
  it("a failed pull-request read is transient", () => {
    const check = classify({ pull: O.none() });
    expect(check.outcome).toBe("transient");
    expect(check.reasons).toEqual(["final #7 unreadable: the pull request read failed"]);
  });

  it("an open final is final-open and a final closed without merging is unverified at any age", () => {
    expect(classify({ pull: O.some(pull({ state: "open", merged: false, mergedAt: O.none() })) }).outcome).toBe(
      "final-open"
    );
    const closed = classify({
      pull: O.some(pull({ state: "closed", merged: false, mergedAt: O.none() })),
      now: DateTime.makeUnsafe("2027-06-01T00:00:00Z"),
    });
    expect(closed.outcome).toBe("unverified");
    expect(closed.reasons).toEqual(["final #7 closed without merging; bind a new final or reopen the packet"]);
  });

  it.effect("a final merged before the window is beyond-window unless a stored receipt verified it", () =>
    Effect.gen(function* () {
      const old = O.some(pull({ mergedAt: O.some(LONG_AGO) }));
      const beyond = classify({ pull: old });
      expect(beyond.outcome).toBe("beyond-window");
      expect(beyond.reasons).toEqual(["final #7 merged more than 28 days ago, beyond the rule-suite window"]);
      const verified = yield* resolve();
      expect(classify({ pull: old, receipt: O.some(verified) }).outcome).toBe("verified");
      const red = yield* resolve({ requiredCheckFacts: [lint({ conclusion: "failure", outcome: "unsatisfied" })] });
      expect(red.outcome).toBe("unsatisfied");
      expect(classify({ pull: old, receipt: O.some(red) }).outcome).toBe("beyond-window");
      const v1 = GoalCompletionReceipt.make({ ...verified, schemaVersion: "goal-completion-receipt/v1" });
      expect(classify({ pull: old, receipt: O.some(v1) }).reasons).toEqual([
        "verified by a goal-completion-receipt/v1 row (Yeet readiness rules)",
      ]);
    })
  );

  it.effect("inside the window a verified receipt verifies and lists its attributed reds", () =>
    Effect.gen(function* () {
      const verified = yield* resolve();
      const plain = classify({ receipt: O.some(verified) });
      expect(plain.outcome).toBe("verified");
      expect(plain.reasons).toEqual([]);
      const attributed = yield* resolve({
        requiredCheckFacts: [lint({ conclusion: "failure", outcome: "unsatisfied" })],
        redAttributions: [lintClaim()],
      });
      expect(attributed.outcome).toBe("verified");
      const check = classify({
        receipt: O.some(attributed),
        claims: GoalClaimSet.make({ redAttributions: [lintClaim()] }),
      });
      expect(check.outcome).toBe("verified");
      expect(A.map(check.attributedReds, (red) => [red.context, red.fixPullRequest])).toEqual([["Lint", 2994]]);
      // A merge time without `merged_at` is read as inside the window.
      expect(classify({ pull: O.some(pull({ mergedAt: O.none() })), receipt: O.some(attributed) }).outcome).toBe(
        "verified"
      );
      // A v1 row that verified is taken as stored, so its own verdict lists no attributed red.
      const v1 = GoalCompletionReceipt.make({
        ...attributed,
        schemaVersion: "goal-completion-receipt/v1",
        redAttributions: [],
      });
      const stored = classify({ receipt: O.some(v1) });
      expect([stored.outcome, stored.attributedReds, stored.reasons]).toEqual([
        "verified",
        [],
        ["verified by a goal-completion-receipt/v1 row (Yeet readiness rules)"],
      ]);
    })
  );

  it.effect("an unverified final with a committed ruling for it is operator-ruling", () =>
    Effect.gen(function* () {
      const red = yield* resolve({ requiredCheckFacts: [lint({ conclusion: "failure", outcome: "unsatisfied" })] });
      const ruled = classify({ receipt: O.some(red), claims: GoalClaimSet.make({ operatorRulings: [ruling()] }) });
      expect(ruled.outcome).toBe("operator-ruling");
      assertSome(ruled.rulingFile, RULING);
      expect(ruled.reasons).toEqual(["unattributed red: Lint"]);
      const other = classify({ receipt: O.some(red), claims: GoalClaimSet.make({ operatorRulings: [ruling(8)] }) });
      expect(other.outcome).toBe("unverified");
    })
  );

  it.effect("unsatisfied finals are unverified with the red and the outstanding threads named", () =>
    Effect.gen(function* () {
      const red = yield* resolve({ requiredCheckFacts: [lint({ conclusion: "failure", outcome: "unsatisfied" })] });
      expect(classify({ receipt: O.some(red) }).reasons).toEqual(["unattributed red: Lint"]);
      const threads = yield* resolve({
        reviewThreads: O.some(GoalReviewThreadTally.make({ total: 2, outstanding: 1 })),
        evidence: [
          evidence("hosted-required-checks", "required", "verified"),
          evidence("hosted-review-threads", "outstanding", "unsatisfied"),
        ],
      });
      expect(threads.outcome).toBe("unsatisfied");
      const check = classify({ receipt: O.some(threads) });
      expect(check.outcome).toBe("unverified");
      expect(check.reasons).toEqual(["1 review thread(s) outstanding"]);
      const stale = yield* resolve({
        evidence: [
          GoalEvidenceCheck.make({
            ...evidence("hosted-required-checks", "required", "verified"),
            observedHead: O.some("later-head"),
          }),
          evidence("hosted-review-threads", "outstanding", "verified"),
        ],
      });
      expect(classify({ receipt: O.some(stale) }).reasons).toEqual([
        'gating evidence hosted-required-checks "required" observed at another head',
      ]);
      // A receipt observed while the final was still unmerged names that first.
      const unmerged = GoalCompletionReceipt.make({ ...red, merged: O.some(false) });
      expect(classify({ receipt: O.some(unmerged) }).reasons).toEqual([
        "final #7 has not merged",
        "unattributed red: Lint",
      ]);
      // An unsatisfied row with no hosted fact to name still says it is unsatisfied.
      const bare = GoalCompletionReceipt.make({ ...threads, reviewThreads: O.none() });
      expect(classify({ receipt: O.some(bare) }).reasons).toEqual(["completion unsatisfied"]);
    })
  );

  it.effect("unknown finals are transient for failed reads and unverified for structural gaps", () =>
    Effect.gen(function* () {
      const unread = yield* resolve({ merge: O.none(), evidence: [] });
      const transient = classify({ receipt: O.some(unread) });
      expect(transient.outcome).toBe("transient");
      assertTrue(A.contains(transient.reasons, "merge facts unobserved"));
      const missing = yield* resolve({ requiredChecks: O.some(snapshot({ gaps: ["rule-suite-unavailable"] })) });
      expect(classify({ receipt: O.some(missing) }).outcome).toBe("unverified");
      // Inside the window but not observed at all.
      expect(classify({}).outcome).toBe("transient");
      expect(classify({}).reasons).toEqual(["final #7 not observed"]);
    })
  );

  it.effect("notes attribution conflicts and attributions that name no red or missing context", () =>
    Effect.gen(function* () {
      const verified = yield* resolve();
      const check = classify({
        receipt: O.some(verified),
        claims: GoalClaimSet.make({
          redAttributions: [lintClaim(), lintClaim("Security")],
          conflicts: [GoalAttributionConflict.make({ context: "Docs", decisionFiles: [DECISION, RULING] })],
        }),
      });
      expect(check.outcome).toBe("verified");
      expect(check.reasons).toEqual([
        `attribution conflict: Docs in ${DECISION}, ${RULING}; the context stays unattributed`,
        `stale attribution: Lint in ${DECISION} was neither red nor missing at the head`,
        `stale attribution: Security in ${DECISION} was neither red nor missing at the head`,
      ]);
    })
  );
});

describe("goalCompletionTransient", () => {
  const TRANSIENT_GAPS = ["network-failure", "partial-ruleset-reads", "inventory-unobserved"];

  it.effect("verified and unsatisfied receipts are never transient", () =>
    Effect.gen(function* () {
      const verified = yield* resolve();
      expect(goalCompletionTransient(verified)).toBe(false);
      const red = yield* resolve({ requiredCheckFacts: [lint({ conclusion: "failure", outcome: "unsatisfied" })] });
      expect(goalCompletionTransient(red)).toBe(false);
    })
  );

  it.effect("each stored gap is transient exactly when it is a read failure", () =>
    Effect.forEach(
      A.filter(GoalCompletionEvidenceGap.literals, (gap) => gap !== "required-check-unobserved"),
      Effect.fnUntraced(function* (gap) {
        const receipt = yield* resolve({
          requiredChecks: O.some(snapshot({ gaps: [gap] })),
          evidence: [
            evidence("hosted-required-checks", "required", "unknown"),
            evidence("hosted-review-threads", "outstanding", "verified"),
          ],
        });
        expect(receipt.outcome).toBe("unknown");
        expect([gap, goalCompletionTransient(receipt)]).toEqual([gap, A.contains(TRANSIENT_GAPS, gap)]);
      }),
      { discard: true }
    )
  );

  it.effect("partial ruleset reads and an unobserved inventory are transient", () =>
    Effect.gen(function* () {
      const partial = yield* resolve({ requiredChecks: O.some(snapshot({ rulesetReadsComplete: false })) });
      expect(partial.outcome).toBe("unknown");
      expect(goalCompletionTransient(partial)).toBe(true);
      const unobserved = yield* resolve({ requiredChecks: O.none() });
      expect(goalCompletionTransient(unobserved)).toBe(true);
    })
  );

  it.effect("failed merge, review-thread and fix-PR reads are transient", () =>
    Effect.gen(function* () {
      const merge = yield* resolve({ merge: O.none() });
      expect(goalCompletionTransient(merge)).toBe(true);
      const threads = yield* resolve({
        reviewThreads: O.none(),
        evidence: [
          evidence("hosted-required-checks", "required", "verified"),
          evidence("hosted-review-threads", "outstanding", "unknown", "review threads unreadable"),
        ],
      });
      expect(threads.outcome).toBe("unknown");
      expect(goalCompletionTransient(threads)).toBe(true);
      const fix = yield* resolve({
        evidence: [
          evidence("hosted-required-checks", "required", "verified"),
          evidence("hosted-required-checks", "fix-pull-requests", "unknown", "fix PR #2994 unreadable"),
          evidence("hosted-review-threads", "outstanding", "verified"),
        ],
      });
      expect(fix.outcome).toBe("unknown");
      expect(goalCompletionTransient(fix)).toBe(true);
    })
  );

  it.effect("a pending required run is transient; a context with no run and no claim is not", () =>
    Effect.gen(function* () {
      const pending = yield* resolve({
        requiredCheckFacts: [lint({ conclusion: "pending", outcome: "unknown" })],
      });
      expect(pending.outcome).toBe("unknown");
      expect(goalCompletionTransient(pending)).toBe(true);
      const absent = yield* resolve({
        requiredCheckFacts: [lint({ checkRunId: O.none(), conclusion: "unknown", outcome: "unknown" })],
      });
      expect(absent.outcome).toBe("unknown");
      expect(goalCompletionTransient(absent)).toBe(false);
      // A pending run beside an absent one is still structural.
      const mixed = yield* resolve({
        requiredChecks: O.some(GoalRequiredCheckSnapshot.make({ ...snapshot(), contexts: ["Lint", "Docs"] })),
        requiredCheckFacts: [
          lint({ conclusion: "pending", outcome: "unknown" }),
          GoalRequiredCheckFact.make({
            ...lint({ checkRunId: O.none(), conclusion: "unknown", outcome: "unknown" }),
            context: "Docs",
          }),
        ],
      });
      expect(goalCompletionTransient(mixed)).toBe(false);
      // An attributed missing context is covered, so the pending one alone decides.
      const covered = yield* resolve({
        requiredChecks: O.some(GoalRequiredCheckSnapshot.make({ ...snapshot(), contexts: ["Lint", "Docs"] })),
        requiredCheckFacts: [
          lint({ conclusion: "pending", outcome: "unknown" }),
          GoalRequiredCheckFact.make({
            ...lint({ checkRunId: O.none(), conclusion: "unknown", outcome: "unknown" }),
            context: "Docs",
          }),
        ],
        redAttributions: [lintClaim("Docs")],
      });
      expect(goalCompletionTransient(covered)).toBe(true);
    })
  );

  it.effect("a missing hosted kind, a stale head and a v1 row are structural", () =>
    Effect.gen(function* () {
      const noThreads = yield* resolve({ evidence: [evidence("hosted-required-checks", "required", "verified")] });
      expect(noThreads.outcome).toBe("unknown");
      expect(goalCompletionTransient(noThreads)).toBe(false);
      const unknownHead = yield* resolve({
        evidence: [
          GoalEvidenceCheck.make({
            ...evidence("hosted-required-checks", "required", "verified"),
            observedHead: O.none(),
          }),
          evidence("hosted-review-threads", "outstanding", "verified"),
        ],
      });
      expect(unknownHead.outcome).toBe("unknown");
      expect(goalCompletionTransient(unknownHead)).toBe(false);
      const unread = yield* resolve({ requiredChecks: O.some(snapshot({ gaps: ["network-failure"] })) });
      const v1 = GoalCompletionReceipt.make({ ...unread, schemaVersion: "goal-completion-receipt/v1" });
      expect(goalCompletionTransient(v1)).toBe(false);
    })
  );
});

const pullBody = (overrides: { readonly merged: boolean; readonly state: string; readonly mergedAt: string | null }) =>
  encode({
    number: FINAL,
    state: overrides.state,
    merged: overrides.merged,
    created_at: "2026-09-01T00:00:00Z",
    merged_at: overrides.mergedAt,
    merge_commit_sha: overrides.merged ? "merge-result" : null,
    head: { sha: "accepted-head" },
    base: { ref: "main", repo: { full_name: "example/repo" } },
  });

// Answers the final's pull request and fails every other GitHub read, recording each endpoint.
const recordingIo = (body: string, reads: Array<string>) =>
  completionIoFixture({
    manifest: Effect.fail(YeetCommandError.make({ message: "no accepted-head manifest" })),
    origin: Effect.succeed("git@github.com:example/repo.git"),
    respond: Effect.fn("GoalsCloseoutCheckTest.respond")((endpoint: string) =>
      Effect.sync(() => reads.push(endpoint)).pipe(
        Effect.andThen(
          Str.endsWith(`pulls/${FINAL}`)(endpoint)
            ? Effect.succeed(body)
            : Effect.fail(YeetCommandError.make({ message: `fixture refuses ${endpoint}` }))
        )
      )
    ),
    reviewThreads: () => Effect.sync(() => reads.push("review-threads")).pipe(Effect.andThen(Effect.die("unread"))),
  });

const fixedClaims = (claims: GoalCompletionClaims) =>
  Effect.provideService(GoalCompletionClaimsReader, { read: () => Effect.succeed(claims) });

it.layer(Layer.mergeAll(NodeTestLayer, layerGoalCompletionReceiptStoreMemory), {
  timeout: "20 seconds",
})("readGoalCloseoutCheck", (it) => {
  it.effect("has no check without a committed closeout", () =>
    Effect.gen(function* () {
      const root = yield* temporaryWorkingDirectory;
      const active = GoalManifest.make({ initiative: { id: "demo", status: "active" }, completionGate: gate });
      const reads: Array<string> = [];
      const check = yield* readGoalCloseoutCheck(root, "demo", active).pipe(
        Effect.provideService(
          GoalCompletionIo,
          recordingIo(pullBody({ merged: true, state: "closed", mergedAt: null }), reads)
        )
      );
      assertNone(check);
      expect(reads).toEqual([]);
    })
  );

  it.effect("a final merged before the window reads only its pull request and its stored receipt", () =>
    Effect.gen(function* () {
      const root = yield* temporaryWorkingDirectory;
      yield* NOW.pipe(DateTime.toEpochMillis, TestClock.setTime);
      const reads: Array<string> = [];
      const io = recordingIo(pullBody({ merged: true, state: "closed", mergedAt: "2026-10-06T00:00:00Z" }), reads);
      const beyond = yield* readGoalCloseoutCheck(root, "demo", closeoutManifest).pipe(
        Effect.provideService(GoalCompletionIo, io)
      );
      assertSome(
        O.map(beyond, (check) => check.outcome),
        "beyond-window"
      );
      // No observation: no rule suite, check run or review-thread read.
      expect(reads).toEqual([`repos/{owner}/{repo}/pulls/${FINAL}`]);
      // A stored verified receipt for this declaration verifies it without GitHub.
      const digest = yield* goalCompletionDeclarationDigest(closeoutManifest);
      const verified = yield* resolve({ declarationDigest: digest });
      expect(verified.outcome).toBe("verified");
      const store = yield* GoalCompletionReceiptStore;
      yield* store.append(verified);
      const stored = yield* readGoalCloseoutCheck(root, "demo", closeoutManifest).pipe(
        Effect.provideService(GoalCompletionIo, io)
      );
      assertSome(
        O.map(stored, (check) => check.outcome),
        "verified"
      );
    })
  );

  it.effect("a final merged inside the window is observed with its committed claims", () =>
    Effect.gen(function* () {
      const root = yield* temporaryWorkingDirectory;
      yield* NOW.pipe(DateTime.toEpochMillis, TestClock.setTime);
      const reads: Array<string> = [];
      const io = recordingIo(pullBody({ merged: true, state: "closed", mergedAt: "2026-11-10T00:00:00Z" }), reads);
      const unread = yield* readGoalCloseoutCheck(root, "demo", closeoutManifest).pipe(
        Effect.provideService(GoalCompletionIo, io),
        fixedClaims(GoalCompletionClaims.make({}))
      );
      // The observation ran (the merge commit read failed), so the final is a transient unknown.
      assertSome(
        O.map(unread, (check) => check.outcome),
        "transient"
      );
      assertTrue(A.some(reads, Str.includes("commits/merge-result")));
      const ruled = yield* readGoalCloseoutCheck(root, "demo", closeoutManifest).pipe(
        Effect.provideService(GoalCompletionIo, io),
        fixedClaims(GoalCompletionClaims.make({ committed: GoalClaimSet.make({ operatorRulings: [ruling()] }) }))
      );
      assertSome(
        O.map(ruled, (check) => [check.outcome, O.getOrNull(check.rulingFile)]),
        ["operator-ruling", RULING]
      );
    })
  );

  it.effect("an open or closed-unmerged final is never observed", () =>
    Effect.gen(function* () {
      const root = yield* temporaryWorkingDirectory;
      for (const [body, outcome] of [
        [pullBody({ merged: false, state: "open", mergedAt: null }), "final-open"],
        [pullBody({ merged: false, state: "closed", mergedAt: null }), "unverified"],
      ] as const) {
        const reads: Array<string> = [];
        const check = yield* readGoalCloseoutCheck(root, "demo", closeoutManifest).pipe(
          Effect.provideService(GoalCompletionIo, recordingIo(body, reads))
        );
        assertSome(
          O.map(check, (value) => value.outcome),
          outcome
        );
        expect(reads).toEqual([`repos/{owner}/{repo}/pulls/${FINAL}`]);
      }
    })
  );

  it.effect("a merged final without a merge time is observed, with the claims of the scope asked for", () =>
    Effect.gen(function* () {
      const root = yield* temporaryWorkingDirectory;
      const reads: Array<string> = [];
      const scopes: Array<string> = [];
      const io = recordingIo(pullBody({ merged: true, state: "closed", mergedAt: null }), reads);
      const recordScope = Effect.provideService(GoalCompletionClaimsReader, {
        read: (_root, _slug, _final, scope) =>
          Effect.sync(() => scopes.push(scope ?? "checkout")).pipe(Effect.as(GoalCompletionClaims.make({}))),
      });
      const checkout = yield* readGoalCloseoutCheck(root, "demo", closeoutManifest).pipe(
        Effect.provideService(GoalCompletionIo, io),
        recordScope
      );
      // The observation runs (and stops at the missing merge time), so the final is a transient unknown.
      assertSome(
        O.map(checkout, (check) => check.outcome),
        "transient"
      );
      expect(reads).toEqual([`repos/{owner}/{repo}/pulls/${FINAL}`, `repos/{owner}/{repo}/pulls/${FINAL}`]);
      yield* readGoalCloseoutCheck(root, "demo", closeoutManifest, "origin-main").pipe(
        Effect.provideService(GoalCompletionIo, io),
        recordScope
      );
      expect(scopes).toEqual(["checkout", "origin-main"]);
    })
  );

  it.effect("a failed pull-request read is transient, and the whole run shares one memoized port", () =>
    Effect.gen(function* () {
      const root = yield* temporaryWorkingDirectory;
      const failing = completionIoFixture({
        manifest: Effect.succeed(""),
        origin: Effect.succeed("git@github.com:example/repo.git"),
        respond: () => Effect.fail(YeetCommandError.make({ message: "offline" })),
      });
      const transient = yield* withGoalCompletionIo(readGoalCloseoutCheck(root, "demo", closeoutManifest)).pipe(
        Effect.provideService(GoalCompletionIo, failing)
      );
      assertSome(
        O.map(transient, (check) => check.outcome),
        "transient"
      );
    })
  );

  const liveReads: Array<string> = [];
  it.layer(
    GoalCloseoutCheckerLive.pipe(
      Layer.provide(
        Layer.succeed(
          GoalCompletionIo,
          recordingIo(pullBody({ merged: false, state: "closed", mergedAt: null }), liveReads)
        )
      )
    ),
    { timeout: "20 seconds" }
  )("the live layer", (it) => {
    it.effect("reads through the port it was built with", () =>
      Effect.gen(function* () {
        const root = yield* temporaryWorkingDirectory;
        const live = yield* GoalCloseoutChecker.use((checker) => checker.check(root, "demo", closeoutManifest));
        assertSome(
          O.map(live, (check) => check.outcome),
          "unverified"
        );
        expect(liveReads).toEqual([`repos/{owner}/{repo}/pulls/${FINAL}`]);
      })
    );
  });

  const fixed = GoalCloseoutCheck.make({ packet: "demo", finalPullRequest: FINAL, outcome: "beyond-window" });
  it.layer(GoalCloseoutChecker.layerTest([fixed]), { timeout: "20 seconds" })("the test layer", (it) => {
    it.effect("returns the fixed check for the slug, and readGoalCloseoutCheck prefers it", () =>
      Effect.gen(function* () {
        const root = yield* temporaryWorkingDirectory;
        const provided = yield* readGoalCloseoutCheck(root, "demo", closeoutManifest);
        assertSome(provided, fixed);
        const other = yield* readGoalCloseoutCheck(root, "other", closeoutManifest);
        assertNone(other);
      })
    );
  });
});

const SHARD = goalCloseoutShard("demo", FINAL);
const update = (patch: Partial<Pick<GoalCloseoutShardUpdate, "boundFinal" | "exitCode">> = {}) =>
  GoalCloseoutShardUpdate.make({
    slug: "demo",
    boundFinal: O.some(FINAL),
    exitCode: O.some(0),
    headSha: "main-head",
    label: "[test] closeout goals/demo",
    ...patch,
  });
const raise = (root: string, shard: string) =>
  recordYeetLocalShardOutcome(
    root,
    YeetLocalShardOutcome.make({ command: goalCloseoutRefreshCommand("demo"), exitCode: 1, headSha: "old", shard })
  );
// Each closeout-like row in the checkout's inbox with whether it is acknowledged, in append order.
const closeoutRows = (root: string) =>
  Effect.map(loadYeetInboxView(root), (view) =>
    A.filterMap(view.entries, (entry) =>
      entry.row.kind === "local-shard-failed"
        ? Result.succeed([entry.row.capsule.shard, entry.ack.acked])
        : Result.failVoid
    )
  );

it.layer(Layer.mergeAll(NodeTestLayer, TestConsole.layer), { timeout: "20 seconds" })(
  "updateGoalCloseoutShards",
  (it) => {
    it.effect("raises and acknowledges the bound final's row and acknowledges superseded finals' rows", () =>
      Effect.gen(function* () {
        const root = yield* temporaryWorkingDirectory;
        yield* raise(root, goalCloseoutShard("demo", 5));
        yield* raise(root, goalCloseoutShard("demo-two", 5));
        // A blocking exit raises the bound final's row and supersedes #5's.
        const raised = yield* updateGoalCloseoutShards(root, update({ exitCode: O.some(1) }));
        expect(raised).toEqual([goalCloseoutShard("demo", 5)]);
        const afterRaise = yield* closeoutRows(root);
        expect(afterRaise).toEqual([
          ["goal-closeout:demo#5", true],
          ["goal-closeout:demo-two#5", false],
          [SHARD, false],
        ]);
        // No exit leaves the bound final's row open.
        const untouched = yield* updateGoalCloseoutShards(root, update({ exitCode: O.none() }));
        expect(untouched).toEqual([]);
        const afterNone = yield* closeoutRows(root);
        expect(A.map(afterNone, ([, acked]) => acked)).toEqual([true, false, false]);
        // A packet that binds no final any more supersedes every row it still has open.
        const reopened = yield* updateGoalCloseoutShards(root, update({ boundFinal: O.none(), exitCode: O.some(0) }));
        expect(reopened).toEqual([SHARD]);
        const afterReopen = yield* closeoutRows(root);
        expect(A.map(afterReopen, ([, acked]) => acked)).toEqual([true, false, true]);
      })
    );

    it.effect("reports an inbox it cannot write and never fails", () =>
      Effect.gen(function* () {
        const root = yield* temporaryWorkingDirectory;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        // A file where the inbox directory belongs makes every write fail.
        yield* fs.makeDirectory(path.join(root, ".beep"), { recursive: true });
        yield* fs.writeFileString(path.join(root, ".beep", "inbox"), "not a directory\n");
        const superseded = yield* updateGoalCloseoutShards(root, update({ exitCode: O.some(1) }));
        expect(superseded).toEqual([]);
        const errors = yield* TestConsole.errorLines;
        assertTrue(
          A.some(errors, (line) =>
            Str.startsWith("[test] closeout goals/demo: could not update the closeout inbox row:")(String(line))
          )
        );
      })
    );
  }
);
