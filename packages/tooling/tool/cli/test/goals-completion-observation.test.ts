import {
  GoalCompletionIo,
  GoalCompletionObservation,
  GoalCompletionReceipt,
  GoalCompletionVerifier,
  GoalInitiative,
  GoalManifest,
  GoalPullRequestRef,
  GoalRequiredCheckSnapshot,
  goalCompletionDeclarationDigest,
  goalsCommand,
  observeGoalCompletion,
  parseGoalManifestText,
  runGoalsDoctor,
  storedGoalCompletion,
} from "@beep/repo-cli/test/Goals";
import { YeetCommandError } from "@beep/repo-cli/test/Yeet";
import { LiteralKit } from "@beep/schema";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Command from "effect/cli/Command";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
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
      requiredChecks: O.some(GoalRequiredCheckSnapshot.make({ ...snapshot, inventoryComplete: true })),
    })
  );
});

it.layer(NodeTestLayer, { timeout: "30 seconds" })("goal completion observations and storage", (it) => {
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
      expect(yield* goalCompletionDeclarationDigest(decoded)).toBe(yield* goalCompletionDeclarationDigest(declared));
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
      expect(yield* goalCompletionDeclarationDigest(value)).not.toEqual(
        yield* goalCompletionDeclarationDigest(changed)
      );
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
      const io = fixtureIo(yield* encodeGoalManifestJson(value));
      assertNone(
        yield* storedGoalCompletion(process.cwd(), "demo", value, final).pipe(
          Effect.provideService(GoalCompletionIo, io)
        )
      );
      const fs = yield* FileSystem.FileSystem;
      yield* fs.writeFileString(".beep/goals/completion-receipts.ndjson", `${stale}\n${correct}\n`);
      assertSome(
        O.map(
          yield* storedGoalCompletion(process.cwd(), "demo", value, final).pipe(
            Effect.provideService(GoalCompletionIo, io)
          ),
          (row) => row.outcome
        ),
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
      const io = fixtureIo(yield* encodeGoalManifestJson(value));
      assertSome(
        O.map(
          yield* storedGoalCompletion(process.cwd(), "demo", value, final).pipe(
            Effect.provideService(GoalCompletionIo, io)
          ),
          (row) => row.outcome
        ),
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
      const io = fixtureIo(yield* encodeGoalManifestJson(value));
      assertSome(
        O.map(
          yield* storedGoalCompletion(process.cwd(), "demo", value, final).pipe(
            Effect.provideService(GoalCompletionIo, io)
          ),
          (row) => row.outcome
        ),
        "verified"
      );
    })
  );
  it.effect("newer successful merged observations replace older required-red and pending-rerun receipts", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      const value = yield* manifest();
      const io = fixtureIo(yield* encodeGoalManifestJson(value));
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
          assertSome(
            yield* storedGoalCompletion(process.cwd(), "demo", value, final).pipe(
              Effect.provideService(GoalCompletionIo, io)
            ),
            latest
          );
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
      const io = fixtureIo(yield* encodeGoalManifestJson(value));
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
          assertSome(
            yield* storedGoalCompletion(process.cwd(), "demo", value, final).pipe(
              Effect.provideService(GoalCompletionIo, io)
            ),
            stale
          );
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
      const io = fixtureIo(yield* encodeGoalManifestJson(value));
      assertSome(
        yield* storedGoalCompletion(process.cwd(), "demo", value, final).pipe(
          Effect.provideService(GoalCompletionIo, io)
        ),
        stale
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
      yield* runGoalsDoctor({ writeBaseline: false, online: true }).pipe(Effect.provideService(GoalCompletionIo, io));
      const fs = yield* FileSystem.FileSystem;
      expect(yield* fs.exists(".beep/goals/completion-receipts.ndjson")).toBe(false);
      yield* Command.runWith(goalsCommand, { version: "0.0.0" })(["completion", "refresh", "--slug", "demo"]).pipe(
        Effect.provideService(GoalCompletionIo, io)
      );
      expect(yield* fs.exists(".beep/goals/completion-receipts.ndjson")).toBe(true);
      assertSome(
        O.map(
          yield* storedGoalCompletion(process.cwd(), "demo", value, final).pipe(
            Effect.provideService(GoalCompletionIo, io)
          ),
          (row) => row.outcome
        ),
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
});
