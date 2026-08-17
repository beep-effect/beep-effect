/**
 * Identity package registration helpers for create-package.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DomainError, getWorkspaceDir, resolveWorkspaceDirs, TSMorphService } from "@beep/repo-utils";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Effect, FileSystem, Order, Path, pipe } from "effect";
import { Project, SyntaxKind } from "ts-morph";
import { toIdentityAccessorName, typedIdentityExportBlock } from "./IdentityExportBlock.ts";
import type { CallExpression, SourceFile, VariableDeclaration } from "ts-morph";

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

const composeCallExpressions = (sourceFile: SourceFile): ReadonlyArray<CallExpression> =>
  A.flatMap(sourceFile.getVariableDeclarations(), (declaration) =>
    pipe(
      O.fromNullishOr(declaration.getInitializerIfKind(SyntaxKind.CallExpression)),
      O.filter((call) => Str.endsWith(".compose")(call.getExpression().getText())),
      O.toArray
    )
  );

const removeComposeSlugArguments = (call: CallExpression, packageName: string): void => {
  const arguments_ = call.getArguments();
  for (let index = A.length(arguments_) - 1; index >= 0; index -= 1) {
    const literal = pipe(
      A.get(arguments_, index),
      O.flatMap((argument) => O.fromNullishOr(argument.asKind(SyntaxKind.StringLiteral)))
    );
    if (O.isSome(literal) && Str.equivalence(literal.value.getLiteralText(), packageName)) call.removeArgument(index);
  }
};

const isAccessorExportFor = (
  declaration: VariableDeclaration,
  packageName: string,
  mechanicalAccessor: string
): boolean => {
  const declarationText = declaration.getText();
  return (
    Str.equivalence(declaration.getName(), mechanicalAccessor) ||
    Str.includes(`IdentityComposer<"@beep/${packageName}">`)(declarationText) ||
    Str.includes(`composers.${mechanicalAccessor}`)(declarationText)
  );
};

const removeAccessorExportStatements = (sourceFile: SourceFile, packageName: string): void => {
  const mechanicalAccessor = toIdentityAccessorName(packageName);
  for (const declaration of sourceFile.getVariableDeclarations()) {
    const statement = declaration.getVariableStatement();
    if (statement === undefined || !statement.isExported()) continue;
    if (isAccessorExportFor(declaration, packageName, mechanicalAccessor)) statement.remove();
  }
};

/**
 * Remove a package segment and every dedicated identity export from `@beep/identity`.
 *
 * **Details**
 *
 * The removal visits every `$I.compose(...)` declaration so it also supports the
 * generated labs group when that P2 writer lands. Dedicated exports and manual
 * casing aliases are removed by their package identity or composer initializer.
 *
 * **Example** (Build an identity removal effect)
 *
 * ```ts
 * import { CreatePackageIdentityRegistration } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityRegistration"
 * import { Effect } from "effect"
 *
 * const program = CreatePackageIdentityRegistration.removeIdentityPackageRegistration(
 *   "packages/foundation/modeling/identity/src/packages.ts",
 *   "example"
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const removeIdentityPackageRegistration = Effect.fn("IdentityRegistration.removeIdentityPackageRegistration")(
  function* (identityPackagesFilePath: string, packageName: string) {
    const tsMorphService = yield* TSMorphService;
    return yield* tsMorphService.updateSourceFile(identityPackagesFilePath, (sourceFile) => {
      for (const call of composeCallExpressions(sourceFile)) removeComposeSlugArguments(call, packageName);
      removeAccessorExportStatements(sourceFile, packageName);
    });
  }
);

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
 * Read every string-literal argument text from one call expression.
 *
 * @param call - Call expression whose arguments are inspected.
 * @returns The literal texts of the call's string-literal arguments.
 * @category getters
 * @since 0.0.0
 */
const stringLiteralArgumentTexts = (call: CallExpression): ReadonlyArray<string> =>
  A.flatMap(call.getArguments(), (argument) =>
    pipe(
      O.fromNullishOr(argument.asKind(SyntaxKind.StringLiteral)),
      O.map((literal) => literal.getLiteralText()),
      O.toArray
    )
  );

/**
 * Read composer slugs declared by every `$I.compose(...)` group in registry source.
 *
 * @param registryContent - Current text of the identity `packages.ts` file.
 * @returns Sorted composer slugs found across every compose group.
 * @category getters
 * @since 0.0.0
 */
const registeredIdentityComposerSlugs = (registryContent: string): ReadonlyArray<string> => {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile("packages.ts", registryContent);
  return A.sort(A.flatMap(composeCallExpressions(sourceFile), stringLiteralArgumentTexts), Order.String);
};

/**
 * Read package slugs represented by dedicated exported identity composers.
 *
 * @param registryContent - Current text of the identity `packages.ts` file.
 * @returns Sorted package slugs inferred from the dedicated composer exports.
 * @category getters
 * @since 0.0.0
 */
const registeredIdentityExportSlugs = (registryContent: string): ReadonlyArray<string> => {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile("packages.ts", registryContent);
  const composerSlugs = registeredIdentityComposerSlugs(registryContent);
  let slugs = A.empty<string>();
  for (const declaration of sourceFile.getVariableDeclarations()) {
    const statement = declaration.getVariableStatement();
    if (statement === undefined || !statement.isExported()) continue;
    const initializer = declaration.getInitializer();
    if (initializer === undefined || !Str.startsWith("composers.$")(initializer.getText())) continue;
    const typedSlug = pipe(
      O.fromNullishOr(declaration.getTypeNode()),
      O.map((node) => node.getText().match(/IdentityComposer<"@beep\/([^"]+)">/)),
      O.flatMap(O.fromNullishOr),
      O.flatMap((match) => O.fromNullishOr(match[1]))
    );
    const matchedComposer = A.findFirst(composerSlugs, (slug) =>
      accessorExportPattern(slug).test(`export const ${declaration.getName()}`)
    );
    const inferredSlug = pipe(Str.slice(1, -2)(declaration.getName()), Str.kebabCase);
    slugs = A.append(
      slugs,
      pipe(
        typedSlug,
        O.orElse(() => matchedComposer),
        O.getOrElse(() => inferredSlug)
      )
    );
  }
  return A.sort(slugs, Order.String);
};

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
  registeredIdentityComposerSlugs,
  registeredIdentityExportSlugs,
  removeIdentityPackageRegistration,
  resolveIdentityPackagesFilePath,
  toIdentityAccessorName,
  typedIdentityExportBlock,
} as const;
