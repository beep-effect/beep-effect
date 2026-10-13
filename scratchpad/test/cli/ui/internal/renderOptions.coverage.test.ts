import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { UiRenderOptions } from "../../../../effected/cli/ui/internal/renderOptions.ts";
it.effect("render overrides are empty by default and supplied options retain identity", () => Effect.gen(function* () {
  assert.deepStrictEqual(yield* UiRenderOptions, {});
  const overrides = { debug: true, maxFps: 120 };
  assert.strictEqual(yield* UiRenderOptions.pipe(Effect.provideService(UiRenderOptions, overrides)), overrides);
  assert.deepStrictEqual(yield* UiRenderOptions, {});
}));
