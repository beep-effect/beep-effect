// The parser bridge must stay behind its own subpaths: importing `@beep/md`
// or `@beep/md/Md` never loads `@beep/markdown`, and the package root keeps
// exactly the eight modules it re-exported before the bridge existed. A
// future `beep codegen barrel` run that adds the bridge to `index.ts` fails
// here, since no other gate checks barrel drift.

import * as MdRoot from "@beep/md";
import * as MdNamespace from "@beep/md/Md";
import * as MdBehavior from "@beep/md/Md.behavior";
import * as MdConformance from "@beep/md/Md.conformance";
import * as MdEscape from "@beep/md/Md.escape";
import * as MdHtml from "@beep/md/Md.html";
import * as MdModel from "@beep/md/Md.model";
import * as MdRender from "@beep/md/Md.render";
import * as MdSafe from "@beep/md/Md.safe";
import { it } from "@beep/test-runner";
import * as ImportGraph from "@beep/test-utils/ImportGraph";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Str from "effect/String";
import manifest from "../package.json" with { type: "json" };

declare global {
  interface ImportMeta {
    glob<T>(
      pattern: string,
      options: { readonly query: "?raw"; readonly import: "default"; readonly eager: true }
    ): Readonly<Record<string, T>>;
  }
}

// Every package source module's text, keyed by its path under `src/`. Vite
// inlines the raw text at transform time, so the walk needs no filesystem.
const SOURCES = ImportGraph.fromGlob(
  import.meta.glob<string>("../src/**/*.ts", { query: "?raw", import: "default", eager: true }),
  { prefix: "../src/" }
);

const runtimeClosure = (entry: string) => ImportGraph.closure({ sources: SOURCES, entry });

const ROOT_MODULES = [
  "./Md.behavior.ts",
  "./Md.conformance.ts",
  "./Md.escape.ts",
  "./Md.html.ts",
  "./Md.model.ts",
  "./Md.render.ts",
  "./Md.safe.ts",
  "./Md.ts",
];

// Every public entry except the two bridge subpaths.
const NON_BRIDGE_ENTRIES = [
  "index.ts",
  "Md.ts",
  "Md.behavior.ts",
  "Md.conformance.ts",
  "Md.escape.ts",
  "Md.html.ts",
  "Md.model.ts",
  "Md.render.ts",
  "Md.safe.ts",
];

const PARSER_PACKAGES = ["@beep/markdown", "@beep/yaml", "@beep/toml", "@beep/jsonc"];

const isBridgeModule = (module: string): boolean =>
  module === "Md.syntax.ts" || module === "Md.parse.ts" || Str.startsWith("internal/syntax/")(module);

const isParserSpecifier = (specifier: string): boolean =>
  A.some(PARSER_PACKAGES, (name) => specifier === name || Str.startsWith(`${name}/`)(specifier));

const sorted = (values: Iterable<string>): ReadonlyArray<string> => A.sort(A.fromIterable(values), Order.String);

describe("@beep/md import boundary", () => {
  it.effect("keeps the bridge and every parser package out of the non-bridge entries' runtime closures", () =>
    Effect.gen(function* () {
      for (const entry of NON_BRIDGE_ENTRIES) {
        const closure = yield* runtimeClosure(entry);
        expect([entry, A.filter(closure.modules, isBridgeModule)]).toStrictEqual([entry, []]);
        expect([entry, A.filter(closure.packages, isParserSpecifier)]).toStrictEqual([entry, []]);
      }
    })
  );

  it.effect("sees the parser packages in the bridge's own closure", () =>
    Effect.gen(function* () {
      const closure = yield* runtimeClosure("Md.parse.ts");
      expect(A.contains(closure.modules, "Md.syntax.ts")).toBe(true);
      expect(A.some(closure.packages, isParserSpecifier)).toBe(true);
    })
  );

  it("imports @beep/markdown only from the bridge modules", () => {
    const importers = SOURCES.pipe(
      HashMap.filter((source) => A.some(ImportGraph.runtimeImportsOf(source), isParserSpecifier)),
      HashMap.keys,
      sorted
    );
    expect(importers.length).toBeGreaterThan(0);
    expect(A.filter(importers, (module) => !isBridgeModule(module))).toStrictEqual([]);
  });

  it.effect("re-exports exactly the eight pre-bridge modules from the package root", () =>
    Effect.gen(function* () {
      const moduleImportsOf1 = yield* ImportGraph.moduleImportsOf(SOURCES, "index.ts");
      expect(sorted(moduleImportsOf1)).toStrictEqual(ROOT_MODULES);
      const modules: ReadonlyArray<Readonly<Record<string, unknown>>> = [
        MdBehavior,
        MdConformance,
        MdEscape,
        MdHtml,
        MdModel,
        MdRender,
        MdSafe,
        MdNamespace,
      ];
      const moduleExports = HashSet.fromIterable(A.flatMap(modules, (module) => R.keys(module)));
      expect(sorted(R.keys(MdRoot))).toStrictEqual(sorted(moduleExports));
    })
  );

  it("publishes the bridge as side-effect-free subpaths with @beep/markdown as a dependency", () => {
    expect(manifest.exports["./Md.syntax"]).toBe("./src/Md.syntax.ts");
    expect(manifest.exports["./Md.parse"]).toBe("./src/Md.parse.ts");
    expect(manifest.publishConfig.exports["./Md.syntax"]).toBe("./dist/Md.syntax.js");
    expect(manifest.publishConfig.exports["./Md.parse"]).toBe("./dist/Md.parse.js");
    expect(manifest.exports["./internal/*"]).toBe("./src/internal/*.ts");
    expect(manifest.publishConfig.exports["./internal/*"]).toBe("./dist/internal/*.js");
    expect(manifest.sideEffects).toStrictEqual([]);
    expect(manifest.dependencies["@beep/markdown"]).toBe("workspace:^");
  });
});
