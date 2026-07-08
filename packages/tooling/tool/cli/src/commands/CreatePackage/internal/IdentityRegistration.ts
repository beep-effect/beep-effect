/**
 * Identity package registration helpers for create-package.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DomainError, getWorkspaceDir, TSMorphService } from "@beep/repo-utils";
import { A, Str, Text } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Effect, FileSystem, Path, pipe } from "effect";
import { SyntaxKind } from "ts-morph";

/**
 * Workspace package name for the identity composer package.
 *
 * @example
 * ```ts
 * import { IDENTITY_PACKAGE_NAME } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityRegistration"
 *
 * console.log(IDENTITY_PACKAGE_NAME)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const IDENTITY_PACKAGE_NAME = "@beep/identity" as const;
/**
 * Path segments for the @beep/identity package composer export file.
 *
 * @example
 * ```ts
 * import { IDENTITY_PACKAGES_EXPORT_PATH } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityRegistration"
 *
 * console.log(IDENTITY_PACKAGES_EXPORT_PATH)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const IDENTITY_PACKAGES_EXPORT_PATH = ["src", "packages.ts"] as const;

/**
 * Build the identity composer accessor name for a package.
 *
 * @example
 * ```ts
 * import { toIdentityAccessorName } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityRegistration"
 *
 * const result = toIdentityAccessorName("@beep/repo-cli")
 * console.log(result) // rendered command output
 * ```
 * @category utilities
 * @since 0.0.0
 */
const toIdentityAccessorName = (packageName: string): string => `$${Str.pascalCase(packageName)}Id`;

/**
 * Render the typed identity composer export block for a package.
 *
 * @example
 * ```ts
 * import { typedIdentityExportBlock } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityRegistration"
 *
 * const result = typedIdentityExportBlock("RepoCli", "$RepoCliId")
 * console.log(result) // rendered command output
 * ```
 * @category utilities
 * @since 0.0.0
 */
const typedIdentityExportBlock = (packageName: string): string => {
  const accessorName = toIdentityAccessorName(packageName);
  const exampleName = Str.pascalCase(packageName);
  return Text.joinLines([
    "",
    "/**",
    ` * Identity composer for \`@beep/${packageName}\`.`,
    " *",
    " * @example",
    " * ```typescript",
    ` * import { ${accessorName} } from "@beep/identity"`,
    " *",
    ` * const id = ${accessorName}.make("${exampleName}")`,
    " * void id",
    " * ```",
    " *",
    " * @since 0.0.0",
    " * @category configuration",
    " */",
    `export const ${accessorName}: Identity.IdentityComposer<"@beep/${packageName}"> = composers.${accessorName};`,
  ]);
};

/**
 * Resolve the repo-relative identity package composer file path.
 *
 * @example
 * ```ts
 * import { resolveIdentityPackagesFilePath } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityRegistration"
 *
 * const result = resolveIdentityPackagesFilePath("/repo")
 * console.log(result) // rendered command output
 * ```
 * @category utilities
 * @since 0.0.0
 */
const resolveIdentityPackagesFilePath = Effect.fn(function* (repoRoot: string) {
  const path = yield* Path.Path;
  const identityWorkspaceDir = yield* getWorkspaceDir(repoRoot, IDENTITY_PACKAGE_NAME);

  if (O.isNone(identityWorkspaceDir)) {
    return yield* DomainError.make({
      message: `Unable to resolve ${IDENTITY_PACKAGE_NAME} workspace for package identity registration.`,
    });
  }

  return path.relative(repoRoot, path.join(identityWorkspaceDir.value, ...IDENTITY_PACKAGES_EXPORT_PATH));
});

/**
 * Add a package segment and typed identity export to @beep/identity.
 *
 * @example
 * ```ts
 * import { ensureIdentityPackageRegistration } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityRegistration"
 *
 * const example = ensureIdentityPackageRegistration
 * console.log(typeof example !== "undefined") // true
 * ```
 * @category utilities
 * @since 0.0.0
 */
const ensureIdentityPackageRegistration = Effect.fn(function* (identityPackagesFilePath: string, packageName: string) {
  const tsMorphService = yield* TSMorphService;
  return yield* tsMorphService.updateSourceFile(identityPackagesFilePath, (sourceFile) => {
    const composersDeclaration =
      sourceFile.getVariableDeclaration("generatedComposers") ?? sourceFile.getVariableDeclarationOrThrow("composers");
    const composersCall = composersDeclaration.getInitializerIfKindOrThrow(SyntaxKind.CallExpression);
    const existingSegments = pipe(
      composersCall.getArguments(),
      A.flatMap((argument) => pipe(O.fromNullishOr(argument.asKind(SyntaxKind.StringLiteral)), O.toArray)),
      A.map((literal) => literal.getLiteralText())
    );

    if (!A.some(existingSegments, Str.equivalence(packageName))) {
      composersCall.addArgument(`"${packageName}"`);
    }

    const accessorName = toIdentityAccessorName(packageName);
    if (sourceFile.getVariableDeclaration(accessorName) === undefined) {
      sourceFile.addStatements(typedIdentityExportBlock(packageName));
    }
  });
});

/**
 * Check whether @beep/identity needs a package composer registration.
 *
 * @example
 * ```ts
 * import { identityPackageRegistrationNeeded } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityRegistration"
 *
 * const result = identityPackageRegistrationNeeded("export {}", "$RepoCliId")
 * console.log(result) // rendered command output
 * ```
 * @category utilities
 * @since 0.0.0
 */
const identityPackageRegistrationNeeded = Effect.fn(function* (
  repoRoot: string,
  identityPackagesFilePath: string,
  packageName: string
) {
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  const filePath = path.join(repoRoot, identityPackagesFilePath);
  const content = yield* fs
    .readFileString(filePath)
    .pipe(Effect.mapError(DomainError.newCause(`Failed to read "${filePath}"`)));

  const accessorName = toIdentityAccessorName(packageName);
  return !Str.includes(`"${packageName}"`)(content) || !Str.includes(`export const ${accessorName}`)(content);
});

/**
 * Internal identity registration surface used by the create-package command.
 *
 * @example
 * ```ts
 * import { CreatePackageIdentityRegistration } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityRegistration"
 *
 * console.log(CreatePackageIdentityRegistration.toIdentityAccessorName("repo-cli"))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const CreatePackageIdentityRegistration = {
  ensureIdentityPackageRegistration,
  identityPackageRegistrationNeeded,
  resolveIdentityPackagesFilePath,
  toIdentityAccessorName,
  typedIdentityExportBlock,
} as const;
