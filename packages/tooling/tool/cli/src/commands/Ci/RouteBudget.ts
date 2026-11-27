/**
 * The GitHub read budget of a route corpus capture: a background reader under
 * `github-budget-ledger`'s 15% reserve signal that counts its own requests.
 *
 * **Details**
 *
 * The capture is a background reader (`goals/certainty-scorecard`, decision
 * `shared-rest-budget`). Before each GitHub call it reads the ledger's reserve
 * signal for the `core` bucket of the identity its responses carry. While
 * that bucket is `Below` its floor the call waits for the bucket's reset (at
 * most 60 minutes); a longer wait fails, and the per-day checkpoint resumes
 * the capture on the next run. `Clear` and `Unknown` admit the call, as the
 * ledger's A7 ruling says. Without a ledger in context (`BEEP_GITHUB_LEDGER`
 * off) every call is admitted and the spend reports `metered: false`.
 *
 * Admission is per logical call: one `gh run list` day or one `gh run view`
 * (the run, its job pages and, after a transport failure, the 30-job pages),
 * with its retries. A call admitted just above the floor can therefore cross
 * it by its own pages; at the corpus's eight concurrent calls that is a few
 * dozen requests at most, typically eight to sixteen, after which every
 * further call waits for the reset.
 *
 * The count is the responses the transport hands to `RateLimitSink`: those
 * that carry rate-limit headers, pagination pages and `GET /rate_limit`
 * included. That is the set the ledger records, and each is forwarded to the
 * sink that was in context, so the ledger keeps the capture's rows. A
 * response without the headers (some 5xx answers) is not counted.
 *
 * @since 0.0.0
 */
import { RateLimitSink } from "@beep/github/Resilience";
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { identityOfObservation } from "../../internal/github/GithubLedger.reducers.ts";
import { BucketKey, GithubIdentityLabel, ReserveState } from "../../internal/github/GithubLedger.schemas.ts";
import { GithubBudgetLedger } from "../../internal/github/GithubLedger.service.ts";
import { RouteError } from "./Route.schemas.ts";
import type { RateLimitObservation, RateLimitSinkShape } from "@beep/github/Resilience";
import type { GithubBudgetLedgerShape } from "../../internal/github/GithubLedger.service.ts";

const $I = $RepoCliId.create("commands/Ci/RouteBudget");

const RESERVE_MAX_WAIT = Duration.minutes(60);
const RESERVE_MARGIN = Duration.seconds(1);

/**
 * What one capture spent: GitHub responses observed, waits on the reserve,
 * the identity the responses carried, and whether a ledger metered it.
 *
 * **Example** (An unmetered capture that read nothing)
 *
 * ```ts
 * import { RouteReadSpend } from "@beep/repo-cli/commands/Ci/RouteBudget"
 * import * as O from "effect/Option"
 *
 * const spend = RouteReadSpend.make({ requests: 0, reserveWaits: 0, identity: O.none(), metered: false })
 * console.log(spend.requests) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RouteReadSpend extends S.Opaque<RouteReadSpend, { readonly brand: unique symbol }>()(
  S.Struct({
    requests: S.Int,
    reserveWaits: S.Int,
    identity: S.Option(GithubIdentityLabel),
    metered: S.Boolean,
  }).pipe(
    $I.annoteSchema("RouteReadSpend", {
      description: "GitHub responses a route capture observed, its reserve waits, identity and metering.",
    })
  )
) {}

/**
 * The operations of {@link RouteReadBudget}.
 *
 * @category services
 * @since 0.0.0
 */
export interface RouteReadBudgetShape {
  /** Before one logical call: wait while the capture identity's `core` bucket is below its reserve; fail when the reset is too far. */
  readonly admit: (label: string) => Effect.Effect<void, RouteError>;
  /** Run one call with every rate-limit-bearing response counted and forwarded to the sink in context. */
  readonly metered: <A, E, R>(call: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
  /** What the capture has spent so far. */
  readonly spend: Effect.Effect<RouteReadSpend>;
}

/**
 * The read budget of a route corpus capture.
 *
 * **Example** (Read the budget service key)
 *
 * ```ts
 * import { RouteReadBudget } from "@beep/repo-cli/commands/Ci/RouteBudget"
 *
 * console.log(typeof RouteReadBudget) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class RouteReadBudget extends Context.Service<RouteReadBudget, RouteReadBudgetShape>()($I`RouteReadBudget`) {}

/**
 * Build the read budget over an optional ledger.
 *
 * **Details**
 *
 * The identity is learned from the first observed response. Until then a
 * call is held while any `user:` identity's `core` bucket is below its
 * floor, since the capture reads as this host's `gh` login.
 *
 * **Example** (An unmetered budget admits every call)
 *
 * ```ts
 * import { makeRouteReadBudget } from "@beep/repo-cli/commands/Ci/RouteBudget"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const program = Effect.gen(function* () {
 *   const budget = yield* makeRouteReadBudget(O.none())
 *   yield* budget.admit("gh run list")
 *   return (yield* budget.spend).metered
 * })
 * console.log(Effect.runSync(program)) // false
 * ```
 *
 * @param ledger - The budget ledger, when the CLI runs with one.
 * @returns The {@link RouteReadBudgetShape}.
 * @category constructors
 * @since 0.0.0
 */
export const makeRouteReadBudget = Effect.fnUntraced(function* (
  ledger: O.Option<GithubBudgetLedgerShape>
): Effect.fn.Return<RouteReadBudgetShape> {
  const requests = yield* Ref.make(0);
  const reserveWaits = yield* Ref.make(0);
  const identity = yield* Ref.make(O.none<GithubIdentityLabel>());

  const observe = (inner: RateLimitSinkShape) =>
    Effect.fnUntraced(function* (observation: RateLimitObservation) {
      yield* Ref.update(requests, (n) => n + 1);
      if (O.isSome(ledger)) {
        const aliases = yield* ledger.value.aliases;
        yield* Ref.set(identity, O.some(identityOfObservation(observation, aliases)));
      }
      yield* inner.record(observation);
    });

  const metered: RouteReadBudgetShape["metered"] = Effect.fnUntraced(function* <A, E, R>(call: Effect.Effect<A, E, R>) {
    const inner = yield* RateLimitSink;
    return yield* Effect.provideService(call, RateLimitSink, { record: observe(inner) });
  });

  const heldBucket = (owner: GithubBudgetLedgerShape, who: O.Option<GithubIdentityLabel>) =>
    O.match(who, {
      onSome: (known) => Effect.map(owner.reserve(BucketKey.make({ identity: known, resource: "core" })), A.of),
      onNone: () =>
        Effect.map(
          owner.reserves,
          A.filter((signal) => signal.key.resource === "core" && Str.startsWith("user:")(signal.key.identity))
        ),
    }).pipe(
      Effect.map(
        A.findFirst((signal) =>
          ReserveState.guards.Below(signal.state)
            ? O.some({ identity: signal.key.identity, resetAt: signal.state.resetAt })
            : O.none()
        )
      ),
      Effect.catchCause((cause) =>
        Effect.as(
          Effect.logDebug("route corpus reserve unreadable", cause),
          O.none<{ readonly identity: GithubIdentityLabel; readonly resetAt: DateTime.Utc }>()
        )
      )
    );

  const admit: (label: string) => Effect.Effect<void, RouteError> = Effect.fnUntraced(function* (label: string) {
    if (O.isNone(ledger)) return;
    const who = yield* Ref.get(identity);
    const held = yield* heldBucket(ledger.value, who);
    if (O.isNone(held)) return;
    const { identity: owner, resetAt } = held.value;
    const now = yield* DateTime.now;
    const wait = Duration.sum(
      Duration.millis(Math.max(0, DateTime.toEpochMillis(resetAt) - DateTime.toEpochMillis(now))),
      RESERVE_MARGIN
    );
    if (Duration.isGreaterThan(wait, RESERVE_MAX_WAIT)) {
      return yield* RouteError.new(
        "corpus-fetch",
        `${label} is held: ${owner}'s core bucket is below its 15% reserve until ${DateTime.formatIso(resetAt)}; rerun the capture after that to continue from its checkpoint.`
      );
    }
    yield* Ref.update(reserveWaits, (n) => n + 1);
    yield* Effect.logWarning("route corpus waiting for the GitHub core reserve to clear").pipe(
      Effect.annotateLogs({ label, identity: owner, resetsAt: DateTime.formatIso(resetAt) })
    );
    yield* Effect.sleep(wait);
    return yield* admit(label);
  });

  const spend = Effect.gen(function* () {
    return RouteReadSpend.make({
      requests: yield* Ref.get(requests),
      reserveWaits: yield* Ref.get(reserveWaits),
      identity: yield* Ref.get(identity),
      metered: O.isSome(ledger),
    });
  });

  return { admit, metered, spend };
});

/**
 * {@link RouteReadBudget} over the ledger the CLI root provides, when it does.
 *
 * **Example** (Inspect the live layer)
 *
 * ```ts
 * import { RouteReadBudgetLive } from "@beep/repo-cli/commands/Ci/RouteBudget"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(RouteReadBudgetLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const RouteReadBudgetLive: Layer.Layer<RouteReadBudget> = Layer.effect(
  RouteReadBudget,
  Effect.flatMap(Effect.serviceOption(GithubBudgetLedger), makeRouteReadBudget)
);
