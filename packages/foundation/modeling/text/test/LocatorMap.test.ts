import { fcRuns } from "@beep/fc-runs";
import { PosixPath } from "@beep/schema/PosixPath";
import { it } from "@beep/test-runner";
import { textDigestOf } from "@beep/text/Arbitrary";
import { AlignedSegment, CaptureMismatch, LocatorMap } from "@beep/text/LocatorMap";
import { Position } from "@beep/text/OffsetUnit";
import { SourceTextExtractor, SourceTextIdentity } from "@beep/text/SourceTextIdentity";
import { normalizeText } from "@beep/text/TextNormalization";
import { describe, expect } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { locatorStep, sha256, wellFormedText } from "./support/generators.ts";

const capture = (name: string): SourceTextIdentity =>
  SourceTextIdentity.make({
    scopeRef: "matter:example",
    sourceRef: `source:${name}`,
    locator: PosixPath.make(`documents/${name}.txt`),
    sourceDigest: textDigestOf(sha256)(name),
    textDigest: textDigestOf(sha256)(name),
    extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
    normalizationVersion: "1",
  });

const a = capture("a");
const b = capture("b");
const c = capture("c");

const at = (start: number, end: number) => Position.make({ unit: "utf16-code-unit", start, end });
const kept = (from: Position, to: Position) => AlignedSegment.cases.Kept.make({ from, to });
const rewritten = (from: Position, to: Position) => AlignedSegment.cases.Rewritten.make({ from, to });

const isLocatorMap = S.is(LocatorMap);
// The same fields without the map check, to encode segment lists the check refuses.
const encodeUnchecked = S.encodeEffect(
  S.Struct({ from: SourceTextIdentity, to: SourceTextIdentity, segments: S.Array(AlignedSegment) })
);
const decodeLocatorMap = S.decodeEffect(LocatorMap);

const composed = (first: ReadonlyArray<AlignedSegment>, second: ReadonlyArray<AlignedSegment>) =>
  Result.getOrThrow(
    LocatorMap.compose(
      LocatorMap.make({ from: a, to: b, segments: first }),
      LocatorMap.make({ from: b, to: c, segments: second })
    )
  ).segments;

describe("@beep/text LocatorMap", () => {
  it("accepts ordered, disjoint UTF-16 segments with gaps on either side", () => {
    expect(isLocatorMap({ from: a, to: b, segments: [] })).toBe(true);
    expect(isLocatorMap({ from: a, to: b, segments: [kept(at(0, 2), at(1, 3)), rewritten(at(3, 4), at(3, 9))] })).toBe(
      true
    );
  });

  it.effect(
    "refuses non-UTF-16 positions, overlaps on either side and kept segments that change width",
    Effect.fnUntraced(function* () {
      const codePoints = Position.make({ unit: "unicode-code-point", start: 0, end: 1 });
      for (const segments of [
        [kept(codePoints, at(0, 1))],
        [rewritten(at(0, 1), codePoints)],
        [kept(at(0, 2), at(0, 2)), kept(at(1, 3), at(2, 4))],
        [kept(at(0, 2), at(0, 2)), kept(at(2, 4), at(1, 3))],
        [kept(at(2, 4), at(2, 4)), kept(at(0, 2), at(0, 2))],
        [kept(at(0, 2), at(0, 3))],
      ]) {
        const encoded = yield* encodeUnchecked({ from: a, to: b, segments });
        const refused = yield* Effect.flip(decodeLocatorMap(encoded));
        expect(refused.message).toContain("Expected UTF-16 segments, ordered and disjoint on both sides");
      }
    })
  );

  it("maps a capture to itself with one kept segment", () => {
    expect(LocatorMap.identity(a, 5)).toEqual(
      LocatorMap.make({ from: a, to: a, segments: [kept(at(0, 5), at(0, 5))] })
    );
    expect(LocatorMap.identity(a, 0).segments).toEqual([]);
  });

  it("refuses to compose maps that do not meet at one capture", () => {
    const first = LocatorMap.identity(a, 2);
    const second = LocatorMap.identity(b, 2);
    assertFailure(LocatorMap.compose(first, second), CaptureMismatch.make({ left: a, right: b }));
  });

  it("composes kept pieces pointwise and rewritten chains as one segment", () => {
    // NFKC then de-hyphenation of "ﬁ-\nne": the ligature, the break and the letter after it become one rewrite.
    const nfkc = normalizeText("ﬁ-\nne", "nfkc");
    const dehyphenated = normalizeText(nfkc.text, "dehyphenate");
    expect(dehyphenated.text).toBe("fine");
    expect(composed(nfkc.segments, dehyphenated.segments)).toEqual([
      rewritten(at(0, 4), at(0, 3)),
      kept(at(4, 5), at(3, 4)),
    ]);
    // A cut of the second map inside a kept segment of the first splits it; both pieces stay kept.
    expect(composed([kept(at(0, 4), at(0, 4))], [kept(at(0, 2), at(0, 2)), kept(at(2, 4), at(3, 5))])).toEqual([
      kept(at(0, 2), at(0, 2)),
      kept(at(2, 4), at(3, 5)),
    ]);
    // A kept segment of one map over a rewritten one of the other is rewritten, with the kept cut mapped pointwise.
    expect(
      composed([rewritten(at(0, 1), at(0, 2)), kept(at(1, 3), at(2, 4))], [rewritten(at(0, 3), at(0, 1))])
    ).toEqual([rewritten(at(0, 2), at(0, 1))]);
  });

  it("drops a piece that touches a gap of either map", () => {
    // The first map leaves 1..2 of the middle text uncovered; the second leaves 3..4 uncovered.
    const first = [kept(at(0, 1), at(0, 1)), kept(at(1, 4), at(2, 5))];
    const second = [kept(at(0, 3), at(0, 3)), kept(at(4, 5), at(4, 5))];
    expect(composed(first, second)).toEqual([
      kept(at(0, 1), at(0, 1)),
      kept(at(1, 2), at(2, 3)),
      kept(at(3, 4), at(4, 5)),
    ]);
    expect(composed([], second)).toEqual([]);
    // A rewrite of the first map hides the cuts of the second inside it, so the one piece spans the second map's gap
    // between two segments and is dropped.
    expect(composed([rewritten(at(0, 1), at(0, 3))], [kept(at(0, 1), at(0, 1)), kept(at(2, 3), at(1, 2))])).toEqual([]);
    // The same piece over two second-map segments that meet is kept, as one rewrite.
    expect(composed([rewritten(at(0, 1), at(0, 3))], [kept(at(0, 1), at(0, 1)), kept(at(1, 3), at(2, 4))])).toEqual([
      rewritten(at(0, 1), at(0, 4)),
    ]);
  });

  it("absorbs into a rewrite the text the second map inserts inside a rewrite of the first", () => {
    // ab to xy as a whole, then _ inserted between x and y: the middle offset 1 has no preimage, so one rewrite.
    expect(composed([rewritten(at(0, 2), at(0, 2))], [kept(at(0, 1), at(0, 1)), kept(at(1, 2), at(2, 3))])).toEqual([
      rewritten(at(0, 2), at(0, 3)),
    ]);
  });

  it.effect.prop(
    "round-trips a generated locator map between generated captures through its encoding",
    [
      Arbitrary.schema(SourceTextIdentity),
      Arbitrary.schema(SourceTextIdentity),
      Arbitrary.flatMap(wellFormedText, ({ text }) => locatorStep(text)),
    ],
    ([from, to, { segments }]) =>
      Effect.gen(function* () {
        const map = LocatorMap.make({ from, to, segments });
        const encoded = yield* S.encodeEffect(LocatorMap)(map);
        const decoded = yield* S.decodeEffect(LocatorMap)(encoded);
        expect(decoded).toEqual(map);
      }),
    { arbitrary: fcRuns(100) }
  );

  it.effect(
    "encodes and decodes a locator map",
    Effect.fnUntraced(function* () {
      const map = LocatorMap.make({
        from: a,
        to: b,
        segments: [kept(at(0, 1), at(0, 1)), rewritten(at(1, 2), at(1, 3))],
      });
      const encoded = yield* S.encodeEffect(LocatorMap)(map);
      const decoded = yield* S.decodeEffect(LocatorMap)(encoded);
      expect(decoded).toEqual(map);
    })
  );
});
