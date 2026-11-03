import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { Git } from "@beep/git/Git";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  applyHeavyAdmissionLabel,
  buildYeetRunPlan,
  defaultYeetRunOptions,
  findOpenPullRequest,
  findOpenPullRequestViaRest,
  RepoPlanStep,
  RepoRunContext,
  runGhPullRequestView,
  validateCommitMessage,
  validateMonitorBranch,
  validateMonitorGuards,
  validateOpenPullRequest,
  YeetEnsuredPullRequest,
} from "@beep/repo-cli/test/Yeet";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import { captureGithub, provideLegacyGh, restPullRequest } from "./support/YeetGithub.ts";
import type { YeetExecutedStep } from "@beep/repo-cli/test/Yeet";

const context = RepoRunContext.make({
  repoRoot: "/repo",
  cwd: "/repo",
  base: "origin/main",
  head: "HEAD",
  branch: "feat/quality",
  packetDir: ".beep/yeet",
  originalArgv: [],
  turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
});
const labelStep = RepoPlanStep.make({
  id: "publish:pr-label",
  label: "publish:pr-label",
  phase: "publish",
  command: "gh",
  args: [],
  cwd: "/repo",
  scope: "repo",
  mutability: "write",
  resume: "never",
});
const created = YeetEnsuredPullRequest.make({ number: 42, created: true });
// `Git` is rebuilt over each substituted spawner: the pull request's remote and diff reads run
// through the kit (W2b). The kit's GitHub calls reach the same spawner as the `gh api` argv they
// replaced (W6).
const provideGitOver =
  (spawner: ScriptedSpawner) =>
  <A, E, R>(self: Effect.Effect<A, E, R>) =>
    self.pipe(provideLegacyGh, Effect.provideServiceEffect(Git, Git.make), provideSpawner(spawner));
const withGh = (output: string, exitCode = 0) =>
  provideGitOver(ScriptedSpawner.make(() => ({ stdout: output, exit: exitCode })));
const encodeView = S.encodeEffect(
  S.fromJsonString(
    S.Struct({
      number: S.Finite,
      state: S.Literals(["OPEN", "CLOSED", "MERGED"]),
      headRefName: S.String,
    })
  )
);

const encodeList = S.encodeEffect(S.fromJsonString(S.Array(S.Unknown)));

describe("Yeet pull request lifecycle boundaries", () => {
  it.layer(Layer.mergeAll(BunCrypto.layer, MemoryFileSystem.layer, Path.layer), { timeout: "10 seconds" })((it) => {
    it.effect("uses REST branch matches and preserves confirmed absence without a GraphQL read", () =>
      Effect.gen(function* () {
        const view = { number: 42, state: "open", headRefName: context.branch };
        for (const views of [[view], [{ ...view, state: "closed" }, { ...view, headRefName: "other" }, view], []]) {
          const output = yield* encodeList(
            A.map(views, (pull) =>
              restPullRequest({ number: pull.number, state: pull.state, head: { ref: pull.headRefName, sha: "abc" } })
            )
          );
          const runner = ScriptedSpawner.make((command) => ({
            stdout: command === "git" ? "git@github.com:beep-effect/beep-effect.git" : output,
          }));
          const found = yield* findOpenPullRequest(context).pipe(provideGitOver(runner));
          if (A.isReadonlyArrayEmpty(views)) assertNone(found);
          else
            assertSome(
              O.map(found, (pr) => pr.number),
              42
            );
          expect(A.map(runner.spawns, (spawn) => spawn.command)).toEqual(["git", "gh"]);
          if (A.isReadonlyArrayNonEmpty(views)) {
            const required = yield* runGhPullRequestView(context).pipe(provideGitOver(runner));
            expect(required.number).toBe(42);
          }
        }
      })
    );

    it.effect("retains REST lookup failures when GraphQL is rate limited", () =>
      Effect.gen(function* () {
        for (const [output, exitCode, message] of [
          ["REST unavailable", 7, "REST unavailable"],
          ["invalid JSON", 0, "Failed to inspect current branch pull request through GitHub REST: "],
          [Str.repeat(512 * 1024 + 1)("x"), 0, "Failed to inspect current branch pull request through GitHub REST: "],
        ] as const) {
          const runner = ScriptedSpawner.make((command, args) =>
            command === "git"
              ? { stdout: "https://github.com/beep-effect/beep-effect.git" }
              : args[0] === "api"
                ? { stdout: output, exit: exitCode }
                : { stdout: "GraphQL: API rate limit already exceeded", exit: 1 }
          );
          const provide = provideGitOver(runner);
          const failure = yield* findOpenPullRequest(context).pipe(Effect.flip, provide);
          expect(failure.message).toContain(message);
          const direct = yield* findOpenPullRequestViaRest(context).pipe(Effect.flip, provide);
          expect(direct.message).toBe(failure.message);
          const required = yield* runGhPullRequestView(context).pipe(Effect.flip, provide);
          expect(required.command).toBe("gh api repos/{owner}/{repo}/pulls");
        }
      })
    );

    it.effect("rejects protected monitoring branches and incompatible publication flags", () =>
      Effect.gen(function* () {
        for (const branch of ["main", "master", "HEAD"]) {
          const failure = yield* validateMonitorBranch(RepoRunContext.make({ ...context, branch })).pipe(Effect.flip);
          expect(failure.message).toContain(`refusing to monitor branch "${branch}"`);
        }
        for (const options of [
          defaultYeetRunOptions({ mode: "publish", tier: "review-fix" }),
          defaultYeetRunOptions({ noEdit: true }),
          defaultYeetRunOptions({ mode: "verify", pushOnly: true }),
          defaultYeetRunOptions({ pushOnly: true, reuseVerified: true, amend: true }),
          defaultYeetRunOptions({ pushOnly: true, reuseVerified: true, noEdit: true, amend: true }),
          defaultYeetRunOptions({ pushOnly: true, reuseVerified: true, message: "fix(repo): repair" }),
          defaultYeetRunOptions({ mode: "verify", stagedOnly: true }),
          defaultYeetRunOptions({ stagedOnly: true, pushOnly: true, reuseVerified: true }),
          defaultYeetRunOptions({ stagedOnly: true, reuseVerified: true }),
          defaultYeetRunOptions({ stagedOnly: true, amend: true }),
        ]) {
          const failure = yield* validateMonitorGuards(context, options).pipe(Effect.flip);
          expect(failure._tag).toBe("YeetCommandError");
          expect(failure.exitCode).toBe(1);
          expect(failure.message).toEqual(expect.any(String));
          expect(failure.message.length).toBeGreaterThan(0);
        }
        // Merge-only eligibility is checked by the publish handler, after option guards.
        yield* validateMonitorGuards(context, defaultYeetRunOptions({ pushOnly: true }));
        yield* validateMonitorGuards(context, defaultYeetRunOptions({ mode: "verify" }));
        yield* validateMonitorGuards(context, defaultYeetRunOptions({ mode: "monitor", plan: true }));
        yield* validateMonitorGuards(context, defaultYeetRunOptions({ monitor: true, pr: true }));
        const output = yield* encodeView({ number: 42, state: "OPEN", headRefName: context.branch });
        yield* validateMonitorGuards(context, defaultYeetRunOptions({ mode: "closeout" })).pipe(withGh(output));
      }).pipe(withGh(""))
    );

    it.effect("accepts commitlint success and preserves rejection output and status", () =>
      Effect.gen(function* () {
        yield* validateCommitMessage(context, "fix(repo): repair").pipe(withGh(""));
        const failure = yield* validateCommitMessage(context, "invalid message").pipe(
          Effect.flip,
          withGh("subject must be conventional", 1)
        );
        expect(failure.message).toBe("commit message failed commitlint:\nsubject must be conventional");
        expect(failure.exitCode).toBe(1);
      })
    );

    it.effect("reports nonzero, truncated, and spawn failures when a PR is required", () =>
      Effect.gen(function* () {
        const nonzero = yield* runGhPullRequestView(context).pipe(Effect.flip, withGh("no PR", 1));
        expect(nonzero).toMatchObject({
          exitCode: 1,
          message: expect.stringContaining("requires an open pull request"),
        });
        const truncated = yield* runGhPullRequestView(context).pipe(
          Effect.flip,
          withGh(Str.repeat(512 * 1024 + 1)("x"))
        );
        expect(truncated.message).toContain("capture limit");
        const withSpawnFailure = provideGitOver(
          ScriptedSpawner.make(() => PlatformError.badArgument({ module: "ChildProcess", method: "spawn" }))
        );
        const spawnFailure = yield* runGhPullRequestView(context).pipe(Effect.flip, withSpawnFailure);
        expect(spawnFailure.message).toBe("Failed to inspect current branch pull request.");
        const findFailure = yield* findOpenPullRequest(context).pipe(Effect.flip, withSpawnFailure);
        expect(findFailure.message).toBe(spawnFailure.message);
      })
    );

    it.effect("treats a missing PR as None but rejects closed or mismatched PRs for monitoring", () =>
      Effect.gen(function* () {
        const missingPr = yield* findOpenPullRequest(context).pipe(withGh("no PR", 1));
        assertNone(missingPr);
        for (const view of [
          { number: 42, state: "CLOSED", headRefName: context.branch },
          { number: 42, state: "OPEN", headRefName: "feat/other" },
        ] as const) {
          const output = yield* encodeView(view);
          const rejectedPr = yield* findOpenPullRequest(context).pipe(withGh(output));
          assertNone(rejectedPr);
          const failure = yield* validateOpenPullRequest(context).pipe(Effect.flip, withGh(output));
          expect(failure.message).toContain(view.state === "CLOSED" ? "is CLOSED" : "expected PR head");
        }
      })
    );

    it.effect("admits code and empty diffs, records failures, and skips docs or existing PRs", () =>
      Effect.gen(function* () {
        for (const paths of [["package.json"], [], ["README.md"]]) {
          const recorder = yield* Ref.make<ReadonlyArray<YeetExecutedStep>>([]);
          const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
          const labelled = yield* encodeList([{ name: "ready-for-heavy" }]);
          yield* applyHeavyAdmissionLabel(context, recorder, O.some(labelStep), created, {
            changedPaths: () => Effect.succeed(paths),
          }).pipe(
            captureGithub((_command, args) =>
              Ref.update(calls, A.append(args)).pipe(Effect.as({ exitCode: 0, output: labelled }))
            ).provide
          );
          const docs = A.contains(paths, "README.md");
          const recorderValue3 = yield* Ref.get(recorder);
          expect(A.map(recorderValue3, (entry) => entry.status)).toEqual([docs ? "skipped" : "passed"]);
          const callsValue4 = yield* Ref.get(calls);
          expect(callsValue4).toEqual(
            docs ? [] : [["api", "-X", "POST", "repos/{owner}/{repo}/issues/42/labels", 'labels=["ready-for-heavy"]']]
          );
        }
        const recorder = yield* Ref.make<ReadonlyArray<YeetExecutedStep>>([]);
        const denied = captureGithub(() => Effect.succeed({ exitCode: 1, output: "label denied" }));
        yield* applyHeavyAdmissionLabel(context, recorder, O.none(), created).pipe(denied.provide);
        const recorderValue5 = yield* Ref.get(recorder);
        expect(recorderValue5).toEqual([]);
        yield* applyHeavyAdmissionLabel(
          context,
          recorder,
          O.some(labelStep),
          YeetEnsuredPullRequest.make({ number: 42, created: false })
        ).pipe(denied.provide);
        yield* applyHeavyAdmissionLabel(context, recorder, O.some(labelStep), created, {
          changedPaths: () => Effect.succeed(["package.json"]),
        }).pipe(denied.provide);
        const recorderValue6 = yield* Ref.get(recorder);
        expect(A.map(recorderValue6, (entry) => [entry.status, entry.result.exitCode])).toEqual([
          ["skipped", 0],
          ["failed", 1],
        ]);
      }).pipe(withGh(""))
    );
  });

  it("keeps the compatibility planner equivalent in both dual invocation forms", () => {
    const message = O.some("fix(repo): restore quality");
    expect(buildYeetRunPlan(context, message)).toEqual(buildYeetRunPlan(message)(context));
  });
});
