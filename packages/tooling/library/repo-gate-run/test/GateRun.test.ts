import { RunDelta } from "@beep/gate-report/ConsoleDocument";
import { formatBytes } from "@beep/gate-report/Format";
import { GateEvent } from "@beep/gate-report/GateEvent";
import { fingerprint } from "@beep/gate-report/ItemKey";
import { HistoryLabel } from "@beep/gate-report/Vocabulary";
import { $RepoGateRunId } from "@beep/identity/packages";
import { RecordTarget } from "@beep/repo-gate-record/GatePaths";
import { GateRecordFile } from "@beep/repo-gate-record/GateRecordFile";
import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
import { ConsoleSettings, GateConsole } from "@beep/repo-gate-run/GateConsole";
import { GateHistory, HistoryAnswer } from "@beep/repo-gate-run/GateHistory";
import { GateRecorder, RunSource } from "@beep/repo-gate-run/GateRecorder";
import { fallbackReport, GateRunRequest, runGate } from "@beep/repo-gate-run/GateRun";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import { eventsSource, failedTest, linesOf, packageTarget, testRunEvents } from "./support/fixtures.ts";
import type { GateRecorderShape } from "@beep/repo-gate-run/GateRecorder";

const $I = $RepoGateRunId.create("test/GateRun");

const LOG = Str.repeat(200)("vitest output line\n");
const log = Stream.make(new TextEncoder().encode(LOG));

const request = (events: ReadonlyArray<GateEvent>, exitCode: number) =>
  GateRunRequest.make({ target: packageTarget("test"), source: eventsSource(events), exitCode });

const red = request(testRunEvents(["adds", "divides"]), 1);
const green = request(testRunEvents([]), 0);

const agent = GateConsole.layer(ConsoleSettings.make({ audience: "agent" }));
const memoryRecorder = GateRecorder.layer.pipe(Layer.provide(GateRecordStore.layerMemory));
const services = (history: Layer.Layer<GateHistory>, recorder: Layer.Layer<GateRecorder> = memoryRecorder) =>
  Layer.mergeAll(agent, history, recorder);

const opensAndClosesOnVerdict = (lines: A.NonEmptyReadonlyArray<string>) => {
  assert.isTrue(A.some([": FAILED,", ": PASSED,", ": ERRORED,"], (word) => Str.includes(word)(lines[0] ?? "")));
  assert.strictEqual(lines[0], A.lastNonEmpty(lines));
};

const printed = Effect.map(
  TestConsole.logLines,
  A.map((line) => `${line}`)
);

class TempRepo extends Context.Service<TempRepo, { readonly root: string }>()($I`TempRepo`) {}

const liveStore = Layer.effect(
  GateRecordStore,
  Effect.gen(function* () {
    const { root } = yield* TempRepo;
    const store = yield* GateRecordStore.make(root);
    return GateRecordStore.of(store);
  })
).pipe(
  Layer.provideMerge(
    Layer.effect(
      TempRepo,
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "gate-run-" });
        return TempRepo.of({ root });
      })
    )
  ),
  Layer.provideMerge(NodeServices.layer)
);

describe("runGate", () => {
  it.layer(Layer.mergeAll(agent, GateHistory.layerNone, GateRecorder.layer.pipe(Layer.provideMerge(liveStore))), {
    timeout: "30 seconds",
  })("AC-L8: a path with its size", (it) => {
    it.effect("names the record and raw log by repository-relative path with the log's size, and both read back", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { root } = yield* TempRepo;
        const result = yield* runGate(red, log);
        const lines = linesOf(result.output.text);
        const pathLine = O.getOrThrow(A.findFirst(lines, Str.startsWith("record: ")));
        const [, record = "", logPath = "", size = ""] = /^record: (\S+) \| log: (\S+) \((.+)\)$/u.exec(pathLine) ?? [];
        const logBytes = (yield* fs.readFile(path.join(root, logPath))).length;
        const recordText = yield* fs.readFileString(path.join(root, record));
        const decoded = yield* S.decodeEffect(GateRecordFile)(recordText);
        assert.strictEqual(record, "packages/foundation/primitive/glob/.beep/gates/test/report.json");
        assert.strictEqual(logPath, "packages/foundation/primitive/glob/.beep/gates/test/report.log");
        assert.strictEqual(logBytes, new TextEncoder().encode(LOG).length);
        assert.strictEqual(size, formatBytes(logBytes));
        assert.strictEqual(decoded.report.runId, "20261119T100000000Z-0001");
        const printedLines = yield* printed;
        assert.deepStrictEqual(printedLines, [result.output.text]);
      })
    );
  });

  it.layer(services(GateHistory.layerNone, GateRecorder.layerFailing("recorder unavailable")), {
    timeout: "30 seconds",
  })("AC-L10: with a recorder that fails", (it) => {
    it.effect("still opens and closes on the verdict, names what was not written, and keeps the exit code", () =>
      Effect.gen(function* () {
        const failed = yield* runGate(red, log);
        const passed = yield* runGate(green, log);
        const lines = linesOf(failed.output.text);
        opensAndClosesOnVerdict(lines);
        opensAndClosesOnVerdict(linesOf(passed.output.text));
        assert.include(lines, "record and raw log unavailable: recorder unavailable");
        assert.isFalse(A.some(lines, Str.startsWith("record: ")));
        assert.strictEqual(failed.exitCode, 1);
        assert.strictEqual(passed.exitCode, 0);
        assert.strictEqual(linesOf(passed.output.text).length, 3);
      })
    );
  });

  const recorderOf = (record: GateRecorderShape["record"]) => Layer.succeed(GateRecorder, GateRecorder.of({ record }));
  const notWritten = (lines: A.NonEmptyReadonlyArray<string>) =>
    O.getOrThrow(A.findFirst(lines, Str.startsWith("record and raw log unavailable: ")));

  it.layer(
    services(
      GateHistory.layerNone,
      recorderOf(
        Effect.fn("test.record")(function* () {
          return yield* Effect.die("recorder bug");
        })
      )
    ),
    { timeout: "30 seconds" }
  )("RG-1: with a recorder that dies with a defect", (it) => {
    it.effect("renders from a report settled here and names the defect", () =>
      Effect.gen(function* () {
        const result = yield* runGate(red, log);
        const lines = linesOf(result.output.text);
        opensAndClosesOnVerdict(lines);
        assert.strictEqual(notWritten(lines), "record and raw log unavailable: recorder bug");
        assert.isFalse(A.some(lines, Str.startsWith("record: ")));
        assert.strictEqual(result.exitCode, 1);
        const finished = yield* runGate(
          GateRunRequest.make({ ...red, source: RunSource.cases.FinishedReport.make({ report: result.report }) }),
          log
        );
        assert.strictEqual(finished.output.text, result.output.text);
      })
    );
  });

  it.layer(
    services(
      GateHistory.layerNone,
      recorderOf(
        Effect.fn("test.record")(function* () {
          return yield* Effect.never;
        })
      )
    ),
    { timeout: "30 seconds" }
  )("RG-1: with a recorder that hangs past the record deadline", (it) => {
    it.effect("renders at the deadline and names the writes as unfinished", () =>
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(runGate(GateRunRequest.make({ ...red, recordDeadlineMs: 50 }), log));
        yield* TestClock.adjust(Duration.millis(50));
        const result = yield* Fiber.join(fiber);
        const lines = linesOf(result.output.text);
        opensAndClosesOnVerdict(lines);
        assert.strictEqual(notWritten(lines), "record and raw log unavailable: the writes did not finish within 50ms");
        assert.strictEqual(result.exitCode, 1);
      })
    );
  });

  it.layer(services(GateHistory.layerNone), { timeout: "30 seconds" })(
    "RG-1: with a log stream that errors and with events that do not describe a whole run",
    (it) => {
      it.effect("a log stream failure still prints the console and names no path", () =>
        Effect.gen(function* () {
          const result = yield* runGate(red, Stream.fail({ code: "EPIPE" }));
          const lines = linesOf(result.output.text);
          opensAndClosesOnVerdict(lines);
          assert.isTrue(Str.startsWith("record and raw log unavailable: ")(notWritten(lines)));
          assert.isFalse(A.some(lines, Str.startsWith("record: ")));
          assert.strictEqual(result.exitCode, 1);
        })
      );

      it.effect("events with no end render as an errored run and name the missing end", () =>
        Effect.gen(function* () {
          const events = A.dropRight(testRunEvents(["adds"]), 1);
          const result = yield* runGate(request(events, 1), log);
          const lines = linesOf(result.output.text);
          opensAndClosesOnVerdict(lines);
          assert.include(lines[0], ": ERRORED,");
          assert.include(notWritten(lines), "RunFinished");
          assert.strictEqual(result.report.reason, "errored");
          assert.strictEqual(result.exitCode, 1);
        })
      );

      it.effect("no events at all render an errored run stated from the target", () =>
        Effect.gen(function* () {
          const packageRun = yield* runGate(request([], 2), log);
          const rootRun = yield* runGate(
            GateRunRequest.make({
              target: RecordTarget.cases.RootTarget.make({ gate: "check", runId: "run-1" }),
              source: eventsSource([]),
              exitCode: 2,
            }),
            log
          );
          assert.isTrue(Str.startsWith("test packages/foundation/primitive/glob: ERRORED,")(packageRun.output.text));
          assert.isTrue(Str.startsWith("check workspace: ERRORED,")(rootRun.output.text));
          assert.strictEqual(rootRun.report.runId, "run-1");
          assert.deepStrictEqual([packageRun.exitCode, rootRun.exitCode], [2, 2]);
        })
      );
    }
  );

  it.layer(services(GateHistory.layerNone), { timeout: "30 seconds" })(
    "review round 1: a cut-off rerun and the stated subject",
    (it) => {
      it.effect("a rerun cut off after its start renders as an errored run of that rerun", () =>
        Effect.gen(function* () {
          const rerun = GateEvent.cases.RunStarted.make({
            runId: "rerun-2",
            gate: "test",
            subject: "@beep/glob",
            itemKind: "test",
            startedAt: DateTime.makeUnsafe(0),
            inputFingerprint: "fingerprint",
          });
          const events = [...testRunEvents([]), rerun, GateEvent.cases.ItemFinished.make({ item: failedTest("adds") })];
          const result = yield* runGate(request(events, 1), log);
          const lines = linesOf(result.output.text);
          opensAndClosesOnVerdict(lines);
          assert.include(lines[0], ": ERRORED,");
          assert.strictEqual(result.report.runId, "rerun-2");
          assert.strictEqual(result.exitCode, 1);
        })
      );

      it.effect("a passed run whose start is missing was not observed whole: errored, items kept", () =>
        Effect.gen(function* () {
          const result = yield* runGate(request(A.drop(testRunEvents([]), 1), 0), log);
          assert.strictEqual(result.report.reason, "errored");
          assert.strictEqual(result.report.totals.passed, 3);
          assert.include(linesOf(result.output.text)[0], ": ERRORED,");
          assert.strictEqual(result.exitCode, 0);
        })
      );

      it.effect("a run with no start is stated by its package name when the caller gives one", () =>
        Effect.gen(function* () {
          const named = yield* runGate(GateRunRequest.make({ ...request([], 1), subject: O.some("@beep/glob") }), log);
          const unnamed = yield* runGate(request([], 1), log);
          assert.isTrue(Str.startsWith("test @beep/glob: ERRORED,")(named.output.text));
          assert.isTrue(Str.startsWith("test packages/foundation/primitive/glob: ERRORED,")(unnamed.output.text));
        })
      );
    }
  );

  it.layer(
    Layer.mergeAll(
      agent,
      memoryRecorder,
      Layer.succeed(
        GateHistory,
        GateHistory.of({
          read: Effect.fn("test.read")(function* () {
            return yield* Effect.die("history store corrupt");
          }),
        })
      )
    ),
    { timeout: "30 seconds" }
  )("review round 1: with a history read that dies with a defect", (it) => {
    it.effect("renders without labels and names the history as not read", () =>
      Effect.gen(function* () {
        const result = yield* runGate(red, log);
        const lines = linesOf(result.output.text);
        opensAndClosesOnVerdict(lines);
        assert.include(lines, "history not read: history store corrupt");
        assert.isTrue(A.some(lines, Str.startsWith("record: ")));
        assert.strictEqual(result.exitCode, 1);
      })
    );
  });

  it("the fallback report is an errored report of the request's gate and subject", () => {
    const stated = fallbackReport(
      GateRunRequest.make({ ...request([], 1), subject: O.some("@beep/glob") }),
      DateTime.makeUnsafe(0)
    );
    const root = fallbackReport(DateTime.makeUnsafe(0))(
      GateRunRequest.make({
        target: RecordTarget.cases.RootTarget.make({ gate: "check", runId: "run-9" }),
        source: eventsSource([]),
        exitCode: 2,
      })
    );
    assert.deepStrictEqual(
      [stated.gate, stated.subject, stated.reason, stated.items.length],
      ["test", "@beep/glob", "errored", 0]
    );
    assert.deepStrictEqual([root.subject, root.runId], ["workspace", "run-9"]);
  });

  it.layer(
    services(
      GateHistory.layerNone,
      GateRecorder.layer.pipe(Layer.provide(GateRecordStore.layerFailingWrites("disk full")))
    ),
    { timeout: "30 seconds" }
  )("AC-L10: with a record store whose writes fail", (it) => {
    it.effect("renders from the settled report and names the record and log as not written", () =>
      Effect.gen(function* () {
        const result = yield* runGate(red, log);
        const lines = linesOf(result.output.text);
        opensAndClosesOnVerdict(lines);
        assert.strictEqual(A.filter(lines, Str.includes("unavailable: ")).length, 1);
        const notice = O.getOrThrow(A.findFirst(lines, Str.startsWith("record and raw log unavailable: ")));
        assert.include(notice, "disk full");
        assert.strictEqual(result.exitCode, 1);
      })
    );
  });

  it.layer(services(GateHistory.layerFailing("history store locked")), { timeout: "30 seconds" })(
    "AC-L10: with a history read that fails",
    (it) => {
      it.effect("adds one line naming the history and is otherwise unchanged", () =>
        Effect.gen(function* () {
          const result = yield* runGate(red, log);
          const lines = linesOf(result.output.text);
          opensAndClosesOnVerdict(lines);
          assert.include(lines, "history not read: history store locked");
          assert.isFalse(A.some(lines, Str.includes("[")));
          assert.strictEqual(result.exitCode, 1);
        })
      );
    }
  );

  it.layer(services(GateHistory.layerSlow(Duration.hours(1))), { timeout: "30 seconds" })(
    "AC-L10: with a history read that misses its deadline",
    (it) => {
      it.effect("renders at the deadline without labels and names the missed deadline", () =>
        Effect.gen(function* () {
          const fiber = yield* Effect.forkChild(runGate(GateRunRequest.make({ ...green, historyDeadlineMs: 10 }), log));
          yield* TestClock.adjust(Duration.millis(10));
          const result = yield* Fiber.join(fiber);
          const lines = linesOf(result.output.text);
          opensAndClosesOnVerdict(lines);
          assert.strictEqual(lines[1], "history not read: no answer within 10ms");
          assert.strictEqual(result.exitCode, 0);
        })
      );
    }
  );

  it.layer(services(GateHistory.layerSlow(Duration.hours(1))), { timeout: "30 seconds" })(
    "with a slow history read inside its deadline",
    (it) => {
      it.effect("waits for a slow answer that arrives inside the deadline", () =>
        Effect.gen(function* () {
          const fiber = yield* Effect.forkChild(
            runGate(GateRunRequest.make({ ...green, historyDeadlineMs: 2 * 60 * 60 * 1000 }), log)
          );
          yield* TestClock.adjust(Duration.hours(1));
          const result = yield* Fiber.join(fiber);
          assert.strictEqual(linesOf(result.output.text).length, 1);
        })
      );
    }
  );

  const failing = [failedTest("adds"), failedTest("divides")];
  const labels = R.fromEntries(
    A.map(failing, (item, index) => [fingerprint(item.key), HistoryLabel.literals[index] ?? "flaky"])
  );

  it.layer(
    services(
      GateHistory.layerTest(
        HistoryAnswer.make({ labels, delta: RunDelta.makeOption({ fixed: 2, stillFailing: 1, new: 1 }) })
      )
    ),
    { timeout: "30 seconds" }
  )("AC-L5 and AC-L6: labels and the delta from history", (it) => {
    it.effect("every failure entry carries exactly one label, and the delta renders before the path line", () =>
      Effect.gen(function* () {
        const result = yield* runGate(red, log);
        const lines = linesOf(result.output.text);
        const entries = A.filter(lines, Str.startsWith("- "));
        const deltaAt = A.findFirstIndex(lines, Str.startsWith("since last run: "));
        const pathAt = A.findFirstIndex(lines, Str.startsWith("record: "));
        assert.strictEqual(entries.length, 2);
        assert.isTrue(
          A.every(
            entries,
            (entry) => A.filter(HistoryLabel.literals, (label) => Str.includes(`[${label}]`)(entry)).length === 1
          )
        );
        assert.include(lines, "since last run: 2 fixed, 1 still failing, 1 new");
        assert.isTrue(O.getOrThrow(deltaAt) < O.getOrThrow(pathAt));
      })
    );

    it.effect("on a green run the delta is a suffix of the single verdict line", () =>
      Effect.gen(function* () {
        const result = yield* runGate(green, log);
        assert.strictEqual(
          result.output.text,
          "test @beep/glob src/math.test.ts: PASSED, 3/3 passed (1.2s) (2 fixed since last run)"
        );
      })
    );
  });

  it.layer(services(GateHistory.layerNone), { timeout: "30 seconds" })("without history", (it) => {
    it.effect("entries carry no label and no delta line renders", () =>
      Effect.gen(function* () {
        const result = yield* runGate(red, log);
        const lines = linesOf(result.output.text);
        assert.isFalse(A.some(lines, Str.includes("[")));
        assert.isFalse(A.some(lines, Str.startsWith("since last run")));
        assert.isTrue(A.some(lines, Str.startsWith("record: ")));
      })
    );
  });
});
