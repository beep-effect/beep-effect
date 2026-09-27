import { fileURLToPath } from "node:url";
import { buildRepoDependencyIndex } from "@beep/repo-utils/DependencyIndex";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { it } from "@beep/test-runner";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, HashMap, Layer, Path } from "effect";
import * as Fs from "effect/FileSystem";
import * as O from "effect/Option";
import * as R from "effect/Record";

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const TestLayer = FsUtilsLive.pipe(Layer.provideMerge(PlatformLayer));

const MOCK_ROOT = fileURLToPath(new URL("./fixtures/mock-monorepo", import.meta.url));

it.layer(TestLayer, { timeout: "10 seconds" })("DependencyIndex", (it) => {
  describe("buildRepoDependencyIndex", () => {
    it.effect(
      "should include root and all workspace packages",
      Effect.fn(function* () {
        const index = yield* buildRepoDependencyIndex(MOCK_ROOT);
        // Root + 3 packages = 4 entries
        expect(HashMap.size(index)).toBe(4);
        expect(HashMap.has(index, "@beep/root")).toBe(true);
        expect(HashMap.has(index, "@mock/pkg-a")).toBe(true);
        expect(HashMap.has(index, "@mock/pkg-b")).toBe(true);
        expect(HashMap.has(index, "@mock/pkg-c")).toBe(true);
      })
    );

    it.effect(
      "should classify workspace deps for pkg-a",
      Effect.fn(function* () {
        const index = yield* buildRepoDependencyIndex(MOCK_ROOT);
        const pkgADeps = HashMap.get(index, "@mock/pkg-a");
        pkgADeps.pipe(O.isSome, assertTrue);
        if (O.isSome(pkgADeps)) {
          const deps = pkgADeps.value;
          // @mock/pkg-b is a workspace dep
          expect(deps.workspace.dependencies).toHaveProperty("@mock/pkg-b");
          // effect is an npm dep
          expect(deps.npm.dependencies).toHaveProperty("effect");
        }
      })
    );

    it.effect(
      "should classify workspace devDeps for pkg-b",
      Effect.fn(function* () {
        const index = yield* buildRepoDependencyIndex(MOCK_ROOT);
        const pkgBDeps = HashMap.get(index, "@mock/pkg-b");
        pkgBDeps.pipe(O.isSome, assertTrue);
        if (O.isSome(pkgBDeps)) {
          const deps = pkgBDeps.value;
          // @mock/pkg-c is a workspace devDep
          expect(deps.workspace.devDependencies).toHaveProperty("@mock/pkg-c");
          // vitest is an npm devDep
          expect(deps.npm.devDependencies).toHaveProperty("vitest");
        }
      })
    );

    it.effect(
      "should handle pkg-c with only npm deps",
      Effect.fn(function* () {
        const index = yield* buildRepoDependencyIndex(MOCK_ROOT);
        const pkgCDeps = HashMap.get(index, "@mock/pkg-c");
        pkgCDeps.pipe(O.isSome, assertTrue);
        if (O.isSome(pkgCDeps)) {
          const deps = pkgCDeps.value;
          // No workspace deps
          expect(R.keys(deps.workspace.dependencies)).toHaveLength(0);
          expect(R.keys(deps.workspace.devDependencies)).toHaveLength(0);
          // zod is npm dep
          expect(deps.npm.dependencies).toHaveProperty("zod");
          // effect is an npm peerDep
          expect(deps.npm.peerDependencies).toHaveProperty("effect");
        }
      })
    );

    it.effect(
      "should classify root package deps as npm",
      Effect.fn(function* () {
        const index = yield* buildRepoDependencyIndex(MOCK_ROOT);
        const rootDeps = HashMap.get(index, "@beep/root");
        rootDeps.pipe(O.isSome, assertTrue);
        if (O.isSome(rootDeps)) {
          const deps = rootDeps.value;
          expect(deps.packageName).toBe("@beep/root");
          // Root has typescript as a dep and vitest as devDep, both npm
          expect(deps.npm.dependencies).toHaveProperty("typescript");
          expect(deps.npm.devDependencies).toHaveProperty("vitest");
        }
      })
    );

    it.effect(
      "should fail with DomainError for invalid root package.json",
      Effect.fn(function* () {
        const pathApi = yield* Path.Path;
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
        const rootPackageJsonPath = pathApi.join(tmpDir, "package.json");

        yield* fs.writeFileString(rootPackageJsonPath, "not valid json");

        const result = yield* buildRepoDependencyIndex(tmpDir).pipe(
          Effect.catchTag("DomainError", (error) => Effect.succeed(error.message))
        );

        expect(result).toContain(`Failed to parse JSON at "${rootPackageJsonPath}"`);
      })
    );

    it.effect(
      "should fail with DomainError for invalid child package.json",
      Effect.fn(function* () {
        const pathApi = yield* Path.Path;
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
        const packageDir = pathApi.join(tmpDir, "packages", "pkg-a");
        const rootPackageJsonPath = pathApi.join(tmpDir, "package.json");
        const childPackageJsonPath = pathApi.join(packageDir, "package.json");

        yield* fs.makeDirectory(packageDir, { recursive: true });
        yield* fs.writeFileString(
          rootPackageJsonPath,
          '{ "name": "root", "private": true, "workspaces": ["packages/*"], "dependencies": {}, "devDependencies": {} }'
        );
        yield* fs.writeFileString(childPackageJsonPath, "not valid json");

        const result = yield* buildRepoDependencyIndex(tmpDir).pipe(
          Effect.catchTag("DomainError", (error) => Effect.succeed(error.message))
        );

        expect(result).toContain(`Failed to parse JSON at "${childPackageJsonPath}"`);
      })
    );
  });
});
