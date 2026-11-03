import { RunOptions, RunResult, Sandbox } from "@beep/cli-kit/CliTest";
import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "Sandbox round-trips plain subprocess environments",
  [Arbitrary.schema(Sandbox)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(Sandbox)(value);
      const decoded = yield* S.decodeEffect(Sandbox)(encoded);
      assert.deepStrictEqual(decoded, value);
      const value1 = yield* S.encodeEffect(Sandbox)(decoded);
      assert.deepStrictEqual(value1, encoded);
    }),
  runs
);

it.effect.prop(
  "RunOptions round-trips and preserves optional-key presence",
  [Arbitrary.schema(RunOptions)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(RunOptions)(
        RunOptions.make({ ...value, sandbox: Sandbox.make(value.sandbox) })
      );
      const decoded = yield* S.decodeEffect(RunOptions)(encoded);
      assert.deepStrictEqual(decoded, value);
      const value2 = yield* S.encodeEffect(RunOptions)(decoded);
      assert.deepStrictEqual(value2, encoded);
      for (const key of ["cwd", "env", "stdin"]) {
        assert.strictEqual(P.hasProperty(decoded, key), P.hasProperty(value, key));
      }
    }),
  runs
);

it.effect.prop(
  "RunResult round-trips non-zero exits and captured streams",
  [Arbitrary.schema(RunResult)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(RunResult)(value);
      const decoded = yield* S.decodeEffect(RunResult)(encoded);
      assert.deepStrictEqual(decoded, value);
      const value3 = yield* S.encodeEffect(RunResult)(decoded);
      assert.deepStrictEqual(value3, encoded);
    }),
  runs
);

it.effect("RunOptions retains absent and empty overrides and rejects explicit undefined", () =>
  Effect.gen(function* () {
    const required = { sandbox: { root: "/tmp/cli", home: "/tmp/cli/home", env: {} }, execPath: "/usr/bin/node" };
    for (const value of [required, { ...required, cwd: "", env: {}, stdin: "" }]) {
      const encoded = yield* S.encodeEffect(RunOptions)(
        RunOptions.make({ ...value, sandbox: Sandbox.make(value.sandbox) })
      );
      const value4 = yield* S.decodeEffect(RunOptions)(encoded);
      assert.deepStrictEqual(value4, value);
    }
    // EF-40: a present key holding `undefined` is rejected.
    for (const key of ["cwd", "env", "stdin"]) {
      assertNone(S.decodeOption(RunOptions)({ ...required, [key]: undefined }));
    }
  })
);
