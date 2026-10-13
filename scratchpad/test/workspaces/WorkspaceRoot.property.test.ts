import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { FindWorkspaceRootOptions, WorkspaceRootNotFoundError } from "../../effected/workspaces/WorkspaceRoot.ts";

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
        assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
      }),
    runs,
  );
};

describe("WorkspaceRoot schema fidelity", () => {
  roundTrips("FindWorkspaceRootOptions: decode(encode(x)) equals x and never fails", FindWorkspaceRootOptions);
  roundTrips("WorkspaceRootNotFoundError: decode(encode(x)) equals x and never fails", WorkspaceRootNotFoundError);
});


it.effect("root options do not validate depth or materialize lazy defaults", () => Effect.gen(function* () {
  assert.deepStrictEqual(yield* S.decodeEffect(FindWorkspaceRootOptions)({}), {});
  for (const maxDepth of [0, -1, 1.5, NaN, Infinity, -Infinity]) {
    const options = { maxDepth };
    const encoded = yield* S.encodeEffect(FindWorkspaceRootOptions)(options);
    assert.deepStrictEqual(yield* S.decodeEffect(FindWorkspaceRootOptions)(encoded), options);
  }
}));
