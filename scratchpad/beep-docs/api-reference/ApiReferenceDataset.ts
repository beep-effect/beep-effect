/**
 * Walks an API reference dataset directory (`<base>/<channel>/manifest.json`
 * plus per-package manifests) and produces one {@link ApiReferenceDatasetEntry}
 * per generated module.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { Effect, FileSystem, HashSet, Path } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import type * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
    ApiChannel,
    ApiReferenceDatasetManifest,
    ApiReferenceDatasetPackage,
    ApiReferenceEntry,
    ApiReferenceModule,
    ApiReferencePackageManifest,
    ModulePath,
    ModulePathFromExportPath,
    PackageSlug,
    PackageSlugFromPackageName,
} from "../domain/ApiReference.ts";
import { PathEscapesDataset, resolveWithinDataset } from "./DatasetPath.ts";

const $I = $ScratchpadId.create("beep-docs/api-reference/ApiReferenceDataset");

/**
 * One module discovered in the dataset: its content-collection id, the
 * absolute path of its reflection JSON, and the {@link ApiReferenceEntry}
 * payload.
 *
 * **Example** (Read the id)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ApiReferenceDatasetEntry } from "@beep/scratchpad/beep-docs/api-reference/ApiReferenceDataset"
 *
 * const entry = S.decodeUnknownSync(ApiReferenceDatasetEntry)({
 *   id: "v4/effect/Option",
 *   reflectionPath: "/data/api-reference/v4/effect/Option.json",
 *   data: {
 *     version: "v4",
 *     revision: "abc123",
 *     packageName: "effect",
 *     packageSlug: "effect",
 *     packageVersion: "4.0.0",
 *     packageDescription: "The core Effect library.",
 *     packageModuleCount: 1,
 *     packageNpmUrl: "https://www.npmjs.com/package/effect",
 *     packageSourceUrl: "https://github.com/Effect-TS/effect",
 *     modulePath: "Option",
 *     exportPath: "./Option",
 *     sourcePath: "src/Option.ts",
 *     reflectionPath: "v4/effect/Option.json",
 *     reflectionDigest: "a".repeat(64),
 *     typedocSchemaVersion: "2.0",
 *   },
 * })
 * console.log(entry.id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ApiReferenceDatasetEntry extends S.Class<ApiReferenceDatasetEntry>($I`ApiReferenceDatasetEntry`)(
  {
    data: ApiReferenceEntry,
    id: S.String,
    reflectionPath: S.String,
  },
  $I.annote("ApiReferenceDatasetEntry", {
    description: "A generated module discovered in the dataset, keyed by `<channel>/<package-slug>/<module-path>`.",
  })
) {}

/**
 * Raised when a dataset file or directory cannot be read.
 *
 * **Example** (Construct the error)
 *
 * ```ts
 * import { DatasetReadFailed } from "@beep/scratchpad/beep-docs/api-reference/ApiReferenceDataset"
 *
 * console.log(DatasetReadFailed.make({ path: "/data/v4/manifest.json", cause: "EACCES" })._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DatasetReadFailed extends S.TaggedError<DatasetReadFailed>($I`DatasetReadFailed`)(
  "DatasetReadFailed",
  {
    path: S.String,
    cause: S.Defect({ includeStack: true }),
  },
  $I.annote("DatasetReadFailed", {
    description: "A dataset file or directory could not be read.",
  })
) {}

/**
 * Raised when a manifest is not valid JSON for its schema.
 *
 * **Example** (Construct the error)
 *
 * ```ts
 * import { DatasetDecodeFailed } from "@beep/scratchpad/beep-docs/api-reference/ApiReferenceDataset"
 *
 * console.log(DatasetDecodeFailed.make({ path: "/data/v4/manifest.json", cause: "bad json" })._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DatasetDecodeFailed extends S.TaggedError<DatasetDecodeFailed>($I`DatasetDecodeFailed`)(
  "DatasetDecodeFailed",
  {
    path: S.String,
    cause: S.Defect({ includeStack: true }),
  },
  $I.annote("DatasetDecodeFailed", {
    description: "A manifest did not decode against its schema.",
  })
) {}

/**
 * Raised when a channel manifest declares a channel other than the directory
 * it lives in.
 *
 * **Example** (Construct the error)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DatasetChannelMismatch } from "@beep/scratchpad/beep-docs/api-reference/ApiReferenceDataset"
 *
 * const error = S.decodeSync(DatasetChannelMismatch)({ _tag: "DatasetChannelMismatch", manifestPath: "/data/v4/manifest.json", expected: "v4", declared: "v3" })
 * console.log(error.declared)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DatasetChannelMismatch extends S.TaggedError<DatasetChannelMismatch>($I`DatasetChannelMismatch`)(
  "DatasetChannelMismatch",
  {
    manifestPath: S.String,
    expected: ApiChannel,
    declared: ApiChannel,
  },
  $I.annote("DatasetChannelMismatch", {
    description: "A channel manifest declares a different channel than its directory name.",
  })
) {}

/**
 * Raised when a package manifest disagrees with the channel manifest entry
 * that referenced it (channel, revision, name, or version).
 *
 * **Example** (Construct the error)
 *
 * ```ts
 * import { PackageManifestMismatch } from "@beep/scratchpad/beep-docs/api-reference/ApiReferenceDataset"
 *
 * console.log(PackageManifestMismatch.make({ manifestPath: "/data/v4/effect/manifest.json" })._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PackageManifestMismatch extends S.TaggedError<PackageManifestMismatch>($I`PackageManifestMismatch`)(
  "PackageManifestMismatch",
  {
    manifestPath: S.String,
  },
  $I.annote("PackageManifestMismatch", {
    description: "A package manifest does not match the channel manifest entry that referenced it.",
  })
) {}

/**
 * Raised when two differently named packages in one channel derive the same
 * URL slug.
 *
 * **Example** (Construct the error)
 *
 * ```ts
 * import { PackageSlugCollision } from "@beep/scratchpad/beep-docs/api-reference/ApiReferenceDataset"
 *
 * const error = PackageSlugCollision.make({ slug: "platform", packageNames: ["@effect/platform", "platform"] })
 * console.log(error.packageNames.length)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PackageSlugCollision extends S.TaggedError<PackageSlugCollision>($I`PackageSlugCollision`)(
  "PackageSlugCollision",
  {
    slug: S.String,
    packageNames: S.Array(S.String),
  },
  $I.annote("PackageSlugCollision", {
    description: "Two differently named packages in one channel share a URL slug.",
  })
) {}

/**
 * Raised when a module names a barrel the package manifest does not declare.
 *
 * **Example** (Construct the error)
 *
 * ```ts
 * import { UnknownBarrel } from "@beep/scratchpad/beep-docs/api-reference/ApiReferenceDataset"
 *
 * const error = UnknownBarrel.make({ manifestPath: "/data/v4/effect/manifest.json", moduleExport: "./Option", barrel: "./missing" })
 * console.log(error.barrel)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class UnknownBarrel extends S.TaggedError<UnknownBarrel>($I`UnknownBarrel`)(
  "UnknownBarrel",
  {
    manifestPath: S.String,
    moduleExport: S.String,
    barrel: S.String,
  },
  $I.annote("UnknownBarrel", {
    description: "A module references a barrel export the package manifest does not declare.",
  })
) {}

/**
 * Raised when a package name cannot be turned into a URL slug.
 *
 * **Example** (Construct the error)
 *
 * ```ts
 * import { PackageSlugDerivationFailed } from "@beep/scratchpad/beep-docs/api-reference/ApiReferenceDataset"
 *
 * console.log(PackageSlugDerivationFailed.make({ packageName: "@other/Pkg", cause: "invalid slug" })._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PackageSlugDerivationFailed extends S.TaggedError<PackageSlugDerivationFailed>(
  $I`PackageSlugDerivationFailed`
)(
  "PackageSlugDerivationFailed",
  {
    packageName: S.String,
    cause: S.Defect({ includeStack: true }),
  },
  $I.annote("PackageSlugDerivationFailed", {
    description: "A package name did not derive a valid URL slug.",
  })
) {}

/**
 * Raised when an export path cannot be turned into a module path.
 *
 * **Example** (Construct the error)
 *
 * ```ts
 * import { ModulePathDerivationFailed } from "@beep/scratchpad/beep-docs/api-reference/ApiReferenceDataset"
 *
 * console.log(ModulePathDerivationFailed.make({ exportPath: "./../x", cause: "invalid segment" })._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ModulePathDerivationFailed extends S.TaggedError<ModulePathDerivationFailed>(
  $I`ModulePathDerivationFailed`
)(
  "ModulePathDerivationFailed",
  {
    exportPath: S.String,
    cause: S.Defect({ includeStack: true }),
  },
  $I.annote("ModulePathDerivationFailed", {
    description: "A package export path did not derive a valid module path.",
  })
) {}

/**
 * Every failure {@link loadApiReferenceDataset} can raise.
 *
 * **Example** (Guard a failure)
 *
 * ```ts
 * import { DatasetReadFailed, LoadApiReferenceDatasetError } from "@beep/scratchpad/beep-docs/api-reference/ApiReferenceDataset"
 *
 * const error = DatasetReadFailed.make({ path: "/data/v4/manifest.json", cause: "EACCES" })
 * console.log(LoadApiReferenceDatasetError.guards.DatasetReadFailed(error)) // true
 * console.log(LoadApiReferenceDatasetError.guards.PathEscapesDataset(error)) // false
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const LoadApiReferenceDatasetError = S.Union([
  PathEscapesDataset,
  DatasetReadFailed,
  DatasetDecodeFailed,
  DatasetChannelMismatch,
  PackageManifestMismatch,
  PackageSlugCollision,
  UnknownBarrel,
  PackageSlugDerivationFailed,
  ModulePathDerivationFailed,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("LoadApiReferenceDatasetError", {
    description: "Typed failures raised while loading an API reference dataset.",
  })
);

/**
 * Decoded type of {@link LoadApiReferenceDatasetError}.
 *
 * @category errors
 * @since 0.0.0
 */
export type LoadApiReferenceDatasetError = typeof LoadApiReferenceDatasetError.Type;

const isApiChannel: P.Refinement<string, ApiChannel> = S.is(ApiChannel);
const channelEquivalence = S.toEquivalence(ApiChannel);

const isNotFound = (error: PlatformError.PlatformError): boolean => P.isTagged("NotFound")(error.reason);

const readJsonFile = <Sch extends S.Top>(schema: Sch) => {
  const decode = S.decodeEffect(S.fromJsonString(schema));
  return Effect.fn("ApiReferenceDataset.readJsonFile")(function* (path: string) {
    const fs = yield* FileSystem.FileSystem;
    const text = yield* fs
      .readFileString(path)
      .pipe(Effect.mapError((cause) => DatasetReadFailed.make({ path, cause })));
    return yield* decode(text).pipe(Effect.mapError((cause) => DatasetDecodeFailed.make({ path, cause })));
  });
};

const readDatasetManifest = readJsonFile(ApiReferenceDatasetManifest);
const readPackageManifest = readJsonFile(ApiReferencePackageManifest);

const decodeModulePath = S.decodeEffect(ModulePathFromExportPath);
const decodePackageSlug = S.decodeEffect(PackageSlugFromPackageName);

const modulePathFromExportPath = Effect.fn("ApiReferenceDataset.modulePathFromExportPath")(function* (
  exportPath: string
) {
  return yield* decodeModulePath(exportPath).pipe(
    Effect.mapError((cause) => ModulePathDerivationFailed.make({ exportPath, cause }))
  );
});

const readChannelDirectories = Effect.fn("ApiReferenceDataset.readChannelDirectories")(function* (
  baseDirectory: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const names: ReadonlyArray<string> = yield* fs
    .readDirectory(baseDirectory)
    .pipe(
      Effect.catch((cause) =>
        isNotFound(cause)
          ? Effect.succeed(A.empty<string>())
          : Effect.fail(DatasetReadFailed.make({ path: baseDirectory, cause }))
      )
    );
  const isDirectory = (name: ApiChannel): Effect.Effect<boolean, DatasetReadFailed> => {
    const entryPath = path.join(baseDirectory, name);
    return fs.stat(entryPath).pipe(
      Effect.map((info) => Eq.equals(info.type, "Directory")),
      Effect.mapError((cause) => DatasetReadFailed.make({ path: entryPath, cause }))
    );
  };
  const candidates: ReadonlyArray<ApiChannel> = A.filter(names, isApiChannel);
  const channels: ReadonlyArray<ApiChannel> = yield* Effect.filter(candidates, isDirectory, { concurrency: 8 });
  return A.sort(channels, Str.Order);
});

interface LoadedPackage {
  readonly slug: PackageSlug;
  readonly name: string;
  readonly entries: ReadonlyArray<ApiReferenceDatasetEntry>;
}

const findSlugCollision = (packages: ReadonlyArray<LoadedPackage>): O.Option<PackageSlugCollision> =>
  pipe(
    A.groupBy(packages, (loaded) => loaded.slug),
    R.toEntries,
    A.findFirst(([slug, group]) =>
      pipe(
        A.map(group, (loaded) => loaded.name),
        A.dedupe,
        O.liftPredicate((names) => A.length(names) > 1),
        O.map((packageNames) => PackageSlugCollision.make({ slug, packageNames }))
      )
    )
  );

const ensureKnownBarrel = (
  manifestPath: string,
  barrelExports: HashSet.HashSet<string>,
  module: ApiReferenceModule
): Effect.Effect<void, UnknownBarrel> =>
  pipe(
    module.barrel,
    O.filter(P.not((barrel) => HashSet.has(barrelExports, barrel))),
    O.map((barrel) => Effect.fail(UnknownBarrel.make({ manifestPath, moduleExport: module.export, barrel }))),
    O.getOrElse(() => Effect.void)
  );

const loadModule = Effect.fn("ApiReferenceDataset.loadModule")(function* (input: {
  readonly baseDirectory: string;
  readonly dataset: ApiReferenceDatasetManifest;
  readonly packageManifest: ApiReferencePackageManifest;
  readonly packageManifestPath: string;
  readonly packageDirectory: string;
  readonly packageSlug: PackageSlug;
  readonly barrelExports: HashSet.HashSet<string>;
  readonly module: ApiReferenceModule;
}) {
  const path = yield* Path.Path;
  yield* ensureKnownBarrel(input.packageManifestPath, input.barrelExports, input.module);
  const modulePath = yield* modulePathFromExportPath(input.module.export);
  const barrelPath = yield* pipe(
    input.module.barrel,
    O.map((barrel) => modulePathFromExportPath(barrel).pipe(Effect.asSome)),
    O.getOrElse(() => Effect.succeed(O.none<ModulePath>()))
  );
  const reflectionPath = yield* resolveWithinDataset(input.packageDirectory, input.module.json);
  return ApiReferenceDatasetEntry.make({
    id: `${input.dataset.channel}/${input.packageSlug}/${modulePath}`,
    reflectionPath,
    data: ApiReferenceEntry.make({
      version: input.dataset.channel,
      revision: input.dataset.revision,
      packageName: input.packageManifest.name,
      packageSlug: input.packageSlug,
      packageVersion: input.packageManifest.version,
      packageDescription: input.packageManifest.description,
      packageModuleCount: A.length(input.packageManifest.modules),
      packageNpmUrl: input.packageManifest.npmUrl,
      packageSourceUrl: input.packageManifest.sourceUrl,
      modulePath,
      barrelPath,
      exportPath: input.module.export,
      sourcePath: input.module.source,
      reflectionPath: path.relative(input.baseDirectory, reflectionPath),
      reflectionDigest: input.module.sha256,
      typedocSchemaVersion: input.dataset.typedocSchemaVersion,
    }),
  });
});

const loadPackage = Effect.fn("ApiReferenceDataset.loadPackage")(function* (input: {
  readonly baseDirectory: string;
  readonly channelDirectory: string;
  readonly dataset: ApiReferenceDatasetManifest;
  readonly packageEntry: ApiReferenceDatasetPackage;
}) {
  const path = yield* Path.Path;
  const packageManifestPath = yield* resolveWithinDataset(input.channelDirectory, input.packageEntry.manifest);
  const packageManifest = yield* readPackageManifest(packageManifestPath);
  const matchesDataset =
    channelEquivalence(packageManifest.channel, input.dataset.channel) &&
    Eq.equals(packageManifest.revision, input.dataset.revision) &&
    Eq.equals(packageManifest.name, input.packageEntry.name) &&
    Eq.equals(packageManifest.version, input.packageEntry.version);
  if (!matchesDataset) {
    return yield* PackageManifestMismatch.make({ manifestPath: packageManifestPath });
  }
  const packageSlug = yield* decodePackageSlug(packageManifest.name).pipe(
    Effect.mapError((cause) => PackageSlugDerivationFailed.make({ packageName: packageManifest.name, cause }))
  );
  const packageDirectory = path.dirname(packageManifestPath);
  const barrelExports = HashSet.fromIterable(A.map(packageManifest.barrels, (barrel) => barrel.export));
  const entries = yield* Effect.forEach(
    packageManifest.modules,
    (module) =>
      loadModule({
        baseDirectory: input.baseDirectory,
        dataset: input.dataset,
        packageManifest,
        packageManifestPath,
        packageDirectory,
        packageSlug,
        barrelExports,
        module,
      }),
    { concurrency: 4 }
  );
  const loaded: LoadedPackage = { slug: packageSlug, name: packageManifest.name, entries };
  return loaded;
});

const loadChannel = Effect.fn("ApiReferenceDataset.loadChannel")(function* (baseDirectory: string, channel: ApiChannel) {
  const path = yield* Path.Path;
  const channelDirectory = path.join(baseDirectory, channel);
  const datasetManifestPath = path.join(channelDirectory, "manifest.json");
  const dataset = yield* readDatasetManifest(datasetManifestPath);
  if (!channelEquivalence(dataset.channel, channel)) {
    return yield* DatasetChannelMismatch.make({ manifestPath: datasetManifestPath, expected: channel, declared: dataset.channel });
  }
  const packages = yield* Effect.forEach(
    dataset.packages,
    (packageEntry) => loadPackage({ baseDirectory, channelDirectory, dataset, packageEntry }),
    { concurrency: 4 }
  );
  yield* pipe(
    findSlugCollision(packages),
    O.map(Effect.fail),
    O.getOrElse(() => Effect.void)
  );
  return A.flatMap(packages, (loaded) => loaded.entries);
});

/**
 * Loads every module entry from an API reference dataset rooted at
 * `baseDirectory`.
 *
 * **Details**
 *
 * Channel directories (`v3`, `v4`, ...) are discovered by name and sorted;
 * each channel manifest is validated against its directory, each package
 * manifest against its channel entry, and every manifest-supplied path is
 * kept inside the dataset. A missing `baseDirectory` yields an empty list.
 *
 * **Example** (Load a dataset with Bun services)
 *
 * ```ts
 * import { BunServices } from "@effect/platform-bun"
 * import { Effect } from "effect"
 * import { loadApiReferenceDataset } from "@beep/scratchpad/beep-docs/api-reference/ApiReferenceDataset"
 *
 * const program = loadApiReferenceDataset(".data/api-reference").pipe(
 *   Effect.map((entries) => entries.map((entry) => entry.id)),
 *   Effect.provide(BunServices.layer)
 * )
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const loadApiReferenceDataset = Effect.fn("ApiReferenceDataset.loadApiReferenceDataset")(function* (
  baseDirectory: string
) {
  const channels = yield* readChannelDirectories(baseDirectory);
  const entries = yield* Effect.forEach(channels, (channel) => loadChannel(baseDirectory, channel), {
    concurrency: 2,
  });
  return A.flatten(entries);
});
