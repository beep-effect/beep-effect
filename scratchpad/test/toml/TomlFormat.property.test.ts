import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Toml } from "../../effected/toml/Toml.ts";
import { TomlDocument } from "../../effected/toml/TomlDocument.ts";
import { TomlEdit } from "../../effected/toml/TomlEdit.ts";
import { TomlFormat, TomlFormattingOptions, TomlModificationError } from "../../effected/toml/TomlFormat.ts";

const runs = { arbitrary: fcRuns(100) };
const Sample = S.Struct({ value: S.Int, next: S.Int, flag: S.Boolean, text: S.String });

describe("TomlFormat property floor", () => {
  it.effect.prop("formatting options encode and decode without loss", [Arbitrary.schema(TomlFormattingOptions)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(TomlFormattingOptions)(value);
      const decoded = yield* S.decodeEffect(TomlFormattingOptions)(encoded);
      assertTrue(S.toEquivalence(TomlFormattingOptions)(value, decoded));
    }), runs);

  it.effect.prop("modification errors encode and decode their diagnostic", [Arbitrary.schema(TomlModificationError)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(TomlModificationError)(value);
      const decoded = yield* S.decodeEffect(TomlModificationError)(encoded);
      assertTrue(S.toEquivalence(TomlModificationError)(value, decoded));
      assert.strictEqual(decoded.message, `TOML modification failed: ${value.diagnostic.code} ${value.diagnostic.message}`);
    }), runs);

  it.effect.prop("format is idempotent and preserves parsed values and multiline string bytes", [Arbitrary.schema(Sample), Arbitrary.schema(TomlFormattingOptions)], ([sample, options]) =>
    Effect.gen(function* () {
      const canonical = yield* Toml.stringify({ value: sample.value, flag: sample.flag, text: sample.text });
      const source = `  #keep\n${canonical}literal = '''\nuntouched  \nbytes\n'''\n`;
      const before = yield* Toml.parse(source);
      const formatted = TomlFormat.formatToString(source, undefined, options);
      assert.strictEqual(TomlEdit.applyAll(source, TomlFormat.format(source, undefined, options)), formatted);
      assert.strictEqual(TomlFormat.formatToString(formatted, undefined, options), formatted);
      assert.deepStrictEqual(TomlFormat.format(formatted, undefined, options), []);
      const after = yield* Toml.parse(formatted);
      assert.deepStrictEqual(after, before);
      assert.deepStrictEqual(yield* Toml.parse(yield* Toml.stringify(after)), before);
      assert.strictEqual((yield* TomlDocument.parse(source)).stringify(), source);
      assert.include(formatted, "'''\nuntouched  \nbytes\n'''");
      assert.include(formatted, "# keep");
    }), runs);

  it.effect.prop("modify is idempotent and preserves all bytes outside the replaced value", [Arbitrary.schema(Sample)], ([sample]) =>
    Effect.gen(function* () {
      const prefix = "# retain heading\nvalue = ";
      const suffix = " # retain tail\n\n[section]\nflag = true\n";
      const source = `${prefix}${sample.value}${suffix}`;
      const modified = yield* TomlFormat.modifyToString(source, ["value"], sample.next);
      assertTrue(Str.startsWith(prefix)(modified));
      assertTrue(Str.endsWith(suffix)(modified));
      assert.strictEqual(yield* TomlFormat.modifyToString(modified, ["value"], sample.next), modified);
      assert.strictEqual(TomlEdit.applyAll(source, yield* TomlFormat.modify(source, ["value"], sample.next)), modified);
      const parsed = yield* Toml.parse(modified);
      assert.deepStrictEqual(parsed, { value: sample.next, section: { flag: true } });
      assert.deepStrictEqual(yield* Toml.parse(yield* Toml.stringify(parsed)), parsed);
    }), runs);
});
