import { purgeAtRoot } from "@beep/repo-cli/commands/Purge";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const testLayer = Layer.mergeAll(NodeServices.layer, FsUtilsLive.pipe(Layer.provide(NodeServices.layer)));

const withTempDirectories = <A, E, R>(use: (tmpDir: string, externalDir: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const tmpDir = yield* fs.makeTempDirectory();
      const externalDir = yield* fs.makeTempDirectory();

      return { externalDir, fs, tmpDir } as const;
    }),
    ({ externalDir, tmpDir }) => use(tmpDir, externalDir),
    ({ externalDir, fs, tmpDir }) =>
      Effect.all([
        fs.remove(tmpDir, { recursive: true, force: true }),
        fs.remove(externalDir, { recursive: true, force: true }),
      ]).pipe(Effect.asVoid)
  );

describe("purge security", () => {
  it("fails closed before deleting artifacts from a symlinked workspace outside the repo root", () =>
    Effect.runPromise(
      withTempDirectories((tmpDir, externalDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const workspaceDir = path.join(tmpDir, "packages", "pkg-outside");
          const externalDistDir = path.join(externalDir, "dist");
          const externalSentinelPath = path.join(externalDistDir, "sentinel.txt");

          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            '{ "name": "@beep/test-root", "workspaces": ["packages/*"] }\n'
          );
          yield* fs.makeDirectory(path.dirname(workspaceDir), { recursive: true });
          yield* fs.writeFileString(
            path.join(externalDir, "package.json"),
            '{ "name": "@beep/outside-workspace", "version": "1.0.0" }\n'
          );
          yield* fs.makeDirectory(externalDistDir, { recursive: true });
          yield* fs.writeFileString(externalSentinelPath, "keep\n");
          yield* fs.symlink(externalDir, workspaceDir);

          const succeeded = yield* purgeAtRoot(tmpDir, false).pipe(
            Effect.match({
              onFailure: () => false,
              onSuccess: () => true,
            })
          );

          expect(succeeded).toBe(false);
          expect(yield* fs.exists(externalDistDir)).toBe(true);
          expect(yield* fs.readFileString(externalSentinelPath)).toBe("keep\n");
        })
      ).pipe(provideScopedLayer(testLayer))
    ));

  it("accepts a symlinked repo root when every purge target stays inside the canonical repository", () =>
    Effect.runPromise(
      withTempDirectories((tmpDir, externalDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const repoAlias = path.join(externalDir, "repo-alias");
          const workspaceDir = path.join(tmpDir, "packages", "pkg-a");
          const rootNodeModules = path.join(tmpDir, "node_modules");
          const workspaceDist = path.join(workspaceDir, "dist");

          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            '{ "name": "@beep/test-root", "workspaces": ["packages/*"] }\n'
          );
          yield* fs.makeDirectory(workspaceDir, { recursive: true });
          yield* fs.writeFileString(
            path.join(workspaceDir, "package.json"),
            '{ "name": "@beep/pkg-a", "version": "1.0.0" }\n'
          );
          yield* fs.makeDirectory(rootNodeModules, { recursive: true });
          yield* fs.makeDirectory(workspaceDist, { recursive: true });
          yield* fs.symlink(tmpDir, repoAlias);

          const succeeded = yield* purgeAtRoot(repoAlias, false).pipe(
            Effect.match({
              onFailure: () => false,
              onSuccess: () => true,
            })
          );

          expect(succeeded).toBe(true);
          expect(yield* fs.exists(rootNodeModules)).toBe(false);
          expect(yield* fs.exists(workspaceDist)).toBe(false);
        })
      ).pipe(provideScopedLayer(testLayer))
    ));
});
