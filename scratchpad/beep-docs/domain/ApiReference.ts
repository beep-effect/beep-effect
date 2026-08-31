/**
 * Schemas for the generated API reference dataset: channel and package
 * manifests, the per-module dataset entry, and the TypeDoc project reflection
 * boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { Sha256Hex } from "@beep/schema/Sha256";
import { SchemaGetter } from "effect";
import { pipe } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { JSONOutput } from "typedoc";

const $I = $ScratchpadId.create("beep-docs/domain/ApiReference");

const NonNegativeInt = S.Int.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`NonNegativeIntCheck`,
    title: "Non-negative Integer",
    description: "An integer greater than or equal to zero.",
  })
);

/**
 * Major-version channel of an API reference dataset, such as `v3` or `v4`.
 *
 * **Details**
 *
 * Channels double as directory names inside the dataset root, so the brand
 * keeps directory scans and manifest fields in the same domain.
 *
 * **Example** (Decode a channel name)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ApiChannel } from "@beep/scratchpad/beep-docs/domain/ApiReference"
 *
 * const channel = S.decodeUnknownSync(ApiChannel)("v4")
 * console.log(channel) // "v4"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ApiChannel = S.String.check(
  S.isPattern(/^v\d+$/, {
    identifier: $I`ApiChannelCheck`,
    title: "API Channel",
    description: "A `v` followed by one or more digits.",
    message: "API channel must be a `v` followed by digits",
  })
).pipe(
  S.brand("ApiChannel"),
  $I.annoteSchema("ApiChannel", {
    description: "Major-version channel of an API reference dataset, such as `v3` or `v4`.",
  })
);

/**
 * Branded channel string extracted from {@link ApiChannel}.
 *
 * @category models
 * @since 0.0.0
 */
export type ApiChannel = typeof ApiChannel.Type;

/**
 * The TypeDoc JSON schema version this dataset understands.
 *
 * **Example** (Decode the supported version)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TypedocSchemaVersion } from "@beep/scratchpad/beep-docs/domain/ApiReference"
 *
 * console.log(S.decodeUnknownSync(TypedocSchemaVersion)("2.0"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TypedocSchemaVersion = S.Literal("2.0").pipe(
  $I.annoteSchema("TypedocSchemaVersion", {
    description: "The TypeDoc JSON output schema version accepted by the dataset.",
  })
);

/**
 * Literal type extracted from {@link TypedocSchemaVersion}.
 *
 * @category models
 * @since 0.0.0
 */
export type TypedocSchemaVersion = typeof TypedocSchemaVersion.Type;

/**
 * URL-safe slug that identifies a package inside an API channel.
 *
 * **Example** (Decode a package slug)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { PackageSlug } from "@beep/scratchpad/beep-docs/domain/ApiReference"
 *
 * console.log(S.decodeUnknownSync(PackageSlug)("platform-node"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PackageSlug = S.String.check(
  S.isPattern(/^[a-z0-9][a-z0-9._-]*$/, {
    identifier: $I`PackageSlugCheck`,
    title: "Package Slug",
    description: "Lowercase alphanumerics, dots, underscores, and hyphens, starting with an alphanumeric.",
    message: "Package slug must start with a lowercase alphanumeric and use only [a-z0-9._-]",
  })
).pipe(
  S.brand("PackageSlug"),
  $I.annoteSchema("PackageSlug", {
    description: "URL path segment that identifies a package inside an API channel.",
  })
);

/**
 * Branded slug string extracted from {@link PackageSlug}.
 *
 * @category models
 * @since 0.0.0
 */
export type PackageSlug = typeof PackageSlug.Type;

/**
 * Derives a {@link PackageSlug} from an npm package name by stripping the
 * `@effect/` scope.
 *
 * **Gotchas**
 *
 * The scope is not recoverable, so encoding returns the slug unchanged rather
 * than the original package name.
 *
 * **Example** (Derive the slug for a scoped package)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { PackageSlugFromPackageName } from "@beep/scratchpad/beep-docs/domain/ApiReference"
 *
 * console.log(S.decodeUnknownSync(PackageSlugFromPackageName)("@effect/platform-node"))
 * // "platform-node"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const PackageSlugFromPackageName = S.String.pipe(
  S.decodeTo(PackageSlug, {
    decode: SchemaGetter.transform(Str.replace(/^@effect\//, "")),
    encode: SchemaGetter.passthrough({ strict: false }),
  }),
  $I.annoteSchema("PackageSlugFromPackageName", {
    description: "Strips the `@effect/` scope from a package name and validates the remainder as a package slug.",
  })
);

/**
 * Decoded slug produced by {@link PackageSlugFromPackageName}.
 *
 * @category models
 * @since 0.0.0
 */
export type PackageSlugFromPackageName = typeof PackageSlugFromPackageName.Type;

/**
 * Slash-separated module path with no empty, `.`, or `..` segments.
 *
 * **Example** (Decode a nested module path)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ModulePath } from "@beep/scratchpad/beep-docs/domain/ApiReference"
 *
 * console.log(S.decodeUnknownSync(ModulePath)("unstable/http/HttpClient"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ModulePath = S.String.check(
  S.isPattern(/^(?!\.{1,2}(?:\/|$))[^/]+(?:\/(?!\.{1,2}(?:\/|$))[^/]+)*$/, {
    identifier: $I`ModulePathCheck`,
    title: "Module Path",
    description: "Slash-separated segments where no segment is empty, `.`, or `..`.",
    message: "Module path segments must be non-empty and must not be `.` or `..`",
  })
).pipe(
  S.brand("ModulePath"),
  $I.annoteSchema("ModulePath", {
    description: "Slash-separated module path used in API reference URLs and entry ids.",
  })
);

/**
 * Branded module path string extracted from {@link ModulePath}.
 *
 * @category models
 * @since 0.0.0
 */
export type ModulePath = typeof ModulePath.Type;

const modulePathFromExportPath = (exportPath: string): string =>
  exportPath === "." ? "index" : pipe(exportPath, Str.replace(/^\.\//, ""));

const exportPathFromModulePath = (modulePath: string): string =>
  modulePath === "index" ? "." : `./${modulePath}`;

/**
 * Converts a package.json export path such as `.` or `./Option` into a
 * {@link ModulePath}.
 *
 * **Example** (Round-trip the root export)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ModulePathFromExportPath } from "@beep/scratchpad/beep-docs/domain/ApiReference"
 *
 * const modulePath = S.decodeUnknownSync(ModulePathFromExportPath)(".")
 * console.log(modulePath) // "index"
 * console.log(S.encodeUnknownSync(ModulePathFromExportPath)(modulePath)) // "."
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const ModulePathFromExportPath = S.String.pipe(
  S.decodeTo(ModulePath, {
    decode: SchemaGetter.transform(modulePathFromExportPath),
    encode: SchemaGetter.transform(exportPathFromModulePath),
  }),
  $I.annoteSchema("ModulePathFromExportPath", {
    description: "Maps `.` to `index` and strips a leading `./` from a package export path.",
  })
);

/**
 * Decoded module path produced by {@link ModulePathFromExportPath}.
 *
 * @category models
 * @since 0.0.0
 */
export type ModulePathFromExportPath = typeof ModulePathFromExportPath.Type;

/**
 * One module of one package inside one API channel, as materialized in the
 * website content collection.
 *
 * **Example** (Construct an entry)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ApiReferenceEntry } from "@beep/scratchpad/beep-docs/domain/ApiReference"
 *
 * const entry = S.decodeUnknownSync(ApiReferenceEntry)({
 *   version: "v4",
 *   revision: "abc123",
 *   packageName: "effect",
 *   packageSlug: "effect",
 *   packageVersion: "4.0.0",
 *   packageDescription: "The core Effect library.",
 *   packageModuleCount: 1,
 *   packageNpmUrl: "https://www.npmjs.com/package/effect",
 *   packageSourceUrl: "https://github.com/Effect-TS/effect",
 *   modulePath: "Option",
 *   exportPath: "./Option",
 *   sourcePath: "src/Option.ts",
 *   reflectionPath: "v4/effect/Option.json",
 *   reflectionDigest: "a".repeat(64),
 *   typedocSchemaVersion: "2.0",
 * })
 * console.log(entry.modulePath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ApiReferenceEntry extends S.Class<ApiReferenceEntry>($I`ApiReferenceEntry`)(
  {
    version: ApiChannel,
    revision: S.NonEmptyString,
    packageName: S.NonEmptyString,
    packageSlug: PackageSlug,
    packageVersion: S.NonEmptyString,
    packageDescription: S.NonEmptyString,
    packageModuleCount: NonNegativeInt,
    packageNpmUrl: S.URLFromString,
    packageSourceUrl: S.URLFromString,
    modulePath: ModulePath,
    barrelPath: ModulePath.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    exportPath: S.NonEmptyString,
    sourcePath: S.NonEmptyString,
    reflectionPath: S.NonEmptyString,
    reflectionDigest: Sha256Hex,
    typedocSchemaVersion: TypedocSchemaVersion,
  },
  $I.annote("ApiReferenceEntry", {
    description: "One module of one package inside one API channel, with the digest of its TypeDoc reflection.",
  })
) {}

const ProjectReflectionShape = S.Struct({
  schemaVersion: TypedocSchemaVersion,
  variant: S.Literal("project"),
  id: S.Finite,
  name: S.String,
  kind: S.Finite,
  flags: S.Record(S.String, S.Unknown),
});

const isProjectReflectionShape = S.is(ProjectReflectionShape);

/**
 * Boundary schema for a TypeDoc `ProjectReflection` JSON document.
 *
 * **Details**
 *
 * Only the envelope (`schemaVersion`, `variant`, `id`, `name`, `kind`,
 * `flags`) is validated; the nested reflection tree is trusted as
 * `JSONOutput.ProjectReflection` from `typedoc`.
 *
 * **Example** (Validate a minimal project reflection)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TypeDocProjectReflection } from "@beep/scratchpad/beep-docs/domain/ApiReference"
 *
 * const project = S.decodeUnknownSync(TypeDocProjectReflection)({
 *   schemaVersion: "2.0",
 *   variant: "project",
 *   id: 1,
 *   name: "effect",
 *   kind: 1,
 *   flags: {},
 * })
 * console.log(project.name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TypeDocProjectReflection = S.declare<JSONOutput.ProjectReflection>(
  (value): value is JSONOutput.ProjectReflection => isProjectReflectionShape(value),
  { expected: "a TypeDoc project reflection" }
).pipe(
  $I.annoteSchema("TypeDocProjectReflection", {
    description: "A TypeDoc JSON project reflection whose envelope has been validated.",
  })
);

/**
 * Decoded type of {@link TypeDocProjectReflection}.
 *
 * @category models
 * @since 0.0.0
 */
export type TypeDocProjectReflection = JSONOutput.ProjectReflection;

/**
 * Parses a JSON string into a {@link TypeDocProjectReflection}.
 *
 * **Example** (Parse reflection JSON)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TypeDocProjectReflectionFromJsonString } from "@beep/scratchpad/beep-docs/domain/ApiReference"
 *
 * const json = '{"schemaVersion":"2.0","variant":"project","id":1,"name":"effect","kind":1,"flags":{}}'
 * console.log(S.decodeUnknownSync(TypeDocProjectReflectionFromJsonString)(json).name)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const TypeDocProjectReflectionFromJsonString = S.fromJsonString(TypeDocProjectReflection).pipe(
  $I.annoteSchema("TypeDocProjectReflectionFromJsonString", {
    description: "JSON string codec for a TypeDoc project reflection.",
  })
);

/**
 * Decoded reflection produced by {@link TypeDocProjectReflectionFromJsonString}.
 *
 * @category models
 * @since 0.0.0
 */
export type TypeDocProjectReflectionFromJsonString = typeof TypeDocProjectReflectionFromJsonString.Type;

const utf8Decoder = new TextDecoder();
const utf8Encoder = new TextEncoder();

/**
 * UTF-8 text codec over raw bytes.
 *
 * **Example** (Decode bytes as text)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Utf8TextFromBytes } from "@beep/scratchpad/beep-docs/domain/ApiReference"
 *
 * console.log(S.decodeUnknownSync(Utf8TextFromBytes)(new Uint8Array([104, 105]))) // "hi"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const Utf8TextFromBytes = S.Uint8Array.pipe(
  S.decodeTo(S.String, {
    decode: SchemaGetter.transform((bytes: Uint8Array) => utf8Decoder.decode(bytes)),
    encode: SchemaGetter.transform((text: string) => utf8Encoder.encode(text)),
  }),
  $I.annoteSchema("Utf8TextFromBytes", {
    description: "UTF-8 text decoded from raw bytes.",
  })
);

/**
 * Decoded text produced by {@link Utf8TextFromBytes}.
 *
 * @category models
 * @since 0.0.0
 */
export type Utf8TextFromBytes = typeof Utf8TextFromBytes.Type;

/**
 * Parses raw file bytes into a {@link TypeDocProjectReflection}, so one read
 * can serve both the checksum and the parsed document.
 *
 * **Example** (Parse reflection bytes)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TypeDocProjectReflectionFromBytes } from "@beep/scratchpad/beep-docs/domain/ApiReference"
 *
 * const bytes = new TextEncoder().encode(
 *   '{"schemaVersion":"2.0","variant":"project","id":1,"name":"effect","kind":1,"flags":{}}'
 * )
 * console.log(S.decodeUnknownSync(TypeDocProjectReflectionFromBytes)(bytes).name)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const TypeDocProjectReflectionFromBytes = Utf8TextFromBytes.pipe(
  S.decodeTo(TypeDocProjectReflectionFromJsonString),
  SchemaUtils.withCodecStatics(["decodeEffect"]),
  $I.annoteSchema("TypeDocProjectReflectionFromBytes", {
    description: "Byte codec for a TypeDoc project reflection: UTF-8 bytes, then JSON, then the reflection envelope.",
  })
);

/**
 * Decoded reflection produced by {@link TypeDocProjectReflectionFromBytes}.
 *
 * @category models
 * @since 0.0.0
 */
export type TypeDocProjectReflectionFromBytes = typeof TypeDocProjectReflectionFromBytes.Type;

/**
 * One package listed by a channel manifest.
 *
 * **Example** (Construct a package listing)
 *
 * ```ts
 * import { ApiReferenceDatasetPackage } from "@beep/scratchpad/beep-docs/domain/ApiReference"
 *
 * const listing = new ApiReferenceDatasetPackage({
 *   name: "effect",
 *   version: "4.0.0",
 *   manifest: "effect/manifest.json",
 * })
 * console.log(listing.manifest)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ApiReferenceDatasetPackage extends S.Class<ApiReferenceDatasetPackage>(
  $I`ApiReferenceDatasetPackage`
)(
  {
    name: S.NonEmptyString,
    version: S.NonEmptyString,
    manifest: S.NonEmptyString,
  },
  $I.annote("ApiReferenceDatasetPackage", {
    description: "A package listed by a channel manifest together with the relative path of its own manifest.",
  })
) {}

/**
 * The `manifest.json` at the root of one channel directory.
 *
 * **Example** (Decode a channel manifest)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ApiReferenceDatasetManifest } from "@beep/scratchpad/beep-docs/domain/ApiReference"
 *
 * const manifest = S.decodeUnknownSync(ApiReferenceDatasetManifest)({
 *   datasetSchemaVersion: 1,
 *   channel: "v4",
 *   typedocVersion: "0.28.20",
 *   typedocSchemaVersion: "2.0",
 *   revision: "abc123",
 *   packages: [],
 * })
 * console.log(manifest.channel)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ApiReferenceDatasetManifest extends S.Class<ApiReferenceDatasetManifest>(
  $I`ApiReferenceDatasetManifest`
)(
  {
    datasetSchemaVersion: S.Literal(1),
    channel: ApiChannel,
    typedocVersion: S.NonEmptyString,
    typedocSchemaVersion: TypedocSchemaVersion,
    revision: S.NonEmptyString,
    packages: S.Array(ApiReferenceDatasetPackage),
  },
  $I.annote("ApiReferenceDatasetManifest", {
    description: "Channel-level manifest that names the git revision and every package generated for the channel.",
  })
) {}

/**
 * A barrel export declared by a package manifest.
 *
 * **Example** (Construct a barrel)
 *
 * ```ts
 * import { ApiReferenceBarrel } from "@beep/scratchpad/beep-docs/domain/ApiReference"
 *
 * console.log(new ApiReferenceBarrel({ export: ".", source: "src/index.ts" }).source)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ApiReferenceBarrel extends S.Class<ApiReferenceBarrel>($I`ApiReferenceBarrel`)(
  {
    export: S.NonEmptyString,
    source: S.NonEmptyString,
  },
  $I.annote("ApiReferenceBarrel", {
    description: "A barrel export path and the source file that backs it.",
  })
) {}

/**
 * A module generated for a package, with the path and digest of its TypeDoc
 * reflection JSON.
 *
 * **Example** (Construct a module listing)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ApiReferenceModule } from "@beep/scratchpad/beep-docs/domain/ApiReference"
 *
 * const module = S.decodeSync(ApiReferenceModule)({
 *   export: "./Option",
 *   source: "src/Option.ts",
 *   json: "Option.json",
 *   sha256: "a".repeat(64),
 * })
 * console.log(module.export)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ApiReferenceModule extends S.Class<ApiReferenceModule>($I`ApiReferenceModule`)(
  {
    export: S.NonEmptyString,
    source: S.NonEmptyString,
    json: S.NonEmptyString,
    sha256: Sha256Hex,
    barrel: S.NonEmptyString.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("ApiReferenceModule", {
    description: "A generated module: its export path, source file, reflection JSON path, digest, and optional owning barrel.",
  })
) {}

/**
 * The per-package manifest referenced from a channel manifest.
 *
 * **Example** (Decode a package manifest)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ApiReferencePackageManifest } from "@beep/scratchpad/beep-docs/domain/ApiReference"
 *
 * const manifest = S.decodeUnknownSync(ApiReferencePackageManifest)({
 *   schemaVersion: 3,
 *   channel: "v4",
 *   name: "effect",
 *   version: "4.0.0",
 *   revision: "abc123",
 *   description: "The core Effect library.",
 *   npmUrl: "https://www.npmjs.com/package/effect",
 *   sourceUrl: "https://github.com/Effect-TS/effect",
 *   barrels: [],
 *   modules: [],
 * })
 * console.log(manifest.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ApiReferencePackageManifest extends S.Class<ApiReferencePackageManifest>(
  $I`ApiReferencePackageManifest`
)(
  {
    schemaVersion: S.Literal(3),
    channel: ApiChannel,
    name: S.NonEmptyString,
    version: S.NonEmptyString,
    revision: S.NonEmptyString,
    description: S.NonEmptyString,
    npmUrl: S.URLFromString,
    sourceUrl: S.URLFromString,
    barrels: S.Array(ApiReferenceBarrel),
    modules: S.Array(ApiReferenceModule),
  },
  $I.annote("ApiReferencePackageManifest", {
    description: "Package-level manifest listing the barrels and modules generated for one package in one channel.",
  })
) {}
