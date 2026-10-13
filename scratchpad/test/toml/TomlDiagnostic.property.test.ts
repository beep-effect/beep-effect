import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(name, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assertTrue(S.toEquivalence(schema)(value, decoded));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};
import * as D from "../../effected/toml/TomlDiagnostic.ts";
describe("diagnostic schema identity", () => {
  roundTrips("lex error codes", D.TomlLexErrorCode);
  roundTrips("parse error codes", D.TomlParseErrorCode);
  roundTrips("semantic error codes", D.TomlSemanticErrorCode);
  roundTrips("stringify error codes", D.TomlStringifyErrorCode);
  roundTrips("all error codes", D.TomlErrorCode);
  roundTrips("positioned diagnostics", D.TomlDiagnostic);
});
