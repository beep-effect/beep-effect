import {
  ArtifactBudget,
  applyBudget,
  BuildExtractionPlanOptions,
  buildExtractionPlan,
  ClockSync,
  CssTransitionEvent,
  defaultExtractionRules,
  END_SEEK_GUARD_SECONDS,
  FRAME_MAX_WIDTH,
  MarkerEvent,
  mergeOverlappingWindows,
  OVERLAP_MERGE_GAP_MS,
  PlanDriverRequestsOptions,
  PointerDownEvent,
  PointerEnterEvent,
  PointerLeaveEvent,
  PointerMoveEvent,
  PointerUpEvent,
  planDriverRequests,
  planWindows,
  videoSecondsToEpochMs,
} from "@beep/qa-capture";
import { fcRuns } from "@beep/test-utils";
import { A, O } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { FastCheck as fc } from "effect/testing";
import type { ActionEvent, ExtractionPlan } from "@beep/qa-capture";

const T0 = 1753838000000;

type GestureSpec = {
  readonly distancePx: number;
  readonly durationMs: number;
  readonly kind: "click" | "drag" | "hover" | "marker" | "transition";
  readonly startOffsetMs: number;
};

const gestureArbitrary = fc.record({
  distancePx: fc.integer({ min: 0, max: 200 }),
  durationMs: fc.integer({ min: 10, max: 4000 }),
  kind: fc.constantFrom("click", "drag", "hover", "marker", "transition"),
  startOffsetMs: fc.integer({ min: 0, max: 120000 }),
});

const eventsForGesture = (gesture: GestureSpec, index: number): ReadonlyArray<ActionEvent> => {
  const base = index * 100;
  const t0 = T0 + gesture.startOffsetMs;
  const t1 = t0 + gesture.durationMs;
  const selectorPath = `[data-qa="target-${index}"]`;
  if (gesture.kind === "marker") {
    return [MarkerEvent.make({ kind: "marker", label: `marker-${index}`, seq: base + 1, tEpochMs: t0 })];
  }
  if (gesture.kind === "transition") {
    return [
      CssTransitionEvent.make({
        durationMs: gesture.durationMs,
        kind: "transition",
        phase: "start",
        property: "transform",
        selectorPath,
        seq: base + 1,
        tEpochMs: t0,
      }),
      CssTransitionEvent.make({
        durationMs: gesture.durationMs,
        kind: "transition",
        phase: "end",
        property: "transform",
        selectorPath,
        seq: base + 2,
        tEpochMs: t1,
      }),
    ];
  }
  if (gesture.kind === "hover") {
    return [
      PointerEnterEvent.make({ kind: "pointer-enter", selectorPath, seq: base + 1, tEpochMs: t0 }),
      PointerLeaveEvent.make({ kind: "pointer-leave", selectorPath, seq: base + 2, tEpochMs: t1 }),
    ];
  }
  const travel = gesture.kind === "drag" ? Math.max(gesture.distancePx, 8) : 0;
  return [
    PointerDownEvent.make({
      button: 0,
      kind: "pointer-down",
      pointerId: index,
      selectorPath,
      seq: base + 1,
      tEpochMs: t0,
      x: 100,
      y: 100,
    }),
    PointerMoveEvent.make({
      kind: "pointer-move",
      pointerId: index,
      seq: base + 2,
      tEpochMs: t0 + gesture.durationMs / 2,
      x: 100 + travel,
      y: 100,
    }),
    PointerUpEvent.make({
      button: 0,
      kind: "pointer-up",
      pointerId: index,
      selectorPath,
      seq: base + 3,
      tEpochMs: t1,
      x: 100 + travel,
      y: 100,
    }),
  ];
};

const eventsArbitrary = fc
  .array(gestureArbitrary, { minLength: 0, maxLength: 24 })
  .map((gestures) => A.flatMap(gestures, eventsForGesture));

const budgetArbitrary = fc
  .integer({ min: 250000, max: 30000000 })
  .map((maxTotalBytes) => ArtifactBudget.make({ maxGifSeconds: 6, maxTotalBytes }));

describe("@beep/qa-capture extraction planner", () => {
  it("derives the documented windows from a drag gesture", () => {
    const events = eventsForGesture({ distancePx: 40, durationMs: 1000, kind: "drag", startOffsetMs: 0 }, 0);
    const windows = planWindows(events, defaultExtractionRules);
    expect(A.length(windows)).toBe(1);
    const window = windows[0];
    expect(window?.ruleKind).toBe("drag");
    expect(window?.priority).toBe("P1");
    expect(window?.startEpochMs).toBe(T0 - 100);
    expect(window?.endEpochMs).toBe(T0 + 1000 + 300);
    expect(O.isSome(window?.gif ?? O.none())).toBe(true);
    expect(A.length(window?.frameTimesEpochMs ?? [])).toBe(3);
  });

  it("classifies sub-threshold pointer travel as a click strip", () => {
    const events = eventsForGesture({ distancePx: 0, durationMs: 200, kind: "click", startOffsetMs: 0 }, 0);
    const windows = planWindows(events, defaultExtractionRules);
    expect(A.length(windows)).toBe(1);
    expect(windows[0]?.ruleKind).toBe("click");
    expect(windows[0]?.priority).toBe("P2");
    expect(O.isNone(windows[0]?.gif ?? O.none())).toBe(true);
  });

  it("ignores hovers dwelling under the rule threshold", () => {
    const events = eventsForGesture({ distancePx: 0, durationMs: 60, kind: "hover", startOffsetMs: 0 }, 0);
    expect(A.length(planWindows(events, defaultExtractionRules))).toBe(0);
  });

  it("anchors hover strips at enter-50/enter+150/leave+50", () => {
    const events = eventsForGesture({ distancePx: 0, durationMs: 400, kind: "hover", startOffsetMs: 0 }, 0);
    const windows = planWindows(events, defaultExtractionRules);
    expect(windows[0]?.frameTimesEpochMs).toEqual([T0 - 50, T0 + 150, T0 + 400 + 50]);
  });

  it("merge law: no two same-kind windows closer than the merge gap survive", () => {
    const kinds = ["animation", "click", "drag", "hover", "marker", "transition"] as const;
    fc.assert(
      fc.property(eventsArbitrary, (events) => {
        const merged = mergeOverlappingWindows(planWindows(events, defaultExtractionRules));
        A.forEach(kinds, (kind) => {
          const windows = A.filter(merged.windows, (window) => window.ruleKind === kind);
          A.forEach(A.zip(windows, A.drop(windows, 1)), ([previous, next]) => {
            expect(next.startEpochMs - previous.endEpochMs).toBeGreaterThanOrEqual(OVERLAP_MERGE_GAP_MS);
          });
        });
      }),
      fcRuns(50)
    );
  });

  it("merge law: every absorbed window is recorded in dropped", () => {
    fc.assert(
      fc.property(eventsArbitrary, (events) => {
        const planned = planWindows(events, defaultExtractionRules);
        const merged = mergeOverlappingWindows(planned);
        expect(A.length(planned)).toBe(A.length(merged.windows) + A.length(merged.dropped));
        A.forEach(merged.dropped, (dropped) => {
          expect(dropped.reason).toBe("overlap-merged");
        });
      }),
      fcRuns(50)
    );
  });

  it("budget law: the fitted estimate never exceeds the budget", () => {
    fc.assert(
      fc.property(eventsArbitrary, budgetArbitrary, (events, budget) => {
        const plan = buildExtractionPlan(BuildExtractionPlanOptions.make({ budget, events }));
        expect(plan.estimatedTotalBytes).toBeLessThanOrEqual(budget.maxTotalBytes);
      }),
      fcRuns(50)
    );
  });

  it("budget law: dropped windows are always recorded", () => {
    fc.assert(
      fc.property(eventsArbitrary, budgetArbitrary, (events, budget) => {
        const merged = mergeOverlappingWindows(planWindows(events, defaultExtractionRules));
        const fitted = applyBudget(merged.windows, budget);
        const droppedWindows = A.filter(
          fitted.dropped,
          (dropped) => dropped.reason === "budget-priority-dropped" || dropped.reason === "budget-dropped"
        );
        expect(A.length(merged.windows)).toBe(A.length(fitted.windows) + A.length(droppedWindows));
      }),
      fcRuns(50)
    );
  });

  it("materializes driver requests with clamped video timestamps plus one contact sheet", () => {
    const events = [
      ...eventsForGesture({ distancePx: 40, durationMs: 1000, kind: "drag", startOffsetMs: 500 }, 0),
      ...eventsForGesture({ distancePx: 0, durationMs: 0, kind: "marker", startOffsetMs: 5000 }, 1),
    ];
    const plan: ExtractionPlan = buildExtractionPlan(BuildExtractionPlanOptions.make({ events }));
    const requests = planDriverRequests(
      PlanDriverRequestsOptions.make({
        clipsDir: "/round/clips",
        clockSync: ClockSync.make({
          confidence: "high",
          method: "beacon",
          offsetMs: -T0,
          residualRmsMs: 5,
          slope: 1,
        }),
        framesDir: "/round/frames",
        plan,
        sheetsDir: "/round/sheets",
        videoDurationSeconds: 10,
        videoPath: "/round/video/capture.webm",
      })
    );

    const sheets = A.filter(requests, (request) => request.kind === "render-contact-sheet");
    expect(A.length(sheets)).toBe(1);

    const strips = A.filter(requests, (request) => request.kind === "extract-frames-at");
    expect(A.length(strips)).toBe(A.length(plan.windows));
    A.forEach(strips, (strip) => {
      if (strip.kind === "extract-frames-at") {
        expect(strip.request.maxWidth).toEqual(O.some(FRAME_MAX_WIDTH));
        A.forEach(strip.request.timestampsSeconds, (timestamp) => {
          expect(timestamp).toBeGreaterThanOrEqual(0);
          expect(timestamp).toBeLessThanOrEqual(10 - END_SEEK_GUARD_SECONDS);
        });
      }
    });

    const gifs = A.filter(requests, (request) => request.kind === "render-gif");
    A.forEach(gifs, (gif) => {
      if (gif.kind === "render-gif") {
        expect(gif.request.durationSeconds).toBeGreaterThan(0);
        expect(gif.request.durationSeconds).toBeLessThanOrEqual(6);
        expect(gif.request.startSeconds + gif.request.durationSeconds).toBeLessThanOrEqual(10 + 6);
      }
    });
  });

  // A seek at exactly the container duration decodes no frame and one failed
  // endpoint seek discards the whole staged strip, so windows extending past
  // the recording must clamp short of the endpoint.
  it("keeps frame seeks and gif starts away from the exact video endpoint", () => {
    const events = eventsForGesture({ distancePx: 40, durationMs: 1000, kind: "drag", startOffsetMs: 5000 }, 0);
    const plan = buildExtractionPlan(BuildExtractionPlanOptions.make({ events }));
    const clockSync = ClockSync.make({
      confidence: "high",
      method: "beacon",
      offsetMs: -T0,
      residualRmsMs: 5,
      slope: 1,
    });
    const videoDurationSeconds = 2;
    const requests = planDriverRequests(
      PlanDriverRequestsOptions.make({
        clipsDir: "/round/clips",
        clockSync,
        framesDir: "/round/frames",
        plan,
        sheetsDir: "/round/sheets",
        videoDurationSeconds,
        videoPath: "/round/video/capture.webm",
      })
    );

    const guarded = videoDurationSeconds - END_SEEK_GUARD_SECONDS;
    const strips = A.filter(requests, (request) => request.kind === "extract-frames-at");
    expect(A.length(strips)).toBeGreaterThan(0);
    A.forEach(strips, (strip) => {
      if (strip.kind === "extract-frames-at") {
        // Every seek of this fully-past-the-end window lands on the guarded
        // bound — never on the undecodable container endpoint itself.
        expect(strip.request.timestampsSeconds).toEqual([guarded]);
      }
    });
    A.forEach(requests, (request) => {
      if (request.kind === "render-gif") {
        expect(request.request.startSeconds).toBeLessThanOrEqual(guarded);
      }
    });
  });

  it("inverts the epoch-to-video mapping exactly for per-frame stamping", () => {
    const clockSync = ClockSync.make({
      confidence: "high",
      method: "beacon",
      offsetMs: -T0,
      residualRmsMs: 5,
      slope: 1,
    });
    expect(videoSecondsToEpochMs(clockSync)(1.5)).toBe(T0 + 1500);
    expect(videoSecondsToEpochMs(clockSync)(0)).toBe(T0);
  });
});
