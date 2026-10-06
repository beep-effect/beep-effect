/**
 * Local attachment source for the Microsoft 365 outbox server.
 *
 * **Details**
 *
 * A session names attachments by absolute path. Every path is resolved through
 * its symlinks and must land on a regular file under one of the configured
 * roots, so a session that has read an untrusted document cannot be talked
 * into attaching an arbitrary private file. All paths are checked before any
 * file is read, and all files are read before any Graph call.
 *
 * @category services
 * @since 0.1.0
 */

import { lookup as lookupMimeType } from "@beep/data/MimeTypes";
import { $M365McpId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import { ByteSize, Context, Crypto, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as Hex from "effect/encoding/Hex";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $M365McpId.create("OutboxAttachmentSource");

const FALLBACK_CONTENT_TYPE = "application/octet-stream";
const ROOT_DIRECTORY_MODE = 0o700;

const PosInt = S.Int.check(S.isGreaterThan(0, { message: "Expected a positive integer" })).annotate({
  title: "PosInt",
  description: "An integer greater than zero.",
});

/**
 * Why an attachment path was refused.
 *
 * **Example** (Guard an attachment refusal reason)
 *
 * ```ts
 * import { OutboxAttachmentErrorReason } from "@beep/m365-mcp/OutboxAttachmentSource"
 *
 * console.log(OutboxAttachmentErrorReason.is["outside-roots"]("outside-roots"))
 * // true
 * ```
 *
 * @category errors
 * @since 0.1.0
 */
export const OutboxAttachmentErrorReason = LiteralKit([
  "not-absolute",
  "outside-roots",
  "not-a-file",
  "empty",
  "too-large",
  "too-many",
  "total-too-large",
  "unreadable",
]).pipe(
  $I.annoteSchema("OutboxAttachmentErrorReason", {
    description: "Why the outbox attachment source refused a path or a list of paths.",
  })
);

/**
 * Type for {@link OutboxAttachmentErrorReason}.
 *
 * **Example** (Type an attachment refusal reason)
 *
 * ```ts
 * import type { OutboxAttachmentErrorReason } from "@beep/m365-mcp/OutboxAttachmentSource"
 *
 * const reason: OutboxAttachmentErrorReason = "too-large"
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.1.0
 */
export type OutboxAttachmentErrorReason = typeof OutboxAttachmentErrorReason.Type;

/**
 * Typed refusal raised by the outbox attachment source.
 *
 * **Details**
 *
 * The message may name the offending path, which is the caller's own input.
 * Spans never carry it.
 *
 * **Example** (Construct an attachment refusal)
 *
 * ```ts
 * import { OutboxAttachmentError } from "@beep/m365-mcp/OutboxAttachmentSource"
 *
 * const error = OutboxAttachmentError.make({
 *   message: "Attachment path is not absolute: notes.pdf",
 *   reason: "not-absolute"
 * })
 * console.log(error.reason)
 * // "not-absolute"
 * ```
 *
 * @category errors
 * @since 0.1.0
 */
export class OutboxAttachmentError extends S.TaggedError<OutboxAttachmentError>($I`OutboxAttachmentError`)(
  "OutboxAttachmentError",
  {
    message: S.String.annotateKey({ description: "Human-readable refusal; may name the caller's own path." }),
    reason: OutboxAttachmentErrorReason.annotateKey({ description: "Stable refusal category." }),
  },
  $I.annoteError<OutboxAttachmentError>("OutboxAttachmentError", {
    description: "Typed refusal raised by the outbox attachment source.",
  })
) {}

/**
 * Name, size and SHA-256 digest of one attached file.
 *
 * **Details**
 *
 * These three values are what the server records when it attaches a file and
 * what a send expectation restates.
 *
 * **Example** (Describe an attached file)
 *
 * ```ts
 * import { OutboxAttachmentDigest } from "@beep/m365-mcp/OutboxAttachmentSource"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const digest = OutboxAttachmentDigest.make({
 *   name: "receipt.pdf",
 *   sha256: Sha256Hex.make("0".repeat(64)),
 *   size: 4
 * })
 * console.log(digest.name)
 * // "receipt.pdf"
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class OutboxAttachmentDigest extends S.Class<OutboxAttachmentDigest>($I`OutboxAttachmentDigest`)(
  {
    name: S.NonEmptyString.annotateKey({ description: "Attachment file name." }),
    sha256: Sha256Hex.annotateKey({ description: "Lowercase hex SHA-256 digest of the attached bytes." }),
    size: S.Natural.annotateKey({ description: "Attachment size in bytes." }),
  },
  $I.annote("OutboxAttachmentDigest", { description: "Name, size and SHA-256 digest of one attached file." })
) {}

/**
 * One local file read and hashed for attaching.
 *
 * **Example** (Construct a resolved attachment)
 *
 * ```ts
 * import { OutboxAttachment } from "@beep/m365-mcp/OutboxAttachmentSource"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const attachment = OutboxAttachment.make({
 *   content: new Uint8Array([37, 80, 68, 70]),
 *   contentType: "application/pdf",
 *   name: "receipt.pdf",
 *   sha256: Sha256Hex.make("0".repeat(64)),
 *   size: 4
 * })
 * console.log(attachment.digest.size)
 * // 4
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class OutboxAttachment extends S.Class<OutboxAttachment>($I`OutboxAttachment`)(
  {
    content: S.Uint8Array.annotateKey({ description: "File bytes (never logged)." }),
    contentType: S.NonEmptyString.annotateKey({
      description: "MIME type by file extension; `application/octet-stream` when unknown.",
    }),
    name: S.NonEmptyString.annotateKey({ description: "File base name." }),
    sha256: Sha256Hex.annotateKey({ description: "Lowercase hex SHA-256 digest of the bytes." }),
    size: S.Natural.annotateKey({ description: "File size in bytes." }),
  },
  $I.annote("OutboxAttachment", { description: "One local file read and hashed for attaching." })
) {
  /**
   * The name, size and digest of this attachment, without its bytes.
   *
   * @since 0.1.0
   */
  get digest(): OutboxAttachmentDigest {
    return OutboxAttachmentDigest.make({ name: this.name, sha256: this.sha256, size: this.size });
  }
}

/**
 * Default largest single attachment, and default largest attachment total per
 * message, in bytes (25 MiB).
 *
 * **Example** (Read the default size limit)
 *
 * ```ts
 * import { OUTBOX_DEFAULT_MAX_ATTACHMENT_BYTES } from "@beep/m365-mcp/OutboxAttachmentSource"
 *
 * console.log(OUTBOX_DEFAULT_MAX_ATTACHMENT_BYTES)
 * // 26214400
 * ```
 *
 * @category constants
 * @since 0.1.0
 */
export const OUTBOX_DEFAULT_MAX_ATTACHMENT_BYTES: number = 25 * 1024 * 1024;

/**
 * Default largest number of attachments on one message.
 *
 * **Example** (Read the default count limit)
 *
 * ```ts
 * import { OUTBOX_DEFAULT_MAX_ATTACHMENTS } from "@beep/m365-mcp/OutboxAttachmentSource"
 *
 * console.log(OUTBOX_DEFAULT_MAX_ATTACHMENTS)
 * // 20
 * ```
 *
 * @category constants
 * @since 0.1.0
 */
export const OUTBOX_DEFAULT_MAX_ATTACHMENTS: number = 20;

/**
 * Where attachments may come from and how large they may be.
 *
 * **Example** (Allow one staging directory)
 *
 * ```ts
 * import { OutboxAttachmentPolicy } from "@beep/m365-mcp/OutboxAttachmentSource"
 *
 * const policy = OutboxAttachmentPolicy.make({ roots: ["/srv/outbox-staging"] })
 * console.log(policy.maxAttachments)
 * // 20
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class OutboxAttachmentPolicy extends S.Class<OutboxAttachmentPolicy>($I`OutboxAttachmentPolicy`)(
  {
    createMissingRoots: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultTypeKey(Effect.succeed(false))
    ).annotateKey({
      description: "Create a missing root (mode 0700) instead of failing; used only for the default staging root.",
    }),
    maxAttachmentBytes: PosInt.pipe(
      S.withConstructorDefault(Effect.succeed(OUTBOX_DEFAULT_MAX_ATTACHMENT_BYTES)),
      S.withDecodingDefaultTypeKey(Effect.succeed(OUTBOX_DEFAULT_MAX_ATTACHMENT_BYTES))
    ).annotateKey({ description: "Largest single attachment in bytes." }),
    maxAttachments: PosInt.pipe(
      S.withConstructorDefault(Effect.succeed(OUTBOX_DEFAULT_MAX_ATTACHMENTS)),
      S.withDecodingDefaultTypeKey(Effect.succeed(OUTBOX_DEFAULT_MAX_ATTACHMENTS))
    ).annotateKey({ description: "Largest number of attachments on one message." }),
    maxMessageAttachmentBytes: PosInt.pipe(
      S.withConstructorDefault(Effect.succeed(OUTBOX_DEFAULT_MAX_ATTACHMENT_BYTES)),
      S.withDecodingDefaultTypeKey(Effect.succeed(OUTBOX_DEFAULT_MAX_ATTACHMENT_BYTES))
    ).annotateKey({ description: "Largest total attachment size on one message, in bytes." }),
    roots: S.NonEmptyArray(S.NonEmptyString).annotateKey({
      description: "Absolute directories attachments may be read from.",
    }),
  },
  $I.annote("OutboxAttachmentPolicy", {
    description: "Attachment roots and size limits of the outbox attachment source.",
  })
) {}

/**
 * Outbox attachment source service shape.
 *
 * **Example** (Name the service method)
 *
 * ```ts
 * import type { OutboxAttachmentSourceShape } from "@beep/m365-mcp/OutboxAttachmentSource"
 *
 * const method: keyof OutboxAttachmentSourceShape = "resolve"
 * console.log(method)
 * ```
 *
 * @category services
 * @since 0.1.0
 */
export type OutboxAttachmentSourceShape = {
  readonly resolve: (
    paths: ReadonlyArray<string>
  ) => Effect.Effect<ReadonlyArray<OutboxAttachment>, OutboxAttachmentError>;
};

const refusal = (reason: OutboxAttachmentErrorReason, message: string): OutboxAttachmentError =>
  OutboxAttachmentError.make({ message, reason });

const refuse = (reason: OutboxAttachmentErrorReason, message: string): Effect.Effect<never, OutboxAttachmentError> =>
  Effect.fail(refusal(reason, message));

const contentTypeOf = (name: string): string => {
  const found = lookupMimeType(name);
  return found === false ? FALLBACK_CONTENT_TYPE : found;
};

const sum = A.reduce(0, (total: number, size: number) => total + size);

const makeSource = Effect.fnUntraced(function* (policy: OutboxAttachmentPolicy) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const crypto = yield* Crypto.Crypto;

  const realRoot = Effect.fnUntraced(function* (root: string) {
    if (!path.isAbsolute(root)) {
      return yield* refuse("not-absolute", `Attachment root is not absolute: ${root}`);
    }
    if (policy.createMissingRoots) {
      yield* fs
        .makeDirectory(root, { mode: ROOT_DIRECTORY_MODE, recursive: true })
        .pipe(Effect.mapError(() => refusal("unreadable", `Attachment root cannot be created: ${root}`)));
    }
    const real = yield* fs
      .realPath(root)
      .pipe(Effect.mapError(() => refusal("unreadable", `Attachment root does not exist or cannot be read: ${root}`)));
    const info = yield* fs
      .stat(real)
      .pipe(Effect.mapError(() => refusal("unreadable", `Attachment root cannot be read: ${root}`)));
    return info.type === "Directory"
      ? real
      : yield* refuse("not-a-file", `Attachment root is not a directory: ${root}`);
  });

  const roots = yield* Effect.forEach(policy.roots, realRoot);

  // Segment-wise containment: a sibling such as `/staging-evil` is not under `/staging`.
  const isUnderRoot =
    (real: string) =>
    (root: string): boolean => {
      const relative = path.relative(root, real);
      return (
        Str.isNonEmpty(relative) &&
        relative !== ".." &&
        !Str.startsWith(`..${path.sep}`)(relative) &&
        !path.isAbsolute(relative)
      );
    };

  const locate = Effect.fnUntraced(function* (candidate: string) {
    if (!path.isAbsolute(candidate)) {
      return yield* refuse("not-absolute", `Attachment path is not absolute: ${candidate}`);
    }
    const real = yield* fs
      .realPath(candidate)
      .pipe(Effect.mapError(() => refusal("unreadable", `Attachment does not exist or cannot be read: ${candidate}`)));
    if (!A.some(roots, isUnderRoot(real))) {
      return yield* refuse("outside-roots", `Attachment is outside the configured attachment roots: ${candidate}`);
    }
    const info = yield* fs
      .stat(real)
      .pipe(Effect.mapError(() => refusal("unreadable", `Attachment cannot be read: ${candidate}`)));
    if (info.type !== "File") {
      return yield* refuse("not-a-file", `Attachment is not a regular file: ${candidate}`);
    }
    const size = Number(ByteSize.toBigInt(info.size));
    if (size === 0) {
      return yield* refuse("empty", `Attachment is empty: ${candidate}`);
    }
    if (size > policy.maxAttachmentBytes) {
      return yield* refuse(
        "too-large",
        `Attachment is ${size} bytes, over the ${policy.maxAttachmentBytes}-byte limit: ${candidate}`
      );
    }
    return { candidate, real, size };
  });

  const read = Effect.fnUntraced(function* (located: { readonly candidate: string; readonly real: string }) {
    const content = yield* fs
      .readFile(located.real)
      .pipe(Effect.mapError(() => refusal("unreadable", `Attachment cannot be read: ${located.candidate}`)));
    // The file may have changed between the size check and the read.
    if (content.byteLength === 0 || content.byteLength > policy.maxAttachmentBytes) {
      return yield* refuse("too-large", `Attachment changed size while it was read: ${located.candidate}`);
    }
    const digest = yield* crypto
      .digest("SHA-256", content)
      .pipe(Effect.mapError(() => refusal("unreadable", `Attachment cannot be hashed: ${located.candidate}`)));
    const name = path.basename(located.real);
    return OutboxAttachment.make({
      content,
      contentType: contentTypeOf(name),
      name,
      sha256: Sha256Hex.make(Hex.encode(digest)),
      size: content.byteLength,
    });
  });

  return OutboxAttachmentSource.of({
    resolve: Effect.fn("OutboxAttachmentSource.resolve")(function* (paths) {
      yield* Effect.annotateCurrentSpan({ m365_outbox_attachment_count: A.length(paths) });
      if (A.length(paths) > policy.maxAttachments) {
        return yield* refuse(
          "too-many",
          `${A.length(paths)} attachments were named; the limit is ${policy.maxAttachments}.`
        );
      }
      const located = yield* Effect.forEach(paths, locate);
      const total = sum(A.map(located, (file) => file.size));
      yield* Effect.annotateCurrentSpan({ m365_outbox_attachment_total_bytes: total });
      if (total > policy.maxMessageAttachmentBytes) {
        return yield* refuse(
          "total-too-large",
          `Attachments total ${total} bytes, over the ${policy.maxMessageAttachmentBytes}-byte message limit.`
        );
      }
      const attachments = yield* Effect.forEach(located, read);
      const readTotal = sum(A.map(attachments, (attachment) => attachment.size));
      return readTotal > policy.maxMessageAttachmentBytes
        ? yield* refuse("total-too-large", "Attachments changed size while they were read.")
        : attachments;
    }),
  });
});

/**
 * Reads, bounds and hashes local attachment files for the outbox server.
 *
 * **Example** (Build the attachment source layer)
 *
 * ```ts
 * import { OutboxAttachmentPolicy, OutboxAttachmentSource } from "@beep/m365-mcp/OutboxAttachmentSource"
 * import { Layer } from "effect"
 *
 * const layer = OutboxAttachmentSource.layer(OutboxAttachmentPolicy.make({ roots: ["/srv/outbox-staging"] }))
 * console.log(Layer.isLayer(layer))
 * // true
 * ```
 *
 * @category services
 * @since 0.1.0
 */
export class OutboxAttachmentSource extends Context.Service<OutboxAttachmentSource, OutboxAttachmentSourceShape>()(
  $I`OutboxAttachmentSource`
) {
  /**
   * Build the attachment source for a policy.
   *
   * **Details**
   *
   * Every root is resolved through its symlinks when the layer is built. A
   * root that is missing, unreadable or not a directory fails the layer, so
   * the server does not start with a root it cannot enforce.
   *
   * **Example** (Build the layer for one root)
   *
   * ```ts
   * import { OutboxAttachmentPolicy, OutboxAttachmentSource } from "@beep/m365-mcp/OutboxAttachmentSource"
   * import { Layer } from "effect"
   *
   * const layer = OutboxAttachmentSource.layer(OutboxAttachmentPolicy.make({ roots: ["/srv/outbox-staging"] }))
   * console.log(Layer.isLayer(layer))
   * // true
   * ```
   *
   * @category layers
   * @since 0.1.0
   */
  static readonly layer = (
    policy: OutboxAttachmentPolicy
  ): Layer.Layer<OutboxAttachmentSource, OutboxAttachmentError, FileSystem.FileSystem | Path.Path | Crypto.Crypto> =>
    Layer.effect(OutboxAttachmentSource, makeSource(policy));
}
