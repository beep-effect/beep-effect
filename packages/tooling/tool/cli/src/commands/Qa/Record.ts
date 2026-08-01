/**
 * The `beep qa record` orchestration for both capture lanes.
 *
 * One scope owns the whole session: the event collector, the discovery handle,
 * and either the spawned playwright harness (lane A) or the OBS recording
 * (lane B). Scope teardown is what makes Ctrl-C safe — the collector stops, the
 * handle file is removed, and `session.json` is finalized on the way out.
 *
 * The OBS layer is built inside the lane B branch on purpose: the playwright
 * lane must never require an obs-websocket connection to record.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { EnsureQaSceneRequest, Obs, StartRecordingRequest } from "@beep/obs";
import {
  ArtifactBudget,
  CaptureLane,
  CaptureSession,
  ClockSync,
  Collector,
  CollectorServeOptions,
  SessionManifest,
  SessionStore,
  Viewport,
} from "@beep/qa-capture";
import { SchemaUtils } from "@beep/schema";
import { A, O } from "@beep/utils";
import { Clock, Effect, FileSystem, Layer, Path } from "effect";
import * as S from "effect/Schema";
import { Socket } from "effect/unstable/socket";
import { readOptionalRedactedConfigString } from "../../internal/cli/EnvConfig.ts";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { printLines } from "../../internal/cli/Printer.ts";
import { runToExit } from "../../internal/process/index.ts";
import { artifactBudgetPath, writeArtifactBudget } from "./Extract.ts";
import { QaCommandError } from "./Qa.errors.ts";
import {
  CaptureTargetRequest,
  collectToolVersions,
  makeSessionId,
  qaRootPath,
  readCommitProvenance,
  readEventLog,
  recordHintPath,
  resolveCaptureTarget,
  resolveRound,
  writeRecordStartHint,
} from "./Qa.session.ts";
import type { CollectorRunning, RoundLayout, RoundNumber } from "@beep/qa-capture";
import type * as Scope from "effect/Scope";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { CliReportedExit } from "../../internal/cli/ExitCodeError.ts";
import type { QaRecordOptions } from "./Qa.schemas.ts";
import type { CaptureTarget, QaEventLog } from "./Qa.session.ts";

const $I = $RepoCliId.create("commands/Qa/Record");

const BYTES_PER_MIB = 1024 * 1024;
const DEFAULT_VIEWPORT = Viewport.make({ height: 1000, width: 1600 });
const OBS_PASSWORD_ENV = "OBS_WEBSOCKET_PASSWORD";

/**
 * Everything the lane A harness needs on its environment.
 *
 * @example
 * ```ts
 * import { HarnessEnvOptions } from "@beep/repo-cli/commands/Qa/Record"
 *
 * const options = HarnessEnvOptions.make({
 *   beacon: true,
 *   collectorUrl: "http://127.0.0.1:43117",
 *   cursor: true,
 *   round: 2,
 *   sessionId: "qa-round-2-1754000000000",
 *   url: "http://storybook.beep.localhost:1355/",
 *   videoDir: "/repo/.beep/qa/round-2/video"
 * })
 * console.log(options.round) // 2
 * ```
 * @category models
 * @since 0.0.0
 */
export class HarnessEnvOptions extends S.Class<HarnessEnvOptions>($I`HarnessEnvOptions`)(
  {
    beacon: S.Boolean.pipe(
      $I.annoteKey("HarnessEnvOptions.beacon", {
        description: "Whether the witness paints the clock-sync beacon.",
      })
    ),
    collectorUrl: S.String.pipe(
      $I.annoteKey("HarnessEnvOptions.collectorUrl", {
        description: "Base URL the witness posts events to.",
      })
    ),
    cursor: S.Boolean.pipe(
      $I.annoteKey("HarnessEnvOptions.cursor", {
        description: "Whether the witness renders its synthetic cursor overlay.",
      })
    ),
    round: S.Int.pipe(
      $I.annoteKey("HarnessEnvOptions.round", {
        description: "Round number the harness records into.",
      })
    ),
    sessionId: S.String.pipe(
      $I.annoteKey("HarnessEnvOptions.sessionId", {
        description: "Session identifier stamped into every artifact.",
      })
    ),
    url: S.String.pipe(
      $I.annoteKey("HarnessEnvOptions.url", {
        description: "Page the harness navigates to.",
      })
    ),
    videoDir: S.String.pipe(
      $I.annoteKey("HarnessEnvOptions.videoDir", {
        description: "Directory the harness writes its recorded video into.",
      })
    ),
  },
  $I.annote("HarnessEnvOptions", {
    description: "Inputs of the lane A harness environment contract.",
  })
) {}

/**
 * Environment the lane A harness is spawned with.
 *
 * These names are the contract with `.beep/qa-capture.mjs`; the template reads
 * exactly `QA_ROUND`, `QA_URL`, `QA_COLLECTOR_URL`, `QA_SESSION_ID`, and
 * `QA_VIDEO_DIR`. `QA_CURSOR` and `QA_BEACON` forward the witness feature
 * flags for templates that honour them.
 *
 * @param options - Collector URL, session identity, and the witness feature flags.
 * @returns The environment variables the harness template reads.
 * @example
 * ```ts
 * import { harnessEnv, HarnessEnvOptions } from "@beep/repo-cli/commands/Qa/Record"
 *
 * const env = harnessEnv(
 *   HarnessEnvOptions.make({
 *     beacon: true,
 *     collectorUrl: "http://127.0.0.1:43117",
 *     cursor: true,
 *     round: 2,
 *     sessionId: "qa-round-2-1754000000000",
 *     url: "http://storybook.beep.localhost:1355/",
 *     videoDir: "/repo/.beep/qa/round-2/video"
 *   })
 * )
 * console.log(env.QA_ROUND) // "2"
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const harnessEnv = (options: HarnessEnvOptions): Record<string, string> => ({
  QA_BEACON: options.beacon ? "1" : "0",
  QA_COLLECTOR_URL: options.collectorUrl,
  QA_CURSOR: options.cursor ? "1" : "0",
  QA_ROUND: `${options.round}`,
  QA_SESSION_ID: options.sessionId,
  QA_URL: options.url,
  QA_VIDEO_DIR: options.videoDir,
});

/**
 * How a recording lane finished.
 *
 * @example
 * ```ts
 * import { RecordOutcome } from "@beep/repo-cli/commands/Qa/Record"
 * import * as O from "effect/Option"
 *
 * const outcome = RecordOutcome.make({ exitCode: 0, recordStartEpochMs: O.none(), videoPath: O.none() })
 * console.log(outcome.exitCode) // 0
 * ```
 * @category models
 * @since 0.0.0
 */
export class RecordOutcome extends S.Class<RecordOutcome>($I`RecordOutcome`)(
  {
    exitCode: S.Int.pipe(
      $I.annoteKey("RecordOutcome.exitCode", {
        description: "Exit code the CLI mirrors; lane A propagates the harness exit.",
      })
    ),
    recordStartEpochMs: S.OptionFromOptionalKey(S.Finite).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("RecordOutcome.recordStartEpochMs", {
        description: "OBS RecordStateChanged STARTED receipt, the lane B clock anchor.",
      })
    ),
    videoPath: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("RecordOutcome.videoPath", {
        description: "Recorded container path, when the lane produced one.",
      })
    ),
  },
  $I.annote("RecordOutcome", {
    description: "How a recording lane finished.",
  })
) {}

/**
 * Fail a finished round that captured zero witness events.
 *
 * An event-less log means the witness was never injected or its posts were
 * silently dropped (wrong collector origin, rewritten content type), so the
 * round carries no gesture timeline for extraction to plan against. The
 * evidence already on disk stays for debugging; the round just must not
 * report as captured.
 *
 * @param eventLog - Decoded witness log of the finished round.
 * @returns An Effect failing with a reported nonzero exit when the log holds no events.
 * @example
 * ```ts
 * import { QaEventLog } from "@beep/repo-cli/commands/Qa/Qa.session"
 * import { requireCapturedEvents } from "@beep/repo-cli/commands/Qa/Record"
 * import { Effect } from "effect"
 *
 * const program = requireCapturedEvents(QaEventLog.make({ events: [], rejectedCount: 0 }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const requireCapturedEvents = (eventLog: QaEventLog): Effect.Effect<void, CliReportedExit> =>
  A.isReadonlyArrayEmpty(eventLog.events)
    ? failWithReportedExit(
        `qa record: 0 witness events captured (${eventLog.rejectedCount} rejected); the witness was not injected or its events were not delivered. See the qa-session-ops collector debugging checklist.`,
        1
      )
    : Effect.void;

const skeletonManifest = (options: {
  readonly commitDirty: boolean;
  readonly commitSha: string;
  readonly lane: "obs" | "playwright";
  readonly layout: RoundLayout;
  readonly scenario: O.Option<string>;
  readonly sessionId: string;
  readonly startedAtEpochMs: number;
  readonly toolVersions: Readonly<Record<string, string>>;
  readonly url: string;
}): SessionManifest =>
  SessionManifest.make({
    artifacts: [],
    clockSync: O.none(),
    eventsPath: options.layout.eventsPath,
    legacyManifestPath: O.none(),
    schemaVersion: "beep.qa.capture-session.v1",
    session: CaptureSession.make({
      commitDirty: options.commitDirty,
      commitSha: options.commitSha,
      id: options.sessionId,
      lane: options.lane,
      round: options.layout.round,
      scenario: options.scenario,
      startedAtEpochMs: options.startedAtEpochMs,
      toolVersions: options.toolVersions,
      url: options.url,
      viewport: DEFAULT_VIEWPORT,
    }),
    videoPath: O.none(),
  });

const runPlaywrightLane = Effect.fn("QaRecord.runPlaywrightLane")(function* (
  layout: RoundLayout,
  running: CollectorRunning,
  sessionId: string,
  target: CaptureTarget,
  options: QaRecordOptions
): Effect.fn.Return<
  RecordOutcome,
  QaCommandError,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> {
  const path = yield* Path.Path;
  const startedAtEpochMs = yield* Clock.currentTimeMillis;
  yield* writeRecordStartHint(recordHintPath(path, layout), startedAtEpochMs);

  yield* printLines([
    `qa record: lane playwright, round ${layout.round}`,
    `  collector: http://127.0.0.1:${running.port}`,
    `  harness: bun ${options.scenario}`,
    `  url: ${target.url}`,
    "",
  ]);

  const exitCode = yield* runToExit({
    args: [options.scenario],
    command: "bun",
    env: harnessEnv(
      HarnessEnvOptions.make({
        beacon: options.beacon,
        collectorUrl: `http://127.0.0.1:${running.port}`,
        cursor: options.cursor,
        round: layout.round,
        sessionId,
        url: target.url,
        videoDir: layout.videoDir,
      })
    ),
    extendEnv: true,
    stdio: "inherit",
  }).pipe(QaCommandError.mapError(`qa record could not spawn the capture harness at ${options.scenario}.`));

  const videoPath = path.join(layout.videoDir, "capture.webm");
  const fs = yield* FileSystem.FileSystem;
  const recorded = yield* fs.exists(videoPath).pipe(Effect.orElseSucceed(() => false));
  return RecordOutcome.make({
    exitCode,
    recordStartEpochMs: O.none(),
    videoPath: recorded ? O.some(videoPath) : O.none(),
  });
});

const obsLayer = Effect.fn("QaRecord.obsLayer")(function* () {
  const password = yield* readOptionalRedactedConfigString(OBS_PASSWORD_ENV).pipe(
    QaCommandError.mapError(`qa record could not read ${OBS_PASSWORD_ENV}.`)
  );
  return Obs.makeLayer({ password }).pipe(Layer.provide(Socket.layerWebSocketConstructorGlobal));
});

const runObsSession = Effect.fn("QaRecord.runObsSession")(function* (
  layout: RoundLayout,
  running: CollectorRunning,
  target: CaptureTarget,
  options: QaRecordOptions
): Effect.fn.Return<RecordOutcome, QaCommandError, Obs | Scope.Scope> {
  const obs = yield* Obs;
  const scene = yield* obs
    .ensureQaScene(EnsureQaSceneRequest.make({}))
    .pipe(QaCommandError.mapError("qa record could not provision the OBS capture scene."));
  const started = yield* obs
    .startRecording(StartRecordingRequest.make({ recordDirectory: layout.videoDir }))
    .pipe(QaCommandError.mapError("qa record could not start the OBS recording."));
  // Ctrl-C interrupts this fiber at `awaitStop`, before the sequential stop
  // below, and the scoped websocket teardown never sends StopRecord — so the
  // stop is also registered as a scope finalizer. After a normal stop the
  // redundant request fails inside OBS (output not active) and is swallowed.
  yield* Effect.addFinalizer(() => obs.stopRecording().pipe(Effect.ignore));

  yield* printLines([
    `qa record: lane obs, round ${layout.round}`,
    `  collector: http://127.0.0.1:${running.port}`,
    `  scene: ${scene.sceneName} / ${scene.inputName}`,
    `  url: ${target.url} (drive this page yourself)`,
    O.match(options.duration, {
      onNone: () => "  stop with: bun run beep qa stop",
      onSome: (seconds) => `  auto-stop in ${seconds}s, or stop with: bun run beep qa stop`,
    }),
    "",
  ]);

  yield* O.match(options.duration, {
    onNone: () => running.awaitStop,
    onSome: (seconds) => Effect.race(running.awaitStop, Effect.sleep(`${seconds} seconds`)),
  });

  const stopped = yield* obs
    .stopRecording()
    .pipe(QaCommandError.mapError("qa record could not stop the OBS recording."));
  return RecordOutcome.make({
    exitCode: 0,
    recordStartEpochMs: O.some(started.recordStartEpochMs),
    videoPath: O.some(stopped.outputPath),
  });
});

const runObsLane = Effect.fn("QaRecord.runObsLane")(function* (
  layout: RoundLayout,
  running: CollectorRunning,
  target: CaptureTarget,
  options: QaRecordOptions
): Effect.fn.Return<RecordOutcome, QaCommandError, ChildProcessSpawner.ChildProcessSpawner | Scope.Scope> {
  const layer = yield* obsLayer();
  // The OBS connection is built into the round's own scope rather than at the
  // CLI entry point, so the playwright lane never opens an obs-websocket
  // socket, and Ctrl-C tears the connection down with the collector.
  const context = yield* Layer.build(layer).pipe(
    Effect.catchTag("ObsError", (cause) =>
      Effect.fail(
        QaCommandError.new(
          cause,
          "qa record could not drive OBS on 127.0.0.1:4455. Enable the obs-websocket server in OBS settings (Tools > WebSocket Server Settings) and re-run `bun run beep qa doctor`."
        )
      )
    )
  );
  return yield* runObsSession(layout, running, target, options).pipe(Effect.provideContext(context));
});

const serveAndRun = Effect.fn("QaRecord.serveAndRun")(function* (
  layout: RoundLayout,
  qaRoot: string,
  round: RoundNumber,
  sessionId: string,
  target: CaptureTarget,
  options: QaRecordOptions
) {
  const collector = yield* Collector;
  const store = yield* SessionStore;
  const running = yield* collector
    .serve(
      CollectorServeOptions.make({
        allowedOrigins: target.allowedOrigins,
        eventsPath: layout.eventsPath,
        handlePath: O.some(store.collectorHandlePath(qaRoot)),
        port: options.port,
        round,
        sessionDir: layout.root,
        sessionId,
      })
    )
    .pipe(QaCommandError.mapError("qa record could not start the witness collector."));

  return yield* CaptureLane.$match(options.lane, {
    obs: () => runObsLane(layout, running, target, options),
    playwright: () => runPlaywrightLane(layout, running, sessionId, target, options),
  });
});

/**
 * Record one QA round on the selected lane.
 *
 * @example
 * ```ts
 * import { runQaRecord } from "@beep/repo-cli/commands/Qa/Record"
 * import { QaRecordOptions } from "@beep/repo-cli/commands/Qa/Qa.schemas"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const options = QaRecordOptions.make({
 *   app: O.some("storybook"),
 *   beacon: true,
 *   budgetMb: 20,
 *   cursor: true,
 *   duration: O.none(),
 *   lane: "playwright",
 *   port: 43117,
 *   round: O.none(),
 *   scenario: ".beep/qa-capture.mjs",
 *   url: O.none()
 * })
 * console.log(Effect.isEffect(runQaRecord("/repo", options))) // true
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const runQaRecord = Effect.fn("QaRecord.run")(function* (
  cwd: string,
  options: QaRecordOptions
): Effect.fn.Return<
  void,
  CliReportedExit | QaCommandError,
  ChildProcessSpawner.ChildProcessSpawner | Collector | FileSystem.FileSystem | Path.Path | SessionStore
> {
  const path = yield* Path.Path;
  const store = yield* SessionStore;

  const qaRoot = qaRootPath(path, cwd);
  const round = yield* resolveRound(qaRoot, options.round);
  const layout = yield* store
    .prepareRound(qaRoot, round)
    .pipe(QaCommandError.mapError(`qa record could not prepare ${qaRoot}/round-${round}.`));
  const target = yield* resolveCaptureTarget(CaptureTargetRequest.make({ app: options.app, url: options.url }));
  yield* writeArtifactBudget(
    artifactBudgetPath(path, layout),
    ArtifactBudget.make({ maxTotalBytes: options.budgetMb * BYTES_PER_MIB })
  );

  const startedAtEpochMs = yield* Clock.currentTimeMillis;
  const sessionId = makeSessionId(round, startedAtEpochMs);
  const [commit, toolVersions] = yield* Effect.all([readCommitProvenance(cwd), collectToolVersions()], {
    concurrency: 2,
  });

  const skeleton = skeletonManifest({
    commitDirty: commit.dirty,
    commitSha: commit.sha,
    lane: options.lane,
    layout,
    scenario: CaptureLane.$match(options.lane, {
      obs: O.none<string>,
      playwright: () => O.some(options.scenario),
    }),
    sessionId,
    startedAtEpochMs,
    toolVersions,
    url: target.url,
  });
  yield* store
    .writeSessionManifest(layout, skeleton)
    .pipe(QaCommandError.mapError(`qa record could not write ${layout.sessionPath}.`));

  const outcome = yield* Effect.scoped(serveAndRun(layout, qaRoot, round, sessionId, target, options));

  const eventLog = yield* readEventLog(layout.eventsPath);
  const finalized = SessionManifest.make({
    artifacts: [],
    clockSync: O.map(outcome.recordStartEpochMs, (epochMs) =>
      ClockSync.make({
        confidence: "medium",
        method: "obs-record-state",
        offsetMs: -epochMs,
        residualRmsMs: 0,
        slope: 1,
      })
    ),
    eventsPath: layout.eventsPath,
    legacyManifestPath: O.none(),
    schemaVersion: "beep.qa.capture-session.v1",
    session: skeleton.session,
    videoPath: outcome.videoPath,
  });
  yield* store
    .writeSessionManifest(layout, finalized)
    .pipe(QaCommandError.mapError(`qa record could not finalize ${layout.sessionPath}.`));

  yield* printLines([
    "",
    `qa record: round ${layout.round} captured`,
    `  events: ${A.length(eventLog.events)} (${eventLog.rejectedCount} rejected)`,
    `  video: ${O.getOrElse(outcome.videoPath, () => "none")}`,
    `  session: ${layout.sessionPath}`,
    `  next: bun run beep qa extract --session ${layout.root}`,
  ]);

  if (outcome.exitCode !== 0) {
    return yield* failWithReportedExit(`qa record: harness exited ${outcome.exitCode}`, outcome.exitCode);
  }
  // The harness exit is mirrored first (the more specific diagnosis); a clean
  // exit with an empty witness log is still an incomplete round.
  yield* requireCapturedEvents(eventLog);
});
