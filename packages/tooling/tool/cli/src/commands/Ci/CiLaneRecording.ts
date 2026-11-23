/**
 * The gate record of a hosted `beep ci lane` step, and the annotations its
 * output wrote.
 *
 * **Details**
 *
 * On a GitHub runner, `beep ci lane <id>` runs the lane as its own child
 * process and streams the child's output through to the job log. While it
 * streams, it saves the output to a scratch log and counts the annotation
 * workflow commands. When the child exits, the step adds its shown
 * annotations to `.beep/ci/annotations-used.json`; then, if the step wrote
 * no gate record of its own, it records the lane's verdict as a root run of
 * the `lane` gate, `.beep/gates/lane/<run-id>.{json,log}`, through the
 * gate-run services. The step exits with the child's exit code
 * (goals/ci-gate-reports, decision `lane-step-gate-records`).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { GateEvent } from "@beep/gate-report/GateEvent";
import { Item } from "@beep/gate-report/Item";
import { ItemKey } from "@beep/gate-report/ItemKey";
import { DurationMs, Text } from "@beep/gate-report/Scalars";
import { $RepoCliId } from "@beep/identity/packages";
import { RecordTarget, RunId, recordLocation } from "@beep/repo-gate-record/GatePaths";
import { inputFingerprint } from "@beep/repo-gate-record/PackageLocation";
import { makeRunId } from "@beep/repo-gate-record/RunId";
import { ConsoleSettings } from "@beep/repo-gate-run/GateConsole";
import { RunSource } from "@beep/repo-gate-run/GateRecorder";
import { GateRunRequest, runGate } from "@beep/repo-gate-run/GateRun";
import { repoPointerTableFor } from "@beep/repo-gate-run/RepoPointers";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { constant, dual, flow } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { exitWithTool, GateServicesConfig, GateToolExit, withGateServices } from "../Gate/GateRuntime.ts";
import { CiCommandError } from "./Ci.errors.ts";
import {
  addAnnotationsUsed,
  emptyWorkflowCommandTally,
  finishWorkflowCommandScan,
  scanWorkflowCommands,
  shownAnnotationsOf,
  WorkflowCommandScan,
  WorkflowCommandTally,
} from "./CiAnnotationsUsed.ts";
import { findJobGateRecordTargets } from "./CiGateRecordSearch.ts";

const $I = $RepoCliId.create("commands/Ci/CiLaneRecording");

/**
 * The gate a lane step records its verdict under; the lane id is the
 * report's subject.
 *
 * **Example** (Name the gate)
 *
 * ```ts
 * import { CI_LANE_GATE } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CI_LANE_GATE) // "lane"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CI_LANE_GATE = "lane";

/**
 * The variable that marks a lane process as the recorded child, so it runs
 * the lane itself instead of recording it again.
 *
 * **Example** (Name the variable)
 *
 * ```ts
 * import { CI_LANE_RECORDED_ENV } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CI_LANE_RECORDED_ENV) // "BEEP_CI_LANE_RECORDED"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CI_LANE_RECORDED_ENV = "BEEP_CI_LANE_RECORDED";

/**
 * How long a lane's output may stay open after the lane exited before the
 * recorder stops reading it and stops the lane's process group.
 *
 * **Details**
 *
 * A descendant that outlives the lane and keeps its output pipe open would
 * otherwise hold the step forever; hosted lane steps already stop such
 * descendants by process group.
 *
 * **Example** (Read the grace)
 *
 * ```ts
 * import { CI_LANE_DRAIN_GRACE_MS } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CI_LANE_DRAIN_GRACE_MS) // 5000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CI_LANE_DRAIN_GRACE_MS = 5_000;

const CLI_ENTRY_SUFFIX = "/tool/cli/src/bin.ts";

/**
 * The command that runs this repo CLI process again: its executable and
 * every argument after it.
 *
 * **Example** (Describe the CLI)
 *
 * ```ts
 * import { CiLaneSelfCommand } from "@beep/repo-cli/commands/Ci"
 *
 * const self = CiLaneSelfCommand.make({ command: "bun", args: ["packages/tooling/tool/cli/src/bin.ts", "ci", "lane", "nix"] })
 * console.log(self.args.length) // 4
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLaneSelfCommand extends S.Opaque<CiLaneSelfCommand, { readonly brand: unique symbol }>()(
  S.Struct({
    command: S.NonEmptyString,
    args: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("CiLaneSelfCommand", {
      description: "The executable and arguments that run the current repo CLI process again.",
    })
  )
) {}

/**
 * What decides whether a `ci lane` process records its lane: the runner
 * marker, the recorded-child marker, and the process's executable and argv.
 *
 * **Example** (Describe a hosted process)
 *
 * ```ts
 * import { CiLaneProcess } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const process = CiLaneProcess.make({
 *   githubActions: O.some("true"),
 *   recorded: O.none(),
 *   execPath: "/usr/bin/bun",
 *   argv: ["/usr/bin/bun", "/home/alice/beep-effect/packages/tooling/tool/cli/src/bin.ts", "ci", "lane", "nix"],
 * })
 * console.log(process.argv.length) // 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLaneProcess extends S.Opaque<CiLaneProcess, { readonly brand: unique symbol }>()(
  S.Struct({
    githubActions: S.Option(S.String),
    recorded: S.Option(S.String),
    execPath: S.NonEmptyString,
    argv: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("CiLaneProcess", {
      description: "The runner marker, the recorded-child marker, and the executable and argv of a ci lane process.",
    })
  )
) {}

/**
 * The command a `ci lane` process records its lane through, when it should.
 *
 * **Details**
 *
 * A lane is recorded on a GitHub runner (`GITHUB_ACTIONS=true`), by the repo
 * CLI entry itself, and never by the child it starts, which carries
 * {@link CI_LANE_RECORDED_ENV}. Off a runner, and in a process that is not
 * the CLI entry (a test runner calling the command), the lane runs in place.
 *
 * **Example** (A hosted lane step)
 *
 * ```ts
 * import { CiLaneProcess, ciLaneSelfCommand } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const self = ciLaneSelfCommand(
 *   CiLaneProcess.make({
 *     githubActions: O.some("true"),
 *     recorded: O.none(),
 *     execPath: "/usr/bin/bun",
 *     argv: ["/usr/bin/bun", "/home/alice/beep-effect/packages/tooling/tool/cli/src/bin.ts", "ci", "lane", "nix"],
 *   })
 * )
 * console.log(O.isSome(self)) // true
 * ```
 *
 * @param process - The process's markers, executable and argv.
 * @returns The command that runs the lane as a recorded child.
 * @category utilities
 * @since 0.0.0
 */
export const ciLaneSelfCommand = (process: CiLaneProcess): O.Option<CiLaneSelfCommand> =>
  O.contains(process.githubActions, "true") &&
  O.isNone(process.recorded) &&
  O.exists(A.get(process.argv, 1), Str.endsWith(CLI_ENTRY_SUFFIX))
    ? CiLaneSelfCommand.makeOption({ command: process.execPath, args: A.drop(process.argv, 1) })
    : O.none();

/**
 * The current process's {@link CiLaneProcess}.
 *
 * **Example** (Read the current process)
 *
 * ```ts
 * import { currentCiLaneProcess } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(currentCiLaneProcess)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const currentCiLaneProcess: Effect.Effect<CiLaneProcess, CiCommandError> = Config.all({
  githubActions: Config.option(Config.String("GITHUB_ACTIONS")),
  recorded: Config.option(Config.String(CI_LANE_RECORDED_ENV)),
}).pipe(
  Effect.map((markers) => CiLaneProcess.make({ ...markers, execPath: process.execPath, argv: process.argv })),
  CiCommandError.mapError("Failed to read the CI lane recording markers.")
);

/**
 * A finished lane child: the lane, its run id and start, how long it ran,
 * its exit code and the run's input fingerprint.
 *
 * **Example** (Describe a passing lane)
 *
 * ```ts
 * import { CiLaneRun } from "@beep/repo-cli/commands/Ci"
 * import * as DateTime from "effect/DateTime"
 *
 * const run = CiLaneRun.make({
 *   lane: "nix",
 *   runId: "20261122T100000000Z-0001",
 *   startedAt: DateTime.makeUnsafe(0),
 *   durationMs: 1200,
 *   exitCode: 0,
 *   inputFingerprint: "local:20261122T100000000Z-0001",
 * })
 * console.log(run.exitCode) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLaneRun extends S.Opaque<CiLaneRun, { readonly brand: unique symbol }>()(
  S.Struct({
    lane: Text,
    runId: RunId,
    startedAt: S.DateTimeUtc,
    durationMs: DurationMs,
    exitCode: S.Int,
    inputFingerprint: Text,
  }).pipe(
    $I.annoteSchema("CiLaneRun", {
      description: "A finished lane child: its lane, run id, start, duration, exit code and input fingerprint.",
    })
  )
) {}

/**
 * The record target of a lane run: a root run of {@link CI_LANE_GATE}.
 *
 * **Example** (Place a lane record)
 *
 * ```ts
 * import { ciLaneRecordTarget } from "@beep/repo-cli/commands/Ci"
 * import { recordLocation } from "@beep/repo-gate-record/GatePaths"
 *
 * console.log(recordLocation(ciLaneRecordTarget("20261122T100000000Z-0001")).record)
 * // ".beep/gates/lane/20261122T100000000Z-0001.json"
 * ```
 *
 * @param runId - The id the record and log files are named after.
 * @returns Where the run's record and log go.
 * @category utilities
 * @since 0.0.0
 */
export const ciLaneRecordTarget = (runId: RunId): RecordTarget =>
  RecordTarget.cases.RootTarget.make({ gate: CI_LANE_GATE, runId });

/**
 * The gate events of a lane run.
 *
 * **Details**
 *
 * A lane is one step. A zero exit is one passed step item; any other exit
 * states no item, so the reducer records the run as errored with a fault
 * whose message is the excerpt of the lane's own log, the most a lane that
 * wrote no structured result can say about its red.
 *
 * **Example** (A passing lane)
 *
 * ```ts
 * import { CiLaneRun, laneRunEvents } from "@beep/repo-cli/commands/Ci"
 * import * as DateTime from "effect/DateTime"
 *
 * const events = laneRunEvents(
 *   CiLaneRun.make({
 *     lane: "nix",
 *     runId: "20261122T100000000Z-0001",
 *     startedAt: DateTime.makeUnsafe(0),
 *     durationMs: 1200,
 *     exitCode: 0,
 *     inputFingerprint: "local:20261122T100000000Z-0001",
 *   })
 * )
 * console.log(events.map((event) => event._tag)) // ["RunStarted", "ItemFinished", "RunFinished"]
 * ```
 *
 * @param run - The finished lane child.
 * @returns The events the lane's record reduces from.
 * @category utilities
 * @since 0.0.0
 */
export const laneRunEvents = (run: CiLaneRun): ReadonlyArray<GateEvent> => [
  GateEvent.cases.RunStarted.make({
    runId: run.runId,
    gate: CI_LANE_GATE,
    subject: run.lane,
    itemKind: "step",
    startedAt: run.startedAt,
    inputFingerprint: run.inputFingerprint,
  }),
  ...(run.exitCode === 0
    ? [
        GateEvent.cases.ItemFinished.make({
          item: Item.make({
            key: ItemKey.cases.TestKey.make({ file: CI_LANE_GATE, fullName: run.lane }),
            unit: run.lane,
            path: [],
            name: `ci lane ${run.lane}`,
            outcome: "passed",
          }),
        }),
      ]
    : []),
  GateEvent.cases.RunFinished.make({
    durationMs: run.durationMs,
    reason: run.exitCode === 0 ? "passed" : "failed",
    exitCode: O.some(run.exitCode),
    collected: O.some(1),
  }),
];

/**
 * When each gate record a checkout holds was last written, by record path.
 *
 * **Example** (Inspect the reader)
 *
 * ```ts
 * import { gateRecordStamps } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(typeof gateRecordStamps) // "function"
 * ```
 *
 * @param repoRoot - The job's checkout.
 * @returns Each record's modification time in milliseconds.
 * @category use-cases
 * @since 0.0.0
 */
export const gateRecordStamps = Effect.fn("CiLaneRecording.gateRecordStamps")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const targets = yield* findJobGateRecordTargets(repoRoot);
  const stamps = yield* Effect.forEach(
    targets,
    Effect.fnUntraced(function* (target) {
      const record = recordLocation(target).record;
      const info = yield* fs
        .stat(path.join(repoRoot, record))
        .pipe(CiCommandError.mapError(`Failed to stat ${record}.`));
      return [
        record,
        O.getOrElse(
          O.map(info.mtime, (mtime) => mtime.getTime()),
          constant(0)
        ),
      ] as const;
    }),
    { concurrency: 1 }
  );
  return HashMap.fromIterable(stamps);
});

/**
 * Whether a step wrote a gate record: a record that is new, or that was
 * written again, between two {@link gateRecordStamps} readings.
 *
 * **Example** (A record restored by a cache hit)
 *
 * ```ts
 * import { stepWroteGateRecords } from "@beep/repo-cli/commands/Ci"
 * import * as HashMap from "effect/HashMap"
 *
 * const before = HashMap.make(["packages/a/.beep/gates/test/report.json", 1])
 * console.log(stepWroteGateRecords(before, HashMap.make(["packages/a/.beep/gates/test/report.json", 2]))) // true
 * console.log(stepWroteGateRecords(before, before)) // false
 * ```
 *
 * @param before - The stamps before the step.
 * @param after - The stamps after it.
 * @returns Whether any record was written during the step.
 * @category utilities
 * @since 0.0.0
 */
export const stepWroteGateRecords: {
  (after: HashMap.HashMap<string, number>): (before: HashMap.HashMap<string, number>) => boolean;
  (before: HashMap.HashMap<string, number>, after: HashMap.HashMap<string, number>): boolean;
} = dual(2, (before: HashMap.HashMap<string, number>, after: HashMap.HashMap<string, number>): boolean =>
  HashMap.some(after, (stamp, record) => !O.contains(HashMap.get(before, record), stamp))
);

/**
 * What one `ci lane` step records: the repository root, the lane, and the
 * command that runs the lane as the recorded child.
 *
 * **Example** (Request a recording)
 *
 * ```ts
 * import { CiLaneRecordingRequest, CiLaneSelfCommand } from "@beep/repo-cli/commands/Ci"
 *
 * const request = CiLaneRecordingRequest.make({
 *   repoRoot: "/home/alice/beep-effect",
 *   lane: "nix",
 *   self: CiLaneSelfCommand.make({ command: "bun", args: ["packages/tooling/tool/cli/src/bin.ts", "ci", "lane", "nix"] }),
 * })
 * console.log(request.lane) // "nix"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLaneRecordingRequest extends S.Opaque<CiLaneRecordingRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    repoRoot: S.NonEmptyString,
    lane: Text,
    self: CiLaneSelfCommand,
    drainGraceMs: DurationMs.pipe(S.withConstructorDefault(Effect.succeed(CI_LANE_DRAIN_GRACE_MS))),
  }).pipe(
    $I.annoteSchema("CiLaneRecordingRequest", {
      description:
        "The repository root, the lane, the command that runs it as the recorded child, and how long its output may outlive it.",
    })
  )
) {}

/**
 * What a recorded lane step did: the child's exit code, the annotation
 * commands its output wrote, and the lane record, when the step wrote none
 * of its own.
 *
 * **Example** (A step whose tests wrote their own records)
 *
 * ```ts
 * import { CiLaneRecording, emptyWorkflowCommandTally } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const recording = CiLaneRecording.make({ exitCode: 1, commands: emptyWorkflowCommandTally, record: O.none() })
 * console.log(recording.exitCode) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLaneRecording extends S.Opaque<CiLaneRecording, { readonly brand: unique symbol }>()(
  S.Struct({
    exitCode: S.Int,
    commands: WorkflowCommandTally,
    record: S.Option(RecordTarget),
  }).pipe(
    $I.annoteSchema("CiLaneRecording", {
      description: "A recorded lane step's exit code, its annotation commands and the lane record it wrote.",
    })
  )
) {}

/**
 * The lane recorder's operations.
 *
 * **Example** (Use the shape)
 *
 * ```ts
 * import type { CiLaneRecorderShape } from "@beep/repo-cli/commands/Ci"
 *
 * const recordOf = (recorder: CiLaneRecorderShape) => recorder.record
 * console.log(typeof recordOf) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface CiLaneRecorderShape {
  readonly record: (request: CiLaneRecordingRequest) => Effect.Effect<CiLaneRecording, CiCommandError>;
}

type RecorderContext = ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path | Stdio.Stdio;

const LANE_LOG = "lane.log";
const laneConsoleSettings = ConsoleSettings.make({ audience: "ci" });

const reportMeasurementFailure = (error: CiCommandError) =>
  Console.error(`[ci] lane recording: ${error.message}`).pipe(Effect.as(O.none<never>()));

const streamLane = Effect.fnUntraced(function* (request: CiLaneRecordingRequest, logFile: string) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const fs = yield* FileSystem.FileSystem;
  const stdio = yield* Stdio.Stdio;
  const scan = yield* Ref.make(WorkflowCommandScan.make({ carry: "", tally: emptyWorkflowCommandTally }));
  const decoder = new TextDecoder();
  const handle = yield* spawner.spawn(
    ChildProcess.make(request.self.command, request.self.args, {
      cwd: request.repoRoot,
      env: { [CI_LANE_RECORDED_ENV]: "1" },
      extendEnv: true,
    })
  );
  const drain = yield* Effect.forkScoped(
    handle.all.pipe(
      Stream.tap((chunk) => Stream.run(Stream.make(chunk), stdio.stdout())),
      Stream.tap((chunk) =>
        Ref.update(scan, (state) => scanWorkflowCommands(state, decoder.decode(chunk, { stream: true })))
      ),
      Stream.run(fs.sink(logFile))
    )
  );
  const exitCode = yield* handle.exitCode;
  const drained = yield* Fiber.join(drain).pipe(Effect.timeoutOption(Duration.millis(request.drainGraceMs)));
  if (O.isNone(drained)) {
    yield* Console.error(
      `[ci] ${request.lane}: the lane exited and its output stayed open ${request.drainGraceMs} ms more; its process group is stopped.`
    );
  }
  const scanned = yield* Ref.get(scan);
  return { exitCode, commands: finishWorkflowCommandScan(scanned) };
}, Effect.scoped);

const writeLaneRecord = Effect.fnUntraced(function* (repoRoot: string, run: CiLaneRun, logFile: string) {
  const fs = yield* FileSystem.FileSystem;
  const target = ciLaneRecordTarget(run.runId);
  yield* runGate(
    GateRunRequest.make({
      target,
      source: RunSource.cases.RunEvents.make({ events: laneRunEvents(run) }),
      exitCode: run.exitCode,
      subject: O.some(run.lane),
      pointers: O.some(repoPointerTableFor(target)),
    }),
    fs.stream(logFile)
  ).pipe(withGateServices(GateServicesConfig.make({ repoRoot, settings: laneConsoleSettings })));
  return target;
});

const recordLane = Effect.fn("CiLaneRecording.recordLane")(function* (request: CiLaneRecordingRequest) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const before = yield* Effect.result(gateRecordStamps(request.repoRoot));
  const runId = yield* makeRunId;
  const fingerprint = yield* inputFingerprint(runId).pipe(Effect.orElseSucceed(constant(`local:${runId}`)));
  const startedAt = yield* DateTime.now;
  const scratch = yield* fs
    .makeTempDirectoryScoped({ prefix: "beep-ci-lane-" })
    .pipe(CiCommandError.mapError("Failed to make the lane log's scratch directory."));
  const logFile = path.join(scratch, LANE_LOG);
  const streamed = yield* streamLane(request, logFile).pipe(
    CiCommandError.mapError(`Failed to run ${A.join([request.self.command, ...request.self.args], " ")}.`)
  );
  const finishedAt = yield* DateTime.now;
  const run = CiLaneRun.make({
    lane: request.lane,
    runId,
    startedAt,
    durationMs: Duration.toMillis(DateTime.distance(startedAt, finishedAt)),
    exitCode: streamed.exitCode,
    inputFingerprint: fingerprint,
  });
  yield* addAnnotationsUsed(request.repoRoot, shownAnnotationsOf(streamed.commands)).pipe(
    Effect.catchTag("CiCommandError", reportMeasurementFailure)
  );
  const record = yield* Effect.fromResult(before).pipe(
    Effect.flatMap((stamps) =>
      Effect.flatMap(gateRecordStamps(request.repoRoot), (after) =>
        stepWroteGateRecords(stamps, after)
          ? Effect.succeedNone
          : Effect.asSome(writeLaneRecord(request.repoRoot, run, logFile))
      )
    ),
    Effect.catchTag("CiCommandError", reportMeasurementFailure)
  );
  return CiLaneRecording.make({ exitCode: streamed.exitCode, commands: streamed.commands, record });
}, Effect.scoped);

/**
 * The lane recorder: runs a lane as a child process, streams and saves its
 * output, counts its annotation commands and records its verdict.
 *
 * **Details**
 *
 * Only running the child can fail the recording. Counting, searching the
 * checkout and writing the record are measurements: a failure there prints
 * one `[ci] lane recording:` line and the step keeps the child's exit code.
 *
 * **Example** (Provide the recorder)
 *
 * ```ts
 * import { CiLaneRecorder } from "@beep/repo-cli/commands/Ci"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(CiLaneRecorder.layer)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CiLaneRecorder extends Context.Service<CiLaneRecorder, CiLaneRecorderShape>()($I`CiLaneRecorder`) {
  /**
   * The recorder over the platform's process spawner, file system, path and
   * standard output.
   *
   * **Example** (Build the layer)
   *
   * ```ts
   * import { CiLaneRecorder } from "@beep/repo-cli/commands/Ci"
   * import * as Layer from "effect/Layer"
   *
   * console.log(Layer.isLayer(CiLaneRecorder.layer)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<CiLaneRecorder, never, RecorderContext> = Layer.effect(
    CiLaneRecorder,
    Effect.map(Effect.context<RecorderContext>(), (context) =>
      CiLaneRecorder.of({ record: flow(recordLane, Effect.provideContext(context)) })
    )
  );
}

/**
 * Run one hosted `ci lane` step as a recorded child and exit with the
 * child's exit code.
 *
 * **Example** (Inspect the use case)
 *
 * ```ts
 * import { recordCiLaneStep } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(typeof recordCiLaneStep) // "function"
 * ```
 *
 * @param request - The repository root, the lane and the command that runs it.
 * @returns Succeeds when the lane passed; fails with its exit code otherwise.
 * @category use-cases
 * @since 0.0.0
 */
export const recordCiLaneStep = Effect.fn("CiLaneRecording.recordCiLaneStep")(function* (
  request: CiLaneRecordingRequest
) {
  const recording = yield* (yield* CiLaneRecorder).record(request);
  return yield* exitWithTool(
    GateToolExit.make({ gate: CI_LANE_GATE, subject: request.lane, exitCode: recording.exitCode })
  );
});
