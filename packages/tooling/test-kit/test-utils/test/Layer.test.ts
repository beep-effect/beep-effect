import { it } from "@beep/test-runner";
import { provideScopedLayer } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import { Cause, Context, Deferred, Effect, Fiber, Layer, Ref } from "effect";

class ExampleService extends Context.Service<ExampleService, { readonly value: string }>()(
  "@beep/test-utils/test/Layer.test/ExampleService"
) {}

describe("layer test helpers", () => {
  it.effect(
    "provides a layer for a scoped assertion body",
    Effect.fnUntraced(function* () {
      const released = yield* Ref.make(false);
      const value = yield* Effect.gen(function* () {
        yield* Effect.acquireRelease(Effect.void, () => Ref.set(released, true));
        return (yield* ExampleService).value;
      }).pipe(provideScopedLayer(Layer.succeed(ExampleService, ExampleService.of({ value: "scoped" }))));

      expect(value).toBe("scoped");
      expect(yield* Ref.get(released)).toBe(true);
    })
  );
  it.effect("releases scoped assertion resources when the body fails", () =>
    Effect.gen(function* () {
      const released = yield* Ref.make(false);
      const exit = yield* Effect.gen(function* () {
        yield* Effect.acquireRelease(Effect.void, () => Ref.set(released, true));
        return yield* Effect.fail("assertion body failure");
      }).pipe(provideScopedLayer(Layer.succeed(ExampleService, ExampleService.of({ value: "scoped" }))), Effect.exit);
      assertExitFailure(exit, Cause.fail("assertion body failure"));
      expect(yield* Ref.get(released)).toBe(true);
    })
  );

  it.effect("releases scoped assertion resources when the body is interrupted", () =>
    Effect.gen(function* () {
      const released = yield* Ref.make(false);
      const acquired = yield* Deferred.make<void>();
      const fiber = yield* Effect.gen(function* () {
        yield* Effect.acquireRelease(Effect.void, () => Ref.set(released, true));
        yield* Deferred.succeed(acquired, undefined);
        return yield* Effect.never;
      }).pipe(
        provideScopedLayer(Layer.succeed(ExampleService, ExampleService.of({ value: "scoped" }))),
        Effect.forkChild
      );
      yield* Deferred.await(acquired);
      yield* Fiber.interrupt(fiber);
      expect(yield* Ref.get(released)).toBe(true);
    })
  );
});
