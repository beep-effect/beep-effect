import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
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
        assertTrue(S.toEquivalence(schema)(decoded, value));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};

import { JsoncEdit } from "@beep/jsonc/JsoncEdit";
import {
  PackageJsonFormat,
  PackageJsonModifyError,
  PackageJsonSyntaxError,
} from "@beep/package-json/PackageJsonFormat";

const ObjectJson = S.Record(S.String, S.Json);
const Json = S.fromJsonString(S.Unknown);
const CustomJson = S.fromJsonString(S.Struct({ private: S.Boolean, custom: S.Json }));
const CustomTailJson = S.fromJsonString(S.Struct({ private: S.Boolean, custom: S.Json, tail: S.String }));
describe("formatting property floor", () => {
  roundTrips("PackageJsonSyntaxError", PackageJsonSyntaxError);
  roundTrips("PackageJsonModifyError", PackageJsonModifyError);
  it.effect.prop(
    "sortValue is idempotent and retains every value",
    [Arbitrary.schema(ObjectJson)],
    ([value]) =>
      Effect.sync(() => {
        const sorted = PackageJsonFormat.sortValue(value);
        assert.deepStrictEqual(PackageJsonFormat.sortValue(sorted), sorted);
        assert.deepStrictEqual(sorted, value);
      }),
    runs
  );
  it.effect.prop(
    "formatToString is idempotent and parse/stringify preserves JSON",
    [Arbitrary.schema(ObjectJson)],
    ([value]) =>
      Effect.gen(function* () {
        const text = yield* S.encodeEffect(Json)(value);
        const formatted = yield* Effect.fromResult(PackageJsonFormat.formatToString(text));
        const fromResult2 = yield* Effect.fromResult(PackageJsonFormat.formatToString(formatted));
        assert.strictEqual(fromResult2, formatted);
        const value3 = yield* S.decodeEffect(Json)(formatted);
        const value6 = yield* S.decodeEffect(Json)(text);
        assert.deepStrictEqual(value3, value6);
      }),
    runs
  );
  it.effect.prop(
    "surgical edits preserve surrounding bytes and are idempotent",
    [Arbitrary.schema(S.Union([S.String, S.Boolean, S.Null, S.Finite]))],
    ([value]) =>
      Effect.gen(function* () {
        const source = '{\r\n\t"private": true,\r\n\t"custom": null\r\n}\r\n';
        const encoded = yield* S.encodeEffect(Json)(value);
        // Built directly from the value: a replacement string would read `$&`
        // and friends in a generated string as substitution patterns.
        const expected = `{\r\n\t"private": true,\r\n\t"custom": ${encoded}\r\n}\r\n`;
        const edits = yield* PackageJsonFormat.modify(source, ["custom"], value);
        const text = yield* PackageJsonFormat.modifyToString(source, ["custom"], value);
        assert.strictEqual(text, JsoncEdit.applyAll(source, edits));
        assert.strictEqual(text, expected);
        const modifyToString4 = yield* PackageJsonFormat.modifyToString(text, ["custom"], value);
        assert.strictEqual(modifyToString4, text);
        const parsed = yield* S.decodeEffect(CustomJson)(text);
        assert.deepStrictEqual(parsed, {
          private: true,
          custom: yield* S.decodeEffect(Json)(encoded),
        });
      }),
    runs
  );
  it.effect.prop(
    "container edits preserve all bytes outside the replacement and parsed JSON fidelity",
    [Arbitrary.schema(S.Json)],
    ([value]) =>
      Effect.gen(function* () {
        const prefix = '{\n    "private" : true,\n    "custom": ';
        const suffix = ',\n    "tail" : "kept"\n}\n';
        const text = yield* PackageJsonFormat.modifyToString(`${prefix}null${suffix}`, ["custom"], value);
        assertTrue(Str.startsWith(prefix)(text));
        assertTrue(Str.endsWith(suffix)(text));
        const parsed = yield* S.decodeEffect(CustomTailJson)(text);
        const argument = S.decodeEffect(Json);
        const value2 = yield* S.encodeEffect(Json)(value);
        assert.deepStrictEqual(parsed, {
          private: true,
          custom: yield* argument(value2),
          tail: "kept",
        });
        const modifyToString5 = yield* PackageJsonFormat.modifyToString(text, ["custom"], value);
        assert.strictEqual(modifyToString5, text);
      }),
    runs
  );
  it.effect("a surgical edit writes replacement-pattern strings verbatim", () =>
    Effect.gen(function* () {
      const source = '{\r\n\t"private": true,\r\n\t"custom": null\r\n}\r\n';
      const value = "$&$`$'$$";
      const text = yield* PackageJsonFormat.modifyToString(source, ["custom"], value);
      assert.strictEqual(text, `{\r\n\t"private": true,\r\n\t"custom": "${value}"\r\n}\r\n`);
    })
  );
});
