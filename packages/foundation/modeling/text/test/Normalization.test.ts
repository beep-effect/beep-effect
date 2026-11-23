import { fcRuns } from "@beep/fc-runs";
import { it } from "@beep/test-runner";
import { AlignedSegment } from "@beep/text/LocatorMap";
import { Position } from "@beep/text/OffsetUnit";
import { normalizeQuote } from "@beep/text/QuoteKey";
import { NormalizedText, normalizeText, TextNormalization } from "@beep/text/TextNormalization";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { normalizationText } from "./support/generators.ts";

const runs = { arbitrary: fcRuns(300) };

const nfkc = Str.normalize("NFKC");
const dehyphenate = Str.replace(/(?<=\p{L})[-‐](?:\r\n|\n|\r)(?=\p{Ll})/gu, "");
const oracles: { readonly [Normalization in TextNormalization]: (text: string) => string } = {
  nfkc,
  dehyphenate,
};

const sliceAt = (text: string, position: Position): string => Str.slice(position.start, position.end)(text);

const expectAligned = (input: string, normalized: NormalizedText, rewrite: (text: string) => string): void => {
  const ends = A.reduce(normalized.segments, { from: 0, to: 0, kept: false }, (at, segment) => {
    expect([segment.from.unit, segment.to.unit], "every segment is UTF-16").toEqual([
      "utf16-code-unit",
      "utf16-code-unit",
    ]);
    expect([segment.from.start, segment.to.start], "segments are ordered and gap-free on both sides").toEqual([
      at.from,
      at.to,
    ]);
    expect(segment.from.end).toBeGreaterThan(segment.from.start);
    const source = sliceAt(input, segment.from);
    const target = sliceAt(normalized.text, segment.to);
    AlignedSegment.match(segment, {
      Kept: () => {
        expect(at.kept, "no two kept segments are adjacent").toBe(false);
        expect(target, "a kept segment is the same text on both sides").toBe(source);
      },
      Rewritten: () => {
        expect(target, "a rewritten segment is the rewrite of its source").toBe(rewrite(source));
        expect(target, "a rewritten segment differs from its source").not.toBe(source);
      },
    });
    return { from: segment.from.end, to: segment.to.end, kept: AlignedSegment.guards.Kept(segment) };
  });
  expect([ends.from, ends.to], "segments cover both texts to the end").toEqual([
    Str.length(input),
    Str.length(normalized.text),
  ]);
};

const at = (start: number, end: number) => Position.make({ unit: "utf16-code-unit", start, end });
const kept = (from: Position, to: Position) => AlignedSegment.cases.Kept.make({ from, to });
const rewritten = (from: Position, to: Position) => AlignedSegment.cases.Rewritten.make({ from, to });

describe("@beep/text TextNormalization", () => {
  it.prop(
    "each normalization gives its whole-text form and aligned segments",
    [normalizationText],
    ([text]) => {
      for (const normalization of TextNormalization.literals) {
        const normalized = normalizeText(text, normalization);
        expect(normalized.text).toBe(oracles[normalization](text));
        expectAligned(text, normalized, oracles[normalization]);
      }
      expect(normalizeQuote(text, "nfkc-dehyphenate/v1")).toBe(dehyphenate(nfkc(text)));
    },
    runs
  );

  it("rewrites NFKC clusters and keeps the text between them", () => {
    expect(normalizeText("ﬁnal ①", "nfkc")).toEqual(
      NormalizedText.make({
        text: "final 1",
        segments: [rewritten(at(0, 1), at(0, 2)), kept(at(1, 5), at(2, 6)), rewritten(at(5, 6), at(6, 7))],
      })
    );
    expect(normalizeText("é", "nfkc").segments).toEqual([kept(at(0, 1), at(0, 1))]);
    expect(normalizeText("é", "nfkc").segments).toEqual([rewritten(at(0, 2), at(0, 1))]);
    expect(normalizeText("ㄱㅏ", "nfkc")).toEqual(
      NormalizedText.make({ text: "가", segments: [rewritten(at(0, 2), at(0, 1))] })
    );
    expect(normalizeText("𝒳", "nfkc")).toEqual(
      NormalizedText.make({ text: "X", segments: [rewritten(at(0, 2), at(0, 1))] })
    );
    expect(normalizeText("", "nfkc")).toEqual(NormalizedText.make({ text: "", segments: [] }));
  });

  it("joins a letter whose NFKC form starts with a mark to the open cluster", () => {
    expect(
      normalizeText("Zﾞ̣", "nfkc"),
      "Z, U+FF9E, U+0323 is one cluster: NFKC composes Z with the dot below across the voiced sound mark"
    ).toEqual(NormalizedText.make({ text: "Ẓ゙", segments: [rewritten(at(0, 3), at(0, 2))] }));
  });

  it("removes a hyphen break between a letter and a lowercase letter as one rewritten segment", () => {
    expect(normalizeText("exam-\nple", "dehyphenate")).toEqual(
      NormalizedText.make({
        text: "example",
        segments: [kept(at(0, 3), at(0, 3)), rewritten(at(3, 7), at(3, 5)), kept(at(7, 9), at(5, 7))],
      })
    );
    expect(normalizeText("a-\nb-\nc", "dehyphenate")).toEqual(
      NormalizedText.make({ text: "abc", segments: [rewritten(at(0, 7), at(0, 3))] })
    );
    expect(normalizeText("ab-\ncd-\nef", "dehyphenate").segments).toEqual([
      kept(at(0, 1), at(0, 1)),
      rewritten(at(1, 5), at(1, 3)),
      rewritten(at(5, 9), at(3, 5)),
      kept(at(9, 10), at(5, 6)),
    ]);
    expect(normalizeText("𝒳-\r\n𝒶", "dehyphenate")).toEqual(
      NormalizedText.make({ text: "𝒳𝒶", segments: [rewritten(at(0, 7), at(0, 4))] })
    );
    expect(normalizeText("x‐\ry", "dehyphenate").text).toBe("xy");
  });

  it("keeps a hyphen break without a letter before or a lowercase letter after", () => {
    for (const text of ["Claim-\nOne", "1-\nb", "-\nb", "a-\n", "a- \nb", "a--\nb"]) {
      expect(normalizeText(text, "dehyphenate"), text).toEqual(
        NormalizedText.make({ text, segments: [kept(at(0, Str.length(text)), at(0, Str.length(text)))] })
      );
    }
  });

  it.effect(
    "encodes and decodes a normalized text",
    Effect.fnUntraced(function* () {
      const normalized = normalizeText("ﬁ-\nnal", "nfkc");
      const encoded = yield* S.encodeEffect(NormalizedText)(normalized);
      const decoded = yield* S.decodeEffect(NormalizedText)(encoded);
      expect(decoded).toEqual(normalized);
    })
  );
});
