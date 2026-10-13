import { assert, describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import { Audience } from "../../effected/env/Audience.ts";
import { EnvOverride } from "../../effected/env/EnvOverride.ts";

const accepts = { human: ["pretty"], agent: ["json"], ci: ["silent"] } as const;

describe("EnvOverride explicit provider absence", () => {
  it.effect("retains the upstream class constructor at runtime", () =>
    Effect.sync(() => {
      assert.strictEqual(typeof EnvOverride, "function");
      assert.strictEqual(Object.getPrototypeOf(Reflect.construct(EnvOverride, [])), EnvOverride.prototype);
    }));

  it.effect("an absent or preserved empty string is neither accepted nor rejected", () =>
    Effect.gen(function* () {
      for (const provider of [
        ConfigProvider.fromUnknown({}),
        ConfigProvider.fromUnknown({ MODE: "" }, { preserveEmptyStrings: true }),
      ]) {
        const result = yield* EnvOverride.readResult({ envVar: "MODE", accepts, source: provider });
        assertNone(result.accepted);
        assertNone(result.rejected);
      }
    }).pipe(Effect.provideService(Audience, { kind: "human", source: "override" })));
});
