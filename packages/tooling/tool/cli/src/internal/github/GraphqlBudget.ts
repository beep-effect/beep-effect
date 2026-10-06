/**
 * A budget guard for the GitHub operations that only exist in GraphQL.
 *
 * **Details**
 *
 * GraphQL is 5,000 points per hour per identity, shared by every session on
 * the workstation account, and it ran dry three times on 2026-10-06. The
 * operations with no REST equivalent (the draft-to-ready flip, review-thread
 * resolution state) go through {@link GraphqlBudget.guard}: it spends one
 * point on `rateLimit { remaining resetAt }` first and, when fewer than the
 * policy threshold remain, either waits until `resetAt` (bounded and logged)
 * or fails with a typed {@link GraphqlBudgetExhausted} that carries `resetAt`.
 *
 * When the probe itself is refused for rate limiting, the guard falls back to
 * the REST `/rate_limit` graphql bucket for the reset time and treats the
 * remaining points as zero; REST misreports the remaining GraphQL points, so
 * the probe is the truth whenever it answers.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { GitHubClient, GraphQLDocument } from "@effected/github";
import { Console, Context, DateTime, Duration, Effect, Layer } from "effect";
import * as S from "effect/Schema";
import { graphqlErrorToGitHubError } from "./GithubGraphql.ts";
import type { GitHubError } from "@effected/github";

const $I = $RepoCliId.create("internal/github/GraphqlBudget");

/**
 * Where a budget snapshot came from.
 *
 * @category models
 * @since 0.0.0
 */
export const GraphqlBudgetSource = LiteralKit(["graphql-probe", "rest-fallback"]).pipe(
  $I.annoteSchema("GraphqlBudgetSource", { description: "Where a GraphQL budget snapshot came from." })
);

/**
 * The remaining GraphQL points and when the window resets.
 *
 * **Example** (A nearly spent budget)
 *
 * ```ts
 * import { GraphqlBudgetSnapshot } from "@beep/repo-cli/test/SharedInternals"
 * import { DateTime } from "effect"
 *
 * const snapshot = GraphqlBudgetSnapshot.make({
 *   remaining: 3,
 *   resetAt: DateTime.makeUnsafe("2026-10-06T17:29:00Z"),
 *   source: "graphql-probe"
 * })
 * console.log(snapshot.remaining) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraphqlBudgetSnapshot extends S.Class<GraphqlBudgetSnapshot>($I`GraphqlBudgetSnapshot`)(
  { remaining: S.Int, resetAt: S.DateTimeUtc, source: GraphqlBudgetSource },
  $I.annote("GraphqlBudgetSnapshot", { description: "Remaining GraphQL points and the window reset time." })
) {}

/**
 * How the guard treats a low budget.
 *
 * **Details**
 *
 * `threshold` is the fewest points an operation may start with. With `wait`
 * the guard sleeps until `resetAt` (plus a few seconds) when the reset is at
 * most `maxWait` away; otherwise it fails at once.
 *
 * **Example** (The default policy)
 *
 * ```ts
 * import { GraphqlBudgetPolicy } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(GraphqlBudgetPolicy.default.threshold) // 25
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraphqlBudgetPolicy extends S.Class<GraphqlBudgetPolicy>($I`GraphqlBudgetPolicy`)(
  { threshold: S.Int, wait: S.Boolean, maxWait: S.Duration },
  $I.annote("GraphqlBudgetPolicy", { description: "How the GraphQL budget guard treats a low budget." })
) {
  /** Wait up to 65 minutes when fewer than 25 points remain. */
  static readonly default = GraphqlBudgetPolicy.make({ threshold: 25, wait: true, maxWait: Duration.minutes(65) });

  /** The default policy with waiting switched off (`--no-wait`). */
  static readonly noWait = GraphqlBudgetPolicy.make({ threshold: 25, wait: false, maxWait: Duration.zero });
}

/**
 * What the guard does with a snapshot.
 *
 * @category models
 * @since 0.0.0
 */
export const GraphqlBudgetAction = LiteralKit(["proceed", "wait", "refuse"]).pipe(
  $I.annoteSchema("GraphqlBudgetAction", { description: "The guard's decision for a budget snapshot." })
);

/**
 * The guard's decision and, for `wait`, how long.
 *
 * @category models
 * @since 0.0.0
 */
export class GraphqlBudgetDecision extends S.Class<GraphqlBudgetDecision>($I`GraphqlBudgetDecision`)(
  { action: GraphqlBudgetAction, waitFor: S.Duration },
  $I.annote("GraphqlBudgetDecision", { description: "The guard's decision for a budget snapshot." })
) {}

const WAIT_SLACK = Duration.seconds(5);

/**
 * Decide whether an operation may spend GraphQL points now.
 *
 * **Example** (Wait for a reset ten minutes away)
 *
 * ```ts
 * import { decideGraphqlBudget, GraphqlBudgetPolicy, GraphqlBudgetSnapshot } from "@beep/repo-cli/test/SharedInternals"
 * import { DateTime } from "effect"
 *
 * const now = DateTime.makeUnsafe("2026-10-06T17:19:00Z")
 * const snapshot = GraphqlBudgetSnapshot.make({
 *   remaining: 0,
 *   resetAt: DateTime.makeUnsafe("2026-10-06T17:29:00Z"),
 *   source: "graphql-probe"
 * })
 * console.log(decideGraphqlBudget({ snapshot, policy: GraphqlBudgetPolicy.default, now }).action) // "wait"
 * ```
 *
 * @param input - The budget read just now, the threshold and waiting rules, and the current time.
 * @returns Proceed, wait (with a duration), or refuse.
 * @category decisions
 * @since 0.0.0
 */
export const decideGraphqlBudget = ({
  snapshot,
  policy,
  now,
}: {
  readonly snapshot: GraphqlBudgetSnapshot;
  readonly policy: GraphqlBudgetPolicy;
  readonly now: DateTime.Utc;
}): GraphqlBudgetDecision => {
  if (snapshot.remaining >= policy.threshold) {
    return GraphqlBudgetDecision.make({ action: "proceed", waitFor: Duration.zero });
  }
  const untilReset = Duration.millis(
    Math.max(0, DateTime.toEpochMillis(snapshot.resetAt) - DateTime.toEpochMillis(now))
  );
  const waitFor = Duration.sum(untilReset, WAIT_SLACK);
  return policy.wait && Duration.isLessThanOrEqualTo(untilReset, policy.maxWait)
    ? GraphqlBudgetDecision.make({ action: "wait", waitFor })
    : GraphqlBudgetDecision.make({ action: "refuse", waitFor });
};

/**
 * The GraphQL budget is below the policy threshold and the guard did not (or
 * could not) wait for the reset.
 *
 * **Example** (Build the error)
 *
 * ```ts
 * import { GraphqlBudgetExhausted } from "@beep/repo-cli/test/SharedInternals"
 * import { DateTime } from "effect"
 *
 * const error = GraphqlBudgetExhausted.make({
 *   operation: "markPullRequestReadyForReview",
 *   remaining: 0,
 *   resetAt: DateTime.makeUnsafe("2026-10-06T17:29:00Z")
 * })
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GraphqlBudgetExhausted extends S.TaggedError<GraphqlBudgetExhausted>($I`GraphqlBudgetExhausted`)(
  "GraphqlBudgetExhausted",
  { operation: S.String, remaining: S.Int, resetAt: S.DateTimeUtc },
  $I.annoteError<GraphqlBudgetExhausted>("GraphqlBudgetExhausted", {
    description: "The GraphQL budget is below the policy threshold.",
  })
) {
  override get message(): string {
    return `GitHub GraphQL budget too low for ${this.operation} (${this.remaining} points left, resets ${DateTime.formatIso(this.resetAt)})`;
  }
}

const RateLimitData = S.Struct({ rateLimit: S.Struct({ remaining: S.Int, resetAt: S.DateTimeUtcFromString }) });

/**
 * The one-point `rateLimit` probe document.
 *
 * @category documents
 * @since 0.0.0
 */
export const graphqlRateLimitDocument = GraphQLDocument.make({
  name: "rateLimit",
  document: "query { rateLimit { remaining resetAt } }",
  response: RateLimitData,
})<Record<string, never>>();

const RestGraphqlBucket = S.Struct({
  resources: S.Struct({ graphql: S.Struct({ remaining: S.Int, reset: S.Int }) }),
});

/**
 * The GraphQL budget guard.
 *
 * @category models
 * @since 0.0.0
 */
export interface GraphqlBudgetShape {
  /** Run `self` only once the budget allows, under `policy`. */
  readonly guard: (
    operation: string,
    policy: GraphqlBudgetPolicy
  ) => <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E | GraphqlBudgetExhausted | GitHubError, R>;
  /** Read the budget now (one GraphQL point, or the REST fallback). */
  readonly probe: Effect.Effect<GraphqlBudgetSnapshot, GitHubError>;
}

/**
 * Budget-aware access to GitHub GraphQL.
 *
 * **Example** (Guard a mutation)
 *
 * ```ts
 * import { GraphqlBudget, GraphqlBudgetPolicy } from "@beep/repo-cli/test/SharedInternals"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const budget = yield* GraphqlBudget
 *   return yield* budget.guard("example", GraphqlBudgetPolicy.noWait)(Effect.succeed("ran"))
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GraphqlBudget extends Context.Service<GraphqlBudget, GraphqlBudgetShape>()($I`GraphqlBudget`) {}

const makeGraphqlBudget = Effect.gen(function* () {
  const client = yield* GitHubClient;

  const restFallback = Effect.suspend(() => client.requestDecoded("GET /rate_limit", {}, RestGraphqlBucket)).pipe(
    Effect.map((wire) =>
      GraphqlBudgetSnapshot.make({
        remaining: 0,
        resetAt: DateTime.makeUnsafe(wire.resources.graphql.reset * 1000),
        source: "rest-fallback",
      })
    )
  );

  const probe: Effect.Effect<GraphqlBudgetSnapshot, GitHubError> = Effect.suspend(() =>
    client.graphql(graphqlRateLimitDocument, {})
  ).pipe(
    Effect.map((data) =>
      GraphqlBudgetSnapshot.make({
        remaining: data.rateLimit.remaining,
        resetAt: data.rateLimit.resetAt,
        source: "graphql-probe",
      })
    ),
    Effect.catchTag("GitHubGraphQLError", (error) =>
      error.kind === "rateLimited" ? restFallback : Effect.fail(graphqlErrorToGitHubError(error))
    )
  );

  const guard =
    (operation: string, policy: GraphqlBudgetPolicy) =>
    <A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, E | GraphqlBudgetExhausted | GitHubError, R> =>
      Effect.gen(function* () {
        for (let attempt = 0; attempt < 2; attempt++) {
          const snapshot = yield* probe;
          const decision = decideGraphqlBudget({ snapshot, policy, now: yield* DateTime.now });
          if (decision.action === "proceed") return yield* self;
          if (decision.action === "refuse" || attempt > 0) {
            return yield* GraphqlBudgetExhausted.make({
              operation,
              remaining: snapshot.remaining,
              resetAt: snapshot.resetAt,
            });
          }
          yield* Console.error(
            `[gh] GraphQL budget low for ${operation} (${snapshot.remaining} left, ${snapshot.source}); waiting ${Duration.format(decision.waitFor)} until ${DateTime.formatIso(snapshot.resetAt)}`
          );
          yield* Effect.sleep(decision.waitFor);
        }
        return yield* Effect.die("unreachable: the GraphQL budget guard loop ended without a decision");
      });

  return GraphqlBudget.of({ guard, probe });
});

/**
 * The guard over a provided `GitHubClient`.
 *
 * **Example** (Inspect the layer)
 *
 * ```ts
 * import { layerGraphqlBudget } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(typeof layerGraphqlBudget) // "object"
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerGraphqlBudget: Layer.Layer<GraphqlBudget, never, GitHubClient> = Layer.effect(
  GraphqlBudget,
  makeGraphqlBudget
);
