// The option-bearing cases of the retired `@beep/utils/Glob` suite, retargeted
// to `FsUtils.globFiles` and its `GlobOptions`: ignore filters, array patterns,
// `absolute`, and the implicit cwd. The walker suite owns the pure matching cases.

import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { FsUtils, FsUtilsLive, GlobOptions } from "@beep/repo-utils/FsUtils";
import { it as rootIt } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const TestLayer = FsUtilsLive.pipe(Layer.provideMerge(Layer.mergeAll(MemoryFileSystem.layer, Path.layer)));

const encode = (value: GlobOptions): typeof GlobOptions.Encoded =>
  Result.getOrThrow(S.encodeResult(GlobOptions)(value));

const decode = (value: typeof GlobOptions.Encoded): GlobOptions =>
  Result.getOrThrow(S.decodeResult(GlobOptions)(value));

const makeFixture = Effect.fn("FsUtilsGlobTest.makeFixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const madeTempDirectoryScoped = yield* fs.makeTempDirectoryScoped({ prefix: "beep-repo-utils-glob-" });
  const dir = yield* fs.realPath(madeTempDirectoryScoped);

  yield* fs.makeDirectory(`${dir}/src/errors`, { recursive: true });
  yield* fs.makeDirectory(`${dir}/src/nested`, { recursive: true });
  yield* fs.writeFileString(`${dir}/src/index.ts`, "");
  yield* fs.writeFileString(`${dir}/src/errors/problem.ts`, "");
  yield* fs.writeFileString(`${dir}/src/nested/deep.ts`, "");
  yield* fs.writeFileString(`${dir}/README.md`, "");

  return dir;
});

describe("FsUtils GlobOptions schema parity", () => {
  rootIt("preserves representative encoded option shapes", () => {
    expect(encode(GlobOptions.make({}))).toEqual({});
    expect(
      encode(
        GlobOptions.make({
          absolute: true,
          cwd: ".",
          dot: false,
          followSymlinks: true,
          ignore: ["dist/**"],
        })
      )
    ).toEqual({
      absolute: true,
      cwd: ".",
      dot: false,
      followSymlinks: true,
      ignore: ["dist/**"],
    });
    expect(encode(GlobOptions.make({ ignore: "dist/**" }))).toEqual({ ignore: "dist/**" });
  });

  rootIt.prop(
    "round-trips GlobOptions",
    { value: GlobOptions },
    ({ value }) => {
      const decoded = decode(encode(GlobOptions.make(value)));
      expect(S.toEquivalence(GlobOptions)(decoded, GlobOptions.make(value))).toBe(true);
    },
    { arbitrary: fcRuns(50) }
  );
});

rootIt.layer(TestLayer, { timeout: "10 seconds" })("FsUtils.globFiles, retired Glob cases", (it) => {
  it.effect("supports array patterns, ignore filters, and deduped deterministic output", () =>
    Effect.gen(function* () {
      const utils = yield* FsUtils;
      const dir = yield* makeFixture();
      const results = yield* utils.globFiles(["src/**/*.ts", "src/index.ts"], {
        cwd: dir,
        ignore: ["**/nested/**", "**/errors/**"],
      });

      expect(results).toEqual(["src/index.ts"]);
    })
  );

  it.effect("resolves an omitted cwd the same as an explicit current directory", () =>
    Effect.gen(function* () {
      const utils = yield* FsUtils;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      yield* fs.makeDirectory(path.resolve("."), { recursive: true });
      yield* fs.writeFileString(path.resolve("package.json"), "{}");
      const implicitResults = yield* utils.globFiles("package.json");
      const explicitResults = yield* utils.globFiles("package.json", { cwd: "." });

      expect(implicitResults).toEqual(["package.json"]);
      expect(explicitResults).toEqual(implicitResults);
    })
  );

  it.effect("returns absolute file paths with an ignore filter applied", () =>
    Effect.gen(function* () {
      const utils = yield* FsUtils;
      const dir = yield* makeFixture();
      const results = yield* utils.globFiles("src/**", {
        absolute: true,
        cwd: dir,
        ignore: ["**/errors/**"],
      });

      expect(results).toEqual([`${dir}/src/index.ts`, `${dir}/src/nested/deep.ts`]);
    })
  );

  it.effect.each(["src/errors", "src/errors/", "src/errors/**"])(
    "applies the %s directory ignore consistently",
    (ignore) =>
      Effect.gen(function* () {
        const utils = yield* FsUtils;
        const dir = yield* makeFixture();
        const results = yield* utils.globFiles("src/**", { cwd: dir, ignore });

        expect(results).toEqual(["src/index.ts", "src/nested/deep.ts"]);
      })
  );
});

rootIt.layer(TestLayer, { timeout: "10 seconds" })("FsUtils.globFiles, pattern normalization", (it) => {
  it.effect("treats a leading-bang include pattern as an exclusion", () =>
    Effect.gen(function* () {
      const utils = yield* FsUtils;
      const dir = yield* makeFixture();
      const results = yield* utils.globFiles(["src/**/*.ts", "!src/nested/**"], { cwd: dir });

      expect(results).toEqual(["src/errors/problem.ts", "src/index.ts"]);
      const globFiles1 = yield* utils.globFiles("!src/**", { cwd: dir });
      expect(globFiles1).toEqual([]);
    })
  );

  it.effect("drops a leading ./ and repeated slashes from patterns and results", () =>
    Effect.gen(function* () {
      const utils = yield* FsUtils;
      const dir = yield* makeFixture();

      const globFiles2 = yield* utils.globFiles(["./src/*.ts", "src/*.ts"], { cwd: dir });
      expect(globFiles2).toEqual(["src/index.ts"]);
      const globFiles3 = yield* utils.globFiles("src//index.ts", { cwd: dir });
      expect(globFiles3).toEqual(["src/index.ts"]);
      const globFiles4 = yield* utils.globFiles(["./src/*.ts", "src/*.ts"], { cwd: dir, absolute: true });
      expect(globFiles4).toEqual([`${dir}/src/index.ts`]);
    })
  );

  it.effect("walks a leading ../ climb from the directory it reaches and keeps the climb in results", () =>
    Effect.gen(function* () {
      const utils = yield* FsUtils;
      const dir = yield* makeFixture();
      const results = yield* utils.globFiles("../src/*.ts", { cwd: `${dir}/src/nested` });

      expect(results).toEqual([]);
      const globFiles5 = yield* utils.globFiles("../*.ts", { cwd: `${dir}/src/nested` });
      expect(globFiles5).toEqual(["../index.ts"]);
      const globFiles6 = yield* utils.globFiles("../../README.md", { cwd: `${dir}/src/nested` });
      expect(globFiles6).toEqual(["../../README.md"]);
    })
  );

  it.effect("applies an absolute ignore pattern to an absolute include pattern", () =>
    Effect.gen(function* () {
      const utils = yield* FsUtils;
      const dir = yield* makeFixture();
      const results = yield* utils.globFiles(`${dir}/src/**/*.ts`, { ignore: `${dir}/src/nested/**` });

      expect(results).toEqual([`${dir}/src/errors/problem.ts`, `${dir}/src/index.ts`]);
    })
  );

  it.effect("fails when a relative pattern's cwd is missing or not a directory", () =>
    Effect.gen(function* () {
      const utils = yield* FsUtils;
      const dir = yield* makeFixture();
      const missing = yield* Effect.flip(utils.globFiles("**", { cwd: `${dir}/missing` }));
      const file = yield* Effect.flip(utils.globFiles("**", { cwd: `${dir}/README.md` }));

      expect(missing._tag).toBe("DomainError");
      expect(file._tag).toBe("DomainError");
      const globFiles7 = yield* utils.globFiles(`${dir}/src/*.ts`, { cwd: `${dir}/missing` });
      expect(globFiles7).toEqual([`${dir}/src/index.ts`]);
    })
  );
});
