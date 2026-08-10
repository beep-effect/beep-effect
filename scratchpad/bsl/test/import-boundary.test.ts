/** Executable proof that the core layer never depends on a SQL dialect. */
import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";

const coreUrl = new URL("../src/core/", import.meta.url);
const importPattern = /(?:from\s*|import\s*)["']([^"']+)["']/g;

describe("core import boundary", () => {
  it("contains no PostgreSQL-backedge or @beep workspace import", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const files = A.fromIterable<string>(
          new Bun.Glob("**/*.ts").scanSync({ cwd: coreUrl.pathname }),
        );
        const sources = yield* Effect.tryPromise(() =>
          Promise.all(A.map(files, (file) => Bun.file(new URL(file, coreUrl)).text())),
        );
        const imports = A.flatMap(A.zip(files, sources), ([file, source]) =>
          A.getSomes(
            A.map(A.fromIterable<RegExpExecArray>(source.matchAll(importPattern)), (match) =>
              O.map(O.fromUndefinedOr(match[1]), (specifier) => ({
                file,
                specifier,
              })),
            ),
          ),
        );
        const forbidden = A.filter(
          imports,
          ({ specifier }) =>
            Str.startsWith("@beep/")(specifier) || Str.includes("../pg")(specifier),
        );
        expect(forbidden).toEqual([]);
      }),
    ));
});
