import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Node from "../../effected/toml/TomlNode.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(name, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assertTrue(S.toEquivalence(schema)(value, decoded));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};
describe("CST schema property floor", () => {
  roundTrips("TomlKeyKind encode/decode", Node.TomlKeyKind);
  roundTrips("TomlKey encode/decode", Node.TomlKey);
  roundTrips("TomlStringStyle encode/decode", Node.TomlStringStyle);
  roundTrips("TomlString encode/decode", Node.TomlString);
  roundTrips("TomlInteger encode/decode", Node.TomlInteger);
  roundTrips("TomlFloat encode/decode", Node.TomlFloat);
  roundTrips("TomlFloat JSON codec", S.toCodecJson(Node.TomlFloat));
  roundTrips("TomlFloat string-tree codec", S.toCodecStringTree(Node.TomlFloat));
  roundTrips("TomlBoolean encode/decode", Node.TomlBoolean);
  roundTrips("TomlDateTimeLiteral encode/decode", Node.TomlDateTimeLiteral);
  roundTrips("TomlArray encode/decode", Node.TomlArray);
  roundTrips("TomlInlineEntry encode/decode", Node.TomlInlineEntry);
  roundTrips("TomlInlineTable encode/decode", Node.TomlInlineTable);
  roundTrips("TomlValueNode encode/decode", Node.TomlValueNode);
  roundTrips("TomlKeyValue encode/decode", Node.TomlKeyValue);
  roundTrips("TomlTableHeader encode/decode", Node.TomlTableHeader);
  roundTrips("TomlArrayTableHeader encode/decode", Node.TomlArrayTableHeader);
  roundTrips("TomlTrivia encode/decode", Node.TomlTrivia);
  roundTrips("TomlExpression encode/decode", Node.TomlExpression);
});
