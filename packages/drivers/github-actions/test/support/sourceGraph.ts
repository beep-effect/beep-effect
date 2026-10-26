// The package's `src` modules, read from source text Vite's raw glob import
// inlines at transform time, so the scans touch no filesystem and run the same
// under Node and Bun (the package test runner is `bunx --bun vitest`). The
// import graph itself is `@beep/test-utils/ImportGraph`'s; this module adds
// the one edge form that walker does not read: a literal
// `process.getBuiltinModule("node:…")` load, which is how this package reaches
// `node:crypto`, `node:fs` and `node:child_process`.

import * as ImportGraph from "@beep/test-utils/ImportGraph";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Str from "effect/String";

const SOURCES = ImportGraph.fromGlob(
  import.meta.glob<string>("../../src/**/*.ts", { query: "?raw", import: "default", eager: true }),
  { prefix: "../../src/" }
);

/** Every `src` module by its `src`-relative path (`"ActionCache.ts"`, `"internal/twirp.ts"`), sorted. */
export const sourceModules: ReadonlyArray<string> = SOURCES.pipe(HashMap.keys, A.fromIterable, A.sort(Str.Order));

/** The raw text of one `src` module; a module that does not exist fails loudly. */
export const sourceOf = (module: string): string =>
  O.getOrThrowWith(HashMap.get(SOURCES, module), () => new Error(`no source module src/${module}`));

const BUILTIN_LOAD = /\bprocess\.getBuiltinModule\(\s*"(node:[^"]+)"\s*\)/g;

/** The `node:*` builtins a module's code loads through `process.getBuiltinModule`. */
export const builtinsOf = (source: string): ReadonlyArray<string> =>
  A.getSomes(
    A.map(A.fromIterable(Str.matchAll(BUILTIN_LOAD)(ImportGraph.stripComments(source))), (match) =>
      O.fromUndefinedOr(match[1])
    )
  );

/** The runtime edges one module names: its import statements, then its builtin loads. */
export const runtimeEdgesOf = (source: string): ReadonlyArray<string> =>
  A.appendAll(ImportGraph.runtimeImportsOf(source), builtinsOf(source));

/**
 * The runtime closure of one `src` module: the modules it reaches and every
 * package or builtin those modules load, each sorted.
 */
export const runtimeClosure = Effect.fn("sourceGraph.runtimeClosure")(function* (entry: string) {
  const { modules, packages } = yield* ImportGraph.closure({ sources: SOURCES, entry });
  const builtins = A.flatMap(modules, (module) => builtinsOf(sourceOf(module)));
  return { modules, packages: A.sort(A.dedupe(A.appendAll(packages, builtins)), Str.Order) };
});
