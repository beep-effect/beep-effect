import { $ScratchpadId } from "@beep/identity/packages";
import {
  afterAll,
  afterEach,
  assert,
  beforeAll,
  beforeEach,
  describe,
  describeWrapped,
  expect,
  expectTypeOf,
  flakyTest,
  it,
  layer,
  spyOn,
} from "../../bun-test/index.ts";
import * as testAssert from "../../bun-test/utils.ts";
import { Clock, Context, Duration, Effect, Fiber, Layer, Schema } from "effect";
import { TestClock } from "effect/testing";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

// Declared ahead of the describe blocks: Bun evaluates describe callbacks
// synchronously during module evaluation, so a later `const` would be in TDZ.
const $I = $ScratchpadId.create("test/bun-test/index.test");
const realNumber = Schema.Finite;
const textArbitrary = Arbitrary.schema(Schema.Literals(["a", "b"]));

it.effect("effect", () =>
  Effect.acquireRelease(
    Effect.sync(() => expect(1).toEqual(1)),
    () => Effect.void
  )
);
it.live("live", () =>
  Effect.acquireRelease(
    Effect.sync(() => expect(1).toEqual(1)),
    () => Effect.void
  )
);

it("throws fails when the thunk does not throw", () => {
  expect(() => testAssert.throws(() => {})).toThrow();
});

it("throwsAsync fails when the promise resolves", () =>
  expect(testAssert.throwsAsync(() => Promise.resolve())).rejects.toThrow("Expected to throw an error"));

it("throwsAsync validates a rejected value", () =>
  testAssert.throwsAsync(
    () => Promise.reject("rejected"),
    (error) => {
      expect(error).toBe("rejected");
    }
  ));

it("throwsAsync captures a synchronous throw", () =>
  testAssert.throwsAsync(
    () => {
      assert.fail("synchronous failure");
      return Promise.resolve();
    },
    (error) => {
      expect(error).toBeInstanceOf(Error);
      expect(error).toHaveProperty("message", "synchronous failure");
    }
  ));

it("throwsAsync preserves validation failures", () =>
  expect(
    testAssert.throwsAsync(
      () => Promise.reject("actual"),
      (error) => {
        expect(error).toBe("expected");
      }
    )
  ).rejects.toThrow());

describe("pipeable native hooks", () => {
  let setup = 0;
  let before = 0;
  let after = 0;

  beforeAll()((done) => {
    setup++;
    done();
  });
  beforeEach(100)(() => {
    before++;
  });
  afterEach({ timeout: 100 })(() => {
    after++;
    return Promise.resolve();
  });
  afterAll()(() => {
    expect(setup).toBe(1);
    expect(before).toBe(2);
    expect(after).toBe(2);
  });

  it("runs setup and before hooks", () => {
    expect(setup).toBe(1);
    expect(before).toBe(1);
    expect(after).toBe(0);
  });
  it("runs cleanup between tests", () => {
    expect(setup).toBe(1);
    expect(before).toBe(2);
    expect(after).toBe(1);
  });
});

it("spyOn preserves data-first and data-last mock types", () => {
  const source = { read: (value: number) => value + 1 };
  const direct = spyOn(source, "read");
  expectTypeOf(direct).returns.toEqualTypeOf<number>();
  expect(source.read(1)).toBe(2);
  expect(direct).toHaveBeenCalledWith(1);
  direct.mockRestore();

  const curried = spyOn("read")(source);
  expectTypeOf(curried).returns.toEqualTypeOf<number>();
  expect(source.read(2)).toBe(3);
  expect(curried).toHaveBeenCalledWith(2);
  curried.mockRestore();

  const explicit = spyOn<typeof source, "read">("read")(source);
  expect(source.read(3)).toBe(4);
  expect(explicit).toHaveBeenCalledWith(3);
  explicit.mockRestore();
});

describeWrapped("data-first wrapped suite", (tests) => {
  tests.effect("keeps callback registration", () => Effect.sync(() => expect(2 + 2).toBe(4)));
});

describeWrapped((tests) => {
  tests.effect("registers a data-last suite", () => Effect.sync(() => expect(3 + 3).toBe(6)));
})("data-last wrapped suite");

it.effect("flakyTest supports both call forms and default timeouts", () =>
  Effect.gen(function* () {
    expect(yield* flakyTest(Effect.succeed(1))).toBe(1);
    expect(yield* flakyTest(Effect.succeed(2), "1 second")).toBe(2);
    expect(yield* Effect.succeed(3).pipe(flakyTest())).toBe(3);
    expect(yield* Effect.succeed(4).pipe(flakyTest("1 second"))).toBe(4);
  })
);

it(() => expect("callback-first").toBe("callback-first"), { timeout: 100 })("data-last plain callback");
it({ timeout: 100 }, () => expect("options-first").toBe("options-first"))("data-last plain options");
it.effect(() => Effect.sync(() => expect(1).toBe(1)))("data-last Effect callback");
it.effect(() => Effect.sync(() => expect(2).toBe(2)), 100)("data-last Effect timeout");
it.effect.skipIf(false)(() => Effect.sync(() => expect(3).toBe(3)))("data-last conditional callback");
it.effect.fails(() => Effect.fail("expected"))("data-last expected failure");
it.prop([Schema.Int], ([value]) => expect(Number.isInteger(value)).toBe(true), {
  arbitrary: { runs: 5, seed: "data-last-property" },
})("data-last property callback");

// each

it.effect.each([1, 2, 3])("effect each %s", (n) =>
  Effect.acquireRelease(
    Effect.sync(() => expect(n).toEqual(n)),
    () => Effect.void
  )
);
it.live.each([1, 2, 3])("live each %s", (n) =>
  Effect.acquireRelease(
    Effect.sync(() => expect(n).toEqual(n)),
    () => Effect.void
  )
);

// skip

it.live.skip("live skipped", () => Effect.die("skipped anyway"));
it.effect.skip("effect skipped", () => Effect.die("skipped anyway"));

// skipIf

it.effect.skipIf(true)("effect skipIf (true)", () => Effect.die("skipped anyway"));
it.effect.skipIf(false)("effect skipIf (false)", () => Effect.sync(() => expect(1).toEqual(1)));

// runIf

it.effect.runIf(true)("effect runIf (true)", () => Effect.sync(() => expect(1).toEqual(1)));
it.effect.runIf(false)("effect runIf (false)", () => Effect.die("not run anyway"));

// chained helpers

it.describe.each(["foo", "bar"] as const)("describe.each %s", (text) => {
  it.effect("runs an Effect test", () =>
    Effect.sync(() => {
      assert.include(["foo", "bar"], text);
    })
  );
});

it.skip.each([1])("skip.each %s", () => assert.fail("skipped anyway"));

// The following test is expected to fail because it simulates a test timeout.
// The wrapper-managed timeout aborts the context's signal, so the Effect fiber
// is interrupted and its finalizers run — which is what the hook verifies.
it.live.fails(
  "interrupts on timeout",
  (ctx) =>
    Effect.gen(function* () {
      let acquired = false;

      ctx.onTestFailed(() => {
        if (acquired) {
          return Effect.logError("'effect is interrupted on timeout' @effect/bun-test test failed").pipe(
            Effect.runPromise
          );
        }
      });

      yield* Effect.acquireRelease(
        Effect.sync(() => (acquired = true)),
        () => Effect.sync(() => (acquired = false))
      );
      yield* Effect.sleep(1000);
    }),
  1
);

class Foo extends Context.Service<Foo, "foo">()($I`Foo`) {
  static layer = Layer.succeed(Foo)("foo");
}

class Bar extends Context.Service<Bar, "bar">()($I`Bar`) {
  static layer = Layer.effect(Bar)(Effect.map(Foo, () => "bar" as const));
}

class Sleeper extends Context.Service<
  Sleeper,
  {
    readonly sleep: (ms: number) => Effect.Effect<void>;
  }
>()($I`Sleeper`) {
  static readonly layer = Layer.effect(Sleeper)(
    Effect.gen(function* () {
      const clock = yield* Clock.Clock;

      return {
        sleep: Effect.fn("Sleeper.sleep")((ms: number) => clock.sleep(Duration.millis(ms))),
      };
    })
  );
}

describe("layer", () => {
  Foo.layer.pipe(layer())("data-last default options", (tests) => {
    tests.effect("provides the layer service", () =>
      Effect.gen(function* () {
        expect(yield* Foo).toBe("foo");
      })
    );
  });

  Foo.layer.pipe(layer({ excludeTestServices: true }))("data-last explicit options", (tests) => {
    tests.effect("provides the layer service", () =>
      Effect.gen(function* () {
        expect(yield* Foo).toBe("foo");
      })
    );
  });

  layer(Foo.layer)((it) => {
    it.effect("adds context", () =>
      Effect.gen(function* () {
        const foo = yield* Foo;
        expect(foo).toEqual("foo");
      })
    );

    it.layer(Bar.layer)("nested", (it) => {
      it.effect("adds context", () =>
        Effect.gen(function* () {
          const foo = yield* Foo;
          const bar = yield* Bar;
          expect(foo).toEqual("foo");
          expect(bar).toEqual("bar");
        })
      );
    });

    it.layer(Bar.layer)((it) => {
      it.effect("without name", () =>
        Effect.gen(function* () {
          const foo = yield* Foo;
          const bar = yield* Bar;
          expect(foo).toEqual("foo");
          expect(bar).toEqual("bar");
        })
      );
    });

    describe("release", () => {
      let released = false;

      class Scoped extends Context.Service<Scoped, "scoped">()($I`Scoped`) {
        static layer = Layer.effect(Scoped)(
          Effect.acquireRelease(Effect.succeed("scoped" as const), () => Effect.sync(() => (released = true)))
        );
      }

      it.layer(Scoped.layer)((it) => {
        it.effect("adds context", () =>
          Effect.gen(function* () {
            const foo = yield* Foo;
            const scoped = yield* Scoped;
            expect(foo).toEqual("foo");
            expect(scoped).toEqual("scoped");
          })
        );
      });

      // Registered after the layer block: Bun runs `afterAll` hooks in
      // registration order, so this must come after the layer's own release.
      afterAll(() => {
        expect(released).toEqual(true);
      });

      it.effect.prop(
        "adds context",
        [realNumber],
        ([num]) =>
          Effect.gen(function* () {
            const foo = yield* Foo;
            expect(foo).toEqual("foo");
            return num === num;
          }),
        { arbitrary: { runs: 200 } }
      );

      it.effect.prop(
        "adds context with a Schema property",
        [Schema.Int],
        ([value]) =>
          Effect.gen(function* () {
            const foo = yield* Foo;
            assert.strictEqual(foo, "foo");
            assert.isTrue(Number.isInteger(value));
          }),
        { arbitrary: { runs: 5, seed: "bun-test-arbitrary-layer" } }
      );
    });
  });

  layer(Sleeper.layer)("test services", (it) => {
    it.effect("TestClock", () =>
      Effect.gen(function* () {
        const sleeper = yield* Sleeper;
        const fiber = yield* Effect.forkChild(sleeper.sleep(100_000));
        yield* Effect.yieldNow;
        yield* TestClock.adjust(100_000);
        yield* Fiber.join(fiber);
      })
    );
  });

  layer(Foo.layer)("with a name", (it) => {
    describe("with a nested describe", () => {
      it.effect("adds context", () =>
        Effect.gen(function* () {
          const foo = yield* Foo;
          expect(foo).toEqual("foo");
        })
      );
    });
    it.effect("adds context", () =>
      Effect.gen(function* () {
        const foo = yield* Foo;
        expect(foo).toEqual("foo");
      })
    );
  });

  layer(Sleeper.layer, { excludeTestServices: true })("live services", (it) => {
    it.effect("Clock", () =>
      Effect.gen(function* () {
        const sleeper = yield* Sleeper;
        yield* sleeper.sleep(1);
      })
    );
  });
});

// property testing

it.prop(
  "schema with array",
  [Schema.String, Schema.Int],
  ([text, count]) => typeof text === "string" && Number.isInteger(count)
);

it.prop(
  "schema with object",
  { text: Schema.String, count: Schema.Int },
  ({ count, text }) => typeof text === "string" && Number.isInteger(count)
);

let mixedTupleRuns = 0;
let mixedRecordRuns = 0;
afterAll(() => {
  assert.strictEqual(mixedTupleRuns, 5);
  assert.strictEqual(mixedRecordRuns, 5);
});

it.prop(
  "Schema and Arbitrary with array",
  [Schema.Int, textArbitrary],
  ([count, text]) => {
    mixedTupleRuns++;
    assert.isTrue(Number.isInteger(count));
    assert.include(["a", "b"], text);
  },
  { arbitrary: { runs: 5, maxDiscards: 0, seed: "bun-test-mixed-tuple" } }
);

it.effect.prop(
  "Schema and Arbitrary with object",
  { count: Schema.Int, text: textArbitrary },
  ({ count, text }) =>
    Effect.sync(() => {
      mixedRecordRuns++;
      assert.isTrue(Number.isInteger(count));
      assert.include(["a", "b"], text);
    }),
  { arbitrary: { runs: 5, maxDiscards: 0, seed: "bun-test-mixed-record" } }
);

it.prop("symmetry", [realNumber, Schema.Int], ([a, b]) => a + b === b + a);

it.prop("symmetry with object", { a: realNumber, b: Schema.Int }, ({ a, b }) => a + b === b + a);

it.live.prop("schema with object", { value: Schema.Int }, ({ value }) =>
  Effect.sync(() => assert.isTrue(Number.isInteger(value)))
);

let arbitraryEffectRuns = 0;
afterAll(() => assert.strictEqual(arbitraryEffectRuns, 5));

it.effect.prop(
  "schema with Arbitrary options",
  [Schema.String, Schema.Int],
  ([text, count]) =>
    Effect.sync(() => {
      arbitraryEffectRuns++;
      assert.strictEqual(typeof text, "string");
      assert.isTrue(Number.isInteger(count));
    }),
  { arbitrary: { runs: 5, maxDiscards: 0, seed: "bun-test-arbitrary" } }
);

it.effect.prop("symmetry", [realNumber, Schema.Int], ([a, b]) =>
  Effect.gen(function* () {
    yield* Effect.void;
    assert.isTrue(a + b === b + a);
  })
);

it.effect.prop("symmetry with object", { a: realNumber, b: Schema.Int }, ({ a, b }) =>
  Effect.gen(function* () {
    yield* Effect.void;
    assert.strictEqual(a + b, b + a);
  })
);

it.effect.prop("should detect the substring", { a: Schema.String, b: Schema.String, c: Schema.String }, ({ a, b, c }) =>
  Effect.gen(function* () {
    yield* Effect.scope;
    assert.include(a + b + c, b);
  })
);

describe("property failures", () => {
  const Input = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 1_000 }));
  const pureDefectValues: Array<number> = [];
  const effectDefectValues: Array<number> = [];
  let interruptedRuns = 0;
  let timeoutPropertyStarted = false;
  let timeoutPropertyReleased = false;

  afterAll(() => {
    assert.deepStrictEqual(pureDefectValues, [8, 1]);
    assert.deepStrictEqual(effectDefectValues, [8, 1]);
    assert.strictEqual(interruptedRuns, 1);
    assert.isTrue(timeoutPropertyStarted);
    assert.isTrue(timeoutPropertyReleased);
  });

  it.prop(
    "shrinks synchronous defects",
    [Input],
    ([value]) => {
      pureDefectValues.push(value);
      throw new Error("property defect");
    },
    { fails: true, arbitrary: { runs: 1, seed: "assertion-shrink" } }
  );

  it.effect.prop(
    "shrinks Effect defects",
    [Input],
    ([value]) =>
      Effect.sync(() => {
        effectDefectValues.push(value);
        assert.strictEqual(value, 0);
      }),
    { fails: true, arbitrary: { runs: 1, seed: "assertion-shrink" } }
  );

  it.effect.prop(
    "preserves interruption",
    [Input],
    () => {
      interruptedRuns++;
      return Effect.interrupt;
    },
    { fails: true, arbitrary: { runs: 1, seed: "assertion-shrink" } }
  );

  it.effect.prop(
    "interrupts property checking on timeout",
    [Schema.Literal("value")],
    () =>
      Effect.acquireUseRelease(
        Effect.sync(() => {
          timeoutPropertyStarted = true;
        }),
        () => Effect.never,
        () =>
          Effect.sync(() => {
            timeoutPropertyReleased = true;
          })
      ),
    { fails: true, timeout: 10, arbitrary: { runs: 1, maxDiscards: 0, seed: "property-timeout" } }
  );
});
