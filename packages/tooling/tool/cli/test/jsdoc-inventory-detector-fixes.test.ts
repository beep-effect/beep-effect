import {
  jsdocCommentsFromSource,
  tagsFromComment,
  writeJSDocDocumentationInventory,
} from "@beep/repo-cli/test/Quality";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeChildProcessSpawner } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as jsonc from "jsonc-parser";
import { describe, expect, it } from "vitest";

/**
 * Regression fixtures for verified JSDoc inventory detector bugs
 * (goals/standards-remediation P1-B/FINAL-A, rulings
 * R2/R5/R3-J2/R3-J3/R20/R21/R9):
 *
 * 1. Re-export declarations must be exempt from requiredExportTags and
 *    missingSummary (they are graph edges, not symbol-quality subjects).
 * 2. `bun run topo-sort` dependency-section header lines must not become
 *    phantom workspace packages.
 * 3. Multi-line import continuation lines (`type X as Y,`) must not
 *    false-positive the no-type-assertions-in-examples scan.
 * 4. `export default <CallExpression>` (the ESLint-rule module shape) must
 *    attribute its doc block from the export-assignment node, not the inner
 *    expression node (R20).
 * 5. String literal contents inside an example must not false-positive the
 *    declare/any/as-assertion unsafe-example scans (R20, R21).
 * 6. A namespaced barrel's re-export target (`export * as Ns from "./mod"`)
 *    must scan the target module's own declarations exactly like a flat
 *    barrel target does; only the barrel line itself stays exempt (R9).
 */

const FileSystemLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const PlatformLayer = Layer.mergeAll(
  FileSystemLayer,
  NodeChildProcessSpawner.layer.pipe(Layer.provideMerge(FileSystemLayer))
);
const encodeJson = UnknownFromJsonString.encodeUnknownSync;
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
  readonly repoPath: string;
  readonly missingRequiredTags: ReadonlyArray<string>;
  readonly missingSummary: boolean;
  readonly remediationStatus: string;
  readonly documentationShapeViolations: ReadonlyArray<{ readonly rule: string }>;
  readonly exampleImportViolations: ReadonlyArray<{ readonly rule: string; readonly detail: string }>;
  readonly unsafeExampleViolations: ReadonlyArray<{ readonly rule: string }>;
};

type PackageFinding = {
  readonly packageName: string;
  readonly status: string;
  readonly sourceCoverage: { readonly publicExportCount: number };
  readonly counts: {
    readonly missingExportExamples: number;
    readonly exampleImportFindings: number;
    readonly documentationRuleFindings: Readonly<Record<string, number>>;
  };
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
  it("ignores JSDoc-looking tags inside fenced example source", () => {
    expect(
      tagsFromComment(`/**
 * Outer summary.
 *
 * \`\`\`ts
 * /** Nested summary. */
 * @remarks This is example source, not an outer tag.
 * @example This is also example source.
 * \`\`\`
 * @category helpers
 * @since 0.0.0
 */`)
    ).toEqual(["@category", "@since"]);
  });

  it("preserves outer legacy tags after a complete nested JSDoc example", () => {
    const comments = jsdocCommentsFromSource(`/**
 * Outer summary.
 *
 * \`\`\`ts
 * /**
 *  * Nested summary.
 *  * @example Nested legacy source.
 *  */
 * export const nested = 1
 * \`\`\`
 *
 * @remarks Outer legacy tag that the zero-legacy gate must detect.
 * @category helpers
 * @since 0.0.0
 */`);

    expect(comments).toHaveLength(1);
    expect(tagsFromComment(comments[0] ?? "")).toEqual(["@remarks", "@category", "@since"]);
  });

  it("keeps delimiter-prefixed source inside the active fence", () => {
    const comments = jsdocCommentsFromSource(`/**
 * Outer summary.
 *
 * \`\`\`ts
 * \`\`\`sourceText
 * /**
 *  * Nested summary.
 *  * @remarks Nested legacy source.
 *  */
 * \`\`\`
 *
 * @category helpers
 * @since 0.0.0
 */`);

    expect(comments).toHaveLength(1);
    expect(tagsFromComment(comments[0] ?? "")).toEqual(["@category", "@since"]);
  });

  it("checks sectionless prose, loose fences, and empty titled examples", () =>
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
 * A sectionless type summary.
 *
 * A second prose paragraph that violates the single-description rule.
 *
 * \`\`\`ts
 * type Example = Sectionless
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export type Sectionless = string;

/**
 * A value with an empty titled example.
 *
 * **Example** (Use the value)
 *
 * \`\`\`ts
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const emptyExample = 1;
`,
                ],
              ],
            },
          ],
        },
        Effect.fnUntraced(function* (repoRoot) {
          const inventory = yield* buildInventory(repoRoot);
          const pkg = inventory.packages.find((entry) => entry.packageName === "@beep/demo");
          const sectionless = pkg?.exports.find((entry) => entry.symbolName === "Sectionless");
          const emptyExample = pkg?.exports.find((entry) => entry.symbolName === "emptyExample");

          expect(sectionless?.documentationShapeViolations.map((issue) => issue.rule)).toEqual(
            expect.arrayContaining(["multiple-description-paragraphs", "loose-ts-fence"])
          );
          expect(emptyExample?.documentationShapeViolations.map((issue) => issue.rule)).toEqual(
            expect.arrayContaining(["empty-section", "malformed-example"])
          );
        })
      )
    ));

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

  it("consolidates a documented-first-signature function-overload group into a single resolved entry (R19)", () =>
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
              ],
            },
          ],
        },
        Effect.fnUntraced(function* (repoRoot) {
          const inventory = yield* buildInventory(repoRoot);
          const pkg = inventory.packages.find((entry) => entry.packageName === "@beep/demo");
          expect(pkg).toBeDefined();

          const groupEntries = pkg?.exports.filter((entry) => entry.symbolName === "formatValue") ?? [];
          // One overload signature + one continuation signature + the
          // implementation must score as ONE entry, not three.
          expect(groupEntries.length).toBe(1);
          expect(groupEntries[0]?.missingRequiredTags).toEqual([]);
          expect(groupEntries[0]?.remediationStatus).toBe("resolved");
        })
      )
    ));

  it("consolidates a fully undocumented function-overload group into a single open entry (R19)", () =>
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
              ],
            },
          ],
        },
        Effect.fnUntraced(function* (repoRoot) {
          const inventory = yield* buildInventory(repoRoot);
          const pkg = inventory.packages.find((entry) => entry.packageName === "@beep/demo");
          expect(pkg).toBeDefined();

          const groupEntries = pkg?.exports.filter((entry) => entry.symbolName === "rawConvert") ?? [];
          // Zero doc blocks anywhere in the group must still yield exactly
          // ONE open entry (not one per signature/implementation line).
          expect(groupEntries.length).toBe(1);
          expect(groupEntries[0]?.missingRequiredTags).toEqual(
            expect.arrayContaining(["@example", "@category", "@since"])
          );
          expect(groupEntries[0]?.remediationStatus).toBe("open");
        })
      )
    ));

  it("still flags a malformed doc block on a non-anchor overload signature (R19)", () =>
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
 * Parse a value from its display string.
 *
 * @example
 * \`\`\`ts
 * import { parseValue } from "@beep/demo"
 *
 * console.log(parseValue("1"))
 * \`\`\`
 * @category helpers
 * @since 0.0.0
 */
export function parseValue(value: string): number;
/**
 * @param {string} value - malformed conditional tag with a type blob.
 */
export function parseValue(value: string, radix: number): number;
export function parseValue(value: string, radix?: number): number {
  return Number.parseInt(value, radix);
}
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

          const groupEntries = pkg?.exports.filter((entry) => entry.symbolName === "parseValue") ?? [];
          expect(groupEntries.length).toBe(1);
          // The anchor (first, documented) signature satisfies every
          // required tag, but the second signature's malformed conditional
          // tag must still surface and keep the group open.
          expect(groupEntries[0]?.missingRequiredTags).toEqual([]);
          expect(groupEntries[0]?.remediationStatus).toBe("open");
        })
      )
    ));

  it("attributes the doc block to the export assignment for a default-exported call expression while an undocumented sibling still opens (R20)", () =>
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
              ],
            },
          ],
        },
        Effect.fnUntraced(function* (repoRoot) {
          const inventory = yield* buildInventory(repoRoot);
          const pkg = inventory.packages.find((entry) => entry.packageName === "@beep/demo");
          expect(pkg).toBeDefined();

          const documented = pkg?.exports.find((entry) => entry.repoPath.endsWith("/documentedRule.ts"));
          expect(documented).toBeDefined();
          expect(documented?.missingRequiredTags).toEqual([]);
          expect(documented?.remediationStatus).toBe("resolved");

          const undocumented = pkg?.exports.find((entry) => entry.repoPath.endsWith("/undocumentedRule.ts"));
          expect(undocumented).toBeDefined();
          expect(undocumented?.missingRequiredTags).toEqual(
            expect.arrayContaining(["@example", "@category", "@since"])
          );
          expect(undocumented?.remediationStatus).toBe("open");
        })
      )
    ));

  it("reads leading-comment JSDoc on destructured BindingElement exports (R24)", () =>
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

const factory = () => ({ documentedMember: 1 as const, undocumentedMember: 2 as const });

export const {
  /**
   * A documented member exported via destructuring.
   *
   * @example
   * \`\`\`ts
   * import { documentedMember } from "@beep/demo"
   *
   * console.log(documentedMember)
   * \`\`\`
   * @category models
   * @since 0.0.0
   */
  documentedMember,
  undocumentedMember,
} = factory();
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

          // Documented binding element: the /** */ block sits in its leading
          // comment range (ts-morph's getJsDocs cannot see it) — R24 reads it.
          const documented = pkg?.exports.find((entry) => entry.symbolName === "documentedMember");
          expect(documented).toBeDefined();
          expect(documented?.missingRequiredTags).toEqual([]);
          expect(documented?.remediationStatus).toBe("resolved");

          // Undocumented binding element still fires.
          const undocumented = pkg?.exports.find((entry) => entry.symbolName === "undocumentedMember");
          expect(undocumented).toBeDefined();
          expect(undocumented?.missingRequiredTags).toEqual(
            expect.arrayContaining(["@example", "@category", "@since"])
          );
          expect(undocumented?.remediationStatus).toBe("open");
        })
      )
    ));

  it("strips string literal contents before flagging declare/any/as-assertion patterns while real unsafe code outside strings still fires (R20, R21)", () =>
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
 * Direct export whose example only mentions declare/as-assertion vocabulary
 * inside ordinary string literals, never as real code.
 *
 * @example
 * \`\`\`ts
 * import { describeRuleExample } from "@beep/demo"
 *
 * const description = "documented as Effect helper, please declare victory"
 *
 * console.log(describeRuleExample(), description)
 * \`\`\`
 * @category helpers
 * @since 0.0.0
 */
export const describeRuleExample = (): void => {};

/**
 * Direct export whose example uses a real declare statement, any, and a
 * type assertion outside of any string literal.
 *
 * @example
 * \`\`\`ts
 * import { realUnsafeStringLiteralExample } from "@beep/demo"
 *
 * declare const externalValue: any
 * const value = externalValue as Effect
 *
 * console.log(value, realUnsafeStringLiteralExample())
 * \`\`\`
 * @category helpers
 * @since 0.0.0
 */
export const realUnsafeStringLiteralExample = (): void => {};
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

          const safeEntry = pkg?.exports.find((entry) => entry.symbolName === "describeRuleExample");
          expect(safeEntry).toBeDefined();
          expect(safeEntry?.unsafeExampleViolations).toEqual([]);
          expect(safeEntry?.remediationStatus).toBe("resolved");

          const unsafeEntry = pkg?.exports.find((entry) => entry.symbolName === "realUnsafeStringLiteralExample");
          expect(unsafeEntry).toBeDefined();
          const rules = unsafeEntry?.unsafeExampleViolations.map((violation) => violation.rule);
          expect(rules).toEqual(
            expect.arrayContaining(["no-declare-statements", "no-any-in-examples", "no-type-assertions-in-examples"])
          );
        })
      )
    ));

  it("scans a namespaced-barrel target's own declarations exactly like a flat-barrel target, with only the barrel line itself exempt (R9)", () =>
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
 * Namespaced barrel for the demo namespace target.
 *
 * @example
 * \`\`\`ts
 * import { Ns } from "@beep/demo"
 *
 * console.log(Ns.undocumentedNs)
 * \`\`\`
 * @category constants
 * @since 0.0.0
 */
export * as Ns from "./nsTarget.ts";

export * from "./flatTarget.ts";
`,
                ],
                [
                  "src/nsTarget.ts",
                  `export const undocumentedNs = 1;
`,
                ],
                [
                  "src/flatTarget.ts",
                  `export const undocumentedFlat = 1;
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

          const nsTargetEntry = pkg?.exports.find((entry) => entry.symbolName === "undocumentedNs");
          expect(nsTargetEntry).toBeDefined();
          expect(nsTargetEntry?.remediationStatus).toBe("open");
          expect(nsTargetEntry?.missingRequiredTags).toEqual(
            expect.arrayContaining(["@example", "@category", "@since"])
          );

          const flatTargetEntry = pkg?.exports.find((entry) => entry.symbolName === "undocumentedFlat");
          expect(flatTargetEntry).toBeDefined();
          expect(flatTargetEntry?.remediationStatus).toBe("open");
          expect(flatTargetEntry?.missingRequiredTags).toEqual(
            expect.arrayContaining(["@example", "@category", "@since"])
          );

          const namespacedBarrelLine = pkg?.exports.find(
            (entry) => entry.exportKind === "re-export" && entry.symbolName?.includes("Ns")
          );
          expect(namespacedBarrelLine).toBeDefined();
          expect(namespacedBarrelLine?.remediationStatus).toBe("resolved");
        })
      )
    ));

  it("does not treat string-literal /** as a JSDoc comment opener", () => {
    const comments = jsdocCommentsFromSource(`
const root = Str.endsWith("/**")(path);
project.addSourceFilesAtPaths(\`\${base}/**/*.ts\`);
/**
 * Real doc.
 * @since 0.0.0
 */
export const real = 1;
`);
    expect(comments).toHaveLength(1);
    expect(comments[0]).toContain("Real doc.");
    expect(comments[0]).not.toContain("addSourceFilesAtPaths");
  });

  it("flags Effect and discovered foundation roots in examples without banning other workspace roots", () =>
    Effect.runPromise(
      withFixtureRepo(
        {
          topoSortScript: "printf '@beep/foundation-demo\\n@beep/consumer\\n'",
          packages: [
            {
              name: "@beep/foundation-demo",
              dir: "foundation/demo",
              files: [
                [
                  "src/index.ts",
                  `/**
 * Foundation fixture.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Foundation value.
 *
 * **Example** (Read the value)
 *
 * \`\`\`ts
 * console.log(value)
 * \`\`\`
 *
 * @category helpers
 * @since 0.0.0
 */
export const value = 1;
`,
                ],
              ],
            },
            {
              name: "@beep/consumer",
              dir: "consumer",
              files: [
                [
                  "src/index.ts",
                  `/**
 * Consumer fixture.
 *
 * **Example** (Import consumer dependencies)
 *
 * \`\`\`ts
 * import { Effect } from "effect"
 * import { value } from '@beep/foundation-demo'
 * console.log(Effect.succeed(value))
 * \`\`\`
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Consumer value.
 *
 * **Example** (Use roots)
 *
 * \`\`\`ts
 * import { Effect } from 'effect'
 * import { value } from "@beep/foundation-demo"
 * import { consumerValue } from '@beep/consumer'
 * console.log(Effect.succeed(value + consumerValue))
 * \`\`\`
 *
 * @category helpers
 * @since 0.0.0
 */
export const consumerValue = 1;
`,
                ],
              ],
            },
          ],
        },
        Effect.fnUntraced(function* (repoRoot) {
          const inventory = yield* buildInventory(repoRoot);
          const consumer = inventory.packages.find((entry) => entry.packageName === "@beep/consumer");
          const value = consumer?.exports.find((entry) => entry.symbolName === "consumerValue");
          const rootFindings = value?.exampleImportViolations.filter(
            (finding) => finding.rule === "no-root-package-import"
          );

          expect(rootFindings).toHaveLength(2);
          expect(rootFindings?.map((finding) => finding.detail)).toEqual([
            "Import stable public modules instead of the effect package root.",
            "Import stable public modules instead of the @beep/foundation-demo package root.",
          ]);
          expect(consumer?.counts.exampleImportFindings).toBe(4);
          expect(consumer?.counts.documentationRuleFindings["no-root-package-import"]).toBe(4);
        })
      )
    ));
});
