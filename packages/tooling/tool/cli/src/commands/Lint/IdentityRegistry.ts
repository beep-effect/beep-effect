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
 * The registry-free root `$BeepId` (`@beep/identity/Root`) is confined to
 * package leaves: only a package's `src/internal/<Composer>.ts` (for example
 * `src/internal/SchemaId.ts` in `@beep/schema`) may use it, and that leaf
 * holds exactly one `$BeepId.create("<slug>")` over its own registry slug.
 * A package that has such a leaf is a leaf package: none of its scanned
 * modules may import `@beep/identity/packages` or the `@beep/identity`
 * barrel, which both load the registry, so the rule covers every module of
 * the package and not only the ones a deployed bundle reaches today.
 *
 * A registration whose workspace the checkout pruned (a product leaf or a
 * package the checkout's prune declaration names, its directory gone) or owns
 * is not an orphan: the orphan and stale-labs rows for it are skipped and
 * counted on the summary line instead (goals/prunable-product-leaves, seam
 * 1b). Every other registration is checked exactly as before.
 *
 * The declared-term registry is gated twice (law L0-3): the generated
 * artifacts must match their source shards, and the snapshot regenerated from
 * the shards must keep the published term set of a base ref (`--base`, by
 * default the merge base with `origin/main`), read with `git show` from wherever
 * the base tree has its `@beep/identity` package, at exactly the release the
 * change against that base calls for. A term or
 * namespace IRI the base published leaves only through a deprecation. A term is
 * retired with `bun run beep identity deprecate`, which takes a live term only;
 * no command retires a namespace, whose IRI is retired by hand with a
 * deprecation row in a remaining shard. A checkout with no registry at all
 * publishes nothing, so deleting the registry is reported as the removal of every
 * term the base published, and a term snapshot left without its registry is
 * drift. Moving the package hides no removal.
 *
 * **Gotchas**
 *
 * A checkout with neither shards nor generated registry data publishes no terms. Every
 * term published by the base is then removed; a leftover snapshot is drift because
 * nothing regenerates it. An undecodable base is compared as empty to retain checkout
 * findings, but prevents fix mode from writing a release that no base backs. Fix mode
 * regenerates artifacts only; it never edits shards or writes deprecations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { TermSnapshot } from "@beep/identity/Term";
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
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { Node, Project } from "ts-morph";
import { registerMissingWorkspaceIdentityPackages } from "../CreatePackage/internal/IdentityBulkRegistration.ts";
import { CreatePackageIdentityRegistration } from "../CreatePackage/internal/IdentityRegistration.ts";
import { LabIdentitySegment } from "../CreatePackage/internal/LabIdentitySegment.ts";
import {
  BaseSnapshot,
  baseSnapshotIssues,
  checkRegistry,
  IdentityRegistryIssue,
  RegistryWrite,
  registryPresent,
  resolveRegistryLayout,
  writeRegistry,
} from "../Identity/Registry.ts";
import { baseFlag, readBaseSnapshot } from "../Identity/RegistryBase.ts";
import type { CallExpression, ImportDeclaration, ImportSpecifier, SourceFile } from "ts-morph";
import type { LabIdentitySegmentState } from "../CreatePackage/internal/LabIdentitySegment.ts";
import type { RegistryLayout } from "../Identity/Registry.ts";

const $I = $RepoCliId.create("commands/Lint/IdentityRegistry");

const IDENTITY_PACKAGE_NAME = "@beep/identity";
const IDENTITY_MODULE_PREFIX = "@beep/identity/";
const IDENTITY_PACKAGES_MODULE = "@beep/identity/packages";
const IDENTITY_ROOT_MODULE = "@beep/identity/Root";
const ROOT_COMPOSER_NAME = "$BeepId";
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
  "root-composer-outside-leaf",
  "root-leaf-slug-mismatch",
  "leaf-package-registry-import",
  "labs-segment-missing",
  "labs-segment-extra",
  "labs-segment-misplaced",
  "registry-shard-invalid",
  "registry-conflict",
  "registry-snapshot-break",
  "registry-generated-drift",
  "term-removed-without-deprecation",
  "namespace-prefix-changed",
  "deprecation-changed",
  "term-revived",
  "binding-changed",
  "release-regressed",
  "release-overstated",
  "since-misstated",
  "binding-dangling",
]).pipe(
  $I.annoteSchema("IdentityRegistryViolationKind", {
    description:
      "Closed identity-registry violation kind: registry completeness, orphaned registrations, non-leaf registry exports, local root composers, registry-free root uses outside a package leaf, leaf slug drift, registry imports in a leaf package, generated-labs-segment drift, the declared-term registry (invalid shards, shard conflicts, snapshot breaks, generated-artifact drift, binding codes that name no module), and breaks of the base ref's published term set (terms removed without a deprecation, namespace prefixes changed, deprecations changed, deprecated terms revived, bindings changed, a snapshot release wound back).",
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

// Modules whose evaluation loads the registry: the registry itself and the barrel that re-exports it.
const isRegistryLoadingModuleSpecifier = (specifier: string): boolean =>
  specifier === IDENTITY_PACKAGES_MODULE || specifier === IDENTITY_PACKAGE_NAME;

// A package's registry-free leaf: `src/internal/<Composer>.ts`, the composer named after its slug.
const leafModulePathFor = (slug: string): string => `src/internal/${Str.pascalCase(slug)}Id.ts`;

// Whether an import declaration survives type erasure: a side-effect import, or one with a value binding.
const importsRuntimeBinding = (declaration: ImportDeclaration): boolean =>
  !declaration.isTypeOnly() &&
  (declaration.getNamespaceImport() !== undefined ||
    declaration.getDefaultImport() !== undefined ||
    A.isReadonlyArrayEmpty(declaration.getNamedImports()) ||
    A.some(declaration.getNamedImports(), (namedImport) => !namedImport.isTypeOnly()));

// What the local-root scan needs to know about the scanned file's package.
type RootComposerScope = {
  readonly slug: string;
  readonly leafModulePath: string;
  readonly isLeafModule: boolean;
  readonly inLeafPackage: boolean;
};

type ReportViolation = (kind: IdentityRegistryViolation["kind"], line: number, detail: string) => void;

// The value bindings a file's identity imports introduce: namespace aliases and local names of `$BeepId`.
type IdentityImportBindings = {
  readonly namespaceAliases: ReadonlyArray<string>;
  readonly rootComposerNames: ReadonlyArray<string>;
};

const outsideLeafDetailFor = (scope: RootComposerScope): string =>
  `Only the package's registry-free leaf (${scope.leafModulePath}) may use \`${ROOT_COMPOSER_NAME}\`; import the composer from "${IDENTITY_PACKAGES_MODULE}" or from that leaf.`;

const localMakeDetail = (callee: string): string =>
  `Import the canonical composer from "${IDENTITY_PACKAGES_MODULE}" instead of building a local root via \`${callee}(...)\`.`;

// Rows a value import declaration earns before its named imports are read.
const checkImportDeclaration = (
  declaration: ImportDeclaration,
  specifier: string,
  scope: RootComposerScope,
  report: ReportViolation
): void => {
  const line = declaration.getStartLineNumber();

  if (scope.inLeafPackage && isRegistryLoadingModuleSpecifier(specifier) && importsRuntimeBinding(declaration)) {
    report(
      "leaf-package-registry-import",
      line,
      `This package has a registry-free leaf (${scope.leafModulePath}), so its modules take their composer from it; "${specifier}" loads the identity registry.`
    );
  }

  if (specifier === IDENTITY_ROOT_MODULE && !scope.isLeafModule && importsRuntimeBinding(declaration)) {
    report("root-composer-outside-leaf", line, outsideLeafDetailFor(scope));
  }
};

// Checks one value named import from an identity module; returns the local name it binds `$BeepId` to, if any.
const checkNamedImport = (
  namedImport: ImportSpecifier,
  specifier: string,
  scope: RootComposerScope,
  report: ReportViolation
): O.Option<string> => {
  const name = namedImport.getName();

  if (name === "make") {
    report("local-root-composer", namedImport.getStartLineNumber(), localMakeDetail("make"));
  }

  if (name !== ROOT_COMPOSER_NAME) {
    return O.none();
  }

  if (specifier !== IDENTITY_ROOT_MODULE && !scope.isLeafModule) {
    report("root-composer-outside-leaf", namedImport.getStartLineNumber(), outsideLeafDetailFor(scope));
  }

  return O.some(namedImport.getAliasNode()?.getText() ?? ROOT_COMPOSER_NAME);
};

const collectIdentityImportBindings = (
  sourceFile: SourceFile,
  scope: RootComposerScope,
  report: ReportViolation
): IdentityImportBindings => {
  let namespaceAliases = A.empty<string>();
  let rootComposerNames = A.empty<string>();

  for (const declaration of A.filter(sourceFile.getImportDeclarations(), (item) => !item.isTypeOnly())) {
    const specifier = declaration.getModuleSpecifier().getLiteralText();
    checkImportDeclaration(declaration, specifier, scope, report);

    if (isIdentityRootModuleSpecifier(specifier)) {
      const valueImports = A.filter(declaration.getNamedImports(), (namedImport) => !namedImport.isTypeOnly());
      rootComposerNames = A.appendAll(
        rootComposerNames,
        A.getSomes(A.map(valueImports, (namedImport) => checkNamedImport(namedImport, specifier, scope, report)))
      );
      namespaceAliases = A.appendAll(
        namespaceAliases,
        O.toArray(O.map(O.fromUndefinedOr(declaration.getNamespaceImport()), (alias) => alias.getText()))
      );
    }
  }

  return { namespaceAliases, rootComposerNames };
};

// How one file refers to `$BeepId`, and where its `$BeepId.create(...)` arguments go.
type CompositionScan = {
  readonly scope: RootComposerScope;
  readonly report: ReportViolation;
  readonly isNamespaceAlias: (node: Node) => boolean;
  readonly isRootComposer: (node: Node) => boolean;
  readonly onCreate: (argument: O.Option<Node>) => void;
};

const isNamedIn =
  (names: ReadonlyArray<string>) =>
  (node: Node): boolean =>
    Node.isIdentifier(node) && A.some(names, Str.equivalence(node.getText()));

// `<namespace alias>.$BeepId`
const isNamespaceRootAccess = (node: Node, isNamespaceAlias: (node: Node) => boolean): boolean =>
  Node.isPropertyAccessExpression(node) &&
  node.getName() === ROOT_COMPOSER_NAME &&
  isNamespaceAlias(node.getExpression());

const visitCompositionCall = (call: CallExpression, scan: CompositionScan): void => {
  const expression = call.getExpression();

  if (!Node.isPropertyAccessExpression(expression)) {
    return;
  }

  const receiver = expression.getExpression();

  if (expression.getName() === "make" && scan.isNamespaceAlias(receiver)) {
    scan.report("local-root-composer", call.getStartLineNumber(), localMakeDetail(`${receiver.getText()}.make`));
  }

  if (scan.scope.isLeafModule && expression.getName() === "create" && scan.isRootComposer(receiver)) {
    scan.onCreate(A.head(call.getArguments()));
  }
};

const visitCompositionNode = (node: Node, scan: CompositionScan): void => {
  if (!scan.scope.isLeafModule && isNamespaceRootAccess(node, scan.isNamespaceAlias)) {
    scan.report("root-composer-outside-leaf", node.getStartLineNumber(), outsideLeafDetailFor(scan.scope));
  }

  if (Node.isCallExpression(node)) {
    visitCompositionCall(node, scan);
  }
};

// Reports namespace uses of the root and local `make` calls; returns the arguments of every `$BeepId.create(...)`.
const collectRootCreates = (
  sourceFile: SourceFile,
  bindings: IdentityImportBindings,
  scope: RootComposerScope,
  report: ReportViolation
): ReadonlyArray<O.Option<Node>> => {
  if (A.isReadonlyArrayEmpty(bindings.namespaceAliases) && A.isReadonlyArrayEmpty(bindings.rootComposerNames)) {
    return A.empty();
  }

  let createArguments = A.empty<O.Option<Node>>();
  const isNamespaceAlias = isNamedIn(bindings.namespaceAliases);
  const isRootName = isNamedIn(bindings.rootComposerNames);
  const scan: CompositionScan = {
    scope,
    report,
    isNamespaceAlias,
    isRootComposer: (node) => isRootName(node) || isNamespaceRootAccess(node, isNamespaceAlias),
    onCreate: (argument) => {
      createArguments = A.append(createArguments, argument);
    },
  };
  sourceFile.forEachDescendant((node) => visitCompositionNode(node, scan));

  return createArguments;
};

const isSlugLiteral =
  (slug: string) =>
  (argument: Node): boolean =>
    Node.isStringLiteral(argument) && argument.getLiteralText() === slug;

const describeCreates = (createArguments: ReadonlyArray<O.Option<Node>>): string =>
  A.isReadonlyArrayEmpty(createArguments)
    ? "none"
    : A.join(
        A.map(
          createArguments,
          (argument) =>
            `\`create(${O.match(argument, { onNone: () => Str.empty, onSome: (node) => node.getText() })})\``
        ),
        ", "
      );

// A leaf holds exactly one `$BeepId.create("<slug>")`, over its own package's registry slug.
const checkLeafCreates = (
  createArguments: ReadonlyArray<O.Option<Node>>,
  scope: RootComposerScope,
  report: ReportViolation
): void => {
  const ownSlugCreates = A.filter(createArguments, O.exists(isSlugLiteral(scope.slug)));

  if (scope.isLeafModule && !(A.length(createArguments) === 1 && A.length(ownSlugCreates) === 1)) {
    report(
      "root-leaf-slug-mismatch",
      1,
      `A registry-free leaf holds exactly one \`${ROOT_COMPOSER_NAME}.create("${scope.slug}")\` over its package's registry slug; found ${describeCreates(createArguments)}.`
    );
  }
};

const collectLocalRootComposerUses = (
  project: Project,
  filePath: string,
  content: string,
  scope: RootComposerScope
): ReadonlyArray<IdentityRegistryViolation> => {
  const sourceFile = project.createSourceFile(filePath, content, { overwrite: true });
  let violations = A.empty<IdentityRegistryViolation>();
  const report: ReportViolation = (kind, line, detail) => {
    violations = A.append(violations, IdentityRegistryViolation.make({ kind, subject: `${filePath}:${line}`, detail }));
  };
  const bindings = collectIdentityImportBindings(sourceFile, scope, report);
  checkLeafCreates(collectRootCreates(sourceFile, bindings, scope, report), scope, report);

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

  for (const [slug, dir] of A.filter(slugsToDirs, ([slug]) => slug !== "identity")) {
    const files = yield* collectSourceFiles(dir);
    const leafModule = normalizePath(path.resolve(dir, leafModulePathFor(slug)));
    const inLeafPackage = A.some(files, Str.equivalence(leafModule));
    const leafModulePath = normalizePath(path.relative(repoRoot, leafModule));

    for (const file of files) {
      const content = yield* fs.readFileString(file).pipe(Effect.orElseSucceed(() => Str.empty));
      const isLeafModule = file === leafModule;

      if (!isLeafModule && !Str.includes(IDENTITY_PACKAGE_NAME)(content)) {
        continue;
      }

      violations = A.appendAll(
        violations,
        collectLocalRootComposerUses(project, normalizePath(path.relative(repoRoot, file)), content, {
          slug,
          leafModulePath,
          isLeafModule,
          inLeafPackage,
        })
      );
    }
  }

  return violations;
});

const regenerateRegistry = Effect.fn("IdentityRegistry.regenerateRegistry")(function* (
  repoRoot: string,
  layout: RegistryLayout,
  base: BaseSnapshot
) {
  const regenerated = yield* writeRegistry(repoRoot, layout, base);
  const { removed, written } = Result.getOrElse(regenerated, () => RegistryWrite.make({ written: [], removed: [] }));
  for (const artifact of written) {
    yield* Console.log(`[lint:identity-registry] regenerated ${artifact}`);
  }
  for (const projection of removed) {
    yield* Console.log(`[lint:identity-registry] removed ${projection}`);
  }
});

const absentRegistryIssues = Effect.fn("IdentityRegistry.absentRegistryIssues")(function* (
  repoRoot: string,
  layout: RegistryLayout,
  base: BaseSnapshot
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const orphaned = yield* fs.exists(path.join(repoRoot, layout.snapshot));
  const snapshotIssues = orphaned
    ? A.of(
        IdentityRegistryIssue.make({
          kind: "registry-generated-drift",
          subject: layout.snapshot,
          detail: `The term snapshot has no registry: there is no shard under ${layout.shards} and no ${layout.data}. Restore the registry, or remove the snapshot with it.`,
        })
      )
    : A.empty<IdentityRegistryIssue>();
  return A.appendAll(baseSnapshotIssues(base, TermSnapshot.empty, layout), snapshotIssues);
});

const collectTermRegistryViolations = Effect.fn("IdentityRegistry.collectTermRegistryViolations")(function* (
  repoRoot: string,
  fix: boolean,
  base: O.Option<string>
) {
  const layout = yield* resolveRegistryLayout(repoRoot);

  const present = yield* registryPresent(repoRoot, layout);

  const baseSnapshot = yield* readBaseSnapshot("lint:identity-registry", repoRoot, layout, base);
  const published = Result.getOrElse(baseSnapshot, () =>
    BaseSnapshot.make({ snapshot: TermSnapshot.empty, ref: base })
  );
  const undecodable = baseSnapshot.pipe(Result.getFailure, A.fromOption);

  if (fix && present && Result.isSuccess(baseSnapshot)) {
    yield* regenerateRegistry(repoRoot, layout, baseSnapshot.success);
  }

  const found = present
    ? yield* checkRegistry(repoRoot, layout, O.some(published))
    : yield* absentRegistryIssues(repoRoot, layout, published);
  const issues = A.appendAll(found, undecodable);
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
  readonly base: O.Option<string>;
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
  const termRegistryViolations = yield* collectTermRegistryViolations(repoRoot, options.fix, options.base);
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
 * **Details**
 *
 * Reports invalid shards, shard conflicts and generated-artifact drift. A fixture
 * checkout with neither shards nor the generated data module has no term registry.
 * The --fix mode regenerates artifacts first and never edits a shard.
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
    base: baseFlag,
  },
  runIdentityRegistryLint
).pipe(
  Command.withDescription(
    "Check that @beep/* workspace packages and identity composers agree exactly, no package builds local root composers, the registry-free root stays in package leaves, the declared-term registry artifacts match their shards, and the published term set keeps every term of the base ref or deprecates it"
  )
);
