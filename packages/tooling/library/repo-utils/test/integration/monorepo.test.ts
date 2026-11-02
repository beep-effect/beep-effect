import { it } from "@beep/test-runner";
/**
 * Integration tests that exercise @beep/repo-utils against the real
 * beep-effect monorepo on disk.
 *
 * These are intentionally loose assertions: they verify structural
 * invariants (non-empty results, expected keys) without hard-coding
 * counts that would break every time a workspace is added or removed.
 */

import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { collectTsConfigPaths } from "@beep/repo-utils/TsConfig";
import { Str } from "@beep/utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const TestLayer = FsUtilsLive.pipe(Layer.provideMerge(PlatformLayer));
const MONOREPO_INTEGRATION_TIMEOUT = 600_000;

it.layer(TestLayer, { timeout: MONOREPO_INTEGRATION_TIMEOUT })("integration (real monorepo)", (it) => {
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
      MONOREPO_INTEGRATION_TIMEOUT
    );
  });

  // ── collectTsConfigPaths ─────────────────────────────────────────────
  describe("collectTsConfigPaths", () => {
    it.effect(
      "should find tsconfig files in workspaces",
      Effect.fn(function* () {
        const root = yield* findRepoRoot();
        // Workspace discovery is `@beep/repo-workspaces`' job; the caller names the directories.
        const configs = yield* collectTsConfigPaths(
          root,
          HashMap.make(["@beep/repo-utils", `${root}/packages/tooling/library/repo-utils`])
        );

        // The root (@beep/root) must have at least one tsconfig
        expect(HashMap.has(configs, "@beep/root")).toBe(true);

        // @beep/repo-utils should have at least one tsconfig
        expect(HashMap.has(configs, "@beep/repo-utils")).toBe(true);

        expect(HashMap.size(configs)).toBe(2);

        // Every entry should be a non-empty array of absolute paths
        for (const [_name, paths] of configs) {
          expect(paths.length).toBeGreaterThan(0);
          for (const p of paths) {
            expect(Str.startsWith("/")(p)).toBe(true);
            expect(p).toMatch(/tsconfig.*\.json$/);
          }
        }
      }),
      MONOREPO_INTEGRATION_TIMEOUT
    );
  });
});
