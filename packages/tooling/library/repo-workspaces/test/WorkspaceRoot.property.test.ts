import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { FindWorkspaceRootOptions, WorkspaceRootNotFoundError } from "@beep/repo-workspaces/WorkspaceRoot";
import { assert, describe, it } from "@effect/vitest";
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

describe("WorkspaceRoot schema fidelity", () => {
  roundTrips("FindWorkspaceRootOptions: decode(encode(x)) equals x and never fails", FindWorkspaceRootOptions);
  roundTrips("WorkspaceRootNotFoundError: decode(encode(x)) equals x and never fails", WorkspaceRootNotFoundError);
});

it.effect("root options do not validate depth or materialize lazy defaults", () =>
  Effect.gen(function* () {
    const value2 = yield* S.decodeEffect(FindWorkspaceRootOptions)({});
    assert.deepStrictEqual(value2, FindWorkspaceRootOptions.make({}));
    for (const maxDepth of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const options = FindWorkspaceRootOptions.make({ maxDepth });
      const encoded = yield* S.encodeEffect(FindWorkspaceRootOptions)(options);
      const value3 = yield* S.decodeEffect(FindWorkspaceRootOptions)(encoded);
      assert.deepStrictEqual(value3, options);
    }
  })
);
