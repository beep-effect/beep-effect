/**
 * Identity package registration helpers for create-package.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { workspaceDirectories } from "@beep/repo-cli-kit/RepoWorkspaces";
import { mentionsToken } from "@beep/repo-cli-kit/WholeToken";
import { DomainError, TSMorphService } from "@beep/repo-utils";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import { Project, SyntaxKind } from "ts-morph";
import { PURE_ANNOTATION, toIdentityAccessorName, typedIdentityExportBlock } from "./IdentityExportBlock.ts";
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

const resolveIdentityPackagesFilePath = Effect.fn(function* (repoRoot: string) {
  const path = yield* Path.Path;
  const workspaceDirectories1 = yield* workspaceDirectories(repoRoot);
  const identityWorkspaceDir = HashMap.get(workspaceDirectories1, IDENTITY_PACKAGE_NAME);

  if (O.isNone(identityWorkspaceDir)) {
    return yield* DomainError.make({
      message: `Unable to resolve ${IDENTITY_PACKAGE_NAME} workspace for package identity registration.`,
    });
  }

  return path.relative(repoRoot, path.join(identityWorkspaceDir.value, ...IDENTITY_PACKAGES_EXPORT_PATH));
});

const registerIdentityIn = (packageName: string) => (sourceFile: SourceFile) => {
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
};

const ensureIdentityPackageRegistration = Effect.fn(function* (
  identityPackagesFilePath: string,
  packageName: string,
  repoRoot?: string | undefined
) {
  const tsMorphService = yield* TSMorphService;
  return yield* tsMorphService.updateSourceFile(identityPackagesFilePath, registerIdentityIn(packageName), repoRoot);
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

const ROOT_LEAF_CALLEE = "$I.create";
const LEGACY_COMPOSERS_READ_PREFIX = "composers.$";

const rootLeafSlug = (declaration: VariableDeclaration): O.Option<string> =>
  pipe(
    O.fromNullishOr(declaration.getInitializerIfKind(SyntaxKind.CallExpression)),
    O.filter((call) => Str.equivalence(call.getExpression().getText(), ROOT_LEAF_CALLEE)),
    O.map((call) => call.getArguments()),
    O.filter((arguments_) => A.length(arguments_) === 1),
    O.flatMap(A.head),
    O.flatMap((argument) => O.fromNullishOr(argument.asKind(SyntaxKind.StringLiteral))),
    O.map((literal) => literal.getLiteralText())
  );

const PURE_COMMENT_PATTERN = /\/\*\s*[#@]__PURE__\s*\*\//;

// The `/*#__PURE__*/` (or `@__PURE__`) comment that lets bundlers drop an unused leaf. It is read
// from the initializer's leading trivia: ts-morph files a same-line comment after `=` as a
// trailing comment of the `=` token, so `getLeadingCommentRanges` misses the unwrapped form.
const hasPureAnnotation = (declaration: VariableDeclaration): boolean =>
  pipe(
    O.fromNullishOr(declaration.getInitializer()),
    O.exists((initializer) =>
      O.isSome(
        Str.match(PURE_COMMENT_PATTERN)(Str.slice(0, initializer.getLeadingTriviaWidth())(initializer.getFullText()))
      )
    )
  );

const readsLegacyComposers = (declaration: VariableDeclaration): boolean =>
  pipe(
    O.fromNullishOr(declaration.getInitializer()),
    O.exists((initializer) => Str.startsWith(LEGACY_COMPOSERS_READ_PREFIX)(initializer.getText()))
  );

const typedExportSlug = (declaration: VariableDeclaration): O.Option<string> =>
  pipe(
    O.fromNullishOr(declaration.getTypeNode()),
    O.flatMap((node) => Str.match(/IdentityComposer<"@beep\/([^"]+)">/)(node.getText())),
    O.flatMap((match) => O.fromNullishOr(match[1]))
  );

const isAccessorNamedFor = (declaration: VariableDeclaration, slug: string): boolean =>
  accessorExportPattern(slug).test(`export const ${declaration.getName()}`);

const isRegistryExportFor = (declaration: VariableDeclaration, slug: string): boolean =>
  O.exists(typedExportSlug(declaration), Str.equivalence(slug)) || isAccessorNamedFor(declaration, slug);

const removeAccessorExportStatements = (sourceFile: SourceFile, packageName: string): void => {
  const readsComposerAccessor = mentionsToken(`composers.${toIdentityAccessorName(packageName)}`);
  for (const declaration of sourceFile.getVariableDeclarations()) {
    const statement = declaration.getVariableStatement();
    if (statement === undefined || !statement.isExported()) continue;
    if (isRegistryExportFor(declaration, packageName) || readsComposerAccessor(declaration.getText())) {
      statement.remove();
    }
  }
};

const removeIdentityPackageRegistration = Effect.fn("IdentityRegistration.removeIdentityPackageRegistration")(
  function* (identityPackagesFilePath: string, packageName: string) {
    const tsMorphService = yield* TSMorphService;
    return yield* tsMorphService.updateSourceFile(identityPackagesFilePath, (sourceFile) => {
      for (const call of composeCallExpressions(sourceFile)) removeComposeSlugArguments(call, packageName);
      removeAccessorExportStatements(sourceFile, packageName);
    });
  }
);

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
  return !Str.includes(`"${packageName}"`)(content) || !mentionsToken(`export const ${accessorName}`)(content);
});

const BEEP_SCOPE_PREFIX = "@beep/";

const accessorExportPattern = (packageName: string): RegExp =>
  new RegExp(`export const \\$${Str.pascalCase(packageName)}Id\\b`, "i");

const missingIdentityRegistrations = (
  registryContent: string,
  packageNames: ReadonlyArray<string>
): ReadonlyArray<string> =>
  A.filter(
    packageNames,
    (name) => !Str.includes(`"${name}"`)(registryContent) || !accessorExportPattern(name).test(registryContent)
  );

const stringLiteralArgumentTexts = (call: CallExpression): ReadonlyArray<string> =>
  A.flatMap(call.getArguments(), (argument) =>
    pipe(
      O.fromNullishOr(argument.asKind(SyntaxKind.StringLiteral)),
      O.map((literal) => literal.getLiteralText()),
      O.toArray
    )
  );

const registeredIdentityComposerSlugs = (registryContent: string): ReadonlyArray<string> => {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile("packages.ts", registryContent);
  return A.sort(A.flatMap(composeCallExpressions(sourceFile), stringLiteralArgumentTexts), Order.String);
};

const legacyExportSlug = (declaration: VariableDeclaration, composerSlugs: ReadonlyArray<string>): string =>
  pipe(
    A.findFirst(composerSlugs, (slug) => accessorExportPattern(slug).test(`export const ${declaration.getName()}`)),
    O.getOrElse(() => pipe(Str.slice(1, -2)(declaration.getName()), Str.kebabCase))
  );

const registryExportDeclarations = (
  sourceFile: SourceFile,
  composerSlugs: ReadonlyArray<string>
): ReadonlyArray<readonly [declaration: VariableDeclaration, slug: string]> =>
  A.flatMap(sourceFile.getVariableDeclarations(), (declaration) => {
    const statement = declaration.getVariableStatement();
    if (statement === undefined || !statement.isExported()) return A.empty();
    const slug = pipe(
      typedExportSlug(declaration),
      O.orElse(() => O.filter(rootLeafSlug(declaration), (literal) => A.contains(composerSlugs, literal))),
      O.orElse(() =>
        readsLegacyComposers(declaration) ? O.some(legacyExportSlug(declaration, composerSlugs)) : O.none()
      ),
      O.orElse(() => A.findFirst(composerSlugs, (composerSlug) => isAccessorNamedFor(declaration, composerSlug)))
    );
    return pipe(
      slug,
      O.map((value) => [declaration, value] as const),
      O.toArray
    );
  });

const registryExports = (registryContent: string) => {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile("packages.ts", registryContent);
  return registryExportDeclarations(sourceFile, registeredIdentityComposerSlugs(registryContent));
};

const registeredIdentityExportSlugs = (registryContent: string): ReadonlyArray<string> =>
  A.sort(
    A.map(registryExports(registryContent), ([, slug]) => slug),
    Order.String
  );

const leafProblems = (declaration: VariableDeclaration, slug: string): ReadonlyArray<string> => {
  const leafSlug = rootLeafSlug(declaration);
  return A.filter(
    [
      pipe(
        leafSlug,
        O.match({
          onNone: () => `its initializer is not \`$I.create("${slug}")\``,
          onSome: (literal) =>
            Str.equivalence(literal, slug)
              ? Str.empty
              : `its \`$I.create("${literal}")\` literal does not equal its slug "${slug}"`,
        })
      ),
      O.isSome(leafSlug) && !hasPureAnnotation(declaration) ? `its initializer lacks ${PURE_ANNOTATION}` : Str.empty,
      O.isNone(typedExportSlug(declaration))
        ? `it is not typed \`Identity.IdentityComposer<"@beep/${slug}">\``
        : Str.empty,
      accessorExportPattern(slug).test(`export const ${declaration.getName()}`)
        ? Str.empty
        : `its name does not match the accessor \`${toIdentityAccessorName(slug)}\``,
    ],
    Str.isNonEmpty
  );
};

const identityLeafMismatches = (
  registryContent: string
): ReadonlyArray<readonly [accessor: string, slug: string, detail: string]> =>
  A.flatMap(registryExports(registryContent), ([declaration, slug]) => {
    const problems = leafProblems(declaration, slug);
    return A.isReadonlyArrayNonEmpty(problems)
      ? [[declaration.getName(), slug, A.join(problems, "; ")] as const]
      : A.empty();
  });

const collectWorkspaceIdentityEntries = Effect.fn("IdentityRegistration.collectWorkspaceIdentityEntries")(function* (
  repoRoot: string
) {
  const workspaces = yield* workspaceDirectories(repoRoot);
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
 * **Details**
 *
 * - `resolveIdentityPackagesFilePath` resolves the repo-relative identity composer file path.
 * - `ensureIdentityPackageRegistration` adds a package's compose segment and typed identity
 *   export. `identityPackageRegistrationNeeded` reports whether that is still needed, and
 *   `missingIdentityRegistrations` keeps the slugs missing their segment or dedicated export.
 * - `removeIdentityPackageRegistration` removes the package's segment from every `$I.compose(...)`
 *   group, every export typed for the package or named its accessor, and a legacy
 *   `composers.$X` read matched by whole token (`composers.$XId` never matches
 *   `composers.$XIdentityId`).
 * - `accessorExportPattern` matches a dedicated export case-insensitively, so a manual alias such
 *   as `$LangExtractId` for the mechanical `$LangextractId` counts.
 * - `registeredIdentityComposerSlugs` returns the sorted slugs of every compose group, and
 *   `registeredIdentityExportSlugs` the sorted slugs of every registry export.
 * - A registry export is an exported declaration typed `Identity.IdentityComposer<"@beep/<slug>">`,
 *   an untyped `$I.create("<slug>")` leaf whose slug a compose group lists, a legacy
 *   `composers.$X` read, or any other export named a listed slug's accessor (an untyped
 *   `generatedComposers.$XId` or `RepoPkgs.$XId` read, which the leaf check then reports).
 * - `identityLeafMismatches` returns one `[accessor, slug, detail]` row per registry export that
 *   is not the canonical leaf: typed, initialized by a pure-annotated `$I.create("<slug>")` whose
 *   literal equals the slug (see `typedIdentityExportBlock`), so a bundle importing one composer
 *   drops every other slug and the compose groups.
 * - `collectWorkspaceIdentityEntries` lists every beep-scoped workspace as `[slug, directory]`,
 *   sorted by slug.
 *
 * **Gotchas**
 *
 * A vocabulary composer such as `$QaId = $I.create("qa")`, under a name that is not the slug's
 * accessor, is never a registry export, so removing or checking a package whose slug equals that
 * literal leaves it alone.
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
  identityLeafMismatches,
  identityPackageRegistrationNeeded,
  missingIdentityRegistrations,
  registeredIdentityComposerSlugs,
  registeredIdentityExportSlugs,
  removeIdentityPackageRegistration,
  resolveIdentityPackagesFilePath,
  toIdentityAccessorName,
  typedIdentityExportBlock,
} as const;
