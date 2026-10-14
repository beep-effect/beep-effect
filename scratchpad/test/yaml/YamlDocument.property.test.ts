import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { parse } from "yaml";
const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(name, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assert.isTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};
import * as A from "effect/Array";
import { Yaml } from "../../effected/yaml/Yaml.ts";
import { YamlDirective, YamlDocument } from "../../effected/yaml/YamlDocument.ts";
const Value = S.Struct({ text: S.String, items: S.Array(S.Int.check(S.isGreaterThanOrEqualTo(1))) });
describe("document properties", () => {
  roundTrips("directives", YamlDirective);
  roundTrips("document model", YamlDocument);
  it.effect.prop("document codec and parsers preserve values, framing and comments with idempotent rendering", [Arbitrary.schema(Value)], ([value]) => Effect.gen(function* () {
    const input = `# header\n%YAML 1.2\n---\n${yield* Yaml.stringify(value)}...\n# tail\n`;
    const codec = YamlDocument.schema();
    const doc = yield* S.decodeEffect(codec)(input);
    const text = yield* S.encodeEffect(codec)(doc);
    const decoded = yield* S.decodeEffect(codec)(text);
    assert.deepStrictEqual(decoded.toValue(), doc.toValue());
    assert.deepStrictEqual(decoded.toValue(), value);
    assert.strictEqual(decoded.commentBefore, doc.commentBefore);
    assert.strictEqual(decoded.comment, doc.comment);
    assert.strictEqual(decoded.hasDocumentStart, true);
    assert.strictEqual(decoded.hasDocumentEnd, true);
    assert.strictEqual(yield* decoded.stringify(), text);
    const stream = yield* YamlDocument.parseAll(`${text}---\n${yield* Yaml.stringify(value)}`);
    assert.deepStrictEqual(A.map(stream, (entry) => entry.toValue()), [value, value]);
    const rendered = A.join(yield* Effect.forEach(stream, (entry) => entry.stringify()), "");
    assert.deepStrictEqual(A.map(yield* YamlDocument.parseAll(rendered), (entry) => entry.toValue()), [value, value]);
  }), runs);
  it.effect.prop("nested flow comment layouts preserve generated values in independent parsers", [
    Arbitrary.schema(S.Literals(["map-map", "map-seq", "seq-map", "seq-seq", "deep"])),
    Arbitrary.schema(S.Int.check(S.isGreaterThanOrEqualTo(1))),
    Arbitrary.schema(S.Boolean),
  ], ([shape, value, parentComment]) => Effect.gen(function* () {
    const child = shape === "map-map" || shape === "seq-map"
      ? `{a: ${value}, # inner\n b: 2}`
      : `[${value}, # inner\n 2]`;
    const tail = parentComment ? " # parent\n" : " ";
    const input = shape === "deep"
      ? `{outer: [{child: ${child}}],${tail}last: 3}\n`
      : Str.startsWith("map")(shape)
        ? `{outer: ${child},${tail}last: 3}\n`
        : `[${child},${tail}3]\n`;
    const doc = yield* YamlDocument.parse(input);
    const text = yield* doc.stringify();
    assert.deepStrictEqual(parse(text), parse(input));
    assert.deepStrictEqual(yield* Yaml.parse(text), yield* Yaml.parse(input));
    const decoded = yield* YamlDocument.parse(text);
    assert.deepStrictEqual(decoded.toValue(), doc.toValue());
    assert.strictEqual(yield* decoded.stringify(), text);
    assert.strictEqual(Str.split(text, "# inner").length, 2);
    if (parentComment) {
      assert.strictEqual(Str.split(text, "# parent").length, 2);
      assert.match(text, /[\]}], # parent\n/);
    }
  }), runs);

});
