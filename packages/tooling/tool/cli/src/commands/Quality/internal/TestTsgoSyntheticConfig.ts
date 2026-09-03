/**
 * Static fields shared by every package-owned synthetic tsgo test config.
 *
 * @since 0.0.0
 */

import { A } from "@beep/utils";

/**
 * @internal
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
