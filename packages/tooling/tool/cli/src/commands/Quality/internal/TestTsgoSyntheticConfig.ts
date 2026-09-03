/**
 * Static fields shared by every package-owned synthetic tsgo test config.
 *
 * @since 0.0.0
 */

import { A } from "@beep/utils";

/**
 * Static compiler fields applied to every package-owned synthetic tsgo test config.
 *
 * **Details**
 *
 * The package worker supplies the owning tsconfig, test-file list, repository root,
 * and temporary build-info path. This template owns the invariant compiler posture.
 *
 * **Example** (Inspect the no-emit posture)
 *
 * ```ts
 * import { testTsgoSyntheticConfigTemplate } from "@beep/repo-cli/commands/Quality/Quality.command"
 *
 * if (!testTsgoSyntheticConfigTemplate.compilerOptions.noEmit) {
 *   throw new Error("the tsgo tests lane must never emit package artifacts")
 * }
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const testTsgoSyntheticConfigTemplate = {
  references: A.empty<string>(),
  exclude: A.empty<string>(),
  compilerOptions: {
    composite: false,
    declaration: false,
    declarationMap: false,
    emitDeclarationOnly: false,
    incremental: false,
    noEmit: true,
    sourceMap: false,
    types: ["node", "bun"],
  },
};
