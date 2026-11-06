import {
  CitationCleanerObject,
  CitationCleanerProduced,
  CitationCleanerRuntime,
  makeCitationCleanerPipeline,
} from "@beep/law-practice-server/internal/Citation/CleanerPipeline";
import { CitationPythonUnicodeStorage } from "@beep/law-practice-server/internal/Citation/PythonHash";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as O from "effect/Option";
import * as TestClock from "effect/testing/TestClock";
import { makeCitationCleanerRegistryHarness as setup } from "./CitationCleanerRegistry.fixtures.ts";

const original = CitationPythonUnicodeStorage.make({
  width: 2,
  bytes: new Uint8Array([61, 216, 0, 222, 95, 0, 95, 0, 65, 0]),
});
it.effect("bounds owned-value preflight with the captured cleaner deadline", () =>
  Effect.gen(function* () {
    const h = yield* setup();
    const value = yield* h.values.sourceUnicode(original);
    const entered = yield* Deferred.make<void>();
    const policy = yield* defaultCitationEnginePolicy;
    const runtime = CitationCleanerRuntime.of({
      ...h.registry.runtime,
      textUnits: Effect.fn("CleanerOwnedTest.blockingUnits")(() =>
        Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never))
      ),
    });
    const pipeline = yield* makeCitationCleanerPipeline({
      ...policy.limits,
      cleanDeadline: Duration.millis(50),
      operationDeadline: Duration.millis(100),
    }).pipe(Effect.provideService(CitationCleanerRuntime, runtime));
    const waiting = yield* pipeline.runOwned({ value, plan: "blocked-preflight" }).pipe(Effect.flip, Effect.forkChild);
    yield* Deferred.await(entered);
    yield* TestClock.adjust(Duration.millis(50));
    const failure = yield* Fiber.join(waiting);
    expect(failure).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "cleanDeadline" });
  })
);
it.effect("retains an issued native input's identity and literal surrogate points through an empty plan", () =>
  Effect.gen(function* () {
    const h = yield* setup();
    const value = yield* h.values.sourceUnicode(original);
    h.select([]);
    const invocation = h.pipeline.runOwned({ value, plan: "owned-empty" });
    const closed: Effect.Effect<Effect.Success<typeof invocation>, Effect.Error<typeof invocation>> = invocation;
    const result = yield* closed;
    expect(result.value).toBe(value);
    expect(result.producedTextUtf16).toBe(5);
    const native = yield* h.values.getUnicode(result.value);
    expect(O.getOrThrow(native).storage).toEqual(original);
    expect(O.getOrThrow(native).pythonLength).toBe(5);
    const work = yield* h.work;
    const snapshot = yield* work.snapshot;
    expect(snapshot.closed).toBe(true);
    const none = yield* h.values.retainHost(null);
    const unchanged = yield* h.pipeline.runOwned({ value: none, plan: "owned-none" });
    expect(unchanged.value).toBe(none);
    expect(unchanged.producedTextUtf16).toBe(0);
  })
);
it.effect("passes the original handle to captured callbacks and preserves native output through real builtins", () =>
  Effect.gen(function* () {
    const h = yield* setup();
    const value = yield* h.values.sourceUnicode(original);
    const callback = yield* h.values.retainHost("owned-callback");
    h.hooks({
      hash: () => Effect.succeed(123456789n),
      equal: () => Effect.succeed(false),
      callable: () => Effect.succeed(true),
      invoke: Effect.fnUntraced(function* (_fn, current, work) {
        expect(current).toBe(value);
        const charge = yield* work.reserveText(5);
        return CitationCleanerProduced.make({ value: current, charges: [charge] });
      }),
    });
    h.select([callback]);
    const retained = yield* h.pipeline.runOwned({ value, plan: "owned-callback" });
    expect(retained.value).toBe(value);
    const underscores = yield* h.values.text("underscores");
    h.select([underscores]);
    const cleaned = yield* h.pipeline.runOwned({ value, plan: "owned-builtin" });
    const output = yield* h.values.getUnicode(cleaned.value);
    expect(O.getOrThrow(output).storage).toEqual({
      width: 2,
      bytes: new Uint8Array([61, 216, 0, 222, 65, 0]),
    });
    expect(O.getOrThrow(output).pythonLength).toBe(3);
  })
);
it.effect("rejects forged handles and native source overflow before invoking a plan", () =>
  Effect.gen(function* () {
    const h = yield* setup();
    const value = yield* h.values.sourceUnicode(original);
    const forged = CitationCleanerObject.make({ slot: value.slot });
    const rejected = yield* h.pipeline.runOwned({ value: forged, plan: "forged" }).pipe(Effect.flip);
    expect(rejected).toMatchObject({ _tag: "CitationCleanerFailure", reason: "unissued-value" });
    const policy = yield* defaultCitationEnginePolicy;
    const tight = yield* makeCitationCleanerPipeline({ ...policy.limits, sourceUtf16: 1 }).pipe(
      Effect.provideService(CitationCleanerRuntime, h.registry.runtime)
    );
    const refused = yield* tight.runOwned({ value, plan: "too-large" }).pipe(Effect.flip);
    expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "sourceUtf16" });
    const calls = yield* h.calls;
    expect(calls).toEqual([]);
  })
);
