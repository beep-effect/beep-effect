import { GitHubClient } from "@beep/github/GitHubClient";
import {
  BucketKey,
  BucketReading,
  GithubBudgetIdentity,
  GithubIdentityLabel,
  GithubLedgerStore,
  GraphqlBudget,
  GraphqlBudgetExhausted,
  GraphqlBudgetPolicy,
  HostLabel,
  layerGithubBudgetLedger,
  layerGithubLedgerStoreMemory,
  layerGraphqlBudget,
} from "@beep/repo-cli/test/SharedInternals";
import { describe, expect, it } from "@effect/vitest";
import { assertInstanceOf, assertTrue } from "@effect/vitest/utils";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as TestClock from "effect/testing/TestClock";
import { withLayer } from "./support/GithubLedgerFakes.ts";
import type { GraphQLDocument } from "@beep/github/GraphQL";
import type { ReadingBasis } from "@beep/repo-cli/test/SharedInternals";

const alice = GithubIdentityLabel.make("user:alice");
const HOUR = 3_600_000;

// A client whose every GraphQL call is the one-point probe, counted.
const probingClient = (probes: Ref.Ref<number>) =>
  GitHubClient.layerTest({
    graphql: dual(2, <A, V extends Record<string, unknown>>(document: GraphQLDocument<A, V>, _variables: V) =>
      Ref.update(probes, (n) => n + 1).pipe(
        Effect.andThen(document.decode({ rateLimit: { remaining: 4500, resetAt: "1970-01-01T01:00:00Z" } })),
        Effect.orDie
      )
    ),
  });

const reading = (options: {
  readonly remaining: number;
  readonly asOf?: number;
  readonly resetAt?: number;
  readonly basis?: ReadingBasis;
}) =>
  BucketReading.make({
    key: BucketKey.make({ identity: alice, resource: "graphql" }),
    limit: 5000,
    remaining: options.remaining,
    used: O.some(5000 - options.remaining),
    resetAt: DateTime.makeUnsafe(options.resetAt ?? HOUR),
    asOf: DateTime.makeUnsafe(options.asOf ?? 0),
    basis: options.basis ?? "transport",
  });

const ledger = layerGithubBudgetLedger({ host: HostLabel.make("hub") }).pipe(
  Layer.provideMerge(layerGithubLedgerStoreMemory)
);

// Seed the ledger's latest file directly, so no GraphQL call precedes the guard.
const run = Effect.fnUntraced(function* (options: {
  readonly seed?: BucketReading;
  readonly withLedger?: boolean;
  readonly now?: number;
  readonly policy?: GraphqlBudgetPolicy;
}) {
  const probes = yield* Ref.make(0);
  const client = Layer.merge(probingClient(probes), Layer.succeed(GithubBudgetIdentity, O.some(alice)));
  const budgetLayer = layerGraphqlBudget.pipe(Layer.provide(client));
  yield* TestClock.setTime(options.now ?? 1000);
  const program = GraphqlBudget.use((budget) =>
    budget.guard("op", options.policy ?? GraphqlBudgetPolicy.noWait)(Effect.succeed("ran"))
  ).pipe(Effect.result, withLayer(budgetLayer));
  const outcome =
    options.withLedger === false
      ? yield* program
      : yield* Effect.gen(function* () {
          const store = yield* GithubLedgerStore;
          if (options.seed !== undefined) yield* store.writeLatestTransport(options.seed);
          const before = yield* Ref.get(probes);
          expect(before).toBe(0);
          return yield* program;
        }).pipe(withLayer(ledger));
  const count = yield* Ref.get(probes);
  return { outcome, probes: count };
});

describe("GraphqlBudget ledger-first", () => {
  it.effect("proceeds on a fresh transport reading with zero probes", () =>
    Effect.gen(function* () {
      const { outcome, probes } = yield* run({ seed: reading({ remaining: 4000 }) });
      outcome.pipe(Result.isSuccess, assertTrue);
      expect(probes).toBe(0);
    })
  );

  it.effect("probes once for a stale reading, a sample reading or a past reset", () =>
    Effect.gen(function* () {
      const stale = yield* run({ seed: reading({ remaining: 4000 }), now: 61_000 });
      const sampled = yield* run({ seed: reading({ remaining: 4000, basis: "sample" }) });
      const reset = yield* run({ seed: reading({ remaining: 4000, resetAt: 500 }) });
      expect([stale.probes, sampled.probes, reset.probes]).toStrictEqual([1, 1, 1]);
      assertTrue(Result.isSuccess(stale.outcome) && Result.isSuccess(sampled.outcome));
    })
  );

  it.effect("probes as before with no ledger", () =>
    Effect.gen(function* () {
      const { outcome, probes } = yield* run({ withLedger: false });
      outcome.pipe(Result.isSuccess, assertTrue);
      expect(probes).toBe(1);
    })
  );

  it.effect("refuses a fresh below-threshold reading without a probe", () =>
    Effect.gen(function* () {
      const { outcome, probes } = yield* run({ seed: reading({ remaining: 3 }) });
      expect(probes).toBe(0);
      assertTrue(outcome._tag === "Failure");
      assertInstanceOf(outcome.failure, GraphqlBudgetExhausted);
      expect(outcome.failure.remaining).toBe(3);
    })
  );
});
