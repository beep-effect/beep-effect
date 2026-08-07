/**
 * Runtime-neutral contracts for resolving and paging canonical source text.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FileProcessingId } from "@beep/identity";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { LiteralKit, NonNegativeInt, PosInt, TaggedErrorClass } from "@beep/schema";
import { Context, Effect, identity, Number as N } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $FileProcessingId.create("SourceText");
const isHighSurrogate = N.between({ minimum: 0xd800, maximum: 0xdbff });
const isLowSurrogate = N.between({ minimum: 0xdc00, maximum: 0xdfff });

/**
 * Number of UTF-16 code units in each nominal source-text page.
 *
 * **Details**
 *
 * Page boundaries move back by one code unit when the nominal boundary would
 * split a surrogate pair.
 *
 * **Example** (Compute nominal page count)
 *
 * ```ts
 * import { SOURCE_TEXT_PAGE_CODE_UNITS } from "@beep/file-processing/SourceText"
 *
 * const sourceCodeUnits = SOURCE_TEXT_PAGE_CODE_UNITS * 2 + 1
 * const nominalPageCount = Math.ceil(sourceCodeUnits / SOURCE_TEXT_PAGE_CODE_UNITS)
 * console.log(nominalPageCount) // 3
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SOURCE_TEXT_PAGE_CODE_UNITS = 65_536;

/**
 * Stable extractor name for canonical UTF-8 text and Markdown sources.
 *
 * **Example** (Build extractor identity string)
 *
 * ```ts
 * import {
 *   UTF8_SOURCE_TEXT_EXTRACTOR_NAME,
 *   UTF8_SOURCE_TEXT_EXTRACTOR_VERSION
 * } from "@beep/file-processing/SourceText"
 *
 * const extractorIdentity =
 *   `${UTF8_SOURCE_TEXT_EXTRACTOR_NAME}@${UTF8_SOURCE_TEXT_EXTRACTOR_VERSION}`
 * console.log(extractorIdentity) // "utf8@1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const UTF8_SOURCE_TEXT_EXTRACTOR_NAME = "utf8";

/**
 * Version of the strict UTF-8 decoding contract used for source text.
 *
 * **Example** (Build extractor identity string)
 *
 * ```ts
 * import {
 *   UTF8_SOURCE_TEXT_EXTRACTOR_NAME,
 *   UTF8_SOURCE_TEXT_EXTRACTOR_VERSION
 * } from "@beep/file-processing/SourceText"
 *
 * const extractorIdentity =
 *   `${UTF8_SOURCE_TEXT_EXTRACTOR_NAME}@${UTF8_SOURCE_TEXT_EXTRACTOR_VERSION}`
 * console.log(extractorIdentity) // "utf8@1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const UTF8_SOURCE_TEXT_EXTRACTOR_VERSION = "1";

/**
 * Failure reasons exposed by source-text resolution and paging.
 *
 * **Example** (Check reason membership)
 *
 * ```ts
 * import { SourceTextResolverErrorReason } from "@beep/file-processing/SourceText"
 *
 * console.log(SourceTextResolverErrorReason.is["source-digest-mismatch"]("source-digest-mismatch")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SourceTextResolverErrorReason = LiteralKit([
  "scope-unavailable",
  "locator-invalid",
  "source-unavailable",
  "source-digest-mismatch",
  "extractor-unavailable",
  "extraction-failed",
  "text-unavailable",
  "text-digest-mismatch",
  "page-out-of-range",
]).pipe(
  $I.annoteSchema("SourceTextResolverErrorReason", {
    description: "Fail-closed reasons emitted while resolving or paging canonical source text.",
  })
);

/**
 * Type for {@link SourceTextResolverErrorReason}.
 *
 * **Example** (Type a failure reason)
 *
 * ```ts
 * import type { SourceTextResolverErrorReason } from "@beep/file-processing/SourceText"
 *
 * const reason: SourceTextResolverErrorReason = "locator-invalid"
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type SourceTextResolverErrorReason = typeof SourceTextResolverErrorReason.Type;

/**
 * Typed, fail-closed source-text resolution failure.
 *
 * **Example** (Create source-unavailable error)
 *
 * ```ts
 * import { SourceTextResolverError } from "@beep/file-processing/SourceText"
 *
 * const error = SourceTextResolverError.new("source-unavailable", "The source file could not be read.")
 * console.log(error.reason) // "source-unavailable"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SourceTextResolverError extends TaggedErrorClass<SourceTextResolverError>($I`SourceTextResolverError`)(
  "SourceTextResolverError",
  {
    cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true })),
    message: S.NonEmptyString,
    reason: SourceTextResolverErrorReason,
  },
  $I.annote("SourceTextResolverError", {
    description: "Typed, fail-closed failure emitted by canonical source-text resolution or paging.",
  })
) {
  /**
   * Construct a source-text resolver failure.
   *
   * **Example** (Create page-out-of-range error)
   *
   * ```ts
   * import { SourceTextResolverError } from "@beep/file-processing/SourceText"
   *
   * const error = SourceTextResolverError.new("page-out-of-range", "Page 2 does not exist.")
   * console.log(error._tag) // "SourceTextResolverError"
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly new = (
    reason: SourceTextResolverErrorReason,
    message: string,
    cause?: unknown
  ): SourceTextResolverError =>
    SourceTextResolverError.make({
      cause: O.fromUndefinedOr(cause),
      message,
      reason,
    });
}

/**
 * Request to resolve the complete canonical text pinned by a provenance identity.
 *
 * **Example** (Inspect identity field)
 *
 * ```ts
 * import { ResolveSourceTextRequest } from "@beep/file-processing/SourceText"
 *
 * console.log(ResolveSourceTextRequest.fields.identity)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResolveSourceTextRequest extends S.Class<ResolveSourceTextRequest>($I`ResolveSourceTextRequest`)(
  {
    identity: SourceTextIdentity,
  },
  $I.annote("ResolveSourceTextRequest", {
    description: "Request to resolve complete canonical text from an immutable provenance source identity.",
  })
) {}

/**
 * Complete canonical source text retained inside the server boundary.
 *
 * **Example** (Inspect text field)
 *
 * ```ts
 * import { ResolvedSourceText } from "@beep/file-processing/SourceText"
 *
 * console.log(ResolvedSourceText.fields.text)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResolvedSourceText extends S.Class<ResolvedSourceText>($I`ResolvedSourceText`)(
  {
    identity: SourceTextIdentity,
    text: S.String,
  },
  $I.annote("ResolvedSourceText", {
    description: "Complete canonical source text whose source, extractor, and text digests have been verified.",
  })
) {}

class SourceTextPageStruct extends S.Class<SourceTextPageStruct>($I`SourceTextPageStruct`)(
  {
    endOffset: NonNegativeInt,
    hasNextPage: S.Boolean,
    hasPreviousPage: S.Boolean,
    identity: SourceTextIdentity,
    pageCount: PosInt,
    pageIndex: NonNegativeInt,
    pageSizeCodeUnits: S.Literal(SOURCE_TEXT_PAGE_CODE_UNITS),
    startOffset: NonNegativeInt,
    text: S.String,
    totalCodeUnits: NonNegativeInt,
  },
  $I.annote("SourceTextPageStruct", {
    description: "Structural base for a bounded canonical source-text page.",
  })
) {}

const SourceTextPageChecks = S.makeFilterGroup([
  S.makeFilter(({ pageCount, pageIndex }: SourceTextPageStruct) => pageIndex < pageCount, {
    identifier: $I`SourceTextPageIndexCheck`,
    title: "Source Text Page Index",
    description: "Checks that a zero-based page index identifies a page within the declared page count.",
    message: "Expected pageIndex to be less than pageCount.",
  }),
  S.makeFilter(
    ({ endOffset, startOffset, totalCodeUnits }: SourceTextPageStruct) =>
      startOffset <= endOffset && endOffset <= totalCodeUnits,
    {
      identifier: $I`SourceTextPageOffsetBoundsCheck`,
      title: "Source Text Page Offset Bounds",
      description: "Checks that page offsets are ordered and bounded by the complete source width.",
      message: "Expected startOffset <= endOffset <= totalCodeUnits.",
    }
  ),
  S.makeFilter(
    ({ endOffset, startOffset, text }: SourceTextPageStruct) => endOffset - startOffset === Str.length(text),
    {
      identifier: $I`SourceTextPageTextWidthCheck`,
      title: "Source Text Page Width",
      description: "Checks that the page's absolute half-open range has the same UTF-16 width as its text.",
      message: "Expected endOffset - startOffset to equal the page text's UTF-16 code-unit length.",
    }
  ),
  S.makeFilter(({ hasPreviousPage, pageIndex }: SourceTextPageStruct) => hasPreviousPage === pageIndex > 0, {
    identifier: $I`SourceTextPagePreviousFlagCheck`,
    title: "Source Text Page Previous Flag",
    description: "Checks that hasPreviousPage agrees with the zero-based page index.",
    message: "Expected hasPreviousPage to be true exactly when pageIndex is greater than zero.",
  }),
  S.makeFilter(
    ({ hasNextPage, pageCount, pageIndex }: SourceTextPageStruct) => hasNextPage === pageIndex + 1 < pageCount,
    {
      identifier: $I`SourceTextPageNextFlagCheck`,
      title: "Source Text Page Next Flag",
      description: "Checks that hasNextPage agrees with the declared final page.",
      message: "Expected hasNextPage to be true exactly when another page remains.",
    }
  ),
]);

const sourceTextIdentityArbitrary = S.toArbitraryLazy(SourceTextIdentity);

const SourceTextPageSchema = SourceTextPageStruct.mapFields(identity)
  .check(SourceTextPageChecks)
  .annotate({
    toArbitrary: () => (fc) =>
      fc
        .tuple(
          sourceTextIdentityArbitrary(fc),
          fc.integer({ min: 1, max: 32 }),
          fc.nat(10_000),
          fc.nat(10_000),
          fc.string({ maxLength: 256 }),
          fc.nat(10_000)
        )
        .map(([identity, pageCount, pageIndexSeed, startOffset, text, trailingCodeUnits]) => {
          const pageIndex = pageIndexSeed % pageCount;
          const endOffset = startOffset + Str.length(text);
          return SourceTextPageStruct.make({
            endOffset: NonNegativeInt.make(endOffset),
            hasNextPage: pageIndex + 1 < pageCount,
            hasPreviousPage: pageIndex > 0,
            identity,
            pageCount: PosInt.make(pageCount),
            pageIndex: NonNegativeInt.make(pageIndex),
            pageSizeCodeUnits: SOURCE_TEXT_PAGE_CODE_UNITS,
            startOffset: NonNegativeInt.make(startOffset),
            text,
            totalCodeUnits: NonNegativeInt.make(endOffset + trailingCodeUnits),
          });
        }),
  });

/**
 * Bounded, surrogate-safe page from a complete canonical source.
 *
 * **Details**
 *
 * Offsets are absolute half-open UTF-16 code-unit offsets into the complete
 * canonical text. Adjacent pages are contiguous even when a nominal boundary
 * must move to avoid splitting a surrogate pair.
 *
 * **Example** (Inspect startOffset field)
 *
 * ```ts
 * import { SourceTextPage } from "@beep/file-processing/SourceText"
 *
 * console.log(SourceTextPage.fields.startOffset)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SourceTextPage extends S.Class<SourceTextPage>($I`SourceTextPage`)(
  SourceTextPageSchema,
  $I.annote("SourceTextPage", {
    description: "Bounded canonical source-text page with absolute surrogate-safe UTF-16 offsets.",
  })
) {}

/**
 * Service shape implemented by authority-owning source providers.
 *
 * **Example** (Select resolver method key)
 *
 * ```ts
 * import type { SourceTextResolverShape } from "@beep/file-processing/SourceText"
 *
 * type ResolverMethod = keyof SourceTextResolverShape
 * const method: ResolverMethod = "resolve"
 * console.log(method)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export interface SourceTextResolverShape {
  readonly resolve: (request: ResolveSourceTextRequest) => Effect.Effect<ResolvedSourceText, SourceTextResolverError>;
}

/**
 * Runtime-neutral port for resolving verified canonical source text.
 *
 * **Example** (Read service key)
 *
 * ```ts
 * import { SourceTextResolver } from "@beep/file-processing/SourceText"
 *
 * console.log(SourceTextResolver.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class SourceTextResolver extends Context.Service<SourceTextResolver, SourceTextResolverShape>()(
  $I`SourceTextResolver`
) {}

const safePageBoundary = (text: string, boundary: number): number => {
  const splitsSurrogatePair =
    boundary > 0 &&
    boundary < Str.length(text) &&
    O.exists(Str.charCodeAt(text, boundary - 1), isHighSurrogate) &&
    O.exists(Str.charCodeAt(text, boundary), isLowSurrogate);

  return Bool.match(splitsSurrogatePair, {
    onFalse: () => boundary,
    onTrue: () => boundary - 1,
  });
};

type SourceTextPageBound = readonly [startOffset: number, endOffset: number];

const sourceTextPageBounds = (text: string): ReadonlyArray<SourceTextPageBound> => {
  const totalCodeUnits = Str.length(text);
  return A.unfold<number, SourceTextPageBound>(0, (startOffset) => {
    if (startOffset > totalCodeUnits || (startOffset === totalCodeUnits && totalCodeUnits > 0)) {
      return O.none();
    }

    const endOffset = safePageBoundary(text, N.min(totalCodeUnits, startOffset + SOURCE_TEXT_PAGE_CODE_UNITS));
    return O.some([[startOffset, endOffset], endOffset < totalCodeUnits ? endOffset : totalCodeUnits + 1]);
  });
};

const sourceTextPageFromBounds = Effect.fn("SourceText.pageFromBounds")(function* (
  source: ResolvedSourceText,
  pageIndex: NonNegativeInt,
  pageBounds: ReadonlyArray<SourceTextPageBound>
): Effect.fn.Return<SourceTextPage, SourceTextResolverError> {
  const totalCodeUnits = Str.length(source.text);
  const pageCount = A.length(pageBounds);
  const [startOffset, endOffset] = yield* A.get(pageBounds, pageIndex).pipe(
    O.match({
      onNone: () =>
        Effect.fail(
          SourceTextResolverError.new(
            "page-out-of-range",
            `Source-text page ${pageIndex} is outside the available range 0-${pageCount - 1}.`
          )
        ),
      onSome: Effect.succeed,
    })
  );

  return SourceTextPage.make({
    endOffset: NonNegativeInt.make(endOffset),
    hasNextPage: pageIndex + 1 < pageCount,
    hasPreviousPage: pageIndex > 0,
    identity: source.identity,
    pageCount: PosInt.make(pageCount),
    pageIndex,
    pageSizeCodeUnits: SOURCE_TEXT_PAGE_CODE_UNITS,
    startOffset: NonNegativeInt.make(startOffset),
    text: Str.slice(startOffset, endOffset)(source.text),
    totalCodeUnits: NonNegativeInt.make(totalCodeUnits),
  });
});

/**
 * Slice a complete canonical source into a bounded, surrogate-safe page.
 *
 * **Gotchas**
 *
 * Empty sources have one empty page at index zero. A page index outside the
 * computed page count fails through {@link SourceTextResolverError}; text is
 * never truncated or fuzzy-relocated.
 *
 * **Example** (Load first page)
 *
 * ```ts
 * import type { ResolvedSourceText } from "@beep/file-processing/SourceText"
 * import { pageSourceText } from "@beep/file-processing/SourceText"
 * import { NonNegativeInt } from "@beep/schema"
 * import { Effect } from "effect"
 *
 * const loadFirstPage = (source: ResolvedSourceText) =>
 *   Effect.runPromise(pageSourceText(source, NonNegativeInt.make(0)))
 * ```
 *
 * @effects Performs deterministic in-memory paging only. It does not read or
 * write source storage, and fails with {@link SourceTextResolverError} when the
 * requested page is outside the canonical source.
 * @category utilities
 * @since 0.0.0
 */
export const pageSourceText = Effect.fn("SourceText.pageSourceText")(function* (
  source: ResolvedSourceText,
  pageIndex: NonNegativeInt
): Effect.fn.Return<SourceTextPage, SourceTextResolverError> {
  return yield* sourceTextPageFromBounds(source, pageIndex, sourceTextPageBounds(source.text));
});

/**
 * Locate the surrogate-safe page containing one absolute UTF-16 code-unit
 * offset.
 *
 * **Details**
 *
 * This is the authoritative way to open an anchor's first page. Nominal
 * division by {@link SOURCE_TEXT_PAGE_CODE_UNITS} is insufficient because an
 * earlier page boundary can move backward to avoid splitting a surrogate pair.
 *
 * **Example** (Load page for offset)
 *
 * ```ts
 * import {
 *   pageSourceTextContainingOffset
 * } from "@beep/file-processing/SourceText"
 * import type { ResolvedSourceText } from "@beep/file-processing/SourceText"
 * import { NonNegativeInt } from "@beep/schema"
 * import { Effect } from "effect"
 *
 * const loadPageContaining = (source: ResolvedSourceText, offset: number) =>
 *   Effect.runPromise(
 *     pageSourceTextContainingOffset(source, NonNegativeInt.make(offset))
 *   )
 * ```
 *
 * @effects Searches deterministic in-memory page bounds only. It does not read
 * or write source storage, and fails with {@link SourceTextResolverError} when
 * the offset is outside the canonical source.
 * @category utilities
 * @since 0.0.0
 */
export const pageSourceTextContainingOffset = Effect.fn("SourceText.pageSourceTextContainingOffset")(function* (
  source: ResolvedSourceText,
  offset: NonNegativeInt
): Effect.fn.Return<SourceTextPage, SourceTextResolverError> {
  const pageBounds = sourceTextPageBounds(source.text);
  const pageIndex = yield* A.findFirstIndex(
    pageBounds,
    ([startOffset, endOffset]) => N.isLessThanOrEqualTo(startOffset, offset) && N.isLessThan(offset, endOffset)
  ).pipe(
    O.match({
      onNone: () =>
        Effect.fail(
          SourceTextResolverError.new(
            "page-out-of-range",
            `Source-text offset ${offset} is outside the canonical source.`
          )
        ),
      onSome: (index) => Effect.succeed(NonNegativeInt.make(index)),
    })
  );
  return yield* sourceTextPageFromBounds(source, pageIndex, pageBounds);
});
