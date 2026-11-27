import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";

declare global {
  interface ImportMeta {
    glob<T>(
      pattern: string,
      options: { readonly query: "?raw"; readonly import: "default"; readonly eager: true }
    ): Readonly<Record<string, T>>;
  }
}

const SRC = "../../src/";

// decision: source-graph-from-vite-inlined-text
const sources = import.meta.glob<string>("../../src/**/*.ts", { query: "?raw", import: "default", eager: true });

/** Every `src` module by path under `src` (for example `"Sbom.ts"` or `"internal/admission.ts"`), sorted. */
export const sourceModules: ReadonlyArray<string> = A.sort(A.map(R.keys(sources), Str.slice(SRC.length)), Str.Order);

/** The raw text of one `src` module; fails loudly for a module that does not exist. */
export const sourceOf = (module: string): string =>
  O.getOrThrowWith(R.get(sources, `${SRC}${module}`), () => new Error(`no source module src/${module}`));

// decision: source-graph-from-vite-inlined-text
const CLAUSE_EDGE =
  /^(?:import|export)\s+(type\s+)?(?:[\w$]+\s*,\s*)?(?:\{[^}]*\}|\*(?:\s+as\s+[\w$]+)?|[\w$]+)\s+from\s+"([^"]+)"/gm;
const TYPE_KEYWORD_GROUP = 1;
const SPECIFIER_GROUP = 2;

const BARE_IMPORT = /^import\s+"([^"]+)"/gm;

/** The edges one module's text names, split into runtime and erased (type-only) specifiers. */
export const edgesOf = (
  source: string
): { readonly runtime: ReadonlyArray<string>; readonly typeOnly: ReadonlyArray<string> } => {
  const clauses = A.fromIterable(Str.matchAll(CLAUSE_EDGE)(source));
  const specifierOf = (match: RegExpMatchArray): ReadonlyArray<string> =>
    match[SPECIFIER_GROUP] === undefined ? [] : [match[SPECIFIER_GROUP]];
  return {
    runtime: A.appendAll(
      A.flatMap(
        A.filter(clauses, (match) => match[TYPE_KEYWORD_GROUP] === undefined),
        specifierOf
      ),
      A.flatMap(A.fromIterable(Str.matchAll(BARE_IMPORT)(source)), (match) =>
        match[1] === undefined ? [] : [match[1]]
      )
    ),
    typeOnly: A.flatMap(
      A.filter(clauses, (match) => match[TYPE_KEYWORD_GROUP] !== undefined),
      specifierOf
    ),
  };
};

const SIBLING = /^\.\/((?:internal\/)?[A-Za-z]+\.ts)$/;

// decision: source-graph-from-vite-inlined-text
const siblingOf = (specifier: string): string =>
  pipe(
    O.fromNullishOr(SIBLING.exec(specifier)),
    O.flatMap((match) => O.fromNullishOr(match[1])),
    O.getOrThrowWith(
      () =>
        new Error(`unexpected relative specifier ${specifier}; only ./<Module>.ts or ./internal/<module>.ts is walked`)
    )
  );

const isRelative = Str.startsWith(".");

/**
 * The runtime closure of one `src` module: the sibling modules it reaches and
 * the bare package specifiers those modules import. Relative edges are
 * followed; bare edges are collected and not entered; type-only edges are
 * skipped because they are erased.
 */
export const runtimeClosure = (
  entry: string
): { readonly modules: ReadonlyArray<string>; readonly packages: ReadonlyArray<string> } => {
  const walk = (
    frontier: ReadonlyArray<string>,
    modules: HashSet.HashSet<string>,
    packages: HashSet.HashSet<string>
  ): readonly [HashSet.HashSet<string>, HashSet.HashSet<string>] => {
    const fresh = A.dedupe(A.filter(frontier, (module) => !HashSet.has(modules, module)));
    if (!A.isReadonlyArrayNonEmpty(fresh)) return [modules, packages];
    const edges = A.flatMap(fresh, (module) => edgesOf(sourceOf(module)).runtime);
    return walk(
      A.map(A.filter(edges, isRelative), siblingOf),
      HashSet.union(modules, HashSet.fromIterable(fresh)),
      HashSet.union(packages, HashSet.fromIterable(A.filter(edges, (edge) => !isRelative(edge))))
    );
  };
  const [modules, packages] = walk([entry], HashSet.empty(), HashSet.empty());
  return { modules: A.sort(A.fromIterable(modules), Str.Order), packages: A.sort(A.fromIterable(packages), Str.Order) };
};

/** The workspace or npm package a bare specifier belongs to (`@beep/spdx/License` is `@beep/spdx`). */
export const packageOf = (specifier: string): string =>
  A.join(A.take(Str.split(specifier, "/"), Str.startsWith("@")(specifier) ? 2 : 1), "/");
