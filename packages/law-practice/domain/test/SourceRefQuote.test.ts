import { SourceRef, TextQuote } from "@beep/law-practice-domain/values";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

describe("review-source quote contract after citation locator retirement", () => {
  it.effect.prop(
    "preserves generated exact selector text and optional context through its codec",
    [TextQuote],
    ([generated]) =>
      Effect.gen(function* () {
        const quote = TextQuote.make(generated);
        const encoded = yield* S.encodeEffect(TextQuote)(quote);
        const decoded = yield* S.decodeEffect(TextQuote)(encoded);
        expect(S.toEquivalence(TextQuote)(decoded, quote)).toBe(true);
        expect(decoded.exact).toBe(quote.exact);
      })
  );
  it.effect("preserves exact/prefix/suffix encoding and empty selector text", () =>
    Effect.gen(function* () {
      for (const wire of [{ exact: "" }, { exact: "claim language", prefix: "", suffix: " after" }]) {
        const quote = yield* S.decodeEffect(TextQuote)(wire);
        expect(yield* S.encodeEffect(TextQuote)(quote)).toEqual(wire);
      }
      const quote = TextQuote.make({ exact: "" });
      assertNone(quote.prefix);
      assertNone(quote.suffix);
    })
  );

  it.effect("keeps the existing SourceRef wire shape without adding a selector kind or citation offsets", () =>
    Effect.gen(function* () {
      const wire = { boxFileId: "1234567890", page: 3, quote: { exact: "claim language", prefix: "before " } };
      const ref = yield* S.decodeEffect(SourceRef)(wire);
      expect(yield* S.encodeEffect(SourceRef)(ref)).toEqual(wire);
      assertNone(ref.crop);
    })
  );
});
