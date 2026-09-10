import * as NodeAsyncHooks from "node:async_hooks";
import { aroundEach } from "@effect/vitest";
import {
  Array as Arr,
  Cause,
  Clock,
  Config,
  Effect,
  Exit,
  Inspectable,
  Layer,
  Logger,
  MutableRef,
  Number as Num,
  Option as O,
  pipe,
  Scope,
} from "effect";
import { dual } from "effect/Function";
import { TestContextUnavailable, TestHang } from "../Vitest.errors.ts";
import type { TestContext, Vitest } from "@effect/vitest";

const liveClock = Effect.runSync(Clock.Clock);
const WatchdogMaximumMarginMillis = 250;
const WatchdogMinimumReliableMarginMillis = 25;
const WatchdogMarginRatio = 0.05;

const traceEnabled = Effect.gen(function* () {
  const explicit = yield* Config.option(Config.String("BEEP_TEST_TRACE"));
  const ci = yield* Config.Boolean("CI").pipe(Config.withDefault(false));
  return O.contains(explicit, "1") || ci;
}).pipe(Effect.orElseSucceed(() => false));

interface ResolvedTestTask {
  readonly fullTestName: string;
  readonly name: string;
  readonly timeout: number;
}

interface PropertyRunState {
  deadlineMillis: O.Option<number>;
  finish: O.Option<() => Promise<void>>;
  readonly lastLogLine: MutableRef.MutableRef<O.Option<string>>;
  outcome: "failure" | "interrupted" | "success";
  startedAtMillis: O.Option<number>;
  watchdogBudgetMillis: O.Option<number>;
}

interface TestExecutionState {
  readonly context: TestContext;
  // Registration tokens use reference identity; rc.112 Effect maps compare plain objects structurally.
  readonly propertyRuns: Map<object, PropertyRunState>;
}

const makePropertyRunState = (): PropertyRunState => ({
  lastLogLine: MutableRef.make(O.none()),
  finish: O.none(),
  startedAtMillis: O.none(),
  deadlineMillis: O.none(),
  outcome: "success",
  watchdogBudgetMillis: O.none(),
});

const testExecutionStorage = new NodeAsyncHooks.AsyncLocalStorage<TestExecutionState>();
// Native Arbitrary resumes trials inside Effect fibers, which may be scheduled
// from another test's async context. The public callback context retains its
// execution identity across those resumptions; weak keys do not retain tasks.
const testExecutions = new WeakMap<TestContext, TestExecutionState>();

const taskName = (task: ResolvedTestTask): string => task.fullTestName || task.name;

const taskFromContext = (context: TestContext): ResolvedTestTask => {
  const task = context.task;
  return { fullTestName: task.fullTestName, name: task.name, timeout: task.timeout };
};

const watchdogBudget = (timeout: number): O.Option<number> => {
  if (!globalThis.Number.isFinite(timeout) || timeout <= 0) {
    return O.none();
  }
  if (timeout <= WatchdogMinimumReliableMarginMillis) {
    const subMillisecondBudget = timeout / 2;
    return subMillisecondBudget > 0 ? O.some(subMillisecondBudget) : O.none();
  }
  const margin = Num.min(
    WatchdogMaximumMarginMillis,
    Num.max(WatchdogMinimumReliableMarginMillis, timeout * WatchdogMarginRatio)
  );
  return O.some(timeout - margin);
};

const renderLogLine = (message: unknown): string =>
  pipe(
    Arr.ensure(message),
    Arr.map((part) => Inspectable.toStringUnknown(part, 0)),
    Arr.join(" ")
  );

const outcomeOf = <A, E>(exit: Exit.Exit<A, E>): PropertyRunState["outcome"] => {
  if (Exit.isSuccess(exit)) {
    return "success";
  }
  return Cause.hasInterrupts(exit.cause) ? "interrupted" : "failure";
};

const retainFailureOutcome = (
  current: PropertyRunState["outcome"],
  next: PropertyRunState["outcome"]
): PropertyRunState["outcome"] => (current === "success" ? next : current);

const provideLoggerLayer = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  layer: Layer.Layer<never>
): Effect.Effect<A, E, R | Scope.Scope> =>
  Scope.Scope.use((scope) =>
    Layer.buildWithScope(layer, scope).pipe(Effect.flatMap((context) => Effect.provide(effect, context)))
  );

const startTestLifecycle = Effect.fnUntraced(function* (
  name: string,
  shouldTrace: boolean,
  startedAtMillis: number,
  monotonicMillis: Effect.Effect<number>,
  isFirstPropertyTrial: boolean,
  propertyRun?: PropertyRunState
) {
  if (shouldTrace && (propertyRun === undefined || isFirstPropertyTrial)) {
    yield* Effect.log("effect-vitest test start").pipe(Effect.annotateLogs({ event: "start", testName: name }));
  }

  if (propertyRun !== undefined && isFirstPropertyTrial && shouldTrace) {
    const currentLoggers = yield* Logger.CurrentLoggers;
    const runInContext = Effect.runPromiseWith(yield* Effect.context<never>());
    propertyRun.finish = O.some(() =>
      runInContext(
        monotonicMillis.pipe(
          Effect.flatMap((endedAtMillis) => {
            const durationMillis = endedAtMillis - startedAtMillis;
            return Effect.log(
              `effect-vitest test end outcome=${propertyRun.outcome} durationMillis=${durationMillis}`
            ).pipe(
              Effect.annotateLogs({
                durationMillis,
                event: "end",
                outcome: propertyRun.outcome,
                testName: name,
              })
            );
          }),
          Effect.provideService(Logger.CurrentLoggers, currentLoggers)
        )
      )
    );
  }
});

const instrumentEffect = <A, E, R>(
  self: Effect.Effect<A, E, R>,
  task: ResolvedTestTask,
  clock: Clock.Clock,
  propertyRun?: PropertyRunState
): Effect.Effect<A, E | TestHang, R | Scope.Scope> =>
  Effect.gen(function* () {
    const monotonicMillis = Effect.map(clock.monotonicTimeNanos, (nanos) => globalThis.Number(nanos) / 1_000_000);
    const name = taskName(task);
    const lastLogLine = propertyRun?.lastLogLine ?? MutableRef.make(O.none<string>());
    const captureLogger = Logger.make<unknown, void>(({ message }) => {
      MutableRef.set(lastLogLine, O.some(renderLogLine(message)));
    });
    const shouldTrace = yield* traceEnabled;
    const loggerLayer = Logger.layer(shouldTrace ? [Logger.consolePretty()] : [], { mergeWithExisting: true });
    const captureLoggerLayer = Logger.layer([captureLogger], { mergeWithExisting: true });
    const startedAtMillis = yield* monotonicMillis;
    const isFirstPropertyTrial = propertyRun !== undefined && O.isNone(propertyRun.startedAtMillis);
    if (isFirstPropertyTrial) {
      propertyRun.startedAtMillis = O.some(startedAtMillis);
      propertyRun.watchdogBudgetMillis = watchdogBudget(task.timeout);
      propertyRun.deadlineMillis = O.map(propertyRun.watchdogBudgetMillis, (timeoutMillis) =>
        Num.sum(startedAtMillis, timeoutMillis)
      );
    }

    return yield* provideLoggerLayer(
      Effect.gen(function* () {
        yield* startTestLifecycle(
          name,
          shouldTrace,
          startedAtMillis,
          monotonicMillis,
          isFirstPropertyTrial,
          propertyRun
        );

        const body: Effect.Effect<Exit.Exit<A, E | TestHang>, never, R | Scope.Scope> = Effect.exit(
          provideLoggerLayer(self, captureLoggerLayer)
        );
        const watchdogExpired = (timeoutMillis: number) =>
          Effect.sync(() =>
            TestHang.make({
              lastLogLine: MutableRef.get(lastLogLine),
              testName: name,
              timeoutMillis,
            })
          ).pipe(
            Effect.tap((error) =>
              shouldTrace
                ? Effect.logError("effect-vitest watchdog expired", error).pipe(
                    Effect.annotateLogs({ event: "watchdog", testName: name, timeoutMillis })
                  )
                : Effect.void
            ),
            Effect.map(Exit.fail)
          );
        // Setup consumes the stored absolute budget; sample again only when arming.
        const armedAtMillis = yield* monotonicMillis;
        const watchdog =
          propertyRun === undefined
            ? O.map(watchdogBudget(task.timeout), (timeoutMillis) => ({
                reportMillis: timeoutMillis,
                sleepMillis: timeoutMillis,
                wait: Effect.provideService(Effect.sleep(timeoutMillis), Clock.Clock, clock),
              }))
            : O.zipWith(
                propertyRun.deadlineMillis,
                propertyRun.watchdogBudgetMillis,
                (deadlineMillis, timeoutMillis) => ({
                  reportMillis: timeoutMillis,
                  sleepMillis: deadlineMillis - armedAtMillis,
                  // raceFirst starts the body first. Charge synchronous body setup
                  // too, by reading NOW again in the watchdog branch itself.
                  wait: monotonicMillis.pipe(
                    Effect.flatMap((nowMillis) => {
                      const remainingMillis = deadlineMillis - nowMillis;
                      return remainingMillis <= 0
                        ? Effect.void
                        : Effect.provideService(Effect.sleep(remainingMillis), Clock.Clock, clock);
                    })
                  ),
                })
              );
        const winner = O.match(watchdog, {
          onNone: (): Effect.Effect<Exit.Exit<A, E | TestHang>, never, R | Scope.Scope> => body,
          onSome: ({
            reportMillis,
            sleepMillis,
            wait,
          }): Effect.Effect<Exit.Exit<A, E | TestHang>, never, R | Scope.Scope> =>
            sleepMillis <= 0
              ? watchdogExpired(reportMillis)
              : Effect.raceFirst(body, wait.pipe(Effect.andThen(watchdogExpired(reportMillis)))),
        });
        const exit = yield* winner;
        const outcome = outcomeOf(exit);
        if (propertyRun !== undefined) {
          propertyRun.outcome = retainFailureOutcome(propertyRun.outcome, outcome);
        }

        if (shouldTrace && propertyRun === undefined) {
          const endedAtMillis = yield* monotonicMillis;
          const durationMillis = endedAtMillis - startedAtMillis;
          yield* Effect.log(`effect-vitest test end outcome=${outcome} durationMillis=${durationMillis}`).pipe(
            Effect.annotateLogs({
              durationMillis,
              event: "end",
              outcome,
              testName: name,
            })
          );
        }

        return yield* exit;
      }),
      loggerLayer
    );
  });

const missingTestContext = (method: string): Effect.Effect<never, TestContextUnavailable> =>
  Effect.fail(TestContextUnavailable.make({ method }));

const propertyRunFor = (registration: object, context: TestContext): PropertyRunState | undefined => {
  const execution = testExecutions.get(context);
  if (execution === undefined) {
    return undefined;
  }
  const existing = execution.propertyRuns.get(registration);
  if (existing !== undefined) {
    return existing;
  }
  const propertyRun = makePropertyRunState();
  execution.propertyRuns.set(registration, propertyRun);
  return propertyRun;
};

const finishPropertyRuns = (execution: TestExecutionState): Promise<void> =>
  Effect.forEach(
    execution.propertyRuns.values(),
    (propertyRun) =>
      O.match(propertyRun.finish, {
        onNone: () => Effect.void,
        onSome: (finish) => Effect.promise(finish),
      }),
    { discard: true }
  ).pipe(Effect.runPromise);

aroundEach((runTest, context) => {
  const execution: TestExecutionState = { context, propertyRuns: new Map() };
  testExecutions.set(context, execution);
  return testExecutionStorage.run(execution, () =>
    runTest()
      .finally(() => finishPropertyRuns(execution))
      .finally(() => {
        testExecutions.delete(context);
      })
  );
});

const instrumentContextCallback =
  <Args extends Array<unknown>, A, E, R>(
    self: (...args: [...Args, TestContext]) => Effect.Effect<A, E, R>,
    clock: Clock.Clock,
    propertyRegistration?: object
  ): ((...args: [...Args, TestContext]) => Effect.Effect<A, E | TestContextUnavailable | TestHang, R | Scope.Scope>) =>
  (...args) => {
    const context = args[args.length - 1] as TestContext;
    if (propertyRegistration === undefined) {
      return instrumentEffect(self(...args), taskFromContext(context), clock);
    }
    const propertyRun = propertyRunFor(propertyRegistration, context);
    if (propertyRun === undefined) {
      return missingTestContext("property");
    }
    return instrumentEffect(self(...args), taskFromContext(context), clock, propertyRun);
  };

const instrumentCaseCallback =
  <Args extends Array<unknown>, A, E, R>(self: (...args: Args) => Effect.Effect<A, E, R>, clock: Clock.Clock) =>
  (...args: Args): Effect.Effect<A, E | TestContextUnavailable | TestHang, R | Scope.Scope> => {
    const execution = testExecutionStorage.getStore();
    return execution === undefined
      ? missingTestContext("each")
      : instrumentEffect(self(...args), taskFromContext(execution.context), clock);
  };

const instrumentTest = <R>(test: Vitest.Test<R>, clock: Clock.Clock): Vitest.Test<R> =>
  new Proxy(test, {
    apply(target, thisArg, args) {
      const [name, self, timeout] = args;
      return Reflect.apply(target, thisArg, [name, instrumentContextCallback(self, clock), timeout]);
    },
  });

const instrumentConditional = <R>(
  conditional: (condition: unknown) => Vitest.Test<R>,
  clock: Clock.Clock
): ((condition: unknown) => Vitest.Test<R>) =>
  new Proxy(conditional, {
    apply(target, thisArg, args) {
      return instrumentTest(Reflect.apply(target, thisArg, args), clock);
    },
  });

const instrumentEach = <R>(each: Vitest.Tester<R>["each"], clock: Clock.Clock): Vitest.Tester<R>["each"] =>
  new Proxy(each, {
    apply(target, thisArg, args) {
      const [cases] = args;
      return new Proxy(() => undefined, {
        apply(_register, registerThisArg, registerArgs) {
          const [name, self, timeout] = registerArgs;
          const registration = Reflect.apply(target, thisArg, [cases]);
          return Reflect.apply(registration, registerThisArg, [name, instrumentCaseCallback(self, clock), timeout]);
        },
      });
    },
  });

const instrumentProperty = <R>(property: Vitest.Tester<R>["prop"], clock: Clock.Clock): Vitest.Tester<R>["prop"] =>
  new Proxy(property, {
    apply(target, thisArg, args) {
      const [name, arbitraries, self, timeout] = args;
      const propertyRegistration = {};
      return Reflect.apply(target, thisArg, [
        name,
        arbitraries,
        instrumentContextCallback(self, clock, propertyRegistration),
        timeout,
      ]);
    },
  });

const instrumentTester = <R>(tester: Vitest.Tester<R>, clock: Clock.Clock): Vitest.Tester<R> =>
  new Proxy(tester, {
    apply(target, thisArg, args) {
      const [name, self, timeout] = args;
      return Reflect.apply(target, thisArg, [name, instrumentContextCallback(self, clock), timeout]);
    },
    get(target, property, receiver) {
      switch (property) {
        case "skip":
        case "only":
        case "fails":
          return instrumentTest(Reflect.get(target, property, receiver), clock);
        case "skipIf":
        case "runIf":
          return instrumentConditional(Reflect.get(target, property, receiver), clock);
        case "each":
          return instrumentEach(Reflect.get(target, property, receiver), clock);
        case "prop":
          return instrumentProperty(Reflect.get(target, property, receiver), clock);
        default:
          return Reflect.get(target, property, receiver);
      }
    },
  });

const instrumentLayerCallback =
  <R>(
    callback: (methods: Vitest.MethodsNonLive<R>) => void,
    clock: Clock.Clock
  ): ((methods: Vitest.MethodsNonLive<R>) => void) =>
  (methods) =>
    callback(instrumentMethodsNonLive(methods, clock));

const instrumentLayerRegistration = <LayerFn extends (...args: ReadonlyArray<never>) => unknown>(
  layer: LayerFn,
  clock: Clock.Clock
): LayerFn =>
  new Proxy(layer, {
    apply(target, thisArg, args) {
      if (args.length === 1) {
        return Reflect.apply(target, thisArg, [instrumentLayerCallback(args[0], clock)]);
      }
      return Reflect.apply(target, thisArg, [args[0], instrumentLayerCallback(args[1], clock)]);
    },
  });

const instrumentLayer = <LayerFn extends (...args: ReadonlyArray<never>) => (...args: ReadonlyArray<never>) => unknown>(
  layer: LayerFn,
  clock: Clock.Clock
): LayerFn =>
  new Proxy(layer, {
    apply(target, thisArg, args) {
      return instrumentLayerRegistration(Reflect.apply(target, thisArg, args), clock);
    },
  });

const instrumentMethodsNonLive = <R>(methods: Vitest.MethodsNonLive<R>, clock: Clock.Clock): Vitest.MethodsNonLive<R> =>
  new Proxy(methods, {
    get(target, property, receiver) {
      switch (property) {
        case "effect":
          return instrumentTester(target.effect, clock);
        case "layer":
          return instrumentLayer(target.layer, clock);
        default:
          return Reflect.get(target, property, receiver);
      }
    },
  });

/** @internal */
export const instrumentMethods: {
  (clock: Clock.Clock | undefined): <R>(methods: Vitest.Methods<R>) => Vitest.Methods<R>;
  <R>(methods: Vitest.Methods<R>, clock: Clock.Clock | undefined): Vitest.Methods<R>;
} = dual(
  2,
  <R>(methods: Vitest.Methods<R>, clock: Clock.Clock = liveClock): Vitest.Methods<R> =>
    new Proxy(methods, {
      get(target, property, receiver) {
        switch (property) {
          case "effect":
            return instrumentTester(target.effect, clock);
          case "live":
            return instrumentTester(target.live, clock);
          case "layer":
            return instrumentLayer(target.layer, clock);
          default:
            return Reflect.get(target, property, receiver);
        }
      },
    })
);
