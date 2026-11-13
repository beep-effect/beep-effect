// PERIL-11 slice 2 admission gate: monitor waiting is reported apart from local
// work. Every attempt below is classified by hand, with the class the v3 fold
// recorded and the reason the v4 class differs, then folded by the live fold.
// The lane ids, labels and failure kinds are the shapes live verdicts carry: a
// `yeet monitor` run (`monitor:01-pr-context`, `monitor:02-pr-checks-watch`), a
// publish that ran the readiness loop attached (`monitor:00-until-ready-submit`
// labelled `monitor:until-ready:attached`) or only submitted the detached job
// (labelled `monitor:until-ready:submit`), and a publish that watched inline.
import {
  buildYeetEconomicsReport,
  EconomicsAttempt,
  EconomicsJournal,
  EconomicsJournalDiagnostics,
  EconomicsLane,
  EconomicsScope,
  economicsAttemptClass,
  economicsCountMix,
  renderYeetEconomicsReport,
} from "@beep/repo-cli/test/Yeet";
import { describe, expect, it } from "@effect/vitest";
import { assertSome, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type { EconomicsAttemptClass } from "@beep/repo-cli/test/Yeet";

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const BASE_MS = DateTime.toEpochMillis(DateTime.makeUnsafe("2026-11-13T00:00:00.000Z"));
const NOW = DateTime.makeUnsafe("2026-11-14T00:00:00.000Z");
const at = (ms: number): string => DateTime.formatIso(DateTime.makeUnsafe(BASE_MS + ms));

const CONTEXT = "monitor:01-pr-context";
const WATCH = "monitor:02-pr-checks-watch";
const READY = "monitor:00-until-ready-submit";

const lane = (
  id: string,
  label: string,
  status: EconomicsLane["status"],
  durationMs: O.Option<number>,
  population: EconomicsLane["population"] = "wrapper",
  parentLaneId: O.Option<string> = O.none()
): EconomicsLane =>
  EconomicsLane.make({
    id,
    label,
    phase: A.headNonEmpty(Str.split(id, ":")),
    status,
    durationMs,
    repairCommand: O.none(),
    population,
    parentLaneId,
  });

const context = (status: EconomicsLane["status"] = "passed", ms = 400) =>
  lane(CONTEXT, "monitor:pr-context", status, O.some(ms));
const watch = (status: EconomicsLane["status"], ms: O.Option<number>) =>
  lane(WATCH, "monitor:pr-checks:watch", status, ms);
const attached = (status: EconomicsLane["status"], ms: number) =>
  lane(READY, "monitor:until-ready:attached", status, O.some(ms));
const cheapGates = (ms: number) => lane("full:00-cheap-gates", "full:00-cheap-gates", "passed", O.some(ms));
const push = lane("publish:01-git-push", "publish:pr-push", "passed", O.some(10 * SECOND));

interface Adjudicated {
  // The actionable-lane row of a v4 red.
  readonly actionable: O.Option<string>;
  readonly attempt: EconomicsAttempt;
  readonly attemptClass: EconomicsAttemptClass;
  // The v3 class and the v4 class, with the reason the v4 class is what it is.
  readonly recorded: EconomicsAttemptClass;
  readonly why: string;
}

const attempt = (
  attemptId: string,
  startMs: number,
  elapsedMs: number,
  overrides: Partial<Parameters<typeof EconomicsAttempt.make>[0]>
): EconomicsAttempt =>
  EconomicsAttempt.make({
    checkout: "beep-effect",
    runId: "run",
    attemptId,
    branch: "feat/monitor-wait",
    mode: O.some("publish"),
    outcome: O.some("failure"),
    failureKind: O.some("step-exit"),
    failedStepId: O.none(),
    message: "",
    startedAt: O.some(at(startMs)),
    endedAt: O.some(at(startMs + elapsedMs)),
    elapsedMs: O.some(elapsedMs),
    diffFingerprint: O.none(),
    terminationReason: O.none(),
    verdictSchemaVersion: O.some("yeet-verdict/v2"),
    lanes: [],
    ...overrides,
  });

const terminatedAttempt = (
  attemptId: string,
  mode: string,
  reason: EconomicsAttempt["terminationReason"],
  startMs: number,
  elapsedMs: number
): EconomicsAttempt =>
  attempt(attemptId, startMs, elapsedMs, {
    mode: O.some(mode),
    outcome: O.none(),
    failureKind: O.none(),
    terminationReason: reason,
    verdictSchemaVersion: O.none(),
  });

const adjudicate = (
  entry: EconomicsAttempt,
  recorded: EconomicsAttemptClass,
  attemptClass: EconomicsAttemptClass,
  actionable: O.Option<string>,
  why: string
): Adjudicated => ({ attempt: entry, recorded, attemptClass, actionable, why });

// `yeet monitor` runs: one journal, no comparable mode.
const MONITOR_RUNS: ReadonlyArray<Adjudicated> = [
  adjudicate(
    attempt("monitor-green", 0, 1_202 * SECOND, {
      mode: O.some("monitor"),
      outcome: O.some("success"),
      failureKind: O.none(),
      lanes: [context(), watch("passed", O.some(1_200 * SECOND))],
    }),
    "green",
    "monitor",
    O.none(),
    "a monitor run's green is hosted CI's, not local work"
  ),
  adjudicate(
    attempt("monitor-red-check", 0, 902 * SECOND, {
      mode: O.some("monitor"),
      failedStepId: O.some(WATCH),
      message: "yeet monitor failed.",
      lanes: [context(), watch("failed", O.some(900 * SECOND))],
    }),
    "red",
    "monitor",
    O.none(),
    "the checks watch saw a red check: the wait's, not a local red"
  ),
  adjudicate(
    attempt("monitor-poll-failed", 0, 601 * SECOND, {
      mode: O.some("monitor"),
      failureKind: O.some("handler-error"),
      message: "Failed to poll pull request comments during yeet monitor.",
      lanes: [context(), watch("passed", O.some(600 * SECOND))],
    }),
    "red",
    "red",
    O.some("unlocated"),
    "a handler error: the monitor itself failed"
  ),
  adjudicate(
    terminatedAttempt("monitor-unrecorded", "monitor", O.some("unrecorded-failure"), 0, 30 * SECOND),
    "red",
    "red",
    O.some("unrecorded"),
    "the monitor run died without a verdict: the monitor itself failed"
  ),
  adjudicate(
    terminatedAttempt("monitor-interrupted", "monitor", O.some("interrupted"), 0, 1_800 * SECOND),
    "terminated",
    "monitor",
    O.none(),
    "a wait cut off before its verdict is not a local termination"
  ),
  adjudicate(
    attempt("monitor-context-failed", 0, 2 * SECOND, {
      mode: O.some("monitor"),
      failedStepId: O.some(CONTEXT),
      lanes: [context("failed", 300), watch("not-run", O.none())],
    }),
    "red",
    "red",
    O.some(CONTEXT),
    "the pull-request lookup failed before any wait: the monitor itself failed"
  ),
];

// A publish that waited attached, red then green: one closed M1 episode.
const PUBLISH_ATTACHED: ReadonlyArray<Adjudicated> = [
  adjudicate(
    attempt("publish-attached-red", 0, 2_590 * SECOND, {
      failedStepId: O.some(READY),
      lanes: [cheapGates(180 * SECOND), push, attached("failed", 2_400 * SECOND)],
    }),
    "red",
    "monitor",
    O.none(),
    "the publish's local work passed; the attached readiness loop reported the red"
  ),
  adjudicate(
    attempt("publish-attached-green", 50 * MINUTE, 2_050 * SECOND, {
      outcome: O.some("success"),
      failureKind: O.none(),
      lanes: [cheapGates(240 * SECOND), push, attached("passed", 1_800 * SECOND)],
    }),
    "green",
    "green",
    O.none(),
    "a green publish stays green; only its wait leaves its local work"
  ),
];

// Three publishes and no green after them: one right-censored M1 streak.
const PUBLISH_OPEN: ReadonlyArray<Adjudicated> = [
  adjudicate(
    attempt("publish-submit-failed", 0, 301 * SECOND, {
      failedStepId: O.some(READY),
      lanes: [cheapGates(300 * SECOND), lane(READY, "monitor:until-ready:submit", "failed", O.some(SECOND))],
    }),
    "red",
    "red",
    O.some(READY),
    "the detached submit only launches the job: a failed submit is local work"
  ),
  adjudicate(
    attempt("publish-inline-watch-red", 10 * MINUTE, 1_620_400, {
      failedStepId: O.some(WATCH),
      lanes: [cheapGates(120 * SECOND), context(), watch("failed", O.some(1_500 * SECOND))],
    }),
    "red",
    "monitor",
    O.none(),
    "the publish watched inline and the watch saw the red"
  ),
  adjudicate(
    attempt("publish-provenance-failed", 40 * MINUTE, 422 * SECOND, {
      failedStepId: O.some("publish:03-pr-provenance-stamp"),
      lanes: [
        cheapGates(120 * SECOND),
        lane("publish:03-pr-provenance-stamp", "publish:pr-provenance-stamp", "failed", O.some(2 * SECOND)),
        attached("failed", 300 * SECOND),
      ],
    }),
    "red",
    "red",
    O.some("publish:03-pr-provenance-stamp"),
    "a lane that is not a wait failed too: a local red"
  ),
];

// Verify controls with no monitor lane: red, interrupted, then green.
const VERIFY: ReadonlyArray<Adjudicated> = [
  adjudicate(
    attempt("verify-red", 0, 600 * SECOND, {
      mode: O.some("verify"),
      lanes: [
        lane("full:01-pre-push", "full:01-pre-push", "failed", O.some(600 * SECOND)),
        lane(
          "quality:coverage",
          "quality:coverage",
          "failed",
          O.some(90 * SECOND),
          "inner",
          O.some("full:01-pre-push")
        ),
      ],
    }),
    "red",
    "red",
    O.some("quality:coverage"),
    "a failed inner lane, unchanged"
  ),
  adjudicate(
    terminatedAttempt("verify-interrupted", "verify", O.some("interrupted"), 15 * MINUTE, 120 * SECOND),
    "terminated",
    "terminated",
    O.none(),
    "a local termination, unchanged"
  ),
  adjudicate(
    attempt("verify-green", 30 * MINUTE, 500 * SECOND, {
      mode: O.some("verify"),
      outcome: O.some("success"),
      failureKind: O.none(),
      lanes: [lane("full:01-pre-push", "full:01-pre-push", "passed", O.some(500 * SECOND))],
    }),
    "green",
    "green",
    O.none(),
    "a green, unchanged"
  ),
];

// A step exit with no recorded lane (an older verdict) cannot be the wait's.
const REPAIR: ReadonlyArray<Adjudicated> = [
  adjudicate(
    attempt("repair-unlaned-step-exit", 0, MINUTE, {
      mode: O.some("repair"),
      failedStepId: O.some("full:00-cheap-gates"),
    }),
    "red",
    "red",
    O.some("full:00-cheap-gates"),
    "a step exit with no failed lane recorded stays red"
  ),
];

const emptyDiagnostics = EconomicsJournalDiagnostics.make({
  journalsObserved: 1,
  unreadableJournals: 0,
  invalidRows: 0,
  compactionReceipts: 0,
  duplicateStartedRowsDeduplicated: 0,
  duplicateFinishedRowsDeduplicated: 0,
  orphanVerdictFilesAdded: 0,
  unkeyedVerdictFiles: 0,
  starts: 0,
  startsWithoutFinish: 0,
  verdictsWithoutStart: 0,
});

const journal = (runId: string, entries: ReadonlyArray<Adjudicated>): EconomicsJournal =>
  EconomicsJournal.make({
    checkout: "beep-effect",
    runId,
    cutoff: O.none(),
    attempts: A.map(entries, (entry) => EconomicsAttempt.make({ ...entry.attempt, runId })),
    diagnostics: emptyDiagnostics,
  });

const ADJUDICATED = [...MONITOR_RUNS, ...PUBLISH_ATTACHED, ...PUBLISH_OPEN, ...VERIFY, ...REPAIR];

const report = buildYeetEconomicsReport(
  [
    journal("run-monitor", MONITOR_RUNS),
    journal("run-publish-attached", PUBLISH_ATTACHED),
    journal("run-publish-open", PUBLISH_OPEN),
    journal("run-verify", VERIFY),
    journal("run-repair", REPAIR),
  ],
  EconomicsScope.make({ kind: "fleet", checkouts: ["beep-effect"], branch: O.none() }),
  NOW,
  []
);

const sumCounts = (rows: ReadonlyArray<{ readonly count: number }>): number =>
  Num.sumAll(A.map(rows, (row) => row.count));

describe("yeet economics monitor wait", () => {
  it("classes every adjudicated attempt, and only ever moves a recorded class to monitor", () => {
    deepStrictEqual(
      A.map(ADJUDICATED, (entry) => [entry.attempt.attemptId, economicsAttemptClass(entry.attempt)]),
      A.map(ADJUDICATED, (entry) => [entry.attempt.attemptId, entry.attemptClass])
    );
    expect(
      A.filter(ADJUDICATED, (entry) => entry.attemptClass !== entry.recorded && entry.attemptClass !== "monitor")
    ).toEqual([]);
  });

  it("keeps the classes a partition and the red mixes equal to the red count", () => {
    // v3 recorded 3 green, 9 red and 2 terminated; v4 moves one green, three reds
    // and one termination to monitor.
    expect(report.attempts.all.classMix).toEqual([
      { key: "red", count: 7 },
      { key: "monitor", count: 5 },
      { key: "green", count: 2 },
      { key: "terminated", count: 1 },
    ]);
    expect(sumCounts(report.attempts.all.classMix)).toBe(A.length(ADJUDICATED));
    expect(report.attempts.comparable.classMix).toEqual([
      { key: "red", count: 4 },
      { key: "green", count: 2 },
      { key: "monitor", count: 2 },
      { key: "terminated", count: 1 },
    ]);
    const failure = report.firstFailure;
    expect(failure.redAttempts).toBe(7);
    expect(sumCounts(failure.actionableLaneMix)).toBe(failure.redAttempts);
    expect(sumCounts(failure.receiptProxyMix)).toBe(failure.redAttempts);
    expect(failure.actionableLaneMix).toEqual(
      economicsCountMix(A.getSomes(A.map(ADJUDICATED, (entry) => entry.actionable)))
    );
    expect(report.attempts.all.failureKindMix).toEqual([
      { key: "step-exit", count: 5 },
      { key: "handler-error", count: 1 },
      { key: "unknown", count: 1 },
    ]);
  });

  it("measures each mode's local work: elapsed less the monitor wait, cut-off attempts beside it", () => {
    deepStrictEqual(
      A.map(report.modeDurations, (row) => [
        row.mode,
        row.attempts,
        row.redAttempts,
        row.terminatedAttempts,
        row.monitorAttempts,
        row.measuredAttempts,
        row.p50ElapsedMs,
        row.p95ElapsedMs,
      ]),
      [
        // Monitor runs: the overhead around the watch (1, 2, 2 and 2 s) and the 30 s
        // unrecorded red; the interrupted wait is counted beside the sample.
        ["monitor", 6, 3, 0, 3, 5, O.some(2 * SECOND), O.some(30 * SECOND)],
        // Publishes: 120.4, 122, 190, 250 and 301 s, never the 5 to 40 minutes waited.
        ["publish", 5, 2, 0, 2, 5, O.some(190 * SECOND), O.some(301 * SECOND)],
        ["verify", 3, 1, 1, 0, 2, O.some(500 * SECOND), O.some(600 * SECOND)],
        ["repair", 1, 1, 0, 0, 1, O.some(MINUTE), O.some(MINUTE)],
      ]
    );
    const greenOf = (mode: string): number =>
      A.countBy(ADJUDICATED, (entry) => O.contains(entry.attempt.mode, mode) && entry.attemptClass === "green");
    deepStrictEqual(
      A.map(
        report.modeDurations,
        (row) => row.redAttempts + row.terminatedAttempts + row.monitorAttempts + greenOf(row.mode)
      ),
      A.map(report.modeDurations, (row) => row.attempts)
    );
  });

  it("reports the waits as their own row and keeps their lanes out of both populations", () => {
    const wait = report.monitorWait;
    // Walls 300, 600, 900, 1,200, 1,500, 1,800 and 2,400 s; four waits ended failed.
    expect([wait.attempts, wait.failedAttempts, wait.totalWallMs]).toEqual([7, 4, 8_700 * SECOND]);
    assertSome(wait.p50WallMs, 1_200 * SECOND);
    assertSome(wait.p95WallMs, 2_400 * SECOND);
    expect(wait.modeMix).toEqual([
      { key: "publish", count: 4 },
      { key: "monitor", count: 3 },
    ]);
    const wrappers = report.wrapperLanes;
    expect(
      A.some(wrappers.rows, (row) => row.id === WATCH || Str.Equivalence(row.label, "monitor:until-ready:attached"))
    ).toBe(false);
    expect(
      A.map(
        A.filter(wrappers.rows, (row) => row.id === READY),
        (row) => row.label
      )
    ).toEqual(["monitor:until-ready:submit"]);
    // Lane time 2,084.9 s over the contributing attempts' local work, 2,090.4 s.
    expect([wrappers.executions, wrappers.totalDurationMs, wrappers.attemptElapsedMs]).toEqual([
      16, 2_084_900, 2_090_400,
    ]);
    assertSome(wrappers.accountedPct, 99.74);
    expect([report.innerLanes.totalDurationMs, report.innerLanes.attemptElapsedMs]).toEqual([
      90 * SECOND,
      600 * SECOND,
    ]);
  });

  it("leaves the M1 walk alone and splits an open streak three ways", () => {
    const { comparable24h, uncut } = report.redToGreen;
    // The attached red then green (5,050 s) and the verify red, termination and green
    // (2,300 s) close two episodes, as in v3.
    expect(comparable24h.closedEpisodes).toBe(2);
    assertSome(comparable24h.p50Ms, 2_300 * SECOND);
    assertSome(comparable24h.p95Ms, 5_050 * SECOND);
    // Open: the three publishes (red, monitor, red) and the lone repair red.
    expect([
      uncut.rightCensoredStreaks,
      uncut.rightCensoredRedAttempts,
      uncut.rightCensoredTerminatedAttempts,
      uncut.rightCensoredMonitorAttempts,
    ]).toEqual([2, 3, 0, 1]);
    const text = renderYeetEconomicsReport(report);
    const lines = [
      "  classes (terminations and monitor-decided attempts apart from reds): red 7, monitor 5, green 2, terminated 1;",
      "  publish: 5 attempt(s), 2 red, 0 terminated, 2 monitor-decided; 5 measured, p50 3.2m, p95 5.0m",
      "monitor waits (hosted CI; outside local work and the lane populations): 7 attempt(s), 4 ended failed; wall p50 20.0m, p95 40.0m, total 2.42h; modes: publish 4, monitor 3",
      "first failure (M2): 7 red attempt(s) (1 terminated and 5 monitor-decided, counted apart),",
      "right 2 streak(s) (3 red, 0 terminated and 1 monitor-decided attempt(s),",
    ];
    expect(A.filter(lines, (line) => !Str.includes(line)(text))).toEqual([]);
  });
});
