/**
 * Native runtime lint hotspot configuration for repository governance.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A } from "@beep/utils";

/**
 * Files that currently receive blocking `no-native-runtime` severity in the legacy ESLint surface.
 *
 * **Details**
 *
 * Keep this list aligned with the legacy rollback lane so the repo-local checker preserves
 * the old warn-vs-error split while P3 is active.
 *
 * **Example** (Read first error file path)
 *
 * ```ts
 * import { NO_NATIVE_RUNTIME_ERROR_FILES } from "@beep/repo-configs/eslint/NoNativeRuntimeHotspots"
 * const firstPath = NO_NATIVE_RUNTIME_ERROR_FILES[0]
 * console.log(firstPath)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const NO_NATIVE_RUNTIME_ERROR_FILES = [
  "packages/tooling/tool/cli/src/commands/DocsAggregate.ts",
  "packages/tooling/tool/cli/src/commands/Lint/index.ts",
  "packages/tooling/tool/cli/src/commands/Laws/index.ts",
  "packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts",
] as const;

/**
 * Paths that enable the stricter hotspot-only runtime checks inside the ESLint rule logic.
 *
 * **Example** (Read first check pattern)
 *
 * ```ts
 * import { NO_NATIVE_RUNTIME_EXTRA_CHECK_PATTERNS } from "@beep/repo-configs/eslint/NoNativeRuntimeHotspots"
 * const firstPattern = NO_NATIVE_RUNTIME_EXTRA_CHECK_PATTERNS[0]
 * console.log(firstPattern)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const NO_NATIVE_RUNTIME_EXTRA_CHECK_PATTERNS = [
  /^packages\/ai\/sdk\/src\/core\/AgentSdkConfig\.ts$/,
  /^packages\/ai\/sdk\/src\/core\/SessionConfig\.ts$/,
  /^packages\/ai\/sdk\/src\/core\/Diagnose\.ts$/,
  /^packages\/ai\/sdk\/src\/core\/Storage\/SessionIndexStore\.ts$/,
  /^tooling\/cli\/src\/commands\/DocsAggregate\.ts$/,
  /^tooling\/cli\/src\/commands\/Lint\/index\.ts$/,
  /^tooling\/cli\/src\/commands\/Laws\/index\.ts$/,
  /^tooling\/cli\/src\/commands\/Laws\/EffectImports\.ts$/,
  /^tooling\/cli\/src\/commands\/Laws\/TerseEffect\.ts$/,
] as const;

/**
 * Check whether a file path matches the native runtime error file allowlist.
 *
 * **Example** (Match error file allowlist)
 *
 * ```ts
 * import { isNoNativeRuntimeErrorFile } from "@beep/repo-configs/eslint/NoNativeRuntimeHotspots"
 * const matches = isNoNativeRuntimeErrorFile("packages/tooling/tool/cli/src/commands/Lint/index.ts")
 * console.log(matches)
 * ```
 *
 * @param relativeFilePath - Repo-relative file path to test against the explicit allowlist.
 * @returns `true` when the file is allowlisted for native runtime tagged errors.
 * @category predicates
 * @since 0.0.0
 */
export const isNoNativeRuntimeErrorFile = (relativeFilePath: string): boolean =>
  A.some(NO_NATIVE_RUNTIME_ERROR_FILES, (filePath) => filePath === relativeFilePath);

/**
 * Check whether a file path matches a native runtime extra-check hotspot pattern.
 *
 * **Example** (Match hotspot pattern)
 *
 * ```ts
 * import { isNoNativeRuntimeExtraCheckHotspot } from "@beep/repo-configs/eslint/NoNativeRuntimeHotspots"
 * const matches = isNoNativeRuntimeExtraCheckHotspot("packages/tooling/tool/cli/src/commands/Laws/index.ts")
 * console.log(matches)
 * ```
 *
 * @param relativeFilePath - Repo-relative file path to test against hotspot patterns.
 * @returns `true` when the file path matches a native runtime hotspot pattern.
 * @category predicates
 * @since 0.0.0
 */
export const isNoNativeRuntimeExtraCheckHotspot = (relativeFilePath: string): boolean =>
  A.some(NO_NATIVE_RUNTIME_EXTRA_CHECK_PATTERNS, (pattern) => pattern.test(relativeFilePath));
