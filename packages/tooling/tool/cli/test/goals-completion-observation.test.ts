import {
  GoalCompletionIo,
  GoalCompletionReceipt,
  GoalInitiative,
  GoalManifest,
  GoalPullRequestRef,
  goalCompletionDeclarationDigest,
  goalsCommand,
  observeGoalCompletion,
  parseGoalManifestText,
  runGoalsDoctor,
  storedGoalCompletion,
} from "@beep/repo-cli/test/Goals";
import { YeetCommandError } from "@beep/repo-cli/test/Yeet";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import { Command } from "effect/cli";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { temporaryWorkingDirectory, writeProjectFile } from "./support/CommandTest.ts";

const encode = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);
const Scenario = S.Struct({
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
  S.decodeEffect(GoalManifest)({
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
      if (Str.includes("pulls/7")(endpoint))
        return Effect.succeed(
          encode({
            number: 7,
            merged: scenario.merged !== false,
            created_at: "2026-10-05T23:00:00Z",
            merged_at: scenario.merged === false ? null : "2026-10-06T01:00:00Z",
            merge_commit_sha: "merge-result",
            head: { sha: "accepted-head" },
            base: { ref: "main", repo: { full_name: "example/repo" } },
          })
        );
      if (Str.includes("check-runs")(endpoint))
        return Effect.succeed(
          encode([
            {
              check_runs: [
                check(1, "2026-10-06T00:10:00Z", scenario.red === true ? "failure" : "success"),
                ...(scenario.postMergeRerun === true
                  ? [{ ...check(2, "2026-10-06T02:00:00Z", "failure"), started_at: "2026-10-06T01:30:00Z" }]
                  : []),
                ...(scenario.preMergePendingRerun === true ? [check(3, "2026-10-06T02:00:00Z", "failure")] : []),
              ],
            },
          ])
        );
      if (Str.includes("check-suites")(endpoint))
        return Effect.succeed(encode([{ check_suites: [{ created_at: "2026-10-06T00:00:00Z" }] }]));
      if (Str.includes("timeline")(endpoint))
        return scenario.missingTimeline === true
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
            );
      if (Str.includes("/history/1")(endpoint))
        return Effect.succeed(
          encode({
            state: {
              enforcement: "active",
              target: "branch",
              conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
              rules: [
                {
                  type: "required_status_checks",
                  parameters: {
                    strict_required_status_checks_policy: false,
                    required_status_checks: [{ context: "Lint" }],
                  },
                },
              ],
            },
          })
        );
      if (Str.includes("/history")(endpoint))
        return scenario.missingHistory === true
          ? Effect.fail(YeetCommandError.make({ message: "History unavailable" }))
          : Effect.succeed(
              encode([
                [
                  { version_id: 1, updated_at: "2026-10-01T00:00:00Z" },
                  { version_id: 2, updated_at: "2026-10-07T00:00:00Z" },
                ],
              ])
            );
      if (Str.includes("rulesets?")(endpoint))
        return Effect.succeed(encode([[{ id: 42, source_type: "Repository", created_at: "2026-09-01T00:00:00Z" }]]));
      return Effect.succeed(
        encode({
          sha: "merge-result",
          parents:
            scenario.mergeParents === 2 ? [{ sha: "parent" }, { sha: "accepted-head" }] : [{ sha: "unrelated-parent" }],
          commit: { tree: { sha: "merge-tree" } },
        })
      );
    }),
  });
const observe = Effect.fn("CompletionTest.observe")(function* (scenario: typeof Scenario.Type = {}) {
  const value = yield* manifest();
  const text = yield* S.encodeEffect(S.fromJsonString(GoalManifest))(value);
  return yield* observeGoalCompletion(process.cwd(), "demo", value, final).pipe(
    Effect.provideService(GoalCompletionIo, fixtureIo(text, scenario))
  );
});

it.layer(NodeServices.layer)("goal completion observations and storage", (it) => {
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
        yield* S.decodeUnknownEffect(GoalManifest)(parseGoalManifestText(text).pipe(O.getOrThrow));
        decoded += 1;
      }
      expect(decoded).toBeGreaterThan(0);
    })
  );
  it.effect("a rerun pending at merge cannot reuse an older green result", () =>
    Effect.gen(function* () {
      expect((yield* observe({ preMergePendingRerun: true })).outcome).toBe("unknown");
    })
  );
  it.effect("verifies a squash/rebase result without original-head ancestry", () =>
    Effect.gen(function* () {
      const receipt = yield* observe();
      expect(receipt.outcome).toBe("verified");
      expect(O.map(receipt.merge, (merge) => merge.method)).toEqual(O.some(O.none()));
      expect(O.map(receipt.requiredChecks, (snapshot) => snapshot.contexts)).toEqual(O.some(["Lint"]));
      expect(O.map(receipt.requiredChecks, (snapshot) => snapshot.sources)).toEqual(
        O.some(["repos/{owner}/{repo}/rulesets/42/history/1"])
      );
    })
  );
  it.effect("recognizes a two-parent merge", () =>
    Effect.gen(function* () {
      expect(O.map((yield* observe({ mergeParents: 2 })).merge, (merge) => merge.method)).toEqual(
        O.some(O.some("merge"))
      );
    })
  );
  it.effect("keeps pre-merge success when a later rerun turns red", () =>
    Effect.gen(function* () {
      expect((yield* observe({ postMergeRerun: true })).outcome).toBe("verified");
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
  it.effect("timeline failure leaves only the sub-claim unknown", () =>
    Effect.gen(function* () {
      const receipt = yield* observe({ missingTimeline: true });
      expect(receipt.outcome).toBe("verified");
      expect(
        A.findFirst(receipt.subClaims, (check) => check.ref.ref === "review-window").pipe(
          O.map((check) => check.outcome)
        )
      ).toEqual(O.some("unknown"));
    })
  );
  it.effect("seven-second historical window remains unsatisfied without resetting completion", () =>
    Effect.gen(function* () {
      const receipt = yield* observe({ windowShort: true });
      expect(receipt.outcome).toBe("verified");
      expect(
        A.findFirst(receipt.subClaims, (check) => check.ref.ref === "review-window").pipe(
          O.map((check) => check.outcome)
        )
      ).toEqual(O.some("unsatisfied"));
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
      const receipt = yield* observe();
      const encodeReceipt = S.encodeEffect(S.fromJsonString(GoalCompletionReceipt));
      const correct = yield* encodeReceipt(receipt);
      const stale = yield* encodeReceipt(
        GoalCompletionReceipt.make({ ...receipt, declarationDigest: "old-digest", finalPullRequest: 8 })
      );
      yield* writeProjectFile(".beep/goals/completion-receipts.ndjson", `${stale}\n${correct}`);
      const io = fixtureIo(yield* S.encodeEffect(S.fromJsonString(GoalManifest))(value));
      expect(
        yield* storedGoalCompletion(process.cwd(), "demo", value, final).pipe(
          Effect.provideService(GoalCompletionIo, io)
        )
      ).toEqual(O.none());
      const fs = yield* FileSystem.FileSystem;
      yield* fs.writeFileString(".beep/goals/completion-receipts.ndjson", `${stale}\n${correct}\n`);
      expect(
        O.map(
          yield* storedGoalCompletion(process.cwd(), "demo", value, final).pipe(
            Effect.provideService(GoalCompletionIo, io)
          ),
          (row) => row.outcome
        )
      ).toEqual(O.some("verified"));
    })
  );
  it.effect("a transient unknown refresh does not displace definite head-bound evidence", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      const value = yield* manifest();
      const receipt = yield* observe();
      const encodeReceipt = S.encodeEffect(S.fromJsonString(GoalCompletionReceipt));
      const correct = yield* encodeReceipt(receipt);
      const unknown = yield* encodeReceipt(
        GoalCompletionReceipt.make({ ...receipt, outcome: "unknown", evidence: [] })
      );
      yield* writeProjectFile(".beep/goals/completion-receipts.ndjson", `${correct}\n${unknown}\n`);
      const io = fixtureIo(yield* S.encodeEffect(S.fromJsonString(GoalManifest))(value));
      expect(
        O.map(
          yield* storedGoalCompletion(process.cwd(), "demo", value, final).pipe(
            Effect.provideService(GoalCompletionIo, io)
          ),
          (row) => row.outcome
        )
      ).toEqual(O.some("verified"));
    })
  );
  it.effect("doctor online reads without creating the receipt file; explicit refresh is the writer", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      const value = yield* manifest();
      const text = yield* S.encodeEffect(S.fromJsonString(GoalManifest))(value);
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
      expect(
        O.map(
          yield* storedGoalCompletion(process.cwd(), "demo", value, final).pipe(
            Effect.provideService(GoalCompletionIo, io)
          ),
          (row) => row.outcome
        )
      ).toEqual(O.some("verified"));
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
