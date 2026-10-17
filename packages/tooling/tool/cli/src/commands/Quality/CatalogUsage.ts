/**
 * Root catalog and root override consumer check.
 *
 * Reports every root catalog entry and root override that nothing consumes:
 * no workspace manifest, no override, no package generator or scaffolder
 * template and, for overrides, no package `bun.lock` resolves. Resolving
 * override consumers through the lockfile covers transitive-only overrides,
 * which Fallow's unused-catalog-entry rule cannot express for Bun.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { A, Str } from "@beep/utils";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { runCaptured } from "../../internal/process/index.ts";
import {
  CatalogUsageFinding,
  CatalogUsageManifest,
  CatalogUsageManifestDependencies,
  CatalogUsageReport,
  CatalogUsageRootManifest,
  CatalogUsageSnapshot,
  CatalogUsageTemplateReference,
} from "./CatalogUsage.schemas.ts";
import { CatalogUsageSource } from "./CatalogUsage.service.ts";
import { collectWorkspacePackageJsonFiles } from "./ChangesetGraph.ts";
import { CatalogUsageError } from "./Quality.errors.ts";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/process";

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

type SourceEnvironment = FileSystem.FileSystem | Path.Path | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner;

const defaultCatalogName = "default";
const catalogProtocol = "catalog:";
const nulSeparator = "\u0000";
const templateCatalogReferencePattern = /["']?((?:@[\w.-]+\/)?[\w.-]+)["']?\s*:\s*["']catalog:([\w.-]*)["']/g;

class CatalogUsageLockfile extends S.Opaque<CatalogUsageLockfile, { readonly brand: unique symbol }>()(
  S.Struct({
    packages: S.Record(S.String, S.Array(S.Unknown)).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<string, ReadonlyArray<unknown>>())),
      S.withDecodingDefault(Effect.succeed(R.empty<string, ReadonlyArray<unknown>>()))
    ),
  })
) {}

const decodeRootManifest = decodeJsoncTextAs(CatalogUsageRootManifest);
const decodeManifestDocument = decodeJsoncTextAs(CatalogUsageManifestDependencies);
const isJsonRecord = S.is(S.Record(S.String, S.Json));
const decodeLockfile = decodeJsoncTextAs(CatalogUsageLockfile);

const catalogKey = (catalog: string, packageName: string): string => `${catalog}${nulSeparator}${packageName}`;

const catalogNameFromSpec = (spec: string): O.Option<string> =>
  Str.startsWith(catalogProtocol)(spec)
    ? O.some(
        pipe(spec, Str.slice(catalogProtocol.length), Str.trim, (name) =>
          Str.isEmpty(name) ? defaultCatalogName : name
        )
      )
    : O.none();

const packageNameFromSpecifier = (specifier: string): string =>
  pipe(
    Str.lastIndexOf("@")(specifier),
    O.filter((index) => index > 0),
    O.match({ onNone: () => specifier, onSome: (index) => Str.slice(0, index)(specifier) })
  );

const installedNameFromLockKey = (key: string): string => {
  const segments = Str.split("/")(key);
  const last = O.getOrElse(A.last(segments), () => key);
  return pipe(
    A.get(segments, A.length(segments) - 2),
    O.filter(Str.startsWith("@")),
    O.match({ onNone: () => last, onSome: (scope) => `${scope}/${last}` })
  );
};

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
export const catalogTemplateReferencesFromText = (
  file: string,
  content: string
): ReadonlyArray<CatalogUsageTemplateReference> =>
  A.flatMap(A.fromIterable(Str.matchAll(templateCatalogReferencePattern)(content)), (match) =>
    pipe(
      O.fromNullishOr(match[1]),
      O.map((packageName) =>
        CatalogUsageTemplateReference.make({
          file,
          packageName,
          catalog: O.getOrElse(catalogNameFromSpec(`${catalogProtocol}${match[2] ?? ""}`), () => defaultCatalogName),
        })
      ),
      A.fromOption
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

const readManifest = Effect.fn("CatalogUsage.readManifest")(function* (repoRoot: string, file: string) {
  const document = yield* readText(repoRoot, file).pipe(
    Effect.flatMap(decodeManifestDocument),
    CatalogUsageError.mapError(`Failed to parse package manifest ${file}.`, file)
  );
  return CatalogUsageManifest.make({ ...document, file });
});

const readLockfilePackages = Effect.fn("CatalogUsage.readLockfilePackages")(function* (repoRoot: string) {
  const lockfile = yield* readText(repoRoot, "bun.lock").pipe(
    Effect.flatMap(decodeLockfile),
    CatalogUsageError.mapError("Failed to parse bun.lock.", "bun.lock")
  );
  return pipe(
    R.toEntries(lockfile.packages),
    A.flatMap(([key, entry]) => [
      installedNameFromLockKey(key),
      ...A.fromOption(O.map(O.filter(A.head(entry), P.isString), packageNameFromSpecifier)),
    ]),
    A.dedupe
  );
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
  const root = yield* readText(repoRoot, "package.json").pipe(
    Effect.flatMap(decodeRootManifest),
    CatalogUsageError.mapError("Failed to parse the root package.json.", "package.json")
  );
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
      snapshot: (repoRoot) => readCatalogUsageSnapshot(repoRoot).pipe(Effect.provide(context)),
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
