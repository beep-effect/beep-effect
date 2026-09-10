import {
  pageSourceText,
  pageSourceTextContainingOffset,
  ResolvedSourceText,
  SOURCE_TEXT_PAGE_CODE_UNITS,
  SourceTextPage,
  SourceTextResolverError,
} from "@beep/file-processing/SourceText";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { NonNegativeInt } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import * as Str from "effect/String";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeUnknownSourceTextPageResult = S.decodeUnknownResult(SourceTextPage);

const emptyDigest = SourceTextDigest.make("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
const identity = SourceTextIdentity.make({
  extractor: SourceTextExtractor.make({ name: "fixture", version: "1" }),
  locator: PosixPath.make("fixtures/source.txt"),
  normalizationVersion: "1",
  scopeRef: "workspace:1",
  sourceDigest: emptyDigest,
  sourceRef: "source:fixture",
  textDigest: emptyDigest,
});

describe("@beep/file-processing SourceText", () => {
  it.effect(
    "moves a nominal page boundary back rather than splitting a surrogate pair",
    Effect.fnUntraced(function* () {
      const prefix = Str.repeat(SOURCE_TEXT_PAGE_CODE_UNITS - 1)("a");
      const text = `${prefix}😀z`;
      const source = ResolvedSourceText.make({ identity, text });
      const first = yield* pageSourceText(source, NonNegativeInt.make(0));
      const second = yield* pageSourceText(source, NonNegativeInt.make(1));

      expect(first.endOffset).toBe(SOURCE_TEXT_PAGE_CODE_UNITS - 1);
      expect(second.startOffset).toBe(first.endOffset);
      expect(first.text).toBe(prefix);
      expect(second.text).toBe("😀z");
      expect(`${first.text}${second.text}`).toBe(text);
      expect(first.hasNextPage).toBe(true);
      expect(second.hasPreviousPage).toBe(true);

      const containing = yield* pageSourceTextContainingOffset(
        source,
        NonNegativeInt.make(SOURCE_TEXT_PAGE_CODE_UNITS - 1)
      );
      expect(containing.pageIndex).toBe(1);
      expect(containing.startOffset).toBe(SOURCE_TEXT_PAGE_CODE_UNITS - 1);
      expect(containing.text).toBe("😀z");
    })
  );

  it.effect(
    "keeps every page within the code-unit cap after a shifted boundary",
    Effect.fnUntraced(function* () {
      const prefix = Str.repeat(SOURCE_TEXT_PAGE_CODE_UNITS - 1)("a");
      const suffix = Str.repeat(SOURCE_TEXT_PAGE_CODE_UNITS)("b");
      const text = `${prefix}😀${suffix}`;
      const source = ResolvedSourceText.make({ identity, text });
      const first = yield* pageSourceText(source, NonNegativeInt.make(0));
      const second = yield* pageSourceText(source, NonNegativeInt.make(1));
      const third = yield* pageSourceText(source, NonNegativeInt.make(2));

      expect(Str.length(first.text)).toBeLessThanOrEqual(SOURCE_TEXT_PAGE_CODE_UNITS);
      expect(Str.length(second.text)).toBeLessThanOrEqual(SOURCE_TEXT_PAGE_CODE_UNITS);
      expect(Str.length(third.text)).toBeLessThanOrEqual(SOURCE_TEXT_PAGE_CODE_UNITS);
      expect(`${first.text}${second.text}${third.text}`).toBe(text);
      expect(third.pageCount).toBe(3);
    })
  );

  it.effect(
    "exposes one empty page and fails closed for an unavailable page",
    Effect.fnUntraced(function* () {
      const source = ResolvedSourceText.make({ identity, text: "" });
      const first = yield* pageSourceText(source, NonNegativeInt.make(0));
      const missing = yield* Effect.result(pageSourceText(source, NonNegativeInt.make(1)));

      expect(first).toMatchObject({
        endOffset: 0,
        pageCount: 1,
        startOffset: 0,
        text: "",
        totalCodeUnits: 0,
      });
      expect(Result.isFailure(missing)).toBe(true);
      if (Result.isFailure(missing)) {
        expect(missing.failure).toBeInstanceOf(SourceTextResolverError);
        expect(missing.failure.reason).toBe("page-out-of-range");
      }
    })
  );

  it("rejects impossible page relationships", () => {
    const validPage = {
      endOffset: 5,
      hasNextPage: true,
      hasPreviousPage: false,
      identity,
      pageCount: 2,
      pageIndex: 0,
      pageSizeCodeUnits: SOURCE_TEXT_PAGE_CODE_UNITS,
      startOffset: 0,
      text: "hello",
      totalCodeUnits: 10,
    };

    expect(Result.isSuccess(decodeUnknownSourceTextPageResult(validPage))).toBe(true);
    expect(Result.isFailure(decodeUnknownSourceTextPageResult({ ...validPage, pageIndex: 2 }))).toBe(true);
    expect(Result.isFailure(decodeUnknownSourceTextPageResult({ ...validPage, startOffset: 6 }))).toBe(true);
    expect(Result.isFailure(decodeUnknownSourceTextPageResult({ ...validPage, endOffset: 11 }))).toBe(true);
    expect(Result.isFailure(decodeUnknownSourceTextPageResult({ ...validPage, text: "four" }))).toBe(true);
    expect(Result.isFailure(decodeUnknownSourceTextPageResult({ ...validPage, hasPreviousPage: true }))).toBe(true);
    expect(Result.isFailure(decodeUnknownSourceTextPageResult({ ...validPage, hasNextPage: false }))).toBe(true);
  });

  it("derives only relationally valid source-text pages", () =>
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([Arbitrary.schema(SourceTextPage)]),
          ([page]) => {
            expect(page.pageIndex).toBeLessThan(page.pageCount);
            expect(page.startOffset).toBeLessThanOrEqual(page.endOffset);
            expect(page.endOffset).toBeLessThanOrEqual(page.totalCodeUnits);
            expect(page.endOffset - page.startOffset).toBe(Str.length(page.text));
            expect(page.hasPreviousPage).toBe(page.pageIndex > 0);
            expect(page.hasNextPage).toBe(page.pageIndex + 1 < page.pageCount);

            return true;
          },
          fcRuns(50)
        )
      )._tag
    ).toBe("Passed"));
});

// The arbitrary compiler consumes decode only; verify the advertised encoding separately.
const sourceTextPageLinkCodec = (() => {
  const annotations: S.Annotations.Declaration<unknown, []> | undefined = SchemaAST.toType(
    SourceTextPage.ast
  ).annotations;
  const link = annotations?.toCodecArbitrary?.({ typeParameters: [], constraint: undefined });
  if (link === undefined || link.transformation._tag !== "Transformation")
    throw new Error("Missing generation transformation");
  return S.make<S.Codec<SourceTextPage, unknown>>(
    SchemaAST.decodeTo(link.to, SchemaAST.toType(SourceTextPage.ast), link.transformation)
  );
})();
const encodeSourceTextPageLink = S.encodeEffect(sourceTextPageLinkCodec);
const encodeSourceTextIdentity = S.encodeEffect(SourceTextIdentity);

it.effect("encodes SourceTextPage through its generation link", () =>
  Effect.gen(function* () {
    const result = yield* Arbitrary.checkEffect(
      Arbitrary.schema(SourceTextPage),
      (page) =>
        Effect.gen(function* () {
          const encoded = yield* encodeSourceTextPageLink(page);
          expect(encoded).toEqual({
            identity: yield* encodeSourceTextIdentity(page.identity),
            pageCount: page.pageCount,
            pageIndex: page.pageIndex,
            startOffset: page.startOffset,
            text: page.text,
          });
          return true;
        }),
      fcRuns(50)
    );
    expect(result._tag).toBe("Passed");
  })
);
