import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CatalogAssemblyError } from "../../effected/npm/CatalogAssemblyError.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(`${name}: decoding an encoded value succeeds and preserves it`, [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assertTrue(equivalent(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

describe("CatalogAssemblyError property floor", () => {
  roundTrips("CatalogAssemblyError", CatalogAssemblyError);

  it.effect.prop("source projection preserves path and cause and retains reasons only for hooks", [Arbitrary.schema(CatalogAssemblyError)], ([error]) =>
    Effect.sync(() => {
      const failure = error.failure;
      assert.strictEqual(failure.source, error.source);
      assert.strictEqual(failure.path, error.path);
      assert.strictEqual(failure.cause, error.cause);
      if (failure.source === "hooks") assert.strictEqual(failure.reason, error.reason);
      else assert.notProperty(failure, "reason");
    }), runs);
});
