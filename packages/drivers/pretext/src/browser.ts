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
import { DateTime, Effect, Layer } from "effect";
import * as P from "effect/Predicate";
import {
  PretextMeasurementError,
  PretextMeasurementUnavailableError,
  PretextUnsupportedFontError,
} from "./Pretext.errors.js";
import { EngineProfile, FontMetrics, FontMetricsSnapshotV1 } from "./Pretext.models.js";
import { PretextCapture } from "./PretextCapture.service.js";
import type { PretextMeasurementUnavailableReason } from "./Pretext.errors.js";
import type { PretextCaptureRequest } from "./PretextCapture.service.js";

/**
 * Browser-safe pure surface re-exported for client code, which imports
 * drivers only through this entrypoint.
 *
 * @category interop
 * @since 0.0.0
 */
export * from "./index.js";

const uaIncludesAny = (ua: string, flags: ReadonlyArray<string>): boolean =>
  A.some(flags, (flag) => pipe(ua, Str.includes(flag)));

/**
 * Detect the current runtime's {@link EngineProfile}. Mirrors upstream
 * pretext's unexported `getEngineProfile` (v0.0.8, `src/measurement.ts`):
 * the values are Chromium/Safari/Gecko quirk fences. On a catalog bump of
 * `@chenglou/pretext`, re-verify this mirror against upstream and re-capture
 * the built-in fixture (revisit trigger recorded in the
 * computable-workspace-geometry DECISIONS log).
 *
 * @example
 * ```ts
 * import { detectEngineProfile } from "@beep/pretext/browser"
 *
 * console.log(detectEngineProfile().lineFitEpsilon)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const detectEngineProfile = (): EngineProfile => {
  if (P.isUndefined(globalThis.navigator)) {
    return EngineProfile.make({
      lineFitEpsilon: 0.005,
      carryCJKAfterClosingQuote: false,
      breakKeepAllAfterPunctuation: true,
      preferPrefixWidthsForBreakableRuns: false,
      preferEarlySoftHyphenBreak: false,
    });
  }
  const ua = navigator.userAgent;
  const isSafari =
    navigator.vendor === "Apple Computer, Inc." &&
    pipe(ua, Str.includes("Safari/")) &&
    !uaIncludesAny(ua, ["Chrome/", "Chromium/", "CriOS/", "FxiOS/", "EdgiOS/"]);
  const isChromium = uaIncludesAny(ua, ["Chrome/", "Chromium/", "CriOS/", "Edg/"]);
  return EngineProfile.make({
    lineFitEpsilon: isSafari ? 1 / 64 : 0.005,
    carryCJKAfterClosingQuote: isChromium,
    breakKeepAllAfterPunctuation: !isSafari,
    preferPrefixWidthsForBreakableRuns: isSafari,
    preferEarlySoftHyphenBreak: isSafari,
  });
};

const capabilityProbes: ReadonlyArray<{
  readonly available: () => boolean;
  readonly reason: PretextMeasurementUnavailableReason;
  readonly message: string;
}> = [
  {
    available: () => !P.isUndefined(globalThis.Intl) && P.isFunction(globalThis.Intl.Segmenter),
    reason: "missingIntlSegmenter",
    message: "Font-metrics capture requires Intl.Segmenter.",
  },
  {
    available: () => P.isFunction(globalThis.OffscreenCanvas) || !P.isUndefined(globalThis.document),
    reason: "missingCanvas2d",
    message: "Font-metrics capture requires OffscreenCanvas or a DOM canvas context.",
  },
];

const probeMeasurementCapability: Effect.Effect<void, PretextMeasurementUnavailableError> = Effect.suspend(() =>
  O.match(
    A.findFirst(capabilityProbes, (probe) => !probe.available()),
    {
      onNone: () => Effect.void,
      onSome: (probe) => PretextMeasurementUnavailableError.make({ reason: probe.reason, message: probe.message }),
    }
  )
);

const measureText = (text: string, font: string): Effect.Effect<number, PretextMeasurementError> =>
  Effect.try({
    try: () => measureNaturalWidth(prepareWithSegments(text, font)),
    catch: (cause) =>
      PretextMeasurementError.make({
        operation: "measureText",
        message: P.isError(cause) ? cause.message : "Pretext failed to measure the text.",
      }),
  });

const detectEngineLabel = (): string =>
  P.isUndefined(globalThis.navigator)
    ? "unknown"
    : pipe(
        navigator.userAgent,
        Str.match(/(?:Chrome|Chromium|Firefox|Safari|Edg)\/[\d.]+/),
        O.flatMap(A.head),
        O.getOrElse(() => navigator.userAgent)
      );

const detectPlatformLabel = (): string => (P.isUndefined(globalThis.navigator) ? "unknown" : navigator.platform);

const captureFontMetrics = Effect.fn("Pretext.captureFontMetrics")(function* (request: PretextCaptureRequest) {
  if (pipe(request.font, Str.includes("system-ui"))) {
    return yield* PretextUnsupportedFontError.make({
      font: request.font,
      message: "system-ui cannot be measured accurately (upstream canvas/DOM divergence); use a concrete font family.",
    });
  }
  yield* probeMeasurementCapability;
  const now = yield* DateTime.now;
  // Sequential by design: measurement is synchronous single-canvas work, so
  // concurrency would only add fiber overhead and canvas contention.
  const entries = yield* Effect.forEach(request.words, (word) =>
    Effect.map(measureText(word, request.font), (width) => [word, width] as const)
  );
  const markerWidth = yield* measureText("i", request.font);
  const pairWidth = yield* measureText("i i", request.font);
  return FontMetricsSnapshotV1.make({
    version: 1,
    metrics: FontMetrics.make({
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
    }),
  });
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
