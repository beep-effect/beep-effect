import {
  decideGoalCompletionEvidence,
  describeGoalCompletionEvidence,
  GoalCompletionEvidenceInput,
  GoalCompletionIo,
  GoalCompletionReceipt,
  GoalManifest,
  GoalMergeTimeEvidence,
  GoalMergeTimeEvidenceProvider,
  GoalMergeTimeEvidenceProviderLive,
  GoalMergeTimeEvidenceRequest,
  GoalObservedCheckRun,
  GoalPullRequestRef,
  GoalRedAttributionClaim,
  goalCompletionIo,
  layerGoalCompletionReceiptStoreMemory,
  observeGoalCompletion,
  storedGoalCompletion,
} from "@beep/repo-cli/test/Goals";
import { YeetCommandError } from "@beep/repo-cli/test/Yeet";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { NodeTestLayer, temporaryWorkingDirectory, writeProjectFile } from "./support/CommandTest.ts";
import { completionIoFixture } from "./support/CompletionIo.ts";
import type {
  GoalCompletionEvidenceVerdict,
  GoalRequiredCheckFact,
  GoalRequiredCheckSnapshot,
} from "@beep/repo-cli/test/Goals";

// Recorded read-only GitHub REST responses for PR #1429 (see the fixture's
// provenance field). Tests mutate copies of these payloads; none reach GitHub.
const RecordedRun = S.Struct({
  id: S.Finite,
  name: S.NonEmptyString,
  status: S.String,
  conclusion: S.NullOr(S.String),
  head_sha: S.NonEmptyString,
  started_at: S.NullOr(S.String),
  completed_at: S.NullOr(S.String),
});
const RecordedEvaluation = S.Struct({
  rule_source: S.Struct({ type: S.String, id: S.NullOr(S.Int), name: S.NullOr(S.String) }),
  enforcement: S.String,
  result: S.String,
  rule_type: S.String,
});
const Recorded = S.Struct({
  provenance: S.String,
  pull: S.Struct({
    number: S.Int,
    created_at: S.String,
    merged: S.Boolean,
    merged_at: S.String,
    merge_commit_sha: S.String,
    head: S.Struct({ sha: S.String }),
    base: S.Struct({ ref: S.String, repo: S.Struct({ full_name: S.String }) }),
  }),
  mergeCommit: S.Unknown,
  rulesets: S.Struct({ id: S.Int, source_type: S.String, created_at: S.String }).pipe(S.Array, S.Array),
  ruleSuites: S.Struct({ id: S.Int, ref: S.String, after_sha: S.String }).pipe(S.Array, S.Array),
  ruleSuite: S.Struct({
    id: S.Int,
    ref: S.String,
    after_sha: S.String,
    pushed_at: S.String,
    result: S.String,
    rule_evaluations: S.Array(RecordedEvaluation),
  }),
  history: S.Struct({ version_id: S.Int, updated_at: S.String }).pipe(S.Array, S.Array),
  version: S.Unknown,
  checkRuns: S.Array(S.Struct({ check_runs: S.Array(RecordedRun) })),
});
type Recorded = typeof Recorded.Type;
type RecordedRunType = typeof RecordedRun.Type;
type RecordedEvaluationType = typeof RecordedEvaluation.Type;

const encode = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);
const decodeRecorded = S.decodeUnknownEffect(S.fromJsonString(Recorded));
const decodeGoalManifest = S.decodeEffect(GoalManifest);
const encodeGoalManifestJson = S.encodeEffect(S.fromJsonString(GoalManifest));
const encodeReceiptJson = S.encodeEffect(S.fromJsonString(GoalCompletionReceipt));
const decodeRuns = S.decodeUnknownEffect(S.Array(GoalObservedCheckRun));

const HEAD = "e9eafb4a6f296ffb5f24a5b5cf610624199c43c3";
const MERGE = "2f2426b695ff2d082443dceb484a40c0c41c1b77";
const SUITE = 4377188695;
const final = GoalPullRequestRef.make({ number: 1429, role: "final" });

const recorded = Effect.fn("CompletionEvidenceTest.recorded")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const text = yield* fs.readFileString(
    path.join(import.meta.dirname, "fixtures", "goals-completion-evidence", "pr-1429.json")
  );
  return yield* decodeRecorded(text);
});

const manifest = () =>
  decodeGoalManifest({
    initiative: { id: "demo", packetId: "packet-demo", status: "completed-retained" },
    completionGate: {
      operator: "yeet",
      requiresPullRequest: true,
      requiresMergeable: true,
      statement: "Ship via yeet",
      grandfathered: false,
      pullRequests: [{ number: 1429, role: "final" }],
    },
  });

const deletedRulesetEvaluation: RecordedEvaluationType = {
  rule_source: { type: "ruleset", id: 999, name: "deleted-security" },
  enforcement: "deleted ruleset",
  result: "pass",
  rule_type: "required_status_checks",
};

type Overrides = {
  readonly fail?: (endpoint: string) => boolean;
  readonly data?: (data: Recorded) => Recorded;
  readonly deletedHistory?: boolean;
  readonly deletedVersion?: (version: unknown) => unknown;
};

const recordedIo = (data: Recorded, acceptedText: string, overrides: Overrides = {}) => {
  const value = overrides.data === undefined ? data : overrides.data(data);
  return completionIoFixture({
    manifest: Effect.succeed(acceptedText),
    origin: Effect.succeed("git@github.com:beep-effect/beep-effect.git\n"),
    respond: Effect.fn("CompletionEvidenceTest.response")((endpoint: string) => {
      if (overrides.fail?.(endpoint) === true)
        return Effect.fail(YeetCommandError.make({ message: "Recorded network failure" }));
      const ok = (body: unknown) => Effect.succeed(encode(body));
      const missing = Effect.fail(YeetCommandError.make({ message: `Unrecorded endpoint ${endpoint}` }));
      return Match.value(endpoint).pipe(
        Match.when(Str.includes("/pulls/"), () => ok(value.pull)),
        Match.when(Str.includes("/check-runs"), () => ok(value.checkRuns)),
        Match.when(Str.includes("/rulesets/rule-suites/"), () => ok(value.ruleSuite)),
        Match.when(Str.includes("/rulesets/rule-suites?"), () => ok(value.ruleSuites)),
        Match.when(Str.includes("/rulesets/999/history"), () =>
          overrides.deletedHistory === true
            ? Str.includes("/history/")(endpoint)
              ? ok(overrides.deletedVersion === undefined ? value.version : overrides.deletedVersion(value.version))
              : ok(value.history)
            : Effect.fail(YeetCommandError.make({ message: "HTTP 404: deleted ruleset history" }))
        ),
        Match.when(Str.includes("/history/"), () => ok(value.version)),
        Match.when(Str.includes("/history?"), () => ok(value.history)),
        Match.when(Str.includes("/rulesets?"), () => ok(value.rulesets)),
        Match.when(Str.includes(`/commits/${MERGE}`), () => ok(value.mergeCommit)),
        Match.orElse(() => missing)
      );
    }),
  });
};

const withRuns =
  (update: (runs: ReadonlyArray<RecordedRunType>) => ReadonlyArray<RecordedRunType>) =>
  (data: Recorded): Recorded => ({
    ...data,
    checkRuns: [{ check_runs: update(A.flatMap(data.checkRuns, (page) => page.check_runs)) }],
  });
const withEvaluations =
  (update: (evaluations: ReadonlyArray<RecordedEvaluationType>) => ReadonlyArray<RecordedEvaluationType>) =>
  (data: Recorded): Recorded => ({
    ...data,
    ruleSuite: { ...data.ruleSuite, rule_evaluations: update(data.ruleSuite.rule_evaluations) },
  });

const observe = Effect.fn("CompletionEvidenceTest.observe")(function* (overrides: Overrides = {}) {
  const data = yield* recorded();
  const value = yield* manifest();
  const text = yield* encodeGoalManifestJson(value);
  return yield* observeGoalCompletion(process.cwd(), "demo", value, final).pipe(
    Effect.provideService(GoalCompletionIo, recordedIo(data, text, overrides))
  );
});

const gapsOf = (receipt: GoalCompletionReceipt) =>
  O.getOrElse(
    O.map(receipt.requiredChecks, (snapshot) => snapshot.gaps),
    A.empty
  );

const DECISION = "goals/demo/decisions/2026-11-14-final-merged-over-reds.md";

const attribution = (context: string, overrides: Partial<GoalRedAttributionClaim> = {}) =>
  GoalRedAttributionClaim.make({
    context,
    attribution: "inherited",
    fixPullRequest: 2994,
    decisionFile: DECISION,
    source: "origin-main",
    ...overrides,
  });

// The pure verdict over an observed receipt's stored facts, with the given claims.
const verdictOf = (
  receipt: GoalCompletionReceipt,
  redAttributions: ReadonlyArray<GoalRedAttributionClaim> = []
): GoalCompletionEvidenceVerdict =>
  decideGoalCompletionEvidence(
    GoalCompletionEvidenceInput.make({
      acceptedHead: receipt.acceptedHead,
      mergeCommit: O.map(receipt.merge, (merge) => merge.mergeCommit),
      requiredChecks: receipt.requiredChecks,
      facts: receipt.requiredCheckFacts,
      redAttributions,
    })
  );

const factOf = (receipt: GoalCompletionReceipt, context: string): O.Option<GoalRequiredCheckFact> =>
  A.findFirst(receipt.requiredCheckFacts, (fact) => fact.context === context);

const lintRun = (runs: ReadonlyArray<RecordedRunType>): RecordedRunType =>
  O.getOrThrow(A.findFirst(runs, (run) => run.name === "Lint"));

const MERGED_AT = DateTime.makeUnsafe("2026-10-06T00:55:25Z");

const ReceiptStoreTestLayer = Layer.mergeAll(NodeTestLayer, layerGoalCompletionReceiptStoreMemory);

it.layer(ReceiptStoreTestLayer, { timeout: "30 seconds" })("goal merge-time completion evidence", (it) => {
  it.effect("verifies complete recorded evidence bound to the accepted head", () =>
    Effect.gen(function* () {
      const receipt = yield* observe();
      expect(receipt.outcome).toBe("verified");
      expect(A.length(receipt.requiredCheckFacts)).toBe(16);
      expect(A.every(receipt.requiredCheckFacts, (fact) => fact.head === HEAD && fact.outcome === "verified")).toBe(
        true
      );
      assertSome(
        O.map(receipt.requiredChecks, (snapshot) => snapshot.inventoryComplete),
        true
      );
      assertSome(
        O.flatMap(receipt.requiredChecks, (snapshot) => O.map(snapshot.mergeTimeInventory, (value) => value.source)),
        `repos/{owner}/{repo}/rulesets/rule-suites/${SUITE}`
      );
      assertSome(
        O.map(receipt.requiredChecks, (snapshot) => snapshot.sources),
        ["repos/{owner}/{repo}/rulesets/10240248/history/50918272"]
      );
    })
  );
  it.effect("a rule suite repeated across listing pages is still one suite", () =>
    Effect.gen(function* () {
      const receipt = yield* observe({
        data: (data) => ({ ...data, ruleSuites: [...data.ruleSuites, ...data.ruleSuites] }),
      });
      expect(receipt.outcome).toBe("verified");
    })
  );
  it.effect("non-required reds keep merge-time and final conclusions without blocking completion", () =>
    Effect.gen(function* () {
      const extra = (id: number, name: string, overrides: Partial<RecordedRunType>): RecordedRunType => ({
        id,
        name,
        status: "completed",
        conclusion: "failure",
        head_sha: HEAD,
        started_at: "2026-10-06T00:30:00Z",
        completed_at: "2026-10-06T00:40:00Z",
        ...overrides,
      });
      const receipt = yield* observe({
        data: withRuns((runs) => [
          ...runs,
          extra(1, "Coverage", { completed_at: "2026-10-06T01:10:00Z" }),
          extra(2, "Lint Policy", { started_at: "2026-10-06T01:30:00Z", completed_at: "2026-10-06T01:40:00Z" }),
          extra(3, "Odd", { conclusion: "mystery" }),
          extra(4, "Queued", { status: "queued", conclusion: null, completed_at: null }),
          extra(5, "Green", { conclusion: "success" }),
        ]),
      });
      expect(receipt.outcome).toBe("verified");
      expect(A.map(receipt.nonRequiredReds, (red) => [red.lane, red.conclusionAtMerge, red.conclusionFinal])).toEqual([
        ["Coverage", "pending", "failure"],
        ["Lint Policy", "unknown", "failure"],
        ["Odd", "unknown", "unknown"],
        ["Queued", "pending", "pending"],
      ]);
    })
  );
  it.effect("a head-bound required red is unsatisfied", () =>
    Effect.gen(function* () {
      const receipt = yield* observe({
        data: withRuns(A.map((run) => (run.name === "Lint" ? { ...run, conclusion: "failure" } : run))),
      });
      expect(receipt.outcome).toBe("unsatisfied");
    })
  );
  it.effect("a head-bound required red attributed by a claim verifies and lists the red", () =>
    Effect.gen(function* () {
      const receipt = yield* observe({
        data: withRuns(A.map((run) => (run.name === "Lint" ? { ...run, conclusion: "failure" } : run))),
      });
      const verdict = verdictOf(receipt, [attribution("Lint")]);
      expect(verdict._tag).toBe("verified");
      if (verdict._tag !== "verified") return;
      expect(A.length(verdict.facts)).toBe(16);
      expect(verdict.ruleSuiteBypassed).toBe(false);
      expect(
        A.map(verdict.attributedReds, (red) => [red.context, red.observed, red.conclusion, red.attribution])
      ).toEqual([["Lint", "red", "failure", "inherited"]]);
      assertSome(A.head(A.map(verdict.attributedReds, (red) => red.checkRunId)), O.some(112045092048));
      expect(describeGoalCompletionEvidence(verdict)).toContain(`attributed: Lint (inherited, fix #2994, ${DECISION})`);
      const unrelated = verdictOf(receipt, [attribution("Knip")]);
      expect(unrelated._tag).toBe("unsatisfied");
      if (unrelated._tag === "unsatisfied") expect(A.map(unrelated.reds, (red) => red.context)).toEqual(["Lint"]);
    })
  );
  it.effect("a conflicting claim does not attribute; agreeing claims collapse to the strongest source", () =>
    Effect.gen(function* () {
      const receipt = yield* observe({
        data: withRuns(A.map((run) => (run.name === "Lint" ? { ...run, conclusion: "failure" } : run))),
      });
      const conflicting = verdictOf(receipt, [
        attribution("Lint"),
        attribution("Lint", { attribution: "introduced", decisionFile: "goals/demo/decisions/other.md" }),
      ]);
      expect(conflicting._tag).toBe("unsatisfied");
      const fixDiffers = verdictOf(receipt, [attribution("Lint"), attribution("Lint", { fixPullRequest: 3000 })]);
      expect(fixDiffers._tag).toBe("unsatisfied");
      const agreeing = verdictOf(receipt, [
        attribution("Lint", { source: "working-tree", decisionFile: "goals/demo/decisions/draft.md" }),
        attribution("Lint", { source: "head", decisionFile: "goals/demo/decisions/head.md" }),
        attribution("Lint"),
      ]);
      expect(agreeing._tag).toBe("verified");
      if (agreeing._tag === "verified")
        expect(A.map(agreeing.attributedReds, (red) => [red.source, red.decisionFile])).toEqual([
          ["origin-main", DECISION],
        ]);
    })
  );
  it.effect("a never-reported required context covered by a claim verifies; a pending one does not", () =>
    Effect.gen(function* () {
      const missing = yield* observe({ data: withRuns(A.filter((run) => run.name !== "Knip")) });
      expect(missing.outcome).toBe("unknown");
      expect(verdictOf(missing)._tag).toBe("unknown");
      const covered = verdictOf(missing, [attribution("Knip", { attribution: "introduced" })]);
      expect(covered._tag).toBe("verified");
      if (covered._tag === "verified") {
        expect(A.map(covered.attributedReds, (red) => [red.context, red.observed, red.conclusion])).toEqual([
          ["Knip", "missing", "unknown"],
        ]);
        expect(A.map(covered.attributedReds, (red) => O.isNone(red.checkRunId))).toEqual([true]);
        expect(describeGoalCompletionEvidence(covered)).toContain("Knip (never reported, introduced, fix #2994");
        expect(describeGoalCompletionEvidence(covered)).toContain("15 green required contexts");
      }
      const pending = yield* observe({
        data: withRuns(
          A.map((run) =>
            run.name === "Knip" ? { ...run, status: "in_progress", conclusion: null, completed_at: null } : run
          )
        ),
      });
      assertSome(
        O.map(factOf(pending, "Knip"), (fact) => fact.conclusion),
        "pending"
      );
      const stillRunning = verdictOf(pending, [attribution("Knip")]);
      expect(stillRunning._tag).toBe("unknown");
      if (stillRunning._tag === "unknown") expect(stillRunning.gaps).toEqual(["required-check-unobserved"]);
    })
  );
  it.effect("gaps win over attributions: an attributed red without a rule suite stays unknown", () =>
    Effect.gen(function* () {
      const receipt = yield* observe({
        data: flow(
          withRuns(A.map((run) => (run.name === "Lint" ? { ...run, conclusion: "failure" } : run))),
          (data) => ({ ...data, ruleSuites: [[]] })
        ),
      });
      expect(verdictOf(receipt)._tag).toBe("unsatisfied");
      const attributed = verdictOf(receipt, [attribution("Lint")]);
      expect(attributed._tag).toBe("unknown");
      if (attributed._tag === "unknown") expect(attributed.gaps).toContain("rule-suite-unavailable");
    })
  );
  it.effect("skipped and neutral required conclusions count as success", () =>
    Effect.forEach(
      ["skipped", "neutral"],
      Effect.fn("CompletionEvidenceTest.successfulConclusion")(function* (conclusion) {
        const receipt = yield* observe({
          data: withRuns(A.map((run) => (run.name === "Lint" ? { ...run, conclusion } : run))),
        });
        expect(receipt.outcome).toBe("verified");
        assertSome(
          O.map(factOf(receipt, "Lint"), (fact) => fact.conclusion),
          conclusion
        );
      })
    )
  );
  it.effect("the newest run on the accepted head binds, whenever it ran", () =>
    Effect.gen(function* () {
      // Pending at merge, then green: it counts by its eventual conclusion.
      const finishedLater = yield* observe({
        data: withRuns(A.map((run) => (run.name === "Lint" ? { ...run, completed_at: "2026-10-06T01:10:00Z" } : run))),
      });
      expect(finishedLater.outcome).toBe("verified");
      const rerun = (overrides: Partial<RecordedRunType>) =>
        withRuns((runs) =>
          A.append(A.fromIterable(runs), {
            ...lintRun(runs),
            id: lintRun(runs).id + 1,
            started_at: "2026-10-06T01:30:00Z",
            completed_at: "2026-10-06T01:40:00Z",
            ...overrides,
          })
        );
      // A rerun after the merge supersedes the result before it.
      const postMergeRed = yield* observe({ data: rerun({ conclusion: "failure" }) });
      expect(postMergeRed.outcome).toBe("unsatisfied");
      // A run still in progress is pending: unknown, never green or red.
      const running = yield* observe({ data: rerun({ status: "in_progress", conclusion: null, completed_at: null }) });
      expect(running.outcome).toBe("unknown");
      assertSome(
        O.map(factOf(running, "Lint"), (fact) => [fact.conclusion, fact.outcome]),
        ["pending", "unknown"]
      );
    })
  );
  it.effect("a merge older than the rule-suite listing window skips the listing", () =>
    Effect.gen(function* () {
      // The layer's test clock is shared with the cases after this one.
      const start = yield* Clock.currentTimeMillis;
      yield* Effect.addFinalizer(() => TestClock.setTime(start));
      const at = (days: number) => MERGED_AT.pipe(DateTime.add({ days }), DateTime.toEpochMillis, TestClock.setTime);
      yield* at(30);
      expect((yield* observe()).outcome).toBe("verified");
      yield* at(32);
      const stale = yield* observe();
      expect(stale.outcome).toBe("unknown");
      expect(gapsOf(stale)).toContain("rule-suite-unavailable");
      // A listing read would fail here; past the window it is never made.
      const unread = yield* observe({ fail: Str.includes("/rulesets/rule-suites") });
      expect(gapsOf(unread)).toContain("rule-suite-unavailable");
      expect(gapsOf(unread)).not.toContain("network-failure");
    })
  );
  it.effect("a failed required-status-checks evaluation with every context green verifies as bypassed", () =>
    Effect.gen(function* () {
      const receipt = yield* observe({
        data: flow(
          withEvaluations(
            A.map((evaluation) =>
              evaluation.rule_type === "required_status_checks" ? { ...evaluation, result: "fail" } : evaluation
            )
          ),
          (data) => ({ ...data, ruleSuite: { ...data.ruleSuite, result: "bypass" } })
        ),
      });
      expect(receipt.outcome).toBe("verified");
      const verdict = verdictOf(receipt);
      expect(verdict._tag === "verified" && verdict.ruleSuiteBypassed).toBe(true);
      expect(describeGoalCompletionEvidence(verdict)).toContain("bypassed");
      const red = yield* observe({
        data: flow(
          withEvaluations(
            A.map((evaluation) =>
              evaluation.rule_type === "required_status_checks" ? { ...evaluation, result: "fail" } : evaluation
            )
          ),
          withRuns(A.map((run) => (run.name === "Lint" ? { ...run, conclusion: "failure" } : run)))
        ),
      });
      const unattributed = verdictOf(red);
      expect(unattributed._tag === "unsatisfied" && unattributed.ruleSuiteRed).toBe(true);
    })
  );
  it.effect("any network failure is unknown, never green", () =>
    Effect.forEach(
      ["/rulesets/rule-suites?", "/rulesets/rule-suites/", "/rulesets?", "/history?", "/check-runs"],
      Effect.fn("CompletionEvidenceTest.networkFailure")(function* (failing) {
        const receipt = yield* observe({ fail: Str.includes(failing) });
        expect(receipt.outcome).toBe("unknown");
      })
    )
  );
  it.effect("a deleted ruleset without recoverable history is unknown", () =>
    Effect.gen(function* () {
      const receipt = yield* observe({ data: withEvaluations(A.append(deletedRulesetEvaluation)) });
      expect(receipt.outcome).toBe("unknown");
      expect(gapsOf(receipt)).toContain("deleted-ruleset-unrecoverable");
      assertSome(
        O.map(receipt.requiredChecks, (snapshot) => snapshot.inventoryComplete),
        false
      );
    })
  );
  it.effect("a failed check from a deleted ruleset that history shows gated the merge is a bypass, not a red", () =>
    Effect.gen(function* () {
      const failedDeleted = withEvaluations(A.append({ ...deletedRulesetEvaluation, result: "fail" }));
      const complete = yield* observe({ data: failedDeleted, deletedHistory: true });
      expect(complete.outcome).toBe("verified");
      const verdict = verdictOf(complete);
      expect(verdict._tag === "verified" && verdict.ruleSuiteBypassed).toBe(true);
      const partial = yield* observe({
        data: flow(failedDeleted, withRuns(A.filter((run) => run.name !== "Knip"))),
        deletedHistory: true,
      });
      expect(partial.outcome).toBe("unknown");
      const unrecoverable = yield* observe({ data: failedDeleted });
      expect(unrecoverable.outcome).toBe("unknown");
      expect(gapsOf(unrecoverable)).toContain("deleted-ruleset-unrecoverable");
    })
  );
  it.effect("a deleted ruleset that history shows was in evaluate mode does not block", () =>
    Effect.gen(function* () {
      const receipt = yield* observe({
        data: withEvaluations(A.append({ ...deletedRulesetEvaluation, result: "fail" })),
        deletedHistory: true,
        deletedVersion: (version: unknown) => ({
          state: { ...(version as { readonly state: object }).state, enforcement: "evaluate" },
        }),
      });
      expect(receipt.outcome).toBe("verified");
      expect(gapsOf(receipt)).toEqual([]);
    })
  );
  it.effect("an inactive or non-matching recovered version contradicts the rule suite and is never verified", () =>
    Effect.forEach(
      [
        (version: unknown) => ({
          state: {
            ...(version as { readonly state: object }).state,
            conditions: { ref_name: { include: ["refs/heads/release"], exclude: [] } },
          },
        }),
        (version: unknown) => ({
          state: { ...(version as { readonly state: object }).state, enforcement: "disabled" },
        }),
        (version: unknown) => ({
          state: { ...(version as { readonly state: object }).state, target: "tag" },
        }),
      ],
      Effect.fn("CompletionEvidenceTest.conflictingDeleted")(function* (deletedVersion) {
        yield* Effect.forEach(
          ["fail", "pass"],
          Effect.fn("CompletionEvidenceTest.conflictingDeletedResult")(function* (result) {
            const receipt = yield* observe({
              data: withEvaluations(A.append({ ...deletedRulesetEvaluation, result })),
              deletedHistory: true,
              deletedVersion,
            });
            expect(receipt.outcome).toBe("unknown");
            expect(gapsOf(receipt)).toContain("inventory-mismatch");
          })
        );
      })
    )
  );
  it.effect("a deleted ruleset whose history GitHub still serves is recovered", () =>
    Effect.gen(function* () {
      const receipt = yield* observe({
        data: withEvaluations(A.append(deletedRulesetEvaluation)),
        deletedHistory: true,
      });
      expect(receipt.outcome).toBe("verified");
      assertSome(
        O.map(receipt.requiredChecks, (snapshot) =>
          A.contains(snapshot.sources, "repos/{owner}/{repo}/rulesets/999/history/50918272")
        ),
        true
      );
    })
  );
  it.effect(
    "partial inventory is unknown: missing rule suite, unevaluated ruleset, unsupported source, missing check",
    () =>
      Effect.gen(function* () {
        const noSuite = yield* observe({ data: (data) => ({ ...data, ruleSuites: [[]] }) });
        expect(noSuite.outcome).toBe("unknown");
        expect(gapsOf(noSuite)).toContain("rule-suite-unavailable");
        const unevaluated = yield* observe({
          data: withEvaluations(A.filter((evaluation) => evaluation.rule_type !== "required_status_checks")),
        });
        expect(unevaluated.outcome).toBe("unknown");
        expect(gapsOf(unevaluated)).toContain("inventory-mismatch");
        const classic = yield* observe({
          data: withEvaluations(
            A.append({
              rule_source: { type: "protected_branch", id: null, name: null },
              enforcement: "active",
              result: "pass",
              rule_type: "required_status_checks",
            })
          ),
        });
        expect(classic.outcome).toBe("unknown");
        expect(gapsOf(classic)).toContain("unsupported-rule-source");
        const inherited = yield* observe({
          data: (data) => ({
            ...data,
            rulesets: [A.map(A.flatten(data.rulesets), (ruleset) => ({ ...ruleset, source_type: "Organization" }))],
          }),
        });
        expect(inherited.outcome).toBe("unknown");
        expect(gapsOf(inherited)).toContain("unsupported-rule-source");
        const missingCheck = yield* observe({ data: withRuns(A.filter((run) => run.name !== "Knip")) });
        expect(missingCheck.outcome).toBe("unknown");
        const ambiguous = yield* observe({
          data: (data) => ({
            ...data,
            ruleSuites: [[...A.flatten(data.ruleSuites), { id: SUITE + 1, ref: "refs/heads/main", after_sha: MERGE }]],
          }),
        });
        expect(ambiguous.outcome).toBe("unknown");
        expect(gapsOf(ambiguous)).toContain("inventory-mismatch");
      })
  );
  it.effect("history that no longer applies, or has no version at merge, cannot complete the inventory", () =>
    Effect.gen(function* () {
      const disabled = yield* observe({
        data: (data) => ({
          ...data,
          version: { state: { ...(data.version as { readonly state: object }).state, enforcement: "disabled" } },
        }),
      });
      expect(disabled.outcome).toBe("unknown");
      expect(gapsOf(disabled)).toContain("inventory-mismatch");
      const laterOnly =
        (createdAt: string) =>
        (data: Recorded): Recorded => ({
          ...data,
          rulesets: [A.map(A.flatten(data.rulesets), (ruleset) => ({ ...ruleset, created_at: createdAt }))],
          history: [[{ version_id: 1, updated_at: "2026-10-07T00:00:00Z" }]],
        });
      const unversioned = yield* observe({ data: laterOnly("2025-11-20T22:12:15-06:00") });
      expect(unversioned.outcome).toBe("unknown");
      expect(gapsOf(unversioned)).toContain("partial-ruleset-reads");
      const createdLater = yield* observe({ data: laterOnly("2026-10-07T00:00:00Z") });
      expect(createdLater.outcome).toBe("unknown");
      expect(gapsOf(createdLater)).toContain("inventory-mismatch");
    })
  );
  it.effect("an unrecognized completed required conclusion is never green", () =>
    Effect.gen(function* () {
      const receipt = yield* observe({
        data: withRuns(A.map((run) => (run.name === "Lint" ? { ...run, conclusion: "mystery" } : run))),
      });
      expect(receipt.outcome).toBe("unsatisfied");
      assertSome(
        O.map(
          A.findFirst(receipt.requiredCheckFacts, (fact) => fact.context === "Lint"),
          (fact) => fact.conclusion
        ),
        "unknown"
      );
    })
  );
  it.effect("without a provided port the git and gh adapters fail typed, before any network read", () =>
    Effect.gen(function* () {
      const missing = "/nonexistent/beep-completion-evidence";
      const io = yield* goalCompletionIo();
      const spawn = yield* io.originUrl(missing).pipe(Effect.flip);
      expect(spawn._tag).toBe("YeetCommandError");
      const absent = yield* io.manifestAtHead(process.cwd(), "missing-ref", "manifest.json").pipe(Effect.option);
      absent.pipe(O.flatten, assertNone);
      const gh = yield* io.pullRequest(missing, 1).pipe(Effect.flip);
      expect(gh._tag).toBe("YeetCommandError");
    })
  );
  it.effect("a newer complete green run supersedes an older red; a newer red is not hidden", () =>
    Effect.gen(function* () {
      const staleRed = yield* observe({
        data: withRuns((runs) =>
          A.append(
            A.fromIterable(runs),
            O.getOrThrow(
              O.map(
                A.findFirst(runs, (run) => run.name === "Lint"),
                (run) => ({
                  ...run,
                  id: run.id - 1,
                  conclusion: "failure",
                })
              )
            )
          )
        ),
      });
      expect(staleRed.outcome).toBe("verified");
      const newerRed = yield* observe({
        data: withRuns((runs) =>
          A.append(
            A.fromIterable(runs),
            O.getOrThrow(
              O.map(
                A.findFirst(runs, (run) => run.name === "Lint"),
                (run) => ({
                  ...run,
                  id: run.id + 1,
                  conclusion: "failure",
                })
              )
            )
          )
        ),
      });
      expect(newerRed.outcome).toBe("unsatisfied");
    })
  );
  it.effect("a stored stale red receipt yields to a newer complete green receipt", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      const value = yield* manifest();
      const red = yield* observe({
        data: withRuns(A.map((run) => (run.name === "Lint" ? { ...run, conclusion: "failure" } : run))),
      });
      const green = yield* observe();
      const newer = GoalCompletionReceipt.make({
        ...green,
        verifiedAt: DateTime.add(red.verifiedAt, { seconds: 1 }),
      });
      const lines = `${yield* encodeReceiptJson(red)}\n${yield* encodeReceiptJson(newer)}\n`;
      yield* writeProjectFile(".beep/goals/completion-receipts.ndjson", lines);
      const data = yield* recorded();
      const encodedGoalManifestJson = yield* encodeGoalManifestJson(value);
      const io = recordedIo(data, encodedGoalManifestJson);
      const pipe1 = yield* storedGoalCompletion(process.cwd(), "demo", value, final).pipe(
        Effect.provideService(GoalCompletionIo, io)
      );
      assertSome(
        O.map(pipe1, (row) => row.outcome),
        "verified"
      );
    })
  );
  it.effect("a provided evidence provider replaces the live adapter", () =>
    Effect.gen(function* () {
      const data = yield* recorded();
      const value = yield* manifest();
      const text = yield* encodeGoalManifestJson(value);
      const receipt = yield* observeGoalCompletion(process.cwd(), "demo", value, final).pipe(
        Effect.provideService(
          GoalMergeTimeEvidenceProvider,
          GoalMergeTimeEvidenceProvider.of({
            observe: Effect.fn("CompletionEvidenceTest.providerObserve")(() =>
              Effect.succeed(GoalMergeTimeEvidence.make({ requiredChecks: O.none(), facts: [] }))
            ),
          })
        ),
        Effect.provideService(GoalCompletionIo, recordedIo(data, text))
      );
      expect(receipt.outcome).toBe("unknown");
    })
  );
});

// The live provider over recorded GitHub responses: a test layer, so no read reaches GitHub.
const RecordedIoLayer = Layer.effect(
  GoalCompletionIo,
  Effect.map(recorded(), (data) => recordedIo(data, ""))
);
const RecordedProviderLayer = Layer.mergeAll(
  NodeTestLayer,
  GoalMergeTimeEvidenceProviderLive.pipe(Layer.provide(RecordedIoLayer), Layer.provide(NodeTestLayer))
);

const completeInput = Effect.fn("CompletionEvidenceTest.completeInput")(function* () {
  const data = yield* recorded();
  const checkRuns = yield* decodeRuns(A.flatMap(data.checkRuns, (page) => page.check_runs));
  const provider = yield* GoalMergeTimeEvidenceProvider;
  const evidence = yield* provider.observe(
    process.cwd(),
    GoalMergeTimeEvidenceRequest.make({
      base: "main",
      mergeCommit: MERGE,
      mergedAt: DateTime.makeUnsafe(data.pull.merged_at),
      acceptedHead: HEAD,
      checkRuns,
    })
  );
  return GoalCompletionEvidenceInput.make({
    acceptedHead: O.some(HEAD),
    mergeCommit: O.some(MERGE),
    requiredChecks: evidence.requiredChecks,
    facts: evidence.facts,
  });
});

// Verified implies: an inventory bound to the merge commit, no gaps, complete
// reads, a recovered version for every required-check source, and for every
// required context a green fact on the accepted head, or a red or
// never-reported head fact that a claim with the same context attributes.
const verifiedHasCompleteHeadBoundFacts = (input: GoalCompletionEvidenceInput): boolean => {
  const verdict = decideGoalCompletionEvidence(input);
  if (verdict._tag !== "verified") return true;
  const headFacts = (context: string) =>
    A.filter(input.facts, (fact) => fact.context === context && O.contains(input.acceptedHead, fact.head));
  const attributed = (context: string): boolean =>
    A.some(
      verdict.attributedReds,
      (red) =>
        red.context === context &&
        A.some(
          input.redAttributions,
          (claim) =>
            claim.context === context &&
            claim.attribution === red.attribution &&
            claim.fixPullRequest === red.fixPullRequest
        )
    ) && A.some(headFacts(context), (fact) => fact.outcome === "unsatisfied" || O.isNone(fact.checkRunId));
  const green = (context: string): boolean => A.some(headFacts(context), (fact) => fact.outcome === "verified");
  return O.exists(
    input.requiredChecks,
    (snapshot: GoalRequiredCheckSnapshot) =>
      A.isReadonlyArrayEmpty(snapshot.gaps) &&
      snapshot.rulesetReadsComplete &&
      A.isReadonlyArrayNonEmpty(snapshot.contexts) &&
      O.exists(
        snapshot.mergeTimeInventory,
        (inventory) =>
          O.contains(input.mergeCommit, inventory.afterSha) &&
          A.every(
            inventory.ruleSources,
            (source) =>
              source.enforcement === "evaluate" || O.isNone(source.requiredStatusChecks) || O.isSome(source.version)
          )
      ) &&
      A.every(snapshot.contexts, (context) => green(context) || attributed(context)) &&
      (A.isReadonlyArrayNonEmpty(input.redAttributions) || A.isReadonlyArrayEmpty(verdict.attributedReds))
  );
};

it.layer(RecordedProviderLayer, { timeout: "60 seconds" })("goal completion evidence provider layer", (it) => {
  it.effect("the recorded request decodes through the provider schema", () =>
    Effect.gen(function* () {
      const data = yield* recorded();
      const checkRuns = yield* decodeRuns(A.flatMap(data.checkRuns, (page) => page.check_runs));
      const request = GoalMergeTimeEvidenceRequest.make({
        base: "main",
        mergeCommit: MERGE,
        mergedAt: DateTime.makeUnsafe(data.pull.merged_at),
        acceptedHead: HEAD,
        checkRuns,
      });
      const provider = yield* GoalMergeTimeEvidenceProvider;
      const evidence = yield* provider.observe(process.cwd(), request);
      const verdict = decideGoalCompletionEvidence(
        GoalCompletionEvidenceInput.make({
          acceptedHead: O.some(HEAD),
          mergeCommit: O.some(MERGE),
          requiredChecks: evidence.requiredChecks,
          facts: evidence.facts,
        })
      );
      expect(verdict._tag).toBe("verified");
      const elsewhere = decideGoalCompletionEvidence(
        GoalCompletionEvidenceInput.make({
          acceptedHead: O.some(HEAD),
          mergeCommit: O.some("another-merge"),
          requiredChecks: evidence.requiredChecks,
          facts: evidence.facts,
        })
      );
      expect(elsewhere._tag).toBe("unknown");
    })
  );

  it.effect.prop(
    "verified is never produced without complete head-bound facts",
    [Arbitrary.schema(GoalCompletionEvidenceInput)],
    Effect.fnUntraced(function* ([input]) {
      const complete = yield* completeInput();
      const mixes = [
        input,
        GoalCompletionEvidenceInput.make({ ...complete, facts: input.facts }),
        GoalCompletionEvidenceInput.make({ ...complete, requiredChecks: input.requiredChecks }),
        GoalCompletionEvidenceInput.make({ ...complete, acceptedHead: input.acceptedHead }),
        GoalCompletionEvidenceInput.make({ ...complete, mergeCommit: input.mergeCommit }),
        GoalCompletionEvidenceInput.make({ ...complete, facts: A.appendAll(complete.facts, input.facts) }),
        GoalCompletionEvidenceInput.make({ ...complete, redAttributions: input.redAttributions }),
        GoalCompletionEvidenceInput.make({
          ...complete,
          facts: input.facts,
          redAttributions: A.appendAll(
            input.redAttributions,
            A.map(input.facts, (fact) => attribution(fact.context))
          ),
        }),
      ];
      expect(A.every(mixes, verifiedHasCompleteHeadBoundFacts)).toBe(true);
      expect(decideGoalCompletionEvidence(complete)._tag).toBe("verified");
    }),
    { arbitrary: { runs: 40 } }
  );
});
