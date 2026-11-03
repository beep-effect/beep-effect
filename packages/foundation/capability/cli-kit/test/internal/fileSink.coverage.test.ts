import { Level } from "@beep/cli-kit/internal/diagnostics";
import { makeFileSink } from "@beep/cli-kit/internal/fileSink";
import { MemoryFileSystem } from "@beep/memfs";
import { assert, it } from "@effect/vitest";
import { assertExitSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as Scope from "effect/Scope";

const unprintableDefects = [
  {
    name: "throwing toString",
    defect: {
      toString() {
        throw new Error("conversion exploded");
      },
    },
  },
  {
    name: "throwing message getter",
    defect: Object.defineProperty(new Error("disk gone"), "message", {
      get() {
        throw new Error("message access exploded");
      },
    }),
  },
];

for (const { name, defect } of unprintableDefects) {
  it.effect(`a ${name} warns once, disables appends and closes its scope successfully`, () =>
    Effect.gen(function* () {
      const errors: Array<string> = [];
      let appends = 0;
      const capture: Console.Console = {
        ...console,
        error: (...parts: ReadonlyArray<unknown>) => {
          errors.push(pipe(parts, A.map(String), A.join(" ")));
        },
      };
      const handle = MemoryFileSystem.makeSync(
        {},
        {
          faults: {
            writeFileString: () => {
              appends++;
              return Effect.die(defect);
            },
          },
        }
      );
      const context = yield* Layer.build(handle.layer);
      const scope = yield* Scope.make();
      yield* Effect.gen(function* () {
        const sink = yield* makeFileSink("/logs/a.ndjson", "Info", () => false).pipe(
          Effect.provideService(Scope.Scope, scope)
        );
        const logging = yield* Layer.build(Logger.layer([sink]));
        yield* Effect.logInfo("first").pipe(Effect.provideContext(logging), Effect.provideService(Level, "Info"));
        for (let i = 0; i < 100; i++) yield* Effect.yieldNow;
        assert.deepStrictEqual(errors, [
          "diagnostics log file /logs/a.ndjson failed: unprintable filesystem error; further file logging disabled",
        ]);
        yield* Effect.logInfo("later").pipe(Effect.provideContext(logging), Effect.provideService(Level, "Info"));
        const exit1 = yield* Effect.exit(Scope.close(scope, Exit.void));
        assertExitSuccess(exit1, undefined);
      }).pipe(
        Effect.provideContext(context),
        Effect.provideService(Console.Console, capture),
        Effect.ensuring(Scope.close(scope, Exit.void))
      );
      assert.strictEqual(appends, 1);
      assert.lengthOf(errors, 1);
      assert.isFalse(handle.volume.has("/logs/a.ndjson"));
    })
  );
}
it.effect("a non-Error filesystem defect is printed once and disables later appends", () =>
  Effect.gen(function* () {
    const errors: Array<string> = [];
    const capture: Console.Console = {
      ...console,
      error: (...parts: ReadonlyArray<unknown>) => {
        errors.push(pipe(parts, A.map(String), A.join(" ")));
      },
    };
    const handle = MemoryFileSystem.makeSync({}, { faults: { writeFileString: MemoryFileSystem.die("disk gone") } });
    const context = yield* Layer.build(handle.layer);
    const scope = yield* Scope.make();
    yield* Effect.gen(function* () {
      const sink = yield* makeFileSink("/logs/a.ndjson", "Info", () => false).pipe(
        Effect.provideService(Scope.Scope, scope)
      );
      const logging = yield* Layer.build(Logger.layer([sink]));
      yield* Effect.logInfo("first").pipe(Effect.provideContext(logging), Effect.provideService(Level, "Info"));
      for (let i = 0; i < 100; i++) yield* Effect.yieldNow;
      yield* Effect.logInfo("later").pipe(Effect.provideContext(logging), Effect.provideService(Level, "Info"));
      yield* Scope.close(scope, Exit.void);
    }).pipe(
      Effect.provideContext(context),
      Effect.provideService(Console.Console, capture),
      Effect.ensuring(Scope.close(scope, Exit.void))
    );
    assert.deepStrictEqual(errors, [
      "diagnostics log file /logs/a.ndjson failed: disk gone; further file logging disabled",
    ]);
    assert.strictEqual(handle.volume.has("/logs/a.ndjson"), false);
  })
);
