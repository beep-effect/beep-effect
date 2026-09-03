/**
 * Leaf rendering helpers for identity composer registration, shared by the
 * flat registration writer and the generated labs segment without creating an
 * import cycle between them.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

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
    ` * ${fence}ts import.meta.vitest name="Make package ID"`,
    ` * import { ${accessorName} } from "@beep/identity/packages"`,
    " *",
    ` * const id = ${accessorName}.make("${exampleName}")`,
    " * console.log(id)",
    ` * ${fence}`,
    " *",
    " * @category configuration",
    " * @since 0.0.0",
    " */",
    `export const ${accessorName}: Identity.IdentityComposer<"@beep/${packageName}"> = composers.${accessorName};`,
  ]);
};
