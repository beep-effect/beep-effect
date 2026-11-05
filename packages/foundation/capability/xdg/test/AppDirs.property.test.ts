import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import {
  AppDirKind,
  AppDirOverrides,
  AppDirsError,
  AppDirsNamespaceError,
  AppDirsOptions,
  ResolvedAppDirs,
} from "@beep/xdg/AppDirs";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(
    `${name}: decode(encode(x)) equals x and decoding never fails`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assertTrue(equivalent(decoded, value));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};

describe("AppDirs schema laws", () => {
  roundTrips("AppDirKind", AppDirKind);
  roundTrips("AppDirOverrides", AppDirOverrides);
  roundTrips("AppDirsOptions", AppDirsOptions);
  roundTrips("AppDirsNamespaceError", AppDirsNamespaceError);
  roundTrips("AppDirsError", AppDirsError);
  roundTrips("ResolvedAppDirs", ResolvedAppDirs);
});
