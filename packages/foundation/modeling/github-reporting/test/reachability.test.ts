import * as ImportGraph from "@beep/test-utils/ImportGraph";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Str from "effect/String";

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

const sourceModules: ReadonlyArray<string> = PACKAGE_SOURCES.pipe(HashMap.keys, A.fromIterable, A.sort(Str.Order));

const managedSectionModule = (specifier: string): ReadonlyArray<string> =>
  specifier === "@beep/managed-section"
    ? [`${MANAGED_SECTION_ROOT}index.ts`]
    : Str.startsWith("@beep/managed-section/")(specifier)
      ? [`${MANAGED_SECTION_ROOT}${Str.slice("@beep/managed-section/".length)(specifier)}.ts`]
      : [];

const reachablePackages = (entry: string) =>
  Effect.map(ImportGraph.closure({ sources: SOURCES, entry }), (closure) => closure.packages);

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
      assert.isFalse(
        A.some(reachablePackages2, isMarkdownEdge),
        'the walk follows runtime edges only (type-only edges are erased); tree-shaking rests on "sideEffects": [] and module-per-file output, and this proves no edge exists'
      );
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
      const reachableClosure4 = yield* reachableClosure("@beep/managed-section/src/index.ts");
      assert.include(
        reachableClosure4,
        "effect/FileSystem",
        "a walker that never entered managed-section would pass the FileSystem check vacuously"
      );
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
        assert.notInclude(
          reachableClosure6,
          "effect/FileSystem",
          `${module} reaches effect/FileSystem; the walk enters the managed-section leaves, so a leaf that later imports it fails here too`
        );
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
        assert.isFalse(
          A.some(workspace, (specifier) => workspaceRoot(specifier) === "@beep/github"),
          "@beep/github is a devDependency, only for the CheckState wire-set test"
        );
      }
    })
  );

  it.effect("each module reaches exactly its pinned edge set", () =>
    Effect.gen(function* () {
      const reachablePackages9 = yield* reachablePackages("CheckState.ts");
      assert.deepStrictEqual(
        reachablePackages9,
        ["@beep/identity/packages", "@beep/schema/LiteralKit", "effect/Match", "effect/Schema"],
        "a stray value import fails here, not in a consumer's bundle, and a blinded walker shows an empty set; the vocabulary never reaches @beep/github, whose conclusion set it mirrors"
      );
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
    assert.notInclude(
      ImportGraph.stripComments(source),
      '@beep/markdown"',
      "a blinded scan is a silent false green, so the stripper gets its own discriminating test"
    );
    assert.deepStrictEqual(ImportGraph.runtimeImportsOf(source), [
      "effect/String",
      "./x.ts",
      "./side-effect.ts",
      "./lazy.ts",
    ]);
  });
});
