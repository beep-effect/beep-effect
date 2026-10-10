import { assert, it } from "@effect/vitest";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Scope from "effect/Scope";
import * as Exit from "effect/Exit";
import * as Logger from "effect/Logger";
import { MemoryFileSystem } from "../../../effected/memfs/index.ts";
import { Level } from "../../../effected/cli/internal/diagnostics.ts";
import { makeFileSink } from "../../../effected/cli/internal/fileSink.ts";
it.effect("a non-Error filesystem defect is printed once and disables later appends", () => Effect.gen(function* () {
  const errors: Array<string> = [];
  const capture: Console.Console = { ...console, error: (...parts: ReadonlyArray<unknown>) => { errors.push(parts.map(String).join(" ")); } };
  const handle = MemoryFileSystem.makeSync({}, { faults: { writeFileString: MemoryFileSystem.die("disk gone") } });
  const context = yield* Layer.build(handle.layer);
  const scope = yield* Scope.make();
  yield* Effect.gen(function* () {
    const sink = yield* makeFileSink("/logs/a.ndjson", "Info", () => false).pipe(Effect.provideService(Scope.Scope, scope));
    const logging = yield* Layer.build(Logger.layer([sink]));
    yield* Effect.logInfo("first").pipe(Effect.provideContext(logging), Effect.provideService(Level, "Info"));
    for (let i = 0; i < 100; i++) yield* Effect.yieldNow;
    yield* Effect.logInfo("later").pipe(Effect.provideContext(logging), Effect.provideService(Level, "Info"));
    yield* Scope.close(scope, Exit.void);
  }).pipe(Effect.provideContext(context), Effect.provideService(Console.Console, capture), Effect.ensuring(Scope.close(scope, Exit.void)));
  assert.deepStrictEqual(errors, ["diagnostics log file /logs/a.ndjson failed: disk gone; further file logging disabled"]);
  assert.strictEqual(handle.volume.has("/logs/a.ndjson"), false);
}));
