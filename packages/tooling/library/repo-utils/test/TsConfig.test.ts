import * as NodeURL from "node:url";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { collectTsConfigPaths } from "@beep/repo-utils/TsConfig";
import { it } from "@beep/test-runner";
import { A, Str } from "@beep/utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const TestLayer = FsUtilsLive.pipe(Layer.provideMerge(PlatformLayer));

const MOCK_ROOT = NodeURL.fileURLToPath(new URL("./fixtures/mock-monorepo", import.meta.url));
// The caller supplies the workspace directories (repo-cli reads them from `@beep/repo-workspaces`).
const MOCK_WORKSPACE_DIRS = HashMap.make(
  ["@mock/pkg-a", `${MOCK_ROOT}/packages/pkg-a`],
  ["@mock/pkg-b", `${MOCK_ROOT}/packages/pkg-b`],
  ["@mock/pkg-c", `${MOCK_ROOT}/packages/pkg-c`]
);

it.layer(TestLayer, { timeout: "10 seconds" })("TsConfig", (it) => {
  describe("collectTsConfigPaths", () => {
    it.effect(
      "should collect tsconfig files for root and workspaces",
      Effect.fn(function* () {
        const configs = yield* collectTsConfigPaths(MOCK_ROOT, MOCK_WORKSPACE_DIRS);
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
        const configs = yield* collectTsConfigPaths(MOCK_ROOT, MOCK_WORKSPACE_DIRS);
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
        const configs = yield* collectTsConfigPaths(MOCK_ROOT, MOCK_WORKSPACE_DIRS);
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
        const configs = yield* collectTsConfigPaths(MOCK_ROOT, MOCK_WORKSPACE_DIRS);
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
        const configs = yield* collectTsConfigPaths(MOCK_ROOT, MOCK_WORKSPACE_DIRS);
        // Root + 3 packages = 4 entries
        expect(HashMap.size(configs)).toBe(4);
      })
    );

    it.effect(
      "should omit a root or workspace directory that has no tsconfig",
      Effect.fn(function* () {
        // Neither `packages/` nor `pkg-a/src` holds a top-level tsconfig*.json.
        const configs = yield* collectTsConfigPaths(
          `${MOCK_ROOT}/packages`,
          HashMap.make(["@mock/pkg-a-src", `${MOCK_ROOT}/packages/pkg-a/src`])
        );
        expect(HashMap.size(configs)).toBe(0);
      })
    );

    it.effect(
      "should accept the workspace directories first (data-last)",
      Effect.fn(function* () {
        const configs = yield* collectTsConfigPaths(MOCK_WORKSPACE_DIRS)(MOCK_ROOT);
        expect(HashMap.size(configs)).toBe(4);
      })
    );
  });
});
