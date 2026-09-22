/**
 * What a pull request review thread still owes its reviewer.
 *
 * "Resolved" is not the same as "answered". GitHub lets the pull request author
 * resolve a thread and lets a reviewer keep typing into it afterwards, so a
 * thread can be closed on the author's say-so while a human reviewer's newest
 * comment sits in it unanswered. Counting only `isResolved: false` threads —
 * which every yeet surface did — reports that pull request as having nothing
 * outstanding, and the operator merges over a live objection.
 *
 * **Details**
 *
 * This module is the single structural rule the status gate, the watch stream,
 * the reply engine and the closeout collector all classify threads with. It is
 * pure and reads no comment bodies: the only inputs are who resolved the
 * thread, who the pull request author is, and who wrote the newest comment.
 * Body text is review data, never a control signal, so a thread's state can
 * never be changed by what a comment says.
 *
 * The four states separate the two things an operator confuses. A thread the
 * *author* resolved with a *human reviewer* speaking last is a follow-up: a
 * person is waiting, and it gates. The same thread with a *review bot*
 * speaking last is an acknowledgement — bots post confirmations onto threads
 * they never re-open — so it is printed and counted but owes nothing.
 * Everything else, including every thread whose participants cannot be
 * identified, is answered: unknown must not masquerade as a named blocker.
 *
 * **Gotchas**
 *
 * `resolvedBy` and a comment author's `login` are not drawn from the same
 * namespace for bots: GitHub reports `coderabbitai[bot]` as a resolver and
 * `coderabbitai` as a comment author. Only the comparison against the pull
 * request author matters here, and a pull request author is always a `User`,
 * so the two logins compare directly and the bot suffix never needs undoing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoCliId.create("commands/Yeet/internal/ReviewThreadState");

/**
 * Whether the newest comment on a review thread came from a person or a bot.
 *
 * **Details**
 *
 * Derived from GraphQL `author { __typename }`: GitHub reports `Bot` for an
 * app-authored comment and `User`/`Organization`/`Mannequin` otherwise. The
 * distinction carries the whole acknowledgement policy — a bot speaking last
 * on a thread the author resolved is a confirmation, a person speaking last is
 * an objection — so it is modelled as a closed domain rather than a raw
 * `__typename` string.
 *
 * **Example** (Check an author kind)
 *
 * ```ts
 * import { YeetReviewCommentAuthorKind } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetReviewCommentAuthorKind.is.bot("bot")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetReviewCommentAuthorKind = LiteralKit(["user", "bot"]).pipe(
  $I.annoteSchema("YeetReviewCommentAuthorKind", {
    title: "Yeet Review Comment Author Kind",
    description: "Whether a review thread's newest comment was written by a person or by a review bot.",
  })
);

/**
 * Whether the newest comment on a review thread came from a person or a bot.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetReviewCommentAuthorKind = typeof YeetReviewCommentAuthorKind.Type;

/**
 * Map GraphQL `author { __typename }` onto the closed author-kind domain.
 *
 * **Details**
 *
 * Total on purpose: GitHub's actor typenames are an open set (`User`, `Bot`,
 * `Organization`, `Mannequin`, and whatever it adds next), and only `Bot`
 * changes the outcome. Everything else — including an absent typename on a
 * query that did not ask for it — is treated as a person, which is the
 * conservative reading: a misread bot merely keeps a thread gating.
 *
 * **Example** (Classify a bot typename)
 *
 * ```ts
 * import { yeetReviewCommentAuthorKind } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(yeetReviewCommentAuthorKind(O.some("Bot"))) // "bot"
 * console.log(yeetReviewCommentAuthorKind(O.none())) // "user"
 * ```
 *
 * @param typename - The GraphQL `__typename` of the comment's author, when the query asked for it.
 * @returns `"bot"` for a GitHub App actor, `"user"` for every other or unknown actor.
 * @category utilities
 * @since 0.0.0
 */
export const yeetReviewCommentAuthorKind = (typename: O.Option<string>): YeetReviewCommentAuthorKind =>
  O.exists(typename, (value) => Str.Equivalence(value, "Bot"))
    ? YeetReviewCommentAuthorKind.Enum.bot
    : YeetReviewCommentAuthorKind.Enum.user;

/**
 * The newest comment on a review thread, reduced to what the rule reads.
 *
 * **Details**
 *
 * Deliberately body-free. The derivation needs to know *who* spoke last and
 * *when*, never *what* they said, so the shape that reaches it cannot carry a
 * body for a future rule to start reading.
 *
 * **Example** (Make a bot's newest comment)
 *
 * ```ts
 * import { YeetReviewThreadNewestComment } from "@beep/repo-cli/test/Yeet"
 *
 * const comment = YeetReviewThreadNewestComment.make({ authorLogin: "coderabbitai", authorKind: "bot" })
 * console.log(comment.authorKind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetReviewThreadNewestComment extends S.Class<YeetReviewThreadNewestComment>(
  $I`YeetReviewThreadNewestComment`
)(
  {
    authorLogin: S.String,
    authorKind: YeetReviewCommentAuthorKind,
    createdAt: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("YeetReviewThreadNewestComment", {
    description: "The newest comment on a review thread, reduced to its author and timestamp.",
  })
) {}

/**
 * Everything the thread-state rule reads about one review thread.
 *
 * **Details**
 *
 * One class rather than a positional argument list because four of the eight
 * fields are optional and three of them are logins: a caller that transposes
 * `resolvedBy` and `pullRequestAuthor` would silently invert the gate. Every
 * field is structural GraphQL metadata; nothing here is comment text.
 *
 * **Example** (Describe an unresolved thread)
 *
 * ```ts
 * import { YeetReviewThreadStateInput } from "@beep/repo-cli/test/Yeet"
 *
 * const input = YeetReviewThreadStateInput.make({
 *   threadId: "PRRT_1",
 *   isResolved: false,
 *   isOutdated: false,
 * })
 * console.log(input.isResolved)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetReviewThreadStateInput extends S.Class<YeetReviewThreadStateInput>($I`YeetReviewThreadStateInput`)(
  {
    threadId: S.String,
    isResolved: S.Boolean,
    isOutdated: S.Boolean,
    path: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    line: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    pullRequestAuthor: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    resolvedBy: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    newestComment: YeetReviewThreadNewestComment.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("YeetReviewThreadStateInput", {
    description: "The structural review-thread metadata the thread-state rule classifies.",
  })
) {}

/**
 * A review thread nobody has resolved.
 *
 * @category models
 * @since 0.0.0
 */
export class ThreadUnresolved extends S.Class<ThreadUnresolved>($I`ThreadUnresolved`)(
  {
    state: S.tag("unresolved"),
    threadId: S.String,
    path: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    line: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    isOutdated: S.Boolean,
  },
  $I.annote("ThreadUnresolved", {
    description: "A review thread still open on the pull request.",
  })
) {}

/**
 * A resolved review thread that owes nothing.
 *
 * **Details**
 *
 * Three different shapes land here: a thread a reviewer closed themselves, a
 * thread whose newest comment is the pull request author's own reply, and a
 * thread whose participants could not be identified. The last is the doctrine
 * case — an unknown resolver or an unknown author is not evidence of an open
 * objection, so it must not block a merge.
 *
 * @category models
 * @since 0.0.0
 */
export class ThreadResolvedAnswered extends S.Class<ThreadResolvedAnswered>($I`ThreadResolvedAnswered`)(
  {
    state: S.tag("resolved-answered"),
    threadId: S.String,
    path: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    line: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    isOutdated: S.Boolean,
  },
  $I.annote("ThreadResolvedAnswered", {
    description: "A resolved review thread with no unanswered reviewer comment.",
  })
) {}

/**
 * A thread the author resolved that a human reviewer has since spoken on.
 *
 * **Details**
 *
 * The state the whole module exists for, and the only resolved state that
 * gates: a person objected after the author closed the thread, and no
 * unresolved-thread count would ever surface it. `yeet reply` answers these by
 * posting without re-resolving.
 *
 * @category models
 * @since 0.0.0
 */
export class ThreadResolvedFollowUp extends S.Class<ThreadResolvedFollowUp>($I`ThreadResolvedFollowUp`)(
  {
    state: S.tag("resolved-follow-up"),
    threadId: S.String,
    path: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    line: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    isOutdated: S.Boolean,
    followUpAuthor: S.String,
    followUpAt: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("ThreadResolvedFollowUp", {
    description: "A thread the pull request author resolved that a human reviewer has commented on since.",
  })
) {}

/**
 * A thread the author resolved that a review bot has since confirmed on.
 *
 * **Details**
 *
 * Review bots post a confirmation onto threads they never re-open, so their
 * last word is a receipt rather than an objection. Listed and counted so the
 * operator can see it, never gating and never owed a reply.
 *
 * @category models
 * @since 0.0.0
 */
export class ThreadResolvedAcknowledged extends S.Class<ThreadResolvedAcknowledged>($I`ThreadResolvedAcknowledged`)(
  {
    state: S.tag("resolved-acknowledged"),
    threadId: S.String,
    path: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    line: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    isOutdated: S.Boolean,
    followUpAuthor: S.String,
    followUpAt: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("ThreadResolvedAcknowledged", {
    description: "A thread the pull request author resolved that a review bot has acknowledged since.",
  })
) {}

/**
 * What one pull request review thread still owes.
 *
 * **Example** (Decode an unresolved thread state)
 *
 * ```ts
 * import { YeetReviewThreadState } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(YeetReviewThreadState)({
 *   state: "unresolved",
 *   threadId: "PRRT_1",
 *   isOutdated: false,
 * })
 * console.log(decoded)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetReviewThreadState = S.Union([
  ThreadUnresolved,
  ThreadResolvedAnswered,
  ThreadResolvedFollowUp,
  ThreadResolvedAcknowledged,
]).pipe(
  S.toTaggedUnion("state"),
  $I.annoteSchema("YeetReviewThreadState", {
    description: "What one pull request review thread still owes its reviewer.",
  })
);

/**
 * What one pull request review thread still owes.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetReviewThreadState = typeof YeetReviewThreadState.Type;

/**
 * The tag alone of a classified review thread state.
 *
 * **Details**
 *
 * Surfaces that carry a thread's classification without carrying the thread —
 * a watch snapshot row, a watch transition target — store this rather than the
 * whole union. It is declared as its own closed domain so those surfaces get
 * the same exhaustiveness and the same wire spelling as the union's own tags.
 * Every producer assigns a {@link YeetReviewThreadState}'s own `state` into
 * this domain, so a variant added to the union without a tag here fails to
 * typecheck at the assignment rather than drifting silently.
 *
 * **Example** (Recognise a gating tag)
 *
 * ```ts
 * import { YeetReviewThreadStateTag } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetReviewThreadStateTag.is["resolved-follow-up"]("resolved-follow-up")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetReviewThreadStateTag = LiteralKit([
  "unresolved",
  "resolved-answered",
  "resolved-follow-up",
  "resolved-acknowledged",
]).pipe(
  $I.annoteSchema("YeetReviewThreadStateTag", {
    title: "Yeet Review Thread State Tag",
    description: "The tag of one classified review thread state, carried where the whole state is not.",
  })
);

/**
 * The tag alone of a classified review thread state.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetReviewThreadStateTag = typeof YeetReviewThreadStateTag.Type;

const isThreadUnresolved = S.is(ThreadUnresolved);
const isThreadResolvedFollowUp = S.is(ThreadResolvedFollowUp);
const isThreadResolvedAcknowledged = S.is(ThreadResolvedAcknowledged);

/**
 * Per-state review thread tallies for one pull request.
 *
 * **Example** (Read an empty tally)
 *
 * ```ts
 * import { YeetReviewThreadStateCounts } from "@beep/repo-cli/test/Yeet"
 *
 * const counts = YeetReviewThreadStateCounts.make({ unresolved: 0, followUp: 0, acknowledged: 0, answered: 0 })
 * console.log(counts.followUp)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetReviewThreadStateCounts extends S.Class<YeetReviewThreadStateCounts>($I`YeetReviewThreadStateCounts`)(
  {
    unresolved: S.Finite,
    followUp: S.Finite,
    acknowledged: S.Finite,
    answered: S.Finite,
  },
  $I.annote("YeetReviewThreadStateCounts", {
    description: "How many of a pull request's review threads occupy each thread state.",
  })
) {}

/**
 * Classify one review thread from its structural metadata alone.
 *
 * **Details**
 *
 * The rule, in the order it is applied:
 *
 * 1. Not resolved — `unresolved`.
 * 2. Resolved, but the pull request author or the resolver is unknown —
 *    `resolved-answered`. Unknown is not a named blocker.
 * 3. Resolved by somebody other than the pull request author —
 *    `resolved-answered`. A reviewer closing their own thread owes nothing.
 * 4. Resolved by the author with no newest comment, or with the author's own
 *    comment newest — `resolved-answered`.
 * 5. Resolved by the author with a *bot* newest — `resolved-acknowledged`.
 * 6. Resolved by the author with a *person* newest — `resolved-follow-up`.
 *
 * **Gotchas**
 *
 * Never reads a comment body. A reviewer writing "resolved" or "LGTM" as their
 * last word still produces a follow-up, because the honest structural fact is
 * that a person spoke last and the author has not replied; the author clears
 * it by replying, not by the bot guessing at sentiment.
 *
 * **Example** (A reviewer's last word on a thread the author resolved)
 *
 * ```ts
 * import {
 *   deriveYeetReviewThreadState,
 *   YeetReviewThreadNewestComment,
 *   YeetReviewThreadStateInput,
 * } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const state = deriveYeetReviewThreadState(
 *   YeetReviewThreadStateInput.make({
 *     threadId: "PRRT_1",
 *     isResolved: true,
 *     isOutdated: false,
 *     pullRequestAuthor: O.some("kriegcloud"),
 *     resolvedBy: O.some("kriegcloud"),
 *     newestComment: O.some(
 *       YeetReviewThreadNewestComment.make({ authorLogin: "reviewer", authorKind: "user" })
 *     ),
 *   })
 * )
 * console.log(state.state) // "resolved-follow-up"
 * ```
 *
 * @param input - The structural metadata of one review thread.
 * @returns The thread state the merge gate, the reply engine and closeout all read.
 * @category utilities
 * @since 0.0.0
 */
export const deriveYeetReviewThreadState = (input: YeetReviewThreadStateInput): YeetReviewThreadState => {
  const located = { threadId: input.threadId, path: input.path, line: input.line, isOutdated: input.isOutdated };
  if (!input.isResolved) {
    return ThreadUnresolved.make({ state: "unresolved", ...located });
  }
  const answered = ThreadResolvedAnswered.make({ state: "resolved-answered", ...located });
  return pipe(
    input.pullRequestAuthor,
    O.flatMap((pullRequestAuthor) =>
      O.map(input.resolvedBy, (resolvedBy) => ({ pullRequestAuthor, resolvedBy }) as const)
    ),
    O.filter(({ pullRequestAuthor, resolvedBy }) => Str.Equivalence(pullRequestAuthor, resolvedBy)),
    O.flatMap(({ pullRequestAuthor }) =>
      pipe(
        input.newestComment,
        O.filter((comment) => !Str.Equivalence(comment.authorLogin, pullRequestAuthor))
      )
    ),
    O.match({
      onNone: () => answered,
      onSome: (comment) =>
        YeetReviewCommentAuthorKind.is.bot(comment.authorKind)
          ? ThreadResolvedAcknowledged.make({
              state: "resolved-acknowledged",
              ...located,
              followUpAuthor: comment.authorLogin,
              followUpAt: comment.createdAt,
            })
          : ThreadResolvedFollowUp.make({
              state: "resolved-follow-up",
              ...located,
              followUpAuthor: comment.authorLogin,
              followUpAt: comment.createdAt,
            }),
    })
  );
};

/**
 * Whether a thread state still owes the pull request work before a merge.
 *
 * **Details**
 *
 * Exactly the two gating states: `unresolved` and `resolved-follow-up`. An
 * acknowledgement is reported but never outstanding, which is what keeps a
 * review bot's confirmation from holding a green pull request open.
 *
 * **Example** (An acknowledgement owes nothing)
 *
 * ```ts
 * import { ThreadUnresolved, yeetReviewThreadStateOutstanding } from "@beep/repo-cli/test/Yeet"
 *
 * const unresolved = ThreadUnresolved.make({ state: "unresolved", threadId: "PRRT_1", isOutdated: false })
 * console.log(yeetReviewThreadStateOutstanding(unresolved)) // true
 * ```
 *
 * @param state - One classified review thread state.
 * @returns `true` when the thread blocks merge readiness.
 * @category utilities
 * @since 0.0.0
 */
export const yeetReviewThreadStateOutstanding = (state: YeetReviewThreadState): boolean =>
  isThreadUnresolved(state) || isThreadResolvedFollowUp(state);

/**
 * Tally classified review threads by state.
 *
 * **Example** (Tally a single unresolved thread)
 *
 * ```ts
 * import { ThreadUnresolved, summarizeYeetReviewThreadStates } from "@beep/repo-cli/test/Yeet"
 *
 * const counts = summarizeYeetReviewThreadStates([
 *   ThreadUnresolved.make({ state: "unresolved", threadId: "PRRT_1", isOutdated: false }),
 * ])
 * console.log(counts.unresolved) // 1
 * ```
 *
 * @param states - Every classified review thread of one pull request.
 * @returns Per-state tallies for the status render block and the closeout report.
 * @category utilities
 * @since 0.0.0
 */
export const summarizeYeetReviewThreadStates = (
  states: ReadonlyArray<YeetReviewThreadState>
): YeetReviewThreadStateCounts => {
  const unresolved = A.filter(states, isThreadUnresolved).length;
  const followUp = A.filter(states, isThreadResolvedFollowUp).length;
  const acknowledged = A.filter(states, isThreadResolvedAcknowledged).length;
  return YeetReviewThreadStateCounts.make({
    unresolved,
    followUp,
    acknowledged,
    answered: states.length - unresolved - followUp - acknowledged,
  });
};
