import { YeetReadyOptions } from "@beep/repo-cli/commands/Yeet";
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
  YeetReadyPullRequestRead,
  YeetStatusArtifact,
  YeetStatusRemote,
} from "@beep/repo-cli/test/Yeet";
import { DomainError } from "@beep/repo-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Match, Ref, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import { ChildProcessSpawner } from "effect/process";
import * as S from "effect/Schema";

const headSha = "abc1234def";
const encodeStatusFixture = S.encodeEffect(S.fromJsonString(S.Unknown));

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

  it("explains unknown head and absent check counters when the check verdict is blocked", () => {
    const incomplete = YeetStatusRemote.make({
      available: true,
      checked: true,
      detail: "incomplete checks",
      state: "OPEN",
      number: 42,
      isDraft: true,
      headSha: O.none(),
    });
    const decision = decideYeetReadyGate(
      YeetReadyPullRequestRead.make({
        remote: incomplete,
        mergeReady: prView({ pendingRequiredCheckCount: 1 }).mergeReady,
      })
    );
    expect(decision).toMatchObject({
      _tag: "blocked",
      blocker: "required-checks-green",
      detail: expect.stringContaining("head unknown: 0 failing, 0 pending of 0 required"),
    });
  });

  it("identifies a closed PR without its number", () => {
    const remote = YeetStatusRemote.make({ available: true, checked: true, state: "CLOSED", detail: "closed" });
    expect(decideYeetReadyGate(YeetReadyPullRequestRead.make({ remote, mergeReady: O.none() }))).toMatchObject({
      _tag: "blocked",
      detail: "pull request #? is CLOSED",
    });
  });

  it("refuses a ready verdict whose PR summary omitted its number", () => {
    const ready = prView();
    const { number: _number, ...fields } = ready.remote;
    expect(
      decideYeetReadyGate(YeetReadyPullRequestRead.make({ ...ready, remote: YeetStatusRemote.make(fields) }))
    ).toMatchObject({
      _tag: "blocked",
      blocker: "pr-open",
    });
  });

  it("names the first blocker in gate order when several fail", () => {
    expect(decideYeetReadyGate(prView({ failingRequiredCheckCount: 1, unresolvedReviewThreadCount: 3 }))).toMatchObject(
      { _tag: "blocked", blocker: "required-checks-green" }
    );
  });
});

it.layer(NodeServices.layer, { timeout: "30 seconds" })("yeet ready gate run", (it) => {
  const recordingCapture =
    (calls: Ref.Ref<ReadonlyArray<ReadonlyArray<string>>>, exitCode = 0) =>
    (command: string, args: ReadonlyArray<string>) =>
      Ref.update(calls, (all) => [...all, [command, ...args]]).pipe(
        Effect.as({ exitCode, output: exitCode === 0 ? "" : "gh: not permitted", truncated: false })
      );
  // The flip takes the gate read twice: once to decide, once to confirm right
  // before `gh pr ready`. This fake answers the first read with `first` and
  // every later read with `later`.
  const readTwice = (first: YeetReadyPullRequestRead, later: YeetReadyPullRequestRead) =>
    Effect.map(
      Ref.make(0),
      (count) => () => Ref.getAndUpdate(count, (n) => n + 1).pipe(Effect.map((n) => (n === 0 ? first : later)))
    );

  it.effect("uses the default status reader and refuses a missing PR", () =>
    Effect.gen(function* () {
      const handle = ChildProcessSpawner.makeHandle({
        all: Stream.empty,
        stdout: Stream.empty,
        stderr: Stream.empty,
        stdin: Sink.drain,
        exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
        getInputFd: () => Sink.drain,
        getOutputFd: () => Stream.empty,
        isRunning: Effect.succeed(false),
        kill: () => Effect.void,
        pid: ChildProcessSpawner.ProcessId(1),
        unref: Effect.succeed(Effect.void),
      });
      const error = yield* runYeetReadyGate(context).pipe(
        Effect.flip,
        Effect.provideService(
          ChildProcessSpawner.ChildProcessSpawner,
          ChildProcessSpawner.make((command) =>
            Effect.succeed({
              ...handle,
              exitCode: Effect.succeed(
                ChildProcessSpawner.ExitCode(command._tag === "StandardCommand" && command.command === "gh" ? 1 : 0)
              ),
            })
          )
        )
      );
      expect(error).toMatchObject({ _tag: "YeetReadyGateRefused", blocker: "pr-open" });
    })
  );

  it.effect("hydrates the ready command and runs its gate without a PR", () =>
    Effect.gen(function* () {
      const spawner = ChildProcessSpawner.make((command) => {
        const args = command._tag === "StandardCommand" ? command.args : [];
        const output = A.contains(args, "--show-toplevel")
          ? "/repo"
          : A.contains(args, "--show-current")
            ? context.branch
            : "";
        const stdout = Stream.make(new TextEncoder().encode(output));
        return Effect.succeed(
          ChildProcessSpawner.makeHandle({
            all: stdout,
            stdout,
            stderr: Stream.empty,
            stdin: Sink.drain,
            exitCode: Effect.succeed(
              ChildProcessSpawner.ExitCode(command._tag === "StandardCommand" && command.command === "gh" ? 1 : 0)
            ),
            getInputFd: () => Sink.drain,
            getOutputFd: () => Stream.empty,
            isRunning: Effect.succeed(false),
            kill: () => Effect.void,
            pid: ChildProcessSpawner.ProcessId(1),
            unref: Effect.succeed(Effect.void),
          })
        );
      });
      const error = yield* runYeetReady(
        YeetReadyOptions.make({ base: context.base, head: context.head, packetDir: context.packetDir })
      ).pipe(Effect.flip, Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner));
      expect(error).toMatchObject({ _tag: "YeetReadyGateRefused", blocker: "pr-open" });
    })
  );

  it.effect("refuses to flip even when both reads claim readiness without a head identity", () =>
    Effect.gen(function* () {
      const ready = prView();
      const headless = YeetReadyPullRequestRead.make({
        ...ready,
        remote: YeetStatusRemote.make({ ...ready.remote, headSha: O.none() }),
      });
      const error = yield* runYeetReadyGate(context, {
        read: () => Effect.succeed(headless),
        capture: () => Effect.die("gh must not run"),
      }).pipe(Effect.flip);
      expect(error.message).toContain("gate unknown, live unknown");
    })
  );

  it.effect("uses the default status reads and command runner for a green draft", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const spawner = ChildProcessSpawner.make((command) =>
        Effect.gen(function* () {
          const args = command._tag === "StandardCommand" ? command.args : [];
          yield* Ref.update(calls, (all) => [...all, args]);
          const output = yield* Match.value(`${args[0]}:${args[1]}`).pipe(
            Match.when("pr:view", () =>
              encodeStatusFixture({
                id: "PR_fixture",
                number: 42,
                url: "https://example.com/pr/42",
                state: "OPEN",
                isDraft: true,
                headRefOid: headSha,
                mergeable: "MERGEABLE",
                mergeStateStatus: "DRAFT",
                reviewDecision: null,
              })
            ),
            Match.when("pr:checks", () =>
              encodeStatusFixture([{ name: "required", bucket: "pass", state: "SUCCESS" }])
            ),
            Match.when("api:graphql", () =>
              encodeStatusFixture({
                data: {
                  node: {
                    reviewThreads: {
                      nodes: [],
                      pageInfo: { hasNextPage: false, endCursor: null },
                    },
                  },
                },
              })
            ),
            Match.when("run:list", () => Effect.succeed("[]")),
            Match.orElse(() => Effect.succeed("")),
            Effect.orDie
          );
          const stdout = Stream.make(new TextEncoder().encode(output));
          return ChildProcessSpawner.makeHandle({
            all: stdout,
            stdout,
            stderr: Stream.empty,
            stdin: Sink.drain,
            exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
            getInputFd: () => Sink.drain,
            getOutputFd: () => Stream.empty,
            isRunning: Effect.succeed(false),
            kill: () => Effect.void,
            pid: ChildProcessSpawner.ProcessId(1),
            unref: Effect.succeed(Effect.void),
          });
        })
      );
      const decision = yield* runYeetReadyGate(context, { findMonitor: () => Effect.succeedNone }).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
      );
      expect(decision._tag).toBe("flip");
      expect(A.filter(yield* Ref.get(calls), (args) => args[0] === "pr" && args[1] === "ready")).toEqual([
        ["pr", "ready", "42"],
      ]);
    })
  );

  it.effect("keeps the successful flip when the default monitor registry read fails", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const decision = yield* runYeetReadyGate(context, {
        read: () => Effect.succeed(prView()),
        capture: recordingCapture(calls),
      }).pipe(
        Effect.provideService(FileSystem.FileSystem, {
          ...fs,
          stat: () => Effect.fail(PlatformError.badArgument({ module: "FileSystem", method: "stat" })),
        })
      );
      expect(decision._tag).toBe("flip");
      expect(yield* Ref.get(calls)).toEqual([["gh", "pr", "ready", "42"]]);
    })
  );

  it.effect("reports a live monitor after flipping and wraps runner failures", () =>
    Effect.gen(function* () {
      const jobId = "aaaaaaaa-1111-4aaa-8bbb-000000000001";
      const record = ProofJobRecord.make({
        schemaVersion: "yeet-proof-job/v1",
        jobId,
        phase: "running",
        submittedAt: "2026-10-05T00:00:00Z",
        request: ProofJobRequest.make({
          mode: "monitor",
          argv: ["monitor", "--until-ready"],
          checkout: "/repo",
          branch: context.branch,
          base: context.base,
          head: context.head,
          forwardedEnvNames: [],
        }),
        submitter: ProofJobSubmitter.make({ pid: 1, cwd: "/repo", procStart: O.none(), harness: O.none() }),
        unit: ProofJobUnit.make({
          unitName: `beep-proof-${jobId}.service`,
          slice: "agent-runs.slice",
          description: "fixture",
          logPath: "/repo/monitor.log",
          execStart: ["bun"],
          execStopPost: [],
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
      const decision = yield* runYeetReadyGate(context, {
        read: () => Effect.succeed(prView()),
        capture: () => Effect.succeed({ exitCode: 0, output: "", truncated: false }),
        findMonitor: () => Effect.succeedSome(record),
      });
      expect(decision._tag).toBe("flip");
      const error = yield* runYeetReadyGate(context, {
        read: () => Effect.succeed(prView()),
        capture: () => Effect.fail(DomainError.make({ message: "spawn failed" })),
      }).pipe(Effect.flip);
      expect(error.message).toContain("Failed to run gh pr ready");
    })
  );

  it.effect("refuses a confirmation that has already flipped or has no head", () =>
    Effect.gen(function* () {
      for (const later of [prView({ isDraft: false }), prView({ headSha: O.none() })]) {
        const error = yield* runYeetReadyGate(context, {
          read: yield* readTwice(prView(), later),
          capture: () => Effect.die("gh must not run"),
        }).pipe(Effect.flip);
        expect(error.message).toContain("changed between the gate read and the flip");
      }
    })
  );

  it.effect("runs gh pr ready on the read pull request when the gate holds", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const decision = yield* runYeetReadyGate(context, {
        read: () => Effect.succeed(prView()),
        capture: recordingCapture(calls),
        findMonitor: () => Effect.succeedNone,
      });
      expect(decision._tag).toBe("flip");
      expect(yield* Ref.get(calls)).toEqual([["gh", "pr", "ready", "42"]]);
    })
  );

  it.effect("refuses to flip when the head moved between the gate read and the confirmation", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const error = yield* runYeetReadyGate(context, {
        read: yield* readTwice(prView(), prView({ headSha: O.some("fedcba9876") })),
        capture: recordingCapture(calls),
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
        capture: recordingCapture(calls),
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
        capture: recordingCapture(calls),
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
        capture: () => Effect.die("gh must not run"),
      }).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "YeetReadyGateRefused", blocker: "required-checks-green" });
      expect(error.message).toContain(`on head ${headSha}`);
    })
  );

  it.effect("reads a non-draft pull request with an open thread as already ready, never as a pending flip", () =>
    Effect.gen(function* () {
      const decision = yield* runYeetReadyGate(context, {
        read: () => Effect.succeed(prView({ isDraft: false, unresolvedReviewThreadCount: 1 })),
        capture: () => Effect.die("gh must not run"),
      });
      expect(decision._tag).toBe("already-ready");
    })
  );

  it.effect("refuses a closed or merged non-draft pull request on pr-open instead of calling it ready", () =>
    Effect.gen(function* () {
      for (const state of ["CLOSED", "MERGED"] as const) {
        const error = yield* runYeetReadyGate(context, {
          read: () => Effect.succeed(prView({ isDraft: false, state })),
          capture: () => Effect.die("gh must not run"),
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
        capture: () => Effect.die("gh must not run"),
      });
      expect(decision._tag).toBe("already-ready");
    })
  );

  it.effect("fails with a command error when gh pr ready fails", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const error = yield* runYeetReadyGate(context, {
        read: () => Effect.succeed(prView()),
        capture: recordingCapture(calls, 1),
      }).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "YeetCommandError", command: "gh pr ready 42" });
      expect(error.message).toContain("gh: not permitted");
    })
  );
});
