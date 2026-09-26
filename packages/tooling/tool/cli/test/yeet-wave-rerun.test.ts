import { fcRuns } from "@beep/fc-runs";
import {
  appendYeetInboxRow,
  GreptileSummary,
  loadYeetPrWave,
  loadYeetRemediationWave,
  mergeReadyCriterionHolds,
  PrCloseoutReport,
  ProofJobLauncher,
  ProofJobRecord,
  ProofJobRequest,
  ProofJobSubmitter,
  ProofJobUnit,
  ProofJobWaitOptions,
  proofJobUnitName,
  proofJobWaitExitFor,
  RepoRunContext,
  readYeetAckState,
  renderYeetPrWaveLine,
  runYeetMonitorUntilMerged,
  YeetBaseDriftCapsule,
  YeetBaseDriftRow,
  YeetCheckFailedRow,
  YeetFailureCapsule,
  YeetInboxRowJson,
  YeetMergeReady,
  YeetMergeReadyCriteria,
  YeetMergeReadyCriterion,
  YeetPrCommentCapsule,
  YeetPrCommentRow,
  YeetPrMergeReadyCapsule,
  YeetPrMergeReadyRow,
  YeetRemediationWave,
  YeetRemediationWaveJson,
  YeetReviewThreadCapsule,
  YeetReviewThreadRow,
  YeetRulesetRequiredContexts,
  YeetStatusArtifact,
  YeetStatusRemote,
  YeetStatusSnapshot,
  YeetStatusWorktree,
  YeetUntilReadyPolicy,
  YeetWatchCheck,
  yeetInboxRowId,
  yeetInboxRowWakes,
  yeetMonitorExitFor,
  yeetPrCommentRowId,
  yeetRedSetKey,
  yeetRedSetKeyGained,
  yeetWaveRedSetKey,
} from "@beep/repo-cli/test/Yeet";
import { UUID } from "@beep/schema/String";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, it } from "@effect/vitest";
import {
  assertFalse,
  assertInclude,
  assertNone,
  assertSome,
  assertTrue,
  deepStrictEqual,
  strictEqual,
} from "@effect/vitest/utils";
import { Duration, Effect, FileSystem, HashSet, Layer, Ref, Sink, Stream } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import type {
  ProofJobLauncherShape,
  ProofJobWaitResult,
  YeetInboxRow,
  YeetMonitorAttachment,
} from "@beep/repo-cli/test/Yeet";

// Orchestrator ruling on pr-event-awareness slice 1: a required red that
// persists on the same head after a rerun keeps its row id (pr, head, check),
// so no new row is written. The wave record carries the head's required red set
// (name, job link, completion stamp per red check), and both waiters treat a
// red set that names a red they have not handed back as a new wave. Optional
// reds are rows but never wake a waiter (ttc ruling 42).

const at = "2026-09-16T00:00:00.000Z";
const url = "https://github.com/beep/repo/pull/7";
const head = "aaaaaaa1111111";
const jobUuid = "4a1b2c3d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

// One red check on run `run`: a rerun of the same check is a new run with a new
// job link and a new completion stamp.
const red = (run: number, name = "Lint", required = true) =>
  YeetWatchCheck.make({
    name,
    outcome: "fail",
    required,
    link: `https://github.com/beep/repo/actions/runs/${run}/job/${run}`,
    completedAt: O.some(`2026-09-16T00:0${run}:00Z`),
  });
const green = (name: string) => YeetWatchCheck.make({ name, outcome: "pass" });

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

// The closeout is already bound and the review threads are open, so a head
// with a required red is neither ready nor asking for a closeout.
const snapshot = (root: string, checks: ReadonlyArray<YeetWatchCheck>, state: string) => {
  const criteria = YeetMergeReadyCriteria.make({
    prOpen: state === "OPEN",
    notDraft: true,
    closeoutRun: true,
    requiredChecksGreen: A.every(checks, (value) => !value.required || value.outcome === "pass"),
    threadsResolved: false,
    mergeable: true,
    mergeStateAcceptable: true,
    reviewDecisionAcceptable: true,
    greptileScore: O.none(),
  });
  return YeetStatusSnapshot.make({
    base: "origin/main",
    branch: "feature/ready",
    head: "HEAD",
    createdAt: at,
    nextCommand: "monitor",
    runId: "wave-rerun",
    schemaVersion: "yeet-status/v1",
    statusPath: `${root}/status.json`,
    worktree: YeetStatusWorktree.make({ clean: true, staged: 0, unstaged: 0, untracked: 0 }),
    closeout: YeetStatusArtifact.make({ detail: "fixture", path: "closeout.json", state: "missing" }),
    verdict: YeetStatusArtifact.make({ detail: "fixture", path: "verdict.json", state: "missing" }),
    remote: YeetStatusRemote.make({
      available: true,
      checked: true,
      detail: "fixture",
      headSha: O.some(head),
      number: 7,
      url,
      checks,
      state,
      failingCheckCount: A.filter(checks, (value) => value.outcome === "fail").length,
    }),
    mergeReady: O.some(
      YeetMergeReady.make({
        ready: false,
        criteria,
        failing: A.findFirst(
          YeetMergeReadyCriterion.Options,
          (criterion) => !mergeReadyCriterionHolds(criteria, criterion)
        ),
      })
    ),
  });
};

const closeoutReport = {
  reportPath: "closeout.json",
  report: PrCloseoutReport.make({
    actionableReviewThreadCount: 0,
    botCommentCount: 0,
    greptile: GreptileSummary.make({ issueCount: 0, score: "5/5" }),
    issueCount: 0,
    issues: [],
    prNumber: 7,
    prUrl: url,
    reviewedHeadSha: O.some(head),
    retriggeredGreptile: false,
    schemaVersion: "yeet-pr-closeout/v1",
  }),
};

type BindPullRequest = (context: RepoRunContext, prNumber: number) => Effect.Effect<void>;

// One `--until-ready` run over one head: poll 0 reads `checks` on the open pull
// request, poll 1 reads it closed. An attached run can stop on poll 0 with a
// wave; otherwise the run ends `closed`, the way a detached job's loop keeps
// polling until something terminal happens.
const runUntilReady = Effect.fn("waveRerunTest.runUntilReady")(function* (
  root: string,
  checks: ReadonlyArray<YeetWatchCheck>,
  attachment: YeetMonitorAttachment,
  bindPullRequest?: BindPullRequest
) {
  const polls = yield* Ref.make(0);
  return yield* runYeetMonitorUntilMerged(contextFor(root), {
    attachment,
    bindPullRequest,
    capture: () => Effect.succeed({ exitCode: 0, output: at, truncated: false }),
    closeout: () => Effect.succeed(closeoutReport),
    collectStatus: () =>
      Ref.getAndUpdate(polls, (n) => n + 1).pipe(
        Effect.map((n) => snapshot(root, checks, n === 0 ? "OPEN" : "CLOSED"))
      ),
    commentRows: () => Effect.succeed(A.empty()),
    onMerged: () => Effect.die("unexpected sweep"),
    policy: YeetUntilReadyPolicy.make({}),
    pollInterval: Duration.zero,
    replayComments: () => Effect.void,
    rulesetRead: () =>
      Effect.succeedSome(
        YeetRulesetRequiredContexts.make({ base: "main", readAt: at, contexts: ["Lint"], rulesetIds: [1] })
      ),
    waveRerunCommand: "bun run beep yeet monitor --until-ready",
  });
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

// The loop's triage lists the head's workflow runs (none here) and the job
// launcher asks systemd whether the job's unit is still loaded.
const platform = Layer.mergeAll(
  NodeFileSystem.layer,
  NodePath.layer,
  NodeCrypto.layer,
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) => {
      if (!ChildProcess.isStandardCommand(command)) return Effect.die("unexpected piped process");
      if (command.args[0] === "run" && command.args[1] === "list") return Effect.succeed(handle("[]"));
      if (A.contains(command.args, "LoadState")) return Effect.succeed(handle("loaded\n"));
      return Effect.die(`unexpected process: ${command.command} ${A.join(command.args, " ")}`);
    })
  )
);

const checkout = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.makeTempDirectoryScoped({ prefix: "yeet-wave-rerun-" });
});

const inboxRows = Effect.fn("waveRerunTest.inboxRows")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(`${root}/.beep/inbox/failures.ndjson`);
  return A.flatMap(Str.split(text, "\n"), (line) => O.toArray(YeetInboxRowJson.decodeOption(line)));
});

const checkFailedRows = (root: string) =>
  inboxRows(root).pipe(Effect.map(A.filter((row): row is YeetCheckFailedRow => row.kind === "check-failed")));

// The test console is shared by every test in one `it.layer` block, so each
// test counts the wave lines it adds from the count it started with.
const waveLineCount = TestConsole.logLines.pipe(
  Effect.map(A.filter((line) => Str.includes("[yeet] wave on PR #7")(String(line)))),
  Effect.map(A.length)
);

const waveLinesSince = (start: number) => waveLineCount.pipe(Effect.map((count) => count - start));

const printed = TestConsole.logLines.pipe(Effect.map(A.map(String)), Effect.map(A.join("\n")));

const failedRow = Effect.fn("waveRerunTest.failedRow")(function* (
  root: string,
  check: YeetWatchCheck,
  severity: "P0" | "P1"
) {
  const capsule = YeetFailureCapsule.make({
    bucket: "fail",
    headSha: head,
    lane: check.name,
    link: check.link,
    observedAt: at,
    prNumber: 7,
    state: "FAILURE",
    workflow: "CI",
  });
  const row = YeetCheckFailedRow.make({
    capsule,
    checkout: root,
    id: yield* yeetInboxRowId(capsule),
    severity,
    ts: at,
  });
  yield* appendYeetInboxRow(root, row);
  return row;
});

const commentRow = Effect.fn("waveRerunTest.commentRow")(function* (root: string, commentId: number) {
  const capsule = YeetPrCommentCapsule.make({
    author: "reviewer",
    commentId,
    createdAt: at,
    excerpt: "Please rebase onto main.",
    headSha: head,
    link: `${url}#issuecomment-${commentId}`,
    prNumber: 7,
    source: "issue",
  });
  const row = YeetPrCommentRow.make({
    capsule,
    checkout: root,
    id: yield* yeetPrCommentRowId(capsule),
    severity: "P1",
    ts: at,
  });
  yield* appendYeetInboxRow(root, row);
  return row;
});

const waveIds = (wave: O.Option<{ readonly entries: ReadonlyArray<{ readonly row: YeetInboxRow }> }>) =>
  O.map(wave, (value) => A.map(value.entries, (entry) => entry.row.id));

describe("red-set keys", () => {
  it("names a rerun that came back red as a new red, and a shrink or an empty set as nothing new", () => {
    const both = yeetRedSetKey([red(1), red(1, "Check")]);
    assertTrue(yeetRedSetKeyGained(yeetRedSetKey([red(2), red(1, "Check")]), both));
    assertFalse(yeetRedSetKeyGained(yeetRedSetKey([red(1)]), both));
    assertFalse(yeetRedSetKeyGained("", both));
    assertFalse(yeetRedSetKeyGained(both, both));
    assertTrue(yeetRedSetKeyGained(both, ""));
    strictEqual(yeetRedSetKey([red(1), red(1, "Check")]), yeetRedSetKey([red(1, "Check"), red(1)]));
  });

  it("keys only the failing required checks for the wave record", () => {
    strictEqual(yeetWaveRedSetKey([red(1), red(1, "Vercel", false), green("Check")]), yeetRedSetKey([red(1)]));
    strictEqual(yeetWaveRedSetKey([red(1, "Vercel", false)]), "");
  });

  it.prop(
    "keys any red set whatever the order, and never counts a part of it as a gained red",
    { checks: YeetWatchCheck.pipe(S.Array, Arbitrary.schema) },
    ({ checks }) => {
      const key = yeetRedSetKey(checks);
      strictEqual(yeetRedSetKey(A.reverse(checks)), key);
      assertFalse(yeetRedSetKeyGained(key, key));
      assertFalse(yeetRedSetKeyGained(yeetRedSetKey(A.drop(checks, 1)), key));
    },
    { arbitrary: fcRuns(20) }
  );

  it.effect("decodes a wave record written before the key existed and writes none back while it is absent", () =>
    Effect.gen(function* () {
      const legacy = `{"schemaVersion":"yeet-dispatch/v1","capsuleIds":["Lint-abc"],"headSha":"${head}","prNumber":7,"sessionStartedAt":"${at}","updatedAt":"${at}"}`;
      const decoded = YeetRemediationWaveJson.decodeOption(legacy);
      assertSome(
        O.map(decoded, (wave) => O.isNone(wave.redSetKey)),
        true
      );
      const encoded = yield* YeetRemediationWaveJson.encode(
        YeetRemediationWave.make({ capsuleIds: [], headSha: head, prNumber: 7, sessionStartedAt: null, updatedAt: at })
      );
      assertFalse(Str.includes("redSetKey")(encoded));
      assertInclude(encoded, `"schemaVersion":"yeet-dispatch/v1"`);
    })
  );
});

describe("wake set", () => {
  const failed = (severity: "P0" | "P1") =>
    YeetCheckFailedRow.make({
      capsule: YeetFailureCapsule.make({
        bucket: "fail",
        headSha: head,
        lane: "Vercel",
        link: null,
        observedAt: at,
        prNumber: 7,
        state: "FAILURE",
        workflow: null,
      }),
      checkout: "/repo",
      id: `Vercel-${severity}`,
      severity,
      ts: at,
    });

  it("wakes on P0 rows and on P1 review-thread and pr-comment rows only", () => {
    const thread = YeetReviewThreadRow.make({
      capsule: YeetReviewThreadCapsule.make({ headSha: head, link: null, prNumber: 7, threadId: "PRRT_1" }),
      checkout: "/repo",
      id: "review-thread-1",
      severity: "P1",
      ts: at,
    });
    const comment = YeetPrCommentRow.make({
      capsule: YeetPrCommentCapsule.make({
        author: "reviewer",
        commentId: 1,
        createdAt: at,
        excerpt: "Please rebase.",
        headSha: head,
        link: `${url}#issuecomment-1`,
        prNumber: 7,
        source: "issue",
      }),
      checkout: "/repo",
      id: "pr-comment-1",
      severity: "P1",
      ts: at,
    });
    const drift = YeetBaseDriftRow.make({
      capsule: YeetBaseDriftCapsule.make({ base: "origin/main", headSha: head, prNumber: 7 }),
      checkout: "/repo",
      id: "base-drift-1",
      severity: "P2",
      ts: at,
    });
    const ready = YeetPrMergeReadyRow.make({
      capsule: YeetPrMergeReadyCapsule.make({
        headSha: head,
        prNumber: 7,
        url: null,
        readyAt: at,
        pushedAt: null,
        settledAt: null,
        closeoutAt: null,
        pushToReadyMs: null,
      }),
      checkout: "/repo",
      id: "pr-merge-ready-1",
      severity: "P1",
      ts: at,
    });
    deepStrictEqual(A.map([failed("P0"), failed("P1"), thread, comment, drift, ready], yeetInboxRowWakes), [
      true,
      false,
      true,
      true,
      false,
      false,
    ]);
  });
});

it.layer(platform, { timeout: "30 seconds" })("attached --until-ready on a changed red set", (it) => {
  it.effect("ends a re-run attached loop with a second wave when a rerun comes back red on the same head", () =>
    Effect.gen(function* () {
      const root = yield* checkout;
      const start = yield* waveLineCount;
      const first = yield* runUntilReady(root, [red(1)], "attached");
      strictEqual(first, "wave");
      const [lint] = yield* checkFailedRows(root);
      if (lint === undefined) return yield* Effect.die("expected the Lint row");

      // The rerun came back red on the same head (a spent flake rerun or a manual
      // `gh run rerun`): a new run link, the same row id, no new row.
      const second = yield* runUntilReady(root, [red(2)], "attached");
      strictEqual(second, "wave");
      strictEqual(yeetMonitorExitFor(second).exitCode, 2);
      deepStrictEqual(
        A.map(yield* checkFailedRows(root), (row) => row.id),
        [lint.id]
      );
      strictEqual(yield* waveLinesSince(start), 2);
      assertInclude(yield* printed, `[yeet] wave on PR #7: 1 new P0/P1 inbox row(s): P0 Lint`);
      assertInclude(yield* printed, `[${lint.id}]`);
      assertSome(
        O.flatMap(yield* loadYeetRemediationWave(root), (wave) => wave.redSetKey),
        yeetWaveRedSetKey([red(2)])
      );

      // The same red set again is not a new wave: the loop runs until the PR closes.
      strictEqual(yield* runUntilReady(root, [red(2)], "attached"), "closed");
      strictEqual(yield* waveLinesSince(start), 2);
      // Handing the wave back never acknowledges it.
      assertFalse((yield* readYeetAckState(root, lint.id)).acked);
    })
  );

  it.effect("is not handed a red set that only shrank", () =>
    Effect.gen(function* () {
      const root = yield* checkout;
      const start = yield* waveLineCount;
      strictEqual(yield* runUntilReady(root, [red(1), red(1, "Check")], "attached"), "wave");
      // Check's rerun went green; Lint is the same red on the same run.
      strictEqual(yield* runUntilReady(root, [red(1), green("Check")], "attached"), "closed");
      strictEqual(yield* waveLinesSince(start), 1);
    })
  );

  it.effect("writes an optional red as a P1 row and never ends on it", () =>
    Effect.gen(function* () {
      const root = yield* checkout;
      const start = yield* waveLineCount;
      strictEqual(yield* runUntilReady(root, [red(1, "Vercel", false), green("Lint")], "attached"), "closed");
      deepStrictEqual(
        A.map(yield* checkFailedRows(root), (row) => [row.capsule.lane, row.severity]),
        [["Vercel", "P1"]]
      );
      strictEqual(yield* waveLinesSince(start), 0);
      // Its rerun coming back red does not wake either: the wave key counts required reds only.
      strictEqual(yield* runUntilReady(root, [red(2, "Vercel", false), green("Lint")], "attached"), "closed");
      strictEqual(yield* waveLinesSince(start), 0);
    })
  );

  it.effect("reads no wave from an optional red alone; a pr-comment and a required red each make one", () =>
    Effect.gen(function* () {
      const root = yield* checkout;
      yield* failedRow(root, red(1, "Vercel", false), "P1");
      assertNone(yield* loadYeetPrWave(root, 7, HashSet.empty()));
      const comment = yield* commentRow(root, 44);
      assertSome(waveIds(yield* loadYeetPrWave(root, 7, HashSet.empty())), [comment.id]);
      const lint = yield* failedRow(root, red(1), "P0");
      assertSome(waveIds(yield* loadYeetPrWave(root, 7, HashSet.make(comment.id))), [lint.id]);
    })
  );
});

const writeMonitorJob = Effect.fn("waveRerunTest.writeMonitorJob")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const jobId = yield* S.decodeEffect(UUID)(jobUuid);
  const jobs = `${root}/.beep/yeet/jobs`;
  const record = ProofJobRecord.make({
    jobId,
    phase: "submitted",
    submittedAt: at,
    request: ProofJobRequest.make({
      mode: "monitor",
      argv: ["monitor", "--until-ready"],
      checkout: root,
      branch: "feature/ready",
      base: "main",
      head,
      forwardedEnvNames: [],
    }),
    submitter: ProofJobSubmitter.make({ pid: 2147483647, cwd: root }),
    unit: ProofJobUnit.make({
      unitName: proofJobUnitName(jobId),
      slice: "agent-runs.slice",
      description: "beep-yeet-job",
      logPath: `${jobs}/${jobId}.log`,
      execStart: [],
      execStopPost: [],
    }),
  });
  yield* fs.makeDirectory(jobs, { recursive: true });
  yield* fs.writeFileString(
    `${jobs}/${jobId}.json`,
    `${yield* S.encodeEffect(S.fromJsonString(ProofJobRecord))(record)}\n`
  );
  return jobId;
});

// The detached loop binds the pull request to the job on each head's first poll.
const binder =
  (launcher: ProofJobLauncherShape, jobId: UUID): BindPullRequest =>
  (_context, prNumber) =>
    launcher.bindPullRequest(jobId, prNumber).pipe(Effect.orDie, Effect.asVoid);

const exitOf = (result: ProofJobWaitResult): number =>
  result.kind === "wave" ? proofJobWaitExitFor("wave").exitCode : proofJobWaitExitFor("success").exitCode;

const gateLineOf = (result: ProofJobWaitResult, jobId: UUID) =>
  result.kind === "wave"
    ? O.some(renderYeetPrWaveLine(result.wave, "job-wait", `bun run beep yeet job wait ${jobId}`))
    : O.none<string>();

// The waits that must not return time out against the live clock, so this
// block runs without the test services, as the proof-job wait tests do.
const quick = ProofJobWaitOptions.make({ timeoutMs: O.some(60), pollIntervalMs: 1 });

it.layer(platform, { timeout: "30 seconds", excludeTestServices: true })("job wait on a changed red set", (it) => {
  it.effect("hands a rerun that came back red on the same head back as a second wave, and the same red set never", () =>
    Effect.gen(function* () {
      const root = yield* checkout;
      const jobId = yield* writeMonitorJob(root);
      const launcher = yield* ProofJobLauncher.make(root);
      const bind = binder(launcher, jobId);

      strictEqual(yield* runUntilReady(root, [red(1)], "detached", bind), "closed");
      const first = yield* launcher.wait(jobId, quick);
      strictEqual(exitOf(first), 2);
      const [lint] = yield* checkFailedRows(root);
      if (lint === undefined) return yield* Effect.die("expected the Lint row");
      deepStrictEqual(first.kind === "wave" ? A.map(first.wave.entries, (entry) => entry.row.id) : [], [lint.id]);

      // The same head's Lint failed again on a new run: no new row, a new wave.
      strictEqual(yield* runUntilReady(root, [red(2)], "detached", bind), "closed");
      const second = yield* launcher.wait(jobId, quick);
      strictEqual(exitOf(second), 2);
      // The same gate line: the same live row, handed back again.
      deepStrictEqual(gateLineOf(second, jobId), gateLineOf(first, jobId));
      assertSome(
        O.flatMap(yield* launcher.read(jobId), (record) => record.returnedWaveRedSetKey),
        yeetWaveRedSetKey([red(2)])
      );

      // Unchanged red set: the re-run waits past it.
      strictEqual(yield* runUntilReady(root, [red(2)], "detached", bind), "closed");
      assertInclude((yield* Effect.flip(launcher.wait(jobId, quick))).message, "Timed out");
      assertFalse((yield* readYeetAckState(root, lint.id)).acked);
    })
  );

  it.effect("is not woken by an optional red alone, and is by a pr-comment and a required red", () =>
    Effect.gen(function* () {
      const root = yield* checkout;
      const jobId = yield* writeMonitorJob(root);
      const launcher = yield* ProofJobLauncher.make(root);
      const bind = binder(launcher, jobId);

      // A rate-limited Vercel deployment: optional, a P1 row, never a wave.
      strictEqual(yield* runUntilReady(root, [red(1, "Vercel", false), green("Lint")], "detached", bind), "closed");
      assertInclude((yield* Effect.flip(launcher.wait(jobId, quick))).message, "Timed out");

      const comment = yield* commentRow(root, 45);
      const woken = yield* launcher.wait(jobId, quick);
      strictEqual(exitOf(woken), 2);
      deepStrictEqual(woken.kind === "wave" ? A.map(woken.wave.entries, (entry) => entry.row.id) : [], [comment.id]);

      strictEqual(yield* runUntilReady(root, [red(1, "Vercel", false), red(1)], "detached", bind), "closed");
      const required = yield* launcher.wait(jobId, quick);
      strictEqual(exitOf(required), 2);
      deepStrictEqual(
        required.kind === "wave" ? A.map(required.wave.entries, (entry) => [entry.row.kind, entry.row.severity]) : [],
        [["check-failed", "P0"]]
      );
    })
  );
});
