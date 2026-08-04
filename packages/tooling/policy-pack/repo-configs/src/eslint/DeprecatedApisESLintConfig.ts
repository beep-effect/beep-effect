/**
 * Deprecated API ESLint configuration used by repository quality gates.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

// cspell:word tsmorph
import { fileURLToPath } from "node:url";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import type { Linter } from "eslint";

const repoRootDirectory = fileURLToPath(new URL("../../../../../../", import.meta.url));
type FlatConfigPlugins = NonNullable<Linter.Config["plugins"]>;
const tseslintPlugin = tseslint as unknown as FlatConfigPlugins[string];

const sourceFileGlobs = ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}", "infra/**/*.ts"] as const;

const generatedAndBuildOutputIgnores = [
  ".next/**",
  "**/.next/**",
  ".repos/**",
  ".sst/**",
  "coverage/**",
  "**/coverage/**",
  "dist/**",
  "**/dist/**",
  "**/docs/**",
  "node_modules/**",
  "**/node_modules/**",
  "apps/*/src/app/sw.ts",
  "**/.turbo/**",
  "**/.cache/**",
  "**/generated/**",
  "**/vendor/**",
  "**/*.gen.*",
  "**/*.d.ts",
] as const;

/**
 * Flat ESLint config array shape exported for deprecated API checks.
 *
 * **Example** (Define a deprecated API config shape)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import type { DeprecatedApisESLintConfigShape } from "@beep/repo-configs/eslint/DeprecatedApisESLintConfig"
 *
 * const config = [
 *   {
 *     rules: {
 *       "@typescript-eslint/no-deprecated": "error"
 *     }
 *   }
 * ] satisfies DeprecatedApisESLintConfigShape
 *
 * strictEqual(config[0]?.rules?.["@typescript-eslint/no-deprecated"], "error")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export type DeprecatedApisESLintConfigShape = ReadonlyArray<Linter.Config>;

/**
 * Shared deprecated API ESLint flat config.
 *
 * **Example** (Detect deprecated API usage)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { DeprecatedApisESLintConfig } from "@beep/repo-configs/eslint/DeprecatedApisESLintConfig"
 *
 * const checksDeprecatedApis = DeprecatedApisESLintConfig.some(
 *   (entry) => entry.rules?.["@typescript-eslint/no-deprecated"] === "error"
 * )
 *
 * strictEqual(checksDeprecatedApis, true)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const DeprecatedApisESLintConfig: DeprecatedApisESLintConfigShape = [
  {
    ignores: [...generatedAndBuildOutputIgnores],
  },
  {
    files: [...sourceFileGlobs],
    ignores: [...generatedAndBuildOutputIgnores],
    plugins: {
      "@typescript-eslint": tseslintPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "apps/*/dtslint/*.ts",
            "apps/*/dtslint/*.tsx",
            "apps/*/scripts/*.ts",
            "packages/_internal/*/drizzle.config.ts",
            "packages/_internal/*/scripts/*.ts",
            "packages/drivers/*/scripts/*.ts",
            "packages/drivers/*/test/fixtures/*.ts",
            // graph-3d driver stories are Storybook-glob-loaded roots typed by
            // the package's tsconfig.stories.json, which the project service
            // does not auto-discover.
            "packages/drivers/graph-3d/stories/*.tsx",
            "packages/foundation/*/*/scripts/*.ts",
            "packages/foundation/*/*/test/fixtures/*.ts",
            "packages/foundation/ui-system/ui/.storybook/*.ts",
            "packages/foundation/ui-system/ui/.storybook/*.tsx",
            "packages/tooling/*/*/scripts/*.ts",
            "packages/tooling/library/repo-utils/test/fixtures/tsmorph-late-file/src/extra.ts",
            "packages/tooling/library/repo-utils/test/fixtures/tsmorph-outline-order/source.ts",
            "packages/tooling/tool/docgen/test/fixtures/section-example/src/index.ts",
          ],
          defaultProject: "tsconfig.json",
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 160,
        },
        tsconfigRootDir: repoRootDirectory,
        warnOnUnsupportedTypeScriptVersion: false,
      },
    },
    rules: {
      "@typescript-eslint/no-deprecated": "error",
    },
  },
];

export default DeprecatedApisESLintConfig;
