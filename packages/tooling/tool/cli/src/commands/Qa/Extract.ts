/**
 * The `beep qa extract` pipeline: correlate, plan, render, stamp, report.
 *
 * Extraction is deliberately record-less: it reads a round directory produced
 * by `beep qa record` (or hand-assembled) and needs no live browser. The order
 * is fixed — decode events, derive a {@link ClockSync}, plan windows, run the
 * ffmpeg driver requests, embed provenance in every produced artifact, then
 * update `session.json` and re-render `report.md`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { BeepQaProvenance, Exiftool, ExiftoolWritableExtension, WriteXmpPacketRequest } from "@beep/exiftool";
import {
  ExtractClipRequest,
  FFmpeg,
  MetadataPair,
  ProbeVideoRequest,
  WriteContainerMetadataRequest,
} from "@beep/ffmpeg";
import { $RepoCliId } from "@beep/identity/packages";
import {
  ArtifactBudget,
  BeaconEvent,
  BuildExtractionPlanOptions,
  buildExtractionPlan,
  CaptureArtifact,
  ClockCorrelator,
  CorrelateClockRequest,
  decodeExtractionPlan,
  defaultExtractionRules,
  encodeExtractionPlanJson,
  PlanDriverRequestsOptions,
  planDriverRequests,
  RoundNumber,
  SessionManifest,
  SessionStore,
} from "@beep/qa-capture";
import { A, O, Str } from "@beep/utils";
import { Console, Effect, FileSystem, flow, Match, Number as N, Path, pipe } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { printLines } from "../../internal/cli/Printer.ts";
import { QaCommandError } from "./Qa.errors.ts";
import { renderExtractionPlanTable, renderRoundReport } from "./Qa.render.ts";
import {
  discoverRecordedVideo,
  qaRootPath,
  readEventLog,
  readRecordStartHint,
  recordHintPath,
  resolveExistingRound,
} from "./Qa.session.ts";
import type { CaptureSession, ClockSync, ExtractionPlan, QaDriverRequest, RoundLayout } from "@beep/qa-capture";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { QaExtractOptions } from "./Qa.schemas.ts";

const $I = $RepoCliId.create("commands/Qa/Extract");

const BYTES_PER_MIB = 1024 * 1024;
const NORMALIZED_VIDEO_NAME = "normalized.mp4";
const NORMALIZE_TAIL_PAD_SECONDS = 5;
const EXTRACTION_PLAN_FILE = "extraction-plan.json";
const ARTIFACT_BUDGET_FILE = "artifact-budget.json";
const ArtifactBudgetJson = S.fromJsonString(ArtifactBudget);

const isWritableByExiftool = S.is(ExiftoolWritableExtension);
const isBeaconEvent = S.is(BeaconEvent);
const CONTAINER_EXTENSIONS: ReadonlyArray<string> = ["mkv", "mp4", "webm"];

/**
 * Path of the sidecar extraction plan a round's last extract wrote.
 *
 * The capture-session manifest has no plan field, so the plan lives beside it
 * and `beep qa report` reads it back to render dropped windows and budget use.
 *
 * @example
 * ```ts
 * import { RoundLayout } from "@beep/qa-capture"
 * import { extractionPlanPath } from "@beep/repo-cli/commands/Qa/Extract"
 * import { Effect, Path } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const path = yield* Path.Path
 *   const layout = RoundLayout.make({
 *     clipsDir: "/repo/.beep/qa/round-1/clips",
 *     eventsPath: "/repo/.beep/qa/round-1/events.ndjson",
 *     framesDir: "/repo/.beep/qa/round-1/frames",
 *     reportPath: "/repo/.beep/qa/round-1/report.md",
 *     root: "/repo/.beep/qa/round-1",
 *     round: 1,
 *     sessionPath: "/repo/.beep/qa/round-1/session.json",
 *     sheetsDir: "/repo/.beep/qa/round-1/sheets",
 *     videoDir: "/repo/.beep/qa/round-1/video"
 *   })
 *   return extractionPlanPath(path, layout)
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const extractionPlanPath: {
  (layout: RoundLayout): (path: Path.Path) => string;
  (path: Path.Path, layout: RoundLayout): string;
} = dual(2, (path: Path.Path, layout: RoundLayout): string => path.join(layout.root, EXTRACTION_PLAN_FILE));

/**
 * Path of the round artifact budget `beep qa record --budget-mb` persisted.
 *
 * The capture-session manifest has no budget field, so the recorder's choice
 * lives beside it and becomes the default the next `qa extract` plans against.
 *
 * @example
 * ```ts
 * import { RoundLayout } from "@beep/qa-capture"
 * import { artifactBudgetPath } from "@beep/repo-cli/commands/Qa/Extract"
 * import { Effect, Path } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const path = yield* Path.Path
 *   const layout = RoundLayout.make({
 *     clipsDir: "/repo/.beep/qa/round-1/clips",
 *     eventsPath: "/repo/.beep/qa/round-1/events.ndjson",
 *     framesDir: "/repo/.beep/qa/round-1/frames",
 *     reportPath: "/repo/.beep/qa/round-1/report.md",
 *     root: "/repo/.beep/qa/round-1",
 *     round: 1,
 *     sessionPath: "/repo/.beep/qa/round-1/session.json",
 *     sheetsDir: "/repo/.beep/qa/round-1/sheets",
 *     videoDir: "/repo/.beep/qa/round-1/video"
 *   })
 *   return artifactBudgetPath(path, layout)
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const artifactBudgetPath: {
  (layout: RoundLayout): (path: Path.Path) => string;
  (path: Path.Path, layout: RoundLayout): string;
} = dual(2, (path: Path.Path, layout: RoundLayout): string => path.join(layout.root, ARTIFACT_BUDGET_FILE));

/**
 * Persist the round artifact budget chosen at record time.
 *
 * @example
 * ```ts
 * import { ArtifactBudget } from "@beep/qa-capture"
 * import { writeArtifactBudget } from "@beep/repo-cli/commands/Qa/Extract"
 * import { Effect } from "effect"
 *
 * const program = writeArtifactBudget("/repo/.beep/qa/round-1/artifact-budget.json", ArtifactBudget.make({}))
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const writeArtifactBudget = Effect.fn("QaExtract.writeArtifactBudget")(function* (
  budgetPath: string,
  budget: ArtifactBudget
): Effect.fn.Return<void, QaCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const json = yield* S.encodeEffect(ArtifactBudgetJson)(budget).pipe(
    QaCommandError.mapError("qa could not encode the round artifact budget.")
  );
  yield* fs.writeFileString(budgetPath, json).pipe(QaCommandError.mapError(`qa could not write ${budgetPath}.`));
});

/**
 * Read the round artifact budget, when record persisted one.
 *
 * @example
 * ```ts
 * import { readArtifactBudget } from "@beep/repo-cli/commands/Qa/Extract"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(readArtifactBudget("/repo/.beep/qa/round-1/artifact-budget.json"))) // true
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const readArtifactBudget = Effect.fn("QaExtract.readArtifactBudget")(function* (
  budgetPath: string
): Effect.fn.Return<O.Option<ArtifactBudget>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs
    .readFileString(budgetPath)
    .pipe(
      Effect.flatMap(S.decodeUnknownEffect(ArtifactBudgetJson)),
      Effect.map(O.some),
      Effect.orElseSucceed(O.none<ArtifactBudget>)
    );
});

/**
 * Read the sidecar extraction plan, when a previous extract wrote one.
 *
 * @example
 * ```ts
 * import { readExtractionPlan } from "@beep/repo-cli/commands/Qa/Extract"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(readExtractionPlan("/repo/.beep/qa/round-1/extraction-plan.json"))) // true
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const readExtractionPlan = Effect.fn("QaExtract.readExtractionPlan")(function* (
  planPath: string
): Effect.fn.Return<O.Option<ExtractionPlan>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs
    .readFileString(planPath)
    .pipe(
      Effect.flatMap(S.decodeUnknownEffect(S.UnknownFromJsonString)),
      Effect.flatMap(decodeExtractionPlan),
      Effect.map(O.some),
      Effect.orElseSucceed(O.none<ExtractionPlan>)
    );
});

const roundNumberOfDirName: (base: string) => O.Option<number> = flow(
  Str.match(/^round-([0-9]+)$/),
  O.flatMap((groups) => A.get(groups, 1)),
  O.flatMap(N.parse)
);

const layoutOfSessionDir = Effect.fnUntraced(function* (
  resolved: string
): Effect.fn.Return<RoundLayout, QaCommandError, Path.Path | SessionStore> {
  const path = yield* Path.Path;
  const store = yield* SessionStore;
  const round = yield* O.match(roundNumberOfDirName(path.basename(resolved)), {
    onNone: () =>
      Effect.fail(
        QaCommandError.make({
          message: `qa --session expects a round-N directory under .beep/qa; got "${resolved}".`,
        })
      ),
    onSome: (value) =>
      S.decodeUnknownEffect(RoundNumber)(value).pipe(
        QaCommandError.mapError(`qa --session directory "${resolved}" has an invalid round number.`)
      ),
  });
  return store.roundLayout(path.dirname(resolved), round);
});

/**
 * Resolve the round directory an extract or report command operates on.
 *
 * An explicit `--session` directory must still be a `round-N` directory under a
 * `.beep/qa` root; anything else would break the round-relative paths every
 * downstream artifact reference depends on.
 *
 * @example
 * ```ts
 * import { resolveRoundLayout } from "@beep/repo-cli/commands/Qa/Extract"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * console.log(Effect.isEffect(resolveRoundLayout("/repo", O.none()))) // true
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const resolveRoundLayout = Effect.fn("QaExtract.resolveRoundLayout")(function* (
  cwd: string,
  session: O.Option<string>
): Effect.fn.Return<RoundLayout, QaCommandError, Path.Path | SessionStore> {
  const path = yield* Path.Path;
  const store = yield* SessionStore;
  return yield* O.match(session, {
    onNone: () =>
      Effect.map(resolveExistingRound(qaRootPath(path, cwd), O.none()), (round) =>
        store.roundLayout(qaRootPath(path, cwd), round)
      ),
    onSome: (dir) => layoutOfSessionDir(path.resolve(dir)),
  });
});

const eventSpanSeconds = (events: ReadonlyArray<{ readonly tEpochMs: number }>): number =>
  pipe(
    O.all([A.head(A.map(events, (event) => event.tEpochMs)), A.last(A.map(events, (event) => event.tEpochMs))]),
    O.match({
      onNone: () => 0,
      onSome: ([first, last]) => Math.max(0, (last - first) / 1000),
    })
  );

const probeDuration = Effect.fn("QaExtract.probeDuration")(function* (videoPath: string) {
  const ffmpeg = yield* FFmpeg;
  const probe = yield* ffmpeg.probeVideo(ProbeVideoRequest.make({ videoPath }));
  return probe.durationSeconds;
});

/**
 * A round's video prepared for frame-accurate extraction.
 *
 * Playwright's live-muxed webm carries no container duration, which makes
 * contact-sheet tiling fail and seeking unreliable. When the probe reports no
 * duration the video is remuxed once to h264/mp4 and every later op reads that
 * copy instead.
 *
 * @example
 * ```ts
 * import { PreparedVideo } from "@beep/repo-cli/commands/Qa/Extract"
 *
 * const prepared = PreparedVideo.make({
 *   durationSeconds: 42.5,
 *   normalized: true,
 *   path: "/repo/.beep/qa/round-1/video/normalized.mp4"
 * })
 * console.log(prepared.normalized) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class PreparedVideo extends S.Class<PreparedVideo>($I`PreparedVideo`)(
  {
    durationSeconds: S.Finite.pipe(
      $I.annoteKey("PreparedVideo.durationSeconds", {
        description: "Container duration the planner maps event epochs onto.",
      })
    ),
    normalized: S.Boolean.pipe(
      $I.annoteKey("PreparedVideo.normalized", {
        description: "Whether the source needed a remux to gain a usable duration.",
      })
    ),
    path: S.String.pipe(
      $I.annoteKey("PreparedVideo.path", {
        description: "Video path every extraction op reads.",
      })
    ),
  },
  $I.annote("PreparedVideo", {
    description: "A round's video prepared for frame-accurate extraction.",
  })
) {}

const normalizeVideo = Effect.fn("QaExtract.normalizeVideo")(function* (
  layout: RoundLayout,
  videoPath: string,
  estimatedSeconds: number
) {
  const ffmpeg = yield* FFmpeg;
  const path = yield* Path.Path;
  const outPath = path.join(layout.videoDir, NORMALIZED_VIDEO_NAME);
  yield* ffmpeg.extractClip(
    ExtractClipRequest.make({
      codec: "h264",
      durationSeconds: Math.max(1, estimatedSeconds + NORMALIZE_TAIL_PAD_SECONDS),
      outPath,
      overwrite: true,
      startSeconds: 0,
      videoPath,
    })
  );
  const normalizedDuration = yield* probeDuration(outPath);
  return PreparedVideo.make({
    durationSeconds: O.getOrElse(normalizedDuration, () => Math.max(1, estimatedSeconds)),
    normalized: true,
    path: outPath,
  });
});

const prepareVideo = Effect.fn("QaExtract.prepareVideo")(function* (
  layout: RoundLayout,
  videoPath: string,
  estimatedSeconds: number
) {
  const duration = yield* probeDuration(videoPath);
  return yield* O.match(duration, {
    onNone: () => normalizeVideo(layout, videoPath, estimatedSeconds),
    onSome: (seconds) =>
      Effect.succeed(
        PreparedVideo.make({ durationSeconds: Math.max(seconds, 0.001), normalized: false, path: videoPath })
      ),
  });
});

const windowIndexOfLabel: (label: string) => O.Option<number> = flow(
  Str.match(/-w([0-9]+)$/),
  O.flatMap((groups) => A.get(groups, 1)),
  O.flatMap(N.parse)
);

/**
 * Recover the witness sequence numbers an artifact label was planned from.
 *
 * `planDriverRequests` names every artifact `<ruleKind>-w<index>`, so the
 * planned window — and therefore its source events — is recoverable from the
 * produced filename without threading a parallel index through the drivers.
 *
 * @example
 * ```ts
 * import { ArtifactBudget, ExtractionPlan } from "@beep/qa-capture"
 * import { windowSeqsForLabel } from "@beep/repo-cli/commands/Qa/Extract"
 *
 * const plan = ExtractionPlan.make({
 *   budget: ArtifactBudget.make({}),
 *   dropped: [],
 *   estimatedTotalBytes: 0,
 *   schemaVersion: "beep.qa.extraction-plan.v1",
 *   windows: []
 * })
 * console.log(windowSeqsForLabel(plan, "drag-w0").length) // 0
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const windowSeqsForLabel: {
  (label: string): (plan: ExtractionPlan) => ReadonlyArray<number>;
  (plan: ExtractionPlan, label: string): ReadonlyArray<number>;
} = dual(
  2,
  (plan: ExtractionPlan, label: string): ReadonlyArray<number> =>
    pipe(
      windowIndexOfLabel(label),
      O.flatMap((index) => A.get(plan.windows, index)),
      O.match({
        onNone: (): ReadonlyArray<number> => [],
        onSome: (window) => window.sourceSeqs,
      })
    )
);

const windowStartForLabel = (plan: ExtractionPlan, label: string, fallbackEpochMs: number): number =>
  pipe(
    windowIndexOfLabel(label),
    O.flatMap((index) => A.get(plan.windows, index)),
    O.match({
      onNone: () => fallbackEpochMs,
      onSome: (window) => window.startEpochMs,
    })
  );

const provenanceFor = (options: {
  readonly actionId: string;
  readonly capturedAtEpochMs: number;
  readonly clockSync: ClockSync;
  readonly session: CaptureSession;
  readonly sourceVideo: string;
}): BeepQaProvenance =>
  BeepQaProvenance.make({
    actionId: options.actionId,
    capturedAtEpochMs: options.capturedAtEpochMs,
    clockOffsetMs: O.some(options.clockSync.offsetMs),
    commitSha: O.some(options.session.commitSha),
    scenarioName: O.getOrElse(options.session.scenario, () => "unknown"),
    sessionId: options.session.id,
    sourceVideo: O.some(options.sourceVideo),
    toolVersions: O.some(options.session.toolVersions),
  });

const containerMetadataPairs = (provenance: BeepQaProvenance): ReadonlyArray<MetadataPair> => [
  MetadataPair.make({ key: "BEEP_QA_SESSION_ID", value: provenance.sessionId }),
  MetadataPair.make({ key: "BEEP_QA_SCENARIO", value: provenance.scenarioName }),
  MetadataPair.make({ key: "BEEP_QA_ACTION_ID", value: provenance.actionId }),
  MetadataPair.make({ key: "BEEP_QA_CAPTURED_AT_EPOCH_MS", value: `${provenance.capturedAtEpochMs}` }),
  MetadataPair.make({
    key: "BEEP_QA_COMMIT_SHA",
    value: O.getOrElse(provenance.commitSha, () => "unknown"),
  }),
  MetadataPair.make({
    key: "BEEP_QA_CLOCK_OFFSET_MS",
    value: `${O.getOrElse(provenance.clockOffsetMs, () => 0)}`,
  }),
  MetadataPair.make({
    key: "BEEP_QA_SOURCE_VIDEO",
    value: O.getOrElse(provenance.sourceVideo, () => "unknown"),
  }),
];

const embedProvenance = Effect.fn("QaExtract.embedProvenance")(function* (
  filePath: string,
  provenance: BeepQaProvenance
): Effect.fn.Return<O.Option<string>, never, Exiftool | FFmpeg | FileSystem.FileSystem | Path.Path> {
  const exiftool = yield* Exiftool;
  const ffmpeg = yield* FFmpeg;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const extension = pipe(filePath, path.extname, Str.replace(/^\./, ""), Str.toLowerCase);

  if (isWritableByExiftool(extension)) {
    return yield* exiftool.writeXmpPacket(WriteXmpPacketRequest.make({ filePath, provenance })).pipe(
      Effect.as(O.none<string>()),
      Effect.catchCause(() => Effect.succeed(O.some(`exiftool could not stamp ${path.basename(filePath)}`)))
    );
  }

  if (A.contains(CONTAINER_EXTENSIONS, extension)) {
    const stampedPath = `${filePath}.provenance.${extension}`;
    return yield* ffmpeg
      .writeContainerMetadata(
        WriteContainerMetadataRequest.make({
          metadata: containerMetadataPairs(provenance),
          outPath: stampedPath,
          overwrite: true,
          videoPath: filePath,
        })
      )
      .pipe(
        Effect.flatMap(() => fs.rename(stampedPath, filePath)),
        Effect.as(O.none<string>()),
        Effect.catchCause(() =>
          fs
            .remove(stampedPath, { force: true })
            .pipe(
              Effect.ignore,
              Effect.as(O.some(`ffmpeg could not stamp container metadata on ${path.basename(filePath)}`))
            )
        )
      );
  }

  return O.some(`no provenance channel for ${path.basename(filePath)}`);
});

/**
 * Artifacts produced by one extraction run, plus everything that went wrong.
 *
 * Driver and provenance failures are collected instead of raised so a partial
 * round still yields the evidence it did manage to render; the command exits
 * non-zero afterwards when the list is non-empty.
 *
 * @example
 * ```ts
 * import { ExtractionOutcome } from "@beep/repo-cli/commands/Qa/Extract"
 *
 * const outcome = ExtractionOutcome.make({ artifacts: [], failures: [] })
 * console.log(outcome.failures.length) // 0
 * ```
 * @category models
 * @since 0.0.0
 */
export class ExtractionOutcome extends S.Class<ExtractionOutcome>($I`ExtractionOutcome`)(
  {
    artifacts: S.Array(CaptureArtifact).pipe(
      $I.annoteKey("ExtractionOutcome.artifacts", {
        description: "Artifacts that were rendered and recorded in session.json.",
      })
    ),
    failures: S.Array(S.String).pipe(
      $I.annoteKey("ExtractionOutcome.failures", {
        description: "Driver and provenance failures, in execution order.",
      })
    ),
  },
  $I.annote("ExtractionOutcome", {
    description: "Artifacts produced by one extraction run, plus everything that went wrong.",
  })
) {}

const fileSize = Effect.fn("QaExtract.fileSize")(function* (
  filePath: string
): Effect.fn.Return<O.Option<number>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.stat(filePath).pipe(
    Effect.map((info) => O.some(Number(info.size))),
    Effect.orElseSucceed(O.none<number>)
  );
});

const artifactOf = Effect.fn("QaExtract.artifactOf")(function* (
  layout: RoundLayout,
  kind: "clip" | "frame" | "gif" | "sheet",
  absolutePath: string,
  eventSeqs: ReadonlyArray<number>
): Effect.fn.Return<CaptureArtifact, never, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const size = yield* fileSize(absolutePath);
  return CaptureArtifact.make({
    eventSeqs,
    fileSizeBytes: size,
    kind,
    relativePath: path.relative(layout.root, absolutePath),
  });
});

const executeRequest = Effect.fn("QaExtract.executeRequest")(function* (
  request: QaDriverRequest,
  context: {
    readonly clockSync: ClockSync;
    readonly layout: RoundLayout;
    readonly plan: ExtractionPlan;
    readonly session: CaptureSession;
    readonly sourceVideo: string;
  }
): Effect.fn.Return<ExtractionOutcome, never, Exiftool | FFmpeg | FileSystem.FileSystem | Path.Path> {
  const ffmpeg = yield* FFmpeg;
  const path = yield* Path.Path;

  const stamp = Effect.fn("QaExtract.stamp")(function* (
    kind: "clip" | "frame" | "gif" | "sheet",
    absolutePath: string,
    label: string
  ) {
    const seqs = windowSeqsForLabel(context.plan, label);
    const capturedAtEpochMs = windowStartForLabel(context.plan, label, context.session.startedAtEpochMs);
    const actionId = O.match(A.head(seqs), {
      onNone: () => label,
      onSome: (seq) => `${label}#${seq}`,
    });
    const warning = yield* embedProvenance(
      absolutePath,
      provenanceFor({
        actionId,
        capturedAtEpochMs,
        clockSync: context.clockSync,
        session: context.session,
        sourceVideo: context.sourceVideo,
      })
    );
    const artifact = yield* artifactOf(context.layout, kind, absolutePath, seqs);
    return ExtractionOutcome.make({
      artifacts: [artifact],
      failures: O.match(warning, { onNone: (): ReadonlyArray<string> => [], onSome: (text) => [text] }),
    });
  });

  const failed = (message: string): ExtractionOutcome => ExtractionOutcome.make({ artifacts: [], failures: [message] });

  return yield* Match.value(request).pipe(
    Match.discriminators("kind")({
      "extract-clip": (planned) =>
        ffmpeg.extractClip(planned.request).pipe(
          Effect.flatMap((result) =>
            stamp("clip", result.outPath, pipe(result.outPath, path.basename, Str.replace(/\.[^.]+$/, "")))
          ),
          Effect.catchCause(() => Effect.succeed(failed(`extract-clip failed for ${planned.request.outPath}`)))
        ),
      "extract-frames-at": (planned) =>
        ffmpeg.extractFramesAt(planned.request).pipe(
          Effect.flatMap((result) =>
            Effect.map(
              Effect.forEach(result.frames, (frame) =>
                stamp(
                  "frame",
                  frame.path,
                  O.getOrElse(planned.request.prefix, () => "frames")
                )
              ),
              (outcomes) =>
                ExtractionOutcome.make({
                  artifacts: A.flatMap(outcomes, (outcome) => outcome.artifacts),
                  failures: A.flatMap(outcomes, (outcome) => outcome.failures),
                })
            )
          ),
          Effect.catchCause(() => Effect.succeed(failed(`extract-frames-at failed for ${planned.request.outDir}`)))
        ),
      "render-contact-sheet": (planned) =>
        ffmpeg.renderContactSheet(planned.request).pipe(
          Effect.flatMap((result) => stamp("sheet", result.outPath, "contact-sheet")),
          Effect.catchCause(() =>
            Effect.succeed(
              failed(
                `render-contact-sheet failed for ${planned.request.outPath} (a duration-less container cannot be tiled)`
              )
            )
          )
        ),
      "render-gif": (planned) =>
        ffmpeg.renderGif(planned.request).pipe(
          Effect.flatMap((result) =>
            stamp("gif", result.outPath, pipe(result.outPath, path.basename, Str.replace(/\.gif$/, "")))
          ),
          Effect.catchCause(() => Effect.succeed(failed(`render-gif failed for ${planned.request.outPath}`)))
        ),
    }),
    Match.exhaustive
  );
});

/**
 * Run the full extraction pipeline over one round directory.
 *
 * @example
 * ```ts
 * import { runQaExtract } from "@beep/repo-cli/commands/Qa/Extract"
 * import { QaExtractOptions } from "@beep/repo-cli/commands/Qa/Qa.schemas"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const options = QaExtractOptions.make({ budgetMb: O.none(), dryRun: true, rules: O.none(), session: O.none() })
 * console.log(Effect.isEffect(runQaExtract("/repo", options))) // true
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const runQaExtract = Effect.fn("QaExtract.run")(function* (
  cwd: string,
  options: QaExtractOptions
): Effect.fn.Return<
  ExtractionOutcome,
  QaCommandError,
  | ChildProcessSpawner.ChildProcessSpawner
  | ClockCorrelator
  | Exiftool
  | FFmpeg
  | FileSystem.FileSystem
  | Path.Path
  | SessionStore
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const store = yield* SessionStore;
  // Every `beep qa` subcommand opens with the same service acquisition and
  // round-layout read; only the error wording each command owns differs.
  // fallow-ignore-next-line code-duplication -- every beep qa subcommand shares this service-acquisition and round-layout prologue; only the error wording differs
  const correlator = yield* ClockCorrelator;

  const layout = yield* resolveRoundLayout(cwd, options.session);
  const manifest = yield* store
    .readSessionManifest(layout)
    .pipe(QaCommandError.mapError(`qa extract could not read ${layout.sessionPath}.`));
  // Every `beep qa` subcommand opens with the same service acquisition and
  // round-layout read; only the error wording each command owns differs.
  // fallow-ignore-next-line code-duplication -- every beep qa subcommand shares this service-acquisition and round-layout prologue; only the error wording differs
  const eventLog = yield* readEventLog(layout.eventsPath);

  const videoPath = yield* O.match(manifest.videoPath, {
    onNone: () => discoverRecordedVideo(layout.videoDir),
    onSome: (value) => Effect.succeed(O.some(value)),
  }).pipe(
    Effect.flatMap(
      O.match({
        onNone: () =>
          Effect.fail(
            QaCommandError.make({
              message: `qa extract found no recorded video under ${layout.videoDir}; record the round first.`,
            })
          ),
        onSome: Effect.succeed,
      })
    )
  );

  const prepared = yield* prepareVideo(layout, videoPath, eventSpanSeconds(eventLog.events)).pipe(
    QaCommandError.mapError(`qa extract could not prepare ${videoPath} for frame extraction.`)
  );

  const hint = yield* readRecordStartHint(recordHintPath(path, layout));
  const recordStartEpochMs = O.flatMap(manifest.clockSync, (clock) =>
    clock.method === "obs-record-state" ? O.some(-clock.offsetMs) : O.none<number>()
  );
  const clockSync = yield* correlator.correlate(
    CorrelateClockRequest.make({
      assumedStartEpochMs: O.getOrElse(hint, () => manifest.session.startedAtEpochMs),
      beaconEvents: A.filter(eventLog.events, isBeaconEvent),
      recordStartEpochMs,
      videoPath: prepared.path,
      workDir: layout.clipsDir,
    })
  );

  const recordedBudget = yield* readArtifactBudget(artifactBudgetPath(path, layout));
  const budget = O.match(options.budgetMb, {
    onNone: () => O.getOrElse(recordedBudget, () => ArtifactBudget.make({})),
    onSome: (mib) => ArtifactBudget.make({ maxTotalBytes: mib * BYTES_PER_MIB }),
  });
  const plan = buildExtractionPlan(
    BuildExtractionPlanOptions.make({
      budget,
      events: eventLog.events,
      rules: O.getOrElse(options.rules, () => defaultExtractionRules),
    })
  );
  const requests = planDriverRequests(
    PlanDriverRequestsOptions.make({
      clipsDir: layout.clipsDir,
      clockSync,
      framesDir: layout.framesDir,
      plan,
      sheetsDir: layout.sheetsDir,
      videoDurationSeconds: prepared.durationSeconds,
      videoPath: prepared.path,
    })
  );

  const planJson = yield* encodeExtractionPlanJson(plan).pipe(
    QaCommandError.mapError("qa extract could not encode the extraction plan.")
  );
  yield* fs
    .writeFileString(extractionPlanPath(path, layout), planJson)
    .pipe(QaCommandError.mapError(`qa extract could not write ${EXTRACTION_PLAN_FILE}.`));

  if (options.dryRun) {
    yield* printLines(renderExtractionPlanTable(plan, A.length(requests)));
    return ExtractionOutcome.make({ artifacts: [], failures: [] });
  }

  const outcomes = yield* Effect.forEach(requests, (request) =>
    executeRequest(request, {
      clockSync,
      layout,
      plan,
      session: manifest.session,
      // Session-relative: provenance is embedded into artifacts that may be
      // committed to packets — absolute home paths must never ride along.
      sourceVideo: path.relative(layout.root, prepared.path),
    })
  );
  const outcome = ExtractionOutcome.make({
    artifacts: A.flatMap(outcomes, (value) => value.artifacts),
    failures: A.flatMap(outcomes, (value) => value.failures),
  });

  const updated = SessionManifest.make({
    artifacts: outcome.artifacts,
    clockSync: O.some(clockSync),
    eventsPath: manifest.eventsPath,
    legacyManifestPath: manifest.legacyManifestPath,
    schemaVersion: "beep.qa.capture-session.v1",
    session: manifest.session,
    videoPath: O.some(videoPath),
  });
  yield* store
    .writeSessionManifest(layout, updated)
    .pipe(QaCommandError.mapError(`qa extract could not update ${layout.sessionPath}.`));
  yield* fs
    .writeFileString(layout.reportPath, renderRoundReport(updated, eventLog, O.some(plan)))
    .pipe(QaCommandError.mapError(`qa extract could not write ${layout.reportPath}.`));

  yield* printLines([
    `qa extract: round ${layout.round}`,
    `  clock: ${clockSync.method} (${clockSync.confidence}, residual ${N.round(clockSync.residualRmsMs, 1)} ms)`,
    `  video: ${prepared.path}${prepared.normalized ? " (normalized)" : ""}`,
    `  windows: ${A.length(plan.windows)}, dropped: ${A.length(plan.dropped)}`,
    `  artifacts: ${A.length(outcome.artifacts)}`,
    `  report: ${layout.reportPath}`,
  ]);
  yield* Effect.forEach(outcome.failures, (failure) => Console.error(`  ! ${failure}`), { discard: true });

  return outcome;
});
