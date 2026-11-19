/**
 * Leaf rendering helpers for identity composer registration, shared by the
 * flat registration writer and the generated labs segment without creating an
 * import cycle between them.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { doctestFenceInfo } from "@beep/repo-utils/JSDoc/DoctestSource";
import { Str, Text } from "@beep/utils";

/**
 * Build the identity composer accessor name for a package.
 *
 * **Example** (Derive accessor from package)
 *
 * ```ts
 * import { toIdentityAccessorName } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityExportBlock"
 *
 * const result = toIdentityAccessorName("@beep/repo-cli")
 * console.log(result) // rendered command output
 * ```
 *
 * @param packageName - Workspace package name to derive the composer accessor from.
 * @returns The PascalCase identity composer accessor name (e.g. `$RepoCliId`).
 * @category utilities
 * @since 0.0.0
 */
export const toIdentityAccessorName = (packageName: string): string => `$${Str.pascalCase(packageName)}Id`;

/**
 * Pure-annotation comment that lets bundlers drop an unused identity leaf.
 *
 * **Example** (Reference the pure annotation)
 *
 * ```ts
 * import { PURE_ANNOTATION } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityExportBlock"
 *
 * console.log(PURE_ANNOTATION) // the bundler pure-annotation comment
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const PURE_ANNOTATION = "/*#__PURE__*/";

/**
 * Render the initializer of one registry leaf: an independent, pure-annotated
 * `$I.create("<slug>")` call, so a bundle keeps only the leaves it reads.
 *
 * **Example** (Render a leaf initializer)
 *
 * ```ts
 * import { identityLeafInitializer } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityExportBlock"
 *
 * const result = identityLeafInitializer("repo-cli")
 * console.log(result) // rendered leaf initializer
 * ```
 *
 * @param packageName - Workspace package slug the leaf composes from the root.
 * @returns The leaf initializer text.
 * @category utilities
 * @since 0.0.0
 */
export const identityLeafInitializer = (packageName: string): string =>
  `${PURE_ANNOTATION} $I.create("${packageName}")`;

/**
 * Render the typed identity composer export block for a package.
 *
 * **Example** (Render typed export block)
 *
 * ```ts
 * import { typedIdentityExportBlock } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityExportBlock"
 *
 * const result = typedIdentityExportBlock("repo-cli")
 * console.log(result) // rendered command output
 * ```
 *
 * @param packageName - Workspace package name the exported identity composer targets.
 * @returns The rendered TypeScript export block declaring the typed identity composer.
 * @category utilities
 * @since 0.0.0
 */
export const typedIdentityExportBlock = (packageName: string): string => {
  const accessorName = toIdentityAccessorName(packageName);
  const exampleName = Str.pascalCase(packageName);
  const fence = "\u0060\u0060\u0060";
  return Text.joinLines([
    "",
    "/**",
    ` * Identity composer for \`@beep/${packageName}\`.`,
    " *",
    " * **Example** (Make package ID)",
    " *",
    ` * ${fence}${doctestFenceInfo("Make package ID")}`,
    ` * import { ${accessorName} } from "@beep/identity/packages"`,
    " *",
    ` * const id = ${accessorName}.make("${exampleName}")`,
    " * console.log(id)",
    ` * ${fence}`,
    " *",
    " * @category configuration",
    " * @since 0.0.0",
    " */",
    `export const ${accessorName}: Identity.IdentityComposer<"@beep/${packageName}"> = ${identityLeafInitializer(packageName)};`,
  ]);
};
