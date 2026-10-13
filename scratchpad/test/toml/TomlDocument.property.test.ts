import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(name, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assertTrue(S.toEquivalence(schema)(value, decoded));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};
import { TomlDocument } from "../../effected/toml/TomlDocument.ts";
import { Toml, TomlParseError } from "../../effected/toml/Toml.ts";
const Sample = S.Struct({ title: S.String, count: S.Int.check(S.isBetween({ minimum: -1000000, maximum: 1000000 })), crlf: S.Boolean, duplicate: S.Boolean });
const codec = TomlDocument.schema();
const parsedDocuments = S.toType(codec).annotate({
  toCodecArbitrary: () => S.link<TomlDocument>()(
    Sample,
    { decode: SchemaGetter.transformEffect((sample: typeof Sample.Type) => Effect.gen(function* () {
      const eol = sample.crlf ? "\r\n" : "\n";
      const valueText = yield* Toml.stringify({ title: sample.title, count: sample.count });
      const text = `# retained comment${eol}${eol}${valueText.replaceAll("\n", eol)}${sample.duplicate ? `count = 2${eol}` : ""}# EOF`;
      return yield* TomlDocument.parse(text);
    }).pipe(Effect.orDie)), encode: SchemaGetter.forbiddenEncoding },
  ),
});
describe("lossless document laws", () => {
  roundTrips("document data schema", TomlDocument);
  // Class data may have arbitrary spans. The text codec's arbitrary uses parsed
  // documents so that spans tile the source, including comments and semantic errors.
  it.effect.prop("text codec decode(encode(x)) identity and total decoding", [Arbitrary.schema(parsedDocuments)], ([doc]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(codec)(doc);
    const decoded = yield* S.decodeEffect(codec)(encoded);
    assertTrue(S.toEquivalence(TomlDocument)(doc, decoded));
    assert.strictEqual(yield* S.encodeEffect(codec)(decoded), encoded);
  }), runs);
  it.effect.prop("document codec identity, source fidelity and stringify idempotence", [Arbitrary.schema(Sample)], ([sample]) => Effect.gen(function* () {
    const eol = sample.crlf ? "\r\n" : "\n";
    const valueText = yield* Toml.stringify({ title: sample.title, count: sample.count });
    const text = `# retained comment${eol}${eol}${valueText.replaceAll("\n", eol)}${sample.duplicate ? `count = 2${eol}` : ""}# EOF`;
    const doc = yield* TomlDocument.parse(text);
    const encoded = yield* S.encodeEffect(codec)(doc);
    const decoded = yield* S.decodeEffect(codec)(encoded);
    assertTrue(S.toEquivalence(TomlDocument)(doc, decoded));
    assert.strictEqual(encoded, text);
    assert.strictEqual(decoded.stringify(), text);
    assert.strictEqual((yield* TomlDocument.parse(decoded.stringify())).stringify(), doc.stringify());
    if (sample.duplicate) {
      assertFailure(yield* Effect.result(decoded.toValue()), TomlParseError.make({ diagnostics: doc.diagnostics }));
    } else {
      assert.deepStrictEqual(yield* decoded.toValue(), yield* Toml.parse(text));
      assert.deepStrictEqual(yield* Toml.parse(yield* Toml.stringify(yield* decoded.toValue())), yield* doc.toValue());
    }
  }), runs);
});
