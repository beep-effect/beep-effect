/**
 * Attachment property values: a reference to an uploaded file and the facts the platform keeps about it.
 *
 * **Details**
 *
 * An attachment property does not hold the file. It holds a reference
 * ({@link AttachmentReference}) to a file uploaded beforehand; the file name,
 * size and media type are read separately ({@link AttachmentMetadata}). The
 * three file descriptor brands declared here ({@link Filename},
 * {@link MediaType}, {@link SizeBytes}) are the wire contract's shared core
 * aliases, so media references reuse them from this module.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { AttachmentRid } from "../Identifier/Identifier.model.ts";

const $I = $ScratchpadId.create("osdk/Attachment/Attachment.model");

// -----------------------------------------------------------------------------
// File descriptors
// -----------------------------------------------------------------------------

/**
 * Name of a file as its uploader supplied it, such as `my-file.txt`.
 *
 * @category models
 * @since 0.0.0
 */
export const Filename = S.NonEmptyString.pipe(
  S.brand("Filename"),
  $I.annoteSchema("Filename", {
    description: "Name of a file as its uploader supplied it, such as my-file.txt.",
  })
);

/**
 * Runtime type of {@link Filename}.
 *
 * @category models
 * @since 0.0.0
 */
export type Filename = typeof Filename.Type;

/**
 * MIME type of a file's content, such as `application/pdf` or `image/jpeg`.
 *
 * **Details**
 *
 * The platform accepts any media type, registered or not, so this is a kind
 * brand over a non-empty string rather than a closed list.
 *
 * **Example** (Brand a media type)
 *
 * ```ts import.meta.vitest name="Brand a media type"
 * import * as S from "effect/Schema"
 * import { MediaType } from "@beep/scratchpad/osdk/src/Attachment/index"
 *
 * const isMediaType = S.is(MediaType)
 * const verdicts = [isMediaType(MediaType.make("application/pdf")), isMediaType("")]
 * verdicts // => [true, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MediaType = S.NonEmptyString.pipe(
  S.brand("MediaType"),
  $I.annoteSchema("MediaType", {
    description: "MIME type of a file's content, such as application/pdf or image/jpeg.",
  })
);

/**
 * Runtime type of {@link MediaType}.
 *
 * @category models
 * @since 0.0.0
 */
export type MediaType = typeof MediaType.Type;

/**
 * Size of a file in bytes, decoded from the wire's number-in-a-string into a non-negative `bigint`.
 *
 * **Details**
 *
 * The wire carries the size as a decimal string, so it is not limited to what
 * a JSON number holds exactly. Decoding to `bigint` keeps every digit, where a
 * `number` would round sizes above 2^53.
 *
 * **Example** (Decode a size from its wire string)
 *
 * ```ts import.meta.vitest name="Decode a size from its wire string"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { SizeBytes } from "@beep/scratchpad/osdk/src/Attachment/index"
 *
 * const size = await Effect.runPromise(S.decodeUnknownEffect(SizeBytes)("393469"))
 * const isLargerThanAKilobyte = size > BigInt(1024)
 * isLargerThanAKilobyte // => true
 * ```
 *
 * @invariant A size is never negative.
 * @category models
 * @since 0.0.0
 */
export const SizeBytes = S.BigIntFromString.check(
  S.isGreaterThanOrEqualToBigInt(
    BigInt(0),
    $I.annote("SizeBytesCheck", {
      title: "Size In Bytes",
      description: "A byte count that is zero or greater.",
      message: "Expected a size in bytes that is zero or greater",
    })
  )
).pipe(
  S.brand("SizeBytes"),
  $I.annoteSchema("SizeBytes", {
    description: "Size of a file in bytes, carried on the wire as a decimal string.",
  })
);

/**
 * Runtime type of {@link SizeBytes}.
 *
 * @category models
 * @since 0.0.0
 */
export type SizeBytes = typeof SizeBytes.Type;

// -----------------------------------------------------------------------------
// Attachment values
// -----------------------------------------------------------------------------

/**
 * Value of an attachment property: a reference to a file uploaded beforehand.
 *
 * **Details**
 *
 * This is the shape read back from an object. When an attachment is supplied to
 * an action the wire takes the bare resource identifier instead.
 *
 * **Example** (Decode an attachment property value)
 *
 * ```ts import.meta.vitest name="Decode an attachment property value"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AttachmentReference } from "@beep/scratchpad/osdk/src/Attachment/index"
 *
 * const reference = await Effect.runPromise(
 *   S.decodeUnknownEffect(AttachmentReference)({
 *     rid: "ri.blobster.main.attachment.bb32154e-e043-4b00-9461-93136ca96b6f",
 *   })
 * )
 * reference.rid // => "ri.blobster.main.attachment.bb32154e-e043-4b00-9461-93136ca96b6f"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AttachmentReference extends S.Opaque<AttachmentReference, { readonly brand: unique symbol }>()(
  S.Struct({
    rid: AttachmentRid.annotateKey({ description: "Resource identifier of the uploaded file." }),
  }).pipe(
    $I.annoteSchema("AttachmentReference", {
      description: "Value of an attachment property: a reference to a file uploaded beforehand.",
    })
  )
) {}

/**
 * What the platform records about an uploaded attachment: its name, size and media type.
 *
 * **Example** (Decode attachment metadata)
 *
 * ```ts import.meta.vitest name="Decode attachment metadata"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AttachmentMetadata } from "@beep/scratchpad/osdk/src/Attachment/index"
 *
 * const metadata = await Effect.runPromise(
 *   S.decodeUnknownEffect(AttachmentMetadata)({
 *     rid: "ri.blobster.main.attachment.bb32154e-e043-4b00-9461-93136ca96b6f",
 *     filename: "my-file.txt",
 *     sizeBytes: "393469",
 *     mediaType: "application/pdf",
 *   })
 * )
 * const summary = `${metadata.filename} (${metadata.sizeBytes} bytes, ${metadata.mediaType})`
 * summary // => "my-file.txt (393469 bytes, application/pdf)"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AttachmentMetadata extends S.Opaque<AttachmentMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    rid: AttachmentRid.annotateKey({ description: "Resource identifier of the uploaded file." }),
    filename: Filename.annotateKey({ description: "Name the file was uploaded under." }),
    sizeBytes: SizeBytes.annotateKey({ description: "Size of the file content in bytes." }),
    mediaType: MediaType.annotateKey({ description: "MIME type of the file content." }),
  }).pipe(
    $I.annoteSchema("AttachmentMetadata", {
      description: "What the platform records about an uploaded attachment: its name, size and media type.",
    })
  )
) {}

/**
 * What accompanies the bytes of a file when it is uploaded as an attachment.
 *
 * **Details**
 *
 * The file content travels as the request body and is not part of this record.
 * A successful upload yields the attachment's resource identifier, which an
 * attachment property or action parameter then refers to.
 *
 * **Example** (Describe an attachment upload)
 *
 * ```ts import.meta.vitest name="Describe an attachment upload"
 * import { AttachmentUpload, Filename } from "@beep/scratchpad/osdk/src/Attachment/index"
 *
 * const upload = AttachmentUpload.make({ filename: Filename.make("report.pdf") })
 * upload.filename // => "report.pdf"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AttachmentUpload extends S.Opaque<AttachmentUpload, { readonly brand: unique symbol }>()(
  S.Struct({
    filename: Filename.annotateKey({ description: "Name to store the uploaded file under." }),
  }).pipe(
    $I.annoteSchema("AttachmentUpload", {
      description: "What accompanies the bytes of a file when it is uploaded as an attachment.",
    })
  )
) {}
