import { isInternallyConsistent, isUtf16Boundary, isWellOrdered, TextAnchor } from "@beep/provenance/TextAnchor";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import { Effect, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const decodeTextAnchor = S.decodeEffect(TextAnchor);
const decodeTextAnchorResult = S.decodeResult(TextAnchor);
const encodeUnknownTextAnchorResult = S.encodeUnknownResult(TextAnchor);
const isTextAnchor = S.is(TextAnchor);

const TextAnchorArbitrary = Arbitrary.schema(TextAnchor);
const TextAnchorEquivalence = S.toEquivalence(TextAnchor);

describe("@beep/provenance TextAnchor", () => {
  it("exposes TextAnchor from the public subpath", () => {
    expect(TextAnchor.isWellOrdered({ startChar: 0, endChar: 0 })).toBe(true);
  });

  it.effect(
    "decodes a well-formed anchor and re-slices the source text to the quote",
    Effect.fnUntraced(function* () {
      const source = "a claimed fact appears here";
      const anchor = yield* decodeTextAnchor({
        startChar: 0,
        endChar: 14,
        quote: "a claimed fact",
      });

      expect(anchor.quote).toBe("a claimed fact");
      expect(Str.slice(anchor.startChar, anchor.endChar)(source)).toBe(anchor.quote);
    })
  );

  it("flags an out-of-order anchor via isWellOrdered", () => {
    expect(isWellOrdered({ startChar: 0, endChar: 14 })).toBe(true);
    expect(isWellOrdered({ startChar: 9, endChar: 2 })).toBe(false);
  });

  it("recognizes zero, end, BMP, and whole-pair UTF-16 boundaries", () => {
    const sourceText = "A😀B";

    expect(isUtf16Boundary(sourceText, 0)).toBe(true);
    expect(isUtf16Boundary(sourceText, 1)).toBe(true);
    expect(isUtf16Boundary(sourceText, 3)).toBe(true);
    expect(isUtf16Boundary(sourceText, 4)).toBe(true);
    expect(isUtf16Boundary(sourceText, 2)).toBe(false);
    expect(isUtf16Boundary(sourceText, -1)).toBe(false);
    expect(isUtf16Boundary(sourceText, 5)).toBe(false);
    expect(isUtf16Boundary(sourceText, 1.5)).toBe(false);
  });

  it("rejects empty quotes and inconsistent widths at construction and decode", () => {
    expect(isTextAnchor({ startChar: 0, endChar: 0, quote: "" })).toBe(false);
    expect(isInternallyConsistent({ startChar: 0, endChar: 4, quote: "fact" })).toBe(true);
    expect(isInternallyConsistent({ startChar: 0, endChar: 1, quote: "fabricated" })).toBe(false);
    expect(isInternallyConsistent({ startChar: 4, endChar: 0, quote: "fact" })).toBe(false);
    assertFailure(
      decodeTextAnchorResult({ startChar: 0, endChar: 1, quote: "fabricated" }).pipe(
        Result.mapError((error) => ({ _tag: error._tag, message: error.message }))
      ),
      {
        _tag: "SchemaError",
        message: "Expected endChar - startChar to equal the non-empty quote's UTF-16 code-unit length.",
      }
    );
    assertFailure(
      decodeTextAnchorResult({ startChar: 4, endChar: 0, quote: "fact" }).pipe(
        Result.mapError((error) => ({ _tag: error._tag, message: error.message }))
      ),
      {
        _tag: "SchemaError",
        message: "Expected endChar - startChar to equal the non-empty quote's UTF-16 code-unit length.",
      }
    );
  });

  it.prop(
    "round-trips schema-derived anchors through the encoded wire shape",
    [TextAnchorArbitrary],
    ([anchor]) => {
      const encoded = Result.getOrThrow(encodeUnknownTextAnchorResult(anchor));
      const decoded = Result.getOrThrow(decodeTextAnchorResult(encoded));

      expect(encoded).toEqual({
        startChar: anchor.startChar,
        endChar: anchor.endChar,
        quote: anchor.quote,
      });
      expect(TextAnchor.isInternallyConsistent(anchor)).toBe(true);
      expect(TextAnchorEquivalence(decoded, anchor)).toBe(true);

      return true;
    },
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "colocated well-ordered predicate agrees with ordered offset pairs",
    [
      Arbitrary.schema(S.Int.check(S.isGreaterThanOrEqualTo(0))),
      Arbitrary.schema(S.Int.check(S.isGreaterThanOrEqualTo(0))),
    ],
    ([startChar, length]) => {
      const endChar = startChar + length;

      expect(TextAnchor.isWellOrdered({ startChar, endChar })).toBe(true);
      expect(isWellOrdered({ startChar: endChar + 1, endChar: startChar })).toBe(false);

      return true;
    },
    { arbitrary: fcRuns(50) }
  );
});
