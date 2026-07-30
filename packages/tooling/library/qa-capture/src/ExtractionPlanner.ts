/**
 * Pure extraction planning: witness events in, budget-fitted windows and
 * `@beep/ffmpeg` driver requests out.
 *
 * The planner never silently exceeds its budget and never hard-fails: every
 * merge, degradation, and drop is recorded in the resulting plan's `dropped`
 * list. The whole-video contact sheet (one small JPEG per round) rides
 * outside the window budget and is always emitted.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ExtractFramesAtRequest, RenderContactSheetRequest, RenderGifRequest } from "@beep/ffmpeg";
import { $QaCaptureId } from "@beep/identity/packages";
import { A, O } from "@beep/utils";
import { Match, MutableHashMap, Number as N, Order, pipe } from "effect";
import * as S from "effect/Schema";
import {
  ArtifactBudget,
  DroppedWindow,
  defaultExtractionRules,
  ExtractFramesAtPlanned,
  ExtractionPlan,
  ExtractionWindow,
  GifSpec,
  RenderContactSheetPlanned,
  RenderGifPlanned,
} from "./ExtractionPlan.models.ts";
import { ClockSync } from "./QaCapture.models.ts";
import type {
  ActionEvent,
  CssAnimationEvent,
  CssTransitionEvent,
  PointerDownEvent,
  PointerEnterEvent,
} from "./ActionEvent.models.ts";
import type {
  ExtractionRule,
  ExtractionRuleKind,
  ExtractionRuleSet,
  QaDriverRequest,
} from "./ExtractionPlan.models.ts";

const $I = $QaCaptureId.create("ExtractionPlanner");

/**
 * Maximum gap in milliseconds between same-kind windows that still merges.
 *
 * @example
 * ```ts
 * import { OVERLAP_MERGE_GAP_MS } from "@beep/qa-capture"
 *
 * console.log(OVERLAP_MERGE_GAP_MS)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const OVERLAP_MERGE_GAP_MS = 250;

/**
 * Deterministic byte estimate for one extracted full-resolution PNG frame.
 *
 * @example
 * ```ts
 * import { FRAME_ESTIMATED_BYTES } from "@beep/qa-capture"
 *
 * console.log(FRAME_ESTIMATED_BYTES)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FRAME_ESTIMATED_BYTES = 60000;

/**
 * Deterministic GIF byte estimate per width pixel per frame.
 *
 * A 640-wide 10 fps GIF estimates to roughly 154 KB per second. Calibrated
 * against the recorded-qa-acceptance round-1 measurements: palette-quantized
 * GIFs of mostly-static UI compress far below photographic estimates, and the
 * original 80 bytes/width-px/frame figure degraded every GIF to strips.
 *
 * @example
 * ```ts
 * import { GIF_BYTES_PER_WIDTH_PIXEL_FRAME } from "@beep/qa-capture"
 *
 * console.log(GIF_BYTES_PER_WIDTH_PIXEL_FRAME)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const GIF_BYTES_PER_WIDTH_PIXEL_FRAME = 24;

/**
 * Deterministic byte estimate for the whole-video contact sheet JPEG.
 *
 * The sheet is always emitted and rides outside the window budget.
 *
 * @example
 * ```ts
 * import { SHEET_ESTIMATED_BYTES } from "@beep/qa-capture"
 *
 * console.log(SHEET_ESTIMATED_BYTES)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SHEET_ESTIMATED_BYTES = 320000;

/**
 * Minimum GIF duration in seconds after clamping to the video timeline.
 *
 * @example
 * ```ts
 * import { MIN_GIF_SECONDS } from "@beep/qa-capture"
 *
 * console.log(MIN_GIF_SECONDS)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MIN_GIF_SECONDS = 0.2;

const DEGRADED_GIF_FPS = 10;
const DEGRADED_GIF_WIDTH = 480;
const DEFAULT_GIF_WIDTH = 640;
const HOVER_MID_OFFSET_MS = 200;

const byStart = Order.mapInput(Order.Number, (window: ExtractionWindow) => window.startEpochMs);
const byEventTime = Order.combine(
  Order.mapInput(Order.Number, (event: ActionEvent) => event.tEpochMs),
  Order.mapInput(Order.Number, (event: ActionEvent) => event.seq)
);
const priorityRank = { P0: 0, P1: 1, P2: 2 } as const;
const byBudgetDropOrder = Order.combine(
  Order.mapInput(Order.Number, (window: ExtractionWindow) => -priorityRank[window.priority]),
  Order.mapInput(Order.Number, (window: ExtractionWindow) => -window.startEpochMs)
);

const sortedUnique = (values: ReadonlyArray<number>): ReadonlyArray<number> =>
  pipe(values, A.dedupe, A.sort(Order.Number));

const enabledRule = (rules: ExtractionRuleSet, kind: ExtractionRuleKind): O.Option<ExtractionRule> =>
  A.findFirst(rules, (rule) => rule.kind === kind && rule.enabled);

const fractionTimes = (rule: ExtractionRule, startEpochMs: number, endEpochMs: number): ReadonlyArray<number> =>
  sortedUnique(A.map(rule.stripFractions, (fraction) => startEpochMs + fraction * (endEpochMs - startEpochMs)));

const spanWindow = (options: {
  readonly rule: ExtractionRule;
  readonly spanStartEpochMs: number;
  readonly spanEndEpochMs: number;
  readonly label: string;
  readonly sourceSeqs: ReadonlyArray<number>;
  readonly frameTimesEpochMs?: ReadonlyArray<number> | undefined;
}): ExtractionWindow => {
  const startEpochMs = Math.max(0, options.spanStartEpochMs - options.rule.preRollMs);
  const endEpochMs = Math.max(startEpochMs, options.spanEndEpochMs + options.rule.postRollMs);
  return ExtractionWindow.make({
    endEpochMs,
    frameTimesEpochMs: options.frameTimesEpochMs ?? fractionTimes(options.rule, startEpochMs, endEpochMs),
    gif: options.rule.renderGif
      ? O.some(GifSpec.make({ fps: options.rule.gifFps, width: DEFAULT_GIF_WIDTH }))
      : O.none(),
    label: options.label,
    priority: options.rule.priority,
    ruleKind: options.rule.kind,
    sourceSeqs: sortedUnique(options.sourceSeqs),
    startEpochMs,
  });
};

type OpenPointer = {
  readonly down: PointerDownEvent;
  readonly maxDistancePx: number;
};

type PlanState = {
  readonly windows: Array<ExtractionWindow>;
  readonly openAnimations: MutableHashMap.MutableHashMap<string, CssAnimationEvent>;
  readonly openHovers: MutableHashMap.MutableHashMap<string, PointerEnterEvent>;
  readonly openPointers: MutableHashMap.MutableHashMap<number, OpenPointer>;
  readonly openTransitions: MutableHashMap.MutableHashMap<string, CssTransitionEvent>;
};

const distancePx = (down: PointerDownEvent, x: number, y: number): number => Math.hypot(x - down.x, y - down.y);

/**
 * Derive extraction windows from a witness event stream.
 *
 * Pairing state (open transitions, animations, gestures, hovers) is tracked
 * with `MutableHashMap`s local to the call; the function stays pure.
 *
 * @example
 * ```ts
 * import { defaultExtractionRules, MarkerEvent, planWindows } from "@beep/qa-capture"
 *
 * const windows = planWindows(
 *   [MarkerEvent.make({ kind: "marker", label: "scenario:start", seq: 1, tEpochMs: 1753838000000 })],
 *   defaultExtractionRules
 * )
 * console.log(windows.length)
 * ```
 *
 * @category planning
 * @since 0.0.0
 */
export const planWindows = (
  events: ReadonlyArray<ActionEvent>,
  rules: ExtractionRuleSet
): ReadonlyArray<ExtractionWindow> => {
  const state: PlanState = {
    openAnimations: MutableHashMap.empty(),
    openHovers: MutableHashMap.empty(),
    openPointers: MutableHashMap.empty(),
    openTransitions: MutableHashMap.empty(),
    windows: [],
  };

  const markerRule = enabledRule(rules, "marker");
  const transitionRule = enabledRule(rules, "transition");
  const animationRule = enabledRule(rules, "animation");
  const dragRule = enabledRule(rules, "drag");
  const hoverRule = enabledRule(rules, "hover");
  const clickRule = enabledRule(rules, "click");

  const pushSpan = (
    rule: O.Option<ExtractionRule>,
    spanStartEpochMs: number,
    spanEndEpochMs: number,
    label: string,
    sourceSeqs: ReadonlyArray<number>,
    frameTimesEpochMs?: ReadonlyArray<number> | undefined
  ): void =>
    O.match(rule, {
      onNone: () => undefined,
      onSome: (found) => {
        state.windows[A.length(state.windows)] = spanWindow({
          frameTimesEpochMs,
          label,
          rule: found,
          sourceSeqs,
          spanEndEpochMs,
          spanStartEpochMs,
        });
        return undefined;
      },
    });

  const closeSpanEvent = (
    rule: O.Option<ExtractionRule>,
    open: O.Option<CssTransitionEvent | CssAnimationEvent>,
    event: CssTransitionEvent | CssAnimationEvent,
    label: string
  ): void =>
    O.match(open, {
      onNone: () => pushSpan(rule, Math.max(0, event.tEpochMs - event.durationMs), event.tEpochMs, label, [event.seq]),
      onSome: (start) => pushSpan(rule, start.tEpochMs, event.tEpochMs, label, [start.seq, event.seq]),
    });

  const handleEvent = Match.type<ActionEvent>().pipe(
    Match.discriminators("kind")({
      animation: (event) => {
        const key = `${event.selectorPath}|${event.animationName}`;
        if (event.phase === "start") {
          MutableHashMap.set(state.openAnimations, key, event);
          return;
        }
        const open = MutableHashMap.get(state.openAnimations, key);
        MutableHashMap.remove(state.openAnimations, key);
        closeSpanEvent(animationRule, open, event, `animation:${event.animationName}@${event.selectorPath}`);
      },
      marker: (event) => pushSpan(markerRule, event.tEpochMs, event.tEpochMs, `marker:${event.label}`, [event.seq]),
      "pointer-down": (event) =>
        MutableHashMap.set(state.openPointers, event.pointerId, { down: event, maxDistancePx: 0 }),
      "pointer-enter": (event) => MutableHashMap.set(state.openHovers, event.selectorPath, event),
      "pointer-leave": (event) => {
        const open = MutableHashMap.get(state.openHovers, event.selectorPath);
        MutableHashMap.remove(state.openHovers, event.selectorPath);
        O.match(open, {
          onNone: () => undefined,
          onSome: (enter) =>
            O.match(hoverRule, {
              onNone: () => undefined,
              onSome: (rule) => {
                const dwellMs = event.tEpochMs - enter.tEpochMs;
                if (dwellMs < rule.minDwellMs) {
                  return undefined;
                }
                const startEpochMs = Math.max(0, enter.tEpochMs - rule.preRollMs);
                const endEpochMs = event.tEpochMs + rule.postRollMs;
                // The hover strip is anchored, not fractional: enter-50,
                // enter+150, leave+50 per the planner doctrine.
                pushSpan(
                  hoverRule,
                  enter.tEpochMs,
                  event.tEpochMs,
                  `hover:${event.selectorPath}`,
                  [enter.seq, event.seq],
                  sortedUnique([startEpochMs, Math.min(startEpochMs + HOVER_MID_OFFSET_MS, endEpochMs), endEpochMs])
                );
                return undefined;
              },
            }),
        });
      },
      "pointer-move": (event) => {
        const open = MutableHashMap.get(state.openPointers, event.pointerId);
        O.match(open, {
          onNone: () => undefined,
          onSome: (tracked) =>
            MutableHashMap.set(state.openPointers, event.pointerId, {
              down: tracked.down,
              maxDistancePx: Math.max(tracked.maxDistancePx, distancePx(tracked.down, event.x, event.y)),
            }),
        });
      },
      "pointer-up": (event) => {
        const open = MutableHashMap.get(state.openPointers, event.pointerId);
        MutableHashMap.remove(state.openPointers, event.pointerId);
        O.match(open, {
          onNone: () => undefined,
          onSome: (tracked) => {
            const travelled = Math.max(tracked.maxDistancePx, distancePx(tracked.down, event.x, event.y));
            const isDrag = O.match(dragRule, {
              onNone: () => false,
              onSome: (rule) => travelled >= rule.minDistancePx,
            });
            if (isDrag) {
              pushSpan(dragRule, tracked.down.tEpochMs, event.tEpochMs, `drag:${tracked.down.selectorPath}`, [
                tracked.down.seq,
                event.seq,
              ]);
              return undefined;
            }
            pushSpan(clickRule, tracked.down.tEpochMs, event.tEpochMs, `click:${tracked.down.selectorPath}`, [
              tracked.down.seq,
              event.seq,
            ]);
            return undefined;
          },
        });
      },
      transition: (event) => {
        const key = `${event.selectorPath}|${event.property}`;
        if (event.phase === "start") {
          MutableHashMap.set(state.openTransitions, key, event);
          return;
        }
        const open = MutableHashMap.get(state.openTransitions, key);
        MutableHashMap.remove(state.openTransitions, key);
        closeSpanEvent(transitionRule, open, event, `transition:${event.property}@${event.selectorPath}`);
      },
    }),
    Match.orElse(() => undefined)
  );

  A.forEach(A.sort(events, byEventTime), (event) => {
    handleEvent(event);
  });

  // Close dangling transition/animation starts using their computed duration.
  MutableHashMap.forEach(state.openTransitions, (start) =>
    pushSpan(
      transitionRule,
      start.tEpochMs,
      start.tEpochMs + start.durationMs,
      `transition:${start.property}@${start.selectorPath}`,
      [start.seq]
    )
  );
  MutableHashMap.forEach(state.openAnimations, (start) =>
    pushSpan(
      animationRule,
      start.tEpochMs,
      start.tEpochMs + start.durationMs,
      `animation:${start.animationName}@${start.selectorPath}`,
      [start.seq]
    )
  );

  return A.sort(state.windows, byStart);
};

/**
 * Result of an overlap merge or budget fit over extraction windows.
 *
 * @example
 * ```ts
 * import type { WindowFitResult } from "@beep/qa-capture"
 *
 * const empty: WindowFitResult = { dropped: [], windows: [] }
 * console.log(empty)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type WindowFitResult = {
  readonly dropped: ReadonlyArray<DroppedWindow>;
  readonly windows: ReadonlyArray<ExtractionWindow>;
};

const droppedFrom = (window: ExtractionWindow, reason: DroppedWindow["reason"], detail: string): DroppedWindow =>
  DroppedWindow.make({
    detail: O.some(detail),
    endEpochMs: window.endEpochMs,
    priority: window.priority,
    reason,
    ruleKind: window.ruleKind,
    startEpochMs: window.startEpochMs,
  });

const mergeGifSpecs = (left: O.Option<GifSpec>, right: O.Option<GifSpec>): O.Option<GifSpec> =>
  O.match(left, {
    onNone: () => right,
    onSome: (a) =>
      O.match(right, {
        onNone: () => left,
        onSome: (b) => O.some(a.fps >= b.fps ? a : b),
      }),
  });

const mergeTwo = (kept: ExtractionWindow, next: ExtractionWindow): ExtractionWindow =>
  ExtractionWindow.make({
    endEpochMs: Math.max(kept.endEpochMs, next.endEpochMs),
    frameTimesEpochMs: sortedUnique([...kept.frameTimesEpochMs, ...next.frameTimesEpochMs]),
    gif: mergeGifSpecs(kept.gif, next.gif),
    label: kept.label,
    priority: priorityRank[kept.priority] <= priorityRank[next.priority] ? kept.priority : next.priority,
    ruleKind: kept.ruleKind,
    sourceSeqs: sortedUnique([...kept.sourceSeqs, ...next.sourceSeqs]),
    startEpochMs: Math.min(kept.startEpochMs, next.startEpochMs),
  });

/**
 * Merge same-kind windows that start less than
 * {@link OVERLAP_MERGE_GAP_MS} after the previous one ends.
 *
 * Every absorbed window is recorded in `dropped` with reason
 * `overlap-merged`.
 *
 * @example
 * ```ts
 * import { mergeOverlappingWindows } from "@beep/qa-capture"
 *
 * const result = mergeOverlappingWindows([])
 * console.log(result.windows.length)
 * ```
 *
 * @category planning
 * @since 0.0.0
 */
export const mergeOverlappingWindows = (windows: ReadonlyArray<ExtractionWindow>): WindowFitResult => {
  const kept: Array<ExtractionWindow> = [];
  const dropped: Array<DroppedWindow> = [];
  const lastIndexByKind = MutableHashMap.empty<ExtractionRuleKind, number>();

  A.forEach(A.sort(windows, byStart), (window) => {
    const lastIndex = MutableHashMap.get(lastIndexByKind, window.ruleKind);
    const merged = O.flatMap(lastIndex, (index) =>
      pipe(
        O.fromUndefinedOr(kept[index]),
        O.filter((previous) => window.startEpochMs - previous.endEpochMs < OVERLAP_MERGE_GAP_MS),
        O.map((previous) => ({ index, previous }))
      )
    );
    O.match(merged, {
      onNone: () => {
        kept[A.length(kept)] = window;
        MutableHashMap.set(lastIndexByKind, window.ruleKind, A.length(kept) - 1);
        return undefined;
      },
      onSome: ({ index, previous }) => {
        kept[index] = mergeTwo(previous, window);
        dropped[A.length(dropped)] = droppedFrom(
          window,
          "overlap-merged",
          `absorbed into ${previous.ruleKind} window starting at ${previous.startEpochMs}`
        );
        return undefined;
      },
    });
  });

  return { dropped, windows: kept };
};

/**
 * Deterministically estimate the committed byte size of one window's
 * artifacts under a budget's GIF duration cap.
 *
 * @example
 * ```ts
 * import { ArtifactBudget, estimateWindowBytes, ExtractionWindow } from "@beep/qa-capture"
 * import * as O from "effect/Option"
 *
 * const bytes = estimateWindowBytes(
 *   ExtractionWindow.make({
 *     endEpochMs: 1000,
 *     frameTimesEpochMs: [0, 500, 1000],
 *     gif: O.none(),
 *     label: "click:button",
 *     priority: "P2",
 *     ruleKind: "click",
 *     sourceSeqs: [1, 2],
 *     startEpochMs: 0
 *   }),
 *   ArtifactBudget.make({})
 * )
 * console.log(bytes)
 * ```
 *
 * @category planning
 * @since 0.0.0
 */
export const estimateWindowBytes = (window: ExtractionWindow, budget: ArtifactBudget): number => {
  const frameBytes = A.length(window.frameTimesEpochMs) * FRAME_ESTIMATED_BYTES;
  const gifBytes = O.match(window.gif, {
    onNone: () => 0,
    onSome: (spec) => {
      const durationSeconds = Math.max(
        MIN_GIF_SECONDS,
        Math.min((window.endEpochMs - window.startEpochMs) / 1000, budget.maxGifSeconds)
      );
      return Math.ceil(durationSeconds * spec.fps * spec.width * GIF_BYTES_PER_WIDTH_PIXEL_FRAME);
    },
  });
  return frameBytes + gifBytes;
};

const estimateTotal = (windows: ReadonlyArray<ExtractionWindow>, budget: ArtifactBudget): number =>
  A.reduce(windows, 0, (total, window) => total + estimateWindowBytes(window, budget));

const withGif = (window: ExtractionWindow, gif: O.Option<GifSpec>): ExtractionWindow =>
  ExtractionWindow.make({
    endEpochMs: window.endEpochMs,
    frameTimesEpochMs: window.frameTimesEpochMs,
    gif,
    label: window.label,
    priority: window.priority,
    ruleKind: window.ruleKind,
    sourceSeqs: window.sourceSeqs,
    startEpochMs: window.startEpochMs,
  });

/**
 * Result of fitting windows under an {@link ArtifactBudget}.
 *
 * @example
 * ```ts
 * import type { BudgetFitResult } from "@beep/qa-capture"
 *
 * const empty: BudgetFitResult = { dropped: [], estimatedTotalBytes: 0, windows: [] }
 * console.log(empty)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BudgetFitResult = {
  readonly dropped: ReadonlyArray<DroppedWindow>;
  readonly estimatedTotalBytes: number;
  readonly windows: ReadonlyArray<ExtractionWindow>;
};

/**
 * Fit windows under a byte budget via the degradation ladder.
 *
 * Ladder: drop P2 windows, reduce GIF fps to 10, reduce GIF width to 480,
 * turn GIFs into strips, then drop remaining windows lowest-priority-first
 * (latest start first inside a priority). Every step is recorded in
 * `dropped`; the returned estimate never exceeds the budget.
 *
 * @example
 * ```ts
 * import { applyBudget, ArtifactBudget } from "@beep/qa-capture"
 *
 * const result = applyBudget([], ArtifactBudget.make({}))
 * console.log(result.estimatedTotalBytes)
 * ```
 *
 * @category planning
 * @since 0.0.0
 */
export const applyBudget = (windows: ReadonlyArray<ExtractionWindow>, budget: ArtifactBudget): BudgetFitResult => {
  const dropped: Array<DroppedWindow> = [];
  let current: ReadonlyArray<ExtractionWindow> = windows;

  // Record capped GIF windows up front; estimation and request building both
  // apply the cap, the window itself keeps its true span.
  A.forEach(current, (window) => {
    const overCap = O.isSome(window.gif) && (window.endEpochMs - window.startEpochMs) / 1000 > budget.maxGifSeconds;
    if (overCap) {
      dropped[A.length(dropped)] = droppedFrom(
        window,
        "gif-capped",
        `gif clamped to ${budget.maxGifSeconds}s of a ${(window.endEpochMs - window.startEpochMs) / 1000}s window`
      );
    }
  });

  const overBudget = (): boolean => estimateTotal(current, budget) > budget.maxTotalBytes;

  // Step 1: drop P2 windows.
  if (overBudget()) {
    A.forEach(
      A.filter(current, (window) => window.priority === "P2"),
      (window) => {
        dropped[A.length(dropped)] = droppedFrom(window, "budget-priority-dropped", "P2 dropped by ladder step 1");
      }
    );
    current = A.filter(current, (window) => window.priority !== "P2");
  }

  // Step 2: reduce GIF fps.
  if (overBudget()) {
    current = A.map(current, (window) =>
      O.match(
        O.filter(window.gif, (spec) => spec.fps > DEGRADED_GIF_FPS),
        {
          onNone: () => window,
          onSome: (spec) => {
            dropped[A.length(dropped)] = droppedFrom(
              window,
              "budget-fps-reduced",
              `gif fps ${spec.fps} -> ${DEGRADED_GIF_FPS} by ladder step 2`
            );
            return withGif(window, O.some(GifSpec.make({ fps: DEGRADED_GIF_FPS, width: spec.width })));
          },
        }
      )
    );
  }

  // Step 3: reduce GIF width.
  if (overBudget()) {
    current = A.map(current, (window) =>
      O.match(
        O.filter(window.gif, (spec) => spec.width > DEGRADED_GIF_WIDTH),
        {
          onNone: () => window,
          onSome: (spec) => {
            dropped[A.length(dropped)] = droppedFrom(
              window,
              "budget-width-reduced",
              `gif width ${spec.width} -> ${DEGRADED_GIF_WIDTH} by ladder step 3`
            );
            return withGif(window, O.some(GifSpec.make({ fps: spec.fps, width: DEGRADED_GIF_WIDTH })));
          },
        }
      )
    );
  }

  // Step 4: GIFs become strips.
  if (overBudget()) {
    current = A.map(current, (window) =>
      O.match(window.gif, {
        onNone: () => window,
        onSome: () => {
          dropped[A.length(dropped)] = droppedFrom(window, "budget-gif-to-strip", "gif dropped by ladder step 4");
          return withGif(window, O.none());
        },
      })
    );
  }

  // Step 5: drop whole windows until the estimate fits.
  let ordered = A.sort(current, byBudgetDropOrder);
  while (estimateTotal(ordered, budget) > budget.maxTotalBytes && A.isReadonlyArrayNonEmpty(ordered)) {
    const head = A.headNonEmpty(ordered);
    dropped[A.length(dropped)] = droppedFrom(head, "budget-dropped", "window dropped by ladder step 5");
    ordered = A.drop(ordered, 1);
  }
  current = A.sort(ordered, byStart);

  return { dropped, estimatedTotalBytes: estimateTotal(current, budget), windows: current };
};

/**
 * Build a complete, budget-fitted {@link ExtractionPlan} from witness events.
 *
 * @example
 * ```ts
 * import { ArtifactBudget, buildExtractionPlan, MarkerEvent } from "@beep/qa-capture"
 *
 * const plan = buildExtractionPlan({
 *   budget: ArtifactBudget.make({}),
 *   events: [MarkerEvent.make({ kind: "marker", label: "scenario:start", seq: 1, tEpochMs: 1753838000000 })]
 * })
 * console.log(plan.windows.length)
 * ```
 *
 * @category planning
 * @since 0.0.0
 */
export const buildExtractionPlan = (options: {
  readonly budget?: ArtifactBudget | undefined;
  readonly events: ReadonlyArray<ActionEvent>;
  readonly rules?: ExtractionRuleSet | undefined;
}): ExtractionPlan => {
  const budget = options.budget ?? ArtifactBudget.make({});
  const rules = options.rules ?? defaultExtractionRules;
  const planned = planWindows(options.events, rules);
  const merged = mergeOverlappingWindows(planned);
  const fitted = applyBudget(merged.windows, budget);
  return ExtractionPlan.make({
    budget,
    dropped: [...merged.dropped, ...fitted.dropped],
    estimatedTotalBytes: fitted.estimatedTotalBytes,
    schemaVersion: "beep.qa.extraction-plan.v1",
    windows: fitted.windows,
  });
};

/**
 * Convert a witness wall-clock timestamp to seconds on the video timeline,
 * clamped to `[0, videoDurationSeconds]`.
 *
 * @example
 * ```ts
 * import { ClockSync, epochToVideoSeconds } from "@beep/qa-capture"
 *
 * const toVideo = epochToVideoSeconds(
 *   ClockSync.make({
 *     confidence: "high",
 *     method: "beacon",
 *     offsetMs: -1753838000000,
 *     residualRmsMs: 5,
 *     slope: 1
 *   }),
 *   10
 * )
 * console.log(toVideo(1753838001500))
 * ```
 *
 * @category planning
 * @since 0.0.0
 */
export const epochToVideoSeconds =
  (clockSync: ClockSync, videoDurationSeconds: number) =>
  (epochMs: number): number =>
    N.round(Math.min(Math.max((clockSync.slope * epochMs + clockSync.offsetMs) / 1000, 0), videoDurationSeconds), 3);

/**
 * Input options for {@link planDriverRequests}.
 *
 * @example
 * ```ts
 * import {
 *   ArtifactBudget,
 *   ClockSync,
 *   ExtractionPlan,
 *   PlanDriverRequestsOptions
 * } from "@beep/qa-capture"
 *
 * const options = PlanDriverRequestsOptions.make({
 *   clipsDir: "/round/clips",
 *   clockSync: ClockSync.make({
 *     confidence: "low",
 *     method: "assumed-start",
 *     offsetMs: -1753838000000,
 *     residualRmsMs: 0,
 *     slope: 1
 *   }),
 *   framesDir: "/round/frames",
 *   plan: ExtractionPlan.make({
 *     budget: ArtifactBudget.make({}),
 *     dropped: [],
 *     estimatedTotalBytes: 0,
 *     schemaVersion: "beep.qa.extraction-plan.v1",
 *     windows: []
 *   }),
 *   sheetsDir: "/round/sheets",
 *   videoDurationSeconds: 12.5,
 *   videoPath: "/round/video/capture.webm"
 * })
 * console.log(options.videoPath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PlanDriverRequestsOptions extends S.Class<PlanDriverRequestsOptions>($I`PlanDriverRequestsOptions`)(
  {
    clipsDir: S.String.pipe(
      $I.annoteKey("PlanDriverRequestsOptions.clipsDir", {
        description: "Directory receiving rendered GIF artifacts.",
      })
    ),
    clockSync: ClockSync.pipe(
      $I.annoteKey("PlanDriverRequestsOptions.clockSync", {
        description: "Clock synchronization mapping event time onto video time.",
      })
    ),
    framesDir: S.String.pipe(
      $I.annoteKey("PlanDriverRequestsOptions.framesDir", {
        description: "Directory receiving extracted strip frames.",
      })
    ),
    plan: ExtractionPlan.pipe(
      $I.annoteKey("PlanDriverRequestsOptions.plan", {
        description: "Budget-fitted extraction plan to materialize.",
      })
    ),
    sheetsDir: S.String.pipe(
      $I.annoteKey("PlanDriverRequestsOptions.sheetsDir", {
        description: "Directory receiving the whole-video contact sheet.",
      })
    ),
    videoDurationSeconds: S.Finite.check(
      S.isGreaterThan(0, {
        identifier: $I`PlanDriverRequestsVideoDurationPositiveCheck`,
        title: "Plan Driver Requests Video Duration Positive",
        description: "Video durations are strictly positive.",
        message: "Expected a positive video duration",
      })
    ).pipe(
      $I.annoteKey("PlanDriverRequestsOptions.videoDurationSeconds", {
        description: "Probed duration of the recorded video in seconds.",
      })
    ),
    videoPath: S.String.pipe(
      $I.annoteKey("PlanDriverRequestsOptions.videoPath", {
        description: "Recorded video path all requests read from.",
      })
    ),
  },
  $I.annote("PlanDriverRequestsOptions", {
    description: "Input options for materializing driver requests from a plan.",
  })
) {}

/**
 * Materialize a fitted plan into `@beep/ffmpeg` driver requests.
 *
 * Emits one frame-strip request per window with frame times, one GIF request
 * per window with a GIF spec (duration clamped to the budget cap and video
 * end), and always exactly one whole-video contact-sheet request. When the
 * clock confidence is `low`, windows are padded by an extra 250 ms on both
 * sides before mapping onto the video timeline.
 *
 * @example
 * ```ts
 * import {
 *   ArtifactBudget,
 *   ClockSync,
 *   ExtractionPlan,
 *   PlanDriverRequestsOptions,
 *   planDriverRequests
 * } from "@beep/qa-capture"
 *
 * const requests = planDriverRequests(
 *   PlanDriverRequestsOptions.make({
 *     clipsDir: "/round/clips",
 *     clockSync: ClockSync.make({
 *       confidence: "low",
 *       method: "assumed-start",
 *       offsetMs: -1753838000000,
 *       residualRmsMs: 0,
 *       slope: 1
 *     }),
 *     framesDir: "/round/frames",
 *     plan: ExtractionPlan.make({
 *       budget: ArtifactBudget.make({}),
 *       dropped: [],
 *       estimatedTotalBytes: 0,
 *       schemaVersion: "beep.qa.extraction-plan.v1",
 *       windows: []
 *     }),
 *     sheetsDir: "/round/sheets",
 *     videoDurationSeconds: 12.5,
 *     videoPath: "/round/video/capture.webm"
 *   })
 * )
 * console.log(requests.length)
 * ```
 *
 * @category planning
 * @since 0.0.0
 */
export const planDriverRequests = (options: PlanDriverRequestsOptions): ReadonlyArray<QaDriverRequest> => {
  const lowConfidencePadMs = options.clockSync.confidence === "low" ? 250 : 0;
  const toVideo = epochToVideoSeconds(options.clockSync, options.videoDurationSeconds);

  const windowRequests = A.flatMap(options.plan.windows, (window, index): ReadonlyArray<QaDriverRequest> => {
    const prefix = `${window.ruleKind}-w${index}`;
    const paddedStart = Math.max(0, window.startEpochMs - lowConfidencePadMs);
    const paddedEnd = window.endEpochMs + lowConfidencePadMs;
    const frameTimes = sortedUnique(
      A.map(A.isReadonlyArrayNonEmpty(window.frameTimesEpochMs) ? window.frameTimesEpochMs : [paddedStart], toVideo)
    );
    const strip = ExtractFramesAtPlanned.make({
      kind: "extract-frames-at",
      request: ExtractFramesAtRequest.make({
        manifestPath: O.some(`${options.framesDir}/${prefix}-manifest.json`),
        outDir: options.framesDir,
        overwrite: true,
        prefix: O.some(prefix),
        timestampsSeconds: frameTimes,
        videoPath: options.videoPath,
      }),
    });
    const gif = O.map(window.gif, (spec) => {
      const startSeconds = toVideo(paddedStart);
      const durationSeconds = N.round(
        Math.max(
          MIN_GIF_SECONDS,
          Math.min(
            (paddedEnd - paddedStart) / 1000,
            options.plan.budget.maxGifSeconds,
            Math.max(MIN_GIF_SECONDS, options.videoDurationSeconds - startSeconds)
          )
        ),
        3
      );
      return RenderGifPlanned.make({
        kind: "render-gif",
        request: RenderGifRequest.make({
          durationSeconds,
          dither: "bayer",
          fps: spec.fps,
          outPath: `${options.clipsDir}/${prefix}.gif`,
          overwrite: true,
          startSeconds,
          videoPath: options.videoPath,
          width: spec.width,
        }),
      });
    });
    return O.match(gif, {
      onNone: (): ReadonlyArray<QaDriverRequest> => [strip],
      onSome: (rendered): ReadonlyArray<QaDriverRequest> => [strip, rendered],
    });
  });

  const sheet = RenderContactSheetPlanned.make({
    kind: "render-contact-sheet",
    request: RenderContactSheetRequest.make({
      outPath: `${options.sheetsDir}/contact-sheet.jpg`,
      overwrite: true,
      videoPath: options.videoPath,
    }),
  });

  return [...windowRequests, sheet];
};
