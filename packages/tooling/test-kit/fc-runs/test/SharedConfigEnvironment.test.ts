// The shared Vitest configuration runs inside a worker whenever a test imports it, and it must read
// the environment without building Effect's default ConfigProvider, which is built once, from the
// environment at its first use: a test that stubs a variable afterwards would read the old value.
import { describe, expect, it, vi } from "@effect/vitest";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";

const SHARED = new URL("../../../../../vitest.shared.ts", import.meta.url);

describe("the shared configuration's environment reads", () => {
  it.effect("leave a variable stubbed after the import visible to the default provider", () =>
    Effect.gen(function* () {
      yield* Effect.promise(() => import(SHARED.href));
      vi.stubEnv("BEEP_SHARED_CONFIG_PROBE", "stubbed after the import");
      const read = yield* Config.String("BEEP_SHARED_CONFIG_PROBE").pipe(
        Effect.ensuring(Effect.sync(() => vi.unstubAllEnvs()))
      );
      expect(read).toBe("stubbed after the import");
    })
  );

  // A new read would add a Config call or a runSync outside the one helper, and fail here.
  it.effect.each(["vitest.shared.ts", "vitest.setup.ts"])("go through one read with its own provider in %s", (name) =>
    Effect.gen(function* () {
      const source = yield* Effect.promise(() => Bun.file(new URL(`../../../../../${name}`, import.meta.url)).text());
      const count = (pattern: RegExp) => Str.split(source, pattern).length - 1;
      expect([
        count(/\bConfig\.(?:String|Int|Number|Boolean|NonEmptyString|schema)\(/),
        count(/\bEffect\.runSync\b/),
        count(/Effect\.provideService\(ConfigProvider\.ConfigProvider, /),
      ]).toEqual([1, 1, 1]);
    })
  );
});
