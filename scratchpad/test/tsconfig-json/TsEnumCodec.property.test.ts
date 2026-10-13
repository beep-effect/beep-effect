import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { ProgrammaticCompilerOptions } from "../../effected/tsconfig-json/TsEnumCodec.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(`${name}: encoding decodes successfully to an equivalent value`, [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assertTrue(equivalent(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

describe("TsEnumCodec property floor", () => {
  roundTrips("ProgrammaticCompilerOptions", ProgrammaticCompilerOptions);
});

import { CompilerOptions } from "../../effected/tsconfig-json/CompilerOptions.ts";
import { TsEnumCodec } from "../../effected/tsconfig-json/TsEnumCodec.ts";

it.effect.prop("compiler enum conversion preserves numeric semantics and stabilizes", [Arbitrary.schema(CompilerOptions)], ([value]) =>
  Effect.gen(function* () {
    const encoded = TsEnumCodec.encodeCompilerOptions(value);
    const decoded = yield* S.decodeEffect(CompilerOptions)(TsEnumCodec.decodeCompilerOptions(encoded));
    assert.deepStrictEqual(TsEnumCodec.encodeCompilerOptions(decoded), encoded);
    assert.deepStrictEqual(TsEnumCodec.decodeCompilerOptions(TsEnumCodec.encodeCompilerOptions(decoded)), decoded);
  }), runs);

it.effect.prop("library file rendering parses back to the normalized reference and stabilizes", [Arbitrary.schema(S.String)], ([value]) =>
  Effect.gen(function* () {
    const parsed = TsEnumCodec.normalizeLibReference(value);
    const formatted = `lib.${parsed}.d.ts`;
    assert.strictEqual(TsEnumCodec.normalizeLibReference(formatted), parsed);
    assert.strictEqual(`lib.${TsEnumCodec.normalizeLibReference(formatted)}.d.ts`, formatted);
  }), runs);
