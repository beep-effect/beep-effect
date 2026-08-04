/**
 * Identity registry lint command.
 *
 * Enforces the canonical `@beep/identity` composer registry invariant:
 * every `@beep/*` workspace package (apps included) has a slug in the
 * `$I.compose(...)` call and a dedicated `export const $XxxId` block in
 * `packages/foundation/modeling/identity/src/packages.ts`, and no package
 * outside `@beep/identity` constructs a local root composer via the
 * identity `make(...)` export.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { normalizePath } from "@beep/schema";
import { A, Str, thunkFalse } from "@beep/utils";
import { Console, Effect, FileSystem, HashSet, Order, Path } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { Node, Project } from "ts-morph";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { CreatePackageIdentityRegistration } from "../CreatePackage/internal/IdentityRegistration.ts";

const $I = $RepoCliId.create("commands/Lint/IdentityRegistry");

const IDENTITY_PACKAGE_NAME = "@beep/identity";
const IDENTITY_MODULE_PREFIX = "@beep/identity/";
const IDENTITY_PACKAGES_MODULE = "@beep/identity/packages";
const FIX_HINT = "Run `bun run beep lint identity-registry --fix` to register missing packages.";
// Test sources are deliberately exempt from the local-root scan;
// generated/output directories never carry authored composers.
const EXCLUDED_SCAN_DIRECTORIES = HashSet.fromIterable([
  "node_modules",
  "dist",
  "dist-test",
  "build",
  "coverage",
  ".turbo",
  "test",
]);

class IdentityRegistryViolation extends S.Class<IdentityRegistryViolation>($I`IdentityRegistryViolation`)(
  {
    kind: S.String,
    subject: S.String,
    detail: S.String,
  },
  $I.annote("IdentityRegistryViolation", {
    description: "Identity registry lint violation row: violation kind, offending subject, and remediation detail.",
  })
) {}

const collectSourceFiles = Effect.fn("IdentityRegistry.collectSourceFiles")(function* (sourceRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const rootExists = yield* fs.exists(sourceRoot).pipe(Effect.orElseSucceed(thunkFalse));

  if (!rootExists) {
    return A.empty<string>();
  }

  const walk = Effect.fn("IdentityRegistry.collectSourceFiles.walk")(function* (
    currentPath: string
  ): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
    const stat = yield* fs.stat(currentPath).pipe(Effect.option);

    if (O.isNone(stat)) {
      return A.empty<string>();
    }

    if (stat.value.type === "File") {
      return Str.endsWith(".ts")(currentPath) || Str.endsWith(".tsx")(currentPath)
        ? A.of(normalizePath(path.resolve(currentPath)))
        : A.empty<string>();
    }

    if (stat.value.type !== "Directory") {
      return A.empty<string>();
    }

    const entries = yield* fs.readDirectory(currentPath).pipe(Effect.orElseSucceed(A.empty<string>));
    let files = A.empty<string>();

    for (const entry of entries) {
      if (HashSet.has(EXCLUDED_SCAN_DIRECTORIES, entry)) {
        continue;
      }

      files = A.appendAll(files, yield* walk(path.join(currentPath, entry)));
    }

    return files;
  });

  return A.sort(yield* walk(sourceRoot), Order.String);
});

const isIdentityRootModuleSpecifier = (specifier: string): boolean =>
  specifier !== IDENTITY_PACKAGES_MODULE &&
  (specifier === IDENTITY_PACKAGE_NAME || Str.startsWith(IDENTITY_MODULE_PREFIX)(specifier));

const collectLocalRootComposerUses = (
  project: Project,
  filePath: string,
  content: string
): ReadonlyArray<IdentityRegistryViolation> => {
  const sourceFile = project.createSourceFile(filePath, content, { overwrite: true });
  let violations = A.empty<IdentityRegistryViolation>();
  let namespaceAliases = A.empty<string>();

  for (const declaration of sourceFile.getImportDeclarations()) {
    if (declaration.isTypeOnly()) {
      continue;
    }

    const specifier = declaration.getModuleSpecifier().getLiteralText();

    if (!isIdentityRootModuleSpecifier(specifier)) {
      continue;
    }

    for (const namedImport of declaration.getNamedImports()) {
      if (namedImport.getName() === "make" && !namedImport.isTypeOnly()) {
        violations = A.append(
          violations,
          IdentityRegistryViolation.make({
            kind: "local-root-composer",
            subject: `${filePath}:${namedImport.getStartLineNumber()}`,
            detail: `Import the canonical composer from "${IDENTITY_PACKAGES_MODULE}" instead of building a local root via \`make(...)\`.`,
          })
        );
      }
    }

    const namespaceImport = declaration.getNamespaceImport();

    if (namespaceImport !== undefined) {
      namespaceAliases = A.append(namespaceAliases, namespaceImport.getText());
    }
  }

  if (A.isReadonlyArrayNonEmpty(namespaceAliases)) {
    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      const expression = node.getExpression();

      if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== "make") {
        return;
      }

      const receiver = expression.getExpression();

      if (Node.isIdentifier(receiver) && A.some(namespaceAliases, Str.equivalence(receiver.getText()))) {
        violations = A.append(
          violations,
          IdentityRegistryViolation.make({
            kind: "local-root-composer",
            subject: `${filePath}:${node.getStartLineNumber()}`,
            detail: `Import the canonical composer from "${IDENTITY_PACKAGES_MODULE}" instead of building a local root via \`${receiver.getText()}.make(...)\`.`,
          })
        );
      }
    });
  }

  return violations;
};

const runIdentityRegistryLint = Effect.fn("IdentityRegistry.runIdentityRegistryLint")(function* (options: {
  readonly fix: boolean;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot();
  const slugsToDirs = yield* CreatePackageIdentityRegistration.collectWorkspaceIdentityEntries(repoRoot);
  const identityPackagesFilePath = yield* CreatePackageIdentityRegistration.resolveIdentityPackagesFilePath(repoRoot);
  const identityPackagesAbsolutePath = path.join(repoRoot, identityPackagesFilePath);

  const slugs = A.map(slugsToDirs, ([slug]) => slug);

  if (options.fix) {
    const registeredSlugs = yield* CreatePackageIdentityRegistration.registerMissingWorkspaceIdentityPackages(repoRoot);

    for (const slug of registeredSlugs) {
      yield* Console.log(`[lint:identity-registry] registered "${slug}" in ${identityPackagesFilePath}`);
    }
  }

  const registryContent = yield* fs.readFileString(identityPackagesAbsolutePath);
  const completenessViolations = A.map(
    CreatePackageIdentityRegistration.missingIdentityRegistrations(registryContent, slugs),
    (slug) =>
      IdentityRegistryViolation.make({
        kind: "missing-registration",
        subject: `@beep/${slug}`,
        detail: `Add "${slug}" to $I.compose(...) and a dedicated \`export const $${Str.pascalCase(slug)}Id\` in ${identityPackagesFilePath}. ${FIX_HINT}`,
      })
  );

  const project = new Project({ skipAddingFilesFromTsConfig: true });
  let localRootViolations = A.empty<IdentityRegistryViolation>();

  for (const [slug, dir] of slugsToDirs) {
    if (slug === "identity") {
      continue;
    }

    const files = yield* collectSourceFiles(dir);

    for (const file of files) {
      const content = yield* fs.readFileString(file).pipe(Effect.orElseSucceed(() => Str.empty));

      if (!Str.includes(IDENTITY_PACKAGE_NAME)(content)) {
        continue;
      }

      const relativeFile = normalizePath(path.relative(repoRoot, file));
      localRootViolations = A.appendAll(
        localRootViolations,
        collectLocalRootComposerUses(project, relativeFile, content)
      );
    }
  }

  const violations = A.appendAll(completenessViolations, localRootViolations);

  if (A.isReadonlyArrayNonEmpty(violations)) {
    yield* Console.error(`[lint:identity-registry] found ${A.length(violations)} violation(s).`);

    for (const violation of violations) {
      yield* Console.error(`${violation.subject} [${violation.kind}] ${violation.detail}`);
    }

    return yield* failWithReportedExit("lint identity-registry: violations found.");
  }

  yield* Console.log(
    `[lint:identity-registry] OK: ${A.length(slugs)} workspace packages registered; no local root composers.`
  );
});

/**
 * Lint command enforcing canonical `@beep/identity` composer registration.
 *
 * **Example** (Run the identity-registry lint command)
 *
 * ```ts
 * console.log("bun run beep lint identity-registry")
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const lintIdentityRegistryCommand = Command.make(
  "identity-registry",
  {
    fix: Flag.boolean("fix").pipe(
      Flag.withDescription("Register missing workspace packages in the identity composer registry")
    ),
  },
  runIdentityRegistryLint
).pipe(
  Command.withDescription(
    "Check that every @beep/* workspace package is registered in @beep/identity and no package builds local root composers"
  )
);
