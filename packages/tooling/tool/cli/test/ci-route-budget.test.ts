import { RateLimitObservation, RateLimitSink, RateLimitSnapshot } from "@beep/github/Resilience";
import { makeRouteReadBudget } from "@beep/repo-cli/commands/Ci/RouteBudget";
import {
  GithubBudgetLedger,
  GithubIdentityLabel,
  GithubLedgerStore,
  HostLabel,
  layerGithubBudgetLedger,
  makeGithubLedgerStoreMemory,
} from "@beep/repo-cli/test/SharedInternals";
import { describe, expect, it } from "@effect/vitest";
import { assertInclude, assertNone, assertSome } from "@effect/vitest/utils";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as TestClock from "effect/testing/TestClock";
import { withLayer } from "./support/GithubLedgerFakes.ts";

const SECOND = 1000;
const identity = GithubIdentityLabel.make("user:alice");

// One core response as the transport observes it, at the test clock's now.
const coreObservation = (remaining: number, resetInMs: number) =>
  Effect.map(DateTime.now, (at) =>
    RateLimitObservation.make({
      at,
      budgetLabel: O.some(identity),
      credential: "token",
      operation: "GET /repos/{owner}/{repo}/actions/runs/{run_id}",
      kind: "rest",
      status: 200,
      outcome: "ok",
      snapshot: RateLimitSnapshot.make({
        resource: "core",
        limit: 5000,
        remaining,
        used: O.some(5000 - remaining),
        resetEpochSeconds: (DateTime.toEpochMillis(at) + resetInMs) / SECOND,
      }),
    })
  );

// A GitHub call as the corpus makes one: the transport hands its response to the sink in context.
const respond = Effect.fn("respond")(function* (remaining: number, resetInMs: number) {
  const sink = yield* RateLimitSink;
  const observation = yield* coreObservation(remaining, resetInMs);
  yield* sink.record(observation);
});

const withLedger = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.flatMap(makeGithubLedgerStoreMemory, (store) =>
    effect.pipe(
      withLayer(
        layerGithubBudgetLedger({ host: HostLabel.make("hub") }).pipe(
          Layer.provideMerge(Layer.succeed(GithubLedgerStore, store))
        )
      )
    )
  );

// The budget over the ledger, with the ledger's sink in context as the CLI root provides it.
const meteredBudget = Effect.gen(function* () {
  const ledger = yield* GithubBudgetLedger;
  const budget = yield* makeRouteReadBudget(O.some(ledger));
  return { budget, sink: ledger.sink };
});

describe("route corpus read budget", () => {
  it.effect("counts every response and forwards it to the sink already in context", () =>
    Effect.gen(function* () {
      const forwarded = yield* Ref.make(0);
      const budget = yield* makeRouteReadBudget(O.none());
      yield* budget.admit("gh run list");
      yield* budget
        .metered(Effect.andThen(respond(4000, 60 * SECOND), respond(3999, 60 * SECOND)))
        .pipe(Effect.provideService(RateLimitSink, { record: () => Ref.update(forwarded, (n) => n + 1) }));
      const spend = yield* budget.spend;
      expect(spend.requests).toBe(2);
      expect(spend.metered).toBe(false);
      assertNone(spend.identity);
      const forwardedCount = yield* Ref.get(forwarded);
      expect(forwardedCount).toBe(2);
    })
  );

  it.effect("admits a call while the core bucket is clear of its reserve", () =>
    withLedger(
      Effect.gen(function* () {
        const { budget, sink } = yield* meteredBudget;
        yield* budget.metered(respond(4000, 30 * SECOND)).pipe(Effect.provideService(RateLimitSink, sink));
        yield* budget.admit("gh run view 1");
        const spend = yield* budget.spend;
        expect(spend.requests).toBe(1);
        expect(spend.reserveWaits).toBe(0);
        expect(spend.metered).toBe(true);
        assertSome(spend.identity, identity);
      })
    )
  );

  it.effect("holds a call below the 15% reserve until the bucket resets", () =>
    withLedger(
      Effect.gen(function* () {
        const { budget, sink } = yield* meteredBudget;
        // 700 of 5,000 is below the 750 floor.
        yield* budget.metered(respond(700, 30 * SECOND)).pipe(Effect.provideService(RateLimitSink, sink));
        const held = yield* Effect.forkChild(budget.admit("gh run view 2"));
        yield* TestClock.adjust("29 seconds");
        expect(held.pollUnsafe()).toBeUndefined();
        yield* TestClock.adjust("2 seconds");
        const exit = yield* Fiber.await(held);
        expect(exit._tag).toBe("Success");
        const spend = yield* budget.spend;
        expect(spend.reserveWaits).toBe(1);
      })
    )
  );

  it.effect("holds the first call, before any response names the identity, on a user bucket below its reserve", () =>
    withLedger(
      Effect.gen(function* () {
        const { budget, sink } = yield* meteredBudget;
        // Another reader on this host spent the bucket; the capture has observed nothing yet.
        yield* respond(5, 30 * SECOND).pipe(Effect.provideService(RateLimitSink, sink));
        const held = yield* Effect.forkChild(budget.admit("gh run list"));
        yield* TestClock.adjust("29 seconds");
        expect(held.pollUnsafe()).toBeUndefined();
        yield* TestClock.adjust("2 seconds");
        const exit = yield* Fiber.await(held);
        expect(exit._tag).toBe("Success");
        const spend = yield* budget.spend;
        expect(spend.requests).toBe(0);
        expect(spend.reserveWaits).toBe(1);
      })
    )
  );

  it.effect("refuses a wait past an hour so the checkpoint resumes the capture later", () =>
    withLedger(
      Effect.gen(function* () {
        const { budget, sink } = yield* meteredBudget;
        yield* budget.metered(respond(10, 2 * 60 * 60 * SECOND)).pipe(Effect.provideService(RateLimitSink, sink));
        const error = yield* Effect.flip(budget.admit("gh run view 3"));
        expect(error.reason).toBe("corpus-fetch");
        assertInclude(error.message, "gh run view 3 is held: user:alice's core bucket is below its 15% reserve");
        const spend = yield* budget.spend;
        expect(spend.reserveWaits).toBe(0);
      })
    )
  );
});
