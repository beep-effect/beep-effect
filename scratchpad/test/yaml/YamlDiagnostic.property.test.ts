import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(name, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assert.isTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};
import { YamlLexErrorCode, YamlParseErrorCode, YamlComposerErrorCode, YamlStringifyErrorCode, YamlModifyErrorCode, YamlErrorCode, YamlDiagnostic } from "../../effected/yaml/YamlDiagnostic.ts";
describe("diagnostic schema round trips", () => {
  roundTrips("lex codes", YamlLexErrorCode);
  roundTrips("parse codes", YamlParseErrorCode);
  roundTrips("composer codes", YamlComposerErrorCode);
  roundTrips("stringify codes", YamlStringifyErrorCode);
  roundTrips("modify codes", YamlModifyErrorCode);
  roundTrips("all codes", YamlErrorCode);
  roundTrips("diagnostics", YamlDiagnostic);
});
