import { fcRuns } from "@beep/fc-runs";
import { it } from "@beep/test-utils/Vitest";
import { afterAll, beforeEach, describe, expect, it as originalIt, TestRunner } from "@effect/vitest";
import {
  Clock,
  Config,
  Console,
  Context,
  Deferred,
  Duration,
  Effect,
  Exit,
  Fiber,
  Inspectable,
  Layer,
  Logger,
  Ref,
  Schema,
  Scope,
} from "effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { TestClock } from "effect/testing";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import type { TestContext } from "@effect/vitest";

// Vitest's public metadata extension point, scoped to this copied fixture module.
declare module "vitest" {
  interface TaskMeta {
    instrumentation?: string;
  }
}

const mode = Effect.runSync(Config.String("BEEP_INSTRUMENTED_IT_FIXTURE").pipe(Config.withDefault(undefined)));
const encodeCleanup = Schema.encodeEffect(Schema.fromJsonString(Schema.String));
const encodeReason = Schema.encodeEffect(Schema.Defect({ includeStack: true }));
const encodePhase = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));

let traceCleanup = "";
const recordCleanup = (text: string): void => {
  traceCleanup = Str.concat(traceCleanup, text);
  encodeCleanup(text).pipe(
    Effect.flatMap((line) => Console.log(`BEEP_VITEST_CLEANUP ${line}`)),
    Effect.runSync
  );
};

const traceCase = Effect.runSync(Config.option(Config.String("BEEP_TRACE_CASE")));
const encodeTraceObservation = Schema.encodeEffect(
  Schema.fromJsonString(
    Schema.Struct({
      case: Schema.String,
      ci: Schema.Boolean,
      trace: Schema.String,
      cleanup: Schema.String,
    })
  )
);
if (O.isSome(traceCase)) {
  afterAll(() =>
    Effect.runPromise(
      Effect.gen(function* () {
        const line = yield* encodeTraceObservation({
          case: traceCase.value,
          ci: yield* Config.Boolean("CI"),
          trace: yield* Config.String("BEEP_TEST_TRACE"),
          cleanup: traceCleanup,
        });
        yield* Console.log(`BEEP_TRACE_OBSERVATION ${line}`);
      })
    )
  );
}

const diagnosticClock = Effect.runSync(Clock.Clock);
const recordPhase = Effect.fnUntraced(function* (context: TestContext, phase: string) {
  const monotonicNanos = yield* diagnosticClock.monotonicTimeNanos;
  const reason = yield* encodeReason(context.signal.reason);
  const line = yield* encodePhase({
    name: context.task.fullTestName,
    phase,
    monotonicNanos: `${monotonicNanos}`,
    aborted: context.signal.aborted,
    reason,
  });
  yield* Console.log(`BEEP_VITEST_PHASE ${line}`);
});

beforeEach((context) => {
  const onAbort = () => Effect.runSync(recordPhase(context, "abort"));
  context.signal.addEventListener("abort", onAbort, { once: true });
  context.onTestFailed(() => Effect.runPromise(recordPhase(context, "failed")));
  context.onTestFinished(() => {
    context.signal.removeEventListener("abort", onAbort);
    return Effect.runPromise(recordPhase(context, "finished"));
  });
  return Effect.runPromise(recordPhase(context, "beforeEach"));
});

const TraceSink = Logger.layer(
  [
    Logger.make<unknown, void>(({ message }) => {
      recordCleanup(`${Inspectable.toStringUnknown(message, 0)}\n`);
    }),
  ],
  { mergeWithExisting: true }
);

if (mode === "watchdog") {
  it.layer(TraceSink, { timeout: "1 second" })("watchdog layer", (layerIt) => {
    layerIt.effect(
      "watchdog concrete name",
      () =>
        Effect.acquireRelease(Effect.log("distinctive-watchdog-log"), () =>
          Effect.sync(() => {
            recordCleanup("released\n");
          })
        ).pipe(Effect.andThen(Effect.never)),
      { timeout: 200 }
    );
  });
}

if (mode === "public-abort") {
  // This deliberately uses the public native tester: its abort signal and raw
  // timeout error, rather than the Effect watchdog, are the evidence subject.
  originalIt("public abort evidence", { timeout: 25 }, (context) =>
    Effect.runPromise(Effect.never, { signal: context.signal })
  );
}

if (mode === "disabled-timeouts") {
  it.effect("zero disables timeout", () => Effect.void, { timeout: 0 });
  it.effect("infinity disables timeout", () => Effect.void, { timeout: Number.POSITIVE_INFINITY });
}

if (mode === "trace-success") {
  it.layer(TraceSink)("trace layer", (layerIt) => {
    layerIt.effect("trace success", () => Effect.log("trace-body-success"), { timeout: 500 });
  });
}

if (mode === "trace-failure") {
  it.layer(TraceSink)("trace layer", (layerIt) => {
    layerIt.effect(
      "trace failure",
      () => Effect.log("trace-body-failure").pipe(Effect.andThen(Effect.fail("preserved-failure"))),
      { timeout: 500 }
    );
  });
}

if (mode === "defect") {
  it.layer(TraceSink)("defect layer", (layerIt) => {
    layerIt.effect("preserves defect", () => Effect.die("preserved-defect"), { timeout: 500 });
  });
}

if (mode === "interruption") {
  it.layer(TraceSink)("interruption layer", (layerIt) => {
    layerIt.effect("preserves interruption", () => Effect.interrupt, { timeout: 500 });
  });
}

if (mode === "live") {
  it.live("live environment", () => Effect.sleep("1 millis"), { timeout: 500 });
}

if (mode === "exclude-test-services") {
  it.layer(Layer.empty, { excludeTestServices: true })("excluded environment", (layerIt) => {
    layerIt.effect("runs without TestClock", () => Effect.sleep("1 millis"), { timeout: 500 });
  });
}

if (mode === "property") {
  it.effect.prop(
    "property context",
    [Arbitrary.Constant("property-value")],
    ([value], ctx) =>
      Effect.sync(() => {
        expect(value).toBe("property-value");
        expect(ctx.task.fullTestName).toContain("property context");
      }),
    { arbitrary: fcRuns(2), timeout: 500 }
  );
}

if (
  mode === "tiny-timeout" ||
  mode === "concurrent-each" ||
  mode === "property-deadline" ||
  mode === "property-setup-budget" ||
  mode === "property-late-success"
) {
  const { makeIt } = await import("@beep/test-utils/test/Vitest");
  // The independent TestClock drives only watchdog timers and deliberate trial
  // delays. A monotonic offset models synchronous setup or a late callback while
  // timer delivery is held; ordinary body Clock services remain untouched.
  const makeControlledWatchdog = () => {
    const scope = Scope.makeUnsafe();
    const timers = Effect.runSync(TestClock.make().pipe(Effect.provideService(Scope.Scope, scope)));
    afterAll(() => Effect.runPromise(Scope.close(scope, Exit.void)));
    let offsetNanos = 0n;
    let armed = Deferred.makeUnsafe<void>();
    const clock: Clock.Clock = {
      ...timers,
      monotonicTimeNanosUnsafe: () => timers.monotonicTimeNanosUnsafe() + offsetNanos,
      monotonicTimeNanos: Effect.map(timers.monotonicTimeNanos, (nanos) => nanos + offsetNanos),
      sleep: Effect.fnUntraced(function* (duration: Duration.Duration) {
        const sleeper = yield* Effect.forkChild(timers.sleep(duration), { startImmediately: true });
        yield* Deferred.succeed(armed, undefined);
        yield* Fiber.join(sleeper);
      }),
    };
    return {
      clock,
      advance: timers.adjust,
      beginTrial: () => {
        armed = Deferred.makeUnsafe<void>();
      },
      elapseWithoutTimerDelivery: (millis: number) => {
        offsetNanos += BigInt(millis) * 1_000_000n;
      },
      awaitArmed: Effect.suspend(() => Deferred.await(armed)),
      delay: Effect.fnUntraced(function* (millis: number) {
        const sleeper = yield* Effect.forkChild(timers.sleep(Duration.millis(millis)), { startImmediately: true });
        yield* Deferred.await(armed);
        yield* timers.adjust(Duration.millis(millis));
        yield* Fiber.join(sleeper);
      }),
    };
  };

  if (mode === "tiny-timeout") {
    const controlled = makeControlledWatchdog();
    const controlledIt = makeIt(controlled.clock);
    controlledIt.effect(
      "tiny positive timeout",
      () =>
        Effect.gen(function* () {
          yield* controlled.awaitArmed;
          yield* controlled.advance("12.5 millis");
          return yield* Effect.never;
        }).pipe(Effect.ensuring(Effect.sync(() => recordCleanup("tiny body released\n")))),
      { timeout: 25 }
    );
  }

  if (mode === "concurrent-each") {
    const alpha = makeControlledWatchdog();
    const beta = makeControlledWatchdog();
    const alphaIt = makeIt(alpha.clock);
    const betaIt = makeIt(beta.clock);
    const alphaLogged = Deferred.makeUnsafe<void>();
    const betaLogged = Deferred.makeUnsafe<void>();
    const alphaReleased = Deferred.makeUnsafe<void>();
    const betaReleased = Deferred.makeUnsafe<void>();
    describe.concurrent("isolated concurrent cases", () => {
      alphaIt.effect.each(["alpha"])(
        "case %s",
        (value) =>
          Effect.log(`last-${value}`).pipe(
            Effect.andThen(Deferred.succeed(alphaLogged, undefined)),
            Effect.andThen(Effect.never),
            Effect.ensuring(Deferred.succeed(alphaReleased, undefined))
          ),
        { timeout: 180 }
      );
      betaIt.effect.each(["beta"])(
        "case %s",
        (value) =>
          Effect.gen(function* () {
            yield* Effect.log(`last-${value}`);
            yield* Deferred.succeed(betaLogged, undefined);
            yield* Effect.all([
              alpha.awaitArmed,
              beta.awaitArmed,
              Deferred.await(alphaLogged),
              Deferred.await(betaLogged),
            ]);
            yield* alpha.advance("155 millis");
            yield* Deferred.await(alphaReleased);
            expect(yield* Deferred.isDone(betaReleased)).toBe(false);
            recordCleanup("alpha expired while beta remained active\n");
            yield* beta.advance("215 millis");
            return yield* Effect.never;
          }).pipe(Effect.ensuring(Deferred.succeed(betaReleased, undefined))),
        { timeout: 240 }
      );
    });
  }

  if (mode === "property-deadline") {
    const controlled = makeControlledWatchdog();
    const controlledIt = makeIt(controlled.clock);
    let trial = 0;
    controlledIt.layer(TraceSink)("property deadline layer", (layerIt) => {
      layerIt.effect.prop(
        "aggregate property deadline",
        [Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 }))],
        ([value], context) => {
          controlled.beginTrial();
          return Effect.gen(function* () {
            trial += 1;
            yield* recordPhase(context, "trial-start");
            expect(yield* Clock.monotonicTimeNanos).toBe(0n);
            yield* Effect.acquireRelease(Effect.log(`property-trial-${trial}-value-${value}`), () =>
              Effect.sync(() => {
                recordCleanup("property-trial-released\n");
              })
            );
            yield* controlled.delay(60);
            expect(yield* Clock.monotonicTimeNanos).toBe(0n);
            yield* recordPhase(context, "trial-success");
          });
        },
        { arbitrary: { ...fcRuns(4), seed: 4242 }, timeout: 180 }
      );
    });
  }

  if (mode === "property-setup-budget") {
    for (const setupMillis of [40, 155]) {
      const controlled = makeControlledWatchdog();
      const controlledIt = makeIt(controlled.clock);
      const SetupSink = Logger.layer(
        [
          Logger.make<unknown, void>(({ message }) => {
            if (Inspectable.toStringUnknown(message, 0).includes("effect-vitest test start")) {
              controlled.elapseWithoutTimerDelivery(setupMillis);
              recordCleanup(`setup-consumed-${setupMillis}\n`);
            }
          }),
        ],
        { mergeWithExisting: true }
      );
      controlledIt.layer(SetupSink.pipe(Layer.provideMerge(TraceSink)))(`setup ${setupMillis}`, (layerIt) => {
        layerIt.effect.prop(
          `charges ${setupMillis}ms of setup`,
          [Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 }))],
          ([value]) => {
            controlled.beginTrial();
            return Effect.gen(function* () {
              // The body runs first in raceFirst; its synchronous setup must not
              // postpone the watchdog's absolute due time when that branch starts.
              controlled.elapseWithoutTimerDelivery(10);
              yield* Effect.log(`setup-${setupMillis}-body-${value}`);
              yield* controlled.delay(120);
              yield* Effect.log(`setup-${setupMillis}-completed`);
            });
          },
          { arbitrary: { ...fcRuns(4), seed: 4242 }, timeout: 180 }
        );
      });
    }
  }

  if (mode === "property-late-success") {
    const controlled = makeControlledWatchdog();
    const controlledIt = makeIt(controlled.clock);
    controlledIt.layer(TraceSink)("late success policy", (layerIt) => {
      layerIt.effect.prop(
        "keeps a late raceFirst success then expires the next trial",
        [Arbitrary.Constant("late")],
        () => {
          controlled.beginTrial();
          return Effect.gen(function* () {
            yield* controlled.awaitArmed;
            controlled.elapseWithoutTimerDelivery(200);
            yield* Effect.log("late-body-completed");
          });
        },
        { arbitrary: { ...fcRuns(4), seed: 4242 }, timeout: 180 }
      );
    });
  }
}

if (mode === "concurrent-property-layer") {
  const DelayedLayer = Layer.effectDiscard(diagnosticClock.sleep(Duration.millis(20)));
  it.layer(Layer.merge(DelayedLayer, TraceSink))("delayed concurrent property layer", (layerIt) => {
    layerIt.effect.prop(
      "property alpha",
      [Arbitrary.Constant("alpha")],
      ([value]) => Effect.log(`last-property-${value}`).pipe(Effect.andThen(Effect.never)),
      {
        concurrent: true,
        arbitrary: { ...fcRuns(2), seed: 101 },
        timeout: 180,
      }
    );
    layerIt.effect.prop(
      "property beta",
      [Arbitrary.Constant("beta")],
      ([value]) => Effect.log(`last-property-${value}`).pipe(Effect.andThen(Effect.never)),
      {
        concurrent: true,
        arbitrary: { ...fcRuns(2), seed: 202 },
        timeout: 240,
      }
    );
  });
}

if (mode === "property-registration-identity") {
  class Barrier extends Context.Service<
    Barrier,
    {
      readonly entered: Ref.Ref<number>;
      readonly ready: Deferred.Deferred<void>;
    }
  >()("@beep/test-utils/fixtures/property-registration-identity/Barrier") {}

  const BarrierLayer = Layer.effect(
    Barrier,
    Effect.all({
      entered: Ref.make(0),
      ready: Deferred.make<void>(),
    })
  );
  const propertyBody = Effect.fnUntraced(function* ([succeeds]: readonly [boolean]) {
    const barrier = yield* Barrier;
    const entered = yield* Ref.updateAndGet(barrier.entered, (count) => count + 1);
    if (entered === 2) yield* Deferred.succeed(barrier.ready, undefined);
    yield* Deferred.await(barrier.ready);
    yield* Effect.log(succeeds ? "identity-success-body" : "identity-failure-body");
    if (!succeeds) return yield* Effect.fail("identity-registration-failure");
  });

  it.layer(Layer.merge(BarrierLayer, TraceSink))("property identity layer", (layerIt) => {
    layerIt.effect.prop("same property title", [Arbitrary.Constant(true)], propertyBody, {
      concurrent: true,
      arbitrary: { ...fcRuns(2), seed: 303 },
    });
    layerIt.effect.prop("same property title", [Arbitrary.Constant(false)], propertyBody, {
      concurrent: true,
      arbitrary: { ...fcRuns(2), seed: 303 },
    });
  });
}

if (mode === "property-repeat-reset") {
  let execution = 0;
  beforeEach(() => {
    execution += 1;
  });
  it.layer(TraceSink)("property repeat layer", (layerIt) => {
    layerIt.effect.prop(
      "property repeat resets execution state",
      [Arbitrary.Constant(1)],
      () => (execution === 1 ? Effect.log("first-execution-body-log") : Effect.never),
      {
        arbitrary: { ...fcRuns(2), seed: 808 },
        repeats: 1,
        timeout: 100,
      }
    );
  });
}

if (mode === "property-retry-reset") {
  let execution = 0;
  beforeEach(() => {
    execution += 1;
  });
  it.layer(TraceSink)("property retry layer", (layerIt) => {
    layerIt.effect.prop(
      "property retry resets execution state",
      [Arbitrary.Constant(1)],
      () =>
        Effect.log(`retry-execution-${execution}`).pipe(
          Effect.andThen(execution === 1 ? Effect.fail("retry-once") : Effect.void)
        ),
      {
        arbitrary: { ...fcRuns(2), seed: 909 },
        retry: 1,
        timeout: 100,
      }
    );
  });
  afterAll(() => expect(execution).toBe(2));
}

if (mode === "each-titles") {
  const tupleCases = [
    ["same", 1],
    ["same", 1],
  ] as const;
  const objectCases = [
    { label: "alpha", nested: { value: 1 } },
    { label: "beta", nested: { value: 2 } },
  ] as const;
  const suite = TestRunner.getCurrentSuite();
  const eachOptions = {
    concurrent: true,
    fails: false,
    meta: { instrumentation: "identity" },
    repeats: 0,
    retry: 0,
    timeout: 400,
  };
  let originalRuns = 0;
  let instrumentedRuns = 0;
  const firstOriginal = suite.tasks.length;
  originalIt.effect.each(tupleCases)(
    "tuple %s %d index=%# oneBased=%$ escaped=%%",
    (testCase) =>
      Effect.sync(() => {
        originalRuns += 1;
        expect(testCase).toHaveLength(2);
      }),
    eachOptions
  );
  originalIt.effect.each(objectCases)(
    "object $label nested=$nested.value index=%# oneBased=%$ escaped=%%",
    (testCase) =>
      Effect.sync(() => {
        originalRuns += 1;
        expect(testCase.nested.value).toBeGreaterThan(0);
      }),
    eachOptions
  );
  const originalTasks = suite.tasks.slice(firstOriginal);

  const firstInstrumented = suite.tasks.length;
  it.effect.each(tupleCases)(
    "tuple %s %d index=%# oneBased=%$ escaped=%%",
    (testCase) =>
      Effect.sync(() => {
        instrumentedRuns += 1;
        expect(testCase).toHaveLength(2);
      }),
    eachOptions
  );
  it.effect.each(objectCases)(
    "object $label nested=$nested.value index=%# oneBased=%$ escaped=%%",
    (testCase) =>
      Effect.sync(() => {
        instrumentedRuns += 1;
        expect(testCase.nested.value).toBeGreaterThan(0);
      }),
    eachOptions
  );
  const instrumentedTasks = suite.tasks.slice(firstInstrumented);
  const collected = (tasks: typeof originalTasks) =>
    tasks.map((task) => {
      if (task.type !== "test") return expect.unreachable("each must register a test task");
      return {
        concurrent: task.concurrent,
        fails: task.fails,
        fullName: task.fullName,
        fullTestName: task.fullTestName,
        meta: task.meta,
        mode: task.mode,
        name: task.name,
        repeats: task.repeats,
        retry: task.retry,
        tags: task.tags,
        timeout: task.timeout,
      };
    });
  expect(collected(instrumentedTasks)).toEqual(collected(originalTasks));
  // Vitest 5 stopped quoting `$label` strings and appends a formatter-dependent
  // dump of the unconsumed case argument, so pin only the interpolated title.
  const interpolatedTitle = Str.replace(/ escaped=% .*$/, " escaped=%");
  expect(originalTasks.map((task) => interpolatedTitle(task.name))).toEqual([
    "tuple same 1 index=0 oneBased=1 escaped=%",
    "tuple same 1 index=1 oneBased=2 escaped=%",
    "object alpha nested=1 index=0 oneBased=1 escaped=%",
    "object beta nested=2 index=1 oneBased=2 escaped=%",
  ]);
  afterAll(() => {
    expect(originalRuns).toBe(4);
    expect(instrumentedRuns).toBe(4);
  });
}

if (mode === "only") {
  it.effect("ordinary case is not selected", () => Effect.die("must-not-run"));
  it.effect.only("selected only case", () =>
    Effect.sync(() => {
      recordCleanup("only-ran\n");
    })
  );
}

if (mode === undefined) {
  it("fixture requires an explicit mode", () => expect.unreachable());
}
