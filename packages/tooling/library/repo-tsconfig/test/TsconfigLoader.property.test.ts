import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { TsconfigExtendsError } from "@beep/repo-tsconfig/TsconfigLoader";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(
    `${name}: encoding decodes successfully to an equivalent value`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assertTrue(equivalent(decoded, value));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};

describe("TsconfigLoader property floor", () => {
  roundTrips("TsconfigExtendsError", TsconfigExtendsError);
});

import { MemoryFileSystem } from "@beep/memfs";
import { TsconfigLoader } from "@beep/repo-tsconfig/TsconfigLoader";
import { CompilerOptions } from "@beep/tsconfig/CompilerOptions";
import { ResolvedTsconfig } from "@beep/tsconfig/ResolvedTsconfig";
import { TsconfigJsonFromString } from "@beep/tsconfig/TsconfigJson";
import { layer } from "@effect/vitest";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

// Tests run concurrently under the shared vitest config, so each property owns its own
// file: one shared path lets the two properties overwrite each other mid-run.
layer(
  Layer.mergeAll(
    MemoryFileSystem.layerWith({ "/prop/load/tsconfig.json": "{}", "/prop/resolve/tsconfig.json": "{}" }),
    Path.layer
  ),
  {
    timeout: "30 seconds",
  }
)("loader parser properties", (it) => {
  it.effect.prop(
    "load retains encoded document fidelity and its rendering is idempotent",
    [Arbitrary.schema(TsconfigJsonFromString)],
    ([value]) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const encoded = yield* S.encodeEffect(TsconfigJsonFromString)(value);
        yield* fs.writeFileString("/prop/load/tsconfig.json", encoded);
        const parsed = yield* TsconfigLoader.load("/prop/load/tsconfig.json");
        assertTrue(S.toEquivalence(TsconfigJsonFromString)(parsed, value));
        const formatted = yield* S.encodeEffect(TsconfigJsonFromString)(parsed);
        yield* fs.writeFileString("/prop/load/tsconfig.json", formatted);
        const reparsed = yield* TsconfigLoader.load("/prop/load/tsconfig.json");
        assertTrue(S.toEquivalence(TsconfigJsonFromString)(reparsed, parsed));
        const value2 = yield* S.encodeEffect(TsconfigJsonFromString)(reparsed);
        assert.strictEqual(value2, formatted);
      }),
    runs
  );

  it.effect.prop(
    "resolve is stable across rereads and compilerOptions is its faithful projection",
    [Arbitrary.schema(CompilerOptions)],
    ([options]) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const value3 = yield* S.encodeEffect(TsconfigJsonFromString)({ compilerOptions: options });
        yield* fs.writeFileString("/prop/resolve/tsconfig.json", value3);
        const resolved = yield* TsconfigLoader.resolve("/prop/resolve/tsconfig.json");
        const absolutized = ResolvedTsconfig.absolutize({ compilerOptions: options }, "/prop/resolve", path.resolve);
        const expected = ResolvedTsconfig.substituteConfigDir(
          ResolvedTsconfig.merge(
            ResolvedTsconfig.make({
              configPath: "/prop/resolve/tsconfig.json",
              extendedPaths: [],
              compilerOptions: {},
            }),
            absolutized,
            "/prop/resolve/tsconfig.json"
          ),
          "/prop/resolve"
        );
        assertTrue(S.toEquivalence(ResolvedTsconfig)(resolved, expected));
        const resolved4 = yield* TsconfigLoader.resolve("/prop/resolve/tsconfig.json");
        assert.deepStrictEqual(resolved4, resolved);
        const compilerOptions5 = yield* TsconfigLoader.compilerOptions("/prop/resolve/tsconfig.json");
        assert.deepStrictEqual(compilerOptions5, resolved.compilerOptions);
      }),
    runs
  );
});
