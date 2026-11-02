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
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
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
const handle = (output: string, exitCode = 0) => {
  const stdout = Stream.make(new TextEncoder().encode(output));
  return ChildProcessSpawner.makeHandle({
    all: stdout,
    stdout,
    stderr: Stream.empty,
    stdin: Sink.drain,
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    unref: Effect.succeed(Effect.void),
  });
};
// `Git` is rebuilt over each substituted spawner: the pull request's remote and diff reads run
// through the kit (W2b).
const provideSpawner =
  (spawner: ChildProcessSpawner.ChildProcessSpawner["Service"]) =>
  <A, E, R>(self: Effect.Effect<A, E, R>) =>
    self.pipe(
      Effect.provideServiceEffect(Git, Git.make),
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
    );
const withGh = (output: string, exitCode = 0) =>
  provideSpawner(ChildProcessSpawner.make(() => Effect.succeed(handle(output, exitCode))));
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
        const view = { number: 42, state: "OPEN", headRefName: context.branch };
        for (const views of [[view], [{ ...view, state: "CLOSED" }, { ...view, headRefName: "other" }, view], []]) {
          const output = yield* encodeList(views);
          const calls = yield* Ref.make<ReadonlyArray<string>>([]);
          const runner = ChildProcessSpawner.make((command) => {
            if (!ChildProcess.isStandardCommand(command)) return Effect.die("unexpected pipe");
            return Ref.update(calls, A.append(command.command)).pipe(
              Effect.as(handle(command.command === "git" ? "git@github.com:beep-effect/beep-effect.git" : output))
            );
          });
          const found = yield* findOpenPullRequest(context).pipe(provideSpawner(runner));
          if (A.isReadonlyArrayEmpty(views)) assertNone(found);
          else
            assertSome(
              O.map(found, (pr) => pr.number),
              42
            );
          expect(yield* Ref.get(calls)).toEqual(["git", "gh"]);
          if (A.isReadonlyArrayNonEmpty(views)) {
            const required = yield* runGhPullRequestView(context).pipe(provideSpawner(runner));
            expect(required.number).toBe(42);
          }
        }
      })
    );

    it.effect("retains REST lookup failures when GraphQL is rate limited", () =>
      Effect.gen(function* () {
        for (const [output, exitCode, message] of [
          ["REST unavailable", 7, "REST unavailable"],
          ["invalid JSON", 0, "Failed to decode GitHub REST pull request JSON"],
          [Str.repeat(512 * 1024 + 1)("x"), 0, "capture limit"],
        ] as const) {
          const runner = ChildProcessSpawner.make((command) => {
            if (!ChildProcess.isStandardCommand(command)) return Effect.die("unexpected pipe");
            return Effect.succeed(
              command.command === "git"
                ? handle("https://github.com/beep-effect/beep-effect.git")
                : command.args[0] === "api"
                  ? handle(output, exitCode)
                  : handle("GraphQL: API rate limit already exceeded", 1)
            );
          });
          const provide = provideSpawner(runner);
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
        const withSpawnFailure = provideSpawner(
          ChildProcessSpawner.make(() =>
            Effect.fail(PlatformError.badArgument({ module: "ChildProcess", method: "spawn" }))
          )
        );
        const spawnFailure = yield* runGhPullRequestView(context).pipe(Effect.flip, withSpawnFailure);
        expect(spawnFailure.message).toBe("Failed to inspect current branch pull request.");
        const findFailure = yield* findOpenPullRequest(context).pipe(Effect.flip, withSpawnFailure);
        expect(findFailure.message).toBe(spawnFailure.message);
      })
    );

    it.effect("treats a missing PR as None but rejects closed or mismatched PRs for monitoring", () =>
      Effect.gen(function* () {
        assertNone(yield* findOpenPullRequest(context).pipe(withGh("no PR", 1)));
        for (const view of [
          { number: 42, state: "CLOSED", headRefName: context.branch },
          { number: 42, state: "OPEN", headRefName: "feat/other" },
        ] as const) {
          const output = yield* encodeView(view);
          assertNone(yield* findOpenPullRequest(context).pipe(withGh(output)));
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
          yield* applyHeavyAdmissionLabel(context, recorder, O.some(labelStep), created, {
            changedPaths: () => Effect.succeed(paths),
            capture: (_command, args) =>
              Ref.update(calls, A.append(args)).pipe(Effect.as({ exitCode: 0, output: "labelled", truncated: false })),
          });
          const docs = A.contains(paths, "README.md");
          expect(A.map(yield* Ref.get(recorder), (entry) => entry.status)).toEqual([docs ? "skipped" : "passed"]);
          expect(yield* Ref.get(calls)).toEqual(
            docs
              ? []
              : [
                  [
                    "api",
                    "-X",
                    "POST",
                    "repos/{owner}/{repo}/issues/42/labels",
                    "-f",
                    "labels[]=ready-for-heavy",
                    "--jq",
                    'map(.name) | join(",")',
                  ],
                ]
          );
        }
        const recorder = yield* Ref.make<ReadonlyArray<YeetExecutedStep>>([]);
        yield* applyHeavyAdmissionLabel(context, recorder, O.none(), created);
        expect(yield* Ref.get(recorder)).toEqual([]);
        yield* applyHeavyAdmissionLabel(
          context,
          recorder,
          O.some(labelStep),
          YeetEnsuredPullRequest.make({ number: 42, created: false })
        );
        yield* applyHeavyAdmissionLabel(context, recorder, O.some(labelStep), created, {
          changedPaths: () => Effect.succeed(["package.json"]),
          capture: () => Effect.succeed({ exitCode: 1, output: "label denied", truncated: false }),
        });
        expect(A.map(yield* Ref.get(recorder), (entry) => [entry.status, entry.result.exitCode])).toEqual([
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
