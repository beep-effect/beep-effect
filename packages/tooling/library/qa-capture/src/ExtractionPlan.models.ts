/**
 * Schema-first extraction rule, window, budget, and plan models plus the
 * {@link QaDriverRequest} tagged union of `@beep/ffmpeg` driver requests.
 *
 * A plan never silently exceeds its budget and never hard-fails: every
 * merge, degradation, and drop is recorded in the plan's `dropped` list.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ExtractClipRequest, ExtractFramesAtRequest, RenderContactSheetRequest, RenderGifRequest } from "@beep/ffmpeg";
import { $QaCaptureId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Effect } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { DurationMilliseconds, EpochMilliseconds, SequenceNumber } from "./ActionEvent.models.ts";
import type * as AST from "effect/SchemaAST";

const $I = $QaCaptureId.create("ExtractionPlan.models");

/**
 * Extraction priorities from must-keep (`P0`) to first-dropped (`P2`).
 *
 * **Example** (Log P0 priority enum)
 *
 * ```ts
 * import { ExtractionPriority } from "@beep/qa-capture"
 * console.log(ExtractionPriority.Enum.P0)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExtractionPriority = LiteralKit(["P0", "P1", "P2"]).pipe(
  $I.annoteSchema("ExtractionPriority", {
    description: "Extraction priorities from must-keep (P0) to first-dropped (P2).",
  })
);

/**
 * Extraction priorities from must-keep (`P0`) to first-dropped (`P2`).
 *
 * **Example** (Assign typed priority value)
 *
 * ```ts
 * import { ExtractionPriority } from "@beep/qa-capture"
 * import type { ExtractionPriority as ExtractionPriorityValue } from "@beep/qa-capture"
 * const priority: ExtractionPriorityValue = ExtractionPriority.Enum.P1
 * console.log(priority)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ExtractionPriority = typeof ExtractionPriority.Type;

/**
 * Kinds of extraction rules the planner understands.
 *
 * **Example** (Log drag rule kind)
 *
 * ```ts
 * import { ExtractionRuleKind } from "@beep/qa-capture"
 * console.log(ExtractionRuleKind.Enum.drag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExtractionRuleKind = LiteralKit(["animation", "click", "drag", "hover", "marker", "transition"]).pipe(
  $I.annoteSchema("ExtractionRuleKind", {
    description: "Kinds of extraction rules the planner understands.",
  })
);

/**
 * Kinds of extraction rules the planner understands.
 *
 * **Example** (Assign typed rule kind)
 *
 * ```ts
 * import { ExtractionRuleKind } from "@beep/qa-capture"
 * import type { ExtractionRuleKind as ExtractionRuleKindValue } from "@beep/qa-capture"
 * const kind: ExtractionRuleKindValue = ExtractionRuleKind.Enum.marker
 * console.log(kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ExtractionRuleKind = typeof ExtractionRuleKind.Type;

/**
 * Reasons a window was merged, degraded, or dropped by the planner.
 *
 * **Example** (Log budget-dropped reason)
 *
 * ```ts
 * import { DropReason } from "@beep/qa-capture"
 * console.log(DropReason.Enum["budget-dropped"])
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DropReason = LiteralKit([
  "budget-dropped",
  "budget-fps-reduced",
  "budget-gif-to-strip",
  "budget-priority-dropped",
  "budget-width-reduced",
  "gif-capped",
  "overlap-merged",
]).pipe(
  $I.annoteSchema("DropReason", {
    description: "Reasons a window was merged, degraded, or dropped by the planner.",
  })
);

/**
 * Reasons a window was merged, degraded, or dropped by the planner.
 *
 * **Example** (Assign typed drop reason)
 *
 * ```ts
 * import { DropReason } from "@beep/qa-capture"
 * import type { DropReason as DropReasonValue } from "@beep/qa-capture"
 * const reason: DropReasonValue = DropReason.Enum["overlap-merged"]
 * console.log(reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DropReason = typeof DropReason.Type;

/**
 * One extraction rule with its priority, pads, and thresholds.
 *
 * **Details**
 *
 * The default rule set ({@link defaultExtractionRules}) encodes the planner
 * doctrine: markers get a frame plus a ±1 s GIF (P0); transitions and
 * animations get a GIF over `[start-100, end+100]` plus first/mid/last frames
 * (P1); drags of at least eight pixels get a GIF over `[down-100, up+300]` at
 * 15 fps plus a three-frame strip (P1); hovers dwelling at least 120 ms get a
 * strip (P2); clicks get a strip (P2).
 *
 * **Example** (Make a drag rule)
 *
 * ```ts
 * import { ExtractionRule } from "@beep/qa-capture"
 * const rule = ExtractionRule.make({
 *   enabled: true,
 *   gifFps: 15,
 *   kind: "drag",
 *   minDistancePx: 8,
 *   minDwellMs: 0,
 *   postRollMs: 300,
 *   preRollMs: 100,
 *   priority: "P1",
 *   renderGif: true,
 *   stripFractions: [0, 0.5, 1]
 * })
 * console.log(rule.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractionRule extends S.Class<ExtractionRule>($I`ExtractionRule`)(
  {
    enabled: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      S.withDecodingDefault(Effect.succeed(true)),
      $I.annoteKey("ExtractionRule.enabled", {
        description: "Whether the rule participates in planning.",
      })
    ),
    gifFps: S.Finite.check(
      S.isGreaterThan(0, {
        identifier: $I`ExtractionRuleGifFpsPositiveCheck`,
        title: "Extraction Rule Gif Fps Positive",
        description: "GIF frame rates are strictly positive.",
        message: "Expected a positive GIF frame rate",
      })
    ).pipe(
      SchemaUtils.withKeyDefaults(10),
      $I.annoteKey("ExtractionRule.gifFps", {
        description: "GIF frame rate used when the rule renders a GIF.",
      })
    ),
    kind: ExtractionRuleKind.pipe(
      $I.annoteKey("ExtractionRule.kind", {
        description: "Event pattern the rule reacts to.",
      })
    ),
    minDistancePx: S.Finite.check(
      S.isGreaterThanOrEqualTo(0, {
        identifier: $I`ExtractionRuleMinDistanceMinimumCheck`,
        title: "Extraction Rule Min Distance Minimum",
        description: "Distance thresholds are zero or greater.",
        message: "Expected a non-negative distance threshold",
      })
    ).pipe(
      SchemaUtils.withKeyDefaults(0),
      $I.annoteKey("ExtractionRule.minDistancePx", {
        description: "Minimum pointer travel in pixels before the rule fires (drag).",
      })
    ),
    minDwellMs: DurationMilliseconds.pipe(
      SchemaUtils.withKeyDefaults(0),
      $I.annoteKey("ExtractionRule.minDwellMs", {
        description: "Minimum dwell duration in milliseconds before the rule fires (hover).",
      })
    ),
    postRollMs: DurationMilliseconds.pipe(
      SchemaUtils.withKeyDefaults(0),
      $I.annoteKey("ExtractionRule.postRollMs", {
        description: "Milliseconds appended after the triggering span.",
      })
    ),
    preRollMs: DurationMilliseconds.pipe(
      SchemaUtils.withKeyDefaults(0),
      $I.annoteKey("ExtractionRule.preRollMs", {
        description: "Milliseconds prepended before the triggering span.",
      })
    ),
    priority: ExtractionPriority.pipe(
      $I.annoteKey("ExtractionRule.priority", {
        description: "Budget priority of windows produced by the rule.",
      })
    ),
    renderGif: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false)),
      $I.annoteKey("ExtractionRule.renderGif", {
        description: "Whether the rule renders a GIF over its window.",
      })
    ),
    stripFractions: S.Array(
      S.Finite.check(
        S.makeFilterGroup(
          [
            S.isGreaterThanOrEqualTo(0, {
              identifier: $I`ExtractionRuleStripFractionMinimumCheck`,
              title: "Extraction Rule Strip Fraction Minimum",
              description: "Strip fractions are zero or greater.",
              message: "Expected a strip fraction of at least zero",
            }),
            S.isLessThanOrEqualTo(1, {
              identifier: $I`ExtractionRuleStripFractionMaximumCheck`,
              title: "Extraction Rule Strip Fraction Maximum",
              description: "Strip fractions do not exceed one.",
              message: "Expected a strip fraction of at most one",
            }),
          ],
          {
            identifier: $I`ExtractionRuleStripFractionChecks`,
            title: "Extraction Rule Strip Fraction",
            description: "Checks for window-relative strip fractions.",
          }
        )
      )
    ).pipe(
      $I.annoteKey("ExtractionRule.stripFractions", {
        description: "Window-relative fractions (0..1) at which strip frames are extracted.",
      })
    ),
  },
  $I.annote("ExtractionRule", {
    description: "One extraction rule with its priority, pads, and thresholds.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(ExtractionRule);
}

/**
 * Rule set accepted by the planner (and the `beep qa extract --rules` file).
 *
 * **Example** (Decode empty rule set)
 *
 * ```ts
 * import { ExtractionRuleSet } from "@beep/qa-capture"
 * import * as S from "effect/Schema"
 * const effect = S.decodeUnknownEffect(ExtractionRuleSet)([])
 * console.log(effect)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExtractionRuleSet = S.Array(ExtractionRule).pipe(
  $I.annoteSchema("ExtractionRuleSet", {
    description: "Rule set accepted by the extraction planner.",
  })
);

/**
 * Rule set accepted by the planner (and the `beep qa extract --rules` file).
 *
 * **Example** (Type an empty rule set)
 *
 * ```ts
 * import type { ExtractionRuleSet } from "@beep/qa-capture"
 * const empty: ExtractionRuleSet = []
 * console.log(empty)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ExtractionRuleSet = typeof ExtractionRuleSet.Type;

/**
 * The default planner rule set.
 *
 * **Example** (Log default rules length)
 *
 * ```ts
 * import { defaultExtractionRules } from "@beep/qa-capture"
 * console.log(defaultExtractionRules.length)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const defaultExtractionRules: ExtractionRuleSet = [
  ExtractionRule.make({
    enabled: true,
    gifFps: 10,
    kind: "marker",
    minDistancePx: 0,
    minDwellMs: 0,
    postRollMs: 1000,
    preRollMs: 1000,
    priority: "P0",
    renderGif: true,
    stripFractions: [0.5],
  }),
  ExtractionRule.make({
    enabled: true,
    gifFps: 10,
    kind: "transition",
    minDistancePx: 0,
    minDwellMs: 0,
    postRollMs: 100,
    preRollMs: 100,
    priority: "P1",
    renderGif: true,
    stripFractions: [0, 0.5, 1],
  }),
  ExtractionRule.make({
    enabled: true,
    gifFps: 10,
    kind: "animation",
    minDistancePx: 0,
    minDwellMs: 0,
    postRollMs: 100,
    preRollMs: 100,
    priority: "P1",
    renderGif: true,
    stripFractions: [0, 0.5, 1],
  }),
  ExtractionRule.make({
    enabled: true,
    gifFps: 15,
    kind: "drag",
    minDistancePx: 8,
    minDwellMs: 0,
    postRollMs: 300,
    preRollMs: 100,
    priority: "P1",
    renderGif: true,
    stripFractions: [0, 0.5, 1],
  }),
  ExtractionRule.make({
    enabled: true,
    gifFps: 10,
    kind: "hover",
    minDistancePx: 0,
    minDwellMs: 120,
    postRollMs: 50,
    preRollMs: 50,
    priority: "P2",
    renderGif: false,
    stripFractions: [0, 0.5, 1],
  }),
  ExtractionRule.make({
    enabled: true,
    gifFps: 10,
    kind: "click",
    minDistancePx: 0,
    minDwellMs: 0,
    postRollMs: 250,
    preRollMs: 100,
    priority: "P2",
    renderGif: false,
    stripFractions: [0, 0.5, 1],
  }),
];

/**
 * Byte and duration budget applied to one extraction round.
 *
 * **Example** (Make default artifact budget)
 *
 * ```ts
 * import { ArtifactBudget } from "@beep/qa-capture"
 * const budget = ArtifactBudget.make({})
 * console.log(budget.maxTotalBytes)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArtifactBudget extends S.Class<ArtifactBudget>($I`ArtifactBudget`)(
  {
    maxGifSeconds: S.Finite.check(
      S.isGreaterThan(0, {
        identifier: $I`ArtifactBudgetMaxGifSecondsPositiveCheck`,
        title: "Artifact Budget Max Gif Seconds Positive",
        description: "GIF duration caps are strictly positive.",
        message: "Expected a positive GIF duration cap",
      })
    ).pipe(
      SchemaUtils.withKeyDefaults(6),
      $I.annoteKey("ArtifactBudget.maxGifSeconds", {
        description: "Maximum GIF duration in seconds; longer windows are capped.",
      })
    ),
    maxTotalBytes: S.Int.check(
      S.isGreaterThan(0, {
        identifier: $I`ArtifactBudgetMaxTotalBytesPositiveCheck`,
        title: "Artifact Budget Max Total Bytes Positive",
        description: "Round byte budgets are strictly positive.",
        message: "Expected a positive byte budget",
      })
    ).pipe(
      SchemaUtils.withKeyDefaults(20971520),
      $I.annoteKey("ArtifactBudget.maxTotalBytes", {
        description: "Maximum estimated total artifact bytes per round; defaults to 20 MiB.",
      })
    ),
  },
  $I.annote("ArtifactBudget", {
    description: "Byte and duration budget applied to one extraction round.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(ArtifactBudget);
}

/**
 * GIF rendering parameters attached to a window.
 *
 * **Example** (Make a GIF spec)
 *
 * ```ts
 * import { GifSpec } from "@beep/qa-capture"
 * const spec = GifSpec.make({ fps: 15, width: 640 })
 * console.log(spec)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GifSpec extends S.Class<GifSpec>($I`GifSpec`)(
  {
    fps: S.Finite.check(
      S.isGreaterThan(0, {
        identifier: $I`GifSpecFpsPositiveCheck`,
        title: "Gif Spec Fps Positive",
        description: "GIF frame rates are strictly positive.",
        message: "Expected a positive GIF frame rate",
      })
    ).pipe(
      $I.annoteKey("GifSpec.fps", {
        description: "GIF frame rate.",
      })
    ),
    width: S.Int.check(
      S.isGreaterThanOrEqualTo(1, {
        identifier: $I`GifSpecWidthMinimumCheck`,
        title: "Gif Spec Width Minimum",
        description: "GIF widths are positive integer pixel counts.",
        message: "Expected a positive GIF width",
      })
    ).pipe(
      $I.annoteKey("GifSpec.width", {
        description: "GIF pixel width; height follows the source aspect ratio.",
      })
    ),
  },
  $I.annote("GifSpec", {
    description: "GIF rendering parameters attached to a window.",
  })
) {}

/**
 * One planned extraction window in the witness wall-clock domain.
 *
 * **Example** (Make a drag window)
 *
 * ```ts
 * import { ExtractionWindow } from "@beep/qa-capture"
 * import * as O from "effect/Option"
 * const window = ExtractionWindow.make({
 *   endEpochMs: 1753838001300,
 *   frameTimesEpochMs: [1753838000900, 1753838001100, 1753838001300],
 *   gif: O.none(),
 *   label: "drag [data-qa=\"dock-sash\"]",
 *   priority: "P1",
 *   ruleKind: "drag",
 *   sourceSeqs: [4, 9],
 *   startEpochMs: 1753838000900
 * })
 * console.log(window.label)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractionWindow extends S.Class<ExtractionWindow>($I`ExtractionWindow`)(
  {
    endEpochMs: EpochMilliseconds.pipe(
      $I.annoteKey("ExtractionWindow.endEpochMs", {
        description: "Window end in epoch milliseconds.",
      })
    ),
    frameTimesEpochMs: S.Array(EpochMilliseconds).pipe(
      $I.annoteKey("ExtractionWindow.frameTimesEpochMs", {
        description: "Strip frame timestamps in epoch milliseconds.",
      })
    ),
    gif: S.OptionFromOptionalKey(GifSpec).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ExtractionWindow.gif", {
        description: "GIF rendering parameters, when the window renders a GIF.",
      })
    ),
    label: S.String.pipe(
      $I.annoteKey("ExtractionWindow.label", {
        description: "Human-readable window label used in artifact names.",
      })
    ),
    priority: ExtractionPriority.pipe(
      $I.annoteKey("ExtractionWindow.priority", {
        description: "Budget priority inherited from the producing rule.",
      })
    ),
    ruleKind: ExtractionRuleKind.pipe(
      $I.annoteKey("ExtractionWindow.ruleKind", {
        description: "Rule kind that produced the window.",
      })
    ),
    sourceSeqs: S.Array(SequenceNumber).pipe(
      $I.annoteKey("ExtractionWindow.sourceSeqs", {
        description: "Witness sequence numbers the window was derived from.",
      })
    ),
    startEpochMs: EpochMilliseconds.pipe(
      $I.annoteKey("ExtractionWindow.startEpochMs", {
        description: "Window start in epoch milliseconds.",
      })
    ),
  },
  $I.annote("ExtractionWindow", {
    description: "One planned extraction window in the witness wall-clock domain.",
  })
) {}

/**
 * Record of a window that was merged, degraded, or dropped.
 *
 * **Example** (Make a dropped window)
 *
 * ```ts
 * import { DroppedWindow } from "@beep/qa-capture"
 * import * as O from "effect/Option"
 * const dropped = DroppedWindow.make({
 *   detail: O.some("absorbed into drag window at 1753838000900"),
 *   endEpochMs: 1753838001300,
 *   priority: "P2",
 *   reason: "overlap-merged",
 *   ruleKind: "hover",
 *   startEpochMs: 1753838000950
 * })
 * console.log(dropped.reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DroppedWindow extends S.Class<DroppedWindow>($I`DroppedWindow`)(
  {
    detail: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("DroppedWindow.detail", {
        description: "Free-form context for the merge, degradation, or drop.",
      })
    ),
    endEpochMs: EpochMilliseconds.pipe(
      $I.annoteKey("DroppedWindow.endEpochMs", {
        description: "Window end in epoch milliseconds.",
      })
    ),
    priority: ExtractionPriority.pipe(
      $I.annoteKey("DroppedWindow.priority", {
        description: "Budget priority of the affected window.",
      })
    ),
    reason: DropReason.pipe(
      $I.annoteKey("DroppedWindow.reason", {
        description: "Why the window was merged, degraded, or dropped.",
      })
    ),
    ruleKind: ExtractionRuleKind.pipe(
      $I.annoteKey("DroppedWindow.ruleKind", {
        description: "Rule kind that produced the affected window.",
      })
    ),
    startEpochMs: EpochMilliseconds.pipe(
      $I.annoteKey("DroppedWindow.startEpochMs", {
        description: "Window start in epoch milliseconds.",
      })
    ),
  },
  $I.annote("DroppedWindow", {
    description: "Record of a window that was merged, degraded, or dropped.",
  })
) {}

/**
 * Complete extraction plan for one round.
 *
 * **Example** (Make an empty plan)
 *
 * ```ts
 * import { ArtifactBudget, ExtractionPlan } from "@beep/qa-capture"
 * const plan = ExtractionPlan.make({
 *   budget: ArtifactBudget.make({}),
 *   dropped: [],
 *   estimatedTotalBytes: 0,
 *   schemaVersion: "beep.qa.extraction-plan.v1",
 *   windows: []
 * })
 * console.log(plan.schemaVersion)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractionPlan extends S.Class<ExtractionPlan>($I`ExtractionPlan`)(
  {
    budget: ArtifactBudget.pipe(
      $I.annoteKey("ExtractionPlan.budget", {
        description: "Budget the plan was fitted under.",
      })
    ),
    dropped: S.Array(DroppedWindow).pipe(
      $I.annoteKey("ExtractionPlan.dropped", {
        description: "Every merge, degradation, and drop applied while fitting the budget.",
      })
    ),
    estimatedTotalBytes: S.Int.check(
      S.isGreaterThanOrEqualTo(0, {
        identifier: $I`ExtractionPlanEstimatedTotalBytesMinimumCheck`,
        title: "Extraction Plan Estimated Total Bytes Minimum",
        description: "Estimated totals are zero or greater.",
        message: "Expected a non-negative estimated byte total",
      })
    ).pipe(
      $I.annoteKey("ExtractionPlan.estimatedTotalBytes", {
        description: "Deterministic byte estimate of all planned artifacts.",
      })
    ),
    schemaVersion: S.Literal("beep.qa.extraction-plan.v1").pipe(
      $I.annoteKey("ExtractionPlan.schemaVersion", {
        description: "Extraction plan schema version literal.",
      })
    ),
    windows: S.Array(ExtractionWindow).pipe(
      $I.annoteKey("ExtractionPlan.windows", {
        description: "Windows kept by the plan, in start order.",
      })
    ),
  },
  $I.annote("ExtractionPlan", {
    description: "Complete extraction plan for one round.",
  })
) {}

/**
 * Planned frame-strip extraction wrapping an ffmpeg request.
 *
 * **Example** (Make planned frame extraction)
 *
 * ```ts
 * import { ExtractFramesAtRequest } from "@beep/ffmpeg"
 * import { ExtractFramesAtPlanned } from "@beep/qa-capture"
 * import * as O from "effect/Option"
 * const planned = ExtractFramesAtPlanned.make({
 *   kind: "extract-frames-at",
 *   request: ExtractFramesAtRequest.make({
 *     manifestPath: O.none(),
 *     outDir: "./frames",
 *     overwrite: false,
 *     prefix: O.none(),
 *     timestampsSeconds: [0.9, 1.1, 1.3],
 *     videoPath: "./video/capture.webm"
 *   })
 * })
 * console.log(planned.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractFramesAtPlanned extends S.Class<ExtractFramesAtPlanned>($I`ExtractFramesAtPlanned`)(
  {
    kind: S.tag("extract-frames-at").pipe(
      $I.annoteKey("ExtractFramesAtPlanned.kind", {
        description: "Discriminator for planned frame-strip extractions.",
      })
    ),
    request: ExtractFramesAtRequest.pipe(
      $I.annoteKey("ExtractFramesAtPlanned.request", {
        description: "The ffmpeg extract-frames-at request to run.",
      })
    ),
  },
  $I.annote("ExtractFramesAtPlanned", {
    description: "Planned frame-strip extraction wrapping an ffmpeg request.",
  })
) {}

/**
 * Planned GIF rendering wrapping an ffmpeg request.
 *
 * **Example** (Make planned GIF render)
 *
 * ```ts
 * import { RenderGifRequest } from "@beep/ffmpeg"
 * import { RenderGifPlanned } from "@beep/qa-capture"
 * const planned = RenderGifPlanned.make({
 *   kind: "render-gif",
 *   request: RenderGifRequest.make({
 *     durationSeconds: 1.4,
 *     outPath: "./clips/drag.gif",
 *     startSeconds: 0.8,
 *     videoPath: "./video/capture.webm"
 *   })
 * })
 * console.log(planned.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RenderGifPlanned extends S.Class<RenderGifPlanned>($I`RenderGifPlanned`)(
  {
    kind: S.tag("render-gif").pipe(
      $I.annoteKey("RenderGifPlanned.kind", {
        description: "Discriminator for planned GIF renders.",
      })
    ),
    request: RenderGifRequest.pipe(
      $I.annoteKey("RenderGifPlanned.request", {
        description: "The ffmpeg render-gif request to run.",
      })
    ),
  },
  $I.annote("RenderGifPlanned", {
    description: "Planned GIF rendering wrapping an ffmpeg request.",
  })
) {}

/**
 * Planned contact-sheet rendering wrapping an ffmpeg request.
 *
 * **Example** (Make planned contact sheet)
 *
 * ```ts
 * import { RenderContactSheetRequest } from "@beep/ffmpeg"
 * import { RenderContactSheetPlanned } from "@beep/qa-capture"
 * const planned = RenderContactSheetPlanned.make({
 *   kind: "render-contact-sheet",
 *   request: RenderContactSheetRequest.make({
 *     outPath: "./sheets/capture.jpg",
 *     videoPath: "./video/capture.webm"
 *   })
 * })
 * console.log(planned.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RenderContactSheetPlanned extends S.Class<RenderContactSheetPlanned>($I`RenderContactSheetPlanned`)(
  {
    kind: S.tag("render-contact-sheet").pipe(
      $I.annoteKey("RenderContactSheetPlanned.kind", {
        description: "Discriminator for planned contact-sheet renders.",
      })
    ),
    request: RenderContactSheetRequest.pipe(
      $I.annoteKey("RenderContactSheetPlanned.request", {
        description: "The ffmpeg render-contact-sheet request to run.",
      })
    ),
  },
  $I.annote("RenderContactSheetPlanned", {
    description: "Planned contact-sheet rendering wrapping an ffmpeg request.",
  })
) {}

/**
 * Planned clip extraction wrapping an ffmpeg request.
 *
 * **Example** (Make planned clip extraction)
 *
 * ```ts
 * import { ExtractClipRequest } from "@beep/ffmpeg"
 * import { ExtractClipPlanned } from "@beep/qa-capture"
 * import * as O from "effect/Option"
 * const planned = ExtractClipPlanned.make({
 *   kind: "extract-clip",
 *   request: ExtractClipRequest.make({
 *     durationSeconds: O.some(2),
 *     outPath: "./clips/drag.mp4",
 *     startSeconds: 0.8,
 *     videoPath: "./video/capture.webm"
 *   })
 * })
 * console.log(planned.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractClipPlanned extends S.Class<ExtractClipPlanned>($I`ExtractClipPlanned`)(
  {
    kind: S.tag("extract-clip").pipe(
      $I.annoteKey("ExtractClipPlanned.kind", {
        description: "Discriminator for planned clip extractions.",
      })
    ),
    request: ExtractClipRequest.pipe(
      $I.annoteKey("ExtractClipPlanned.request", {
        description: "The ffmpeg extract-clip request to run.",
      })
    ),
  },
  $I.annote("ExtractClipPlanned", {
    description: "Planned clip extraction wrapping an ffmpeg request.",
  })
) {}

/**
 * Tagged union of `@beep/ffmpeg` driver requests emitted by the planner.
 *
 * **Example** (Inspect driver request kind)
 *
 * ```ts
 * import { QaDriverRequest } from "@beep/qa-capture"
 * import type { QaDriverRequest as QaDriverRequestValue } from "@beep/qa-capture"
 * const kindOf = (request: QaDriverRequestValue) => request.kind
 * console.log(kindOf)
 * console.log(QaDriverRequest)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const QaDriverRequest = S.Union([
  ExtractClipPlanned,
  ExtractFramesAtPlanned,
  RenderContactSheetPlanned,
  RenderGifPlanned,
]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("QaDriverRequest", {
    description: "Tagged union of ffmpeg driver requests emitted by the planner.",
  })
);

/**
 * Tagged union of `@beep/ffmpeg` driver requests emitted by the planner.
 *
 * **Example** (Type a driver request)
 *
 * ```ts
 * import type { QaDriverRequest } from "@beep/qa-capture"
 * const kindOf = (request: QaDriverRequest) => request.kind
 * console.log(kindOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type QaDriverRequest = typeof QaDriverRequest.Type;

/**
 * Decode an unknown value into an {@link ExtractionRuleSet}.
 *
 * **Example** (Decode empty rule set)
 *
 * ```ts
 * import { decodeExtractionRuleSet } from "@beep/qa-capture"
 * const effect = decodeExtractionRuleSet([])
 * console.log(effect)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeExtractionRuleSet: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<ExtractionRuleSet, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<ExtractionRuleSet, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(ExtractionRuleSet));

/**
 * Decode an unknown value into an {@link ExtractionPlan}.
 *
 * **Example** (Decode empty extraction plan)
 *
 * ```ts
 * import { decodeExtractionPlan } from "@beep/qa-capture"
 * const effect = decodeExtractionPlan({})
 * console.log(effect)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeExtractionPlan: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<ExtractionPlan, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<ExtractionPlan, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(ExtractionPlan));

/**
 * Encode an {@link ExtractionPlan} into its JSON string representation.
 *
 * **Example** (Encode plan to JSON)
 *
 * ```ts
 * import { encodeExtractionPlanJson } from "@beep/qa-capture"
 * import type { ExtractionPlan } from "@beep/qa-capture"
 * const encode = (plan: ExtractionPlan) => encodeExtractionPlanJson(plan)
 * console.log(encode)
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeExtractionPlanJson: {
  (options?: AST.ParseOptions): (input: ExtractionPlan) => Effect.Effect<string, S.SchemaError>;
  (input: ExtractionPlan, options?: AST.ParseOptions): Effect.Effect<string, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeEffect(S.fromJsonString(ExtractionPlan)));
