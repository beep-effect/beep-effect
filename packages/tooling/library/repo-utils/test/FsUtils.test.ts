import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { exists, FsUtils, FsUtilsLive, findNearestPackageDir } from "@beep/repo-utils/FsUtils";
import { normalizePath } from "@beep/schema";
import { it as rootIt } from "@beep/test-runner";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, vi } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Fs from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Result from "effect/Result";

// Build a TestLayer that provides FsUtils AND also passes through FileSystem/Path
// so tests can use them directly (e.g. for makeTempDirectory)
const PlatformLayer = Layer.mergeAll(NodeServices.layer);
const TestLayer = FsUtilsLive.pipe(Layer.provideMerge(PlatformLayer));

const MemoryTestLayer = FsUtilsLive.pipe(Layer.provideMerge(Layer.mergeAll(MemoryFileSystem.layer, Path.layer)));

/**
 * A memory volume whose `readDirectory` of `/repo/locked` fails with the given
 * system-error tag; every other call reaches the seeded volume.
 */
const deniedReadDirectoryLayer = (reason: "PermissionDenied" | "NotFound") =>
  FsUtilsLive.pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        MemoryFileSystem.layerWith(
          { "/repo/src/a.ts": "", "/repo/locked/b.ts": "" },
          {
            faults: {
              readDirectory: (path: string) =>
                path === "/repo/locked"
                  ? Effect.fail(
                      PlatformError.systemError({
                        _tag: reason,
                        module: "FileSystem",
                        method: "readDirectory",
                        pathOrDescriptor: path,
                      })
                    )
                  : undefined,
            },
          }
        ),
        Path.layer
      )
    )
  );

describe("FsUtils", () => {
  rootIt.layer(TestLayer, { timeout: "10 seconds" })("globFiles patterns", (it) => {
    it.effect(
      "should match files with a pattern",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const results = yield* utils.globFiles("src/**/*.ts", {
          cwd: `${__dirname}/..`,
        });
        expect(results.length).toBeGreaterThan(0);
        expect(A.some(results, Str.includes("index.ts"))).toBe(true);
      })
    );

    it.effect(
      "should return empty array for non-matching pattern",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const results = yield* utils.globFiles("**/*.nonexistent-ext-xyz", {
          cwd: `${__dirname}/..`,
        });
        expect(results).toEqual([]);
      })
    );

    it.effect(
      "should respect ignore option",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const results = yield* utils.globFiles("src/**/*.ts", {
          cwd: `${__dirname}/..`,
          ignore: ["**/errors/**"],
        });
        expect(A.every(results, (r) => !Str.includes("errors/")(r))).toBe(true);
        expect(results).toContain("src/index.ts");
      })
    );

    it.effect(
      "supports array patterns, absolute paths, and deduped matches",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const cwd = `${__dirname}/..`;
        const canonicalCwd = yield* utils.realPath(cwd);
        const results = yield* utils.globFiles(["src/**/*.ts", "src/FsUtils.ts", "src/FsUtils.ts"], {
          cwd,
          absolute: true,
        });
        const normalizedResults = A.map(results, normalizePath);

        expect(results.length).toBeGreaterThan(0);
        expect(A.every(normalizedResults, Str.startsWith(normalizePath(canonicalCwd)))).toBe(true);
        expect(new Set(normalizedResults).size).toBe(normalizedResults.length);
        expect(A.some(normalizedResults, Str.endsWith("/src/FsUtils.ts"))).toBe(true);
      })
    );
  });

  rootIt.layer(TestLayer, { timeout: "10 seconds" })("globFiles", (it) => {
    it.effect(
      "should only return files, not directories",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const results = yield* utils.globFiles("src/**", {
          cwd: `${__dirname}/..`,
        });
        // All results should have file extensions (not bare directory names)
        expect(results.length).toBeGreaterThan(0);
        expect(A.every(results, Str.includes("."))).toBe(true);

        const fs = yield* Fs.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped();
        yield* fs.makeDirectory(`${root}/dotted.dir`);
        yield* fs.writeFileString(`${root}/dotted.dir/inside.ts`, "");
        const files = yield* utils.globFiles("**/*", { cwd: root });
        expect(files).toContain("dotted.dir/inside.ts");
        expect(files).not.toContain("dotted.dir");
        for (const file of files) {
          expect((yield* fs.stat(`${root}/${file}`)).type).toBe("File");
        }
      })
    );
  });

  rootIt.layer(MemoryTestLayer, { timeout: "10 seconds" })("readJson / writeJson", (it) => {
    it.effect(
      "should round-trip JSON through write and read",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        const filePath = `${tmpDir}/test.json`;
        const data = { name: "test-pkg", version: "1.0.0" };

        yield* utils.writeJson(filePath, data);
        const result = yield* utils.readJson(filePath);

        assertSome(result, data);
      })
    );

    it.effect(
      "should write with 2-space indentation and trailing newline",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        const filePath = `${tmpDir}/formatted.json`;
        yield* utils.writeJson(filePath, { a: 1 });

        const raw = yield* fs.readFileString(filePath);
        expect(raw).toBe('{\n  "a": 1\n}\n');
      })
    );

    it.effect(
      "should fail with NoSuchFileError for missing file",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const result = yield* utils
          .readJson("/nonexistent/path/file.json")
          .pipe(Effect.catchTag("NoSuchFileError", (e) => Effect.succeed(`caught: ${e.path}`)));
        expect(result).toBe("caught: /nonexistent/path/file.json");

        const fs = yield* Fs.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped();
        const present = `${root}/present.json`;
        yield* fs.writeFileString(present, '{ "available": true }');
        const readJson1 = yield* utils.readJson(present);
        assertSome(readJson1, { available: true });
      })
    );

    it.effect(
      "should return None for invalid JSON",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        const filePath = `${tmpDir}/bad.json`;
        yield* fs.writeFileString(filePath, "not valid json {{{");

        const result = yield* utils.readJson(filePath);
        assertNone(result);
      })
    );
  });

  rootIt.layer(MemoryTestLayer, { timeout: "10 seconds" })("modifyFile", (it) => {
    it.effect(
      "should modify file content and return true",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        const filePath = `${tmpDir}/modify.txt`;
        yield* fs.writeFileString(filePath, "hello world");

        const changed = yield* utils.modifyFile(filePath, (content) => Str.replace("world", "effect")(content));
        expect(changed).toBe(true);

        const result = yield* fs.readFileString(filePath);
        expect(result).toBe("hello effect");
      })
    );

    it.effect(
      "should return false and not write when content unchanged",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        const writeSpy = yield* Effect.acquireRelease(
          Effect.sync(() => vi.spyOn(fs, "writeFileString")),
          (spy) => Effect.sync(() => spy.mockRestore())
        );
        const filePath = `${tmpDir}/noop.txt`;
        yield* fs.writeFileString(filePath, "unchanged");
        writeSpy.mockClear();

        const changed = yield* utils.modifyFile(filePath, (content) => content);
        expect(changed).toBe(false);
        expect(writeSpy).not.toHaveBeenCalled();
        const readFileString2 = yield* fs.readFileString(filePath);
        expect(readFileString2).toBe("unchanged");

        const changedControl = yield* utils.modifyFile(filePath, () => "changed");
        expect(changedControl).toBe(true);
        expect(writeSpy).toHaveBeenCalledTimes(1);
        const readFileString3 = yield* fs.readFileString(filePath);
        expect(readFileString3).toBe("changed");
      })
    );

    it.effect(
      "should fail with NoSuchFileError for missing file",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const result = yield* utils
          .modifyFile("/nonexistent/file.txt", (c) => c)
          .pipe(Effect.catchTag("NoSuchFileError", (e) => Effect.succeed(`caught: ${e.path}`)));
        expect(result).toBe("caught: /nonexistent/file.txt");

        const fs = yield* Fs.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped();
        const present = `${root}/present.txt`;
        yield* fs.writeFileString(present, "available");
        const modifyFile4 = yield* utils.modifyFile(present, () => "updated");
        expect(modifyFile4).toBe(true);
        const readFileString5 = yield* fs.readFileString(present);
        expect(readFileString5).toBe("updated");
      })
    );
  });

  rootIt.layer(MemoryTestLayer, { timeout: "10 seconds" })("existsOrThrow", (it) => {
    it.effect(
      "should succeed for existing path",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
        yield* utils.existsOrThrow(tmpDir);
      })
    );

    it.effect(
      "should fail for non-existing path",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const result = yield* utils
          .existsOrThrow("/nonexistent/path/xyz")
          .pipe(Effect.catchTag("NoSuchFileError", (e) => Effect.succeed(`caught: ${e.path}`)));
        expect(result).toBe("caught: /nonexistent/path/xyz");

        const fs = yield* Fs.FileSystem;
        const present = yield* fs.makeTempDirectoryScoped();
        const existsOrThrow6 = yield* utils.existsOrThrow(present);
        expect(existsOrThrow6).toBeUndefined();
      })
    );
  });

  rootIt.layer(MemoryTestLayer, { timeout: "10 seconds" })("isDirectory / isFile", (it) => {
    it.effect(
      "should return true for a directory",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        const isDirectory7 = yield* utils.isDirectory(tmpDir);
        expect(isDirectory7).toBe(true);
        const isFile8 = yield* utils.isFile(tmpDir);
        expect(isFile8).toBe(false);
      })
    );

    it.effect(
      "should return true for a file",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
        const tmpFile = `${tmpDir}/file`;
        yield* fs.writeFileString(tmpFile, "");

        const isFile9 = yield* utils.isFile(tmpFile);
        expect(isFile9).toBe(true);
        const isDirectory10 = yield* utils.isDirectory(tmpFile);
        expect(isDirectory10).toBe(false);
      })
    );
  });

  rootIt.layer(MemoryTestLayer, { timeout: "10 seconds" })("getParentDirectory", (it) => {
    it.effect(
      "should return the parent directory",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const parent = yield* utils.getParentDirectory("/foo/bar/baz.ts");
        expect(parent).toBe("/foo/bar");
      })
    );

    it.effect(
      "should handle root path",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const parent = yield* utils.getParentDirectory("/");
        expect(parent).toBe("/");
      })
    );
  });

  rootIt.layer(MemoryTestLayer, { timeout: "10 seconds" })("globFiles traversal", (it) => {
    it.effect(
      "should return an empty array for a missing root",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const files = yield* utils.globFiles("nonexistent/root/xyz/**", { cwd: "/" });
        expect(files).toEqual([]);
        // The walk root may be missing; the cwd a relative pattern resolves against may not.
        const missingCwd = yield* Effect.flip(utils.globFiles("**", { cwd: "/nonexistent/root/xyz" }));
        expect(missingCwd._tag).toBe("DomainError");

        const fs = yield* Fs.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped();
        const present = `${root}/present.ts`;
        yield* fs.writeFileString(present, "");
        const globFiles11 = yield* utils.globFiles("**", { cwd: root, absolute: true });
        expect(globFiles11).toEqual([present]);
      })
    );

    it.effect(
      "should sort the flat result globally by path, not per directory level",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        yield* fs.makeDirectory(`${tmpDir}/a`);
        yield* fs.writeFileString(`${tmpDir}/a/x.ts`, "");
        yield* fs.writeFileString(`${tmpDir}/a.ts`, "");

        const files = yield* utils.globFiles("**", { cwd: tmpDir, absolute: true });
        // Global path order places "a.ts" before "a/x.ts" ('.' < '/');
        // a per-level DFS sort would descend "a" first and invert them.
        expect(files).toEqual([`${tmpDir}/a.ts`, `${tmpDir}/a/x.ts`]);
      })
    );

    it.effect(
      "should prune a **/<name>/** ignore by exact directory name and filter by the include pattern",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        yield* fs.makeDirectory(`${tmpDir}/src`);
        yield* fs.writeFileString(`${tmpDir}/src/keep.ts`, "");
        yield* fs.writeFileString(`${tmpDir}/src/skip.txt`, "");
        yield* fs.makeDirectory(`${tmpDir}/node_modules/dep`, {
          recursive: true,
        });
        yield* fs.writeFileString(`${tmpDir}/node_modules/dep/index.ts`, "");
        yield* fs.makeDirectory(`${tmpDir}/node_modules_extra`);
        yield* fs.writeFileString(`${tmpDir}/node_modules_extra/kept.ts`, "");

        const files = yield* utils.globFiles("**/*.ts", {
          cwd: tmpDir,
          absolute: true,
          ignore: ["**/node_modules/**"],
        });

        expect(files).toEqual([`${tmpDir}/node_modules_extra/kept.ts`, `${tmpDir}/src/keep.ts`]);
      })
    );

    it.effect(
      "should not apply the walker's default prune when no ignore names a directory",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        yield* fs.makeDirectory(`${tmpDir}/node_modules/dep`, { recursive: true });
        yield* fs.writeFileString(`${tmpDir}/node_modules/dep/index.ts`, "");
        yield* fs.writeFileString(`${tmpDir}/root.ts`, "");

        const globFiles12 = yield* utils.globFiles("**/*.ts", { cwd: tmpDir });
        expect(globFiles12).toEqual(["node_modules/dep/index.ts", "root.ts"]);
        const globFiles13 = yield* utils.globFiles("**/*.ts", { cwd: tmpDir, ignore: "node_modules" });
        expect(globFiles13).toEqual(["root.ts"]);
      })
    );

    rootIt.layer(TestLayer, { timeout: "10 seconds" })((it) => {
      it.effect(
        "should match symlinked files but never enter symlinked directories by default",
        Effect.fn(function* () {
          const utils = yield* FsUtils;
          const fs = yield* Fs.FileSystem;
          const tmpDir = yield* fs.makeTempDirectoryScoped();

          yield* fs.writeFileString(`${tmpDir}/real.ts`, "");
          yield* fs.symlink(`${tmpDir}/real.ts`, `${tmpDir}/link.ts`);
          yield* fs.makeDirectory(`${tmpDir}/pkg`);
          yield* fs.writeFileString(`${tmpDir}/pkg/index.ts`, "");
          yield* fs.symlink(`${tmpDir}/pkg`, `${tmpDir}/alias`);

          const files = yield* utils.globFiles("**/*.ts", { cwd: tmpDir });
          expect(A.sort(files, Order.String)).toEqual(["link.ts", "pkg/index.ts", "real.ts"]);

          const followed = yield* utils.globFiles("**/*.ts", { cwd: tmpDir, followSymlinks: true });
          expect(followed).toEqual(["alias/index.ts", "link.ts", "pkg/index.ts", "real.ts"]);
        })
      );
    });

    rootIt.layer(TestLayer, { timeout: "10 seconds" })((it) => {
      it.effect(
        "should terminate on a symlink directory cycle under followSymlinks",
        Effect.fn(function* () {
          const utils = yield* FsUtils;
          const fs = yield* Fs.FileSystem;
          const tmpDir = yield* fs.makeTempDirectoryScoped();

          yield* fs.makeDirectory(`${tmpDir}/pkg`);
          yield* fs.writeFileString(`${tmpDir}/pkg/index.ts`, "");
          // A self-referential loop: pkg/loop -> pkg
          yield* fs.symlink(`${tmpDir}/pkg`, `${tmpDir}/pkg/loop`);

          const files = yield* utils.globFiles("**", {
            cwd: tmpDir,
            absolute: true,
            followSymlinks: true,
          });
          expect(files).toEqual([`${tmpDir}/pkg/index.ts`]);
        })
      );
    });

    rootIt.layer(TestLayer, { timeout: "10 seconds" })((it) => {
      it.effect(
        "should match an absolute pattern from its filesystem root and return absolute paths",
        Effect.fn(function* () {
          const utils = yield* FsUtils;
          const fs = yield* Fs.FileSystem;
          const madeTempDirectoryScoped = yield* fs.makeTempDirectoryScoped();
          const tmpDir = yield* fs.realPath(madeTempDirectoryScoped);

          yield* fs.makeDirectory(`${tmpDir}/src`);
          yield* fs.writeFileString(`${tmpDir}/src/a.ts`, "");
          yield* fs.writeFileString(`${tmpDir}/src/b.md`, "");

          const files = yield* utils.globFiles(`${tmpDir}/src/**/*.ts`, { cwd: "/nonexistent/cwd" });
          expect(files).toEqual([`${tmpDir}/src/a.ts`]);
        })
      );
    });

    // Deterministic in every profile: the walk's readDirectory fault is injected, so the
    // typed failure never depends on the process's uid or capabilities.
    rootIt.layer(deniedReadDirectoryLayer("PermissionDenied"), { timeout: "10 seconds" })((it) => {
      it.effect(
        "should fail with DomainError when readDirectory is denied mid-walk (injected fault)",
        Effect.fn(function* () {
          const utils = yield* FsUtils;

          const error = yield* utils.globFiles("**/*.ts", { cwd: "/repo", ignore: ["locked/**"] }).pipe(Effect.flip);
          expect(error._tag).toBe("DomainError");
          expect(error.message).toBe('Glob failed for pattern "**/*.ts"');
          // globFiles maps every failure to the same message, so pin the walker's unreadable
          // branch: any other DomainError (e.g. a missing cwd) must not satisfy this case.
          expect(error.cause).toMatchObject({
            _tag: "GlobExpansionError",
            cause: { _tag: "DescendError", reason: "unreadableDirectory", path: "locked" },
          });
        })
      );
    });

    // Contrast: a directory that vanishes mid-walk (NotFound) is a benign race, not a failure.
    rootIt.layer(deniedReadDirectoryLayer("NotFound"), { timeout: "10 seconds" })((it) => {
      it.effect(
        "should skip a directory whose readDirectory fails NotFound (injected fault)",
        Effect.fn(function* () {
          const utils = yield* FsUtils;
          const globFiles14 = yield* utils.globFiles("**/*.ts", { cwd: "/repo" });
          expect(globFiles14).toEqual(["src/a.ts"]);
        })
      );
    });

    rootIt.layer(TestLayer, { timeout: "10 seconds" })((it) => {
      it.effect(
        "should fail with DomainError when a directory mid-walk is unreadable",
        Effect.fn(function* (ctx) {
          const utils = yield* FsUtils;
          const fs = yield* Fs.FileSystem;
          const tmpDir = yield* fs.makeTempDirectoryScoped();

          yield* fs.makeDirectory(`${tmpDir}/locked`);
          yield* fs.writeFileString(`${tmpDir}/locked/a.ts`, "");
          yield* fs.chmod(`${tmpDir}/locked`, 0o000);

          // Real OS permission enforcement is a property of the running process: uid 0 (or
          // CAP_DAC_OVERRIDE) reads a mode-000 directory. When the probe read succeeds this
          // case cannot qualify, so it is reported as skipped, never as passed; the injected
          // fault cases above still cover the error branch.
          // Expected log noise: vitest's ctx.skip throws, so inside Effect.sync it travels the
          // Effect defect channel and @effect/vitest logs one "ERROR ... test is skipped; abort
          // execution" line before rethrowing. The reported outcome is still SKIP (the rethrown
          // value keeps vitest's skip identity); the line is not a failure.
          const probe = yield* Effect.result(fs.readDirectory(`${tmpDir}/locked`));
          if (Result.isSuccess(probe)) {
            yield* fs.chmod(`${tmpDir}/locked`, 0o755);
            return yield* Effect.sync(() =>
              ctx.skip("OS does not enforce directory read permission for this process (uid 0 or CAP_DAC_OVERRIDE)")
            );
          }

          const error = yield* utils.globFiles("**/*.ts", { cwd: tmpDir, ignore: ["locked/**"] }).pipe(Effect.flip);
          expect(error._tag).toBe("DomainError");
          expect(error.message).toBe('Glob failed for pattern "**/*.ts"');

          yield* fs.chmod(`${tmpDir}/locked`, 0o755);
          const globFiles15 = yield* utils.globFiles("**/*.ts", { cwd: tmpDir });
          expect(globFiles15).toEqual(["locked/a.ts"]);
        })
      );
    });
  });

  rootIt.layer(MemoryTestLayer, { timeout: "10 seconds" })("exists", (it) => {
    it.effect(
      "should return true for an existing path",
      Effect.fn(function* () {
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
        const exists16 = yield* exists(tmpDir);
        expect(exists16).toBe(true);
      })
    );

    it.effect(
      "should return false and never fail for a missing path",
      Effect.fn(function* () {
        // No error channel to catch: the success value is total.
        const exists17 = yield* exists("/nonexistent/path/xyz");
        expect(exists17).toBe(false);

        const fs = yield* Fs.FileSystem;
        const present = yield* fs.makeTempDirectoryScoped();
        const exists18 = yield* exists(present);
        expect(exists18).toBe(true);
      })
    );
  });

  rootIt.layer(MemoryTestLayer, { timeout: "10 seconds" })("findNearestPackageDir", (it) => {
    it.effect(
      "should find the nearest ancestor directory containing a package.json",
      Effect.fn(function* () {
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
        const canonicalRoot = yield* fs.realPath(tmpDir);
        const pkgDir = `${canonicalRoot}/packages/pkg-a`;
        const nested = `${pkgDir}/src/nested`;

        yield* fs.makeDirectory(nested, { recursive: true });
        yield* fs.writeFileString(`${pkgDir}/package.json`, '{ "name": "@mock/pkg-a" }');

        const owning = yield* findNearestPackageDir(nested, canonicalRoot);
        assertSome(owning, pkgDir);
      })
    );

    it.effect(
      "should treat the stopAt boundary as exclusive",
      Effect.fn(function* () {
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
        const canonicalRoot = yield* fs.realPath(tmpDir);
        const nested = `${canonicalRoot}/packages/pkg-a`;

        yield* fs.makeDirectory(nested, { recursive: true });
        // package.json lives exactly at the boundary; it must not be returned.
        yield* fs.writeFileString(`${canonicalRoot}/package.json`, '{ "name": "@mock/root" }');

        const owning = yield* findNearestPackageDir(nested, canonicalRoot);
        assertNone(owning);
      })
    );

    it.effect(
      "should support the data-last form",
      Effect.fn(function* () {
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
        const canonicalRoot = yield* fs.realPath(tmpDir);
        const pkgDir = `${canonicalRoot}/packages/pkg-b`;
        const nested = `${pkgDir}/src`;

        yield* fs.makeDirectory(nested, { recursive: true });
        yield* fs.writeFileString(`${pkgDir}/package.json`, '{ "name": "@mock/pkg-b" }');

        const owning = yield* pipe(nested, findNearestPackageDir(canonicalRoot));
        assertSome(owning, pkgDir);
      })
    );
  });
});
