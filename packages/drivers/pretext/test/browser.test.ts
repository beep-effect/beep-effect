import { detectEngineProfile, PretextCapture, PretextCaptureLive, PretextCaptureRequest } from "@beep/pretext/browser";
import { provideScopedLayer } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as P from "effect/Predicate";

const runtimeHasCanvas2d = P.isFunction(globalThis.OffscreenCanvas) || !P.isUndefined(globalThis.document);

describe("detectEngineProfile", () => {
  it.effect(
    "pins the non-browser fence values mirrored from upstream v0.0.8",
    Effect.fnUntraced(function* () {
      const profile = detectEngineProfile();

      expect(profile.lineFitEpsilon).toBe(0.005);
      expect(profile.carryCJKAfterClosingQuote).toBe(false);
      expect(profile.breakKeepAllAfterPunctuation).toBe(true);
      expect(profile.preferPrefixWidthsForBreakableRuns).toBe(false);
      expect(profile.preferEarlySoftHyphenBreak).toBe(false);
    })
  );
});

describe("PretextCaptureLive", () => {
  it.effect(
    "rejects system-ui with a typed error in any runtime",
    Effect.fnUntraced(function* () {
      const capture = yield* PretextCapture;
      const error = yield* Effect.flip(
        capture.captureFontMetrics(
          PretextCaptureRequest.make({
            font: "16px system-ui",
            lineHeight: 20,
            words: ["the"],
          })
        )
      );

      expect(error._tag).toBe("PretextUnsupportedFontError");
    }, provideScopedLayer(PretextCaptureLive))
  );

  it.effect.skipIf(runtimeHasCanvas2d)(
    "fails typed, not thrown, when the runtime cannot measure",
    Effect.fnUntraced(function* () {
      const capture = yield* PretextCapture;
      const error = yield* Effect.flip(
        capture.captureFontMetrics(
          PretextCaptureRequest.make({
            font: "16px Arial",
            lineHeight: 20,
            words: ["the"],
          })
        )
      );

      expect(error).toMatchObject({ _tag: "PretextMeasurementUnavailableError", reason: "missingCanvas2d" });
    }, provideScopedLayer(PretextCaptureLive))
  );

  it.effect.skipIf(!runtimeHasCanvas2d)(
    "captures a live snapshot when the runtime can measure",
    Effect.fnUntraced(function* () {
      const capture = yield* PretextCapture;
      const snapshot = yield* capture.captureFontMetrics(
        PretextCaptureRequest.make({
          font: "16px Arial",
          lineHeight: 20,
          words: ["the", "dragon"],
        })
      );

      expect(snapshot.version).toBe(1);
      expect(snapshot.metrics.lineHeight).toBe(20);
    }, provideScopedLayer(PretextCaptureLive))
  );
});
