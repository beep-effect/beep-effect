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
import { assertSuccess } from "@effect/vitest/utils";
import { Yaml, YamlParseOptions, YamlStringifyOptions, YamlParseError, YamlStringifyError } from "../../effected/yaml/Yaml.ts";
const Value = S.Struct({ text: S.String, count: S.Int.check(S.isGreaterThanOrEqualTo(1)), enabled: S.Boolean, items: S.Array(S.String) });
const Single = Yaml.fromString().pipe(S.decodeTo(Value));
const Default = Yaml.YamlFromString.pipe(S.decodeTo(Value));
const All = Yaml.allFromString().pipe(S.decodeTo(S.NonEmptyArray(Value)));
describe("facade properties", () => {
  roundTrips("parse options", YamlParseOptions);
  roundTrips("stringify options", YamlStringifyOptions);
  roundTrips("parse errors", YamlParseError);
  roundTrips("stringify errors", YamlStringifyError);
  roundTrips("fromString on serializable domain", Single);
  roundTrips("YamlFromString on serializable domain", Default);
  roundTrips("allFromString on serializable domain", All);
  roundTrips("schema target", Yaml.schema(Value));
  it.effect.prop("bind directions and schema agree", [Arbitrary.schema(Value)], ([value]) => Effect.gen(function* () {
    const bound = Yaml.bind(Value);
    const text = yield* bound.encode(value);
    assert.deepStrictEqual(yield* bound.decode(text), value);
    assert.deepStrictEqual(yield* S.decodeEffect(bound.schema)(text), value);
  }), runs);
  it.effect.prop("single and stream parsers preserve values and canonical stringify is idempotent", [Arbitrary.schema(Value)], ([value]) => Effect.gen(function* () {
    const text = yield* Yaml.stringify(value);
    const input = `# header\n${text}# tail\n`;
    const parsed = yield* Yaml.parse(input);
    const canonical = yield* Yaml.stringify(parsed);
    assert.deepStrictEqual(parsed, value);
    assert.deepStrictEqual(yield* Yaml.parse(canonical), parsed);
    assert.strictEqual(yield* Yaml.stringify(yield* Yaml.parse(canonical)), canonical);
    assertSuccess(Yaml.parseResult(input), parsed);
    assertSuccess(Yaml.stringifyResult(parsed), canonical);
    const stream = `${input}---\n${text}`;
    const values = yield* Yaml.parseAll(stream);
    assert.deepStrictEqual(values, [value, value]);
    assertSuccess(Yaml.parseAllResult(stream), values);
    const rendered = yield* S.encodeEffect(All)([value, value]);
    assert.deepStrictEqual(yield* Yaml.parseAll(rendered), values);
    const stripped = Yaml.stripComments(input);
    assert.strictEqual(Yaml.stripComments(stripped), stripped);
    assert.deepStrictEqual(yield* Yaml.parse(stripped), value);
    assert.isTrue(Yaml.equals(input, canonical));
    assert.isTrue(Yaml.equalsValue(input, value));
  }), runs);
});
