import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { PortableTsconfig, PortableTsconfigOptions } from "../../effected/tsconfig-json/PortableTsconfig.ts";

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

describe("PortableTsconfig property floor", () => {
  roundTrips("PortableTsconfig", PortableTsconfig);
  roundTrips("PortableTsconfigOptions", PortableTsconfigOptions);
});

import { CompilerOptions } from "../../effected/tsconfig-json/CompilerOptions.ts";

it.effect.prop("portable projection is stable, forces virtual-environment flags and drops machine paths", [Arbitrary.schema(CompilerOptions)], ([value]) =>
  Effect.gen(function* () {
    const portable = PortableTsconfig.make(value, { includeTypes: true });
    assert.deepStrictEqual(PortableTsconfig.make(portable.compilerOptions, { includeTypes: true }), portable);
    assertTrue(S.is(PortableTsconfig)(portable));
    const encoded = yield* S.encodeEffect(PortableTsconfig)(portable);
    assert.deepStrictEqual(encoded, portable);
    assert.deepStrictEqual(yield* S.decodeEffect(PortableTsconfig)(encoded), portable);
    assert.strictEqual(portable.compilerOptions.noEmit, true);
    assert.strictEqual(portable.compilerOptions.composite, false);
    assert.isFalse("typeRoots" in portable.compilerOptions);
    assert.isFalse("outDir" in portable.compilerOptions);
    assert.deepStrictEqual(portable.compilerOptions.types, value.types);
  }), runs);

it.effect.prop("schema-generated portable configs obey the flags and remain unchanged by projection", [Arbitrary.schema(PortableTsconfig)], ([value]) =>
  Effect.gen(function* () {
    assert.strictEqual(value.compilerOptions.noEmit, true);
    assert.strictEqual(value.compilerOptions.composite, false);
    assert.isFalse("typeRoots" in value.compilerOptions);
    assert.isFalse("outDir" in value.compilerOptions);
    assert.deepStrictEqual(PortableTsconfig.make(value.compilerOptions, { includeTypes: true }), value);
    assert.deepStrictEqual(yield* S.encodeEffect(PortableTsconfig)(value), value);
  }), runs);
