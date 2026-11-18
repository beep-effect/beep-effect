import { Git } from "@beep/git/Git";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { NodeChildProcessSpawner } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

/**
 * Shared fixture repos for the JSDoc inventory suites
 * (`jsdoc-inventory-detector-fixes.test.ts`, `jsdoc-inventory-noresolve-parity.test.ts`).
 * The source shapes below are scored by both suites, so one copy pins both the detector
 * fix and the noResolve parity contract (goals/heavy-pool-diet LINT-01).
 */

const FileSystemLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
// `Git` over the platform spawner: the inventories list the visible tree through the kit (W7b, SPEC D-19).
export const PlatformLayer = Layer.provideMerge(
  Git.layer,
  Layer.mergeAll(
    BunCrypto.layer,
    FileSystemLayer,
    NodeChildProcessSpawner.layer.pipe(Layer.provideMerge(FileSystemLayer))
  )
);

export const fixedGeneratedAt = "2026-01-01T00:00:00.000Z";

const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);

const tsdocPolicy = {
  tagDefinitions: [
    { tagName: "@effects", syntaxKind: "block" },
    { tagName: "@precondition", syntaxKind: "block" },
    { tagName: "@postcondition", syntaxKind: "block" },
    { tagName: "@invariant", syntaxKind: "block" },
  ],
  supportForTags: {
    "@effects": true,
    "@precondition": true,
    "@postcondition": true,
    "@invariant": true,
  },
};

export type FixtureFiles = ReadonlyArray<readonly [relativePath: string, content: string]>;

export type FixturePackage = {
  readonly name: string;
  readonly dir: string;
  readonly files: FixtureFiles;
};

const writeJsonFile = (filePath: string, value: unknown) =>
  FileSystem.FileSystem.pipe(Effect.flatMap((fs) => fs.writeFileString(filePath, `${encodeJson(value)}\n`)));

const writeFiles = Effect.fnUntraced(function* (root: string, files: FixtureFiles) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  for (const [relativePath, content] of files) {
    const filePath = path.join(root, relativePath);
    yield* fs.makeDirectory(path.dirname(filePath), { recursive: true });
    yield* fs.writeFileString(filePath, content);
  }
});

/**
 * Write a scoped temporary workspace: root manifest, tsdoc policy, one manifest per package,
 * the package files, and optional repo-root files (for example a `node_modules` package a
 * fixture imports, so a resolving program actually loads it).
 */
export const acquireFixtureRepo = Effect.fnUntraced(function* (options: {
  readonly topoSortScript: string;
  readonly packages: ReadonlyArray<FixturePackage>;
  readonly rootFiles?: FixtureFiles;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* Effect.acquireRelease(fs.makeTempDirectory(), (directory) =>
    fs.remove(directory, { recursive: true }).pipe(Effect.orDie)
  );

  yield* writeJsonFile(path.join(repoRoot, "package.json"), {
    name: "fixture-root",
    scripts: {
      "topo-sort": options.topoSortScript,
    },
    workspaces: ["packages/*", "packages/*/*"],
  });
  yield* writeJsonFile(path.join(repoRoot, "tsdoc.json"), tsdocPolicy);

  for (const pkg of options.packages) {
    const packageRoot = path.join(repoRoot, "packages", pkg.dir);
    yield* fs.makeDirectory(packageRoot, { recursive: true });
    yield* writeJsonFile(path.join(packageRoot, "package.json"), {
      name: pkg.name,
      exports: {
        ".": "./src/index.ts",
      },
    });
    yield* writeFiles(packageRoot, pkg.files);
  }

  yield* writeFiles(repoRoot, options.rootFiles ?? []);

  return repoRoot;
});

/** R2/R5: a star re-export barrel beside an undocumented-example direct helper. */
export const starExportFiles: FixtureFiles = [
  [
    "src/lib.ts",
    `/**
 * Demo library value re-exported by the package barrel.
 *
 * @example
 * \`\`\`ts
 * import { libValue } from "@beep/demo/lib"
 *
 * console.log(libValue)
 * \`\`\`
 * @category constants
 * @since 0.0.0
 */
export const libValue = "lib";
`,
  ],
  [
    "src/index.ts",
    `/**
 * Demo package documentation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

export * from "./lib.ts";

/**
 * Direct helper exported without a compiling example.
 *
 * @category helpers
 * @since 0.0.0
 */
export const directHelperWithoutExample = (): void => {};
`,
  ],
];

/** R19: a function-overload group whose first signature carries the doc block. */
export const documentedOverloadFiles: FixtureFiles = [
  [
    "src/index.ts",
    `/**
 * Demo package documentation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Format a value as a display string.
 *
 * @example
 * \`\`\`ts
 * import { formatValue } from "@beep/demo"
 *
 * console.log(formatValue(1))
 * \`\`\`
 * @category helpers
 * @since 0.0.0
 */
export function formatValue(value: number): string;
export function formatValue(value: string): string;
export function formatValue(value: number | string): string {
  return String(value);
}
`,
  ],
];

/** R19: a function-overload group with no doc block anywhere. */
export const undocumentedOverloadFiles: FixtureFiles = [
  [
    "src/index.ts",
    `/**
 * Demo package documentation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Fully documented sibling constant (keeps the package doc comment from
 * being misattributed to the first, otherwise-undocumented, declaration
 * below).
 *
 * @example
 * \`\`\`ts
 * import { sibling } from "@beep/demo"
 *
 * console.log(sibling)
 * \`\`\`
 * @category constants
 * @since 0.0.0
 */
export const sibling = "sibling";

export function rawConvert(value: number): string;
export function rawConvert(value: string): string;
export function rawConvert(value: number | string): string {
  return String(value);
}
`,
  ],
];

/** R20: local named re-exports of `export default <CallExpression>` rule modules. */
export const localNamedReExportFiles: FixtureFiles = [
  [
    "src/index.ts",
    `/**
 * Demo package documentation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

export { default as documentedRule } from "./documentedRule.ts";
export { default as undocumentedRule } from "./undocumentedRule.ts";
`,
  ],
  [
    "src/documentedRule.ts",
    `/**
 * Demo ESLint rule module, documented on its export assignment rather than
 * the inner call expression (the shape \`export default rule(...)\` takes).
 *
 * @example
 * \`\`\`ts
 * import rule from "@beep/demo/documentedRule"
 *
 * console.log(rule.meta.type)
 * \`\`\`
 * @category tools
 * @since 0.0.0
 */
export default defineRule({
  meta: { type: "problem" },
});
`,
  ],
  [
    "src/undocumentedRule.ts",
    `export default defineRule({
  meta: { type: "problem" },
});
`,
  ],
];
