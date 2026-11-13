import { ReviewThreadNode, ReviewThreads } from "@beep/github/ReviewThread";
import {
  classifyGoalCloseout,
  GoalCloseoutClassificationInput,
  goalCompletionTransient,
} from "@beep/repo-cli/commands/Goals/CloseoutCheck";
import { GoalCompletionClaimsReader } from "@beep/repo-cli/commands/Goals/RedAttribution";
import {
  GoalClaimSet,
  GoalCompletionClaims,
  GoalCompletionIo,
  GoalCompletionPull,
  GoalCompletionReceipt,
  GoalCompletionReceiptStore,
  GoalInitiative,
  GoalManifest,
  GoalOperatorRulingClaim,
  GoalPullRequestRef,
  GoalRedAttributionClaim,
  GoalReviewThreadTally,
  goalCloseoutShard,
  goalCompletionDeclarationDigest,
  goalCompletionUnknownReasons,
  goalCompletionVerdict,
  goalsCommand,
  layerGoalCompletionReceiptStoreMemory,
  makeGoalCompletionReceiptStoreAt,
  makeGoalCompletionReceiptStoreLive,
  observeGoalCompletion,
  parseGoalManifestText,
  runGoalsDoctor,
  storedGoalCompletion,
} from "@beep/repo-cli/test/Goals";
import {
  loadYeetInboxView,
  recordYeetLocalShardOutcome,
  YeetCommandError,
  YeetLocalShardOutcome,
} from "@beep/repo-cli/test/Yeet";
import { LiteralKit } from "@beep/schema";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
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
import { NodeTestLayer, temporaryWorkingDirectory, writeProjectFile } from "./support/CommandTest.ts";
import { completionIoFixture } from "./support/CompletionIo.ts";

const decodeGoalManifest = S.decodeEffect(GoalManifest);
const decodeGoalManifestJson = S.decodeEffect(S.fromJsonString(GoalManifest));
const decodeUnknownGoalManifest = S.decodeUnknownEffect(GoalManifest);
const encodeGoalCompletionReceiptJson = S.encodeEffect(S.fromJsonString(GoalCompletionReceipt));
const encodeGoalManifestJson = S.encodeEffect(S.fromJsonString(GoalManifest));

const encode = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);
const HistoricalRulesetFailure = LiteralKit(["organization", "glob", "unreadable"]);
// How GitHub answers the read of fix PR #2994, named by a redAttribution claim.
const FixPull = LiteralKit(["open", "merged", "closed", "unreadable"]);
const FIX_PULL_REQUEST = 2994;
const Scenario = S.Struct({
  // GitHub lists the merge-push rule suite, so the merge-time inventory is complete.
  complete: S.optionalKey(S.Boolean),
  fixPull: S.optionalKey(FixPull),
  partialRuleset: S.optionalKey(HistoricalRulesetFailure),
  base: S.optionalKey(S.NonEmptyString),
  branchPattern: S.optionalKey(S.NonEmptyString),
  defaultExclusion: S.optionalKey(S.Boolean),
  distinctSiblingRed: S.optionalKey(S.Boolean),
  failure: S.optionalKey(S.Boolean),
  merged: S.optionalKey(S.Boolean),
  postMergeRerun: S.optionalKey(S.Boolean),
  preMergePendingRerun: S.optionalKey(S.Boolean),
  runningRerun: S.optionalKey(S.Boolean),
  missingHistory: S.optionalKey(S.Boolean),
  missingTimeline: S.optionalKey(S.Boolean),
  undatedTimeline: S.optionalKey(S.Boolean),
  windowShort: S.optionalKey(S.Boolean),
  mergeParents: S.optionalKey(S.Int),
  // Lint never reports a run on the accepted head.
  missing: S.optionalKey(S.Boolean),
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
  completionIoFixture({
    manifest: Effect.succeed(acceptedText),
    origin: Effect.succeed("git@github.com:example/repo.git\n"),
    respond: Effect.fn("GoalCompletionIo.response")((endpoint: string) => {
      if (scenario.failure === true)
        return Effect.fail(YeetCommandError.make({ message: "Synthetic network error or rate limit" }));
      return Match.value(endpoint).pipe(
        Match.when(Str.includes(`pulls/${FIX_PULL_REQUEST}`), () =>
          scenario.fixPull === undefined || FixPull.is.unreadable(scenario.fixPull)
            ? Effect.fail(YeetCommandError.make({ message: "Synthetic fix PR read failure" }))
            : Effect.succeed(
                encode({
                  number: FIX_PULL_REQUEST,
                  state: FixPull.is.open(scenario.fixPull) ? "open" : "closed",
                  merged: FixPull.is.merged(scenario.fixPull),
                  created_at: "2026-10-07T00:00:00Z",
                  merged_at: FixPull.is.merged(scenario.fixPull) ? "2026-10-08T00:00:00Z" : null,
                  merge_commit_sha: FixPull.is.merged(scenario.fixPull) ? "fix-merge" : null,
                  head: { sha: "fix-head" },
                  base: { ref: "main", repo: { full_name: "example/repo" } },
                })
              )
        ),
        Match.when(
          (path: string) => scenario.complete === true && Str.includes("rule-suites?")(path),
          () => Effect.succeed(encode([[{ id: 1, ref: "refs/heads/main", after_sha: "merge-result" }]]))
        ),
        Match.when(
          (path: string) => scenario.complete === true && Str.includes("rule-suites/1")(path),
          () =>
            Effect.succeed(
              encode({
                id: 1,
                ref: "refs/heads/main",
                after_sha: "merge-result",
                pushed_at: "2026-10-06T01:00:00Z",
                result: "pass",
                rule_evaluations: [
                  {
                    rule_source: { type: "ruleset", id: 42, name: "main" },
                    enforcement: "active",
                    result: "pass",
                    rule_type: "required_status_checks",
                  },
                ],
              })
            )
        ),
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
                  ...(scenario.missing === true
                    ? []
                    : [check(1, "2026-10-06T00:10:00Z", scenario.red === true ? "failure" : "success")]),
                  ...(scenario.distinctSiblingRed === true
                    ? [{ ...check(4, "2026-10-06T00:10:00Z", "failure"), name: "Security" }]
                    : []),
                  ...(scenario.postMergeRerun === true
                    ? [{ ...check(2, "2026-10-06T02:00:00Z", "failure"), started_at: "2026-10-06T01:30:00Z" }]
                    : []),
                  ...(scenario.preMergePendingRerun === true ? [check(3, "2026-10-06T02:00:00Z", "failure")] : []),
                  ...(scenario.runningRerun === true
                    ? [
                        {
                          ...check(5, "2026-10-06T02:00:00Z", "failure"),
                          status: "in_progress",
                          conclusion: null,
                          completed_at: null,
                        },
                      ]
                    : []),
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
                    ...(scenario.undatedTimeline === true ? [{ event: "ready_for_review" }] : []),
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
const observe = Effect.fn("CompletionTest.observe")(function* (
  scenario: typeof Scenario.Type = {},
  claims: GoalCompletionClaims = GoalCompletionClaims.make({}),
  threads: O.Option<Effect.Effect<ReviewThreads, YeetCommandError>> = O.none()
) {
  const value = yield* manifest();
  const text = yield* encodeGoalManifestJson(value);
  const io = fixtureIo(text, scenario);
  return yield* observeGoalCompletion(process.cwd(), "demo", value, final, claims).pipe(
    Effect.provideService(
      GoalCompletionIo,
      O.match(threads, { onNone: () => io, onSome: (read) => ({ ...io, reviewThreads: () => read }) })
    )
  );
});

// The fixture lists the merge-push rule suite, so this receipt verifies on hosted facts alone.
const completeReceipt = Effect.fn("CompletionTest.completeReceipt")(function* () {
  const receipt = yield* observe({ complete: true });
  expect(receipt.outcome).toBe("verified");
  return receipt;
});

const DECISION = "goals/demo/decisions/2026-11-14-final-merged-over-lint.md";
const lintClaim = (source: GoalRedAttributionClaim["source"] = "origin-main") =>
  GoalRedAttributionClaim.make({
    context: "Lint",
    attribution: "inherited",
    fixPullRequest: FIX_PULL_REQUEST,
    decisionFile: DECISION,
    source,
  });
const committedClaims = (claims: ReadonlyArray<GoalRedAttributionClaim>) =>
  GoalCompletionClaims.make({
    committed: GoalClaimSet.make({ redAttributions: claims }),
    preview: GoalClaimSet.make({ redAttributions: claims }),
  });

const thread = (isResolved: boolean) =>
  ReviewThreadNode.make({
    id: isResolved ? "PRRT_resolved" : "PRRT_open",
    isResolved,
    isOutdated: false,
    isCollapsed: false,
    path: "src/a.ts",
    line: O.some(1),
    startLine: O.none(),
    diffSide: "RIGHT",
    resolvedBy: O.none(),
    comments: [],
    commentsTruncated: false,
    newestComment: O.none(),
  });

const captureOutput = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
  const current = yield* Console.Console;
  let output: ReadonlyArray<unknown> = [];
  yield* effect.pipe(
    Effect.provideService(Console.Console, {
      ...current,
      log: (...values: ReadonlyArray<unknown>) => {
        output = A.appendAll(output, values);
      },
    })
  );
  return A.join(A.map(output, String), "\n");
});

const CLOSEOUT_SHARD = goalCloseoutShard("demo", 7);

// Whether each inbox row for `shard` (by default `goal-closeout:demo#7`) in the checkout is acknowledged.
const closeoutRowsAcked = (root: string, shard = CLOSEOUT_SHARD) =>
  Effect.map(loadYeetInboxView(root), (view) =>
    A.filterMap(view.entries, (entry) =>
      entry.row.kind === "local-shard-failed" && entry.row.capsule.shard === shard
        ? Result.succeed(entry.ack.acked)
        : Result.failVoid
    )
  );
const SUPERSEDED_SHARD = goalCloseoutShard("demo", 5);

// Runs `goals completion refresh --slug demo` in a fresh checkout against the
// fixture port, a fixed claims reader and the memory receipt store. With
// `seedCloseoutRow`, the checkout's inbox first holds the P0 row `yeet sweep
// --retire` raises for an unverified closeout of #7, and with
// `seedSupersededRow` one for #5, a final the packet bound before.
const refreshDemo = Effect.fn("CompletionTest.refreshDemo")(function* (
  scenario: typeof Scenario.Type,
  claims: GoalCompletionClaims,
  options: { readonly seedCloseoutRow?: boolean; readonly seedSupersededRow?: boolean } = {}
) {
  const root = yield* temporaryWorkingDirectory;
  const seeded = [
    ...(options.seedCloseoutRow === true ? [CLOSEOUT_SHARD] : []),
    ...(options.seedSupersededRow === true ? [SUPERSEDED_SHARD] : []),
  ];
  for (const shard of seeded) {
    yield* recordYeetLocalShardOutcome(
      root,
      YeetLocalShardOutcome.make({
        command: "bun run beep goals completion refresh --slug demo",
        exitCode: 1,
        headSha: "main-head",
        shard,
      })
    );
  }
  const value = yield* manifest();
  const text = yield* encodeGoalManifestJson(value);
  yield* writeProjectFile("bun.lock", "");
  yield* writeProjectFile("goals/demo/ops/manifest.json", text);
  yield* writeProjectFile("goals/demo/README.md", "# Demo\n\nLifecycle: `completed-retained`\n");
  const io = fixtureIo(text, scenario);
  // A store of this checkout's own, so no other test's receipt can match.
  const { store } = yield* sharedStore(process.cwd());
  const output = yield* captureOutput(
    Command.runWith(goalsCommand, { version: "0.0.0" })(["completion", "refresh", "--slug", "demo"]).pipe(
      Effect.provideService(GoalCompletionIo, io),
      Effect.provideService(GoalCompletionReceiptStore, store),
      Effect.provideService(GoalCompletionClaimsReader, { read: () => Effect.succeed(claims) })
    )
  );
  const stored = yield* storedGoalCompletion(process.cwd(), "demo", value, final).pipe(
    Effect.provideService(GoalCompletionIo, io),
    Effect.provideService(GoalCompletionReceiptStore, store)
  );
  const closeoutAcked = yield* closeoutRowsAcked(root);
  const supersededAcked = yield* closeoutRowsAcked(root, SUPERSEDED_SHARD);
  return { output, stored, closeoutAcked, supersededAcked };
});

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
  it.effect("an absent or refused local manifest uses the typed hosted fallback", () =>
    Effect.gen(function* () {
      const value = yield* manifest();
      const text = yield* encodeGoalManifestJson(value);
      for (const local of [Effect.succeedNone, Effect.fail(YeetCommandError.make({ message: "refused" }))]) {
        let hostedReads = 0;
        const receipt = yield* observeGoalCompletion(process.cwd(), "demo", value, final).pipe(
          Effect.provideService(GoalCompletionIo, {
            ...fixtureIo(text),
            manifestAtHead: () => local,
            hostedManifest: () =>
              Effect.sync(() => {
                hostedReads += 1;
                return O.some(text);
              }),
          })
        );
        expect(hostedReads).toBe(1);
        const digest = yield* goalCompletionDeclarationDigest(value);
        assertSome(receipt.acceptedDeclarationDigest, digest);
      }
    })
  );
  it.effect("an undated timeline event does not discard the dated review-window evidence", () =>
    Effect.gen(function* () {
      const receipt = yield* observe({ undatedTimeline: true });
      expect(receipt.subClaims).toEqual((yield* observe()).subClaims);
      expect(A.some(receipt.subClaims, (claim) => claim.outcome === "verified")).toBe(true);
    })
  );
  it.effect("a rerun pending at merge counts by its eventual conclusion, never an older green result", () =>
    Effect.gen(function* () {
      expect((yield* observe({ preMergePendingRerun: true })).outcome).toBe("unsatisfied");
      // A rerun still in progress is pending: unknown, not the older green.
      expect((yield* observe({ runningRerun: true })).outcome).toBe("unknown");
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
      // The hosted required-checks outcome follows the verdict alone: green facts
      // over an incomplete inventory are unknown, never verified.
      expect(
        A.map(
          A.filter(receipt.evidence, (check) => check.ref.kind === "hosted-required-checks"),
          (check) => check.outcome
        )
      ).toEqual(["unknown"]);
      expect(A.every(receipt.requiredCheckFacts, (fact) => fact.outcome === "verified")).toBe(true);
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
  it.effect("a post-merge rerun supersedes the pre-merge result, even with an incomplete inventory", () =>
    Effect.gen(function* () {
      const receipt = yield* observe({ postMergeRerun: true });
      expect(receipt.outcome).toBe("unsatisfied");
      expect(
        A.some(
          receipt.evidence,
          (check) => check.ref.kind === "hosted-required-checks" && check.outcome === "unsatisfied"
        )
      ).toBe(true);
      assertSome(
        A.findFirst(receipt.requiredCheckFacts, (fact) => fact.context === "Lint").pipe(
          O.flatMap((fact) => fact.checkRunId)
        ),
        2
      );
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
  it.effect("an open final is unsatisfied with merged = false and reads no review threads", () =>
    Effect.gen(function* () {
      let threadReads = 0;
      const receipt = yield* observe(
        { merged: false },
        GoalCompletionClaims.make({}),
        O.some(
          Effect.sync(() => {
            threadReads += 1;
            return ReviewThreads.make({ pullRequestAuthor: O.none(), threads: [] });
          })
        )
      );
      expect(receipt.outcome).toBe("unsatisfied");
      assertSome(receipt.merged, false);
      assertNone(receipt.merge);
      assertNone(receipt.reviewThreads);
      expect(threadReads).toBe(0);
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
  it.effect("labels the historical window as raw evidence without rewrite carry", () =>
    Effect.gen(function* () {
      const receipt = yield* observe({ windowShort: true });
      const window = O.getOrThrow(A.findFirst(receipt.subClaims, (check) => check.ref.ref === "review-window"));
      expect(window.detail).toContain("Raw review window at merge");
      expect(window.detail).toContain("rewrite carry is not applied");
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
          const stale = yield* observe({ red, runningRerun: !red });
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
  it.effect("a degraded refresh keeps an older red; one that observed a newer pending run replaces it", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      const value = yield* manifest();
      const stale = yield* observe({ red: true });
      expect(stale.outcome).toBe("unsatisfied");
      const staleText = yield* encodeGoalCompletionReceiptJson(stale);
      const encodedGoalManifestJson11 = yield* encodeGoalManifestJson(value);
      const io = fixtureIo(encodedGoalManifestJson11);
      yield* Effect.forEach(
        [
          { scenario: { missingHistory: true }, keepsRed: true },
          // The newest run binds (DN-1): a rerun still in progress supersedes the
          // older red, and the definite unknown read of it is the current truth.
          { scenario: { runningRerun: true }, keepsRed: false },
        ],
        Effect.fn("GoalsCompletionTest.retainRequiredRed")(function* ({ scenario, keepsRed }) {
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
          assertSome(pipe12, keepsRed ? stale : degraded);
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
      // Definite: merged, complete ruleset reads and a verified hosted thread read;
      // only the merge-time inventory is incomplete.
      expect(degraded.outcome).toBe("unknown");
      degraded.merge.pipe(O.isSome, assertTrue);
      assertSome(
        O.map(degraded.requiredChecks, (snapshot) => snapshot.rulesetReadsComplete),
        true
      );
      assertTrue(
        A.some(degraded.evidence, (check) => check.ref.kind === "hosted-review-threads" && check.outcome === "verified")
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
  it.effect("doctor online classifies a committed closeout from hosted facts and writes nothing", () =>
    Effect.forEach(
      [
        { scenario: { complete: true }, blocks: false, text: "note: demo: completed-retained (verified via #7)" },
        {
          scenario: { complete: true, red: true },
          blocks: true,
          text: "demo [closeout-unverified] Final PR #7: unattributed red: Lint.",
        },
      ] as const,
      Effect.fn("CompletionTest.onlineCloseout")(function* (row) {
        yield* temporaryWorkingDirectory;
        const value = yield* decodeGoalManifest({
          initiative: { id: "demo", packetId: "packet-demo", status: "completed-retained" },
          completionGate: {
            operator: "yeet",
            requiresPullRequest: true,
            requiresMergeable: true,
            statement: "Ship via yeet",
            grandfathered: false,
            pullRequests: [{ number: 7, role: "final" }],
          },
          closeout: { status: "completed-retained", finalPullRequest: 7 },
        });
        const text = yield* encodeGoalManifestJson(value);
        yield* writeProjectFile("bun.lock", "");
        yield* writeProjectFile("goals/demo/ops/manifest.json", text);
        yield* writeProjectFile("goals/demo/README.md", "# Demo\n\nLifecycle: `completed-retained`\n");
        yield* writeProjectFile(
          "goals/goals-doctor.baseline.jsonc",
          '{"schemaVersion":"goals-doctor-baseline/v1","findings":[]}\n'
        );
        const path = yield* Path.Path;
        const directory = path.join(process.cwd(), "workstation-state", "goals");
        const store = yield* makeGoalCompletionReceiptStoreLive().pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnv({ env: { BEEP_GOALS_STATE_ROOT: directory } })
          )
        );
        let output = A.empty<string>();
        const current = yield* Console.Console;
        const exit = yield* runGoalsDoctor({ writeBaseline: false, online: true }).pipe(
          Effect.provideService(GoalCompletionIo, fixtureIo(text, row.scenario)),
          Effect.provideService(GoalCompletionReceiptStore, store),
          Effect.provideService(GoalCompletionClaimsReader, {
            read: () => Effect.succeed(GoalCompletionClaims.make({})),
          }),
          Effect.provideService(Console.Console, {
            ...current,
            log: (...values: ReadonlyArray<unknown>) => {
              output = A.appendAll(output, A.map(values, String));
            },
            error: (...values: ReadonlyArray<unknown>) => {
              output = A.appendAll(output, A.map(values, String));
            },
          }),
          Effect.exit
        );
        expect(exit._tag).toBe(row.blocks ? "Failure" : "Success");
        expect(A.join(output, "\n")).toContain(row.text);
        const fs = yield* FileSystem.FileSystem;
        const legacy = yield* fs.exists(".beep/goals/completion-receipts.ndjson");
        expect(legacy).toBe(false);
        const shared = yield* fs.exists(path.join(directory, "github.com__example__repo.jsonl"));
        expect(shared).toBe(false);
      }),
      { discard: true }
    )
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
  it.effect("verifies a merged final on hosted facts alone and records the v2 receipt facts", () =>
    Effect.gen(function* () {
      const receipt = yield* completeReceipt();
      expect(receipt.schemaVersion).toBe("goal-completion-receipt/v2");
      assertSome(receipt.merged, true);
      assertSome(receipt.reviewThreads, GoalReviewThreadTally.make({ total: 0, outstanding: 0 }));
      expect(receipt.redAttributions).toEqual([]);
      expect(A.map(receipt.evidence, (check) => [check.ref.kind, check.ref.ref, check.outcome])).toEqual([
        ["hosted-required-checks", "required", "verified"],
        ["hosted-review-threads", "outstanding", "verified"],
      ]);
      expect(goalCompletionUnknownReasons(receipt)).toEqual([]);
      // The accepted-head manifest names #7 through its final pullRequests entry.
      assertSome(
        A.findFirst(receipt.subClaims, (claim) => claim.ref.ref === "accepted-declaration").pipe(
          O.map((claim) => claim.outcome)
        ),
        "verified"
      );
    })
  );
  it.effect("the accepted-declaration sub-claim reads the raw head manifest and never gates", () =>
    Effect.gen(function* () {
      const value = yield* manifest();
      const outcomeFor = Effect.fn("CompletionTest.acceptedDeclaration")(function* (accepted: string) {
        const receipt = yield* observeGoalCompletion(process.cwd(), "demo", value, final).pipe(
          Effect.provideService(GoalCompletionIo, {
            ...fixtureIo(accepted, { complete: true }),
            hostedManifest: () => Effect.succeedNone,
          })
        );
        expect(receipt.outcome).toBe("verified");
        return O.getOrThrow(
          A.findFirst(receipt.subClaims, (claim) => claim.ref.ref === "accepted-declaration").pipe(
            O.map((claim) => claim.outcome)
          )
        );
      });
      const outcomes = yield* Effect.forEach(
        [
          // A legacy proposal the current schema no longer needs still names its final.
          encode({ proposedCloseout: { status: "completed-retained", finalPullRequest: 7 } }),
          encode({ closeout: { status: "completed-retained", finalPullRequest: 7 } }),
          encode({ completionGate: { pullRequests: [{ number: 7, role: "supporting" }] } }),
          "not json",
        ],
        outcomeFor
      );
      expect(outcomes).toEqual(["verified", "verified", "unsatisfied", "unknown"]);
    })
  );
  it.effect("the local Yeet verdict is not read and gates nothing", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      const ref = path.join(root, ".beep", "yeet", "runs", "lane", "verdict.json");
      yield* fs.makeDirectory(path.dirname(ref), { recursive: true });
      // An explicit not-ready verdict that the old gating reader would have read as unsatisfied.
      yield* fs.writeFileString(ref, encode({ mode: "publish", outcome: "failure", mergeReady: { ready: false } }));
      const value = yield* decodeGoalManifest({
        initiative: { id: "demo", packetId: "packet-demo", status: "completed-retained" },
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
      const text = yield* encodeGoalManifestJson(value);
      const receipt = yield* observeGoalCompletion(root, "demo", value, final).pipe(
        Effect.provideService(GoalCompletionIo, fixtureIo(text, { complete: true }))
      );
      expect(receipt.outcome).toBe("verified");
      expect(A.some(receipt.evidence, (check) => check.ref.ref === ref)).toBe(false);
    })
  );
  it.effect("review threads: none outstanding verifies, any outstanding is unsatisfied, a failed read is unknown", () =>
    Effect.gen(function* () {
      const read = (threads: ReadonlyArray<ReviewThreadNode>) =>
        O.some(Effect.succeed(ReviewThreads.make({ pullRequestAuthor: O.some("author"), threads })));
      const clean = yield* observe({ complete: true }, GoalCompletionClaims.make({}), read([thread(true)]));
      expect(clean.outcome).toBe("verified");
      assertSome(clean.reviewThreads, GoalReviewThreadTally.make({ total: 1, outstanding: 0 }));
      const open = yield* observe(
        { complete: true },
        GoalCompletionClaims.make({}),
        read([thread(true), thread(false)])
      );
      expect(open.outcome).toBe("unsatisfied");
      assertSome(open.reviewThreads, GoalReviewThreadTally.make({ total: 2, outstanding: 1 }));
      assertSome(
        A.findFirst(open.evidence, (check) => check.ref.kind === "hosted-review-threads").pipe(
          O.map((check) => check.detail)
        ),
        "1 of 2 review threads outstanding when refresh ran."
      );
      const failed = yield* observe(
        { complete: true },
        GoalCompletionClaims.make({}),
        O.some(YeetCommandError.make({ message: "GraphQL budget exhausted" }).pipe(Effect.fail))
      );
      expect(failed.outcome).toBe("unknown");
      assertNone(failed.reviewThreads);
      expect(goalCompletionUnknownReasons(failed)).toEqual(["review threads unreadable"]);
    })
  );
  it.effect("a red required check with a matching committed claim verifies and the receipt lists it", () =>
    Effect.gen(function* () {
      expect((yield* observe({ complete: true, red: true })).outcome).toBe("unsatisfied");
      for (const fixPull of ["merged", "open"] as const) {
        const receipt = yield* observe({ complete: true, red: true, fixPull }, committedClaims([lintClaim()]));
        expect(receipt.outcome).toBe("verified");
        expect(receipt.redAttributions).toEqual([lintClaim()]);
        const verdict = goalCompletionVerdict(receipt);
        expect(
          verdict._tag === "verified"
            ? A.map(verdict.attributedReds, (red) => [red.context, red.observed, red.conclusion, red.source])
            : []
        ).toEqual([["Lint", "red", "failure", "origin-main"]]);
        assertSome(
          A.findFirst(receipt.evidence, (check) => check.ref.ref === "required").pipe(O.map((check) => check.outcome)),
          "verified"
        );
        assertTrue(
          A.some(
            receipt.evidence,
            (check) => check.ref.ref === "required" && Str.includes("attributed: Lint")(check.detail)
          )
        );
      }
    })
  );
  it.effect(
    "a fix PR closed without merging leaves the red unattributed; an unreadable one is a transient unknown",
    () =>
      Effect.gen(function* () {
        const claims = committedClaims([lintClaim()]);
        const closed = yield* observe({ complete: true, red: true, fixPull: "closed" }, claims);
        expect(closed.outcome).toBe("unsatisfied");
        expect(closed.redAttributions).toEqual([]);
        assertTrue(
          A.some(closed.evidence, (check) =>
            Str.includes(`Not counted: fix PR #${FIX_PULL_REQUEST} closed without merging.`)(check.detail)
          )
        );
        // GitHub answers a missing PR with a failed read, so it reads as unreadable too.
        const unreadable = yield* observe({ complete: true, red: true, fixPull: "unreadable" }, claims);
        expect(unreadable.outcome).toBe("unknown");
        expect(unreadable.redAttributions).toEqual([lintClaim()]);
        expect(goalCompletionUnknownReasons(unreadable)).toEqual([`fix PR #${FIX_PULL_REQUEST} unreadable`]);
        // An unreadable fix PR for a claim that clears nothing does not hold a green final back.
        const green = yield* observe({ complete: true, fixPull: "unreadable" }, claims);
        expect(green.outcome).toBe("verified");
        expect(green.redAttributions).toEqual([]);
        // Without the claim's fix PR a red with no other claim stays a known red.
        const unrelated = yield* observe(
          { complete: true, red: true, fixPull: "unreadable" },
          committedClaims([GoalRedAttributionClaim.make({ ...lintClaim(), context: "Security" })])
        );
        expect(unrelated.outcome).toBe("unsatisfied");
      })
  );
  it.effect("an unreadable fix PR for a claim on a never-reported required context is a transient unknown", () =>
    Effect.gen(function* () {
      const claims = committedClaims([lintClaim()]);
      const unreadable = yield* observe({ complete: true, missing: true, fixPull: "unreadable" }, claims);
      expect(unreadable.outcome).toBe("unknown");
      expect(unreadable.redAttributions).toEqual([lintClaim()]);
      expect(goalCompletionUnknownReasons(unreadable)).toEqual([`fix PR #${FIX_PULL_REQUEST} unreadable`]);
      assertTrue(goalCompletionTransient(unreadable));
      const pull = GoalCompletionPull.make({
        created_at: DateTime.makeUnsafe("2026-10-05T23:00:00Z"),
        number: 7,
        state: "closed",
        merged: true,
        merged_at: O.some(DateTime.makeUnsafe("2026-10-06T01:00:00Z")),
        merge_commit_sha: O.some("merge-result"),
        head: { sha: "accepted-head" },
        base: { ref: "main", repo: { full_name: "example/repo" } },
      });
      const classified = classifyGoalCloseout(
        GoalCloseoutClassificationInput.make({
          packet: "demo",
          finalPullRequest: 7,
          pull: O.some(pull),
          now: DateTime.makeUnsafe("2026-10-07T00:00:00Z"),
          receipt: O.some(unreadable),
          claims: claims.committed,
        })
      );
      expect([classified.outcome, classified.reasons]).toEqual([
        "transient",
        [`fix PR #${FIX_PULL_REQUEST} unreadable`],
      ]);
      // Readable, the claim covers the missing context.
      const readable = yield* observe({ complete: true, missing: true, fixPull: "merged" }, claims);
      expect(readable.outcome).toBe("verified");
      const verdict = goalCompletionVerdict(readable);
      expect(
        verdict._tag === "verified" ? A.map(verdict.attributedReds, (red) => [red.context, red.observed]) : []
      ).toEqual([["Lint", "missing"]]);
      // Without a claim the never-reported context is a structural unknown.
      const unclaimed = yield* observe({ complete: true, missing: true });
      expect(unclaimed.outcome).toBe("unknown");
      assertFalse(goalCompletionTransient(unclaimed));
    })
  );
  it.effect("refresh stores only committed claims and previews what a working-tree claim would change", () =>
    Effect.gen(function* () {
      const ruling = GoalOperatorRulingClaim.make({
        finalPullRequest: 7,
        decisionFile: "goals/demo/decisions/2026-11-14-operator-closes-7.md",
        source: "origin-main",
      });
      const { output, stored } = yield* refreshDemo(
        { complete: true, red: true, fixPull: "merged" },
        GoalCompletionClaims.make({
          committed: GoalClaimSet.make({ operatorRulings: [ruling] }),
          preview: GoalClaimSet.make({ redAttributions: [lintClaim("working-tree")], operatorRulings: [ruling] }),
        })
      );
      assertSome(
        O.map(stored, (row) => [row.outcome, row.redAttributions] as const),
        ["unsatisfied", []]
      );
      expect(output).toContain("[goals:completion] demo #7: unsatisfied");
      expect(output).toContain("[goals:completion] demo #7: unattributed red: Lint");
      expect(output).toContain(`closed by operator ruling ${ruling.decisionFile} (origin-main)`);
      expect(output).toContain("bun run beep goals decisions add demo");
      expect(output).toContain(`[goals:completion] demo #7: would verify once committed: ${DECISION}`);
    })
  );
  it.effect("refresh says a verified final that counts a HEAD-only claim is not done until it merges", () =>
    Effect.gen(function* () {
      const { output, stored } = yield* refreshDemo(
        { complete: true, red: true, fixPull: "merged" },
        committedClaims([lintClaim("head")])
      );
      assertSome(
        O.map(stored, (row) => row.outcome),
        "verified"
      );
      expect(output).toContain(
        `[goals:completion] demo #7: verified (claims at HEAD only: ${DECISION}; not done until they merge)`
      );
      expect(output).toContain(`attributed Lint (inherited, fix #${FIX_PULL_REQUEST}, ${DECISION}, head)`);
      const merged = yield* refreshDemo(
        { complete: true, red: true, fixPull: "merged" },
        committedClaims([lintClaim()])
      );
      expect(merged.output).toContain("[goals:completion] demo #7: verified\n");
      expect(merged.output).not.toContain("not done until they merge");
    })
  );
  it.effect("refresh printing plain verified clears the closeout's inbox row; nothing else does", () =>
    Effect.gen(function* () {
      const scenario = { complete: true, red: true, fixPull: "merged" } as const;
      const verified = yield* refreshDemo(scenario, committedClaims([lintClaim()]), { seedCloseoutRow: true });
      expect(verified.output).toContain("[goals:completion] demo #7: verified\n");
      expect(verified.closeoutAcked).toEqual([true]);
      // A HEAD-only claim is not done until it merges, so the row stays open.
      const headOnly = yield* refreshDemo(scenario, committedClaims([lintClaim("head")]), { seedCloseoutRow: true });
      expect(headOnly.output).toContain("not done until they merge");
      expect(headOnly.closeoutAcked).toEqual([false]);
      const unsatisfied = yield* refreshDemo(scenario, GoalCompletionClaims.make({}), { seedCloseoutRow: true });
      expect(unsatisfied.output).toContain("[goals:completion] demo #7: unsatisfied");
      expect(unsatisfied.closeoutAcked).toEqual([false]);
      // Without a row there is nothing to clear, and the refresh still verifies.
      const clean = yield* refreshDemo(scenario, committedClaims([lintClaim()]));
      expect(clean.closeoutAcked).toEqual([]);
      assertSome(
        O.map(clean.stored, (row) => row.outcome),
        "verified"
      );
    })
  );
  it.effect("refresh clears the row for an operator ruling on origin/main, and a closed final's superseded rows", () =>
    Effect.gen(function* () {
      const scenario = { complete: true, red: true } as const;
      const rulingClaims = (source: GoalOperatorRulingClaim["source"], finalPullRequest = 7) =>
        GoalCompletionClaims.make({
          committed: GoalClaimSet.make({
            operatorRulings: [
              GoalOperatorRulingClaim.make({
                finalPullRequest,
                decisionFile: "goals/demo/decisions/2026-11-14-operator-closes-7.md",
                source,
              }),
            ],
          }),
        });
      const ruled = yield* refreshDemo(scenario, rulingClaims("origin-main"), {
        seedCloseoutRow: true,
        seedSupersededRow: true,
      });
      expect(ruled.output).toContain("[goals:completion] demo #7: unsatisfied");
      expect(ruled.output).toContain("closed by operator ruling");
      expect([ruled.closeoutAcked, ruled.supersededAcked]).toEqual([[true], [true]]);
      // A ruling found only at HEAD, or one for another final, has not closed #7 on main.
      const headRuling = yield* refreshDemo(scenario, rulingClaims("head"), {
        seedCloseoutRow: true,
        seedSupersededRow: true,
      });
      expect([headRuling.closeoutAcked, headRuling.supersededAcked]).toEqual([[false], [false]]);
      const otherFinal = yield* refreshDemo(scenario, rulingClaims("origin-main", 8), { seedCloseoutRow: true });
      expect(otherFinal.closeoutAcked).toEqual([false]);
      // A plain verified refresh also clears the row of the final the packet bound before.
      const verified = yield* refreshDemo(
        { complete: true, red: true, fixPull: "merged" },
        committedClaims([lintClaim()]),
        { seedSupersededRow: true }
      );
      expect([verified.closeoutAcked, verified.supersededAcked]).toEqual([[], [true]]);
    })
  );
});
