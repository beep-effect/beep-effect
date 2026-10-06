import {
  applyHeavyAdmissionLabel,
  buildYeetRunPlan,
  findOpenPullRequest,
  RepoPlanStep,
  RepoRunContext,
  runGhPullRequestView,
  validateOpenPullRequest,
  YeetEnsuredPullRequest,
} from "@beep/repo-cli/test/Yeet";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import { Effect, Ref, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import { ChildProcessSpawner } from "effect/process";
import * as S from "effect/Schema";
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
const withGh = (output: string, exitCode = 0) =>
  Effect.provideService(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() => Effect.succeed(handle(output, exitCode)))
  );
const encodeView = S.encodeEffect(
  S.fromJsonString(
    S.Struct({
      number: S.Finite,
      state: S.Literals(["OPEN", "CLOSED", "MERGED"]),
      headRefName: S.String,
    })
  )
);

describe("Yeet pull request lifecycle boundaries", () => {
  it.layer(BunCrypto.layer, { timeout: "10 seconds" })((it) => {
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
        const withSpawnFailure = Effect.provideService(
          ChildProcessSpawner.ChildProcessSpawner,
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
          expect(yield* Ref.get(calls)).toEqual(docs ? [] : [["pr", "edit", "42", "--add-label", "ready-for-heavy"]]);
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
