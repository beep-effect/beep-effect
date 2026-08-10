/** Executable proof that the core layer never depends on a SQL dialect. */
import { describe, expect, it } from "bun:test";
import { gen, runPromise, tryPromise } from "effect/Effect";
import { flatMap, fromIterable, getSomes, zip } from "effect/Array";
import { fromUndefinedOr, map } from "effect/Option";

const coreUrl = new URL("../src/core/", import.meta.url);
const importPattern = /(?:from\s*|import\s*)["']([^"']+)["']/g;

describe("core import boundary", () => {
  it("contains no PostgreSQL-backedge or @beep workspace import", () =>
    runPromise(
      gen(function* () {
        const files = fromIterable<string>(
          new Bun.Glob("**/*.ts").scanSync({ cwd: coreUrl.pathname }),
        );
        const sources = yield* tryPromise(() =>
          Promise.all(files.map((file) => Bun.file(new URL(file, coreUrl)).text())),
        );
        const imports = flatMap(zip(files, sources), ([file, source]) =>
          getSomes(
            fromIterable<RegExpExecArray>(source.matchAll(importPattern)).map((match) =>
              map(fromUndefinedOr(match[1]), (specifier) => ({
                file,
                specifier,
              })),
            ),
          ),
        );
        const forbidden = imports.filter(
          ({ specifier }) => specifier.startsWith("@beep/") || specifier.includes("../pg"),
        );
        expect(forbidden).toEqual([]);
      }),
    ));
});
