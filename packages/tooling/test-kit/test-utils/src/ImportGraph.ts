/**
 * Runtime import graphs read from source text, for package boundary tests.
 *
 * **Details**
 *
 * A test hands this module its package's sources as raw text, typically from
 * Vite's eager `?raw` glob import, so the walk needs no filesystem at test
 * time. Type-only edges (`import type`, `export type`) are erased at runtime
 * and skipped. Comments are removed first, line comments before block
 * comments: JSDoc examples carry real import statements, and prose such as
 * `@beep/*` would otherwise open a block comment and hide the imports after it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TestUtilsId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $TestUtilsId.create("ImportGraph");

/**
 * Remove line comments, then block comments, from module text.
 *
 * **Details**
 *
 * The order is load-bearing. A line comment naming a glob such as `src/*`
 * would open a phantom block comment if blocks went first, and the stripper
 * would then delete every import up to the close of the next doc comment.
 *
 * **Example** (Strip a commented-out import)
 *
 * ```ts
 * import { stripComments } from "@beep/test-utils/ImportGraph"
 *
 * const code = stripComments('// import "./gone.ts"\nimport "./kept.ts"')
 * console.log(code.includes("gone")) // false
 * ```
 *
 * @param source - Module text to clean.
 * @returns The text with whole-line `//` comments and all block comments removed (trailing `//` comments are kept).
 * @category testing
 * @since 0.0.0
 */
export const stripComments = (source: string): string =>
  pipe(source, Str.replace(/(^|\n)\s*\/\/.*/g, "$1"), Str.replace(/\/\*[\s\S]*?\*\//g, ""));

const EDGE =
  /(?:^|\n)\s*(?:import|export)\b(\s+type\b)?\s*(?:[\w$]+\s*,\s*)?(?:\{[^{};]*\}|\*\s*(?:as\s+[\w$]+)?|[\w$]+)\s*from\s*["']([^"']+)["']|(?:^|\n)\s*import\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

const edgeOf = (match: RegExpMatchArray): ReadonlyArray<string> =>
  match[1] === undefined ? A.fromNullishOr(match[2] ?? match[3] ?? match[4]) : [];

/**
 * The runtime specifiers one module's text imports, in source order.
 *
 * **Details**
 *
 * Covers `import … from`, `export … from`, side-effect `import "x"` and
 * dynamic `import("x")` edges. A `from` edge whose clause starts with `type`
 * is skipped; inline `import { type X }` specifiers are not, because the
 * statement still loads the module. Comments are stripped first with
 * {@link stripComments}.
 *
 * **Example** (Read the runtime edges of a module)
 *
 * ```ts
 * import { runtimeImportsOf } from "@beep/test-utils/ImportGraph"
 *
 * const edges = runtimeImportsOf(
 *   'import type { T } from "./types.ts"\nimport * as A from "effect/Array"\nexport { x } from "./x.ts"'
 * )
 * console.log(edges) // ["effect/Array", "./x.ts"]
 * ```
 *
 * @param source - Module text to scan.
 * @returns The runtime import specifiers, in source order.
 * @category testing
 * @since 0.0.0
 */
export const runtimeImportsOf = (source: string): ReadonlyArray<string> =>
  A.flatMap(A.fromIterable(Str.matchAll(EDGE)(stripComments(source))), edgeOf);

/**
 * Module texts keyed by module id: what {@link closure} walks.
 *
 * @category models
 * @since 0.0.0
 */
export type Sources = HashMap.HashMap<string, string>;

interface FromGlobOptions {
  readonly prefix: string;
  readonly root?: string | undefined;
}

/**
 * Key an eager raw glob import by module id.
 *
 * **Details**
 *
 * Every key loses its first `prefix.length` characters and gains `root` (empty
 * when omitted) in front, so `"../../src/internal/a.ts"` with prefix `"../../src/"` becomes
 * `"internal/a.ts"`. Give a second package's sources a `root` to walk both in
 * one {@link Sources} map with `HashMap.union`.
 *
 * **Example** (Key a glob import relative to src)
 *
 * ```ts
 * import { fromGlob } from "@beep/test-utils/ImportGraph"
 * import * as HashMap from "effect/HashMap"
 *
 * // In a test this record comes from an eager `?raw` import.meta.glob call.
 * const glob = { "../../src/index.ts": 'export * from "./a.ts"' }
 * const sources = fromGlob(glob, { prefix: "../../src/" })
 * console.log(HashMap.has(sources, "index.ts")) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const fromGlob: {
  (options: FromGlobOptions): (glob: Readonly<Record<string, string>>) => Sources;
  (glob: Readonly<Record<string, string>>, options: FromGlobOptions): Sources;
} = dual(
  2,
  (glob: Readonly<Record<string, string>>, options: FromGlobOptions): Sources =>
    HashMap.fromIterable(
      A.map(
        R.toEntries(glob),
        ([path, text]) => [`${options.root ?? ""}${Str.slice(options.prefix.length)(path)}`, text] as const
      )
    )
);

/**
 * **Example** (Construct a missing-source error)
 *
 * ```ts
 * import { ImportGraphMissingSourceError } from "@beep/test-utils/ImportGraph"
 *
 * const error = ImportGraphMissingSourceError.make({ module: "gone.ts", message: "no source module gone.ts" })
 * console.log(error._tag) // "ImportGraphMissingSourceError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ImportGraphMissingSourceError extends S.TaggedError<
  ImportGraphMissingSourceError,
  { readonly brand: unique symbol }
>($I`ImportGraphMissingSourceError`)(
  "ImportGraphMissingSourceError",
  {
    module: S.String.pipe(
      $I.annoteKey("ImportGraphMissingSourceError.module", {
        description: "The module id the walk looked up.",
      })
    ),
    message: S.String.pipe(
      $I.annoteKey("ImportGraphMissingSourceError.message", {
        description: "Human-readable description of the missing module.",
      })
    ),
  },
  $I.annoteError<ImportGraphMissingSourceError>("ImportGraphMissingSourceError", {
    description: "An import-graph walk reached a module id that has no source text.",
  })
) {}

/**
 * The runtime specifiers of one module in a {@link Sources} map.
 *
 * **Example** (Read one module's edges by id)
 *
 * ```ts
 * import { moduleImportsOf } from "@beep/test-utils/ImportGraph"
 * import * as Effect from "effect/Effect"
 * import * as HashMap from "effect/HashMap"
 *
 * const sources = HashMap.make(["index.ts", 'export * from "./a.ts"'])
 * console.log(Effect.runSync(moduleImportsOf(sources, "index.ts"))) // ["./a.ts"]
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const moduleImportsOf: {
  (module: string): (sources: Sources) => Effect.Effect<ReadonlyArray<string>, ImportGraphMissingSourceError>;
  (sources: Sources, module: string): Effect.Effect<ReadonlyArray<string>, ImportGraphMissingSourceError>;
} = dual(
  2,
  Effect.fn("ImportGraph.moduleImportsOf")(function* (sources: Sources, module: string) {
    const source = yield* Effect.fromOption(HashMap.get(sources, module), () =>
      ImportGraphMissingSourceError.make({ module, message: `no source module ${module}` })
    );
    return runtimeImportsOf(source);
  })
);

/**
 * **Example** (Construct a closure value)
 *
 * ```ts
 * import { ImportClosure } from "@beep/test-utils/ImportGraph"
 *
 * const closure = ImportClosure.make({ modules: ["index.ts"], packages: ["effect/Array"] })
 * console.log(closure.packages) // ["effect/Array"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ImportClosure extends S.Opaque<ImportClosure, { readonly brand: unique symbol }>()(
  S.Struct({
    modules: S.Array(S.String).pipe(
      $I.annoteKey("ImportClosure.modules", {
        description: "Every module id reached, the entry included, in string order.",
      })
    ),
    packages: S.Array(S.String).pipe(
      $I.annoteKey("ImportClosure.packages", {
        description: "Every bare (package) specifier a reached module imports at runtime, in string order.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ImportClosure", {
      description: "The runtime import closure of one entry module: the modules it reaches and the packages they name.",
    })
  )
) {}

interface ClosureOptions {
  readonly enter?: ((specifier: string) => ReadonlyArray<string>) | undefined;
  readonly entry: string;
  readonly sources: Sources;
}

const isRelative = Str.startsWith(".");

const enterNothing = (_specifier: string): ReadonlyArray<string> => [];

const resolveFrom = (module: string, specifier: string): string =>
  A.join(
    A.reduce(Str.split(specifier, "/"), A.dropRight(Str.split(module, "/"), 1), (segments, part) =>
      part === ".." ? A.dropRight(segments, 1) : part === "." ? segments : A.append(segments, part)
    ),
    "/"
  );

const sorted = (values: HashSet.HashSet<string>): ReadonlyArray<string> => A.sort(A.fromIterable(values), Str.Order);

/**
 * Walk an entry module's runtime import closure.
 *
 * **Details**
 *
 * The walk starts at `entry` and reads module texts from `sources`. Relative
 * edges are resolved against the importing module and followed. Bare edges are
 * collected into `packages`; the walk enters one only when `enter` maps it to
 * module ids, for walking into another package's sources held under a `root`
 * (see {@link fromGlob}), and by default enters none. A module id with no text fails the walk with
 * {@link ImportGraphMissingSourceError}, so a misspelled entry cannot pass as
 * an empty closure.
 *
 * **Example** (Walk a two-module closure)
 *
 * ```ts
 * import { closure } from "@beep/test-utils/ImportGraph"
 * import * as Effect from "effect/Effect"
 * import * as HashMap from "effect/HashMap"
 *
 * const sources = HashMap.make(
 *   ["index.ts", 'export * from "./a.ts"'],
 *   ["a.ts", 'import * as A from "effect/Array"']
 * )
 * const result = Effect.runSync(closure({ sources, entry: "index.ts" }))
 * console.log(result.modules, result.packages) // ["a.ts", "index.ts"] ["effect/Array"]
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const closure = Effect.fn("ImportGraph.closure")(function* (options: ClosureOptions) {
  const enter = options.enter ?? enterNothing;
  let modules = HashSet.empty<string>();
  let packages = HashSet.empty<string>();
  let frontier: ReadonlyArray<string> = [options.entry];
  while (A.isReadonlyArrayNonEmpty(frontier)) {
    const visited = modules;
    const fresh = A.dedupe(A.filter(frontier, (module) => !HashSet.has(visited, module)));
    modules = HashSet.union(modules, HashSet.fromIterable(fresh));
    const steps = yield* Effect.forEach(
      fresh,
      (module) =>
        Effect.map(moduleImportsOf(options.sources, module), (edges) => {
          const bare = A.filter(edges, P.not(isRelative));
          return [
            A.appendAll(
              A.map(A.filter(edges, isRelative), (specifier) => resolveFrom(module, specifier)),
              A.flatMap(bare, enter)
            ),
            bare,
          ] as const;
        }),
      { concurrency: 1 }
    );
    packages = HashSet.union(packages, HashSet.fromIterable(A.flatMap(steps, ([, bare]) => bare)));
    frontier = A.flatMap(steps, ([next]) => next);
  }
  return ImportClosure.make({ modules: sorted(modules), packages: sorted(packages) });
});
