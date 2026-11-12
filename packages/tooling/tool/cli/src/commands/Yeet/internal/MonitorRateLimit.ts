/**
 * GitHub rate-limit handling for the `yeet monitor` merge loop.
 *
 * Every fleet host and session shares one GitHub user bucket. When it drains,
 * every poll of every detached monitor fails, and an ordinary consecutive
 * failure budget would end all of them within minutes of each other. A poll
 * that failed on a GitHub rate limit therefore sleeps until the bucket resets
 * (or backs off exponentially for a secondary limit) instead of spending the
 * poll-error budget.
 *
 * **Details**
 *
 * The classifier reads the failure text gh and octokit put in the
 * `YeetCommandError` message. The pause reads `GET /rate_limit`, which does not
 * count against the primary limit, and sleeps until the latest reset of an
 * exhausted bucket. Rate-limited polls are bounded on their own counter, so a
 * permanent error that merely looks like a rate limit still ends the loop.
 *
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { readGithubRateLimit, recordRateLimitRead } from "../../../internal/github/GithubRateLimitSampler.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/MonitorRateLimit");

/**
 * Consecutive rate-limited polls the merge loop sleeps through before it
 * counts further ones as ordinary poll failures.
 *
 * **Details**
 *
 * A misclassified permanent error must still terminate the loop: after this
 * many rate-limited polls without a successful one, each further rate-limited
 * poll spends the ordinary poll-error budget.
 *
 * **Example** (Read the bound)
 *
 * ```ts
 * import { YEET_MONITOR_RATE_LIMIT_BUDGET } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YEET_MONITOR_RATE_LIMIT_BUDGET) // 8
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_MONITOR_RATE_LIMIT_BUDGET = 8;

/**
 * Which GitHub rate limit a failed poll hit.
 *
 * **Details**
 *
 * `primary` is the hourly REST or GraphQL quota; `secondary` is GitHub's
 * abuse-style limit (concurrency, burst, or an unexplained HTTP 429), which has
 * no reset time and is waited out by exponential backoff.
 *
 * **Example** (List the limit kinds)
 *
 * ```ts
 * import { YeetGithubRateLimitKind } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetGithubRateLimitKind.literals) // ["primary", "secondary"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetGithubRateLimitKind = LiteralKit(["primary", "secondary"]).pipe(
  $I.annoteSchema("YeetGithubRateLimitKind", {
    title: "Yeet GitHub Rate Limit Kind",
    description: "Which GitHub rate limit a failed monitor poll hit.",
  })
);

/**
 * Which GitHub rate limit a failed poll hit.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetGithubRateLimitKind = typeof YeetGithubRateLimitKind.Type;

/**
 * The `GET /rate_limit` buckets the merge loop reads.
 *
 * **Example** (List the buckets)
 *
 * ```ts
 * import { YeetGithubRateLimitBucketName } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetGithubRateLimitBucketName.literals) // ["core", "graphql"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetGithubRateLimitBucketName = LiteralKit(["core", "graphql"]).pipe(
  $I.annoteSchema("YeetGithubRateLimitBucketName", {
    title: "Yeet GitHub Rate Limit Bucket Name",
    description: "A GET /rate_limit resource the merge loop reads.",
  })
);

/**
 * A `GET /rate_limit` bucket the merge loop reads.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetGithubRateLimitBucketName = typeof YeetGithubRateLimitBucketName.Type;

// Ordered: an explicit secondary-limit message wins over the generic phrase it
// also contains, and the primary signatures win over a bare 429. None of them
// matches the bare word "limit".
const rateLimitSignatures: ReadonlyArray<readonly [RegExp, YeetGithubRateLimitKind]> = [
  [/secondary rate limit/i, "secondary"],
  [/api rate limit (?:already )?exceeded/i, "primary"],
  [/graphql_rate_limit/i, "primary"],
  [/"type"\s*:\s*"rate_limit(?:ed)?"/i, "primary"],
  [/\brate_limited\b/i, "primary"],
  [/rate limit exceeded/i, "primary"],
  [/http 429\b/i, "secondary"],
];

/**
 * Classify a failed poll's message as a GitHub rate limit.
 *
 * **Details**
 *
 * Recognises gh's and octokit's texts: `API rate limit (already) exceeded`,
 * `secondary rate limit`, `graphql_rate_limit`, a GraphQL error whose `type`
 * is `RATE_LIMIT` or `RATE_LIMITED`, `rate limit exceeded`, and `HTTP 429`,
 * case-insensitively. Anything else is an ordinary failure.
 *
 * **Example** (Classify a gh rate-limit failure)
 *
 * ```ts
 * import { classifyYeetGithubRateLimit } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const kind = classifyYeetGithubRateLimit("HTTP 403: API rate limit exceeded for user ID 1")
 * console.log(O.getOrNull(kind)) // "primary"
 * ```
 *
 * @param message - The failed poll's error message.
 * @returns The rate-limit kind, or none for an ordinary failure.
 * @category utilities
 * @since 0.0.0
 */
export const classifyYeetGithubRateLimit = (message: string): O.Option<YeetGithubRateLimitKind> =>
  O.map(
    A.findFirst(rateLimitSignatures, ([pattern]) => pattern.test(message)),
    ([, kind]) => kind
  );

/**
 * One `GET /rate_limit` bucket: what is left and when it resets.
 *
 * **Example** (Construct an exhausted bucket)
 *
 * ```ts
 * import { YeetGithubRateLimitBucket } from "@beep/repo-cli/test/Yeet"
 *
 * const bucket = YeetGithubRateLimitBucket.make({ remaining: 0, reset: 1_789_517_400 })
 * console.log(bucket.remaining) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetGithubRateLimitBucket extends S.Opaque<YeetGithubRateLimitBucket, { readonly brand: unique symbol }>()(
  S.Struct({ remaining: S.Int, reset: S.Int }).pipe(
    $I.annoteSchema("YeetGithubRateLimitBucket", {
      description: "A GitHub rate-limit bucket: remaining requests and the reset time in epoch seconds.",
    })
  )
) {}

/**
 * The `GET /rate_limit` buckets the merge loop decides on.
 *
 * **Example** (Construct the REST and GraphQL buckets)
 *
 * ```ts
 * import { YeetGithubRateLimitBucket, YeetGithubRateLimitResources } from "@beep/repo-cli/test/Yeet"
 *
 * const resources = YeetGithubRateLimitResources.make({
 *   core: YeetGithubRateLimitBucket.make({ remaining: 4_000, reset: 1_789_517_400 }),
 *   graphql: YeetGithubRateLimitBucket.make({ remaining: 0, reset: 1_789_518_000 }),
 * })
 * console.log(resources.graphql.remaining) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetGithubRateLimitResources extends S.Opaque<
  YeetGithubRateLimitResources,
  { readonly brand: unique symbol }
>()(
  S.Struct({ core: YeetGithubRateLimitBucket, graphql: YeetGithubRateLimitBucket }).pipe(
    $I.annoteSchema("YeetGithubRateLimitResources", {
      description: "The REST core and GraphQL buckets of a GitHub rate-limit read.",
    })
  )
) {}

/**
 * The decoded `GET /rate_limit` response the merge loop reads.
 *
 * **Example** (Decode a rate-limit read)
 *
 * ```ts
 * import { YeetGithubRateLimitSnapshot } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const snapshot = S.decodeUnknownSync(YeetGithubRateLimitSnapshot)({
 *   resources: { core: { remaining: 0, reset: 1 }, graphql: { remaining: 10, reset: 2 } },
 * })
 * console.log(snapshot.resources.core.remaining) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetGithubRateLimitSnapshot extends S.Opaque<
  YeetGithubRateLimitSnapshot,
  { readonly brand: unique symbol }
>()(
  S.Struct({ resources: YeetGithubRateLimitResources }).pipe(
    $I.annoteSchema("YeetGithubRateLimitSnapshot", {
      description: "The GET /rate_limit response the merge loop reads to time a rate-limit pause.",
    })
  )
) {}

const exhaustedBuckets = (snapshot: YeetGithubRateLimitSnapshot) =>
  A.filter(
    [
      ["core", snapshot.resources.core],
      ["graphql", snapshot.resources.graphql],
    ] as const,
    ([, bucket]) => bucket.remaining === 0
  );

/**
 * Decide whether a failed poll hit a GitHub rate limit, from its text or from
 * the `GET /rate_limit` read taken after it.
 *
 * **Details**
 *
 * The status read loses gh's text at several sites (a GraphQL census read
 * that fell back, a review-thread read whose cause is not in the message), so
 * a failure whose text classifies as nothing still counts as a `primary`
 * limit when the read shows the REST core or GraphQL bucket at zero.
 *
 * **Example** (A census failure during a GraphQL drain)
 *
 * ```ts
 * import {
 *   resolveYeetGithubRateLimitKind,
 *   YeetGithubRateLimitBucket,
 *   YeetGithubRateLimitResources,
 *   YeetGithubRateLimitSnapshot,
 * } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const read = YeetGithubRateLimitSnapshot.make({
 *   resources: YeetGithubRateLimitResources.make({
 *     core: YeetGithubRateLimitBucket.make({ remaining: 4_000, reset: 1 }),
 *     graphql: YeetGithubRateLimitBucket.make({ remaining: 0, reset: 2 }),
 *   }),
 * })
 * const kind = resolveYeetGithubRateLimitKind("Failed to read the complete pull request check census.", O.some(read))
 * console.log(O.getOrNull(kind)) // "primary"
 * ```
 *
 * @param message - The failed poll's error message.
 * @param snapshot - The `GET /rate_limit` read, or none when it failed.
 * @returns The rate-limit kind, or none for an ordinary failure.
 * @category utilities
 * @since 0.0.0
 */
export const resolveYeetGithubRateLimitKind: {
  (snapshot: O.Option<YeetGithubRateLimitSnapshot>): (message: string) => O.Option<YeetGithubRateLimitKind>;
  (message: string, snapshot: O.Option<YeetGithubRateLimitSnapshot>): O.Option<YeetGithubRateLimitKind>;
} = dual(
  2,
  (message: string, snapshot: O.Option<YeetGithubRateLimitSnapshot>): O.Option<YeetGithubRateLimitKind> =>
    O.orElse(classifyYeetGithubRateLimit(message), () =>
      O.as(
        O.filter(snapshot, (read) => A.isReadonlyArrayNonEmpty(exhaustedBuckets(read))),
        YeetGithubRateLimitKind.Enum.primary
      )
    )
);

/**
 * Read `GET /rate_limit` through the provided GitHub client.
 *
 * **Details**
 *
 * The endpoint does not count against the primary limit, so the merge loop can
 * read it while the bucket is empty. Only `core` and `graphql` are required;
 * any other bucket that is malformed or new is ignored. With a GitHub budget
 * ledger bound, the read is also recorded as a `monitor-pause` sample.
 *
 * **Example** (Reference the read)
 *
 * ```ts
 * import { readYeetGithubRateLimit } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(readYeetGithubRateLimit)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const readYeetGithubRateLimit = Effect.gen(function* () {
  const wire = yield* readGithubRateLimit;
  yield* recordRateLimitRead(wire, "monitor-pause");
  return YeetGithubRateLimitSnapshot.make({
    resources: YeetGithubRateLimitResources.make({
      core: YeetGithubRateLimitBucket.make({
        remaining: wire.resources.core.remaining,
        reset: wire.resources.core.reset,
      }),
      graphql: YeetGithubRateLimitBucket.make({
        remaining: wire.resources.graphql.remaining,
        reset: wire.resources.graphql.reset,
      }),
    }),
  });
});

/**
 * A pause until the latest reset of the exhausted buckets.
 *
 * **Example** (Construct a reset pause)
 *
 * ```ts
 * import { YeetGithubRateLimitResetPause } from "@beep/repo-cli/test/Yeet"
 * import * as DateTime from "effect/DateTime"
 * import * as Duration from "effect/Duration"
 *
 * const pause = YeetGithubRateLimitResetPause.make({
 *   limit: "primary",
 *   buckets: ["graphql"],
 *   resetAt: DateTime.makeUnsafe(605_000),
 *   sleep: Duration.seconds(605),
 * })
 * console.log(pause.kind) // "reset"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetGithubRateLimitResetPause extends S.Opaque<
  YeetGithubRateLimitResetPause,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    kind: S.tag("reset"),
    limit: YeetGithubRateLimitKind,
    buckets: S.NonEmptyArray(YeetGithubRateLimitBucketName),
    resetAt: S.DateTimeUtc,
    sleep: S.Duration,
  }).pipe(
    $I.annoteSchema("YeetGithubRateLimitResetPause", {
      description: "Sleep until the latest reset of the exhausted GitHub buckets, plus a margin.",
    })
  )
) {}

/**
 * An exponential backoff when no bucket is exhausted or the read failed.
 *
 * **Example** (Construct a backoff pause)
 *
 * ```ts
 * import { YeetGithubRateLimitBackoffPause } from "@beep/repo-cli/test/Yeet"
 * import * as Duration from "effect/Duration"
 *
 * const pause = YeetGithubRateLimitBackoffPause.make({ limit: "secondary", attempt: 2, sleep: Duration.minutes(2) })
 * console.log(pause.kind) // "backoff"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetGithubRateLimitBackoffPause extends S.Opaque<
  YeetGithubRateLimitBackoffPause,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    kind: S.tag("backoff"),
    limit: YeetGithubRateLimitKind,
    attempt: S.Int,
    sleep: S.Duration,
  }).pipe(
    $I.annoteSchema("YeetGithubRateLimitBackoffPause", {
      description: "Exponential backoff for a secondary limit or an unreadable rate-limit state.",
    })
  )
) {}

/**
 * How long a rate-limited poll sleeps, and why.
 *
 * **Example** (Match a pause)
 *
 * ```ts
 * import { YeetGithubRateLimitBackoffPause, YeetGithubRateLimitPause } from "@beep/repo-cli/test/Yeet"
 * import * as Duration from "effect/Duration"
 *
 * const pause = YeetGithubRateLimitBackoffPause.make({ limit: "secondary", attempt: 1, sleep: Duration.minutes(1) })
 * console.log(YeetGithubRateLimitPause.match(pause, { reset: () => "reset", backoff: () => "backoff" })) // "backoff"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetGithubRateLimitPause = S.Union([YeetGithubRateLimitResetPause, YeetGithubRateLimitBackoffPause]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("YeetGithubRateLimitPause", {
    description: "How long a rate-limited merge-loop poll sleeps, and why.",
  })
);

/**
 * How long a rate-limited poll sleeps, and why.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetGithubRateLimitPause = typeof YeetGithubRateLimitPause.Type;

const resetMargin = Duration.seconds(5);
const resetPauseCeiling = Duration.minutes(65);
const backoffFloor = Duration.minutes(1);
const backoffCeiling = Duration.minutes(15);

/**
 * The inputs one rate-limit pause is decided from.
 *
 * **Details**
 *
 * `attempt` is the 1-based count of consecutive rate-limited polls, this one
 * included; `interval` is the loop's poll interval and the shortest a reset
 * pause sleeps; `snapshot` is the `GET /rate_limit` read, or none when it
 * failed.
 *
 * **Example** (Construct a pause input without a rate-limit read)
 *
 * ```ts
 * import { YeetGithubRateLimitPauseInput } from "@beep/repo-cli/test/Yeet"
 * import * as DateTime from "effect/DateTime"
 * import * as Duration from "effect/Duration"
 * import * as O from "effect/Option"
 *
 * const input = YeetGithubRateLimitPauseInput.make({
 *   attempt: 1,
 *   interval: Duration.seconds(90),
 *   limit: "secondary",
 *   now: DateTime.makeUnsafe(0),
 *   snapshot: O.none(),
 * })
 * console.log(input.attempt) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetGithubRateLimitPauseInput extends S.Opaque<
  YeetGithubRateLimitPauseInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    attempt: S.Int,
    interval: S.Duration,
    limit: YeetGithubRateLimitKind,
    now: S.DateTimeUtc,
    snapshot: S.Option(YeetGithubRateLimitSnapshot),
  }).pipe(
    $I.annoteSchema("YeetGithubRateLimitPauseInput", {
      description: "The rate-limit read, clock, poll interval and attempt one rate-limit pause is decided from.",
    })
  )
) {}

const backoffPause = (input: YeetGithubRateLimitPauseInput) =>
  YeetGithubRateLimitBackoffPause.make({
    limit: input.limit,
    attempt: input.attempt,
    sleep: Duration.min(Duration.times(backoffFloor, 2 ** Math.max(0, input.attempt - 1)), backoffCeiling),
  });

/**
 * Decide how long a rate-limited poll sleeps.
 *
 * **Details**
 *
 * When a bucket has nothing left, sleep until the latest such reset plus five
 * seconds, clamped to at least the poll interval and at most 65 minutes. When
 * no bucket is exhausted (a secondary limit) or the read failed, back off
 * exponentially from one minute (60 s, 120 s, 240 s, ...), capped at 15
 * minutes, as GitHub's guidance for secondary limits asks.
 *
 * **Example** (Back off without a rate-limit read)
 *
 * ```ts
 * import { decideYeetGithubRateLimitPause, YeetGithubRateLimitPauseInput } from "@beep/repo-cli/test/Yeet"
 * import * as DateTime from "effect/DateTime"
 * import * as Duration from "effect/Duration"
 * import * as O from "effect/Option"
 *
 * const pause = decideYeetGithubRateLimitPause(
 *   YeetGithubRateLimitPauseInput.make({
 *     attempt: 2,
 *     interval: Duration.seconds(90),
 *     limit: "secondary",
 *     now: DateTime.makeUnsafe(0),
 *     snapshot: O.none(),
 *   })
 * )
 * console.log(Duration.toMillis(pause.sleep)) // 120000
 * ```
 *
 * @param input - The rate-limit read, the clock, the poll interval and the attempt.
 * @returns The pause the loop sleeps before its next poll.
 * @category utilities
 * @since 0.0.0
 */
export const decideYeetGithubRateLimitPause = (input: YeetGithubRateLimitPauseInput): YeetGithubRateLimitPause =>
  O.match(
    O.flatMap(input.snapshot, (snapshot) =>
      A.match(exhaustedBuckets(snapshot), {
        onEmpty: O.none,
        onNonEmpty: O.some,
      })
    ),
    {
      onNone: (): YeetGithubRateLimitPause => backoffPause(input),
      onSome: (exhausted) => {
        const resetAt = DateTime.makeUnsafe(
          Math.max(...A.map(exhausted, ([, bucket]) => bucket.reset)) * 1000 + Duration.toMillis(resetMargin)
        );
        const until = Duration.millis(Math.max(0, DateTime.toEpochMillis(resetAt) - DateTime.toEpochMillis(input.now)));
        return YeetGithubRateLimitResetPause.make({
          limit: input.limit,
          buckets: A.map(exhausted, ([name]) => name),
          resetAt,
          sleep: Duration.clamp(until, { minimum: input.interval, maximum: resetPauseCeiling }),
        });
      },
    }
  );

// Whole seconds: the reset is second-resolution and the log is for people.
const renderPauseDuration = (sleep: Duration.Duration) =>
  Duration.format(Duration.seconds(Math.ceil(Duration.toSeconds(sleep))));

/**
 * The one log line a rate-limited poll prints.
 *
 * **Example** (Render a backoff)
 *
 * ```ts
 * import { renderYeetGithubRateLimitPause, YeetGithubRateLimitBackoffPause } from "@beep/repo-cli/test/Yeet"
 * import * as Duration from "effect/Duration"
 *
 * const pause = YeetGithubRateLimitBackoffPause.make({ limit: "secondary", attempt: 1, sleep: Duration.minutes(1) })
 * console.log(renderYeetGithubRateLimitPause(pause))
 * // "[yeet] GitHub rate limit (secondary): backing off 1m (rate-limited poll 1/8) instead of spending the poll-error budget"
 * ```
 *
 * @param pause - The decided pause.
 * @returns The log line.
 * @category utilities
 * @since 0.0.0
 */
export const renderYeetGithubRateLimitPause = (pause: YeetGithubRateLimitPause): string =>
  YeetGithubRateLimitPause.match(pause, {
    reset: (reset) =>
      `[yeet] GitHub rate limit (${reset.limit}, ${A.join(reset.buckets, "+")}): sleeping until ${reset.resetAt.pipe(DateTime.formatIso, Str.slice(11, 19))}Z (${renderPauseDuration(reset.sleep)}) instead of spending the poll-error budget`,
    backoff: (backoff) =>
      `[yeet] GitHub rate limit (${backoff.limit}): backing off ${renderPauseDuration(backoff.sleep)} (rate-limited poll ${backoff.attempt}/${YEET_MONITOR_RATE_LIMIT_BUDGET}) instead of spending the poll-error budget`,
  });

/**
 * How one merge-loop poll counts against the loop's budgets.
 *
 * **Details**
 *
 * `rate-limited` is a failure the loop sleeps through without spending the
 * poll-error budget; `failed` spends it.
 *
 * **Example** (List the outcomes)
 *
 * ```ts
 * import { YeetMonitorPollOutcome } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetMonitorPollOutcome.literals) // ["succeeded", "failed", "rate-limited"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetMonitorPollOutcome = LiteralKit(["succeeded", "failed", "rate-limited"]).pipe(
  $I.annoteSchema("YeetMonitorPollOutcome", {
    title: "Yeet Monitor Poll Outcome",
    description: "How one merge-loop poll counts against the loop's budgets.",
  })
);

/**
 * How one merge-loop poll counts against the loop's budgets.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetMonitorPollOutcome = typeof YeetMonitorPollOutcome.Type;

/**
 * The merge loop's consecutive-failure counters.
 *
 * **Details**
 *
 * `failures` counts consecutive ordinary failures (the poll-error budget);
 * `rateLimited` counts rate-limited polls since the last successful one.
 * `outcome` is how the last accounted poll counted, after a rate-limited poll
 * past {@link YEET_MONITOR_RATE_LIMIT_BUDGET} was demoted to `failed`.
 *
 * **Example** (Construct a fresh budget)
 *
 * ```ts
 * import { YeetMonitorPollBudget } from "@beep/repo-cli/test/Yeet"
 *
 * const budget = YeetMonitorPollBudget.make({})
 * console.log(budget.failures, budget.rateLimited, budget.outcome) // 0 0 "succeeded"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetMonitorPollBudget extends S.Opaque<YeetMonitorPollBudget, { readonly brand: unique symbol }>()(
  S.Struct({
    failures: S.Int.pipe(S.withConstructorDefault(Effect.succeed(0))),
    rateLimited: S.Int.pipe(S.withConstructorDefault(Effect.succeed(0))),
    outcome: YeetMonitorPollOutcome.pipe(
      S.withConstructorDefault(Effect.succeed(YeetMonitorPollOutcome.Enum.succeeded))
    ),
  }).pipe(
    $I.annoteSchema("YeetMonitorPollBudget", {
      description: "The merge loop's consecutive poll-error and rate-limited counters.",
    })
  )
) {}

/**
 * Account one poll against the merge loop's budgets.
 *
 * **Details**
 *
 * A successful poll resets both counters. An ordinary failure spends the
 * poll-error budget and leaves the rate-limited count alone. A rate-limited
 * poll neither spends nor resets the poll-error budget, until
 * {@link YEET_MONITOR_RATE_LIMIT_BUDGET} of them have passed since the last
 * success; after that it is counted as an ordinary failure.
 *
 * **Example** (A rate-limited poll does not spend the poll-error budget)
 *
 * ```ts
 * import { stepYeetMonitorPollBudget, YeetMonitorPollBudget } from "@beep/repo-cli/test/Yeet"
 *
 * const next = stepYeetMonitorPollBudget(YeetMonitorPollBudget.make({ failures: 2 }), "rate-limited")
 * console.log(next.failures, next.rateLimited, next.outcome) // 2 1 "rate-limited"
 * ```
 *
 * @param budget - The counters before this poll.
 * @param outcome - How this poll ended.
 * @returns The counters after this poll, with the outcome it counted as.
 * @category utilities
 * @since 0.0.0
 */
export const stepYeetMonitorPollBudget: {
  (outcome: YeetMonitorPollOutcome): (budget: YeetMonitorPollBudget) => YeetMonitorPollBudget;
  (budget: YeetMonitorPollBudget, outcome: YeetMonitorPollOutcome): YeetMonitorPollBudget;
} = dual(2, (budget: YeetMonitorPollBudget, outcome: YeetMonitorPollOutcome): YeetMonitorPollBudget => {
  const failed = () =>
    YeetMonitorPollBudget.make({
      failures: budget.failures + 1,
      rateLimited: budget.rateLimited,
      outcome: YeetMonitorPollOutcome.Enum.failed,
    });
  return YeetMonitorPollOutcome.match(outcome, {
    succeeded: () => YeetMonitorPollBudget.make({}),
    failed,
    "rate-limited": () =>
      budget.rateLimited >= YEET_MONITOR_RATE_LIMIT_BUDGET
        ? failed()
        : YeetMonitorPollBudget.make({
            failures: budget.failures,
            rateLimited: budget.rateLimited + 1,
            outcome: YeetMonitorPollOutcome.Enum["rate-limited"],
          }),
  });
});
