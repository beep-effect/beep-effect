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

import { Lockfile } from "@beep/lockfiles/Lockfile";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { manifestParser } from "../../internal/ManifestRead.ts";
import { runCaptured } from "../../internal/process/index.ts";
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
  | ChildProcessSpawner.ChildProcessSpawner;

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
  const consumedCatalogKeys = HashSet.fromIterable([
    ...A.flatMap(dependencyEntries, ([packageName, spec]) =>
      A.fromOption(O.map(catalogNameFromSpec(spec), (catalog) => catalogKey(catalog, packageName)))
    ),
    ...overrideCatalogKeys(snapshot.root.overrides),
    ...A.map(snapshot.templateReferences, (reference) => catalogKey(reference.catalog, reference.packageName)),
  ]);
  const overrideConsumers = HashSet.fromIterable([
    ...A.map(dependencyEntries, ([packageName]) => packageName),
    ...snapshot.lockfilePackages,
  ]);

  const catalogEntries = [
    ...A.map(R.keys(snapshot.root.catalog), (key) => [defaultCatalogName, key] as const),
    ...A.flatMap(R.toEntries(snapshot.root.catalogs), ([catalog, entries]) =>
      A.map(R.keys(entries), (key) => [catalog, key] as const)
    ),
  ];
  const overrideKeys = R.keys(snapshot.root.overrides);

  const findings = A.sort(
    [
      ...pipe(
        catalogEntries,
        A.filter(([catalog, key]) => !HashSet.has(consumedCatalogKeys, catalogKey(catalog, key))),
        A.map(([catalog, key]) => CatalogUsageFinding.make({ subject: "catalog-entry", key, catalog }))
      ),
      ...pipe(
        overrideKeys,
        A.filter((key) => !HashSet.has(overrideConsumers, packageNameFromSpecifier(key))),
        A.map((key) => CatalogUsageFinding.make({ subject: "root-override", key }))
      ),
    ],
    byFindingKey
  );

  return CatalogUsageReport.make({
    catalogEntries: A.length(catalogEntries),
    rootOverrides: A.length(overrideKeys),
    manifests: A.length(snapshot.manifests),
    templateReferences: A.length(snapshot.templateReferences),
    findings,
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

const readManifest = Effect.fn("CatalogUsage.readManifest")(function* (repoRoot: string, file: string) {
  return yield* readCatalogUsageManifest(yield* readText(repoRoot, file), file);
});

const readLockfilePackages = Effect.fn("CatalogUsage.readLockfilePackages")(function* (repoRoot: string) {
  const lockfile = yield* readText(repoRoot, "bun.lock").pipe(
    Effect.flatMap(Lockfile.parse({ format: "bun" })),
    CatalogUsageError.mapError("Failed to parse bun.lock.", "bun.lock")
  );
  // An aliased install answers to both its alias and its real package name.
  return A.dedupe(A.flatMap(lockfile.packages, (pkg) => [pkg.installName, pkg.name]));
});

const collectTemplateFiles = Effect.fn("CatalogUsage.collectTemplateFiles")(function* (repoRoot: string) {
  const result = yield* runCaptured({
    command: "git",
    args: ["ls-files", "-z", "--", ...CATALOG_USAGE_TEMPLATE_SOURCES],
    cwd: repoRoot,
    source: "stdout",
  }).pipe(CatalogUsageError.mapError("Failed to list generator template sources."));
  if (result.exitCode !== 0) {
    return yield* CatalogUsageError.make({
      message: `git ls-files for generator template sources failed with exit code ${result.exitCode}.`,
    });
  }
  return pipe(Str.split(nulSeparator)(result.output), A.map(Str.trim), A.filter(Str.isNonEmpty));
});

const readCatalogUsageSnapshot = Effect.fn("CatalogUsage.readCatalogUsageSnapshot")(function* (
  repoRoot: string
): Effect.fn.Return<CatalogUsageSnapshot, CatalogUsageError, SourceEnvironment> {
  const root = yield* readText(repoRoot, "package.json").pipe(Effect.flatMap(readRootCatalogs));
  const workspaceFiles = yield* collectWorkspacePackageJsonFiles(repoRoot).pipe(
    CatalogUsageError.mapError("Failed to list workspace package manifests.")
  );
  const manifests = yield* Effect.forEach(["package.json", ...workspaceFiles], (file) => readManifest(repoRoot, file));
  const lockfilePackages = yield* readLockfilePackages(repoRoot);
  const templateFiles = yield* collectTemplateFiles(repoRoot);
  const templateReferences = yield* Effect.forEach(templateFiles, (file) =>
    Effect.map(readText(repoRoot, file), (content) => catalogTemplateReferencesFromText(file, content))
  );

  return CatalogUsageSnapshot.make({
    root,
    manifests,
    lockfilePackages,
    templateReferences: A.flatten(templateReferences),
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
  const report = catalogUsageReport(yield* source.snapshot(repoRoot));
  yield* Console.log(
    `[catalog-usage] catalog_entries=${report.catalogEntries} root_overrides=${report.rootOverrides} manifests=${report.manifests} template_references=${report.templateReferences} findings=${A.length(report.findings)}`
  );
  if (A.isReadonlyArrayNonEmpty(report.findings)) {
    yield* Console.error("[catalog-usage] root catalog entries and overrides without a consumer:");
    yield* Effect.forEach(report.findings, (finding) => Console.error(renderFinding(finding)), { discard: true });
    return yield* CatalogUsageError.make({
      message: `${A.length(report.findings)} root catalog entr(ies) or override(s) have no consumer.`,
      file: "package.json",
    });
  }
  return report;
});
