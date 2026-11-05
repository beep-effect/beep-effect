import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
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

import { Yaml, YamlParseError, YamlParseOptions, YamlStringifyError, YamlStringifyOptions } from "@beep/yaml/Yaml";
import { assertSuccess } from "@effect/vitest/utils";

const Value = S.Struct({
  text: S.String,
  count: S.Int.check(S.isGreaterThanOrEqualTo(1)),
  enabled: S.Boolean,
  items: S.Array(S.String),
});
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
  it.effect.prop(
    "bind directions and schema agree",
    [Arbitrary.schema(Value)],
    ([value]) =>
      Effect.gen(function* () {
        const bound = Yaml.bind(Value);
        const text = yield* bound.encode(value);
        const decoded2 = yield* bound.decode(text);
        assert.deepStrictEqual(decoded2, value);
        const value3 = yield* S.decodeEffect(bound.schema)(text);
        assert.deepStrictEqual(value3, value);
      }),
    runs
  );
  it.effect.prop(
    "single and stream parsers preserve values and canonical stringify is idempotent",
    [Arbitrary.schema(Value)],
    ([value]) =>
      Effect.gen(function* () {
        const text = yield* Yaml.stringify(value);
        const input = `# header\n${text}# tail\n`;
        const parsed = yield* Yaml.parse(input);
        const canonical = yield* Yaml.stringify(parsed);
        assert.deepStrictEqual(parsed, value);
        const parsed4 = yield* Yaml.parse(canonical);
        assert.deepStrictEqual(parsed4, parsed);
        const parsed7 = yield* Yaml.parse(canonical);
        const stringify5 = yield* Yaml.stringify(parsed7);
        assert.strictEqual(stringify5, canonical);
        assertSuccess(Yaml.parseResult(input), parsed);
        assertSuccess(Yaml.stringifyResult(parsed), canonical);
        const stream = `${input}---\n${text}`;
        const values = yield* Yaml.parseAll(stream);
        assert.deepStrictEqual(values, [value, value]);
        assertSuccess(Yaml.parseAllResult(stream), values);
        const rendered = yield* S.encodeEffect(All)([value, value]);
        const parsedAll = yield* Yaml.parseAll(rendered);
        assert.deepStrictEqual(parsedAll, values);
        const stripped = Yaml.stripComments(input);
        assert.strictEqual(Yaml.stripComments(stripped), stripped);
        const parsed6 = yield* Yaml.parse(stripped);
        assert.deepStrictEqual(parsed6, value);
        assert.isTrue(Yaml.equals(input, canonical));
        assert.isTrue(Yaml.equalsValue(input, value));
      }),
    runs
  );
});
