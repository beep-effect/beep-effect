/**
 * The daily notice: how many questions wait for the attorney today, emailed
 * from the attorney's mailbox to itself at most once a day.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ReviewItem } from "@beep/law-practice-domain";
import { docketDayInZone } from "@beep/law-practice-server/DocketIntake";
import { makeNoticeMailboxLayer, NoticeClaudeLink, NoticeMailboxConfig } from "@beep/law-practice-server/NoticeMailbox";
import { makeReviewFilesLayer, ReviewFilesConfig } from "@beep/law-practice-server/ReviewFiles";
import { DailyNotice, DailyNoticeLive, DailyNoticeOutcome } from "@beep/law-practice-use-cases/DailyNotice";
import { DigestSelection, QuestionQueue, QuestionQueueLive } from "@beep/law-practice-use-cases/QuestionQueue";
import { ReviewItemStore } from "@beep/law-practice-use-cases/ReviewItemStore";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { NoticeClaudeFolder } from "@beep/law-practice-server/NoticeMailbox";
import type { M365, M365MailAddress } from "@beep/m365";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";

/**
 * Prefix of the notice's mailbox settings: `PRACTICE_REVIEW_NOTICE_TENANT_ID`,
 * `_CLIENT_ID`, `_CERT_THUMBPRINT_SHA256`, `_CERT_PRIVATE_KEY` and `_MAILBOX`.
 *
 * **Example** (Name a notice setting)
 *
 * ```ts
 * import { NOTICE_ENV_PREFIX } from "@/Notice"
 *
 * console.log(`${NOTICE_ENV_PREFIX}_MAILBOX`) // "PRACTICE_REVIEW_NOTICE_MAILBOX"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const NOTICE_ENV_PREFIX = "PRACTICE_REVIEW_NOTICE";

// The request the notice's Claude Code link types in the review folder; the attorney presses Enter to send it.
// The hub's MCP server is registered at user scope on the attorney's PC, so Claude Code reaches the review
// queue from the review folder, whose `CLAUDE.md` holds the rules for the walk-through.
const REVIEW_QUESTIONS_PROMPT = "Walk me through my waiting review questions.";

/**
 * Send today's notice if one is due: count the questions the digest selects
 * for today in the given time zone, then send at most one notice for the day.
 *
 * **Example** (Reference the notice program)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import { sendDailyNotice } from "@/Notice"
 *
 * console.log(Effect.isEffect(sendDailyNotice(DateTime.zoneMakeNamedUnsafe("America/Chicago")))) // true
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const sendDailyNotice = Effect.fn("ReviewNotice.send")(function* (timeZone: DateTime.TimeZone) {
  const now1 = yield* DateTime.now;
  const today = docketDayInZone(now1, timeZone);
  const list2 = yield* (yield* ReviewItemStore).list;
  const questions = A.filter(list2, ReviewItem.guards.question);
  const digest = yield* (yield* QuestionQueue).digest(DigestSelection.make({ today, items: questions }));
  return yield* (yield* DailyNotice).sendIfDue({ digest, today });
});

// The outcome as one JSON line.
const encodeOutcomeLine = S.encodeEffect(S.fromJsonString(DailyNoticeOutcome));

/**
 * Send today's notice if one is due, and return its outcome as the one JSON
 * line `notice` prints to the journal.
 *
 * **Details**
 *
 * The line is the encoded `DailyNoticeOutcome`: a status, the day, and for a
 * sent notice the count it said. It never carries a question, the Claude Code
 * folder or the link, which go only into the email. `notice` prints exactly
 * this line and nothing else.
 *
 * **Example** (Reference the outcome line)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import { noticeOutcomeLine } from "@/Notice"
 *
 * console.log(Effect.isEffect(noticeOutcomeLine(DateTime.zoneMakeNamedUnsafe("America/Chicago")))) // true
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const noticeOutcomeLine = flow(sendDailyNotice, Effect.flatMap(encodeOutcomeLine));

/**
 * The services `sendDailyNotice` needs, over the hub's files in
 * `dataDirectory` and a notice mailbox that sends from `mailbox` to itself.
 *
 * **Details**
 *
 * The questions come from `items.jsonl` and their answers from
 * `answers.jsonl`. Each notice day is claimed by creating
 * `notice-sent/<YYYY-MM-DD>` beside them before the notice is sent, so two
 * runs on the same day send at most one notice. With a `claudeFolder`, the
 * email adds an "Answer them in Claude Code" link that opens Claude Code there
 * with "Walk me through my waiting review questions." typed in; the notice's
 * outcome stays count-only either way. The caller provides the `M365`
 * connection.
 *
 * **Example** (Make the notice layer)
 *
 * ```ts
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 * import { makeNoticeLayer } from "@/Notice"
 *
 * const layer = makeNoticeLayer({
 *   claudeFolder: O.none(),
 *   dataDirectory: "/var/lib/practice-review-hub",
 *   mailbox: "attorney@example.test"
 * })
 * console.log(Layer.isLayer(layer)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeNoticeLayer = (options: {
  readonly claudeFolder: O.Option<NoticeClaudeFolder>;
  readonly dataDirectory: string;
  readonly mailbox: M365MailAddress;
}): Layer.Layer<DailyNotice | QuestionQueue | ReviewItemStore, never, FileSystem.FileSystem | M365 | Path.Path> =>
  Layer.merge(
    DailyNoticeLive.pipe(
      Layer.provide(
        makeNoticeMailboxLayer(
          NoticeMailboxConfig.make({
            claudeLink: O.map(options.claudeFolder, (folder) =>
              NoticeClaudeLink.make({ folder, prompt: REVIEW_QUESTIONS_PROMPT })
            ),
            dataDirectory: options.dataDirectory,
            mailbox: options.mailbox,
          })
        )
      )
    ),
    QuestionQueueLive
  ).pipe(Layer.provideMerge(makeReviewFilesLayer(ReviewFilesConfig.make({ dataDirectory: options.dataDirectory }))));
