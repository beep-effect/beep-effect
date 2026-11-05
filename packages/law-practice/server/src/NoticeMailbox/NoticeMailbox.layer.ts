/**
 * Server adapter of the daily notice's `NoticeMailbox` port over `@beep/m365`
 * mail drafts and one claim file per notice day.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { NoticeMailbox, NoticeMailboxError } from "@beep/law-practice-use-cases/DailyNotice";
import {
  GraphPathSegment,
  M365,
  M365CreateDraftMessageRequest,
  M365MailAddress,
  M365MailBody,
  M365MailDraft,
  M365SendDraftMessageRequest,
} from "@beep/m365";
import { WindowsDotSegment, WindowsDrivePath } from "@beep/schema/FilePath";
import { escapeHtml } from "@beep/utils/Html";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { NoticeMailboxOperation, NoticeMessage } from "@beep/law-practice-use-cases/DailyNotice";
import type { M365Shape } from "@beep/m365";
import type { LocalDate } from "@beep/schema/LocalDate";
import type { PlatformError } from "effect/PlatformError";

const $I = $LawPracticeServerId.create("NoticeMailbox/NoticeMailbox.layer");

// A folder segment of . or .., whichever separator the folder is written with.
const hasDotSegment = flow(Str.split(/[\\/]+/u), A.some(S.is(WindowsDotSegment)));

/**
 * An absolute Windows folder on the attorney's PC, written with `\` or `/`
 * separators.
 *
 * **Details**
 *
 * It is a `WindowsDrivePath` that also starts at the drive's root, so a
 * drive-relative path such as `C:Review` is refused. It also refuses what the
 * Claude Code link's `cwd` refuses: a `.` or `..` segment, and invisible,
 * control or bidirectional characters, so a folder the link could not open
 * fails when the config is decoded instead of in the attorney's inbox.
 *
 * **Example** (Check a review folder)
 *
 * ```ts
 * import { NoticeClaudeFolder } from "@beep/law-practice-server/NoticeMailbox"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(NoticeClaudeFolder)("C:/Users/attorney/Review")) // true
 * console.log(S.is(NoticeClaudeFolder)("C:Review")) // false
 * console.log(S.is(NoticeClaudeFolder)("C:/Users/attorney/../Review")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NoticeClaudeFolder = WindowsDrivePath.check(
  S.makeFilterGroup(
    [
      S.isPattern(
        /^[A-Za-z]:[\\/]/u,
        $I.annote("NoticeClaudeFolderAbsoluteCheck", {
          title: "Notice Claude Folder Absolute",
          description: "A Windows drive path that starts at the drive's root, such as C:\\ or C:/.",
          message: "The Claude Code folder must be an absolute Windows path, such as C:/Users/attorney/Review.",
        })
      ),
      S.makeFilter(
        P.not(hasDotSegment),
        $I.annote("NoticeClaudeFolderNoDotSegmentCheck", {
          title: "Notice Claude Folder Without Dot Segments",
          description: "A Windows drive path with no . or .. segment, which the Claude Code link refuses.",
          message: "The Claude Code folder must not contain a . or .. segment.",
        })
      ),
      S.isPattern(
        /^[^\p{C}\p{Zl}\p{Zp}]*$/u,
        $I.annote("NoticeClaudeFolderVisibleCharactersCheck", {
          title: "Notice Claude Folder Visible Characters",
          description:
            "A Windows drive path without control, format (bidirectional or zero-width), private-use or unassigned characters, or line separators.",
          message: "The Claude Code folder must not contain invisible, control or bidirectional characters.",
        })
      ),
    ],
    $I.annote("NoticeClaudeFolderChecks", {
      title: "Notice Claude Folder",
      description: "Checks for an absolute Windows folder the Claude Code link can open.",
    })
  )
).pipe(
  $I.annoteSchema("NoticeClaudeFolder", {
    description: "An absolute Windows folder on the attorney's PC, with \\ or / separators.",
  })
);

/**
 * Type of {@link NoticeClaudeFolder}.
 *
 * **Example** (Type a review folder)
 *
 * ```ts
 * import { NoticeClaudeFolder } from "@beep/law-practice-server/NoticeMailbox"
 * import * as S from "effect/Schema"
 *
 * const folder: NoticeClaudeFolder = S.decodeUnknownSync(NoticeClaudeFolder)("C:\\Users\\attorney\\Review")
 * console.log(folder) // "C:\\Users\\attorney\\Review"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NoticeClaudeFolder = typeof NoticeClaudeFolder.Type;

// The longest request the Claude Code link's q parameter carries.
const CLAUDE_LINK_PROMPT_MAX_LENGTH = 5_000;

/**
 * The Claude Code link a notice can carry: the folder on the attorney's PC
 * Claude Code opens in, and the request it types there.
 *
 * **Details**
 *
 * The link uses the `claude-cli://open` scheme, which opens Claude Code with
 * the request typed in but not sent. It belongs to the deployment, not to the
 * notice: the notice itself still says only how many questions wait.
 *
 * **Example** (Make a link)
 *
 * ```ts
 * import { NoticeClaudeFolder, NoticeClaudeLink } from "@beep/law-practice-server/NoticeMailbox"
 * import * as S from "effect/Schema"
 *
 * const link = NoticeClaudeLink.make({
 *   folder: S.decodeUnknownSync(NoticeClaudeFolder)("C:/Users/attorney/Review"),
 *   prompt: "Walk me through my waiting review questions."
 * })
 * console.log(link.prompt) // "Walk me through my waiting review questions."
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NoticeClaudeLink extends S.Opaque<NoticeClaudeLink, { readonly brand: unique symbol }>()(
  S.Struct({
    folder: NoticeClaudeFolder.annotateKey({
      description: "Folder on the attorney's PC that Claude Code opens in; \\ or / separators.",
    }),
    prompt: S.NonEmptyString.check(
      S.isMaxLength(
        CLAUDE_LINK_PROMPT_MAX_LENGTH,
        $I.annote("NoticeClaudeLinkPromptMaxLengthCheck", {
          title: "Notice Claude Link Prompt Max Length",
          description: "A request of at most 5,000 characters, the most the Claude Code link's q parameter carries.",
          message: "The Claude Code request must be at most 5,000 characters.",
        })
      )
    ).annotateKey({
      description: "Request Claude Code types in that folder; the attorney presses Enter to send it.",
    }),
  }).pipe(
    $I.annoteSchema("NoticeClaudeLink", {
      description: "Folder and typed request of the notice's Claude Code link.",
    })
  )
) {}

/**
 * The attorney's mailbox the notice goes from and to, the data directory its
 * day claims are kept in, and an optional Claude Code link.
 *
 * **Details**
 *
 * Without `claudeLink` the notice is plain text. With it, the notice is HTML
 * that adds an "Answer them in Claude Code" link and a sentence naming the
 * folder and the request for when the link does not open. `make` defaults
 * `claudeLink` to none.
 *
 * **Example** (Decode a notice config)
 *
 * ```ts
 * import { NoticeMailboxConfig } from "@beep/law-practice-server/NoticeMailbox"
 * import * as S from "effect/Schema"
 *
 * const config = S.decodeUnknownOption(NoticeMailboxConfig)({
 *   mailbox: "attorney@example.test",
 *   dataDirectory: "/var/lib/practice-review-hub"
 * })
 * console.log(config._tag) // "Some"
 * ```
 *
 * **Example** (Decode a notice config with a Claude Code link)
 *
 * ```ts
 * import { NoticeMailboxConfig } from "@beep/law-practice-server/NoticeMailbox"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const config = S.decodeUnknownSync(NoticeMailboxConfig)({
 *   mailbox: "attorney@example.test",
 *   dataDirectory: "/var/lib/practice-review-hub",
 *   claudeLink: { folder: "C:/Users/attorney/Review", prompt: "Walk me through my waiting review questions." }
 * })
 * console.log(O.isSome(config.claudeLink)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NoticeMailboxConfig extends S.Opaque<NoticeMailboxConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    mailbox: M365MailAddress.annotateKey({
      description: "The attorney's mailbox address; the notice goes from it to itself. Never logged.",
    }),
    dataDirectory: S.NonEmptyString.annotateKey({
      description: "Directory whose notice-sent/ subdirectory holds one claim file per notice day.",
    }),
    claudeLink: NoticeClaudeLink.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Claude Code link the notice carries as HTML; absent, the notice is plain text.",
      })
    ),
  }).pipe(
    $I.annoteSchema("NoticeMailboxConfig", {
      description:
        "The attorney's mailbox the notice goes from and to, the directory of its day claims, and an optional Claude Code link.",
    })
  )
) {}

// The link Claude Code opens: the folder, with \ separators, as the working directory and the request as the
// typed-in prompt. Both are percent-encoded; htmlLink escapes the whole URL for the attribute.
const windowsFolder = Str.replaceAll("/", "\\");
const claudeCodeHref = (link: NoticeClaudeLink): string =>
  A.join(
    ["claude-cli://open?cwd=", encodeURIComponent(windowsFolder(link.folder)), "&q=", encodeURIComponent(link.prompt)],
    ""
  );

// The HTML notice is put together from fixed tags and escaped text only: htmlText escapes text, htmlLink escapes
// its URL and label, and htmlParagraph only joins pieces those two produced, so no value is formatted into markup.
const htmlParagraph = (pieces: ReadonlyArray<string>): string => A.join(["<p>", ...pieces, "</p>"], "");
const htmlText = escapeHtml;
const htmlLink = (href: string, label: string): string =>
  A.join(['<a href="', escapeHtml(href), '">', escapeHtml(label), "</a>"], "");

// The HTML notice: the count sentence first, so an inbox preview still shows only the count, then the link, the
// check to make before pressing Enter (a forged notice could type in a different request), and what to do when the
// link does not open.
const noticeHtml = (message: NoticeMessage, link: NoticeClaudeLink): string =>
  A.join(
    [
      htmlParagraph([htmlText(message.body)]),
      htmlParagraph([htmlLink(claudeCodeHref(link), "Answer them in Claude Code")]),
      htmlParagraph([
        htmlText("The link opens Claude Code with the request typed in. Check that it reads exactly: "),
        htmlText(link.prompt),
        htmlText(" Then press Enter. If it reads anything else, close Claude Code without pressing Enter."),
      ]),
      htmlParagraph([
        htmlText("If the link does not open, open Claude Code in "),
        htmlText(windowsFolder(link.folder)),
        htmlText(" and type: "),
        htmlText(link.prompt),
      ]),
    ],
    "\n"
  );

// Subdirectory of the data directory that holds one claim file per notice day.
const NOTICE_CLAIMS_DIRECTORY = "notice-sent";

const isAlreadyExists = (error: PlatformError): boolean => P.isTagged(error.reason, "AlreadyExists");

const failed =
  (operation: NoticeMailboxOperation) =>
  (cause: unknown): NoticeMailboxError =>
    NoticeMailboxError.make({ cause: O.some(cause), operation });

const makeNoticeMailbox = (
  m365: M365Shape,
  fs: FileSystem.FileSystem,
  path: Path.Path,
  config: NoticeMailboxConfig
) => {
  const userId = O.some(config.mailbox);

  const send = Effect.fn("NoticeMailbox.send")(
    function* (message: NoticeMessage) {
      const draft = yield* m365.createDraftMessage(
        M365CreateDraftMessageRequest.make({
          draft: M365MailDraft.make({
            subject: message.subject,
            body: O.match(config.claudeLink, {
              onNone: () => M365MailBody.make({ content: message.body, contentType: "text" }),
              onSome: (link) => M365MailBody.make({ content: noticeHtml(message, link), contentType: "html" }),
            }),
            toRecipients: [config.mailbox],
          }),
          userId,
        })
      );
      const messageId = yield* S.decodeEffect(GraphPathSegment)(draft.id);
      yield* m365.sendDraftMessage(M365SendDraftMessageRequest.make({ messageId, userId }));
    },
    Effect.mapError(failed("send"))
  );

  // One file per day, created exclusively: the run whose create succeeds owns the day, and every
  // other run that day, concurrent or later, finds the file and sends nothing.
  const claims = path.join(config.dataDirectory, NOTICE_CLAIMS_DIRECTORY);
  const claimDay = Effect.fn("NoticeMailbox.claimDay")(
    function* (day: LocalDate) {
      yield* fs.makeDirectory(claims, { recursive: true, mode: 0o700 });
      return yield* fs
        .writeFileString(path.join(claims, day.toISOString()), `${day.toISOString()}\n`, { flag: "wx", mode: 0o600 })
        .pipe(
          Effect.as(true),
          Effect.catchIf(isAlreadyExists, () => Effect.succeed(false))
        );
    },
    Effect.mapError(failed("claim"))
  );

  return NoticeMailbox.of({ claimDay, send });
};

/**
 * Build the `NoticeMailbox` port over `@beep/m365` and the local file system.
 *
 * **Details**
 *
 * `send` creates a draft in the configured mailbox, addressed to that same
 * mailbox, and sends it, so the notice uses no grant beyond the mailbox's own.
 * The draft is plain text, or HTML with an "Answer them in Claude Code" link
 * when the config has a `claudeLink`. `claimDay` creates `notice-sent/<YYYY-MM-DD>` in the data
 * directory with an exclusive create: the run whose create succeeds gets
 * `true`, and a run that finds the file gets `false`, so two runs on one day,
 * at the same time or not, claim it once. Every failure is a
 * `NoticeMailboxError` naming the operation.
 *
 * **Example** (Make the notice mailbox layer)
 *
 * ```ts
 * import { NoticeMailboxConfig, makeNoticeMailboxLayer } from "@beep/law-practice-server/NoticeMailbox"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const layer = O.map(
 *   S.decodeUnknownOption(NoticeMailboxConfig)({
 *     mailbox: "attorney@example.test",
 *     dataDirectory: "/var/lib/practice-review-hub"
 *   }),
 *   makeNoticeMailboxLayer
 * )
 * console.log(O.isSome(layer)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeNoticeMailboxLayer = (
  config: NoticeMailboxConfig
): Layer.Layer<NoticeMailbox, never, FileSystem.FileSystem | M365 | Path.Path> =>
  Layer.effect(
    NoticeMailbox,
    Effect.gen(function* () {
      const M3651 = yield* M365;
      const FileSystem2 = yield* FileSystem.FileSystem;
      const Path3 = yield* Path.Path;
      return makeNoticeMailbox(M3651, FileSystem2, Path3, config);
    })
  );
