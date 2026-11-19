/**
 * The gate run entry: the whole flow for one finished tool run. Events
 * become a report, the record and raw log are written, history's labels and
 * delta are read under their deadline, and the console is rendered and
 * printed. Persistence and history never block or change the console's
 * verdict, and the exit code stays the tool's.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { formatDuration } from "@beep/gate-report/Format";
import { GateEvent } from "@beep/gate-report/GateEvent";
import { GateReport } from "@beep/gate-report/GateReport";
import { DurationMs } from "@beep/gate-report/Scalars";
import { $RepoGateRunId } from "@beep/identity/packages";
import { RecordTarget } from "@beep/repo-gate-record/GatePaths";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { WORKSPACE_SUBJECT } from "./ConsoleDefaults.ts";
import { ConsoleOutput, ConsoleRequest, GateConsole } from "./GateConsole.ts";
import { applyLabels, DEFAULT_HISTORY_DEADLINE_MS, GateHistory, HistoryAnswer } from "./GateHistory.ts";
import { GateRecorder, Recorded, RecordRequest, RunSource, settleSource } from "./GateRecorder.ts";
import { Omission } from "./Omission.ts";
import type * as Stream from "effect/Stream";
import type { GateHistoryShape } from "./GateHistory.ts";
import type { GateRecorderShape } from "./GateRecorder.ts";

const $I = $RepoGateRunId.create("GateRun");

/**
 * How long, in milliseconds, a gate run waits for its record and raw log
 * writes before it renders without them.
 *
 * **Example** (Read the default deadline)
 *
 * ```ts
 * import { DEFAULT_RECORD_DEADLINE_MS } from "@beep/repo-gate-run/GateRun";
 *
 * console.log(DEFAULT_RECORD_DEADLINE_MS); // 10000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_RECORD_DEADLINE_MS = 10_000;

/**
 * One finished tool run to report: whose record, what the run produced, the
 * exit code the tool returned, how long to wait for the record and log
 * writes (10 s by default) and how long to wait for history (250 ms by
 * default).
 *
 * **Example** (Describe a finished run)
 *
 * ```ts
 * import { RecordTarget } from "@beep/repo-gate-record/GatePaths";
 * import { RunSource } from "@beep/repo-gate-run/GateRecorder";
 * import { GateRunRequest } from "@beep/repo-gate-run/GateRun";
 *
 * const request = GateRunRequest.make({
 *   target: RecordTarget.cases.PackageTarget.make({ packageDir: "packages/glob", gate: "test" }),
 *   source: RunSource.cases.RunEvents.make({ events: [] }),
 *   exitCode: 0,
 * });
 * console.log(request.exitCode); // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GateRunRequest extends S.Opaque<GateRunRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    target: RecordTarget,
    source: RunSource,
    exitCode: S.Int,
    historyDeadlineMs: DurationMs.pipe(S.withConstructorDefault(Effect.succeed(DEFAULT_HISTORY_DEADLINE_MS))),
    recordDeadlineMs: DurationMs.pipe(S.withConstructorDefault(Effect.succeed(DEFAULT_RECORD_DEADLINE_MS))),
  }).pipe(
    $I.annoteSchema("GateRunRequest", {
      description:
        "A finished tool run: whose record, its events or report, the tool's exit code, and the record and history deadlines.",
    })
  )
) {}

/**
 * What a gate run printed and settled: the report, the console it printed,
 * the record paths when written, and the exit code to return, which is the
 * tool's.
 *
 * **Example** (Build a result)
 *
 * ```ts
 * import { GateReport, Totals } from "@beep/gate-report/GateReport";
 * import { ConsoleOutput } from "@beep/repo-gate-run/GateConsole";
 * import { GateRunResult } from "@beep/repo-gate-run/GateRun";
 * import * as DateTime from "effect/DateTime";
 *
 * const report = GateReport.make({
 *   gate: "test", subject: "@beep/glob", itemKind: "test", runId: "r1",
 *   startedAt: DateTime.makeUnsafe(0), durationMs: 0, inputFingerprint: "x",
 *   reason: "passed", outcome: "all-pass", units: [], items: [], totals: Totals.make({ collected: 1, passed: 1 }),
 * });
 * const result = GateRunResult.make({ report, output: ConsoleOutput.make({ projection: "agent", text: "" }), exitCode: 0 });
 * console.log(result.exitCode); // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GateRunResult extends S.Opaque<GateRunResult, { readonly brand: unique symbol }>()(
  S.Struct({
    report: GateReport,
    output: ConsoleOutput,
    exitCode: S.Int,
  }).pipe(
    $I.annoteSchema("GateRunResult", {
      description: "A gate run's report, the console it printed and the tool's exit code.",
    })
  )
) {}

const subjectOf: (target: RecordTarget) => string = RecordTarget.match({
  PackageTarget: (target) => target.packageDir,
  RootTarget: () => WORKSPACE_SUBJECT,
});

const runIdOf: (target: RecordTarget) => string = RecordTarget.match({
  PackageTarget: () => "unrecorded",
  RootTarget: (target) => target.runId,
});

// Events that do not describe a whole run still get a console: a missing start is stated from the
// target, and a missing end is an errored finish carrying the tool's exit code. A whole run is
// left as it is.
const completeEvents = (
  request: GateRunRequest,
  events: ReadonlyArray<GateEvent>,
  startedAt: DateTime.Utc
): ReadonlyArray<GateEvent> => [
  ...(A.some(events, GateEvent.guards.RunStarted)
    ? []
    : [
        GateEvent.cases.RunStarted.make({
          runId: runIdOf(request.target),
          gate: request.target.gate,
          subject: subjectOf(request.target),
          itemKind: "step",
          startedAt,
          inputFingerprint: "unrecorded",
        }),
      ]),
  ...events,
  ...(A.some(events, (event) => GateEvent.guards.RunFinished(event) || GateEvent.guards.RunCancelled(event))
    ? []
    : [GateEvent.cases.RunFinished.make({ durationMs: 0, reason: "errored", exitCode: O.some(request.exitCode) })]),
];

// The record step failed, hung or died: settle the report here, with no excerpt, and name the
// record and log as unavailable: a write may have landed, but nothing confirmed it. The completed events always reduce, so the console always has a
// report.
const unrecorded = Effect.fnUntraced(function* (request: GateRunRequest, reason: string) {
  const startedAt = yield* DateTime.now;
  const source = RunSource.match(request.source, {
    RunEvents: (run) => RunSource.cases.RunEvents.make({ events: completeEvents(request, run.events, startedAt) }),
    FinishedReport: (finished) => finished,
  });
  const report = yield* settleSource(source, O.none()).pipe(Effect.fromResult, Effect.orDie);
  return Recorded.make({
    report,
    omissions: [Omission.make({ part: "record", reason }), Omission.make({ part: "log", reason })],
  });
});

// A failure's own message when it has one (a tagged error, an Error, a string), else the first
// line of the rendered cause.
const messageOf = (error: unknown): O.Option<string> =>
  pipe(
    O.liftPredicate(error, P.isString),
    O.orElse(() =>
      pipe(
        O.liftPredicate(error, P.hasProperty("message")),
        O.map((withMessage) => withMessage.message),
        O.filter(P.isString)
      )
    )
  );

const firstLine: (cause: Cause.Cause<unknown>) => string = flow(Cause.pretty, Str.split("\n"), A.headNonEmpty);

const causeReason = (cause: Cause.Cause<unknown>): string =>
  cause.pipe(
    Cause.squash,
    messageOf,
    O.getOrElse(() => firstLine(cause))
  );

// Persist first, under the record deadline: the path line needs the log's written size. Any
// failure of the step (a write error the recorder could not absorb, a log stream error, malformed
// events, a defect) or a missed deadline becomes an omission, and the console renders regardless.
const recordWithin = Effect.fnUntraced(function* <E, R>(
  recorder: GateRecorderShape,
  request: GateRunRequest,
  log: Stream.Stream<Uint8Array, E, R>
) {
  const exit = yield* recorder
    .record(RecordRequest.make({ target: request.target, source: request.source }), log)
    .pipe(Effect.timeoutOption(Duration.millis(request.recordDeadlineMs)), Effect.exit);
  return yield* Exit.match(exit, {
    onSuccess: O.match({
      onSome: Effect.succeed,
      onNone: () => unrecorded(request, `the writes did not finish within ${formatDuration(request.recordDeadlineMs)}`),
    }),
    onFailure: (cause) => unrecorded(request, causeReason(cause)),
  });
});
type HistoryRead = { readonly answer: HistoryAnswer; readonly omission: O.Option<Omission> };

const withoutHistory = (reason: string): HistoryRead => ({
  answer: HistoryAnswer.make({}),
  omission: Omission.makeOption({ part: "history", reason }),
});

const readHistory = (history: GateHistoryShape, report: GateReport, deadlineMs: number): Effect.Effect<HistoryRead> =>
  history.read(report).pipe(
    Effect.timeoutOption(Duration.millis(deadlineMs)),
    Effect.map(
      O.match({
        onNone: () => withoutHistory(`no answer within ${formatDuration(deadlineMs)}`),
        onSome: (answer): HistoryRead => ({ answer, omission: O.none() }),
      })
    ),
    Effect.catchTag("HistoryReadError", (error) => Effect.succeed(withoutHistory(error.message)))
  );

/**
 * Run the whole flow for a finished tool run and print its console.
 *
 * **Details**
 *
 * The record step runs first, under `recordDeadlineMs`, because the path
 * line names the log with its written size. Whatever happens to that step (a
 * defect, a log stream failure, events that do not describe a whole run, or
 * the deadline passing) the report is settled here instead and the console
 * names the record and log as not written; the path line only ever names
 * files the recorder confirmed. Events missing their start or end are
 * completed from the target and the tool's exit code, so they render as an
 * errored run. History is read only after the report is settled and is given
 * its own deadline: a late or failed read renders without labels and delta
 * and adds one line saying so. The console is printed with one
 * `Console.log`, always, and the exit code returned is the tool's, whatever
 * the report says. The call never fails.
 *
 * **Example** (Construct a gate run)
 *
 * ```ts
 * import { RecordTarget } from "@beep/repo-gate-record/GatePaths";
 * import { RunSource } from "@beep/repo-gate-run/GateRecorder";
 * import { GateRunRequest, runGate } from "@beep/repo-gate-run/GateRun";
 * import * as Effect from "effect/Effect";
 * import * as Stream from "effect/Stream";
 *
 * const request = GateRunRequest.make({
 *   target: RecordTarget.cases.PackageTarget.make({ packageDir: "packages/glob", gate: "test" }),
 *   source: RunSource.cases.RunEvents.make({ events: [] }),
 *   exitCode: 0,
 * });
 * console.log(Effect.isEffect(runGate(request, Stream.empty))); // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runGate = Effect.fn("GateRun.runGate")(function* <E, R>(
  request: GateRunRequest,
  log: Stream.Stream<Uint8Array, E, R>
) {
  const recorder = yield* GateRecorder;
  const history = yield* GateHistory;
  const gateConsole = yield* GateConsole;
  const recorded = yield* recordWithin(recorder, request, log);
  const read = yield* readHistory(history, recorded.report, request.historyDeadlineMs);
  const report = applyLabels(recorded.report, read.answer.labels);
  const output = gateConsole.render(
    ConsoleRequest.make({
      report,
      paths: recorded.paths,
      delta: read.answer.delta,
      omissions: [...recorded.omissions, ...O.toArray(read.omission)],
    })
  );
  yield* Console.log(output.text);
  return GateRunResult.make({ report, output, exitCode: request.exitCode });
});
