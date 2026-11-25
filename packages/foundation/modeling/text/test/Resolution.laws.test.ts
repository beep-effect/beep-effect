import { fcRuns } from "@beep/fc-runs";
import { it } from "@beep/test-runner";
import { rangeIn, scalarRangeIn, wellFormedTextWith } from "@beep/text/Arbitrary";
import { Position } from "@beep/text/OffsetUnit";
import { Resolution, resolve } from "@beep/text/Resolution";
import { QuoteSelector, RangeSelector, RefinedSelector } from "@beep/text/Selector";
import { describe, expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { narrowTextWith, oneOf, overlappingRepeat, wellFormedText } from "./support/generators.ts";

const runs = { arbitrary: fcRuns(100) };

const quote = (exact: string, context: { readonly prefix?: string; readonly suffix?: string } = {}) =>
  QuoteSelector.make({ exact, prefix: O.fromUndefinedOr(context.prefix), suffix: O.fromUndefinedOr(context.suffix) });

const utf16 = (start: number, end: number) => Position.make({ unit: "utf16-code-unit", start, end });

const unique = (text: string, start: number, end: number) =>
  Resolution.cases.Unique.make({ position: utf16(start, end), quote: Str.slice(start, end)(text) });

const oracleStartsOfWellFormedPassage = (text: string, passage: string): ReadonlyArray<number> => {
  const starts: Array<number> = [];
  for (let index = 0; index + passage.length <= text.length; index++) {
    if (Str.startsWith(passage, index)(text)) {
      starts.push(index);
    }
  }
  return starts;
};

const passageAndFillerFromWideOrSelfOverlappingNarrowAlphabet = oneOf([
  Arbitrary.all({ passage: wellFormedText, filler: wellFormedTextWith({ minLength: 0, maxLength: 40 }) }),
  Arbitrary.all({
    passage: narrowTextWith({ minLength: 1, maxLength: 12 }),
    filler: narrowTextWith({ minLength: 0, maxLength: 12 }),
  }),
]);

const separatedRepeat = Arbitrary.map(
  passageAndFillerFromWideOrSelfOverlappingNarrowAlphabet,
  ({ passage, filler }) => ({
    passage: passage.text,
    text: `${passage.text}${filler.text}${passage.text}`,
  })
);

const overlappingRepeatText = Arbitrary.map(overlappingRepeat, ({ passage, text }) => ({
  passage: passage.text,
  text: text.text,
}));

const repeatedPassageTwoThirdsOverlappingForKmpFallback = oneOf([
  separatedRepeat,
  overlappingRepeatText,
  overlappingRepeatText,
]);

const passageArbitrary = Arbitrary.flatMap(
  oneOf([
    wellFormedText,
    narrowTextWith({ minLength: 1, maxLength: 24 }),
    Arbitrary.map(overlappingRepeat, ({ text }) => text),
  ]),
  (generated) =>
    Arbitrary.map(scalarRangeIn(generated.codePoints.length), (range) => ({
      text: generated.text,
      ...rangeIn(generated.boundaries["utf16-code-unit"])(range),
    }))
);

describe("@beep/text Resolution laws", () => {
  it.prop(
    "L1-5 a repeated passage resolves to Ambiguous",
    [repeatedPassageTwoThirdsOverlappingForKmpFallback],
    ([{ passage, text }]) => {
      const count = oracleStartsOfWellFormedPassage(text, passage).length;
      expect(count).toBeGreaterThanOrEqual(2);
      expect(resolve(text, quote(passage))).toEqual(Resolution.cases.Ambiguous.make({ count }));
    },
    runs
  );

  it.prop(
    "L1-5 context, Refined and Range pick the right copy of a repeated passage",
    [passageAndFillerFromWideOrSelfOverlappingNarrowAlphabet],
    ([{ passage, filler }]) => {
      const q = passage.text;
      const text = `${q}${filler.text}${q}`;
      const second = q.length + filler.text.length;
      expect(resolve(text, quote(q, { prefix: `${q}${filler.text}` }))).toEqual(unique(text, second, text.length));
      expect(resolve(text, quote(q, { suffix: `${filler.text}${q}` }))).toEqual(unique(text, 0, q.length));
      expect(resolve(text, RefinedSelector.make({ base: utf16(second, text.length), by: quote(q) }))).toEqual(
        unique(text, second, text.length)
      );
      expect(
        resolve(
          `${text}.`,
          RangeSelector.make({ from: utf16(second, text.length), to: utf16(text.length, text.length + 1) })
        )
      ).toEqual(unique(text, second, text.length));
    },
    runs
  );

  it.prop(
    "L1-5 a passage is Unique with its slice exactly when it occurs once",
    [passageArbitrary],
    ([{ text, start, end }]) => {
      const passage = Str.slice(start, end)(text);
      const starts = oracleStartsOfWellFormedPassage(text, passage);
      const resolved = resolve(quote(passage))(text);
      if (starts.length === 1) {
        expect(resolved).toEqual(unique(text, start, end));
      } else {
        expect(resolved).toEqual(Resolution.cases.Ambiguous.make({ count: starts.length }));
      }
    },
    runs
  );

  it("L1-5 overlapping matches count, and the first match is never returned", () => {
    expect(resolve("aaa", quote("aa"))).toEqual(Resolution.cases.Ambiguous.make({ count: 2 }));
    expect(resolve("abababa", quote("aba"))).toEqual(Resolution.cases.Ambiguous.make({ count: 3 }));
    expect(
      resolve("aabaaabaaa", quote("aabaaa")),
      "a failed partial match falls back to the longest border, or the second copy is lost"
    ).toEqual(Resolution.cases.Ambiguous.make({ count: 2 }));
    expect(
      resolve("aabaaabaaa", quote("baaa", { prefix: "aa" })),
      "the border fallback inside a self-overlapping context needle, context before"
    ).toEqual(Resolution.cases.Ambiguous.make({ count: 2 }));
    expect(
      resolve("aabaaabaaa", quote("aab", { suffix: "aaa" })),
      "the border fallback inside a self-overlapping context needle, context after"
    ).toEqual(Resolution.cases.Ambiguous.make({ count: 2 }));
    expect(
      resolve("😀a😀😀a😀😀a😀", quote("😀a😀😀a😀")),
      "a self-overlapping passage around an astral scalar"
    ).toEqual(Resolution.cases.Ambiguous.make({ count: 2 }));
    expect(
      resolve("😀a😀😀a😀😀a😀", quote("😀a😀", { prefix: "😀a😀" })),
      "context before a passage around an astral scalar"
    ).toEqual(Resolution.cases.Ambiguous.make({ count: 2 }));
    expect(
      resolve("😀a😀😀a😀😀a😀", quote("😀a😀", { prefix: "😀a😀", suffix: "😀a😀" })),
      "context on both sides of a passage around an astral scalar"
    ).toEqual(unique("😀a😀😀a😀😀a😀", 5, 10));
    expect(resolve("😀 1 U.S. 1; 1 U.S. 1", quote("1 U.S. 1"))).toEqual(Resolution.cases.Ambiguous.make({ count: 2 }));
    expect(resolve("😀 1 U.S. 1; 1 U.S. 1", quote("1 U.S. 1", { prefix: "; " }))).toEqual(
      unique("😀 1 U.S. 1; 1 U.S. 1", 13, 21)
    );
    expect(resolve("😀 1 U.S. 1; 1 U.S. 1", quote("1 U.S. 1", { suffix: ";" }))).toEqual(
      unique("😀 1 U.S. 1; 1 U.S. 1", 3, 11)
    );
  });

  it("L1-5 a Range narrowed by a Refined quote finds the copy between two headings", () => {
    const text = "Claim 1. the device. Claim 2. the device. Claim 3.";
    const section = RangeSelector.make({ from: quote("Claim 2."), to: quote("Claim 3.") });
    expect(resolve(text, quote("the device"))).toEqual(Resolution.cases.Ambiguous.make({ count: 2 }));
    expect(resolve(text, RefinedSelector.make({ base: section, by: quote("the device") }))).toEqual(
      unique(text, 30, 40)
    );
  });
});
