/**
 * Fixture-backed capture layers: the DOM-free test story.
 *
 * A fixture layer serves {@link PretextCapture} from a canned, oracle-
 * validated snapshot, so every consumer of the capture capability tests
 * without a DOM or canvas. The built-in fixture is the Chrome/150 · Linux ·
 * 16px Arial capture (OffscreenCanvas measureText + hidden-div
 * getBoundingClientRect oracle, captured live).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, R } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { PretextMeasurementError } from "./Pretext.errors.js";
import { decodeFontMetricsSnapshot } from "./Pretext.models.js";
import { PretextCapture } from "./PretextCapture.service.js";
import type { FontMetricsSnapshotV1, FontMetricsSnapshotV1Encoded } from "./Pretext.models.js";
import type { PretextCaptureRequest } from "./PretextCapture.service.js";

/**
 * The built-in fixture in wire form: Chrome/150 on Linux, 16px Arial,
 * captured 2026-07-12 against a live DOM oracle. Engine profile mirrors
 * upstream pretext v0.0.8's Chromium fences.
 *
 * @example
 * ```ts
 * import { chromeLinuxArial16Encoded } from "@beep/pretext"
 *
 * console.log(chromeLinuxArial16Encoded.metrics.font)
 * ```
 *
 * @since 0.0.0
 * @category fixtures
 */
export const chromeLinuxArial16Encoded: FontMetricsSnapshotV1Encoded = {
  version: 1,
  metrics: {
    capturedAt: "2026-07-12",
    oracle:
      "Chrome/150.0.0.0 on Linux x86_64, OffscreenCanvas measureText + hidden-div getBoundingClientRect, captured live via Claude-in-Chrome",
    engine: "Chrome/150.0.0.0",
    platform: "Linux x86_64",
    font: "16px Arial",
    lineHeight: 20,
    sentence: "The dragon slithers across the page and text flows around its body in real time.",
    spaceWidth: 4.4453125,
    words: {
      The: 27.5703125,
      dragon: 49.8203125,
      slithers: 50.6796875,
      across: 47.125,
      the: 22.2421875,
      page: 35.59375,
      and: 26.6953125,
      text: 25.7890625,
      flows: 36.453125,
      around: 49.8203125,
      its: 16,
      body: 34.6953125,
      in: 12.453125,
      real: 26.6796875,
      "time.": 34.671875,
    },
    domLineCounts: { "200": 3, "320": 2, "480": 2 },
    engineProfile: {
      lineFitEpsilon: 0.005,
      carryCJKAfterClosingQuote: true,
      breakKeepAllAfterPunctuation: true,
      preferPrefixWidthsForBreakableRuns: false,
      preferEarlySoftHyphenBreak: false,
    },
  },
};

/**
 * The built-in fixture decoded against the v1 contract.
 *
 * @example
 * ```ts
 * import { chromeLinuxArial16 } from "@beep/pretext"
 * import * as Effect from "effect/Effect"
 *
 * const snapshot = Effect.runSync(chromeLinuxArial16)
 *
 * console.log(snapshot.metrics.font)
 * ```
 *
 * @since 0.0.0
 * @category fixtures
 */
export const chromeLinuxArial16 = decodeFontMetricsSnapshot(chromeLinuxArial16Encoded);

const fixtureCaptureFontMetrics = (snapshot: FontMetricsSnapshotV1) =>
  Effect.fn("Pretext.fixtureCaptureFontMetrics")(function* (request: PretextCaptureRequest) {
    if (request.font !== snapshot.metrics.font) {
      return yield* PretextMeasurementError.make({
        operation: "fixtureCapture",
        message: `Fixture carries "${snapshot.metrics.font}"; requested "${request.font}".`,
      });
    }
    const missing = A.filter(request.words, (word) => O.isNone(R.get(snapshot.metrics.words, word)));
    if (A.length(missing) > 0) {
      return yield* PretextMeasurementError.make({
        operation: "fixtureCapture",
        message: `Fixture does not carry widths for: ${A.join(missing, ", ")}.`,
      });
    }
    const words = R.fromEntries(
      A.getSomes(
        A.map(request.words, (word) => O.map(R.get(snapshot.metrics.words, word), (width) => [word, width] as const))
      )
    );
    return { version: snapshot.version, metrics: { ...snapshot.metrics, words } };
  });

/**
 * Build a {@link PretextCapture} layer that answers from a canned snapshot.
 * The layer validates font identity and word coverage — an unmeasured word
 * is a typed {@link PretextMeasurementError}, exactly as fidelity demands —
 * and returns the fixture's own captured values.
 *
 * @example
 * ```ts
 * import { chromeLinuxArial16, makePretextCaptureFixture } from "@beep/pretext"
 * import * as Effect from "effect/Effect"
 *
 * const layer = makePretextCaptureFixture(Effect.runSync(chromeLinuxArial16))
 *
 * console.log(String(layer))
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export const makePretextCaptureFixture = (snapshot: FontMetricsSnapshotV1): Layer.Layer<PretextCapture> =>
  Layer.succeed(
    PretextCapture,
    PretextCapture.of({
      captureFontMetrics: fixtureCaptureFontMetrics(snapshot),
    })
  );

/**
 * {@link PretextCapture} served from the built-in Chrome/150 · Linux ·
 * 16px Arial fixture — the default DOM-free test layer.
 *
 * @example
 * ```ts
 * import { PretextCaptureFixture } from "@beep/pretext"
 *
 * console.log(String(PretextCaptureFixture))
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export const PretextCaptureFixture = Layer.effect(
  PretextCapture,
  Effect.map(chromeLinuxArial16, (snapshot) =>
    PretextCapture.of({ captureFontMetrics: fixtureCaptureFontMetrics(snapshot) })
  )
);
