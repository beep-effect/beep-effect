/**
 * Identity registry lint command.
 *
 * Enforces the canonical `@beep/identity` composer registry invariant:
 * every `@beep/*` workspace package (apps included) has a slug in the
 * `$I.compose(...)` call and a dedicated `export const $XxxId` block in
 * `packages/foundation/modeling/identity/src/packages.ts`, every such export
 * is an independent pure `$I.create("<slug>")` leaf whose literal equals its
 * slug (so a bundle that uses one composer drops the rest), lab workspaces
 * under `apps/labs/` live exactly in the marker-fenced generated labs
 * segment (both directions, with misplacement detection), and no package
 * outside `@beep/identity` constructs a local root composer via the
 * identity `make(...)` export.
 *
 * A registration whose workspace the checkout pruned (a product leaf or a
 * package the checkout's prune declaration names, its directory gone) or owns
 * is not an orphan: the orphan and stale-labs rows for it are skipped and
 * counted on the summary line instead (goals/prunable-product-leaves, seam
 * 1b). Every other registration is checked exactly as before.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import {
  isCheckoutSubjectPruned,
  loadCheckoutInventory,
  prunedCheckoutSubjectsNote,
  workspaceSubject,
} from "@beep/repo-cli-kit/CheckoutSubject";
import { failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import { productLeaves } from "@beep/repo-cli-kit/ProductLeaves";
import { findRepoRoot } from "@beep/repo-utils";
import { LiteralKit, normalizePath } from "@beep/schema";
import { A, Str, thunkFalse } from "@beep/utils";
import { compileAndExpand } from "@beep/walker/Expand";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { Node, Project } from "ts-morph";
import { registerMissingWorkspaceIdentityPackages } from "../CreatePackage/internal/IdentityBulkRegistration.ts";
import { CreatePackageIdentityRegistration } from "../CreatePackage/internal/IdentityRegistration.ts";
import { LabIdentitySegment } from "../CreatePackage/internal/LabIdentitySegment.ts";
import { checkRegistry, registryPresent, resolveRegistryLayout, writeRegistry } from "../Identity/Registry.ts";
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
  "registry-leaf-mismatch",
  "local-root-composer",
  "labs-segment-missing",
  "labs-segment-extra",
  "labs-segment-misplaced",
  "registry-shard-invalid",
  "registry-conflict",
  "registry-generated-drift",
]).pipe(
  $I.annoteSchema("IdentityRegistryViolationKind", {
    description:
      "Closed identity-registry violation kind: registry completeness, orphaned registrations, non-leaf registry exports, local root composers, generated-labs-segment drift, and the declared-term registry (invalid shards, shard conflicts, generated-artifact drift).",
  })
);

class IdentityRegistryViolation extends S.Opaque<IdentityRegistryViolation, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: IdentityRegistryViolationKind,
    subject: S.String,
    detail: S.String,
  }).pipe(
    $I.annoteSchema("IdentityRegistryViolation", {
      description: "Identity registry lint violation row: violation kind, offending subject, and remediation detail.",
    })
  )
) {}

const collectSourceFiles = Effect.fn("IdentityRegistry.collectSourceFiles")(function* (sourceRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const rootExists = yield* fs.exists(sourceRoot).pipe(Effect.orElseSucceed(thunkFalse));

  if (!rootExists) {
    return A.empty<string>();
  }

  return yield* compileAndExpand("**/*.{ts,tsx}", {
    cwd: path.resolve(sourceRoot),
    glob: { dot: true },
    prune: A.fromIterable(EXCLUDED_SCAN_DIRECTORIES),
    followSymlinks: true,
    onUnreadable: "skip",
  }).pipe(
    Effect.map((files) =>
      A.sort(
        A.map(files, (file) => normalizePath(path.resolve(sourceRoot, file))),
        Order.String
      )
    ),
    Effect.orElseSucceed(A.empty<string>)
  );
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

// Leaf rows: registry exports that are not an independent pure `$I.create("<slug>")` leaf whose
// literal equals the slug, so a one-composer bundle would keep a slug it never reads.
const registryLeafViolations = (
  registryContent: string,
  identityPackagesFilePath: string
): ReadonlyArray<IdentityRegistryViolation> =>
  A.map(CreatePackageIdentityRegistration.identityLeafMismatches(registryContent), ([accessor, slug, detail]) =>
    IdentityRegistryViolation.make({
      kind: "registry-leaf-mismatch",
      subject: `@beep/${slug}`,
      detail: `\`${accessor}\` in ${identityPackagesFilePath} must be \`export const ${accessor}: Identity.IdentityComposer<"@beep/${slug}"> = /*#__PURE__*/ $I.create("${slug}")\`: ${detail}.`,
    })
  );

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

// Declared-term registry rows: invalid shards, shard conflicts and generated-artifact drift. A
// checkout with neither shards nor the generated data module (a fixture repo) carries no registry.
// `--fix` regenerates the artifacts first; it never edits a shard.
const collectTermRegistryViolations = Effect.fn("IdentityRegistry.collectTermRegistryViolations")(function* (
  repoRoot: string,
  fix: boolean
) {
  const layout = yield* resolveRegistryLayout(repoRoot);

  if (!(yield* registryPresent(repoRoot, layout))) {
    return A.empty<IdentityRegistryViolation>();
  }

  if (fix) {
    const written = yield* writeRegistry(repoRoot, layout);

    if (Result.isSuccess(written)) {
      for (const artifact of written.success) {
        yield* Console.log(`[lint:identity-registry] regenerated ${artifact}`);
      }
    }
  }

  const issues = yield* checkRegistry(repoRoot, layout);
  return A.map(issues, (issue) =>
    IdentityRegistryViolation.make({ kind: issue.kind, subject: issue.subject, detail: issue.detail })
  );
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

// The rows that say a registration has no live workspace: an orphan, or a stale generated lab.
const OwnerlessViolationKind = LiteralKit(["orphan-registration", "labs-segment-extra"]).pipe(
  $I.annoteSchema("OwnerlessViolationKind", {
    description: "Identity-registry violation kinds that report a registration with no live workspace owner.",
  })
);
const isOwnerlessViolationKind = S.is(OwnerlessViolationKind);

// The skipped rows' line: how many, and which pruned workspaces they name.
const skippedRegistrationsLine = (skipped: A.NonEmptyReadonlyArray<IdentityRegistryViolation>): string =>
  `[lint:identity-registry] skipped ${A.length(skipped)} registration row(s) whose workspace is ${prunedCheckoutSubjectsNote(
    A.map(A.dedupe(A.map(skipped, (violation) => violation.subject)), workspaceSubject)
  )}`;

// The ownerless rows whose workspace the checkout pruned or owns, set aside from the rest. The
// inventory is read only when there is an ownerless row, so a clean registry reads nothing more.
const withoutPrunedOwners = Effect.fn("IdentityRegistry.withoutPrunedOwners")(function* (
  repoRoot: string,
  found: ReadonlyArray<IdentityRegistryViolation>
) {
  if (!A.some(found, (violation) => isOwnerlessViolationKind(violation.kind))) {
    return { skipped: A.empty<IdentityRegistryViolation>(), violations: found };
  }
  const inventory = yield* loadCheckoutInventory(repoRoot, productLeaves);
  const isPrunedOwner = (violation: IdentityRegistryViolation): boolean =>
    isOwnerlessViolationKind(violation.kind) && isCheckoutSubjectPruned(inventory, workspaceSubject(violation.subject));
  return {
    skipped: A.filter(found, isPrunedOwner),
    violations: A.filter(found, (violation) => !isPrunedOwner(violation)),
  };
});

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
  const argument = A.appendAll(
    A.appendAll(
      registrySlugViolations(registryContent, slugs, identityPackagesFilePath),
      registryLeafViolations(registryContent, identityPackagesFilePath)
    ),
    labsSegmentViolations(labsState, identityPackagesFilePath)
  );
  const collectLocalRootViolations1 = yield* collectLocalRootViolations(repoRoot, slugsToDirs);
  const termRegistryViolations = yield* collectTermRegistryViolations(repoRoot, options.fix);
  const found = A.appendAll(A.appendAll(argument, collectLocalRootViolations1), termRegistryViolations);
  const { skipped, violations } = yield* withoutPrunedOwners(repoRoot, found);

  if (A.isReadonlyArrayNonEmpty(skipped)) {
    yield* Console.log(skippedRegistrationsLine(skipped));
  }

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
    fix: Flag.Boolean("fix").pipe(
      Flag.withDefault(false),
      Flag.withDescription(
        "Register missing workspace packages in the identity composer registry and regenerate the declared-term registry artifacts"
      )
    ),
  },
  runIdentityRegistryLint
).pipe(
  Command.withDescription(
    "Check that @beep/* workspace packages and identity composers agree exactly, no package builds local root composers, and the declared-term registry artifacts match their shards"
  )
);
