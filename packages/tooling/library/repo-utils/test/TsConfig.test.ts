import { fileURLToPath } from "node:url";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { collectTsConfigPaths } from "@beep/repo-utils/TsConfig";
import { A, Str } from "@beep/utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, layer } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, HashMap, Layer, Path } from "effect";
import * as O from "effect/Option";

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const TestLayer = FsUtilsLive.pipe(Layer.provideMerge(PlatformLayer));

const MOCK_ROOT = fileURLToPath(new URL("./fixtures/mock-monorepo", import.meta.url));

layer(TestLayer, { timeout: "10 seconds" })("TsConfig", (it) => {
  describe("collectTsConfigPaths", () => {
    it.effect(
      "should collect tsconfig files for root and workspaces",
      Effect.fn(function* () {
        const configs = yield* collectTsConfigPaths(MOCK_ROOT);
        // Root should have tsconfig.json and tsconfig.build.json
        const rootConfigs = HashMap.get(configs, "@beep/root");
        rootConfigs.pipe(O.isSome, assertTrue);
        if (O.isSome(rootConfigs)) {
          expect(rootConfigs.value.length).toBe(2);
          expect(A.some(rootConfigs.value, Str.endsWith("tsconfig.json"))).toBe(true);
          expect(A.some(rootConfigs.value, Str.endsWith("tsconfig.build.json"))).toBe(true);
        }
      })
    );

    it.effect(
      "should find tsconfig files in workspace packages",
      Effect.fn(function* () {
        const configs = yield* collectTsConfigPaths(MOCK_ROOT);
        // pkg-a has tsconfig.json and tsconfig.test.json
        const pkgAConfigs = HashMap.get(configs, "@mock/pkg-a");
        pkgAConfigs.pipe(O.isSome, assertTrue);
        if (O.isSome(pkgAConfigs)) {
          expect(pkgAConfigs.value.length).toBe(2);
          expect(A.some(pkgAConfigs.value, Str.endsWith("tsconfig.json"))).toBe(true);
          expect(A.some(pkgAConfigs.value, Str.endsWith("tsconfig.test.json"))).toBe(true);
        }
      })
    );

    it.effect(
      "should find single tsconfig in packages with one config",
      Effect.fn(function* () {
        const configs = yield* collectTsConfigPaths(MOCK_ROOT);
        // pkg-b and pkg-c each have only tsconfig.json
        const pkgBConfigs = HashMap.get(configs, "@mock/pkg-b");
        pkgBConfigs.pipe(O.isSome, assertTrue);
        if (O.isSome(pkgBConfigs)) {
          expect(pkgBConfigs.value.length).toBe(1);
        }
      })
    );

    it.effect(
      "should return absolute paths",
      Effect.fn(function* () {
        const pathApi = yield* Path.Path;
        const configs = yield* collectTsConfigPaths(MOCK_ROOT);
        for (const [_name, paths] of configs) {
          for (const p of paths) {
            expect(pathApi.isAbsolute(p)).toBe(true);
          }
        }
      })
    );

    it.effect(
      "should include all workspace packages",
      Effect.fn(function* () {
        const configs = yield* collectTsConfigPaths(MOCK_ROOT);
        // Root + 3 packages = 4 entries
        expect(HashMap.size(configs)).toBe(4);
      })
    );
  });
});
