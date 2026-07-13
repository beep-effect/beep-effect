import {
  chromeLinuxArial16,
  chromeLinuxArial16Encoded,
  FontMetricsSnapshotV1,
  lineCount,
  naturalWidth,
  TextLayoutInput,
  textHeight,
} from "@beep/pretext";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as R from "effect/Record";

describe("FontMetricsSnapshotV1", () => {
  it.effect(
    "decodes the built-in fixture",
    Effect.fnUntraced(function* () {
      const snapshot = yield* chromeLinuxArial16;

      expect(snapshot.version).toBe(1);
      expect(snapshot.metrics.font).toBe("16px Arial");
      expect(snapshot.metrics.engineProfile.preferEarlySoftHyphenBreak).toBe(false);
      expect(O.isSome(snapshot.metrics.domLineCounts)).toBe(true);
    })
  );

  it.effect(
    "round-trips encode after decode as identity",
    Effect.fnUntraced(function* () {
      const snapshot = yield* chromeLinuxArial16;
      const encoded = yield* FontMetricsSnapshotV1.encode(snapshot);

      expect(encoded).toEqual(chromeLinuxArial16Encoded);
    })
  );

  it.effect(
    "fails typed on unversioned input",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.flip(FontMetricsSnapshotV1.decode(chromeLinuxArial16Encoded.metrics));

      expect(error._tag).toBe("PretextSnapshotCodecError");
      expect(error.operation).toBe("decode");
    })
  );

  it.effect(
    "fails typed on a future version tag",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.flip(
        FontMetricsSnapshotV1.decode({ version: 2, metrics: chromeLinuxArial16Encoded.metrics })
      );

      expect(error._tag).toBe("PretextSnapshotCodecError");
    })
  );
});

describe("pure layout helpers", () => {
  it.effect(
    "reproduces the DOM oracle line counts at every fixture width",
    Effect.fnUntraced(function* () {
      const snapshot = yield* chromeLinuxArial16;
      const metrics = snapshot.metrics;
      const sentence = O.getOrThrow(metrics.sentence);
      const domLineCounts = O.getOrThrow(metrics.domLineCounts);

      expect(lineCount(metrics, TextLayoutInput.make({ maxWidth: 200, text: sentence }))).toEqual(
        R.get(domLineCounts, "200")
      );
      expect(lineCount(metrics, TextLayoutInput.make({ maxWidth: 320, text: sentence }))).toEqual(
        R.get(domLineCounts, "320")
      );
      expect(lineCount(metrics, TextLayoutInput.make({ maxWidth: 480, text: sentence }))).toEqual(
        R.get(domLineCounts, "480")
      );
    })
  );

  it.effect(
    "naturalWidth is the tightest one-line width",
    Effect.fnUntraced(function* () {
      const snapshot = yield* chromeLinuxArial16;
      const metrics = snapshot.metrics;
      const sentence = O.getOrThrow(metrics.sentence);
      const width = O.getOrThrow(naturalWidth(metrics, sentence));

      expect(lineCount(metrics, TextLayoutInput.make({ maxWidth: width, text: sentence }))).toEqual(O.some(1));
      expect(
        O.getOrThrow(lineCount(metrics, TextLayoutInput.make({ maxWidth: width - 1, text: sentence })))
      ).toBeGreaterThan(1);
    })
  );

  it.effect(
    "textHeight multiplies line count by the snapshot line height",
    Effect.fnUntraced(function* () {
      const snapshot = yield* chromeLinuxArial16;
      const metrics = snapshot.metrics;
      const sentence = O.getOrThrow(metrics.sentence);

      expect(textHeight(metrics, TextLayoutInput.make({ maxWidth: 320, text: sentence }))).toEqual(
        O.some(2 * metrics.lineHeight)
      );
    })
  );

  it.effect(
    "returns None for words the snapshot never measured",
    Effect.fnUntraced(function* () {
      const snapshot = yield* chromeLinuxArial16;

      expect(naturalWidth(snapshot.metrics, "unmeasured words entirely")).toEqual(O.none());
      expect(
        lineCount(snapshot.metrics, TextLayoutInput.make({ maxWidth: 320, text: "unmeasured words entirely" }))
      ).toEqual(O.none());
    })
  );
});
