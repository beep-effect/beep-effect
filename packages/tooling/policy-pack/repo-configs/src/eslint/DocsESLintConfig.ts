/**
 * Docs-only ESLint configuration used by repository tooling.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { fileURLToPath } from "node:url";
import tsParser from "@typescript-eslint/parser";
import jsdoc from "eslint-plugin-jsdoc";
import tsdoc from "eslint-plugin-tsdoc";
import requireCategoryTagRule from "./RequireCategoryTagRule.ts";
import type { Linter } from "eslint";

const beepJsdoc = {
  rules: {
    "require-category-tag": requireCategoryTagRule,
  },
};

const repoRootDirectory = fileURLToPath(new URL("../../../../../../", import.meta.url));

/**
 * Flat ESLint config array shape exported for repository documentation checks.
 *
 * **Example** (Configure documentation linting)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import type { DocsESLintConfigShape } from "@beep/repo-configs/eslint/DocsESLintConfig"
 *
 * const config = [
 *   {
 *     rules: {
 *       "tsdoc/syntax": "error"
 *     }
 *   }
 * ] satisfies DocsESLintConfigShape
 *
 * strictEqual(config[0]?.rules?.["tsdoc/syntax"], "error")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export type DocsESLintConfigShape = ReadonlyArray<Linter.Config>;

/**
 * Docs-only ESLint configuration used by the repository root `lint:jsdoc` lane.
 *
 * **Example** (Configure documentation linting)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { DocsESLintConfig } from "@beep/repo-configs/eslint/DocsESLintConfig"
 *
 * const hasTSDocSyntaxRule = DocsESLintConfig.some((entry) => entry.rules?.["tsdoc/syntax"] === "error")
 *
 * strictEqual(hasTSDocSyntaxRule, true)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const DocsESLintConfig: DocsESLintConfigShape = [
  {
    ignores: [
      // Lab apps are ceremony-exempt from the docs/JSDoc lint lane
      // (goals/lab-apps-lifecycle D2); the deprecated-apis LAW profile
      // (DeprecatedApisESLintConfig) deliberately still lints apps/labs.
      // Canonical glob: packages/tooling/tool/cli/src/internal/cli/Labs.
      "apps/labs/**",
      ".next/**",
      "**/.next/**",
      ".repos/**",
      ".sst/**",
      "coverage/**",
      "**/coverage/**",
      "dist/**",
      "**/dist/**",
      "**/docs/**",
      "infra/ci-runners/sdks/ghaRunners/**",
      "node_modules/**",
      "**/storybook-static/**",
      "**/.turbo/**",
      "**/src-tauri/target/**",
    ],
  },
  {
    files: ["packages/tooling/*/*/src/**/*.ts"],
    ignores: [
      "packages/tooling/*/*/src/internal/**",
      "packages/tooling/*/*/src/**/*.test.ts",
      "packages/tooling/*/*/src/**/*.spec.ts",
      "**/*.d.ts",
    ],
    plugins: {
      jsdoc,
      "beep-jsdoc": beepJsdoc,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        tsconfigRootDir: repoRootDirectory,
        warnOnUnsupportedTypeScriptVersion: false,
      },
    },
    settings: {
      jsdoc: {
        mode: "typescript",
        tagNamePreference: {
          returns: "returns",
          augments: "extends",
        },
        structuredTags: {
          domain: {
            name: "text",
            type: false,
          },
          provides: {
            name: "text",
            type: false,
          },
          depends: {
            name: "text",
            type: false,
          },
          errors: {
            name: "text",
            type: false,
          },
        },
      },
    },
    rules: {
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
          },
          contexts: [
            "ExportNamedDeclaration > TSTypeAliasDeclaration",
            "ExportNamedDeclaration > TSInterfaceDeclaration",
            "ExportNamedDeclaration > VariableDeclaration",
          ],
          checkConstructors: false,
        },
      ],
      "jsdoc/require-description": [
        "warn",
        {
          contexts: [
            "ExportNamedDeclaration > FunctionDeclaration",
            "ExportNamedDeclaration > VariableDeclaration",
            "ExportNamedDeclaration > TSTypeAliasDeclaration",
            "ExportNamedDeclaration > TSInterfaceDeclaration",
            "ExportNamedDeclaration > ClassDeclaration",
          ],
        },
      ],
      "jsdoc/require-param": ["warn", { checkDestructured: false }],
      "jsdoc/require-param-description": "warn",
      "jsdoc/require-returns": "warn",
      "jsdoc/require-returns-description": "warn",
      "jsdoc/informative-docs": "error",
      "jsdoc/no-blank-block-descriptions": "error",
      "jsdoc/check-tag-names": [
        "error",
        {
          definedTags: [
            "domain",
            "provides",
            "depends",
            "errors",
            "effects",
            "precondition",
            "postcondition",
            "invariant",
            "packageDocumentation",
            "internal",
            "alpha",
            "beta",
            "ignore",
          ],
        },
      ],
      "jsdoc/check-param-names": [
        "error",
        {
          checkDestructured: false,
        },
      ],
      "beep-jsdoc/require-category-tag": "warn",
      "jsdoc/match-description": [
        "warn",
        {
          matchDescription: ".{20,}",
          tags: {
            param: {
              match: ".{5,}",
              message: "Parameter description must be at least 5 characters.",
            },
            returns: {
              match: ".{5,}",
              message: "Returns description must be at least 5 characters.",
            },
          },
        },
      ],
      "jsdoc/sort-tags": "warn",
      "jsdoc/multiline-blocks": "warn",
      "jsdoc/tag-lines": ["warn", "never", { startLines: 1 }],
    },
  },
  {
    files: ["packages/tooling/*/*/src/**/tag-values/**/*.ts"],
    plugins: { jsdoc },
    rules: {
      "jsdoc/require-description": "off",
      "jsdoc/match-description": "off",
    },
  },
  {
    files: ["packages/tooling/*/*/src/index.ts"],
    plugins: {
      jsdoc,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        tsconfigRootDir: repoRootDirectory,
        warnOnUnsupportedTypeScriptVersion: false,
      },
    },
    rules: {
      "jsdoc/require-file-overview": [
        "warn",
        {
          tags: {
            packageDocumentation: {
              initialCommentsOnly: true,
              mustExist: true,
            },
          },
        },
      ],
    },
  },
  {
    files: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}", "infra/**/*.ts"],
    ignores: [
      "**/*.d.ts",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "**/*.stories.tsx",
      "**/test/**",
      "**/tests/**",
      "**/.storybook/**",
      "**/dist/**",
      "**/docs/**",
      "**/.turbo/**",
      "**/.next/**",
      "**/vitest.storybook.config.ts",
      "packages/tooling/*/*/scripts/**",
      "packages/tooling/*/*/src/internal/**",
    ],
    plugins: {
      "eslint-plugin-tsdoc": tsdoc,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        tsconfigRootDir: repoRootDirectory,
        warnOnUnsupportedTypeScriptVersion: false,
      },
    },
    rules: {
      "eslint-plugin-tsdoc/syntax": "warn",
    },
  },
];

export default DocsESLintConfig;
