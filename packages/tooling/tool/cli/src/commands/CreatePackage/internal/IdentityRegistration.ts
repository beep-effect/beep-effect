/**
 * Identity package registration helpers for create-package.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DomainError, getWorkspaceDir, resolveWorkspaceDirs, TSMorphService } from "@beep/repo-utils";
import { A, Str, Text } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Effect, FileSystem, Order, Path, pipe } from "effect";
import { SyntaxKind } from "ts-morph";

/**
 * Workspace package name for the identity composer package.
 *
 * @category utilities
 * @since 0.0.0
 */
export const IDENTITY_PACKAGE_NAME = "@beep/identity" as const;
/**
 * Path segments for the `@beep/identity` package composer export file.
 *
 * **Example** (Join path segments)
 *
 * ```ts
 * import { IDENTITY_PACKAGES_EXPORT_PATH } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityRegistration"
 *
 * console.log(IDENTITY_PACKAGES_EXPORT_PATH.join("/")) // "src/packages.ts"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const IDENTITY_PACKAGES_EXPORT_PATH = ["src", "packages.ts"] as const;

/**
 * Build the identity composer accessor name for a package.
 *
 * **Example** (Derive accessor from package)
 *
 * ```ts
 * import { toIdentityAccessorName } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityRegistration"
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
const toIdentityAccessorName = (packageName: string): string => `$${Str.pascalCase(packageName)}Id`;

/**
 * Render the typed identity composer export block for a package.
 *
 * **Example** (Render typed export block)
 *
 * ```ts
 * import { typedIdentityExportBlock } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityRegistration"
 *
 * const result = typedIdentityExportBlock("RepoCli", "$RepoCliId")
 * console.log(result) // rendered command output
 * ```
 *
 * @param packageName - Workspace package name the exported identity composer targets.
 * @returns The rendered TypeScript export block declaring the typed identity composer.
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
 * **Example** (Resolve packages file path)
 *
 * ```ts
 * import { resolveIdentityPackagesFilePath } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityRegistration"
 *
 * const result = resolveIdentityPackagesFilePath("/repo")
 * console.log(result) // rendered command output
 * ```
 *
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
 * Add a package segment and typed identity export to `@beep/identity`.
 *
 * **Example** (Register package identity export)
 *
 * ```ts
 * import { ensureIdentityPackageRegistration } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityRegistration"
 * import { Effect } from "effect"
 *
 * // Provide FileSystem to run the effect.
 * const program = ensureIdentityPackageRegistration(
 *   "packages/common/identity/src/registered-packages.ts",
 *   "@beep/schema"
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
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
 * Check whether `@beep/identity` needs a package composer registration.
 *
 * **Example** (Check registration needed)
 *
 * ```ts
 * import { identityPackageRegistrationNeeded } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityRegistration"
 *
 * const result = identityPackageRegistrationNeeded("export {}", "$RepoCliId")
 * console.log(result) // rendered command output
 * ```
 *
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

const BEEP_SCOPE_PREFIX = "@beep/";

/**
 * Match a dedicated composer export for a package, tolerating manual casing
 * aliases such as `$LangExtractId` for the mechanical `$LangextractId`.
 *
 * **Example** (Match export with casing)
 *
 * ```ts
 * import { CreatePackageIdentityRegistration } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityRegistration"
 *
 * const pattern = CreatePackageIdentityRegistration.accessorExportPattern("repo-cli")
 * console.log(pattern.test("export const $RepoCliId")) // true
 * ```
 *
 * @param packageName - Workspace package slug (without the `@beep/` scope).
 * @returns A case-insensitive pattern matching the dedicated export statement.
 * @category utilities
 * @since 0.0.0
 */
const accessorExportPattern = (packageName: string): RegExp =>
  new RegExp(`export const \\$${Str.pascalCase(packageName)}Id\\b`, "i");

/**
 * Filter workspace package slugs missing either their `$I.compose(...)`
 * segment or dedicated export in the identity registry content.
 *
 * **Example** (Filter unregistered package slugs)
 *
 * ```ts
 * import { CreatePackageIdentityRegistration } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityRegistration"
 *
 * const missing = CreatePackageIdentityRegistration.missingIdentityRegistrations("export {}", ["repo-cli"])
 * console.log(missing) // ["repo-cli"]
 * ```
 *
 * @param registryContent - Current text of the identity `packages.ts` file.
 * @param packageNames - Workspace package slugs to check.
 * @returns The slugs that still need registration.
 * @category utilities
 * @since 0.0.0
 */
const missingIdentityRegistrations = (
  registryContent: string,
  packageNames: ReadonlyArray<string>
): ReadonlyArray<string> =>
  A.filter(
    packageNames,
    (name) => !Str.includes(`"${name}"`)(registryContent) || !accessorExportPattern(name).test(registryContent)
  );

/**
 * Enumerate every `@beep/*` workspace package as `[slug, directory]` entries,
 * sorted by slug.
 *
 * **Example** (Collect workspace package entries)
 *
 * ```ts
 * import { CreatePackageIdentityRegistration } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityRegistration"
 * import { Effect } from "effect"
 *
 * const program = CreatePackageIdentityRegistration.collectWorkspaceIdentityEntries("/repo")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const collectWorkspaceIdentityEntries = Effect.fn("IdentityRegistration.collectWorkspaceIdentityEntries")(function* (
  repoRoot: string
) {
  const workspaces = yield* resolveWorkspaceDirs(repoRoot);
  let entries = A.empty<readonly [slug: string, dir: string]>();

  for (const [name, dir] of workspaces) {
    if (Str.startsWith(BEEP_SCOPE_PREFIX)(name)) {
      entries = A.append(entries, [Str.replace(BEEP_SCOPE_PREFIX, Str.empty)(name), dir] as const);
    }
  }

  return A.sort(
    entries,
    Order.mapInput(Order.String, ([slug]: readonly [slug: string, dir: string]) => slug)
  );
});

/**
 * Register every workspace package missing from the identity composer
 * registry, returning the slugs that were registered.
 *
 * **Example** (Register missing workspace packages)
 *
 * ```ts
 * import { CreatePackageIdentityRegistration } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityRegistration"
 * import { Effect } from "effect"
 *
 * const program = CreatePackageIdentityRegistration.registerMissingWorkspaceIdentityPackages("/repo")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const registerMissingWorkspaceIdentityPackages = Effect.fn(
  "IdentityRegistration.registerMissingWorkspaceIdentityPackages"
)(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const identityPackagesFilePath = yield* resolveIdentityPackagesFilePath(repoRoot);
  const entries = yield* collectWorkspaceIdentityEntries(repoRoot);
  const absolutePath = path.join(repoRoot, identityPackagesFilePath);
  const registryContent = yield* fs
    .readFileString(absolutePath)
    .pipe(Effect.mapError(DomainError.newCause(`Failed to read "${absolutePath}"`)));
  const missing = missingIdentityRegistrations(
    registryContent,
    A.map(entries, ([slug]) => slug)
  );

  for (const slug of missing) {
    yield* ensureIdentityPackageRegistration(identityPackagesFilePath, slug);
  }

  return missing;
});

/**
 * Internal identity registration surface used by the create-package command.
 *
 * **Example** (Access identity registration helpers)
 *
 * ```ts
 * import { CreatePackageIdentityRegistration } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityRegistration"
 *
 * console.log(CreatePackageIdentityRegistration.toIdentityAccessorName("repo-cli"))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const CreatePackageIdentityRegistration = {
  accessorExportPattern,
  collectWorkspaceIdentityEntries,
  ensureIdentityPackageRegistration,
  identityPackageRegistrationNeeded,
  missingIdentityRegistrations,
  registerMissingWorkspaceIdentityPackages,
  resolveIdentityPackagesFilePath,
  toIdentityAccessorName,
  typedIdentityExportBlock,
} as const;
