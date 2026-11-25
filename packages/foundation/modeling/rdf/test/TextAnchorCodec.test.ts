import { IRIReference } from "@beep/identity/Iri";
import {
  textAnchorToWebAnnotationTarget,
  WebAnnotation,
  WebAnnotationTarget,
  webAnnotationTargetToTextAnchor,
} from "@beep/rdf/Adapters/WebAnnotation";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { TextAnchor } from "@beep/text/TextAnchor";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import { flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type {
  WebAnnotationAnchorRefusal,
  WebAnnotationAnchorRefused,
  WebAnnotationSelector,
} from "@beep/rdf/Adapters/WebAnnotation";

const SOURCE = Result.getOrThrow(S.decodeResult(IRIReference)("https://example.org/document"));
const ASTRAL = "A😀B";

const decodeTarget = flow(S.decodeResult(WebAnnotationTarget), Result.getOrThrow);
const encodeTarget = flow(S.encodeResult(WebAnnotationTarget), Result.getOrThrow);

const targetOf = (...selector: ReadonlyArray<typeof WebAnnotationSelector.Encoded>) =>
  decodeTarget({ source: SOURCE, selector });

const encodeOver = (anchor: TextAnchor, sourceText: string) =>
  textAnchorToWebAnnotationTarget(anchor, { source: SOURCE, sourceText });

const refusalOf = <A>(result: Result.Result<A, WebAnnotationAnchorRefused>): O.Option<WebAnnotationAnchorRefusal> =>
  O.map(Result.getFailure(result), (refused) => refused.reason);

const assertRefused = <A>(result: Result.Result<A, WebAnnotationAnchorRefused>, reason: WebAnnotationAnchorRefusal) =>
  assertSome(refusalOf(result), reason);

const anchorOf = (startChar: number, endChar: number, quote: string) => TextAnchor.make({ startChar, endChar, quote });

const position = (start: number, end: number) => ({ type: "TextPositionSelector", start, end }) as const;

const quote = (exact: string, context: { readonly prefix?: string; readonly suffix?: string } = {}) =>
  ({ type: "TextQuoteSelector", exact, ...context }) as const;

const FRAGMENT = { type: "FragmentSelector", value: "section-1" } as const;

const PrintableBmpOrAstralEmojiPick = S.Int.check(S.isBetween({ minimum: 0x20, maximum: 0x2fff + 64 }));

const toCodePoint = (pick: number): number => (pick > 0x2fff ? 0x1f600 + (pick - 0x3000) : pick);

const between = (minimum: number, maximum: number) => Arbitrary.schema(S.Int.check(S.isBetween({ minimum, maximum })));

const anchorCase = Arbitrary.flatMap(
  Arbitrary.array(Arbitrary.schema(PrintableBmpOrAstralEmojiPick), { minLength: 1, maxLength: 40 }),
  (picks) => {
    const codePoints = A.map(picks, toCodePoint);
    const utf16 = A.scan(codePoints, 0, (offset, codePoint) => offset + (codePoint > 0xffff ? 2 : 1));
    const text = A.join(
      A.map(codePoints, (codePoint) => String.fromCodePoint(codePoint)),
      ""
    );
    return Arbitrary.flatMap(between(0, codePoints.length - 1), (first) =>
      Arbitrary.map(between(first + 1, codePoints.length), (last) => {
        const startChar = A.getUnsafe(utf16, first);
        const endChar = A.getUnsafe(utf16, last);
        return {
          text,
          points: { start: first, end: last },
          anchor: anchorOf(startChar, endChar, Str.slice(startChar, endChar)(text)),
        };
      })
    );
  }
);

const runs = { arbitrary: fcRuns(100) };

describe("@beep/rdf TextAnchor and Web Annotation codec", () => {
  it.prop(
    "P2-OA decoding an encoded anchor gives the anchor back",
    [anchorCase],
    ([{ text, points, anchor }]) => {
      const target = Result.getOrThrow(encodeOver(anchor, text));
      expect(encodeTarget(target).selector).toEqual([position(points.start, points.end), quote(anchor.quote)]);
      expect(Result.getOrThrow(webAnnotationTargetToTextAnchor(target, text))).toEqual(anchor);
    },
    runs
  );

  it("P2-OA wire offsets are code points for an anchor after an astral character", () => {
    const anchor = anchorOf(3, 4, "B");
    const target = Result.getOrThrow(encodeOver(anchor, ASTRAL));
    expect(encodeTarget(target)).toEqual({ source: SOURCE, selector: [position(2, 3), quote("B")] });
    expect(Result.getOrThrow(webAnnotationTargetToTextAnchor(target, ASTRAL))).toEqual(anchor);
  });

  it("P2-OA an anchor that splits a surrogate pair is refused on encode", () => {
    assertRefused(encodeOver(anchorOf(1, 2, "\ud83d"), ASTRAL), "split-boundary");
  });

  it("P2-OA wire offsets past the text and empty wire ranges are refused", () => {
    assertRefused(webAnnotationTargetToTextAnchor(targetOf(position(9, 12)), ASTRAL), "out-of-range");
    assertRefused(webAnnotationTargetToTextAnchor(targetOf(position(2, 2)), ASTRAL), "empty-range");
  });

  it("P2-OA a position-only target takes its quote from the text", () => {
    const anchor = pipe(targetOf(position(4, 9)), webAnnotationTargetToTextAnchor("The quick brown fox"));
    expect(Result.getOrThrow(anchor)).toEqual(anchorOf(4, 9, "quick"));
  });

  it("P2-OA a quote-only target decodes only when it resolves uniquely", () => {
    const text = "alpha beta alpha";
    const decode = (selector: ReturnType<typeof quote>) => webAnnotationTargetToTextAnchor(targetOf(selector), text);
    expect(Result.getOrThrow(decode(quote("beta")))).toEqual(anchorOf(6, 10, "beta"));
    assertRefused(decode(quote("alpha")), "ambiguous");
    assertRefused(decode(quote("gamma")), "not-found");
    expect(Result.getOrThrow(decode(quote("alpha", { prefix: "beta " })))).toEqual(anchorOf(11, 16, "alpha"));
  });

  it("P2-OA disagreeing selectors are refused", () => {
    const decode = (...selectors: ReadonlyArray<typeof WebAnnotationSelector.Encoded>) =>
      webAnnotationTargetToTextAnchor(targetOf(...selectors), ASTRAL);
    assertRefused(decode(position(0, 1), quote("B")), "selector-conflict");
    assertRefused(decode(position(0, 1), position(2, 3)), "selector-conflict");
    assertRefused(decode(quote("A"), quote("B")), "selector-conflict");
    assertRefused(decode(position(2, 3), quote("B", { prefix: "A" })), "selector-conflict");
    assertRefused(decode(position(2, 3), quote("B", { suffix: "!" })), "selector-conflict");
  });

  it("P2-OA repeated selectors that agree decode to one anchor", () => {
    const anchor = anchorOf(3, 4, "B");
    expect(
      Result.getOrThrow(
        webAnnotationTargetToTextAnchor(targetOf(position(2, 3), position(2, 3), quote("B", { prefix: "😀" })), ASTRAL)
      )
    ).toEqual(anchor);
    const text = "x ab y ab z";
    expect(
      Result.getOrThrow(
        webAnnotationTargetToTextAnchor(targetOf(quote("ab", { prefix: "x " }), quote("ab", { suffix: " y" })), text)
      )
    ).toEqual(anchorOf(2, 4, "ab"));
  });

  it.prop(
    "P2-OA re-encoding a decoded target keeps the anchor and writes both selectors",
    [anchorCase],
    ([{ text, points, anchor }]) => {
      const before = Str.slice(0, anchor.startChar)(text);
      const after = Str.slice(anchor.endChar)(text);
      const wirePosition = position(points.start, points.end);
      const positionOnlyGainsQuote = targetOf(wirePosition);
      const quoteUniqueByWholeTextContextDropsContext = targetOf(
        quote(anchor.quote, { prefix: before, suffix: after })
      );
      const fragmentAndContextBesidePositionAreDropped = targetOf(
        FRAGMENT,
        wirePosition,
        quote(anchor.quote, { prefix: before, suffix: after })
      );
      const targets = [
        positionOnlyGainsQuote,
        quoteUniqueByWholeTextContextDropsContext,
        fragmentAndContextBesidePositionAreDropped,
      ];
      for (const target of targets) {
        const decoded = Result.getOrThrow(webAnnotationTargetToTextAnchor(target, text));
        expect(decoded).toEqual(anchor);
        const reencoded = Result.getOrThrow(encodeOver(decoded, text));
        expect(encodeTarget(reencoded).selector).toEqual([wirePosition, quote(anchor.quote)]);
        expect(Result.getOrThrow(webAnnotationTargetToTextAnchor(reencoded, text))).toEqual(decoded);
      }
    },
    runs
  );

  it("P2-OA re-encoding a context-free quote-only target adds its position", () => {
    const decoded = Result.getOrThrow(webAnnotationTargetToTextAnchor(targetOf(quote("B")), ASTRAL));
    const reencoded = Result.getOrThrow(encodeOver(decoded, ASTRAL));
    expect(encodeTarget(reencoded).selector).toEqual([position(2, 3), quote("B")]);
  });

  it("P2-OA a single-selector annotation keeps its wire bytes", () => {
    const json =
      '{"id":"https://example.com/annotations/1","type":"Annotation","target":{"source":"https://example.com/documents/1","selector":{"type":"TextQuoteSelector","exact":"Alice"}}}';
    const codec = S.fromJsonString(WebAnnotation);
    const annotation = Result.getOrThrow(S.decodeResult(codec)(json));
    expect(A.map(annotation.target.selector, (selector) => selector.type)).toEqual(["TextQuoteSelector"]);
    expect(Result.getOrThrow(S.encodeResult(codec)(annotation))).toBe(json);
  });

  it("P2-OA ill-formed text, a misquoted anchor and a target without a text selector are refused", () => {
    assertRefused(encodeOver(anchorOf(1, 2, "A"), "\ud800AB"), "ill-formed-text");
    assertRefused(encodeOver(anchorOf(0, 1, "B"), ASTRAL), "selector-conflict");
    assertRefused(webAnnotationTargetToTextAnchor(targetOf(quote("B")), "\ud800 B"), "ill-formed-text");
    assertRefused(webAnnotationTargetToTextAnchor(targetOf(FRAGMENT), ASTRAL), "no-text-selector");
    expect(Result.getOrThrow(webAnnotationTargetToTextAnchor(targetOf(FRAGMENT, quote("B")), ASTRAL))).toEqual(
      anchorOf(3, 4, "B")
    );
  });
});
