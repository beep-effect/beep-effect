import { detectEngineProfile, PretextCapture, PretextCaptureLive, PretextCaptureRequest } from "@beep/pretext/browser";
import { it } from "@beep/test-runner";
import { describe, expect, vi } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";

const runtimeHasCanvas2d = P.isFunction(globalThis.OffscreenCanvas) || !P.isUndefined(globalThis.document);

// Swap `navigator` and restore it inside one synchronous step, so concurrent tests never observe it.
const profileWithNavigator = (navigatorValue: unknown) =>
  Effect.sync(() => {
    const original = O.fromNullishOr(Object.getOwnPropertyDescriptor(globalThis, "navigator"));
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: navigatorValue });
    try {
      return detectEngineProfile();
    } finally {
      O.match(original, {
        onNone: () => {
          Reflect.deleteProperty(globalThis, "navigator");
        },
        onSome: (descriptor) => {
          Object.defineProperty(globalThis, "navigator", descriptor);
        },
      });
    }
  });

describe("detectEngineProfile", () => {
  it.effect(
    "distinguishes Safari, Chromium and Firefox independently of the host",
    Effect.fnUntraced(function* () {
      yield* Effect.acquireUseRelease(
        Effect.sync(() =>
          vi.stubGlobal("navigator", {
            vendor: "Apple Computer, Inc.",
            userAgent: "Version/18.0 Safari/605.1.15",
          })
        ),
        () =>
          Effect.sync(() => {
            expect(detectEngineProfile()).toMatchObject({
              lineFitEpsilon: 1 / 64,
              carryCJKAfterClosingQuote: false,
              breakKeepAllAfterPunctuation: false,
              preferPrefixWidthsForBreakableRuns: true,
              preferEarlySoftHyphenBreak: true,
            });

            vi.stubGlobal("navigator", {
              vendor: "Apple Computer, Inc.",
              userAgent: "CriOS/130.0.0.0 Mobile Safari/604.1",
            });
            expect(detectEngineProfile()).toMatchObject({
              lineFitEpsilon: 0.005,
              carryCJKAfterClosingQuote: true,
              breakKeepAllAfterPunctuation: true,
              preferPrefixWidthsForBreakableRuns: false,
              preferEarlySoftHyphenBreak: false,
            });

            vi.stubGlobal("navigator", {
              vendor: "",
              userAgent: "Firefox/130.0",
            });
            expect(detectEngineProfile()).toMatchObject({
              lineFitEpsilon: 0.005,
              carryCJKAfterClosingQuote: false,
              breakKeepAllAfterPunctuation: true,
              preferPrefixWidthsForBreakableRuns: false,
              preferEarlySoftHyphenBreak: false,
            });
          }),
        () => Effect.sync(() => vi.unstubAllGlobals())
      );
    })
  );

  it.effect(
    "pins the non-browser fence values mirrored from upstream v0.0.8",
    Effect.fnUntraced(function* () {
      const profile = yield* profileWithNavigator(undefined);

      expect(profile.lineFitEpsilon).toBe(0.005);
      expect(profile.carryCJKAfterClosingQuote).toBe(false);
      expect(profile.breakKeepAllAfterPunctuation).toBe(true);
      expect(profile.preferPrefixWidthsForBreakableRuns).toBe(false);
      expect(profile.preferEarlySoftHyphenBreak).toBe(false);
    })
  );

  it.effect(
    "switches to the Safari fence values for an Apple WebKit user agent",
    Effect.fnUntraced(function* () {
      const profile = yield* profileWithNavigator({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
        vendor: "Apple Computer, Inc.",
      });

      expect(profile.lineFitEpsilon).toBe(1 / 64);
      expect(profile.carryCJKAfterClosingQuote).toBe(false);
      expect(profile.breakKeepAllAfterPunctuation).toBe(false);
      expect(profile.preferPrefixWidthsForBreakableRuns).toBe(true);
      expect(profile.preferEarlySoftHyphenBreak).toBe(true);
    })
  );

  it.effect(
    "carries CJK after closing quotes for Chromium even when the vendor claims Apple",
    Effect.fnUntraced(function* () {
      const profile = yield* profileWithNavigator({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1",
        vendor: "Apple Computer, Inc.",
      });

      expect(profile.lineFitEpsilon).toBe(0.005);
      expect(profile.carryCJKAfterClosingQuote).toBe(true);
      expect(profile.breakKeepAllAfterPunctuation).toBe(true);
      expect(profile.preferPrefixWidthsForBreakableRuns).toBe(false);
      expect(profile.preferEarlySoftHyphenBreak).toBe(false);
    })
  );

  it.effect(
    "keeps the default fence values for a non-WebKit, non-Chromium user agent",
    Effect.fnUntraced(function* () {
      const profile = yield* profileWithNavigator({
        userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
        vendor: "",
      });

      expect(profile.lineFitEpsilon).toBe(0.005);
      expect(profile.carryCJKAfterClosingQuote).toBe(false);
      expect(profile.breakKeepAllAfterPunctuation).toBe(true);
      expect(profile.preferPrefixWidthsForBreakableRuns).toBe(false);
      expect(profile.preferEarlySoftHyphenBreak).toBe(false);
    })
  );
});

describe("PretextCaptureLive", () => {
  it.layer(PretextCaptureLive, { timeout: "10 seconds" })((it) => {
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
      })
    );
  });

  it.layer(PretextCaptureLive, { timeout: "10 seconds" })((it) => {
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
      })
    );
  });

  it.layer(PretextCaptureLive, { timeout: "10 seconds" })((it) => {
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
        expect(snapshot.metrics.engineProfile).toEqual(detectEngineProfile());
      })
    );
  });
});
