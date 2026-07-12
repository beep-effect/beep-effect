/**
 * Impure capture surface: live font-metrics capture in a browser-grade
 * runtime.
 *
 * Requires `Intl.Segmenter` and a Canvas 2D context (`OffscreenCanvas` or a
 * DOM canvas); absence is a typed failure at capture time, never a crash.
 * The pure contracts re-exported here make this entrypoint self-sufficient
 * for client code, which per driver law imports drivers only through
 * `@beep/pretext/browser`.
 *
 * Snapshots captured here are per-engine values by design — the same text
 * measured under another engine or platform yields different widths. Never
 * treat a snapshot as cross-machine deterministic.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, pipe, R, Str } from "@beep/utils";
import { measureNaturalWidth, prepareWithSegments } from "@chenglou/pretext";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import {
  PretextMeasurementError,
  PretextMeasurementUnavailableError,
  PretextUnsupportedFontError,
} from "./Pretext.errors.js";
import { PretextCapture } from "./PretextCapture.service.js";
import type { EngineProfile, FontMetricsSnapshotV1 } from "./Pretext.models.js";
import type { PretextCaptureRequest } from "./PretextCapture.service.js";

/**
 * Browser-safe pure surface re-exported for client code, which imports
 * drivers only through this entrypoint.
 *
 * @since 0.0.0
 * @category re-exports
 */
export * from "./index.js";

// Mirrors upstream pretext's engine detection (v0.0.8, dist/measurement.js
// getEngineProfile), which the upstream exports map does not expose. The
// values are Chromium/Safari/Gecko quirk fences; keep in lockstep with the
// pinned catalog version.
const detectEngineProfile = (): EngineProfile => {
  if (typeof navigator === "undefined") {
    return {
      lineFitEpsilon: 0.005,
      carryCJKAfterClosingQuote: false,
      breakKeepAllAfterPunctuation: true,
      preferPrefixWidthsForBreakableRuns: false,
      preferEarlySoftHyphenBreak: false,
    };
  }
  const ua = navigator.userAgent;
  const isSafari =
    navigator.vendor === "Apple Computer, Inc." &&
    pipe(ua, Str.includes("Safari/")) &&
    !pipe(ua, Str.includes("Chrome/")) &&
    !pipe(ua, Str.includes("Chromium/")) &&
    !pipe(ua, Str.includes("CriOS/")) &&
    !pipe(ua, Str.includes("FxiOS/")) &&
    !pipe(ua, Str.includes("EdgiOS/"));
  const isChromium =
    pipe(ua, Str.includes("Chrome/")) ||
    pipe(ua, Str.includes("Chromium/")) ||
    pipe(ua, Str.includes("CriOS/")) ||
    pipe(ua, Str.includes("Edg/"));
  return {
    lineFitEpsilon: isSafari ? 1 / 64 : 0.005,
    carryCJKAfterClosingQuote: isChromium,
    breakKeepAllAfterPunctuation: !isSafari,
    preferPrefixWidthsForBreakableRuns: isSafari,
    preferEarlySoftHyphenBreak: isSafari,
  };
};

const hasIntlSegmenter = (): boolean => typeof Intl !== "undefined" && typeof Intl.Segmenter === "function";

const hasCanvas2d = (): boolean => typeof OffscreenCanvas === "function" || typeof document !== "undefined";

const probeMeasurementCapability: Effect.Effect<void, PretextMeasurementUnavailableError> = Effect.suspend(() => {
  if (!hasIntlSegmenter()) {
    return Effect.fail(
      PretextMeasurementUnavailableError.make({
        reason: "missingIntlSegmenter",
        message: "Font-metrics capture requires Intl.Segmenter.",
      })
    );
  }
  if (!hasCanvas2d()) {
    return Effect.fail(
      PretextMeasurementUnavailableError.make({
        reason: "missingCanvas2d",
        message: "Font-metrics capture requires OffscreenCanvas or a DOM canvas context.",
      })
    );
  }
  return Effect.void;
});

const measureText = (text: string, font: string): Effect.Effect<number, PretextMeasurementError> =>
  Effect.try({
    try: () => measureNaturalWidth(prepareWithSegments(text, font)),
    catch: (cause) =>
      PretextMeasurementError.make({
        operation: "measureText",
        message: cause instanceof Error ? cause.message : "Pretext failed to measure the text.",
      }),
  });

const detectEngineLabel = (): string =>
  typeof navigator === "undefined"
    ? "unknown"
    : pipe(
        navigator.userAgent,
        Str.match(/(?:Chrome|Chromium|Firefox|Safari|Edg)\/[\d.]+/),
        O.flatMap(A.head),
        O.getOrElse(() => navigator.userAgent)
      );

const detectPlatformLabel = (): string => (typeof navigator === "undefined" ? "unknown" : navigator.platform);

const captureFontMetrics = Effect.fn("Pretext.captureFontMetrics")(function* (request: PretextCaptureRequest) {
  if (pipe(request.font, Str.includes("system-ui"))) {
    return yield* PretextUnsupportedFontError.make({
      font: request.font,
      message: "system-ui cannot be measured accurately (upstream canvas/DOM divergence); use a concrete font family.",
    });
  }
  yield* probeMeasurementCapability;
  const now = yield* DateTime.now;
  const entries = yield* Effect.forEach(request.words, (word) =>
    Effect.map(measureText(word, request.font), (width) => [word, width] as const)
  );
  const markerWidth = yield* measureText("i", request.font);
  const pairWidth = yield* measureText("i i", request.font);
  const snapshot: FontMetricsSnapshotV1 = {
    version: 1,
    metrics: {
      capturedAt: DateTime.formatIso(now),
      engine: detectEngineLabel(),
      platform: detectPlatformLabel(),
      font: request.font,
      lineHeight: request.lineHeight,
      spaceWidth: pairWidth - markerWidth * 2,
      words: R.fromEntries(entries),
      engineProfile: detectEngineProfile(),
      sentence: request.sentence,
      oracle: O.none(),
      domLineCounts: O.none(),
    },
  };
  return snapshot;
});

/**
 * Live {@link PretextCapture} layer: measures through `@chenglou/pretext`
 * in the current runtime. Capability gaps and rejected fonts surface as
 * typed failures on each capture call.
 *
 * @example
 * ```ts
 * import { PretextCaptureLive } from "@beep/pretext/browser"
 *
 * console.log(String(PretextCaptureLive))
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export const PretextCaptureLive: Layer.Layer<PretextCapture> = Layer.succeed(
  PretextCapture,
  PretextCapture.of({ captureFontMetrics })
);
