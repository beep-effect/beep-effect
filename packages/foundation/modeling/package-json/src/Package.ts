/**
 * The core `Package` model: a rich `Schema.Class` for a package.json document
 * with computed getters, dual-signature immutable-mutation statics, a
 * derived-patch `copyWith`, the `rest` catch-all with its wire transform /
 * `.extend()` story (`Package.schema`, `Package.wireFor`), the pure
 * `Package.toJsonString` serializer, and `Package.resolve` over the
 * `@beep/npm-spec` resolver contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PackageJsonId } from "@beep/identity/packages";
import { CatalogResolver } from "@beep/npm-spec/CatalogResolver";
import { DependencySpecifier } from "@beep/npm-spec/DependencySpecifier";
import { WorkspaceResolver } from "@beep/npm-spec/WorkspaceResolver";
import { SemVer } from "@beep/semver";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Fn from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { Dependency } from "./Dependency.ts";
import { DevEnginesSchema } from "./DevEngines.ts";
import { Funding } from "./Funding.ts";
import { renderJson, resolveFormatOptions } from "./internal/format.ts";
import { makeWire } from "./internal/wire.ts";
import { InvalidSpdxLicenseError, SpdxLicense } from "./License.ts";
import {
  BooleanOrStringListField,
  BrowserField,
  ManField,
  OpenRecordField,
  OverridesField,
  StringListField,
  StringRecordField,
  TypesVersionsField,
  WorkspacesField,
} from "./ManifestFields.ts";
import { PackageManager } from "./PackageManager.ts";
import { InvalidPackageNameError, PackageName } from "./PackageName.ts";
import { Person } from "./Person.ts";
import { Bugs, Repository } from "./Repository.ts";
import type { InvalidVersionError } from "@beep/semver";

const $I = $PackageJsonId.create("Package");

const toHashMap = SchemaTransformation.transform({
  decode: (record: { readonly [x: string]: string }) => HashMap.fromIterable(R.toEntries(record)),
  encode: (map: HashMap.HashMap<string, string>) => map.pipe(HashMap.toEntries, R.fromEntries),
});

/**
 * A string→string map field decoding a plain JSON object to a `HashMap`,
 * defaulting to an empty map when the key is absent. Backs the four dependency
 * maps and `scripts`. Not meant to be referenced directly.
 *
 * **Example** (Decode a dependency map)
 *
 * ```ts
 * import { DependencyMapField } from "@beep/package-json/Package";
 * import * as S from "effect/Schema";
 * import * as HashMap from "effect/HashMap";
 *
 * console.log(HashMap.size(S.decodeUnknownSync(DependencyMapField)({ effect: "^4.0.0" }))); // 1
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const DependencyMapField = S.Record(S.String, S.String).pipe(
  S.withDecodingDefaultKey(Effect.succeed<{ readonly [x: string]: string }>({})),
  S.decodeTo(S.HashMap(S.String, S.String), toHashMap),
  $I.annoteSchema("DependencyMapField", {
    description: "A string-to-string map decoded to a HashMap, defaulting to an empty map when absent.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type DependencyMapField = typeof DependencyMapField.Type;

/**
 * A string→string map field decoding a plain JSON object to a `HashMap`,
 * with no default (an absent key stays absent). Backs `engines`. Not meant to
 * be referenced directly.
 *
 * **Example** (Decode engine constraints)
 *
 * ```ts
 * import { StringMapField } from "@beep/package-json/Package";
 * import * as S from "effect/Schema";
 * import * as HashMap from "effect/HashMap";
 *
 * console.log(HashMap.size(S.decodeUnknownSync(StringMapField)({ node: ">=22" }))); // 1
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const StringMapField = S.Record(S.String, S.String).pipe(
  S.decodeTo(S.HashMap(S.String, S.String), toHashMap),
  $I.annoteSchema("StringMapField", {
    description: "A string-to-string map decoded to a HashMap, with no default for an absent key.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type StringMapField = typeof StringMapField.Type;

/**
 * **Example** (Decode a single executable path)
 *
 * ```ts
 * import { BinField } from "@beep/package-json/Package";
 * import * as S from "effect/Schema";
 *
 * console.log(S.decodeUnknownSync(BinField)("./cli.js")); // ./cli.js
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const BinField = S.Union([S.String, StringMapField]).pipe(
  $I.annoteSchema("BinField", {
    description: "The `bin` field: a single string path or a name→path map. Not meant to be referenced directly.",
  })
);

/**
 * Decoded value produced by {@link BinField}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BinField = typeof BinField.Type;

/**
 * **Example** (Decode a root entry point)
 *
 * ```ts
 * import { ExportsField } from "@beep/package-json/Package";
 * import * as S from "effect/Schema";
 *
 * console.log(S.decodeUnknownSync(ExportsField)("./index.js")); // ./index.js
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ExportsField = S.Union([S.String, S.Record(S.String, S.Unknown)]).pipe(
  $I.annoteSchema("ExportsField", {
    description:
      "The `exports` field: a single string entry point or an open object of conditional exports. Not meant to be referenced directly.",
  })
);

/**
 * Decoded value produced by {@link ExportsField}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExportsField = typeof ExportsField.Type;

/**
 * The `publishConfig` field: an open record preserving known npm keys
 * (`access`, `directory`, ...) plus extensions like `targets`. Not meant to be
 * referenced directly.
 *
 * **Example** (Keep a publication setting)
 *
 * ```ts
 * import { PublishConfigField } from "@beep/package-json/Package";
 * import * as S from "effect/Schema";
 *
 * console.log(S.decodeUnknownSync(PublishConfigField)({ access: "public" }).access); // public
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const PublishConfigField = S.Record(S.String, S.Unknown).pipe(
  $I.annoteSchema("PublishConfigField", {
    description: "An open publishConfig record preserving npm keys and extensions.",
  })
);

/**
 * Decoded value produced by {@link PublishConfigField}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PublishConfigField = typeof PublishConfigField.Type;

/**
 * **Example** (Construct optional peer metadata)
 *
 * ```ts
 * import { PeerDependencyMeta } from "@beep/package-json/Package";
 *
 * const meta = PeerDependencyMeta.make({ optional: true });
 * console.log(meta.optional); // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class PeerDependencyMeta extends S.Opaque<PeerDependencyMeta, { readonly brand: unique symbol }>()(
  S.Struct({
    optional: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("PeerDependencyMeta.optional", {
        description: "Whether the peer dependency is optional: an absent peer is then not reported as missing.",
      })
    ),
  }).pipe(
    $I.annoteSchema("PeerDependencyMeta", {
      description: "One `peerDependenciesMeta` entry: metadata for a single peer dependency.",
    })
  )
) {}

/**
 * The `peerDependenciesMeta` field: a map of package name to `{ optional? }`.
 * Not meant to be referenced directly.
 *
 * **Example** (Decode optional peer metadata)
 *
 * ```ts
 * import { PeerDependenciesMetaField } from "@beep/package-json/Package";
 * import * as S from "effect/Schema";
 *
 * console.log(S.decodeUnknownSync(PeerDependenciesMetaField)({ effect: { optional: true } }).effect?.optional); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const PeerDependenciesMetaField = S.Record(S.String, PeerDependencyMeta).pipe(
  $I.annoteSchema("PeerDependenciesMetaField", {
    description: "A map of peer dependency names to metadata with an optional boolean flag.",
  })
);

/**
 * Decoded value produced by {@link PeerDependenciesMetaField}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PeerDependenciesMetaField = typeof PeerDependenciesMetaField.Type;

/**
 * **Details**
 *
 * Raised by {@link Package.decode}. The underlying `SchemaError` is preserved on
 * the structured `cause` field (never stringified), so callers keep the issue
 * tree for diagnostics.
 *
 * **Example** (Inspect a decode failure)
 *
 * ```ts
 * import { PackageDecodeError } from "@beep/package-json/Package";
 *
 * const error = PackageDecodeError.make({ cause: new Error("Invalid input") });
 * console.log(error.message); // Failed to decode package.json
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class PackageDecodeError extends S.TaggedError<PackageDecodeError, { readonly brand: unique symbol }>(
  $I`PackageDecodeError`
)(
  "PackageDecodeError",
  {
    /** The underlying `SchemaError`, preserved structurally rather than stringified. */
    cause: S.Defect().pipe(
      $I.annoteKey("PackageDecodeError.cause", {
        description: "The underlying `SchemaError`, preserved structurally rather than stringified.",
      })
    ),
  },
  $I.annoteError<PackageDecodeError>("PackageDecodeError", {
    description: "Indicates that a JSON value could not be decoded into a valid Package.",
  })
) {
  /**
   * Provides the diagnostic summary for a failed package.json decode.
   *
   * **Example** (Read the decode error summary)
   *
   * ```ts
   * import { PackageDecodeError } from "@beep/package-json/Package";
   *
   * const error = PackageDecodeError.make({ cause: new Error("Invalid input") });
   * console.log(error.message); // Failed to decode package.json
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return "Failed to decode package.json";
  }

  /**
   * Decode an unknown JSON value through a manifest codec, normalizing schema
   * failures to a {@link PackageDecodeError} at the boundary. The one decode
   * route behind `Package.decode` and `PackageManifest.decode`.
   *
   * **Example** (Decode through a manifest codec)
   *
   * ```ts
   * import { Package, PackageDecodeError } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   *
   * const pkg = Effect.runSync(PackageDecodeError.decodeUnknown(Package.schema)({ name: "my-pkg", version: "1.0.0" }));
   * console.log(pkg.name); // my-pkg
   * ```
   *
   * @param schema - the manifest codec to decode through
   * @returns a function from the raw JSON value to the decoded manifest
   * @category decoding
   * @since 0.0.0
   */
  static decodeUnknown<A, I>(schema: S.Codec<A, I>): (input: unknown) => Effect.Effect<A, PackageDecodeError> {
    const decode = S.decodeUnknownEffect(schema);
    return (input) => decode(input).pipe(Effect.mapError((cause) => PackageDecodeError.make({ cause })));
  }
}

const PackageIndentSchema = S.Union([S.Finite, S.Literals(["tab", "preserve"])]);

/**
 * Indentation for serialized package.json output: a spaces count, `"tab"` for
 * real tab indentation, or `"preserve"` to reuse the indentation detected from
 * the original source text (falling back to the two-space default when no
 * source text is available).
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type PackageIndent = typeof PackageIndentSchema.Type;

/**
 * **Details**
 *
 * `sourceText` backs `indent: "preserve"`: its indentation (tab vs N spaces,
 * detected from the first indented line) is reused, and it is ignored for
 * other `indent` values. When absent, `PackageJsonFile.write` supplies the
 * existing file's text automatically; the pure {@link Package.toJsonString}
 * falls back to the default indentation.
 *
 * **Example** (Construct formatting options)
 *
 * ```ts
 * import { PackageFormatOptions } from "@beep/package-json/Package";
 *
 * const options = PackageFormatOptions.make({ indent: "tab", sort: false });
 * console.log(options.indent); // tab
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class PackageFormatOptions extends S.Opaque<PackageFormatOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    indent: S.optionalKey(PackageIndentSchema).pipe(
      $I.annoteKey("PackageFormatOptions.indent", {
        description: 'Indentation: a spaces count, `"tab"`, or `"preserve"` (default `2`).',
      })
    ),
    newline: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("PackageFormatOptions.newline", { description: "Append a trailing newline (default `true`)." })
    ),
    sort: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("PackageFormatOptions.sort", {
        description: "Order top-level keys canonically and alphabetize dependency maps (default `true`).",
      })
    ),
    sourceText: S.optionalKey(S.String).pipe(
      $I.annoteKey("PackageFormatOptions.sourceText", {
        description: 'The original source text whose indentation `indent: "preserve"` reuses.',
      })
    ),
    stripEmpty: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("PackageFormatOptions.stripEmpty", {
        description: "Strip empty dependency-map keys (default `true`).",
      })
    ),
  }).pipe(
    $I.annoteSchema("PackageFormatOptions", {
      description: "Options for Package.toJsonString and PackageJsonFile.write: indent, newline, sort and stripEmpty.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PackageFormatOptions {
  /**
   * The plain options object the serializers accept: a constructed
   * {@link PackageFormatOptions} or an object literal with the same fields.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PackageFormatOptions.Encoded;
}

/**
 * A patch over {@link Package}'s modeled fields — every field optional,
 * derived from the schema so it never drifts from the model.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type PackagePatch = Partial<{
  readonly [K in keyof (typeof Package)["fields"]]: (typeof Package)["fields"][K]["Type"];
}>;

type StringMapKey = "dependencies" | "devDependencies" | "peerDependencies" | "optionalDependencies" | "scripts";

const mapEntrySetter = (
  key: StringMapKey
): {
  (name: string, value: string): (pkg: Package) => Package;
  (pkg: Package, name: string, value: string): Package;
} =>
  Fn.dual(3, (pkg: Package, name: string, value: string) =>
    pkg.copyWith(R.singleton(key, HashMap.set(pkg[key], name, value)))
  );

const mapEntryRemover = (
  key: StringMapKey
): {
  (name: string): (pkg: Package) => Package;
  (pkg: Package, name: string): Package;
} => Fn.dual(2, (pkg: Package, name: string) => pkg.copyWith(R.singleton(key, HashMap.remove(pkg[key], name))));

/**
 * **Example** (Update a package version and serialize the result)
 *
 * ```ts
 * import { Package } from "@beep/package-json/Package";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const pkg = yield* Package.decode({ name: "my-pkg", version: "1.0.0" });
 *   const next = yield* Package.setVersion(pkg, "1.1.0");
 *   return next.toJsonString();
 * });
 * console.log(Effect.runSync(program).includes('"version": "1.1.0"')); // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Package extends S.Class<Package, { readonly brand: unique symbol }>($I`Package`)(
  {
    name: PackageName.pipe(
      $I.annoteKey("Package.name", {
        description: "Package identifier satisfying npm naming rules, with an optional `@scope/` prefix",
      })
    ),
    version: SemVer.FromString.pipe(
      $I.annoteKey("Package.version", {
        description: "Package release version validated against strict semantic versioning",
      })
    ),
    description: S.optionalKey(S.String).pipe(
      $I.annoteKey("Package.description", { description: "Human-readable summary of the package's purpose" })
    ),
    private: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("Package.private", {
        description: "Whether the manifest marks the package as private, treated as false when absent",
      })
    ),
    type: S.optionalKey(S.Literals(["module", "commonjs"])).pipe(
      $I.annoteKey("Package.type", {
        description: "Module interpretation for JavaScript files in the package: `module` or `commonjs`",
      })
    ),
    main: S.optionalKey(S.String).pipe(
      $I.annoteKey("Package.main", {
        description: "Legacy root entry-point path, consulted by the resolver only when `exports` is absent",
      })
    ),
    license: S.optionalKey(SpdxLicense).pipe(
      $I.annoteKey("Package.license", {
        description:
          "Package licensing declaration: an SPDX identifier or expression, `UNLICENSED`, or `SEE LICENSE IN <file>`",
      })
    ),
    author: S.optionalKey(Person.FromValue).pipe(
      $I.annoteKey("Package.author", {
        description: "Primary author information decoded from a person object or `Name <email> (url)` shorthand",
      })
    ),
    contributors: Person.FromValue.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("Package.contributors", {
        description: "People credited with contributions, decoded from person objects or shorthand strings",
      })
    ),
    maintainers: Person.FromValue.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("Package.maintainers", {
        description: "People listed as package maintainers, decoded from person objects or shorthand strings",
      })
    ),
    keywords: S.String.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("Package.keywords", { description: "Terms describing the package for discovery and search" })
    ),
    repository: S.optionalKey(Repository.FromValue).pipe(
      $I.annoteKey("Package.repository", {
        description:
          "Source repository reference, preserving its original shorthand or object form and any monorepo subdirectory",
      })
    ),
    bugs: S.optionalKey(Bugs.FromValue).pipe(
      $I.annoteKey("Package.bugs", {
        description: "Issue-reporting destination, carrying an issue-tracker URL, contact email, or both",
      })
    ),
    funding: S.optionalKey(Funding.FromField).pipe(
      $I.annoteKey("Package.funding", {
        description:
          "Financial support destinations, decoded to an array while preserving the original field and entry forms on encode",
      })
    ),
    homepage: S.optionalKey(S.String).pipe(
      $I.annoteKey("Package.homepage", { description: "Address of the package's homepage" })
    ),
    dependencies: DependencyMapField.pipe(
      $I.annoteKey("Package.dependencies", {
        description: "Production dependency specifiers keyed by package name, defaulting to an empty map",
      })
    ),
    devDependencies: DependencyMapField.pipe(
      $I.annoteKey("Package.devDependencies", {
        description: "Development dependency specifiers keyed by package name, defaulting to an empty map",
      })
    ),
    peerDependencies: DependencyMapField.pipe(
      $I.annoteKey("Package.peerDependencies", {
        description: "Peer dependency specifiers keyed by package name, defaulting to an empty map",
      })
    ),
    optionalDependencies: DependencyMapField.pipe(
      $I.annoteKey("Package.optionalDependencies", {
        description: "Optional dependency specifiers keyed by package name, defaulting to an empty map",
      })
    ),
    peerDependenciesMeta: S.optionalKey(PeerDependenciesMetaField).pipe(
      $I.annoteKey("Package.peerDependenciesMeta", {
        description:
          "Per-package peer dependency metadata whose `optional` flag determines whether a decoded peer dependency is optional",
      })
    ),
    scripts: DependencyMapField.pipe(
      $I.annoteKey("Package.scripts", { description: "Commands keyed by script name, defaulting to an empty map" })
    ),
    bin: S.optionalKey(BinField).pipe(
      $I.annoteKey("Package.bin", {
        description: "Executable entry-point path, either a single path or command names mapped to paths",
      })
    ),
    engines: S.optionalKey(StringMapField).pipe(
      $I.annoteKey("Package.engines", {
        description: "Supported runtime and tool version constraints keyed by engine name",
      })
    ),
    exports: S.optionalKey(ExportsField).pipe(
      $I.annoteKey("Package.exports", {
        description: "Public package entry points expressed as a single path or an object of subpaths and conditions",
      })
    ),
    publishConfig: S.optionalKey(PublishConfigField).pipe(
      $I.annoteKey("Package.publishConfig", {
        description:
          "Publication settings preserving npm keys such as `access` and `directory` alongside extension keys",
      })
    ),
    packageManager: S.optionalKey(PackageManager.FromString).pipe(
      $I.annoteKey("Package.packageManager", {
        description:
          "Package-manager pin carrying a lowercase manager name, exact version without build metadata, and optional Corepack integrity hash",
      })
    ),
    devEngines: S.optionalKey(DevEnginesSchema).pipe(
      $I.annoteKey("Package.devEngines", {
        description:
          "Development environment constraints for package manager, runtime, operating system, CPU, and libc, with optional failure policies",
      })
    ),
    files: S.optionalKey(StringListField).pipe(
      $I.annoteKey("Package.files", {
        description: "File globs included when the package is packed, alongside the files npm always includes",
      })
    ),
    imports: S.optionalKey(OpenRecordField).pipe(
      $I.annoteKey("Package.imports", {
        description: "Node subpath imports keyed by `#` specifiers, kept as an open object like `exports`",
      })
    ),
    module: S.optionalKey(S.String).pipe(
      $I.annoteKey("Package.module", {
        description: "Bundler ESM entry-point path, read by bundlers that predate `exports`",
      })
    ),
    browser: S.optionalKey(BrowserField).pipe(
      $I.annoteKey("Package.browser", {
        description: "Browser entry-point path, or a map of module replacements where `false` blocks a module",
      })
    ),
    man: S.optionalKey(ManField).pipe(
      $I.annoteKey("Package.man", {
        description: "One man page path or a list of man page paths installed with the package",
      })
    ),
    directories: S.optionalKey(StringRecordField).pipe(
      $I.annoteKey("Package.directories", {
        description: "Package layout hints such as `bin`, `man`, `doc`, `lib`, `example` and `test` directories",
      })
    ),
    config: S.optionalKey(OpenRecordField).pipe(
      $I.annoteKey("Package.config", {
        description: "Configuration values exposed to package scripts as `npm_package_config_*` environment variables",
      })
    ),
    bundleDependencies: S.optionalKey(BooleanOrStringListField).pipe(
      $I.annoteKey("Package.bundleDependencies", {
        description: "Dependency names bundled into the packed tarball, or `true` to bundle every dependency",
      })
    ),
    bundledDependencies: S.optionalKey(BooleanOrStringListField).pipe(
      $I.annoteKey("Package.bundledDependencies", {
        description: "The `bundledDependencies` alias npm also accepts for `bundleDependencies`",
      })
    ),
    overrides: S.optionalKey(OverridesField).pipe(
      $I.annoteKey("Package.overrides", {
        description: "npm dependency overrides: replacement specifiers or nested objects of scoped overrides",
      })
    ),
    engineStrict: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("Package.engineStrict", {
        description: "The deprecated npm flag that made `engines` mismatches fatal",
      })
    ),
    os: S.optionalKey(StringListField).pipe(
      $I.annoteKey("Package.os", {
        description: "Operating systems the package runs on, with `!`-prefixed entries excluding a system",
      })
    ),
    cpu: S.optionalKey(StringListField).pipe(
      $I.annoteKey("Package.cpu", {
        description: "CPU architectures the package runs on, with `!`-prefixed entries excluding an architecture",
      })
    ),
    libc: S.optionalKey(StringListField).pipe(
      $I.annoteKey("Package.libc", {
        description: "C standard libraries the package runs against, such as `glibc` or `musl`",
      })
    ),
    preferGlobal: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("Package.preferGlobal", {
        description: "The deprecated npm hint that the package is meant to be installed globally",
      })
    ),
    workspaces: S.optionalKey(WorkspacesField).pipe(
      $I.annoteKey("Package.workspaces", {
        description: "Workspace package globs, as a list or as an object with packages, nohoist and other keys",
      })
    ),
    sideEffects: S.optionalKey(BooleanOrStringListField).pipe(
      $I.annoteKey("Package.sideEffects", {
        description: "Bundler side-effect declaration: a flag, or the file globs that do have side effects",
      })
    ),
    types: S.optionalKey(S.String).pipe(
      $I.annoteKey("Package.types", { description: "TypeScript declaration entry-point path" })
    ),
    typings: S.optionalKey(S.String).pipe(
      $I.annoteKey("Package.typings", { description: "The `typings` alias TypeScript also accepts for `types`" })
    ),
    typesVersions: S.optionalKey(TypesVersionsField).pipe(
      $I.annoteKey("Package.typesVersions", {
        description: "TypeScript version ranges mapped to path patterns and their declaration redirects",
      })
    ),
    resolutions: S.optionalKey(StringRecordField).pipe(
      $I.annoteKey("Package.resolutions", {
        description: "Yarn and Bun dependency resolutions: package patterns mapped to forced specifiers",
      })
    ),
    patchedDependencies: S.optionalKey(StringRecordField).pipe(
      $I.annoteKey("Package.patchedDependencies", {
        description: "Bun patches: package specifiers mapped to the patch file applied at install",
      })
    ),
    trustedDependencies: S.optionalKey(StringListField).pipe(
      $I.annoteKey("Package.trustedDependencies", {
        description: "Bun packages allowed to run their lifecycle scripts at install",
      })
    ),
    catalog: S.optionalKey(StringRecordField).pipe(
      $I.annoteKey("Package.catalog", {
        description: "Bun default catalog: package names mapped to the specifiers `catalog:` resolves to",
      })
    ),
    readme: S.optionalKey(S.String).pipe(
      $I.annoteKey("Package.readme", { description: "README text as the registry stores it in the published manifest" })
    ),
    rest: S.optionalKey(S.Record(S.String, S.Unknown)).pipe(
      $I.annoteKey("Package.rest", {
        description:
          "Unknown top-level manifest fields preserved on decode and flattened back into the document on encode",
      })
    ),
  },
  $I.annote("Package", {
    description:
      "A package.json document as a rich `Schema.Class`: typed known fields, a `rest` catch-all preserving unknown top-level fields across a read/edit/write cycle, computed getters, and immutable mutation statics.",
  })
) {
  /**
   * Passes this package through transformations, including curried immutable mutation statics.
   *
   * **Details**
   *
   * `Schema.Class` instances are not `Pipeable`, so `Package` declares this
   * overload block itself.
   *
   * **Example** (Pipe a package through a dependency update)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   *
   * const pkg = Effect.runSync(Package.decode({ name: "my-pkg", version: "1.0.0" }));
   * const next = pkg.pipe(Package.addDependency("effect", "^4.0.0"));
   * console.log(next.hasDependency("effect")); // true
   * ```
   *
   * @category combinators
   * @since 0.0.0
   */
  pipe<A>(this: A): A;
  pipe<A, B>(this: A, ab: (_: A) => B): B;
  pipe<A, B, C>(this: A, ab: (_: A) => B, bc: (_: B) => C): C;
  pipe<A, B, C, D>(this: A, ab: (_: A) => B, bc: (_: B) => C, cd: (_: C) => D): D;
  pipe<A, B, C, D, E>(this: A, ab: (_: A) => B, bc: (_: B) => C, cd: (_: C) => D, de: (_: D) => E): E;
  pipe(this: unknown, ...fns: ReadonlyArray<(_: unknown) => unknown>): unknown {
    return A.reduce(fns, this, (value, f) => f(value));
  }

  /**
   * The default wire codec: an open JSON object ↔ a {@link Package} instance,
   * partitioning unknown keys into `rest` and flattening them back on encode.
   *
   * **Example** (Round-trip an unknown manifest field)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import * as S from "effect/Schema";
   *
   * const pkg = S.decodeUnknownSync(Package.schema)({ name: "my-pkg", version: "1.0.0", custom: true });
   * console.log(S.encodeSync(Package.schema)(pkg).custom); // true
   * ```
   *
   * @category codecs
   * @since 0.0.0
   */
  static readonly schema: S.Codec<Package, { readonly [k: string]: unknown }> = makeWire(Package);

  /**
   * Build the wire codec for a `.extend()`ed subclass, so its custom fields
   * decode as typed members and are excluded from `rest`.
   *
   * **Example** (Decode an extended manifest)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import * as S from "effect/Schema";
   *
   * class ExtendedPackage extends Package.extend<ExtendedPackage>("ExtendedPackage")({ custom: S.String }) {}
   * const codec = Package.wireFor(ExtendedPackage);
   * const pkg = S.decodeUnknownSync(codec)({ name: "my-pkg", version: "1.0.0", custom: "kept" });
   * console.log(pkg.custom); // kept
   * ```
   *
   * @param Class - the extended `Schema.Class`, carrying its own `fields`
   * @returns a codec between an open JSON object and `Class` instances
   * @category codecs
   * @since 0.0.0
   */
  static wireFor<Self extends Package, RD = never, RE = never>(
    Class: S.Codec<Self, unknown, RD, RE> & { readonly fields: Record<string, unknown> }
  ): S.Codec<Self, { readonly [k: string]: unknown }, RD, RE> {
    return makeWire(Class);
  }

  /**
   * Decode an unknown JSON value into a {@link Package}, normalizing schema
   * failures to a typed {@link PackageDecodeError} at the boundary.
   *
   * **Details**
   *
   * The input is the parsed package.json JSON value (e.g. from `JSON.parse`).
   * The Effect resolves to the decoded `Package`, failing with
   * {@link PackageDecodeError} when the input does not satisfy the schema.
   *
   * **Example** (Decode a manifest name)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   *
   * const pkg = Effect.runSync(Package.decode({ name: "my-pkg", version: "1.0.0" }));
   * console.log(pkg.name); // my-pkg
   * ```
   *
   * @category decoding
   * @since 0.0.0
   */
  static readonly decode = Effect.fn("Package.decode")(function* (input: unknown) {
    return yield* PackageDecodeError.decodeUnknown(Package.schema)(input);
  });

  /**
   * Whether the package is marked private.
   *
   * **Example** (Inspect isPrivate)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   *
   * const pkg = Effect.runSync(Package.decode({ name: "my-pkg", version: "1.0.0" }));
   * console.log(pkg.isPrivate); // false
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  get isPrivate(): boolean {
    return this.private ?? false;
  }

  /**
   * Whether the package name is scoped (`@scope/name`).
   *
   * **Example** (Inspect isScoped)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   *
   * const pkg = Effect.runSync(Package.decode({ name: "my-pkg", version: "1.0.0" }));
   * console.log(pkg.isScoped); // false
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  get isScoped(): boolean {
    return PackageName.isScoped(this.name);
  }

  /**
   * Whether the package is ESM (`"type": "module"`).
   *
   * **Example** (Inspect isESM)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   *
   * const pkg = Effect.runSync(Package.decode({ name: "my-pkg", version: "1.0.0" }));
   * console.log(pkg.isESM); // false
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  get isESM(): boolean {
    return this.type === "module";
  }

  /**
   * Whether any dependency map contains `name`.
   *
   * **Example** (Inspect hasDependency)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   *
   * const pkg = Effect.runSync(Package.decode({ name: "my-pkg", version: "1.0.0" }));
   * console.log(pkg.hasDependency("effect")); // false
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  hasDependency(name: string): boolean {
    return (
      HashMap.has(this.dependencies, name) ||
      HashMap.has(this.devDependencies, name) ||
      HashMap.has(this.peerDependencies, name) ||
      HashMap.has(this.optionalDependencies, name)
    );
  }

  /**
   * The `dependencies` map as {@link Dependency} instances (`kind: "prod"`).
   *
   * **Example** (Read prod dependency entries)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   * import * as HashMap from "effect/HashMap";
   *
   * const pkg = Effect.runSync(Package.decode({ name: "my-pkg", version: "1.0.0", dependencies: { effect: "^4.0.0" } }));
   * console.log(HashMap.size(pkg.getDependencies())); // 1
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  getDependencies(): HashMap.HashMap<string, Dependency> {
    return HashMap.map(this.dependencies, (specifier, name) => Dependency.make({ name, specifier, kind: "prod" }));
  }

  /**
   * The `devDependencies` map as {@link Dependency} instances (`kind: "dev"`).
   *
   * **Example** (Read dev dependency entries)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   * import * as HashMap from "effect/HashMap";
   *
   * const pkg = Effect.runSync(Package.decode({ name: "my-pkg", version: "1.0.0", devDependencies: { effect: "^4.0.0" } }));
   * console.log(HashMap.size(pkg.getDevDependencies())); // 1
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  getDevDependencies(): HashMap.HashMap<string, Dependency> {
    return HashMap.map(this.devDependencies, (specifier, name) => Dependency.make({ name, specifier, kind: "dev" }));
  }

  /**
   * The `peerDependencies` map as {@link Dependency} instances (`kind: "peer"`), carrying `isOptional` from `peerDependenciesMeta`.
   *
   * **Example** (Read peer dependency entries)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   * import * as HashMap from "effect/HashMap";
   *
   * const pkg = Effect.runSync(Package.decode({ name: "my-pkg", version: "1.0.0", peerDependencies: { effect: "^4.0.0" } }));
   * console.log(HashMap.size(pkg.getPeerDependencies())); // 1
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  getPeerDependencies(): HashMap.HashMap<string, Dependency> {
    const meta = this.peerDependenciesMeta;
    return HashMap.map(this.peerDependencies, (specifier, name) =>
      Dependency.make({ name, specifier, kind: "peer", isOptional: meta?.[name]?.optional ?? false })
    );
  }

  /**
   * The `optionalDependencies` map as {@link Dependency} instances (`kind: "optional"`).
   *
   * **Example** (Read optional dependency entries)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   * import * as HashMap from "effect/HashMap";
   *
   * const pkg = Effect.runSync(Package.decode({ name: "my-pkg", version: "1.0.0", optionalDependencies: { effect: "^4.0.0" } }));
   * console.log(HashMap.size(pkg.getOptionalDependencies())); // 1
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  getOptionalDependencies(): HashMap.HashMap<string, Dependency> {
    return HashMap.map(this.optionalDependencies, (specifier, name) =>
      Dependency.make({ name, specifier, kind: "optional" })
    );
  }

  /**
   * Return a new {@link Package} with the given fields replaced.
   *
   * **Example** (Copy a package with a description)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   *
   * const pkg = Effect.runSync(Package.decode({ name: "my-pkg", version: "1.0.0" }));
   * const next = pkg.copyWith({ description: "Updated" });
   * console.log(next.description); // Updated
   * ```
   *
   * @category combinators
   * @since 0.0.0
   */
  copyWith(patch: PackagePatch): Package {
    return Package.make({ ...this, ...patch });
  }

  /**
   * Set the version from a string. Fails with `InvalidVersionError`. Dual API.
   *
   * **Example** (Apply setVersion in curried form)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   *
   * const pkg = Effect.runSync(Package.decode({ name: "my-pkg", version: "1.0.0" }));
   * const next = Effect.runSync(pkg.pipe(Package.setVersion("1.1.0")));
   * console.log(next.toJsonString().includes('"version": "1.1.0"')); // true
   * ```
   *
   * @category setters
   * @since 0.0.0
   */
  static readonly setVersion: {
    (version: string): (pkg: Package) => Effect.Effect<Package, InvalidVersionError>;
    (pkg: Package, version: string): Effect.Effect<Package, InvalidVersionError>;
  } = Fn.dual(
    2,
    Effect.fn("Package.setVersion")(function* (pkg: Package, version: string) {
      const semver = yield* SemVer.parse(version);
      return pkg.copyWith({ version: semver });
    })
  );

  /**
   * Set the package name. Fails with `InvalidPackageNameError`. Dual API.
   *
   * **Example** (Apply setName in curried form)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   *
   * const pkg = Effect.runSync(Package.decode({ name: "my-pkg", version: "1.0.0" }));
   * const next = Effect.runSync(pkg.pipe(Package.setName("new-name")));
   * console.log(next.name); // new-name
   * ```
   *
   * @category setters
   * @since 0.0.0
   */
  static readonly setName: {
    (name: string): (pkg: Package) => Effect.Effect<Package, InvalidPackageNameError>;
    (pkg: Package, name: string): Effect.Effect<Package, InvalidPackageNameError>;
  } = Fn.dual(
    2,
    Effect.fn("Package.setName")(function* (pkg: Package, name: string) {
      if (!S.is(PackageName)(name)) {
        return yield* InvalidPackageNameError.make({ input: name });
      }
      return pkg.copyWith({ name });
    })
  );

  /**
   * Set the license from an SPDX string. Fails with `InvalidSpdxLicenseError`. Dual API.
   *
   * **Example** (Apply setLicense in curried form)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   *
   * const pkg = Effect.runSync(Package.decode({ name: "my-pkg", version: "1.0.0" }));
   * const next = Effect.runSync(pkg.pipe(Package.setLicense("MIT")));
   * console.log(next.license); // MIT
   * ```
   *
   * @category setters
   * @since 0.0.0
   */
  static readonly setLicense: {
    (license: string): (pkg: Package) => Effect.Effect<Package, InvalidSpdxLicenseError>;
    (pkg: Package, license: string): Effect.Effect<Package, InvalidSpdxLicenseError>;
  } = Fn.dual(
    2,
    Effect.fn("Package.setLicense")(function* (pkg: Package, license: string) {
      if (!S.is(SpdxLicense)(license)) {
        return yield* InvalidSpdxLicenseError.make({ input: license });
      }
      return pkg.copyWith({ license });
    })
  );

  /**
   * Add or replace a `dependencies` entry. Dual API.
   *
   * **Example** (Add a dependencies entry)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   * import * as HashMap from "effect/HashMap";
   *
   * const pkg = Effect.runSync(Package.decode({ name: "my-pkg", version: "1.0.0" }));
   * const next = pkg.pipe(Package.addDependency("effect", "^4.0.0"));
   * console.log(HashMap.has(next.dependencies, "effect")); // true
   * ```
   *
   * @category setters
   * @since 0.0.0
   */
  static readonly addDependency: {
    (name: string, specifier: string): (pkg: Package) => Package;
    (pkg: Package, name: string, specifier: string): Package;
  } = mapEntrySetter("dependencies");

  /**
   * Remove a `dependencies` entry. Dual API.
   *
   * **Example** (Remove a dependencies entry)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   * import * as HashMap from "effect/HashMap";
   *
   * const pkg = Effect.runSync(Package.decode({ name: "my-pkg", version: "1.0.0" }));
   * const populated = Package.addDependency(pkg, "effect", "^4.0.0");
   * const next = populated.pipe(Package.removeDependency("effect"));
   * console.log(HashMap.has(next.dependencies, "effect")); // false
   * ```
   *
   * @category setters
   * @since 0.0.0
   */
  static readonly removeDependency: {
    (name: string): (pkg: Package) => Package;
    (pkg: Package, name: string): Package;
  } = mapEntryRemover("dependencies");

  /**
   * Add or replace a `devDependencies` entry. Dual API.
   *
   * **Example** (Add a devDependencies entry)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   * import * as HashMap from "effect/HashMap";
   *
   * const pkg = Effect.runSync(Package.decode({ name: "my-pkg", version: "1.0.0" }));
   * const next = pkg.pipe(Package.addDevDependency("effect", "^4.0.0"));
   * console.log(HashMap.has(next.devDependencies, "effect")); // true
   * ```
   *
   * @category setters
   * @since 0.0.0
   */
  static readonly addDevDependency: {
    (name: string, specifier: string): (pkg: Package) => Package;
    (pkg: Package, name: string, specifier: string): Package;
  } = mapEntrySetter("devDependencies");

  /**
   * Remove a `devDependencies` entry. Dual API.
   *
   * **Example** (Remove a devDependencies entry)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   * import * as HashMap from "effect/HashMap";
   *
   * const pkg = Effect.runSync(Package.decode({ name: "my-pkg", version: "1.0.0" }));
   * const populated = Package.addDevDependency(pkg, "effect", "^4.0.0");
   * const next = populated.pipe(Package.removeDevDependency("effect"));
   * console.log(HashMap.has(next.devDependencies, "effect")); // false
   * ```
   *
   * @category setters
   * @since 0.0.0
   */
  static readonly removeDevDependency: {
    (name: string): (pkg: Package) => Package;
    (pkg: Package, name: string): Package;
  } = mapEntryRemover("devDependencies");

  /**
   * Add or replace a `peerDependencies` entry. Dual API.
   *
   * **Example** (Add a peerDependencies entry)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   * import * as HashMap from "effect/HashMap";
   *
   * const pkg = Effect.runSync(Package.decode({ name: "my-pkg", version: "1.0.0" }));
   * const next = pkg.pipe(Package.addPeerDependency("effect", "^4.0.0"));
   * console.log(HashMap.has(next.peerDependencies, "effect")); // true
   * ```
   *
   * @category setters
   * @since 0.0.0
   */
  static readonly addPeerDependency: {
    (name: string, specifier: string): (pkg: Package) => Package;
    (pkg: Package, name: string, specifier: string): Package;
  } = mapEntrySetter("peerDependencies");

  /**
   * Remove a `peerDependencies` entry. Dual API.
   *
   * **Example** (Remove a peerDependencies entry)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   * import * as HashMap from "effect/HashMap";
   *
   * const pkg = Effect.runSync(Package.decode({ name: "my-pkg", version: "1.0.0" }));
   * const populated = Package.addPeerDependency(pkg, "effect", "^4.0.0");
   * const next = populated.pipe(Package.removePeerDependency("effect"));
   * console.log(HashMap.has(next.peerDependencies, "effect")); // false
   * ```
   *
   * @category setters
   * @since 0.0.0
   */
  static readonly removePeerDependency: {
    (name: string): (pkg: Package) => Package;
    (pkg: Package, name: string): Package;
  } = mapEntryRemover("peerDependencies");

  /**
   * Add or replace an `optionalDependencies` entry. Dual API.
   *
   * **Example** (Add a optionalDependencies entry)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   * import * as HashMap from "effect/HashMap";
   *
   * const pkg = Effect.runSync(Package.decode({ name: "my-pkg", version: "1.0.0" }));
   * const next = pkg.pipe(Package.addOptionalDependency("effect", "^4.0.0"));
   * console.log(HashMap.has(next.optionalDependencies, "effect")); // true
   * ```
   *
   * @category setters
   * @since 0.0.0
   */
  static readonly addOptionalDependency: {
    (name: string, specifier: string): (pkg: Package) => Package;
    (pkg: Package, name: string, specifier: string): Package;
  } = mapEntrySetter("optionalDependencies");

  /**
   * Remove an `optionalDependencies` entry. Dual API.
   *
   * **Example** (Remove a optionalDependencies entry)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   * import * as HashMap from "effect/HashMap";
   *
   * const pkg = Effect.runSync(Package.decode({ name: "my-pkg", version: "1.0.0" }));
   * const populated = Package.addOptionalDependency(pkg, "effect", "^4.0.0");
   * const next = populated.pipe(Package.removeOptionalDependency("effect"));
   * console.log(HashMap.has(next.optionalDependencies, "effect")); // false
   * ```
   *
   * @category setters
   * @since 0.0.0
   */
  static readonly removeOptionalDependency: {
    (name: string): (pkg: Package) => Package;
    (pkg: Package, name: string): Package;
  } = mapEntryRemover("optionalDependencies");

  /**
   * Add or replace a `scripts` entry. Dual API.
   *
   * **Example** (Update the test script)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   * import * as HashMap from "effect/HashMap";
   *
   * const pkg = Effect.runSync(Package.decode({ name: "my-pkg", version: "1.0.0" }));
   * const populated = Package.setScript(pkg, "test", "vitest run");
   * console.log(HashMap.has(populated.scripts, "test")); // true
   * ```
   *
   * @category setters
   * @since 0.0.0
   */
  static readonly setScript: {
    (name: string, command: string): (pkg: Package) => Package;
    (pkg: Package, name: string, command: string): Package;
  } = mapEntrySetter("scripts");

  /**
   * Remove a `scripts` entry. Dual API.
   *
   * **Example** (Remove the test script)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   * import * as HashMap from "effect/HashMap";
   *
   * const pkg = Effect.runSync(Package.decode({ name: "my-pkg", version: "1.0.0" }));
   * const populated = Package.setScript(pkg, "test", "vitest run");
   * const next = populated.pipe(Package.removeScript("test"));
   * console.log(HashMap.has(next.scripts, "test")); // false
   * ```
   *
   * @category setters
   * @since 0.0.0
   */
  static readonly removeScript: {
    (name: string): (pkg: Package) => Package;
    (pkg: Package, name: string): Package;
  } = mapEntryRemover("scripts");

  /**
   * Resolve `catalog:` and `workspace:` specifiers across all four dependency
   * maps using the `CatalogResolver` and `WorkspaceResolver` from context,
   * returning a new `Package`. This is the explicit resolution step —
   * `PackageJsonFile.write` never resolves.
   *
   * **Details**
   *
   * Classification and projection go through `@beep/npm-spec`'s
   * `DependencySpecifier` statics: `workspace:` uses the pnpm publish-time
   * projection, and the alias form `workspace:<name>@<range>` resolves the
   * TARGET package's version and becomes the published `npm:<name>@<range>`
   * alias. Specifiers the resolvers answer `Option.none()` for are left
   * unchanged — resolution still succeeds. Fails with `@beep/npm-spec`'s
   * `CatalogAssemblyError` when catalog assembly failed, or
   * `DependencyResolutionError` when a resolver's mechanism failed; requires
   * `CatalogResolver` and `WorkspaceResolver` in `R`. For fail-typed
   * resolution over the tolerant model, see `@beep/npm-spec`'s
   * `Manifest#resolve`.
   *
   * **Example** (Resolve catalog dependencies with no-op resolvers)
   *
   * ```ts
   * import { Default } from "@beep/npm-spec";
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   * import * as HashMap from "effect/HashMap";
   * import * as O from "effect/Option";
   *
   * const program = Effect.gen(function* () {
   *   const pkg = yield* Package.decode({
   *     name: "my-pkg",
   *     version: "1.0.0",
   *     dependencies: { effect: "catalog:" },
   *   });
   *   return yield* Package.resolve(pkg);
   * }).pipe(Effect.provide(Default)); // the no-op resolvers leave `catalog:` unchanged
   * const resolved = Effect.runSync(program);
   * console.log(O.getOrElse(HashMap.get(resolved.dependencies, "effect"), () => "missing")); // catalog:
   * ```
   *
   * @param pkg - the package whose specifiers to resolve
   * @category utilities
   * @since 0.0.0
   */
  static readonly resolve = Effect.fn("Package.resolve")(function* (pkg: Package) {
    const workspace = yield* WorkspaceResolver;
    const catalog = yield* CatalogResolver;

    const resolveSpecifier = Effect.fnUntraced(function* (name: string, specifier: string) {
      if (DependencySpecifier.isWorkspace(specifier)) {
        const target = O.getOrElse(DependencySpecifier.workspaceTargetOf(specifier), () => name);
        const version = yield* workspace.versionOf(target);
        return O.map(version, (resolved) => DependencySpecifier.resolveWorkspace(specifier, resolved));
      }
      if (DependencySpecifier.isCatalog(specifier)) {
        return yield* catalog.rangeOf(name, DependencySpecifier.catalogNameOf(specifier));
      }
      return O.none<string>();
    });

    const resolveMap = Effect.fn("Package.resolveMap")(function* (map: HashMap.HashMap<string, string>) {
      let next = map;
      for (const [name, specifier] of HashMap.entries(map)) {
        const resolved = yield* resolveSpecifier(name, specifier);
        if (O.isSome(resolved)) {
          next = HashMap.set(next, name, resolved.value);
        }
      }
      return next;
    });

    return pkg.copyWith({
      dependencies: yield* resolveMap(pkg.dependencies),
      devDependencies: yield* resolveMap(pkg.devDependencies),
      peerDependencies: yield* resolveMap(pkg.peerDependencies),
      optionalDependencies: yield* resolveMap(pkg.optionalDependencies),
    });
  });

  /**
   * Serialize to a formatted package.json string: encode through the wire
   * codec (flattening `rest`), then apply the canonical key order, dependency
   * sorting and empty-map stripping unless the options opt out. Pure.
   *
   * **Example** (Serialize a package name)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   *
   * const pkg = Effect.runSync(Package.decode({ name: "my-pkg", version: "1.0.0" }));
   * console.log(pkg.toJsonString().includes('"name": "my-pkg"')); // true
   * ```
   *
   * @category serialization
   * @since 0.0.0
   */
  toJsonString(options?: PackageFormatOptions.Encoded): string {
    const raw = Result.getOrThrowWith(S.encodeUnknownResult(Package.schema)(this), Fn.identity);
    return renderJson(raw, resolveFormatOptions(options));
  }
}
