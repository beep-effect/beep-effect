/**
 * Predict the squash commit message GitHub writes for a pull request and lint
 * it with the repo's commitlint before the merge gate decides.
 *
 * **Details**
 *
 * `main` is PR-only and every PR is squash-merged, so the commit that reaches
 * `main` is composed server-side from the pull request, not from any commit a
 * PR-head Commitlint run ever saw. The main lint range is previous-main..new-main,
 * so a squash message that fails `commitlint.config.ts` turns the required
 * Commitlint check red on `main` with nothing but the next merge to clear it
 * (episode ep47, 2026-10-19: a 102-character `* <subject>` bullet from a
 * round-2 commit). {@link predictSquashCommitMessage} is the pure model of
 * GitHub's composition under the repository's `squash_merge_commit_title` /
 * `squash_merge_commit_message` settings, recorded from merged squashes on
 * `main`; {@link lintSquashCommitMessage} runs the same `bunx commitlint` the
 * `commitlint` CI lane runs, on that prediction, over stdin.
 *
 * **Gotchas**
 *
 * The merge gate pins `commit_title` to `<PR title> (#n)` when it merges, so
 * the title the repository setting would compose is overridden there; the
 * reader passes that pinned title and the setting only shapes the body. GitHub
 * also appends normalized `Co-authored-by:` trailers after the `---------`
 * separator for some merges; they are shorter than any commitlint limit and
 * the prediction leaves them out.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { decodeYeetGhOutput, yeetGh } from "./GhCall.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { YeetCommandError } from "../Yeet.errors.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/SquashCommitlint");

/**
 * The repository's `squash_merge_commit_title` setting: where GitHub takes the
 * default squash title from when the merge does not pin one.
 *
 * **Example** (Narrow a title default)
 *
 * ```ts
 * import { GitHubSquashTitleDefault } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(GitHubSquashTitleDefault.is.COMMIT_OR_PR_TITLE("COMMIT_OR_PR_TITLE")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GitHubSquashTitleDefault = LiteralKit(["PR_TITLE", "COMMIT_OR_PR_TITLE"]).pipe(
  $I.annoteSchema("GitHubSquashTitleDefault", {
    description: "GitHub's squash_merge_commit_title repository setting.",
  })
);

/**
 * The repository's `squash_merge_commit_title` setting.
 *
 * @category models
 * @since 0.0.0
 */
export type GitHubSquashTitleDefault = typeof GitHubSquashTitleDefault.Type;

/**
 * The repository's `squash_merge_commit_message` setting: where GitHub takes
 * the default squash body from.
 *
 * **Example** (Narrow a message default)
 *
 * ```ts
 * import { GitHubSquashMessageDefault } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(GitHubSquashMessageDefault.is.COMMIT_MESSAGES("COMMIT_MESSAGES")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GitHubSquashMessageDefault = LiteralKit(["PR_BODY", "COMMIT_MESSAGES", "BLANK"]).pipe(
  $I.annoteSchema("GitHubSquashMessageDefault", {
    description: "GitHub's squash_merge_commit_message repository setting.",
  })
);

/**
 * The repository's `squash_merge_commit_message` setting.
 *
 * @category models
 * @since 0.0.0
 */
export type GitHubSquashMessageDefault = typeof GitHubSquashMessageDefault.Type;

/**
 * Both squash defaults of a repository, as `GET repos/{owner}/{repo}` reports them.
 *
 * **Example** (This repository's recorded settings)
 *
 * ```ts
 * import { GitHubSquashDefaults } from "@beep/repo-cli/test/Yeet"
 *
 * const defaults = GitHubSquashDefaults.make({ title: "COMMIT_OR_PR_TITLE", message: "COMMIT_MESSAGES" })
 * console.log(defaults.message) // "COMMIT_MESSAGES"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GitHubSquashDefaults extends S.Opaque<GitHubSquashDefaults, { readonly brand: unique symbol }>()(
  S.Struct({ title: GitHubSquashTitleDefault, message: GitHubSquashMessageDefault }).pipe(
    $I.annoteSchema("GitHubSquashDefaults", {
      description: "The repository's squash merge title and message defaults.",
    })
  )
) {}

/**
 * GitHub's own "Default message" squash setting, used when the repository
 * payload omits either field.
 *
 * **Example** (Read the fallback)
 *
 * ```ts
 * import { GITHUB_SQUASH_DEFAULTS_FALLBACK } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(GITHUB_SQUASH_DEFAULTS_FALLBACK.title) // "COMMIT_OR_PR_TITLE"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const GITHUB_SQUASH_DEFAULTS_FALLBACK = GitHubSquashDefaults.make({
  title: "COMMIT_OR_PR_TITLE",
  message: "COMMIT_MESSAGES",
});

/**
 * Everything GitHub composes a squash message from, plus the title the merge
 * pins when it does.
 *
 * **Details**
 *
 * `commitMessages` are the full messages of the pull request's commits in
 * order (subject, blank line, body, trailers), as `pulls/{n}/commits` returns
 * them. `commitTitle` is the `commit_title` the merge request will send; the
 * merge gate always pins `<PR title> (#n)`, so it is `Some` there. With `None`
 * the title follows `defaults.title` the way GitHub's own button does.
 *
 * **Example** (Describe a two-commit pull request)
 *
 * ```ts
 * import { GitHubSquashDefaults, SquashMessageSource } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const source = SquashMessageSource.make({
 *   prNumber: 1913,
 *   title: "docs(doctrine): admit Codex as step 2",
 *   body: "Summary",
 *   commitMessages: ["docs(doctrine): admit Codex as step 2\n\nWhy.", "chore(doctrine): re-request review"],
 *   defaults: GitHubSquashDefaults.make({ title: "COMMIT_OR_PR_TITLE", message: "COMMIT_MESSAGES" }),
 *   commitTitle: O.none(),
 * })
 * console.log(source.commitMessages.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SquashMessageSource extends S.Opaque<SquashMessageSource, { readonly brand: unique symbol }>()(
  S.Struct({
    prNumber: S.Finite,
    title: S.String,
    body: S.String,
    commitMessages: S.Array(S.String),
    defaults: GitHubSquashDefaults,
    commitTitle: S.Option(S.String),
  }).pipe(
    $I.annoteSchema("SquashMessageSource", {
      description: "The pull request facts GitHub composes a squash commit message from.",
    })
  )
) {}

/**
 * The predicted squash commit: its header line and the body below it.
 *
 * **Example** (A one-line squash)
 *
 * ```ts
 * import { SquashCommitMessage } from "@beep/repo-cli/test/Yeet"
 *
 * const message = SquashCommitMessage.make({ header: "fix(x): y (#7)", body: "" })
 * console.log(message.header) // "fix(x): y (#7)"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SquashCommitMessage extends S.Opaque<SquashCommitMessage, { readonly brand: unique symbol }>()(
  S.Struct({ header: S.NonEmptyString, body: S.String }).pipe(
    $I.annoteSchema("SquashCommitMessage", {
      description: "The squash commit message GitHub is predicted to write: header and body.",
    })
  )
) {}

/**
 * The separator GitHub writes after the last commit bullet of a multi-commit squash body.
 *
 * **Example** (Read the separator)
 *
 * ```ts
 * import { GITHUB_SQUASH_BULLET_SEPARATOR } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(GITHUB_SQUASH_BULLET_SEPARATOR) // "---------"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const GITHUB_SQUASH_BULLET_SEPARATOR = "---------";

const firstLine = (message: string): string => A.headNonEmpty(Str.split("\n")(message));

// The commit message below its subject line, trimmed the way GitHub writes it.
const commitBody = (message: string): string => Str.trim(A.join(A.drop(Str.split("\n")(Str.trim(message)), 1), "\n"));

// Recorded from squashes on main (d23e463b03, 4ff36bacc8, 7be3407ae1): one
// commit contributes its body alone; several contribute `* <full message>`
// bullets, blank-line separated, closed by the `---------` separator.
const commitMessagesBody = (messages: ReadonlyArray<string>): string =>
  A.match(messages, {
    onEmpty: () => Str.empty,
    onNonEmpty: (all) =>
      A.length(all) === 1
        ? commitBody(A.headNonEmpty(all))
        : A.join([...A.map(all, (message) => `* ${Str.trim(message)}`), GITHUB_SQUASH_BULLET_SEPARATOR], "\n\n"),
  });

const defaultTitle = (source: SquashMessageSource): string =>
  GitHubSquashTitleDefault.match(source.defaults.title, {
    PR_TITLE: () => source.title,
    COMMIT_OR_PR_TITLE: () =>
      A.length(source.commitMessages) === 1 ? firstLine(Str.trim(source.commitMessages[0] ?? "")) : source.title,
  });

/**
 * Compose the squash commit message GitHub writes for this source, pure.
 *
 * **Details**
 *
 * Header: the pinned `commitTitle` when there is one, else the repository's
 * title default (`PR_TITLE`, or the single commit's subject under
 * `COMMIT_OR_PR_TITLE`) followed by ` (#n)`. Body: under `COMMIT_MESSAGES`, a
 * single commit's body alone, or one `* <full message>` bullet per commit
 * closed by `---------`; under `PR_BODY` the pull request description; under
 * `BLANK` nothing. An empty header (a blank title and no commits) falls back to
 * `(#n)` so the message is never empty.
 *
 * **Example** (The ep47 shape: a long round-2 subject becomes a long bullet)
 *
 * ```ts
 * import { GitHubSquashDefaults, predictSquashCommitMessage, SquashMessageSource } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const message = predictSquashCommitMessage(
 *   SquashMessageSource.make({
 *     prNumber: 1913,
 *     title: "docs(doctrine): admit Codex",
 *     body: "Summary",
 *     commitMessages: ["docs(doctrine): admit Codex\n\nWhy.", "chore(doctrine): re-request review"],
 *     defaults: GitHubSquashDefaults.make({ title: "COMMIT_OR_PR_TITLE", message: "COMMIT_MESSAGES" }),
 *     commitTitle: O.some("docs(doctrine): admit Codex (#1913)"),
 *   })
 * )
 * console.log(message.body.split("\n")[0]) // "* docs(doctrine): admit Codex"
 * ```
 *
 * @param source - The pull request facts and the pinned title.
 * @returns The predicted header and body.
 * @category workflows
 * @since 0.0.0
 */
export const predictSquashCommitMessage = (source: SquashMessageSource): SquashCommitMessage => {
  const title = O.getOrElse(source.commitTitle, () => Str.trim(`${defaultTitle(source)} (#${source.prNumber})`));
  const body = GitHubSquashMessageDefault.match(source.defaults.message, {
    PR_BODY: () => Str.trim(source.body),
    COMMIT_MESSAGES: () => commitMessagesBody(source.commitMessages),
    BLANK: () => Str.empty,
  });
  return SquashCommitMessage.make({ header: Str.isEmpty(title) ? `(#${source.prNumber})` : title, body });
};

/**
 * Render the message as the text commitlint reads: header, blank line, body.
 *
 * **Example** (Render a one-line squash)
 *
 * ```ts
 * import { renderSquashCommitMessage, SquashCommitMessage } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(renderSquashCommitMessage(SquashCommitMessage.make({ header: "fix(x): y (#7)", body: "" })))
 * // "fix(x): y (#7)"
 * ```
 *
 * @param message - The predicted message.
 * @returns The full commit message text.
 * @category formatting
 * @since 0.0.0
 */
export const renderSquashCommitMessage = (message: SquashCommitMessage): string =>
  Str.isEmpty(message.body) ? message.header : `${message.header}\n\n${message.body}`;

/**
 * The line limit `commitlint.config.ts` enforces on the header, body and footer
 * (`@commitlint/config-conventional` plus the repo's `body-max-line-length`).
 *
 * **Example** (Read the limit)
 *
 * ```ts
 * import { COMMITLINT_MAX_LINE_LENGTH } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(COMMITLINT_MAX_LINE_LENGTH) // 100
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const COMMITLINT_MAX_LINE_LENGTH = 100;

/**
 * The longest commit subject that survives the squash body: a subject becomes a
 * `* <subject>` bullet, two characters longer than itself.
 *
 * **Gotchas**
 *
 * The first commit subject usually also becomes the PR title (`yeet publish`
 * titles the PR from it), and the header is `<PR title> (#n)` against
 * `header-max-length` 100, so that subject has the tighter budget of
 * {@link squashPullRequestTitleMaxLength}: about 92 for a four-digit PR.
 *
 * **Example** (Read the subject budget)
 *
 * ```ts
 * import { SQUASH_COMMIT_SUBJECT_MAX_LENGTH } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(SQUASH_COMMIT_SUBJECT_MAX_LENGTH) // 98
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SQUASH_COMMIT_SUBJECT_MAX_LENGTH = COMMITLINT_MAX_LINE_LENGTH - 2;

/**
 * The longest PR title whose pinned header `<title> (#n)` stays within
 * `header-max-length`: the line limit minus the ` (#n)` suffix.
 *
 * **Example** (A four-digit PR leaves 92 characters)
 *
 * ```ts
 * import { squashPullRequestTitleMaxLength } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(squashPullRequestTitleMaxLength(1915)) // 92
 * ```
 *
 * @param prNumber - The pull request number the header suffix carries.
 * @returns The title budget in characters.
 * @category constants
 * @since 0.0.0
 */
export const squashPullRequestTitleMaxLength = (prNumber: number): number =>
  COMMITLINT_MAX_LINE_LENGTH - Str.length(` (#${prNumber})`);

/**
 * One line of the predicted message that is longer than the commitlint limit.
 *
 * **Example** (Describe a long bullet)
 *
 * ```ts
 * import { SquashCommitlintOffendingLine } from "@beep/repo-cli/test/Yeet"
 *
 * const line = SquashCommitlintOffendingLine.make({ line: 7, length: 102, text: "* docs(doctrine): ..." })
 * console.log(line.line) // 7
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SquashCommitlintOffendingLine extends S.Opaque<
  SquashCommitlintOffendingLine,
  { readonly brand: unique symbol }
>()(
  S.Struct({ line: S.Finite, length: S.Finite, text: S.String }).pipe(
    $I.annoteSchema("SquashCommitlintOffendingLine", {
      description: "A predicted squash message line longer than the commitlint limit, 1-based.",
    })
  )
) {}

/**
 * Commitlint accepted the predicted message.
 *
 * **Example** (A pass)
 *
 * ```ts
 * import { SquashCommitlintPass } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(SquashCommitlintPass.make({})._tag) // "pass"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SquashCommitlintPass extends S.Opaque<SquashCommitlintPass, { readonly brand: unique symbol }>()(
  S.TaggedStruct("pass", {}).pipe(
    $I.annoteSchema("SquashCommitlintPass", { description: "Commitlint accepted the predicted squash message." })
  )
) {}

/**
 * Commitlint refused the predicted message: the rules it named and the lines
 * over the limit.
 *
 * **Example** (The ep47 failure)
 *
 * ```ts
 * import { SquashCommitlintFail, SquashCommitlintOffendingLine } from "@beep/repo-cli/test/Yeet"
 *
 * const fail = SquashCommitlintFail.make({
 *   rules: ["footer-max-line-length"],
 *   offendingLines: [SquashCommitlintOffendingLine.make({ line: 7, length: 102, text: "* docs(doctrine): ..." })],
 * })
 * console.log(fail.rules[0]) // "footer-max-line-length"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SquashCommitlintFail extends S.Opaque<SquashCommitlintFail, { readonly brand: unique symbol }>()(
  S.TaggedStruct("fail", {
    rules: S.NonEmptyArray(S.NonEmptyString),
    offendingLines: S.Array(SquashCommitlintOffendingLine),
  }).pipe(
    $I.annoteSchema("SquashCommitlintFail", {
      description: "Commitlint refused the predicted squash message, naming the rules and the lines over the limit.",
    })
  )
) {}

/**
 * Commitlint gave no verdict: it could not be spawned, or it exited without
 * naming a rule. The merge gate treats this as a hold, never as a pass.
 *
 * **Example** (A missing binary)
 *
 * ```ts
 * import { SquashCommitlintUnavailable } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(SquashCommitlintUnavailable.make({ detail: "bunx: command not found" })._tag) // "unavailable"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SquashCommitlintUnavailable extends S.Opaque<
  SquashCommitlintUnavailable,
  { readonly brand: unique symbol }
>()(
  S.TaggedStruct("unavailable", { detail: S.NonEmptyString }).pipe(
    $I.annoteSchema("SquashCommitlintUnavailable", {
      description: "Commitlint could not run or gave no verdict; an unknown, never a pass.",
    })
  )
) {}

/**
 * What commitlint said about the predicted squash message.
 *
 * **Example** (Check a verdict)
 *
 * ```ts
 * import { SquashCommitlintPass, SquashCommitlintVerdict } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(SquashCommitlintVerdict)(SquashCommitlintPass.make({}))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SquashCommitlintVerdict = S.Union([
  SquashCommitlintPass,
  SquashCommitlintFail,
  SquashCommitlintUnavailable,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("SquashCommitlintVerdict", {
    description: "Pass, fail with the named rules, or no verdict.",
  })
);

/**
 * What commitlint said about the predicted squash message.
 *
 * @category models
 * @since 0.0.0
 */
export type SquashCommitlintVerdict = typeof SquashCommitlintVerdict.Type;

/**
 * The predicted message together with commitlint's verdict on it.
 *
 * **Example** (A passing report)
 *
 * ```ts
 * import { SquashCommitlintPass, SquashCommitlintReport, SquashCommitMessage } from "@beep/repo-cli/test/Yeet"
 *
 * const report = SquashCommitlintReport.make({
 *   message: SquashCommitMessage.make({ header: "fix(x): y (#7)", body: "" }),
 *   verdict: SquashCommitlintPass.make({}),
 * })
 * console.log(report.verdict._tag) // "pass"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SquashCommitlintReport extends S.Opaque<SquashCommitlintReport, { readonly brand: unique symbol }>()(
  S.Struct({ message: SquashCommitMessage, verdict: SquashCommitlintVerdict }).pipe(
    $I.annoteSchema("SquashCommitlintReport", {
      description: "The predicted squash message and commitlint's verdict on it.",
    })
  )
) {}

// `✖   footer's lines must not be longer than 100 characters [footer-max-line-length]`
const COMMITLINT_ERROR_RULE = /^\s*✖.*\[([a-z0-9-]+)\]\s*$/u;

// Commitlint colors its report when a TTY or FORCE_COLOR asks; the child runs
// with NO_COLOR, and the codes are stripped anyway before the rule is read.
const ANSI_ESCAPE = /\u001b\[[0-9;]*m/gu;

const namedErrorRules = (output: string): ReadonlyArray<string> =>
  A.filterMap(Str.split("\n")(Str.replace(ANSI_ESCAPE, Str.empty)(output)), (line) =>
    Result.fromNullishOr(COMMITLINT_ERROR_RULE.exec(line)?.[1], () => undefined)
  );

// Body and footer max-line-length rules exempt URL lines; the header never does.
const COMMITLINT_URL_LINE = /\bhttps?:\/\/\S+/u;

/**
 * The lines of the rendered message longer than {@link COMMITLINT_MAX_LINE_LENGTH}, 1-based.
 *
 * **Details**
 *
 * Body and footer lines carrying URLs are exempt under `@commitlint/ensure`.
 * The header has no URL exemption and is reported whenever it exceeds the limit.
 *
 * **Example** (Find the long bullet)
 *
 * ```ts
 * import { squashCommitlintOffendingLines, SquashCommitMessage } from "@beep/repo-cli/test/Yeet"
 *
 * const long = squashCommitlintOffendingLines(
 *   SquashCommitMessage.make({ header: "fix(x): y (#7)", body: `* ${"a".repeat(100)}` })
 * )
 * console.log(long.map((line) => [line.line, line.length])) // [[3, 102]]
 * ```
 *
 * @param message - The predicted message.
 * @returns Every line over the limit, in order.
 * @category utilities
 * @since 0.0.0
 */
export const squashCommitlintOffendingLines = (
  message: SquashCommitMessage
): ReadonlyArray<SquashCommitlintOffendingLine> =>
  A.filterMap(Str.split("\n")(renderSquashCommitMessage(message)), (text, index) =>
    Str.length(text) > COMMITLINT_MAX_LINE_LENGTH && (index === 0 || !COMMITLINT_URL_LINE.test(text))
      ? Result.succeed(SquashCommitlintOffendingLine.make({ line: index + 1, length: Str.length(text), text }))
      : Result.failVoid
  );

/**
 * One finished commitlint run over a predicted message: its exit status, the
 * report it printed, and the message it read.
 *
 * **Example** (A passing run)
 *
 * ```ts
 * import { CommitlintRun, SquashCommitMessage } from "@beep/repo-cli/test/Yeet"
 *
 * const run = CommitlintRun.make({
 *   exitCode: 0,
 *   output: "✔   found 0 problems, 0 warnings",
 *   message: SquashCommitMessage.make({ header: "fix(x): y (#7)", body: "" }),
 * })
 * console.log(run.exitCode) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CommitlintRun extends S.Opaque<CommitlintRun, { readonly brand: unique symbol }>()(
  S.Struct({ exitCode: S.Finite, output: S.String, message: SquashCommitMessage }).pipe(
    $I.annoteSchema("CommitlintRun", {
      description: "A finished commitlint run: exit status, printed report, and the message it read.",
    })
  )
) {}

/**
 * Classify one commitlint run: exit 0 passes; a non-zero exit that names at
 * least one rule fails on those rules; anything else is no verdict.
 *
 * **Example** (Classify the ep47 run)
 *
 * ```ts
 * import { classifyCommitlintRun, CommitlintRun, SquashCommitMessage } from "@beep/repo-cli/test/Yeet"
 *
 * const verdict = classifyCommitlintRun(
 *   CommitlintRun.make({
 *     exitCode: 1,
 *     output: "✖   footer's lines must not be longer than 100 characters [footer-max-line-length]\n✖   found 1 problems",
 *     message: SquashCommitMessage.make({ header: "fix(x): y (#7)", body: `* ${"a".repeat(100)}` }),
 *   })
 * )
 * console.log(verdict._tag) // "fail"
 * ```
 *
 * @param run - The exit status, the printed report and the message commitlint read.
 * @returns The verdict.
 * @category utilities
 * @since 0.0.0
 */
export const classifyCommitlintRun = ({ exitCode, output, message }: CommitlintRun): SquashCommitlintVerdict => {
  if (exitCode === 0) return SquashCommitlintPass.make({});
  const rules = A.dedupe(namedErrorRules(output));
  return A.match(rules, {
    onEmpty: (): SquashCommitlintVerdict =>
      SquashCommitlintUnavailable.make({
        detail: `commitlint exited ${exitCode} without naming a rule: ${Str.trim(output) || "no output"}`,
      }),
    onNonEmpty: (named) =>
      SquashCommitlintFail.make({ rules: named, offendingLines: squashCommitlintOffendingLines(message) }),
  });
};

const encoder = new TextEncoder();

/**
 * Run the repo's commitlint (`bunx commitlint --verbose`, cwd the repo root,
 * the message on stdin, exactly as the `commitlint` CI lane runs it) on a
 * predicted squash message. Never fails: a spawn failure is an `unavailable`
 * verdict, which the merge gate holds on.
 *
 * **Example** (Build the lint effect)
 *
 * ```ts
 * import { lintSquashCommitMessage } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof lintSquashCommitMessage) // "function"
 * ```
 *
 * @param context - Its `repoRoot` is the cwd, so `commitlint.config.ts` is the config commitlint loads.
 * @param message - The predicted squash message fed to commitlint over stdin.
 * @returns The report.
 * @category workflows
 * @since 0.0.0
 */
export const lintSquashCommitMessage = Effect.fn("Yeet.lintSquashCommitMessage")(function* (
  context: RepoRunContext,
  message: SquashCommitMessage
): Effect.fn.Return<SquashCommitlintReport, never, ChildProcessSpawner.ChildProcessSpawner> {
  const verdict = yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make("bunx", ["commitlint", "--verbose"], {
        cwd: context.repoRoot,
        env: { NO_COLOR: "1", FORCE_COLOR: "0" },
        extendEnv: true,
        stdin: Stream.make(encoder.encode(renderSquashCommitMessage(message))),
        stdout: "pipe",
        stderr: "pipe",
      });
      const [code, output] = yield* Effect.all([handle.exitCode, handle.all.pipe(Stream.decodeText, Stream.mkString)], {
        concurrency: "unbounded",
      });
      return classifyCommitlintRun(CommitlintRun.make({ exitCode: code, output, message }));
    })
  ).pipe(
    Effect.catch((cause) =>
      Effect.succeed(SquashCommitlintUnavailable.make({ detail: `bunx commitlint could not run: ${cause.message}` }))
    )
  );
  return SquashCommitlintReport.make({ message, verdict });
});

const renderOffending = (lines: ReadonlyArray<SquashCommitlintOffendingLine>): string =>
  A.join(
    A.map(lines, (line) => `line ${line.line} (${line.length} chars): "${line.text}"`),
    "; "
  );

// Which part of the squash a rule judges: header, type, scope and subject rules
// read the pinned `<PR title> (#n)` line, body and footer rules read the commit
// messages below it. Offending line numbers back the same split (line 1 is the
// header) for a length rule whose family name is not recognised.
const HEADER_RULE = /^(?:header|type|scope|subject)-/u;
const COMMITS_RULE = /^(?:body|footer)-/u;

const remedies = (
  rules: ReadonlyArray<string>,
  offendingLines: ReadonlyArray<SquashCommitlintOffendingLine>
): ReadonlyArray<string> => {
  const header = A.some(rules, (rule) => HEADER_RULE.test(rule)) || A.some(offendingLines, (line) => line.line === 1);
  const commits = A.some(rules, (rule) => COMMITS_RULE.test(rule)) || A.some(offendingLines, (line) => line.line > 1);
  const title = `shorten or reword the PR title: the header is "<title> (#n)", ${COMMITLINT_MAX_LINE_LENGTH} chars or fewer`;
  const subjects = `the squash body bullets every commit subject as "* <subject>", so reword commit subjects to ${SQUASH_COMMIT_SUBJECT_MAX_LENGTH} chars or fewer and keep body lines to ${COMMITLINT_MAX_LINE_LENGTH} or fewer`;
  return header || commits ? [...(header ? [title] : []), ...(commits ? [subjects] : [])] : [title, subjects];
};

/**
 * One line for a verdict: `pass`, the failing rules with the offending lines
 * and the remedy, or why there is no verdict.
 *
 * **Details**
 *
 * The remedy follows the rule family first and the offending lines second:
 * `header-*`, `type-*`, `scope-*` and `subject-*` rules, or line 1, judge the
 * pinned `<PR title> (#n)` header, which only the PR title clears; `body-*`
 * and `footer-*` rules, or any later line, judge the commit messages, which a
 * reworded subject or body clears. A rule outside both families with no line
 * over the limit gets both remedies.
 *
 * **Example** (Render a pass)
 *
 * ```ts
 * import { renderSquashCommitlintVerdict, SquashCommitlintPass } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(renderSquashCommitlintVerdict(SquashCommitlintPass.make({}))) // "pass"
 * ```
 *
 * @param verdict - The verdict to render.
 * @returns One line, starting with the rule names for a failure.
 * @category formatting
 * @since 0.0.0
 */
export const renderSquashCommitlintVerdict = (verdict: SquashCommitlintVerdict): string =>
  SquashCommitlintVerdict.match(verdict, {
    pass: () => "pass",
    fail: ({ rules, offendingLines }) =>
      A.join(
        [
          `${A.join(rules, ", ")}${A.isReadonlyArrayNonEmpty(offendingLines) ? ` at ${renderOffending(offendingLines)}` : ""}`,
          ...remedies(rules, offendingLines),
        ],
        "; "
      ),
    unavailable: ({ detail }) => `commitlint gave no verdict (${detail}); an unknown is never a pass`,
  });

const GhNullableText = S.String.pipe(S.NullOr, S.optionalKey);
const GhRepositorySquashSettings = S.Struct({
  squash_merge_commit_title: GhNullableText,
  squash_merge_commit_message: GhNullableText,
});
const GhPullCommitPages = S.Struct({ commit: S.Struct({ message: S.String }) }).pipe(S.Array, S.Array);
const GhPullFacts = S.Struct({ number: S.Finite, title: S.String, body: GhNullableText });

const decodeSquashSettings = S.decodeUnknownEffect(S.fromJsonString(GhRepositorySquashSettings));
const decodeCommitPages = S.decodeUnknownEffect(S.fromJsonString(GhPullCommitPages));
const decodePullFacts = S.decodeUnknownEffect(S.fromJsonString(GhPullFacts));

/**
 * Read the repository's squash defaults over REST; an omitted or unrecognised
 * field falls back to GitHub's own default for it.
 *
 * **Example** (Build the read effect)
 *
 * ```ts
 * import { readGitHubSquashDefaults } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof readGitHubSquashDefaults) // "function"
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const readGitHubSquashDefaults = Effect.fn("Yeet.readGitHubSquashDefaults")(function* (
  context: RepoRunContext
): Effect.fn.Return<
  GitHubSquashDefaults,
  YeetCommandError,
  ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom
> {
  const settings = yield* decodeYeetGhOutput(
    "the repository squash settings",
    decodeSquashSettings,
    yield* yeetGh(context, "gh api repos", ["api", "repos/{owner}/{repo}"])
  );
  const title = O.fromNullishOr(settings.squash_merge_commit_title).pipe(
    O.filter(S.is(GitHubSquashTitleDefault)),
    O.getOrElse(() => GITHUB_SQUASH_DEFAULTS_FALLBACK.title)
  );
  const message = O.fromNullishOr(settings.squash_merge_commit_message).pipe(
    O.filter(S.is(GitHubSquashMessageDefault)),
    O.getOrElse(() => GITHUB_SQUASH_DEFAULTS_FALLBACK.message)
  );
  return GitHubSquashDefaults.make({ title, message });
});

/**
 * The pull request facts the squash reader needs: number, title and description.
 *
 * **Example** (Facts for a pull request without a description)
 *
 * ```ts
 * import { SquashPullRequestFacts } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(SquashPullRequestFacts.make({ number: 7, title: "fix(x): y", body: O.none() }).number) // 7
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SquashPullRequestFacts extends S.Opaque<SquashPullRequestFacts, { readonly brand: unique symbol }>()(
  S.Struct({ number: S.Finite, title: S.String, body: S.Option(S.String) }).pipe(
    $I.annoteSchema("SquashPullRequestFacts", {
      description: "The pull request number, title and description the squash prediction reads.",
    })
  )
) {}

/**
 * Predict the squash message the merge gate will produce for this pull request
 * and lint it: repository defaults and the PR commits over REST, the title
 * pinned to `<PR title> (#n)` as `executeMergeGate` pins it.
 *
 * **Example** (Build the read effect)
 *
 * ```ts
 * import { readSquashCommitlint } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof readSquashCommitlint) // "function"
 * ```
 *
 * @param context - Resolves the repository root the gh calls and the commitlint run execute in.
 * @param facts - The pull request number, title and description the prediction is built from.
 * @returns The predicted message and commitlint's verdict.
 * @category workflows
 * @since 0.0.0
 */
export const readSquashCommitlint = Effect.fn("Yeet.readSquashCommitlint")(function* (
  context: RepoRunContext,
  facts: SquashPullRequestFacts
): Effect.fn.Return<
  SquashCommitlintReport,
  YeetCommandError,
  ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom
> {
  const defaults = yield* readGitHubSquashDefaults(context);
  // `--slurp` wraps pages in an array; fold the pages back into one commit list.
  const pages = yield* decodeYeetGhOutput(
    "the pull request commits",
    decodeCommitPages,
    yield* yeetGh(context, `gh api pulls/${facts.number}/commits`, [
      "api",
      `repos/{owner}/{repo}/pulls/${facts.number}/commits?per_page=100`,
      "--paginate",
      "--slurp",
    ])
  );
  const message = predictSquashCommitMessage(
    SquashMessageSource.make({
      prNumber: facts.number,
      title: facts.title,
      body: O.getOrElse(facts.body, () => Str.empty),
      commitMessages: A.map(A.flatten(pages), (entry) => entry.commit.message),
      defaults,
      commitTitle: O.some(`${facts.title} (#${facts.number})`),
    })
  );
  return yield* lintSquashCommitMessage(context, message);
});

/**
 * {@link readSquashCommitlint} for a pull request known only by number: reads
 * its title and description first.
 *
 * **Example** (Build the read effect)
 *
 * ```ts
 * import { readSquashCommitlintForPullRequest } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof readSquashCommitlintForPullRequest) // "function"
 * ```
 *
 * @param context - Resolves the repository root the gh calls and the commitlint run execute in.
 * @param prNumber - Which pull request `pulls/{n}` reads before the commits and settings.
 * @returns The predicted message and commitlint's verdict.
 * @category workflows
 * @since 0.0.0
 */
export const readSquashCommitlintForPullRequest = Effect.fn("Yeet.readSquashCommitlintForPullRequest")(function* (
  context: RepoRunContext,
  prNumber: number
): Effect.fn.Return<
  SquashCommitlintReport,
  YeetCommandError,
  ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom
> {
  const pull = yield* decodeYeetGhOutput(
    "the pull request",
    decodePullFacts,
    yield* yeetGh(context, `gh api pulls/${prNumber}`, ["api", `repos/{owner}/{repo}/pulls/${prNumber}`])
  );
  return yield* readSquashCommitlint(
    context,
    SquashPullRequestFacts.make({ number: pull.number, title: pull.title, body: O.fromNullishOr(pull.body) })
  );
});
