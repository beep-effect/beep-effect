/**
 * Typed failures of the runner fleet's service contracts and Lambda programs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AlchemyGithubRunnersId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $AlchemyGithubRunnersId.create("RunnerFleet.errors");

/**
 * A GitHub REST call failed.
 *
 * **Details**
 *
 * `status` is the HTTP status when GitHub answered. Programs branch on it:
 * `404` means gone, `422` on runner deletion means the runner is busy.
 *
 * **Example** (A busy runner)
 *
 * ```ts
 * import { GitHubApiError } from "@beep/alchemy-github-runners/RunnerFleet.errors"
 * import * as O from "effect/Option"
 *
 * const error = GitHubApiError.make({ operation: "deleteRunner", status: O.some(422), message: "busy" })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GitHubApiError extends S.TaggedError<GitHubApiError, { readonly brand: unique symbol }>(
  $I`GitHubApiError`
)(
  "GitHubApiError",
  {
    operation: S.String,
    status: S.Option(S.Int).pipe(S.withConstructorDefault(Effect.succeedNone)),
    message: S.String,
  },
  $I.annoteError<GitHubApiError>("GitHubApiError", { description: "A GitHub REST call failed." })
) {}

/**
 * Minting the App JWT or an installation token failed.
 *
 * **Example** (A malformed key)
 *
 * ```ts
 * import { GitHubAppAuthError } from "@beep/alchemy-github-runners/RunnerFleet.errors"
 *
 * console.log(GitHubAppAuthError.make({ message: "not a PEM private key" })._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GitHubAppAuthError extends S.TaggedError<GitHubAppAuthError, { readonly brand: unique symbol }>(
  $I`GitHubAppAuthError`
)(
  "GitHubAppAuthError",
  { message: S.String },
  $I.annoteError<GitHubAppAuthError>("GitHubAppAuthError", {
    description: "Minting the App JWT or an installation token failed.",
  })
) {}

/**
 * An AWS call failed.
 *
 * **Details**
 *
 * `code` is the AWS error code when one was returned (`ParameterNotFound`,
 * `RequestLimitExceeded`, ...). `retryable` is the live layer's verdict:
 * throttling, 5xx and network failures are retryable.
 *
 * **Example** (A throttled CreateFleet)
 *
 * ```ts
 * import { AwsApiError } from "@beep/alchemy-github-runners/RunnerFleet.errors"
 * import * as O from "effect/Option"
 *
 * const error = AwsApiError.make({
 *   service: "ec2", operation: "createFleet", code: O.some("RequestLimitExceeded"), retryable: true, message: "slow down",
 * })
 * console.log(error.retryable)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AwsApiError extends S.TaggedError<AwsApiError, { readonly brand: unique symbol }>($I`AwsApiError`)(
  "AwsApiError",
  {
    service: S.String,
    operation: S.String,
    code: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    retryable: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    message: S.String,
  },
  $I.annoteError<AwsApiError>("AwsApiError", { description: "An AWS call failed." })
) {}

/**
 * A Lambda's runtime config is missing or does not decode.
 *
 * **Example** (Missing environment variable)
 *
 * ```ts
 * import { RuntimeConfigError } from "@beep/alchemy-github-runners/RunnerFleet.errors"
 *
 * console.log(RuntimeConfigError.make({ message: "BEEP_RUNNER_CONFIG is not set" })._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RuntimeConfigError extends S.TaggedError<RuntimeConfigError, { readonly brand: unique symbol }>(
  $I`RuntimeConfigError`
)(
  "RuntimeConfigError",
  { message: S.String },
  $I.annoteError<RuntimeConfigError>("RuntimeConfigError", {
    description: "A Lambda's runtime config is missing or does not decode.",
  })
) {}

/**
 * The webhook refused a delivery with an HTTP status.
 *
 * **Example** (Bad signature)
 *
 * ```ts
 * import { WebhookRejected } from "@beep/alchemy-github-runners/RunnerFleet.errors"
 *
 * console.log(WebhookRejected.make({ statusCode: 401, message: "Unable to verify signature!" }).statusCode)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WebhookRejected extends S.TaggedError<WebhookRejected, { readonly brand: unique symbol }>(
  $I`WebhookRejected`
)(
  "WebhookRejected",
  { statusCode: S.Int, message: S.String },
  $I.annoteError<WebhookRejected>("WebhookRejected", {
    description: "The webhook refused a delivery with an HTTP status.",
  })
) {}
