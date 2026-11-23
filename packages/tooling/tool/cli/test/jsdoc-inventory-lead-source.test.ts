import { Jsonc } from "@beep/jsonc/Jsonc";
import { JSDocDocumentationInventoryOptions, writeJSDocDocumentationInventory } from "@beep/repo-cli/test/Quality";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import { acquireFixtureRepo, fixedGeneratedAt, PlatformLayer } from "./jsdoc-inventory-fixtures.ts";

type ExportFinding = {
  readonly symbolName: string;
  readonly repoPath: string;
  readonly missingSummary: boolean;
  readonly remediationStatus: string;
  readonly documentationShapeViolations: ReadonlyArray<{ readonly rule: string; readonly detail?: string }>;
};

type InventoryJson = {
  readonly packages: ReadonlyArray<{
    readonly packageName: string;
    readonly status: string;
    readonly counts: { readonly documentationRuleFindings: Readonly<Record<string, number>> };
    readonly exports: ReadonlyArray<ExportFinding>;
  }>;
};

const example = (title: string, code: string): string =>
  ` * **Example** (${title})\n *\n * \`\`\`ts\n * ${code}\n * \`\`\`\n *\n`;

const indexSource = `/**
 * Demo package documentation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as S from "effect/Schema";

const $I = { annoteSchema: (_: string, __: object) => <A>(self: A) => self };

/**
 * A party name.
 *
${example("Decode a name", "console.log(Name)")} * @category schemas
 * @since 0.0.0
 */
export const Name = S.String.pipe($I.annoteSchema("Name", { description: "A party name." }));

/**
 * Runtime type for {@link Name}.
 *
 * @category models
 * @since 0.0.0
 */
export type Name = typeof Name.Type;

/**
 * Names are dated claims, never party fields.
 *
${example("Decode a kind", "console.log(NameKind)")} * @category schemas
 * @since 0.0.0
 */
export const NameKind = S.String.pipe($I.annoteSchema("NameKind", { description: "Kind of name." }));

/**
${example("Decode a label", "console.log(Label)")} * @category schemas
 * @since 0.0.0
 */
export const Label = S.String.pipe($I.annoteSchema("Label", { description: "A display label." }));

/**
${example("Read a count", "console.log(count)")} * @category constants
 * @since 0.0.0
 */
export const count = 1;

/**
 * Lib value exports.
 *
 * @since 0.0.0
 */
export * from "./lib.ts";

/**
 * Lib namespace exports.
 *
 * @since 0.0.0
 */
export * as Lib from "./lib.ts";

/**
 * Value re-export.
 *
 * @since 0.0.0
 */
export { libValue as value } from "./lib.ts";

/**
 * Library value, again.
 *
 * @since 0.0.0
 */
export { libValue } from "./lib.ts";

const hidden = 2;

/**
 * Hidden total.
 *
 * @since 0.0.0
 */
export { hidden as total };
`;

const libSource = `/**
 * Demo library module.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Library value.
 *
${example("Read the value", "console.log(libValue)")} * @category constants
 * @since 0.0.0
 */
export const libValue = "lib";
`;

const generatedSource = `import * as S from "effect/Schema";

const $I = { annoteSchema: (_: string, __: object) => <A>(self: A) => self };

/**
 * Generated schema for Box.
 *
${example("Decode a box", "console.log(Box)")} * @category schemas
 * @since 0.0.0
 */
export const Box = S.String.pipe($I.annoteSchema("Box", { description: "Generated schema for Box." }));
`;

const buildInventory = Effect.fnUntraced(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const outputJsonPath = path.join(repoRoot, "out", "jsdoc.inventory.jsonc");
  yield* writeJSDocDocumentationInventory(
    JSDocDocumentationInventoryOptions.make({
      rootDir: repoRoot,
      outputJsonPath,
      outputMarkdownPath: path.join(repoRoot, "out", "jsdoc.inventory.md"),
      generatedAt: fixedGeneratedAt,
    })
  );
  const text = yield* fs.readFileString(outputJsonPath);
  return Result.getOrThrow(Jsonc.parseResult(text)) as InventoryJson;
});

const rulesOf = (entry: ExportFinding): ReadonlyArray<string> =>
  A.map(entry.documentationShapeViolations, (issue) => issue.rule);

it.layer(PlatformLayer, { concurrent: false, timeout: "20 seconds" })((it) => {
  describe("JSDoc inventory lead source", () => {
    it.effect("derives leads from annotations and counts restating leads without opening the package", () =>
      Effect.flatMap(
        acquireFixtureRepo({
          topoSortScript: "printf '@beep/demo\\n'",
          packages: [
            {
              name: "@beep/demo",
              dir: "demo",
              files: [
                ["src/index.ts", indexSource],
                ["src/lib.ts", libSource],
                ["src/_generated/Box.gen.ts", generatedSource],
              ],
            },
          ],
        }),
        Effect.fnUntraced(function* (repoRoot) {
          const inventory = yield* buildInventory(repoRoot);
          const pkg = O.getOrThrow(A.findFirst(inventory.packages, (entry) => entry.packageName === "@beep/demo"));
          const find = (predicate: (entry: ExportFinding) => boolean): ExportFinding =>
            O.getOrThrow(A.findFirst(pkg.exports, predicate));
          const named = (name: string) =>
            find((entry) => entry.symbolName === name && !Str.includes("lib")(entry.repoPath));

          expect(rulesOf(find((entry) => entry.symbolName === "Name"))).toContain("restating-lead");
          expect(A.filter(pkg.exports, (entry) => entry.symbolName === "Name").length).toBe(2);
          expect(
            A.every(
              A.filter(pkg.exports, (entry) => entry.symbolName === "Name"),
              (entry) => A.contains(rulesOf(entry), "restating-lead")
            )
          ).toBe(true);
          expect(rulesOf(named("NameKind"))).not.toContain("restating-lead");

          const label = named("Label");
          expect(label.missingSummary).toBe(false);
          expect(rulesOf(label)).toEqual([]);

          const countEntry = named("count");
          expect(countEntry.missingSummary).toBe(true);
          expect(rulesOf(countEntry)).not.toContain("leading-blank");

          const barrels = A.filter(pkg.exports, (entry) => Str.startsWith("export ")(entry.symbolName));
          expect(A.map(barrels, rulesOf)).toEqual([["restating-lead"], ["restating-lead"], ["restating-lead"], []]);
          expect(A.every(barrels, (entry) => entry.remediationStatus === "resolved")).toBe(true);

          expect(rulesOf(named("Box"))).toEqual([]);
          expect(rulesOf(find((entry) => entry.symbolName === "libValue"))).toEqual([]);
          expect(pkg.counts.documentationRuleFindings["restating-lead"]).toBe(5);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );
  });
});
