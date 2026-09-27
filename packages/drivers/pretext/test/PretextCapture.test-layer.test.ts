import { chromeLinuxArial16, PretextCapture, PretextCaptureFixture, PretextCaptureRequest } from "@beep/pretext";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Struct from "effect/Struct";

describe("PretextCaptureFixture", () => {
  it.layer(PretextCaptureFixture, { timeout: "10 seconds" })((it) => {
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
        {
          const actualOption = R.get(snapshot.metrics.words, "dragon");
          O.match(R.get(fixture.metrics.words, "dragon"), {
            onNone: () => assertNone(actualOption),
            onSome: (expectedValue) => assertSome(actualOption, expectedValue),
          });
        }
      })
    );
  });

  it.layer(PretextCaptureFixture, { timeout: "10 seconds" })((it) => {
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
      })
    );
  });

  it.layer(PretextCaptureFixture, { timeout: "10 seconds" })((it) => {
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
      })
    );
  });

  it.layer(PretextCaptureFixture, { timeout: "10 seconds" })((it) => {
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

        snapshot.metrics.sentence.pipe(O.isSome, assertTrue);
        const fixture = yield* chromeLinuxArial16;
        assertSome(snapshot.metrics.sentence, O.getOrThrow(fixture.metrics.sentence));
        expect(snapshot.metrics.capturedAt).toBe(fixture.metrics.capturedAt);
        expect(snapshot.metrics.engine).toBe(fixture.metrics.engine);
        expect(snapshot.metrics.platform).toBe(fixture.metrics.platform);
        expect(snapshot.metrics.engineProfile).toEqual(fixture.metrics.engineProfile);
        assertSome(snapshot.metrics.oracle, O.getOrThrow(fixture.metrics.oracle));
        assertSome(snapshot.metrics.domLineCounts, O.getOrThrow(fixture.metrics.domLineCounts));
      })
    );
  });
});
