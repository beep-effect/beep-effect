/**
 * The adapter's implementation, loaded by the registered reporter when
 * Vitest starts: it keeps the run's start time and console lines, under a
 * bound, and at the end of the run synthesizes the gate events, reduces them
 * with the model, and writes the package's test record and raw log through the
 * record library. It never prints on success and never fails the run: a
 * failure becomes one line on stderr.
 *
 * @since 0.0.0
 */
import { GateRecord } from "@beep/gate-report/GateRecord";
import { reduceEvents } from "@beep/gate-report/Reducer";
import { RecordTarget } from "@beep/repo-gate-record/GatePaths";
import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
import { inputFingerprint, locatePackage } from "@beep/repo-gate-record/PackageLocation";
import { makeRunId } from "@beep/repo-gate-record/RunId";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as O from "effect/Option";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { makeConsoleLogBuffer, runLogText } from "./RunLog.ts";
import { readStrayOutput } from "./StrayOutputRecorder.ts";
import { synthesizeEvents } from "./Synthesize.ts";
import type { VitestConsoleLog, VitestError, VitestModule } from "./VitestShapes.ts";

/**
 * The line every adapter message on stderr starts with.
 *
 * @since 0.0.0
 */
export const ADAPTER_PREFIX = "[@beep/repo-gate-vitest]";

/**
 * The gate a Vitest invocation records: `test-integration` when it was
 * asked for the integration directory, `test` otherwise.
 *
 * @since 0.0.0
 */
export const gateOf = (argv: ReadonlyArray<string>): string =>
  A.some(argv, Str.startsWith("test/integration")) ? "test-integration" : "test";

/**
 * Everything a finished run hands the adapter.
 *
 * @since 0.0.0
 */
type FinishInput = {
  readonly root: string;
  readonly argv: ReadonlyArray<string>;
  readonly startedAt: O.Option<DateTime.Utc>;
  readonly consoleText: string;
  readonly modules: ReadonlyArray<VitestModule>;
  readonly unhandledErrors: ReadonlyArray<VitestError>;
  readonly reason: string;
  readonly logger: unknown;
};

const encoder = new TextEncoder();

/**
 * Settle and write one finished run's record and raw log. Does nothing when
 * the Vitest root is not a package of a repository.
 *
 * @since 0.0.0
 */
export const writeRunRecord = Effect.fn("GateVitestRun.writeRunRecord")(function* (input: FinishInput) {
  const located = yield* locatePackage(input.root);
  if (O.isNone(located)) return;
  const { repoRoot, packageDir, subject } = located.value;
  const runId = yield* makeRunId;
  const finishedAt = yield* DateTime.now;
  const startedAt = O.getOrElse(input.startedAt, () => finishedAt);
  const gate = gateOf(input.argv);
  const events = synthesizeEvents({
    runId,
    gate,
    subject,
    root: input.root,
    startedAt,
    durationMs: Duration.toMillis(DateTime.distance(startedAt, finishedAt)),
    inputFingerprint: yield* inputFingerprint(runId),
    modules: input.modules,
    unhandledErrors: input.unhandledErrors,
    reason: input.reason,
    strayOutput: readStrayOutput(input.logger),
  });
  const report = yield* Effect.fromResult(reduceEvents(events));
  const store = yield* GateRecordStore.make(repoRoot);
  const target = RecordTarget.cases.PackageTarget.make({ packageDir, gate });
  yield* store.writeLog(target, Stream.make(encoder.encode(runLogText(report, input.consoleText))));
  yield* store.writeRecord(target, GateRecord.make({ generatedAt: finishedAt, report }));
});

/**
 * The one stderr line naming why the adapter wrote nothing.
 *
 * @since 0.0.0
 */
export const failureLine = (cause: Cause.Cause<unknown>): string =>
  `${ADAPTER_PREFIX} gate record not written: ${pipe(cause, Cause.pretty, Str.split("\n"), A.headNonEmpty)}`;

// The adapter's one line goes to the error console of the Vitest main
// process, beside Vitest's own output.
const printToStderr = (line: string): void => {
  Effect.runSync(Console.error(line));
};

/**
 * The live session the registered reporter drives.
 *
 * @since 0.0.0
 */
export type GateVitestRun = {
  readonly start: () => void;
  readonly console: (log: VitestConsoleLog) => void;
  readonly finish: (input: Pick<FinishInput, "modules" | "unhandledErrors" | "reason" | "logger">) => Promise<void>;
};

/**
 * Make the session for one Vitest instance.
 *
 * **Details**
 *
 * `start` resets the console lines and the start time, so a watch-mode
 * rerun records a clean run. `finish` never rejects.
 *
 * @since 0.0.0
 */
export const makeGateVitestRun = (options: {
  readonly root: string;
  readonly argv: ReadonlyArray<string>;
  readonly printLine?: (line: string) => void;
}) => {
  const printLine = options.printLine ?? printToStderr;
  const logs = makeConsoleLogBuffer();
  const state: { startedAt: O.Option<DateTime.Utc> } = { startedAt: O.none() };
  const session: GateVitestRun = {
    start: () => {
      state.startedAt = O.some(DateTime.nowUnsafe());
      logs.reset();
    },
    console: logs.add,
    finish: (input) => {
      const runtime = ManagedRuntime.make(NodeServices.layer);
      return runtime
        .runPromise(
          writeRunRecord({
            ...input,
            root: options.root,
            argv: options.argv,
            startedAt: state.startedAt,
            consoleText: logs.text(),
          }).pipe(Effect.catchCause((cause) => Effect.sync(() => pipe(cause, failureLine, printLine))))
        )
        .finally(runtime.dispose);
    },
  };
  return session;
};
