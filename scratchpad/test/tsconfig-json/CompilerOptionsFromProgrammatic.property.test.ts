import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CompilerOptionsFromProgrammatic, ProgrammaticRecord } from "../../effected/tsconfig-json/CompilerOptionsFromProgrammatic.ts";

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

describe("CompilerOptionsFromProgrammatic property floor", () => {
  roundTrips("ProgrammaticRecord", ProgrammaticRecord);
});

it.effect.prop("numeric codec preserves compiler semantics, including enum aliases", [Arbitrary.schema(CompilerOptionsFromProgrammatic)], ([value]) =>
  Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(CompilerOptionsFromProgrammatic)(value);
    const decoded = yield* S.decodeEffect(CompilerOptionsFromProgrammatic)(encoded);
    // es6/es2015 and node/node10 have the same numeric meaning.
    assert.deepStrictEqual(TsEnumCodec.encodeCompilerOptions(decoded), TsEnumCodec.encodeCompilerOptions(value));
    assert.deepStrictEqual(yield* S.encodeEffect(CompilerOptionsFromProgrammatic)(decoded), encoded);
  }), runs);

import { TsEnumCodec } from "../../effected/tsconfig-json/TsEnumCodec.ts";
