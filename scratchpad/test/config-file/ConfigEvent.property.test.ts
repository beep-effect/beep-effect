import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
import { ConfigSourceRef, ConfigEventPayload, ConfigEvent } from "../../effected/config-file/ConfigEvent.ts";

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(name + ": decoding an encoded value succeeds and recovers the value", [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assert.isTrue(S.toEquivalence(schema)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

describe("ConfigEvent schema properties", () => {
  roundTrips("ConfigSourceRef", ConfigSourceRef);
  roundTrips("ConfigEventPayload", ConfigEventPayload);
  roundTrips("ConfigEvent", ConfigEvent);
});
