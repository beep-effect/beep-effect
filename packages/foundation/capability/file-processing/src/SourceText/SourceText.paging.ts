/**
 * Surrogate-safe canonical source-text paging.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { NonNegativeInt, PosInt } from "@beep/schema";
import { Effect, Number as N } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { SourceTextResolverError } from "./SourceText.errors.ts";
import { SOURCE_TEXT_PAGE_CODE_UNITS, SourceTextPage } from "./SourceText.schema.ts";
import type { ResolvedSourceText } from "./SourceText.schema.ts";

const isHighSurrogate = N.between({ minimum: 0xd800, maximum: 0xdbff });
const isLowSurrogate = N.between({ minimum: 0xdc00, maximum: 0xdfff });

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
    Effect.fromOption(() =>
      SourceTextResolverError.new(
        "page-out-of-range",
        `Source-text page ${pageIndex} is outside the available range 0-${pageCount - 1}.`
      )
    )
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
 * ```ts import.meta.vitest name="Load first page"
 * import type { ResolvedSourceText } from "@beep/file-processing/SourceText"
 * import { pageSourceText } from "@beep/file-processing/SourceText"
 * import { NonNegativeInt } from "@beep/schema"
 * import { Effect } from "effect"
 *
 * const loadFirstPage = (source: ResolvedSourceText) =>
 *   Effect.runPromise(pageSourceText(source, NonNegativeInt.make(0)))
 *
 * typeof loadFirstPage // => "function"
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
 * ```ts import.meta.vitest name="Load page for offset"
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
 *
 * typeof loadPageContaining // => "function"
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
