import {
  GoalCompletionIo,
  GoalCompletionObservation,
  GoalCompletionReceipt,
  GoalCompletionReceiptStore,
  GoalCompletionVerifier,
  GoalInitiative,
  GoalManifest,
  GoalMergeTimeInventory,
  GoalMergeTimeRuleSource,
  GoalPullRequestRef,
  GoalRequiredCheckSnapshot,
  goalCompletionDeclarationDigest,
  goalsCommand,
  layerGoalCompletionReceiptStoreMemory,
  makeGoalCompletionReceiptStoreAt,
  makeGoalCompletionReceiptStoreLive,
  observeGoalCompletion,
  parseGoalManifestText,
  runGoalsDoctor,
  storedGoalCompletion,
} from "@beep/repo-cli/test/Goals";
import { repoRunArtifactId } from "@beep/repo-cli/test/RepoRun";
import { YeetCommandError } from "@beep/repo-cli/test/Yeet";
import { LiteralKit } from "@beep/schema";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import { NodeTestLayer, temporaryWorkingDirectory, writeProjectFile } from "./support/CommandTest.ts";

const decodeGoalManifest = S.decodeEffect(GoalManifest);
const decodeGoalManifestJson = S.decodeEffect(S.fromJsonString(GoalManifest));
const decodeUnknownGoalManifest = S.decodeUnknownEffect(GoalManifest);
const encodeGoalCompletionReceiptJson = S.encodeEffect(S.fromJsonString(GoalCompletionReceipt));
const encodeGoalManifestJson = S.encodeEffect(S.fromJsonString(GoalManifest));

const encode = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);
const HistoricalRulesetFailure = LiteralKit(["organization", "glob", "unreadable"]);
const Scenario = S.Struct({
  partialRuleset: S.optionalKey(HistoricalRulesetFailure),
  base: S.optionalKey(S.NonEmptyString),
  branchPattern: S.optionalKey(S.NonEmptyString),
  defaultExclusion: S.optionalKey(S.Boolean),
  distinctSiblingRed: S.optionalKey(S.Boolean),
  failure: S.optionalKey(S.Boolean),
  merged: S.optionalKey(S.Boolean),
  postMergeRerun: S.optionalKey(S.Boolean),
  preMergePendingRerun: S.optionalKey(S.Boolean),
  missingHistory: S.optionalKey(S.Boolean),
  missingTimeline: S.optionalKey(S.Boolean),
  windowShort: S.optionalKey(S.Boolean),
  mergeParents: S.optionalKey(S.Int),
  red: S.optionalKey(S.Boolean),
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
      pullRequests: [{ number: 7, role: "final" }],
    },
  });
const final = GoalPullRequestRef.make({ number: 7, role: "final" });
const check = (id: number, completed: string, conclusion: string) => ({
  id,
  name: "Lint",
  status: "completed",
  conclusion,
  head_sha: "accepted-head",
  started_at: "2026-10-06T00:00:00Z",
  completed_at: completed,
});
const fixtureIo = (acceptedText: string, scenario: typeof Scenario.Type = {}) =>
  GoalCompletionIo.of({
    git: Effect.fn("GoalCompletionIo.git")((_root: string, args: ReadonlyArray<string>) =>
      Effect.succeed(A.head(args).pipe(O.contains("show")) ? acceptedText : "git@github.com:example/repo.git\n")
    ),
    github: Effect.fn("GoalCompletionIo.github")((_root: string, args: ReadonlyArray<string>) => {
      if (scenario.failure === true)
        return Effect.fail(YeetCommandError.make({ message: "Synthetic network error or rate limit" }));
      const endpoint = O.getOrElse(A.get(args, 1), () => "");
      return Match.value(endpoint).pipe(
        Match.when(Str.includes("pulls/7"), () =>
          Effect.succeed(
            encode({
              number: 7,
              merged: scenario.merged !== false,
              created_at: "2026-10-05T23:00:00Z",
              merged_at: scenario.merged === false ? null : "2026-10-06T01:00:00Z",
              merge_commit_sha: "merge-result",
              head: { sha: "accepted-head" },
              base: { ref: scenario.base ?? "main", repo: { full_name: "example/repo" } },
            })
          )
        ),
        Match.when(Str.includes("check-runs"), () =>
          Effect.succeed(
            encode([
              {
                check_runs: [
                  check(1, "2026-10-06T00:10:00Z", scenario.red === true ? "failure" : "success"),
                  ...(scenario.distinctSiblingRed === true
                    ? [{ ...check(4, "2026-10-06T00:10:00Z", "failure"), name: "Security" }]
                    : []),
                  ...(scenario.postMergeRerun === true
                    ? [{ ...check(2, "2026-10-06T02:00:00Z", "failure"), started_at: "2026-10-06T01:30:00Z" }]
                    : []),
                  ...(scenario.preMergePendingRerun === true ? [check(3, "2026-10-06T02:00:00Z", "failure")] : []),
                ],
              },
            ])
          )
        ),
        Match.when(Str.includes("check-suites"), () =>
          Effect.succeed(encode([{ check_suites: [{ created_at: "2026-10-06T00:00:00Z" }] }]))
        ),
        Match.when(Str.includes("timeline"), () =>
          scenario.missingTimeline === true
            ? Effect.fail(YeetCommandError.make({ message: "Timeline unavailable" }))
            : Effect.succeed(
                encode([
                  [
                    {
                      event: "ready_for_review",
                      created_at: scenario.windowShort === true ? "2026-10-06T00:59:53Z" : "2026-10-06T00:00:00Z",
                    },
                  ],
                ])
              )
        ),
        Match.when(Str.includes("/history/1"), () =>
          Effect.succeed(
            encode({
              state: {
                enforcement: "active",
                target: "branch",
                conditions: {
                  ref_name: {
                    include:
                      HistoricalRulesetFailure.is.glob(scenario.partialRuleset) &&
                      Str.includes("/rulesets/43/")(endpoint)
                        ? ["refs/heads/release/*"]
                        : [scenario.branchPattern ?? "~DEFAULT_BRANCH"],
                    exclude: scenario.defaultExclusion === true ? ["~DEFAULT_BRANCH"] : [],
                  },
                },
                rules: [
                  {
                    type: "required_status_checks",
                    parameters: {
                      strict_required_status_checks_policy: false,
                      required_status_checks: [
                        {
                          context:
                            scenario.distinctSiblingRed === true && Str.includes("/rulesets/43/")(endpoint)
                              ? "Security"
                              : "Lint",
                        },
                      ],
                    },
                  },
                ],
              },
            })
          )
        ),
        Match.when(Str.includes("/history"), () =>
          scenario.missingHistory === true ||
          (HistoricalRulesetFailure.is.unreadable(scenario.partialRuleset) && Str.includes("/rulesets/43/")(endpoint))
            ? Effect.fail(YeetCommandError.make({ message: "History unavailable" }))
            : Effect.succeed(
                encode([
                  [
                    { version_id: 1, updated_at: "2026-10-01T00:00:00Z" },
                    { version_id: 2, updated_at: "2026-10-07T00:00:00Z" },
                  ],
                ])
              )
        ),
        Match.when(Str.includes("rulesets?"), () =>
          Effect.succeed(
            encode([
              [
                { id: 42, source_type: "Repository", created_at: "2026-09-01T00:00:00Z" },
                ...(scenario.partialRuleset === undefined && scenario.distinctSiblingRed !== true
                  ? []
                  : [
                      {
                        id: 43,
                        source_type: HistoricalRulesetFailure.is.organization(scenario.partialRuleset)
                          ? "Organization"
                          : "Repository",
                        created_at: "2026-09-01T00:00:00Z",
                      },
                    ]),
              ],
            ])
          )
        ),
        Match.orElse(() =>
          Effect.succeed(
            encode({
              sha: "merge-result",
              parents:
                scenario.mergeParents === 2
                  ? [{ sha: "parent" }, { sha: "accepted-head" }]
                  : [{ sha: "unrelated-parent" }],
              commit: { tree: { sha: "merge-tree" } },
            })
          )
        )
      );
    }),
  });
const observe = Effect.fn("CompletionTest.observe")(function* (scenario: typeof Scenario.Type = {}) {
  const value = yield* manifest();
  const text = yield* encodeGoalManifestJson(value);
  return yield* observeGoalCompletion(process.cwd(), "demo", value, final).pipe(
    Effect.provideService(GoalCompletionIo, fixtureIo(text, scenario))
  );
});

const completeReceipt = Effect.fn("CompletionTest.completeReceipt")(function* () {
  const receipt = yield* observe();
  const snapshot = O.getOrThrow(receipt.requiredChecks);
  return yield* GoalCompletionVerifier.resolve(
    GoalCompletionObservation.make({
      ...receipt,
      merged: O.some(true),
      grandfathered: false,
      requiredChecks: O.some(
        GoalRequiredCheckSnapshot.make({
          ...snapshot,
          inventoryComplete: true,
          gaps: [],
          mergeTimeInventory: O.some(
            GoalMergeTimeInventory.make({
              source: "repos/{owner}/{repo}/rulesets/rule-suites/1",
              ruleSuiteId: 1,
              ref: "refs/heads/main",
              afterSha: "merge-result",
              pushedAt: receipt.verifiedAt,
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
            })
          ),
        })
      ),
    })
  );
});

const RecoveryFixture = S.Struct({
  root: S.String,
  branch: S.String,
  runId: S.String,
  runRoot: S.String,
  jobsRoot: S.String,
  ref: S.String,
  jobId: S.String,
});
type RecoveryFixture = typeof RecoveryFixture.Type;

const recoveryVerdictFixture = (variant: string, fixture: RecoveryFixture, criteria: typeof readinessCriteria) => {
  const { branch, runId } = fixture;
  return encode({
    schemaVersion: "yeet-verdict/v2",
    base: "origin/main",
    branch,
    committed: true,
    createdAt: "2026-10-06T00:00:00Z",
    head: "HEAD",
    resolvedHeadSha: "accepted-head",
    lanes: [],
    message: "publish succeeded",
    mode: "publish",
    outcome: variant === "failed-verdict" ? "failure" : "success",
    packetPaths: [],
    pushed: true,
    runId,
    ...(variant === "already-ready" ? { mergeReady: { ready: true, criteria } } : {}),
    ...(variant === "explicit-not-ready"
      ? { mergeReady: { ready: false, failing: "pr-open", criteria: { ...criteria, prOpen: false } } }
      : {}),
  });
};
const recoveryRemoteFixture = (variant: string) => ({
  available: true,
  checked: true,
  detail: "PR OPEN",
  number: variant === "wrong-pr" ? 8 : 7,
  headSha: variant === "wrong-head" ? "older-head" : "accepted-head",
  state: "OPEN",
  isDraft: false,
  mergeable: "MERGEABLE",
  mergeStateStatus: "CLEAN",
  unresolvedReviewThreadCount: 0,
  ...(variant === "missing-thread-facts" ? {} : { followUpThreadCount: 0 }),
  optionalCheckCount: 0,
  failingOptionalCheckCount: 0,
  pendingOptionalCheckCount: 0,
  checks: [],
  checkCount: 1,
  requiredCheckCount: 1,
  failingCheckCount: variant === "contradictory-ready" ? 1 : 0,
  pendingCheckCount: 0,
  ...(variant === "missing-check-facts" ? {} : { failingRequiredCheckCount: 0 }),
  pendingRequiredCheckCount: 0,
  reviewWindow: {
    _tag: "elapsed",
    anchor: "head-push",
    anchoredAt: "2026-10-06T00:00:00Z",
    windowMs: 1200000,
  },
});
const recoveryStatusFixture = (variant: string, fixture: RecoveryFixture, criteria: typeof readinessCriteria) => {
  const { branch, runId, runRoot, ref } = fixture;
  return encode({
    schemaVersion: "yeet-status/v1",
    base: "origin/main",
    branch: variant === "wrong-branch" ? "other" : branch,
    createdAt:
      variant === "after-merge"
        ? "2026-10-06T01:01:00Z"
        : variant === "outside-job"
          ? "2026-10-05T23:00:00Z"
          : "2026-10-06T00:40:00Z",
    head: "HEAD",
    runId,
    statusPath: `${runRoot}/status.json`,
    nextCommand: "merge",
    closeout: {
      state: "present",
      path: `${runRoot}/pr-closeout.json`,
      detail: "reviewed",
      issueCount: 0,
      gateIssues: [],
      reviewedHeadSha: variant === "wrong-closeout" ? "older-head" : "accepted-head",
    },
    verdict: { state: "present", path: ref, detail: "published" },
    worktree: { clean: true, staged: 0, unstaged: 0, untracked: 0 },
    mergeReady: {
      ready: variant !== "not-ready",
      ...(variant === "not-ready" ? { failing: "pr-open" } : {}),
      criteria: variant === "not-ready" ? { ...criteria, prOpen: false } : criteria,
    },
    remote: recoveryRemoteFixture(variant),
  });
};
const recoveryJobFixture = (variant: string, fixture: RecoveryFixture) => {
  const { root, branch, jobsRoot, jobId } = fixture;
  const job = {
    schemaVersion: "yeet-proof-job/v1",
    jobId,
    phase: "finished",
    submittedAt: "2026-10-06T00:00:00Z",
    request: {
      mode: "monitor",
      argv: ["monitor", "--until-ready"],
      checkout: root,
      branch,
      base: "origin/main",
      head: "old-submission-head",
      forwardedEnvNames: [],
    },
    submitter: { pid: 1, cwd: root },
    unit: {
      unitName: `beep-proof-${jobId}.service`,
      slice: "agent-runs.slice",
      description: "monitor",
      logPath: `${jobsRoot}/${jobId}.log`,
      execStart: [],
      execStopPost: [],
    },
    runner: { pid: 2, startedAt: "2026-10-06T00:01:00Z" },
    prNumber: 7,
    ...(variant === "missing-finalization"
      ? {}
      : {
          systemd: {
            serviceResult: variant === "failed-finalization" ? "exit-code" : "success",
            exitCode: "exited",
            exitStatus: variant === "failed-finalization" ? "1" : "0",
            finalizedAt: variant === "finalized-after-merge" ? "2026-10-06T01:00:30Z" : "2026-10-06T00:42:00Z",
          },
        }),
    outcome: {
      verdictOutcome: variant === "failed-job" ? "failure" : "success",
      endedAt: "2026-10-06T00:41:00Z",
    },
  };
  return Match.value(variant).pipe(
    Match.when("missing-runner", () => Struct.omit(job, ["runner"])),
    Match.when("unfinished-job", () => ({ ...Struct.omit(job, ["outcome"]), phase: "running" })),
    Match.orElse(() => job),
    encode
  );
};
const recoveryExpectedOutcome = (variant: string) => {
  if (variant === "valid" || variant === "hosted-red" || variant === "already-ready") return "verified";
  return variant === "explicit-not-ready" ? "unsatisfied" : "unknown";
};
const recoveryJobOption = (variant: string, jobId: string) =>
  variant === "without-opt-in" ? O.none<string>() : O.some(variant === "path-escape" ? "../../outside" : jobId);
const readinessCriteria = {
  prOpen: true,
  notDraft: true,
  closeoutRun: true,
  requiredChecksGreen: true,
  threadsResolved: true,
  mergeable: true,
  mergeStateAcceptable: true,
  reviewDecisionAcceptable: true,
  reviewWindowElapsed: true,
};

// A goal verified in one clone must read as verified in every clone, so these
// stores stand in for the workstation directory shared across clones.
const sharedStore = Effect.fn("CompletionTest.sharedStore")(function* (root: string) {
  const path = yield* Path.Path;
  const directory = path.join(root, "workstation-state", "goals");
  return { directory, store: yield* makeGoalCompletionReceiptStoreAt(directory) };
});

const ReceiptStoreTestLayer = Layer.mergeAll(NodeTestLayer, layerGoalCompletionReceiptStoreMemory);

it.layer(ReceiptStoreTestLayer, { timeout: "30 seconds" })("goal completion observations and storage", (it) => {
  it.effect.prop(
    "preserves declaration digests across arbitrary PR-reference codec round trips",
    [Arbitrary.schema(GoalPullRequestRef)],
    Effect.fnUntraced(function* ([reference]) {
      const value = yield* manifest();
      const declared = yield* decodeGoalManifest({
        ...value,
        completionGate: { ...value.completionGate, pullRequests: [reference] },
      });
      const text = yield* encodeGoalManifestJson(declared);
      const decoded = yield* decodeGoalManifestJson(text);
      const goalCompletionDeclarationDigest1 = yield* goalCompletionDeclarationDigest(decoded);
      const expectation = expect(goalCompletionDeclarationDigest1);
      const goalCompletionDeclarationDigest3 = yield* goalCompletionDeclarationDigest(declared);
      expectation.toBe(goalCompletionDeclarationDigest3);
    }),
    { arbitrary: { runs: 32 } }
  );
  it.effect("decodes every live goal manifest without rewriting legacy fields", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const goals = path.resolve(import.meta.dirname, "../../../../../goals");
      const directories = yield* fs.readDirectory(goals);
      let decoded = 0;
      for (const slug of A.filter(directories, (name) => name !== "_template" && !Str.startsWith(".")(name))) {
        if ((yield* fs.stat(path.join(goals, slug))).type !== "Directory") continue;
        const file = path.join(goals, slug, "ops", "manifest.json");
        if (!(yield* fs.exists(file))) continue;
        const text = yield* fs.readFileString(file);
        yield* decodeUnknownGoalManifest(parseGoalManifestText(text).pipe(O.getOrThrow));
        decoded += 1;
      }
      expect(decoded).toBeGreaterThan(0);
    })
  );
  it.effect("retains repository check facts when a sibling parent, glob or history cannot be read", () =>
    Effect.forEach(
      HistoricalRulesetFailure.literals,
      Effect.fn("GoalsCompletionTest.partialRulesets")(function* (partialRuleset) {
        yield* Effect.forEach(
          [true, false],
          Effect.fn("GoalsCompletionTest.partialRulesetCheck")(function* (red) {
            const receipt = yield* observe({ partialRuleset, red });
            expect(receipt.outcome).toBe(red ? "unsatisfied" : "unknown");
            assertSome(
              O.map(receipt.requiredChecks, (snapshot) => snapshot.inventoryComplete),
              false
            );
            assertSome(
              O.map(receipt.requiredChecks, (snapshot) => snapshot.contexts),
              ["Lint"]
            );
            assertSome(
              O.map(receipt.requiredChecks, (snapshot) => snapshot.sources),
              ["repos/{owner}/{repo}/rulesets/42/history/1"]
            );
          })
        );
      })
    )
  );
  it.effect("unresolved non-main default-branch include and exclude tokens fail closed", () =>
    Effect.gen(function* () {
      const included = yield* observe({ base: "develop", red: true });
      expect(included.outcome).toBe("unknown");
      assertNone(included.requiredChecks);
      const excluded = yield* observe({
        base: "develop",
        branchPattern: "~ALL",
        defaultExclusion: true,
        red: true,
      });
      expect(excluded.outcome).toBe("unknown");
      assertNone(excluded.requiredChecks);
    })
  );
  it.effect("non-main explicit refs and all-branch rules retain known required reds", () =>
    Effect.forEach(
      ["refs/heads/develop", "~ALL"],
      Effect.fn("GoalsCompletionTest.nonMainLiteralRules")(function* (branchPattern) {
        const receipt = yield* observe({ base: "develop", branchPattern, red: true });
        expect(receipt.outcome).toBe("unsatisfied");
        assertSome(
          O.map(receipt.requiredChecks, (snapshot) => snapshot.contexts),
          ["Lint"]
        );
        assertSome(
          O.map(receipt.requiredChecks, (snapshot) => snapshot.rulesetReadsComplete),
          true
        );
      })
    )
  );
  it.effect("a rerun pending at merge cannot reuse an older green result", () =>
    Effect.gen(function* () {
      expect((yield* observe({ preMergePendingRerun: true })).outcome).toBe("unknown");
    })
  );
  it.effect("retains squash/rebase merge facts but cannot verify a current-only ruleset inventory", () =>
    Effect.gen(function* () {
      const receipt = yield* observe();
      expect(receipt.outcome).toBe("unknown");
      assertSome(
        O.map(receipt.requiredChecks, (snapshot) => snapshot.inventoryComplete),
        false
      );
      expect(
        A.some(receipt.evidence, (check) => check.ref.kind === "hosted-required-checks" && check.outcome === "verified")
      ).toBe(true);
      assertSome(
        O.map(receipt.merge, (merge) => merge.method),
        O.none()
      );
      assertSome(
        O.map(receipt.requiredChecks, (snapshot) => snapshot.contexts),
        ["Lint"]
      );
      assertSome(
        O.map(receipt.requiredChecks, (snapshot) => snapshot.sources),
        ["repos/{owner}/{repo}/rulesets/42/history/1"]
      );
    })
  );
  it.effect("recognizes a two-parent merge", () =>
    Effect.gen(function* () {
      assertSome(
        O.map((yield* observe({ mergeParents: 2 })).merge, (merge) => merge.method),
        O.some("merge")
      );
    })
  );
  it.effect("retains pre-merge passing context despite a post-merge rerun and incomplete inventory", () =>
    Effect.gen(function* () {
      const receipt = yield* observe({ postMergeRerun: true });
      expect(receipt.outcome).toBe("unknown");
      expect(
        A.some(receipt.evidence, (check) => check.ref.kind === "hosted-required-checks" && check.outcome === "verified")
      ).toBe(true);
    })
  );
  it.effect("a positive required red makes completion unsatisfied", () =>
    Effect.gen(function* () {
      expect((yield* observe({ red: true })).outcome).toBe("unsatisfied");
    })
  );
  it.effect("network or rate-limit failure is unknown", () =>
    Effect.gen(function* () {
      expect((yield* observe({ failure: true })).outcome).toBe("unknown");
    })
  );
  it.effect("unmerged PR is unsatisfied", () =>
    Effect.gen(function* () {
      expect((yield* observe({ merged: false })).outcome).toBe("unsatisfied");
    })
  );
  it.effect("missing historical requirements cannot use today's rules", () =>
    Effect.gen(function* () {
      expect((yield* observe({ missingHistory: true })).outcome).toBe("unknown");
    })
  );
  it.effect("timeline failure leaves the window sub-claim unknown independently of inventory completeness", () =>
    Effect.gen(function* () {
      const receipt = yield* observe({ missingTimeline: true });
      expect(receipt.outcome).toBe("unknown");
      assertSome(
        A.findFirst(receipt.subClaims, (check) => check.ref.ref === "review-window").pipe(
          O.map((check) => check.outcome)
        ),
        "unknown"
      );
    })
  );
  it.effect("seven-second historical window remains unsatisfied without resetting completion", () =>
    Effect.gen(function* () {
      const receipt = yield* observe({ windowShort: true });
      expect(receipt.outcome).toBe("unknown");
      assertSome(
        A.findFirst(receipt.subClaims, (check) => check.ref.ref === "review-window").pipe(
          O.map((check) => check.outcome)
        ),
        "unsatisfied"
      );
    })
  );
  it.effect("packet identity participates in declaration addressing", () =>
    Effect.gen(function* () {
      const value = yield* manifest();
      const changed = GoalManifest.make({
        ...value,
        initiative: GoalInitiative.make({ ...value.initiative, packetId: "different-packet" }),
      });
      const goalCompletionDeclarationDigest2 = yield* goalCompletionDeclarationDigest(value);
      const argument = expect(goalCompletionDeclarationDigest2).not;
      const goalCompletionDeclarationDigest4 = yield* goalCompletionDeclarationDigest(changed);
      argument.toEqual(goalCompletionDeclarationDigest4);
    })
  );
  it.effect("ignores stale PR/digest receipts and a partial tail, then reads a complete matching row", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      const value = yield* manifest();
      const receipt = yield* completeReceipt();
      const correct = yield* encodeGoalCompletionReceiptJson(receipt);
      const stale = yield* encodeGoalCompletionReceiptJson(
        GoalCompletionReceipt.make({ ...receipt, declarationDigest: "old-digest", finalPullRequest: 8 })
      );
      yield* writeProjectFile(".beep/goals/completion-receipts.ndjson", `${stale}\n${correct}`);
      const encodedGoalManifestJson = yield* encodeGoalManifestJson(value);
      const io = fixtureIo(encodedGoalManifestJson);
      const pipe3 = yield* storedGoalCompletion(process.cwd(), "demo", value, final).pipe(
        Effect.provideService(GoalCompletionIo, io)
      );
      assertNone(pipe3);
      const fs = yield* FileSystem.FileSystem;
      yield* fs.writeFileString(".beep/goals/completion-receipts.ndjson", `${stale}\n${correct}\n`);
      const pipe4 = yield* storedGoalCompletion(process.cwd(), "demo", value, final).pipe(
        Effect.provideService(GoalCompletionIo, io)
      );
      assertSome(
        O.map(pipe4, (row) => row.outcome),
        "verified"
      );
    })
  );
  it.effect("revalidates stored verified receipts against incomplete inventory", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      const value = yield* manifest();
      const receipt = yield* observe();
      const staleVerified = GoalCompletionReceipt.make({ ...receipt, outcome: "verified" });
      const text = yield* encodeGoalCompletionReceiptJson(staleVerified);
      yield* writeProjectFile(".beep/goals/completion-receipts.ndjson", `${text}\n`);
      const encodedGoalManifestJson5 = yield* encodeGoalManifestJson(value);
      const io = fixtureIo(encodedGoalManifestJson5);
      const pipe6 = yield* storedGoalCompletion(process.cwd(), "demo", value, final).pipe(
        Effect.provideService(GoalCompletionIo, io)
      );
      assertSome(
        O.map(pipe6, (row) => row.outcome),
        "unknown"
      );
    })
  );
  it.effect("a transient unknown refresh does not displace definite head-bound evidence", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      const value = yield* manifest();
      const receipt = yield* completeReceipt();
      const correct = yield* encodeGoalCompletionReceiptJson(receipt);
      const unknown = yield* encodeGoalCompletionReceiptJson(
        GoalCompletionReceipt.make({
          ...receipt,
          outcome: "unknown",
          evidence: [],
          merge: O.none(),
          acceptedHead: O.none(),
          acceptedDeclarationDigest: O.none(),
          requiredChecks: O.none(),
          verifiedAt: DateTime.add(receipt.verifiedAt, { seconds: 1 }),
        })
      );
      yield* writeProjectFile(".beep/goals/completion-receipts.ndjson", `${correct}\n${unknown}\n`);
      const encodedGoalManifestJson7 = yield* encodeGoalManifestJson(value);
      const io = fixtureIo(encodedGoalManifestJson7);
      const pipe8 = yield* storedGoalCompletion(process.cwd(), "demo", value, final).pipe(
        Effect.provideService(GoalCompletionIo, io)
      );
      assertSome(
        O.map(pipe8, (row) => row.outcome),
        "verified"
      );
    })
  );
  it.effect("newer successful merged observations replace older required-red and pending-rerun receipts", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      const value = yield* manifest();
      const encodedGoalManifestJson9 = yield* encodeGoalManifestJson(value);
      const io = fixtureIo(encodedGoalManifestJson9);
      yield* Effect.forEach(
        [true, false],
        Effect.fn("GoalsCompletionTest.replaceStaleReceipt")(function* (red) {
          const stale = yield* observe({ red, preMergePendingRerun: !red });
          expect(stale.outcome).toBe(red ? "unsatisfied" : "unknown");
          const observed = yield* observe();
          const latest = GoalCompletionReceipt.make({
            ...observed,
            verifiedAt: DateTime.add(stale.verifiedAt, { seconds: 1 }),
          });
          expect(latest.outcome).toBe("unknown");
          latest.merge.pipe(O.isSome, assertTrue);
          const staleText = yield* encodeGoalCompletionReceiptJson(stale);
          const latestText = yield* encodeGoalCompletionReceiptJson(latest);
          yield* writeProjectFile(".beep/goals/completion-receipts.ndjson", `${staleText}\n${latestText}\n`);
          const pipe10 = yield* storedGoalCompletion(process.cwd(), "demo", value, final).pipe(
            Effect.provideService(GoalCompletionIo, io)
          );
          assertSome(pipe10, latest);
        })
      );
    })
  );
  it.effect("degraded merged refreshes retain older positively observed required-red evidence", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      const value = yield* manifest();
      const stale = yield* observe({ red: true });
      expect(stale.outcome).toBe("unsatisfied");
      const staleText = yield* encodeGoalCompletionReceiptJson(stale);
      const encodedGoalManifestJson11 = yield* encodeGoalManifestJson(value);
      const io = fixtureIo(encodedGoalManifestJson11);
      yield* Effect.forEach(
        [{ missingHistory: true }, { preMergePendingRerun: true }],
        Effect.fn("GoalsCompletionTest.retainRequiredRed")(function* (scenario) {
          const observed = yield* observe(scenario);
          const degraded = GoalCompletionReceipt.make({
            ...observed,
            verifiedAt: DateTime.add(stale.verifiedAt, { seconds: 1 }),
          });
          expect(degraded.outcome).toBe("unknown");
          degraded.merge.pipe(O.isSome, assertTrue);
          const degradedText = yield* encodeGoalCompletionReceiptJson(degraded);
          yield* writeProjectFile(".beep/goals/completion-receipts.ndjson", `${staleText}\n${degradedText}\n`);
          const pipe12 = yield* storedGoalCompletion(process.cwd(), "demo", value, final).pipe(
            Effect.provideService(GoalCompletionIo, io)
          );
          assertSome(pipe12, stale);
        })
      );
    })
  );
  it.effect("partial history cannot clear a red required only by the unreadable sibling", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      const value = yield* manifest();
      const stale = yield* observe({ distinctSiblingRed: true });
      expect(stale.outcome).toBe("unsatisfied");
      assertSome(
        O.map(stale.requiredChecks, (snapshot) => snapshot.contexts),
        ["Lint", "Security"]
      );
      assertSome(
        O.map(stale.requiredChecks, (snapshot) => snapshot.rulesetReadsComplete),
        true
      );
      const observed = yield* observe({ distinctSiblingRed: true, partialRuleset: "unreadable" });
      const partial = GoalCompletionReceipt.make({
        ...observed,
        verifiedAt: DateTime.add(stale.verifiedAt, { seconds: 1 }),
      });
      expect(partial.outcome).toBe("unknown");
      assertSome(
        O.map(partial.requiredChecks, (snapshot) => snapshot.contexts),
        ["Lint"]
      );
      assertSome(
        O.map(partial.requiredChecks, (snapshot) => snapshot.rulesetReadsComplete),
        false
      );
      const staleText = yield* encodeGoalCompletionReceiptJson(stale);
      const partialText = yield* encodeGoalCompletionReceiptJson(partial);
      yield* writeProjectFile(".beep/goals/completion-receipts.ndjson", `${staleText}\n${partialText}\n`);
      const encodedGoalManifestJson13 = yield* encodeGoalManifestJson(value);
      const io = fixtureIo(encodedGoalManifestJson13);
      const pipe14 = yield* storedGoalCompletion(process.cwd(), "demo", value, final).pipe(
        Effect.provideService(GoalCompletionIo, io)
      );
      assertSome(pipe14, stale);
    })
  );
  it.effect("a receipt another clone wrote to the shared store is read without a legacy file", () =>
    Effect.gen(function* () {
      const root = yield* temporaryWorkingDirectory;
      const value = yield* manifest();
      const { directory, store } = yield* sharedStore(root);
      const completeReceipt15 = yield* completeReceipt();
      yield* store.append(completeReceipt15);
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const exists16 = yield* fs.exists(path.join(directory, "github.com__example__repo.jsonl"));
      expect(exists16).toBe(true);
      const exists17 = yield* fs.exists(".beep/goals/completion-receipts.ndjson");
      expect(exists17).toBe(false);
      const argument1 = storedGoalCompletion(process.cwd(), "demo", value, final);
      const encodedGoalManifestJson6 = yield* encodeGoalManifestJson(value);
      const pipe18 = yield* argument1.pipe(
        Effect.provideService(GoalCompletionIo, fixtureIo(encodedGoalManifestJson6)),
        Effect.provideService(GoalCompletionReceiptStore, store)
      );
      assertSome(
        O.map(pipe18, (row) => row.outcome),
        "verified"
      );
    })
  );
  it.effect("reads the union of the shared store and the legacy clone file", () =>
    Effect.gen(function* () {
      const root = yield* temporaryWorkingDirectory;
      const value = yield* manifest();
      const encodedGoalManifestJson19 = yield* encodeGoalManifestJson(value);
      const io = fixtureIo(encodedGoalManifestJson19);
      const verified = yield* completeReceipt();
      const path = yield* Path.Path;
      const readOutcome = (store: typeof GoalCompletionReceiptStore.Service) =>
        storedGoalCompletion(process.cwd(), "demo", value, final).pipe(
          Effect.provideService(GoalCompletionIo, io),
          Effect.provideService(GoalCompletionReceiptStore, store),
          Effect.map(O.map((row) => row.outcome))
        );
      const legacyOnly = yield* sharedStore(path.join(root, "legacy-only"));
      yield* writeProjectFile(
        ".beep/goals/completion-receipts.ndjson",
        `${yield* encodeGoalCompletionReceiptJson(verified)}\n`
      );
      const readOutcome20 = yield* readOutcome(legacyOnly.store);
      assertSome(readOutcome20, "verified");
      const newerUnknown = GoalCompletionReceipt.make({
        ...(yield* observe()),
        verifiedAt: DateTime.add(verified.verifiedAt, { seconds: 1 }),
      });
      expect(newerUnknown.outcome).toBe("unknown");
      const sharedVerified = yield* sharedStore(path.join(root, "shared-verified"));
      yield* sharedVerified.store.append(verified);
      yield* writeProjectFile(
        ".beep/goals/completion-receipts.ndjson",
        `${yield* encodeGoalCompletionReceiptJson(newerUnknown)}\n`
      );
      const readOutcome21 = yield* readOutcome(sharedVerified.store);
      assertSome(readOutcome21, "verified");
    })
  );
  it.effect("a newer definite unknown refresh never displaces a verified receipt", () =>
    Effect.gen(function* () {
      const root = yield* temporaryWorkingDirectory;
      const value = yield* manifest();
      const verified = yield* completeReceipt();
      expect(verified.outcome).toBe("verified");
      const degraded = GoalCompletionReceipt.make({
        ...(yield* observe()),
        verifiedAt: DateTime.add(verified.verifiedAt, { seconds: 1 }),
      });
      // Definite: merged, complete ruleset reads, verified hosted required checks; only the yeet verdict is unknown.
      expect(degraded.outcome).toBe("unknown");
      degraded.merge.pipe(O.isSome, assertTrue);
      assertSome(
        O.map(degraded.requiredChecks, (snapshot) => snapshot.rulesetReadsComplete),
        true
      );
      assertTrue(
        A.some(
          degraded.evidence,
          (check) => check.ref.kind === "hosted-required-checks" && check.outcome === "verified"
        )
      );
      const { store } = yield* sharedStore(root);
      yield* store.append(verified);
      yield* store.append(degraded);
      const argument2 = storedGoalCompletion(process.cwd(), "demo", value, final);
      const encodedGoalManifestJson8 = yield* encodeGoalManifestJson(value);
      const pipe22 = yield* argument2.pipe(
        Effect.provideService(GoalCompletionIo, fixtureIo(encodedGoalManifestJson8)),
        Effect.provideService(GoalCompletionReceiptStore, store)
      );
      assertSome(
        O.map(pipe22, (row) => row.outcome),
        "verified"
      );
    })
  );
  it.effect("doctor online reads without creating the receipt file; explicit refresh is the writer", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      const value = yield* manifest();
      const text = yield* encodeGoalManifestJson(value);
      yield* writeProjectFile("bun.lock", "");
      yield* writeProjectFile("goals/demo/ops/manifest.json", text);
      yield* writeProjectFile("goals/demo/README.md", "# Demo\n\nLifecycle: `completed-retained`\n");
      const io = fixtureIo(text);
      const path = yield* Path.Path;
      const directory = path.join(process.cwd(), "workstation-state", "goals");
      const store = yield* makeGoalCompletionReceiptStoreLive().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnv({ env: { BEEP_GOALS_STATE_ROOT: directory } })
        )
      );
      const sharedFile = path.join(directory, "github.com__example__repo.jsonl");
      yield* runGoalsDoctor({ writeBaseline: false, online: true }).pipe(
        Effect.provideService(GoalCompletionIo, io),
        Effect.provideService(GoalCompletionReceiptStore, store)
      );
      const fs = yield* FileSystem.FileSystem;
      const exists23 = yield* fs.exists(".beep/goals/completion-receipts.ndjson");
      expect(exists23).toBe(false);
      const exists24 = yield* fs.exists(sharedFile);
      expect(exists24).toBe(false);
      yield* Command.runWith(goalsCommand, { version: "0.0.0" })(["completion", "refresh", "--slug", "demo"]).pipe(
        Effect.provideService(GoalCompletionIo, io),
        Effect.provideService(GoalCompletionReceiptStore, store)
      );
      // The repository resolves from origin, so the shared store is the only writer target.
      const exists25 = yield* fs.exists(".beep/goals/completion-receipts.ndjson");
      expect(exists25).toBe(false);
      const exists26 = yield* fs.exists(sharedFile);
      expect(exists26).toBe(true);
      const pipe27 = yield* storedGoalCompletion(process.cwd(), "demo", value, final).pipe(
        Effect.provideService(GoalCompletionIo, io),
        Effect.provideService(GoalCompletionReceiptStore, store)
      );
      assertSome(
        O.map(pipe27, (row) => row.outcome),
        "unknown"
      );
    })
  );
  it.effect("refresh refuses a requested invalid manifest or missing final declaration", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      yield* writeProjectFile("bun.lock", "");
      const run = Command.runWith(goalsCommand, { version: "0.0.0" });
      yield* writeProjectFile("goals/invalid/ops/manifest.json", "{}");
      expect((yield* run(["completion", "refresh", "--slug", "invalid"]).pipe(Effect.exit))._tag).toBe("Failure");
      yield* writeProjectFile(
        "goals/no-final/ops/manifest.json",
        encode({
          initiative: { id: "no-final", status: "completed-retained" },
          completionGate: {
            operator: "yeet",
            requiresPullRequest: true,
            requiresMergeable: true,
            statement: "ship",
            grandfathered: false,
          },
        })
      );
      expect((yield* run(["completion", "refresh", "--slug", "no-final"]).pipe(Effect.exit))._tag).toBe("Failure");
    })
  );
  it.effect("refresh rejects malformed readiness-job values at the CLI boundary", () =>
    Effect.gen(function* () {
      const run = Command.runWith(goalsCommand, { version: "0.0.0" });
      for (const job of ["not-a-uuid", "../../outside"]) {
        const error = yield* run(["completion", "refresh", "--slug", "demo", "--readiness-job", job]).pipe(Effect.flip);
        expect(error).toEqual(YeetCommandError.make({ message: "--readiness-job must be a job UUID" }));
      }
      const error = yield* run(["completion", "refresh", "--readiness-job", "not-a-uuid"]).pipe(Effect.flip);
      expect(error).toEqual(YeetCommandError.make({ message: "--readiness-job requires --slug" }));
    })
  );
  it.effect("refresh refuses an unknown slug", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      yield* writeProjectFile("bun.lock", "");
      const exit = yield* Command.runWith(goalsCommand, { version: "0.0.0" })([
        "completion",
        "refresh",
        "--slug",
        "missing",
      ]).pipe(Effect.exit);
      expect(exit._tag).toBe("Failure");
    })
  );
  for (const variant of [
    "valid",
    "already-ready",
    "missing-job",
    "directory-job",
    "directory-status",
    "missing-status",
    "missing-runner",
    "unfinished-job",
    "without-opt-in",
    "wrong-head",
    "wrong-pr",
    "after-merge",
    "finalized-after-merge",
    "outside-job",
    "failed-job",
    "failed-finalization",
    "missing-finalization",
    "missing-thread-facts",
    "missing-check-facts",
    "not-ready",
    "contradictory-ready",
    "path-escape",
    "status-symlink",
    "wrong-branch",
    "wrong-closeout",
    "failed-verdict",
    "explicit-not-ready",
    "hosted-red",
  ]) {
    it.effect(`recovers only canonical pre-merge monitor readiness: ${variant}`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped();
        const branch = "codex/recovery-test";
        const runId = yield* repoRunArtifactId(branch);
        const runRoot = path.join(root, ".beep", "yeet", "runs", runId);
        const jobsRoot = path.join(root, ".beep", "yeet", "jobs");
        const jobId = "aabbccdd-1234-4567-89ab-123456789abc";
        yield* fs.makeDirectory(runRoot, { recursive: true });
        yield* fs.makeDirectory(jobsRoot, { recursive: true });
        const ref = path.join(runRoot, "verdict.json");
        const value = yield* decodeGoalManifest({
          initiative: { id: "demo", status: "active" },
          proposedCloseout: { status: "completed-retained", finalPullRequest: 7 },
          completionGate: {
            operator: "yeet",
            requiresPullRequest: true,
            requiresMergeable: true,
            statement: "Ship via yeet",
            grandfathered: false,
            pullRequests: [{ number: 7, role: "final" }],
            acceptanceEvidence: [{ kind: "yeet-verdict", ref, gating: true }],
          },
        });
        const fixture = RecoveryFixture.make({ root, branch, runId, runRoot, jobsRoot, ref, jobId });
        const verdictText = recoveryVerdictFixture(variant, fixture, readinessCriteria);
        yield* fs.writeFileString(ref, verdictText);
        const statusText = recoveryStatusFixture(variant, fixture, readinessCriteria);
        if (variant === "status-symlink") {
          const outside = yield* fs.makeTempDirectoryScoped();
          yield* fs.writeFileString(path.join(outside, "status.json"), statusText);
          yield* fs.symlink(path.join(outside, "status.json"), path.join(runRoot, "status.json"));
        } else if (variant === "directory-status") {
          yield* fs.makeDirectory(path.join(runRoot, "status.json"));
        } else if (variant !== "missing-status") {
          yield* fs.writeFileString(path.join(runRoot, "status.json"), statusText);
        }
        if (variant === "directory-job") {
          yield* fs.makeDirectory(path.join(jobsRoot, `${jobId}.json`));
        } else if (variant !== "missing-job") {
          yield* fs.writeFileString(path.join(jobsRoot, `${jobId}.json`), recoveryJobFixture(variant, fixture));
        }
        const job = recoveryJobOption(variant, jobId);
        const argument3 = observeGoalCompletion(root, "demo", value, final, job);
        const encodedGoalManifestJson10 = yield* encodeGoalManifestJson(value);
        const receipt = yield* argument3.pipe(
          Effect.provideService(
            GoalCompletionIo,
            fixtureIo(encodedGoalManifestJson10, { red: variant === "hosted-red" })
          )
        );
        const evidence = A.findFirst(
          receipt.evidence,
          (item) => item.ref.kind === "yeet-verdict" && item.ref.ref === ref
        );
        assertSome(
          O.map(evidence, (item) => item.outcome),
          recoveryExpectedOutcome(variant)
        );
        const diagnostics: Readonly<Record<string, string>> = {
          "already-ready":
            "Readiness recovery unnecessary: declared verdict already verifies the resolved head and readiness.",
          "missing-job": "Readiness recovery refused: canonical job artifact is absent",
          "directory-job": "Readiness recovery refused: canonical job artifact is unreadable or not a file",
          "directory-status": "Readiness recovery refused: canonical status artifact is unreadable or not a file",
          "missing-status": "Readiness recovery refused: canonical status artifact is absent",
          "missing-runner": "Readiness recovery refused: job runner receipt is absent",
          "unfinished-job": "Readiness recovery refused: job outcome receipt is absent",
          "finalized-after-merge": "Readiness recovery refused: job finalized after PR merge",
          "missing-finalization": "Readiness recovery refused: job service finalization receipt is absent",
          "wrong-head": "Readiness recovery refused: status head mismatch",
        };
        const diagnostic = R.get(diagnostics, variant);
        if (O.isSome(diagnostic))
          assertSome(
            O.map(evidence, (item) => item.detail),
            diagnostic.value
          );
        if (variant === "hosted-red") expect(receipt.outcome).not.toBe("verified");
        const readFileString28 = yield* fs.readFileString(ref);
        expect(readFileString28).toBe(verdictText);
      })
    );
  }
});
