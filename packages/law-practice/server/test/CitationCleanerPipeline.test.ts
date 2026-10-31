import { fileURLToPath } from "node:url";
import {
  CitationCleanerFailure,
  CitationCleanerObject,
  CitationCleanerProduced,
  CitationCleanerRuntime,
  CitationCleanerTextCharge,
  makeCitationCleanerPipeline,
} from "@beep/law-practice-server/_test/Citation/CleanerPipeline";
import {
  CitationLiteralCleaner,
  makeCitationLiteralCleaners,
} from "@beep/law-practice-server/_test/Citation/LiteralCleaners";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import type {
  CitationCleanerCursor,
  CitationCleanerWork,
} from "@beep/law-practice-server/_test/Citation/CleanerPipeline";
import type { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";

type Failure = CitationCleanerFailure | CitationSafetyLimitExceeded;
type Callback = (
  value: CitationCleanerObject,
  work: CitationCleanerWork
) => Effect.Effect<CitationCleanerProduced, Failure>;
const fail = (reason: CitationCleanerFailure["reason"]) => CitationCleanerFailure.make({ reason });
const harness = Effect.gen(function* () {
  const values = new WeakMap<CitationCleanerObject, unknown>();
  const callbacks = new WeakMap<CitationCleanerObject, Callback>();
  const registry = new Map<unknown, CitationCleanerObject>();
  const plans = new Map<string, (initial: CitationCleanerObject, work: CitationCleanerWork) => CitationCleanerCursor>();
  let nextSlot = 0;
  let events: ReadonlyArray<string> = [];
  let lastWork = O.none<CitationCleanerWork>();
  const record = (event: string) => {
    events = A.append(events, event);
  };
  const own = (value: unknown) => {
    const ref = CitationCleanerObject.make({ slot: nextSlot++ });
    values.set(ref, value);
    return ref;
  };
  const raw = Effect.fn("CleanerTest.raw")(
    (ref: CitationCleanerObject): Effect.Effect<unknown, CitationCleanerFailure> =>
      values.has(ref) ? Effect.succeed(values.get(ref)) : Effect.fail(fail("unissued-value"))
  );
  const callback = (body: Callback) => {
    const ref = own(body);
    callbacks.set(ref, body);
    return ref;
  };
  const emit = Effect.fn("CleanerTest.emit")(function* (
    work: CitationCleanerWork,
    units: number,
    materialize: () => string
  ) {
    const charges = units > 0 ? [yield* work.reserveText(units)] : [];
    const value = yield* Effect.sync(() => own(materialize()));
    return CitationCleanerProduced.make({ value, charges });
  });
  const sequence = (steps: ReadonlyArray<CitationCleanerObject>): CitationCleanerCursor => {
    let index = 0;
    return {
      next: Effect.sync(() => {
        record("next");
        return O.fromUndefinedOr(steps[index++]);
      }),
    };
  };
  const runtime = CitationCleanerRuntime.of({
    fromText: Effect.fn("CleanerTest.fromText")((text: string) =>
      Effect.sync(() => {
        record("fromText");
        return own(text);
      })
    ),
    assertOwned: Effect.fn("CleanerTest.assertOwned")(
      (value: CitationCleanerObject): Effect.Effect<void, Failure> =>
        values.has(value) ? Effect.void : Effect.fail(fail("unissued-value"))
    ),
    textUnits: Effect.fn("CleanerTest.textUnits")((value: CitationCleanerObject) =>
      raw(value).pipe(Effect.map((value) => (P.isString(value) ? O.some(value.length) : O.none())))
    ),
    open: Effect.fn("CleanerTest.open")((plan: string, initial: CitationCleanerObject, work: CitationCleanerWork) =>
      Effect.suspend(() => {
        record(`open:${plan}`);
        lastWork = O.some(work);
        const open = plans.get(plan);
        return open === undefined ? Effect.fail(fail("unknown-plan")) : Effect.succeed(open(initial, work));
      })
    ),
    contains: Effect.fn("CleanerTest.contains")((step: CitationCleanerObject) =>
      raw(step).pipe(
        Effect.map((value) => {
          record("contains");
          return registry.has(value);
        })
      )
    ),
    get: Effect.fn("CleanerTest.get")((step: CitationCleanerObject) =>
      raw(step).pipe(
        Effect.flatMap((value) => {
          record("get");
          return Effect.fromOption(O.fromUndefinedOr(registry.get(value)), () => fail("lookup-key-missing"));
        })
      )
    ),
    callable: Effect.fn("CleanerTest.callable")((value: CitationCleanerObject) =>
      Effect.sync(() => {
        record("callable");
        return callbacks.has(value);
      })
    ),
    invoke: Effect.fn("CleanerTest.invoke")(
      (
        fn: CitationCleanerObject,
        value: CitationCleanerObject,
        work: CitationCleanerWork
      ): Effect.Effect<CitationCleanerProduced, Failure> =>
        Effect.suspend(() => {
          record("invoke");
          const body = callbacks.get(fn);
          return body === undefined ? Effect.fail(fail("not-callable")) : body(value, work);
        })
    ),
  });
  return {
    runtime,
    own,
    raw,
    callback,
    emit,
    sequence,
    plans,
    registry,
    record,
    events: Effect.sync(() => events),
    work: Effect.suspend(() => Effect.fromOption(lastWork, () => fail("closed-work"))),
  };
});
const pipeline = Effect.fn("CleanerTest.pipeline")(function* (
  h: Effect.Success<typeof harness>,
  overrides: Partial<Effect.Success<typeof defaultCitationEnginePolicy>["limits"]> = {}
) {
  return yield* makeCitationCleanerPipeline({ ...(yield* defaultCitationEnginePolicy).limits, ...overrides }).pipe(
    Effect.provideService(CitationCleanerRuntime, h.runtime)
  );
});
it.effect("consumes a live cursor and performs membership before a separate value lookup", () =>
  Effect.gen(function* () {
    const h = yield* harness;
    const named = h.own("named");
    let advanced = false;
    const first = h.callback((_, work) => {
      advanced = true;
      return h.emit(work, 1, () => "A");
    });
    const later = h.callback((_, work) => h.emit(work, 1, () => "B"));
    h.registry.set("named", first);
    h.plans.set("lazy", () => {
      let index = 0;
      return {
        next: Effect.sync(() => {
          h.record("next");
          if (index++ === 0) return O.some(named);
          if (index === 2) {
            expect(advanced).toBe(true);
            return O.some(later);
          }
          return O.none();
        }),
      };
    });
    const run = yield* (yield* pipeline(h)).run({ text: "x", plan: "lazy" });
    expect(yield* h.raw(run.value)).toBe("B");
    expect(run.producedTextUtf16).toBe(2);
    expect(yield* h.events).toEqual([
      "fromText",
      "open:lazy",
      "next",
      "contains",
      "get",
      "invoke",
      "next",
      "contains",
      "callable",
      "invoke",
      "next",
    ]);
    expect((yield* (yield* h.work).snapshot).closed).toBe(true);
  })
);
it.effect("preserves non-string values, identities and callback state across operations", () =>
  Effect.gen(function* () {
    const h = yield* harness;
    const host = { count: 0 };
    const hostRef = h.own(host);
    const produceHost = h.callback(() => Effect.succeed(CitationCleanerProduced.make({ value: hostRef, charges: [] })));
    const useHost = h.callback((value, work) =>
      Effect.gen(function* () {
        expect(yield* h.raw(value)).toBe(host);
        host.count++;
        return yield* h.emit(work, 1, () => `${host.count}`);
      })
    );
    h.plans.set("host", () => h.sequence([produceHost]));
    h.plans.set("state", () => h.sequence([produceHost, useHost]));
    const p = yield* pipeline(h);
    const object = yield* p.run({ text: "x", plan: "host" });
    expect(object.value).toBe(hostRef);
    expect(object.producedTextUtf16).toBe(0);
    expect(yield* h.raw((yield* p.run({ text: "x", plan: "state" })).value)).toBe("1");
    expect(yield* h.raw((yield* p.run({ text: "x", plan: "state" })).value)).toBe("2");
  })
);
it.effect("does not fall back from a matched non-callable and stops before fetching another step on failure", () =>
  Effect.gen(function* () {
    const h = yield* harness;
    const name = h.own("name");
    h.registry.set("name", h.own(7));
    h.plans.set("invalid", () => h.sequence([name, h.own("later")]));
    const failed = yield* Effect.flip((yield* pipeline(h)).run({ text: "x", plan: "invalid" }));
    expect(failed._tag).toBe("CitationCleanerFailure");
    if (failed._tag === "CitationCleanerFailure") expect(failed.reason).toBe("not-callable");
    expect(yield* h.events).toEqual(["fromText", "open:invalid", "next", "contains", "get", "invoke"]);
  })
);
it.effect("shares nested reservations and permits intermediate values larger than the original source allowance", () =>
  Effect.gen(function* () {
    const h = yield* harness;
    const inner = h.callback((_, work) => h.emit(work, 2, () => "YY"));
    const outer = h.callback((value, work) =>
      Effect.gen(function* () {
        const result = yield* work.nested("inner", value);
        return CitationCleanerProduced.make({ value: result, charges: [yield* work.reserveText(2)] });
      })
    );
    h.plans.set("inner", () => h.sequence([inner]));
    h.plans.set("outer", () => h.sequence([outer]));
    const p = yield* pipeline(h, { sourceUtf16: 1, producedTextUtf16: 4 });
    const result = yield* p.run({ text: "x", plan: "outer" });
    expect(yield* h.raw(result.value)).toBe("YY");
    expect(result.producedTextUtf16).toBe(4);
    const stale = yield* Effect.flip((yield* h.work).nested("inner", result.value));
    expect(stale._tag).toBe("CitationCleanerFailure");
    if (stale._tag === "CitationCleanerFailure") expect(stale.reason).toBe("closed-work");
    const failed = yield* Effect.flip(
      (yield* pipeline(h, { sourceUtf16: 1, producedTextUtf16: 3 })).run({ text: "x", plan: "outer" })
    );
    expect(failed._tag).toBe("CitationSafetyLimitExceeded");
    if (failed._tag === "CitationSafetyLimitExceeded") expect(failed.limit).toBe("producedTextUtf16");
  })
);
it.effect("reserves before materialization, rejects forged/reused charges and accounts for an empty plan", () =>
  Effect.gen(function* () {
    const h = yield* harness;
    let materialized = false;
    const large = h.callback((_, work) =>
      h.emit(work, 3, () => {
        materialized = true;
        return "ABC";
      })
    );
    h.plans.set("large", () => h.sequence([large]));
    const p = yield* pipeline(h, { producedTextUtf16: 2 });
    expect((yield* Effect.flip(p.run({ text: "x", plan: "large" })))._tag).toBe("CitationSafetyLimitExceeded");
    expect(materialized).toBe(false);
    const forged = h.callback(() =>
      Effect.succeed(
        CitationCleanerProduced.make({ value: h.own("X"), charges: [CitationCleanerTextCharge.make({ units: 1 })] })
      )
    );
    const reused = h.callback((_, work) =>
      Effect.gen(function* () {
        const charge = yield* work.reserveText(1);
        return CitationCleanerProduced.make({ value: h.own("XX"), charges: [charge, charge] });
      })
    );
    const restored = h.callback((_, work) =>
      Effect.gen(function* () {
        const issued = yield* work.reserveText(1);
        const codec = S.fromJsonString(CitationCleanerTextCharge);
        const encoded = yield* S.encodeEffect(codec)(issued).pipe(Effect.orDie);
        const decoded = yield* S.decodeEffect(codec)(encoded).pipe(Effect.orDie);
        expect(decoded.units).toBe(issued.units);
        return CitationCleanerProduced.make({ value: h.own("X"), charges: [decoded] });
      })
    );
    h.plans.set("restored", () => h.sequence([restored]));
    h.plans.set("forged", () => h.sequence([forged]));
    h.plans.set("reused", () => h.sequence([reused]));
    for (const plan of ["forged", "reused", "restored"]) {
      const failed = yield* Effect.flip(p.run({ text: "x", plan }));
      expect(failed._tag).toBe("CitationCleanerFailure");
      if (failed._tag === "CitationCleanerFailure") expect(failed.reason).toBe("invalid-reservation");
    }
    h.plans.set("empty", () => h.sequence([]));
    const empty = yield* p.run({ text: "AB", plan: "empty" });
    expect(yield* h.raw(empty.value)).toBe("AB");
    expect(empty.producedTextUtf16).toBe(2);
    expect(yield* Effect.flip(p.run({ text: "ABC", plan: "empty" }))).toMatchObject({
      _tag: "CitationSafetyLimitExceeded",
      limit: "producedTextUtf16",
    });
  })
);
it.effect(
  "captures one deadline through nested work, ignores caller clock replacement and closes on cancellation",
  () =>
    Effect.gen(function* () {
      const h = yield* harness;
      const entered = yield* Deferred.make<void>();
      const wait = h.callback(() => Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never)));
      h.plans.set("wait", () => h.sequence([wait]));
      const outer = h.callback((value, work) =>
        work.nested("wait", value).pipe(Effect.map((value) => CitationCleanerProduced.make({ value, charges: [] })))
      );
      h.plans.set("nested", () => h.sequence([outer]));
      const p = yield* pipeline(h, { cleanDeadline: Duration.millis(100), operationDeadline: Duration.millis(50) });
      const clock = yield* Clock.Clock;
      const changed: Clock.Clock = {
        currentTimeMillisUnsafe: () => clock.currentTimeMillisUnsafe(),
        currentTimeMillis: clock.currentTimeMillis,
        currentTimeNanosUnsafe: () => clock.currentTimeNanosUnsafe(),
        currentTimeNanos: clock.currentTimeNanos,
        monotonicTimeNanosUnsafe: () => clock.monotonicTimeNanosUnsafe(),
        monotonicTimeNanos: clock.monotonicTimeNanos,
        sleep: () => Effect.never,
      };
      const fiber = yield* p
        .run({ text: "x", plan: "nested" })
        .pipe(Effect.provideService(Clock.Clock, changed), Effect.forkChild);
      yield* Deferred.await(entered);
      yield* TestClock.adjust(Duration.millis(50));
      const failed = yield* Fiber.join(fiber).pipe(Effect.flip);
      expect(failed).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "operationDeadline" });
      expect((yield* (yield* h.work).snapshot).closed).toBe(true);
      const interrupted = yield* Effect.forkChild(p.run({ text: "x", plan: "wait" }));
      yield* Effect.yieldNow;
      yield* Fiber.interrupt(interrupted);
      expect(Exit.hasInterrupts(yield* Fiber.await(interrupted))).toBe(true);
    })
);
it.effect("redacts runtime defects and mixed interruption causes, and rejects functions in request data", () =>
  Effect.gen(function* () {
    const h = yield* harness;
    const defect = h.callback(() => Effect.die("private source"));
    const mixed = h.callback(() => Effect.failCause(Cause.combine(Cause.interrupt(777), Cause.die("private source"))));
    h.plans.set("defect", () => h.sequence([defect]));
    h.plans.set("mixed", () => h.sequence([mixed]));
    const p = yield* pipeline(h);
    expect(yield* Effect.flip(p.run({ text: "private source", plan: "defect" }))).toMatchObject({
      _tag: "CitationCleanerFailure",
      reason: "runtime-failed",
    });
    const result = yield* Effect.exit(p.run({ text: "private source", plan: "mixed" }));
    expect(Exit.hasInterrupts(result)).toBe(true);
    if (Exit.isFailure(result)) expect(Cause.hasDies(result.cause)).toBe(false);
    const malformed = {
      get text() {
        throw new Error("private source");
      },
      plan: "defect",
    };
    expect(yield* Effect.flip(p.run(malformed))).toMatchObject({
      _tag: "CitationCleanerFailure",
      reason: "runtime-failed",
    });
    expect(yield* Effect.flip(p.run({ text: "x", plan: "defect", callback: () => "x" }))).toMatchObject({
      _tag: "CitationCleanerFailure",
      reason: "invalid-input",
    });
  })
);

it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("reserved literal cleaner stages", (it) => {
  it.effect(
    "preserves all 440 frozen primitive text outputs through the executor and pre-allocation stage reservations",
    () =>
      Effect.gen(function* () {
        const raw = yield* (yield* FileSystem.FileSystem).readFileString(
          fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/literal-cleaners.json", import.meta.url))
        );
        expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw))).toBe(
          "242701dc5547bc00fa441117925f934e45c4505f1515e4c51ab0e8380dd199e8"
        );
        const corpus = yield* S.decodeEffect(
          S.fromJsonString(
            S.Struct({
              artifacts: S.Array(S.Struct({ sha256: S.String, value: S.String })),
              cases: S.Array(S.Struct({ cleaner: CitationLiteralCleaner, text: S.String, expected: S.String })),
            })
          )
        )(raw);
        const texts = HashMap.fromIterable(A.map(corpus.artifacts, (row) => [row.sha256, row.value] as const));
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const literal = yield* makeCitationLiteralCleaners(limits);
        const h = yield* harness;
        for (const row of corpus.cases) {
          if (!h.plans.has(row.cleaner)) {
            const cleaner = row.cleaner;
            const fn = h.callback((value, work) =>
              Effect.gen(function* () {
                const text = yield* h.raw(value);
                if (!P.isString(text)) return yield* fail("callback-failed");
                const stage = yield* literal
                  .stage({ cleaner, text }, work)
                  .pipe(
                    Effect.mapError((error) =>
                      error._tag === "CitationLiteralCleanerFailure" ? fail("callback-failed") : error
                    )
                  );
                return CitationCleanerProduced.make({ value: h.own(stage.text), charges: stage.charges });
              })
            );
            const name = h.own(cleaner);
            h.registry.set(cleaner, fn);
            h.plans.set(cleaner, () => h.sequence([name]));
          }
        }
        const p = yield* pipeline(h);
        expect(corpus.cases).toHaveLength(440);
        for (const row of corpus.cases) {
          const text = yield* Effect.fromOption(HashMap.get(texts, row.text));
          const expected = yield* Effect.fromOption(HashMap.get(texts, row.expected));
          const result = yield* p.run({ text, plan: row.cleaner });
          expect(yield* h.raw(result.value)).toBe(expected);
          expect(result.producedTextUtf16).toBe(expected.length);
        }
      }),
    { timeout: 30_000 }
  );
  it.effect("keeps raw source checks separate from intermediate stage checks and charges repeated production", () =>
    Effect.gen(function* () {
      const h = yield* harness;
      const limits = { ...(yield* defaultCitationEnginePolicy).limits, sourceUtf16: 1, producedTextUtf16: 6 };
      const literal = yield* makeCitationLiteralCleaners(limits);
      expect((yield* Effect.flip(literal.apply({ cleaner: "underscores", text: "__A__" }))).reason).toBe(
        "limit-exceeded"
      );
      const first = h.callback((_, work) => h.emit(work, 5, () => "__A__"));
      const second = h.callback((value, work) =>
        Effect.gen(function* () {
          const text = yield* h.raw(value);
          const output = yield* literal
            .stage({ cleaner: "underscores", text }, work)
            .pipe(
              Effect.mapError((error) =>
                error._tag === "CitationLiteralCleanerFailure" ? fail("callback-failed") : error
              )
            );
          return CitationCleanerProduced.make({ value: h.own(output.text), charges: output.charges });
        })
      );
      h.plans.set("stages", () => h.sequence([first, second]));
      const result = yield* (yield* pipeline(h, limits)).run({ text: "x", plan: "stages" });
      expect(yield* h.raw(result.value)).toBe("A");
      expect(result.producedTextUtf16).toBe(6);
      const failed = yield* Effect.flip(
        (yield* pipeline(h, { ...limits, producedTextUtf16: 5 })).run({ text: "x", plan: "stages" })
      );
      expect(failed).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "producedTextUtf16" });
    })
  );
});
