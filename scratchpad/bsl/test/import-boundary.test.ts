/** Executable proof of the core, PostgreSQL, and SQLite import DAG. */
import { describe, expect, it } from "bun:test";
import { gen, runPromise, tryPromise } from "effect/Effect";
import { flatMap, fromIterable, getSomes, zip } from "effect/Array";
import { fromUndefinedOr, map } from "effect/Option";

const importPattern = /(?:from\s*|import\s*)["']([^"']+)["']/g;

const forbiddenImports = (
  directory: "core" | "pg" | "sqlite",
  forbiddenFragments: ReadonlyArray<string>,
  forbidWorkspaceImports = false,
) =>
  gen(function* () {
    const directoryUrl = new URL(`../src/${directory}/`, import.meta.url);
    const files = fromIterable<string>(
      new Bun.Glob("**/*.ts").scanSync({ cwd: directoryUrl.pathname }),
    );
    const sources = yield* tryPromise(() =>
      Promise.all(files.map((file) => Bun.file(new URL(file, directoryUrl)).text())),
    );
    const imports = flatMap(zip(files, sources), ([file, source]) =>
      getSomes(
        fromIterable<RegExpExecArray>(source.matchAll(importPattern)).map((match) =>
          map(fromUndefinedOr(match[1]), (specifier) => ({ file, specifier })),
        ),
      ),
    );
    return imports.filter(({ specifier }) =>
      (forbidWorkspaceImports && specifier.startsWith("@beep/")) ||
      forbiddenFragments.some((part) => specifier.includes(part))
    );
  });

describe("dialect import boundaries", () => {
  it("keeps core independent of both dialects and workspace packages", () =>
    runPromise(
      gen(function* () {
        const forbidden = yield* forbiddenImports("core", ["../pg", "../sqlite"], true);
        expect(forbidden).toEqual([]);
      }),
    ));

  it("keeps PostgreSQL and SQLite as non-importing siblings", () =>
    runPromise(
      gen(function* () {
        const pgBackedges = yield* forbiddenImports("pg", ["../sqlite"]);
        const sqliteBackedges = yield* forbiddenImports("sqlite", ["../pg"]);
        expect([...pgBackedges, ...sqliteBackedges]).toEqual([]);
      }),
    ));
});
