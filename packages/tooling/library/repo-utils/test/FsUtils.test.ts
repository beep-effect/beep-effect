import { exists, FsUtils, FsUtilsLive, findNearestPackageDir, walkFiles } from "@beep/repo-utils/FsUtils";
import { normalizePath } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, Order, pipe } from "effect";
import * as Fs from "effect/FileSystem";
import * as O from "effect/Option";

// Build a TestLayer that provides FsUtils AND also passes through FileSystem/Path
// so tests can use them directly (e.g. for makeTempDirectory)
const PlatformLayer = Layer.mergeAll(NodeServices.layer);
const TestLayer = FsUtilsLive.pipe(Layer.provideMerge(PlatformLayer));

layer(TestLayer)("FsUtils", (it) => {
  describe("glob", () => {
    it.effect(
      "should match files with a pattern",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const results = yield* utils.glob("src/**/*.ts", {
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
        const results = yield* utils.glob("**/*.nonexistent-ext-xyz", {
          cwd: `${__dirname}/..`,
        });
        expect(results).toEqual([]);
      })
    );

    it.effect(
      "should respect ignore option",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const results = yield* utils.glob("src/**/*.ts", {
          cwd: `${__dirname}/..`,
          ignore: ["**/errors/**"],
        });
        expect(A.every(results, (r) => !Str.includes("errors/")(r))).toBe(true);
      })
    );

    it.effect(
      "supports array patterns, absolute paths, and deduped matches",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const cwd = `${__dirname}/..`;
        const canonicalCwd = yield* utils.realPath(cwd);
        const results = yield* utils.glob(["src/**/*.ts", "src/FsUtils.ts", "src/FsUtils.ts"], {
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

  describe("globFiles", () => {
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
      })
    );
  });

  describe("readJson / writeJson", () => {
    it.effect(
      "should round-trip JSON through write and read",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();

        const filePath = `${tmpDir}/test.json`;
        const data = { name: "test-pkg", version: "1.0.0" };

        yield* utils.writeJson(filePath, data);
        const result = yield* utils.readJson(filePath);

        expect(result).toEqual(O.some(data));

        // Clean up
        yield* fs.remove(tmpDir, { recursive: true });
      })
    );

    it.effect(
      "should write with 2-space indentation and trailing newline",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();

        const filePath = `${tmpDir}/formatted.json`;
        yield* utils.writeJson(filePath, { a: 1 });

        const raw = yield* fs.readFileString(filePath);
        expect(raw).toBe('{\n  "a": 1\n}\n');

        yield* fs.remove(tmpDir, { recursive: true });
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
      })
    );

    it.effect(
      "should return None for invalid JSON",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();

        const filePath = `${tmpDir}/bad.json`;
        yield* fs.writeFileString(filePath, "not valid json {{{");

        const result = yield* utils.readJson(filePath);
        expect(result).toEqual(O.none());

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );
  });

  describe("modifyFile", () => {
    it.effect(
      "should modify file content and return true",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();

        const filePath = `${tmpDir}/modify.txt`;
        yield* fs.writeFileString(filePath, "hello world");

        const changed = yield* utils.modifyFile(filePath, (content) => Str.replace("world", "effect")(content));
        expect(changed).toBe(true);

        const result = yield* fs.readFileString(filePath);
        expect(result).toBe("hello effect");

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );

    it.effect(
      "should return false and not write when content unchanged",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();

        const filePath = `${tmpDir}/noop.txt`;
        yield* fs.writeFileString(filePath, "unchanged");

        const changed = yield* utils.modifyFile(filePath, (content) => content);
        expect(changed).toBe(false);

        yield* fs.remove(tmpDir, { recursive: true });
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
      })
    );
  });

  describe("existsOrThrow", () => {
    it.effect(
      "should succeed for existing path",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();
        yield* utils.existsOrThrow(tmpDir);
        yield* fs.remove(tmpDir, { recursive: true });
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
      })
    );
  });

  describe("isDirectory / isFile", () => {
    it.effect(
      "should return true for a directory",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();

        expect(yield* utils.isDirectory(tmpDir)).toBe(true);
        expect(yield* utils.isFile(tmpDir)).toBe(false);

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );

    it.effect(
      "should return true for a file",
      Effect.fn(function* () {
        const utils = yield* FsUtils;
        const fs = yield* Fs.FileSystem;
        const tmpFile = yield* fs.makeTempFile();

        expect(yield* utils.isFile(tmpFile)).toBe(true);
        expect(yield* utils.isDirectory(tmpFile)).toBe(false);

        yield* fs.remove(tmpFile);
      })
    );
  });

  describe("getParentDirectory", () => {
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

  describe("walkFiles", () => {
    it.effect(
      "should return an empty array for a missing root",
      Effect.fn(function* () {
        const files = yield* walkFiles("/nonexistent/root/xyz");
        expect(files).toEqual([]);
      })
    );

    it.effect(
      "should sort the flat result globally by path, not per directory level",
      Effect.fn(function* () {
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();

        yield* fs.makeDirectory(`${tmpDir}/a`);
        yield* fs.writeFileString(`${tmpDir}/a/x.ts`, "");
        yield* fs.writeFileString(`${tmpDir}/a.ts`, "");

        const files = yield* pipe(tmpDir, walkFiles());
        // Global path order places "a.ts" before "a/x.ts" ('.' < '/');
        // a per-level DFS sort would descend "a" first and invert them.
        expect(files).toEqual([`${tmpDir}/a.ts`, `${tmpDir}/a/x.ts`]);

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );

    it.effect(
      "should prune skipDirectories by exact base name and apply the include predicate",
      Effect.fn(function* () {
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();

        yield* fs.makeDirectory(`${tmpDir}/src`);
        yield* fs.writeFileString(`${tmpDir}/src/keep.ts`, "");
        yield* fs.writeFileString(`${tmpDir}/src/skip.txt`, "");
        yield* fs.makeDirectory(`${tmpDir}/node_modules/dep`, { recursive: true });
        yield* fs.writeFileString(`${tmpDir}/node_modules/dep/index.ts`, "");

        const files = yield* walkFiles(tmpDir, {
          skipDirectories: ["node_modules"],
          include: (_filePath, name) => Str.endsWith(".ts")(name),
        });

        expect(files).toEqual([`${tmpDir}/src/keep.ts`]);

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );

    it.effect(
      "should exclude symlinked entries under the skip-symlinks guard",
      Effect.fn(function* () {
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();

        yield* fs.writeFileString(`${tmpDir}/real.ts`, "");
        yield* fs.symlink(`${tmpDir}/real.ts`, `${tmpDir}/link.ts`);

        const followed = yield* walkFiles(tmpDir);
        expect(A.sort(followed, Order.String)).toEqual([`${tmpDir}/link.ts`, `${tmpDir}/real.ts`]);

        const guarded = yield* walkFiles(tmpDir, { symlinkGuard: "skip-symlinks" });
        expect(guarded).toEqual([`${tmpDir}/real.ts`]);

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );

    it.effect(
      "should terminate on a symlink directory cycle under the guard-cycles guard",
      Effect.fn(function* () {
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();

        yield* fs.makeDirectory(`${tmpDir}/pkg`);
        yield* fs.writeFileString(`${tmpDir}/pkg/index.ts`, "");
        // A self-referential loop: pkg/loop -> pkg
        yield* fs.symlink(`${tmpDir}/pkg`, `${tmpDir}/pkg/loop`);

        const files = yield* walkFiles(tmpDir, { symlinkGuard: "guard-cycles" });
        expect(files).toEqual([`${tmpDir}/pkg/index.ts`]);

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );
  });

  describe("exists", () => {
    it.effect(
      "should return true for an existing path",
      Effect.fn(function* () {
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();
        expect(yield* exists(tmpDir)).toBe(true);
        yield* fs.remove(tmpDir, { recursive: true });
      })
    );

    it.effect(
      "should return false and never fail for a missing path",
      Effect.fn(function* () {
        // No error channel to catch: the success value is total.
        expect(yield* exists("/nonexistent/path/xyz")).toBe(false);
      })
    );
  });

  describe("findNearestPackageDir", () => {
    it.effect(
      "should find the nearest ancestor directory containing a package.json",
      Effect.fn(function* () {
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();
        const canonicalRoot = yield* fs.realPath(tmpDir);
        const pkgDir = `${canonicalRoot}/packages/pkg-a`;
        const nested = `${pkgDir}/src/nested`;

        yield* fs.makeDirectory(nested, { recursive: true });
        yield* fs.writeFileString(`${pkgDir}/package.json`, '{ "name": "@mock/pkg-a" }');

        const owning = yield* findNearestPackageDir(nested, canonicalRoot);
        expect(owning).toStrictEqual(O.some(pkgDir));

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );

    it.effect(
      "should treat the stopAt boundary as exclusive",
      Effect.fn(function* () {
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();
        const canonicalRoot = yield* fs.realPath(tmpDir);
        const nested = `${canonicalRoot}/packages/pkg-a`;

        yield* fs.makeDirectory(nested, { recursive: true });
        // package.json lives exactly at the boundary; it must not be returned.
        yield* fs.writeFileString(`${canonicalRoot}/package.json`, '{ "name": "@mock/root" }');

        const owning = yield* findNearestPackageDir(nested, canonicalRoot);
        expect(owning).toStrictEqual(O.none());

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );

    it.effect(
      "should support the data-last form",
      Effect.fn(function* () {
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();
        const canonicalRoot = yield* fs.realPath(tmpDir);
        const pkgDir = `${canonicalRoot}/packages/pkg-b`;
        const nested = `${pkgDir}/src`;

        yield* fs.makeDirectory(nested, { recursive: true });
        yield* fs.writeFileString(`${pkgDir}/package.json`, '{ "name": "@mock/pkg-b" }');

        const owning = yield* pipe(nested, findNearestPackageDir(canonicalRoot));
        expect(owning).toStrictEqual(O.some(pkgDir));

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );
  });
});
