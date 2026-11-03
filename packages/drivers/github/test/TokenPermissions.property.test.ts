import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import {
  ExtraPermission,
  PermissionGap,
  PermissionLevel,
  PermissionResult,
  TokenPermissionError,
  TokenPermissions,
} from "@beep/github/TokenPermissions";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    `${name} preserves values and encoded output through encode/decode`,
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

describe("TokenPermissions schema property floor", () => {
  roundTrips("PermissionLevel", PermissionLevel);
  roundTrips("PermissionGap", PermissionGap);
  roundTrips("ExtraPermission", ExtraPermission);
  roundTrips("PermissionResult", PermissionResult);
  roundTrips("TokenPermissionError", TokenPermissionError);
  roundTrips("TokenPermissions", TokenPermissions);
});

const GitHubPermissions = S.Record(S.String, S.Union([PermissionLevel, S.String]));
it.effect.prop(
  "permission normalization is idempotent and faithful through JSON, including own __proto__ grants",
  [Arbitrary.schema(GitHubPermissions)],
  ([permissions]) =>
    Effect.gen(function* () {
      const input = { ...permissions, ["__proto__"]: "admin", contents: "write" };
      const parsed = TokenPermissions.fromGitHub(input);
      assert.deepStrictEqual(parsed.granted, R.filter(input, S.is(PermissionLevel)));
      assert.deepStrictEqual(TokenPermissions.fromGitHub(parsed.granted).granted, parsed.granted);
      const json = S.fromJsonString(GitHubPermissions);
      const argument = S.decodeEffect(json);
      const value3 = yield* S.encodeEffect(json)(parsed.granted);
      const value2 = yield* argument(value3);
      const reparsed = TokenPermissions.fromGitHub(value2);
      assert.isTrue(S.toEquivalence(TokenPermissions)(reparsed, parsed));
      assert.strictEqual(R.has(reparsed.granted, "__proto__"), true);
      assert.deepStrictEqual(R.get(reparsed.granted, "__proto__"), O.some("admin"));
    }),
  runs
);
