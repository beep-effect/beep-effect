import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Public from "../../effected/toml/index.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(name, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assertTrue(S.toEquivalence(schema)(value, decoded));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};
describe("public barrel schema property floor", () => {
  roundTrips("TomlParseError encode/decode", Public.TomlParseError);
  roundTrips("TomlStringifyError encode/decode", Public.TomlStringifyError);
  roundTrips("TomlStringifyOptions encode/decode", Public.TomlStringifyOptions);
  roundTrips("TomlLocalDate encode/decode", Public.TomlLocalDate);
  roundTrips("TomlLocalDateTime encode/decode", Public.TomlLocalDateTime);
  roundTrips("TomlLocalTime encode/decode", Public.TomlLocalTime);
  roundTrips("TomlOffsetDateTime encode/decode", Public.TomlOffsetDateTime);
  roundTrips("TomlDiagnostic encode/decode", Public.TomlDiagnostic);
  roundTrips("TomlErrorCode encode/decode", Public.TomlErrorCode);
  roundTrips("TomlLexErrorCode encode/decode", Public.TomlLexErrorCode);
  roundTrips("TomlParseErrorCode encode/decode", Public.TomlParseErrorCode);
  roundTrips("TomlSemanticErrorCode encode/decode", Public.TomlSemanticErrorCode);
  roundTrips("TomlStringifyErrorCode encode/decode", Public.TomlStringifyErrorCode);
  roundTrips("TomlDocument encode/decode", Public.TomlDocument);
  roundTrips("TomlEdit encode/decode", Public.TomlEdit);
  roundTrips("TomlRange encode/decode", Public.TomlRange);
  roundTrips("TomlFormattingOptions encode/decode", Public.TomlFormattingOptions);
  roundTrips("TomlModificationError encode/decode", Public.TomlModificationError);
});
