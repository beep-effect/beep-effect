import { writeJSDocDocumentationInventory } from "@beep/repo-cli/test/Quality";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeChildProcessSpawner } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as S from "effect/Schema";
import * as jsonc from "jsonc-parser";
import { describe, expect, it } from "vitest";

/**
 * Regression fixtures for three verified JSDoc inventory detector bugs
 * (goals/standards-remediation P1-B, rulings R2/R5/R3-J2/R3-J3):
 *
 * 1. Re-export declarations must be exempt from requiredExportTags and
 *    missingSummary (they are graph edges, not symbol-quality subjects).
 * 2. `bun run topo-sort` dependency-section header lines must not become
 *    phantom workspace packages.
 * 3. Multi-line import continuation lines (`type X as Y,`) must not
 *    false-positive the no-type-assertions-in-examples scan.
 */

const FileSystemLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const PlatformLayer = Layer.mergeAll(
  FileSystemLayer,
  NodeChildProcessSpawner.layer.pipe(Layer.provideMerge(FileSystemLayer))
);
const encodeJson = S.encodeUnknownSync(S.UnknownFromJsonString);
const fixedGeneratedAt = "2026-01-01T00:00:00.000Z";

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

type ExportFinding = {
  readonly symbolName?: string;
  readonly exportKind: string;
  readonly missingRequiredTags: ReadonlyArray<string>;
  readonly missingSummary: boolean;
  readonly remediationStatus: string;
  readonly unsafeExampleViolations: ReadonlyArray<{ readonly rule: string }>;
};

type PackageFinding = {
  readonly packageName: string;
  readonly status: string;
  readonly sourceCoverage: { readonly publicExportCount: number };
  readonly counts: { readonly missingExportExamples: number };
  readonly exports: ReadonlyArray<ExportFinding>;
};

type InventoryJson = {
  readonly packages: ReadonlyArray<PackageFinding>;
};

type FixturePackage = {
  readonly name: string;
  readonly dir: string;
  readonly files: ReadonlyArray<readonly [relativePath: string, content: string]>;
};

const writeJsonFile = (filePath: string, value: unknown) =>
  FileSystem.FileSystem.pipe(Effect.flatMap((fs) => fs.writeFileString(filePath, `${encodeJson(value)}\n`)));

const parseJsoncText = (text: string): unknown => {
  const errors: Array<jsonc.ParseError> = [];
  const parsed = jsonc.parse(text, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });

  expect(errors).toEqual([]);
  return parsed;
};

const acquireFixtureRepo = Effect.fnUntraced(function* (options: {
  readonly topoSortScript: string;
  readonly packages: ReadonlyArray<FixturePackage>;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* fs.makeTempDirectory();

  yield* writeJsonFile(path.join(repoRoot, "package.json"), {
    name: "fixture-root",
    scripts: {
      "topo-sort": options.topoSortScript,
    },
    workspaces: ["packages/*"],
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

    for (const [relativePath, content] of pkg.files) {
      const filePath = path.join(packageRoot, relativePath);
      yield* fs.makeDirectory(path.dirname(filePath), { recursive: true });
      yield* fs.writeFileString(filePath, content);
    }
  }

  return repoRoot;
});

const withFixtureRepo = Effect.fnUntraced(function* <A, E, R>(
  options: { readonly topoSortScript: string; readonly packages: ReadonlyArray<FixturePackage> },
  use: (repoRoot: string) => Effect.Effect<A, E, R>
) {
  return yield* Effect.acquireUseRelease(
    acquireFixtureRepo(options),
    use,
    Effect.fnUntraced(function* (repoRoot) {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.remove(repoRoot, { recursive: true });
    })
  ).pipe(provideScopedLayer(PlatformLayer));
});

const buildInventory = Effect.fnUntraced(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const outputJsonPath = path.join(repoRoot, "out", "jsdoc.inventory.jsonc");
  const outputMarkdownPath = path.join(repoRoot, "out", "jsdoc.inventory.md");

  yield* writeJSDocDocumentationInventory({
    rootDir: repoRoot,
    outputJsonPath,
    outputMarkdownPath,
    generatedAt: fixedGeneratedAt,
  });

  return parseJsoncText(yield* fs.readFileString(outputJsonPath)) as InventoryJson;
});

describe("JSDoc inventory detector fixes (P1-B)", () => {
  it("exempts re-export declarations from requiredExportTags and missingSummary while direct exports still fire (R2, R5)", () =>
    Effect.runPromise(
      withFixtureRepo(
        {
          topoSortScript: "printf '@beep/demo\\n'",
          packages: [
            {
              name: "@beep/demo",
              dir: "demo",
              files: [
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

export * from "./lib.js";

/**
 * Direct helper exported without a compiling example.
 *
 * @category helpers
 * @since 0.0.0
 */
export const directHelperWithoutExample = (): void => {};
`,
                ],
              ],
            },
          ],
        },
        Effect.fnUntraced(function* (repoRoot) {
          const inventory = yield* buildInventory(repoRoot);
          const pkg = inventory.packages.find((entry) => entry.packageName === "@beep/demo");
          expect(pkg).toBeDefined();

          const reExportEntry = pkg?.exports.find((entry) => entry.exportKind === "re-export");
          expect(reExportEntry).toBeDefined();
          expect(reExportEntry?.missingRequiredTags).toEqual([]);
          expect(reExportEntry?.missingSummary).toBe(false);
          expect(reExportEntry?.remediationStatus).toBe("resolved");

          const directEntry = pkg?.exports.find((entry) => entry.symbolName === "directHelperWithoutExample");
          expect(directEntry).toBeDefined();
          expect(directEntry?.missingRequiredTags).toContain("@example");
          expect(directEntry?.remediationStatus).toBe("open");

          // Re-export declarations remain counted as public surface; only
          // their findings stop. Total public exports = the re-export node +
          // the direct helper (from index.ts) + libValue (from lib.ts).
          expect(pkg?.sourceCoverage.publicExportCount).toBe(3);
          // The re-export no longer contributes to the missing-@example total.
          expect(pkg?.counts.missingExportExamples).toBe(1);
        })
      )
    ));

  it("filters phantom package names parsed from topo-sort dependency section headers (R3-J2)", () =>
    Effect.runPromise(
      withFixtureRepo(
        {
          topoSortScript:
            "printf 'dependencies 0\\ndevDependencies 1\\npeerDependencies 2\\noptionalDependencies 3\\n@beep/demo 4\\n'",
          packages: [
            {
              name: "@beep/demo",
              dir: "demo",
              files: [
                [
                  "src/index.ts",
                  `/**
 * Demo package documentation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Fully documented demo constant.
 *
 * @example
 * \`\`\`ts
 * import { demoValue } from "@beep/demo"
 *
 * console.log(demoValue)
 * \`\`\`
 * @category constants
 * @since 0.0.0
 */
export const demoValue = "demo";
`,
                ],
              ],
            },
          ],
        },
        Effect.fnUntraced(function* (repoRoot) {
          const inventory = yield* buildInventory(repoRoot);

          expect(inventory.packages.map((entry) => entry.packageName)).toEqual(["@beep/demo"]);
          expect(inventory.packages.some((entry) => entry.status === "missing-workspace-metadata")).toBe(false);
        })
      )
    ));

  it("parses real workspace package names from topo-sort output in topological order (R3-J2)", () =>
    Effect.runPromise(
      withFixtureRepo(
        {
          topoSortScript: "printf 'devDependencies 0\\n@beep/demo 1\\ndependencies 2\\n@beep/demo-two 3\\n'",
          packages: [
            {
              name: "@beep/demo",
              dir: "demo",
              files: [
                [
                  "src/index.ts",
                  `/**
 * Demo package documentation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Fully documented demo constant.
 *
 * @example
 * \`\`\`ts
 * import { demoValue } from "@beep/demo"
 *
 * console.log(demoValue)
 * \`\`\`
 * @category constants
 * @since 0.0.0
 */
export const demoValue = "demo";
`,
                ],
              ],
            },
            {
              name: "@beep/demo-two",
              dir: "demo-two",
              files: [
                [
                  "src/index.ts",
                  `/**
 * Second demo package documentation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Fully documented second demo constant.
 *
 * @example
 * \`\`\`ts
 * import { demoTwoValue } from "@beep/demo-two"
 *
 * console.log(demoTwoValue)
 * \`\`\`
 * @category constants
 * @since 0.0.0
 */
export const demoTwoValue = "demo-two";
`,
                ],
              ],
            },
          ],
        },
        Effect.fnUntraced(function* (repoRoot) {
          const inventory = yield* buildInventory(repoRoot);

          expect(inventory.packages.map((entry) => entry.packageName)).toEqual(["@beep/demo", "@beep/demo-two"]);
        })
      )
    ));

  it("strips multi-line import statements before flagging type assertions while real assertions outside imports still fire (R3-J3)", () =>
    Effect.runPromise(
      withFixtureRepo(
        {
          topoSortScript: "printf '@beep/demo\\n'",
          packages: [
            {
              name: "@beep/demo",
              dir: "demo",
              files: [
                [
                  "src/index.ts",
                  `/**
 * Demo package documentation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Direct export whose example uses a multi-line import with a type alias.
 *
 * @example
 * \`\`\`ts
 * import {
 *   type MultiLineAliasSource,
 *   type MultiLineAliasSource as MultiLineAliasValue,
 * } from "@beep/demo"
 *
 * const value: MultiLineAliasValue = { tag: "demo" }
 *
 * console.log(value.tag)
 * \`\`\`
 * @category helpers
 * @since 0.0.0
 */
export const multiLineImportAliasExample = (): void => {};

/**
 * Direct export whose example uses a real type assertion, a declare
 * statement, and any outside of any import.
 *
 * @example
 * \`\`\`ts
 * import {
 *   type MultiLineAliasSource as MultiLineAliasValue,
 * } from "@beep/demo"
 *
 * declare const externalValue: any
 * const value = externalValue as unknown
 *
 * console.log(value)
 * \`\`\`
 * @category helpers
 * @since 0.0.0
 */
export const realUnsafeExample = (): void => {};
`,
                ],
              ],
            },
          ],
        },
        Effect.fnUntraced(function* (repoRoot) {
          const inventory = yield* buildInventory(repoRoot);
          const pkg = inventory.packages.find((entry) => entry.packageName === "@beep/demo");
          expect(pkg).toBeDefined();

          const safeEntry = pkg?.exports.find((entry) => entry.symbolName === "multiLineImportAliasExample");
          expect(safeEntry).toBeDefined();
          expect(safeEntry?.unsafeExampleViolations).toEqual([]);
          expect(safeEntry?.remediationStatus).toBe("resolved");

          const unsafeEntry = pkg?.exports.find((entry) => entry.symbolName === "realUnsafeExample");
          expect(unsafeEntry).toBeDefined();
          const rules = unsafeEntry?.unsafeExampleViolations.map((violation) => violation.rule);
          expect(rules).toEqual(
            expect.arrayContaining(["no-declare-statements", "no-any-in-examples", "no-type-assertions-in-examples"])
          );
          expect(unsafeEntry?.unsafeExampleViolations.length).toBe(3);
        })
      )
    ));
});
