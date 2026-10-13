import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
const runs = { arbitrary: fcRuns(100) };
const roundTrips = <A, I>(name: string, schema: S.Codec<A, I>): void => {
  it.effect.prop(`${name}: decode(encode(x)) equals x and never fails`, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assert.isTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};
import { GitHubTokenError } from "../../effected/github-actions/GitHubToken.ts";
describe("GitHubToken schema property floor", () => {
  roundTrips("GitHubTokenError", GitHubTokenError);
});
