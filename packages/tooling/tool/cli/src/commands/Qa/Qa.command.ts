/**
 * The `beep qa` command group: record, control, extract, report, judge.
 *
 * One registry owns the whole recorded-QA loop so the lane, the round layout,
 * and the driver layers stay consistent across every step. Handlers decode
 * their flags into {@link QaRecordOptions} and friends before doing anything,
 * so a bad `--round` fails with a schema message instead of a stack trace.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Exiftool } from "@beep/exiftool";
import { FFmpeg } from "@beep/ffmpeg";
import { CaptureLane, ClockCorrelator, Collector, ExtractionRuleSet, SessionStore, Witness } from "@beep/qa-capture";
import { A } from "@beep/utils";
import { Effect, Layer, Path } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { printLines } from "../../internal/cli/Printer.ts";
import { markLiveSession, stopLiveSession } from "./Control.ts";
import { isBlockingProbe, renderDoctorReport, runQaDoctor } from "./Doctor.ts";
import { runQaExtract } from "./Extract.ts";
import { runQaJudgeIngest } from "./JudgeIngest.ts";
import { runQaJudgeLint } from "./JudgeLint.ts";
import { runQaJudgePack } from "./JudgePack.ts";
import { QaCommandError } from "./Qa.errors.ts";
import {
  DEFAULT_SCENARIO_PATH,
  decodeQaExtractOptions,
  decodeQaJudgeIngestOptions,
  decodeQaJudgeLintOptions,
  decodeQaJudgePackOptions,
  decodeQaMarkOptions,
  decodeQaRecordOptions,
  decodeQaReportOptions,
} from "./Qa.schemas.ts";
import { qaRootPath } from "./Qa.session.ts";
import { runQaRecord } from "./Record.ts";
import { runQaReport } from "./Report.ts";

const FFmpegLive = FFmpeg.makeLayer();

/**
 * Layer stack shared by every `beep qa` subcommand.
 *
 * **Details**
 *
 * `Witness` and `FFmpeg` are provided once and merged out again so the
 * collector, the clock correlator, and the extraction pipeline all observe the
 * same memoized instances.
 *
 * **Example** (Verify shared QA layers)
 *
 * ```ts
 * import { QaCommandLayers } from "@beep/repo-cli/commands/Qa/Qa.command"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(QaCommandLayers)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const QaCommandLayers = Layer.mergeAll(
  ClockCorrelator.layer,
  Collector.layer,
  Exiftool.makeLayer(),
  SessionStore.layer
).pipe(Layer.provideMerge(Layer.mergeAll(FFmpegLive, Witness.layer)));

const laneFlag = Flag.choice("lane", CaptureLane.Options).pipe(
  Flag.withDescription("Recording lane: playwright drives a headless harness, obs records a real window"),
  Flag.withDefault(CaptureLane.Enum.playwright)
);
const urlFlag = Flag.string("url").pipe(
  Flag.withDescription("Absolute URL to capture; takes precedence over --app"),
  Flag.optional
);
const appFlag = Flag.string("app").pipe(
  Flag.withDescription(
    "Portless app name; apps expand to http://<app>.beep.localhost:1355, labs (apps/labs/<app>) to http://<app>.labs.beep.localhost:1355"
  ),
  Flag.optional
);
const roundFlag = Flag.integer("round").pipe(
  Flag.withDescription("Round number; defaults to the next free round under .beep/qa"),
  Flag.optional
);
const requiredRoundFlag = Flag.integer("round").pipe(Flag.withDescription("Round number under .beep/qa"));
const scenarioFlag = Flag.string("scenario").pipe(
  Flag.withDescription("Playwright capture harness spawned with bun"),
  Flag.withDefault(DEFAULT_SCENARIO_PATH)
);
const durationFlag = Flag.integer("duration").pipe(
  Flag.withDescription("Auto-stop the obs lane after this many seconds"),
  Flag.optional
);
const portFlag = Flag.integer("port").pipe(
  Flag.withDescription("Collector bind port; 0 requests an ephemeral port"),
  Flag.withDefault(43117)
);
const cursorFlag = Flag.boolean("cursor").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Render the witness cursor dot (disable with --no-cursor)"),
  Flag.withDefault(true)
);
const beaconFlag = Flag.boolean("beacon").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Run the clock sync beacon (disable with --no-beacon)"),
  Flag.withDefault(true)
);
const recordBudgetFlag = Flag.integer("budget-mb").pipe(
  Flag.withDescription("Artifact budget in MiB recorded for this round's extraction"),
  Flag.withDefault(20)
);
const extractBudgetFlag = Flag.integer("budget-mb").pipe(
  Flag.withDescription("Artifact budget in MiB; defaults to the budget recorded with the round"),
  Flag.optional
);
const sessionFlag = Flag.directory("session", { mustExist: true }).pipe(
  Flag.withDescription("Round directory to operate on; defaults to the latest recorded round"),
  Flag.optional
);
const rulesFlag = Flag.fileSchema("rules", ExtractionRuleSet, { format: "json" }).pipe(
  Flag.withDescription("Extraction rule set overriding the defaults"),
  Flag.optional
);
const dryRunFlag = Flag.boolean("dry-run").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print and persist the extraction plan without running any driver")
);
const surfaceFlag = Flag.string("surface").pipe(
  Flag.withDescription("Surface name rendered into the judge prompt; defaults to the recorded URL"),
  Flag.optional
);
const fromFlag = Flag.file("from", { mustExist: true }).pipe(
  Flag.withDescription("File holding the judge transcript; the last fenced JSON block is ingested")
);
const dataFlag = Flag.string("data").pipe(
  Flag.withDescription("Extra text appended to the marker label (witness markers carry a label only)"),
  Flag.optional
);
const labelArgument = Argument.string("label").pipe(
  Argument.withDescription("Marker label, conventionally scenario:<name> or gesture:<name>")
);

const printQaIndex = () =>
  printLines(["qa commands: record, stop, mark, extract, report, doctor, judge-pack, judge-ingest, judge-lint"]);

const runRecordCommand = Effect.fn("QaCommand.record")(function* (options: unknown) {
  const decoded = yield* decodeQaRecordOptions(options).pipe(QaCommandError.mapError("Invalid `qa record` options."));
  yield* runQaRecord(process.cwd(), decoded);
});

const runStopCommand = Effect.fn("QaCommand.stop")(function* () {
  const path = yield* Path.Path;
  const handle = yield* stopLiveSession(qaRootPath(path, process.cwd()));
  yield* printLines([`qa stop: asked the round ${handle.round} collector on port ${handle.port} to stop`]);
});

const runMarkCommand = Effect.fn("QaCommand.mark")(function* (options: unknown) {
  const path = yield* Path.Path;
  const decoded = yield* decodeQaMarkOptions(options).pipe(QaCommandError.mapError("Invalid `qa mark` options."));
  const accepted = yield* markLiveSession(qaRootPath(path, process.cwd()), decoded.label, decoded.data);
  yield* printLines([`qa mark: appended "${decoded.label}" as seq ${accepted.seq}`]);
});

const runExtractCommand = Effect.fn("QaCommand.extract")(function* (options: unknown) {
  const decoded = yield* decodeQaExtractOptions(options).pipe(QaCommandError.mapError("Invalid `qa extract` options."));
  const outcome = yield* runQaExtract(process.cwd(), decoded);
  if (A.isReadonlyArrayNonEmpty(outcome.failures)) {
    return yield* failWithReportedExit(
      `qa extract: ${A.length(outcome.failures)} driver or provenance step(s) failed`,
      1
    );
  }
});

const runReportCommand = Effect.fn("QaCommand.report")(function* (options: unknown) {
  const decoded = yield* decodeQaReportOptions(options).pipe(QaCommandError.mapError("Invalid `qa report` options."));
  yield* runQaReport(process.cwd(), decoded);
});

const runDoctorCommand = Effect.fn("QaCommand.doctor")(function* () {
  const probes = yield* runQaDoctor();
  yield* printLines(renderDoctorReport(probes));
  const blocking = A.filter(probes, isBlockingProbe);
  if (A.isReadonlyArrayNonEmpty(blocking)) {
    return yield* failWithReportedExit(`qa doctor: ${A.length(blocking)} required tool(s) missing`, 1);
  }
});

const runJudgePackCommand = Effect.fn("QaCommand.judgePack")(function* (options: unknown) {
  const decoded = yield* decodeQaJudgePackOptions(options).pipe(
    QaCommandError.mapError("Invalid `qa judge-pack` options.")
  );
  yield* runQaJudgePack(process.cwd(), decoded);
});

const runJudgeIngestCommand = Effect.fn("QaCommand.judgeIngest")(function* (options: unknown) {
  const decoded = yield* decodeQaJudgeIngestOptions(options).pipe(
    QaCommandError.mapError("Invalid `qa judge-ingest` options.")
  );
  yield* runQaJudgeIngest(process.cwd(), decoded);
});

const runJudgeLintCommand = Effect.fn("QaCommand.judgeLint")(function* (options: unknown) {
  const decoded = yield* decodeQaJudgeLintOptions(options).pipe(
    QaCommandError.mapError("Invalid `qa judge-lint` options.")
  );
  yield* runQaJudgeLint(process.cwd(), decoded);
});

const qaRecordCommand = Command.make(
  "record",
  {
    app: appFlag,
    beacon: beaconFlag,
    budgetMb: recordBudgetFlag,
    cursor: cursorFlag,
    duration: durationFlag,
    lane: laneFlag,
    port: portFlag,
    round: roundFlag,
    scenario: scenarioFlag,
    url: urlFlag,
  },
  runRecordCommand
).pipe(
  Command.withDescription("Record a QA round: witness collector plus a playwright harness or an OBS capture"),
  Command.provide(QaCommandLayers)
);

const qaStopCommand = Command.make("stop", {}, runStopCommand).pipe(
  Command.withDescription("Stop the live QA capture session"),
  Command.provide(QaCommandLayers)
);

const qaMarkCommand = Command.make("mark", { data: dataFlag, label: labelArgument }, runMarkCommand).pipe(
  Command.withDescription("Append a semantic marker to the live session's witness log"),
  Command.provide(QaCommandLayers)
);

const qaExtractCommand = Command.make(
  "extract",
  {
    budgetMb: extractBudgetFlag,
    dryRun: dryRunFlag,
    rules: rulesFlag,
    session: sessionFlag,
  },
  runExtractCommand
).pipe(
  Command.withDescription("Correlate the clock, plan windows, render evidence, and stamp provenance"),
  Command.provide(QaCommandLayers)
);

const qaReportCommand = Command.make("report", { session: sessionFlag }, runReportCommand).pipe(
  Command.withDescription("Re-render a round's report.md from session.json"),
  Command.provide(QaCommandLayers)
);

const qaDoctorCommand = Command.make("doctor", {}, runDoctorCommand).pipe(
  Command.withDescription("Probe ffmpeg, ffprobe, exiftool, playwright, and obs-websocket"),
  Command.provide(QaCommandLayers)
);

const qaJudgePackCommand = Command.make(
  "judge-pack",
  { round: requiredRoundFlag, surface: surfaceFlag },
  runJudgePackCommand
).pipe(
  Command.withDescription("Build a round's judge/ bundle: timeline.md, manifest.json, prompt.md"),
  Command.provide(QaCommandLayers)
);

const qaJudgeIngestCommand = Command.make(
  "judge-ingest",
  { from: fromFlag, round: requiredRoundFlag },
  runJudgeIngestCommand
).pipe(
  Command.withDescription("Decode a judge transcript into inventory.json and inventory.md"),
  Command.provide(QaCommandLayers)
);

const qaJudgeLintCommand = Command.make("judge-lint", { round: requiredRoundFlag }, runJudgeLintCommand).pipe(
  Command.withDescription("Re-validate a round's inventory.json against its evidence"),
  Command.provide(QaCommandLayers)
);

/**
 * Recorded-QA command group.
 *
 * **Example** (Run recorded QA command)
 *
 * ```ts
 * import { qaCommand } from "@beep/repo-cli/commands/Qa/index"
 * import { Command } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const run = Command.run(qaCommand, { version: "0.0.0" })
 * console.log(Effect.isEffect(run)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const qaCommand = Command.make("qa", {}, printQaIndex).pipe(
  Command.withDescription("Recorded UI verification: capture, extract, and judge motion evidence"),
  Command.withSubcommands(
    A.make(
      qaRecordCommand,
      qaStopCommand,
      qaMarkCommand,
      qaExtractCommand,
      qaReportCommand,
      qaDoctorCommand,
      qaJudgePackCommand,
      qaJudgeIngestCommand,
      qaJudgeLintCommand
    )
  )
);
