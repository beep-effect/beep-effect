/**
 * Typed failures of the runner fleet's service contracts and Lambda programs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { $AlchemyGithubRunnersId } from "./internal/AlchemyGithubRunnersId.ts";

const $I = $AlchemyGithubRunnersId.create("RunnerFleet.errors");

/**
 * A GitHub REST call failed.
 *
 * **Details**
 *
 * `status` is the HTTP status when GitHub answered. Programs branch on it:
 * `404` means gone, `422` on runner deletion means the runner is busy.
 * `code` is the client's error tag (`UnprocessableEntity`, `TooManyRequests`,
 * ...) when the call reached GitHub. `rateLimited` marks a primary or
 * secondary rate limit, which GitHub can answer with a 403 as well as a 429.
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
    code: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    rateLimited: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
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
 * AWS error codes that mean the request was throttled.
 *
 * **Details**
 *
 * AWS throttles with HTTP 400 as well as 429 and 503, so a throttling code
 * outranks the status: the request was valid and a later resend can succeed.
 *
 * **Example** (EC2's request limit)
 *
 * ```ts
 * import { AwsThrottlingCode } from "@beep/alchemy-github-runners/RunnerFleet.errors"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AwsThrottlingCode)("RequestLimitExceeded")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AwsThrottlingCode = LiteralKit([
  "Throttling",
  "ThrottlingException",
  "ThrottledException",
  "RequestThrottled",
  "RequestThrottledException",
  "RequestLimitExceeded",
  "TooManyRequestsException",
  "ProvisionedThroughputExceeded",
  "ProvisionedThroughputExceededException",
  "TransactionInProgressException",
  "BandwidthLimitExceeded",
  "SlowDown",
  "EC2ThrottledException",
  "PriorRequestNotComplete",
  "TooManyUpdates",
]).pipe($I.annoteSchema("AwsThrottlingCode", { description: "AWS error codes that mean the request was throttled." }));

/**
 * Runtime type for {@link AwsThrottlingCode}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type AwsThrottlingCode = typeof AwsThrottlingCode.Type;

/**
 * Whose fault an AWS failure is, as the live layer reads the SDK's error.
 *
 * **Details**
 *
 * `client`: the request was refused (an HTTP 4xx other than 429, such as a
 * validation, authorization or quota error); sending it again fails the same
 * way. `transient`: throttling (whatever the status, 400 included), a 5xx, a
 * timeout or a network failure.
 * `unknown`: the SDK gave neither a status nor a category.
 *
 * **Example** (A refused request)
 *
 * ```ts
 * import { AwsFault } from "@beep/alchemy-github-runners/RunnerFleet.errors"
 *
 * console.log(AwsFault.is.client("client")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AwsFault = LiteralKit(["client", "transient", "unknown"]).pipe(
  $I.annoteSchema("AwsFault", { description: "Whose fault an AWS failure is." })
);

/**
 * Runtime type for {@link AwsFault}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type AwsFault = typeof AwsFault.Type;

/**
 * An AWS call failed.
 *
 * **Details**
 *
 * `code` is the AWS error code when one was returned (`ParameterNotFound`,
 * `RequestLimitExceeded`, ...). `retryable` is the live layer's verdict:
 * throttling, 5xx and network failures are retryable. `status` is the HTTP
 * status when the SDK exposes it (its unknown-error class does), and `fault`
 * says whether a resend can succeed ({@link AwsFault}).
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
    status: S.Option(S.Int).pipe(S.withConstructorDefault(Effect.succeedNone)),
    fault: AwsFault.pipe(S.withConstructorDefault(Effect.succeed<AwsFault>("unknown"))),
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

/**
 * A destroy-time sweep terminated the fleet but could not deregister every runner.
 *
 * **Details**
 *
 * `instanceIds` names the instances whose GitHub runner registration is left
 * behind: the GitHub call failed, or the runner stayed busy through every retry.
 *
 * **Example** (One runner left registered)
 *
 * ```ts
 * import { RunnerSweepIncomplete } from "@beep/alchemy-github-runners/RunnerFleet.errors"
 *
 * const error = RunnerSweepIncomplete.make({ instanceIds: ["i-1"], message: "1 runner left registered" })
 * console.log(error.instanceIds) // ["i-1"]
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RunnerSweepIncomplete extends S.TaggedError<RunnerSweepIncomplete, { readonly brand: unique symbol }>(
  $I`RunnerSweepIncomplete`
)(
  "RunnerSweepIncomplete",
  { instanceIds: S.Array(S.String), message: S.String },
  $I.annoteError<RunnerSweepIncomplete>("RunnerSweepIncomplete", {
    description: "A destroy-time sweep could not deregister every runner.",
  })
) {}
