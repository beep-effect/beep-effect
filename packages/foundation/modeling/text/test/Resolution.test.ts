import { IRI } from "@beep/identity/Iri";
import { it } from "@beep/test-runner";
import { Position } from "@beep/text/OffsetUnit";
import { Resolution, resolve } from "@beep/text/Resolution";
import { FragmentSelector, QuoteSelector, RangeSelector, RefinedSelector } from "@beep/text/Selector";
import { describe, expect } from "@effect/vitest";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const quote = (exact: string, prefix?: string) =>
  QuoteSelector.make({ exact, prefix: O.fromUndefinedOr(prefix), suffix: O.none() });

const at = (unit: Position["unit"], start: number, end: number) => Position.make({ unit, start, end });

const notFound = Resolution.cases.NotFound.make({});
const ambiguous = (count: number) => Resolution.cases.Ambiguous.make({ count });
const unique = (start: number, end: number, text: string) =>
  Resolution.cases.Unique.make({ position: at("utf16-code-unit", start, end), quote: text });

const fragment = FragmentSelector.make({
  conformsTo: Result.getOrThrow(S.decodeResult(IRI)("http://tools.ietf.org/rfc/rfc5147")),
  value: "char=0,1",
});

describe("@beep/text Resolution", () => {
  it("resolves a position in any unit to its UTF-16 range, and a refused conversion to NotFound", () => {
    expect(resolve("A😀B", at("unicode-code-point", 1, 2))).toEqual(unique(1, 3, "😀"));
    expect(resolve("A😀B", at("utf8-byte", 5, 6))).toEqual(unique(3, 4, "B"));
    expect(resolve("A😀B", at("utf16-code-unit", 1, 2))).toEqual(notFound);
    expect(resolve("A😀B", at("utf16-code-unit", 3, 9))).toEqual(notFound);
  });

  it("counts a quote only at scalar boundaries and needs its whole context", () => {
    // The low half of the emoji is not a scalar, so the quote of it matches nowhere.
    expect(resolve("A😀B", quote("\ude00B"))).toEqual(notFound);
    expect(resolve("A😀B", quote("B", "\ude00"))).toEqual(unique(3, 4, "B"));
    expect(resolve("aaab", quote("aab"))).toEqual(unique(1, 4, "aab"));
    expect(resolve("abcabe", quote("d", "abcab"))).toEqual(notFound);
    expect(resolve("", quote("a"))).toEqual(notFound);
    expect(resolve("abc", quote("abcd"))).toEqual(notFound);
  });

  it("resolves no fragment over plain text", () => {
    expect(resolve("char=0,1", fragment)).toEqual(notFound);
    expect(resolve("abc", RefinedSelector.make({ base: fragment, by: quote("a") }))).toEqual(notFound);
  });

  it("refines inside the base selection, relative to it", () => {
    const text = "x fact y fact z";
    expect(resolve(text, RefinedSelector.make({ base: at("utf16-code-unit", 7, 15), by: quote("fact") }))).toEqual(
      unique(9, 13, "fact")
    );
    expect(resolve(text, RefinedSelector.make({ base: quote("y fact"), by: at("unicode-code-point", 2, 6) }))).toEqual(
      unique(9, 13, "fact")
    );
    // A base that is not Unique has no segment for `by`: the outcome is the base's.
    expect(resolve(text, RefinedSelector.make({ base: quote("fact"), by: quote("a") }))).toEqual(ambiguous(2));
    expect(resolve(text, RefinedSelector.make({ base: quote("w"), by: quote("a") }))).toEqual(notFound);
    // `by` may itself be ambiguous or absent inside the base.
    expect(resolve(text, RefinedSelector.make({ base: at("utf16-code-unit", 0, 15), by: quote("fact") }))).toEqual(
      ambiguous(2)
    );
    expect(resolve(text, RefinedSelector.make({ base: at("utf16-code-unit", 0, 4), by: quote("y") }))).toEqual(
      notFound
    );
  });

  it("runs a range from the start of `from` to the start of `to`, exclusive", () => {
    const text = "Claim 1. one. Claim 2. two.";
    expect(resolve(text, RangeSelector.make({ from: quote("Claim 1."), to: quote("Claim 2.") }))).toEqual(
      unique(0, 14, "Claim 1. one. ")
    );
    // Empty and inverted ranges are NotFound.
    expect(resolve(text, RangeSelector.make({ from: quote("Claim 2."), to: quote("Claim 2.") }))).toEqual(notFound);
    expect(resolve(text, RangeSelector.make({ from: quote("Claim 2."), to: quote("Claim 1.") }))).toEqual(notFound);
    // Any NotFound part is NotFound, whatever the other part is.
    expect(resolve(text, RangeSelector.make({ from: quote("Claim 3."), to: quote("Claim") }))).toEqual(notFound);
    expect(resolve(text, RangeSelector.make({ from: quote("Claim"), to: fragment }))).toEqual(notFound);
    // Otherwise an ambiguous part makes the range ambiguous with the product of the counts.
    expect(resolve(text, RangeSelector.make({ from: quote("Claim"), to: quote("two") }))).toEqual(ambiguous(2));
    expect(resolve(text, RangeSelector.make({ from: quote("Claim"), to: quote(".") }))).toEqual(ambiguous(8));
  });

  it("saturates the count of nested ranges instead of throwing", () => {
    // (10^4 * 10^4)^2 = 10^16 selections, past Number.MAX_SAFE_INTEGER: the count saturates there.
    const text = Str.repeat(10_000)("a");
    const inner = RangeSelector.make({ from: quote("a"), to: quote("a") });
    const nested = RangeSelector.make({ from: inner, to: inner });
    expect(resolve(text, inner)).toEqual(ambiguous(100_000_000));
    expect(resolve(text, nested)).toEqual(ambiguous(Number.MAX_SAFE_INTEGER));
    expect(resolve(text, RangeSelector.make({ from: nested, to: nested }))).toEqual(ambiguous(Number.MAX_SAFE_INTEGER));
    expect(resolve(text, RefinedSelector.make({ base: nested, by: quote("a") }))).toEqual(
      ambiguous(Number.MAX_SAFE_INTEGER)
    );
  });

  it("resolves through the pipeable form", () => {
    expect(resolve(quote("b"))("abc")).toEqual(unique(1, 2, "b"));
  });
});
