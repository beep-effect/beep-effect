/**
 * Root catalog and root override consumer check. It reports every root catalog entry and root override that nothing consumes:
 * no workspace manifest, no override, no package generator or scaffolder
 * template and, for overrides, no package `bun.lock` resolves. Resolving
 * override consumers through the lockfile covers transitive-only overrides,
 * which Fallow's unused-catalog-entry rule cannot express for Bun.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Git } from "@beep/git/Git";
import { GitCommand } from "@beep/git/GitCommand";
import { ImporterDependency } from "@beep/lockfiles/ImporterDependency";
import { Lockfile } from "@beep/lockfiles/Lockfile";
import {
  isCheckoutSubjectPruned,
  loadCheckoutInventoryWith,
  workspaceSubject,
} from "@beep/repo-cli-kit/CheckoutSubject";
import { manifestParser } from "@beep/repo-cli-kit/ManifestRead";
import { productLeaves } from "@beep/repo-cli-kit/ProductLeaves";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { adaptGitKitError } from "../../internal/repo-run/GitExec.ts";
import {
  CatalogUsageFinding,
  CatalogUsageManifest,
  CatalogUsageReport,
  CatalogUsageRootManifest,
  CatalogUsageSnapshot,
  CatalogUsageTemplateReference,
} from "./CatalogUsage.schemas.ts";
import { CatalogUsageSource } from "./CatalogUsage.service.ts";
import { collectWorkspacePackageJsonFiles } from "./ChangesetGraph.ts";
import { CatalogUsageError } from "./Quality.errors.ts";
import type { LockfileImporter } from "@beep/lockfiles/LockfileImporter";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

/**
 * Public catalog usage error export.
 *
 * @category errors
 * @since 0.0.0
 */
export { CatalogUsageError } from "./Quality.errors.ts";

/**
 * Tracked sources whose `catalog:` dependency spellings count as consumers.
 *
 * **Details**
 *
 * `beep create-package` and `beep architecture` write package manifests from
 * these sources, so a catalog entry they name stays live even before any
 * generated package exists.
 *
 * **Example** (Read the scanned generator sources)
 *
 * ```ts
 * import { CATALOG_USAGE_TEMPLATE_SOURCES } from "@beep/repo-cli/commands/Quality/CatalogUsage"
 *
 * console.log(CATALOG_USAGE_TEMPLATE_SOURCES.length) // 2
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const CATALOG_USAGE_TEMPLATE_SOURCES = [
  "packages/tooling/tool/cli/src/commands/CreatePackage",
  "packages/tooling/tool/cli/src/commands/Architecture/internal/PackageShell.ts",
] as const;

type SourceEnvironment =
  | FileSystem.FileSystem
  | Path.Path
  | SecureRandom.SecureRandom
  | ChildProcessSpawner.ChildProcessSpawner
  | Git;

const defaultCatalogName = "default";
const catalogProtocol = "catalog:";
const nulSeparator = "\u0000";
const templateCatalogReferencePattern = /["']?((?:@[\w.-]+\/)?[\w.-]+)["']?\s*:\s*["']catalog:([\w.-]*)["']/g;

// The root manifest reads through `LenientManifest`; Bun's named `catalogs`
// map is not a field the kit models, so it is taken from `rest` and the three
// catalog fields validate as the snapshot's `CatalogUsageRootManifest`.
const parseRootManifest = manifestParser(["catalog", "overrides"]);
const decodeRootCatalogs = S.decodeUnknownEffect(CatalogUsageRootManifest);
/**
 * Read the root `package.json` text's `catalog`, named `catalogs` and
 * `overrides`.
 *
 * **Details**
 *
 * The manifest reads through `LenientManifest`; Bun's named `catalogs` map is
 * not a field the kit models, so it is taken from `rest`. Strict JSON only:
 * JSONC text fails.
 *
 * **Example** (Read the default catalog)
 *
 * ```ts
 * import { readRootCatalogs } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 *
 * const root = Effect.runSync(readRootCatalogs('{"catalog":{"effect":"4.0.0"}}'))
 * console.log(root.catalog) // { effect: "4.0.0" }
 * ```
 *
 * @param text - The root manifest document as read from disk.
 * @returns The root catalog fields as the snapshot's root manifest.
 * @category parsing
 * @since 0.0.0
 */
export const readRootCatalogs = Effect.fn("CatalogUsage.readRootCatalogs")(function* (
  text: string
): Effect.fn.Return<CatalogUsageRootManifest, CatalogUsageError> {
  const root = yield* parseRootManifest(text).pipe(
    CatalogUsageError.mapError("Failed to parse the root package.json.", "package.json")
  );
  return yield* decodeRootCatalogs(
    O.getSomesStruct({
      catalog: O.fromUndefinedOr(root.catalog),
      catalogs: O.flatMap(O.fromUndefinedOr(root.rest), R.get("catalogs")),
      overrides: O.fromUndefinedOr(root.overrides),
    })
  ).pipe(CatalogUsageError.mapError("Failed to parse the root package.json.", "package.json"));
});
const parseManifestDependencies = manifestParser([
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
]);
const isJsonRecord = S.is(S.Record(S.String, S.Json));

const catalogKey = (catalog: string, packageName: string): string => `${catalog}${nulSeparator}${packageName}`;

const catalogNameFromSuffix = (suffix: string): string =>
  pipe(Str.trim(suffix), (name) => (Str.isEmpty(name) ? defaultCatalogName : name));

const catalogNameFromSpec = (spec: string): O.Option<string> =>
  Str.startsWith(catalogProtocol)(spec)
    ? O.some(catalogNameFromSuffix(Str.slice(catalogProtocol.length)(spec)))
    : O.none();

const packageNameFromSpecifier = (specifier: string): string =>
  pipe(
    Str.lastIndexOf("@")(specifier),
    O.filter((index) => index > 0),
    O.match({ onNone: () => specifier, onSome: (index) => Str.slice(0, index)(specifier) })
  );

const manifestDependencyEntries = (manifest: CatalogUsageManifest): ReadonlyArray<readonly [string, string]> =>
  A.flatMap(
    [manifest.dependencies, manifest.devDependencies, manifest.peerDependencies, manifest.optionalDependencies],
    R.toEntries
  );

const dependencyCatalogKeys = (entries: ReadonlyArray<readonly [string, string]>): ReadonlyArray<string> =>
  A.flatMap(entries, ([packageName, spec]) =>
    A.fromOption(O.map(catalogNameFromSpec(spec), (catalog) => catalogKey(catalog, packageName)))
  );

const overrideCatalogKeys = (overrides: R.ReadonlyRecord<string, S.Json>): ReadonlyArray<string> =>
  A.flatMap(R.toEntries(overrides), ([key, value]) =>
    P.isString(value)
      ? A.fromOption(O.map(catalogNameFromSpec(value), (catalog) => catalogKey(catalog, packageNameFromSpecifier(key))))
      : !A.isArray(value) && isJsonRecord(value)
        ? overrideCatalogKeys(value)
        : A.empty<string>()
  );

const byFindingKey: Order.Order<CatalogUsageFinding> = Order.mapInput(
  Order.String,
  (finding) => `${finding.subject}${nulSeparator}${finding.catalog ?? ""}${nulSeparator}${finding.key}`
);

/**
 * Evaluate a snapshot and report every unconsumed catalog entry and root override.
 *
 * **Details**
 *
 * A catalog entry is consumed by a manifest dependency, an override value or a
 * generator template that spells `catalog:` (default catalog) or
 * `catalog:<name>` for its catalog. A root override is consumed by a manifest
 * dependency with the same package name or by a package `bun.lock` resolves;
 * a `name@range` override selector matches on its package name.
 *
 * **Example** (Report a planted unused entry)
 *
 * ```ts
 * import { catalogUsageReport } from "@beep/repo-cli/commands/Quality/CatalogUsage"
 * import { CatalogUsageRootManifest, CatalogUsageSnapshot } from "@beep/repo-cli/commands/Quality/CatalogUsage.schemas"
 *
 * const report = catalogUsageReport(
 *   CatalogUsageSnapshot.make({
 *     root: CatalogUsageRootManifest.make({ catalog: { "left-pad": "^1.3.0" } }),
 *     manifests: [],
 *     lockfilePackages: [],
 *     templateReferences: []
 *   })
 * )
 * console.log(report.findings.length) // 1
 * ```
 *
 * @param snapshot - Repository state to evaluate.
 * @returns Checked counts and the sorted findings.
 * @category utilities
 * @since 0.0.0
 */
export const catalogUsageReport = (snapshot: CatalogUsageSnapshot): CatalogUsageReport => {
  const dependencyEntries = A.flatMap(snapshot.manifests, manifestDependencyEntries);
  const prunedEntries = A.flatMap(snapshot.prunedManifests, manifestDependencyEntries);
  const consumedCatalogKeys = HashSet.fromIterable([
    ...dependencyCatalogKeys(dependencyEntries),
    ...overrideCatalogKeys(snapshot.root.overrides),
    ...A.map(snapshot.templateReferences, (reference) => catalogKey(reference.catalog, reference.packageName)),
  ]);
  const overrideConsumers = HashSet.fromIterable([
    ...A.map(dependencyEntries, ([packageName]) => packageName),
    ...snapshot.lockfilePackages,
  ]);
  const prunedCatalogKeys = HashSet.fromIterable(dependencyCatalogKeys(prunedEntries));
  const prunedOverrideConsumers = HashSet.fromIterable(A.map(prunedEntries, ([packageName]) => packageName));

  const catalogEntries = [
    ...A.map(R.keys(snapshot.root.catalog), (key) => [defaultCatalogName, key] as const),
    ...A.flatMap(R.toEntries(snapshot.root.catalogs), ([catalog, entries]) =>
      A.map(R.keys(entries), (key) => [catalog, key] as const)
    ),
  ];
  const overrideKeys = R.keys(snapshot.root.overrides);

  const unconsumed = [
    ...pipe(
      catalogEntries,
      A.filter(([catalog, key]) => !HashSet.has(consumedCatalogKeys, catalogKey(catalog, key))),
      A.map(
        ([catalog, key]) =>
          [
            CatalogUsageFinding.make({ subject: "catalog-entry", key, catalog }),
            HashSet.has(prunedCatalogKeys, catalogKey(catalog, key)),
          ] as const
      )
    ),
    ...pipe(
      overrideKeys,
      A.filter((key) => !HashSet.has(overrideConsumers, packageNameFromSpecifier(key))),
      A.map(
        (key) =>
          [
            CatalogUsageFinding.make({ subject: "root-override", key }),
            HashSet.has(prunedOverrideConsumers, packageNameFromSpecifier(key)),
          ] as const
      )
    ),
  ];

  return CatalogUsageReport.make({
    catalogEntries: A.length(catalogEntries),
    rootOverrides: A.length(overrideKeys),
    manifests: A.length(snapshot.manifests),
    templateReferences: A.length(snapshot.templateReferences),
    findings: A.sort(
      A.map(
        A.filter(unconsumed, ([, pruned]) => !pruned),
        ([finding]) => finding
      ),
      byFindingKey
    ),
    prunedConsumers: A.sort(
      A.map(
        A.filter(unconsumed, ([, pruned]) => pruned),
        ([finding]) => finding
      ),
      byFindingKey
    ),
  });
};

/**
 * Extract the `catalog:` dependency spellings in one generator template source.
 *
 * **Example** (Read a template dependency)
 *
 * ```ts
 * import { catalogTemplateReferencesFromText } from "@beep/repo-cli/commands/Quality/CatalogUsage"
 *
 * const references = catalogTemplateReferencesFromText("gen.ts", 'const deps = { "@types/node": "catalog:" }')
 * console.log(references[0]?.packageName) // "@types/node"
 * ```
 *
 * @param file - Repo-relative source path recorded on each reference.
 * @param content - Source text to scan.
 * @returns Every catalog dependency the source spells.
 * @category utilities
 * @since 0.0.0
 */
export const catalogTemplateReferencesFromText: {
  (content: string): (file: string) => ReadonlyArray<CatalogUsageTemplateReference>;
  (file: string, content: string): ReadonlyArray<CatalogUsageTemplateReference>;
} = dual(
  2,
  (file: string, content: string): ReadonlyArray<CatalogUsageTemplateReference> =>
    A.flatMap(A.fromIterable(Str.matchAll(templateCatalogReferencePattern)(content)), (match) =>
      pipe(
        O.all([O.fromNullishOr(match[1]), O.fromNullishOr(match[2])]),
        O.map(([packageName, suffix]) =>
          CatalogUsageTemplateReference.make({ file, packageName, catalog: catalogNameFromSuffix(suffix) })
        ),
        A.fromOption
      )
    )
);

const readText = Effect.fn("CatalogUsage.readText")(function* (
  repoRoot: string,
  file: string
): Effect.fn.Return<string, CatalogUsageError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs
    .readFileString(path.join(repoRoot, file))
    .pipe(CatalogUsageError.mapError(`Failed to read ${file}.`, file));
});

/**
 * Read one workspace `package.json` text into its four dependency buckets.
 *
 * **Details**
 *
 * A present bucket must be a string record; an absent one reads as empty.
 * Strict JSON only: JSONC text fails.
 *
 * **Example** (Read a manifest with one dependency)
 *
 * ```ts
 * import { readCatalogUsageManifest } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 *
 * const manifest = Effect.runSync(
 *   readCatalogUsageManifest('{"dependencies":{"effect":"catalog:"}}', "packages/demo/package.json")
 * )
 * console.log(manifest.dependencies, manifest.devDependencies) // { effect: "catalog:" } {}
 * ```
 *
 * @param text - The workspace manifest document as read from disk.
 * @param file - Repo-relative manifest path the record carries.
 * @returns The manifest's dependency buckets.
 * @category parsing
 * @since 0.0.0
 */
export const readCatalogUsageManifest = Effect.fn("CatalogUsage.readCatalogUsageManifest")(function* (
  text: string,
  file: string
): Effect.fn.Return<CatalogUsageManifest, CatalogUsageError> {
  const manifest = yield* parseManifestDependencies(text).pipe(
    CatalogUsageError.mapError(`Failed to parse package manifest ${file}.`, file)
  );
  return CatalogUsageManifest.make({
    file,
    dependencies: manifest.dependencies ?? R.empty(),
    devDependencies: manifest.devDependencies ?? R.empty(),
    peerDependencies: manifest.peerDependencies ?? R.empty(),
    optionalDependencies: manifest.optionalDependencies ?? R.empty(),
  });
});

const parseManifestName = manifestParser(["name"]);

// One manifest's dependency buckets, and its package name when it declares one.
const readManifest = Effect.fn("CatalogUsage.readManifest")(function* (repoRoot: string, file: string) {
  const readText1 = yield* readText(repoRoot, file);
  const manifest = yield* readCatalogUsageManifest(readText1, file);
  const named = yield* parseManifestName(readText1).pipe(
    CatalogUsageError.mapError(`Failed to parse package manifest ${file}.`, file)
  );
  return { manifest, name: O.fromUndefinedOr(named.name) } as const;
});

const readLockfile = Effect.fn("CatalogUsage.readLockfile")(function* (repoRoot: string) {
  return yield* readText(repoRoot, "bun.lock").pipe(
    Effect.flatMap(Lockfile.parse({ format: "bun" })),
    CatalogUsageError.mapError("Failed to parse bun.lock.", "bun.lock")
  );
});

// An aliased install answers to both its alias and its real package name.
const lockfilePackageNames = (lockfile: Lockfile): ReadonlyArray<string> =>
  A.dedupe(A.flatMap(lockfile.packages, (pkg) => [pkg.installName, pkg.name]));

const encodeImporterDependency = S.encodeEffect(ImporterDependency);

// One pruned workspace's lockfile record as the dependency spellings its manifest declared.
const prunedImporterManifest = Effect.fn("CatalogUsage.prunedImporterManifest")(function* (
  directory: string,
  importer: LockfileImporter
) {
  const dependencies = yield* Effect.forEach(
    importer.dependencies,
    (dependency) =>
      Effect.map(encodeImporterDependency(dependency), (encoded) => [encoded.name, encoded.specifier] as const),
    { concurrency: 1 }
  );
  return CatalogUsageManifest.make({
    file: `bun.lock#${directory}`,
    dependencies: R.fromEntries(dependencies),
    devDependencies: R.empty(),
    peerDependencies: R.empty(),
    optionalDependencies: R.empty(),
  });
});

// goals/prunable-product-leaves, seam 1b: the lockfile still records a pruned workspace's declared
// dependencies under its last-known directory until the lockfile is regenerated. Those records are
// what the pruned workspace consumed; a record of an undeclared missing workspace is not read.
const prunedLockfileManifests = Effect.fn("CatalogUsage.prunedLockfileManifests")(function* (
  repoRoot: string,
  lockfile: Lockfile,
  workspaces: HashMap.HashMap<string, string>
) {
  const inventory = yield* loadCheckoutInventoryWith(repoRoot, productLeaves, workspaces).pipe(
    CatalogUsageError.mapError("Failed to read the checkout inventory.")
  );
  // A workspace the checkout owns replaced upstream's content, so upstream's record excuses it too.
  const owned = A.filterMap(inventory.declaration.owned, (entry) =>
    entry.packageName !== undefined && isCheckoutSubjectPruned(inventory, workspaceSubject(entry.packageName))
      ? Result.succeed(entry.path)
      : Result.failVoid
  );
  const records = A.getSomes(
    A.map(A.dedupe([...HashMap.values(inventory.prunedWorkspaces), ...owned]), (directory) =>
      O.map(lockfile.importer(directory), (importer) => [directory, importer] as const)
    )
  );
  return yield* Effect.forEach(records, ([directory, importer]) => prunedImporterManifest(directory, importer), {
    concurrency: 1,
  }).pipe(CatalogUsageError.mapError("Failed to read a pruned workspace's bun.lock record.", "bun.lock"));
});

const collectTemplateFiles = Effect.fn("CatalogUsage.collectTemplateFiles")(function* (repoRoot: string) {
  const git = yield* Git;
  const entries = yield* git.lsFiles(repoRoot, { pathspec: CATALOG_USAGE_TEMPLATE_SOURCES }).pipe(
    Effect.mapError(
      adaptGitKitError(GitCommand.lsFiles(CATALOG_USAGE_TEMPLATE_SOURCES), {
        onSpawnFailure: () => CatalogUsageError.new("Failed to list generator template sources."),
        onNonZeroExit: ({ exitCode }) =>
          CatalogUsageError.make({
            message: `git ls-files for generator template sources failed with exit code ${exitCode}.`,
          }),
        onTruncated: O.none(),
      })
    )
  );
  return pipe(
    entries,
    A.map((entry) => Str.trim(entry.path)),
    A.filter(Str.isNonEmpty)
  );
});

const readCatalogUsageSnapshot = Effect.fn("CatalogUsage.readCatalogUsageSnapshot")(function* (
  repoRoot: string
): Effect.fn.Return<CatalogUsageSnapshot, CatalogUsageError, SourceEnvironment> {
  const root = yield* readText(repoRoot, "package.json").pipe(Effect.flatMap(readRootCatalogs));
  const workspaceFiles = yield* collectWorkspacePackageJsonFiles(repoRoot).pipe(
    CatalogUsageError.mapError("Failed to list workspace package manifests.")
  );
  const rootManifest = yield* readManifest(repoRoot, "package.json");
  const workspaceManifests = yield* Effect.forEach(workspaceFiles, (file) => readManifest(repoRoot, file), {
    concurrency: 1,
  });
  const manifests = A.map([rootManifest, ...workspaceManifests], (read) => read.manifest);
  const lockfile = yield* readLockfile(repoRoot);
  const workspaces = HashMap.fromIterable(
    A.getSomes(
      A.map(workspaceManifests, (read) =>
        O.map(read.name, (name) => [name, Str.replace(/\/?package\.json$/u, "")(read.manifest.file)] as const)
      )
    )
  );
  const prunedManifests = yield* prunedLockfileManifests(repoRoot, lockfile, workspaces);
  const templateFiles = yield* collectTemplateFiles(repoRoot);
  const templateReferences = yield* Effect.forEach(
    templateFiles,
    (file) => Effect.map(readText(repoRoot, file), (content) => catalogTemplateReferencesFromText(file, content)),
    { concurrency: 1 }
  );

  return CatalogUsageSnapshot.make({
    root,
    manifests,
    lockfilePackages: lockfilePackageNames(lockfile),
    templateReferences: A.flatten(templateReferences),
    prunedManifests,
  });
});

/**
 * Live catalog usage source over a git checkout.
 *
 * **Example** (Provide the live source)
 *
 * ```ts
 * import { CatalogUsageSourceLive, runCatalogUsageCheck } from "@beep/repo-cli/commands/Quality/CatalogUsage"
 * import * as Effect from "effect/Effect"
 *
 * const program = runCatalogUsageCheck(process.cwd()).pipe(Effect.provide(CatalogUsageSourceLive))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CatalogUsageSourceLive = Layer.effect(
  CatalogUsageSource,
  Effect.gen(function* () {
    const context = yield* Effect.context<SourceEnvironment>();
    return CatalogUsageSource.of({
      snapshot: Effect.fn("CatalogUsageSource.snapshot")(function* (repoRoot: string) {
        return yield* readCatalogUsageSnapshot(repoRoot).pipe(Effect.provide(context));
      }),
    });
  })
);

const renderFinding = (finding: CatalogUsageFinding): string =>
  P.isUndefined(finding.catalog)
    ? `  - ${finding.subject} ${finding.key}`
    : `  - ${finding.subject} ${finding.catalog}:${finding.key}`;

/**
 * Run the check-only catalog usage gate for one checkout.
 *
 * **Details**
 *
 * Logs one summary line, then fails with {@link CatalogUsageError} when any
 * finding exists. There is no baseline or exception file: remove the entry,
 * or add the consumer that needs it.
 *
 * **Example** (Run the catalog usage gate)
 *
 * ```ts
 * import { CatalogUsageSourceLive, runCatalogUsageCheck } from "@beep/repo-cli/commands/Quality/CatalogUsage"
 * import * as Effect from "effect/Effect"
 *
 * const program = runCatalogUsageCheck("/repo").pipe(Effect.provide(CatalogUsageSourceLive))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param repoRoot - Repository root to check.
 * @returns The clean report.
 * @category utilities
 * @since 0.0.0
 */
export const runCatalogUsageCheck = Effect.fn("CatalogUsage.runCatalogUsageCheck")(function* (
  repoRoot: string
): Effect.fn.Return<CatalogUsageReport, CatalogUsageError, CatalogUsageSource> {
  const source = yield* CatalogUsageSource;
  const snapshot2 = yield* source.snapshot(repoRoot);
  const report = catalogUsageReport(snapshot2);
  yield* Console.log(
    `[catalog-usage] catalog_entries=${report.catalogEntries} root_overrides=${report.rootOverrides} manifests=${report.manifests} template_references=${report.templateReferences} findings=${A.length(report.findings)}`
  );
  if (A.isReadonlyArrayNonEmpty(report.prunedConsumers)) {
    yield* Console.log(
      `[catalog-usage] skipped_pruned=${A.length(report.prunedConsumers)}: consumed only by workspaces pruned from this checkout:`
    );
    yield* Effect.forEach(report.prunedConsumers, (finding) => Console.log(renderFinding(finding)), {
      concurrency: 1,
      discard: true,
    });
  }
  if (A.isReadonlyArrayNonEmpty(report.findings)) {
    yield* Console.error("[catalog-usage] root catalog entries and overrides without a consumer:");
    yield* Effect.forEach(report.findings, (finding) => Console.error(renderFinding(finding)), {
      concurrency: 1,
      discard: true,
    });
    return yield* CatalogUsageError.make({
      message: `${A.length(report.findings)} root catalog entr(ies) or override(s) have no consumer.`,
      file: "package.json",
    });
  }
  return report;
});
