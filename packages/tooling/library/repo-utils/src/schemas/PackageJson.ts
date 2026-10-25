/**
 * The repo-aware package.json model, built on `@beep/package-json`.
 *
 * `PackageJson` extends the kit's presence-lenient `PackageManifest`: every
 * generic npm field (`version`, `license`, `author`, `repository`, `funding`,
 * `bin`, `workspaces`, `packageManager`, ...) comes from the kit, and this
 * module adds only what is repo-specific: repo package-name keys for the
 * dependency maps and `catalog`, non-empty `scripts`, `engines` and
 * `patchedDependencies` records, the `exports` and `imports` grammar, the
 * typed `publishConfig`, the `beep` architecture metadata, `resolutions#`, and
 * a closed `rest` so the strict decode rejects unknown top-level keys.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoUtilsId } from "@beep/identity/packages";
import { PackageDecodeError } from "@beep/package-json/Package";
import { PackageJsonFormat } from "@beep/package-json/PackageJsonFormat";
import { PackageManifest } from "@beep/package-json/PackageManifest";
import { PackageName } from "@beep/package-json/PackageName";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { identity, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Tuple from "effect/Tuple";
import { NoSuchFileError } from "../errors/index.ts";
import { jsonStringifyPretty } from "../JsonUtils.ts";
import type { PackageFormatOptions } from "@beep/package-json/Package";
import type * as Exit from "effect/Exit";
import type { DomainError } from "../errors/index.ts";

const $I = $RepoUtilsId.create("schemas/PackageJson");

const strictDecodeOptions = { onExcessProperty: "error" as const };

const repoPackageNamePattern =
  /^(?:(?:@(?:[A-Za-z0-9-*~][A-Za-z0-9-*._~]*)?\/[A-Za-z0-9-._~])|[A-Za-z0-9-~])[A-Za-z0-9-._~]*$/;
const relativeDotPathPattern = /^\.\//;
const exportTopLevelPattern = /^(?:\.|\.\/.+)$/;
const importSpecifierPattern = /^#.+$/;
const exportConditionPattern = /^(?:[^.0-9]+|types@.+)$/;

/**
 * Schema for package names used as dependency and catalog keys and in the
 * `WorkspaceDeps` and `DocgenConfig` package references.
 *
 * **Details**
 *
 * It admits mixed case so existing names keep decoding. A manifest's own
 * `name` is the kit's npm `PackageName` instead, which is lowercase only.
 *
 * **Example** (Validate workspace package name)
 *
 * ```ts
 * import { RepoPackageName } from "@beep/repo-utils/schemas/PackageJson"
 * import * as S from "effect/Schema"
 * const isValid = S.is(RepoPackageName)("@beep/repo-utils")
 * console.log(isValid)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const RepoPackageName = S.String.check(S.isMinLength(1))
  .check(S.isMaxLength(214))
  .check(S.isPattern(repoPackageNamePattern))
  .pipe(
    $I.annoteSchema("RepoPackageName", {
      title: "Repo Package Name",
      description:
        "A package name used as a dependency or catalog key and in WorkspaceDeps and DocgenConfig references; it admits mixed case, while a manifest's own name follows the npm PackageName rules.",
    })
  );

/**
 * Schema for package.json relative dot paths.
 *
 * **Example** (Validate relative dot path)
 *
 * ```ts
 * import { RelativeDotPath } from "@beep/repo-utils/schemas/PackageJson"
 * import * as S from "effect/Schema"
 * const isPath = S.is(RelativeDotPath)("./src/index.ts")
 * console.log(isPath)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const RelativeDotPath = S.String.check(S.isPattern(relativeDotPathPattern)).pipe(
  $I.annoteSchema("RelativeDotPath", {
    title: "Relative Dot Path",
    description: "A relative path that starts with ./, used by exports and publishConfig.",
  })
);

const ExportTopLevelKey = S.String.check(S.isPattern(exportTopLevelPattern)).pipe(
  $I.annoteSchema("ExportTopLevelKey", {
    title: "Export Top Level Key",
    description: "A top-level package exports key such as . or ./subpath.",
  })
);

const ImportSpecifierKey = S.String.check(S.isPattern(importSpecifierPattern)).pipe(
  $I.annoteSchema("ImportSpecifierKey", {
    title: "Import Specifier Key",
    description: "A package imports specifier key such as #internal or #config/*.",
  })
);

const ExportConditionKey = S.String.check(S.isPattern(exportConditionPattern)).pipe(
  $I.annoteSchema("ExportConditionKey", {
    title: "Export Condition Key",
    description: "A conditional exports/imports key such as import, require, default, node, or types@>=5.",
  })
);

/**
 * Schema for non-empty package metadata strings.
 *
 * **Example** (Validate non-empty string)
 *
 * ```ts
 * import { NonEmptyStringValue } from "@beep/repo-utils/schemas/PackageJson"
 * import * as S from "effect/Schema"
 * const isNonEmpty = S.is(NonEmptyStringValue)("catalog:")
 * console.log(isNonEmpty)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const NonEmptyStringValue = S.String.check(S.isMinLength(1)).pipe(
  $I.annoteSchema("NonEmptyStringValue", {
    title: "Non Empty String Value",
    description: "A non-empty string value used for package metadata fields that should not be blank.",
  })
);

const makeStrictStringKeyRecord = <Value extends S.Top>(
  keyGuard: (key: string) => boolean,
  value: Value,
  message: string
) =>
  S.Record(S.String, value).check(
    S.makeFilter<S.Record.Type<typeof S.String, Value>>((record) =>
      pipe(
        R.keys(record),
        // Report one invalid key per decode; callers use the path as the JSON pointer anchor.
        A.findFirst((key) => !keyGuard(key)),
        O.match({
          onNone: () => undefined,
          onSome: (invalidKey) => ({
            path: [invalidKey],
            issue: message,
          }),
        })
      )
    )
  );

const RepoDependencyRecord = makeStrictStringKeyRecord(
  S.is(RepoPackageName),
  NonEmptyStringValue,
  "Dependency names must be valid repo package names"
).pipe(
  $I.annoteSchema("RepoDependencyRecord", {
    title: "Repo Dependency Record",
    description:
      "A record of repo-local package names to non-empty version or protocol specifiers, including legacy mixed-case workspace packages.",
  })
);

const NonEmptyStringRecord = makeStrictStringKeyRecord(
  S.is(NonEmptyStringValue),
  NonEmptyStringValue,
  "Record keys must not be empty"
).pipe(
  $I.annoteSchema("NonEmptyStringRecord", {
    title: "Non Empty String Record",
    description: "A record whose keys and values are non-empty strings.",
  })
);

/**
 * Render a string map field (`dependencies`, `scripts`, `engines`, a
 * `WorkspaceDeps` bucket) as a plain record with its keys in sorted order.
 *
 * **Details**
 *
 * A `HashMap` keeps no insertion order, so every plain-record view of one is
 * sorted by key; the encoders of the map fields use the same ordering.
 *
 * **Example** (Render scripts as a sorted record)
 *
 * ```ts
 * import * as HashMap from "effect/HashMap"
 * import { toSortedRecord } from "@beep/repo-utils/schemas/PackageJson"
 *
 * console.log(toSortedRecord(HashMap.make(["test", "vitest"], ["build", "tsc -b"])))
 * // { build: "tsc -b", test: "vitest" }
 * ```
 *
 * @param map - The string map to render.
 * @returns A record holding the same entries, keys sorted.
 * @category utilities
 * @since 0.0.0
 */
export const toSortedRecord = (map: HashMap.HashMap<string, string>): R.ReadonlyRecord<string, string> =>
  pipe(
    A.fromIterable(map),
    A.sort(Order.mapInput(Order.String, ([key]: readonly [string, string]) => key)),
    R.fromEntries
  );

const recordToSortedHashMap = {
  // An absent map decodes to an empty `HashMap`, the kit's `DependencyMapField` default.
  decode: SchemaGetter.transformOptional((record: O.Option<{ readonly [key: string]: string }>) =>
    record.pipe(O.getOrElse(R.empty<string, string>), R.toEntries, HashMap.fromIterable, O.some)
  ),
  // An empty map encodes to an absent key, so encoding never invents `{}`; keys are emitted in sorted order.
  encode: SchemaGetter.transformOptional((map: O.Option<HashMap.HashMap<string, string>>) =>
    pipe(
      map,
      O.filter((entries) => !HashMap.isEmpty(entries)),
      O.map(toSortedRecord)
    )
  ),
};

// The decoded HashMap carries the same key and value checks as the encoded record, so derived arbitraries and
// `S.is` guards agree with what the record admits.
const makeHashMapField = <
  Record extends S.Codec<{ readonly [key: string]: string }>,
  Key extends S.Codec<string>,
  Value extends S.Codec<string>,
>(
  record: Record,
  key: Key,
  value: Value
) =>
  S.optionalKey(record).pipe(
    S.decodeTo(S.HashMap(key, value), recordToSortedHashMap),
    S.withConstructorDefault(Effect.succeed(HashMap.empty<string, string>()))
  );

const RepoDependencyMapField = makeHashMapField(RepoDependencyRecord, RepoPackageName, NonEmptyStringValue).pipe(
  $I.annoteSchema("RepoDependencyMapField", {
    title: "Repo Dependency Map Field",
    description:
      "A dependency map keyed by repo package names, decoded to a HashMap that defaults to empty and encodes back to an absent key when empty.",
  })
);

const NonEmptyStringMapField = makeHashMapField(NonEmptyStringRecord, NonEmptyStringValue, NonEmptyStringValue).pipe(
  $I.annoteSchema("NonEmptyStringMapField", {
    title: "Non Empty String Map Field",
    description:
      "A non-empty string map decoded to a HashMap that defaults to empty and encodes back to an absent key when empty.",
  })
);

const OptionalNonEmptyStringMapField = S.optionalKey(
  NonEmptyStringRecord.pipe(
    S.decodeTo(S.HashMap(NonEmptyStringValue, NonEmptyStringValue), {
      decode: SchemaGetter.transform((record: { readonly [key: string]: string }) =>
        HashMap.fromIterable(R.toEntries(record))
      ),
      encode: SchemaGetter.transform(toSortedRecord),
    })
  )
).pipe(
  $I.annoteSchema("OptionalNonEmptyStringMapField", {
    title: "Optional Non Empty String Map Field",
    description: "An optional non-empty string map decoded to a HashMap, with no default for an absent key.",
  })
);

const BeepFoundationKind = S.Literals(["primitive", "modeling", "capability", "ui-system"] as const).pipe(
  $I.annoteSchema("BeepFoundationKind", {
    title: "Beep Foundation Kind",
    description: "Canonical foundation package kind metadata from the repo architecture.",
  })
);

const BeepToolingKind = S.Literals(["library", "tool", "policy-pack", "test-kit"] as const).pipe(
  $I.annoteSchema("BeepToolingKind", {
    title: "Beep Tooling Kind",
    description: "Canonical tooling package kind metadata from the repo architecture.",
  })
);

const BeepPackageFamily = LiteralKit(["foundation", "drivers", "tooling", "ecosystem"]).pipe(
  $I.annoteSchema("BeepPackageFamily", {
    title: "Beep Package Family",
    description: "Canonical package family discriminator for repo-local package metadata.",
  })
);

/**
 * Repo-local package metadata for foundation packages.
 *
 * **Example** (Tag a modeling package in the foundation family)
 *
 * ```ts
 * import { BeepFoundationMetadata } from "@beep/repo-utils/schemas/PackageJson"
 *
 * const metadata = BeepFoundationMetadata.make({ family: "foundation", kind: "modeling" })
 *
 * console.log(`${metadata.family}/${metadata.kind}`) // => "foundation/modeling"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BeepFoundationMetadata extends S.Opaque<BeepFoundationMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    family: S.tag("foundation"),
    kind: BeepFoundationKind,
  }).pipe(
    $I.annoteSchema("BeepFoundationMetadata", {
      title: "Beep Foundation Metadata",
      description: "Repo-local package metadata for foundation packages.",
    })
  )
) {}

/**
 * Repo-local package metadata for flat driver packages.
 *
 * **Example** (Tag a flat driver package)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { BeepDriverMetadata } from "@beep/repo-utils/schemas/PackageJson"
 *
 * const metadata = S.decodeUnknownSync(BeepDriverMetadata)({ family: "drivers" })
 *
 * console.log(metadata.family) // => "drivers"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BeepDriverMetadata extends S.Opaque<BeepDriverMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    family: S.tag("drivers"),
  }).pipe(
    $I.annoteSchema("BeepDriverMetadata", {
      title: "Beep Driver Metadata",
      description: "Repo-local package metadata for flat driver packages.",
    })
  )
) {}

/**
 * Repo-local package metadata for tooling packages.
 *
 * **Example** (Reject an unknown tooling kind)
 *
 * ```ts
 * import * as Exit from "effect/Exit"
 * import * as S from "effect/Schema"
 * import { BeepToolingMetadata } from "@beep/repo-utils/schemas/PackageJson"
 *
 * const decode = S.decodeUnknownExit(BeepToolingMetadata)
 *
 * console.log(Exit.isSuccess(decode({ family: "tooling", kind: "policy-pack" }))) // => true
 * console.log(Exit.isSuccess(decode({ family: "tooling", kind: "plugin" }))) // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BeepToolingMetadata extends S.Opaque<BeepToolingMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    family: S.tag("tooling"),
    kind: BeepToolingKind,
  }).pipe(
    $I.annoteSchema("BeepToolingMetadata", {
      title: "Beep Tooling Metadata",
      description: "Repo-local package metadata for tooling packages.",
    })
  )
) {}

/**
 * Repo-local package metadata for flat ecosystem packages.
 *
 * **Example** (Tag an ecosystem package)
 *
 * ```ts
 * import { BeepEcosystemMetadata } from "@beep/repo-utils/schemas/PackageJson"
 *
 * const metadata = BeepEcosystemMetadata.make({ family: "ecosystem" })
 *
 * console.log(metadata.family) // => "ecosystem"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BeepEcosystemMetadata extends S.Opaque<BeepEcosystemMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    family: S.tag("ecosystem"),
  }).pipe(
    $I.annoteSchema("BeepEcosystemMetadata", {
      title: "Beep Ecosystem Metadata",
      description: "Repo-local package metadata for flat ecosystem packages.",
    })
  )
) {}

const BeepPackageMetadata = BeepPackageFamily.mapMembers(
  Tuple.evolve([
    () => BeepFoundationMetadata,
    () => BeepDriverMetadata,
    () => BeepToolingMetadata,
    () => BeepEcosystemMetadata,
  ])
).pipe(
  S.toTaggedUnion("family"),
  $I.annoteSchema("BeepPackageMetadata", {
    title: "Beep Package Metadata",
    description: "Machine-readable repo architecture metadata for non-slice code packages.",
  })
);

type Json = string | number | boolean | null | ReadonlyArray<Json> | { readonly [key: string]: Json };

const Json: S.Codec<Json, Json> = S.suspend(() =>
  S.Union([S.String, S.Finite, S.Boolean, S.Null, S.Array(Json), S.Record(S.String, Json)])
).pipe(
  $I.annoteSchema("Json", {
    title: "JSON Value",
    description: "A recursive JSON value used for schema-backed escape hatches like config and publishConfig extras.",
  })
);

type PackageExportsEntry = string | null | { readonly [key: string]: PackageExportsEntryOrFallback };

type PackageExportsEntryOrFallback = PackageExportsEntry | ReadonlyArray<PackageExportsEntry>;

const PackageExportsEntryPath = S.Union([RelativeDotPath, S.Null]).pipe(
  $I.annoteSchema("PackageExportsEntryPath", {
    title: "Package Exports Entry Path",
    description: "An exports target path starting with ./, or null to explicitly block the target.",
  })
);

const PackageExportsEntryObject: S.Codec<
  { readonly [key: string]: PackageExportsEntryOrFallback },
  { readonly [key: string]: PackageExportsEntryOrFallback }
> = S.suspend(() =>
  makeStrictStringKeyRecord(
    S.is(ExportConditionKey),
    PackageExportsEntryOrFallback,
    "Package exports condition keys must be valid condition names"
  )
).pipe(
  $I.annoteSchema("PackageExportsEntryObject", {
    title: "Package Exports Entry Object",
    description:
      "A conditional exports object keyed by conditions such as import, require, default, or types@ selectors.",
  })
);

const PackageExportsEntry: S.Codec<PackageExportsEntry, PackageExportsEntry> = S.suspend(() =>
  S.Union([PackageExportsEntryPath, PackageExportsEntryObject])
).pipe(
  $I.annoteSchema("PackageExportsEntry", {
    title: "Package Exports Entry",
    description: "A single exports entry represented as a relative path, null, or a conditional exports object.",
  })
);

const PackageExportsFallback = S.NonEmptyArray(PackageExportsEntry).pipe(
  $I.annoteSchema("PackageExportsFallback", {
    title: "Package Exports Fallback",
    description: "A non-empty fallback array of exports entries evaluated in order.",
  })
);

const PackageExportsEntryOrFallback: S.Codec<PackageExportsEntryOrFallback, PackageExportsEntryOrFallback> = S.suspend(
  () => S.Union([PackageExportsEntry, PackageExportsFallback])
).pipe(
  $I.annoteSchema("PackageExportsEntryOrFallback", {
    title: "Package Exports Entry Or Fallback",
    description: "An exports target represented as a single entry or a non-empty fallback array of entries.",
  })
);

const PackageExportsSubpathMap = makeStrictStringKeyRecord(
  S.is(ExportTopLevelKey),
  PackageExportsEntryOrFallback,
  "Package exports subpath keys must be . or start with ./"
).pipe(
  $I.annoteSchema("PackageExportsSubpathMap", {
    title: "Package Exports Subpath Map",
    description: "An exports map whose keys are . or ./subpath targets and whose values are exports entries.",
  })
);

/**
 * Schema for the `exports` field.
 *
 * **Example** (Inspect PackageExports schema)
 *
 * ```ts
 * import { PackageExports } from "@beep/repo-utils/schemas/PackageJson"
 * const schema = PackageExports
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const PackageExports = S.Union([
  PackageExportsEntryPath,
  PackageExportsSubpathMap,
  PackageExportsEntryObject,
  PackageExportsFallback,
]).pipe(
  $I.annoteSchema("PackageExports", {
    title: "Package Exports",
    description:
      "The package exports field modeled as a path target, conditional exports object, subpath map, or fallback array.",
  })
);

type PackageImportsEntry = string | null | { readonly [key: string]: PackageImportsEntryOrFallback };

type PackageImportsEntryOrFallback = PackageImportsEntry | ReadonlyArray<PackageImportsEntry>;

const PackageImportsEntryPath = S.Union([S.String, S.Null]).pipe(
  $I.annoteSchema("PackageImportsEntryPath", {
    title: "Package Imports Entry Path",
    description: "An imports target path or null to explicitly block the target.",
  })
);

const PackageImportsEntryObject: S.Codec<
  { readonly [key: string]: PackageImportsEntryOrFallback },
  { readonly [key: string]: PackageImportsEntryOrFallback }
> = S.suspend(() =>
  makeStrictStringKeyRecord(
    S.is(ExportConditionKey),
    PackageImportsEntryOrFallback,
    "Package imports condition keys must be valid condition names"
  )
).pipe(
  $I.annoteSchema("PackageImportsEntryObject", {
    title: "Package Imports Entry Object",
    description:
      "A conditional imports object keyed by conditions such as import, require, default, or types@ selectors.",
  })
);

const PackageImportsEntry: S.Codec<PackageImportsEntry, PackageImportsEntry> = S.suspend(() =>
  S.Union([PackageImportsEntryPath, PackageImportsEntryObject])
).pipe(
  $I.annoteSchema("PackageImportsEntry", {
    title: "Package Imports Entry",
    description: "A single imports entry represented as a path, null, or a conditional imports object.",
  })
);

const PackageImportsFallback = S.NonEmptyArray(PackageImportsEntry).pipe(
  $I.annoteSchema("PackageImportsFallback", {
    title: "Package Imports Fallback",
    description: "A non-empty fallback array of imports entries evaluated in order.",
  })
);

const PackageImportsEntryOrFallback: S.Codec<PackageImportsEntryOrFallback, PackageImportsEntryOrFallback> = S.suspend(
  () => S.Union([PackageImportsEntry, PackageImportsFallback])
).pipe(
  $I.annoteSchema("PackageImportsEntryOrFallback", {
    title: "Package Imports Entry Or Fallback",
    description: "An imports target represented as a single entry or a non-empty fallback array of entries.",
  })
);

/**
 * Schema for the `imports` field.
 *
 * **Example** (Inspect PackageImports schema)
 *
 * ```ts
 * import { PackageImports } from "@beep/repo-utils/schemas/PackageJson"
 * const schema = PackageImports
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const PackageImports = makeStrictStringKeyRecord(
  S.is(ImportSpecifierKey),
  PackageImportsEntryOrFallback,
  "Package imports keys must start with #"
).pipe(
  $I.annoteSchema("PackageImports", {
    title: "Package Imports",
    description: "Private package import mappings keyed by # specifiers.",
  })
);

const PublishConfigBin = S.Union([S.String, S.Record(S.String, S.String)]).pipe(
  $I.annoteSchema("PublishConfigBin", {
    title: "Publish Config Bin",
    description: "The publishConfig bin override: a single executable path or command names mapped to paths.",
  })
);
const PublishConfigPackageExports = PackageExports.pipe($I.annoteSchema("PublishConfigPackageExports"));

const PublishConfigBase = S.Struct({
  access: S.optionalKey(S.Literals(["public", "restricted"] as const)),
  tag: S.optionalKey(S.String),
  registry: S.optionalKey(S.String),
  provenance: S.optionalKey(S.Boolean),
  bin: S.optionalKey(PublishConfigBin),
  exports: S.optionalKey(PublishConfigPackageExports),
}).pipe(
  $I.annoteSchema("PublishConfigBase", {
    title: "Publish Config Base",
    description:
      "Structured npm publish configuration fields modeled explicitly before allowing additional JSON-valued keys.",
  })
);

/**
 * Schema for the `publishConfig` field.
 *
 * **Example** (Inspect PublishConfig schema)
 *
 * ```ts
 * import { PublishConfig } from "@beep/repo-utils/schemas/PackageJson"
 * const schema = PublishConfig
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const PublishConfig = S.StructWithRest(PublishConfigBase, [S.Record(S.String, Json)]).pipe(
  $I.annoteSchema("PublishConfig", {
    title: "Publish Config",
    description:
      "npm publish configuration with explicit support for access, tag, registry, provenance, bin, exports, and additional JSON-valued config keys.",
  })
);

// `PackageManifest` keeps unknown top-level keys in `rest`; the repo model is closed, so a literal `rest` key is
// rejected at `/rest` like any other unexpected key.
const ClosedRest = S.Never.pipe(
  $I.annoteSchema("ClosedRest", {
    title: "Closed Rest",
    description: "The closed catch-all of the repo package.json model: no unknown top-level key is carried.",
    message: "Unexpected package.json key",
  })
);

const RawPackageJson = S.Record(S.String, S.Unknown);

// The repo model's wire codec: keys outside the declared fields are gathered into `rest`, which `ClosedRest` rejects
// with the unexpected-key message, so the codec is strict without parse options and decodes to the class itself.
const makeClosedWire = <Self>(
  Class: S.Codec<Self, unknown> & { readonly fields: Readonly<Record<string, unknown>> }
): S.Codec<Self, { readonly [k: string]: unknown }> => {
  const knownKeys = HashSet.fromIterable(A.filter(R.keys(Class.fields), (key) => key !== "rest"));
  return RawPackageJson.pipe(
    S.decode(
      SchemaTransformation.transform({
        decode: (raw: { readonly [k: string]: unknown }): Record<string, unknown> => {
          const entries = R.toEntries(raw);
          const known = R.fromEntries(A.filter(entries, ([key]) => HashSet.has(knownKeys, key)));
          const unknownEntries = A.filter(entries, ([key]) => !HashSet.has(knownKeys, key));
          return A.isReadonlyArrayNonEmpty(unknownEntries) ? { ...known, rest: R.fromEntries(unknownEntries) } : known;
        },
        encode: identity,
      })
    ),
    S.decodeTo(Class)
  );
};

/**
 * Type-safe schema for this repo's package.json files.
 *
 * **Details**
 *
 * Extends `PackageManifest` from `@beep/package-json`: the generic npm fields
 * are the kit's, and this class narrows or adds the repo-specific ones. The
 * dependency maps and `scripts` decode to `HashMap` and default to empty;
 * `engines` decodes to a `HashMap` when present; every other optional field
 * is absent (`undefined`) rather than an `Option`.
 *
 * Decode it with the strict helpers (`decodePackageJsonEffect`,
 * `PackageJson.decodeStrictEffect`, ...): they reject unexpected top-level
 * keys. `PackageJson.schema`, `PackageJson.decode` and `toJsonString` are
 * redefined to run the repo model, so none of the kit's open
 * `PackageManifest` entry points is reachable through this class.
 *
 * **Example** (Decode a repo manifest and read a dependency)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as HashMap from "effect/HashMap"
 * import { decodePackageJsonEffect } from "@beep/repo-utils/schemas/PackageJson"
 *
 * const manifest = Effect.runSync(
 *   decodePackageJsonEffect({ name: "@beep/example", dependencies: { effect: "catalog:" } })
 * )
 * console.log(HashMap.get(manifest.dependencies, "effect")) // Some("catalog:")
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class PackageJson extends PackageManifest.extend<PackageJson>($I`PackageJson`)(
  {
    name: PackageName.pipe(
      $I.annoteKey("PackageJson.name", { description: "Package identifier satisfying npm naming rules." })
    ),
    dependencies: RepoDependencyMapField.pipe(
      $I.annoteKey("PackageJson.dependencies", {
        description: "Production dependency specifiers keyed by repo package name, defaulting to an empty map.",
      })
    ),
    devDependencies: RepoDependencyMapField.pipe(
      $I.annoteKey("PackageJson.devDependencies", {
        description: "Development dependency specifiers keyed by repo package name, defaulting to an empty map.",
      })
    ),
    peerDependencies: RepoDependencyMapField.pipe(
      $I.annoteKey("PackageJson.peerDependencies", {
        description: "Peer dependency specifiers keyed by repo package name, defaulting to an empty map.",
      })
    ),
    optionalDependencies: RepoDependencyMapField.pipe(
      $I.annoteKey("PackageJson.optionalDependencies", {
        description: "Optional dependency specifiers keyed by repo package name, defaulting to an empty map.",
      })
    ),
    scripts: NonEmptyStringMapField.pipe(
      $I.annoteKey("PackageJson.scripts", {
        description: "Non-empty commands keyed by non-empty script names, defaulting to an empty map.",
      })
    ),
    engines: OptionalNonEmptyStringMapField.pipe(
      $I.annoteKey("PackageJson.engines", {
        description: "Supported runtime and tool version constraints keyed by engine name.",
      })
    ),
    patchedDependencies: S.optionalKey(NonEmptyStringRecord).pipe(
      $I.annoteKey("PackageJson.patchedDependencies", {
        description: "Bun patch files keyed by the patched package specifier.",
      })
    ),
    catalog: S.optionalKey(RepoDependencyRecord).pipe(
      $I.annoteKey("PackageJson.catalog", {
        description: "Bun default catalog: repo package names mapped to the specifiers `catalog:` resolves to.",
      })
    ),
    exports: S.optionalKey(PackageExports).pipe(
      $I.annoteKey("PackageJson.exports", {
        description: "Package entry points under the repo exports grammar.",
      })
    ),
    imports: S.optionalKey(PackageImports).pipe(
      $I.annoteKey("PackageJson.imports", {
        description: "Private package import mappings keyed by # specifiers.",
      })
    ),
    publishConfig: S.optionalKey(PublishConfig).pipe(
      $I.annoteKey("PackageJson.publishConfig", {
        description: "npm publish configuration with typed access, tag, registry, provenance, bin and exports.",
      })
    ),
    beep: S.optionalKey(BeepPackageMetadata).pipe(
      $I.annoteKey("PackageJson.beep", {
        description: "Machine-readable repo architecture metadata for non-slice code packages.",
      })
    ),
    "resolutions#": S.optionalKey(NonEmptyStringRecord).pipe(
      $I.annoteKey("PackageJson.resolutions#", {
        description: "Comments explaining the root resolutions, keyed by the resolved package.",
      })
    ),
    rest: S.optionalKey(ClosedRest).pipe(
      $I.annoteKey("PackageJson.rest", {
        description: "Closed catch-all: the repo model carries no unknown top-level key.",
      })
    ),
  },
  $I.annote("PackageJson", {
    description:
      "A strict repo-aware package.json schema that extends the @beep/package-json PackageManifest with monorepo-only metadata.",
    messageUnexpectedKey: "Unexpected package.json key",
  })
) {
  /**
   * The wire codec: an open JSON object ↔ a {@link PackageJson} instance.
   *
   * **Details**
   *
   * Redefines the inherited `PackageManifest.schema`, the kit's open wire
   * that keeps unknown keys in `rest` and decodes to a plain
   * `PackageManifest`. Here an unknown top-level key is gathered into the
   * closed `rest`, which rejects it, so the codec needs no
   * `onExcessProperty` option to stay strict.
   *
   * **Example** (Decode through the repo wire codec)
   *
   * ```ts
   * import * as S from "effect/Schema"
   * import { PackageJson } from "@beep/repo-utils/schemas/PackageJson"
   *
   * const manifest = S.decodeSync(PackageJson.schema)({ name: "@beep/example" })
   * console.log(S.is(PackageJson)(manifest)) // true
   * ```
   *
   * @category codecs
   * @since 0.0.0
   */
  static readonly schema: S.Codec<PackageJson, { readonly [k: string]: unknown }> = makeClosedWire(PackageJson);

  /**
   * Decode an unknown strict package.json value into a Result.
   *
   * **Example** (Decode to Result)
   *
   * ```ts
   * import { PackageJson } from "@beep/repo-utils/schemas/PackageJson"
   * const result = PackageJson.decodeStrictResult({ name: "@beep/example" }, { onExcessProperty: "error" })
   * console.log(result)
   * ```
   *
   * @category validation
   * @since 0.0.0
   */
  static readonly decodeStrictResult = S.decodeUnknownResult(PackageJson);
  /**
   * Decode an unknown strict package.json value into an Exit.
   *
   * **Example** (Decode to Exit)
   *
   * ```ts
   * import { PackageJson } from "@beep/repo-utils/schemas/PackageJson"
   * const exit = PackageJson.decodeStrictExit({ name: "@beep/example" }, { onExcessProperty: "error" })
   * console.log(exit)
   * ```
   *
   * @category validation
   * @since 0.0.0
   */
  static readonly decodeStrictExit = S.decodeUnknownExit(PackageJson);
  /**
   * Decode an unknown strict package.json value as an Effect.
   *
   * **Example** (Decode to Effect)
   *
   * ```ts
   * import { PackageJson } from "@beep/repo-utils/schemas/PackageJson"
   * const effect = PackageJson.decodeStrictEffect({ name: "@beep/example" }, { onExcessProperty: "error" })
   * console.log(effect)
   * ```
   *
   * @category validation
   * @since 0.0.0
   */
  static readonly decodeStrictEffect = S.decodeUnknownEffect(PackageJson);
  /**
   * Encode a strict package.json value as an Effect.
   *
   * **Example** (Encode as Effect)
   *
   * ```ts
   * import { PackageJson } from "@beep/repo-utils/schemas/PackageJson"
   * const effect = PackageJson.encodeStrictEffect(PackageJson.make({ name: "@beep/example" }))
   * console.log(effect)
   * ```
   *
   * @category validation
   * @since 0.0.0
   */
  static readonly encodeStrictEffect = S.encodeUnknownEffect(PackageJson);
  /**
   * Encode a strict package.json value to a JSON string as an Effect.
   *
   * **Example** (Encode to JSON string)
   *
   * ```ts
   * import { PackageJson } from "@beep/repo-utils/schemas/PackageJson"
   * const effect = PackageJson.encodeJsonStringEffect(PackageJson.make({ name: "@beep/example" }))
   * console.log(effect)
   * ```
   *
   * @category validation
   * @since 0.0.0
   */
  static readonly encodeJsonStringEffect = S.encodeUnknownEffect(S.fromJsonString(PackageJson));

  /**
   * Decode an unknown JSON value through the strict repo model, failing with
   * the kit's `PackageDecodeError`.
   *
   * **Details**
   *
   * Overrides the inherited `PackageManifest.decode`, which runs the kit's
   * open wire codec and would return a plain `PackageManifest` with `beep`
   * and `resolutions#` parked in `rest`.
   *
   * **Example** (Decode through the repo model)
   *
   * ```ts
   * import * as Effect from "effect/Effect"
   * import { PackageJson } from "@beep/repo-utils/schemas/PackageJson"
   *
   * const manifest = Effect.runSync(PackageJson.decode({ name: "@beep/example", beep: { family: "ecosystem" } }))
   * console.log(manifest.beep?.family) // "ecosystem"
   * ```
   *
   * @category decoding
   * @since 0.0.0
   */
  static readonly decode = Effect.fn("RepoUtils.PackageJson.decode")(function* (input: unknown) {
    return yield* decodePackageJsonEffect(input).pipe(Effect.mapError((cause) => PackageDecodeError.make({ cause })));
  });

  /**
   * Serialize through the repo model, then format with the kit's text
   * formatter.
   *
   * **Details**
   *
   * Overrides the inherited `PackageManifest.toJsonString`, which encodes
   * through the kit's wire codec and would drop `beep` and `resolutions#`.
   * Key order follows the kit formatter; the repo's canonical order is
   * `encodePackageJsonCanonicalPrettyEffect` in `PackageJsonTools`.
   *
   * **Example** (Serialize a manifest with beep metadata)
   *
   * ```ts
   * import * as Effect from "effect/Effect"
   * import { decodePackageJsonEffect } from "@beep/repo-utils/schemas/PackageJson"
   *
   * const manifest = Effect.runSync(decodePackageJsonEffect({ name: "@beep/example", beep: { family: "ecosystem" } }))
   * console.log(manifest.toJsonString().includes("ecosystem")) // true
   * ```
   *
   * @param options - Kit formatting options (indent, sort, stripEmpty, newline).
   * @returns The formatted package.json text.
   * @category serialization
   * @since 0.0.0
   */
  override toJsonString(options?: PackageFormatOptions.Encoded): string {
    const encoded = Result.getOrThrowWith(S.encodeUnknownResult(PackageJson)(this), identity);
    return Result.getOrThrowWith(PackageJsonFormat.formatToString(JSON.stringify(encoded), options), identity);
  }
}

/**
 * Namespace helpers for the repo-aware package-json schema.
 *
 * **Example** (Read typed package name)
 *
 * ```ts
 * import type { PackageJson } from "@beep/repo-utils/schemas/PackageJson"
 * const readName = (value: PackageJson.Type) => value.name
 * console.log(readName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace PackageJson {
  /**
   * Decoded runtime type for {@link PackageJson}.
   *
   * @category models
   * @since 0.0.0
   */
  export type Type = PackageJson;
  /**
   * Encoded representation for {@link PackageJson}.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = S.Codec.Encoded<typeof PackageJson>;
}

/**
 * Runtime type for {@link RepoPackageName}.
 *
 * **Example** (Accept RepoPackageName type)
 *
 * ```ts
 * import type { RepoPackageName } from "@beep/repo-utils/schemas/PackageJson"
 * const acceptPackageName = (_value: RepoPackageName) => undefined
 * console.log(acceptPackageName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type RepoPackageName = (typeof RepoPackageName)["Type"];
/**
 * Runtime type for {@link RelativeDotPath}.
 *
 * **Example** (Accept RelativeDotPath type)
 *
 * ```ts
 * import type { RelativeDotPath } from "@beep/repo-utils/schemas/PackageJson"
 * const acceptPath = (_value: RelativeDotPath) => undefined
 * console.log(acceptPath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type RelativeDotPath = (typeof RelativeDotPath)["Type"];
/**
 * Runtime type for {@link NonEmptyStringValue}.
 *
 * **Example** (Accept NonEmptyStringValue type)
 *
 * ```ts
 * import type { NonEmptyStringValue } from "@beep/repo-utils/schemas/PackageJson"
 * const acceptText = (_value: NonEmptyStringValue) => undefined
 * console.log(acceptText)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NonEmptyStringValue = (typeof NonEmptyStringValue)["Type"];
/**
 * Runtime type for {@link PackageExports}.
 *
 * **Example** (Accept PackageExports type)
 *
 * ```ts
 * import type { PackageExports } from "@beep/repo-utils/schemas/PackageJson"
 * const acceptPackageExports = (_value: PackageExports) => undefined
 * console.log(acceptPackageExports)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PackageExports = (typeof PackageExports)["Type"];
/**
 * Runtime type for {@link PackageImports}.
 *
 * **Example** (Accept PackageImports type)
 *
 * ```ts
 * import type { PackageImports } from "@beep/repo-utils/schemas/PackageJson"
 * const acceptPackageImports = (_value: PackageImports) => undefined
 * console.log(acceptPackageImports)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PackageImports = (typeof PackageImports)["Type"];
/**
 * Runtime type for {@link PublishConfig}.
 *
 * **Example** (Accept PublishConfig type)
 *
 * ```ts
 * import type { PublishConfig } from "@beep/repo-utils/schemas/PackageJson"
 * const acceptPublishConfig = (_value: PublishConfig) => undefined
 * console.log(acceptPublishConfig)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PublishConfig = (typeof PublishConfig)["Type"];

/**
 * Synchronously decode an unknown value into a strict `PackageJson`.
 * Throws a `SchemaError` if validation fails.
 *
 * **Example** (Decode package.json value)
 *
 * ```ts
 * import { decodePackageJson } from "@beep/repo-utils/schemas/PackageJson"
 * const packageJson = decodePackageJson({ name: "@beep/example" })
 * console.log(packageJson)
 * ```
 *
 * @param input - Unknown package.json-shaped value to validate and decode.
 * @returns Decoded strict `PackageJson` value.
 * @category validation
 * @since 0.0.0
 */
export const decodePackageJson = (input: unknown): PackageJson.Type =>
  Result.getOrThrow(PackageJson.decodeStrictResult(input, strictDecodeOptions));

/**
 * Synchronously decode an unknown value into a strict `PackageJson`,
 * returning an `Exit` instead of throwing.
 *
 * **Example** (Decode to Exit)
 *
 * ```ts
 * import { decodePackageJsonExit } from "@beep/repo-utils/schemas/PackageJson"
 * const exit = decodePackageJsonExit({ name: "@beep/example" })
 * console.log(exit)
 * ```
 *
 * @param input - Unknown package.json-shaped value to validate and decode.
 * @returns Exit describing either the decoded package.json or the schema failure.
 * @category validation
 * @since 0.0.0
 */
export const decodePackageJsonExit: (input: unknown) => Exit.Exit<PackageJson.Type, S.SchemaError> = (input) =>
  PackageJson.decodeStrictExit(input, strictDecodeOptions);

/**
 * Decode an unknown value into a strict `PackageJson` as an Effect.
 *
 * **Details**
 *
 * Excess top-level and nested properties are rejected. Use this when repo tools
 * need package manifests that match the supported schema surface instead of
 * permissively carrying unknown keys forward.
 *
 * **Example** (Decode with Effect)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { decodePackageJsonEffect } from "@beep/repo-utils/schemas/PackageJson"
 * const packageJson = Effect.runSync(
 *   decodePackageJsonEffect({
 *     name: "@beep/example",
 *     dependencies: { effect: "catalog:" }
 *   })
 * )
 * console.log(packageJson.name) // "@beep/example"
 * ```
 *
 * @param input - Unknown value decoded against the strict `PackageJson` schema.
 * @returns An Effect that succeeds with the decoded `PackageJson` or fails with `S.SchemaError`.
 * @effects
 * Runs strict Effect Schema decoding with excess-property rejection and fails
 * with `S.SchemaError`; it performs no filesystem or process I/O.
 * @category validation
 * @since 0.0.0
 */
export const decodePackageJsonEffect: (input: unknown) => Effect.Effect<PackageJson.Type, S.SchemaError> = (input) =>
  PackageJson.decodeStrictEffect(input, strictDecodeOptions);

/**
 * Encode a strict `PackageJson` value back to its encoded form as an Effect.
 *
 * **Details**
 *
 * The input is first decoded with strict excess-property rejection so callers
 * do not accidentally encode malformed package.json objects.
 *
 * **Gotchas**
 *
 * The output does not keep the input's key order. The dependency maps,
 * `scripts`, `engines` and `bin` decode to `HashMap`, so their keys come out
 * sorted, and an empty map (`"dependencies": {}`) is omitted. Writers that
 * need the repo's on-disk order use `encodePackageJsonCanonicalPrettyEffect`.
 *
 * **Example** (Encode package.json Effect)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { encodePackageJsonEffect } from "@beep/repo-utils/schemas/PackageJson"
 * const encoded = Effect.runSync(
 *   encodePackageJsonEffect({
 *     name: "@beep/example",
 *     private: true,
 *     scripts: { check: "tsgo -b tsconfig.json" }
 *   })
 * )
 * console.log(encoded.scripts?.check) // "tsgo -b tsconfig.json"
 * ```
 *
 * @effects
 * Decodes the input with strict package.json validation before encoding it back
 * to the schema's external representation; failures are reported as
 * `S.SchemaError`.
 * @category validation
 * @since 0.0.0
 */
export const encodePackageJsonEffect: (input: unknown) => Effect.Effect<PackageJson.Encoded, S.SchemaError> = Effect.fn(
  function* (input) {
    const validated = yield* decodePackageJsonEffect(input);
    return yield* PackageJson.encodeStrictEffect(validated);
  }
);

/**
 * Encode a strict `PackageJson` value to a compact JSON string as an Effect.
 *
 * **Example** (Encode to JSON string)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { encodePackageJsonToJsonEffect } from "@beep/repo-utils/schemas/PackageJson"
 * const json = Effect.runSync(
 *   encodePackageJsonToJsonEffect({
 *     name: "@beep/example",
 *     type: "module"
 *   })
 * )
 * console.log(json.includes("\"type\":\"module\"")) // true
 * ```
 *
 * @effects
 * Validates the package manifest and serializes the encoded value through the
 * schema JSON-string encoder; failures are reported as `S.SchemaError`.
 * @category validation
 * @since 0.0.0
 */
export const encodePackageJsonToJsonEffect: (input: unknown) => Effect.Effect<string, S.SchemaError> = Effect.fn(
  function* (input) {
    const validated = yield* decodePackageJsonEffect(input);
    return yield* PackageJson.encodeJsonStringEffect(validated);
  }
);

/**
 * Encode a strict `PackageJson` value to a pretty-printed JSON string.
 *
 * **Details**
 *
 * Formatting happens after schema validation and encoding, so invalid manifest
 * fields fail as schema errors before JSON rendering is attempted.
 *
 * **Example** (Pretty-print package.json)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { encodePackageJsonPrettyEffect } from "@beep/repo-utils/schemas/PackageJson"
 * const pretty = Effect.runSync(
 *   encodePackageJsonPrettyEffect({
 *     name: "@beep/example",
 *     private: true
 *   })
 * )
 * console.log(pretty.includes("\n")) // true
 * ```
 *
 * @effects
 * Validates and encodes the manifest, then pretty-prints the JSON payload;
 * formatting failures surface as `DomainError`.
 * @category validation
 * @since 0.0.0
 */
export const encodePackageJsonPrettyEffect: (input: unknown) => Effect.Effect<string, S.SchemaError | DomainError> =
  Effect.fn(function* (input) {
    const validated = yield* encodePackageJsonEffect(input);
    return yield* jsonStringifyPretty(validated);
  });

const decodeUnknownFromJsonString = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));

/**
 * Read a `package.json` file from disk and decode it into a strict `PackageJson`.
 *
 * **Details**
 *
 * Composes `FileSystem.readFileString` with the existing strict
 * {@link decodePackageJsonEffect}, collapsing the read-then-parse-then-decode
 * pattern duplicated across repo tooling into one helper. A read failure (for
 * example a missing file) surfaces as {@link NoSuchFileError}; malformed JSON and
 * any schema violation — including excess top-level keys, which the strict decode
 * rejects — surface as `S.SchemaError`.
 *
 * **Example** (Read package.json from disk)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { readPackageJsonFile } from "@beep/repo-utils/schemas/PackageJson"
 *
 * const program = readPackageJsonFile("packages/example/package.json")
 * const name = Effect.map(program, (manifest) => manifest.name)
 * console.log(name)
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const readPackageJsonFile: (
  filePath: string
) => Effect.Effect<PackageJson.Type, NoSuchFileError | S.SchemaError, FileSystem.FileSystem> = Effect.fn(
  function* (filePath) {
    const fs = yield* FileSystem.FileSystem;
    const content = yield* fs
      .readFileString(filePath)
      .pipe(
        Effect.mapError((error) =>
          NoSuchFileError.make({ path: filePath, message: `Failed to read package.json: ${error.message}` })
        )
      );
    const parsed = yield* decodeUnknownFromJsonString(content);
    return yield* decodePackageJsonEffect(parsed);
  }
);
