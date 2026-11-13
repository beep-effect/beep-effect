/**
 * GitHub's rate-limit snapshot and the package's single retry policy.
 *
 * **Details**
 *
 * The client parses every response's rate-limit headers into a
 * `RateLimitSnapshot`, and one `RetryPolicy` decides which failures to retry
 * and how long to wait, honouring GitHub's server-advised delays up to a
 * ceiling. Nothing here imports an error class: a policy reads only the two
 * fields `RetryableFailure` describes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GithubId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Random from "effect/Random";
import * as Redacted from "effect/Redacted";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $GithubId.create("Resilience");

/**
 * Non-secret twelve-hex SHA-256 prefix identifying a physical token.
 *
 * **Example** (Validate a fingerprint)
 *
 * ```ts
 * import { CredentialFingerprint } from "@beep/github/Resilience"
 * console.log(CredentialFingerprint.make("012345abcdef"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CredentialFingerprint = S.String.check(S.isPattern(/^[0-9a-f]{12}$/)).pipe(
  S.brand("CredentialFingerprint"),
  $I.annoteSchema("CredentialFingerprint", { description: "Twelve hex digits of a token's SHA-256; never the token." })
);

/**
 * Type of {@link CredentialFingerprint}.
 * @category models
 * @since 0.0.0
 */
export type CredentialFingerprint = typeof CredentialFingerprint.Type;

const credentialEncoder = new TextEncoder();

/**
 * Hash a redacted token without retaining its plaintext.
 *
 * **Example** (Hash a fixture)
 *
 * ```ts
 * import { credentialFingerprint } from "@beep/github/Resilience"
 * import * as Effect from "effect/Effect"
 * import * as Redacted from "effect/Redacted"
 * console.log((await Effect.runPromise(credentialFingerprint(Redacted.make("fixture")))).length) // 12
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const credentialFingerprint = Effect.fn("Resilience.credentialFingerprint")(function* (
  token: Redacted.Redacted<string>
) {
  const context = yield* Layer.build(Digest.layerWebCrypto);
  const digest = Context.get(context, Digest.Digest);
  const hex = yield* digest.digestHex(Digest.sha256, credentialEncoder.encode(Redacted.value(token)));
  return CredentialFingerprint.make(Str.slice(0, 12)(hex));
}, Effect.scoped);

/**
 * The GitHub rate-limit bucket a request counted against.
 *
 * **Details**
 *
 * The literal set is the `GET /rate_limit` `resources` keys GitHub documents,
 * plus three keys older documentation and live responses still carry
 * (`code_scanning_upload`, `audit_log`, `audit_log_streaming`), plus a closed
 * `unknown` for an absent or unrecognised `x-ratelimit-resource` header. A
 * GraphQL request always counts against `graphql`.
 *
 * **Example** (Recognise a documented bucket)
 *
 * ```ts
 * import { GitHubRateLimitResource } from "@beep/github/Resilience";
 *
 * console.log(GitHubRateLimitResource.is.graphql("graphql")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const GitHubRateLimitResource = LiteralKit([
  "core",
  "graphql",
  "search",
  "code_search",
  "source_import",
  "integration_manifest",
  "code_scanning_upload",
  "code_scanning_autofix",
  "actions_runner_registration",
  "scim",
  "dependency_snapshots",
  "dependency_sbom",
  "audit_log",
  "audit_log_streaming",
  "copilot_usage_records",
  "unknown",
]).pipe(
  $I.annoteSchema("GitHubRateLimitResource", {
    description: "The GitHub rate-limit bucket a request counted against (x-ratelimit-resource).",
  })
);

/**
 * The values accepted by {@link GitHubRateLimitResource}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type GitHubRateLimitResource = typeof GitHubRateLimitResource.Type;

/**
 * What GitHub's rate-limit headers said on the most recent REST response.
 *
 * **Details**
 *
 * Every REST response carries `x-ratelimit-remaining`, `x-ratelimit-limit` and
 * `x-ratelimit-reset`; the client parses them into this and keeps the latest
 * one. Read it through the client's `rateLimit` member when you want to pace
 * yourself — **nothing in this package throttles on your behalf.**
 *
 * The cell lives inside the client layer that writes it, so there is nothing
 * extra to provide: reading it through the client is the only way.
 *
 * **Example** (Inspect a spent rate-limit budget)
 *
 * ```ts
 * import { RateLimitSnapshot } from "@beep/github/Resilience";
 *
 * const snapshot = RateLimitSnapshot.make({ remaining: 0, limit: 5000, resetEpochSeconds: 60 });
 *
 * console.log(snapshot.isExhausted) // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class RateLimitSnapshot extends S.Class<RateLimitSnapshot, { readonly brand: unique symbol }>(
  $I`RateLimitSnapshot`
)(
  {
    /** Requests left in the current window. */
    remaining: S.Int.pipe(
      $I.annoteKey("RateLimitSnapshot.remaining", { description: "Requests left in the current window." })
    ),
    /** The window's ceiling. */
    limit: S.Int.pipe($I.annoteKey("RateLimitSnapshot.limit", { description: "The window's ceiling." })),
    /** When the window resets, as epoch **seconds** — GitHub's own unit. */
    resetEpochSeconds: S.Int.pipe(
      $I.annoteKey("RateLimitSnapshot.resetEpochSeconds", {
        description: "When the window resets, as epoch **seconds** — GitHub's own unit.",
      })
    ),
    /** The bucket the request counted against (`x-ratelimit-resource`); `unknown` when absent or unrecognised. */
    resource: GitHubRateLimitResource.pipe(
      S.withDecodingDefaultKey(Effect.succeed(GitHubRateLimitResource.Enum.unknown)),
      S.withConstructorDefault(Effect.succeed(GitHubRateLimitResource.Enum.unknown)),
      $I.annoteKey("RateLimitSnapshot.resource", {
        description: "The bucket the request counted against; unknown when absent or unrecognised.",
      })
    ),
    /** Requests used in the current window (`x-ratelimit-used`); none when the response omitted it. */
    used: S.Int.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      $I.annoteKey("RateLimitSnapshot.used", { description: "Requests used in the current window." })
    ),
  },
  $I.annote("RateLimitSnapshot", {
    description: "What GitHub's rate-limit headers said on the most recent REST response.",
  })
) {
  /**
   * Milliseconds until the window resets, relative to `nowMillis`, floored at zero.
   *
   * **Example** (Measure time until the reset)
   *
   * ```ts
   * import { RateLimitSnapshot } from "@beep/github/Resilience";
   *
   * const snapshot = RateLimitSnapshot.make({ remaining: 0, limit: 5000, resetEpochSeconds: 60 });
   *
   * console.log(snapshot.millisUntilReset(59000)) // 1000
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  millisUntilReset(nowMillis: number): number {
    return Math.max(0, this.resetEpochSeconds * 1000 - nowMillis);
  }

  /**
   * True when the budget is spent.
   *
   * **Example** (Detect an exhausted budget)
   *
   * ```ts
   * import { RateLimitSnapshot } from "@beep/github/Resilience";
   *
   * const snapshot = RateLimitSnapshot.make({ remaining: 0, limit: 5000, resetEpochSeconds: 60 });
   *
   * console.log(snapshot.isExhausted) // true
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  get isExhausted(): boolean {
    return this.remaining <= 0;
  }
}

/**
 * Whether an observed request went to REST or GraphQL.
 *
 * **Example** (Recognise a GraphQL observation)
 *
 * ```ts
 * import { RateLimitRequestKind } from "@beep/github/Resilience";
 *
 * console.log(RateLimitRequestKind.is.graphql("graphql")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const RateLimitRequestKind = LiteralKit(["rest", "graphql"]).pipe(
  $I.annoteSchema("RateLimitRequestKind", {
    description: "Whether the observed request went to REST or GraphQL.",
  })
);

/**
 * The values accepted by {@link RateLimitRequestKind}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type RateLimitRequestKind = typeof RateLimitRequestKind.Type;

/**
 * How an observed GitHub attempt ended, as far as the budget is concerned.
 *
 * **Details**
 *
 * `rate-limited` is a primary limit (the bucket is empty, or a GraphQL
 * `RATE_LIMITED` entry); `secondary-limited` is GitHub's abuse throttle (a 429,
 * a 403 carrying `retry-after`, or a "secondary rate limit" message);
 * `not-modified` is a 304; `error` is any other failure.
 *
 * **Example** (Recognise a primary rate limit)
 *
 * ```ts
 * import { RateLimitOutcome } from "@beep/github/Resilience";
 *
 * console.log(RateLimitOutcome.is["rate-limited"]("rate-limited")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const RateLimitOutcome = LiteralKit(["ok", "not-modified", "rate-limited", "secondary-limited", "error"]).pipe(
  $I.annoteSchema("RateLimitOutcome", { description: "How an observed GitHub attempt ended." })
);

/**
 * The values accepted by {@link RateLimitOutcome}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type RateLimitOutcome = typeof RateLimitOutcome.Type;

/**
 * The kind of credential an observed request carried.
 *
 * **Details**
 *
 * `token` is a bearer token (a personal, OAuth or installation token),
 * `app-jwt` is a GitHub App's own JWT, and `unauthenticated` is no credential
 * at all. The driver knows this without knowing who owns the bucket.
 *
 * **Example** (Recognise an App JWT)
 *
 * ```ts
 * import { RateLimitCredential } from "@beep/github/Resilience";
 *
 * console.log(RateLimitCredential.is["app-jwt"]("app-jwt")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const RateLimitCredential = LiteralKit(["token", "app-jwt", "unauthenticated"]).pipe(
  $I.annoteSchema("RateLimitCredential", { description: "The kind of credential an observed request carried." })
);

/**
 * The values accepted by {@link RateLimitCredential}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type RateLimitCredential = typeof RateLimitCredential.Type;

/**
 * One GitHub response's rate-limit headers, with the context the transport knows.
 *
 * **Details**
 *
 * The transport emits one observation per HTTP attempt to the
 * {@link RateLimitSink}. `budgetLabel` is the caller's opaque, non-secret label,
 * passed through verbatim; the driver never parses or composes it and never
 * sends it in a header. `at` is in-memory only: an observation is never
 * serialised, so it carries a `DateTime.Utc` directly.
 *
 * **Example** (Describe a successful REST attempt)
 *
 * ```ts
 * import { RateLimitObservation, RateLimitSnapshot } from "@beep/github/Resilience";
 * import * as DateTime from "effect/DateTime";
 * import * as O from "effect/Option";
 *
 * const observation = RateLimitObservation.make({
 *   snapshot: RateLimitSnapshot.make({ remaining: 4999, limit: 5000, resetEpochSeconds: 60, resource: "core" }),
 *   budgetLabel: O.some("user:octocat"),
 *   credential: "token",
 *   operation: "GET /rate_limit",
 *   kind: "rest",
 *   status: 200,
 *   outcome: "ok",
 *   at: DateTime.makeUnsafe(0),
 * });
 * console.log(observation.snapshot.resource) // core
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class RateLimitObservation extends S.Opaque<RateLimitObservation, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Non-secret physical token fingerprint; absent for rotating App tokens and unknown credentials. */
    fingerprint: S.OptionFromOptionalKey(CredentialFingerprint).pipe(S.withConstructorDefault(Effect.succeedNone)),
    /** The parsed rate-limit headers. */
    snapshot: RateLimitSnapshot.pipe(
      $I.annoteKey("RateLimitObservation.snapshot", { description: "The parsed rate-limit headers." })
    ),
    /** The caller's opaque budget label, verbatim; never a token. */
    budgetLabel: S.Option(S.String).pipe(
      $I.annoteKey("RateLimitObservation.budgetLabel", {
        description: "The caller's opaque budget label, verbatim; never a token.",
      })
    ),
    /** The kind of credential the request carried. */
    credential: RateLimitCredential.pipe(
      $I.annoteKey("RateLimitObservation.credential", { description: "The kind of credential the request carried." })
    ),
    /** The route or operation name, as the caller passed it. */
    operation: S.String.pipe(
      $I.annoteKey("RateLimitObservation.operation", {
        description: "The route or operation name, as the caller passed it.",
      })
    ),
    /** Whether the request went to REST or GraphQL. */
    kind: RateLimitRequestKind.pipe(
      $I.annoteKey("RateLimitObservation.kind", { description: "Whether the request went to REST or GraphQL." })
    ),
    /** The HTTP status; 200 for a GraphQL response that carried errors. */
    status: S.Int.pipe(
      $I.annoteKey("RateLimitObservation.status", {
        description: "The HTTP status; 200 for a GraphQL response that carried errors.",
      })
    ),
    /** How the attempt ended, as far as the budget is concerned. */
    outcome: RateLimitOutcome.pipe(
      $I.annoteKey("RateLimitObservation.outcome", {
        description: "How the attempt ended, as far as the budget is concerned.",
      })
    ),
    /** When the response (or the failure) was seen, by the Effect clock. */
    at: S.DateTimeUtc.pipe(
      $I.annoteKey("RateLimitObservation.at", {
        description: "When the response or the failure was seen, by the Effect clock.",
      })
    ),
  }).pipe(
    $I.annoteSchema("RateLimitObservation", { description: "One GitHub response's rate-limit headers, in context." })
  )
) {}

/**
 * The operations a {@link RateLimitSink} provides.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface RateLimitSinkShape {
  /**
   * Accept one observation.
   *
   * **Gotchas**
   *
   * The transport bounds this call to 250 ms and absorbs any failure or
   * defect, so a slow or broken sink never fails or stalls a request; it runs
   * on the requesting fiber, so fiber-local context is visible to it.
   */
  readonly record: (observation: RateLimitObservation) => Effect.Effect<void>;
}

/**
 * Where the transport sends every rate-limit observation.
 *
 * **Details**
 *
 * A `Context.Reference`: reading it adds nothing to a layer's requirements,
 * and its default drops every observation, so a client built without one
 * behaves exactly as before. The transport captures the sink once, when the
 * client layer is built, from the context that layer is built in.
 *
 * **Example** (Collect observations in memory)
 *
 * ```ts
 * import { GitHubClient } from "@beep/github/GitHubClient";
 * import { RateLimitSink } from "@beep/github/Resilience";
 * import type { RateLimitObservation } from "@beep/github/Resilience";
 * import * as Effect from "effect/Effect";
 * import * as Layer from "effect/Layer";
 * import * as Redacted from "effect/Redacted";
 *
 * const seen: Array<RateLimitObservation> = [];
 * const sink = Layer.succeed(RateLimitSink, {
 *   record: (observation) => Effect.sync(() => seen.push(observation)),
 * });
 * const client = GitHubClient.layerFromToken({ token: Redacted.make("example-token"), budgetLabel: "user:octocat" });
 * console.log(Layer.isLayer(Layer.provide(client, sink))) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export const RateLimitSink: Context.Reference<RateLimitSinkShape> = Context.Reference<RateLimitSinkShape>(
  $I`RateLimitSink`,
  { defaultValue: () => ({ record: () => Effect.void }) }
);

/**
 * The shape {@link RetryPolicy} needs from a failure to decide anything.
 *
 * **Details**
 *
 * Declared structurally so this module imports no error class. That keeps the
 * policy usable for both the REST and the GraphQL error without either of them
 * importing the other, and it makes every policy decision testable against a
 * two-field literal instead of a constructed error. The policy's members take
 * {@link RetryableFailure.Encoded}, so any error carrying the two fields is
 * accepted as it is.
 *
 * **Example** (Describe a rate-limited failure)
 *
 * ```ts
 * import { RetryableFailure } from "@beep/github/Resilience";
 *
 * const failure = RetryableFailure.make({ retryable: true, retryAfterMillis: 2000 });
 * console.log(failure.retryAfterMillis) // 2000
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class RetryableFailure extends S.Opaque<RetryableFailure, { readonly brand: unique symbol }>()(
  S.Struct({
    /** A server-advised delay in milliseconds, when GitHub sent one. */
    retryAfterMillis: S.optionalKey(S.Finite).pipe(
      $I.annoteKey("RetryableFailure.retryAfterMillis", {
        description: "A server-advised delay in milliseconds, when GitHub sent one.",
      })
    ),
    /** Whether retrying could plausibly succeed. */
    retryable: S.Boolean.pipe(
      $I.annoteKey("RetryableFailure.retryable", { description: "Whether retrying could plausibly succeed." })
    ),
  }).pipe(
    $I.annoteSchema("RetryableFailure", {
      description: "The shape RetryPolicy needs from a failure to decide anything.",
    })
  )
) {}

/**
 * Companion types for {@link RetryableFailure}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RetryableFailure {
  /**
   * The plain two-field shape every policy member accepts, which `GitHubError`
   * and `GitHubGraphQLError` already satisfy.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof RetryableFailure.Encoded;
}

/**
 * How the client retries a failed request.
 *
 * **Details**
 *
 * There is exactly **one** retry policy in this package, and it is wired into
 * the client so every resource inherits it and no resource carries its own.
 *
 * Only failures that report `retryable` are retried, which for `GitHubError`
 * means a transport failure or a rate limit. A 404, a validation rejection and
 * an authorization failure fail on the first attempt.
 *
 * A write GitHub may already have applied (a REST `POST` or `PATCH`, or a
 * GraphQL mutation) is retried only after a rate limit, which GitHub answers
 * before doing anything. An ambiguous transport failure on such a write fails
 * at once, so a lost response never posts a second comment or reply.
 *
 * **Example** (Configure retry limits for a token-authenticated client)
 *
 * ```ts
 * import { GitHubClient } from "@beep/github/GitHubClient";
 * import { RetryPolicy } from "@beep/github/Resilience";
 * import * as Duration from "effect/Duration";
 * import * as Layer from "effect/Layer";
 * import * as Redacted from "effect/Redacted";
 *
 * const layer = GitHubClient.layerFromToken({
 *   token: Redacted.make("ghp_example"),
 *   retry: RetryPolicy.make({ ...RetryPolicy.default, maxRetries: 2, maxDelay: Duration.seconds(10) }),
 * });
 * console.log(Layer.isLayer(layer)) // true
 * ```
 *
 * @public
 * @category policies
 * @since 0.0.0
 */
export class RetryPolicy extends S.Class<RetryPolicy, { readonly brand: unique symbol }>($I`RetryPolicy`)(
  {
    /** Retries after the first attempt. `0` disables retrying. */
    maxRetries: S.Int.check(S.isBetween({ minimum: 0, maximum: 10 })).pipe(
      $I.annoteKey("RetryPolicy.maxRetries", { description: "Retries after the first attempt. `0` disables retrying." })
    ),
    /** The first backoff step; doubles per attempt. */
    baseDelay: S.DurationFromMillis.pipe(
      $I.annoteKey("RetryPolicy.baseDelay", { description: "The first backoff step; doubles per attempt." })
    ),
    /** The computed backoff never exceeds this. */
    maxDelay: S.DurationFromMillis.pipe(
      $I.annoteKey("RetryPolicy.maxDelay", { description: "The computed backoff never exceeds this." })
    ),
    /** Prefer GitHub's `retry-after` / rate-limit reset over the computed backoff. */
    respectRetryAfter: S.Boolean.pipe(
      $I.annoteKey("RetryPolicy.respectRetryAfter", {
        description: "Prefer GitHub's `retry-after` / rate-limit reset over the computed backoff.",
      })
    ),
    /**
     * Refuse to wait longer than this for a server-advised delay.
     *
     * **Gotchas**
     *
     * A primary rate-limit window can be three quarters of an hour out. Sleeping
     * through it converts a failure into a hang, so past this ceiling the error
     * is re-failed immediately and the caller decides what to do.
     */
    maxServerAdvisedDelay: S.DurationFromMillis.pipe(
      $I.annoteKey("RetryPolicy.maxServerAdvisedDelay", {
        description: "Refuse to wait longer than this for a server-advised delay.",
      })
    ),
  },
  $I.annote("RetryPolicy", { description: "How the client retries a failed request." })
) {
  /**
   * Four retries, 1s base, 30s cap, honoring server-advised delays up to a minute.
   *
   * **Example** (Inspect the default retry count)
   *
   * ```ts
   * import { RetryPolicy } from "@beep/github/Resilience";
   *
   * console.log(RetryPolicy.default.maxRetries) // 4
   * ```
   *
   * @category constants
   * @since 0.0.0
   */
  static readonly default: RetryPolicy = RetryPolicy.make({
    maxRetries: 4,
    baseDelay: Duration.seconds(1),
    maxDelay: Duration.seconds(30),
    respectRetryAfter: true,
    maxServerAdvisedDelay: Duration.seconds(60),
  });

  /**
   * Retries nothing; every failure surfaces on the first attempt.
   *
   * **Example** (Disable retries for transient failures)
   *
   * ```ts
   * import { RetryPolicy } from "@beep/github/Resilience";
   *
   * console.log(RetryPolicy.none.retries({ retryable: true })) // false
   * ```
   *
   * @category constants
   * @since 0.0.0
   */
  static readonly none: RetryPolicy = RetryPolicy.make({
    maxRetries: 0,
    baseDelay: Duration.zero,
    maxDelay: Duration.zero,
    respectRetryAfter: false,
    maxServerAdvisedDelay: Duration.zero,
  });

  /**
   * Whether this policy would retry `failure` at all, ignoring attempt counts.
   *
   * **Details**
   *
   * Pure and total, so the classification is testable without a clock, a
   * runtime or a schedule.
   *
   * **Example** (Reject a server delay beyond the ceiling)
   *
   * ```ts
   * import { RetryPolicy } from "@beep/github/Resilience";
   *
   * console.log(RetryPolicy.default.retries({ retryable: true, retryAfterMillis: 120000 })) // false
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  retries(failure: RetryableFailure.Encoded): boolean {
    if (this.maxRetries === 0 || !failure.retryable) return false;
    const advised = this.advisedMillis(failure);
    return advised === undefined || advised <= Duration.toMillis(this.maxServerAdvisedDelay);
  }

  /**
   * The delay before the given attempt, for a failure and a `[0, 1)` draw.
   *
   * **Details**
   *
   * A server-advised delay wins outright when `respectRetryAfter`
   * is set: GitHub knows when its window reopens and a computed backoff can only
   * guess. Otherwise this is **full jitter** — a uniform draw from
   * `[0, min(baseDelay * 2^(attempt-1), maxDelay)]` — which spreads a fleet of
   * retrying callers rather than synchronizing them into a second herd.
   *
   * `random` is a parameter so the arithmetic is checkable without stubbing a
   * generator.
   *
   * **Example** (Compute deterministic full jitter)
   *
   * ```ts
   * import { RetryPolicy } from "@beep/github/Resilience";
   * import * as Duration from "effect/Duration";
   *
   * const delay = RetryPolicy.default.delayFor({ retryable: true }, 1, 0.5);
   * console.log(Duration.toMillis(delay)) // 500
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  delayFor(failure: RetryableFailure.Encoded, attempt: number, random: number): Duration.Duration {
    const advised = this.advisedMillis(failure);
    if (advised !== undefined) return Duration.millis(advised);
    const uncapped = Duration.toMillis(this.baseDelay) * 2 ** Math.max(0, attempt - 1);
    const capped = Math.min(uncapped, Duration.toMillis(this.maxDelay));
    return Duration.millis(Math.floor(capped * random));
  }

  /**
   * The server-advised delay, when there is one and this policy honors it.
   *
   * **Example** (Honor an advised delay)
   *
   * ```ts
   * import { RetryPolicy } from "@beep/github/Resilience";
   * import * as Duration from "effect/Duration";
   *
   * const delay = RetryPolicy.default.delayFor({ retryable: true, retryAfterMillis: 2000 }, 1, 0.5);
   * console.log(Duration.toMillis(delay)) // 2000
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  private advisedMillis(failure: RetryableFailure.Encoded): number | undefined {
    return this.respectRetryAfter ? failure.retryAfterMillis : undefined;
  }

  /**
   * The `Schedule` this policy compiles to, for `Effect.retry`.
   *
   * **Details**
   *
   * Built on `Schedule.modifyDelay`, whose callback receives the schedule's
   * `Metadata` — including the **input that failed**. That is what makes a
   * header-driven policy expressible as a `Schedule` at all: the delay is a
   * function of the error, not only of the attempt number.
   *
   * **Example** (Attach the policy to a successful effect)
   *
   * ```ts
   * import { RetryPolicy } from "@beep/github/Resilience";
   * import * as Effect from "effect/Effect";
   *
   * const program = Effect.succeed("ok").pipe(Effect.retry(RetryPolicy.default.schedule()));
   * console.log(Effect.runSync(program)) // ok
   * ```
   *
   * @category schedulers
   * @since 0.0.0
   */
  schedule<E extends RetryableFailure.Encoded>(): Schedule.Schedule<number, E> {
    return Schedule.forever.pipe(
      Schedule.modifyDelay(({ input, attempt }: Schedule.Metadata<number, E>) =>
        Effect.map(Random.next, (random) => this.delayFor(input, attempt, random))
      ),
      Schedule.while(
        ({ input, attempt }: Schedule.Metadata<number, E>) => attempt <= this.maxRetries && this.retries(input)
      )
    );
  }
}
