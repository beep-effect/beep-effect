import { fcRuns } from "@beep/fc-runs";
import { it } from "@beep/test-runner";
import { Anchored, mintOccurrenceId, OccurrenceId } from "@beep/text/Occurrence";
import { Position } from "@beep/text/OffsetUnit";
import { TextAnchor } from "@beep/text/TextAnchor";
import { TextAnchorVerificationReceipt } from "@beep/text/VerifiedTextAnchor";
import { expect } from "@effect/vitest";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { anchoredCase } from "./support/generators.ts";
import { citationSource, firstCitation, firstCitationId } from "./support/goldens.ts";

const AnchoredJson = S.fromJsonString(Anchored);

it.layer(Digest.layerWebCrypto)("@beep/text Anchored", (it) => {
  it("reads the UTF-16 range, the quote and the capture from its receipt", () => {
    expect(Anchored.range(firstCitation)).toEqual(Position.make({ unit: "utf16-code-unit", start: 3, end: 11 }));
    expect(Anchored.quote(firstCitation)).toBe("1 U.S. 1");
    expect(Anchored.source(firstCitation)).toEqual(citationSource);
  });

  it.effect(
    "encodes as the bare receipt under one key and decodes back",
    Effect.fnUntraced(function* () {
      const encoded = yield* S.encodeEffect(AnchoredJson)(firstCitation);
      expect(Str.startsWith('{"receipt":{"anchor":{"startChar":3,"endChar":11,"quote":"1 U.S. 1"},')(encoded)).toBe(
        true
      );
      const decoded = yield* S.decodeEffect(AnchoredJson)(encoded);
      expect(decoded).toEqual(firstCitation);
    })
  );

  it.effect.prop(
    "reads its range and quote from the receipt and survives a JSON round trip",
    [anchoredCase],
    ([{ text, source, anchored }]) =>
      Effect.gen(function* () {
        const { startChar, endChar } = anchored.receipt.anchor;
        expect(Anchored.range(anchored)).toEqual(
          Position.make({ unit: "utf16-code-unit", start: startChar, end: endChar })
        );
        expect(Anchored.quote(anchored)).toBe(Str.slice(startChar, endChar)(text));
        expect(Anchored.source(anchored)).toEqual(source);
        const encoded = yield* S.encodeEffect(AnchoredJson)(anchored);
        const decoded = yield* S.decodeEffect(AnchoredJson)(encoded);
        expect(decoded).toEqual(anchored);
      }),
    { arbitrary: fcRuns(100) }
  );

  it.effect(
    "refuses a row whose width disagrees with its quote",
    Effect.fnUntraced(function* () {
      const { receipt } = yield* S.encodeEffect(Anchored)(firstCitation);
      const refused = yield* Effect.flip(
        S.decodeEffect(Anchored)({ receipt: { ...receipt, anchor: { ...receipt.anchor, endChar: 12 } } })
      );
      expect(S.isSchemaError(refused)).toBe(true);
    })
  );

  it("accepts only sha256-prefixed occurrence ids", () => {
    expect(S.is(OccurrenceId)(firstCitationId)).toBe(true);
    expect(S.is(OccurrenceId)("68270708e021dadff3752f9e0d36a435565fdb6015bf7c1cc16e4e9024c54a48")).toBe(false);
  });

  it.effect(
    "fails minting with a schema error on a quote that holds a lone surrogate",
    Effect.fnUntraced(function* () {
      const loneSurrogate = Anchored.make({
        receipt: TextAnchorVerificationReceipt.make({
          anchor: TextAnchor.make({ startChar: 0, endChar: 1, quote: "\ud800" }),
          source: citationSource,
        }),
      });
      const error = yield* Effect.flip(mintOccurrenceId(loneSurrogate));
      expect(S.isSchemaError(error)).toBe(true);
    })
  );
});
