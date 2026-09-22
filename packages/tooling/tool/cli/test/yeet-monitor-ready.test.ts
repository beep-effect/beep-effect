import {
  GreptileSummary,
  mergeReadyCriterionHolds,
  PrCloseoutReport,
  RepoRunContext,
  readYeetAckState,
  runYeetMonitorUntilMerged,
  YeetCommandError,
  YeetInboxRowJson,
  YeetMergeReady,
  YeetMergeReadyCriteria,
  YeetMergeReadyCriterion,
  YeetMonitorTerminalState,
  YeetRulesetRequiredContexts,
  YeetSettleCheck,
  YeetStatusArtifact,
  YeetStatusRemote,
  YeetStatusSnapshot,
  YeetStatusWorktree,
  YeetUntilMergedPolicy,
  YeetUntilReadyPolicy,
  yeetAutomaticCloseoutOptions,
  yeetMonitorExitFor,
  yeetMonitorExitTable,
  yeetPrMergeReadyRowId,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import { DateTime, Duration, Effect, FileSystem, Layer, Ref, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const at = "2026-09-16T00:00:00.000Z";
const url = "https://github.com/beep/repo/pull/7";
const head = "aaaaaaa1111111";
const nextHead = "bbbbbbb2222222";
const failure = YeetCommandError.make({ message: "read unavailable", exitCode: 1 });
const check = (name = "Lint", outcome: typeof YeetSettleCheck.Type.outcome = "pass", required = true) =>
  YeetSettleCheck.make({ name, outcome, required });
const contextFor = (root: string) =>
  RepoRunContext.make({
    base: "origin/main",
    branch: "feature/ready",
    cwd: root,
    head: "HEAD",
    originalArgv: [],
    packetDir: ".beep/yeet",
    repoRoot: root,
    turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
  });
const snapshot = (
  root: string,
  checks: ReadonlyArray<YeetSettleCheck>,
  bound = true,
  sha = head,
  state = "OPEN",
  threads = true,
  mergeStateStatus?: string
) => {
  const criteria = YeetMergeReadyCriteria.make({
    prOpen: state === "OPEN",
    notDraft: true,
    closeoutRun: bound,
    requiredChecksGreen: A.every(checks, (value) => !value.required || value.outcome === "pass"),
    threadsResolved: threads,
    mergeable: true,
    mergeStateAcceptable: true,
    reviewDecisionAcceptable: true,
    greptileScore: O.none(),
  });
  const ready = criteria.prOpen && bound && criteria.requiredChecksGreen && threads;
  return YeetStatusSnapshot.make({
    base: "origin/main",
    branch: "feature/ready",
    head: "HEAD",
    createdAt: at,
    nextCommand: "monitor",
    runId: "ready",
    schemaVersion: "yeet-status/v1",
    statusPath: `${root}/status.json`,
    worktree: YeetStatusWorktree.make({ clean: true, staged: 0, unstaged: 0, untracked: 0 }),
    closeout: YeetStatusArtifact.make({ detail: "fixture", path: "closeout.json", state: "missing" }),
    verdict: YeetStatusArtifact.make({ detail: "fixture", path: "verdict.json", state: "missing" }),
    remote: YeetStatusRemote.make({
      available: true,
      checked: true,
      detail: "fixture",
      headSha: O.some(sha),
      number: 7,
      url,
      checks,
      state,
      failingCheckCount: A.filter(checks, (value) => value.outcome === "fail").length,
      ...(mergeStateStatus === undefined ? {} : { mergeStateStatus }),
    }),
    mergeReady: O.some(
      YeetMergeReady.make({
        ready,
        criteria,
        failing: A.findFirst(
          YeetMergeReadyCriterion.Options,
          (criterion) => !mergeReadyCriterionHolds(criteria, criterion)
        ),
      })
    ),
  });
};
const report = (sha = head, issueCount = 0) => ({
  reportPath: "closeout.json",
  report: PrCloseoutReport.make({
    actionableReviewThreadCount: issueCount,
    botCommentCount: 0,
    greptile: GreptileSummary.make({ issueCount: 0, score: "5/5" }),
    issueCount,
    issues: [],
    prNumber: 7,
    prUrl: url,
    reviewedHeadSha: O.some(sha),
    retriggeredGreptile: false,
    schemaVersion: "yeet-pr-closeout/v1",
  }),
});
const rules = (contexts = ["Lint"]) =>
  Effect.succeedSome(
    YeetRulesetRequiredContexts.make({
      base: "main",
      readAt: at,
      contexts,
      rulesetIds: [1],
    })
  );
const options = {
  capture: () => Effect.succeed({ exitCode: 0, output: at, truncated: false }),
  rulesetRead: () => rules(),
  policy: YeetUntilReadyPolicy.make({}),
  pollInterval: Duration.zero,
  closeout: () => Effect.die("unexpected closeout"),
  onMerged: () => Effect.die("unexpected sweep"),
  // The loop replays the durable comment stream on its first cycle; these
  // cases are about readiness, so the replay is stubbed out and proven once,
  // on its own, below.
  replayComments: () => Effect.void,
};
const platform = Layer.mergeAll(
  NodeFileSystem.layer,
  NodePath.layer,
  NodeCrypto.layer,
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) => {
      if (ChildProcess.isStandardCommand(command) && command.args[0] === "run" && command.args[1] === "list")
        return Effect.succeed(handle("[]"));
      return Effect.die("unexpected process");
    })
  )
);
const fixture = Effect.fn("readyTest.fixture")(function* <V, E, R>(use: (root: string) => Effect.Effect<V, E, R>) {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-ready-" });
  yield* TestClock.setTime(1789516800000);
  return yield* use(root);
});
const rows = Effect.fn("readyTest.rows")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(`${root}/.beep/inbox/failures.ndjson`);
  return A.flatMap(Str.split(text, "\n"), (line) => O.toArray(YeetInboxRowJson.decodeOption(line)));
});
const lines = TestConsole.logLines.pipe(Effect.map(A.map(String)), Effect.map(A.join("\n")));

it.layer(platform)("B8 base conflict and registration memory", (test) => {
  test.effect("names the emptied rollup base-conflict past the budget, then settles the repaired push to ready", () =>
    fixture((root) =>
      Effect.gen(function* () {
        const calls = yield* Ref.make(0);
        const ticks = yield* Ref.make(0);
        const closeouts = yield* Ref.make(0);
        // Poll 0: Lint registered. Poll 1: base moved, rollup emptied, DIRTY. Poll 2: repaired
        // push (new head) with Lint green. Poll 3: the closeout reread binds it → ready.
        const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
          ...options,
          policy: YeetUntilReadyPolicy.make({ settleTimeoutMs: 1000 }),
          now: Ref.getAndUpdate(ticks, (n) => n + 1).pipe(Effect.map((n) => DateTime.makeUnsafe(n * 5000))),
          collectStatus: () =>
            Ref.getAndUpdate(calls, (n) => n + 1).pipe(
              Effect.map((n) => {
                if (n === 0) return snapshot(root, [check("Lint", "pending")], false);
                if (n === 1) return snapshot(root, [], false, head, "OPEN", true, "DIRTY");
                return snapshot(root, [check("Lint")], n >= 3, nextHead);
              })
            ),
          closeout: () => Ref.update(closeouts, (n) => n + 1).pipe(Effect.as(report(nextHead))),
        });
        expect(terminal).toBe("ready");
        expect(yield* Ref.get(calls)).toBe(4);
        expect(yield* Ref.get(closeouts)).toBe(1);
        const printed = yield* lines;
        expect(printed).toContain(
          "settle: base-conflict; merge origin/main and push; waited 5s (not counted toward the 1s settle timeout)"
        );
        expect(printed).toContain("[yeet] rollup: 1 registered context(s) absent this poll, kept pending");
        expect(printed).toContain("[yeet] settle: required-pending → base-conflict");
        expect(printed).not.toContain("settle-timeout");
        expect(yield* rows(root)).toHaveLength(1);
      })
    )
  );
});

it.layer(platform)("B8 settle clock resumes with the budget", (test) => {
  test.effect("clears a base conflict on the same head into a fresh registration window, then reaches ready", () =>
    fixture((root) =>
      Effect.gen(function* () {
        const calls = yield* Ref.make(0);
        const ticks = yield* Ref.make(0);
        const closeouts = yield* Ref.make(0);
        // Polls 0–1: empty rollup under DIRTY, 5s apart against a 1s budget. Poll 2: MERGEABLE,
        // rollup still empty → registration with the clock restarted. Poll 3: Lint green →
        // settled → closeout → reread (poll 4) binds it → ready. Same head throughout.
        const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
          ...options,
          policy: YeetUntilReadyPolicy.make({ settleTimeoutMs: 1000 }),
          now: Ref.getAndUpdate(ticks, (n) => n + 1).pipe(Effect.map((n) => DateTime.makeUnsafe(n * 5000))),
          collectStatus: () =>
            Ref.getAndUpdate(calls, (n) => n + 1).pipe(
              Effect.map((n) => {
                if (n <= 1) return snapshot(root, [], false, head, "OPEN", true, "DIRTY");
                if (n === 2) return snapshot(root, [], false);
                return snapshot(root, [check("Lint")], n >= 4);
              })
            ),
          closeout: () => Ref.update(closeouts, (n) => n + 1).pipe(Effect.as(report())),
        });
        expect(terminal).toBe("ready");
        expect(yield* Ref.get(calls)).toBe(5);
        expect(yield* Ref.get(closeouts)).toBe(1);
        const printed = yield* lines;
        expect(printed).toContain("[yeet] settle: base-conflict → registration");
        expect(printed).toContain("[yeet] settle budget resumed; clock reset");
        expect(printed).toContain("settle: registration; no checks reported for this head yet; waited 0 of 1s");
        expect(printed).not.toContain("settle-timeout");
        expect(yield* rows(root)).toHaveLength(1);
      })
    )
  );
});

it.layer(platform)("B7 readiness loop", (test) => {
  test.effect(
    "waits for registration and pending checks, closes out once, and emits a complete ready capsule despite optional red",
    () =>
      fixture((root) =>
        Effect.gen(function* () {
          const calls = yield* Ref.make(0);
          const closeouts = yield* Ref.make(0);
          const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
            ...options,
            collectStatus: () =>
              Ref.getAndUpdate(calls, (n) => n + 1).pipe(
                Effect.map((n) =>
                  snapshot(
                    root,
                    n === 0 ? [] : [check("Lint", n === 1 ? "pending" : "pass"), check("Vercel", "fail", false)],
                    n >= 3
                  )
                )
              ),
            closeout: () => Ref.update(closeouts, (n) => n + 1).pipe(Effect.as(report())),
          });
          expect(terminal).toBe("ready");
          expect(yeetMonitorExitFor(terminal).exitCode).toBe(0);
          expect(yield* Ref.get(calls)).toBe(4);
          expect(yield* Ref.get(closeouts)).toBe(1);
          const observed = yield* rows(root);
          const mergeReadyId = yield* yeetPrMergeReadyRowId({ prNumber: 7, headSha: head });
          expect(observed).toHaveLength(1);
          expect(observed[0]).toMatchObject({
            kind: "pr-merge-ready",
            severity: "P1",
            id: mergeReadyId,
            capsule: {
              headSha: head,
              prNumber: 7,
              url,
              pushedAt: at,
              readyAt: at,
              settledAt: at,
              closeoutAt: at,
              pushToReadyMs: 0,
            },
          });
          expect(yield* lines).toMatch(/\[yeet\] settle: registration(?:\n|$)/);
          expect(yield* lines).toContain("closeout: 0 issue(s) for head aaaaaaa");
          expect(yield* lines).toContain("push→ready");
          yield* runYeetMonitorUntilMerged(contextFor(root), {
            ...options,
            collectStatus: () => Effect.succeed(snapshot(root, [check()])),
          });
          expect(yield* rows(root)).toHaveLength(1);
        })
      )
  );
  test.effect(
    "announces once per head, supersedes the old row, closes out the new head, and sweeps once on merge",
    () =>
      fixture((root) =>
        Effect.gen(function* () {
          const polls = yield* Ref.make(0);
          const reads = yield* Ref.make(0);
          const closes = yield* Ref.make(0);
          const sweeps = yield* Ref.make(0);
          const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
            ...options,
            policy: YeetUntilMergedPolicy.make({}),
            rulesetRead: () => Ref.update(reads, (n) => n + 1).pipe(Effect.andThen(rules())),
            collectStatus: () =>
              Ref.getAndUpdate(polls, (n) => n + 1).pipe(
                Effect.map((n) =>
                  snapshot(root, [check()], n !== 0 && n !== 3, n < 3 ? head : nextHead, n === 6 ? "MERGED" : "OPEN")
                )
              ),
            closeout: () =>
              Ref.getAndUpdate(closes, (n) => n + 1).pipe(Effect.map((n) => report(n === 0 ? head : nextHead))),
            onMerged: () => Ref.update(sweeps, (n) => n + 1),
          });
          expect(terminal).toBe("merged");
          expect(yield* Ref.get(reads)).toBe(2);
          expect(yield* Ref.get(closes)).toBe(2);
          expect(yield* Ref.get(sweeps)).toBe(1);
          expect(yield* rows(root)).toHaveLength(2);
          const ack = yield* readYeetAckState(root, yield* yeetPrMergeReadyRowId({ prNumber: 7, headSha: head }));
          expect(ack.acked).toBe(true);
          expect(ack.receipt?.resolution).toMatchObject({ kind: "fix-sha", sha: nextHead });
          expect(A.filter(Str.split(yield* lines, "\n"), Str.includes("merge-ready announced"))).toHaveLength(2);
        })
      )
  );
  for (const reset of [false, true])
    test.effect(`exhausts exactly five consecutive read failures, reset=${reset}`, () =>
      fixture((root) =>
        Effect.gen(function* () {
          const calls = yield* Ref.make(0);
          const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
            ...options,
            collectStatus: () =>
              Ref.getAndUpdate(calls, (n) => n + 1).pipe(
                Effect.flatMap((n) =>
                  reset && n === 3 ? Effect.succeed(snapshot(root, [check("Lint", "pending")])) : Effect.fail(failure)
                )
              ),
          });
          expect(terminal).toBe("poll-error-budget");
          expect(yield* Ref.get(calls)).toBe(reset ? 9 : 5);
          expect(A.join(A.map(yield* TestConsole.errorLines, String), "\n")).toContain(
            "poll failed (5/5): read unavailable"
          );
        })
      )
    );
  test.effect("retries closeout failures against the cached head and budgets consecutive errors", () =>
    fixture((root) =>
      Effect.gen(function* () {
        const reads = yield* Ref.make(0);
        const closes = yield* Ref.make(0);
        const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
          ...options,
          collectStatus: () => Effect.succeed(snapshot(root, [check()], false)),
          rulesetRead: () => Ref.update(reads, (n) => n + 1).pipe(Effect.andThen(rules())),
          closeout: () => Ref.update(closes, (n) => n + 1).pipe(Effect.andThen(Effect.fail(failure))),
        });
        expect(terminal).toBe("poll-error-budget");
        expect(yield* Ref.get(reads)).toBe(1);
        expect(yield* Ref.get(closes)).toBe(5);
      })
    )
  );
  test.effect("closeout issues block readiness without failing or repeating closeout", () =>
    fixture((root) =>
      Effect.gen(function* () {
        const calls = yield* Ref.make(0);
        const closes = yield* Ref.make(0);
        const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
          ...options,
          collectStatus: () =>
            Ref.getAndUpdate(calls, (n) => n + 1).pipe(
              Effect.map((n) => snapshot(root, [check()], n > 0, head, n === 3 ? "CLOSED" : "OPEN", false))
            ),
          closeout: () => Ref.update(closes, (n) => n + 1).pipe(Effect.as(report(head, 2))),
        });
        expect(terminal).toBe("closed");
        expect(yield* Ref.get(closes)).toBe(1);
        expect(yield* lines).toContain("closeout: 2 issue(s)");
      })
    )
  );
  test.effect("ignores a stale-head closeout reread and builds a new timeline on the next poll", () =>
    fixture((root) =>
      Effect.gen(function* () {
        const calls = yield* Ref.make(0);
        const reads = yield* Ref.make(0);
        const closes = yield* Ref.make(0);
        const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
          ...options,
          collectStatus: () =>
            Ref.getAndUpdate(calls, (n) => n + 1).pipe(
              Effect.map((n) => snapshot(root, [check()], n === 3, n === 0 ? head : nextHead))
            ),
          rulesetRead: () => Ref.update(reads, (n) => n + 1).pipe(Effect.andThen(rules())),
          closeout: () =>
            Ref.getAndUpdate(closes, (n) => n + 1).pipe(Effect.map((n) => report(n === 0 ? head : nextHead))),
        });
        expect(terminal).toBe("ready");
        expect(yield* Ref.get(reads)).toBe(2);
        expect(yield* Ref.get(closes)).toBe(2);
        expect(yield* rows(root)).toMatchObject([{ capsule: { headSha: nextHead } }]);
      })
    )
  );
});

const encodeJson = (value: unknown) => S.encodeUnknownEffect(S.fromJsonString(S.Unknown))(value).pipe(Effect.orDie);
const handle = (output: string, code = 0) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.make(new TextEncoder().encode(output)),
    stdout: Stream.make(new TextEncoder().encode(output)),
    stderr: Stream.empty,
    stdin: Sink.drain,
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(code)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    unref: Effect.succeed(Effect.void),
  });
describe("required red decisions", () => {
  for (const name of ["Lint", "Test Unit (unit-a)", "Outside", "Vercel"]) {
    for (const flake of [false, true])
      it.effect(`${name}: flake=${flake}`, () =>
        fixture((root) =>
          Effect.gen(function* () {
            const polls = yield* Ref.make(0);
            const reruns = yield* Ref.make(0);
            const runner = ChildProcessSpawner.make(
              Effect.fnUntraced(function* (command) {
                if (!ChildProcess.isStandardCommand(command)) return yield* Effect.die("unexpected pipe");
                const [first, second] = command.args;
                if (first === "run" && second === "list")
                  return yield* Effect.succeed(
                    handle(
                      yield* encodeJson([
                        { databaseId: 7, headSha: head, status: "completed", conclusion: "failure", name: "CI" },
                      ])
                    )
                  );
                if (second === "rerun") return yield* Ref.update(reruns, (n) => n + 1).pipe(Effect.as(handle("")));
                if (A.contains(command.args, "--log-failed"))
                  return yield* Effect.succeed(handle(flake ? "Test timed out in 5000ms" : "Assertion failed"));
                return yield* Effect.succeed(
                  handle(
                    yield* encodeJson({
                      jobs: [
                        {
                          databaseId: 991,
                          name,
                          status: "completed",
                          conclusion: "failure",
                          steps: [{ name: "Test", conclusion: "failure" }],
                        },
                      ],
                    })
                  )
                );
              })
            );
            const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
              ...options,
              rulesetRead: () => rules([name === "Test Unit (unit-a)" ? "Test Unit" : "Lint"]),
              collectStatus: () =>
                Ref.getAndUpdate(polls, (n) => n + 1).pipe(
                  Effect.map((n) =>
                    snapshot(
                      root,
                      [
                        check(name, "fail", name === "Outside"),
                        ...(name === "Vercel" ? [check("Other", "pending")] : []),
                      ],
                      true,
                      head,
                      n === 2 ? "CLOSED" : "OPEN"
                    )
                  )
                ),
            }).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, runner));
            expect(terminal).toBe(name === "Vercel" ? "closed" : "required-red");
            expect(yield* Ref.get(reruns)).toBe(flake ? 1 : 0);
            if (name !== "Vercel") {
              expect(yield* lines).toContain(`required-red: ${name}`);
              expect(yield* lines).not.toContain("merge-ready: yes");
              const fs = yield* FileSystem.FileSystem;
              expect(yield* fs.exists(`${root}/.beep/inbox/failures.ndjson`)).toBe(false);
            }
          })
        ).pipe(provideScopedLayer(platform))
      );
  }
});

it("uses one complete exit table and read-only automatic closeout options", () => {
  expect(A.map(yeetMonitorExitTable, (row) => row.terminal)).toEqual(YeetMonitorTerminalState.Options);
  for (const row of yeetMonitorExitTable)
    expect(row.exitCode).toBe(row.terminal === "ready" || row.terminal === "merged" ? 0 : 1);
  expect(yeetAutomaticCloseoutOptions).toMatchObject({ retriggerGreptile: false, replyThread: "", replyBody: "" });
  assertSome(O.some(yeetMonitorExitFor("ready").exitCode), 0);
});

it.layer(platform)("B7 remaining boundaries", (test) => {
  test.effect("times out at exactly 1000ms and names both missing and pending required checks", () =>
    fixture((root) =>
      Effect.gen(function* () {
        const polls = yield* Ref.make(0);
        const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
          ...options,
          policy: YeetUntilReadyPolicy.make({ settleTimeoutMs: 1000 }),
          rulesetRead: () => rules(["Never registered"]),
          collectStatus: Effect.fnUntraced(function* () {
            const n = yield* Ref.getAndUpdate(polls, (value) => value + 1);
            if (n === 1) yield* TestClock.adjust("999 millis");
            if (n === 2) yield* TestClock.adjust("1 millis");
            return snapshot(root, [check("Outside", "pending")]);
          }),
        });
        expect(terminal).toBe("settle-timeout");
        expect(yield* Ref.get(polls)).toBe(3);
        expect(yield* lines).toContain("missing: Never registered");
        expect(yield* lines).toContain("pending: Outside");
      })
    )
  );
  test.effect("counts a post-closeout reread failure without repeating the successful closeout", () =>
    fixture((root) =>
      Effect.gen(function* () {
        const calls = yield* Ref.make(0);
        const closes = yield* Ref.make(0);
        const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
          ...options,
          collectStatus: () =>
            Ref.getAndUpdate(calls, (n) => n + 1).pipe(
              Effect.flatMap((n) => (n === 1 ? Effect.fail(failure) : Effect.succeed(snapshot(root, [check()], n > 1))))
            ),
          closeout: () => Ref.update(closes, (n) => n + 1).pipe(Effect.as(report())),
        });
        expect(terminal).toBe("ready");
        expect(yield* Ref.get(closes)).toBe(1);
        expect(A.join(A.map(yield* TestConsole.errorLines, String), "\n")).toContain("poll failed (1/5)");
      })
    )
  );
  test.effect("accepts an operator merge under until-ready and sweeps once", () =>
    fixture((root) =>
      Effect.gen(function* () {
        const sweeps = yield* Ref.make(0);
        const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
          ...options,
          collectStatus: () => Effect.succeed(snapshot(root, [], false, head, "MERGED")),
          onMerged: () => Ref.update(sweeps, (n) => n + 1),
        });
        expect(terminal).toBe("merged");
        expect(yield* Ref.get(sweeps)).toBe(1);
      })
    )
  );
});

for (const waiting of ["awaiting-log", "awaiting-run"])
  it.effect(`keeps polling required ${waiting} decisions`, () =>
    fixture((root) =>
      Effect.gen(function* () {
        const polls = yield* Ref.make(0);
        const runner = ChildProcessSpawner.make(
          Effect.fnUntraced(function* (command) {
            if (!ChildProcess.isStandardCommand(command)) return yield* Effect.die("unexpected pipe");
            if (command.args[1] === "list")
              return yield* Effect.succeed(
                handle(
                  yield* encodeJson([
                    { databaseId: 7, headSha: head, status: "in_progress", conclusion: "", name: "CI" },
                  ])
                )
              );
            if (command.args[1] === "rerun") return yield* Effect.die("must not rerun an active parent");
            if (A.contains(command.args, "--log-failed"))
              return yield* Effect.succeed(
                waiting === "awaiting-log" ? handle("", 1) : handle("Test timed out in 5000ms")
              );
            return yield* Effect.succeed(
              handle(
                yield* encodeJson({
                  jobs: [
                    {
                      databaseId: 991,
                      name: "Lint",
                      status: "completed",
                      conclusion: "failure",
                      steps: [{ name: "Test", conclusion: "failure" }],
                    },
                  ],
                })
              )
            );
          })
        );
        const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
          ...options,
          collectStatus: () =>
            Ref.getAndUpdate(polls, (n) => n + 1).pipe(
              Effect.map((n) => snapshot(root, [check("Lint", "fail")], true, head, n === 1 ? "CLOSED" : "OPEN"))
            ),
        }).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, runner));
        expect(terminal).toBe("closed");
        expect(yield* Ref.get(polls)).toBe(2);
        expect(yield* lines).toContain(waiting === "awaiting-log" ? "reclassifying next poll" : "deferring rerun");
      })
    ).pipe(provideScopedLayer(platform))
  );

// R7 (reviewer follow-ups): a `--until-merged` session that starts after a gap
// has to print what was said in that gap before it starts reporting merge
// readiness the operator will act on — and exactly once, because after the
// first cycle the session is attached and nothing can be missed.
it.layer(platform)("R7 durable comment replay", (test) => {
  test.effect("replays the comment stream on the first cycle only, naming the pull request", () =>
    fixture((root) =>
      Effect.gen(function* () {
        const polls = yield* Ref.make(0);
        const replayed = yield* Ref.make<ReadonlyArray<number>>(A.empty());

        const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
          ...options,
          collectStatus: () =>
            Ref.getAndUpdate(polls, (n) => n + 1).pipe(Effect.map((n) => snapshot(root, [check("Lint")], n >= 1))),
          closeout: () => Effect.succeed(report()),
          replayComments: (_context, prNumber) => Ref.update(replayed, A.append(prNumber)),
        });

        expect(terminal).toBe("ready");
        expect(yield* Ref.get(replayed)).toStrictEqual([7]);
        expect(yield* Ref.get(polls)).toBeGreaterThan(1);
      })
    )
  );

  test.effect("keeps the first cycle open until a poll can replay", () =>
    fixture((root) =>
      Effect.gen(function* () {
        const polls = yield* Ref.make(0);
        const replayed = yield* Ref.make<ReadonlyArray<number>>(A.empty());

        // The first read fails before it learns the pull request number: the
        // replay it would have done is owed by the next successful read, not
        // dropped with the failure.
        const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
          ...options,
          collectStatus: () =>
            Ref.getAndUpdate(polls, (n) => n + 1).pipe(
              Effect.flatMap((n) =>
                n === 0 ? Effect.fail(failure) : Effect.succeed(snapshot(root, [check("Lint")], n >= 2))
              )
            ),
          closeout: () => Effect.succeed(report()),
          replayComments: (_context, prNumber) => Ref.update(replayed, A.append(prNumber)),
        });

        expect(terminal).toBe("ready");
        expect(yield* Ref.get(replayed)).toStrictEqual([7]);
        expect(yield* Ref.get(polls)).toBeGreaterThan(2);
      })
    )
  );
});
