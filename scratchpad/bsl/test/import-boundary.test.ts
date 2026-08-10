/** Executable proof of the core, PostgreSQL, and SQLite import DAG. */
import { describe, expect, it } from "bun:test";
import { gen, runPromise, tryPromise } from "effect/Effect";
import { flatMap, fromIterable, getSomes, zip } from "effect/Array";
import { fromUndefinedOr, map } from "effect/Option";

const importPattern = /(?:from\s*|import\s*)["']([^"']+)["']/g;

const localImportClosure = (entrypoint: URL) =>
  gen(function* () {
    const pending = [entrypoint];
    const visited = new Set<string>();
    while (pending.length > 0) {
      const current = pending.pop();
      if (current === undefined || visited.has(current.pathname)) continue;
      visited.add(current.pathname);
      const source = yield* tryPromise(() => Bun.file(current).text());
      for (const match of source.matchAll(importPattern)) {
        const specifier = match[1];
        if (specifier?.startsWith(".")) pending.push(new URL(specifier, current));
      }
    }
    return [...visited];
  });

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

  it("keeps each dialect-local kit constructor outside its sibling graph", () =>
    runPromise(
      gen(function* () {
        const pg = yield* localImportClosure(new URL("../src/pg/index.ts", import.meta.url));
        const sqlite = yield* localImportClosure(new URL("../src/sqlite/index.ts", import.meta.url));
        expect(pg.some((path) => path.endsWith("/pg/kit.ts"))).toBe(true);
        expect(sqlite.some((path) => path.endsWith("/sqlite/kit.ts"))).toBe(true);
        expect(pg.some((path) => path.includes("/sqlite/"))).toBe(false);
        expect(sqlite.some((path) => path.includes("/pg/"))).toBe(false);
      }),
    ));
});

describe("bundle isolation", () => {
  it("drops unrelated PostgreSQL column families and SQLite from an integer import", () =>
    runPromise(
      gen(function* () {
        const result = yield* tryPromise(() => Bun.build({
          entrypoints: [new URL("./bundle-pg-integer.consumer.ts", import.meta.url).pathname],
          format: "esm",
          minify: true,
          target: "bun",
        }));
        const outputs = yield* tryPromise(() =>
          Promise.all(result.outputs.map((output) => output.text())),
        );
        const output = outputs.join("");
        expect(result.success).toBe(true);
        expect(outputs).toHaveLength(1);
        expect(output).not.toContain("Custom-column identity must agree");
        expect(output).not.toContain("Timestamp identity must agree");
        expect(output).not.toContain("timestamp_ms");
      }),
    ));
});
