import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
const runs = { arbitrary: fcRuns(100) };
import { Yaml } from "../../../effected/yaml/Yaml.ts";
import { SelectedDocument, PnpmStream, selectSoleDocument, splitPnpmStream } from "../../../effected/lockfiles/internal/documents.ts";
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(`${name}: encoding decodes without failure and preserves the value`, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assertTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};

roundTrips("SelectedDocument", SelectedDocument);
roundTrips("PnpmStream", PnpmStream);
it.effect.prop("document readers retain YAML values through idempotent rendering and reparsing", [Arbitrary.schema(S.Struct({ value: S.String }))], ([value]) => Effect.gen(function* () {
  const text = yield* Yaml.stringify(value);
  const selected = yield* selectSoleDocument(text);
  const stream = yield* splitPnpmStream(text);
  assert.deepStrictEqual(selected.document, value);
  assert.deepStrictEqual(stream.main, value);
  const canonical = yield* Yaml.stringify(selected.document);
  assert.strictEqual(yield* Yaml.stringify((yield* selectSoleDocument(canonical)).document), canonical);
  assert.deepStrictEqual(yield* selectSoleDocument(canonical), selected);
  assert.deepStrictEqual(yield* splitPnpmStream(canonical), stream);
}), runs);

it.effect.prop("two-document splitting retains both positions through rendering and reparsing", [Arbitrary.schema(S.Struct({ preamble: S.Struct({ env: S.String }), main: S.Struct({ value: S.String }) }))], ([sample]) => Effect.gen(function* () {
  const render = Effect.fnUntraced(function* (preamble: unknown, main: unknown) { return `${yield* Yaml.stringify(preamble)}\n---\n${yield* Yaml.stringify(main)}`; });
  const text = yield* render(sample.preamble, sample.main);
  const split = yield* splitPnpmStream(text);
  assert.deepStrictEqual(split, { ...sample, documents: 2 });
  const canonical = yield* render(split.preamble, split.main);
  assert.strictEqual(canonical, text);
  const reparsed = yield* splitPnpmStream(canonical);
  assert.deepStrictEqual(reparsed, split);
  assert.strictEqual(yield* render(reparsed.preamble, reparsed.main), canonical);
}), runs);
