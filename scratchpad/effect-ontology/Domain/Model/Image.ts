/**
 * Image-ingestion and multimodal-prompt values.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit, MimeType, NonNegativeInt, PosInt, SchemaUtils, Sha256Hex, URLStr } from "@beep/schema";
import * as A from "effect/Array";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effect-ontology/Domain/Model/Image");

const Base64ImageData = S.NonEmptyString.check(
  S.isPattern(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/, {
    identifier: $I`Base64ImageDataPatternCheck`,
    title: "Base64 Image Data",
    description: "A non-empty canonical base64 text payload.",
    message: "Image data must be valid padded base64 text.",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.constantFrom("AA==", "AQID", "aGVsbG8="),
  })
  .pipe(
    $I.annoteSchema("Base64ImageData", {
      description: "Non-empty base64-encoded image bytes prepared for a multimodal prompt.",
    })
  );

/**
 * Semantic role an image plays in its source document.
 *
 * **Example** (Use ImageRole)
 * ```ts
 * import { ImageRole } from "@effect-ontology/Model/Image"
 *
 * console.log(ImageRole.is.hero("hero")) // true
 * console.log(ImageRole.is.thumbnail("inline")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ImageRole = LiteralKit(["hero", "inline", "thumbnail"])
  .annotate({
    toArbitrary: () => (fc) => fc.constantFrom("hero", "inline", "thumbnail"),
  })
  .annotate(
    $I.annote("ImageRole", {
      description: "Closed set of roles an image can play in a source document.",
    })
  );

/**
 * Runtime value accepted by {@link ImageRole}.
 *
 * **Example** (Use ImageRole)
 * ```ts
 * import type { ImageRole } from "@effect-ontology/Model/Image"
 *
 * const role: ImageRole = "inline"
 * console.log(role) // "inline"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ImageRole = typeof ImageRole.Type;

/**
 * Kind of aggregate that owns an image reference.
 *
 * **Example** (Use ImageOwnerType)
 * ```ts
 * import { ImageOwnerType } from "@effect-ontology/Model/Image"
 *
 * console.log(ImageOwnerType.is.document("document")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ImageOwnerType = LiteralKit(["link", "document"])
  .annotate({
    toArbitrary: () => (fc) => fc.constantFrom("link", "document"),
  })
  .annotate(
    $I.annote("ImageOwnerType", {
      description: "Closed set of owner kinds supported by image manifests.",
    })
  );

/**
 * Runtime value accepted by {@link ImageOwnerType}.
 *
 * **Example** (Use ImageOwnerType)
 * ```ts
 * import type { ImageOwnerType } from "@effect-ontology/Model/Image"
 *
 * const owner: ImageOwnerType = "document"
 * console.log(owner) // "document"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ImageOwnerType = typeof ImageOwnerType.Type;

const ImageCandidateFields = {
  sourceUrl: URLStr.annotateKey({
    description: "Original URL from which the image can be fetched.",
  }),
  alt: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({ description: "Alternative text recovered from the source." })
  ),
  caption: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({ description: "Figure caption or nearby descriptive text." })
  ),
  role: ImageRole.annotateKey({
    description: "Semantic role the image plays in its source.",
  }),
  order: NonNegativeInt.annotateKey({
    description: "Zero-based image position in the source.",
  }),
  referrerUrl: URLStr.annotateKey({
    description: "Page URL on which the image was discovered.",
  }),
};

/**
 * Image discovered before fetching, hashing, or persistence.
 *
 * **Example** (Use ImageCandidate)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ImageCandidate } from "@effect-ontology/Model/Image"
 *
 * const candidate = S.decodeUnknownOption(ImageCandidate)({
 *   sourceUrl: "https://example.com/skyline.jpg",
 *   role: "hero",
 *   order: 0,
 *   referrerUrl: "https://example.com/article"
 * })
 *
 * console.log(O.map(candidate, (value) => value.role)) // "hero"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ImageCandidate extends S.Class<ImageCandidate>($I`ImageCandidate`)(
  ImageCandidateFields,
  $I.annote("ImageCandidate", {
    description: "Raw image discovery record before content-addressed ingestion.",
  })
) {
  /** Schema-derived candidate guard. */
  static readonly is = S.is(ImageCandidate);

  /** Non-throwing candidate decoder. */
  static readonly decodeOption = S.decodeUnknownOption(ImageCandidate);
}

const ImageAssetFields = {
  hash: Sha256Hex.annotateKey({
    description: "Full SHA-256 digest used as the asset's content identity.",
  }),
  contentType: MimeType.kinds.Image.annotateKey({
    description: "IANA image media type of the stored bytes.",
  }),
  sizeBytes: PosInt.annotateKey({
    description: "Strictly positive encoded size in bytes.",
  }),
  width: S.OptionFromOptionalKey(PosInt).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({ description: "Pixel width when image metadata is available." })
  ),
  height: S.OptionFromOptionalKey(PosInt).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({ description: "Pixel height when image metadata is available." })
  ),
  storagePath: S.NonEmptyString.annotateKey({
    description: "Repository or object-storage path containing the original bytes.",
  }),
  sourceUrl: S.OptionFromOptionalKey(URLStr).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({ description: "Original fetch URL retained for provenance." })
  ),
  createdAt: S.OptionFromOptionalKey(S.DateTimeUtcFromString).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({ description: "UTC instant at which the asset was first stored." })
  ),
};

/**
 * Deduplicated, content-addressed metadata for stored image bytes.
 *
 * **Example** (Use ImageAsset)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ImageAsset } from "@effect-ontology/Model/Image"
 *
 * const asset = S.decodeUnknownOption(ImageAsset)({
 *   hash: "a".repeat(64),
 *   contentType: "image/jpeg",
 *   sizeBytes: 1024,
 *   storagePath: "assets/images/a/original"
 * })
 *
 * console.log(O.map(asset, (value) => value.contentType)) // "image/jpeg"
 * ```
 *
 * @invariant `hash` is a complete SHA-256 digest and byte/pixel counts are
 * positive integers.
 * @category models
 * @since 0.0.0
 */
export class ImageAsset extends S.Class<ImageAsset>($I`ImageAsset`)(
  ImageAssetFields,
  $I.annote("ImageAsset", {
    description: "Content-addressed metadata for one stored image asset.",
  })
) {
  /** Schema-derived asset guard. */
  static readonly is = S.is(ImageAsset);

  /** Non-throwing asset decoder. */
  static readonly decodeOption = S.decodeUnknownOption(ImageAsset);

  static readonly decodeJsonStringEffect = S.decodeEffect(S.fromJsonString(ImageAsset));

  static readonly encodeJsonStringEffect = S.encodeEffect(S.fromJsonString(ImageAsset, { space: 2 }));

  static readonly decodeUnknownEffect = S.decodeUnknownEffect(ImageAsset);

  static readonly encodeEffect = S.encodeEffect(ImageAsset);
}

const ImageRefFields = {
  ownerType: ImageOwnerType.annotateKey({
    description: "Kind of aggregate that owns this reference.",
  }),
  ownerId: S.NonEmptyString.annotateKey({
    description: "Identifier of the owning link or document.",
  }),
  assetHash: Sha256Hex.annotateKey({
    description: "Content digest of the referenced asset.",
  }),
  alt: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({ description: "Context-specific alternative text." })
  ),
  caption: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({ description: "Context-specific image caption." })
  ),
  position: NonNegativeInt.annotateKey({
    description: "Zero-based position within the owner content.",
  }),
  context: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({ description: "Surrounding source text retained for prompt context." })
  ),
  role: S.OptionFromOptionalKey(ImageRole).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({ description: "Context-specific image role when known." })
  ),
};

/**
 * Owner-scoped reference from a document or link to an image asset.
 *
 * **Example** (Use ImageRef)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ImageRef } from "@effect-ontology/Model/Image"
 *
 * const ref = S.decodeUnknownOption(ImageRef)({
 *   ownerType: "document",
 *   ownerId: "doc-1",
 *   assetHash: "b".repeat(64),
 *   position: 0
 * })
 *
 * console.log(O.map(ref, (value) => value.ownerId)) // "doc-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ImageRef extends S.Class<ImageRef>($I`ImageRef`)(
  ImageRefFields,
  $I.annote("ImageRef", {
    description: "Context-bearing reference from an owner aggregate to a content-addressed image.",
  })
) {
  /** Schema-derived image-reference guard. */
  static readonly is = S.is(ImageRef);
}

const ImageManifestFields = {
  ownerType: ImageOwnerType.annotateKey({
    description: "Kind of aggregate represented by the manifest.",
  }),
  ownerId: S.NonEmptyString.annotateKey({
    description: "Identifier of the aggregate represented by the manifest.",
  }),
  images: S.Array(ImageRef).pipe(
    SchemaUtils.withEmptyArrayDefaults<ImageRef>(),
    S.annotateKey({ description: "Image references in source order." })
  ),
  updatedAt: S.DateTimeUtcFromString.annotateKey({
    description: "UTC instant at which the manifest was last updated.",
  }),
};

/**
 * Ordered image-reference manifest for one owner.
 *
 * **Details**
 *
 * * `totalCount` is derived from `images`; it is intentionally not persisted as
 * a second, potentially inconsistent source of truth.
 *
 * **Example** (Use ImageManifest)
 * ```ts
 * import { DateTime } from "effect"
 * import { ImageManifest } from "@effect-ontology/Model/Image"
 *
 * const manifest = ImageManifest.make({
 *   ownerType: "document",
 *   ownerId: "doc-1",
 *   updatedAt: DateTime.nowUnsafe()
 * })
 *
 * console.log(manifest.totalCount) // 0
 * ```
 *
 * @invariant `totalCount` always equals the number of image references.
 * @category models
 * @since 0.0.0
 */
export class ImageManifest extends S.Class<ImageManifest>($I`ImageManifest`)(
  ImageManifestFields,
  $I.annote("ImageManifest", {
    description: "Ordered image-reference manifest with a derived, non-stale count.",
  })
) {
  /**
   * Number of references in this manifest.
   *
   * **Example** (Use ImageForPromptFields)
   * ```ts
   * import { DateTime } from "effect"
   * import { ImageManifest } from "@effect-ontology/Model/Image"
   *
   * const manifest = ImageManifest.make({
   *   ownerType: "document",
   *   ownerId: "doc-1",
   *   updatedAt: DateTime.nowUnsafe()
   * })
   * console.log(manifest.totalCount) // 0
   * ```
   *
   * @returns The current number of image references.
   */
  get totalCount(): number {
    return A.length(this.images);
  }

  static readonly fromUnknownEffect = (i: unknown) => {
    const schema = S.fromJsonString(ImageManifest);
    return S.decodeUnknownEffect(schema)(i);
  };
  static readonly encodeEffect = (i: ImageManifest) => {
    const schema = S.fromJsonString(ImageManifest);
    return S.encodeEffect(schema)(i);
  };
}

const ImageForPromptFields = {
  base64: Base64ImageData.annotateKey({
    description: "Base64-encoded image bytes.",
  }),
  mediaType: MimeType.kinds.Image.annotateKey({
    description: "Image media type supplied to the multimodal model.",
  }),
  alt: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({ description: "Alternative text supplied to the model." })
  ),
  caption: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({ description: "Caption supplied to the model." })
  ),
  context: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({ description: "Surrounding text supplied to the model." })
  ),
  position: S.OptionFromOptionalKey(NonNegativeInt).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({ description: "Source-document position when available." })
  ),
  assetHash: S.OptionFromOptionalKey(Sha256Hex).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({ description: "Source asset digest retained for traceability." })
  ),
};

/**
 * Image payload prepared for multimodal model input.
 *
 * **Example** (Use ImageForPrompt)
 * ```ts
 * import { ImageForPrompt } from "@effect-ontology/Model/Image"
 *
 * const image = ImageForPrompt.make({
 *   base64: "AA==",
 *   mediaType: "image/png"
 * })
 *
 * console.log(image.mediaType) // "image/png"
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class ImageForPrompt extends S.Class<ImageForPrompt>($I`ImageForPrompt`)(
  ImageForPromptFields,
  $I.annote("ImageForPrompt", {
    description: "Validated base64 image payload and context for multimodal prompting.",
  })
) {}

const ImageFetchResultFields = {
  bytes: S.Uint8Array.annotateKey({
    description: "Fetched image bytes.",
  }),
  hash: Sha256Hex.annotateKey({
    description: "SHA-256 digest computed from the fetched bytes.",
  }),
  contentType: MimeType.kinds.Image.annotateKey({
    description: "Detected or declared image media type.",
  }),
  candidate: ImageCandidate.annotateKey({
    description: "Discovery record that led to the fetch.",
  }),
};

/**
 * Successful result of fetching and identifying an image candidate.
 *
 * **Example** (Use ImageFetchResult)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ImageFetchResult } from "@effect-ontology/Model/Image"
 *
 * const result = S.decodeUnknownOption(ImageFetchResult)({
 *   bytes: new Uint8Array([1]),
 *   hash: "c".repeat(64),
 *   contentType: "image/png",
 *   candidate: {
 *     sourceUrl: "https://example.com/image.png",
 *     role: "inline",
 *     order: 0,
 *     referrerUrl: "https://example.com"
 *   }
 * })
 *
 * console.log(O.map(result, (value) => value.bytes.length)) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ImageFetchResult extends S.Class<ImageFetchResult>($I`ImageFetchResult`)(
  ImageFetchResultFields,
  $I.annote("ImageFetchResult", {
    description: "Fetched image bytes paired with their digest, media type, and discovery provenance.",
  })
) {}
