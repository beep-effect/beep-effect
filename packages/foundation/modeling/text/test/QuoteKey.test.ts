import { it } from "@beep/test-runner";
import { mintQuoteKey, normalizeQuote, QuoteKey, QuoteNormalization } from "@beep/text/QuoteKey";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import { citationQuoteKey } from "./support/goldens.ts";

const normalization: QuoteNormalization = "nfkc-dehyphenate/v1";
const keyOf = (quote: string) => mintQuoteKey(quote, normalization);

describe("@beep/text QuoteKey", () => {
  it("normalizes a quote with NFKC, then removes in-word hyphen breaks", () => {
    expect(normalizeQuote("ﬁ-\nnal", normalization)).toBe("final");
    expect(normalizeQuote(normalization)("①")).toBe("1");
    expect(normalizeQuote("Claim-\nOne", normalization)).toBe("Claim-\nOne");
    expect(S.is(QuoteNormalization)("nfkc-dehyphenate/v1")).toBe(true);
    expect(S.is(QuoteNormalization)("nfkc")).toBe(false);
  });
});

it.layer(Digest.layerWebCrypto)("@beep/text QuoteKey minting", (it) => {
  it.effect(
    "mints the golden key and one key for spellings that normalize alike",
    Effect.fnUntraced(function* () {
      const golden = yield* keyOf("1 U.S. 1");
      expect(golden).toBe(citationQuoteKey);
      const spellings = yield* Effect.forEach(["final", "ﬁnal", "fi-\nnal", "ﬁ-\r\nnal"], keyOf, { concurrency: 1 });
      expect(HashSet.size(HashSet.fromIterable(spellings))).toBe(1);
      expect(A.every(spellings, S.is(QuoteKey))).toBe(true);
      const capitalized = yield* keyOf("Final");
      expect(
        HashSet.has(HashSet.fromIterable(spellings), capitalized),
        "case is not folded: another passage, another key"
      ).toBe(false);
    })
  );

  it.effect(
    "fails with a schema error on a quote that holds a lone surrogate",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.flip(keyOf("a\udc00"));
      expect(S.isSchemaError(error)).toBe(true);
    })
  );
});
