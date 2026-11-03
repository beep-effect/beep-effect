/**
 * The notice-mailbox adapter over a fake `M365` mailbox and a real temporary
 * data directory for the day claims. No request leaves the process; the
 * mailbox, questions and notice here are synthetic.
 */

import { QuestionOption } from "@beep/law-practice-domain/values/Question";
import { ReviewItem } from "@beep/law-practice-domain/values/ReviewItem";
import {
  makeNoticeMailboxLayer,
  NoticeClaudeFolder,
  NoticeClaudeLink,
  NoticeMailboxConfig,
} from "@beep/law-practice-server/NoticeMailbox";
import { DailyNotice, DailyNoticeLive, NoticeMailbox, NoticeMessage } from "@beep/law-practice-use-cases/DailyNotice";
import { GraphMessage } from "@beep/m365";
import { LocalDate } from "@beep/schema/LocalDate";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeM365Stub, oneRun, Platform, serviceOf, temporaryDirectory } from "./MailTagging.adapters.fixture.ts";
import type { M365CreateDraftMessageRequest, M365SendDraftMessageRequest } from "@beep/m365";

const MAILBOX = "attorney@example.test";

type Calls = {
  readonly drafts: ReadonlyArray<M365CreateDraftMessageRequest>;
  readonly sends: ReadonlyArray<M365SendDraftMessageRequest>;
};

// Records every draft and send; each draft gets the next id.
const fakeMailbox = (calls: Ref.Ref<Calls>) =>
  makeM365Stub({
    createDraftMessage: (request) =>
      Ref.modify(calls, (current) => {
        const draft = GraphMessage.make({ id: `draft-${A.length(current.drafts) + 1}` });
        const next: readonly [GraphMessage, Calls] = [draft, { ...current, drafts: A.append(current.drafts, request) }];
        return next;
      }),
    sendDraftMessage: (request) =>
      Ref.update(calls, (current) => ({ ...current, sends: A.append(current.sends, request) })),
  });

// Without a link the config is made with no claudeLink key at all, as configs written before the link are.
const mailboxConfig = (dataDirectory: string, claudeLink: O.Option<NoticeClaudeLink>) =>
  O.match(claudeLink, {
    onNone: () => NoticeMailboxConfig.make({ mailbox: MAILBOX, dataDirectory }),
    onSome: (link) => NoticeMailboxConfig.make({ mailbox: MAILBOX, dataDirectory, claudeLink: O.some(link) }),
  });

const mailboxLayer = (dataDirectory: string, calls: Ref.Ref<Calls>, claudeLink = O.none<NoticeClaudeLink>()) =>
  makeNoticeMailboxLayer(mailboxConfig(dataDirectory, claudeLink)).pipe(Layer.provide(fakeMailbox(calls)));

// A folder and a request with every character the HTML body must escape: &, ', < and >.
const LINK_FOLDER = "C:/Users/attorney/Review & Notes";
const LINK_PROMPT = "Walk me through the examiner's <b>office action</b> & dates.";

// The exact HTML body for LINK_FOLDER and LINK_PROMPT. In the href, & between the parameters and the ' that
// encodeURIComponent leaves alone are escaped; the folder is shown and linked with \ separators.
const LINK_HTML = A.join(
  [
    "<p>2 questions are waiting in Claude.</p>",
    '<p><a href="claude-cli://open?cwd=C%3A%5CUsers%5Cattorney%5CReview%20%26%20Notes&amp;q=Walk%20me%20through%20the%20examiner&#39;s%20%3Cb%3Eoffice%20action%3C%2Fb%3E%20%26%20dates.">Answer them in Claude Code</a></p>',
    "<p>The link opens Claude Code with the request typed in. Check that it reads exactly: Walk me through the examiner&#39;s &lt;b&gt;office action&lt;/b&gt; &amp; dates. Then press Enter. If it reads anything else, close Claude Code without pressing Enter.</p>",
    "<p>If the link does not open, open Claude Code in C:\\Users\\attorney\\Review &amp; Notes and type: Walk me through the examiner&#39;s &lt;b&gt;office action&lt;/b&gt; &amp; dates.</p>",
  ],
  "\n"
);

// Reverses escapeHtml, so the href can be read back the way a mail client reads the attribute.
const unescapeHtml = flow(
  Str.replaceAll("&#39;", "'"),
  Str.replaceAll("&quot;", '"'),
  Str.replaceAll("&gt;", ">"),
  Str.replaceAll("&lt;", "<"),
  Str.replaceAll("&amp;", "&")
);

const noCalls = () => Ref.make<Calls>({ drafts: [], sends: [] });

const day = (dayOfMonth: number) => LocalDate.make({ year: 2026, month: 10, day: dayOfMonth });

const question = ReviewItem.cases.question.make({
  itemId: "question:notice-race",
  text: "Is the synthetic reply due on December 1?",
  sourceRefs: [],
  facts: [],
  options: [
    QuestionOption.make({ optionId: "due-december-1", label: "Yes, December 1" }),
    QuestionOption.make({ optionId: "not-a-deadline", label: "It is not a deadline" }),
  ],
});

describe("@beep/law-practice-server NoticeMailbox", () => {
  it.layer(Platform, { timeout: "10 seconds" })("over a temporary data directory", (it) => {
    it.effect("sends from the mailbox to itself", () =>
      oneRun(
        Effect.gen(function* () {
          const calls = yield* noCalls();
          const argument = serviceOf(NoticeMailbox);
          const temporaryDirectory2 = yield* temporaryDirectory;
          const mailbox = yield* argument(mailboxLayer(temporaryDirectory2, calls));

          yield* mailbox.send(
            NoticeMessage.make({ subject: "Claude: 2 questions waiting", body: "2 questions are waiting in Claude." })
          );

          const { drafts, sends } = yield* Ref.get(calls);
          expect(
            A.map(drafts, ({ draft, userId }) => [
              draft.subject,
              draft.body.content,
              draft.body.contentType,
              draft.toRecipients,
              O.getOrElse(userId, () => "no user id"),
            ])
          ).toStrictEqual([
            ["Claude: 2 questions waiting", "2 questions are waiting in Claude.", "text", [MAILBOX], MAILBOX],
          ]);
          expect(A.map(sends, ({ messageId }) => messageId)).toStrictEqual(["draft-1"]);
        })
      )
    );

    it.effect("sends HTML with an Answer them in Claude Code link when the config has one", () =>
      oneRun(
        Effect.gen(function* () {
          const calls = yield* noCalls();
          const link = NoticeClaudeLink.make({ folder: NoticeClaudeFolder.make(LINK_FOLDER), prompt: LINK_PROMPT });
          const argument1 = serviceOf(NoticeMailbox);
          const temporaryDirectory3 = yield* temporaryDirectory;
          const mailbox = yield* argument1(mailboxLayer(temporaryDirectory3, calls, O.some(link)));

          yield* mailbox.send(
            NoticeMessage.make({ subject: "Claude: 2 questions waiting", body: "2 questions are waiting in Claude." })
          );

          const { drafts, sends } = yield* Ref.get(calls);
          const draft = O.getOrThrow(A.head(drafts)).draft;
          const href = O.getOrThrow(O.flatMap(Str.match(/href="([^"]*)"/u)(draft.body.content), A.get(1)));
          const url = new URL(unescapeHtml(href));

          expect([A.length(drafts), draft.subject, draft.body.contentType, draft.toRecipients]).toStrictEqual([
            1,
            "Claude: 2 questions waiting",
            "html",
            [MAILBOX],
          ]);
          expect(draft.body.content).toBe(LINK_HTML);
          expect(Str.includes("<b>")(draft.body.content)).toBe(false);
          expect([url.protocol, url.host, url.searchParams.get("cwd"), url.searchParams.get("q")]).toStrictEqual([
            "claude-cli:",
            "open",
            "C:\\Users\\attorney\\Review & Notes",
            LINK_PROMPT,
          ]);
          expect(A.map(sends, ({ messageId }) => messageId)).toStrictEqual(["draft-1"]);
        })
      )
    );

    it.effect("refuses a Claude Code folder the link's cwd cannot open", () =>
      Effect.sync(() => {
        expect(
          A.map(
            [
              "C:\\Users\\attorney\\Review",
              "C:/Users/attorney/Review",
              "C:Review",
              "Review",
              "/srv/review",
              "C:/Users/attorney/../Review",
              "C:\\Users\\attorney\\..\\Review",
              "C:/Users/./Review",
              "C:/Users/attorney/Review\u202E",
              "C:/Users/attorney/Re\u200Bview",
              "C:/Users/attorney/Re\tview",
            ],
            S.is(NoticeClaudeFolder)
          )
        ).toStrictEqual([true, true, false, false, false, false, false, false, false, false, false]);
      })
    );

    it.effect("refuses a Claude Code request longer than the link carries", () =>
      Effect.sync(() => {
        const linkOf = (prompt: string) => ({ folder: "C:/Users/attorney/Review", prompt });
        expect(
          A.map([linkOf(Str.repeat(5_000)("a")), linkOf(Str.repeat(5_001)("a"))], S.is(NoticeClaudeLink))
        ).toStrictEqual([true, false]);
      })
    );

    it.effect("defaults claudeLink to none and leaves the key out when encoding", () =>
      Effect.gen(function* () {
        const plain = { mailbox: MAILBOX, dataDirectory: "/synthetic/review-hub" };
        const made = NoticeMailboxConfig.make(plain);
        const decoded = yield* S.decodeEffect(NoticeMailboxConfig)(plain);

        assertNone(made.claudeLink);
        assertNone(decoded.claudeLink);
        expect({ ...(yield* S.encodeEffect(NoticeMailboxConfig)(decoded)) }).toStrictEqual(plain);
      })
    );

    it.effect("claims each day once, as one file under notice-sent", () =>
      oneRun(
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const dataDirectory = yield* temporaryDirectory;
          const argument2 = serviceOf(NoticeMailbox);
          const noCalls4 = yield* noCalls();
          const mailbox = yield* argument2(mailboxLayer(dataDirectory, noCalls4));

          const claims = yield* Effect.all([
            mailbox.claimDay(day(14)),
            mailbox.claimDay(day(14)),
            mailbox.claimDay(day(15)),
          ]);
          const files = yield* (yield* FileSystem.FileSystem).readDirectory(path.join(dataDirectory, "notice-sent"));

          expect(claims).toStrictEqual([true, false, true]);
          expect(A.sort(files, Str.Order)).toStrictEqual(["2026-10-14", "2026-10-15"]);
        })
      )
    );

    it.effect("sends exactly once when two runs on the same day race", () =>
      oneRun(
        Effect.gen(function* () {
          const calls = yield* noCalls();
          const argument3 = serviceOf(DailyNotice);
          const temporaryDirectory5 = yield* temporaryDirectory;
          const notice = yield* argument3(
            DailyNoticeLive.pipe(Layer.provide(mailboxLayer(temporaryDirectory5, calls)))
          );

          const outcomes = yield* Effect.all(
            [
              notice.sendIfDue({ digest: [question], today: day(14) }),
              notice.sendIfDue({ digest: [question], today: day(14) }),
            ],
            { concurrency: 2 }
          );

          expect(
            A.sort(
              A.map(outcomes, ({ status }) => status),
              Str.Order
            )
          ).toStrictEqual(["already-sent", "sent"]);
          expect(A.length((yield* Ref.get(calls)).drafts)).toBe(1);
        })
      )
    );

    it.effect("fails the claim when the data directory cannot hold claims", () =>
      oneRun(
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const temporaryDirectory1 = yield* temporaryDirectory;
          const notADirectory = path.join(temporaryDirectory1, "data-file");
          yield* (yield* FileSystem.FileSystem).writeFileString(notADirectory, "not a directory\n");
          const argument4 = serviceOf(NoticeMailbox);
          const noCalls6 = yield* noCalls();
          const mailbox = yield* argument4(mailboxLayer(notADirectory, noCalls6));

          const failure = yield* Effect.flip(mailbox.claimDay(day(14)));

          expect(failure.operation).toBe("claim");
        })
      )
    );
  });
});
