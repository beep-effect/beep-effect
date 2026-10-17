/**
 * Schemas for the root catalog and override consumer check.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Quality/CatalogUsage.schemas");

const emptyStringRecord = Effect.succeed(R.empty<string, string>());
const StringRecord = S.Record(S.String, S.String);
const DefaultedStringRecord = StringRecord.pipe(
  S.withConstructorDefault(emptyStringRecord),
  S.withDecodingDefault(emptyStringRecord)
);

/**
 * Root-manifest surface a catalog usage finding names.
 *
 * **Example** (Check a finding subject)
 *
 * ```ts
 * import { CatalogUsageSubject } from "@beep/repo-cli/commands/Quality/CatalogUsage.schemas"
 *
 * console.log(CatalogUsageSubject.is["root-override"]("root-override")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CatalogUsageSubject = LiteralKit(["catalog-entry", "root-override"]).pipe(
  $I.annoteSchema("CatalogUsageSubject", {
    description: "Root-manifest surface a catalog usage finding names: a catalog entry or a root override.",
  })
);

/**
 * {@inheritDoc CatalogUsageSubject}
 *
 * @category models
 * @since 0.0.0
 */
export type CatalogUsageSubject = typeof CatalogUsageSubject.Type;

/**
 * Root `package.json` fields that declare catalog entries and overrides.
 *
 * **Details**
 *
 * `catalog` is the default catalog (`catalog:` and `catalog:default`);
 * `catalogs` holds the named catalogs (`catalog:<name>`). Override values are
 * kept as decoded JSON because Bun accepts version strings, `catalog:`
 * references and nested parent-scoped override objects.
 *
 * **Example** (Construct an empty root manifest)
 *
 * ```ts
 * import { CatalogUsageRootManifest } from "@beep/repo-cli/commands/Quality/CatalogUsage.schemas"
 *
 * console.log(Object.keys(CatalogUsageRootManifest.make({}).catalog).length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CatalogUsageRootManifest extends S.Opaque<CatalogUsageRootManifest, { readonly brand: unique symbol }>()(
  S.Struct({
    catalog: DefaultedStringRecord,
    catalogs: S.Record(S.String, StringRecord).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<string, R.ReadonlyRecord<string, string>>())),
      S.withDecodingDefault(Effect.succeed(R.empty<string, R.ReadonlyRecord<string, string>>()))
    ),
    overrides: S.Record(S.String, S.Json).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<string, S.Json>())),
      S.withDecodingDefault(Effect.succeed(R.empty<string, S.Json>()))
    ),
  }).pipe(
    $I.annoteSchema("CatalogUsageRootManifest", {
      description: "Root package.json catalog, named catalogs and overrides read by the catalog usage check.",
    })
  )
) {}

const manifestDependencyFields = {
  dependencies: DefaultedStringRecord,
  devDependencies: DefaultedStringRecord,
  peerDependencies: DefaultedStringRecord,
  optionalDependencies: DefaultedStringRecord,
};

/**
 * The four dependency fields a `package.json` document declares.
 *
 * **Example** (Construct empty dependency fields)
 *
 * ```ts
 * import { CatalogUsageManifestDependencies } from "@beep/repo-cli/commands/Quality/CatalogUsage.schemas"
 *
 * console.log(CatalogUsageManifestDependencies.make({}).dependencies) // {}
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CatalogUsageManifestDependencies extends S.Opaque<
  CatalogUsageManifestDependencies,
  { readonly brand: unique symbol }
>()(
  S.Struct(manifestDependencyFields).pipe(
    $I.annoteSchema("CatalogUsageManifestDependencies", {
      description: "The dependencies, devDependencies, peerDependencies and optionalDependencies of a package.json.",
    })
  )
) {}

/**
 * Dependency fields of one workspace manifest.
 *
 * **Example** (Construct a manifest with one catalog dependency)
 *
 * ```ts
 * import { CatalogUsageManifest } from "@beep/repo-cli/commands/Quality/CatalogUsage.schemas"
 *
 * const manifest = CatalogUsageManifest.make({ file: "packages/demo/package.json", dependencies: { effect: "catalog:" } })
 * console.log(manifest.devDependencies) // {}
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CatalogUsageManifest extends S.Opaque<CatalogUsageManifest, { readonly brand: unique symbol }>()(
  S.Struct({
    file: S.String,
    ...manifestDependencyFields,
  }).pipe(
    $I.annoteSchema("CatalogUsageManifest", {
      description: "The four dependency fields of one workspace package.json, keyed by its repo-relative path.",
    })
  )
) {}

/**
 * One `catalog:` dependency spelled by a generator or scaffolder template.
 *
 * **Example** (Construct a template reference)
 *
 * ```ts
 * import { CatalogUsageTemplateReference } from "@beep/repo-cli/commands/Quality/CatalogUsage.schemas"
 *
 * const reference = CatalogUsageTemplateReference.make({
 *   file: "packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts",
 *   packageName: "bun-types",
 *   catalog: "default"
 * })
 * console.log(reference.catalog) // "default"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CatalogUsageTemplateReference extends S.Opaque<
  CatalogUsageTemplateReference,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    file: S.String,
    packageName: S.String,
    catalog: S.String,
  }).pipe(
    $I.annoteSchema("CatalogUsageTemplateReference", {
      description: "A catalog dependency written by a package generator or scaffolder template.",
    })
  )
) {}

/**
 * Repository state the catalog usage check evaluates.
 *
 * **Details**
 *
 * `manifests` includes the root manifest. `lockfilePackages` lists the package
 * names `bun.lock` resolves, which is how a root override of a transitive
 * dependency proves a consumer.
 *
 * **Example** (Construct an empty snapshot)
 *
 * ```ts
 * import { CatalogUsageRootManifest, CatalogUsageSnapshot } from "@beep/repo-cli/commands/Quality/CatalogUsage.schemas"
 *
 * const snapshot = CatalogUsageSnapshot.make({
 *   root: CatalogUsageRootManifest.make({}),
 *   manifests: [],
 *   lockfilePackages: [],
 *   templateReferences: []
 * })
 * console.log(snapshot.manifests.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CatalogUsageSnapshot extends S.Opaque<CatalogUsageSnapshot, { readonly brand: unique symbol }>()(
  S.Struct({
    root: CatalogUsageRootManifest,
    manifests: S.Array(CatalogUsageManifest),
    lockfilePackages: S.Array(S.String),
    templateReferences: S.Array(CatalogUsageTemplateReference),
  }).pipe(
    $I.annoteSchema("CatalogUsageSnapshot", {
      description: "Root manifest, workspace manifests, lockfile package names and template catalog references.",
    })
  )
) {}

/**
 * One root catalog entry or root override with no consumer.
 *
 * **Example** (Construct an unused catalog entry finding)
 *
 * ```ts
 * import { CatalogUsageFinding } from "@beep/repo-cli/commands/Quality/CatalogUsage.schemas"
 *
 * const finding = CatalogUsageFinding.make({ subject: "catalog-entry", key: "left-pad", catalog: "default" })
 * console.log(finding.key) // "left-pad"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CatalogUsageFinding extends S.Opaque<CatalogUsageFinding, { readonly brand: unique symbol }>()(
  S.Struct({
    subject: CatalogUsageSubject,
    key: S.String,
    catalog: S.optionalKey(S.String),
  }).pipe(
    $I.annoteSchema("CatalogUsageFinding", {
      description: "A root catalog entry or root override that no manifest, override, template or lockfile consumes.",
    })
  )
) {}

/**
 * Aggregate result of the catalog usage check.
 *
 * **Example** (Construct a clean report)
 *
 * ```ts
 * import { CatalogUsageReport } from "@beep/repo-cli/commands/Quality/CatalogUsage.schemas"
 *
 * const report = CatalogUsageReport.make({
 *   catalogEntries: 2,
 *   rootOverrides: 1,
 *   manifests: 3,
 *   templateReferences: 4,
 *   findings: []
 * })
 * console.log(report.findings.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CatalogUsageReport extends S.Opaque<CatalogUsageReport, { readonly brand: unique symbol }>()(
  S.Struct({
    catalogEntries: S.Finite,
    rootOverrides: S.Finite,
    manifests: S.Finite,
    templateReferences: S.Finite,
    findings: S.Array(CatalogUsageFinding),
  }).pipe(
    $I.annoteSchema("CatalogUsageReport", {
      description: "Counts of checked catalog entries, overrides, manifests and template references, plus findings.",
    })
  )
) {}
