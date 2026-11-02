/**
 * Hold site collection: read the checkout's hold-shaped config entries into a
 * {@link HoldSiteSnapshot} for `beep holds lint`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Node, SyntaxKind } from "ts-morph";
import { decodeTomlTextWith } from "../../internal/schema/TextCodec.ts";
import { createInMemoryTsMorphProject } from "../../internal/tsmorph/ProjectFactory.ts";
import { HoldsError, holdsPlatformError } from "./Holds.errors.ts";
import { HoldAnchor, HoldSiteSnapshot } from "./Holds.schemas.ts";
import { holdLedgerDirectory, syncpackHeldListFile } from "./Holds.service.ts";

const $I = $RepoCliId.create("commands/Holds/Holds.sites");

const StringRecord = S.optionalKey(S.Record(S.String, S.String));

const RootManifest = S.Struct({
  catalog: StringRecord,
  overrides: StringRecord,
  patchedDependencies: StringRecord,
});

const WorkspaceManifest = S.Struct({
  dependencies: StringRecord,
  devDependencies: StringRecord,
  optionalDependencies: StringRecord,
  peerDependencies: StringRecord,
});

const OsvPackageOverride = S.Struct({ name: S.optionalKey(S.String) });

const OsvConfig = S.Struct({
  PackageOverrides: S.optionalKey(OsvPackageOverride.pipe(S.Array)),
});

const decodeRootManifest = S.decodeUnknownEffect(S.fromJsonString(RootManifest));
const decodeWorkspaceManifest = S.decodeUnknownEffect(S.fromJsonString(WorkspaceManifest));
const decodeHeldList = S.decodeUnknownEffect(S.fromJsonString(S.Array(S.String)));
const decodeOsvConfig = decodeTomlTextWith(S.decodeUnknownEffect(OsvConfig));

// Read the labels from the syntax tree: comments and quote style must not change what counts as a group.
const syncpackVersionGroupLabels = (text: string): ReadonlyArray<string> =>
  pipe(
    createInMemoryTsMorphProject()
      .createSourceFile("syncpack.config.ts", text, { overwrite: true })
      .getDescendantsOfKind(SyntaxKind.PropertyAssignment),
    A.filter((property) => property.getName() === "versionGroups"),
    A.flatMap((property) =>
      O.toArray(O.fromUndefinedOr(property.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression)))
    ),
    A.flatMap((groups) => groups.getElements()),
    A.flatMap((group) =>
      Node.isObjectLiteralExpression(group) ? O.toArray(O.fromUndefinedOr(group.getProperty("label"))) : []
    ),
    A.flatMap((label) =>
      Node.isPropertyAssignment(label) ? O.toArray(O.fromUndefinedOr(label.getInitializer())) : []
    ),
    A.flatMap((value) =>
      Node.isStringLiteral(value) || Node.isNoSubstitutionTemplateLiteral(value) ? [value.getLiteralValue()] : []
    )
  );

const keysOf = (record: Readonly<Record<string, string>> | undefined): ReadonlyArray<string> =>
  O.match(O.fromUndefinedOr(record), { onNone: () => [], onSome: R.keys });

const decodeFailure = (file: string) => (cause: unknown) =>
  HoldsError.make({ reason: "decode", message: `Could not decode ${file}.`, cause });

/**
 * Reads the hold-shaped config sites of one checkout.
 *
 * **Example** (Read a snapshot through the shape)
 *
 * ```ts
 * import type { HoldSitesShape } from "@beep/repo-cli/commands/Holds"
 *
 * const snapshot = (sites: HoldSitesShape) => sites.snapshot([])
 * console.log(typeof snapshot) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface HoldSitesShape {
  /** Collect the snapshot; `manifests` are the workspace manifests that ledger anchors name. */
  readonly snapshot: (manifests: ReadonlyArray<string>) => Effect.Effect<HoldSiteSnapshot, HoldsError>;
}

/**
 * Service tag for {@link HoldSitesShape}.
 *
 * **Example** (Use the site service)
 *
 * ```ts
 * import { HoldSites } from "@beep/repo-cli/commands/Holds"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const sites = yield* HoldSites
 *   return yield* sites.snapshot([])
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class HoldSites extends Context.Service<HoldSites, HoldSitesShape>()($I`HoldSites`) {}

/**
 * Build the file-backed site reader for a repository checkout.
 *
 * **Details**
 *
 * Root overrides, patched dependencies and OSV package overrides are required
 * sites. Root catalog entries, syncpack version-group labels and the named
 * workspace manifests' dependencies are present sites only.
 *
 * **Example** (Build the reader for a checkout)
 *
 * ```ts
 * import { makeHoldSites } from "@beep/repo-cli/commands/Holds"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeHoldSites("."))) // true
 * ```
 *
 * @param repoRoot - Absolute path of the checkout.
 * @returns The site service.
 * @category layers
 * @since 0.0.0
 */
export const makeHoldSites = Effect.fn("HoldSites.make")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const readText = (relative: string) =>
    fs
      .readFileString(path.join(repoRoot, relative))
      .pipe(Effect.mapError(holdsPlatformError(`Could not read ${relative}`)));

  const readOptionalText = Effect.fn("HoldSites.readOptional")(function* (relative: string) {
    const exists = yield* fs
      .exists(path.join(repoRoot, relative))
      .pipe(Effect.mapError(holdsPlatformError(`Could not stat ${relative}`)));
    return exists ? O.some(yield* readText(relative)) : O.none();
  });

  const manifestSites = Effect.fn("HoldSites.manifest")(function* (manifest: string) {
    const decoded = yield* readOptionalText(manifest).pipe(
      Effect.flatMap(
        O.match({
          onNone: () => Effect.succeedNone,
          onSome: (text) => Effect.asSome(decodeWorkspaceManifest(text)),
        })
      ),
      Effect.mapError(decodeFailure(manifest))
    );
    return pipe(
      O.toArray(decoded),
      A.flatMap((json) => [
        ...keysOf(json.dependencies),
        ...keysOf(json.devDependencies),
        ...keysOf(json.optionalDependencies),
        ...keysOf(json.peerDependencies),
      ]),
      A.map((packageName) => HoldAnchor.cases.ManifestDependency.make({ manifest, packageName }))
    );
  });

  const snapshot = Effect.fn("HoldSites.snapshot")(function* (manifests: ReadonlyArray<string>) {
    const root = yield* readText("package.json").pipe(
      Effect.flatMap((text) => decodeRootManifest(text).pipe(Effect.mapError(decodeFailure("package.json"))))
    );
    const osv = yield* readOptionalText("osv-scanner.toml").pipe(
      Effect.flatMap(
        O.match({
          onNone: () => Effect.succeedNone,
          onSome: (text) => Effect.asSome(decodeOsvConfig(text)),
        })
      ),
      Effect.mapError(decodeFailure("osv-scanner.toml"))
    );
    const syncpackText = yield* readOptionalText("syncpack.config.ts");
    const heldListPath = `${holdLedgerDirectory}/${syncpackHeldListFile}`;
    const heldList = yield* readOptionalText(heldListPath).pipe(
      Effect.flatMap(
        O.match({
          onNone: () => Effect.succeed<ReadonlyArray<string>>([]),
          onSome: (text) => decodeHeldList(text).pipe(Effect.mapError(decodeFailure(heldListPath))),
        })
      )
    );
    const manifestAnchors = yield* Effect.forEach(A.dedupe(manifests), manifestSites);
    const required = [
      ...A.map(keysOf(root.overrides), (packageName) => HoldAnchor.cases.RootOverride.make({ packageName })),
      ...A.map(keysOf(root.patchedDependencies), (key) => HoldAnchor.cases.PatchedDependency.make({ key })),
      ...pipe(
        O.flatMap(osv, (config) => O.fromUndefinedOr(config.PackageOverrides)),
        O.match({ onNone: A.empty<typeof OsvPackageOverride.Type>, onSome: A.fromIterable }),
        A.map((entry) => O.fromUndefinedOr(entry.name)),
        A.getSomes,
        A.dedupe,
        A.map((packageName) => HoldAnchor.cases.OsvPackageOverride.make({ packageName }))
      ),
    ];
    const versionGroups = pipe(
      O.toArray(syncpackText),
      A.flatMap(syncpackVersionGroupLabels),
      A.map((label) => HoldAnchor.cases.SyncpackVersionGroup.make({ label }))
    );
    const present = [
      ...required,
      ...A.map(keysOf(root.catalog), (packageName) => HoldAnchor.cases.CatalogEntry.make({ packageName })),
      ...versionGroups,
      ...A.flatten(manifestAnchors),
    ];
    return HoldSiteSnapshot.make({ required, present, heldList });
  });

  return HoldSites.of({ snapshot });
});

/**
 * Layer providing {@link HoldSites} for one checkout.
 *
 * **Example** (Provide the site reader)
 *
 * ```ts
 * import { layerHoldSites } from "@beep/repo-cli/commands/Holds"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerHoldSites("."))) // true
 * ```
 *
 * @param repoRoot - Absolute path of the checkout.
 * @returns A layer that needs `FileSystem` and `Path`.
 * @category layers
 * @since 0.0.0
 */
export const layerHoldSites = (repoRoot: string) => Layer.effect(HoldSites, makeHoldSites(repoRoot));
