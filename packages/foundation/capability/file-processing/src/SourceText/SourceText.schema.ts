/**
 * Canonical source-text schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FileProcessingId } from "@beep/identity";
import { SourceTextIdentity } from "@beep/text/SourceTextIdentity";
import { identity } from "effect/Function";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";
import { PosInt } from "../internal/PosInt.ts";
import type * as SchemaAST from "effect/SchemaAST";

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
 * ```ts import.meta.vitest name="Compute nominal page count"
 * import { SOURCE_TEXT_PAGE_CODE_UNITS } from "@beep/file-processing/SourceText"
 *
 * const sourceCodeUnits = SOURCE_TEXT_PAGE_CODE_UNITS * 2 + 1
 * const nominalPageCount = Math.ceil(sourceCodeUnits / SOURCE_TEXT_PAGE_CODE_UNITS)
 * nominalPageCount // => 3
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SOURCE_TEXT_PAGE_CODE_UNITS = 65_536;

/**
 * Stable extractor name for canonical UTF-8 text and Markdown sources.
 *
 * **Example** (Build extractor name identity string)
 *
 * ```ts import.meta.vitest name="Build extractor name identity string"
 * import {
 *   UTF8_SOURCE_TEXT_EXTRACTOR_NAME,
 *   UTF8_SOURCE_TEXT_EXTRACTOR_VERSION
 * } from "@beep/file-processing/SourceText"
 *
 * const extractorIdentity =
 *   `${UTF8_SOURCE_TEXT_EXTRACTOR_NAME}@${UTF8_SOURCE_TEXT_EXTRACTOR_VERSION}`
 * extractorIdentity // => "utf8@1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const UTF8_SOURCE_TEXT_EXTRACTOR_NAME = "utf8";

/**
 * Version of the strict UTF-8 decoding contract used for source text.
 *
 * **Example** (Build extractor version identity string)
 *
 * ```ts import.meta.vitest name="Build extractor version identity string"
 * import {
 *   UTF8_SOURCE_TEXT_EXTRACTOR_NAME,
 *   UTF8_SOURCE_TEXT_EXTRACTOR_VERSION
 * } from "@beep/file-processing/SourceText"
 *
 * const extractorIdentity =
 *   `${UTF8_SOURCE_TEXT_EXTRACTOR_NAME}@${UTF8_SOURCE_TEXT_EXTRACTOR_VERSION}`
 * extractorIdentity // => "utf8@1"
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
export class ResolveSourceTextRequest extends S.Opaque<ResolveSourceTextRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    identity: SourceTextIdentity,
  }).pipe(
    $I.annoteSchema("ResolveSourceTextRequest", {
      description: "Request to resolve complete canonical text from an immutable provenance source identity.",
    })
  )
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
export class ResolvedSourceText extends S.Opaque<ResolvedSourceText, { readonly brand: unique symbol }>()(
  S.Struct({
    identity: SourceTextIdentity,
    text: S.String,
  }).pipe(
    $I.annoteSchema("ResolvedSourceText", {
      description: "Complete canonical source text whose source, extractor, and text digests have been verified.",
    })
  )
) {}

class SourceTextPageStruct extends S.Opaque<SourceTextPageStruct, { readonly brand: unique symbol }>()(
  S.Struct({
    endOffset: S.Natural,
    hasNextPage: S.Boolean,
    hasPreviousPage: S.Boolean,
    identity: SourceTextIdentity,
    pageCount: PosInt,
    pageIndex: S.Natural,
    pageSizeCodeUnits: S.tag(SOURCE_TEXT_PAGE_CODE_UNITS),
    startOffset: S.Natural,
    text: S.String,
    totalCodeUnits: S.Natural,
  }).pipe(
    $I.annoteSchema("SourceTextPageStruct", {
      description: "Structural base for a bounded canonical source-text page.",
    })
  )
) {}

const SourceTextPageFieldsSchema = SourceTextPageStruct.mapFields(identity);
type SourceTextPageFields = typeof SourceTextPageFieldsSchema.Type;

const SourceTextPageChecks = S.makeFilterGroup([
  S.makeFilter(
    ({ pageCount, pageIndex }: SourceTextPageFields) => pageIndex < pageCount,
    $I.annote("SourceTextPageIndexCheck", {
      title: "Source Text Page Index",
      description: "Checks that a zero-based page index identifies a page within the declared page count.",
      message: "Expected pageIndex to be less than pageCount.",
    })
  ),
  S.makeFilter(
    ({ endOffset, startOffset, totalCodeUnits }: SourceTextPageFields) =>
      startOffset <= endOffset && endOffset <= totalCodeUnits,
    $I.annote("SourceTextPageOffsetBoundsCheck", {
      title: "Source Text Page Offset Bounds",
      description: "Checks that page offsets are ordered and bounded by the complete source width.",
      message: "Expected startOffset <= endOffset <= totalCodeUnits.",
    })
  ),
  S.makeFilter(
    ({ endOffset, startOffset, text }: SourceTextPageFields) => endOffset - startOffset === Str.length(text),
    $I.annote("SourceTextPageTextWidthCheck", {
      title: "Source Text Page Width",
      description: "Checks that the page's absolute half-open range has the same UTF-16 width as its text.",
      message: "Expected endOffset - startOffset to equal the page text's UTF-16 code-unit length.",
    })
  ),
  S.makeFilter(
    ({ hasPreviousPage, pageIndex }: SourceTextPageFields) => hasPreviousPage === pageIndex > 0,
    $I.annote("SourceTextPagePreviousFlagCheck", {
      title: "Source Text Page Previous Flag",
      description: "Checks that hasPreviousPage agrees with the zero-based page index.",
      message: "Expected hasPreviousPage to be true exactly when pageIndex is greater than zero.",
    })
  ),
  S.makeFilter(
    ({ hasNextPage, pageCount, pageIndex }: SourceTextPageFields) => hasNextPage === pageIndex + 1 < pageCount,
    $I.annote("SourceTextPageNextFlagCheck", {
      title: "Source Text Page Next Flag",
      description: "Checks that hasNextPage agrees with the declared final page.",
      message: "Expected hasNextPage to be true exactly when another page remains.",
    })
  ),
]);

const SourceTextPageSchema = SourceTextPageFieldsSchema.check(SourceTextPageChecks);

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
export class SourceTextPage extends S.Class<SourceTextPage, { readonly brand: unique symbol }>($I`SourceTextPage`)(
  SourceTextPageSchema,
  $I.annote("SourceTextPage", {
    toCodecArbitrary: (): SchemaAST.Link =>
      S.link<SourceTextPage>()(
        S.Struct({
          identity: SourceTextIdentity,
          pageCount: S.Int.check(S.isBetween({ minimum: 1, maximum: 32 })),
          pageIndex: S.Natural.check(S.isLessThanOrEqualTo(10_000)),
          startOffset: S.Natural.check(S.isLessThanOrEqualTo(10_000)),
          text: S.String.check(S.isMaxLength(256)),
        }),
        SchemaTransformation.transform({
          decode: (value) => {
            const pageIndex = value.pageIndex % value.pageCount;
            const endOffset = value.startOffset + Str.length(value.text);
            return SourceTextPage.make({
              ...value,
              pageCount: PosInt.make(value.pageCount),
              pageIndex: S.Natural.make(pageIndex),
              endOffset: S.Natural.make(endOffset),
              totalCodeUnits: S.Natural.make(endOffset),
              pageSizeCodeUnits: SOURCE_TEXT_PAGE_CODE_UNITS,
              hasNextPage: pageIndex + 1 < value.pageCount,
              hasPreviousPage: pageIndex > 0,
            });
          },
          encode: (value) => value,
        })
      ),
    description: "Bounded canonical source-text page with absolute surrogate-safe UTF-16 offsets.",
  })
) {}
