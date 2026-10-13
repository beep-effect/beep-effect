import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(name, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assertTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};
import { PackageJsonFormat, PackageJsonModifyError, PackageJsonSyntaxError } from "../../effected/package-json/PackageJsonFormat.ts";
import { JsoncEdit } from "../../effected/jsonc/JsoncEdit.ts";
const ObjectJson = S.Record(S.String, S.Json);
const Json = S.fromJsonString(S.Unknown);
const CustomJson = S.fromJsonString(S.Struct({ private: S.Boolean, custom: S.Json }));
const CustomTailJson = S.fromJsonString(S.Struct({ private: S.Boolean, custom: S.Json, tail: S.String }));
describe("formatting property floor", () => {
  roundTrips("PackageJsonSyntaxError", PackageJsonSyntaxError);
  roundTrips("PackageJsonModifyError", PackageJsonModifyError);
  it.effect.prop("sortValue is idempotent and retains every value", [Arbitrary.schema(ObjectJson)], ([value]) => Effect.sync(() => {
    const sorted = PackageJsonFormat.sortValue(value);
    assert.deepStrictEqual(PackageJsonFormat.sortValue(sorted), sorted);
    assert.deepStrictEqual(sorted, value);
  }), runs);
  it.effect.prop("formatToString is idempotent and parse/stringify preserves JSON", [Arbitrary.schema(ObjectJson)], ([value]) => Effect.gen(function* () {
    const text = yield* S.encodeEffect(Json)(value);
    const formatted = yield* Effect.fromResult(PackageJsonFormat.formatToString(text));
    assert.strictEqual(yield* Effect.fromResult(PackageJsonFormat.formatToString(formatted)), formatted);
    assert.deepStrictEqual(yield* S.decodeEffect(Json)(formatted), yield* S.decodeEffect(Json)(text));
  }), runs);
  it.effect.prop("surgical edits preserve surrounding bytes and are idempotent", [Arbitrary.schema(S.Union([S.String, S.Boolean, S.Null, S.Finite]))], ([value]) => Effect.gen(function* () {
    const source = '{\r\n\t"private": true,\r\n\t"custom": null\r\n}\r\n';
    const expected = source.replace("null", yield* S.encodeEffect(Json)(value));
    const edits = yield* PackageJsonFormat.modify(source, ["custom"], value);
    const text = yield* PackageJsonFormat.modifyToString(source, ["custom"], value);
    assert.strictEqual(text, JsoncEdit.applyAll(source, edits));
    assert.strictEqual(text, expected);
    assert.strictEqual(yield* PackageJsonFormat.modifyToString(text, ["custom"], value), text);
    const parsed = yield* S.decodeEffect(CustomJson)(text);
    assert.deepStrictEqual(parsed, { private: true, custom: yield* S.decodeEffect(Json)(yield* S.encodeEffect(Json)(value)) });
  }), runs);
  it.effect.prop("container edits preserve all bytes outside the replacement and parsed JSON fidelity", [Arbitrary.schema(S.Json)], ([value]) => Effect.gen(function* () {
    const prefix = '{\n    "private" : true,\n    "custom": ';
    const suffix = ',\n    "tail" : "kept"\n}\n';
    const text = yield* PackageJsonFormat.modifyToString(`${prefix}null${suffix}`, ["custom"], value);
    assertTrue(text.startsWith(prefix));
    assertTrue(text.endsWith(suffix));
    const parsed = yield* S.decodeEffect(CustomTailJson)(text);
    assert.deepStrictEqual(parsed, { private: true, custom: yield* S.decodeEffect(Json)(yield* S.encodeEffect(Json)(value)), tail: "kept" });
    assert.strictEqual(yield* PackageJsonFormat.modifyToString(text, ["custom"], value), text);
  }), runs);
});
