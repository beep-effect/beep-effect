import { fcRuns } from "@beep/fc-runs";
import { it } from "@beep/test-runner";
import { Anchored } from "@beep/text/Occurrence";
import { convertPosition, OffsetUnit, Position, slicePosition } from "@beep/text/OffsetUnit";
import { TextAnchor } from "@beep/text/TextAnchor";
import { VerifyTextAnchorInput, verifyTextAnchor } from "@beep/text/VerifiedTextAnchor";
import { expect } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";
import { anchoredCase, rangeIn } from "./support/generators.ts";
import { citationSource, citationText, firstCitation } from "./support/goldens.ts";
import type { SourceTextIdentity } from "@beep/text/SourceTextIdentity";

const runs = { arbitrary: fcRuns(100) };

const verify = (anchor: TextAnchor, source: SourceTextIdentity, sourceText: string) =>
  verifyTextAnchor(VerifyTextAnchorInput.make({ anchor, expectedSource: source, source, sourceText }));

// A quote of the same UTF-16 width and other text: x repeated, or y repeated when the quote is all x.
const sameWidthOtherQuote = (quote: string): string => {
  const width = Str.length(quote);
  const xs = Str.repeat(width)("x");
  return xs === quote ? Str.repeat(width)("y") : xs;
};

it.layer(Digest.layerWebCrypto, { timeout: "10 seconds" })("@beep/text TextAnchor laws", (it) => {
  it.effect.prop(
    "L1-1 slicing the text at a position yields the quote",
    [anchoredCase],
    ([{ text, boundaries, range, source, anchored }]) =>
      Effect.gen(function* () {
        const verified = yield* verify(anchored.receipt.anchor, source, text);
        expect(verified.anchor).toEqual(anchored.receipt.anchor);
        const quote = Anchored.quote(anchored);
        assertSuccess(slicePosition(Anchored.range(anchored), text), quote);
        // The same range in every unit, read from the generator's own boundaries, selects the same quote.
        for (const unit of OffsetUnit.literals) {
          const position = Position.make({ unit, ...rangeIn(boundaries[unit])(range) });
          assertSuccess(slicePosition(position, text), quote);
          assertSuccess(convertPosition(Anchored.range(anchored), unit, text), position);
        }
      }),
    runs
  );

  it.effect.prop(
    "L1-1 a quote of the right width and the wrong text is refused as a quote mismatch",
    [anchoredCase],
    ([{ text, source, anchored }]) =>
      Effect.gen(function* () {
        const { startChar, endChar, quote } = anchored.receipt.anchor;
        const forged = TextAnchor.make({ startChar, endChar, quote: sameWidthOtherQuote(quote) });
        const error = yield* Effect.flip(verify(forged, source, text));
        expect(error.reason).toBe("quote-mismatch");
      }),
    runs
  );

  it.effect(
    "L1-1 the golden anchor after an astral character slices to its quote in every unit",
    Effect.fnUntraced(function* () {
      const text = citationText;
      const source = citationSource;
      yield* verify(firstCitation.receipt.anchor, source, text);
      assertSuccess(slicePosition(Anchored.range(firstCitation), text), "1 U.S. 1");
      assertSuccess(slicePosition(Position.make({ unit: "unicode-code-point", start: 2, end: 10 }), text), "1 U.S. 1");
      assertSuccess(slicePosition(Position.make({ unit: "utf8-byte", start: 5, end: 13 }), text), "1 U.S. 1");
      const forged = TextAnchor.make({ startChar: 3, endChar: 11, quote: "1 U.S. 2" });
      expect((yield* Effect.flip(verify(forged, source, text))).reason).toBe("quote-mismatch");
    })
  );
});
