import {
  appendYeetInboxRow,
  GreptileSummary,
  mergeReadyCriterionHolds,
  PrCloseoutReport,
  RepoRunContext,
  readYeetAckState,
  runYeetMonitorUntilMerged,
  writeYeetAckReceipt,
  YeetAckFixResolution,
  YeetAckReceipt,
  YeetCheckFailedRow,
  YeetCommandError,
  YeetFailureCapsule,
  YeetInboxRowJson,
  YeetMergeReady,
  YeetMergeReadyCriteria,
  YeetMergeReadyCriterion,
  YeetMonitorAttachment,
  YeetMonitorTerminalState,
  YeetPrCommentCapsule,
  YeetPrCommentRow,
  YeetRulesetRequiredContexts,
  YeetStatusArtifact,
  YeetStatusRemote,
  YeetStatusSnapshot,
  YeetStatusWorktree,
  YeetUntilMergedPolicy,
  YeetUntilReadyPolicy,
  YeetWatchCheck,
  yeetAttachedMonitorRerunCommand,
  yeetAutomaticCloseoutOptions,
  yeetInboxRowId,
  yeetMonitorExitFor,
  yeetMonitorExitTable,
  yeetPrMergeReadyRowId,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { DateTime, Duration, Effect, FileSystem, Layer, Ref, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import type { YeetPrCommentWindow } from "@beep/repo-cli/test/Yeet";

const at = "2026-09-16T00:00:00.000Z";
const url = "https://github.com/beep/repo/pull/7";
const head = "aaaaaaa1111111";
const nextHead = "bbbbbbb2222222";
const failure = YeetCommandError.make({ message: "read unavailable", exitCode: 1 });
const check = (name = "Lint", outcome: typeof YeetWatchCheck.Type.outcome = "pass", required = true) =>
  YeetWatchCheck.make({ name, outcome, required });
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
  checks: ReadonlyArray<YeetWatchCheck>,
  bound = true,
  sha = head,
  state = "OPEN",
  threads = true,
  mergeStateStatus?: string,
  mergeable?: string
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
      ...(mergeable === undefined ? {} : { mergeable }),
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
  // Under until-merged the loop replays the durable comment stream on its first
  // cycle, and under until-ready it turns comments into inbox rows every poll;
  // these cases are about readiness, so both are stubbed out and proven on
  // their own (the replay below, the rows in yeet-pr-comment-rows).
  replayComments: () => Effect.void,
  commentRows: () => Effect.succeed(A.empty()),
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

it.layer(platform, { timeout: "30 seconds" })("B8 base conflict and registration memory", (test) => {
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
        // The conflicted head's P0 row, then the repaired head's readiness row.
        const written = yield* rows(root);
        expect(A.map(written, (row) => row.kind)).toStrictEqual(["base-conflict", "pr-merge-ready"]);
        expect(written[0]).toMatchObject({ severity: "P0", capsule: { headSha: head, mergeStateStatus: "DIRTY" } });
        expect(written[1]).toMatchObject({ capsule: { headSha: nextHead } });
      })
    )
  );
});

it.layer(platform, { timeout: "30 seconds" })("push → row → ack timeline", (test) => {
  test.effect("prints the left head's timeline from the new stamps and the ready head's beside the gate line", () =>
    fixture((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        // The red head's evidence as the other writers leave it: the optional
        // Vercel red's P1 row first, then the required Check red's P0 row, the
        // inbox hook's first injection stamp for each, and each row's fix-sha ack.
        const redRow = Effect.fn("readyTest.redRow")(function* (lane: string, severity: "P0" | "P1", ts: string) {
          const capsule = YeetFailureCapsule.make({
            bucket: "fail",
            headSha: head,
            lane,
            link: null,
            observedAt: ts,
            prNumber: 7,
            state: "FAILURE",
            workflow: null,
          });
          const id = yield* yeetInboxRowId(capsule);
          yield* appendYeetInboxRow(root, YeetCheckFailedRow.make({ capsule, checkout: root, id, severity, ts }));
          return id;
        });
        const optionalId = yield* redRow("Vercel", "P1", "2026-09-16T00:02:30.000Z");
        const id = yield* redRow("Check", "P0", "2026-09-16T00:04:00.000Z");
        yield* fs.makeDirectory(`${root}/.beep/inbox/sessions`, { recursive: true });
        yield* fs.writeFileString(
          `${root}/.beep/inbox/sessions/claude-1.json`,
          yield* encodeJson({
            schemaVersion: "yeet-hook-session/v1",
            incidentId: null,
            seenIds: [optionalId, id],
            firstSeenAt: { [optionalId]: "2026-09-16T00:02:40Z", [id]: "2026-09-16T00:04:30Z" },
          })
        );
        yield* writeYeetAckReceipt(
          root,
          YeetAckReceipt.make({
            id: optionalId,
            ackedAt: "2026-09-16T00:03:30.000Z",
            resolution: YeetAckFixResolution.make({ sha: nextHead }),
          })
        );
        yield* writeYeetAckReceipt(
          root,
          YeetAckReceipt.make({
            id,
            ackedAt: "2026-09-16T00:06:00.000Z",
            resolution: YeetAckFixResolution.make({ sha: nextHead }),
          })
        );
        // GitHub completes the optional red first; only the required red stamps the head's red.
        const optionalRed = YeetWatchCheck.make({
          name: "Vercel",
          outcome: "fail",
          required: false,
          completedAt: O.some("2026-09-16T00:02:00Z"),
        });
        const red = YeetWatchCheck.make({
          name: "Check",
          outcome: "fail",
          completedAt: O.some("2026-09-16T00:03:00Z"),
        });
        const calls = yield* Ref.make(0);
        // Poll 0: the red head (both reds), Lint still pending. Poll 1: the fix push,
        // Lint green, closeout pending. Poll 2: the closeout reread binds it → ready.
        const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
          ...options,
          collectStatus: () =>
            Ref.getAndUpdate(calls, (n) => n + 1).pipe(
              Effect.map((n) =>
                n === 0
                  ? snapshot(root, [check("Lint", "pending"), optionalRed, red], false)
                  : snapshot(root, [check("Lint")], n >= 2, nextHead)
              )
            ),
          closeout: () => Effect.succeed(report(nextHead)),
        });
        expect(terminal).toBe("ready");
        const printed = yield* lines;
        expect(printed).toContain(
          "[yeet] push→row→ack aaaaaaa: pushed 2026-09-16T00:00:00.000Z, red 2026-09-16T00:03:00Z (+3m), " +
            "row 2026-09-16T00:04:00.000Z (+1m), injected 2026-09-16T00:04:30Z (+30s), " +
            "acked 2026-09-16T00:06:00.000Z (+1m 30s)"
        );
        expect(printed).toContain(
          "[yeet] push→row→ack bbbbbbb: pushed 2026-09-16T00:00:00.000Z, red -, row -, injected -, acked -"
        );
        expect(printed.indexOf("push→ready")).toBeLessThan(printed.indexOf("push→row→ack bbbbbbb"));
      })
    )
  );

  test.effect("follows the red's own row when another required red's row shares its poll stamp", () =>
    fixture((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const polledAt = "2026-09-16T00:04:00.000Z";
        // One poll sees two required reds, Build listed before Check, and the
        // loop dispatches both rows with the poll's stamp in that order. GitHub
        // completed Check first, so Check stamps the head's red and its lane.
        const buildId = yield* yeetInboxRowId({ headSha: head, lane: "Build", prNumber: 7 });
        const checkId = yield* yeetInboxRowId({ headSha: head, lane: "Check", prNumber: 7 });
        yield* fs.makeDirectory(`${root}/.beep/inbox/sessions`, { recursive: true });
        yield* fs.writeFileString(
          `${root}/.beep/inbox/sessions/claude-1.json`,
          yield* encodeJson({
            schemaVersion: "yeet-hook-session/v1",
            incidentId: null,
            seenIds: [buildId, checkId],
            firstSeenAt: { [buildId]: "2026-09-16T00:04:10Z", [checkId]: "2026-09-16T00:04:40Z" },
          })
        );
        yield* writeYeetAckReceipt(
          root,
          YeetAckReceipt.make({
            id: buildId,
            ackedAt: "2026-09-16T00:05:00.000Z",
            resolution: YeetAckFixResolution.make({ sha: nextHead }),
          })
        );
        yield* writeYeetAckReceipt(
          root,
          YeetAckReceipt.make({
            id: checkId,
            ackedAt: "2026-09-16T00:06:00.000Z",
            resolution: YeetAckFixResolution.make({ sha: nextHead }),
          })
        );
        const build = YeetWatchCheck.make({
          name: "Build",
          outcome: "fail",
          completedAt: O.some("2026-09-16T00:03:30Z"),
        });
        const red = YeetWatchCheck.make({
          name: "Check",
          outcome: "fail",
          completedAt: O.some("2026-09-16T00:03:00Z"),
        });
        const calls = yield* Ref.make(0);
        const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
          ...options,
          now: Effect.succeed(DateTime.makeUnsafe(polledAt)),
          collectStatus: () =>
            Ref.getAndUpdate(calls, (n) => n + 1).pipe(
              Effect.map((n) =>
                n === 0
                  ? snapshot(root, [check("Lint", "pending"), build, red], false)
                  : snapshot(root, [check("Lint")], n >= 2, nextHead)
              )
            ),
          closeout: () => Effect.succeed(report(nextHead)),
        });
        expect(terminal).toBe("ready");
        const reds = A.filter(yield* rows(root), (row) => row.kind === "check-failed");
        expect(A.map(reds, (row) => [row.id, row.ts])).toStrictEqual([
          [buildId, polledAt],
          [checkId, polledAt],
        ]);
        expect(yield* lines).toContain(
          "[yeet] push→row→ack aaaaaaa: pushed 2026-09-16T00:00:00.000Z, red 2026-09-16T00:03:00Z (+3m), " +
            "row 2026-09-16T00:04:00.000Z (+1m), injected 2026-09-16T00:04:40Z (+40s), " +
            "acked 2026-09-16T00:06:00.000Z (+1m 20s)"
        );
      })
    )
  );
});

it.layer(platform, { timeout: "30 seconds" })("B8 settle clock resumes with the budget", (test) => {
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
                if (n <= 1) return snapshot(root, [], false, head, "OPEN", true, "DIRTY", "CONFLICTING");
                if (n === 2) return snapshot(root, [], false, head, "OPEN", true, "CLEAN", "MERGEABLE");
                return snapshot(root, [check("Lint")], n >= 4, head, "OPEN", true, "CLEAN", "MERGEABLE");
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
        // One conflict row for the head, acked cleared when the same head read MERGEABLE.
        const written = yield* rows(root);
        expect(A.map(written, (row) => row.kind)).toStrictEqual(["base-conflict", "pr-merge-ready"]);
        const conflict = yield* readYeetAckState(root, A.getUnsafe(written, 0).id);
        assertSome(
          O.map(O.fromNullOr(conflict.receipt), (receipt) => receipt.resolution.kind),
          "cleared"
        );
        expect(printed).toContain("[yeet] base conflict cleared on head aaaaaaa without a push");
      })
    )
  );
});

it.layer(platform, { timeout: "30 seconds" })("B7 readiness loop", (test) => {
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
          // Under until-ready the optional red converges into a P1 check-failed
          // row (the --watch capsule), and readiness still holds past it.
          expect(A.map(observed, (row) => row.kind)).toEqual(["check-failed", "pr-merge-ready"]);
          expect(observed[0]).toMatchObject({
            kind: "check-failed",
            severity: "P1",
            capsule: { lane: "Vercel", headSha: head, prNumber: 7 },
          });
          expect(observed[1]).toMatchObject({
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
          expect(yield* rows(root)).toHaveLength(2);
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

const encodeUnknownJsonString = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
const encodeJson = (value: unknown) => encodeUnknownJsonString(value).pipe(Effect.orDie);
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
      it.layer(platform, { timeout: "30 seconds" })((it) =>
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
              // A required red no longer ends --until-ready (pr-event-awareness D16):
              // the loop keeps polling until the PR closes on poll 2, and the red
              // is a converged check-failed row instead of a terminal.
              expect(terminal).toBe("closed");
              expect(yield* Ref.get(polls)).toBe(3);
              expect(yield* Ref.get(reruns)).toBe(flake ? 1 : 0);
              expect(yield* lines).not.toContain("merge-ready: yes");
              expect(A.map(yield* rows(root), (row) => [row.kind, row.capsule])).toMatchObject([
                ["check-failed", { lane: name, headSha: head, prNumber: 7 }],
              ]);
              if (name !== "Vercel") {
                expect(yield* lines).toContain(`required-red: ${name}; not terminal under --until-ready`);
              }
            })
          )
        )
      );
  }
});

it.layer(platform, { timeout: "30 seconds" })((it) =>
  it.effect("reads a conclusively triaged red set once per head and again when the red moves", () =>
    fixture((root) =>
      Effect.gen(function* () {
        const polls = yield* Ref.make(0);
        const logReads = yield* Ref.make(0);
        const runner = ChildProcessSpawner.make(
          Effect.fnUntraced(function* (command) {
            if (!ChildProcess.isStandardCommand(command)) return yield* Effect.die("unexpected pipe");
            const [first, second] = command.args;
            if (first === "run" && second === "list")
              return handle(
                yield* encodeJson([
                  { databaseId: 7, headSha: head, status: "completed", conclusion: "failure", name: "CI" },
                ])
              );
            if (second === "rerun") return yield* Effect.die("a needs-code-fix red is never rerun");
            if (A.contains(command.args, "--log-failed"))
              return yield* Ref.update(logReads, (n) => n + 1).pipe(Effect.as(handle("Assertion failed")));
            return handle(
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
            );
          })
        );
        const red = (job: number) =>
          YeetWatchCheck.make({
            name: "Lint",
            outcome: "fail",
            link: `https://github.com/beep/repo/actions/runs/7/job/${job}`,
          });
        // Polls 0-2 report one red; poll 3 reports it again from a new job (a
        // manual rerun that failed again); poll 4 closes the PR.
        const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
          ...options,
          collectStatus: () =>
            Ref.getAndUpdate(polls, (n) => n + 1).pipe(
              Effect.map((n) => snapshot(root, [red(n >= 3 ? 992 : 991)], true, head, n === 4 ? "CLOSED" : "OPEN"))
            ),
        }).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, runner));
        expect(terminal).toBe("closed");
        expect(yield* Ref.get(polls)).toBe(5);
        // The unchanged red is classified on poll 0 only; the moved red on poll 3.
        expect(yield* Ref.get(logReads)).toBe(2);
        expect(A.length(Str.split(yield* lines, "required-red: Lint;")) - 1).toBe(2);
      })
    )
  )
);

// The triage line promises further polling only where the loop keeps polling:
// an attached run stops on the same poll with `wave`, so its line must not.
for (const attachment of YeetMonitorAttachment.Options)
  it.layer(platform, { timeout: "30 seconds" })((it) =>
    it.effect(`${attachment}: the required-red line matches whether the loop keeps polling`, () =>
      fixture((root) =>
        Effect.gen(function* () {
          const polls = yield* Ref.make(0);
          const runner = ChildProcessSpawner.make(
            Effect.fnUntraced(function* (command) {
              if (!ChildProcess.isStandardCommand(command)) return yield* Effect.die("unexpected pipe");
              const [first, second] = command.args;
              if (first === "run" && second === "list")
                return handle(
                  yield* encodeJson([
                    { databaseId: 7, headSha: head, status: "completed", conclusion: "failure", name: "CI" },
                  ])
                );
              if (second === "rerun") return yield* Effect.die("a needs-code-fix red is never rerun");
              if (A.contains(command.args, "--log-failed")) return handle("Assertion failed");
              return handle(
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
              );
            })
          );
          // Poll 0: the required red. Poll 1: the pull request closes.
          const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
            ...options,
            attachment,
            collectStatus: () =>
              Ref.getAndUpdate(polls, (n) => n + 1).pipe(
                Effect.map((n) => snapshot(root, [check("Lint", "fail")], true, head, n === 1 ? "CLOSED" : "OPEN"))
              ),
          }).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, runner));
          const printed = yield* lines;
          expect(printed).toContain("required-red: Lint; not terminal under --until-ready: the wave is in the inbox");
          if (attachment === "attached") {
            expect(terminal).toBe("wave");
            expect(yield* Ref.get(polls)).toBe(1);
            expect(printed).not.toContain("keeps polling for the fix push");
            expect(printed).toContain("The attached monitor stopped");
          } else {
            expect(terminal).toBe("closed");
            expect(printed).toContain("the loop keeps polling for the fix push");
          }
        })
      )
    )
  );

// pr-event-awareness W2 follow-through: an attached `--until-ready` run has no
// job for `yeet job wait` to hand the wave back on, so the loop ends itself with
// `wave` (exit 2) on the first new P0/P1 row on its pull request. A detached run
// keeps polling and the job's waiter carries the wave.
describe("attached wave return", () => {
  const polled = (root: string, n: number) =>
    // Poll 0: Lint green, readiness blocked on review threads. Poll 1: the same
    // head's Lint red. Poll 2: the pull request closes.
    snapshot(root, [check("Lint", n === 0 ? "pass" : "fail")], true, head, n === 2 ? "CLOSED" : "OPEN", false);
  const seedEarlierRow = Effect.fn("readyTest.seedEarlierRow")(function* (root: string) {
    const capsule = YeetFailureCapsule.make({
      bucket: "fail",
      headSha: head,
      lane: "Vercel",
      link: null,
      observedAt: at,
      prNumber: 7,
      state: "FAILURE",
      workflow: null,
    });
    const row = YeetCheckFailedRow.make({
      capsule,
      checkout: root,
      id: yield* yeetInboxRowId(capsule),
      severity: "P1",
      ts: at,
    });
    yield* appendYeetInboxRow(root, row);
    return row;
  });
  it("names the operator's own command as the attached re-run when it prints verbatim", () => {
    const argv = ["bun", "/repo/bin.ts", "--", "yeet", "monitor", "--until-ready", "--settle-timeout", "20m"];
    assertSome(yeetAttachedMonitorRerunCommand(argv), "bun run beep yeet monitor --until-ready --settle-timeout 20m");
    assertNone(yeetAttachedMonitorRerunCommand(["bun", "/repo/bin.ts", "yeet", "monitor", "--base", "it's"]));
    assertNone(yeetAttachedMonitorRerunCommand(["bun", "/repo/vitest.mjs", "run", "test"]));
  });
  for (const attachment of YeetMonitorAttachment.Options)
    it.layer(platform, { timeout: "30 seconds" })((it) =>
      it.effect(`${attachment}: green then a required red`, () =>
        fixture((root) =>
          Effect.gen(function* () {
            // Already in the inbox when the loop starts, and live on this head:
            // not new, so it never ends the loop.
            const earlier = yield* seedEarlierRow(root);
            const polls = yield* Ref.make(0);
            const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
              ...options,
              attachment,
              waveRerunCommand: "bun run beep yeet monitor --until-ready --settle-timeout 20m",
              collectStatus: () => Ref.getAndUpdate(polls, (n) => n + 1).pipe(Effect.map((n) => polled(root, n))),
            });
            const red = A.findFirst(
              yield* rows(root),
              (row) => row.kind === "check-failed" && row.capsule.lane === "Lint"
            ).pipe(O.map((row) => row.id));
            const redId = O.getOrThrow(red);
            const printed = yield* lines;
            if (attachment === "attached") {
              expect(terminal).toBe("wave");
              expect(yeetMonitorExitFor(terminal).exitCode).toBe(2);
              expect(yield* Ref.get(polls)).toBe(2);
              expect(printed).toContain("[yeet] wave on PR #7: 1 new P0/P1 inbox row(s): P0 Lint");
              expect(printed).toContain(`[${redId}]`);
              expect(printed).not.toContain(`[${earlier.id}]`);
              expect(printed).toContain(
                "The attached monitor stopped and the rows stay in the inbox until acknowledged or superseded; fix, publish, then re-run: bun run beep yeet monitor --until-ready --settle-timeout 20m"
              );
            } else {
              expect(terminal).toBe("closed");
              expect(yield* Ref.get(polls)).toBe(3);
              expect(printed).not.toContain("[yeet] wave on PR");
            }
            // Handing the wave back never acknowledges it.
            expect((yield* readYeetAckState(root, redId)).acked).toBe(false);
          })
        )
      )
    );
});

it("uses one complete exit table and read-only automatic closeout options", () => {
  expect(A.map(yeetMonitorExitTable, (row) => row.terminal)).toEqual(YeetMonitorTerminalState.Options);
  for (const row of yeetMonitorExitTable)
    expect(row.exitCode).toBe(
      row.terminal === "ready" || row.terminal === "merged" ? 0 : row.terminal === "wave" ? 2 : 1
    );
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
// first cycle the session is attached and nothing can be missed. It replays
// from its own `until-merged` position (pr-event-awareness D21); an
// `--until-ready` session replays nothing and turns comments into inbox rows
// instead (yeet-pr-comment-rows).
const untilMerged = {
  policy: YeetUntilMergedPolicy.make({}),
  onMerged: () => Effect.void,
  closeout: () => Effect.succeed(report()),
};
it.layer(platform, { timeout: "30 seconds" })("R7 durable comment replay", (test) => {
  test.effect("replays the until-merged comment stream on the first cycle only, naming the pull request", () =>
    fixture((root) =>
      Effect.gen(function* () {
        const polls = yield* Ref.make(0);
        const replayed = yield* Ref.make<ReadonlyArray<readonly [number, string | undefined]>>(A.empty());
        const rowPolls = yield* Ref.make(0);

        const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
          ...options,
          ...untilMerged,
          collectStatus: () =>
            Ref.getAndUpdate(polls, (n) => n + 1).pipe(
              Effect.map((n) => snapshot(root, [check("Lint")], n >= 1, head, n >= 2 ? "MERGED" : "OPEN"))
            ),
          replayComments: (_context, prNumber, consumer) =>
            Ref.update(replayed, A.append([prNumber, consumer] as const)),
          commentRows: () => Ref.update(rowPolls, (n) => n + 1).pipe(Effect.as(A.empty())),
        });

        expect(terminal).toBe("merged");
        expect(yield* Ref.get(replayed)).toStrictEqual([[7, "until-merged"]]);
        expect(yield* Ref.get(polls)).toBeGreaterThan(1);
        expect(yield* Ref.get(rowPolls)).toBe(0);
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
          ...untilMerged,
          collectStatus: () =>
            Ref.getAndUpdate(polls, (n) => n + 1).pipe(
              Effect.flatMap((n) =>
                n === 0
                  ? Effect.fail(failure)
                  : Effect.succeed(snapshot(root, [check("Lint")], n >= 2, head, n >= 3 ? "MERGED" : "OPEN"))
              )
            ),
          replayComments: (_context, prNumber) => Ref.update(replayed, A.append(prNumber)),
        });

        expect(terminal).toBe("merged");
        expect(yield* Ref.get(replayed)).toStrictEqual([7]);
        expect(yield* Ref.get(polls)).toBeGreaterThan(2);
      })
    )
  );
});

// pr-event-awareness W4 (D13/D21/D32): under `--until-ready` nothing is
// replayed to the log; every poll turns new comments into P1 `pr-comment` rows
// from the loop's own watermark, inside a window that starts at the monitor
// job's submit time, or at the loop's start for an attached run.
const commentRowFor = (window: YeetPrCommentWindow, observedAt: string) =>
  YeetPrCommentRow.make({
    capsule: YeetPrCommentCapsule.make({
      author: "reviewer",
      commentId: 44,
      createdAt: observedAt,
      excerpt: "Please rebase onto main.",
      headSha: window.headSha,
      link: `${url}#issuecomment-44`,
      prNumber: window.prNumber,
      source: "issue",
    }),
    checkout: "/repo",
    id: "pr-comment-44",
    severity: "P1",
    ts: observedAt,
  });
const loginCapture = (answers: Ref.Ref<ReadonlyArray<number>>) => (_command: string, args: ReadonlyArray<string>) =>
  args[1] === "user"
    ? Ref.getAndUpdate(answers, A.drop(1)).pipe(
        Effect.map((remaining) => ({
          exitCode: O.getOrElse(A.head(remaining), () => 0),
          output: "operator\n",
          truncated: false,
        }))
      )
    : Effect.succeed({ exitCode: 0, output: at, truncated: false });
it.layer(platform, { timeout: "30 seconds" })("W4 until-ready comment rows", (test) => {
  test.effect("replays nothing and turns comments into rows on every poll, inside the job's window", () =>
    fixture((root) =>
      Effect.gen(function* () {
        const polls = yield* Ref.make(0);
        const replayed = yield* Ref.make(0);
        const logins = yield* Ref.make<ReadonlyArray<number>>(A.empty());
        const windows = yield* Ref.make<ReadonlyArray<YeetPrCommentWindow>>(A.empty());
        const submittedAt = "2026-09-15T23:00:00.000Z";

        const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
          ...options,
          capture: loginCapture(logins),
          collectStatus: () =>
            Ref.getAndUpdate(polls, (n) => n + 1).pipe(Effect.map((n) => snapshot(root, [check("Lint")], n >= 2))),
          closeout: () => Effect.succeed(report()),
          commentsSince: submittedAt,
          replayComments: () => Ref.update(replayed, (n) => n + 1),
          commentRows: (_context, window, observedAt) =>
            Ref.getAndUpdate(windows, A.append(window)).pipe(
              Effect.map((seen) => (A.isReadonlyArrayEmpty(seen) ? [commentRowFor(window, observedAt)] : []))
            ),
        });

        expect(terminal).toBe("ready");
        expect(yield* Ref.get(replayed)).toBe(0);
        // Every poll converges comments, not only the first cycle (the closeout's
        // reread is inside a poll, so status reads outnumber polls).
        const seen = yield* Ref.get(windows);
        expect(A.length(seen)).toBeGreaterThan(1);
        expect(
          A.dedupe(
            A.map(seen, (window) => `${window.since} ${window.actingLogin} #${window.prNumber} ${window.headSha}`)
          )
        ).toStrictEqual([`${submittedAt} operator #7 ${head}`]);
        expect(yield* lines).toContain(
          `[yeet] P1 pr-comment row pr-comment-44: comment by @reviewer on PR #7 ${url}#issuecomment-44`
        );
      })
    )
  );

  test.effect("starts an attached run's window at the loop's start and waits for the acting login", () =>
    fixture((root) =>
      Effect.gen(function* () {
        const polls = yield* Ref.make(0);
        // The first login read fails; the next one names the login and is kept.
        const logins = yield* Ref.make<ReadonlyArray<number>>([1]);
        const windows = yield* Ref.make<ReadonlyArray<YeetPrCommentWindow>>(A.empty());
        const captures = yield* Ref.make(0);
        const capture = loginCapture(logins);

        const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
          ...options,
          capture: (command, args) =>
            (args[1] === "user" ? Ref.update(captures, (n) => n + 1) : Effect.void).pipe(
              Effect.andThen(capture(command, args))
            ),
          collectStatus: () =>
            Ref.getAndUpdate(polls, (n) => n + 1).pipe(Effect.map((n) => snapshot(root, [check("Lint")], n >= 3))),
          closeout: () => Effect.succeed(report()),
          commentRows: (_context, window) => Ref.update(windows, A.append(window)).pipe(Effect.as(A.empty())),
        });

        expect(terminal).toBe("ready");
        // The loop's start is the fixture's clock. The first poll had no login and
        // polled nothing; the second read named it, and no later poll read it again.
        const seen = yield* Ref.get(windows);
        expect(A.length(seen)).toBeGreaterThan(0);
        expect(A.dedupe(A.map(seen, (window) => window.since))).toStrictEqual([at]);
        expect(yield* Ref.get(captures)).toBe(2);
        expect(A.join(A.map(yield* TestConsole.errorLines, String), "\n")).toContain(
          "[yeet] comment rows wait: gh could not name the acting login"
        );
      })
    )
  );
});
