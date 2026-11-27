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
import { PointerTable } from "@beep/gate-report/ConsoleDocument";
import { formatDuration } from "@beep/gate-report/Format";
import { GateEvent } from "@beep/gate-report/GateEvent";
import { GateReport, Totals } from "@beep/gate-report/GateReport";
import { DurationMs, Text } from "@beep/gate-report/Scalars";
import { $RepoGateRunId } from "@beep/identity/packages";
import { RecordTarget } from "@beep/repo-gate-record/GatePaths";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { constant, dual, flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
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
 * writes (10 s by default), the deadline history is read under (250 ms by
 * default), and the pointer table to print with instead of the console's
 * own, when the caller pins the next step to this run's record. `subject` is
 * the package name, which the caller knows; it states the run when the
 * events do not, and without it a package run is stated by its directory.
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
    pointers: S.OptionFromOptionalKey(PointerTable).pipe(S.withConstructorDefault(Effect.succeedNone)),
    subject: S.OptionFromOptionalKey(Text).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("GateRunRequest", {
      description:
        "A finished tool run: whose record, its events or report, the tool's exit code, the record and history deadlines, the pointers and the package name.",
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

const subjectOf = (request: GateRunRequest): string =>
  O.getOrElse(
    request.subject,
    RecordTarget.match(request.target, {
      PackageTarget: (target) => constant(target.packageDir),
      RootTarget: () => constant(WORKSPACE_SUBJECT),
    })
  );

const runIdOf: (target: RecordTarget) => string = RecordTarget.match({
  PackageTarget: () => "unrecorded",
  RootTarget: (target) => target.runId,
});

const statedRun = (request: GateRunRequest, startedAt: DateTime.Utc) => ({
  runId: runIdOf(request.target),
  gate: request.target.gate,
  subject: subjectOf(request),
  itemKind: "step" as const,
  startedAt,
  inputFingerprint: "unrecorded",
});

/**
 * The least report a gate run can render: errored, with no unit or item,
 * stated from the request's target, subject and run id.
 *
 * **Details**
 *
 * The run entry falls back to it when a run's events, even completed, do not
 * reduce, so a console prints whatever the events held.
 *
 * **Example** (State a report from the request)
 *
 * ```ts
 * import { RecordTarget } from "@beep/repo-gate-record/GatePaths";
 * import { RunSource } from "@beep/repo-gate-run/GateRecorder";
 * import { GateRunRequest, fallbackReport } from "@beep/repo-gate-run/GateRun";
 * import * as DateTime from "effect/DateTime";
 *
 * const request = GateRunRequest.make({
 *   target: RecordTarget.cases.PackageTarget.make({ packageDir: "packages/glob", gate: "test" }),
 *   source: RunSource.cases.RunEvents.make({ events: [] }),
 *   exitCode: 1,
 * });
 * console.log(fallbackReport(request, DateTime.makeUnsafe(0)).reason); // errored
 * ```
 *
 * @param request - the finished run whose events did not reduce
 * @param startedAt - when the entry settled the run, the report's start
 * @returns an errored report with no item, of the request's gate and subject
 * @category constructors
 * @since 0.0.0
 */
export const fallbackReport: {
  (request: GateRunRequest, startedAt: DateTime.Utc): GateReport;
  (startedAt: DateTime.Utc): (request: GateRunRequest) => GateReport;
} = dual(
  2,
  (request: GateRunRequest, startedAt: DateTime.Utc): GateReport =>
    GateReport.make({
      ...statedRun(request, startedAt),
      durationMs: 0,
      reason: "errored",
      outcome: "some-fail",
      units: [],
      items: [],
      totals: Totals.make({}),
    })
);

const isEnd = (event: GateEvent): boolean =>
  GateEvent.guards.RunFinished(event) || GateEvent.guards.RunCancelled(event);

const unobserved = (event: GateEvent): GateEvent =>
  GateEvent.guards.RunFinished(event) ? GateEvent.cases.RunFinished.make({ ...event, reason: "errored" }) : event;

const completeEvents = (
  request: GateRunRequest,
  events: ReadonlyArray<GateEvent>,
  startedAt: DateTime.Utc
): ReadonlyArray<GateEvent> => {
  const lastStart = A.findLastIndex(events, GateEvent.guards.RunStarted);
  const lastRun = O.match(lastStart, { onNone: () => events, onSome: (index) => A.drop(events, index) });
  const observed = O.isSome(lastStart) ? events : A.map(events, unobserved);
  return [
    ...(O.isSome(lastStart) ? [] : [GateEvent.cases.RunStarted.make(statedRun(request, startedAt))]),
    ...observed,
    ...(A.some(lastRun, isEnd)
      ? []
      : [GateEvent.cases.RunFinished.make({ durationMs: 0, reason: "errored", exitCode: O.some(request.exitCode) })]),
  ];
};

const unrecorded = Effect.fnUntraced(function* (request: GateRunRequest, reason: string) {
  const startedAt = yield* DateTime.now;
  const source = RunSource.match(request.source, {
    RunEvents: (run) => RunSource.cases.RunEvents.make({ events: completeEvents(request, run.events, startedAt) }),
    FinishedReport: (finished) => finished,
  });
  const report = Result.getOrElse(settleSource(source, O.none()), constant(fallbackReport(request, startedAt)));
  return Recorded.make({
    report,
    omissions: [Omission.make({ part: "record", reason }), Omission.make({ part: "log", reason })],
  });
});

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
        onSome: (answer): HistoryRead => ({
          answer,
          omission: O.flatMap(answer.baseline, (reason) => Omission.makeOption({ part: "baseline", reason })),
        }),
      })
    ),
    Effect.catchCause(flow(causeReason, withoutHistory, Effect.succeed))
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
 * completed from the request (its subject, else the package directory) and
 * the tool's exit code; a run whose start is missing was not observed whole,
 * so it is errored whatever its finish said, with its items kept. Only the
 * events after the last `RunStarted`
 * count, so a rerun cut off by the tool's exit renders as an errored run; if
 * completed events still do not reduce, {@link fallbackReport} is rendered.
 * A history failure or defect, or a late answer, renders without labels and
 * delta. History is read only after the report is settled and is given
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
      pointers: request.pointers,
    })
  );
  yield* Console.log(output.text);
  return GateRunResult.make({ report, output, exitCode: request.exitCode });
});
