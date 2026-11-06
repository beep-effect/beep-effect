import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    name,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assertTrue(S.toEquivalence(schema)(value, decoded));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};

import { Toml, TomlParseError } from "@beep/toml/Toml";
import { TomlDocument } from "@beep/toml/TomlDocument";

const Sample = S.Struct({
  title: S.String,
  count: S.Int.check(S.isBetween({ minimum: -1000000, maximum: 1000000 })),
  crlf: S.Boolean,
  duplicate: S.Boolean,
});
const codec = TomlDocument.schema();
const parsedDocuments = S.toType(codec).annotate({
  toCodecArbitrary: () =>
    S.link<TomlDocument>()(Sample, {
      decode: SchemaGetter.transformEffect((sample: typeof Sample.Type) =>
        Effect.gen(function* () {
          const eol = sample.crlf ? "\r\n" : "\n";
          const valueText = yield* Toml.stringify({ title: sample.title, count: sample.count });
          const text = `# retained comment${eol}${eol}${Str.replaceAll("\n", eol)(valueText)}${sample.duplicate ? `count = 2${eol}` : ""}# EOF`;
          return yield* TomlDocument.parse(text);
        }).pipe(Effect.orDie)
      ),
      encode: SchemaGetter.forbiddenEncoding,
    }),
});
describe("lossless document laws", () => {
  roundTrips("document data schema", TomlDocument);
  // Class data may have arbitrary spans. The text codec's arbitrary uses parsed
  // documents so that spans tile the source, including comments and semantic errors.
  it.effect.prop(
    "text codec decode(encode(x)) identity and total decoding",
    [Arbitrary.schema(parsedDocuments)],
    ([doc]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(codec)(doc);
        const decoded = yield* S.decodeEffect(codec)(encoded);
        assertTrue(S.toEquivalence(TomlDocument)(doc, decoded));
        const value2 = yield* S.encodeEffect(codec)(decoded);
        assert.strictEqual(value2, encoded);
      }),
    runs
  );
  it.effect.prop(
    "document codec identity, source fidelity and stringify idempotence",
    [Arbitrary.schema(Sample)],
    ([sample]) =>
      Effect.gen(function* () {
        const eol = sample.crlf ? "\r\n" : "\n";
        const valueText = yield* Toml.stringify({ title: sample.title, count: sample.count });
        const text = `# retained comment${eol}${eol}${Str.replaceAll("\n", eol)(valueText)}${sample.duplicate ? `count = 2${eol}` : ""}# EOF`;
        const doc = yield* TomlDocument.parse(text);
        const encoded = yield* S.encodeEffect(codec)(doc);
        const decoded = yield* S.decodeEffect(codec)(encoded);
        assertTrue(S.toEquivalence(TomlDocument)(doc, decoded));
        assert.strictEqual(encoded, text);
        assert.strictEqual(decoded.stringify(), text);
        assert.strictEqual((yield* TomlDocument.parse(decoded.stringify())).stringify(), doc.stringify());
        if (sample.duplicate) {
          const result3 = yield* Effect.result(decoded.toValue());
          assertFailure(result3, TomlParseError.make({ diagnostics: doc.diagnostics }));
        } else {
          const toValue4 = yield* decoded.toValue();
          const parsed6 = yield* Toml.parse(text);
          assert.deepStrictEqual(toValue4, parsed6);
          const toValue9 = yield* decoded.toValue();
          const stringify7 = yield* Toml.stringify(toValue9);
          const parsed5 = yield* Toml.parse(stringify7);
          const toValue8 = yield* doc.toValue();
          assert.deepStrictEqual(parsed5, toValue8);
        }
      }),
    runs
  );
});
