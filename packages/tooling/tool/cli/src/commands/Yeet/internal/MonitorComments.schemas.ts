/**
 * Pull request comment shapes shared by the comment monitor and the watch
 * stream, with the bounded one-line excerpt both render.
 *
 * **Details**
 *
 * Split from `MonitorComments.ts` so the watch stream reads the comment
 * vocabulary without importing the comment monitor's `gh` reads
 * (beep-cli-composition W1b).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Fmt } from "@beep/cli-kit/Fmt";
import { $RepoCliId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoCliId.create("commands/Yeet/internal/MonitorComments.schemas");

/**
 * Normalized pull request review comment emitted by Yeet monitor.
 *
 * **Details**
 *
 * `authorType` is the REST account type of the author (`"User"`, `"Bot"`),
 * when the payload carried one; the two other comment variants carry it too.
 *
 * **Example** (Describe an inline review)
 *
 * ```ts
 * import { YeetMonitorReviewComment } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const comment = YeetMonitorReviewComment.make({
 *   author: "greptile-apps[bot]",
 *   body: "Please preserve the existing polling interval.",
 *   createdAt: "2026-08-04T12:00:01.000Z",
 *   id: 43,
 *   line: O.some(88),
 *   path: "src/Monitor.ts",
 *   url: "https://github.com/o/r/pull/1#discussion_r43",
 * })
 * console.log(comment.path) // src/Monitor.ts
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetMonitorReviewComment extends S.Opaque<YeetMonitorReviewComment, { readonly brand: unique symbol }>()(
  S.TaggedStruct("review", {
    author: S.String,
    body: S.String,
    createdAt: S.String,
    id: S.Finite,
    line: S.OptionFromNullOr(S.Finite),
    path: S.String,
    url: S.String,
    authorType: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("YeetMonitorReviewComment", {
      description: "Normalized GitHub inline review comment streamed during Yeet monitoring.",
    })
  )
) {}

/**
 * Normalized pull request conversation comment emitted by Yeet monitor.
 *
 * **Example** (Describe a conversation comment)
 *
 * ```ts
 * import { YeetMonitorIssueComment } from "@beep/repo-cli/test/Yeet"
 *
 * const comment = YeetMonitorIssueComment.make({
 *   author: "octocat",
 *   body: "The hosted checks are green.",
 *   createdAt: "2026-08-04T12:00:01.000Z",
 *   id: 44,
 *   url: "https://github.com/o/r/pull/1#issuecomment-44",
 * })
 * console.log(comment.author) // octocat
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetMonitorIssueComment extends S.Opaque<YeetMonitorIssueComment, { readonly brand: unique symbol }>()(
  S.TaggedStruct("issue", {
    author: S.String,
    body: S.String,
    createdAt: S.String,
    id: S.Finite,
    url: S.String,
    authorType: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("YeetMonitorIssueComment", {
      description: "Normalized GitHub pull request conversation comment streamed during Yeet monitoring.",
    })
  )
) {}

/**
 * The two stream members that belong to a review *thread* rather than a review.
 *
 * **Details**
 *
 * Surfaces keyed on a comment's path and id — the watch stream's
 * `comment-posted` rows above all — accept only these two. A review body has
 * no thread, no path and no line, so widening those rows to carry one would
 * mean inventing values for all three.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetMonitorThreadComment = YeetMonitorReviewComment | YeetMonitorIssueComment;

/**
 * Collapse whitespace in a comment body and bound its length for one line.
 *
 * **Details**
 *
 * Terminal control sequences are stripped before the whitespace collapse, so a
 * hostile comment body cannot smuggle escape codes into operator terminals.
 * Shared with `yeet status` thread triage, which strips bot badge markup first
 * and then bounds the surviving first line here — so both operator surfaces
 * sanitize and truncate identically instead of drifting apart.
 *
 * **Example** (Bound a long body)
 *
 * ```ts
 * import { yeetCommentExcerpt } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(yeetCommentExcerpt("please  add\na regression test", 12))
 * ```
 *
 * @param body - Raw comment text.
 * @param maxLength - Maximum characters before an ellipsis is appended.
 * @returns The single-line, bounded, control-sequence-free excerpt.
 * @category formatting
 * @since 0.0.0
 */
export const yeetCommentExcerpt: {
  (maxLength: number): (body: string) => string;
  (body: string, maxLength: number): string;
} = dual(2, (body: string, maxLength: number): string => {
  // GitHub comment text is attacker-controlled terminal input: no escape sequence or line break may reach a
  // [yeet] line, so a comment cannot spoof output, write the clipboard or make a link.
  const normalized = pipe(body, Fmt.stripControls, Str.replace(/\s+/gu, " "), Str.trim);
  return Str.length(normalized) <= maxLength ? normalized : `${pipe(normalized, Str.takeLeft(maxLength))}…`;
});
