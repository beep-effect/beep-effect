import { it } from "@beep/test-runner";
import * as ImportGraph from "@beep/test-utils/ImportGraph";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Str from "effect/String";

const lines = (...parts: ReadonlyArray<string>): string => A.join(parts, "\n");

describe("ImportGraph.stripComments", () => {
  it("removes line comments before block comments, so a /*-bearing token in prose hides nothing", () => {
    // The token must sit in a LINE comment: inside a block comment a `/*` is
    // swallowed by its own comment and is harmless.
    const source = lines(
      "// Prose naming a scope like @octokit/* and a glob like src/* here.",
      'import * as Str from "effect/String";',
      "/** A doc comment. */",
      'import * as A from "effect/Array";'
    );
    expect(ImportGraph.runtimeImportsOf(source)).toStrictEqual(["effect/String", "effect/Array"]);
  });

  it("drops the imports that JSDoc examples and line comments carry", () => {
    const source = lines(
      '// import { Markdown } from "@beep/markdown";',
      "/**",
      " * Prose naming @beep/* and an example:",
      ' * import { Markdown } from "@beep/markdown/Markdown";',
      " */",
      'import * as Str from "effect/String";'
    );
    const code = ImportGraph.stripComments(source);
    expect(pipe(code, Str.includes('@beep/markdown"'))).toBe(false);
    expect(pipe(code, Str.includes('@beep/markdown/Markdown"'))).toBe(false);
    expect(pipe(code, Str.includes('import * as Str from "effect/String";'))).toBe(true);
  });
});

describe("ImportGraph.runtimeImportsOf", () => {
  it("reads every runtime edge form in source order", () => {
    const source = lines(
      'import * as Str from "effect/String";',
      'import type { Root } from "@beep/markdown/MarkdownNode";',
      'export { x } from "./x.ts";',
      'export * from "./all.ts";',
      'export type { T } from "./types.ts";',
      'import "./side-effect.ts";',
      "const lazy = () => import( './lazy.ts' );"
    );
    expect(ImportGraph.runtimeImportsOf(source)).toStrictEqual([
      "effect/String",
      "./x.ts",
      "./all.ts",
      "./side-effect.ts",
      "./lazy.ts",
    ]);
  });

  it("keeps an import whose clause holds inline type specifiers, and spans multi-line clauses", () => {
    const source = lines(
      "import {",
      "  type Alpha,",
      "  beta,",
      '} from "./mixed.ts";',
      'import type * as Types from "./erased.ts";'
    );
    expect(ImportGraph.runtimeImportsOf(source)).toStrictEqual(["./mixed.ts"]);
  });

  it("does not read from-like strings inside exported declaration bodies", () => {
    const source = lines(
      "export class PackageJsonFile {",
      '  message = `Failed to read package.json from "${this.path}"`;',
      "}",
      "export const text = 'from \"./x.ts\"';",
      "export function message() {",
      '  return `from "@beep/markdown"`;',
      "}",
      'import Default, { value } from "./real.ts";',
      'export * as ns from "./namespace.ts";',
      'export{compact}from"./compact.ts";',
      'import*as ns from"./star.ts";',
      'import D,*as other from"./default-star.ts";'
    );
    expect(ImportGraph.runtimeImportsOf(source)).toStrictEqual([
      "./real.ts",
      "./namespace.ts",
      "./compact.ts",
      "./star.ts",
      "./default-star.ts",
    ]);
  });

  it("ignores a side-effect import that does not start a line and a dynamic import of a non-literal", () => {
    const source = lines("const text = 'import \"./quoted.ts\"';", "const load = (name: string) => import(name);");
    expect(ImportGraph.runtimeImportsOf(source)).toStrictEqual([]);
  });
});

describe("ImportGraph.fromGlob", () => {
  it("drops the prefix and puts the root in front", () => {
    const glob = { "../../src/index.ts": "index", "../../src/internal/a.ts": "a" };
    expect(HashMap.toEntries(ImportGraph.fromGlob(glob, { prefix: "../../src/" }))).toStrictEqual(
      HashMap.toEntries(HashMap.make(["index.ts", "index"], ["internal/a.ts", "a"]))
    );
    const rooted = ImportGraph.fromGlob({ prefix: "../../../other/src/", root: "@beep/other/src/" })({
      "../../../other/src/index.ts": "other",
    });
    expect(HashMap.toEntries(rooted)).toStrictEqual([["@beep/other/src/index.ts", "other"]]);
  });
});

const SOURCES = HashMap.make(
  ["index.ts", lines('export * from "./a.ts";', 'export * from "./nested/b.ts";')],
  ["a.ts", lines('import * as A from "effect/Array";', 'import { b } from "./nested/b.ts";')],
  [
    "nested/b.ts",
    lines(
      'import { a } from "../a.ts";',
      'import type { T } from "../types.ts";',
      'import * as Other from "@beep/other";',
      'export * from "./c.ts";'
    ),
  ],
  ["nested/c.ts", 'import "@beep/other/side";'],
  ["@beep/other/src/index.ts", lines('export * from "./leaf.ts";')],
  ["@beep/other/src/leaf.ts", 'import * as FileSystem from "effect/FileSystem";']
);

describe("ImportGraph.closure", () => {
  it.effect("follows relative edges through cycles and collects bare edges without entering them", () =>
    Effect.gen(function* () {
      const closure = yield* ImportGraph.closure({ sources: SOURCES, entry: "index.ts" });
      expect(closure.modules).toStrictEqual(["a.ts", "index.ts", "nested/b.ts", "nested/c.ts"]);
      expect(closure.packages).toStrictEqual(["@beep/other", "@beep/other/side", "effect/Array"]);
    })
  );

  it.effect("enters the modules a bare specifier maps to", () =>
    Effect.gen(function* () {
      const enter = (specifier: string): ReadonlyArray<string> =>
        specifier === "@beep/other" ? ["@beep/other/src/index.ts"] : [];
      const closure = yield* ImportGraph.closure({ sources: SOURCES, entry: "nested/b.ts", enter });
      expect(closure.modules).toStrictEqual([
        "@beep/other/src/index.ts",
        "@beep/other/src/leaf.ts",
        "a.ts",
        "nested/b.ts",
        "nested/c.ts",
      ]);
      expect(closure.packages).toStrictEqual(["@beep/other", "@beep/other/side", "effect/Array", "effect/FileSystem"]);
    })
  );

  it.effect("fails with a typed error for a module that has no source", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(ImportGraph.closure({ sources: SOURCES, entry: "missing.ts" }));
      expect(error).toBeInstanceOf(ImportGraph.ImportGraphMissingSourceError);
      expect([error.module, error.message]).toStrictEqual(["missing.ts", "no source module missing.ts"]);
    })
  );

  it.effect("reads one module's edges by id", () =>
    Effect.gen(function* () {
      const value1 = yield* ImportGraph.moduleImportsOf("index.ts")(SOURCES);
      expect(value1).toStrictEqual(["./a.ts", "./nested/b.ts"]);
      const error = yield* Effect.flip(ImportGraph.moduleImportsOf(SOURCES, "gone.ts"));
      expect(error.module).toBe("gone.ts");
    })
  );
});
