/**
 * Pull request title resolution for Yeet publish.
 *
 * **Details**
 *
 * The squash-merge commit takes its subject from the pull request title, so
 * the title must never be a merge-commit subject. Publish titles the pull
 * request from the `--message` first line when one was given, otherwise from
 * the branch's first (oldest) non-merge commit subject. A pull request that
 * already exists keeps its title unless that title is a merge-commit subject,
 * in which case the next publish renames it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Effect, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { YeetCommandError } from "../Yeet.errors.ts";
import { runGitOutput } from "./GitExec.ts";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/process";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/PullRequestTitle");

// Git's own default merge subjects: `Merge branch 'x'`, `Merge branches 'a' and
// 'b'`, `Merge remote-tracking branch 'origin/main' into x`, `Merge pull request
// #1 from o/b`, `Merge commit 'sha'`, `Merge tag 'v1'`.
const MERGE_COMMIT_SUBJECT_PATTERN = /^Merge (?:branch(?:es)? |remote-tracking branch |pull request #|commit |tag )/u;

const SINGLE_LINE_PATTERN = /^[^\r\n]*$/u;

/**
 * A pull request title: one trimmed, non-empty line.
 *
 * **Example** (Decode a padded title)
 *
 * ```ts
 * import { YeetPullRequestTitle } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(YeetPullRequestTitle)("  feat(repo-cli): title  ")) // "feat(repo-cli): title"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const YeetPullRequestTitle = S.Trim.check(
  S.isNonEmpty({ message: "Pull request title must not be empty" }),
  S.isPattern(SINGLE_LINE_PATTERN, { message: "Pull request title must be a single line" })
).pipe(
  $I.annoteSchema("YeetPullRequestTitle", {
    description: "One trimmed, non-empty line used as a pull request title and squash-merge subject.",
  })
);

/**
 * Decoded type of {@link YeetPullRequestTitle}.
 *
 * @category models
 * @since 0.0.0
 */
export type YeetPullRequestTitle = typeof YeetPullRequestTitle.Type;

/**
 * Where a publish took the pull request title from.
 *
 * **Example** (Check a source literal)
 *
 * ```ts
 * import { YeetPullRequestTitleSource } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetPullRequestTitleSource.is.message("message")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const YeetPullRequestTitleSource = LiteralKit(["message", "first-non-merge-commit"]).pipe(
  $I.annoteSchema("YeetPullRequestTitleSource", {
    description:
      "Origin of a publish pull request title: the --message first line or the first non-merge commit subject.",
  })
);

/**
 * Type-level union of {@link YeetPullRequestTitleSource}.
 *
 * @category models
 * @since 0.0.0
 */
export type YeetPullRequestTitleSource = typeof YeetPullRequestTitleSource.Type;

/**
 * A resolved pull request title together with its source.
 *
 * **Example** (Build a message-sourced title)
 *
 * ```ts
 * import { YeetPullRequestTitleResolution } from "@beep/repo-cli/test/Yeet"
 *
 * const resolved = YeetPullRequestTitleResolution.make({ title: "feat(repo-cli): ship", source: "message" })
 * console.log(resolved.source) // "message"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class YeetPullRequestTitleResolution extends S.Class<YeetPullRequestTitleResolution>(
  $I`YeetPullRequestTitleResolution`
)(
  {
    title: YeetPullRequestTitle,
    source: YeetPullRequestTitleSource,
  },
  $I.annote("YeetPullRequestTitleResolution", {
    description: "The pull request title a publish resolved and where it came from.",
  })
) {}

/**
 * Outcome statuses of syncing an existing pull request's title on re-publish.
 *
 * **Example** (Check a status literal)
 *
 * ```ts
 * import { YeetPullRequestTitleSyncStatus } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetPullRequestTitleSyncStatus.is.updated("updated")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const YeetPullRequestTitleSyncStatus = LiteralKit(["kept", "updated", "failed"]).pipe(
  $I.annoteSchema("YeetPullRequestTitleSyncStatus", {
    description:
      "Whether a re-publish kept the existing pull request title, replaced a merge-commit subject, or failed to.",
  })
);

/**
 * Type-level union of {@link YeetPullRequestTitleSyncStatus}.
 *
 * @category models
 * @since 0.0.0
 */
export type YeetPullRequestTitleSyncStatus = typeof YeetPullRequestTitleSyncStatus.Type;

/**
 * Typed result of one re-publish title sync: a status plus the line already logged.
 *
 * **Example** (Build a kept outcome)
 *
 * ```ts
 * import { YeetPullRequestTitleSync } from "@beep/repo-cli/test/Yeet"
 *
 * const sync = YeetPullRequestTitleSync.make({ status: "kept", message: "pull request #7 keeps its title" })
 * console.log(sync.status) // "kept"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class YeetPullRequestTitleSync extends S.Class<YeetPullRequestTitleSync>($I`YeetPullRequestTitleSync`)(
  {
    status: YeetPullRequestTitleSyncStatus,
    message: S.String,
  },
  $I.annote("YeetPullRequestTitleSync", {
    description: "Outcome of syncing an existing pull request title during a re-publish.",
  })
) {}

/**
 * Whether a commit subject is one of git's default merge-commit subjects.
 *
 * **Example** (Recognise a remote-tracking merge)
 *
 * ```ts
 * import { isMergeCommitSubject } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(isMergeCommitSubject("Merge remote-tracking branch 'origin/main' into feat/x")) // true
 * console.log(isMergeCommitSubject("feat(repo-cli): merge strategy")) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isMergeCommitSubject = S.is(S.String.check(S.isPattern(MERGE_COMMIT_SUBJECT_PATTERN)));

const firstNonEmptyLine = (text: string): O.Option<string> =>
  pipe(Str.split(text, "\n"), A.map(Str.trim), A.findFirst(Str.isNonEmpty));

/**
 * The pull request title a `--message` carries: its first non-empty line.
 *
 * **Example** (Take the subject line of a full commit message)
 *
 * ```ts
 * import { titleFromMessage } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(titleFromMessage("feat(repo-cli): ship\n\nbody text"))) // "feat(repo-cli): ship"
 * console.log(O.isNone(titleFromMessage("  \n"))) // true
 * ```
 *
 * @param message - The full conventional commit message.
 * @returns The first non-empty trimmed line, or `None` for a blank message.
 * @category formatting
 * @since 0.0.0
 */
export const titleFromMessage = firstNonEmptyLine;

/**
 * Resolve the title a publish gives its pull request.
 *
 * **Details**
 *
 * The `--message` first line wins whenever one was given, even when publish
 * created no new commit (an amend, a push-only re-publish, or a branch whose
 * head is a merge commit). Without a message the title is the oldest
 * non-merge commit subject in `range`; a range with no non-merge commit is a
 * typed error that names the `--message` remedy instead of titling the pull
 * request after a merge commit.
 *
 * **Example** (Prefer the message over git history)
 *
 * ```ts
 * import { resolvePullRequestTitle, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main", branch: "feature/x", cwd: ".", head: "HEAD", originalArgv: [],
 *   packetDir: ".beep/yeet", repoRoot: ".", turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 * const resolved = resolvePullRequestTitle(context, O.some("feat(repo-cli): ship\n\nbody"), "abc123..HEAD")
 * console.log(Effect.isEffect(resolved)) // true
 * ```
 *
 * @param context - Repo context whose root runs git.
 * @param message - The publish `--message`, when one was given.
 * @param range - The branch commit range (`<merge-base>..HEAD`, or `HEAD`).
 * @returns The resolved title and its source.
 * @category workflows
 * @since 0.0.0
 */
export const resolvePullRequestTitle = Effect.fn("Yeet.resolvePullRequestTitle")(function* (
  context: RepoRunContext,
  message: O.Option<string>,
  range: string
): Effect.fn.Return<
  YeetPullRequestTitleResolution,
  YeetCommandError,
  Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
> {
  const fromMessage = O.flatMap(message, titleFromMessage);
  if (O.isSome(fromMessage)) {
    return YeetPullRequestTitleResolution.make({ title: fromMessage.value, source: "message" });
  }
  const args = ["log", "--no-merges", "--reverse", "--pretty=%s", range];
  const subjects = yield* runGitOutput(context.repoRoot, args);
  return yield* O.match(firstNonEmptyLine(subjects), {
    onNone: () =>
      YeetCommandError.make({
        message: `yeet publish found no non-merge commit in ${range} to title the pull request; pass --message "<conventional subject>".`,
        command: `git ${A.join(args, " ")}`,
        exitCode: 1,
      }),
    onSome: (title) => Effect.succeed(YeetPullRequestTitleResolution.make({ title, source: "first-non-merge-commit" })),
  });
});
