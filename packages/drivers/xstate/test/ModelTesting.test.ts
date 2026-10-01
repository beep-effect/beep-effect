import { it } from "@beep/test-runner";
import { arbitraryFromSchema, effectActorSut, eventsFromSchemas } from "@beep/xstate/test";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { createEffectActor, waitFor } from "@xstate/effect";
import { assertTestCoverage, propertyTest, testPaths } from "@xstate/test";
import { Effect, Layer, pipe } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { TestClock } from "effect/testing";
import * as fc from "fast-check";
import { createMachine, types } from "xstate";
import { Deployments, deploymentsSucceeding, ReleaseEvents, releaseMachine } from "./fixtures/Release.machine.ts";
import type { AnyStateMachine } from "xstate";

// `@xstate/test` 2.0.0-alpha.1 constrains its source to `ActorLogic<any, any, any>`, which a machine
// declaring `schemas.emitted` does not satisfy (its `ActorSelf.on` is narrowed to the emitted union).
const releaseModel: AnyStateMachine = releaseMachine;

const counterMachine = createMachine({
  id: "counter",
  schemas: {
    context: types<{ count: number }>(),
    events: { INC: types<{ by: number }>(), RESET: types<{}>() },
  },
  context: { count: 0 },
  initial: "counting",
  states: {
    counting: {
      on: {
        INC: ({ context, event }) => ({ context: { count: context.count + event.by } }),
        RESET: ({ context }) => (context.count > 0 ? { context: { count: 0 } } : undefined),
      },
    },
  },
});

describe("schema generators", () => {
  it.effect("samples values that satisfy the source schema", () =>
    Effect.gen(function* () {
      const Reviewer = S.Struct({ reviewer: S.NonEmptyString });
      const arbitrary = yield* arbitraryFromSchema(Reviewer, { count: 8, seed: 7 });
      const samples = fc.sample(arbitrary, 16);
      assertTrue(A.every(samples, S.is(Reviewer)));
    })
  );

  it.effect("derives one generator per declared event", () =>
    Effect.gen(function* () {
      const events = yield* pipe(ReleaseEvents, eventsFromSchemas({ count: 4 }));
      expect(Object.keys(events).sort()).toEqual(["APPROVE", "CANCEL", "RETRY"]);
      assertTrue(A.every(fc.sample(events.APPROVE, 4), S.is(ReleaseEvents.APPROVE)));
    })
  );
});

describe("model-based testing of the release machine", () => {
  it.effect("every shortest path keeps the release id and drives every event type", () =>
    Effect.gen(function* () {
      const events = yield* eventsFromSchemas(ReleaseEvents, { count: 4 });
      const { coverage, results } = yield* Effect.promise(() =>
        testPaths(releaseModel, {
          events,
          input: { release: "v2.0.0" },
          invariant: ({ snapshot }) => {
            expect(snapshot.context.release).toBe("v2.0.0");
          },
        })
      );
      expect(results.length).toBeGreaterThan(0);
      assertTestCoverage(coverage, { eventTypes: 1 });
    })
  );

  it.effect("random event sequences never approve without a reviewer", () =>
    Effect.gen(function* () {
      const events = yield* eventsFromSchemas(ReleaseEvents, { count: 6 });
      yield* Effect.promise(() =>
        propertyTest(releaseModel, {
          seed: 1,
          numRuns: 40,
          events,
          input: { release: "v3.0.0" },
          invariant: ({ snapshot }) => {
            if (snapshot.matches("deploying") === true) {
              expect(snapshot.context.reviewer.length).toBeGreaterThan(0);
            }
          },
          reachable: ["deploying", "cancelled"],
        })
      );
    })
  );
});

describe("effectActorSut", () => {
  it.live("the Effect-hosted interpreter agrees with the pure model", () =>
    Effect.promise(() =>
      propertyTest(counterMachine, {
        seed: 3,
        numRuns: 20,
        maxCommands: 6,
        events: { INC: fc.record({ by: fc.integer({ min: 1, max: 5 }) }), RESET: fc.constant({}) },
        sut: effectActorSut(counterMachine, { layer: Layer.empty }),
      })
    )
  );
});

describe("TestClock drives delayed transitions", () => {
  it.effect("an unapproved release expires after thirty seconds", () =>
    Effect.gen(function* () {
      const actor = yield* createEffectActor(releaseMachine, { input: { release: "v4.0.0" } });
      yield* TestClock.adjust("30 seconds");
      const snapshot = yield* waitFor(actor, (current) => current.matches("expired"), { timeout: "1 second" });
      expect(snapshot.status).toBe("done");
    }).pipe(Effect.scoped, Effect.provideService(Deployments, deploymentsSucceeding))
  );
});
