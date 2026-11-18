import {
  buildJSDocDocumentationInventory,
  JSDocDocumentationInventoryOptions,
  JSDocInventoryProgramOptions,
} from "@beep/repo-cli/test/Quality";
import { createInMemoryTsMorphProject } from "@beep/repo-cli-kit/tsmorph/index";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import {
  acquireFixtureRepo,
  documentedOverloadFiles,
  fixedGeneratedAt,
  localNamedReExportFiles,
  PlatformLayer,
  starExportFiles,
  undocumentedOverloadFiles,
} from "./jsdoc-inventory-fixtures.ts";
import type { FixtureFiles } from "./jsdoc-inventory-fixtures.ts";

/**
 * noResolve parity contract (goals/heavy-pool-diet LINT-01, #3019).
 *
 * The inventory builds each package program with `noResolve: true` so imports into other
 * packages stay unloaded. That is only sound while every detector reads declarations of the
 * added files alone. These fixtures cover the five shapes the lever's gate names (merged
 * namespace, module augmentation, star export, local named re-export, overload groups): the
 * inventory built with resolution off must deeply equal the one built with resolution on, and
 * both must match the explicit listing below. A detector that starts depending on resolved
 * imports fails here instead of silently changing the committed inventory.
 */

/** A namespace merged with a function and with a class, mixing documented and undocumented members. */
const mergedNamespaceFiles: FixtureFiles = [
  [
    "src/index.ts",
    `/**
 * Merged-namespace demo package.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Render a value as a label.
 *
 * @example
 * \`\`\`ts
 * import { toLabel } from "@beep/merged"
 *
 * console.log(toLabel(1))
 * \`\`\`
 * @category helpers
 * @since 0.0.0
 */
export function toLabel(value: number): string {
  return \`\${toLabel.prefix}:\${value}\`;
}

/**
 * Members merged onto {@link toLabel}.
 *
 * @example
 * \`\`\`ts
 * import { toLabel } from "@beep/merged"
 *
 * console.log(toLabel.prefix)
 * \`\`\`
 * @category helpers
 * @since 0.0.0
 */
export namespace toLabel {
  /**
   * Prefix written before every label.
   *
   * @example
   * \`\`\`ts
   * import { toLabel } from "@beep/merged"
   *
   * console.log(toLabel.prefix)
   * \`\`\`
   * @category constants
   * @since 0.0.0
   */
  export const prefix = "label";
  export const suffix = "!";
}

export class Registry {
  readonly size = 0;
}

export namespace Registry {
  export const empty = new Registry();
}
`,
  ],
];

/** `declare module` augmenting a package the file imports; the package exists so a resolving program loads it. */
const moduleAugmentationFiles: FixtureFiles = [
  [
    "src/index.ts",
    `/**
 * Module-augmentation demo package.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import type { Base } from "@fixture/augmented";

declare module "@fixture/augmented" {
  interface Base {
    readonly extra: string;
  }
}

/**
 * Build a base record carrying the augmented field.
 *
 * @example
 * \`\`\`ts
 * import { makeBase } from "@beep/augment"
 *
 * console.log(makeBase().extra)
 * \`\`\`
 * @category constructors
 * @since 0.0.0
 */
export const makeBase = (): Base => ({ id: 1, extra: "x" });

export const undocumentedBase = (): Base => ({ id: 2, extra: "y" });
`,
  ],
];

const augmentedPackageFiles: FixtureFiles = [
  ["node_modules/@fixture/augmented/package.json", `{ "name": "@fixture/augmented", "types": "index.d.ts" }\n`],
  ["node_modules/@fixture/augmented/index.d.ts", "export interface Base {\n  readonly id: number;\n}\n"],
];

const fixturePackages = [
  { name: "@beep/merged", dir: "merged", files: mergedNamespaceFiles },
  { name: "@beep/augment", dir: "augment", files: moduleAugmentationFiles },
  { name: "@beep/star", dir: "star", files: starExportFiles },
  { name: "@beep/named", dir: "named", files: localNamedReExportFiles },
  { name: "@beep/overload-documented", dir: "overload-documented", files: documentedOverloadFiles },
  { name: "@beep/overload-undocumented", dir: "overload-undocumented", files: undocumentedOverloadFiles },
];

const topoSortScript = `printf '${A.join(
  A.map(fixturePackages, (pkg) => pkg.name),
  "\\n"
)}\\n'`;

const buildWith = (repoRoot: string, noResolve: boolean) =>
  buildJSDocDocumentationInventory(
    JSDocDocumentationInventoryOptions.make({ rootDir: repoRoot, generatedAt: fixedGeneratedAt }),
    JSDocInventoryProgramOptions.make({ noResolve })
  );

type ListingEntry = {
  readonly entry: { readonly [key: string]: unknown };
  readonly missingRequiredTags: ReadonlyArray<string>;
  readonly remediationStatus: string;
};

const listEntry = ({ entry, missingRequiredTags, remediationStatus }: ListingEntry) =>
  A.join(
    [
      `${entry.repoPath}:${entry.line}`,
      `${entry.symbolName ?? "<module>"}`,
      `${entry.exportKind ?? entry.docKind}`,
      remediationStatus,
      A.join(missingRequiredTags, ","),
    ],
    " "
  );

// Pinned listing (module entries, then exports, per package in topo order). Namespace members
// (`toLabel.prefix`, `toLabel.suffix`, `Registry.empty`) are not scored on their own today; the
// merged declarations are. A detector change that moves this listing must move it in both modes.
const expectedListing: ReadonlyArray<string> = [
  "packages/merged/src/index.ts:1 <module> packageDocumentation resolved ",
  "packages/merged/src/index.ts:20 toLabel function resolved ",
  "packages/merged/src/index.ts:36 toLabel namespace resolved ",
  "packages/merged/src/index.ts:53 Registry class open @example,@category,@since",
  "packages/merged/src/index.ts:57 Registry namespace open @example,@category,@since",
  "packages/augment/src/index.ts:1 <module> packageDocumentation resolved ",
  "packages/augment/src/index.ts:27 makeBase const resolved ",
  "packages/augment/src/index.ts:29 undocumentedBase const open @example,@category,@since",
  "packages/star/src/index.ts:1 <module> packageDocumentation resolved ",
  "packages/star/src/lib.ts:1 <module> jsdoc resolved ",
  'packages/star/src/index.ts:8 export * from "./lib.ts"; re-export resolved ',
  "packages/star/src/index.ts:16 directHelperWithoutExample const open @example",
  "packages/star/src/lib.ts:13 libValue const resolved ",
  "packages/named/src/documentedRule.ts:1 <module> jsdoc resolved ",
  "packages/named/src/index.ts:1 <module> packageDocumentation resolved ",
  "packages/named/src/undocumentedRule.ts:1 <module> none open @since",
  "packages/named/src/documentedRule.ts:14 default CallExpression resolved ",
  'packages/named/src/index.ts:8 export { default as documentedRule } from "./documentedRule.ts"; re-export resolved ',
  'packages/named/src/index.ts:9 export { default as undocumentedRule } from "./undocumentedRule.ts"; re-export resolved ',
  "packages/named/src/undocumentedRule.ts:1 default CallExpression open @example,@category,@since",
  "packages/overload-documented/src/index.ts:1 <module> packageDocumentation resolved ",
  "packages/overload-documented/src/index.ts:20 formatValue function resolved ",
  "packages/overload-undocumented/src/index.ts:1 <module> packageDocumentation resolved ",
  "packages/overload-undocumented/src/index.ts:24 rawConvert function open @example,@category,@since",
  "packages/overload-undocumented/src/index.ts:22 sibling const resolved ",
];

it.layer(PlatformLayer, { concurrent: false, timeout: "60 seconds" })((it) => {
  describe("JSDoc inventory noResolve parity (heavy-pool-diet LINT-01)", () => {
    it.effect("scores every gate shape identically with and without module resolution", () =>
      Effect.flatMap(
        acquireFixtureRepo({ topoSortScript, packages: fixturePackages, rootFiles: augmentedPackageFiles }),
        Effect.fnUntraced(function* (repoRoot) {
          const path = yield* Path.Path;

          // The augmentation fixture only proves something if a resolving program loads the
          // augmented package and the production program does not.
          const augmentedDeclarationLoaded = (noResolve: boolean) => {
            const project = createInMemoryTsMorphProject({ compilerOptions: { noResolve } });
            project.addSourceFileAtPath(path.join(repoRoot, "packages", "augment", "src", "index.ts"));
            return A.some(project.getProgram().compilerObject.getSourceFiles(), (sourceFile) =>
              Str.endsWith("node_modules/@fixture/augmented/index.d.ts")(sourceFile.fileName)
            );
          };
          expect(augmentedDeclarationLoaded(false)).toBe(true);
          expect(augmentedDeclarationLoaded(true)).toBe(false);

          const unresolved = yield* buildWith(repoRoot, true);
          const resolved = yield* buildWith(repoRoot, false);

          expect(unresolved).toStrictEqual(resolved);

          const listing = A.flatMap(unresolved.packages, (pkg) =>
            A.map(A.appendAll(pkg.modules, pkg.exports), (entry) =>
              listEntry({
                entry,
                missingRequiredTags: entry.missingRequiredTags,
                remediationStatus: entry.remediationStatus,
              })
            )
          );
          expect(listing).toEqual(expectedListing);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );
  });
});
