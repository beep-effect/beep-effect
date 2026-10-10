import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as A from "effect/Array";
import { composeFirstDocument } from "../../../effected/yaml/internal/composer/document.ts";
import { renderDoubleQuoted, renderSingleQuoted, stringifyValue, stringifyDocument, stripNodeComments, StringifyFailure, StringifyDepthExceeded } from "../../../effected/yaml/internal/stringifier.ts";

const safeText = S.Array(S.Literals(["a", "b", " ", "'", "\\"])).pipe(Arbitrary.schema, Arbitrary.map(A.join("")));
const wordText = S.Array(S.Literals(["a", "b", "c"])).pipe(Arbitrary.schema, Arbitrary.map((chars) => `x${A.join(chars, "")}`));
const runs = { arbitrary: fcRuns(100) };
const read = (text: string) => {
  const doc = composeFirstDocument(text);
  assert.deepStrictEqual(doc.errors, []);
  return doc.contents?.toValue() ?? null;
};

describe("stringifier property floor", () => {
  it.effect.prop("StringifyFailure encoding decodes successfully and preserves both diagnostic fields", [Arbitrary.schema(StringifyFailure)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(StringifyFailure)(value);
    const decoded = yield* S.decodeEffect(StringifyFailure)(encoded);
    assert.isTrue(S.toEquivalence(StringifyFailure)(value, decoded));
  }), runs);
  it.effect.prop("StringifyDepthExceeded encoding decodes successfully and preserves the diagnostic", [Arbitrary.schema(StringifyDepthExceeded)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(StringifyDepthExceeded)(value);
    const decoded = yield* S.decodeEffect(StringifyDepthExceeded)(encoded);
    assert.isTrue(S.toEquivalence(StringifyDepthExceeded)(value, decoded));
  }), runs);
  it.effect.prop("stringifyValue is stable after parsing and preserves parsed JSON values", [Arbitrary.schema(S.Json)], ([value]) => Effect.sync(() => {
    const text = stringifyValue(value);
    const parsed = read(text);
    const formatted = stringifyValue(parsed);
    assert.strictEqual(stringifyValue(read(formatted)), formatted);
    assert.deepStrictEqual(read(formatted), parsed);
  }), runs);
  it.effect.prop("stringifyDocument is idempotent after composition and preserves values", [Arbitrary.schema(S.Json)], ([value]) => Effect.sync(() => {
    const input = stringifyValue(value);
    const doc = composeFirstDocument(input);
    const text = stringifyDocument(doc);
    assert.deepStrictEqual(read(text), read(input));
    assert.strictEqual(stringifyDocument(composeFirstDocument(text)), text);
  }), runs);
  it.effect.prop("double quoted rendering preserves strings and is stable after decoding in either mode", [Arbitrary.schema(S.String), Arbitrary.schema(S.Boolean)], ([value, canonical]) => Effect.gen(function* () {
    const text = renderDoubleQuoted(value, canonical);
    assert.strictEqual(read(text), value);
    const parsed = yield* S.decodeUnknownEffect(S.String)(read(text));
    assert.strictEqual(renderDoubleQuoted(parsed, canonical), text);
  }), runs);
  it.effect.prop("single quoted rendering preserves apostrophes and is stable after decoding", [safeText], ([value]) => Effect.gen(function* () {
    const text = renderSingleQuoted(value);
    const parsed = yield* S.decodeUnknownEffect(S.String)(read(text));
    assert.strictEqual(parsed, value);
    assert.strictEqual(renderSingleQuoted(parsed), text);
  }), runs);
  it.effect.prop("comment stripping is idempotent and preserves values while document rendering retains entry comments", [wordText], ([value]) => Effect.sync(() => {
    const input = `# header\nkey: '${value}' # tail\n`;
    const doc = composeFirstDocument(input);
    assert.strictEqual(stringifyDocument(doc), input);
    if (doc.contents === null) assert.fail("Expected a mapping");
    else {
      const stripped = stripNodeComments(doc.contents);
      assert.deepStrictEqual(stripNodeComments(stripped), stripped);
      assert.deepStrictEqual(stripped.toValue(), doc.contents.toValue());
      assert.strictEqual(stringifyDocument({ ...doc, contents: stripped }), `key: '${value}'\n`);
    }
  }), runs);
});
