import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { PackedTarball, PublishOutcome, DryRunOutcome, PackOptions, PublishOptions } from "../../effected/npm/PackagePublish.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(`${name}: decode(encode(x)) preserves x and never fails`, [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assertTrue(equivalent(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

describe("PackagePublish property floor", () => {
  roundTrips("PackedTarball", PackedTarball);
  roundTrips("PublishOutcome", PublishOutcome);
  roundTrips("DryRunOutcome", DryRunOutcome);
  roundTrips("PackOptions", PackOptions);
  roundTrips("PublishOptions", PublishOptions);
});
