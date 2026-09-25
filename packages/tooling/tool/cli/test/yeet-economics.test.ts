import { QualityTaskLaneRun, QualityTaskLaneRunReport } from "@beep/repo-cli/test/Quality";
import { JsonStringCodec, nearestRank } from "@beep/repo-cli/test/SharedInternals";
import {
  BuildYeetVerdictInput,
  buildYeetEconomicsReport,
  buildYeetVerdictForTesting,
  EconomicsAttempt,
  EconomicsJournal,
  EconomicsJournalDiagnostics,
  EconomicsLane,
  EconomicsScope,
  EconomicsScopeRequest,
  printYeetEconomicsCloseoutSummary,
  RepoPlanStep,
  RepoStepRunResult,
  renderYeetEconomicsCloseoutSummary,
  renderYeetEconomicsReport,
  repoRunArtifactId,
  runYeetEconomics,
  runYeetEconomicsCommand,
  YEET_ECONOMICS_OFFSET_METHOD,
  YeetAttemptFinished,
  YeetAttemptJournalCompacted,
  YeetAttemptJournalEvent,
  YeetAttemptStarted,
  YeetAttemptTerminated,
  YeetEconomicsError,
  YeetEconomicsOptions,
  YeetEconomicsReportJson,
  YeetEconomicsSource,
  YeetExecutedStep,
  YeetVerdict,
  YeetVerdictJson,
  YeetVerdictLane,
} from "@beep/repo-cli/test/Yeet";
import { NonNegativeInt } from "@beep/schema";
import { UUID } from "@beep/schema/String";
import { fcRuns } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { DateTime, Effect, FileSystem, Layer, Order, Path } from "effect";
import * as A from "effect/Array";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import type { YeetEconomicsReport, YeetEconomicsSourceShape } from "@beep/repo-cli/test/Yeet";

const BASE_MS = DateTime.toEpochMillis(DateTime.makeUnsafe("2026-09-25T00:00:00.000Z"));
const NOW = DateTime.makeUnsafe("2026-09-26T00:00:00.000Z");
const MINUTE = 60_000;
const DAY_MINUTES = 24 * 60;
const PACKET_DIR = ".beep/yeet";
const at = (minutes: number): string => DateTime.formatIso(DateTime.makeUnsafe(BASE_MS + minutes * MINUTE));

const LiveSource = Layer.provideMerge(YeetEconomicsSource.layer, NodeServices.layer);
const LiveSourceWithConsole = Layer.mergeAll(LiveSource, TestConsole.layer);
const JournalEventJson = JsonStringCodec(YeetAttemptJournalEvent);

const id = (suffix: string): UUID => UUID.make(`7c9f5b1e-2d4a-4f6b-9a8c-${Str.padStart(12, "0")(suffix)}`);

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

const scope = EconomicsScope.make({ kind: "checkout", checkouts: ["beep-effect3"], branch: O.none() });

const lane = (
  laneId: string,
  status: EconomicsLane["status"],
  durationMs: O.Option<number>,
  population: EconomicsLane["population"],
  repairCommand: O.Option<string> = O.none()
): EconomicsLane =>
  EconomicsLane.make({ id: laneId, label: laneId, phase: "full", status, durationMs, repairCommand, population });

const attempt = (overrides: Partial<Parameters<typeof EconomicsAttempt.make>[0]>): EconomicsAttempt =>
  EconomicsAttempt.make({
    checkout: "beep-effect3",
    runId: "run-1",
    attemptId: "a",
    branch: "feat/economics",
    mode: O.some("verify"),
    outcome: O.some("success"),
    failureKind: O.none(),
    failedStepId: O.none(),
    message: "",
    startedAt: O.some(at(0)),
    endedAt: O.some(at(10)),
    elapsedMs: O.some(10 * MINUTE),
    diffFingerprint: O.none(),
    terminationReason: O.none(),
    verdictSchemaVersion: O.some("yeet-verdict/v2"),
    lanes: [],
    ...overrides,
  });

// A red attempt that ran from `start` to `end` minutes past the base instant.
const red = (
  attemptId: string,
  start: number,
  end: number,
  overrides: Partial<Parameters<typeof EconomicsAttempt.make>[0]> = {}
) =>
  attempt({
    attemptId,
    outcome: O.some("failure"),
    failureKind: O.some("step-exit"),
    startedAt: O.some(at(start)),
    endedAt: O.some(at(end)),
    elapsedMs: O.some((end - start) * MINUTE),
    ...overrides,
  });

const green = (
  attemptId: string,
  start: number,
  end: number,
  overrides: Partial<Parameters<typeof EconomicsAttempt.make>[0]> = {}
) =>
  attempt({
    attemptId,
    startedAt: O.some(at(start)),
    endedAt: O.some(at(end)),
    elapsedMs: O.some((end - start) * MINUTE),
    ...overrides,
  });

const journal = (
  runId: string,
  attempts: ReadonlyArray<EconomicsAttempt>,
  overrides: Partial<Parameters<typeof EconomicsJournal.make>[0]> = {}
): EconomicsJournal =>
  EconomicsJournal.make({
    checkout: "beep-effect3",
    runId,
    cutoff: O.none(),
    attempts: A.map(attempts, (entry) => EconomicsAttempt.make({ ...entry, runId })),
    diagnostics: emptyDiagnostics,
    ...overrides,
  });

const report = (journals: ReadonlyArray<EconomicsJournal>): YeetEconomicsReport =>
  buildYeetEconomicsReport(journals, scope, NOW);

const verdict = (
  attemptId: O.Option<UUID>,
  overrides: Partial<Parameters<typeof YeetVerdict.make>[0]> = {}
): YeetVerdict =>
  YeetVerdict.make({
    schemaVersion: "yeet-verdict/v2",
    attemptId,
    base: "origin/main",
    branch: "feat/economics",
    committed: false,
    createdAt: at(10),
    startedAt: O.some(at(0)),
    endedAt: O.some(at(10)),
    elapsedMs: O.some(10 * MINUTE),
    head: "HEAD",
    lanes: [],
    message: "yeet verification proof passed.",
    mode: "verify",
    outcome: "success",
    packetPaths: [],
    pushed: false,
    runId: "feat/economics",
    ...overrides,
  });

const started = (attemptId: UUID, minutes = 0): YeetAttemptStarted =>
  YeetAttemptStarted.make({
    schemaVersion: "yeet-attempt-journal/v1",
    _tag: "attempt-started",
    attemptId,
    runId: "run",
    branch: "feat/economics",
    base: "origin/main",
    head: "HEAD",
    mode: "verify",
    startedAt: at(minutes),
  });

const finished = (attemptId: UUID, entry: YeetVerdict): YeetAttemptFinished =>
  YeetAttemptFinished.make({
    schemaVersion: "yeet-attempt-journal/v1",
    _tag: "attempt-finished",
    attemptId,
    recordedAt: at(10),
    verdict: entry,
  });

const terminated = (
  attemptId: UUID,
  reason: YeetAttemptTerminated["reason"],
  recordedMinutes = 5
): YeetAttemptTerminated =>
  YeetAttemptTerminated.make({
    schemaVersion: "yeet-attempt-journal/v1",
    _tag: "attempt-terminated",
    attemptId,
    recordedAt: at(recordedMinutes),
    reason,
  });

const runDirectory = Effect.fn("EconomicsTest.runDirectory")(function* (
  checkoutRoot: string,
  runId: string,
  packetDir = PACKET_DIR
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.join(checkoutRoot, packetDir, "runs", runId);
  yield* fs.makeDirectory(directory, { recursive: true });
  return directory;
});

const writeJournal = Effect.fn("EconomicsTest.writeJournal")(function* (
  checkoutRoot: string,
  runId: string,
  rows: ReadonlyArray<YeetAttemptJournalEvent | string>,
  trailer = "\n",
  packetDir = PACKET_DIR
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* runDirectory(checkoutRoot, runId, packetDir);
  const lines = yield* Effect.forEach(rows, (row) =>
    Str.isString(row) ? Effect.succeed(row) : JournalEventJson.encode(row)
  );
  yield* fs.writeFileString(path.join(directory, "attempts.ndjson"), `${A.join(lines, "\n")}${trailer}`);
});

const writeVerdict = Effect.fn("EconomicsTest.writeVerdict")(function* (
  checkoutRoot: string,
  runId: string,
  entry: YeetVerdict
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* runDirectory(checkoutRoot, runId);
  yield* fs.writeFileString(path.join(directory, "verdict.json"), yield* YeetVerdictJson.encode(entry));
});

const readScope = Effect.fn("EconomicsTest.readScope")(function* (
  repoRoot: string,
  options: { readonly branch?: string; readonly fleet?: boolean; readonly packetDir?: string } = {}
) {
  const source = yield* YeetEconomicsSource;
  return yield* source.read(
    EconomicsScopeRequest.make({
      repoRoot,
      branch: O.fromUndefinedOr(options.branch),
      fleet: options.fleet ?? false,
      packetDir: options.packetDir ?? PACKET_DIR,
    })
  );
});

const shareTotal = (rows: YeetEconomicsReport["wrapperLanes"]["rows"]): number =>
  Num.sumAll(A.map(rows, (row) => O.getOrElse(row.sharePct, () => 0)));

const failingSource = (read: YeetEconomicsSourceShape["read"]) =>
  Layer.mergeAll(Layer.succeed(YeetEconomicsSource, YeetEconomicsSource.of({ read })), TestConsole.layer);

it.layer(LiveSource, { timeout: "30 seconds" })("yeet economics loader", (layerIt) => {
  layerIt.effect("counts every row kind, deduplicates repeats, and keys orphan verdicts", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "economics-loader-" });
      const compacted = YeetAttemptJournalCompacted.make({
        schemaVersion: "yeet-attempt-journal/v1",
        _tag: "journal-compacted",
        recordedAt: at(-5),
        evictedCount: NonNegativeInt.make(1),
        oldestEvictedRecordedAt: at(-20),
        terminalEvictionCutoffRecordedAt: O.some(at(-10)),
      });
      yield* writeJournal(
        root,
        "run-a",
        [
          compacted,
          YeetAttemptJournalCompacted.make({
            ...compacted,
            terminalEvictionCutoffRecordedAt: O.none(),
            oldestEvictedRecordedAt: at(-30),
          }),
          '{"schemaVersion":"yeet-attempt-journal/v1","_tag":"journal-compacted","oldestEvictedRecordedAt":"not-a-date"}',
          started(id("1")),
          started(id("1")),
          finished(id("1"), verdict(O.some(id("1")))),
          started(id("2")),
          terminated(id("2"), "interrupted"),
          terminated(id("2"), "interrupted"),
          started(id("3")),
          terminated(id("5"), "signal"),
          "not-json",
          '{"schemaVersion":"yeet-attempt-journal/v0","_tag":"attempt-started","attemptId":"x"}',
          '{"schemaVersion":',
        ],
        ""
      );
      // An orphan verdict for an attempt with no terminal row synthesizes one.
      yield* writeVerdict(root, "run-a", verdict(O.some(id("4")), { outcome: "failure", endedAt: O.none() }));
      // A run whose journal is unreadable and whose verdict has no attempt id.
      const unreadable = yield* runDirectory(root, "run-b");
      yield* fs.makeDirectory(path.join(unreadable, "attempts.ndjson"));
      yield* writeVerdict(root, "run-b", verdict(O.none()));
      // A symlinked journal is refused by the no-follow reader and counts as unreadable.
      const linked = yield* runDirectory(root, "run-c");
      yield* fs.writeFileString(path.join(root, "elsewhere.ndjson"), "");
      yield* fs.symlink(path.join(root, "elsewhere.ndjson"), path.join(linked, "attempts.ndjson"));

      const journals = yield* readScope(root);
      const runA = A.findFirst(journals, (entry) => entry.runId === "run-a");
      assertSome(
        O.flatMap(runA, (entry) => entry.cutoff),
        at(-10)
      );
      // A terminal row with neither a verdict nor a start falls back to the run id for its branch.
      assertSome(
        O.map(
          A.findFirst(
            A.flatMap(journals, (entry) => entry.attempts),
            (entry) => entry.attemptId === id("5")
          ),
          (entry) => entry.branch
        ),
        "run-a"
      );
      const economics = report(journals);
      expect(economics.dataQuality.diagnostics).toMatchObject({
        journalsObserved: 1,
        unreadableJournals: 2,
        invalidRows: 2,
        compactionReceipts: 3,
        leftCensoredJournals: 1,
        duplicateStartedRowsDeduplicated: 1,
        duplicateFinishedRowsDeduplicated: 1,
        orphanVerdictFilesAdded: 1,
        unkeyedVerdictFiles: 1,
        starts: 3,
        finishedAttempts: 4,
        startsWithoutFinish: 1,
        verdictsWithoutStart: 2,
        verdictV2Attempts: 2,
        verdictOtherAttempts: 2,
      });
      expect(economics.terminations.reasonMix).toEqual([
        { key: "interrupted", count: 1 },
        { key: "signal", count: 1 },
      ]);
      expect(economics.attempts.all.outcomeMix).toEqual([
        { key: "unknown", count: 2 },
        { key: "failure", count: 1 },
        { key: "success", count: 1 },
      ]);
    })
  );

  layerIt.effect("fails a checkout without run directories and reads an empty run as nothing", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "economics-empty-" });
      const failure = yield* Effect.flip(readScope(root));
      expect(failure).toBeInstanceOf(YeetEconomicsError);
      expect(failure.reason).toBe("no-runs-directory");
      yield* runDirectory(root, "run-empty");
      expect(yield* readScope(root)).toEqual([]);
    })
  );

  layerIt.effect("skips stray files and symlinked run directories without a diagnostic", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "economics-stray-" });
      yield* writeJournal(root, "run-real", [started(id("81")), finished(id("81"), verdict(O.some(id("81"))))]);
      const runs = path.join(root, PACKET_DIR, "runs");
      yield* fs.writeFileString(path.join(runs, "stray.lock"), "");
      const elsewhere = path.join(root, "elsewhere-run");
      yield* fs.makeDirectory(elsewhere);
      yield* fs.writeFileString(path.join(elsewhere, "attempts.ndjson"), "");
      yield* fs.symlink(elsewhere, path.join(runs, "linked-run"));

      const journals = yield* readScope(root);
      expect(A.map(journals, (entry) => entry.runId)).toEqual(["run-real"]);
      expect(report(journals).dataQuality.diagnostics).toMatchObject({
        journalsObserved: 1,
        unreadableJournals: 0,
        invalidRows: 0,
        unkeyedVerdictFiles: 0,
        orphanVerdictFilesAdded: 0,
      });
    })
  );

  layerIt.effect("counts a guard-refused journal once and a missing verdict behind it as nothing", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "economics-linked-runs-" });
      // The runs directory itself is a symlink: the no-follow reader refuses every file under it.
      yield* writeJournal(root, "run-x", [started(id("85")), finished(id("85"), verdict(O.some(id("85"))))]);
      const runs = path.join(root, PACKET_DIR, "runs");
      yield* fs.rename(runs, path.join(root, "real-runs"));
      yield* fs.symlink(path.join(root, "real-runs"), runs);
      const journals = yield* readScope(root);
      expect(A.map(journals, (entry) => entry.runId)).toEqual(["run-x"]);
      expect(report(journals).dataQuality.diagnostics).toMatchObject({
        journalsObserved: 0,
        unreadableJournals: 1,
        unkeyedVerdictFiles: 0,
        orphanVerdictFilesAdded: 0,
      });
    })
  );

  layerIt.effect("counts a complete row that fails the projection at an unterminated end", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "economics-torn-" });
      yield* writeJournal(
        root,
        "run-complete-tail",
        [
          started(id("82")),
          '{"schemaVersion":"yeet-attempt-journal/v1","_tag":"attempt-terminated","attemptId":"a","reason":"bogus"}',
        ],
        ""
      );
      yield* writeJournal(root, "run-torn-tail", [started(id("83")), '{"schemaVersion":"yeet-attem'], "");
      const journals = yield* readScope(root);
      expect(A.map(journals, (entry) => [entry.runId, entry.diagnostics.invalidRows])).toEqual([
        ["run-complete-tail", 1],
        ["run-torn-tail", 0],
      ]);
    })
  );

  layerIt.effect("lets a live terminal row win over the run's verdict file", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "economics-verdict-" });
      yield* writeJournal(root, "run-v", [
        started(id("84")),
        finished(id("84"), verdict(O.some(id("84")), { outcome: "success" })),
      ]);
      yield* writeVerdict(root, "run-v", verdict(O.some(id("84")), { outcome: "failure" }));
      const economics = report(yield* readScope(root));
      expect(economics.dataQuality.diagnostics.orphanVerdictFilesAdded).toBe(0);
      expect(economics.attempts.all.outcomeMix).toEqual([{ key: "success", count: 1 }]);
    })
  );

  layerIt.effect("measures no elapsed time for a reconciler-stamped termination", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "economics-elapsed-" });
      const greenAfterRed = (attemptId: UUID) =>
        finished(
          attemptId,
          verdict(O.some(attemptId), {
            startedAt: O.some(at(25)),
            endedAt: O.some(at(35)),
            lanes: [
              YeetVerdictLane.make({
                id: "full:01-pre-push",
                label: "full:pre-push",
                phase: "full",
                status: "passed",
                durationMs: 6 * MINUTE,
              }),
            ],
          })
        );
      yield* writeJournal(root, "run-legacy", [
        started(id("91")),
        terminated(id("91"), "legacy-unowned-start", 11 * DAY_MINUTES),
        started(id("92"), 25),
        greenAfterRed(id("92")),
      ]);
      yield* writeJournal(root, "run-interrupted", [
        started(id("93")),
        terminated(id("93"), "interrupted", 5),
        started(id("94"), 25),
        greenAfterRed(id("94")),
      ]);
      const journals = yield* readScope(root);
      const elapsedOf = (attemptId: UUID) =>
        O.flatMap(
          A.findFirst(
            A.flatMap(journals, (entry) => entry.attempts),
            (entry) => entry.attemptId === attemptId
          ),
          (entry) => entry.elapsedMs
        );
      assertNone(elapsedOf(id("91")));
      assertSome(elapsedOf(id("93")), 5 * MINUTE);
      const byRun = (runId: string) => report(A.filter(journals, (entry) => entry.runId === runId));
      const legacy = byRun("run-legacy");
      const interrupted = byRun("run-interrupted");
      expect(legacy.wrapperLanes.attemptElapsedMs).toBe(10 * MINUTE);
      expect(interrupted.wrapperLanes.attemptElapsedMs).toBe(10 * MINUTE);
      expect(legacy.redToGreen.uncut).toMatchObject({ totalEpisodeSpanMinutes: 35, measuredAttemptMachineMinutes: 10 });
      expect(interrupted.redToGreen.uncut).toMatchObject({
        totalEpisodeSpanMinutes: 35,
        measuredAttemptMachineMinutes: 15,
      });
    })
  );
});

it.layer(LiveSource, { timeout: "30 seconds" })("yeet economics lane populations", (layerIt) => {
  layerIt.effect("splits post-A5 verdicts by parentLaneId and legacy verdicts by prefix, never summing the two", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "economics-lanes-" });
      const step = RepoPlanStep.make({
        id: "full:01-pre-push",
        label: "full:pre-push",
        phase: "full",
        command: "bun",
        args: ["run", "beep", "quality", "github-checks", "pre-push"],
        cwd: "/repo",
        scope: "repo",
        mutability: "readonly",
        resume: "never",
      });
      // An executed outer step outside the wrapper prefixes: only `parentLaneId`
      // tells it from an inner lane.
      const audit = RepoPlanStep.make({
        id: "fallow:audit",
        label: "fallow:audit",
        phase: "feedback",
        command: "bun",
        args: ["run", "beep", "fallow", "audit"],
        cwd: "/repo",
        scope: "repo",
        mutability: "readonly",
        resume: "never",
      });
      const innerRun = (laneId: string, status: QualityTaskLaneRun["status"], durationMs: number) =>
        QualityTaskLaneRun.make({
          id: laneId,
          label: laneId,
          status,
          durationMs: O.some(durationMs),
          inputDigest: O.none(),
        });
      const postA5 = buildYeetVerdictForTesting(
        BuildYeetVerdictInput.make({
          attemptId: O.some(id("10")),
          base: "origin/main",
          branch: "feat/economics",
          createdAt: at(10),
          startedAt: O.some(at(0)),
          endedAt: O.some(at(10)),
          elapsedMs: O.some(10 * MINUTE),
          executed: [
            YeetExecutedStep.make({
              result: RepoStepRunResult.make({
                stepId: audit.id,
                commandText: "bun run beep fallow audit",
                exitCode: 0,
                elapsedMs: 1_000,
              }),
              step: audit,
            }),
            YeetExecutedStep.make({
              result: RepoStepRunResult.make({
                stepId: step.id,
                commandText: "bun run beep quality github-checks pre-push",
                exitCode: 1,
                elapsedMs: 6_000,
              }),
              step,
            }),
          ],
          innerLaneReports: [
            QualityTaskLaneRunReport.make({
              schemaVersion: "quality-task-lane-run/v1",
              parentLaneId: O.some(step.id),
              lanes: [innerRun("quality:security", "passed", 2_000), innerRun("quality:coverage", "failed", 4_000)],
            }),
          ],
          head: "HEAD",
          message: "yeet verification proof failed.",
          mode: "verify",
          outcome: "failure",
          packetPaths: [],
          planned: [audit, step],
          runId: "feat/economics",
        })
      );
      const innerLanes = A.filter(postA5.lanes, (entry) => entry.id !== step.id && entry.id !== audit.id);
      expect(A.map(innerLanes, (entry) => entry.parentLaneId)).toEqual([step.id, step.id]);
      const legacy = verdict(O.some(id("11")), {
        lanes: [
          YeetVerdictLane.make({
            id: "full:00-cheap-gates",
            label: "full:cheap-gates",
            phase: "full",
            status: "passed",
            durationMs: 2_000,
          }),
          YeetVerdictLane.make({
            id: "quality:lint",
            label: "quality:lint",
            phase: "full",
            status: "passed",
            durationMs: 2_000,
          }),
        ],
      });
      // An attempt with only wrapper lanes never enters the inner denominator.
      const wrapperOnly = verdict(O.some(id("12")), {
        lanes: [
          YeetVerdictLane.make({
            id: "full:00-cheap-gates",
            label: "full:cheap-gates",
            phase: "full",
            status: "passed",
            durationMs: 2_000,
          }),
        ],
      });
      yield* writeJournal(root, "run-lanes", [
        finished(id("10"), postA5),
        finished(id("11"), legacy),
        finished(id("12"), wrapperOnly),
      ]);

      const economics = report(yield* readScope(root));
      expect(A.map(economics.wrapperLanes.rows, (row) => [row.id, row.totalDurationMs])).toEqual([
        ["full:01-pre-push", 6_000],
        ["full:00-cheap-gates", 4_000],
        ["fallow:audit", 1_000],
      ]);
      expect(A.map(economics.innerLanes.rows, (row) => [row.id, row.totalDurationMs])).toEqual([
        ["quality:coverage", 4_000],
        ["quality:lint", 2_000],
        ["quality:security", 2_000],
      ]);
      expect(shareTotal(economics.wrapperLanes.rows)).toBe(100);
      expect(shareTotal(economics.innerLanes.rows)).toBe(100);
      // The A1 script sums both populations into one 19 000 ms denominator.
      expect(economics.wrapperLanes.totalDurationMs).toBe(11_000);
      expect(economics.innerLanes.totalDurationMs).toBe(8_000);
      expect(economics.wrapperLanes.attemptElapsedMs).toBe(30 * MINUTE);
      expect(economics.innerLanes.attemptElapsedMs).toBe(20 * MINUTE);
      assertSome(economics.wrapperLanes.accountedPct, 0.61);
      assertSome(economics.innerLanes.accountedPct, 0.67);
      expect(economics.innerLanes.rows[0]?.statusMix).toEqual([{ key: "failed", count: 1 }]);
    })
  );
});

describe("yeet economics first failure", () => {
  // One red attempt's first failure, reported alone.
  const firstFailureOf = (lanes: ReadonlyArray<EconomicsLane>) =>
    report([journal("run-1", [red("red", 0, 10, { lanes })])]).firstFailure;
  const inner = (laneId: string, status: EconomicsLane["status"], durationMs: number, parent: string) =>
    EconomicsLane.make({ ...lane(laneId, status, O.some(durationMs), "inner"), parentLaneId: O.some(parent) });

  it("walks the wrappers before the failing lane's parent, then its siblings before it", () => {
    // Legacy verdict: the parent is the first failed timed wrapper.
    const legacyInner = firstFailureOf([
      lane("full:00-cheap-gates", "passed", O.some(3_000), "wrapper"),
      lane("full:01-pre-push", "failed", O.some(5_000), "wrapper"),
      lane("quality:security", "passed", O.some(700), "inner"),
      lane("quality:coverage", "failed", O.some(300), "inner"),
      lane("quality:osv", "failed", O.some(200), "inner"),
    ]);
    assertSome(legacyInner.startOffsetP50Ms, 3_700);
    assertSome(legacyInner.completionOffsetP50Ms, 4_000);
    // Legacy verdict with two wrappers where the second failed and its inner lanes carry durations.
    const legacySecond = firstFailureOf([
      lane("full:00-cheap-gates", "passed", O.some(1_000), "wrapper"),
      lane("full:01-pre-push", "failed", O.some(6_000), "wrapper"),
      lane("quality:lint", "passed", O.some(2_000), "inner"),
      lane("quality:coverage", "failed", O.some(1_500), "inner"),
    ]);
    assertSome(legacySecond.startOffsetP50Ms, 3_000);
    assertSome(legacySecond.completionOffsetP50Ms, 4_500);
    // Post-A5 verdict: `parentLaneId` picks the parent and its siblings; another wrapper's inner lane is not one.
    const postA5 = firstFailureOf([
      lane("full:00-cheap-gates", "passed", O.some(2_000), "wrapper"),
      lane("full:01-pre-push", "failed", O.some(8_000), "wrapper"),
      inner("quality:lint", "passed", 500, "full:00-cheap-gates"),
      inner("quality:security", "passed", 700, "full:01-pre-push"),
      inner("quality:coverage", "failed", 300, "full:01-pre-push"),
    ]);
    assertSome(postA5.startOffsetP50Ms, 2_700);
    assertSome(postA5.completionOffsetP50Ms, 3_000);
    expect(postA5.actionableLaneMix).toEqual([{ key: "quality:coverage", count: 1 }]);
    expect(postA5.offsetMethod).toBe(YEET_ECONOMICS_OFFSET_METHOD);
  });

  it("falls back to the failed timed wrapper and leaves attempts without one unreconstructable", () => {
    const economics = report([
      journal("run-1", [
        red("wrapper-walk", 20, 30, {
          lanes: [
            lane("full:00-cheap-gates", "passed", O.some(1_000), "wrapper"),
            lane("full:01-pre-push", "failed", O.some(2_000), "wrapper"),
            lane("quality:security", "passed", O.some(500), "inner"),
          ],
        }),
        // The inner lane failed without a duration, so the timed failed wrapper carries the offset.
        red("durationless", 40, 50, {
          lanes: [
            lane("full:01-pre-push", "failed", O.some(9_000), "wrapper"),
            lane("quality:coverage", "failed", O.none(), "inner"),
          ],
        }),
        red("untimed", 55, 58, { lanes: [lane("full:01-pre-push", "failed", O.none(), "wrapper")] }),
        red("terminated", 60, 70, { outcome: O.none(), failureKind: O.none(), verdictSchemaVersion: O.none() }),
      ]),
    ]);
    const failure = economics.firstFailure;
    expect(failure).toMatchObject({
      redAttempts: 4,
      attemptsWithReconstructableOuterFailure: 2,
      attemptsWithoutReconstructableOuterFailure: 2,
    });
    assertSome(failure.startOffsetP50Ms, 0);
    assertSome(failure.startOffsetP95Ms, 1_000);
    assertSome(failure.completionOffsetP50Ms, 3_000);
    assertSome(failure.completionOffsetP95Ms, 9_000);
    expect(failure.actionableLaneMix).toEqual([
      { key: "full:01-pre-push", count: 2 },
      { key: "quality:coverage", count: 1 },
      { key: "unlocated", count: 1 },
    ]);
  });

  it("classifies each receipt proxy by its own sentinel", () => {
    const sentinels: ReadonlyArray<readonly [string, Partial<Parameters<typeof EconomicsAttempt.make>[0]>]> = [
      ["scheduler-lock-bounce", { message: "Another Yeet full proof for this repository is active." }],
      ["native-compiler-flake", { message: "error TS2589: Type instantiation is excessively deep" }],
      ["stale-workspace-or-projection", { message: "error TS2307: Cannot find module" }],
      ["base-churn", { message: "origin/main has advanced since the proof started" }],
      ["scheduler-or-submitter", { failedStepId: O.some("admission-wait") }],
      [
        "semantic-delta-path",
        { lanes: [lane("quality:goals", "failed", O.none(), "inner", O.some("Fix the Semantic Delta paths"))] },
      ],
      ["unclassified", { message: "lint failed" }],
    ];
    for (const [expected, overrides] of sentinels) {
      expect(report([journal("run-1", [red(expected, 0, 1, overrides)])]).firstFailure.receiptProxyMix).toEqual([
        { key: expected, count: 1 },
      ]);
    }
  });
});

describe("yeet economics red to green", () => {
  const bounce: Partial<Parameters<typeof EconomicsAttempt.make>[0]> = {
    failureKind: O.some("handler-error"),
    message: "Another Yeet full proof is active.",
  };

  it("closes, cuts, censors, and never spans two runs", () => {
    const economics = report([
      journal("run-1", [
        green("leading-green", -20, -15),
        red("lock-bounce", 5, 6, bounce),
        red("first-red", 10, 20),
        red("second-red", 30, 40),
        green("closing-green", 50, 60),
      ]),
      journal("run-2", [red("long-red", 0, 10), green("next-day", 1_490, 1_500)]),
      // The censored red starts exactly at the cutoff; the pair after it stays closed.
      journal(
        "run-3",
        [
          red("censored-red", 95, 97),
          green("censored-green", 100, 110),
          red("after-cutoff-red", 120, 125),
          green("after-cutoff-green", 130, 140),
        ],
        { cutoff: O.some(at(95)) }
      ),
      journal("run-4", [
        red("killed", 0, 5, { outcome: O.none(), failureKind: O.none(), terminationReason: O.some("signal") }),
        red("still-red", 10, 20),
      ]),
      journal("run-5", [red("lonely-red", 0, 5)]),
      journal("run-6", [green("other-run-green", 10, 20)]),
      // A green without an end time closes at its start.
      journal("run-7", [red("short-red", 0, 5), green("endless-green", 10, 20, { endedAt: O.none() })]),
    ]);
    const { comparable24h, uncut } = economics.redToGreen;
    expect(comparable24h).toMatchObject({
      closedEpisodes: 3,
      totalEpisodeSpanMinutes: 80,
      measuredAttemptMachineMinutes: 60,
      leftCensoredEpisodesExcluded: 1,
      leftCensoredObservedAttempts: 2,
      rightCensoredStreaks: 2,
      rightCensoredRedAttempts: 3,
      // run-4 is open from 0 to 20 minutes, run-5 from 0 to 5.
      rightCensoredObservedSpanMinutes: 25,
    });
    assertSome(comparable24h.p50Ms, 20 * MINUTE);
    assertSome(comparable24h.p95Ms, 50 * MINUTE);
    assertSome(comparable24h.closedEpisodesOver24hExcluded, 1);
    expect(uncut.closedEpisodes).toBe(4);
    expect(uncut.rightCensoredObservedSpanMinutes).toBe(25);
    assertSome(uncut.p50Ms, 20 * MINUTE);
    assertSome(uncut.p95Ms, 1_500 * MINUTE);
    assertNone(uncut.closedEpisodesOver24hExcluded);
    expect(economics.attempts.comparable.failureKindMix).toEqual([
      { key: "step-exit", count: 8 },
      { key: "unknown", count: 1 },
    ]);
  });
});

describe("yeet economics right-censored bound", () => {
  it("stops an open streak at its last member's last measured time", () => {
    const terminatedAs = (
      attemptId: string,
      reason: "legacy-unowned-start" | "interrupted",
      recordedMinutes: number
    ): EconomicsAttempt =>
      red(attemptId, 10, recordedMinutes, {
        outcome: O.none(),
        failureKind: O.none(),
        terminationReason: O.some(reason),
      });
    const openSpan = (last: EconomicsAttempt) =>
      report([journal("run-1", [red("first-red", 0, 5), last])]).redToGreen.uncut.rightCensoredObservedSpanMinutes;
    // A reconciler-stamped red recorded 11 days later counts only up to its start.
    expect(openSpan(terminatedAs("legacy", "legacy-unowned-start", 10 + 11 * DAY_MINUTES))).toBe(10);
    // A red terminated when it died counts up to its recordedAt.
    expect(openSpan(terminatedAs("interrupted", "interrupted", 15))).toBe(15);
  });
});

describe("yeet economics unchanged fingerprint", () => {
  it("counts a verdict red then green on the same fingerprint once, keyed by lane and proxy class", () => {
    const fingerprinted = report([
      journal("run-1", [
        red("r1", 0, 1, {
          diffFingerprint: O.some("f1"),
          message: "error TS2589: Type instantiation is excessively deep",
          lanes: [lane("quality:check", "failed", O.some(1_000), "inner")],
        }),
        green("g1", 2, 3, { diffFingerprint: O.some("f1") }),
        red("r2", 4, 5, { diffFingerprint: O.some("f2") }),
        green("g2", 6, 7, { diffFingerprint: O.some("f3") }),
      ]),
    ]);
    expect(fingerprinted.unchangedFingerprint).toMatchObject({
      classification: "measured",
      attemptsWithFingerprint: 4,
      failedUnchangedFingerprintThenGreen: 1,
      byActionableLane: [{ key: "quality:check", count: 1 }],
      byReceiptProxy: [{ key: "native-compiler-flake", count: 1 }],
    });
    const bare = report([journal("run-1", [red("r1", 0, 1), green("g1", 2, 3)])]);
    expect(bare.unchangedFingerprint).toMatchObject({
      classification: "unmeasurable",
      attemptsWithFingerprint: 0,
      failedUnchangedFingerprintThenGreen: 0,
      byActionableLane: [],
      byReceiptProxy: [],
    });
  });

  it("never counts an interrupted red or a closeout pair", () => {
    const economics = report([
      journal("run-1", [
        red("interrupted", 0, 1, {
          outcome: O.none(),
          failureKind: O.none(),
          terminationReason: O.some("interrupted"),
          diffFingerprint: O.some("f4"),
        }),
        green("after-interrupt", 2, 3, { diffFingerprint: O.some("f4") }),
      ]),
      journal("run-2", [
        red("closeout-red", 0, 1, { mode: O.some("closeout"), diffFingerprint: O.some("f5") }),
        green("closeout-green", 2, 3, { mode: O.some("closeout"), diffFingerprint: O.some("f5") }),
      ]),
    ]);
    expect(economics.unchangedFingerprint).toMatchObject({
      classification: "measured",
      attemptsWithFingerprint: 4,
      failedUnchangedFingerprintThenGreen: 0,
    });
  });
});

it.layer(LiveSource, { timeout: "30 seconds" })("yeet economics terminations", (layerIt) => {
  layerIt.effect("sorts termination reasons by count then reason and counts starts without a terminal row", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "economics-terminations-" });
      yield* writeJournal(root, "run-t", [
        started(id("21")),
        started(id("22")),
        started(id("23")),
        started(id("24")),
        started(id("25")),
        started(id("26")),
        terminated(id("21"), "signal"),
        terminated(id("22"), "interrupted"),
        terminated(id("23"), "signal"),
        terminated(id("24"), "interrupted"),
        terminated(id("25"), "oom-killed"),
      ]);
      yield* writeJournal(root, "run-u", [started(id("31")), terminated(id("31"), "legacy-unowned-start")]);
      const economics = report(yield* readScope(root));
      expect(economics.terminations).toMatchObject({ starts: 7, startsWithoutFinish: 1 });
      expect(economics.terminations.reasonMix).toEqual([
        { key: "interrupted", count: 2 },
        { key: "signal", count: 2 },
        { key: "legacy-unowned-start", count: 1 },
        { key: "oom-killed", count: 1 },
      ]);
    })
  );
});

describe("yeet economics document", () => {
  it.effect("round-trips the JSON codec and encodes an empty report with null percentiles", () =>
    Effect.gen(function* () {
      const empty = report([]);
      expect(empty.schemaVersion).toBe("yeet-economics/v1");
      expect(empty.dataQuality.diagnostics.finishedAttempts).toBe(0);
      assertNone(empty.redToGreen.comparable24h.p50Ms);
      assertNone(empty.wrapperLanes.accountedPct);
      assertNone(empty.innerLanes.accountedPct);
      assertNone(empty.firstFailure.completionOffsetP50Ms);
      assertNone(empty.dataQuality.attemptWindowStartUtc);
      const text = yield* YeetEconomicsReportJson.encode(empty);
      expect(Str.includes('"p50Ms":null')(text)).toBe(true);
      expect(Str.includes('"accountedPct":null')(text)).toBe(true);
      expect(yield* YeetEconomicsReportJson.decode(text)).toEqual(empty);
      // Lane rows, first-failure offsets and the M4 mixes all cross the codec.
      const populated = report([
        journal("run-1", [
          red("r", 0, 1, {
            diffFingerprint: O.some("f1"),
            lanes: [
              lane("full:01-pre-push", "failed", O.some(4_000), "wrapper"),
              lane("quality:coverage", "failed", O.some(1_500), "inner"),
            ],
          }),
          green("g", 2, 3, {
            diffFingerprint: O.some("f1"),
            lanes: [lane("full:01-pre-push", "passed", O.some(3_000), "wrapper")],
          }),
        ]),
      ]);
      expect(A.length(populated.wrapperLanes.rows)).toBe(1);
      expect(A.length(populated.innerLanes.rows)).toBe(1);
      assertSome(populated.firstFailure.completionOffsetP50Ms, 1_500);
      expect(populated.unchangedFingerprint.byActionableLane).toEqual([{ key: "quality:coverage", count: 1 }]);
      expect(yield* YeetEconomicsReportJson.decode(yield* YeetEconomicsReportJson.encode(populated))).toEqual(
        populated
      );
      const invalid = yield* Effect.flip(
        YeetEconomicsReportJson.decode(Str.replace('"yeet-economics/v1"', '"yeet-economics/v0"')(text))
      );
      expect(S.isSchemaError(invalid)).toBe(true);
    })
  );
});

it.layer(LiveSource, { timeout: "30 seconds" })("yeet economics scope", (layerIt) => {
  layerIt.effect("reads only the named branch's run directory", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "economics-branch-" });
      const runId = yield* repoRunArtifactId("feat/economics");
      yield* writeJournal(root, runId, [started(id("41")), finished(id("41"), verdict(O.some(id("41"))))]);
      yield* writeJournal(root, "other-run", [started(id("42")), finished(id("42"), verdict(O.some(id("42"))))]);
      const narrowed = yield* readScope(root, { branch: "feat/economics" });
      expect(A.map(narrowed, (entry) => entry.runId)).toEqual([runId]);
      expect(A.length(yield* readScope(root))).toBe(2);
    })
  );

  layerIt.effect("labels fleet checkouts by their path under the projects root and skips ones without runs", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const projects = yield* fs.makeTempDirectoryScoped({ prefix: "economics-fleet-" });
      const checkout = (relative: string) => path.join(projects, relative);
      const green41 = [started(id("51")), finished(id("51"), verdict(O.some(id("51"))))];
      yield* writeJournal(checkout("beep-effect7"), "run-clone", green41);
      yield* writeJournal(checkout("beep-effect-worktrees/lane-a"), "run-lane-a", green41);
      yield* writeJournal(checkout("beep-effect7-worktrees/lane-b"), "run-lane-b", green41);
      yield* writeJournal(checkout("other-repo"), "run-other", green41);
      yield* fs.makeDirectory(checkout("beep-effect9"), { recursive: true });
      yield* fs.writeFileString(checkout("beep-effect-notes.txt"), "not a checkout\n");
      // A symlinked sibling is never followed.
      yield* fs.symlink(checkout("beep-effect7"), checkout("beep-effect-link"));

      const fleet = yield* readScope(checkout("beep-effect7-worktrees/lane-b"), { fleet: true });
      expect(A.map(fleet, (entry) => entry.checkout)).toEqual([
        "beep-effect-worktrees/lane-a",
        "beep-effect7",
        "beep-effect7-worktrees/lane-b",
      ]);
      const alone = yield* readScope(checkout("beep-effect7-worktrees/lane-b"));
      expect(A.map(alone, (entry) => entry.checkout)).toEqual(["beep-effect7-worktrees/lane-b"]);
      const skipped = yield* Effect.flip(readScope(checkout("beep-effect9")));
      expect(skipped.message).toContain(".beep/yeet/runs");
    })
  );

  layerIt.effect("finds the projects root from a lane under a clone's .claude/worktrees through its .git file", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const projects = yield* fs.makeTempDirectoryScoped({ prefix: "economics-nested-" });
      const checkout = (relative: string) => path.join(projects, relative);
      const green52 = [started(id("52")), finished(id("52"), verdict(O.some(id("52"))))];
      const clone = checkout("beep-effect7");
      const nestedLane = checkout("beep-effect7/.claude/worktrees/x");
      yield* fs.makeDirectory(path.join(clone, ".git", "worktrees", "x"), { recursive: true });
      yield* writeJournal(clone, "run-clone", green52);
      yield* writeJournal(nestedLane, "run-nested", green52);
      yield* fs.writeFileString(
        path.join(nestedLane, ".git"),
        `gitdir: ${path.join(clone, ".git", "worktrees", "x")}\n`
      );
      yield* writeJournal(checkout("beep-effect-worktrees/lane-a"), "run-lane-a", green52);
      yield* writeJournal(checkout("beep-effect7-worktrees/lane-b"), "run-lane-b", green52);

      const expected = [
        "beep-effect-worktrees/lane-a",
        "beep-effect7",
        "beep-effect7-worktrees/lane-b",
        "beep-effect7/.claude/worktrees/x",
      ];
      expect(A.map(yield* readScope(nestedLane, { fleet: true }), (entry) => entry.checkout)).toEqual(expected);
      expect(A.map(yield* readScope(clone, { fleet: true }), (entry) => entry.checkout)).toEqual(expected);
    })
  );

  layerIt.effect("reads the runs directory under a non-default packet dir", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "economics-packet-" });
      yield* writeJournal(
        root,
        "run-alt",
        [started(id("53")), finished(id("53"), verdict(O.some(id("53"))))],
        "\n",
        ".beep/yeet-alt"
      );
      const journals = yield* readScope(root, { packetDir: ".beep/yeet-alt" });
      expect(A.map(journals, (entry) => entry.runId)).toEqual(["run-alt"]);
      const missing = yield* Effect.flip(readScope(root));
      expect(missing.message).toContain(".beep/yeet/runs");
    })
  );
});

it.layer(LiveSourceWithConsole, { timeout: "30 seconds" })("yeet economics command", (layerIt) => {
  layerIt.effect("prints text or JSON, and an empty report for a checkout with no runs", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "economics-run-" });
      const runId = yield* repoRunArtifactId("feat/economics");
      yield* writeJournal(root, runId, [started(id("61")), finished(id("61"), verdict(O.some(id("61"))))]);
      const options = (json: boolean, branch: O.Option<string>) =>
        YeetEconomicsOptions.make({ json, branch, fleet: false });
      yield* runYeetEconomics(options(false, O.none()), Effect.succeed(root));
      yield* runYeetEconomics(options(true, O.some("feat/economics")), Effect.succeed(root));
      const empty = yield* fs.makeTempDirectoryScoped({ prefix: "economics-run-empty-" });
      yield* runYeetEconomics(options(true, O.none()), Effect.succeed(empty));
      const projects = yield* fs.makeTempDirectoryScoped({ prefix: "economics-run-fleet-" });
      const fleetCheckout = `${projects}/beep-effect-fleet`;
      yield* writeJournal(fleetCheckout, "run-fleet", [
        started(id("62")),
        finished(id("62"), verdict(O.some(id("62")))),
      ]);
      yield* runYeetEconomics(
        YeetEconomicsOptions.make({ json: true, branch: O.none(), fleet: true }),
        Effect.succeed(fleetCheckout)
      );
      const lines = yield* TestConsole.logLines;
      expect(A.length(lines)).toBe(4);
      expect(Str.startsWith("yeet economics")(`${lines[0]}`)).toBe(true);
      const branchReport = yield* YeetEconomicsReportJson.decode(`${lines[1]}`);
      expect(branchReport.scope).toMatchObject({ kind: "branch", checkouts: [A.lastNonEmpty(Str.split(root, "/"))] });
      const emptyReport = yield* YeetEconomicsReportJson.decode(`${lines[2]}`);
      expect(emptyReport.scope.checkouts).toEqual([]);
      expect(emptyReport.dataQuality.diagnostics.finishedAttempts).toBe(0);
      const fleetReport = yield* YeetEconomicsReportJson.decode(`${lines[3]}`);
      expect(fleetReport.scope).toMatchObject({ kind: "fleet", checkouts: ["beep-effect-fleet"] });
      expect(Effect.isEffect(runYeetEconomicsCommand({ json: false, branch: O.none(), fleet: false }))).toBe(true);
    })
  );
});

// `runYeetEconomics` reads a filesystem only for its default repo root.
const sourceFailingWith = (reason: YeetEconomicsError["reason"]) =>
  Layer.merge(
    failingSource(() => Effect.fail(YeetEconomicsError.make({ reason, message: reason }))),
    NodeServices.layer
  );

it.layer(sourceFailingWith("run-id"), { timeout: "30 seconds" })("yeet economics command failures", (layerIt) => {
  layerIt.effect("fails on every cause but a missing runs directory", () =>
    Effect.gen(function* () {
      const options = YeetEconomicsOptions.make({ json: false, branch: O.some("main"), fleet: false });
      const runId = yield* Effect.flip(runYeetEconomics(options, Effect.succeed("/repo")));
      expect(runId.reason).toBe("run-id");
      const repoRoot = yield* Effect.flip(
        runYeetEconomics(
          options,
          Effect.fail(YeetEconomicsError.make({ reason: "repo-root", message: "Failed to locate repo root." }))
        )
      );
      expect(repoRoot.reason).toBe("repo-root");
      expect(yield* TestConsole.logLines).toEqual([]);
    })
  );
});

it.layer(sourceFailingWith("no-runs-directory"), { timeout: "30 seconds" })(
  "yeet economics command without runs",
  (layerIt) => {
    layerIt.effect("prints an empty report for a missing runs directory", () =>
      Effect.gen(function* () {
        yield* runYeetEconomics(
          YeetEconomicsOptions.make({ json: false, branch: O.none(), fleet: false }),
          Effect.succeed("/repo")
        );
        const lines = yield* TestConsole.logLines;
        expect(A.length(lines)).toBe(1);
        expect(Str.includes("attempts: 0 — none")(`${lines[0]}`)).toBe(true);
      })
    );
  }
);

describe("yeet economics rendering", () => {
  const sections = [
    "yeet economics",
    "attempts:",
    "wrapper lanes:",
    "inner lanes:",
    "first failure (M2)",
    "red to green (M1) comparable24h",
    "red to green (M1) uncut",
    "terminations (M5)",
    "unchanged fingerprint (M4 fingerprint-repeat proxy; the ack-resolution join is not on this surface)",
    "by actionable lane:",
    "data quality:",
  ];

  it("names every section and keeps the closeout summary within five lines", () => {
    const wrapperRuns = A.map(A.range(1, 12), (index) =>
      lane(`full:${Str.padStart(2, "0")(`${index}`)}-step`, "passed", O.some(index * 1_000), "wrapper")
    );
    // Same id and total as the top lane, a different label: ordered by label, rendered as `id / label`.
    const relabelled = EconomicsLane.make({
      ...lane("full:12-step", "passed", O.some(12_000), "wrapper"),
      label: "full:twelve",
    });
    const populated = report([
      journal("run-1", [
        red("r", 0, 10, {
          lanes: [...wrapperRuns, relabelled, lane("quality:coverage", "failed", O.some(90 * MINUTE), "inner")],
        }),
        green("g", 20, 90),
      ]),
    ]);
    for (const economics of [report([]), populated]) {
      const text = renderYeetEconomicsReport(economics);
      for (const section of sections) {
        expect(Str.includes(section)(text)).toBe(true);
      }
      const summary = renderYeetEconomicsCloseoutSummary(economics);
      expect(A.length(summary) <= 5).toBe(true);
      expect(A.every(summary, Str.startsWith("economics:"))).toBe(true);
    }
    expect(renderYeetEconomicsCloseoutSummary(report([]))).toEqual([
      "economics: 0 attempt(s) — none",
      "economics: red to green p50 n/a over 0 closed episode(s) (comparable, <= 24h)",
      "economics: first failure completes at p50 n/a (0 of 0 red attempt(s) reconstructable)",
      "economics: no wrapper lane time measured",
      "economics: terminations 0 start(s), 0 without a terminal row; reasons none",
    ]);
    const text = renderYeetEconomicsReport(populated);
    expect(Str.includes("+3 more lane(s)")(text)).toBe(true);
    expect(Str.includes("full:12-step / full:twelve (full)")(text)).toBe(true);
    expect(Str.includes("1.50h")(text)).toBe(true);
    expect(renderYeetEconomicsCloseoutSummary(populated)[3]).toBe(
      "economics: top wrapper lane full:12-step 12.0s (13.33% of wrapper time)"
    );
    const fleetScope = EconomicsScope.make({ kind: "fleet", checkouts: ["a", "b", "c", "d"], branch: O.some("main") });
    expect(
      Str.startsWith("yeet economics (yeet-economics/v1) — fleet main: a, b, c, +1 more;")(
        renderYeetEconomicsReport(buildYeetEconomicsReport([], fleetScope, NOW))
      )
    ).toBe(true);
  });
});

it.layer(LiveSourceWithConsole, { timeout: "30 seconds" })("yeet economics closeout summary", (layerIt) => {
  layerIt.effect("prints the branch summary from the live source", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "economics-closeout-" });
      const runId = yield* repoRunArtifactId("feat/economics");
      yield* writeJournal(root, runId, [started(id("71")), finished(id("71"), verdict(O.some(id("71"))))]);
      yield* printYeetEconomicsCloseoutSummary(root, "feat/economics", PACKET_DIR, O.none());
      const lines = yield* TestConsole.logLines;
      expect(A.length(lines)).toBe(5);
      expect(lines[0]).toBe("[yeet] economics: 1 attempt(s) — success 1");
    })
  );

  layerIt.effect("drops the closeout's own in-flight start from its packet dir's journal", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "economics-in-flight-" });
      const runId = yield* repoRunArtifactId("feat/economics");
      yield* writeJournal(
        root,
        runId,
        [started(id("72")), finished(id("72"), verdict(O.some(id("72")))), started(id("73"), 20)],
        "\n",
        ".beep/yeet-alt"
      );
      yield* printYeetEconomicsCloseoutSummary(root, "feat/economics", ".beep/yeet-alt", O.some(id("73")));
      yield* printYeetEconomicsCloseoutSummary(root, "feat/economics", ".beep/yeet-alt", O.none());
      // The layer's console is shared with the test above; these are the last two summaries.
      const lines = A.takeRight(yield* TestConsole.logLines, 10);
      expect(lines[4]).toBe(
        "[yeet] economics: terminations 1 start(s), 0 without a terminal row; reasons none (1 in flight)"
      );
      expect(lines[9]).toBe("[yeet] economics: terminations 2 start(s), 1 without a terminal row; reasons none");
    })
  );
});

it.layer(
  failingSource(() =>
    Effect.fail(YeetEconomicsError.make({ reason: "no-runs-directory", message: "no .beep/yeet/runs under /repo" }))
  ),
  { timeout: "30 seconds" }
)("yeet economics closeout on a failing source", (layerIt) => {
  layerIt.effect("reduces a failing source to one log line", () =>
    Effect.gen(function* () {
      yield* printYeetEconomicsCloseoutSummary("/repo", "main", PACKET_DIR, O.none());
      expect(yield* TestConsole.logLines).toEqual(["[yeet] economics: no .beep/yeet/runs under /repo"]);
    })
  );
});

it.layer(
  failingSource(() => Effect.die("source exploded")),
  { timeout: "30 seconds" }
)("yeet economics closeout on a defect", (layerIt) => {
  layerIt.effect("reduces a defect to one log line", () =>
    Effect.gen(function* () {
      yield* printYeetEconomicsCloseoutSummary("/repo", "main", PACKET_DIR, O.none());
      const lines = yield* TestConsole.logLines;
      expect(A.length(lines)).toBe(1);
      expect(Str.startsWith("[yeet] economics: ")(`${lines[0]}`)).toBe(true);
    })
  );
});

describe("shared nearest rank", () => {
  // The helper `Ci/LaneTimings.ts` carried before the promotion, kept as the oracle.
  const previousLaneTimingsNearestRank = (values: ReadonlyArray<number>, quantile: number): O.Option<number> => {
    const sorted = A.sort(values, Order.Number);
    return A.length(sorted) === 0 ? O.none() : O.fromNullishOr(sorted[Math.ceil(quantile * A.length(sorted)) - 1]);
  };

  it.prop(
    "matches the previous LaneTimings helper for every quantile in (0, 1]",
    {
      values: S.Array(S.Finite),
      quantile: S.Finite.check(S.isGreaterThan(0), S.isLessThanOrEqualTo(1)),
    },
    ({ values, quantile }) => {
      expect(nearestRank(values, quantile)).toEqual(previousLaneTimingsNearestRank(values, quantile));
    },
    { arbitrary: fcRuns(60) }
  );

  it("clamps the rank and has no percentile for an empty sample", () => {
    assertSome(nearestRank([3, 1, 2], 0), 1);
    assertSome(nearestRank(0.5)([40, 10, 30, 20]), 20);
    assertNone(nearestRank([], 0.95));
  });
});
