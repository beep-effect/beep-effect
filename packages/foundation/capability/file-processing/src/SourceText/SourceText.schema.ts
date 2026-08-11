/**
 * Canonical source-text schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FileProcessingId } from "@beep/identity";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { NonNegativeInt, PosInt } from "@beep/schema";
import { identity } from "effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $FileProcessingId.create("SourceText");

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

const sourceTextIdentityArbitrary = S.toArbitrary(SourceTextIdentity);

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
