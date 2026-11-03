import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Package } from "@beep/package-json/Package";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    name,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assert.isTrue(S.toEquivalence(schema)(decoded, value));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};

import { DevEngine, DevEngineOrArray, DevEnginesSchema } from "@beep/package-json/DevEngines";

describe("DevEngines property floor", () => {
  roundTrips("DevEngine", DevEngine);
  roundTrips("DevEngineOrArray", DevEngineOrArray);
  roundTrips("DevEnginesSchema", DevEnginesSchema);
});

// npm documents `warn`, `error` and `ignore`; `download` is the OpenJS
// devEngines proposal value pnpm implements (3-A2).
describe("DevEngine.onFail", () => {
  it.effect("accepts download, per the OpenJS devEngines proposal pnpm implements", () =>
    Effect.gen(function* () {
      const wire = { runtime: { name: "node", version: "^24.0.0", onFail: "download" as const } };
      const decoded = yield* S.decodeEffect(DevEnginesSchema)(wire);
      assertTrue(S.is(DevEngine)(decoded.runtime));
      const value2 = yield* S.encodeEffect(DevEnginesSchema)(decoded);
      deepStrictEqual(value2, wire);
      const devEngines = { packageManager: { name: "pnpm", onFail: "download" as const } };
      const pkg = yield* Package.decode({ name: "pkg", version: "1.0.0", devEngines });
      deepStrictEqual((yield* S.encodeUnknownEffect(Package.schema)(pkg)).devEngines, devEngines);
    })
  );

  it.effect("still rejects a value outside warn, error, ignore and download", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(S.decodeUnknownEffect(DevEngine)({ name: "node", onFail: "retry" }));
      strictEqual(error._tag, "SchemaError");
    })
  );
});
