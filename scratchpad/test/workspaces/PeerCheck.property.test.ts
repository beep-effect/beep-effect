import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { UnverifiedReason, PeerParent, UnsatisfiedPeer, PeerCheck } from "../../effected/workspaces/PeerCheck.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(`${name}: encoded values decode successfully to the original value`, [Arbitrary.schema(schema)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assert.isTrue(equivalent(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

describe("PeerCheck schema laws", () => {
  roundTrips("UnverifiedReason", UnverifiedReason);
  roundTrips("PeerParent", PeerParent);
  roundTrips("UnsatisfiedPeer", UnsatisfiedPeer);
  roundTrips("PeerCheck", PeerCheck);
});
