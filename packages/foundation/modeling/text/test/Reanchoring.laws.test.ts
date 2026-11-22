import { fcRuns } from "@beep/fc-runs";
import { PosixPath } from "@beep/schema/PosixPath";
import { it } from "@beep/test-runner";
import { anchoredOn, rangeIn, scalarRangeIn, sourceFor, textDigestOf } from "@beep/text/Arbitrary";
import { AlignedSegment, LocatorMap } from "@beep/text/LocatorMap";
import { Anchored, mintOccurrenceId } from "@beep/text/Occurrence";
import { Position } from "@beep/text/OffsetUnit";
import { normalizeQuote } from "@beep/text/QuoteKey";
import { Reanchoring, reanchor } from "@beep/text/Reanchoring";
import { SourceTextExtractor, SourceTextIdentity } from "@beep/text/SourceTextIdentity";
import { normalizeText, TextNormalization } from "@beep/text/TextNormalization";
import { VerifySourceTextIdentityInput, verifySourceTextIdentity } from "@beep/text/VerifiedTextAnchor";
import { expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import { anchoredCase, locatorStep, normalizationText, sha256, wellFormedText } from "./support/generators.ts";
import type { PreimageMintError } from "@beep/text/Occurrence";
import type { TextNormalization as Normalization } from "@beep/text/TextNormalization";
import type { VerifiedTextAnchorError } from "@beep/text/VerifiedTextAnchor";

const runs = { arbitrary: fcRuns(100) };

const verifiedOf = (source: SourceTextIdentity, sourceText: string) =>
  verifySourceTextIdentity(VerifySourceTextIdentityInput.make({ expectedSource: source, source, sourceText }));

const capture = (name: string, text: string): SourceTextIdentity =>
  SourceTextIdentity.make({
    scopeRef: "matter:example",
    sourceRef: `source:${name}`,
    locator: PosixPath.make(`documents/${name}.txt`),
    sourceDigest: textDigestOf(sha256)(text),
    textDigest: textDigestOf(sha256)(text),
    extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
    normalizationVersion: "1",
  });

const at = (start: number, end: number) => Position.make({ unit: "utf16-code-unit", start, end });

const isMapped = (outcome: Reanchoring): outcome is Reanchoring & { readonly to: Anchored } =>
  !Reanchoring.guards.Unmapped(outcome);

const rangeOf = (outcome: Reanchoring & { readonly to: Anchored }) => Anchored.range(outcome.to);

// The UTF-16 offset of each scalar boundary of a text: offset 0, then the end of each scalar.
const boundariesOf = (text: string): A.NonEmptyReadonlyArray<number> =>
  A.scan(A.fromIterable(text), 0, (offset, scalar) => offset + scalar.length);

// Three captures and two generated gapped steps between them, with an occurrence in the first.
const chainCase = Arbitrary.flatMap(wellFormedText, (first) =>
  Arbitrary.flatMap(locatorStep(first.text), (f) =>
    Arbitrary.flatMap(locatorStep(f.target), (g) =>
      Arbitrary.map(
        Arbitrary.all({
          range: scalarRangeIn(first.codePoints.length),
          a: sourceFor(sha256)(first.text),
          b: sourceFor(sha256)(f.target),
          c: sourceFor(sha256)(g.target),
        }),
        ({ range, a, b, c }) => ({
          anchored: anchoredOn(a, first.text, rangeIn(first.boundaries["utf16-code-unit"])(range)),
          f: LocatorMap.make({ from: a, to: b, segments: f.segments }),
          g: LocatorMap.make({ from: b, to: c, segments: g.segments }),
          texts: { b: f.target, c: g.target },
        })
      )
    )
  )
);

// Text salted with hyphen breaks and the scalars NFKC rewrites, never empty, with a scalar range in it.
const normalizationCase = Arbitrary.flatMap(normalizationText, (salted) => {
  const text = `${salted}a`;
  const boundaries = boundariesOf(text);
  return Arbitrary.map(scalarRangeIn(boundaries.length - 1), (range) => ({ text, range: rangeIn(boundaries)(range) }));
});

const normalizationMap = (from: SourceTextIdentity, text: string, normalization: Normalization) => {
  const normalized = normalizeText(text, normalization);
  const to = capture(`${normalization}-of-${from.sourceRef}`, normalized.text);
  return { map: LocatorMap.make({ from, to, segments: normalized.segments }), to, text: normalized.text };
};

// Re-anchors the UTF-16 range `start..end` of `text` through `normalization`.
const throughNormalization = Effect.fnUntraced(function* (
  text: string,
  normalization: Normalization,
  start: number,
  end: number
) {
  const from = capture("a", text);
  const { map, to, text: targetText } = normalizationMap(from, text, normalization);
  const target = yield* verifiedOf(to, targetText);
  return yield* reanchor(anchoredOn(from, text, { start, end }), map, target);
});

// Re-anchors the range `start..end` of `text` through a hand-made map to `targetText`.
const throughSegments = Effect.fnUntraced(function* (
  text: string,
  targetText: string,
  segments: ReadonlyArray<AlignedSegment>,
  start: number,
  end: number
) {
  const from = capture("a", text);
  const to = capture("b", targetText);
  const target = yield* verifiedOf(to, targetText);
  return yield* reanchor(LocatorMap.make({ from, to, segments }), target)(anchoredOn(from, text, { start, end }));
});

// Every re-anchoring in these tests: it mints with the Digest service and may verify a source first.
type Outcome = Effect.Effect<Reanchoring, PreimageMintError | VerifiedTextAnchorError, Digest.Digest>;

const expectMapped = (outcome: Outcome, tag: "Exact" | "Widened", quote: string): Outcome =>
  Effect.map(outcome, (mapped) => {
    expect(mapped._tag).toBe(tag);
    expect(isMapped(mapped) && Anchored.quote(mapped.to)).toBe(quote);
    return mapped;
  });

const expectUnmapped = (outcome: Outcome, reason: string): Outcome =>
  Effect.map(outcome, (unmapped) => {
    expect(Reanchoring.guards.Unmapped(unmapped) ? unmapped.reason : unmapped._tag).toBe(reason);
    return unmapped;
  });

const kept = (from: Position, to: Position) => AlignedSegment.cases.Kept.make({ from, to });
const rewritten = (from: Position, to: Position) => AlignedSegment.cases.Rewritten.make({ from, to });

it.layer(Digest.layerWebCrypto, { timeout: "30 seconds" })("@beep/text Reanchoring laws", (it) => {
  it.effect.prop(
    "L1-3 reanchoring is lax-functorial and exact and natural on Exact under NFKC and de-hyphenation",
    [chainCase],
    ([{ anchored, f, g, texts }]) =>
      Effect.gen(function* () {
        const b = yield* verifiedOf(f.to, texts.b);
        const c = yield* verifiedOf(g.to, texts.c);
        const composite = Result.getOrThrow(LocatorMap.compose(f, g));
        const first = yield* reanchor(anchored, f, b);
        const direct = yield* reanchor(anchored, composite, c);
        expect(direct.from).toBe(first.from);
        if (!isMapped(first)) {
          return;
        }
        const second = yield* reanchor(first.to, g, c);
        const firstTarget = yield* mintOccurrenceId(first.to);
        expect(second.from).toBe(firstTarget);
        if (isMapped(second) && isMapped(direct)) {
          // The stepwise range is inside the composite range.
          expect(rangeOf(direct).start).toBeLessThanOrEqual(rangeOf(second).start);
          expect(rangeOf(second).end).toBeLessThanOrEqual(rangeOf(direct).end);
        }
        if (Reanchoring.guards.Exact(first) && Reanchoring.guards.Exact(second)) {
          expect(direct).toEqual(Reanchoring.cases.Exact.make({ from: first.from, to: second.to }));
        }
      }),
    runs
  );

  it.effect.prop(
    "L1-3 the identity map gives Exact with the same id",
    [anchoredCase],
    ([{ text, source, anchored }]) =>
      Effect.gen(function* () {
        const target = yield* verifiedOf(source, text);
        const outcome = yield* reanchor(anchored, LocatorMap.identity(source, Str.length(text)), target);
        expect(Reanchoring.guards.Exact(outcome)).toBe(true);
        if (isMapped(outcome)) {
          const id = yield* mintOccurrenceId(outcome.to);
          expect(outcome.to).toEqual(anchored);
          expect(id).toBe(outcome.from);
        }
      }),
    runs
  );

  it.effect.prop(
    "L1-3 on Exact the target quote is the normalization of the source quote",
    [normalizationCase],
    ([{ text, range }]) =>
      Effect.gen(function* () {
        const from = capture("a", text);
        const anchored = anchoredOn(from, text, range);
        const quote = Anchored.quote(anchored);
        for (const normalization of TextNormalization.literals) {
          const { map, to, text: targetText } = normalizationMap(from, text, normalization);
          const target = yield* verifiedOf(to, targetText);
          const outcome = yield* reanchor(anchored, map, target);
          // A normalization map has no gap, so an occurrence always maps.
          expect(isMapped(outcome)).toBe(true);
          if (Reanchoring.guards.Exact(outcome)) {
            expect(Anchored.quote(outcome.to)).toBe(normalizeText(quote, normalization).text);
          }
        }
        // De-hyphenation after NFKC, through the composite map.
        const nfkc = normalizationMap(from, text, "nfkc");
        const dehyphenated = normalizationMap(nfkc.to, nfkc.text, "dehyphenate");
        const composite = Result.getOrThrow(LocatorMap.compose(nfkc.map, dehyphenated.map));
        const target = yield* verifiedOf(dehyphenated.to, dehyphenated.text);
        const outcome = yield* reanchor(anchored, composite, target);
        expect(isMapped(outcome)).toBe(true);
        if (Reanchoring.guards.Exact(outcome)) {
          expect(Anchored.quote(outcome.to)).toBe(normalizeQuote(quote, "nfkc-dehyphenate/v1"));
        }
      }),
    runs
  );

  it.effect(
    "L1-3 NFKC fixtures map exactly on cluster edges and widen inside a cluster",
    Effect.fnUntraced(function* () {
      yield* expectMapped(throughNormalization("ﬁnal ①", "nfkc", 0, 6), "Exact", "final 1");
      yield* expectMapped(throughNormalization("ﬁnal ①", "nfkc", 1, 5), "Exact", "nal ");
      yield* expectMapped(throughNormalization("ﬁnal ①", "nfkc", 0, 1), "Exact", "fi");
      yield* expectMapped(throughNormalization("ﬁnal ①", "nfkc", 5, 6), "Exact", "1");
      yield* expectMapped(throughNormalization("é", "nfkc", 0, 1), "Exact", "é");
      yield* expectMapped(throughNormalization("é", "nfkc", 0, 2), "Exact", "é");
      yield* expectMapped(throughNormalization("é", "nfkc", 0, 1), "Widened", "é");
      yield* expectMapped(throughNormalization("ㄱㅏ", "nfkc", 0, 2), "Exact", "가");
      yield* expectMapped(throughNormalization("ㄱㅏ", "nfkc", 0, 1), "Widened", "가");
      // 𝒳 is two UTF-16 units and becomes the one unit X.
      const script = yield* expectMapped(throughNormalization("𝒳", "nfkc", 0, 2), "Exact", "X");
      expect(isMapped(script) && rangeOf(script)).toEqual(at(0, 1));
      // Z, U+FF9E, U+0323 is one cluster, so a range of the Z alone widens to all of it.
      yield* expectMapped(throughNormalization("Zﾞ̣", "nfkc", 0, 1), "Widened", "Ẓ゙");
      yield* expectMapped(throughNormalization("Zﾞ̣", "nfkc", 0, 3), "Exact", "Ẓ゙");
    })
  );

  it.effect(
    "L1-3 de-hyphenation fixtures map a whole word exactly and widen a cut before the lookahead letter",
    Effect.fnUntraced(function* () {
      yield* expectMapped(throughNormalization("exam-\nple", "dehyphenate", 0, 9), "Exact", "example");
      for (const end of [4, 5, 6]) {
        yield* expectMapped(throughNormalization("exam-\nple", "dehyphenate", 0, end), "Widened", "examp");
      }
      expect(normalizeText("a-\nb-\nc", "dehyphenate").segments).toEqual([rewritten(at(0, 7), at(0, 3))]);
      yield* expectMapped(throughNormalization("a-\nb-\nc", "dehyphenate", 3, 4), "Widened", "abc");
    })
  );

  it.effect(
    "L1-3 inserted target text widens, and gaps, wrong captures and tampered targets do not map",
    Effect.fnUntraced(function* () {
      const around = [kept(at(0, 1), at(0, 1)), kept(at(1, 2), at(2, 3))];
      yield* expectMapped(throughSegments("ab", "aXb", around, 0, 2), "Widened", "aXb");
      yield* expectMapped(throughSegments("ab", "aXb", around, 0, 1), "Exact", "a");
      const gapped = [kept(at(0, 1), at(0, 1))];
      yield* expectUnmapped(throughSegments("ab", "a", gapped, 0, 2), "outside-map");
      yield* expectUnmapped(throughSegments("ab", "a", gapped, 1, 2), "outside-map");
      // A gap between two segments: the deleted b is outside the map, so a range over it does not map, while the
      // ranges on either side of it still map exactly.
      const deleted = [kept(at(0, 1), at(0, 1)), kept(at(2, 3), at(1, 2))];
      yield* expectUnmapped(throughSegments("abc", "ac", deleted, 0, 3), "outside-map");
      yield* expectUnmapped(throughSegments("abc", "ac", deleted, 1, 3), "outside-map");
      yield* expectMapped(throughSegments("abc", "ac", deleted, 0, 1), "Exact", "a");
      yield* expectMapped(throughSegments("abc", "ac", deleted, 2, 3), "Exact", "c");
      const tampered = [kept(at(0, 3), at(0, 3))];
      yield* expectUnmapped(throughSegments("abc", "abd", tampered, 0, 3), "quote-mismatch");
      yield* expectMapped(throughSegments("abc", "abd", tampered, 0, 2), "Exact", "ab");

      const a = capture("a", "ab");
      const b = capture("b", "ab");
      const other = capture("other", "ab");
      const map = LocatorMap.make({ from: a, to: b, segments: LocatorMap.identity(a, 2).segments });
      const anchored = anchoredOn(a, "ab", { start: 0, end: 2 });
      const stray = anchoredOn(other, "ab", { start: 0, end: 2 });
      const target = yield* verifiedOf(b, "ab");
      const otherTarget = yield* verifiedOf(other, "ab");
      const strayId = yield* mintOccurrenceId(stray);
      const unmapped = yield* expectUnmapped(reanchor(stray, map, target), "capture-mismatch");
      expect(unmapped.from).toBe(strayId);
      yield* expectUnmapped(reanchor(anchored, map, otherTarget), "capture-mismatch");
      yield* expectMapped(reanchor(anchored, map, target), "Exact", "ab");
    })
  );

  it.effect(
    "L1-3 a composite rewrite absorbs text the second step inserted inside the first step's rewrite",
    Effect.fnUntraced(function* () {
      // ab is rewritten to xy as a whole, then _ is inserted between x and y. The middle offset 1 has no preimage
      // in ab, so the composite is one rewrite of ab to x_y: Exact through it, Widened stepwise, one range.
      const a = capture("a", "ab");
      const b = capture("b", "xy");
      const c = capture("c", "x_y");
      const f = LocatorMap.make({ from: a, to: b, segments: [rewritten(at(0, 2), at(0, 2))] });
      const g = LocatorMap.make({ from: b, to: c, segments: [kept(at(0, 1), at(0, 1)), kept(at(1, 2), at(2, 3))] });
      const composite = Result.getOrThrow(LocatorMap.compose(f, g));
      expect(composite.segments).toEqual([rewritten(at(0, 2), at(0, 3))]);
      const anchored = anchoredOn(a, "ab", { start: 0, end: 2 });
      const middle = yield* verifiedOf(b, "xy");
      const target = yield* verifiedOf(c, "x_y");
      const first = yield* expectMapped(reanchor(anchored, f, middle), "Exact", "xy");
      const direct = yield* expectMapped(reanchor(anchored, composite, target), "Exact", "x_y");
      if (isMapped(first) && isMapped(direct)) {
        const second = yield* expectMapped(reanchor(first.to, g, target), "Widened", "x_y");
        expect(isMapped(second) && rangeOf(second)).toEqual(rangeOf(direct));
      }
    })
  );

  it.effect(
    "L1-3 a target range that splits a scalar or runs past the target text does not map",
    Effect.fnUntraced(function* () {
      const halves = [rewritten(at(0, 1), at(0, 1)), rewritten(at(1, 2), at(1, 3))];
      yield* expectUnmapped(throughSegments("xy", "😀c", halves, 0, 1), "split-boundary");
      yield* expectMapped(throughSegments("xy", "😀c", halves, 0, 2), "Exact", "😀c");
      const past = [rewritten(at(0, 2), at(0, 5))];
      yield* expectUnmapped(throughSegments("ab", "a", past, 0, 2), "split-boundary");
    })
  );
});
