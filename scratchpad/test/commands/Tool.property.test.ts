import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { ToolSource, MismatchPolicy, VersionFlag, VersionJson, VersionNone, VersionProbe, Tool } from "../../effected/commands/Tool.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(`${name}: decode(encode(x)) preserves x and never fails`, [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assert.isTrue(equivalent(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

describe("Tool schema property floor", () => {
  roundTrips("ToolSource", ToolSource);
  roundTrips("MismatchPolicy", MismatchPolicy);
  roundTrips("VersionFlag", VersionFlag);
  roundTrips("VersionJson", VersionJson);
  roundTrips("VersionNone", VersionNone);
  roundTrips("VersionProbe", VersionProbe);
  roundTrips("Tool", Tool);
});
