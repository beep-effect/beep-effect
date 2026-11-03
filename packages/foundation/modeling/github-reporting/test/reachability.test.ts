// The root entry point must never link the markdown engine, and the managed
// document must reach `@beep/managed-section` only through its pure leaves, so
// `effect/FileSystem` (imported by the `ManagedSection` service the
// managed-section ROOT re-exports) stays out of this package's closure. The
// FileSystem check walks INTO the managed-section leaves, so a leaf that later
// imports it fails here too. Each module's exact edge set is pinned, which
// also keeps the `@beep/github` driver (a devDependency, for the CheckState
// wire-set test only) out of `src`.
//
// Checked by walking the RUNTIME import graph of `src` (type-only edges are
// erased and skipped). A bundler dropping unreferenced modules rests on
// `"sideEffects": []` plus module-per-file output; this proves the part the
// package controls: no edge exists.

import * as ImportGraph from "@beep/test-utils/ImportGraph";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Str from "effect/String";

/** The subset of Vite's `import.meta.glob` signature this suite uses. */
interface RawGlobOptions {
  readonly eager: true;
  readonly import: "default";
  readonly query: "?raw";
}

declare global {
  interface ImportMeta {
    glob<T>(pattern: string, options: RawGlobOptions): Record<string, T>;
  }
}

// Vite inlines every `src` module's raw text at transform time, so the walk
// needs no filesystem. The `@beep/managed-section` sources are inlined the same
// way, under the module-id root `@beep/managed-section/src/`, so a closure walk
// can enter that package through the leaves this package imports and see what
// they reach in turn.
const PACKAGE_SOURCES = ImportGraph.fromGlob(
  import.meta.glob<string>("../src/**/*.ts", { query: "?raw", import: "default", eager: true }),
  { prefix: "../src/" }
);

const MANAGED_SECTION_ROOT = "@beep/managed-section/src/";

const SOURCES = HashMap.union(
  PACKAGE_SOURCES,
  ImportGraph.fromGlob(
    import.meta.glob<string>("../../managed-section/src/**/*.ts", { query: "?raw", import: "default", eager: true }),
    { prefix: "../../managed-section/src/", root: MANAGED_SECTION_ROOT }
  )
);

/** Every module under `src`, relative to `src/` (for example `"internal/admission.ts"`). */
const sourceModules: ReadonlyArray<string> = PACKAGE_SOURCES.pipe(HashMap.keys, A.fromIterable, A.sort(Str.Order));

/**
 * The `@beep/managed-section` module a bare specifier names, if any: the root
 * maps to `index.ts`, a subpath `@beep/managed-section/X` to `X.ts`.
 */
const managedSectionModule = (specifier: string): ReadonlyArray<string> =>
  specifier === "@beep/managed-section"
    ? [`${MANAGED_SECTION_ROOT}index.ts`]
    : Str.startsWith("@beep/managed-section/")(specifier)
      ? [`${MANAGED_SECTION_ROOT}${Str.slice("@beep/managed-section/".length)(specifier)}.ts`]
      : [];

/**
 * The bare (package) specifiers reachable from one `src` module at runtime.
 * Relative edges are followed; bare edges are collected and not entered.
 */
const reachablePackages = (entry: string) =>
  Effect.map(ImportGraph.closure({ sources: SOURCES, entry }), (closure) => closure.packages);

/**
 * As {@link reachablePackages}, but a `@beep/managed-section` edge is also
 * entered, so the result holds what that package's modules reach in turn. The
 * entry may be a `src` module or a managed-section module id (for example
 * `"@beep/managed-section/src/index.ts"`).
 */
const reachableClosure = (entry: string) =>
  Effect.map(
    ImportGraph.closure({ sources: SOURCES, entry, enter: managedSectionModule }),
    (closure) => closure.packages
  );

const isMarkdownEdge = (specifier: string): boolean =>
  specifier === "@beep/markdown" || Str.startsWith("@beep/markdown/")(specifier);

const MANAGED_SECTION_LEAVES = [
  "@beep/managed-section/CommentStyle",
  "@beep/managed-section/Section",
  "@beep/managed-section/SectionDialect",
  "@beep/managed-section/SectionDocument",
];

// The workspace packages `src` may reach at runtime: its `dependencies`, and
// no driver. `@beep/github` is a devDependency and must never appear here.
const ALLOWED_WORKSPACE_ROOTS = [
  "@beep/identity",
  "@beep/managed-section",
  "@beep/markdown",
  "@beep/schema",
  "@beep/utils",
];

const workspaceRoot = (specifier: string): string => A.join(A.take(Str.split(specifier, "/"), 2), "/");

describe("bundle reachability", () => {
  it.effect("GitHubMarkdown DOES reach @beep/markdown (the control: the walker can see the edge)", () =>
    Effect.gen(function* () {
      const reachablePackages1 = yield* reachablePackages("GitHubMarkdown.ts");
      assert.isTrue(A.some(reachablePackages1, isMarkdownEdge));
    })
  );

  it.effect("the root entry point never reaches @beep/markdown", () =>
    Effect.gen(function* () {
      const reachablePackages2 = yield* reachablePackages("index.ts");
      assert.isFalse(A.some(reachablePackages2, isMarkdownEdge));
    })
  );

  it.effect("GitHubMarkdown is the only module that reaches @beep/markdown", () =>
    Effect.gen(function* () {
      const filter3 = yield* Effect.filter(sourceModules, (module) =>
        Effect.map(reachablePackages(module), A.some(isMarkdownEdge))
      );
      assert.deepStrictEqual(filter3, ["GitHubMarkdown.ts"]);
    })
  );

  it.effect("the closure walk sees effect/FileSystem behind the managed-section root (the control)", () =>
    Effect.gen(function* () {
      // Without this, a walker that never entered managed-section would pass
      // the FileSystem check below vacuously.
      const reachableClosure4 = yield* reachableClosure("@beep/managed-section/src/index.ts");
      assert.include(reachableClosure4, "effect/FileSystem");
    })
  );

  it.effect("managed-section is reached through its pure leaves only, and effect/FileSystem never", () =>
    Effect.gen(function* () {
      for (const module of sourceModules) {
        const reachablePackages5 = yield* reachablePackages(module);
        const managedSection = A.filter(reachablePackages5, Str.startsWith("@beep/managed-section"));
        assert.isTrue(
          A.every(managedSection, (specifier) => A.contains(MANAGED_SECTION_LEAVES, specifier)),
          `${module} reaches ${A.join(managedSection, ", ")}`
        );
        const reachableClosure6 = yield* reachableClosure(module);
        assert.notInclude(reachableClosure6, "effect/FileSystem", `${module} reaches effect/FileSystem`);
      }
      const reachablePackages7 = yield* reachablePackages("index.ts");
      assert.deepStrictEqual(
        A.filter(reachablePackages7, Str.startsWith("@beep/managed-section")),
        MANAGED_SECTION_LEAVES
      );
    })
  );

  it.effect("no src module reaches a driver or any workspace package outside its dependencies", () =>
    Effect.gen(function* () {
      for (const module of sourceModules) {
        const reachableClosure8 = yield* reachableClosure(module);
        const workspace = A.filter(reachableClosure8, Str.startsWith("@beep/"));
        for (const specifier of workspace) {
          assert.include(ALLOWED_WORKSPACE_ROOTS, workspaceRoot(specifier), `${module} reaches ${specifier}`);
        }
        assert.isFalse(A.some(workspace, (specifier) => workspaceRoot(specifier) === "@beep/github"));
      }
    })
  );

  it.effect("each module reaches exactly its pinned edge set", () =>
    Effect.gen(function* () {
      // Exact edge sets, carried over from the lab test this package replaced:
      // a stray value import fails here rather than in a consumer's bundle, and a
      // blinded walker shows up as an empty set rather than as a pass. The
      // vocabulary reaches nothing but effect and the kit (in particular NOT
      // `@beep/github`, whose conclusion set it mirrors).
      const reachablePackages9 = yield* reachablePackages("CheckState.ts");
      assert.deepStrictEqual(reachablePackages9, [
        "@beep/identity/packages",
        "@beep/schema/LiteralKit",
        "effect/Match",
        "effect/Schema",
      ]);
      const reachablePackages10 = yield* reachablePackages("ManagedDocument.ts");
      assert.deepStrictEqual(reachablePackages10, [
        "@beep/identity/packages",
        ...MANAGED_SECTION_LEAVES,
        "@beep/utils/Option",
        "effect/Array",
        "effect/Effect",
        "effect/Function",
        "effect/Result",
        "effect/Schema",
        "effect/String",
      ]);
      const reachablePackages11 = yield* reachablePackages("CheckDocument.ts");
      assert.deepStrictEqual(reachablePackages11, [
        "@beep/identity/packages",
        ...MANAGED_SECTION_LEAVES,
        "@beep/schema/LiteralKit",
        "@beep/utils/Option",
        "@beep/utils/TestDouble",
        "effect/Array",
        "effect/BigInt",
        "effect/Boolean",
        "effect/Clock",
        "effect/Context",
        "effect/DateTime",
        "effect/Duration",
        "effect/Effect",
        "effect/Function",
        "effect/HashMap",
        "effect/Latch",
        "effect/Layer",
        "effect/Match",
        "effect/Number",
        "effect/Option",
        "effect/Predicate",
        "effect/Ref",
        "effect/Result",
        "effect/Schema",
        "effect/Semaphore",
        "effect/String",
      ]);
      const reachablePackages12 = yield* reachablePackages("GitHubMarkdown.ts");
      assert.deepStrictEqual(reachablePackages12, [
        "@beep/identity/packages",
        "@beep/markdown/Markdown",
        "@beep/markdown/MarkdownNode",
        "@beep/schema/LiteralKit",
        "@beep/utils/thunk",
        "effect/Array",
        "effect/Function",
        "effect/Option",
        "effect/Predicate",
        "effect/Record",
        "effect/Result",
        "effect/Schema",
        "effect/SchemaAST",
        "effect/String",
      ]);
    })
  );

  it("the comment stripper removes prose imports and keeps code", () => {
    // A blinded scan is a silent false green, so the stripper gets its own
    // discriminating test.
    const source = A.join(
      [
        '// import { Markdown } from "@beep/markdown";',
        "/**",
        " * Prose naming @beep/* and an example:",
        ' * import { Markdown } from "@beep/markdown/Markdown";',
        " */",
        'import * as Str from "effect/String";',
        'import type { Root } from "@beep/markdown/MarkdownNode";',
        'export { x } from "./x.ts";',
        'import "./side-effect.ts";',
        'const lazy = () => import("./lazy.ts");',
      ],
      "\n"
    );
    assert.notInclude(ImportGraph.stripComments(source), '@beep/markdown"');
    assert.deepStrictEqual(ImportGraph.runtimeImportsOf(source), [
      "effect/String",
      "./x.ts",
      "./side-effect.ts",
      "./lazy.ts",
    ]);
  });
});
