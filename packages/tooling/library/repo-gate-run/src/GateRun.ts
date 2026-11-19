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
import { GateReport } from "@beep/gate-report/GateReport";
import { DurationMs } from "@beep/gate-report/Scalars";
import { $RepoGateRunId } from "@beep/identity/packages";
import { RecordTarget } from "@beep/repo-gate-record/GatePaths";
import * as Console from "effect/Console";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { ConsoleOutput, ConsoleRequest, GateConsole } from "./GateConsole.ts";
import { applyLabels, DEFAULT_HISTORY_DEADLINE_MS, GateHistory, HistoryAnswer } from "./GateHistory.ts";
import { GateRecorder, Recorded, RecordRequest, RunSource, settleSource } from "./GateRecorder.ts";
import { Omission } from "./Omission.ts";
import type * as Stream from "effect/Stream";
import type { GateHistoryShape } from "./GateHistory.ts";
import type { GateRecorderError } from "./GateRecorder.ts";

const $I = $RepoGateRunId.create("GateRun");

/**
 * One finished tool run to report: whose record, what the run produced, the
 * exit code the tool returned, and how long to wait for history (250 ms by
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
  }).pipe(
    $I.annoteSchema("GateRunRequest", {
      description:
        "A finished tool run: whose record, its events or report, the tool's exit code, the history deadline.",
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

const isRecorderError = (error: unknown): error is GateRecorderError => P.isTagged(error, "GateRecorderError");

// The recorder could not run: settle the report here, with no excerpt, and
// name the record and log as not written.
const unrecorded = (source: RunSource) => (error: GateRecorderError) =>
  Effect.map(Effect.fromResult(settleSource(source, O.none())), (report) =>
    Recorded.make({
      report,
      omissions: [
        Omission.make({ part: "record", reason: error.message }),
        Omission.make({ part: "log", reason: error.message }),
      ],
    })
  );

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
 * The recorder writes the raw stream and the record; if it cannot run, the
 * report is settled here and the console names the record and log as not
 * written. History is read only after the report is settled and is given its
 * deadline: a late or failed read renders without labels and delta and adds
 * one line saying so. The console is printed with one `Console.log`. The
 * exit code returned is the tool's, whatever the report says. Malformed
 * events fail with `IncompleteRunError`; a raw stream failure fails as it is.
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
  const recorded = yield* recorder
    .record(RecordRequest.make({ target: request.target, source: request.source }), log)
    .pipe(Effect.catchIf(isRecorderError, unrecorded(request.source)));
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
