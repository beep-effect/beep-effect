import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ConfigDependencySpec } from "../../effected/workspaces/ConfigDependencySpec.ts";

it.effect("version failures explain the exact-version requirement", () => Effect.gen(function* () {
  const failure = yield* Effect.flip(ConfigDependencySpec.parse("latest"));
  assert.strictEqual(failure.input, "latest");
  assert.strictEqual(failure.reason, "version");
  assert.include(failure.message, "version must be an exact SemVer version");
}));
