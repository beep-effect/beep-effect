import { provideScopedLayer } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Context, Effect, Layer } from "effect";

class ExampleService extends Context.Service<ExampleService, { readonly value: string }>()("ExampleService") {}

describe("layer test helpers", () => {
  it.effect(
    "provides a layer for a scoped assertion body",
    Effect.fnUntraced(function* () {
      const value = yield* Effect.gen(function* () {
        return (yield* ExampleService).value;
      }).pipe(provideScopedLayer(Layer.succeed(ExampleService, ExampleService.of({ value: "scoped" }))));

      expect(value).toBe("scoped");
    })
  );
});
