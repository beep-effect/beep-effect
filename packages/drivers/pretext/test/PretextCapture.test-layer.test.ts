import { chromeLinuxArial16, PretextCapture, PretextCaptureFixture, PretextCaptureRequest } from "@beep/pretext";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Struct from "effect/Struct";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

describe("PretextCaptureFixture", () => {
  it.effect(
    "captures a snapshot DOM-free from the canned fixture",
    Effect.fnUntraced(function* () {
      const capture = yield* PretextCapture;
      const fixture = yield* chromeLinuxArial16;
      const snapshot = yield* capture.captureFontMetrics(
        PretextCaptureRequest.make({
          font: "16px Arial",
          lineHeight: 20,
          words: ["the", "dragon"],
        })
      );

      expect(snapshot.version).toBe(1);
      expect(Struct.keys(snapshot.metrics.words)).toEqual(["the", "dragon"]);
      expect(snapshot.metrics.spaceWidth).toBe(fixture.metrics.spaceWidth);
      expect(R.get(snapshot.metrics.words, "dragon")).toEqual(R.get(fixture.metrics.words, "dragon"));
    }, provideScopedLayer(PretextCaptureFixture))
  );

  it.effect(
    "fails typed when the requested font is not the fixture font",
    Effect.fnUntraced(function* () {
      const capture = yield* PretextCapture;
      const error = yield* Effect.flip(
        capture.captureFontMetrics(
          PretextCaptureRequest.make({
            font: "16px Georgia",
            lineHeight: 20,
            words: ["the"],
          })
        )
      );

      expect(error._tag).toBe("PretextMeasurementError");
      expect(error.message).toContain("16px Georgia");
    }, provideScopedLayer(PretextCaptureFixture))
  );

  it.effect(
    "fails typed when a requested word was never measured",
    Effect.fnUntraced(function* () {
      const capture = yield* PretextCapture;
      const error = yield* Effect.flip(
        capture.captureFontMetrics(
          PretextCaptureRequest.make({
            font: "16px Arial",
            lineHeight: 20,
            words: ["the", "wyvern"],
          })
        )
      );

      expect(error._tag).toBe("PretextMeasurementError");
      expect(error.message).toContain("wyvern");
    }, provideScopedLayer(PretextCaptureFixture))
  );

  it.effect(
    "answers with the fixture's own capture provenance",
    Effect.fnUntraced(function* () {
      const capture = yield* PretextCapture;
      const snapshot = yield* capture.captureFontMetrics(
        PretextCaptureRequest.make({
          font: "16px Arial",
          lineHeight: 20,
          words: ["the"],
        })
      );

      expect(O.isSome(snapshot.metrics.sentence)).toBe(true);
    }, provideScopedLayer(PretextCaptureFixture))
  );
});
