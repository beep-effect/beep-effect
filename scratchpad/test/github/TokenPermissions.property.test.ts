import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as R from "effect/Record";
import { PermissionLevel, PermissionGap, ExtraPermission, PermissionResult, TokenPermissionError, TokenPermissions } from "../../effected/github/TokenPermissions.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(`${name} preserves values and encoded output through encode/decode`, [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assert.isTrue(S.toEquivalence(schema)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
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
it.effect.prop("permission normalization is idempotent and faithful through JSON, including own __proto__ grants", [Arbitrary.schema(GitHubPermissions)], ([permissions]) =>
  Effect.gen(function* () {
    const input = { ...permissions, ["__proto__"]: "admin", contents: "write" };
    const parsed = TokenPermissions.fromGitHub(input);
    assert.deepStrictEqual(parsed.granted, R.filter(input, S.is(PermissionLevel)));
    assert.deepStrictEqual(TokenPermissions.fromGitHub(parsed.granted).granted, parsed.granted);
    const json = S.fromJsonString(GitHubPermissions);
    const reparsed = TokenPermissions.fromGitHub(yield* S.decodeEffect(json)(yield* S.encodeEffect(json)(parsed.granted)));
    assert.isTrue(S.toEquivalence(TokenPermissions)(reparsed, parsed));
    assert.strictEqual(R.has(reparsed.granted, "__proto__"), true);
    assert.strictEqual(reparsed.granted["__proto__"], "admin");
  }), runs);
