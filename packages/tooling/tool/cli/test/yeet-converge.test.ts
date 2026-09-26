import {
  appendYeetInboxRow,
  appendYeetInboxRowOnce,
  convergeYeetInbox,
  GreptileSummary,
  loadYeetInboxView,
  loadYeetPrWave,
  loadYeetRemediationWave,
  mergeReadyCriterionHolds,
  PrCloseoutReport,
  RepoRunContext,
  runYeetMonitorUntilMerged,
  writeYeetAckReceipt,
  YeetAckFixResolution,
  YeetAckReceipt,
  YeetAckThreadResolution,
  YeetAckWontfixResolution,
  YeetBaseDriftCapsule,
  YeetBaseDriftRow,
  YeetCheckSignal,
  YeetConvergeObservation,
  YeetInboxRowJson,
  YeetMergeReady,
  YeetMergeReadyCriteria,
  YeetMergeReadyCriterion,
  YeetRemediationWave,
  YeetRemediationWaveJson,
  YeetRulesetRequiredContexts,
  YeetStatusArtifact,
  YeetStatusRemote,
  YeetStatusReviewThread,
  YeetStatusSnapshot,
  YeetStatusWorktree,
  YeetUntilMergedPolicy,
  YeetUntilReadyPolicy,
  YeetWatchCheck,
  YeetWatchThread,
  yeetBaseDriftRowId,
} from "@beep/repo-cli/test/Yeet";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { expect, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import { Duration, Effect, FileSystem, HashSet, Layer, Ref, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

const at = "2026-09-25T00:00:00.000Z";
const url = "https://github.com/beep/repo/pull/7";
const head = "aaaaaaa1111111";
const fixHead = "bbbbbbb2222222";
const staleHead = "ccccccc3333333";
const link = "https://github.com/beep/repo/actions/runs/11/job/22";

const redCheck = (name = "Check", required = true) =>
  YeetWatchCheck.make({
    name,
    outcome: "fail",
    required,
    link,
    signal: YeetCheckSignal.make({ bucket: "fail", state: "FAILURE" }),
    workflow: "CI",
  });
const greenCheck = (name = "Check") => YeetWatchCheck.make({ name, outcome: "pass", required: true });
const thread = (threadId: string) => YeetStatusReviewThread.make({ threadId, author: "reviewer", excerpt: "nit" });

const contextFor = (root: string) =>
  RepoRunContext.make({
    base: "origin/main",
    branch: "feature/converge",
    cwd: root,
    head: "HEAD",
    originalArgv: [],
    packetDir: ".beep/yeet",
    repoRoot: root,
    turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
  });

interface SnapshotInput {
  readonly bound?: boolean;
  readonly checks: ReadonlyArray<YeetWatchCheck>;
  readonly mergeable?: string;
  readonly mergeStateStatus?: string;
  readonly sha: string;
  readonly state?: string;
  readonly unresolved?: ReadonlyArray<YeetStatusReviewThread>;
}

const snapshot = (root: string, input: SnapshotInput) => {
  const state = input.state ?? "OPEN";
  const bound = input.bound ?? false;
  const unresolved = input.unresolved ?? [];
  const criteria = YeetMergeReadyCriteria.make({
    prOpen: state === "OPEN",
    notDraft: true,
    closeoutRun: bound,
    requiredChecksGreen: A.every(input.checks, (value) => !value.required || value.outcome === "pass"),
    threadsResolved: A.isReadonlyArrayEmpty(unresolved),
    mergeable: input.mergeable !== "CONFLICTING",
    mergeStateAcceptable: input.mergeStateStatus !== "DIRTY",
    reviewDecisionAcceptable: true,
    greptileScore: O.none(),
  });
  const failing = A.findFirst(
    YeetMergeReadyCriterion.Options,
    (criterion) => !mergeReadyCriterionHolds(criteria, criterion)
  );
  return YeetStatusSnapshot.make({
    base: "origin/main",
    branch: "feature/converge",
    head: "HEAD",
    createdAt: at,
    nextCommand: "monitor",
    runId: "converge",
    schemaVersion: "yeet-status/v1",
    statusPath: `${root}/status.json`,
    worktree: YeetStatusWorktree.make({ clean: true, staged: 0, unstaged: 0, untracked: 0 }),
    closeout: YeetStatusArtifact.make({ detail: "fixture", path: "closeout.json", state: "missing" }),
    verdict: YeetStatusArtifact.make({ detail: "fixture", path: "verdict.json", state: "missing" }),
    remote: YeetStatusRemote.make({
      available: true,
      checked: true,
      detail: "fixture",
      headSha: O.some(input.sha),
      number: 7,
      url,
      checks: input.checks,
      state,
      failingCheckCount: A.filter(input.checks, (value) => value.outcome === "fail").length,
      unresolvedThreads: O.some(unresolved),
      ...(input.mergeStateStatus === undefined ? {} : { mergeStateStatus: input.mergeStateStatus }),
      ...(input.mergeable === undefined ? {} : { mergeable: input.mergeable }),
    }),
    mergeReady: O.some(YeetMergeReady.make({ ready: O.isNone(failing), criteria, failing })),
  });
};

const report = (sha: string) => ({
  reportPath: "closeout.json",
  report: PrCloseoutReport.make({
    actionableReviewThreadCount: 0,
    botCommentCount: 0,
    greptile: GreptileSummary.make({ issueCount: 0, score: "5/5" }),
    issueCount: 0,
    issues: [],
    prNumber: 7,
    prUrl: url,
    reviewedHeadSha: O.some(sha),
    retriggeredGreptile: false,
    schemaVersion: "yeet-pr-closeout/v1",
  }),
});

const handle = (output: string) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.make(new TextEncoder().encode(output)),
    stdout: Stream.make(new TextEncoder().encode(output)),
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

// The failed-job triage behind a red reads `gh run list`; an empty run list
// keeps these cases about convergence rather than rerun classification.
const platform = Layer.mergeAll(
  NodeFileSystem.layer,
  NodePath.layer,
  NodeCrypto.layer,
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) =>
      ChildProcess.isStandardCommand(command) && command.args[0] === "run" && command.args[1] === "list"
        ? Effect.succeed(handle("[]"))
        : Effect.die("unexpected process")
    )
  )
);

const loopOptions = {
  capture: () => Effect.succeed({ exitCode: 0, output: at, truncated: false }),
  rulesetRead: () =>
    Effect.succeedSome(
      YeetRulesetRequiredContexts.make({ base: "main", readAt: at, contexts: ["Check"], rulesetIds: [1] })
    ),
  pollInterval: Duration.zero,
  onMerged: () => Effect.void,
  replayComments: () => Effect.void,
  // The until-ready comment consumer is proven in yeet-pr-comment-rows.
  commentRows: () => Effect.succeed(A.empty()),
};

const rows = Effect.fn("convergeTest.rows")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs.exists(`${root}/.beep/inbox/failures.ndjson`);
  if (!exists) return [];
  const text = yield* fs.readFileString(`${root}/.beep/inbox/failures.ndjson`);
  return A.flatMap(Str.split(text, "\n"), (line) => O.toArray(YeetInboxRowJson.decodeOption(line)));
});

const seedStaleWave = Effect.fn("convergeTest.seedStaleWave")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(`${root}/.beep/inbox`, { recursive: true });
  const json = yield* YeetRemediationWaveJson.encode(
    YeetRemediationWave.make({
      capsuleIds: ["Check-stale"],
      headSha: staleHead,
      prNumber: 7,
      sessionStartedAt: at,
      updatedAt: at,
    })
  );
  yield* fs.writeFileString(`${root}/.beep/inbox/dispatch.json`, `${json}\n`);
});

// The ids the bounded active index holds: what the inbox hook injects from.
const activeIds = Effect.fn("convergeTest.activeIds")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(`${root}/.beep/inbox/active.ndjson`);
  return A.flatMap(Str.split(text, "\n"), (line) =>
    O.toArray(O.map(YeetInboxRowJson.decodeOption(line), (row) => row.id))
  );
});

const tempRoot = Effect.fn("convergeTest.tempRoot")(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.makeTempDirectoryScoped({ prefix: "yeet-converge-" });
});

it.layer(platform, { timeout: "30 seconds" })("Converge", (test) => {
  test.effect("writes one row per failing check, outstanding thread and BEHIND state, idempotently", () =>
    Effect.gen(function* () {
      const root = yield* tempRoot();
      const observation = YeetConvergeObservation.make({
        checks: [redCheck("Check"), redCheck("Vercel", false), greenCheck("Lint")],
        headSha: head,
        mergeStateStatus: "BEHIND",
        prNumber: 7,
        threads: [
          YeetWatchThread.make({ id: "T1", state: "unresolved" }),
          YeetWatchThread.make({ id: "T2", state: "resolved-follow-up" }),
          YeetWatchThread.make({ id: "T3", state: "resolved-answered" }),
        ],
      });
      const context = { base: "origin/main", repoRoot: root };
      yield* convergeYeetInbox(context, observation, at);
      const first = yield* rows(root);
      expect(A.map(first, (row) => `${row.kind}:${row.severity}`)).toEqual([
        "check-failed:P0",
        "check-failed:P1",
        "review-thread:P1",
        "review-thread:P1",
        "base-drift:P2",
      ]);
      expect(first[0]).toMatchObject({
        capsule: {
          bucket: "fail",
          headSha: head,
          lane: "Check",
          link,
          observedAt: at,
          prNumber: 7,
          state: "FAILURE",
          workflow: "CI",
        },
      });
      const wave = O.getOrThrow(yield* loadYeetRemediationWave(root));
      expect(wave.headSha).toBe(head);
      expect(wave.capsuleIds).toEqual([first[0]?.id, first[1]?.id]);
      yield* convergeYeetInbox(context, observation, "2026-09-25T00:00:30.000Z");
      expect(yield* rows(root)).toHaveLength(5);
    })
  );

  test.effect("never appends a row again while its ack stands, after the active index dropped it", () =>
    Effect.gen(function* () {
      const root = yield* tempRoot();
      const context = { base: "origin/main", repoRoot: root };
      const observation = YeetConvergeObservation.make({
        checks: [redCheck()],
        headSha: head,
        mergeStateStatus: "BEHIND",
        prNumber: 7,
        threads: [YeetWatchThread.make({ id: "T1", state: "unresolved" })],
      });
      yield* convergeYeetInbox(context, observation, at);
      const written = yield* rows(root);
      expect(A.map(written, (row) => row.kind)).toEqual(["check-failed", "review-thread", "base-drift"]);
      // Each row is answered while its item stays outstanding: a fix in flight
      // for the red, a reply on the thread, a wontfix on the drift.
      const resolutions = [
        YeetAckFixResolution.make({ sha: fixHead }),
        YeetAckThreadResolution.make({ url: `${url}#discussion_r1` }),
        YeetAckWontfixResolution.make({ reason: "the base moves daily" }),
      ];
      yield* Effect.forEach(A.zip(written, resolutions), ([row, resolution]) =>
        writeYeetAckReceipt(root, YeetAckReceipt.make({ ackedAt: at, id: row.id, resolution }))
      );
      // An unrelated append rebuilds the active index, which drops acked rows.
      const unrelatedCapsule = YeetBaseDriftCapsule.make({ base: "origin/main", headSha: fixHead, prNumber: 8 });
      const unrelated = YeetBaseDriftRow.make({
        capsule: unrelatedCapsule,
        checkout: root,
        id: yield* yeetBaseDriftRowId(unrelatedCapsule),
        severity: "P2",
        ts: at,
      });
      yield* appendYeetInboxRow(root, unrelated);
      expect(yield* activeIds(root)).toEqual([unrelated.id]);
      // The red, the thread and the drift are all still true on the next poll.
      yield* convergeYeetInbox(context, observation, "2026-09-25T00:00:30.000Z");
      yield* convergeYeetInbox(context, observation, "2026-09-25T00:01:00.000Z");
      expect(A.map(yield* rows(root), (row) => row.id)).toEqual([...A.map(written, (row) => row.id), unrelated.id]);
      expect(yield* activeIds(root)).toEqual([unrelated.id]);
      expect(yield* appendYeetInboxRowOnce(root, A.getUnsafe(written, 1))).toBe(false);
    })
  );

  test.effect("leaves an older head's wave record alone when the observation has no red", () =>
    Effect.gen(function* () {
      const root = yield* tempRoot();
      yield* seedStaleWave(root);
      yield* convergeYeetInbox(
        { base: "origin/main", repoRoot: root },
        YeetConvergeObservation.make({
          checks: [greenCheck()],
          headSha: head,
          mergeStateStatus: "CLEAN",
          prNumber: 7,
          threads: [],
        }),
        at
      );
      assertSome(
        O.map(yield* loadYeetRemediationWave(root), (wave) => wave.headSha),
        staleHead
      );
    })
  );
});

it.layer(platform, { timeout: "30 seconds" })("until-ready merge loop as the inbox producer", (test) => {
  test.effect(
    "pins the wave per head, keeps polling through a required red and a base conflict, and re-pins at the fix push",
    () =>
      Effect.gen(function* () {
        const root = yield* tempRoot();
        yield* seedStaleWave(root);
        const polls = yield* Ref.make(0);
        const pinnedAtPoll = yield* Ref.make(A.empty<string>());
        // Polls 0-1: head A red on the required Check, a base conflict, one
        // unresolved thread. Poll 2: the fix push (head B), green, closeout
        // pending; the closeout reread (poll 3) binds it and the loop is ready.
        const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
          ...loopOptions,
          policy: YeetUntilReadyPolicy.make({}),
          collectStatus: Effect.fnUntraced(function* () {
            const wave = yield* loadYeetRemediationWave(root);
            yield* Ref.update(
              pinnedAtPoll,
              A.append(O.match(wave, { onNone: () => "none", onSome: (w) => w.headSha }))
            );
            const n = yield* Ref.getAndUpdate(polls, (value) => value + 1);
            return n <= 1
              ? snapshot(root, {
                  bound: true,
                  checks: [redCheck()],
                  mergeStateStatus: "DIRTY",
                  mergeable: "CONFLICTING",
                  sha: head,
                  unresolved: [thread("T1")],
                })
              : snapshot(root, { bound: n >= 3, checks: [greenCheck()], sha: fixHead });
          }),
          closeout: () => Effect.succeed(report(fixHead)),
        });
        expect(terminal).toBe("ready");
        expect(yield* Ref.get(polls)).toBe(4);
        // The stale record is superseded at the first poll, stays on head A
        // through the red polls, and moves to head B at the fix push.
        expect(yield* Ref.get(pinnedAtPoll)).toEqual([staleHead, head, head, fixHead]);
        const written = yield* rows(root);
        expect(A.map(written, (row) => row.kind)).toEqual([
          "check-failed",
          "review-thread",
          "base-conflict",
          "pr-merge-ready",
        ]);
        expect(written[0]).toMatchObject({
          severity: "P0",
          capsule: {
            bucket: "fail",
            headSha: head,
            lane: "Check",
            link,
            prNumber: 7,
            state: "FAILURE",
            workflow: "CI",
          },
        });
        const wave = O.getOrThrow(yield* loadYeetRemediationWave(root));
        expect(wave).toMatchObject({ headSha: fixHead, prNumber: 7, capsuleIds: [], sessionStartedAt: null });
        const view = yield* loadYeetInboxView(root);
        const red = A.findFirst(view.entries, (entry) => entry.row.kind === "check-failed");
        assertSome(
          O.map(red, (entry) => entry.liveness),
          "superseded"
        );
        // The conflict joined head A's wave, so the fix push supersedes it too;
        // the review thread is wave-exempt and stays live.
        const conflict = A.findFirst(view.entries, (entry) => entry.row.kind === "base-conflict");
        assertSome(
          O.map(conflict, (entry) => entry.liveness),
          "superseded"
        );
        const outstanding = A.findFirst(view.entries, (entry) => entry.row.kind === "review-thread");
        assertSome(
          O.map(outstanding, (entry) => entry.liveness),
          "live"
        );
        const printed = A.join(A.map(yield* TestConsole.logLines, String), "\n");
        expect(printed).toContain("settle: base-conflict");
        const errors = A.join(A.map(yield* TestConsole.errorLines, String), "\n");
        expect(errors).toContain("head moved to bbbbbbb; the 2-capsule wave for aaaaaaa is superseded.");
      })
  );

  test.effect("binds a detached job's pull request only after pinning the wave record to the head it observes", () =>
    Effect.gen(function* () {
      const root = yield* tempRoot();
      const context = { base: "origin/main", repoRoot: root };
      // An earlier monitor left the previous head's red live against its wave record.
      yield* convergeYeetInbox(
        context,
        YeetConvergeObservation.make({
          checks: [redCheck()],
          headSha: staleHead,
          mergeStateStatus: "CLEAN",
          prNumber: 7,
          threads: [],
        }),
        at
      );
      const [staleRed] = yield* rows(root);
      // A waiter bound now, before any pin, would read that red as a new wave.
      const early = yield* loadYeetPrWave(root, 7, HashSet.empty());
      assertSome(
        O.map(early, (wave) => A.map(wave.entries, (entry) => entry.row.id)),
        [staleRed?.id]
      );
      const polls = yield* Ref.make(0);
      const binds = yield* Ref.make(A.empty<readonly [number, string, ReadonlyArray<string>]>());
      // Poll 0: the job starts on head A, red. Poll 1: head A again. Poll 2:
      // the fix push (head B), its check still running. Poll 3: closed.
      const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
        ...loopOptions,
        policy: YeetUntilReadyPolicy.make({}),
        attachment: "detached",
        bindPullRequest: Effect.fnUntraced(function* (_context, prNumber) {
          // What the job's waiter reads the moment the record is bound.
          const pinned = O.getOrThrow(yield* loadYeetRemediationWave(root)).headSha;
          const wave = yield* loadYeetPrWave(root, prNumber, HashSet.empty());
          const ids = O.match(wave, {
            onNone: A.empty<string>,
            onSome: (value) => A.map(value.entries, (entry) => entry.row.id),
          });
          yield* Ref.update(binds, A.append([prNumber, pinned, ids] as const));
        }),
        collectStatus: () =>
          Ref.getAndUpdate(polls, (n) => n + 1).pipe(
            Effect.map((n) =>
              n <= 1
                ? snapshot(root, { bound: true, checks: [redCheck()], sha: head })
                : snapshot(root, {
                    checks: [YeetWatchCheck.make({ name: "Check", outcome: "pending", required: true })],
                    sha: fixHead,
                    state: n === 3 ? "CLOSED" : "OPEN",
                  })
            )
          ),
        closeout: () => Effect.die("unexpected closeout"),
      });
      expect(terminal).toBe("closed");
      const headRed = A.findFirst(
        yield* rows(root),
        (row) => row.kind === "check-failed" && row.capsule.headSha === head
      );
      // One bind per head, each after its pin: the previous head's red is
      // already superseded, and the current head's red is returned at once.
      expect(yield* Ref.get(binds)).toStrictEqual([
        [7, head, O.toArray(O.map(headRed, (row) => row.id))],
        [7, fixHead, []],
      ]);
    })
  );

  test.effect("an until-merged loop keeps its contract and writes no wave rows", () =>
    Effect.gen(function* () {
      const root = yield* tempRoot();
      const fs = yield* FileSystem.FileSystem;
      const polls = yield* Ref.make(0);
      const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
        ...loopOptions,
        policy: YeetUntilMergedPolicy.make({}),
        collectStatus: () =>
          Ref.getAndUpdate(polls, (n) => n + 1).pipe(
            Effect.map((n) =>
              snapshot(root, {
                bound: true,
                checks: [redCheck()],
                sha: head,
                state: n === 0 ? "OPEN" : "MERGED",
                unresolved: [thread("T1")],
              })
            )
          ),
        closeout: () => Effect.die("unexpected closeout"),
      });
      expect(terminal).toBe("merged");
      expect(yield* fs.exists(`${root}/.beep/inbox/failures.ndjson`)).toBe(false);
      expect(yield* fs.exists(`${root}/.beep/inbox/dispatch.json`)).toBe(false);
    })
  );
});
