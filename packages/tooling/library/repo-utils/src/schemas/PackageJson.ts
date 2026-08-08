/**
 * Type-safe package.json schemas using Effect v4 Schema.
 *
 * The exported `NpmPackageJson` schema models the npm/package.json surface we
 * intentionally support from SchemaStore and npm docs. `PackageJson` extends it
 * with repo-local top-level fields used in this monorepo.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoUtilsId } from "@beep/identity/packages";
import { EmailString, LiteralKit, SchemaUtils } from "@beep/schema";
import { Effect, FileSystem, pipe, Result, Tuple } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { NoSuchFileError } from "../errors/index.ts";
import { jsonStringifyPretty } from "../JsonUtils.ts";
import type { Exit } from "effect";
import type { DomainError } from "../errors/index.ts";

const $I = $RepoUtilsId.create("schemas/PackageJson");

const strictDecodeOptions = { onExcessProperty: "error" as const };

const npmPackageNamePattern = /^(?:(?:@(?:[a-z0-9-*~][a-z0-9-*._~]*)?\/[a-z0-9-._~])|[a-z0-9-~])[a-z0-9-._~]*$/;
const repoPackageNamePattern =
  /^(?:(?:@(?:[A-Za-z0-9-*~][A-Za-z0-9-*._~]*)?\/[A-Za-z0-9-._~])|[A-Za-z0-9-~])[A-Za-z0-9-._~]*$/;
const packageManagerPattern = /^(npm|pnpm|yarn|bun)@\d+\.\d+\.\d+(-.+)?$/;
const packageTypePattern = /^(module|commonjs)$/;
const relativeDotPathPattern = /^\.\//;
const exportTopLevelPattern = /^(?:\.|\.\/.+)$/;
const importSpecifierPattern = /^#.+$/;
const exportConditionPattern = /^(?:[^.0-9]+|types@.+)$/;

/**
 * Schema for npm-compatible package names.
 *
 * **Example** (Validate scoped package name)
 *
 * ```ts
 * import { NpmPackageName } from "@beep/repo-utils/schemas/PackageJson"
 * const isValid = NpmPackageName.is("@beep/example")
 * console.log(isValid)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const NpmPackageName = S.String.check(S.isMinLength(1))
  .check(S.isMaxLength(214))
  .check(S.isPattern(npmPackageNamePattern))
  .pipe(
    $I.annoteSchema("NpmPackageName", {
      title: "Npm Package Name",
      description: "An npm package name that satisfies the package.json SchemaStore constraints.",
    }),
    SchemaUtils.withCodecStatics
  );

/**
 * Schema for repository workspace package names.
 *
 * **Example** (Validate workspace package name)
 *
 * ```ts
 * import { RepoPackageName } from "@beep/repo-utils/schemas/PackageJson"
 * const isValid = RepoPackageName.is("@beep/repo-utils")
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
        "A repo-local package name, including the legacy mixed-case workspace names currently present in this monorepo.",
    }),
    SchemaUtils.withCodecStatics
  );

const PackageManager = S.String.check(S.isPattern(packageManagerPattern)).pipe(
  $I.annoteSchema("PackageManager", {
    title: "Package Manager",
    description: "A Corepack-style package manager pin such as bun@1.3.10 or pnpm@9.0.0.",
  })
);

/**
 * Schema for package.json relative dot paths.
 *
 * **Example** (Validate relative dot path)
 *
 * ```ts
 * import { RelativeDotPath } from "@beep/repo-utils/schemas/PackageJson"
 * const isPath = RelativeDotPath.is("./src/index.ts")
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
  }),
  SchemaUtils.withCodecStatics
);

const ExportTopLevelKey = S.String.check(S.isPattern(exportTopLevelPattern)).pipe(
  $I.annoteSchema("ExportTopLevelKey", {
    title: "Export Top Level Key",
    description: "A top-level package exports key such as . or ./subpath.",
  }),
  SchemaUtils.withCodecStatics
);

const ImportSpecifierKey = S.String.check(S.isPattern(importSpecifierPattern)).pipe(
  $I.annoteSchema("ImportSpecifierKey", {
    title: "Import Specifier Key",
    description: "A package imports specifier key such as #internal or #config/*.",
  }),
  SchemaUtils.withCodecStatics
);

const ExportConditionKey = S.String.check(S.isPattern(exportConditionPattern)).pipe(
  $I.annoteSchema("ExportConditionKey", {
    title: "Export Condition Key",
    description: "A conditional exports/imports key such as import, require, default, node, or types@>=5.",
  }),
  SchemaUtils.withCodecStatics
);

const StringArray = S.Array(S.String).pipe(
  $I.annoteSchema("StringArray", {
    title: "String Array",
    description: "An array of strings used for package metadata fields such as files, man, os, and cpu.",
  })
);

/**
 * Schema for non-empty package metadata strings.
 *
 * **Example** (Validate non-empty string)
 *
 * ```ts
 * import { NonEmptyStringValue } from "@beep/repo-utils/schemas/PackageJson"
 * const isNonEmpty = NonEmptyStringValue.is("catalog:")
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
  }),
  SchemaUtils.withCodecStatics
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

const StringRecord = S.Record(S.String, S.String).pipe(
  $I.annoteSchema("StringRecord", {
    title: "String Record",
    description: "A record mapping string keys to string values, used for dependency maps, scripts, and engines.",
  })
);

const NpmDependencyRecord = makeStrictStringKeyRecord(
  NpmPackageName.is,
  NonEmptyStringValue,
  "Dependency names must be valid npm package names"
).pipe(
  $I.annoteSchema("NpmDependencyRecord", {
    title: "Npm Dependency Record",
    description: "A record of npm package names to non-empty version or protocol specifiers.",
  })
);

const RepoDependencyRecord = makeStrictStringKeyRecord(
  RepoPackageName.is,
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
  NonEmptyStringValue.is,
  NonEmptyStringValue,
  "Record keys must not be empty"
).pipe(
  $I.annoteSchema("NonEmptyStringRecord", {
    title: "Non Empty String Record",
    description: "A record whose keys and values are non-empty strings.",
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

const BeepPackageFamily = LiteralKit(["foundation", "drivers", "tooling"]).pipe(
  $I.annoteSchema("BeepPackageFamily", {
    title: "Beep Package Family",
    description: "Canonical package family discriminator for repo-local package metadata.",
  })
);

class BeepFoundationMetadata extends S.Class<BeepFoundationMetadata>($I`BeepFoundationMetadata`)(
  {
    family: S.Literal("foundation"),
    kind: BeepFoundationKind,
  },
  $I.annote("BeepFoundationMetadata", {
    title: "Beep Foundation Metadata",
    description: "Repo-local package metadata for foundation packages.",
  })
) {}

class BeepDriverMetadata extends S.Class<BeepDriverMetadata>($I`BeepDriverMetadata`)(
  {
    family: S.Literal("drivers"),
  },
  $I.annote("BeepDriverMetadata", {
    title: "Beep Driver Metadata",
    description: "Repo-local package metadata for flat driver packages.",
  })
) {}

class BeepToolingMetadata extends S.Class<BeepToolingMetadata>($I`BeepToolingMetadata`)(
  {
    family: S.Literal("tooling"),
    kind: BeepToolingKind,
  },
  $I.annote("BeepToolingMetadata", {
    title: "Beep Tooling Metadata",
    description: "Repo-local package metadata for tooling packages.",
  })
) {}

const BeepPackageMetadata = BeepPackageFamily.mapMembers(
  Tuple.evolve([() => BeepFoundationMetadata, () => BeepDriverMetadata, () => BeepToolingMetadata])
).pipe(
  S.toTaggedUnion("family"),
  $I.annoteSchema("BeepPackageMetadata", {
    title: "Beep Package Metadata",
    description: "Machine-readable repo architecture metadata for non-slice code packages.",
  })
);

const PackageTypeField = S.String.check(S.isPattern(packageTypePattern)).pipe(
  $I.annoteSchema("PackageTypeField", {
    title: "Package Type Field",
    description: "The package type field constrained to the supported Node.js package types.",
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

const BrowserReplacement = S.Union([S.String, S.Literal(false)]).pipe(
  $I.annoteSchema("BrowserReplacement", {
    title: "Browser Replacement",
    description: "A browser field replacement target, either a module path string or false to disable the module.",
  })
);

class PersonObject extends S.Class<PersonObject>($I`PersonObject`)(
  {
    name: S.String,
    email: S.optionalKey(EmailString),
    url: S.optionalKey(S.String),
  },
  $I.annote("PersonObject", {
    title: "Person Object",
    description: "Structured package person metadata with a required name and optional contact fields.",
  })
) {}

class RepositoryObject extends S.Class<RepositoryObject>($I`RepositoryObject`)(
  {
    type: S.String,
    url: S.String,
    directory: S.optionalKey(S.String),
  },
  $I.annote("RepositoryObject", {
    title: "Repository Object",
    description: "Structured repository metadata with required type and url fields and an optional directory.",
  })
) {}

class BugsObject extends S.Class<BugsObject>($I`BugsObject`)(
  {
    url: S.optionalKey(S.String),
    email: S.optionalKey(EmailString),
  },
  $I.annote("BugsObject", {
    title: "Bugs Object",
    description: "Structured bug tracker metadata with optional URL and contact email fields.",
  })
) {}

class FundingEntry extends S.Class<FundingEntry>($I`FundingEntry`)(
  {
    url: S.String,
    type: S.optionalKey(S.String),
  },
  $I.annote("FundingEntry", {
    title: "Funding Entry",
    description: "Structured funding metadata with a required URL and an optional funding type label.",
  })
) {}

/**
 * A person involved with the package, represented as a string or structured object.
 *
 * **Example** (Inspect Person schema)
 *
 * ```ts
 * import { Person } from "@beep/repo-utils/schemas/PackageJson"
 * const schema = Person
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Person = S.Union([S.String, PersonObject]).pipe(
  $I.annoteSchema("Person", {
    title: "Person",
    description:
      "A package author, contributor, or maintainer, either as a string or a structured object with a required name.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * The package author field.
 *
 * **Example** (Inspect Author schema)
 *
 * ```ts
 * import { Author } from "@beep/repo-utils/schemas/PackageJson"
 * const schema = Author
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Author = Person.pipe(
  $I.annoteSchema("Author", {
    title: "Author",
    description: "Package author, either as a string or a structured object with a required name.",
  })
);

/**
 * The package contributors field.
 *
 * **Example** (Inspect Contributors schema)
 *
 * ```ts
 * import { Contributors } from "@beep/repo-utils/schemas/PackageJson"
 * const schema = Contributors
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Contributors = S.Array(Person).pipe(
  $I.annoteSchema("Contributors", {
    title: "Contributors",
    description: "A list of people who contributed to the package.",
  })
);

/**
 * The package maintainers field.
 *
 * **Example** (Inspect Maintainers schema)
 *
 * ```ts
 * import { Maintainers } from "@beep/repo-utils/schemas/PackageJson"
 * const schema = Maintainers
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Maintainers = S.Array(Person).pipe(
  $I.annoteSchema("Maintainers", {
    title: "Maintainers",
    description: "A list of people who maintain the package.",
  })
);

/**
 * Schema for the `repository` field.
 *
 * **Example** (Inspect Repository schema)
 *
 * ```ts
 * import { Repository } from "@beep/repo-utils/schemas/PackageJson"
 * const schema = Repository
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Repository = S.Union([S.String, RepositoryObject]).pipe(
  $I.annoteSchema("Repository", {
    title: "Repository",
    description:
      "A package repository reference represented as a shorthand string or a structured object with required type and url.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Schema for the `bugs` field.
 *
 * **Example** (Inspect Bugs schema)
 *
 * ```ts
 * import { Bugs } from "@beep/repo-utils/schemas/PackageJson"
 * const schema = Bugs
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Bugs = S.Union([S.String, BugsObject]).pipe(
  $I.annoteSchema("Bugs", {
    title: "Bugs",
    description:
      "A package bug tracker reference represented as a URL string or a structured object with optional url and email.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Schema for the `funding` field.
 *
 * **Example** (Inspect Funding schema)
 *
 * ```ts
 * import { Funding } from "@beep/repo-utils/schemas/PackageJson"
 * const schema = Funding
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Funding = S.Union([S.String, FundingEntry, S.NonEmptyArray(S.Union([S.String, FundingEntry]))]).pipe(
  $I.annoteSchema("Funding", {
    title: "Funding",
    description:
      "Package funding metadata represented as a URL string, a structured funding object, or a non-empty array of those.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Schema for the `bin` field.
 *
 * **Example** (Inspect Bin schema)
 *
 * ```ts
 * import { Bin } from "@beep/repo-utils/schemas/PackageJson"
 * const schema = Bin
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Bin = S.Union([S.String, StringRecord]).pipe(
  $I.annoteSchema("Bin", {
    title: "Bin",
    description: "Executable binaries, either as a single file path string or a record mapping command names to paths.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Schema for the `browser` field.
 *
 * **Example** (Inspect Browser schema)
 *
 * ```ts
 * import { Browser } from "@beep/repo-utils/schemas/PackageJson"
 * const schema = Browser
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Browser = S.Union([S.String, S.Record(S.String, BrowserReplacement)]).pipe(
  $I.annoteSchema("Browser", {
    title: "Browser",
    description:
      "Browser-specific entry points represented as a replacement path string or a record of module replacements.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Schema for the `directories` field.
 *
 * @category validation
 * @since 0.0.0
 */
class DirectoriesShape extends S.Class<DirectoriesShape>($I`Directories`)(
  {
    bin: S.optionalKey(S.String),
    doc: S.optionalKey(S.String),
    example: S.optionalKey(S.String),
    lib: S.optionalKey(S.String),
    man: S.optionalKey(S.String),
    test: S.optionalKey(S.String),
  },
  $I.annote("Directories", {
    title: "Directories",
    description: "Directory metadata describing where package resources such as binaries, docs, and tests live.",
  })
) {}

/**
 * Schema for the `directories` field.
 *
 * **Example** (Inspect Directories schema)
 *
 * ```ts
 * import { Directories } from "@beep/repo-utils/schemas/PackageJson"
 * const schema = Directories
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Directories = DirectoriesShape;

const PeerDependencyMetaEntry = S.Struct({
  optional: S.optionalKey(S.Boolean),
}).pipe(
  $I.annoteSchema("PeerDependencyMetaEntry", {
    title: "Peer Dependency Meta Entry",
    description: "Structured metadata for a peer dependency, including whether it is optional.",
  })
);

/**
 * Schema for the `man` field.
 *
 * **Example** (Inspect Man schema)
 *
 * ```ts
 * import { Man } from "@beep/repo-utils/schemas/PackageJson"
 * const schema = Man
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Man = S.Union([S.String, StringArray]).pipe(
  $I.annoteSchema("Man", {
    title: "Man",
    description: "A man page reference represented as a single file path or an array of file paths.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Schema for the `sideEffects` field.
 *
 * **Example** (Inspect SideEffects schema)
 *
 * ```ts
 * import { SideEffects } from "@beep/repo-utils/schemas/PackageJson"
 * const schema = SideEffects
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const SideEffects = S.Union([S.Boolean, StringArray]).pipe(
  $I.annoteSchema("SideEffects", {
    title: "Side Effects",
    description: "Whether the package has side effects, represented as a boolean or an array of glob patterns.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Schema for the `bundleDependencies` / `bundledDependencies` fields.
 *
 * **Example** (Inspect BundleDependencies schema)
 *
 * ```ts
 * import { BundleDependencies } from "@beep/repo-utils/schemas/PackageJson"
 * const schema = BundleDependencies
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const BundleDependencies = S.Union([S.Boolean, StringArray]).pipe(
  $I.annoteSchema("BundleDependencies", {
    title: "Bundle Dependencies",
    description: "Bundled dependency metadata represented as a boolean or an array of package names.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Schema for the `peerDependenciesMeta` field.
 *
 * **Example** (Inspect PeerDependenciesMeta schema)
 *
 * ```ts
 * import { PeerDependenciesMeta } from "@beep/repo-utils/schemas/PackageJson"
 * const schema = PeerDependenciesMeta
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const PeerDependenciesMeta = S.Record(
  S.String,
  S.StructWithRest(PeerDependencyMetaEntry, [S.Record(S.String, Json)])
).pipe(
  $I.annoteSchema("PeerDependenciesMeta", {
    title: "Peer Dependencies Meta",
    description: "Metadata describing peer dependency usage, including whether a peer dependency is optional.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Schema for the `typesVersions` field.
 *
 * **Example** (Inspect TypesVersions schema)
 *
 * ```ts
 * import { TypesVersions } from "@beep/repo-utils/schemas/PackageJson"
 * const schema = TypesVersions
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const TypesVersions = S.Record(S.String, S.Record(S.String, StringArray)).pipe(
  $I.annoteSchema("TypesVersions", {
    title: "Types Versions",
    description: "TypeScript version-specific path mappings for declarations.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Schema for a development environment requirement entry.
 *
 * @category validation
 * @since 0.0.0
 */
class DevEngineDependencyShape extends S.Class<DevEngineDependencyShape>($I`DevEngineDependency`)(
  {
    name: S.String,
    version: S.optionalKey(S.String),
    onFail: S.optionalKey(S.Literals(["ignore", "warn", "error", "download"] as const)),
  },
  $I.annote("DevEngineDependency", {
    title: "Dev Engine Dependency",
    description:
      "A development environment requirement such as a runtime, package manager, CPU, OS, or libc constraint.",
  })
) {}

/**
 * Schema for a development environment requirement entry.
 *
 * **Example** (Inspect DevEngineDependency schema)
 *
 * ```ts
 * import { DevEngineDependency } from "@beep/repo-utils/schemas/PackageJson"
 * const schema = DevEngineDependency
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const DevEngineDependency = DevEngineDependencyShape;

const DevEngineRequirement = S.Union([DevEngineDependency, S.Array(DevEngineDependency)]).pipe(
  $I.annoteSchema("DevEngineRequirement", {
    title: "Dev Engine Requirement",
    description:
      "A development environment requirement represented as a single dependency entry or an array of dependency entries.",
  })
);

const OptionalDevEngineRequirement = S.optionalKey(DevEngineRequirement);

/**
 * Schema for the `devEngines` field.
 *
 * @category validation
 * @since 0.0.0
 */
class DevEnginesShape extends S.Class<DevEnginesShape>($I`DevEngines`)(
  {
    os: OptionalDevEngineRequirement,
    cpu: OptionalDevEngineRequirement,
    libc: OptionalDevEngineRequirement,
    runtime: OptionalDevEngineRequirement,
    packageManager: OptionalDevEngineRequirement,
  },
  $I.annote("DevEngines", {
    title: "Dev Engines",
    description: "Development environment constraints for OS, CPU, libc, runtime, and package manager.",
  })
) {}

/**
 * Schema for the `devEngines` field.
 *
 * **Example** (Inspect DevEngines schema)
 *
 * ```ts
 * import { DevEngines } from "@beep/repo-utils/schemas/PackageJson"
 * const schema = DevEngines
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const DevEngines = DevEnginesShape;

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
    ExportConditionKey.is,
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
  ExportTopLevelKey.is,
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
  }),
  SchemaUtils.withCodecStatics
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
    ExportConditionKey.is,
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
  ImportSpecifierKey.is,
  PackageImportsEntryOrFallback,
  "Package imports keys must start with #"
).pipe(
  $I.annoteSchema("PackageImports", {
    title: "Package Imports",
    description: "Private package import mappings keyed by # specifiers.",
  }),
  SchemaUtils.withCodecStatics
);

type OverrideValue = string | { readonly [key: string]: OverrideValue };

const OverrideValue: S.Codec<OverrideValue, OverrideValue> = S.suspend(() =>
  S.Union([S.String, S.Record(S.String, OverrideValue)])
).pipe(
  $I.annoteSchema("OverrideValue", {
    title: "Override Value",
    description: "An npm overrides value represented as a version string or a nested override object.",
  })
);

class WorkspacesObject extends S.Class<WorkspacesObject>($I`WorkspacesObject`)(
  {
    packages: S.optionalKey(StringArray),
    nohoist: S.optionalKey(StringArray),
  },
  $I.annote("WorkspacesObject", {
    title: "Workspaces Object",
    description: "A Yarn-style workspaces object with package globs and optional nohoist rules.",
  })
) {}

const PublishConfigBin = Bin.annotate({ identifier: $I`PublishConfigBin` });
const PublishConfigPackageExports = PackageExports.annotate({
  identifier: $I`PublishConfigPackageExports`,
});

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
 * Schema for the `workspaces` field.
 *
 * **Example** (Inspect Workspaces schema)
 *
 * ```ts
 * import { Workspaces } from "@beep/repo-utils/schemas/PackageJson"
 * const schema = Workspaces
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Workspaces = S.Union([StringArray, WorkspacesObject]).pipe(
  $I.annoteSchema("Workspaces", {
    title: "Workspaces",
    description:
      "Workspace package globs represented as an array of strings or an object with packages and optional nohoist.",
  }),
  SchemaUtils.withCodecStatics
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
  }),
  SchemaUtils.withCodecStatics
);

const npmPackageJsonFields = {
  name: NpmPackageName,
  version: S.OptionFromOptionalKey(S.String),
  description: S.OptionFromOptionalKey(S.String),
  keywords: S.OptionFromOptionalKey(StringArray),
  homepage: S.OptionFromOptionalKey(S.String),
  bugs: S.OptionFromOptionalKey(Bugs),
  license: S.OptionFromOptionalKey(S.String),
  author: S.OptionFromOptionalKey(Author),
  contributors: S.OptionFromOptionalKey(Contributors),
  maintainers: S.OptionFromOptionalKey(Maintainers),
  funding: S.OptionFromOptionalKey(Funding),
  files: S.OptionFromOptionalKey(StringArray),
  exports: S.OptionFromOptionalKey(PackageExports),
  imports: S.OptionFromOptionalKey(PackageImports),
  main: S.OptionFromOptionalKey(S.String),
  module: S.OptionFromOptionalKey(S.String),
  browser: S.OptionFromOptionalKey(Browser),
  bin: S.OptionFromOptionalKey(Bin),
  man: S.OptionFromOptionalKey(Man),
  directories: S.OptionFromOptionalKey(Directories),
  repository: S.OptionFromOptionalKey(Repository),
  scripts: S.OptionFromOptionalKey(NonEmptyStringRecord),
  config: S.OptionFromOptionalKey(S.Record(S.String, Json)),
  dependencies: S.OptionFromOptionalKey(NpmDependencyRecord),
  devDependencies: S.OptionFromOptionalKey(NpmDependencyRecord),
  peerDependencies: S.OptionFromOptionalKey(NpmDependencyRecord),
  peerDependenciesMeta: S.OptionFromOptionalKey(PeerDependenciesMeta),
  bundleDependencies: S.OptionFromOptionalKey(BundleDependencies),
  bundledDependencies: S.OptionFromOptionalKey(BundleDependencies),
  optionalDependencies: S.OptionFromOptionalKey(NpmDependencyRecord),
  overrides: S.OptionFromOptionalKey(S.Record(S.String, OverrideValue)),
  engines: S.OptionFromOptionalKey(NonEmptyStringRecord),
  engineStrict: S.OptionFromOptionalKey(S.Boolean),
  os: S.OptionFromOptionalKey(StringArray),
  cpu: S.OptionFromOptionalKey(StringArray),
  libc: S.OptionFromOptionalKey(StringArray),
  devEngines: S.OptionFromOptionalKey(DevEngines),
  private: S.OptionFromOptionalKey(S.Boolean),
  publishConfig: S.OptionFromOptionalKey(PublishConfig),
  preferGlobal: S.OptionFromOptionalKey(S.Boolean),
  workspaces: S.OptionFromOptionalKey(Workspaces),
  packageManager: S.OptionFromOptionalKey(PackageManager),
  sideEffects: S.OptionFromOptionalKey(SideEffects),
  types: S.OptionFromOptionalKey(S.String),
  typings: S.OptionFromOptionalKey(S.String),
  type: S.OptionFromOptionalKey(PackageTypeField),
  typesVersions: S.OptionFromOptionalKey(TypesVersions),
  resolutions: S.OptionFromOptionalKey(StringRecord),
  patchedDependencies: S.OptionFromOptionalKey(NonEmptyStringRecord),
  trustedDependencies: S.OptionFromOptionalKey(StringArray),
  readme: S.OptionFromOptionalKey(S.String),
} as const;

const packageJsonFields = {
  ...npmPackageJsonFields,
  name: RepoPackageName,
  dependencies: S.OptionFromOptionalKey(RepoDependencyRecord),
  devDependencies: S.OptionFromOptionalKey(RepoDependencyRecord),
  peerDependencies: S.OptionFromOptionalKey(RepoDependencyRecord),
  optionalDependencies: S.OptionFromOptionalKey(RepoDependencyRecord),
  catalog: S.OptionFromOptionalKey(RepoDependencyRecord),
  beep: S.OptionFromOptionalKey(BeepPackageMetadata),
  "resolutions#": S.OptionFromOptionalKey(NonEmptyStringRecord),
} as const;

/**
 * Type-safe schema for npm package.json files.
 *
 * **Details**
 *
 * Unexpected keys are rejected by the exported decode helpers.
 *
 * **Example** (Inspect NpmPackageJson schema)
 *
 * ```ts
 * import { NpmPackageJson } from "@beep/repo-utils/schemas/PackageJson"
 * const schema = NpmPackageJson
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class NpmPackageJson extends S.Class<NpmPackageJson>($I`NpmPackageJson`)(
  npmPackageJsonFields,
  $I.annote("NpmPackageJson", {
    description: "A strict npm-oriented package.json schema derived from SchemaStore and npm documentation.",
    messageUnexpectedKey: "Unexpected package.json key",
  })
) {}

/**
 * Type-safe schema for this repo's package.json files.
 *
 * **Details**
 *
 * Extends the npm surface with repo-local metadata fields used by the monorepo.
 *
 * **Example** (Inspect PackageJson schema)
 *
 * ```ts
 * import { PackageJson } from "@beep/repo-utils/schemas/PackageJson"
 * const schema = PackageJson
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class PackageJson extends S.Class<PackageJson>($I`PackageJson`)(
  packageJsonFields,
  $I.annote("PackageJson", {
    description: "A strict repo-aware package.json schema that extends the npm surface with monorepo-only metadata.",
    messageUnexpectedKey: "Unexpected package.json key",
  })
) {
  /**
   * Decode an unknown strict package.json value into a Result.
   *
   * **Example** (Decode to Result)
   *
   * ```ts
   * import { PackageJson } from "@beep/repo-utils/schemas/PackageJson"
   * const result = PackageJson.decodeStrictResult({ name: "@beep/example" })
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
   * const exit = PackageJson.decodeStrictExit({ name: "@beep/example" })
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
   * const effect = PackageJson.decodeStrictEffect({ name: "@beep/example" })
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
}

/**
 * Namespace helpers for the strict npm package-json schema.
 *
 * **Example** (Read typed package name)
 *
 * ```ts
 * import type { NpmPackageJson } from "@beep/repo-utils/schemas/PackageJson"
 * const readName = (value: NpmPackageJson.Type) => value.name
 * console.log(readName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace NpmPackageJson {
  /**
   * Decoded runtime type for {@link NpmPackageJson}.
   *
   * @category models
   * @since 0.0.0
   */
  export type Type = S.Schema.Type<typeof NpmPackageJson>;
  /**
   * Encoded representation for {@link NpmPackageJson}.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = S.Codec.Encoded<typeof NpmPackageJson>;
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
  export type Type = S.Schema.Type<typeof PackageJson>;
  /**
   * Encoded representation for {@link PackageJson}.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = S.Codec.Encoded<typeof PackageJson>;
}

/**
 * Runtime type for {@link NpmPackageName}.
 *
 * **Example** (Accept NpmPackageName type)
 *
 * ```ts
 * import type { NpmPackageName } from "@beep/repo-utils/schemas/PackageJson"
 * const acceptPackageName = (_value: NpmPackageName) => undefined
 * console.log(acceptPackageName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NpmPackageName = (typeof NpmPackageName)["Type"];
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
 * Runtime type for {@link Person}.
 *
 * **Example** (Accept Person type)
 *
 * ```ts
 * import type { Person } from "@beep/repo-utils/schemas/PackageJson"
 * const acceptPerson = (_value: Person) => undefined
 * console.log(acceptPerson)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Person = (typeof Person)["Type"];
/**
 * Runtime type for {@link Author}.
 *
 * **Example** (Accept Author type)
 *
 * ```ts
 * import type { Author } from "@beep/repo-utils/schemas/PackageJson"
 * const acceptAuthor = (_value: Author) => undefined
 * console.log(acceptAuthor)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Author = (typeof Author)["Type"];
/**
 * Runtime type for {@link Contributors}.
 *
 * **Example** (Accept Contributors type)
 *
 * ```ts
 * import type { Contributors } from "@beep/repo-utils/schemas/PackageJson"
 * const acceptContributors = (_value: Contributors) => undefined
 * console.log(acceptContributors)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Contributors = (typeof Contributors)["Type"];
/**
 * Runtime type for {@link Maintainers}.
 *
 * **Example** (Accept Maintainers type)
 *
 * ```ts
 * import type { Maintainers } from "@beep/repo-utils/schemas/PackageJson"
 * const acceptMaintainers = (_value: Maintainers) => undefined
 * console.log(acceptMaintainers)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Maintainers = (typeof Maintainers)["Type"];
/**
 * Runtime type for {@link Repository}.
 *
 * **Example** (Accept Repository type)
 *
 * ```ts
 * import type { Repository } from "@beep/repo-utils/schemas/PackageJson"
 * const acceptRepository = (_value: Repository) => undefined
 * console.log(acceptRepository)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Repository = (typeof Repository)["Type"];
/**
 * Runtime type for {@link Bugs}.
 *
 * **Example** (Accept Bugs type)
 *
 * ```ts
 * import type { Bugs } from "@beep/repo-utils/schemas/PackageJson"
 * const acceptBugs = (_value: Bugs) => undefined
 * console.log(acceptBugs)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Bugs = (typeof Bugs)["Type"];
/**
 * Runtime type for {@link Funding}.
 *
 * **Example** (Accept Funding type)
 *
 * ```ts
 * import type { Funding } from "@beep/repo-utils/schemas/PackageJson"
 * const acceptFunding = (_value: Funding) => undefined
 * console.log(acceptFunding)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Funding = (typeof Funding)["Type"];
/**
 * Runtime type for {@link Bin}.
 *
 * **Example** (Accept Bin type)
 *
 * ```ts
 * import type { Bin } from "@beep/repo-utils/schemas/PackageJson"
 * const acceptBin = (_value: Bin) => undefined
 * console.log(acceptBin)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Bin = (typeof Bin)["Type"];
/**
 * Runtime type for {@link Browser}.
 *
 * **Example** (Accept Browser type)
 *
 * ```ts
 * import type { Browser } from "@beep/repo-utils/schemas/PackageJson"
 * const acceptBrowser = (_value: Browser) => undefined
 * console.log(acceptBrowser)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Browser = (typeof Browser)["Type"];
/**
 * Runtime type for {@link Directories}.
 *
 * **Example** (Accept Directories type)
 *
 * ```ts
 * import type { Directories } from "@beep/repo-utils/schemas/PackageJson"
 * const acceptDirectories = (_value: Directories) => undefined
 * console.log(acceptDirectories)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Directories = (typeof Directories)["Type"];
/**
 * Runtime type for {@link Man}.
 *
 * **Example** (Accept Man type)
 *
 * ```ts
 * import type { Man } from "@beep/repo-utils/schemas/PackageJson"
 * const acceptMan = (_value: Man) => undefined
 * console.log(acceptMan)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Man = (typeof Man)["Type"];
/**
 * Runtime type for {@link SideEffects}.
 *
 * **Example** (Accept SideEffects type)
 *
 * ```ts
 * import type { SideEffects } from "@beep/repo-utils/schemas/PackageJson"
 * const acceptSideEffects = (_value: SideEffects) => undefined
 * console.log(acceptSideEffects)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SideEffects = (typeof SideEffects)["Type"];
/**
 * Runtime type for {@link BundleDependencies}.
 *
 * **Example** (Accept BundleDependencies type)
 *
 * ```ts
 * import type { BundleDependencies } from "@beep/repo-utils/schemas/PackageJson"
 * const acceptBundleDependencies = (_value: BundleDependencies) => undefined
 * console.log(acceptBundleDependencies)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BundleDependencies = (typeof BundleDependencies)["Type"];
/**
 * Runtime type for {@link PeerDependenciesMeta}.
 *
 * **Example** (Accept PeerDependenciesMeta type)
 *
 * ```ts
 * import type { PeerDependenciesMeta } from "@beep/repo-utils/schemas/PackageJson"
 * const acceptPeerDependenciesMeta = (_value: PeerDependenciesMeta) => undefined
 * console.log(acceptPeerDependenciesMeta)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PeerDependenciesMeta = (typeof PeerDependenciesMeta)["Type"];
/**
 * Runtime type for {@link TypesVersions}.
 *
 * **Example** (Accept TypesVersions type)
 *
 * ```ts
 * import type { TypesVersions } from "@beep/repo-utils/schemas/PackageJson"
 * const acceptTypesVersions = (_value: TypesVersions) => undefined
 * console.log(acceptTypesVersions)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TypesVersions = (typeof TypesVersions)["Type"];
/**
 * Runtime type for {@link DevEngineDependency}.
 *
 * **Example** (Accept DevEngineDependency type)
 *
 * ```ts
 * import type { DevEngineDependency } from "@beep/repo-utils/schemas/PackageJson"
 * const acceptDevEngineDependency = (_value: DevEngineDependency) => undefined
 * console.log(acceptDevEngineDependency)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DevEngineDependency = (typeof DevEngineDependency)["Type"];
/**
 * Runtime type for {@link DevEngines}.
 *
 * **Example** (Accept DevEngines type)
 *
 * ```ts
 * import type { DevEngines } from "@beep/repo-utils/schemas/PackageJson"
 * const acceptDevEngines = (_value: DevEngines) => undefined
 * console.log(acceptDevEngines)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DevEngines = (typeof DevEngines)["Type"];
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
 * Runtime type for {@link Workspaces}.
 *
 * **Example** (Accept Workspaces type)
 *
 * ```ts
 * import type { Workspaces } from "@beep/repo-utils/schemas/PackageJson"
 * const acceptWorkspaces = (_value: Workspaces) => undefined
 * console.log(acceptWorkspaces)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Workspaces = (typeof Workspaces)["Type"];
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
 * import { Effect } from "effect"
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
 * **Example** (Encode package.json Effect)
 *
 * ```ts
 * import { Effect } from "effect"
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
 * import { Effect } from "effect"
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
 * import { Effect } from "effect"
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
 * import { Effect } from "effect"
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
