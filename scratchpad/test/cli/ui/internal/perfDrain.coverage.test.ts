import { assert, it, vi } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import { drainPerformance, resolveDrain } from "../../../../effected/cli/ui/internal/perfDrain.ts";
it.effect("invalid environment configuration safely enables automatic draining", () => Effect.gen(function* () {
  assert.isTrue(yield* resolveDrain("auto").pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ NODE_ENV: {} }))));
}));
it.effect("draining tolerates runtimes without performance or clearMeasures", () => Effect.sync(() => {
  vi.stubGlobal("performance", undefined);
  try { assert.doesNotThrow(() => drainPerformance(true)); } finally { vi.unstubAllGlobals(); }
  vi.stubGlobal("performance", {});
  try { assert.doesNotThrow(() => drainPerformance(true)); } finally { vi.unstubAllGlobals(); }
}));

it.effect("an unavailable configuration source falls back to draining", () => Effect.gen(function* () {
  const paths: Array<ConfigProvider.Path> = [];
  const provider = ConfigProvider.make((path) => {
    paths.push(path);
    return Effect.fail(new ConfigProvider.SourceError({ message: "configuration unavailable" }));
  });
  assert.isTrue(yield* resolveDrain("auto").pipe(Effect.provideService(ConfigProvider.ConfigProvider, provider)));
  assert.isAbove(paths.length, 0);
}));
