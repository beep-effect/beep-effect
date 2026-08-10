/**
 * \@beep/repo-configs
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DeprecatedApisESLintConfig as DeprecatedApisESLintConfigInternal } from "./eslint/DeprecatedApisESLintConfig.ts";
import { DocsESLintConfig as DocsESLintConfigInternal } from "./eslint/DocsESLintConfig.ts";
import type { DeprecatedApisESLintConfigShape as DeprecatedApisESLintConfigShapeInternal } from "./eslint/DeprecatedApisESLintConfig.ts";
import type { DocsESLintConfigShape as DocsESLintConfigShapeInternal } from "./eslint/DocsESLintConfig.ts";

/**
 * Package version for `@beep/repo-configs`.
 *
 * **Example** (Assert package version value)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { VERSION } from "@beep/repo-configs"
 *
 * strictEqual(VERSION, "0.0.0")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Flat docs-only ESLint config array shape exported by this package.
 *
 * **Example** (Satisfy docs ESLint shape)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import type { DocsESLintConfigShape } from "@beep/repo-configs"
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
export type DocsESLintConfigShape = DocsESLintConfigShapeInternal;

/**
 * Flat deprecated API ESLint config array shape exported by this package.
 *
 * **Example** (Satisfy deprecated APIs shape)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import type { DeprecatedApisESLintConfigShape } from "@beep/repo-configs"
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
export type DeprecatedApisESLintConfigShape = DeprecatedApisESLintConfigShapeInternal;

/**
 * Shared docs-only repository ESLint flat config.
 *
 * **Example** (Detect TSDoc syntax rule)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { DocsESLintConfig } from "@beep/repo-configs"
 *
 * const hasTSDocSyntaxRule = DocsESLintConfig.some((entry) => entry.rules?.["tsdoc/syntax"] === "error")
 *
 * strictEqual(hasTSDocSyntaxRule, true)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const DocsESLintConfig = DocsESLintConfigInternal;

/**
 * Shared deprecated API ESLint flat config.
 *
 * **Example** (Detect no-deprecated rule)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { DeprecatedApisESLintConfig } from "@beep/repo-configs"
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
export const DeprecatedApisESLintConfig = DeprecatedApisESLintConfigInternal;
