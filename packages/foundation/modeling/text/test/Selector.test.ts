import { fcRuns } from "@beep/fc-runs";
import { IRI } from "@beep/identity/Iri";
import { it } from "@beep/test-runner";
import { OffsetUnit, Position } from "@beep/text/OffsetUnit";
import { FragmentSelector, QuoteSelector, RangeSelector, RefinedSelector, Selector } from "@beep/text/Selector";
import { describe, expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const encode = (selector: Selector) => Result.getOrThrow(S.encodeResult(Selector)(selector));
const SelectorJson = S.fromJsonString(Selector);
const iri = (value: string) => Result.getOrThrow(S.decodeResult(IRI)(value));
const isSelector = S.is(Selector);

const between = (minimum: number, maximum: number) => Arbitrary.schema(S.Int.check(S.isBetween({ minimum, maximum })));

const SPECIFICATIONS: A.NonEmptyReadonlyArray<IRI> = [
  iri("http://www.w3.org/TR/media-frags/"),
  iri("http://tools.ietf.org/rfc/rfc5147"),
  iri("http://www.w3.org/TR/xpointer/"),
];

const optionalText = Arbitrary.map(
  Arbitrary.all([Arbitrary.schema(S.Boolean), Arbitrary.schema(S.String)]),
  ([present, text]) => (present ? O.some(text) : O.none())
);

const positionWithPositiveWidthArbitrary = Arbitrary.map(
  Arbitrary.all([Arbitrary.schema(OffsetUnit), between(0, 10_000), between(1, 500)]),
  ([unit, start, width]) => Position.make({ unit, start, end: start + width })
);

const quoteArbitrary = Arbitrary.map(
  Arbitrary.all([Arbitrary.schema(S.NonEmptyString), optionalText, optionalText]),
  ([exact, prefix, suffix]) => QuoteSelector.make({ exact, prefix, suffix })
);

const fragmentArbitrary = Arbitrary.map(
  Arbitrary.all([between(0, SPECIFICATIONS.length - 1), Arbitrary.schema(S.NonEmptyString)]),
  ([pick, value]) => FragmentSelector.make({ conformsTo: A.getUnsafe(SPECIFICATIONS, pick), value })
);

const leafArbitrary: Arbitrary.Arbitrary<Selector> = Arbitrary.flatMap(
  between(0, 2),
  (kind): Arbitrary.Arbitrary<Selector> =>
    kind === 0 ? positionWithPositiveWidthArbitrary : kind === 1 ? quoteArbitrary : fragmentArbitrary
);

const selectorAt = (maxCompositeDepth: number): Arbitrary.Arbitrary<Selector> =>
  maxCompositeDepth === 0
    ? leafArbitrary
    : Arbitrary.flatMap(between(0, 2), (kind) =>
        kind === 0
          ? leafArbitrary
          : Arbitrary.map(
              Arbitrary.all([selectorAt(maxCompositeDepth - 1), selectorAt(maxCompositeDepth - 1)]),
              ([left, right]) =>
                kind === 1
                  ? RefinedSelector.make({ base: left, by: right })
                  : RangeSelector.make({ from: left, to: right })
            )
      );

describe("@beep/text Selector", () => {
  it("encodes each case to its Web Annotation shape", () => {
    const position = Position.make({ unit: "unicode-code-point", start: 2, end: 3 });
    const quote = QuoteSelector.make({ exact: "B", prefix: O.some("😀"), suffix: O.none() });
    const fragment = FragmentSelector.make({ conformsTo: A.headNonEmpty(SPECIFICATIONS), value: "page=2" });

    expect(encode(position)).toEqual({ _tag: "Position", unit: "unicode-code-point", start: 2, end: 3 });
    expect(encode(quote)).toEqual({ _tag: "Quote", exact: "B", prefix: "😀" });
    expect(encode(fragment)).toEqual({
      _tag: "Fragment",
      conformsTo: "http://www.w3.org/TR/media-frags/",
      value: "page=2",
    });
    expect(encode(RefinedSelector.make({ base: position, by: quote }))).toEqual({
      _tag: "Refined",
      base: { _tag: "Position", unit: "unicode-code-point", start: 2, end: 3 },
      by: { _tag: "Quote", exact: "B", prefix: "😀" },
    });
    expect(encode(RangeSelector.make({ from: quote, to: fragment }))).toEqual({
      _tag: "Range",
      from: { _tag: "Quote", exact: "B", prefix: "😀" },
      to: { _tag: "Fragment", conformsTo: "http://www.w3.org/TR/media-frags/", value: "page=2" },
    });
  });

  it("refuses an empty quote, an empty position, a relative specification and a nested invalid case", () => {
    expect(isSelector({ _tag: "Quote", exact: "" })).toBe(false);
    expect(isSelector({ _tag: "Position", unit: "utf16-code-unit", start: 4, end: 4 })).toBe(false);
    expect(isSelector({ _tag: "Fragment", conformsTo: "media-frags", value: "page=2" })).toBe(false);
    expect(
      isSelector({
        _tag: "Refined",
        base: { _tag: "Quote", exact: "fact" },
        by: { _tag: "Range", from: { _tag: "Quote", exact: "a" }, to: { _tag: "Quote", exact: "" } },
      })
    ).toBe(false);
    expect(isSelector({ _tag: "Anchor", exact: "fact" })).toBe(false);
  });

  it.prop(
    "round-trips a recursive selector through its JSON encoding",
    [selectorAt(3)],
    ([selector]) => {
      const json = Result.getOrThrow(S.encodeResult(SelectorJson)(selector));
      const decoded = Result.getOrThrow(S.decodeResult(SelectorJson)(json));
      expect(decoded).toEqual(selector);
      expect(Selector.guards[selector._tag](decoded)).toBe(true);
    },
    { arbitrary: fcRuns(100) }
  );
});
