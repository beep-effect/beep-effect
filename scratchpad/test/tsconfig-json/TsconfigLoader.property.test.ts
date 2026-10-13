import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { TsconfigExtendsError } from "../../effected/tsconfig-json/TsconfigLoader.ts";

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

describe("TsconfigLoader property floor", () => {
  roundTrips("TsconfigExtendsError", TsconfigExtendsError);
});

import { layer } from "@effect/vitest";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { CompilerOptions } from "../../effected/tsconfig-json/CompilerOptions.ts";
import { TsconfigJsonFromString } from "../../effected/tsconfig-json/TsconfigJson.ts";
import { ResolvedTsconfig } from "../../effected/tsconfig-json/ResolvedTsconfig.ts";
import { TsconfigLoader } from "../../effected/tsconfig-json/TsconfigLoader.ts";

layer(Layer.mergeAll(MemoryFileSystem.layerWith({ "/prop/tsconfig.json": "{}" }), Path.layer), { timeout: "30 seconds" })("loader parser properties", (it) => {
  it.effect.prop("load retains encoded document fidelity and its rendering is idempotent", [Arbitrary.schema(TsconfigJsonFromString)], ([value]) => Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const encoded = yield* S.encodeEffect(TsconfigJsonFromString)(value);
    yield* fs.writeFileString("/prop/tsconfig.json", encoded);
    const parsed = yield* TsconfigLoader.load("/prop/tsconfig.json");
    assertTrue(S.toEquivalence(TsconfigJsonFromString)(parsed, value));
    const formatted = yield* S.encodeEffect(TsconfigJsonFromString)(parsed);
    yield* fs.writeFileString("/prop/tsconfig.json", formatted);
    const reparsed = yield* TsconfigLoader.load("/prop/tsconfig.json");
    assertTrue(S.toEquivalence(TsconfigJsonFromString)(reparsed, parsed));
    assert.strictEqual(yield* S.encodeEffect(TsconfigJsonFromString)(reparsed), formatted);
  }), runs);

  it.effect.prop("resolve is stable across rereads and compilerOptions is its faithful projection", [Arbitrary.schema(CompilerOptions)], ([options]) => Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    yield* fs.writeFileString("/prop/tsconfig.json", yield* S.encodeEffect(TsconfigJsonFromString)({ compilerOptions: options }));
    const resolved = yield* TsconfigLoader.resolve("/prop/tsconfig.json");
    const absolutized = ResolvedTsconfig.absolutize({ compilerOptions: options }, "/prop", path.resolve);
    const expected = ResolvedTsconfig.substituteConfigDir(ResolvedTsconfig.merge({ configPath: "/prop/tsconfig.json", extendedPaths: [], compilerOptions: {} }, absolutized, "/prop/tsconfig.json"), "/prop");
    assertTrue(S.toEquivalence(ResolvedTsconfig)(resolved, expected));
    assert.deepStrictEqual(yield* TsconfigLoader.resolve("/prop/tsconfig.json"), resolved);
    assert.deepStrictEqual(yield* TsconfigLoader.compilerOptions("/prop/tsconfig.json"), resolved.compilerOptions);
  }), runs);
});
