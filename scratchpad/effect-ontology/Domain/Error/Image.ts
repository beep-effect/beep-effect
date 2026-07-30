/**
 * Schema-backed image fetching and validation failures.
 *
 * @remarks
 * URLs use the repository's canonical `URLStr`, byte counts and durations are
 * non-negative integers, and safe messages default at schema construction.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import type { TaggedErrorClassFromFields } from "@beep/schema";
import { NonNegativeInt, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import * as Duration from "effect/Duration";
import * as S from "effect/Schema";
import {
  ErrorMessage,
  ErrorUrl,
  Milliseconds,
  makeOntologyErrorClass,
  OptionalErrorCause,
  OptionalHttpStatusCode,
} from "./Base.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Error/Image");

/**
 * Failure to download an image from a URL.
 *
 * @example
 * ```ts
 * import { ImageFetchError } from "@effect-ontology/Error/Image.ts"
 *
 * const error = ImageFetchError.fromUnknown({
 *   message: "Image request failed.",
 *   url: "https://example.com/image.png"
 * })
 * console.log(error.url)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ImageFetchError = makeOntologyErrorClass(
  $I`ImageFetchError`,
  "ImageFetchError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable image-fetch diagnostic.",
    }),
    url: ErrorUrl.annotateKey({
      description: "Canonical image URL that failed to load.",
    }),
    statusCode: OptionalHttpStatusCode.annotateKey({
      description: "Optional HTTP response status, normalized to Option.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional image client defect.",
    }),
  },
  $I.annote("ImageFetchError", {
    description: "Failure to download an image because of transport or HTTP response errors.",
  })
);

/** Runtime value decoded by {@link ImageFetchError}.
 * @example
 * ```ts
 * import { ImageFetchError, type ImageFetchError as Failure } from "@effect-ontology/Error/Image.ts"
 * const error: Failure = ImageFetchError.fromUnknown({ message: "Failed.", url: "https://example.com/a.png" })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type ImageFetchError = typeof ImageFetchError.Type;

const ImageTimeoutErrorFields = {
  url: ErrorUrl.annotateKey({
    description: "Canonical image URL whose request timed out.",
  }),
  timeoutMs: Milliseconds.annotateKey({
    description: "Configured image-fetch deadline in milliseconds.",
  }),
  message: ErrorMessage.pipe(SchemaUtils.withKeyDefaults("Image fetch timed out")).annotateKey({
    description: "Human-readable timeout diagnostic with a schema-owned default.",
  }),
} satisfies S.Struct.Fields;

const makeImageTimeoutError = (
  input: S.Schema.Type<S.TaggedStruct<"ImageTimeoutError", typeof ImageTimeoutErrorFields>>
): ImageTimeoutError => ImageTimeoutError.make(input as never);

const ImageTimeoutErrorBase: TaggedErrorClassFromFields<
  ImageTimeoutError,
  "ImageTimeoutError",
  typeof ImageTimeoutErrorFields
> = TaggedErrorClass<ImageTimeoutError>($I`ImageTimeoutError`)("ImageTimeoutError", ImageTimeoutErrorFields, {
  ...$I.annote("ImageTimeoutError", {
    description: "Image download that exceeded its configured deadline.",
  }),
  toArbitrary:
    ([from]) =>
    () => ({
      arbitrary: from.arbitrary.map(makeImageTimeoutError),
      terminal: from.terminal?.map(makeImageTimeoutError),
    }),
});

/**
 * Image download that exceeded its configured deadline.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { ImageTimeoutError } from "@effect-ontology/Error/Image.ts"
 *
 * const error = S.decodeUnknownSync(ImageTimeoutError)({
 *   url: "https://example.com/image.png",
 *   timeoutMs: 5_000
 * })
 * console.log(error.timeout)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ImageTimeoutError extends ImageTimeoutErrorBase {
  /**
   * Configured deadline represented as an Effect `Duration`.
   *
   * @example
   * ```ts
   * import * as S from "effect/Schema"
   * import { ImageTimeoutError } from "@effect-ontology/Error/Image.ts"
   *
   * const timeout = S.decodeUnknownSync(ImageTimeoutError)({
   *   url: "https://example.com/image.png",
   *   timeoutMs: 250
   * }).timeout
   * console.log(timeout)
   * ```
   *
   * @returns The schema-owned millisecond deadline as an Effect `Duration`.
   * @category errors
   * @since 0.0.0
   */
  get timeout(): Duration.Duration {
    return Duration.millis(this.timeoutMs);
  }
}

/**
 * Downloaded image whose size exceeds the configured maximum.
 *
 * @example
 * ```ts
 * import { ImageTooLargeError } from "@effect-ontology/Error/Image.ts"
 *
 * const error = ImageTooLargeError.fromUnknown({
 *   url: "https://example.com/image.png",
 *   sizeBytes: 2_000,
 *   maxBytes: 1_000
 * })
 * console.log(error.message)
 * ```
 *
 * @invariant Byte counts are finite non-negative integers.
 * @category errors
 * @since 0.0.0
 */
export const ImageTooLargeError = makeOntologyErrorClass(
  $I`ImageTooLargeError`,
  "ImageTooLargeError",
  {
    url: ErrorUrl.annotateKey({
      description: "Canonical URL of the oversized image.",
    }),
    sizeBytes: NonNegativeInt.annotateKey({
      description: "Observed image size in bytes.",
    }),
    maxBytes: NonNegativeInt.annotateKey({
      description: "Maximum permitted image size in bytes.",
    }),
    message: ErrorMessage.pipe(SchemaUtils.withKeyDefaults("Image exceeds maximum size limit")).annotateKey({
      description: "Human-readable size-limit diagnostic with a schema-owned default.",
    }),
  },
  $I.annote("ImageTooLargeError", {
    description: "Downloaded image whose size exceeds the configured maximum.",
  })
);

/** Runtime value decoded by {@link ImageTooLargeError}.
 * @example
 * ```ts
 * import { ImageTooLargeError, type ImageTooLargeError as Failure } from "@effect-ontology/Error/Image.ts"
 * const error: Failure = ImageTooLargeError.fromUnknown({ url: "https://example.com/a", sizeBytes: 2, maxBytes: 1 })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type ImageTooLargeError = typeof ImageTooLargeError.Type;

/**
 * Image response with an unsupported media type.
 *
 * @example
 * ```ts
 * import { ImageInvalidTypeError } from "@effect-ontology/Error/Image.ts"
 *
 * const error = ImageInvalidTypeError.fromUnknown({
 *   url: "https://example.com/image.svg",
 *   contentType: "image/svg+xml",
 *   allowedTypes: ["image/png", "image/jpeg"]
 * })
 * console.log(error.message)
 * ```
 *
 * @invariant `allowedTypes` contains at least one non-empty media type.
 * @category errors
 * @since 0.0.0
 */
export const ImageInvalidTypeError = makeOntologyErrorClass(
  $I`ImageInvalidTypeError`,
  "ImageInvalidTypeError",
  {
    url: ErrorUrl.annotateKey({
      description: "Canonical URL of the rejected image.",
    }),
    contentType: S.NonEmptyString.annotateKey({
      description: "Media type returned for the image.",
    }),
    allowedTypes: S.NonEmptyArray(S.NonEmptyString).annotateKey({
      description: "Non-empty set of accepted image media types.",
    }),
    message: ErrorMessage.pipe(SchemaUtils.withKeyDefaults("Image has unsupported content type")).annotateKey({
      description: "Human-readable media-type diagnostic with a schema-owned default.",
    }),
  },
  $I.annote("ImageInvalidTypeError", {
    description: "Image response with a media type outside the accepted set.",
  })
);

/** Runtime value decoded by {@link ImageInvalidTypeError}.
 * @example
 * ```ts
 * import { ImageInvalidTypeError, type ImageInvalidTypeError as Failure } from "@effect-ontology/Error/Image.ts"
 * const error: Failure = ImageInvalidTypeError.fromUnknown({
 *   url: "https://example.com/a",
 *   contentType: "text/plain",
 *   allowedTypes: ["image/png"]
 * })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type ImageInvalidTypeError = typeof ImageInvalidTypeError.Type;

const ImageErrorDefinition = S.Union([
  ImageFetchError,
  ImageTimeoutError,
  ImageTooLargeError,
  ImageInvalidTypeError,
]).pipe(S.toTaggedUnion("_tag"));

/**
 * Exhaustive tagged union of image-operation failures.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { ImageError, ImageTimeoutError } from "@effect-ontology/Error/Image.ts"
 *
 * const error = S.decodeUnknownSync(ImageTimeoutError)({
 *   url: "https://example.com/a",
 *   timeoutMs: 10
 * })
 * console.log(ImageError.guards.ImageTimeoutError(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ImageError = ImageErrorDefinition.pipe(
  $I.annoteSchema("ImageError", {
    description: "Exhaustive tagged union of image-operation failures.",
    toArbitrary: () => () => S.toArbitrary(ImageErrorDefinition),
  })
);

/**
 * Runtime failure decoded by {@link ImageError}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { ImageTimeoutError, type ImageError } from "@effect-ontology/Error/Image.ts"
 *
 * const error: ImageError = S.decodeUnknownSync(ImageTimeoutError)({
 *   url: "https://example.com/a",
 *   timeoutMs: 10
 * })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ImageError = typeof ImageError.Type;
