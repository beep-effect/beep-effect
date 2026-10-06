import { YeetCommandError } from "@beep/repo-cli/commands/Yeet/Yeet.errors";
import {
  decideYeetReadyGate,
  deriveYeetMergeReady,
  ProofJobRecord,
  ProofJobRequest,
  ProofJobSubmitter,
  ProofJobUnit,
  RepoRunContext,
  runYeetReady,
  runYeetReadyGate,
  YeetReadyOptions,
  YeetReadyPullRequestRead,
  YeetStatusArtifact,
  YeetStatusRemote,
} from "@beep/repo-cli/test/Yeet";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, Ref, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as Struct from "effect/Struct";

const headSha = "abc1234def";

const context = RepoRunContext.make({
  base: "origin/main",
  branch: "feature/ready-gate",
  cwd: "/repo",
  head: "HEAD",
  originalArgv: [],
  packetDir: ".beep/yeet",
  repoRoot: "/repo",
  turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
});

// A fake of the monitor's pull request read: the remote summary as
// `collectYeetStatus` reports it, with readiness derived the same way.
const prView = (
  overrides: Partial<{
    readonly available: boolean;
    readonly failingRequiredCheckCount: number;
    readonly headSha: O.Option<string>;
    readonly isDraft: boolean;
    readonly mergeable: string;
    readonly pendingRequiredCheckCount: number;
    readonly state: string;
    readonly unresolvedReviewThreadCount: number;
  }> = {}
): YeetReadyPullRequestRead => {
  const remote = YeetStatusRemote.make({
    available: true,
    checked: true,
    detail: "PR #42 OPEN",
    state: "OPEN",
    number: 42,
    headSha: O.some(headSha),
    isDraft: true,
    mergeable: "MERGEABLE",
    mergeStateStatus: "DRAFT",
    requiredCheckCount: 3,
    failingRequiredCheckCount: 0,
    pendingRequiredCheckCount: 0,
    unresolvedReviewThreadCount: 0,
    ...overrides,
  });
  const closeout = YeetStatusArtifact.make({
    detail: "closed",
    issueCount: 0,
    path: "pr-closeout.json",
    state: "present",
    reviewedHeadSha: O.some(headSha),
  });
  return YeetReadyPullRequestRead.make({ remote, mergeReady: deriveYeetMergeReady(closeout, remote) });
};

const noPullRequest = YeetReadyPullRequestRead.make({
  remote: YeetStatusRemote.make({ available: false, checked: true, detail: "no pull request for this branch" }),
  mergeReady: O.none(),
});

describe("yeet ready gate decision (push-first-publish D10)", () => {
  it("flips a draft whose threads are answered and required checks are green", () => {
    expect(decideYeetReadyGate(prView())).toMatchObject({ _tag: "flip", prNumber: 42 });
  });

  it("flips even while the base conflicts: D10 gates threads and checks only", () => {
    expect(decideYeetReadyGate(prView({ mergeable: "CONFLICTING" }))).toMatchObject({ _tag: "flip" });
  });

  it("reports a non-draft as already ready", () => {
    expect(decideYeetReadyGate(prView({ isDraft: false }))).toMatchObject({ _tag: "already-ready", prNumber: 42 });
  });

  it.each([
    ["no pull request", noPullRequest, "pr-open"],
    ["a closed pull request", prView({ state: "CLOSED" }), "pr-open"],
    ["a failing required check", prView({ failingRequiredCheckCount: 1 }), "required-checks-green"],
    ["a pending required check", prView({ pendingRequiredCheckCount: 2 }), "required-checks-green"],
    ["an unanswered review thread", prView({ unresolvedReviewThreadCount: 1 }), "threads-resolved"],
  ] as const)("refuses %s and names the blocker", (_name, read, blocker) => {
    expect(decideYeetReadyGate(read)).toMatchObject({ _tag: "blocked", blocker });
  });

  it("names the first blocker in gate order when several fail", () => {
    expect(decideYeetReadyGate(prView({ failingRequiredCheckCount: 1, unresolvedReviewThreadCount: 3 }))).toMatchObject(
      { _tag: "blocked", blocker: "required-checks-green" }
    );
  });
});

it.layer(NodeServices.layer, { timeout: "30 seconds" })("yeet ready gate run", (it) => {
  const recordingMarkReady =
    (calls: Ref.Ref<ReadonlyArray<ReadonlyArray<string>>>, fails = false) =>
    (prNumber: number) =>
      Ref.update(calls, (all) => [...all, ["ready", `${prNumber}`]]).pipe(
        Effect.andThen(
          fails
            ? Effect.fail(
                YeetCommandError.make({
                  message: "could not mark pull request #42 ready for review: not permitted",
                  command: "bun run beep yeet gh pr ready 42",
                  exitCode: 1,
                })
              )
            : Effect.void
        )
      );
  // The flip takes the gate read twice: once to decide, once to confirm right
  // before `gh pr ready`. This fake answers the first read with `first` and
  // every later read with `later`.
  const readTwice = (first: YeetReadyPullRequestRead, later: YeetReadyPullRequestRead) =>
    Effect.map(
      Ref.make(0),
      (count) => () => Ref.getAndUpdate(count, (n) => n + 1).pipe(Effect.map((n) => (n === 0 ? first : later)))
    );

  it.effect("runs gh pr ready on the read pull request when the gate holds", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const decision = yield* runYeetReadyGate(context, {
        read: () => Effect.succeed(prView()),
        markReady: recordingMarkReady(calls),
        findMonitor: () => Effect.succeedNone,
      });
      expect(decision._tag).toBe("flip");
      expect(yield* Ref.get(calls)).toEqual([["ready", "42"]]);
    })
  );

  it.effect("refuses to flip when the head moved between the gate read and the confirmation", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const error = yield* runYeetReadyGate(context, {
        read: yield* readTwice(prView(), prView({ headSha: O.some("fedcba9876") })),
        markReady: recordingMarkReady(calls),
      }).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "YeetCommandError" });
      expect(error.message).toContain("changed between the gate read and the flip");
      expect(error.message).toContain(`gate ${headSha}, live fedcba9876`);
      expect(yield* Ref.get(calls)).toEqual([]);
    })
  );

  it.effect("refuses to flip when the same head picks up a new thread before the confirmation", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const error = yield* runYeetReadyGate(context, {
        read: yield* readTwice(prView(), prView({ unresolvedReviewThreadCount: 1 })),
        markReady: recordingMarkReady(calls),
      }).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "YeetCommandError" });
      expect(error.message).toContain("now blocked on threads-resolved");
      expect(yield* Ref.get(calls)).toEqual([]);
    })
  );

  it.effect("refuses with a typed error naming the blocker and never calls gh", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const error = yield* runYeetReadyGate(context, {
        read: () => Effect.succeed(prView({ unresolvedReviewThreadCount: 2 })),
        markReady: recordingMarkReady(calls),
      }).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "YeetReadyGateRefused", blocker: "threads-resolved" });
      expect(error.message).toContain("blocked on threads-resolved");
      expect(error.message).toContain("2 review thread(s) still owe an answer");
      expect(yield* Ref.get(calls)).toEqual([]);
    })
  );

  it.effect("names the current head when required checks are not green", () =>
    Effect.gen(function* () {
      const error = yield* runYeetReadyGate(context, {
        read: () => Effect.succeed(prView({ pendingRequiredCheckCount: 1 })),
        markReady: () => Effect.die("the flip must not run"),
      }).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "YeetReadyGateRefused", blocker: "required-checks-green" });
      expect(error.message).toContain(`on head ${headSha}`);
    })
  );

  it.effect("reads a non-draft pull request with an open thread as already ready, never as a pending flip", () =>
    Effect.gen(function* () {
      const decision = yield* runYeetReadyGate(context, {
        read: () => Effect.succeed(prView({ isDraft: false, unresolvedReviewThreadCount: 1 })),
        markReady: () => Effect.die("the flip must not run"),
      });
      expect(decision._tag).toBe("already-ready");
    })
  );

  it.effect("refuses a closed or merged non-draft pull request on pr-open instead of calling it ready", () =>
    Effect.gen(function* () {
      for (const state of ["CLOSED", "MERGED"] as const) {
        const error = yield* runYeetReadyGate(context, {
          read: () => Effect.succeed(prView({ isDraft: false, state })),
          markReady: () => Effect.die("the flip must not run"),
        }).pipe(Effect.flip);
        expect(error).toMatchObject({ _tag: "YeetReadyGateRefused", blocker: "pr-open" });
        expect(error.message).toContain(state);
      }
    })
  );

  it.effect("does not call gh for a pull request that is already ready", () =>
    Effect.gen(function* () {
      const decision = yield* runYeetReadyGate(context, {
        read: () => Effect.succeed(prView({ isDraft: false })),
        markReady: () => Effect.die("the flip must not run"),
      });
      expect(decision._tag).toBe("already-ready");
    })
  );

  it.effect("fails with a command error when the ready flip fails", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const error = yield* runYeetReadyGate(context, {
        read: () => Effect.succeed(prView()),
        markReady: recordingMarkReady(calls, true),
      }).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "YeetCommandError", command: "bun run beep yeet gh pr ready 42" });
      expect(error.message).toContain("not permitted");
    })
  );
});

const fakeHandle = (output: string, exitCode = 0) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.make(new TextEncoder().encode(output)),
    stdout: Stream.make(new TextEncoder().encode(output)),
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
const mockSpawner = ChildProcessSpawner.make((command) =>
  Effect.succeed(fakeHandle("[]", ChildProcess.isStandardCommand(command) && command.command === "gh" ? 1 : 0))
);
const readyPlatform = Layer.mergeAll(
  MemoryFileSystem.layer,
  Path.layer,
  BunCrypto.layer,
  Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, mockSpawner)
);
it.layer(readyPlatform, { timeout: "10 seconds" })("ready gate runtime boundaries", (it) => {
  it.effect("confirms and flips through the default remote reader", () =>
    Effect.gen(function* () {
      const runner = ChildProcessSpawner.make((command) => {
        if (!ChildProcess.isStandardCommand(command)) return Effect.die("unexpected pipe");
        const route = A.join(A.take(command.args, 2), " ");
        const answers: Readonly<Record<string, string>> = {
          "pr view":
            '{"headRefOid":"abc1234def","id":"PR_ready","isDraft":true,"labels":[],"mergeable":"MERGEABLE","mergeStateStatus":"DRAFT","number":42,"reviewDecision":null,"state":"OPEN","url":"https://github.com/beep/beep/pull/42"}',
          "pr checks":
            '[{"bucket":"pass","completedAt":"2026-10-01T00:00:00Z","link":"","name":"Check","startedAt":"2026-10-01T00:00:00Z","state":"SUCCESS","workflow":"Check"}]',
          "api graphql":
            '{"data":{"node":{"author":{"login":"author"},"reviewThreads":{"nodes":[],"pageInfo":{"endCursor":null,"hasNextPage":false}}}}}',
          "run list": "[]",
        };
        return Effect.succeed(fakeHandle(command.command === "gh" ? (answers[route] ?? "") : ""));
      });
      expect(
        (yield* runYeetReadyGate(context, { markReady: () => Effect.void }).pipe(
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, runner)
        ))._tag
      ).toBe("flip");
    })
  );
  it.effect("reads remote status through the default reader", () =>
    Effect.gen(function* () {
      expect((yield* runYeetReadyGate(context).pipe(Effect.flip))._tag).toBe("YeetReadyGateRefused");
    })
  );
  it.effect("hydrates the command context before its default remote read", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.makeDirectory(`${process.cwd()}/.git`, { recursive: true });
      const error = yield* runYeetReady(
        YeetReadyOptions.make({ base: "origin/main", head: "HEAD", packetDir: ".beep/yeet" })
      ).pipe(Effect.flip);
      expect(error._tag).toBe("YeetReadyGateRefused");
    })
  );
  it.effect("loses only the hint when the monitor registry is unreadable", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const failingFs = FileSystem.FileSystem.of({
        ...fs,
        exists: Effect.fn("ReadyTest.exists")(() =>
          Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", module: "ReadyTest", method: "exists" }))
        ),
      });
      expect(
        (yield* runYeetReadyGate(context, {
          read: () => Effect.succeed(prView()),
          markReady: () => Effect.void,
        }).pipe(Effect.provideService(FileSystem.FileSystem, failingFs)))._tag
      ).toBe("flip");
    })
  );
  it.effect("reads an empty monitor registry after the flip", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.makeDirectory("/repo/.beep/yeet/jobs", { recursive: true });
      yield* fs.remove("/repo/.beep/yeet/jobs/.guard", { recursive: true, force: true });
      yield* fs.writeFileString("/repo/.beep/yeet/jobs/.guard", "");
      expect(
        (yield* runYeetReadyGate(context, {
          read: () => Effect.succeed(prView()),
          markReady: () => Effect.void,
        }))._tag
      ).toBe("flip");
    })
  );
});
it.layer(NodeServices.layer, { timeout: "10 seconds" })("ready confirmation races", (it) => {
  it.effect("refuses another flip after an actor already marked the PR ready", () =>
    Effect.gen(function* () {
      const count = yield* Ref.make(0);
      const error = yield* runYeetReadyGate(context, {
        read: () => Ref.getAndUpdate(count, (n) => n + 1).pipe(Effect.map((n) => prView({ isDraft: n === 0 }))),
      }).pipe(Effect.flip);
      expect(error.message).toContain("already ready for review");
    })
  );
  it.effect("refuses a flip without a head identity", () =>
    Effect.gen(function* () {
      const error = yield* runYeetReadyGate(context, {
        read: () => Effect.succeed(prView({ headSha: O.none() })),
      }).pipe(Effect.flip);
      expect(error.message).toContain("gate unknown, live unknown");
    })
  );
  it.effect("maps an unavailable GitHub token on the default flip to the command error", () =>
    Effect.gen(function* () {
      // Every child process (`gh auth token`) fails, so no request reaches GitHub.
      const refusing = ChildProcessSpawner.make(() => Effect.succeed(fakeHandle("", 1)));
      const error = yield* runYeetReadyGate(context, {
        read: () => Effect.succeed(prView()),
      }).pipe(Effect.flip, Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, refusing));
      expect(error).toMatchObject({ _tag: "YeetCommandError", command: "bun run beep yeet gh pr ready 42" });
      expect(error.message).toContain("could not mark pull request #42 ready for review");
    })
  );
  it.effect("reports the existing monitor after a successful flip", () =>
    Effect.gen(function* () {
      const record = ProofJobRecord.make({
        jobId: "cc5d6bd3-1111-4aaa-8bbb-000000000001",
        phase: "running",
        submittedAt: "2026-10-05T10:00:00.000Z",
        request: ProofJobRequest.make({
          mode: "monitor",
          argv: ["monitor", "--until-ready"],
          checkout: "/repo",
          branch: context.branch,
          base: "origin/main",
          head: headSha,
          forwardedEnvNames: [],
        }),
        submitter: ProofJobSubmitter.make({ pid: 4242, procStart: O.none(), cwd: "/repo", harness: O.none() }),
        unit: ProofJobUnit.make({
          unitName: "beep-proof-test.service",
          slice: "agent-runs.slice",
          description: "test",
          logPath: "/repo/test.log",
          execStart: ["bun"],
          execStopPost: ["bun"],
          maxRuntimeSeconds: O.none(),
          invocationId: O.none(),
        }),
        runner: O.none(),
        outcome: O.none(),
        systemd: O.none(),
        terminationReason: O.none(),
        cancelRequestedAt: O.none(),
        prNumber: O.some(42),
      });
      expect(
        (yield* runYeetReadyGate(context, {
          read: () => Effect.succeed(prView()),
          markReady: () => Effect.void,
          findMonitor: () => Effect.succeedSome(record),
        }))._tag
      ).toBe("flip");
    })
  );
});

describe("ready gate incomplete remote identities", () => {
  it("reports a closed remote whose number is absent", () => {
    const read = prView({ state: "CLOSED" });
    const decision = decideYeetReadyGate(
      YeetReadyPullRequestRead.make({
        ...read,
        remote: YeetStatusRemote.make(Struct.omit(read.remote, ["number"])),
      })
    );
    expect(decision).toMatchObject({ _tag: "blocked", detail: "pull request #? is CLOSED" });
  });
  it("fails closed if a successful verdict lacks a PR number", () => {
    const read = prView();
    expect(
      decideYeetReadyGate(
        YeetReadyPullRequestRead.make({
          ...read,
          remote: YeetStatusRemote.make(Struct.omit(read.remote, ["number"])),
        })
      )._tag
    ).toBe("blocked");
  });
  it("reports an unknown head for checks that cannot be proven green", () => {
    expect(decideYeetReadyGate(prView({ headSha: O.none(), failingRequiredCheckCount: 1 }))).toMatchObject({
      _tag: "blocked",
      detail: expect.stringContaining("on head unknown"),
    });
  });
  it.layer(NodeServices.layer, { timeout: "10 seconds" })((it) => {
    it.effect("refuses a successful verdict with no head identity before capture", () =>
      Effect.gen(function* () {
        const read = prView();
        const withoutHead = YeetReadyPullRequestRead.make({
          ...read,
          remote: YeetStatusRemote.make({ ...read.remote, headSha: O.none() }),
        });
        const error = yield* runYeetReadyGate(context, { read: () => Effect.succeed(withoutHead) }).pipe(Effect.flip);
        expect(error.message).toContain("gate unknown, live unknown");
      })
    );
  });
});
