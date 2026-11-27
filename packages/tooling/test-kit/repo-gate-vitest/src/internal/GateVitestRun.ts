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
import { mergeReports } from "@beep/gate-report/ReportMerge";
import { RecordTarget, recordLocation } from "@beep/repo-gate-record/GatePaths";
import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
import { inputFingerprint, locatePackage } from "@beep/repo-gate-record/PackageLocation";
import { makeRunId } from "@beep/repo-gate-record/RunId";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { makeConsoleLogBuffer, runLogText } from "./RunLog.ts";
import { readStrayOutput } from "./StrayOutputRecorder.ts";
import { synthesizeEvents } from "./Synthesize.ts";
import type { GateReport } from "@beep/gate-report/GateReport";
import type { GateRecordStoreShape } from "@beep/repo-gate-record/GateRecordStore";
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
 * The variable a package script sets on every Vitest run it chains after the
 * first, so the runs add up to one record:
 * `bunx --bun vitest run --exclude=X && BEEP_GATE_CONTINUES=1 bunx vitest run X`.
 *
 * @since 0.0.0
 */
export const GATE_CONTINUES_ENV = "BEEP_GATE_CONTINUES";

/**
 * The sidecar beside a gate's record naming the run id of the record that a
 * continuing run may fold into.
 *
 * @since 0.0.0
 */
export const SESSION_FILE = "session";

const continues = Config.withDefault(Config.Boolean(GATE_CONTINUES_ENV), false);

type GateFiles = {
  readonly store: GateRecordStoreShape;
  readonly target: RecordTarget;
  readonly session: string;
  readonly log: string;
};

const gateFiles = Effect.fnUntraced(function* (repoRoot: string, target: RecordTarget) {
  const path = yield* Path.Path;
  const location = recordLocation(target);
  return {
    store: yield* GateRecordStore.make(repoRoot),
    target,
    session: path.join(repoRoot, path.dirname(location.record), SESSION_FILE),
    log: path.join(repoRoot, location.log),
  };
});

const earlierRun = Effect.fnUntraced(function* (files: GateFiles) {
  const fs = yield* FileSystem.FileSystem;
  const named = yield* fs.readFileString(files.session).pipe(Effect.option);
  const record = yield* files.store.readRecord(files.target).pipe(Effect.option);
  const log = yield* fs.readFile(files.log).pipe(Effect.orElseSucceed(() => new Uint8Array()));
  return pipe(
    record,
    O.filter((earlier) => O.contains(named, earlier.report.runId)),
    O.map((earlier) => ({ report: earlier.report, log }))
  );
});

const persistRun = Effect.fnUntraced(function* (input: {
  readonly files: GateFiles;
  readonly report: GateReport;
  readonly consoleText: string;
  readonly generatedAt: DateTime.Utc;
}) {
  const fs = yield* FileSystem.FileSystem;
  const continuing = yield* continues;
  const earlier = continuing ? yield* earlierRun(input.files) : O.none();
  const ownLog = encoder.encode(runLogText(input.report, input.consoleText));
  const report = O.match(earlier, {
    onNone: () => input.report,
    onSome: (run) => mergeReports(run.report, input.report),
  });
  const log = O.match(earlier, { onNone: () => [ownLog], onSome: (run) => [run.log, ownLog] });
  yield* input.files.store.writeLog(input.files.target, Stream.fromIterable(log));
  yield* input.files.store.writeRecord(input.files.target, GateRecord.make({ generatedAt: input.generatedAt, report }));
  yield* fs.writeFileString(input.files.session, report.runId).pipe(Effect.ignore);
});

/**
 * Clear the record's sidecar as a run starts, unless the run continues a
 * chain. A run that clears it and then writes nothing leaves no name, so no
 * later run of its chain can fold into a record another invocation or a
 * cache restore left.
 *
 * @since 0.0.0
 */
export const clearSession = Effect.fnUntraced(function* (root: string, argv: ReadonlyArray<string>) {
  const continuing = yield* continues;
  const located = yield* locatePackage(root);
  if (continuing || O.isNone(located)) return;
  const fs = yield* FileSystem.FileSystem;
  const target = RecordTarget.cases.PackageTarget.make({ packageDir: located.value.packageDir, gate: gateOf(argv) });
  const files = yield* gateFiles(located.value.repoRoot, target);
  yield* fs.remove(files.session).pipe(Effect.ignore);
});

/**
 * Settle and write one finished run's record and raw log. Does nothing when
 * the Vitest root is not a package of a repository.
 *
 * **Details**
 *
 * A run with {@link GATE_CONTINUES_ENV} set folds into the record its
 * chain's first run left, when the sidecar names that record's run, and
 * appends its log; any other run replaces the record and log. An unreadable
 * record or sidecar starts the record afresh. A run that does not continue
 * clears the sidecar as it starts, so a record a cache restore or an earlier
 * invocation left is never extended. The sidecar is written last, after the
 * record and log, so a run whose writes failed never leaves a name a later run
 * would fold into.
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
  const files = yield* gateFiles(repoRoot, RecordTarget.cases.PackageTarget.make({ packageDir, gate }));
  yield* persistRun({ files, report, consoleText: input.consoleText, generatedAt: finishedAt });
});

/**
 * The one stderr line naming why the adapter wrote nothing.
 *
 * @since 0.0.0
 */
export const failureLine = (cause: Cause.Cause<unknown>): string =>
  `${ADAPTER_PREFIX} gate record not written: ${pipe(cause, Cause.pretty, Str.split("\n"), A.headNonEmpty)}`;

const printToStderr = (line: string): void => {
  Effect.runSync(Console.error(line));
};

const runWithPlatform = (effect: Effect.Effect<void, never, NodeServices.NodeServices>): Promise<void> => {
  const runtime = ManagedRuntime.make(NodeServices.layer);
  return runtime.runPromise(effect).finally(runtime.dispose);
};

/**
 * The live session the registered reporter drives.
 *
 * @since 0.0.0
 */
export type GateVitestRun = {
  readonly start: () => Promise<void>;
  readonly console: (log: VitestConsoleLog) => void;
  readonly finish: (input: Pick<FinishInput, "modules" | "unhandledErrors" | "reason" | "logger">) => Promise<void>;
};

/**
 * Make the session for one Vitest instance.
 *
 * **Details**
 *
 * `start` resets the console lines and the start time, so a watch-mode
 * rerun records a clean run, and clears the record's sidecar unless the run
 * continues a chain. Neither `start` nor `finish` rejects.
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
      return runWithPlatform(clearSession(options.root, options.argv).pipe(Effect.ignoreCause));
    },
    console: logs.add,
    finish: (input) =>
      runWithPlatform(
        writeRunRecord({
          ...input,
          root: options.root,
          argv: options.argv,
          startedAt: state.startedAt,
          consoleText: logs.text(),
        }).pipe(Effect.catchCause((cause) => Effect.sync(() => pipe(cause, failureLine, printLine))))
      ),
  };
  return session;
};
