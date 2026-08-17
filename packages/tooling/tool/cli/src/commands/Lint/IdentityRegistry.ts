/**
 * Identity registry lint command.
 *
 * Enforces the canonical `@beep/identity` composer registry invariant:
 * every `@beep/*` workspace package (apps included) has a slug in the
 * `$I.compose(...)` call and a dedicated `export const $XxxId` block in
 * `packages/foundation/modeling/identity/src/packages.ts`, lab workspaces
 * under `apps/labs/` live exactly in the marker-fenced generated labs
 * segment (both directions, with misplacement detection), and no package
 * outside `@beep/identity` constructs a local root composer via the
 * identity `make(...)` export.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { LiteralKit, normalizePath } from "@beep/schema";
import { A, Str, thunkFalse } from "@beep/utils";
import { Console, Effect, FileSystem, HashSet, Order, Path, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { Node, Project } from "ts-morph";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { registerMissingWorkspaceIdentityPackages } from "../CreatePackage/internal/IdentityBulkRegistration.ts";
import { CreatePackageIdentityRegistration } from "../CreatePackage/internal/IdentityRegistration.ts";
import { LabIdentitySegment } from "../CreatePackage/internal/LabIdentitySegment.ts";
import type { LabIdentitySegmentState } from "../CreatePackage/internal/LabIdentitySegment.ts";

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

const IdentityRegistryViolationKind = LiteralKit([
  "missing-registration",
  "orphan-registration",
  "local-root-composer",
  "labs-segment-missing",
  "labs-segment-extra",
  "labs-segment-misplaced",
]).pipe(
  $I.annoteSchema("IdentityRegistryViolationKind", {
    description:
      "Closed identity-registry violation kind: registry completeness, orphaned registrations, local root composers, and generated-labs-segment drift.",
  })
);

class IdentityRegistryViolation extends S.Class<IdentityRegistryViolation>($I`IdentityRegistryViolation`)(
  {
    kind: IdentityRegistryViolationKind,
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

/**
 * Slugs present in the generated labs segment (composer group or export
 * block) with no live lab workspace behind them, sorted.
 *
 * @param state - Labs segment diff produced by `LabIdentitySegment.diffLabIdentitySegment`.
 * @returns Sorted stale generated-lab slugs.
 */
const staleGeneratedLabSlugs = (state: LabIdentitySegmentState): ReadonlyArray<string> =>
  A.sort(
    A.fromIterable(
      HashSet.difference(
        HashSet.union(HashSet.fromIterable(state.actualComposerSlugs), HashSet.fromIterable(state.actualExportSlugs)),
        HashSet.fromIterable(state.expectedSlugs)
      )
    ),
    Order.String
  );

// Registration surfaces (composer slug, export const) an orphan slug still occupies.
const orphanSurfaces = (
  composerSlugs: HashSet.HashSet<string>,
  exportSlugs: HashSet.HashSet<string>,
  slug: string
): ReadonlyArray<string> =>
  A.filter(
    [
      HashSet.has(composerSlugs, slug) ? "$I.compose(...)" : Str.empty,
      HashSet.has(exportSlugs, slug) ? `export $${Str.pascalCase(slug)}Id` : Str.empty,
    ],
    Str.isNonEmpty
  );

// Registry completeness rows (live workspaces missing from the registry) plus
// orphan rows (registered slugs with no live workspace), in report order.
const registrySlugViolations = (
  registryContent: string,
  slugs: ReadonlyArray<string>,
  identityPackagesFilePath: string
): ReadonlyArray<IdentityRegistryViolation> => {
  const completenessViolations = A.map(
    CreatePackageIdentityRegistration.missingIdentityRegistrations(registryContent, slugs),
    (slug) =>
      IdentityRegistryViolation.make({
        kind: "missing-registration",
        subject: `@beep/${slug}`,
        detail: `Add "${slug}" to $I.compose(...) and a dedicated \`export const $${Str.pascalCase(slug)}Id\` in ${identityPackagesFilePath}. ${FIX_HINT}`,
      })
  );
  const liveSlugs = HashSet.fromIterable(slugs);
  const composerSlugs = HashSet.fromIterable(
    CreatePackageIdentityRegistration.registeredIdentityComposerSlugs(registryContent)
  );
  const exportSlugs = HashSet.fromIterable(
    CreatePackageIdentityRegistration.registeredIdentityExportSlugs(registryContent)
  );
  const orphanSlugs = A.sort(
    A.fromIterable(HashSet.difference(HashSet.union(composerSlugs, exportSlugs), liveSlugs)),
    Order.String
  );
  const orphanViolations = A.map(orphanSlugs, (slug) =>
    IdentityRegistryViolation.make({
      kind: "orphan-registration",
      subject: `@beep/${slug}`,
      detail: `Remove ${A.join(orphanSurfaces(composerSlugs, exportSlugs, slug), " and ")} from ${identityPackagesFilePath}; no live workspace owns this composer.`,
    })
  );
  return A.appendAll(completenessViolations, orphanViolations);
};

// Labs-segment drift rows: expected labs absent from the generated segment,
// stale generated entries, and labs registered outside the segment.
const labsSegmentViolations = (
  labsState: LabIdentitySegmentState,
  identityPackagesFilePath: string
): ReadonlyArray<IdentityRegistryViolation> => {
  const labComposerSet = HashSet.fromIterable(labsState.actualComposerSlugs);
  const labExportSet = HashSet.fromIterable(labsState.actualExportSlugs);
  const misplacedLabSet = HashSet.fromIterable(labsState.misplacedSlugs);
  const labsMissingViolations = A.map(
    A.filter(
      labsState.expectedSlugs,
      (slug) =>
        (!HashSet.has(labComposerSet, slug) || !HashSet.has(labExportSet, slug)) && !HashSet.has(misplacedLabSet, slug)
    ),
    (slug) =>
      IdentityRegistryViolation.make({
        kind: "labs-segment-missing",
        subject: `@beep/${slug}`,
        detail: `Lab "@beep/${slug}" is not registered in the generated labs segment of ${identityPackagesFilePath}. ${FIX_HINT}`,
      })
  );
  const labsExtraViolations = A.map(staleGeneratedLabSlugs(labsState), (slug) =>
    IdentityRegistryViolation.make({
      kind: "labs-segment-extra",
      subject: `@beep/${slug}`,
      detail: `The generated labs segment of ${identityPackagesFilePath} contains "${slug}" with no live lab under apps/labs. ${FIX_HINT}`,
    })
  );
  const labsMisplacedViolations = A.map(labsState.misplacedSlugs, (slug) =>
    IdentityRegistryViolation.make({
      kind: "labs-segment-misplaced",
      subject: `@beep/${slug}`,
      detail: `Lab "${slug}" is registered outside the generated labs segment of ${identityPackagesFilePath}. ${FIX_HINT}`,
    })
  );
  return A.appendAll(A.appendAll(labsMissingViolations, labsExtraViolations), labsMisplacedViolations);
};

// --fix path: consolidate misplaced labs into the generated segment, register
// missing workspace packages, log stale generated-lab removals, then re-diff.
const applyRegistryFixes = Effect.fn("IdentityRegistry.applyRegistryFixes")(function* (
  repoRoot: string,
  identityPackagesFilePath: string,
  labsState: LabIdentitySegmentState
) {
  for (const slug of labsState.misplacedSlugs) {
    yield* CreatePackageIdentityRegistration.removeIdentityPackageRegistration(identityPackagesFilePath, slug);
    yield* Console.log(
      `[lint:identity-registry] removed misplaced lab "${slug}" from outside the generated labs segment in ${identityPackagesFilePath}`
    );
  }

  const registeredSlugs = yield* registerMissingWorkspaceIdentityPackages(repoRoot);

  for (const slug of registeredSlugs) {
    yield* Console.log(`[lint:identity-registry] registered "${slug}" in ${identityPackagesFilePath}`);
  }

  for (const slug of staleGeneratedLabSlugs(labsState)) {
    yield* Console.log(
      `[lint:identity-registry] removed "${slug}" from the generated labs segment in ${identityPackagesFilePath}`
    );
  }

  return yield* LabIdentitySegment.diffLabIdentitySegment(repoRoot);
});

// Local-root-composer scan across every non-identity workspace source tree.
const collectLocalRootViolations = Effect.fn("IdentityRegistry.collectLocalRootViolations")(function* (
  repoRoot: string,
  slugsToDirs: ReadonlyArray<readonly [slug: string, dir: string]>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  let violations = A.empty<IdentityRegistryViolation>();

  for (const [, dir] of A.filter(slugsToDirs, ([slug]) => slug !== "identity")) {
    for (const file of yield* collectSourceFiles(dir)) {
      const content = yield* fs.readFileString(file).pipe(Effect.orElseSucceed(() => Str.empty));

      if (!Str.includes(IDENTITY_PACKAGE_NAME)(content)) {
        continue;
      }

      violations = A.appendAll(
        violations,
        collectLocalRootComposerUses(project, normalizePath(path.relative(repoRoot, file)), content)
      );
    }
  }

  return violations;
});

// Violation report: count header, one row per violation, reported non-zero exit.
const reportViolations = Effect.fn("IdentityRegistry.reportViolations")(function* (
  violations: A.NonEmptyReadonlyArray<IdentityRegistryViolation>
) {
  yield* Console.error(`[lint:identity-registry] found ${A.length(violations)} violation(s).`);

  for (const violation of violations) {
    yield* Console.error(`${violation.subject} [${violation.kind}] ${violation.detail}`);
  }

  return yield* failWithReportedExit("lint identity-registry: violations found.");
});

// Success line summarizing registry and generated-labs-segment health.
const identityRegistryOkLine = (workspaceCount: number, labCount: number): string =>
  `[lint:identity-registry] OK: ${workspaceCount} workspace packages registered; ${labCount} lab(s) in the generated labs segment; no orphan or local root composers.`;

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
  const labsBefore = yield* Effect.result(LabIdentitySegment.diffLabIdentitySegment(repoRoot));

  if (Result.isFailure(labsBefore)) {
    yield* Console.error(`[lint:identity-registry] ${labsBefore.failure.message}`);
    return yield* failWithReportedExit("lint identity-registry: generated labs segment markers are invalid.");
  }

  const labsState = options.fix
    ? yield* applyRegistryFixes(repoRoot, identityPackagesFilePath, labsBefore.success)
    : labsBefore.success;

  const registryContent = yield* fs.readFileString(identityPackagesAbsolutePath);
  const violations = A.appendAll(
    A.appendAll(
      registrySlugViolations(registryContent, slugs, identityPackagesFilePath),
      labsSegmentViolations(labsState, identityPackagesFilePath)
    ),
    yield* collectLocalRootViolations(repoRoot, slugsToDirs)
  );

  if (A.isReadonlyArrayNonEmpty(violations)) {
    return yield* reportViolations(violations);
  }

  yield* Console.log(identityRegistryOkLine(A.length(slugs), A.length(labsState.expectedSlugs)));
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
    "Check that @beep/* workspace packages and identity composers agree exactly and no package builds local root composers"
  )
);
