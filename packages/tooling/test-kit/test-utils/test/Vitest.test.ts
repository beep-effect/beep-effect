import { fcRuns } from "@beep/fc-runs";
import { $TestUtilsId } from "@beep/identity/packages";
import { it, TestHang } from "@beep/test-utils/Vitest";
import { afterAll, expect, expectTypeOf, TestRunner } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { Context, Effect, Layer, Option as O, Ref } from "effect";
import { FastCheck as fc, TestClock } from "effect/testing";
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
  [fc.integer({ min: 1, max: 2 })],
  ([value], ctx) =>
    Effect.sync(() => {
      propertyRuns += 1;
      assertTrue(value === 1 || value === 2);
      assertTrue(ctx.task.fullTestName.includes("preserves generated property values"));
    }),
  { fastCheck: { ...fcRuns(2), seed: 42 } }
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
