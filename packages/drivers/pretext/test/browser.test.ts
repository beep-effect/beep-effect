import { PretextCapture, PretextCaptureLive, PretextCaptureRequest } from "@beep/pretext/browser";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

const runtimeHasCanvas2d = typeof OffscreenCanvas === "function" || typeof document !== "undefined";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

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

      expect(error._tag).toBe("PretextMeasurementUnavailableError");
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
