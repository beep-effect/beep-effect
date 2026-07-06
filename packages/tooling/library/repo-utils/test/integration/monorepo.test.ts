/**
 * Integration tests that exercise @beep/repo-utils against the real
 * beep-effect monorepo on disk.
 *
 * These are intentionally loose assertions: they verify structural
 * invariants (non-empty results, expected keys) without hard-coding
 * counts that would break every time a workspace is added or removed.
 */

import { buildRepoDependencyIndex } from "@beep/repo-utils/DependencyIndex";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { collectTsConfigPaths } from "@beep/repo-utils/TsConfig";
import { collectUniqueNpmDependencies } from "@beep/repo-utils/UniqueDeps";
import { resolveWorkspaceDirs } from "@beep/repo-utils/Workspaces";
import { A, Str } from "@beep/utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, FileSystem, HashMap, HashSet, Layer, Order } from "effect";

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const TestLayer = FsUtilsLive.pipe(Layer.provideMerge(PlatformLayer));

layer(TestLayer, { timeout: 120_000 })("integration (real monorepo)", (it) => {
  // ── findRepoRoot ─────────────────────────────────────────────────────
  describe("findRepoRoot", () => {
    it.effect(
      "should find the monorepo root directory",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* findRepoRoot();
        const hasPackageJson = yield* fs.exists(`${root}/package.json`);
        const hasTurboJson = yield* fs.exists(`${root}/turbo.json`);
        const hasBunLock = yield* fs.exists(`${root}/bun.lock`);

        expect(Str.startsWith("/")(root)).toBe(true);
        expect(Str.endsWith("/")(root)).toBe(false);
        expect(hasPackageJson).toBe(true);
        expect(hasTurboJson).toBe(true);
        expect(hasBunLock).toBe(true);
      }),
      120_000
    );
  });

  // ── resolveWorkspaceDirs ─────────────────────────────────────────────
  describe("resolveWorkspaceDirs", () => {
    it.effect(
      "should discover @beep/repo-cli and @beep/repo-utils",
      Effect.fn(function* () {
        const root = yield* findRepoRoot();
        const workspaces = yield* resolveWorkspaceDirs(root);

        expect(HashMap.has(workspaces, "@beep/repo-cli")).toBe(true);
        expect(HashMap.has(workspaces, "@beep/repo-utils")).toBe(true);

        // At least 2 workspaces (could be more as repo grows)
        expect(HashMap.size(workspaces)).toBeGreaterThanOrEqual(2);
      }),
      120_000
    );
  });

  // ── collectTsConfigPaths ─────────────────────────────────────────────
  describe("collectTsConfigPaths", () => {
    it.effect(
      "should find tsconfig files in workspaces",
      Effect.fn(function* () {
        const root = yield* findRepoRoot();
        const configs = yield* collectTsConfigPaths(root);

        // The root (@beep/root) must have at least one tsconfig
        expect(HashMap.has(configs, "@beep/root")).toBe(true);

        // @beep/repo-utils should have at least one tsconfig
        expect(HashMap.has(configs, "@beep/repo-utils")).toBe(true);

        // Every entry should be a non-empty array of absolute paths
        for (const [_name, paths] of configs) {
          expect(paths.length).toBeGreaterThan(0);
          for (const p of paths) {
            expect(Str.startsWith("/")(p)).toBe(true);
            expect(p).toMatch(/tsconfig.*\.json$/);
          }
        }
      }),
      120_000
    );
  });

  // ── buildRepoDependencyIndex ─────────────────────────────────────────
  describe("buildRepoDependencyIndex", () => {
    it.effect(
      "should build the dependency map for the monorepo",
      Effect.fn(function* () {
        const root = yield* findRepoRoot();
        const index = yield* buildRepoDependencyIndex(root);

        // Must contain root and at least @beep/repo-utils
        expect(HashMap.has(index, "@beep/root")).toBe(true);
        expect(HashMap.has(index, "@beep/repo-utils")).toBe(true);

        // Each entry must have the workspace/npm structure
        for (const [_name, deps] of index) {
          expect(deps).toHaveProperty("workspace");
          expect(deps).toHaveProperty("npm");
          expect(deps.workspace).toHaveProperty("dependencies");
          expect(deps.npm).toHaveProperty("dependencies");
          expect(deps.npm).toHaveProperty("devDependencies");
        }
      }),
      120_000
    );
  });

  // ── collectUniqueNpmDependencies ─────────────────────────────────────
  describe("collectUniqueNpmDependencies", () => {
    it.effect(
      "should list all NPM deps across the monorepo",
      Effect.fn(function* () {
        const root = yield* findRepoRoot();
        const unique = yield* collectUniqueNpmDependencies(root);

        // "effect" must be present as a runtime dependency
        expect(unique.dependencies).toContain("effect");

        // Both arrays must be sorted
        const sortedDeps = A.sort(unique.dependencies, Order.String);
        expect(unique.dependencies).toEqual(sortedDeps);

        const sortedDevDeps = A.sort(unique.devDependencies, Order.String);
        expect(unique.devDependencies).toEqual(sortedDevDeps);

        // No duplicates within each array
        expect(HashSet.size(HashSet.fromIterable(unique.dependencies))).toBe(unique.dependencies.length);
        expect(HashSet.size(HashSet.fromIterable(unique.devDependencies))).toBe(unique.devDependencies.length);
      }),
      120_000
    );
  });
});
