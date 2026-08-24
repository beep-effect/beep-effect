/**
 * The pure attachment model for the chat composer: the {@link ComposerAttachment}
 * schema class plus its capture-time validation and object-URL helpers. Kept
 * free of any `@effect/atom` or React dependency so the per-editor atom layer
 * (`atoms.ts`) can depend on it without a circular import back through the
 * attachment plugins/UI in `attachments.tsx`.
 *
 * Per the repo schema-first law the captured value is modeled as the
 * {@link ComposerAttachment} `S.Class`: its `mimeType` is validated against
 * `@beep/schema`'s {@link MimeType}, its `size` is bounded by
 * {@link DEFAULT_MAX_ATTACHMENT_BYTES}, its `objectUrl` is a string (never
 * base64), and its `file` is a real `File` instance. Capture-time validation is
 * a static method on the class returning `Result.Result` — a {@link Success}
 * attachment or a tagged {@link AttachmentRejection} carrying *why* the file was
 * dropped (over budget vs unrecognized MIME type).
 *
 * @packageDocumentation \@beep/editor/chat/attachment-model
 * @since 0.0.0
 */

import { $EditorId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { ImageMimeType, MimeType } from "@beep/schema/MimeType";
import { dual, P } from "@beep/utils";
import { flow, identity, Number as N, Result, SchemaTransformation } from "effect";
import * as S from "effect/Schema";

const $I = $EditorId.create("chat/attachment-model");

// Non-throwing MIME decode: an empty or unrecognized `file.type` becomes a
// `Result.Failure` (mapped to {@link AttachmentInvalidMimeType}) instead of a
// thrown `ParseError` escaping the capture pipeline.
const decodeMimeType = S.decodeUnknownResult(MimeType);

/**
 * Image MIME types eligible for vision (the rest are captured as generic files).
 * Derived from `@beep/schema`'s {@link ImageMimeType} so the literal subset stays
 * in lockstep with the canonical MIME vocabulary.
 *
 * **Example** (Checking PNG MIME eligibility)
 *
 * ```ts
 * import { IMAGE_MIME_TYPES } from "@beep/editor/chat/attachment-model"
 *
 * console.log(IMAGE_MIME_TYPES.includes("image/png")) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const IMAGE_MIME_TYPES = ImageMimeType.pickOptions(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/**
 * Schema for the vision-eligible image MIME subset, used to guard whether a
 * captured attachment is an image via {@link isImageAttachment}.
 *
 * **Example** (Validating image MIME type)
 *
 * ```ts
 * import { ImageAttachmentMimeType } from "@beep/editor/chat/attachment-model"
 *
 * console.log(ImageAttachmentMimeType.is("image/png")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ImageAttachmentMimeType = S.Literals(IMAGE_MIME_TYPES).pipe(
  $I.annoteSchema("ImageAttachmentMimeType", {
    description: "The vision-eligible image MIME subset captured as thumbnailed attachments.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Companion type for {@link ImageAttachmentMimeType}.
 *
 * **Example** (Assigning image MIME type)
 *
 * ```ts
 * import type { ImageAttachmentMimeType } from "@beep/editor/chat/attachment-model"
 *
 * const mimeType: ImageAttachmentMimeType = "image/png"
 * console.log(mimeType) // "image/png"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ImageAttachmentMimeType = typeof ImageAttachmentMimeType.Type;

/**
 * Default maximum captured attachment size (10 MB).
 *
 * **Example** (Converting default max to MB)
 *
 * ```ts
 * import { DEFAULT_MAX_ATTACHMENT_BYTES } from "@beep/editor/chat/attachment-model"
 *
 * const defaultMegabytes = DEFAULT_MAX_ATTACHMENT_BYTES / 1024 / 1024
 * console.log(defaultMegabytes) // 10
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const DEFAULT_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/**
 * Schema for a real DOM `File` instance.
 *
 * @category schemas
 * @since 0.0.0
 */
const FileFromSelf = S.declare<File>((u): u is File => "File" in globalThis && u instanceof File).pipe(
  $I.annoteSchema("FileFromSelf", {
    description: "A captured DOM File instance.",
  })
);

const AttachmentByteCount = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("AttachmentByteCount", {
    description: "A non-negative integer byte count.",
  })
);

const AttachmentSizeBytes = AttachmentByteCount.pipe(
  S.check(S.isLessThanOrEqualTo(DEFAULT_MAX_ATTACHMENT_BYTES)),
  $I.annoteSchema("AttachmentSizeBytes", {
    description: `A captured attachment size in bytes, bounded by the ${DEFAULT_MAX_ATTACHMENT_BYTES}-byte default.`,
  })
);

const clampAttachmentCaptureLimitBytes = flow(
  N.round(0),
  N.clamp({ minimum: 0, maximum: DEFAULT_MAX_ATTACHMENT_BYTES })
);

const AttachmentCaptureLimitBytes = S.Finite.pipe(
  S.decodeTo(
    AttachmentSizeBytes,
    SchemaTransformation.transform({
      decode: clampAttachmentCaptureLimitBytes,
      encode: identity,
    })
  ),
  $I.annoteSchema("AttachmentCaptureLimitBytes", {
    description: "A composer attachment capture limit clamped to the supported byte range.",
  })
);

const resolveAttachmentCaptureLimitBytes = (maxBytes: number): number =>
  Result.getOrElse(S.decodeResult(AttachmentCaptureLimitBytes)(maxBytes), () => DEFAULT_MAX_ATTACHMENT_BYTES);

const AttachmentTooLargeFields = {
  filename: S.String.annotateKey({ description: "Original name of the rejected file." }),
  size: AttachmentByteCount.annotateKey({ description: "Rejected file size in bytes." }),
  maxBytes: AttachmentByteCount.annotateKey({ description: "Effective byte limit used during capture." }),
} satisfies S.Struct.Fields;
const sameAttachmentTooLargeFields = S.toEquivalence(S.TaggedStruct("AttachmentTooLarge", AttachmentTooLargeFields));
const sameAttachmentTooLarge = (self: AttachmentTooLarge, that: AttachmentTooLarge): boolean =>
  sameAttachmentTooLargeFields(self, that);

/**
 * A captured file rejected because it exceeds the (clamped) byte budget.
 *
 * **Example** (Creating oversized file rejection)
 *
 * ```ts
 * import { AttachmentTooLarge } from "@beep/editor/chat/attachment-model"
 *
 * const rejection = new AttachmentTooLarge({
 *   filename: "recording.mov",
 *   size: 15_000_000,
 *   maxBytes: 10_485_760,
 * })
 *
 * console.log(rejection._tag) // "AttachmentTooLarge"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AttachmentTooLarge extends S.TaggedError<AttachmentTooLarge>($I`AttachmentTooLarge`)(
  "AttachmentTooLarge",
  AttachmentTooLargeFields,
  $I.annoteClass<
    S.declare<AttachmentTooLarge>,
    readonly [S.TaggedStruct<"AttachmentTooLarge", typeof AttachmentTooLargeFields>]
  >("AttachmentTooLarge", {
    description: "A captured file rejected because it exceeds the (clamped) byte budget.",
    toEquivalence: () => sameAttachmentTooLarge,
  })
) {}

const AttachmentInvalidMimeTypeFields = {
  filename: S.String.annotateKey({ description: "Original name of the rejected file." }),
  mimeType: S.String.annotateKey({ description: "Raw browser File.type string that failed MIME decoding." }),
} satisfies S.Struct.Fields;
const sameAttachmentInvalidMimeTypeFields = S.toEquivalence(
  S.TaggedStruct("AttachmentInvalidMimeType", AttachmentInvalidMimeTypeFields)
);
const sameAttachmentInvalidMimeType = (self: AttachmentInvalidMimeType, that: AttachmentInvalidMimeType): boolean =>
  sameAttachmentInvalidMimeTypeFields(self, that);

/**
 * A captured file rejected because its `file.type` is empty or not a recognized
 * {@link MimeType}.
 *
 * **Example** (Creating invalid MIME rejection)
 *
 * ```ts
 * import { AttachmentInvalidMimeType } from "@beep/editor/chat/attachment-model"
 *
 * const rejection = new AttachmentInvalidMimeType({
 *   filename: "payload.bin",
 *   mimeType: "",
 * })
 *
 * console.log(rejection._tag) // "AttachmentInvalidMimeType"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AttachmentInvalidMimeType extends S.TaggedError<AttachmentInvalidMimeType>($I`AttachmentInvalidMimeType`)(
  "AttachmentInvalidMimeType",
  AttachmentInvalidMimeTypeFields,
  $I.annoteClass<
    S.declare<AttachmentInvalidMimeType>,
    readonly [S.TaggedStruct<"AttachmentInvalidMimeType", typeof AttachmentInvalidMimeTypeFields>]
  >("AttachmentInvalidMimeType", {
    description: "A captured file rejected because its `file.type` is empty or not a recognized MIME type.",
    toEquivalence: () => sameAttachmentInvalidMimeType,
  })
) {}

const AttachmentPortFailedFields = {
  message: S.String.annotateKey({ description: "User-safe upload-port failure message." }),
  cause: S.optionalKey(S.Defect({ includeStack: true })).annotateKey({
    description: "Optional underlying defect retained for structured logs, never rendered directly.",
  }),
} satisfies S.Struct.Fields;
const AttachmentPortFailedEquivalenceFields = {
  message: AttachmentPortFailedFields.message,
} satisfies S.Struct.Fields;
// cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
const sameAttachmentPortFailedFields = S.toEquivalence(
  S.TaggedStruct("AttachmentPortFailed", AttachmentPortFailedEquivalenceFields)
);
const sameAttachmentPortFailed = (self: AttachmentPortFailed, that: AttachmentPortFailed): boolean =>
  sameAttachmentPortFailedFields(self, that);

/**
 * The consumer's `onAttach` upload port rejected while being notified of
 * accepted attachments. The current batch is rolled back and its object URLs
 * are revoked; this typed failure is safe to surface without rendering the raw
 * cause.
 *
 * **Example** (Creating port failure error)
 *
 * ```ts
 * import { AttachmentPortFailed } from "@beep/editor/chat/attachment-model"
 *
 * const failure = new AttachmentPortFailed({ message: "Files could not be attached." })
 *
 * console.log(failure._tag) // "AttachmentPortFailed"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AttachmentPortFailed extends S.TaggedError<AttachmentPortFailed>($I`AttachmentPortFailed`)(
  "AttachmentPortFailed",
  AttachmentPortFailedFields,
  $I.annoteClass<
    S.declare<AttachmentPortFailed>,
    readonly [S.TaggedStruct<"AttachmentPortFailed", typeof AttachmentPortFailedFields>]
  >("AttachmentPortFailed", {
    description: "The consumer's `onAttach` upload port rejected the current attachment batch.",
    toEquivalence: () => sameAttachmentPortFailed,
  })
) {}

/**
 * Why {@link ComposerAttachment.fromFile} declined to capture a file. A tagged
 * union so the capture pipeline can distinguish — and surface — an over-budget
 * file from one with an unrecognized MIME type, rather than collapsing both into
 * an opaque `O.none()`.
 *
 * **Example** (Typing a capture rejection)
 *
 * ```ts
 * import { AttachmentInvalidMimeType, type AttachmentRejection } from "@beep/editor/chat/attachment-model"
 *
 * const rejection: AttachmentRejection = new AttachmentInvalidMimeType({
 *   filename: "payload.bin",
 *   mimeType: "",
 * })
 *
 * console.log(rejection._tag) // "AttachmentInvalidMimeType"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const AttachmentRejection = S.Union([AttachmentTooLarge, AttachmentInvalidMimeType]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("AttachmentRejection", {
    description:
      "Why {@link ComposerAttachment.fromFile} declined to capture a file. A tagged\nunion so the capture pipeline can distinguish — and surface — an over-budget\nfile from one with an unrecognized MIME type, rather than collapsing both into\nan opaque `O.none()`.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Companion type for {@link AttachmentRejection}.
 *
 * **Example** (Assigning rejection union type)
 *
 * ```ts
 * import { AttachmentInvalidMimeType, type AttachmentRejection } from "@beep/editor/chat/attachment-model"
 *
 * const rejection: AttachmentRejection = new AttachmentInvalidMimeType({
 *   filename: "payload.bin",
 *   mimeType: "",
 * })
 *
 * console.log(rejection._tag) // "AttachmentInvalidMimeType"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type AttachmentRejection = typeof AttachmentRejection.Type;

/**
 * Any typed failure the attachment surface can show inline: capture validation
 * or a rejected consumer port.
 *
 * **Example** (Typing an attachment failure)
 *
 * ```ts
 * import { AttachmentPortFailed, type AttachmentFailure } from "@beep/editor/chat/attachment-model"
 *
 * const failure: AttachmentFailure = new AttachmentPortFailed({
 *   message: "Files could not be attached.",
 * })
 * console.log(failure._tag) // "AttachmentPortFailed"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const AttachmentFailure = S.Union([AttachmentTooLarge, AttachmentInvalidMimeType, AttachmentPortFailed]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("AttachmentFailure", {
    description: "A capture-validation failure or rejected consumer attachment port.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Companion type for {@link AttachmentFailure}.
 *
 * **Example** (Making attachment failure value)
 *
 * ```ts
 * import { AttachmentPortFailed, type AttachmentFailure } from "@beep/editor/chat/attachment-model"
 *
 * const failure: AttachmentFailure = AttachmentPortFailed.make({
 *   message: "Files could not be attached.",
 * })
 * console.log(failure._tag) // "AttachmentPortFailed"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type AttachmentFailure = typeof AttachmentFailure.Type;

// Monotonic id source for captured attachments — ephemeral UI identity only, so
// a simple counter suffices (no persistence, no cross-session stability needed).
let attachmentSequence = 0;

/**
 * The in-memory attachment value (app-local UI shape for v1): a captured file
 * plus an object-URL ref used for thumbnails. Not a wire/persisted payload. The
 * `objectUrl` must be released with {@link revokeAttachment} once the chip is
 * removed.
 *
 * **Details**
 *
 * Validation lives on the schema: `mimeType` is a {@link MimeType}, `size` is
 * bounded by {@link DEFAULT_MAX_ATTACHMENT_BYTES}, and capture-time size policy
 * is configurable via the {@link ComposerAttachment.fromFile} static.
 *
 * **Example** (Making a composer attachment)
 *
 * ```ts
 * import { ComposerAttachment } from "@beep/editor/chat/attachment-model"
 *
 * const a = ComposerAttachment.make({
 *   id: "1",
 *   filename: "x.png",
 *   mimeType: "image/png",
 *   size: 1,
 *   objectUrl: "blob:x",
 *   file: new File([], "x.png"),
 * })
 * console.log(a.filename) // "x.png"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ComposerAttachment extends S.Class<ComposerAttachment>($I`ComposerAttachment`)(
  {
    id: S.String.annotateKey({ description: "Ephemeral UI identity used as the chip key." }),
    filename: S.String.annotateKey({ description: "Original file name." }),
    mimeType: MimeType.annotateKey({ description: "Validated MIME type of the captured file." }),
    size: AttachmentSizeBytes.annotateKey({
      description: "Captured file size in bytes, bounded by the default max.",
    }),
    objectUrl: S.String.annotateKey({
      description: "In-memory object-URL reference used for the thumbnail; not transported.",
    }),
    file: FileFromSelf.annotateKey({
      description: "Captured file handle kept for the app upload port to transport later.",
    }),
  },
  $I.annote("ComposerAttachment", {
    description:
      "An in-memory captured attachment: file, validated MIME type, bounded size, and a thumbnail object URL.",
  })
) {
  /**
   * Whether a file's size is within the given byte budget. Configurable size
   * policy lives here rather than on the field check so the per-composer
   * `maxAttachmentBytes` prop can tighten the bound.
   *
   * **Example** (Checking file size budget)
   *
   * ```ts
   * import { ComposerAttachment } from "@beep/editor/chat/attachment-model"
   *
   * console.log(ComposerAttachment.isWithinSize(new File([], "x"), 10)) // true
   * ```
   *
   * @category utilities
   * @since 0.0.0
   */
  static readonly isWithinSize = (file: File, maxBytes: number = DEFAULT_MAX_ATTACHMENT_BYTES): boolean =>
    file.size <= resolveAttachmentCaptureLimitBytes(maxBytes);

  /**
   * Read a captured `File` into a {@link ComposerAttachment} synchronously (via
   * an object URL for the thumbnail), or a tagged {@link AttachmentRejection}
   * describing why it was declined. Never throws: both reachable
   * `ComposerAttachment.make` failure modes are pre-validated into the failure
   * channel — an over-budget file ({@link AttachmentTooLarge}, with `maxBytes`
   * clamped to the schema's hard {@link DEFAULT_MAX_ATTACHMENT_BYTES} so an
   * oversized budget can never admit a file the `size` field check would reject)
   * and an empty/unrecognized `file.type` ({@link AttachmentInvalidMimeType}).
   * Release the `objectUrl` of a {@link Success} with {@link revokeAttachment}
   * once removed.
   *
   * **Example** (Capturing file as attachment)
   *
   * ```ts
   * import { ComposerAttachment } from "@beep/editor/chat/attachment-model"
   * import { Result } from "effect"
   *
   * const result = ComposerAttachment.fromFile(
   *   new File(["avatar"], "avatar.png", { type: "image/png" })
   * )
   *
   * console.log(Result.isSuccess(result)) // true
   * ```
   *
   * @effects Creates an object URL for successfully captured files; release it
   * with {@link revokeAttachment} once the attachment is removed.
   * @category utilities
   * @since 0.0.0
   */
  static readonly fromFile = (
    file: File,
    maxBytes: number = DEFAULT_MAX_ATTACHMENT_BYTES
  ): Result.Result<ComposerAttachment, AttachmentRejection> => {
    const effectiveMaxBytes = resolveAttachmentCaptureLimitBytes(maxBytes);
    if (!ComposerAttachment.isWithinSize(file, effectiveMaxBytes)) {
      return Result.fail(
        AttachmentTooLarge.make({ filename: file.name, size: file.size, maxBytes: effectiveMaxBytes })
      );
    }
    return Result.match(decodeMimeType(file.type), {
      onFailure: () => Result.fail(AttachmentInvalidMimeType.make({ filename: file.name, mimeType: file.type })),
      onSuccess: (mimeType) => {
        attachmentSequence += 1;
        return Result.succeed(
          ComposerAttachment.make({
            id: `attachment-${attachmentSequence}-${file.name}`,
            filename: file.name,
            mimeType,
            size: file.size,
            objectUrl: URL.createObjectURL(file),
            file,
          })
        );
      },
    });
  };
}

/**
 * Whether an attachment is a vision-eligible image, guarded by the
 * {@link ImageAttachmentMimeType} schema.
 *
 * **Example** (Detecting vision-eligible image)
 *
 * ```ts
 * import { ComposerAttachment, isImageAttachment } from "@beep/editor/chat/attachment-model"
 *
 * const a = ComposerAttachment.make({
 *   id: "1",
 *   filename: "a.png",
 *   mimeType: "image/png",
 *   size: 1,
 *   objectUrl: "blob:a",
 *   file: new File([], "a.png"),
 * })
 * console.log(isImageAttachment(a)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const isImageAttachment = (attachment: ComposerAttachment): boolean =>
  ImageAttachmentMimeType.is(attachment.mimeType);

/**
 * Read a captured `File` into a {@link ComposerAttachment} synchronously, or a
 * tagged {@link AttachmentRejection} describing why it was declined. Internal
 * helper (not a boundary) that delegates to {@link ComposerAttachment.fromFile};
 * release the `objectUrl` of a {@link Success} with {@link revokeAttachment} once
 * it is removed.
 *
 * **Example** (Converting file to attachment)
 *
 * ```ts
 * import { fileToAttachment } from "@beep/editor/chat/attachment-model"
 * import { Result } from "effect"
 *
 * const result = fileToAttachment(new File(["hi"], "note.txt", { type: "text/plain" }))
 *
 * console.log(Result.isSuccess(result)) // true
 * ```
 *
 * @effects Creates an object URL for successfully captured files; release it
 * with {@link revokeAttachment} once the attachment is removed.
 * @category utilities
 * @since 0.0.0
 */
export const fileToAttachment: {
  (maxBytes?: number): (file: File) => Result.Result<ComposerAttachment, AttachmentRejection>;
  (file: File, maxBytes?: number): Result.Result<ComposerAttachment, AttachmentRejection>;
} = dual(
  (args) => P.isNotUndefined(args[0]) && !P.isNumber(args[0]),
  (
    file: File,
    maxBytes: number = DEFAULT_MAX_ATTACHMENT_BYTES
  ): Result.Result<ComposerAttachment, AttachmentRejection> => ComposerAttachment.fromFile(file, maxBytes)
);

/**
 * Release the object URL backing an attachment thumbnail.
 *
 * **Example** (Revoking attachment object URL)
 *
 * ```ts
 * import { ComposerAttachment, revokeAttachment } from "@beep/editor/chat/attachment-model"
 *
 * const attachment = ComposerAttachment.make({
 *   id: "1",
 *   filename: "preview.png",
 *   mimeType: "image/png",
 *   size: 1,
 *   objectUrl: "blob:preview",
 *   file: new File([], "preview.png", { type: "image/png" }),
 * })
 *
 * function removeChip(attachment: ComposerAttachment): string {
 *   revokeAttachment(attachment)
 *   return attachment.id
 * }
 *
 * console.log(removeChip(attachment)) // "1"
 * ```
 *
 * @effects Calls `URL.revokeObjectURL` for the attachment thumbnail URL.
 * @category utilities
 * @since 0.0.0
 */
export const revokeAttachment = (attachment: ComposerAttachment): void => URL.revokeObjectURL(attachment.objectUrl);
