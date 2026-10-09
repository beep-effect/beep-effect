import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { RegistryTarget, PublishedVersion, PublishTime, RegistryReadError, SeededVersion, RegistrySeed } from "../../effected/npm/NpmRegistry.ts";

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

describe("NpmRegistry property floor", () => {
  roundTrips("RegistryTarget", RegistryTarget);
  roundTrips("PublishedVersion", PublishedVersion);
  roundTrips("PublishTime", PublishTime);
  roundTrips("RegistryReadError", RegistryReadError);
  roundTrips("SeededVersion", SeededVersion);
  roundTrips("RegistrySeed", RegistrySeed);
});
