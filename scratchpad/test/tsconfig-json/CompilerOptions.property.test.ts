import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Target, Module, ModuleResolution, Jsx, NewLine, ModuleDetection, Lib, CompilerOptions } from "../../effected/tsconfig-json/CompilerOptions.ts";

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

describe("CompilerOptions property floor", () => {
  roundTrips("Target", Target);
  roundTrips("Module", Module);
  roundTrips("ModuleResolution", ModuleResolution);
  roundTrips("Jsx", Jsx);
  roundTrips("NewLine", NewLine);
  roundTrips("ModuleDetection", ModuleDetection);
  roundTrips("Lib", Lib);
  roundTrips("CompilerOptions", CompilerOptions);
});

it.effect.prop("README fidelity: case-varying targets canonicalize while unknown options survive", [Arbitrary.schema(Target), Arbitrary.schema(S.Json)], ([target, extension]) =>
  Effect.gen(function* () {
    const decoded = yield* S.decodeEffect(CompilerOptions)({ target: target.toUpperCase(), futureOption: extension });
    const encoded = yield* S.encodeEffect(CompilerOptions)(decoded);
    assert.strictEqual(encoded.target, target);
    assert.deepStrictEqual(encoded.futureOption, extension);
    assert.deepStrictEqual(yield* S.decodeEffect(CompilerOptions)(encoded), decoded);
  }), runs);
