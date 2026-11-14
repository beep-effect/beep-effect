/**
 * Tagged errors for the Yeet command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { GitHubError, GitHubErrorKind } from "@beep/github/GitHubError";
import { $RepoCliId } from "@beep/identity/packages";
import { OpaqueDefect } from "@beep/repo-cli-kit/schema/OpaqueDefect";
import { LiteralKit } from "@beep/schema";
import { Err } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { dual } from "effect/Function";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Yeet/Yeet.errors");

/**
 * What a Yeet handler error refused or failed on, when the handler knows.
 *
 * **Details**
 *
 * The kinds of the handler errors economics used to read as `unlocated`
 * (MEAS-03 slice 2): `publish-input` is publish refusing the worktree, staging
 * or commit message it was handed; `review-threads` is merge readiness
 * refusing outstanding review threads; `github-rate-limit` is a GitHub call
 * refused on a rate limit; `github-transport` is any other failed GitHub call
 * the handler needed (no usable answer, or GitHub refused the request). A
 * handler error with no kind is still a handler error; economics then reads
 * its message, and anything it does not recognise stays `unlocated`.
 *
 * **Example** (List the kinds)
 *
 * ```ts
 * import { YeetHandlerErrorKind } from "@beep/repo-cli/commands/Yeet"
 *
 * console.log(YeetHandlerErrorKind.literals)
 * // ["publish-input", "review-threads", "github-rate-limit", "github-transport"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetHandlerErrorKind = LiteralKit([
  "publish-input",
  "review-threads",
  "github-rate-limit",
  "github-transport",
]).pipe(
  $I.annoteSchema("YeetHandlerErrorKind", {
    description: "What a Yeet handler error refused or failed on: publish input, review threads, or a GitHub call.",
  })
);

/**
 * What a Yeet handler error refused or failed on.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetHandlerErrorKind = typeof YeetHandlerErrorKind.Type;

type YeetCommandErrorOptions =
  | undefined
  | {
      readonly command?: string;
      readonly exitCode?: number;
      readonly file?: string;
    };

/**
 * Operational error raised by the yeet command.
 *
 * **Details**
 *
 * `handlerErrorKind` names what the error refused or failed on when the raise
 * site knows it ({@link YeetHandlerErrorKind}); the run verdict records it, so
 * economics locates the red without reading the message.
 *
 * **Example** (Make yeet command error)
 *
 * ```ts
 * import { YeetCommandError } from "@beep/repo-cli/commands/Yeet"
 *
 * const error = YeetCommandError.make({ message: "failed" })
 * console.log(error.message)
 * ```
 *
 * **Example** (A typed publish input refusal)
 *
 * ```ts
 * import { YeetCommandError } from "@beep/repo-cli/commands/Yeet"
 *
 * const error = YeetCommandError.make({
 *   message: "yeet publish refuses untracked files.",
 *   handlerErrorKind: "publish-input",
 * })
 * console.log(error.handlerErrorKind) // "publish-input"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class YeetCommandError extends S.TaggedError<YeetCommandError, { readonly brand: unique symbol }>(
  $I`YeetCommandError`
)(
  "YeetCommandError",
  {
    message: S.String,
    command: S.optionalKey(S.String),
    exitCode: S.optionalKey(S.Finite),
    file: S.optionalKey(S.String),
    handlerErrorKind: S.optionalKey(YeetHandlerErrorKind),
    cause: S.optionalKey(OpaqueDefect),
  },
  $I.annoteError<YeetCommandError>("YeetCommandError", {
    description: "Failure raised while planning or executing a yeet run.",
  })
) {
  /** Process exit code reported when this error reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = this.exitCode ?? 1;

  /**
   * Construct a yeet command error from a cause and optional command context.
   *
   * @category constructors
   */
  static readonly new: {
    (cause: unknown, message: string, opts?: YeetCommandErrorOptions): YeetCommandError;
    (message: string, opts?: YeetCommandErrorOptions): (cause: unknown) => YeetCommandError;
  } = dual(
    3,
    (cause: unknown, message: string, { command, exitCode, file }: YeetCommandErrorOptions = {}): YeetCommandError =>
      YeetCommandError.make({
        cause,
        message,
        ...O.getSomesStruct({
          command: O.fromUndefinedOr(command),
          exitCode: O.fromUndefinedOr(exitCode),
          file: O.fromUndefinedOr(file),
        }),
      })
  );

  static readonly mapError = Err.mapToError(this.new);
}

const isGitHubError = S.is(GitHubError);

// A GitHub client failure is classified once, by its structural kind
// (`GitHubError.fromOctokit`), never by its message.
const githubCauseKind = (cause: unknown): O.Option<YeetHandlerErrorKind> =>
  O.map(O.liftPredicate(cause, isGitHubError), (error) =>
    GitHubErrorKind.is.rateLimited(error.kind)
      ? YeetHandlerErrorKind.Enum["github-rate-limit"]
      : YeetHandlerErrorKind.Enum["github-transport"]
  );

/**
 * The kind the run verdict records for a handler error, when one is known.
 *
 * **Details**
 *
 * The raise site's own `handlerErrorKind` wins. Otherwise an error whose
 * `cause` is a `GitHubError` is a GitHub call failure: `github-rate-limit`
 * when GitHub's kind is `rateLimited`, else `github-transport`. Any other
 * error has no kind, and economics reads its message instead.
 *
 * **Example** (A GitHub rate limit under a Yeet error)
 *
 * ```ts
 * import { GitHubError } from "@beep/github/GitHubError"
 * import { YeetCommandError, yeetHandlerErrorKind } from "@beep/repo-cli/commands/Yeet"
 * import * as O from "effect/Option"
 *
 * const error = YeetCommandError.make({
 *   message: "GitHub REST default branch read failed",
 *   cause: GitHubError.make({ kind: "rateLimited", operation: "GET /repos/{owner}/{repo}", reason: "API rate limit exceeded" }),
 * })
 * console.log(O.getOrNull(yeetHandlerErrorKind(error))) // "github-rate-limit"
 * ```
 *
 * @param error - The handler error that ended the run.
 * @returns The handler error kind, or none when neither the site nor the cause names one.
 * @category utilities
 * @since 0.0.0
 */
export const yeetHandlerErrorKind = (error: YeetCommandError): O.Option<YeetHandlerErrorKind> =>
  O.orElse(O.fromUndefinedOr(error.handlerErrorKind), () => githubCauseKind(error.cause));
