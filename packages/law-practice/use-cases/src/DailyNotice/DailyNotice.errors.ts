/**
 * Typed failures of the daily notice's mailbox port.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { DefectCause } from "../internal/DefectCause.ts";

const $I = $LawPracticeUseCasesId.create("DailyNotice/DailyNotice.errors");

const NoticeMailboxOperationBase = LiteralKit(["claim", "send"]);

/**
 * **Example** (Guard a mailbox operation)
 *
 * ```ts
 * import { NoticeMailboxOperation } from "@beep/law-practice-use-cases/DailyNotice"
 *
 * console.log(NoticeMailboxOperation.is.send("send")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const NoticeMailboxOperation = NoticeMailboxOperationBase.pipe(
  $I.annoteSchema("NoticeMailboxOperation", {
    description: "Notice-mailbox operation that failed: claiming the day, or sending the notice.",
  }),
  SchemaUtils.withLiteralKitStatics(NoticeMailboxOperationBase)
);

/**
 * @see {@link NoticeMailboxOperation} for the operation names.
 * @category errors
 * @since 0.0.0
 */
export type NoticeMailboxOperation = typeof NoticeMailboxOperation.Type;

/**
 * **Details**
 *
 * The cause is kept for diagnostics only and never holds message content.
 *
 * **Example** (Report a failed send)
 *
 * ```ts
 * import { NoticeMailboxError } from "@beep/law-practice-use-cases/DailyNotice"
 *
 * const error = NoticeMailboxError.make({ operation: "send" })
 * console.log(error.operation) // "send"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class NoticeMailboxError extends S.TaggedError<NoticeMailboxError, { readonly brand: unique symbol }>(
  $I`NoticeMailboxError`
)(
  "NoticeMailboxError",
  {
    cause: DefectCause.annotateKey({
      description: "Optional underlying mailbox or storage defect.",
    }),
    operation: NoticeMailboxOperation.annotateKey({
      description: "Mailbox operation that failed.",
    }),
  },
  $I.annoteError<NoticeMailboxError>("NoticeMailboxError", {
    title: "Notice mailbox unavailable",
    description: "The notice mailbox could not claim the day, or could not send the notice.",
  })
) {}
