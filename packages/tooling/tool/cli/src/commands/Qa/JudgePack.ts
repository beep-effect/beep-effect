/**
 * The `beep qa judge-pack` evidence bundler.
 *
 * The vision judge runs in a read-only sandbox and cannot browse a round, so
 * this command hands it exactly three files: `timeline.md` (what happened, in
 * video seconds), `manifest.json` (the precise file list it must open, with
 * byte sizes and everything omitted for budget), and `prompt.md` (the committed
 * judge prompt with round placeholders filled).
 *
 * Two rules are structural, not stylistic: animated media and raw video are
 * never listed, and evidence that does not fit the byte budget is recorded in
 * `dropped` so the judge can never claim coverage it did not have.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { FFmpeg, ProbeVideoRequest } from "@beep/ffmpeg";
import { resolvePathWithinCanonicalRoot } from "@beep/file-processing/PathSafety";
import { $RepoCliId } from "@beep/identity/packages";
import { ClockSync, END_SEEK_GUARD_SECONDS, epochToVideoSeconds, SessionStore } from "@beep/qa-capture";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A, O, Str, thunkEmptyReadonlyArray, thunkEmptyStr } from "@beep/utils";
import { Effect, FileSystem, Match, Number as N, Order, Path, pipe } from "effect";
import * as Eq from "effect/Equal";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { printLines } from "../../internal/cli/Printer.ts";
import { QaCommandError } from "./Qa.errors.ts";
import { discoverRecordedVideo, QaEventLog, qaRootPath, readEventLog } from "./Qa.session.ts";
import type { ActionEvent, RoundLayout, SessionManifest } from "@beep/qa-capture";
import type { QaJudgePackOptions } from "./Qa.schemas.ts";

const $I = $RepoCliId.create("commands/Qa/JudgePack");

/**
 * Total byte budget of one judge evidence bundle.
 *
 * **Example** (Usage)
 * ```ts
 * import { JUDGE_TOTAL_BUDGET_BYTES } from "@beep/repo-cli/commands/Qa/JudgePack"
 *
 * console.log(JUDGE_TOTAL_BUDGET_BYTES) // 8388608
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const JUDGE_TOTAL_BUDGET_BYTES = 8 * 1024 * 1024;

/**
 * Per-file byte ceiling of one judge evidence bundle.
 *
 * **Example** (Usage)
 * ```ts
 * import { JUDGE_PER_FILE_BUDGET_BYTES } from "@beep/repo-cli/commands/Qa/JudgePack"
 *
 * console.log(JUDGE_PER_FILE_BUDGET_BYTES) // 409600
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const JUDGE_PER_FILE_BUDGET_BYTES = 400 * 1024;

/**
 * Repo-relative path of the committed judge prompt template.
 *
 * **Example** (Usage)
 * ```ts
 * import { JUDGE_PROMPT_TEMPLATE } from "@beep/repo-cli/commands/Qa/JudgePack"
 *
 * console.log(JUDGE_PROMPT_TEMPLATE.endsWith("judge-prompt.md")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const JUDGE_PROMPT_TEMPLATE = ".claude/skills/browser-qa-loop/resources/judge-prompt.md";

/**
 * Evidence classes a judge bundle can list, in descending keep priority.
 *
 * **Example** (Usage)
 * ```ts
 * import { JudgeEvidenceKind } from "@beep/repo-cli/commands/Qa/JudgePack"
 *
 * console.log(JudgeEvidenceKind.Options.length) // 3
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JudgeEvidenceKind = LiteralKit(["frame", "screenshot", "sheet"]).pipe(
  $I.annoteSchema("JudgeEvidenceKind", {
    description: "Evidence classes a judge bundle can list.",
  })
);

/**
 * Evidence class of one bundled file.
 *
 * **Example** (Usage)
 * ```ts
 * import type { JudgeEvidenceKind } from "@beep/repo-cli/commands/Qa/JudgePack"
 *
 * const kind: JudgeEvidenceKind = "sheet"
 * console.log(kind)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type JudgeEvidenceKind = typeof JudgeEvidenceKind.Type;

/**
 * One file the judge is instructed to open.
 *
 * **Example** (Usage)
 * ```ts
 * import { JudgeEvidenceFile } from "@beep/repo-cli/commands/Qa/JudgePack"
 *
 * const file = JudgeEvidenceFile.make({ bytes: 180_000, kind: "frame", path: "frames/drag-w0-0001.png" })
 * console.log(file.path)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JudgeEvidenceFile extends S.Class<JudgeEvidenceFile>($I`JudgeEvidenceFile`)(
  {
    bytes: S.Int.pipe(
      $I.annoteKey("JudgeEvidenceFile.bytes", {
        description: "File size on disk.",
      })
    ),
    kind: JudgeEvidenceKind.pipe(
      $I.annoteKey("JudgeEvidenceFile.kind", {
        description: "Evidence class of the file.",
      })
    ),
    path: S.String.pipe(
      $I.annoteKey("JudgeEvidenceFile.path", {
        description: "Round-relative path the judge opens.",
      })
    ),
  },
  $I.annote("JudgeEvidenceFile", {
    description: "One file the vision judge is instructed to open.",
  })
) {}

/**
 * One file omitted from the bundle, with the budget rule that omitted it.
 *
 * **Example** (Usage)
 * ```ts
 * import { JudgeDroppedFile } from "@beep/repo-cli/commands/Qa/JudgePack"
 *
 * const dropped = JudgeDroppedFile.make({
 *   bytes: 900_000,
 *   path: "sheets/contact-sheet.jpg",
 *   reason: "per-file-budget"
 * })
 * console.log(dropped.reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JudgeDroppedFile extends S.Class<JudgeDroppedFile>($I`JudgeDroppedFile`)(
  {
    bytes: S.Int.pipe(
      $I.annoteKey("JudgeDroppedFile.bytes", {
        description: "File size that could not be afforded.",
      })
    ),
    path: S.String.pipe(
      $I.annoteKey("JudgeDroppedFile.path", {
        description: "Round-relative path of the omitted file.",
      })
    ),
    reason: S.String.pipe(
      $I.annoteKey("JudgeDroppedFile.reason", {
        description: "Budget rule that omitted the file.",
      })
    ),
  },
  $I.annote("JudgeDroppedFile", {
    description: "One file omitted from a judge bundle, with the budget rule that omitted it.",
  })
) {}

/**
 * Outcome of fitting evidence candidates into the judge byte budget.
 *
 * **Example** (Usage)
 * ```ts
 * import { JudgeEvidenceSelection } from "@beep/repo-cli/commands/Qa/JudgePack"
 *
 * const selection = JudgeEvidenceSelection.make({ dropped: [], files: [] })
 * console.log(selection.files.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JudgeEvidenceSelection extends S.Class<JudgeEvidenceSelection>($I`JudgeEvidenceSelection`)(
  {
    dropped: S.Array(JudgeDroppedFile).pipe(
      $I.annoteKey("JudgeEvidenceSelection.dropped", {
        description: "Candidates the budget could not afford, each with its omission reason.",
      })
    ),
    files: S.Array(JudgeEvidenceFile).pipe(
      $I.annoteKey("JudgeEvidenceSelection.files", {
        description: "Candidates that fit the budget, in stable path order.",
      })
    ),
  },
  $I.annote("JudgeEvidenceSelection", {
    description: "Budget-fitted judge evidence split into what is bundled and what was dropped.",
  })
) {}

/**
 * Placeholder values substituted into the committed judge prompt template.
 *
 * **Example** (Usage)
 * ```ts
 * import { JudgePromptValues } from "@beep/repo-cli/commands/Qa/JudgePack"
 *
 * const values = JudgePromptValues.make({
 *   round: 3,
 *   roundDir: "/repo/.beep/qa/round-3",
 *   scenarioNotes: "",
 *   surface: "dock"
 * })
 * console.log(values.surface) // "dock"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JudgePromptValues extends S.Class<JudgePromptValues>($I`JudgePromptValues`)(
  {
    round: S.Int.pipe(
      $I.annoteKey("JudgePromptValues.round", {
        description: "Round number the bundle judges.",
      })
    ),
    roundDir: S.String.pipe(
      $I.annoteKey("JudgePromptValues.roundDir", {
        description: "Absolute round directory the judge reads evidence from.",
      })
    ),
    scenarioNotes: S.String.pipe(
      $I.annoteKey("JudgePromptValues.scenarioNotes", {
        description: "Pre-rendered scenario notes block, empty when the round has none.",
      })
    ),
    surface: S.String.pipe(
      $I.annoteKey("JudgePromptValues.surface", {
        description: "Surface under review, used to scope the judge's lens.",
      })
    ),
  },
  $I.annote("JudgePromptValues", {
    description: "Round placeholders filled into `prompt.md` before a judge run.",
  })
) {}

/**
 * The exact evidence set handed to one judge run.
 *
 * **Example** (Usage)
 * ```ts
 * import { JudgeManifest } from "@beep/repo-cli/commands/Qa/JudgePack"
 *
 * const manifest = JudgeManifest.make({
 *   dropped: [],
 *   files: [],
 *   round: 3,
 *   roundDir: "/repo/.beep/qa/round-3",
 *   totalBytes: 0
 * })
 * console.log(manifest.round) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JudgeManifest extends S.Class<JudgeManifest>($I`JudgeManifest`)(
  {
    dropped: S.Array(JudgeDroppedFile).pipe(
      $I.annoteKey("JudgeManifest.dropped", {
        description: "Evidence omitted for byte budget; the judge must not claim coverage of these.",
      })
    ),
    files: S.Array(JudgeEvidenceFile).pipe(
      $I.annoteKey("JudgeManifest.files", {
        description: "Every file the judge must open, round-relative.",
      })
    ),
    round: S.Int.pipe(
      $I.annoteKey("JudgeManifest.round", {
        description: "Round being judged.",
      })
    ),
    roundDir: S.String.pipe(
      $I.annoteKey("JudgeManifest.roundDir", {
        description: "Absolute round directory the relative paths resolve against.",
      })
    ),
    totalBytes: S.Int.pipe(
      $I.annoteKey("JudgeManifest.totalBytes", {
        description: "Total size of the bundled files.",
      })
    ),
  },
  $I.annote("JudgeManifest", {
    description: "The exact evidence set handed to one vision-judge run.",
  })
) {}

const JudgeManifestJson = S.fromJsonString(JudgeManifest);

const LegacyAssertion = S.Struct({
  detail: S.optionalKey(S.String),
  name: S.String,
  ok: S.Boolean,
});

const LegacyScenario = S.Struct({
  assertions: S.Array(LegacyAssertion).pipe(SchemaUtils.withKeyDefaults([])),
  name: S.String,
  notes: S.Array(S.String).pipe(SchemaUtils.withKeyDefaults([])),
  screenshots: S.Array(S.String).pipe(SchemaUtils.withKeyDefaults([])),
});

const LegacyManifest = S.Struct({
  scenarios: S.Array(LegacyScenario).pipe(SchemaUtils.withKeyDefaults([])),
});

const LegacyManifestJson = S.fromJsonString(LegacyManifest);

/**
 * Legacy screenshot-harness manifest, when the round produced one.
 *
 * **Example** (Usage)
 * ```ts
 * import { readLegacyManifest } from "@beep/repo-cli/commands/Qa/JudgePack"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(readLegacyManifest("/repo/.beep/qa/round-1/manifest.json"))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const readLegacyManifest = Effect.fn("QaJudgePack.readLegacyManifest")(function* (
  manifestPath: string
): Effect.fn.Return<O.Option<typeof LegacyManifest.Type>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs
    .readFileString(manifestPath)
    .pipe(
      Effect.flatMap(S.decodeUnknownEffect(LegacyManifestJson)),
      Effect.asSome,
      Effect.orElseSucceed(O.none<typeof LegacyManifest.Type>)
    );
});

const scenarioIsGreen = (scenario: typeof LegacyScenario.Type): boolean =>
  A.every(scenario.assertions, (assertion) => assertion.ok);

const greenScreenshots = (manifest: O.Option<typeof LegacyManifest.Type>): ReadonlyArray<string> =>
  O.match(manifest, {
    onNone: (): ReadonlyArray<string> => [],
    onSome: (value) =>
      pipe(
        value.scenarios,
        A.filter(scenarioIsGreen),
        A.flatMap((scenario) => scenario.screenshots)
      ),
  });

const eventLine = (event: ActionEvent, toVideo: (epochMs: number) => number): string => {
  const seconds = toVideo(event.tEpochMs).toFixed(3);
  const detail = Match.value(event).pipe(
    Match.discriminators("kind")({
      animation: (value) => `${value.phase} ${value.selectorPath}`,
      beacon: (value) => `flip ${value.flipIndex} ${value.isWhite ? "white" : "black"}`,
      "focus-in": (value) => value.selectorPath,
      "focus-out": (value) => value.selectorPath,
      "key-down": (value) => value.key,
      marker: (value) => value.label,
      "pointer-cancel": (value) => `${value.selectorPath} @${Math.round(value.x)},${Math.round(value.y)}`,
      "pointer-down": (value) => `${value.selectorPath} @${Math.round(value.x)},${Math.round(value.y)}`,
      "pointer-enter": (value) => value.selectorPath,
      "pointer-leave": (value) => value.selectorPath,
      "pointer-move": (value) => `@${Math.round(value.x)},${Math.round(value.y)}`,
      "pointer-up": (value) => `${value.selectorPath} @${Math.round(value.x)},${Math.round(value.y)}`,
      scroll: (value) => value.selectorPath,
      transition: (value) => `${value.phase} ${value.selectorPath}`,
    }),
    Match.exhaustive
  );
  return `- t=${seconds} seq=${event.seq} ${event.kind} ${detail}`;
};

/**
 * Everything {@link renderTimeline} needs to place one round on the video clock.
 *
 * **Example** (Usage)
 * ```ts
 * import { ClockSync } from "@beep/qa-capture"
 * import { RenderTimelineOptions } from "@beep/repo-cli/commands/Qa/JudgePack"
 * import { QaEventLog } from "@beep/repo-cli/commands/Qa/Qa.session"
 * import * as O from "effect/Option"
 *
 * const options = RenderTimelineOptions.make({
 *   clockSync: ClockSync.make({
 *     confidence: "high",
 *     method: "beacon",
 *     offsetMs: 0,
 *     residualRmsMs: 4,
 *     slope: 1
 *   }),
 *   eventLog: QaEventLog.make({ events: [], rejectedCount: 0 }),
 *   legacy: O.none(),
 *   round: 2,
 *   videoDurationSeconds: 30
 * })
 * console.log(options.round) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RenderTimelineOptions extends S.Class<RenderTimelineOptions>($I`RenderTimelineOptions`)(
  {
    clockSync: ClockSync.pipe(
      $I.annoteKey("RenderTimelineOptions.clockSync", {
        description: "Correlation mapping witness epochs onto video seconds.",
      })
    ),
    eventLog: QaEventLog.pipe(
      $I.annoteKey("RenderTimelineOptions.eventLog", {
        description: "Decoded witness events the timeline segments.",
      })
    ),
    legacy: S.OptionFromOptionalKey(LegacyManifest).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("RenderTimelineOptions.legacy", {
        description: "Legacy screenshot-harness manifest supplying scenario notes, when the round produced one.",
      })
    ),
    round: S.Int.pipe(
      $I.annoteKey("RenderTimelineOptions.round", {
        description: "Round number the timeline heads with.",
      })
    ),
    videoDurationSeconds: S.Finite.pipe(
      $I.annoteKey("RenderTimelineOptions.videoDurationSeconds", {
        description: "Probed video duration clamping every rendered timestamp.",
      })
    ),
  },
  $I.annote("RenderTimelineOptions", {
    description: "Inputs of one `judge/timeline.md` rendering.",
  })
) {}

const isScenarioMarker = (event: ActionEvent): boolean =>
  event.kind === "marker" && Str.startsWith("scenario:")(event.label);

const assertionDetailSuffix = (detail: string | undefined): string =>
  pipe(
    O.fromUndefinedOr(detail),
    O.map((value) => ` (${value})`),
    O.getOrElse(thunkEmptyStr)
  );

const scenarioNoteLines = (scenario: (typeof LegacyManifest.Type)["scenarios"][number]): ReadonlyArray<string> => [
  ...A.map(scenario.notes, (note) => `> note: ${note}`),
  ...pipe(
    scenario.assertions,
    A.filter((assertion) => !assertion.ok),
    A.map((assertion) => `> FAILED ASSERTION: ${assertion.name}${assertionDetailSuffix(assertion.detail)}`)
  ),
];

const scenarioNotesFor = (name: string, legacy: O.Option<typeof LegacyManifest.Type>): ReadonlyArray<string> =>
  pipe(
    legacy,
    O.flatMap((value) =>
      A.findFirst(value.scenarios, (scenario) => Str.includes(scenario.name)(name) || Str.includes(name)(scenario.name))
    ),
    O.map(scenarioNoteLines),
    O.getOrElse(thunkEmptyReadonlyArray<string>())
  );

/**
 * Render `judge/timeline.md` for one round.
 *
 * Scenario boundaries come from `scenario:` markers in the witness log, so the
 * timeline segments exactly the way the harness did — no re-derivation, no
 * guessing.
 *
 * **Example** (Usage)
 *
 * ```ts
 * import { ClockSync } from "@beep/qa-capture"
 * import { renderTimeline } from "@beep/repo-cli/commands/Qa/JudgePack"
 * import { QaEventLog } from "@beep/repo-cli/commands/Qa/Qa.session"
 * import * as O from "effect/Option"
 *
 * const clock = ClockSync.make({
 *   confidence: "high",
 *   method: "beacon",
 *   offsetMs: 0,
 *   residualRmsMs: 4,
 *   slope: 1
 * })
 * const timeline = renderTimeline({
 *   clockSync: clock,
 *   eventLog: QaEventLog.make({ events: [], rejectedCount: 0 }),
 *   legacy: O.none(),
 *   round: 2,
 *   videoDurationSeconds: 30
 * })
 * console.log(timeline.startsWith("# Round 2 timeline")) // true
 * ```
 *
 * @param options - Round number, witness events, clock sync, video duration, and legacy manifest.
 * @returns Markdown body of the round timeline in video seconds.
 * @category formatting
 * @since 0.0.0
 */
export const renderTimeline = (options: RenderTimelineOptions): string => {
  const { clockSync, eventLog, legacy, round, videoDurationSeconds } = options;
  const toVideo = epochToVideoSeconds(clockSync, videoDurationSeconds);
  const boundaries = A.reduce(eventLog.events, [] as ReadonlyArray<number>, (acc, event, index) =>
    isScenarioMarker(event) ? [...acc, index] : acc
  );
  const sections = A.isReadonlyArrayNonEmpty(boundaries)
    ? A.map(boundaries, (start, position) => {
        const end = O.getOrElse(A.get(boundaries, position + 1), () => A.length(eventLog.events));
        const slice = A.drop(A.take(eventLog.events, end), start);
        const name = pipe(
          A.head(slice),
          O.map((event) => (event.kind === "marker" ? Str.replace("scenario:", "")(event.label) : "unnamed")),
          O.getOrElse((): string => "unnamed")
        );
        return [
          `## scenario: ${name}`,
          "",
          ...scenarioNotesFor(name, legacy),
          "",
          ...A.map(slice, (event) => eventLine(event, toVideo)),
          "",
        ];
      })
    : [["## all events", "", ...A.map(eventLog.events, (event) => eventLine(event, toVideo)), ""]];

  return A.join(
    [
      `# Round ${round} timeline`,
      "",
      `Clock: \`${clockSync.method}\` (${clockSync.confidence}, residual ${N.round(clockSync.residualRmsMs, 1)} ms).`,
      "Times are video seconds; `seq` values are the witness sequence numbers to cite as `eventIds`.",
      "",
      ...A.flatten(sections),
    ],
    "\n"
  );
};

/**
 * Render `judge/prompt.md` from the committed template.
 *
 * **Example** (Usage)
 * ```ts
 * import { renderJudgePrompt } from "@beep/repo-cli/commands/Qa/JudgePack"
 *
 * const rendered = renderJudgePrompt("Round {{ROUND}} of {{SURFACE}} in {{ROUND_DIR}}: {{SCENARIO_NOTES}}", {
 *   round: 3,
 *   roundDir: "/repo/.beep/qa/round-3",
 *   scenarioNotes: "none",
 *   surface: "storybook"
 * })
 * console.log(rendered.includes("{{ROUND}}")) // false
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const renderJudgePrompt: {
  (values: JudgePromptValues): (template: string) => string;
  (template: string, values: JudgePromptValues): string;
} = dual(2, (template: string, values: JudgePromptValues): string =>
  pipe(
    template,
    Str.replaceAll("{{ROUND_DIR}}", values.roundDir),
    Str.replaceAll("{{ROUND}}", `${values.round}`),
    Str.replaceAll("{{SCENARIO_NOTES}}", values.scenarioNotes),
    Str.replaceAll("{{SURFACE}}", values.surface)
  )
);

const byPath: Order.Order<JudgeEvidenceFile> = Order.mapInput(Order.String, (file: JudgeEvidenceFile) => file.path);

const keepPriority = (kind: JudgeEvidenceKind, green: boolean): number =>
  JudgeEvidenceKind.$match(kind, {
    frame: () => 2,
    screenshot: () => (green ? 3 : 1),
    sheet: () => 0,
  });

/**
 * Select the evidence that fits the judge budget, recording every omission.
 *
 * Green-scenario screenshots are sacrificed before frame strips because a
 * passing static shot proves the least about motion; nothing under `clips/` or
 * `video/` is ever a candidate.
 *
 * **Example** (Usage)
 * ```ts
 * import { JudgeEvidenceFile, selectJudgeEvidence } from "@beep/repo-cli/commands/Qa/JudgePack"
 *
 * const selection = selectJudgeEvidence(
 *   [JudgeEvidenceFile.make({ bytes: 1_000_000, kind: "frame", path: "frames/a.png" })],
 *   []
 * )
 * console.log(selection.dropped[0].reason) // "per-file-budget"
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const selectJudgeEvidence: {
  (
    greenScreenshotNames: ReadonlyArray<string>
  ): (candidates: ReadonlyArray<JudgeEvidenceFile>) => JudgeEvidenceSelection;
  (candidates: ReadonlyArray<JudgeEvidenceFile>, greenScreenshotNames: ReadonlyArray<string>): JudgeEvidenceSelection;
} = dual(
  2,
  (
    candidates: ReadonlyArray<JudgeEvidenceFile>,
    greenScreenshotNames: ReadonlyArray<string>
  ): JudgeEvidenceSelection => {
    const oversized = A.filter(candidates, (file) => file.bytes > JUDGE_PER_FILE_BUDGET_BYTES);
    const affordable = A.filter(candidates, (file) => file.bytes <= JUDGE_PER_FILE_BUDGET_BYTES);
    const isGreen = (file: JudgeEvidenceFile): boolean =>
      A.contains(greenScreenshotNames, Str.replace(/^.*\//, "")(file.path));
    const byKeepPriority: Order.Order<JudgeEvidenceFile> = Order.combine(
      Order.mapInput(Order.Number, (file: JudgeEvidenceFile) => keepPriority(file.kind, isGreen(file))),
      byPath
    );
    const ordered = A.sort(affordable, byKeepPriority);

    const fitted = A.reduce(
      ordered,
      { dropped: A.empty<JudgeDroppedFile>(), kept: A.empty<JudgeEvidenceFile>(), total: 0 },
      (state, file) =>
        state.total + file.bytes <= JUDGE_TOTAL_BUDGET_BYTES
          ? { dropped: state.dropped, kept: [...state.kept, file], total: state.total + file.bytes }
          : {
              dropped: [
                ...state.dropped,
                JudgeDroppedFile.make({ bytes: file.bytes, path: file.path, reason: "total-budget" }),
              ],
              kept: state.kept,
              total: state.total,
            }
    );

    return JudgeEvidenceSelection.make({
      dropped: [
        ...A.map(oversized, (file) =>
          JudgeDroppedFile.make({ bytes: file.bytes, path: file.path, reason: "per-file-budget" })
        ),
        ...fitted.dropped,
      ],
      files: A.sort(fitted.kept, byPath),
    });
  }
);

const IMAGE_EXTENSIONS: ReadonlyArray<string> = [".jpeg", ".jpg", ".png"];

const collectCandidates = Effect.fn("QaJudgePack.collectCandidates")(function* (
  layout: RoundLayout
): Effect.fn.Return<ReadonlyArray<JudgeEvidenceFile>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  // fallow-ignore-next-line code-duplication -- judge-pack assembles typed image evidence while judge-check resolves cited paths after the same mandatory root guard
  const canonicalRoot = yield* fs.realPath(layout.root).pipe(Effect.orElseSucceed(() => path.resolve(layout.root)));

  const listImages = Effect.fn("QaJudgePack.listImages")(function* (dir: string, kind: JudgeEvidenceKind) {
    const entries = yield* fs.readDirectory(dir).pipe(Effect.orElseSucceed((): ReadonlyArray<string> => []));
    const images = A.filter(entries, (entry) => A.contains(IMAGE_EXTENSIONS, Str.toLowerCase(path.extname(entry))));
    return yield* Effect.forEach(images, (entry) => {
      const absolute = path.join(dir, entry);
      return resolvePathWithinCanonicalRoot({
        canonicalRoot,
        candidate: path.relative(canonicalRoot, absolute),
      }).pipe(
        Effect.filterOrFail(
          (canonical) => Eq.equals(path.resolve(absolute), canonical),
          () => QaCommandError.make({ message: `qa judge-pack refused linked evidence path "${absolute}".` })
        ),
        Effect.flatMap((canonical) => fs.stat(canonical)),
        Effect.filterOrFail(
          (info) => Eq.equals(info.type, "File"),
          () => QaCommandError.make({ message: `qa judge-pack refused non-file evidence path "${absolute}".` })
        ),
        Effect.map((info) =>
          O.some(
            JudgeEvidenceFile.make({
              bytes: Number(info.size),
              kind,
              path: path.relative(layout.root, absolute),
            })
          )
        ),
        Effect.orElseSucceed(O.none<JudgeEvidenceFile>)
      );
    });
  });

  const [screenshots, frames, sheets] = yield* Effect.all(
    [
      listImages(layout.root, "screenshot"),
      listImages(layout.framesDir, "frame"),
      listImages(layout.sheetsDir, "sheet"),
    ],
    { concurrency: 3 }
  );
  return A.getSomes([...screenshots, ...frames, ...sheets]);
});

// Must stay in lockstep with the normalized clip name `qa extract` writes
// (Extract.ts); extract remuxes Lane A's duration-less live-muxed webm into
// this clip precisely so a container duration exists.
const NORMALIZED_VIDEO_NAME = "normalized.mp4";

// A recording no longer than the end-seek guard cannot carry temporal
// evidence: the guarded mapping interval [0, duration - guard] is empty, so
// every event would render at t=0.000. A concrete-but-degenerate duration
// therefore fails packing exactly like a missing one.
const guardedDuration = (source: string, durationSeconds: number): Effect.Effect<number, QaCommandError> =>
  durationSeconds > END_SEEK_GUARD_SECONDS
    ? Effect.succeed(durationSeconds)
    : Effect.fail(
        QaCommandError.make({
          message: `qa judge-pack found a ${durationSeconds}s container duration in ${source}; recordings must exceed ${END_SEEK_GUARD_SECONDS}s to carry temporal evidence.`,
        })
      );

// Lane A's live-muxed webm reports no container duration; `qa extract`
// writes the normalized clip exactly for this case.
const normalizedClipDuration = Effect.fn("QaJudgePack.normalizedClipDuration")(function* (
  layout: RoundLayout,
  source: string,
  normalizedPath: string
): Effect.fn.Return<number, QaCommandError, FFmpeg> {
  const ffmpeg = yield* FFmpeg;
  const normalized = yield* ffmpeg
    .probeVideo(ProbeVideoRequest.make({ videoPath: normalizedPath }))
    .pipe(
      QaCommandError.mapError(
        `qa judge-pack could not probe the normalized clip at ${normalizedPath}; re-run \`bun run beep qa extract --round ${layout.round}\` before packing.`
      )
    );
  return yield* O.match(normalized.durationSeconds, {
    onNone: () =>
      Effect.fail(
        QaCommandError.make({
          message: `qa judge-pack found no container duration in ${source} or ${normalizedPath}; re-run \`bun run beep qa extract --round ${layout.round}\` before packing.`,
        })
      ),
    onSome: (durationSeconds) => guardedDuration(normalizedPath, durationSeconds),
  });
});

// A judge bundle without a real video duration is corrupted temporal evidence:
// `epochToVideoSeconds` clamps every event into [0, duration], so a degraded
// zero would map the whole interaction onto t=0.000. Missing videos, probe
// failures, and duration-less containers therefore fail packing instead.
const requireVideoDuration = Effect.fn("QaJudgePack.requireVideoDuration")(function* (
  layout: RoundLayout,
  videoPath: O.Option<string>
): Effect.fn.Return<number, QaCommandError, FFmpeg | Path.Path> {
  const ffmpeg = yield* FFmpeg;
  const path = yield* Path.Path;
  const source = yield* Effect.fromOption(videoPath, () =>
    QaCommandError.make({
      message: `qa judge-pack found no recorded video for round ${layout.round}; record and extract the round before packing.`,
    })
  );
  const probe = yield* ffmpeg
    .probeVideo(ProbeVideoRequest.make({ videoPath: source }))
    .pipe(QaCommandError.mapError(`qa judge-pack could not probe the recorded video at ${source}.`));
  const normalizedPath = path.join(layout.videoDir, NORMALIZED_VIDEO_NAME);
  return yield* O.match(probe.durationSeconds, {
    onNone: () => normalizedClipDuration(layout, source, normalizedPath),
    onSome: (durationSeconds) => guardedDuration(source, durationSeconds),
  });
});

const requireClockSync = (manifest: SessionManifest): Effect.Effect<ClockSync, QaCommandError> =>
  Effect.fromOption(manifest.clockSync, () =>
    QaCommandError.make({
      message: "qa judge-pack needs a correlated clock; run `bun run beep qa extract` for this round before packing.",
    })
  );

/**
 * Build a round's `judge/` bundle.
 *
 * **Example** (Usage)
 * ```ts
 * import { runQaJudgePack } from "@beep/repo-cli/commands/Qa/JudgePack"
 * import { QaJudgePackOptions } from "@beep/repo-cli/commands/Qa/Qa.schemas"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const options = QaJudgePackOptions.make({ round: 3, surface: O.none() })
 * console.log(Effect.isEffect(runQaJudgePack("/repo", options))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runQaJudgePack = Effect.fn("QaJudgePack.run")(function* (
  cwd: string,
  options: QaJudgePackOptions
): Effect.fn.Return<JudgeManifest, QaCommandError, FFmpeg | FileSystem.FileSystem | Path.Path | SessionStore> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const store = yield* SessionStore;

  const layout = store.roundLayout(qaRootPath(path, cwd), options.round);
  const manifest = yield* store
    .readSessionManifest(layout)
    .pipe(QaCommandError.mapError(`qa judge-pack could not read ${layout.sessionPath}.`));
  const clockSync = yield* requireClockSync(manifest);
  const eventLog = yield* readEventLog(layout.eventsPath);
  const legacy = yield* readLegacyManifest(path.join(layout.root, "manifest.json"));

  const videoPath = yield* O.match(manifest.videoPath, {
    onNone: () => discoverRecordedVideo(layout.videoDir),
    onSome: (value) => Effect.succeedSome(value),
  });
  const videoDurationSeconds = yield* requireVideoDuration(layout, videoPath);

  const judgeDir = path.join(layout.root, "judge");
  yield* fs
    .makeDirectory(judgeDir, { recursive: true })
    .pipe(QaCommandError.mapError(`qa judge-pack could not create ${judgeDir}.`));

  const candidates = yield* collectCandidates(layout);
  const selection = selectJudgeEvidence(candidates, greenScreenshots(legacy));
  const judgeManifest = JudgeManifest.make({
    dropped: selection.dropped,
    files: selection.files,
    round: options.round,
    roundDir: layout.root,
    totalBytes: A.reduce(selection.files, 0, (total, file) => total + file.bytes),
  });

  const timeline = renderTimeline(
    RenderTimelineOptions.make({
      clockSync,
      eventLog,
      legacy,
      round: options.round,
      videoDurationSeconds,
    })
  );
  const templatePath = path.join(cwd, JUDGE_PROMPT_TEMPLATE);
  const template = yield* fs
    .readFileString(templatePath)
    .pipe(QaCommandError.mapError(`qa judge-pack could not read the judge prompt template at ${templatePath}.`));
  const scenarioNotes = O.match(legacy, {
    onNone: () => "_no legacy scenario manifest for this round._",
    onSome: (value) =>
      A.join(
        A.map(
          value.scenarios,
          (scenario) =>
            `- **${scenario.name}**${scenarioIsGreen(scenario) ? "" : " (has failing assertions)"}${A.isReadonlyArrayNonEmpty(scenario.notes) ? `: ${A.join(scenario.notes, "; ")}` : ""}`
        ),
        "\n"
      ),
  });
  const prompt = renderJudgePrompt(
    template,
    JudgePromptValues.make({
      round: options.round,
      roundDir: layout.root,
      scenarioNotes,
      surface: O.getOrElse(options.surface, () => manifest.session.url),
    })
  );

  const manifestJson = yield* S.encodeEffect(JudgeManifestJson)(judgeManifest).pipe(
    QaCommandError.mapError("qa judge-pack could not encode the judge manifest.")
  );

  yield* Effect.all(
    [
      fs.writeFileString(path.join(judgeDir, "manifest.json"), manifestJson),
      fs.writeFileString(path.join(judgeDir, "prompt.md"), prompt),
      fs.writeFileString(path.join(judgeDir, "timeline.md"), timeline),
    ],
    { concurrency: 3, discard: true }
  ).pipe(QaCommandError.mapError(`qa judge-pack could not write ${judgeDir}.`));

  yield* printLines([
    `qa judge-pack: round ${options.round} -> ${judgeDir}`,
    `  files: ${A.length(judgeManifest.files)} (${judgeManifest.totalBytes} bytes)`,
    `  dropped: ${A.length(judgeManifest.dropped)}`,
    `  next: node "\${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" task --model gpt-5.6-sol --effort high --prompt-file ${path.join(judgeDir, "prompt.md")}`,
  ]);

  return judgeManifest;
});
