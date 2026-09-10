import { fcRuns } from "@beep/fc-runs";
import { $TestUtilsId } from "@beep/identity/packages";
import { makeIt } from "@beep/test-utils/test/Vitest";
import { it, TestContextUnavailable, TestHang } from "@beep/test-utils/Vitest";
import { afterAll, expect, expectTypeOf, TestRunner, it as upstreamIt } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { Clock, Config, ConfigProvider, Context, Duration, Effect, Layer, Logger, Option as O, Ref } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { TestClock } from "effect/testing";
import type { Vitest } from "@effect/vitest";

const $I = $TestUtilsId.create("test/Vitest.test");

class Probe extends Context.Service<Probe, { readonly value: number }>()($I`Probe`) {}

let propertyRuns = 0;
let layerAcquisitions = 0;
let layerReleases = 0;
let perTestReleases = 0;

const SharedProbeLayer = Layer.effect(
  Probe,
  Effect.acquireRelease(
    Effect.sync(() => {
      layerAcquisitions += 1;
      return { value: 1 };
    }),
    () =>
      Effect.sync(() => {
        layerReleases += 1;
      })
  )
);

const callableSuite = TestRunner.getCurrentSuite();
const functionTitleStart = callableSuite.tasks.length;
const functionTitleResult = it(function instrumentedFunctionTitle() {});
const functionTitleTasks = callableSuite.tasks.slice(functionTitleStart);

it("preserves a Function title with an omitted handler", () => {
  expectTypeOf(functionTitleResult).toEqualTypeOf<void>();
  expect(functionTitleTasks).toHaveLength(1);
  expect(functionTitleTasks.map(({ mode, name }) => ({ mode, name }))).toEqual([
    { mode: "todo", name: "instrumentedFunctionTitle" },
  ]);
});

it("preserves callable plain Vitest tests", () => {
  expect(TestHang.is(TestHang.make({ testName: "probe", timeoutMillis: 1 }))).toBe(true);
  expectTypeOf(it.effect.only).toEqualTypeOf<Vitest.Methods["effect"]["only"]>();
});

it(() => {
  expect(true).toBe(true);
}, 100)("supports the callback-first pipeable plain-test form");

it({ timeout: 100 }, () => {
  expect(true).toBe(true);
})("supports the options-first pipeable plain-test form");

const omittedArgumentStart = callableSuite.tasks.length;
it(undefined, 100)("registers a timed todo with an omitted callback");
it(undefined)("registers a todo with omitted curry arguments");
it()("registers a todo with an empty curry call");
const omittedArgumentTasks = callableSuite.tasks.slice(omittedArgumentStart);

it("preserves registration for the declared omitted-argument forms", () => {
  expect(omittedArgumentTasks).toHaveLength(3);
  expect(omittedArgumentTasks).toMatchObject([
    { mode: "todo", name: "registers a timed todo with an omitted callback", timeout: 100 },
    { mode: "todo", name: "registers a todo with omitted curry arguments" },
    { mode: "todo", name: "registers a todo with an empty curry call" },
  ]);
});

it(undefined, () => {
  expect(true).toBe(true);
})("runs the handler with omitted pipeable options");

it.effect("runs Effect tests with their TestContext", (ctx) =>
  Effect.gen(function* () {
    assertTrue(ctx.task.fullTestName.endsWith("runs Effect tests with their TestContext"));
    yield* Effect.log("effect body");
    yield* TestClock.adjust("1 millis");
  })
);

it.effect.each([1, 2])("passes each callback only its concrete case: %s", (value) =>
  Effect.sync(() => {
    assertTrue(value === 1 || value === 2);
  })
);

it.effect.prop(
  "preserves generated property values and TestContext",
  [S.Int.check(S.isBetween({ minimum: 1, maximum: 2 }))],
  ([value], ctx) =>
    Effect.sync(() => {
      propertyRuns += 1;
      assertTrue(value === 1 || value === 2);
      assertTrue(ctx.task.fullTestName.includes("preserves generated property values"));
    }),
  { arbitrary: { ...fcRuns(2), seed: 42 } }
);

it.effect.skip("preserves skipped registration", () => Effect.die("must not run"));
it.effect.skipIf(true)("preserves conditional skip registration", () => Effect.die("must not run"));
it.effect.runIf(true)("preserves conditional run registration", () => Effect.void);
it.effect.fails("preserves expected-failure registration", () => Effect.fail("expected failure"));

it.live("runs live effects without requiring TestClock", () => Effect.sleep("1 millis"));

it.layer(SharedProbeLayer)("instrumented layer", (layerIt) => {
  layerIt.effect("provides the block layer", () =>
    Effect.gen(function* () {
      const probe = yield* Probe;
      expect(probe.value).toBe(1);
      expect(layerAcquisitions).toBe(1);
      yield* Effect.acquireRelease(Effect.void, () =>
        Effect.sync(() => {
          perTestReleases += 1;
        })
      );
    })
  );

  layerIt.layer(Layer.effectDiscard(Ref.make(0)))("nested instrumented layer", (nestedIt) => {
    nestedIt.effect("preserves MethodsNonLive", () =>
      Effect.gen(function* () {
        const probe = yield* Probe;
        expect(probe.value).toBe(1);
        expect(layerAcquisitions).toBe(1);
        expect(perTestReleases).toBe(1);
        assertFalse("live" in nestedIt);
      })
    );
  });
});

it.layer(Layer.empty)((unnamedIt) => {
  unnamedIt.effect("preserves unnamed layer registration", () => Effect.void);
});

it.layer(Layer.empty, { excludeTestServices: true })("excluded test services", (layerIt) => {
  layerIt.effect("does not require TestClock for its watchdog", () =>
    Effect.sync(() => {
      assertSome(O.some("ok"), "ok");
      assertNone(O.none());
    })
  );
});

afterAll(() => {
  expect(propertyRuns).toBeGreaterThanOrEqual(2);
  expect(layerAcquisitions).toBe(1);
  expect(layerReleases).toBe(1);
  expect(perTestReleases).toBe(1);
});

const encodeTestHang = S.encodeEffect(TestHang);
const encodeMissingContext = S.encodeEffect(TestContextUnavailable);

it.effect("preserves typed runner error messages and encoded diagnostic fields", () =>
  Effect.gen(function* () {
    const missing = TestContextUnavailable.make({ method: "each" });
    expect(missing.message).toBe("Instrumented each callback ran without its Vitest execution context");
    expect(yield* encodeMissingContext(missing)).toEqual({
      _tag: "TestContextUnavailable",
      method: "each",
    });
    const withoutLog = TestHang.make({ testName: "no output", timeoutMillis: 25 });
    expect(withoutLog.message).toBe('Instrumented test "no output" exceeded its 25ms watchdog. Last log: <none>');
    const withLog = TestHang.make({ testName: "queue worker", timeoutMillis: 175, lastLogLine: O.some("waiting") });
    expect(withLog.message).toBe('Instrumented test "queue worker" exceeded its 175ms watchdog. Last log: waiting');
    expect(yield* encodeTestHang(withLog)).toEqual({
      _tag: "TestHang",
      testName: "queue worker",
      timeoutMillis: 175,
      lastLogLine: "waiting",
    });
    expect(yield* encodeTestHang(withoutLog)).toEqual({
      _tag: "TestHang",
      testName: "no output",
      timeoutMillis: 25,
    });
  })
);

// Only the source-only watchdog seam advances this logical clock. Body TestClock
// remains owned by @effect/vitest; no native timers arrange the deadline race.
const watchdogClock = Effect.runSync(Clock.Clock);
let watchdogMillis = 0;
const controlledIt = makeIt({
  ...watchdogClock,
  monotonicTimeNanos: Effect.sync(() => BigInt(watchdogMillis) * 1_000_000n),
  monotonicTimeNanosUnsafe: () => BigInt(watchdogMillis) * 1_000_000n,
  sleep: (duration) =>
    Effect.sync(() => {
      watchdogMillis += Duration.toMillis(duration);
    }),
});
let observedHang = O.none<TestHang>();
let propertyReleases = 0;
let deadlineTrials = 0;
let lifecycleStarts = 0;
let lifecycleEnds = 0;
const diagnosticLayer = Layer.merge(
  ConfigProvider.layer(ConfigProvider.fromUnknown({ BEEP_TEST_TRACE: "1", CI: false })),
  Logger.layer(
    [
      Logger.make(({ message }) => {
        const messages = A.ensure(message);
        observedHang = O.orElse(A.findFirst(messages, TestHang.is), () => observedHang);
        if (A.contains(messages, "effect-vitest test start")) lifecycleStarts += 1;
        if (A.some(messages, (part) => part === "effect-vitest test end outcome=failure durationMillis=155"))
          lifecycleEnds += 1;
      }),
    ],
    { mergeWithExisting: true }
  )
);

controlledIt.layer(diagnosticLayer)("in-process property watchdog", (deadlineIt) => {
  deadlineIt.effect.prop(
    "charges one budget across real failing trials and shrinking",
    [S.Int.check(S.isBetween({ minimum: 1, maximum: 100 }))],
    ([value]) =>
      Effect.gen(function* () {
        deadlineTrials += 1;
        yield* Effect.acquireRelease(Effect.void, () =>
          Effect.sync(() => {
            propertyReleases += 1;
          })
        );
        yield* Effect.log(`in-process trial ${value}`);
        return yield* Effect.never;
      }),
    { timeout: 180, fails: true, arbitrary: { ...fcRuns(4), seed: 4242 } }
  );
});

it.effect("retains the real watchdog failure and releases its property trial scope", () =>
  Effect.sync(() => {
    expect(deadlineTrials).toBe(1);
    expect(propertyReleases).toBe(1);
    expect(lifecycleStarts).toBe(1);
    expect(lifecycleEnds).toBe(1);
    const hang = O.getOrThrow(observedHang);
    expect(hang.timeoutMillis).toBe(155);
    expect(hang.testName).toContain("charges one budget across real failing trials and shrinking");
    expect(hang.message).toContain("in-process trial");
  })
);

controlledIt.effect(
  "keeps the body TestClock independent with a disabled watchdog",
  () =>
    Effect.gen(function* () {
      yield* TestClock.adjust("2 seconds");
      expect(yield* Clock.currentTimeMillis).toBe(2_000);
    }),
  0
);
controlledIt.effect(
  "accepts an infinite watchdog timeout without scheduling a sleep",
  () =>
    Effect.sync(() => {
      expect(watchdogMillis).toBe(155);
    }),
  Number.POSITIVE_INFINITY
);
controlledIt.effect(
  "allows synchronous completion with a tiny positive watchdog budget",
  () =>
    Effect.sync(() => {
      expect(watchdogMillis).toBe(155);
    }),
  20
);

it.layer(ConfigProvider.layer(ConfigProvider.fromUnknown({ CI: "invalid", component: "runner" })))(
  "invalid trace configuration",
  (quietIt) => {
    quietIt.effect("keeps configuration failure from failing the test body", () =>
      Effect.gen(function* () {
        expect(yield* Config.String("component")).toBe("runner");
      })
    );
  }
);

it.layer(ConfigProvider.layer(ConfigProvider.fromUnknown({ BEEP_TEST_TRACE: "1", CI: false })))(
  "traced ordinary execution",
  (tracedIt) => {
    tracedIt.effect("preserves configuration and body services while emitting an ordinary lifecycle", () =>
      Effect.gen(function* () {
        expect(yield* Config.Boolean("CI")).toBe(false);
        yield* TestClock.adjust("1 second");
        expect(yield* Clock.currentTimeMillis).toBe(1_000);
      })
    );
  }
);
let interruptedScopeReleased = false;
it.effect.fails("preserves intentional interruption and releases the acquired scope", () =>
  Effect.gen(function* () {
    yield* Effect.acquireRelease(Effect.void, () =>
      Effect.sync(() => {
        interruptedScopeReleased = true;
      })
    );
    return yield* Effect.interrupt;
  })
);
it.effect("observes interruption cleanup after the expected failure", () =>
  Effect.sync(() => {
    expect(interruptedScopeReleased).toBe(true);
  })
);
let quietScopeReleases = 0;
controlledIt.layer(ConfigProvider.layer(ConfigProvider.fromUnknown({ BEEP_TEST_TRACE: "0", CI: false })))(
  "quiet synchronous setup",
  (quietIt) => {
    quietIt.effect.prop(
      "charges body setup before the watchdog branch sleeps",
      [S.Int.check(S.isBetween({ minimum: 1, maximum: 100 }))],
      () =>
        Effect.gen(function* () {
          yield* Effect.acquireRelease(Effect.void, () =>
            Effect.sync(() => {
              quietScopeReleases += 1;
            })
          );
          watchdogMillis += 155;
          return yield* Effect.never;
        }),
      { timeout: 180, fails: true, arbitrary: { ...fcRuns(4), seed: 4242 } }
    );
  }
);
it.effect("observes expired setup without resetting the budget during shrinking", () =>
  Effect.sync(() => {
    expect(quietScopeReleases).toBe(1);
    expect(watchdogMillis).toBe(310);
  })
);

it.effect("preserves callable tester metadata for tooling that inspects registration functions", () =>
  Effect.sync(() => {
    expect(controlledIt.effect.name).toBe(upstreamIt.effect.name);
    expect(controlledIt.effect.length).toBe(upstreamIt.effect.length);
  })
);
it.layer(Layer.empty)("plain property passthrough", (layerIt) => {
  layerIt.prop(
    "preserves the public non-Effect property method in a layer block",
    [S.Int.check(S.isBetween({ minimum: 1, maximum: 100 }))],
    ([value], ctx) => {
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(100);
      expect(ctx.task.fullTestName).toContain("plain property passthrough");
    },
    { arbitrary: { ...fcRuns(4), seed: 4242 } }
  );
});
