import * as Main from "@beep/runtime-env";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as Str from "effect/String";

describe("the @beep/runtime-env entrypoint", () => {
  it.effect("exports exactly the public runtime surface", () =>
    Effect.sync(() => {
      assert.deepStrictEqual(A.sort(R.keys(Main), Str.Order), [
        "AgentEnvKey",
        "Audience",
        "CurrentRuntimeEnv",
        "EnvOverride",
        "RuntimeEnv",
        "TerminalEnv",
      ]);
    })
  );
});
