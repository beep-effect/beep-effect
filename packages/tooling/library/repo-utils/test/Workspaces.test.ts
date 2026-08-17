import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import {
  getWorkspaceDir,
  resolveWorkspaceDirs,
  resolveWorkspacePackages,
  workspaceGlobsFrom,
} from "@beep/repo-utils/Workspaces";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, layer } from "@effect/vitest";
import { Context, Effect, HashMap, Layer, Path } from "effect";
import * as Fs from "effect/FileSystem";
import * as O from "effect/Option";

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const TestLayer = FsUtilsLive.pipe(Layer.provideMerge(PlatformLayer));
const pathApi = Effect.runSync(Effect.scoped(Layer.build(NodePath.layer).pipe(Effect.map(Context.get(Path.Path)))));

const MOCK_ROOT = pathApi.resolve(__dirname, "fixtures/mock-monorepo");

layer(TestLayer)("Workspaces", (it) => {
  describe("resolveWorkspaceDirs", () => {
    it.effect(
      "should resolve all workspace packages",
      Effect.fn(function* () {
        const workspaces = yield* resolveWorkspaceDirs(MOCK_ROOT);
        expect(HashMap.size(workspaces)).toBe(3);
        expect(HashMap.has(workspaces, "@mock/pkg-a")).toBe(true);
        expect(HashMap.has(workspaces, "@mock/pkg-b")).toBe(true);
        expect(HashMap.has(workspaces, "@mock/pkg-c")).toBe(true);
      })
    );

    it.effect(
      "should map names to absolute directory paths",
      Effect.fn(function* () {
        const workspaces = yield* resolveWorkspaceDirs(MOCK_ROOT);
        const dirA = HashMap.get(workspaces, "@mock/pkg-a");
        expect(O.isSome(dirA)).toBe(true);
        if (O.isSome(dirA)) {
          expect(dirA.value).toContain("packages/pkg-a");
          expect(pathApi.isAbsolute(dirA.value)).toBe(true);
        }
      })
    );

    it.effect(
      "should return empty HashMap when no workspaces defined",
      Effect.fn(function* () {
        // pkg-a has no workspaces field
        const workspaces = yield* resolveWorkspaceDirs(pathApi.resolve(MOCK_ROOT, "packages/pkg-a"));
        expect(HashMap.size(workspaces)).toBe(0);
      })
    );

    it.effect(
      "should ignore generated coverage directories while resolving workspaces",
      Effect.fn(function* () {
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();
        const packageDir = pathApi.join(tmpDir, "packages", "pkg-a");
        const coverageDir = pathApi.join(packageDir, "coverage");

        const workspaces = yield* Effect.acquireUseRelease(
          Effect.gen(function* () {
            yield* fs.makeDirectory(coverageDir, { recursive: true });
            yield* fs.writeFileString(
              pathApi.join(tmpDir, "package.json"),
              '{ "name": "root", "workspaces": ["packages/*", "packages/*/coverage"] }'
            );
            yield* fs.writeFileString(
              pathApi.join(packageDir, "package.json"),
              '{ "name": "@mock/pkg-a", "version": "1.0.0" }'
            );
            yield* fs.writeFileString(
              pathApi.join(coverageDir, "package.json"),
              '{ "name": "@generated/coverage-artifact", "version": "1.0.0" }'
            );
          }),
          () => resolveWorkspaceDirs(tmpDir),
          () => fs.remove(tmpDir, { recursive: true })
        );

        expect(HashMap.has(workspaces, "@mock/pkg-a")).toBe(true);
        expect(HashMap.has(workspaces, "@generated/coverage-artifact")).toBe(false);
      })
    );

    it.effect(
      "should resolve only existing members when a workspace glob matches zero directories",
      Effect.fn(function* () {
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();
        const packageDir = pathApi.join(tmpDir, "packages", "pkg-a");

        // The apps/labs/* glob is declared before any lab exists (ratified
        // lab-apps row 1): resolution must yield only the existing members.
        const workspaces = yield* Effect.acquireUseRelease(
          Effect.gen(function* () {
            yield* fs.makeDirectory(packageDir, { recursive: true });
            yield* fs.writeFileString(
              pathApi.join(tmpDir, "package.json"),
              '{ "name": "root", "workspaces": ["packages/*", "apps/labs/*"] }'
            );
            yield* fs.writeFileString(
              pathApi.join(packageDir, "package.json"),
              '{ "name": "@mock/pkg-a", "version": "1.0.0" }'
            );
          }),
          () => resolveWorkspaceDirs(tmpDir),
          () => fs.remove(tmpDir, { recursive: true })
        );

        expect(HashMap.size(workspaces)).toBe(1);
        expect(HashMap.has(workspaces, "@mock/pkg-a")).toBe(true);
      })
    );

    it.effect(
      "should fail with NoSuchFileError for missing root",
      Effect.fn(function* () {
        const result = yield* resolveWorkspaceDirs("/nonexistent/root").pipe(
          Effect.catchTag("NoSuchFileError", (e) => Effect.succeed(`caught: ${e._tag}`))
        );
        expect(result).toBe("caught: NoSuchFileError");
      })
    );

    it.effect(
      "should fail with DomainError for invalid root package.json",
      Effect.fn(function* () {
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();

        yield* fs.writeFileString(pathApi.join(tmpDir, "package.json"), "not valid json");

        const result = yield* resolveWorkspaceDirs(tmpDir).pipe(
          Effect.catchTag("DomainError", (error) => Effect.succeed(error.message))
        );

        expect(result).toContain(`Failed to parse JSON at "${pathApi.join(tmpDir, "package.json")}"`);

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );

    it.effect(
      "should fail with DomainError for invalid child package.json",
      Effect.fn(function* () {
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();
        const packagesDir = pathApi.join(tmpDir, "packages");
        const packageDir = pathApi.join(packagesDir, "pkg-a");
        const rootPackageJsonPath = pathApi.join(tmpDir, "package.json");
        const childPackageJsonPath = pathApi.join(packageDir, "package.json");

        yield* fs.makeDirectory(packageDir, { recursive: true });
        yield* fs.writeFileString(rootPackageJsonPath, '{ "name": "root", "workspaces": ["packages/*"] }');
        yield* fs.writeFileString(childPackageJsonPath, "not valid json");

        const result = yield* resolveWorkspaceDirs(tmpDir).pipe(
          Effect.catchTag("DomainError", (error) => Effect.succeed(error.message))
        );

        expect(result).toContain(`Failed to parse JSON at "${childPackageJsonPath}"`);

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );

    it.effect(
      "should fail closed for workspace globs that traverse outside the repo root",
      Effect.fn(function* () {
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();

        yield* fs.writeFileString(pathApi.join(tmpDir, "package.json"), '{ "name": "root", "workspaces": ["../*"] }');

        const result = yield* resolveWorkspaceDirs(tmpDir).pipe(
          Effect.catchTag("DomainError", (error) => Effect.succeed(error.message))
        );

        expect(result).toContain('Unsafe workspace glob "../*" escapes the repository root.');

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );

    it.effect(
      "should fail closed for Windows absolute workspace globs",
      Effect.fn(function* () {
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();

        yield* fs.writeFileString(
          pathApi.join(tmpDir, "package.json"),
          '{ "name": "root", "workspaces": ["C:/outside/*"] }'
        );

        const result = yield* resolveWorkspaceDirs(tmpDir).pipe(
          Effect.catchTag("DomainError", (error) => Effect.succeed(error.message))
        );

        expect(result).toContain('Unsafe workspace glob "C:/outside/*" escapes the repository root.');

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );

    it.effect(
      "should reject symlinked workspace directories that resolve outside the repo root",
      Effect.fn(function* () {
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();
        const externalDir = yield* fs.makeTempDirectory();
        const packagesDir = pathApi.join(tmpDir, "packages");
        const symlinkDir = pathApi.join(packagesDir, "pkg-outside");
        const rootPackageJsonPath = pathApi.join(tmpDir, "package.json");

        yield* fs.makeDirectory(packagesDir, { recursive: true });
        yield* fs.writeFileString(rootPackageJsonPath, '{ "name": "root", "workspaces": ["packages/*"] }');
        yield* fs.writeFileString(
          pathApi.join(externalDir, "package.json"),
          '{ "name": "@mock/pkg-outside", "version": "1.0.0" }'
        );
        yield* fs.symlink(externalDir, symlinkDir);

        const result = yield* resolveWorkspaceDirs(tmpDir).pipe(
          Effect.catchTag("DomainError", (error) => Effect.succeed(error.message))
        );

        expect(result).toContain(`Workspace path escapes repository root: "${symlinkDir}" -> "${externalDir}"`);

        yield* fs.remove(tmpDir, { recursive: true });
        yield* fs.remove(externalDir, { recursive: true });
      })
    );
  });

  describe("getWorkspaceDir", () => {
    it.effect(
      "should find an existing workspace by name",
      Effect.fn(function* () {
        const dir = yield* getWorkspaceDir(MOCK_ROOT, "@mock/pkg-b");
        expect(O.isSome(dir)).toBe(true);
        if (O.isSome(dir)) {
          expect(dir.value).toContain("packages/pkg-b");
        }
      })
    );

    it.effect(
      "should return None for a non-existent workspace",
      Effect.fn(function* () {
        const dir = yield* getWorkspaceDir(MOCK_ROOT, "@mock/nonexistent");
        expect(O.isNone(dir)).toBe(true);
      })
    );
  });

  describe("resolveWorkspacePackages", () => {
    it.effect(
      "should resolve each package with its dir, decoded manifest, and scripts",
      Effect.fn(function* () {
        const packages = yield* resolveWorkspacePackages(MOCK_ROOT);
        expect(HashMap.size(packages)).toBe(3);

        const pkgA = HashMap.get(packages, "@mock/pkg-a");
        expect(O.isSome(pkgA)).toBe(true);
        if (O.isSome(pkgA)) {
          expect(pkgA.value.dir).toContain("packages/pkg-a");
          expect(pkgA.value.manifest.name).toBe("@mock/pkg-a");
          // The mock manifest declares no scripts, so the flattened record is empty.
          expect(pkgA.value.scripts).toEqual({});
        }
      })
    );
  });

  describe("workspaceGlobsFrom", () => {
    it.effect(
      "should return the array form of workspace globs unchanged",
      Effect.fn(function* () {
        expect(workspaceGlobsFrom(O.some(["packages/*", "apps/*"]))).toEqual(["packages/*", "apps/*"]);
      })
    );

    it.effect(
      "should return an empty array when workspaces is None",
      Effect.fn(function* () {
        expect(workspaceGlobsFrom(O.none())).toEqual([]);
      })
    );
  });
});
