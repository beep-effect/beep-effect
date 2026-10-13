import { it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { CurrentRuntimeEnv } from "../../effected/env/RuntimeEnv.ts";

it.layer(CurrentRuntimeEnv.layerTest(), { timeout: "30 seconds" })("CurrentRuntimeEnv default test layer", (it) => {
  it.effect("omitting overrides produces an entirely absent snapshot", () =>
    Effect.gen(function* () {
      const env = yield* CurrentRuntimeEnv;
      assertNone(env.agent);
      assertNone(env.ci);
      assertNone(env.terminal);
    }));
});
