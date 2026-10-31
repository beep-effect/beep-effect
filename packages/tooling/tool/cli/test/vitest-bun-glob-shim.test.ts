import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { assertFalse, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Str from "effect/String";

// Parity for the Bun.Glob shim that vitest.setup.ts installs for Node runs (effected-promotion R2a,
// W4-p): the same suite runs on Bun against the native Bun.Glob and on Node against the shim, so every
// expectation below is a verdict both runtimes must share. The match cases are the patterns the repo
// hands to `new Bun.Glob(...)` plus the dot and trailing-globstar semantics the shim's matcher switch
// (picomatch to `@beep/glob` GlobPattern) moved onto Bun's side, and the leading `#` (a literal for
// Bun, a comment for minimatch unless `nocomment`) and leading `!` (a negation for both) probes.
const matchCases: ReadonlyArray<readonly [pattern: string, path: string, expected: boolean]> = [
  ["**/*.ts", "src/index.ts", true],
  ["**/*.ts", "index.ts", true],
  ["**/*.ts", ".hidden/index.ts", true],
  ["**/*.ts", "src/index.tsx", false],
  ["*.json", "package.json", true],
  ["*.json", "nested/package.json", false],
  ["*", ".env", true],
  ["*", "a/b", false],
  ["**/*", "a", true],
  ["**/*", ".a/b", true],
  ["**/package.json", "package.json", true],
  ["**/package.json", "packages/x/package.json", true],
  ["test/**/*.test.{ts,tsx}", "test/deep/a.test.tsx", true],
  ["test/**/*.test.{ts,tsx}", "test/a.test.js", false],
  ["a/**", "a", false],
  ["a/**", "a/", true],
  ["a/**", "a/b/c", true],
  ["packages/**/test/**", "packages/x/test", false],
  ["packages/**/test/**", "packages/x/test/a.ts", true],
  ["src/**/*.ts/**", "src/x.ts", false],
  ["#a", "#a", true],
  ["#*", "#foo", true],
  ["#a", "a", false],
  ["!a", "b", true],
  ["!a", "a", false],
  ["!*.ts", "x.js", true],
];

const fixtureFiles: ReadonlyArray<string> = [
  "a.ts",
  "b.json",
  ".env",
  "src/index.ts",
  "src/nested/deep.ts",
  "src/.hidden/x.ts",
  "test/a.test.ts",
];

const scan = (
  pattern: string,
  options: { readonly cwd: string; readonly dot?: boolean; readonly onlyFiles?: boolean }
) => A.sort(Str.Order)(A.fromIterable(new Bun.Glob(pattern).scanSync(options)));

it.layer(NodeServices.layer)("Bun.Glob shim parity", (it) => {
  it.effect("match agrees across runtimes on the repo's patterns and the dot and globstar probes", () =>
    Effect.sync(() => {
      A.forEach(matchCases, ([pattern, path, expected]) => {
        const actual = new Bun.Glob(pattern).match(path);
        if (expected) assertTrue(actual, `${pattern} should match ${path}`);
        else assertFalse(actual, `${pattern} should not match ${path}`);
      });
    })
  );

  it.effect("scanSync lists the same files, directories and dotfiles across runtimes", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const cwd = yield* fs.realPath(yield* fs.makeTempDirectoryScoped());
      yield* Effect.forEach(fixtureFiles, (file) =>
        Effect.gen(function* () {
          yield* fs.makeDirectory(path.dirname(path.join(cwd, file)), { recursive: true });
          yield* fs.writeFileString(path.join(cwd, file), "");
        })
      );

      deepStrictEqual(scan("**/*.ts", { cwd }), ["a.ts", "src/index.ts", "src/nested/deep.ts", "test/a.test.ts"]);
      deepStrictEqual(scan("**/*.ts", { cwd, dot: true }), [
        "a.ts",
        "src/.hidden/x.ts",
        "src/index.ts",
        "src/nested/deep.ts",
        "test/a.test.ts",
      ]);
      // scanSync lists files only unless `onlyFiles: false` asks for directories too.
      deepStrictEqual(scan("*", { cwd }), ["a.ts", "b.json"]);
      deepStrictEqual(scan("*", { cwd, dot: true }), [".env", "a.ts", "b.json"]);
      deepStrictEqual(scan("*", { cwd, onlyFiles: false }), ["a.ts", "b.json", "src", "test"]);
      deepStrictEqual(scan("*", { cwd, dot: true, onlyFiles: false }), [".env", "a.ts", "b.json", "src", "test"]);
      deepStrictEqual(scan("*.json", { cwd }), ["b.json"]);
      deepStrictEqual(scan("src/**/*", { cwd }), ["src/index.ts", "src/nested/deep.ts"]);
      deepStrictEqual(scan("src/**/*", { cwd, onlyFiles: false }), [
        "src/index.ts",
        "src/nested",
        "src/nested/deep.ts",
      ]);
      deepStrictEqual(scan("src/**/*", { cwd, dot: true, onlyFiles: false }), [
        "src/.hidden",
        "src/.hidden/x.ts",
        "src/index.ts",
        "src/nested",
        "src/nested/deep.ts",
      ]);
      deepStrictEqual(scan("src/**", { cwd, onlyFiles: false }), ["src/index.ts", "src/nested", "src/nested/deep.ts"]);
      deepStrictEqual(scan("src", { cwd, onlyFiles: false }), ["src"]);
      deepStrictEqual(scan("**/*", { cwd }), [
        "a.ts",
        "b.json",
        "src/index.ts",
        "src/nested/deep.ts",
        "test/a.test.ts",
      ]);
      deepStrictEqual(scan("**/*", { cwd, onlyFiles: false }), [
        "a.ts",
        "b.json",
        "src",
        "src/index.ts",
        "src/nested",
        "src/nested/deep.ts",
        "test",
        "test/a.test.ts",
      ]);
      deepStrictEqual(scan("test/**/*.test.{ts,tsx}", { cwd }), ["test/a.test.ts"]);
    })
  );
});
