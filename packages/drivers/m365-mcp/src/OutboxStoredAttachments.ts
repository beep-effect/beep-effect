/**
 * Summaries of the attachments a draft actually stores.
 *
 * **Details**
 *
 * The size Graph reports for an attachment includes storage overhead and is
 * not the length of the uploaded bytes, and the ids Graph returns from an
 * upload and from a listing are not a reliable join. So the outbox never
 * trusts a record of what it uploaded: it downloads each stored attachment
 * and takes the name Graph stores, the length of the downloaded bytes and
 * their SHA-256 digest. That also covers an attachment added in Outlook.
 *
 * @category services
 * @since 0.1.0
 */

import { $M365McpId } from "@beep/identity/packages";
import {
  GraphPathSegment,
  M365,
  M365DownloadMessageAttachmentRequest,
  M365ListMessageAttachmentsRequest,
} from "@beep/m365";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import { Crypto, Effect, pipe } from "effect";
import * as A from "effect/Array";
import * as Hex from "effect/encoding/Hex";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { OutboxAttachmentDigest } from "./OutboxAttachmentSource.ts";
import type { GraphAttachment, M365Error } from "@beep/m365";

const $I = $M365McpId.create("OutboxStoredAttachments");

const FILE_ATTACHMENT_ODATA_TYPE = "#microsoft.graph.fileAttachment";

const PosInt = S.Int.check(S.isGreaterThan(0, { message: "Expected a positive integer" })).annotate({
  title: "PosInt",
  description: "An integer greater than zero.",
});

/**
 * Why a draft's stored attachments could not be summarized.
 *
 * **Example** (Guard a stored attachment failure reason)
 *
 * ```ts
 * import { OutboxStoredAttachmentErrorReason } from "@beep/m365-mcp/OutboxStoredAttachments"
 *
 * console.log(OutboxStoredAttachmentErrorReason.is.unsupported("unsupported"))
 * // true
 * ```
 *
 * @category errors
 * @since 0.1.0
 */
export const OutboxStoredAttachmentErrorReason = LiteralKit([
  "unsupported",
  "too-many",
  "too-large",
  "unreadable",
]).pipe(
  $I.annoteSchema("OutboxStoredAttachmentErrorReason", {
    description: "Why the stored attachments of a draft could not be summarized.",
  })
);

/**
 * Type for {@link OutboxStoredAttachmentErrorReason}.
 *
 * **Example** (Type a stored attachment failure reason)
 *
 * ```ts
 * import type { OutboxStoredAttachmentErrorReason } from "@beep/m365-mcp/OutboxStoredAttachments"
 *
 * const reason: OutboxStoredAttachmentErrorReason = "too-many"
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.1.0
 */
export type OutboxStoredAttachmentErrorReason = typeof OutboxStoredAttachmentErrorReason.Type;

/**
 * Typed failure to summarize a draft's stored attachments.
 *
 * **Details**
 *
 * `count` is the number of attachments at fault. The message never names a
 * file.
 *
 * **Example** (Construct a stored attachment failure)
 *
 * ```ts
 * import { OutboxStoredAttachmentError } from "@beep/m365-mcp/OutboxStoredAttachments"
 *
 * const error = OutboxStoredAttachmentError.make({
 *   count: 1,
 *   message: "1 attachment(s) on the draft cannot be verified.",
 *   reason: "unsupported"
 * })
 * console.log(error.count)
 * // 1
 * ```
 *
 * @category errors
 * @since 0.1.0
 */
export class OutboxStoredAttachmentError extends S.TaggedError<OutboxStoredAttachmentError>(
  $I`OutboxStoredAttachmentError`
)(
  "OutboxStoredAttachmentError",
  {
    count: S.Natural.annotateKey({ description: "Number of attachments at fault." }),
    message: S.String.annotateKey({ description: "Human-readable failure; never a file name." }),
    reason: OutboxStoredAttachmentErrorReason.annotateKey({ description: "Stable failure category." }),
  },
  $I.annoteError<OutboxStoredAttachmentError>("OutboxStoredAttachmentError", {
    description: "Typed failure to summarize the stored attachments of a draft.",
  })
) {}

/**
 * Which draft to summarize, and how much the server may download to do it.
 *
 * **Example** (Request a draft's stored attachments)
 *
 * ```ts
 * import { OutboxStoredAttachmentsRequest } from "@beep/m365-mcp/OutboxStoredAttachments"
 *
 * const request = OutboxStoredAttachmentsRequest.make({
 *   draftId: "message-id",
 *   mailbox: "mailbox@example.test",
 *   maxAttachments: 20,
 *   maxReportedBytes: 52428800
 * })
 * console.log(request.maxAttachments)
 * // 20
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class OutboxStoredAttachmentsRequest extends S.Class<OutboxStoredAttachmentsRequest>(
  $I`OutboxStoredAttachmentsRequest`
)(
  {
    draftId: GraphPathSegment.annotateKey({ description: "Graph id of the draft." }),
    mailbox: GraphPathSegment.annotateKey({ description: "The configured mailbox." }),
    maxAttachments: PosInt.annotateKey({ description: "Largest number of stored attachments to download." }),
    maxReportedBytes: PosInt.annotateKey({
      description: "Largest sum of the sizes Graph reports for the stored attachments; checked before any download.",
    }),
  },
  $I.annote("OutboxStoredAttachmentsRequest", {
    description: "A draft whose stored attachments are to be downloaded and hashed, with download limits.",
  })
) {}

const isGraphId = S.is(GraphPathSegment);

const isVerifiable = (attachment: GraphAttachment): boolean =>
  O.contains(attachment["@odata.type"], FILE_ATTACHMENT_ODATA_TYPE) &&
  !O.contains(attachment.isInline, true) &&
  O.exists(attachment.name, (name) => name.length > 0) &&
  isGraphId(attachment.id);

const failure = (reason: OutboxStoredAttachmentErrorReason, count: number, message: string) =>
  OutboxStoredAttachmentError.make({ count, message, reason });

const reportedBytes = A.reduce(0, (total: number, attachment: GraphAttachment) =>
  pipe(
    attachment.size,
    O.getOrElse(() => 0),
    (size) => total + size
  )
);

/**
 * Download and hash every attachment a draft stores.
 *
 * **Details**
 *
 * Each summary is the name Graph stores, the byte length of the downloaded
 * content and the SHA-256 digest of that content. The call fails, before any
 * download, when the draft holds more attachments than `maxAttachments`, when
 * the sizes Graph reports sum to more than `maxReportedBytes`, or when an
 * attachment is not a plain file attachment (an item or reference attachment,
 * an inline one, or one without a name). A failed listing is the driver's own
 * `M365Error`; a failed download is `unreadable`.
 *
 * **Example** (Summarize a draft's stored attachments)
 *
 * ```ts
 * import { OutboxStoredAttachmentsRequest, readStoredAttachments } from "@beep/m365-mcp/OutboxStoredAttachments"
 * import { Effect } from "effect"
 *
 * const program = readStoredAttachments(
 *   OutboxStoredAttachmentsRequest.make({
 *     draftId: "message-id",
 *     mailbox: "mailbox@example.test",
 *     maxAttachments: 20,
 *     maxReportedBytes: 52428800
 *   })
 * ).pipe(Effect.map((stored) => stored.length))
 * console.log(Effect.isEffect(program))
 * // true
 * ```
 *
 * @category services
 * @since 0.1.0
 */
export const readStoredAttachments = Effect.fn("OutboxStoredAttachments.read")(function* (
  request: OutboxStoredAttachmentsRequest
): Effect.fn.Return<
  ReadonlyArray<OutboxAttachmentDigest>,
  M365Error | OutboxStoredAttachmentError,
  M365 | Crypto.Crypto
> {
  const m365 = yield* M365;
  const crypto = yield* Crypto.Crypto;
  const userId = O.some(request.mailbox);
  const listed = yield* m365.listMessageAttachments(
    M365ListMessageAttachmentsRequest.make({ messageId: request.draftId, userId })
  );
  const attachments = listed.value;
  const count = A.length(attachments);
  const reported = reportedBytes(attachments);
  yield* Effect.annotateCurrentSpan({
    m365_outbox_stored_attachment_count: count,
    m365_outbox_stored_reported_bytes: reported,
  });
  if (count > request.maxAttachments) {
    return yield* failure(
      "too-many",
      count,
      `The draft holds ${count} attachments; the limit is ${request.maxAttachments}.`
    );
  }
  if (reported > request.maxReportedBytes) {
    return yield* failure(
      "too-large",
      count,
      `The draft's attachments are reported as ${reported} bytes, over the ${request.maxReportedBytes}-byte download limit.`
    );
  }
  const unsupported = A.length(attachments) - A.length(A.filter(attachments, isVerifiable));
  if (unsupported > 0) {
    return yield* failure(
      "unsupported",
      unsupported,
      `${unsupported} attachment(s) on the draft are not plain file attachments (item, reference, inline or unnamed) and cannot be verified.`
    );
  }

  return yield* Effect.forEach(attachments, (attachment) =>
    Effect.gen(function* () {
      const content = yield* m365.downloadMessageAttachment(
        M365DownloadMessageAttachmentRequest.make({
          attachmentId: attachment.id,
          messageId: request.draftId,
          userId,
        })
      );
      const digest = yield* crypto.digest("SHA-256", content.bytes);
      return OutboxAttachmentDigest.make({
        name: pipe(
          attachment.name,
          O.getOrElse(() => "")
        ),
        sha256: Sha256Hex.make(Hex.encode(digest)),
        size: content.bytes.byteLength,
      });
    }).pipe(Effect.mapError(() => failure("unreadable", 1, "A stored attachment could not be downloaded and hashed.")))
  );
});
