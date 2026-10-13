import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Config from "../../effected/tsconfig-json/index.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>, canonicalize: (value: T) => T = (value) => value): void => {
  it.effect.prop(`${name} decodes every encoded value with structural fidelity`, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assert.isTrue(S.toEquivalence(schema)(decoded, canonicalize(value)));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};

describe("index exported schema property floor", () => {
  roundTrips("CompilerOptions", Config.CompilerOptions);
  roundTrips("Jsx", Config.Jsx);
  roundTrips("Lib", Config.Lib);
  roundTrips("Module", Config.Module);
  roundTrips("ModuleDetection", Config.ModuleDetection);
  roundTrips("ModuleResolution", Config.ModuleResolution);
  roundTrips("NewLine", Config.NewLine);
  roundTrips("Target", Config.Target);
  // Numeric TypeScript enums have deliberate aliases; compare their documented
  // canonical spelling while retaining every other field structurally.
  roundTrips("CompilerOptionsFromProgrammatic", Config.CompilerOptionsFromProgrammatic, (value) => ({
    ...value,
    ...(value.target === "es6" ? { target: "es2015" as const } : {}),
    ...(value.module === "es6" ? { module: "es2015" as const } : {}),
    ...(value.moduleResolution === "node" ? { moduleResolution: "node10" as const } : {}),
  }));
  roundTrips("JsxConfig", Config.JsxConfig);
  roundTrips("PortableTsconfig", Config.PortableTsconfig);
  roundTrips("ResolvedTsconfig", Config.ResolvedTsconfig);
  roundTrips("FallbackPolling", Config.FallbackPolling);
  roundTrips("Reference", Config.Reference);
  roundTrips("TsconfigJson", Config.TsconfigJson);
  roundTrips("TsconfigJsonFromString", Config.TsconfigJsonFromString);
  roundTrips("TsconfigParseError", Config.TsconfigParseError);
  roundTrips("TypeAcquisition", Config.TypeAcquisition);
  roundTrips("WatchDirectory", Config.WatchDirectory);
  roundTrips("WatchFile", Config.WatchFile);
  roundTrips("WatchOptions", Config.WatchOptions);
  roundTrips("TsconfigExtendsError", Config.TsconfigExtendsError);
  roundTrips("ProgrammaticCompilerOptions", Config.ProgrammaticCompilerOptions);
});
