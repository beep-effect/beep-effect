/**
 * Review source-reference value objects: where in a Box document a review
 * item's evidence lives, with an optional pre-rendered crop of the passage.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { QuoteSelector } from "@beep/text/Selector";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import { constTrue } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { PosInt } from "../../internal/PosInt.ts";

const $I = $LawPracticeDomainId.create("values/SourceRef/SourceRef.model");

const PAGE_CROP_MAX_DATA_LENGTH = 120_000;

/**
 * **Example** (Decode a Box file id)
 *
 * ```ts
 * import { BoxFileId } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(BoxFileId)("1234567890")) // true
 * console.log(S.is(BoxFileId)("abc")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const BoxFileId = S.String.check(
  S.isPattern(/^[0-9]+$/, { message: "Expected a Box file id (decimal digits)" })
).pipe(
  $I.annoteSchema("BoxFileId", {
    description: "Box file identifier: the decimal digit string Box assigns to a file.",
  })
);

/**
 * @see {@link BoxFileId} for the digit-string check.
 * @category models
 * @since 0.0.0
 */
export type BoxFileId = typeof BoxFileId.Type;

/**
 * **Example** (Read the crop image formats)
 *
 * ```ts
 * import { PageCropMimeType } from "@beep/law-practice-domain"
 *
 * console.log(PageCropMimeType.literals) // ["image/png", "image/jpeg"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PageCropMimeType = LiteralKit(["image/png", "image/jpeg"]).pipe(
  $I.annoteSchema("PageCropMimeType", {
    description: "Image formats a pre-rendered page crop may carry.",
  })
);

/**
 * @see {@link PageCropMimeType} for the literal domain.
 * @category models
 * @since 0.0.0
 */
export type PageCropMimeType = typeof PageCropMimeType.Type;

const PageCropData = S.String.check(
  S.isMinLength(1),
  S.isMaxLength(PAGE_CROP_MAX_DATA_LENGTH, {
    message: `Expected base64 crop data of at most ${PAGE_CROP_MAX_DATA_LENGTH} characters`,
  }),
  S.isBase64()
).pipe(
  $I.annoteSchema("PageCropData", {
    description:
      "Base64 image data of at most 120,000 characters, so the desktop Svg wrapper stays under its 131,072-character cap.",
  })
);

/**
 * **Details**
 *
 * Producers render the crop; the review pane never draws whole Box pages.
 * `data` is base64 of at most 120,000 characters, so the desktop `Svg`
 * wrapper stays under its 131,072-character cap.
 *
 * **Example** (Build a page crop)
 *
 * ```ts
 * import { PageCrop } from "@beep/law-practice-domain"
 *
 * const crop = PageCrop.make({
 *   page: 3,
 *   mimeType: "image/png",
 *   width: 640,
 *   height: 120,
 *   data: "iVBORw0KGgo=",
 * })
 *
 * console.log(crop.mimeType) // "image/png"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class PageCrop extends S.Opaque<PageCrop, { readonly brand: unique symbol }>()(
  S.Struct({
    page: PosInt.annotateKey({
      description: "One-based page number the crop was taken from.",
    }),
    mimeType: PageCropMimeType.annotateKey({
      description: "Image format of the crop data.",
    }),
    width: PosInt.annotateKey({
      description: "Crop width in pixels.",
    }),
    height: PosInt.annotateKey({
      description: "Crop height in pixels.",
    }),
    data: PageCropData.annotateKey({
      description: "Base64 image data, at most 120,000 characters.",
    }),
  }).pipe(
    $I.annoteSchema("PageCrop", {
      description: "A pre-rendered, size-bounded image of the passage region on one page.",
    })
  )
) {}

/**
 * **Example** (Type an encoded crop image format)
 *
 * ```ts
 * import type { PageCrop } from "@beep/law-practice-domain"
 *
 * const mimeType: PageCrop.Encoded["mimeType"] = "image/jpeg"
 * console.log(mimeType) // "image/jpeg"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export declare namespace PageCrop {
  /**
   * Wire-encoded representation of a decoded {@link PageCrop}.
   *
   * **Example** (Alias the encoded type)
   *
   * ```ts
   * import type { PageCrop } from "@beep/law-practice-domain"
   *
   * type Wire = PageCrop.Encoded
   * ```
   *
   * @category value-objects
   * @since 0.0.0
   */
  export type Encoded = typeof PageCrop.Encoded;
}

const SourceRefCropPageCheck = S.makeFilter(
  ({ page, crop }: { readonly page: O.Option<PosInt>; readonly crop: O.Option<PageCrop> }) =>
    O.getOrElse(
      O.zipWith(page, crop, (refPage, pageCrop) => Eq.equals(pageCrop.page, refPage)),
      constTrue
    ),
  $I.annote("SourceRefCropPageCheck", {
    title: "Source reference crop page",
    description: "When a source reference carries both a page and a crop, the crop must be taken from that page.",
    message: "Expected the crop page to equal the source reference page",
  })
);

/**
 * Where a review item's evidence lives: a Box file, an optional page, the
 * quoted passage, and an optional pre-rendered crop.
 *
 * **Details**
 *
 * `quote` is the shared `@beep/text` {@link QuoteSelector}: an unverified
 * locator, never an occurrence or a receipt, with a non-empty `exact`. `page` and `crop` decode from optional
 * keys into `Option` values and default to `Option.none()` on construction.
 * When both are present, `crop.page` must equal `page`; decoding and `make`
 * reject a crop taken from another page.
 *
 * **Example** (Build a source reference)
 *
 * ```ts
 * import { SourceRef } from "@beep/law-practice-domain"
 * import { QuoteSelector } from "@beep/text/Selector"
 * import * as O from "effect/Option"
 *
 * const ref = SourceRef.make({
 *   boxFileId: "1234567890",
 *   page: O.some(3),
 *   quote: QuoteSelector.make({ exact: "a hinge coupling the lid to the base", prefix: O.none(), suffix: O.none() }),
 * })
 *
 * console.log(ref.boxFileId) // "1234567890"
 * console.log(O.isNone(ref.crop)) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class SourceRef extends S.Opaque<SourceRef, { readonly brand: unique symbol }>()(
  S.Struct({
    boxFileId: BoxFileId.annotateKey({
      description: "Box file that holds the passage.",
    }),
    page: PosInt.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "One-based page number of the passage, when known.",
      })
    ),
    quote: QuoteSelector.annotateKey({
      description: "W3C quote selector for the passage: its exact text with optional prefix and suffix context.",
    }),
    crop: PageCrop.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Optional pre-rendered image of the passage region.",
      })
    ),
  })
    .check(SourceRefCropPageCheck)
    .pipe(
      $I.annoteSchema("SourceRef", {
        description:
          "Where a review item's evidence lives: a Box file, an optional page, the quote, and an optional crop.",
      })
    )
) {}

/**
 * **Example** (Type an encoded source reference page)
 *
 * ```ts
 * import type { SourceRef } from "@beep/law-practice-domain"
 *
 * const page: SourceRef.Encoded["page"] = 3
 * console.log(page) // 3
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export declare namespace SourceRef {
  /**
   * Wire-encoded representation of a decoded {@link SourceRef}.
   *
   * **Example** (Alias the encoded type)
   *
   * ```ts
   * import type { SourceRef } from "@beep/law-practice-domain"
   *
   * type Wire = SourceRef.Encoded
   * ```
   *
   * @category value-objects
   * @since 0.0.0
   */
  export type Encoded = typeof SourceRef.Encoded;
}
