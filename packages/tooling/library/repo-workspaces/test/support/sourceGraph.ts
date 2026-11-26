import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { hostPath } from "./hostPath.ts";

const SRC = "../../src/";

const viteInlinedSources = import.meta.glob<string>("../../src/**/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
});

const STATEMENT = /^(?:(?:import|export)\s+(?!type\b)[^;"']*?\bfrom\s*|import\s*)["']([^"']+)["']/gm;
const DYNAMIC = /(?<![\w$.])import\(\s*["']([^"']+)["']\s*\)/g;
const COMMENT_LINE = /^\s*(?:\*|\/\/|\/\*).*$/gm;

/** The specifiers a module's source text imports at runtime, in source order per form. */
export const specifiersOf = (text: string): ReadonlyArray<string> => {
  const code = Str.replace(COMMENT_LINE, "")(text);
  return A.getSomes(
    A.map(
      A.appendAll(A.fromIterable(Str.matchAll(STATEMENT)(code)), A.fromIterable(Str.matchAll(DYNAMIC)(code))),
      (match) => O.fromUndefinedOr(match[1])
    )
  );
};

/** Every `src` module's source text, by its `src`-relative path. */
export const sourceTexts: Readonly<Record<string, string>> = R.fromEntries(
  A.map(R.toEntries(viteInlinedSources), ([key, text]) => [Str.slice(SRC.length)(key), text])
);

/** Every `src` module, by its `src`-relative path, with the specifiers it imports at runtime. */
export const runtimeImports: Readonly<Record<string, ReadonlyArray<string>>> = R.fromEntries(
  A.map(R.toEntries(viteInlinedSources), ([key, text]) => [Str.slice(SRC.length)(key), specifiersOf(text)])
);

const names = (pkg: string) => (specifier: string) => specifier === pkg || Str.startsWith(`${pkg}/`)(specifier);

/** The modules that import `pkg` directly, sorted. */
export const directImportersOf = (pkg: string): ReadonlyArray<string> =>
  A.sort(
    A.filter(R.keys(runtimeImports), (module) => A.some(runtimeImports[module] ?? [], names(pkg))),
    Str.Order
  );

const relativeImportsOf = (module: string): ReadonlyArray<string> =>
  A.map(A.filter(runtimeImports[module] ?? [], Str.startsWith(".")), (specifier) =>
    hostPath.posix.join(hostPath.posix.dirname(module), specifier)
  );

const closureOf = (entry: string): MutableHashSet.MutableHashSet<string> => {
  const seen = MutableHashSet.empty<string>();
  let frontier: ReadonlyArray<string> = [entry];
  while (A.isReadonlyArrayNonEmpty(frontier)) {
    for (const module of frontier) MutableHashSet.add(seen, module);
    frontier = A.filter(A.flatMap(frontier, relativeImportsOf), (module) => !MutableHashSet.has(seen, module));
  }
  return seen;
};

/** Whether `pkg` is reachable at runtime from `entry` through the package's own modules. */
export const reaches: {
  (entry: string, pkg: string): boolean;
  (pkg: string): (entry: string) => boolean;
} = dual(2, (entry: string, pkg: string): boolean =>
  A.some(A.fromIterable(closureOf(entry)), (module) => A.some(runtimeImports[module] ?? [], names(pkg)))
);
