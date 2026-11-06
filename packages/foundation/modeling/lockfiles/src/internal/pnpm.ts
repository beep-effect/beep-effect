import { $LockfilesId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { LockfileImporter } from "../LockfileImporter.ts";
import { PnpmCatalogs, PnpmExtension } from "../PnpmExtension.ts";
import { ResolvedPackage } from "../ResolvedPackage.ts";
import { splitPnpmStream } from "./documents.ts";
import {
  extractWorkspaceDeps,
  framingFailure,
  gatePnpmVersion,
  importerDependencies,
  LockfileFields,
  PackageResolution,
  partitionEdges,
  peerDeclarations,
  slashPrefixes,
  splitNameVersion,
  splitPeerSuffix,
  toIntegrityHash,
  validationFailure,
  workspaceEntryOf,
} from "./shared.ts";
import type { DependencyMap, ParseFailure, ResolvedEdges, WorkspaceEntry } from "./shared.ts";

const $I = $LockfilesId.create("internal/pnpm");

// ── Raw schema (permissive validation scaffolding, not API) ────────────────

const PnpmImporterDeps = S.optionalKey(
  S.Record(
    S.String,
    S.Struct({
      specifier: S.String.pipe(
        $I.annoteKey("PnpmImporterDeps.specifier", {
          description: "Dependency specifier declared by the importer or catalog",
        })
      ),
      version: S.String.pipe(
        $I.annoteKey("PnpmImporterDeps.version", {
          description: "Recorded package version or resolved dependency version",
        })
      ),
    })
  )
).pipe(
  $I.annoteSchema("PnpmImporterDeps", {
    description: "Optional pnpm importer dependency map containing declared specifiers and resolved versions",
  })
);

const PnpmImporter = S.Struct({
  dependencies: PnpmImporterDeps.pipe(
    $I.annoteKey("PnpmImporter.dependencies", { description: "Declared runtime dependencies keyed by package name" })
  ),
  devDependencies: PnpmImporterDeps.pipe(
    $I.annoteKey("PnpmImporter.devDependencies", {
      description: "Declared development dependencies keyed by package name",
    })
  ),
  peerDependencies: PnpmImporterDeps.pipe(
    $I.annoteKey("PnpmImporter.peerDependencies", { description: "Declared peer dependencies keyed by package name" })
  ),
  optionalDependencies: PnpmImporterDeps.pipe(
    $I.annoteKey("PnpmImporter.optionalDependencies", {
      description: "Declared optional dependencies keyed by package name",
    })
  ),
  // `publishConfig.directory` surfaces here: pnpm records the directory a
  // workspace package's links actually point AT, importer-relative. It is the
  // exact evidence that lets a `link:<importer>/<publishDirectory>` edge name
  // its importer.
  publishDirectory: S.optionalKey(S.String).pipe(
    $I.annoteKey("PnpmImporter.publishDirectory", {
      description: "Importer-relative published directory targeted by workspace links",
    })
  ),
}).pipe(
  $I.annoteSchema("PnpmImporter", {
    description: "Permissive pnpm importer with declared dependency sections and optional published directory",
  })
);

const PnpmLockfileRaw = S.Struct({
  // The version gate owns non-finite rejection and preserves the recorded value in its typed cause.
  lockfileVersion: S.Union([S.String, S.Finite]).pipe(
    $I.annoteKey("PnpmLockfileRaw.lockfileVersion", {
      description: "Recorded format version, preserved verbatim before gating or string conversion",
    })
  ),
  settings: PnpmExtension.fields.settings,
  overrides: S.optionalKey(S.Record(S.String, S.String)).pipe(
    $I.annoteKey("PnpmLockfileRaw.overrides", { description: "Dependency resolution overrides preserved as recorded" })
  ),
  catalogs: S.optionalKey(PnpmCatalogs).pipe(
    $I.annoteKey("PnpmLockfileRaw.catalogs", { description: "Named dependency catalogs preserved as recorded" })
  ),
  importers: S.Record(S.String, PnpmImporter).pipe(
    $I.annoteKey("PnpmLockfileRaw.importers", { description: "Workspace importer entries recorded by the lockfile" })
  ),
  packages: S.optionalKey(
    S.Record(
      S.String,
      S.Struct({
        resolution: S.optionalKey(PackageResolution).pipe(
          $I.annoteKey("PnpmLockfileRaw.packages.resolution", { description: "Optional package resolution metadata" })
        ),
        peerDependencies: S.optionalKey(S.Record(S.String, S.String)).pipe(
          $I.annoteKey("PnpmLockfileRaw.packages.peerDependencies", {
            description: "Declared peer dependencies keyed by package name",
          })
        ),
        peerDependenciesMeta: S.optionalKey(
          S.Record(
            S.String,
            S.Struct({
              optional: S.optionalKey(S.Boolean).pipe(
                $I.annoteKey("PnpmLockfileRaw.packages.peerDependenciesMeta.optional", {
                  description: "Whether this peer dependency is optional",
                })
              ),
            })
          )
        ).pipe(
          $I.annoteKey("PnpmLockfileRaw.packages.peerDependenciesMeta", {
            description: "Optionality metadata keyed by peer dependency name",
          })
        ),
        // Pre-v9 lockfiles carry resolution inline here, since they have no
        // `snapshots:` section to carry it.
        dependencies: S.optionalKey(S.Record(S.String, S.String)).pipe(
          $I.annoteKey("PnpmLockfileRaw.packages.dependencies", {
            description: "Declared runtime dependencies keyed by package name",
          })
        ),
        optionalDependencies: S.optionalKey(S.Record(S.String, S.String)).pipe(
          $I.annoteKey("PnpmLockfileRaw.packages.optionalDependencies", {
            description: "Declared optional dependencies keyed by package name",
          })
        ),
      })
    )
  ).pipe(
    $I.annoteKey("PnpmLockfileRaw.packages", { description: "Resolved package entries in lockfile traversal order" })
  ),
  // Lockfile v9 split per-*instance* resolution out of `packages:` into its
  // own section; earlier versions carry both in `packages:`.
  snapshots: S.optionalKey(
    S.Record(
      S.String,
      S.Struct({
        dependencies: S.optionalKey(S.Record(S.String, S.String)).pipe(
          $I.annoteKey("PnpmLockfileRaw.snapshots.dependencies", {
            description: "Declared runtime dependencies keyed by package name",
          })
        ),
        optionalDependencies: S.optionalKey(S.Record(S.String, S.String)).pipe(
          $I.annoteKey("PnpmLockfileRaw.snapshots.optionalDependencies", {
            description: "Declared optional dependencies keyed by package name",
          })
        ),
      })
    )
  ).pipe(
    $I.annoteKey("PnpmLockfileRaw.snapshots", {
      description: "Per-instance dependency sections keyed by pnpm snapshot identity",
    })
  ),
}).pipe(
  $I.annoteSchema("PnpmLockfileRaw", {
    description: "Supported pnpm document with importer entries, version metadata and per-instance snapshots",
  })
);

type PnpmLockfileRawType = typeof PnpmLockfileRaw.Type;
type PnpmImporterType = typeof PnpmImporter.Type;
type PnpmPackageEntry = NonNullable<PnpmLockfileRawType["packages"]>[string];

const decodePnpmLockfileRaw = S.decodeUnknownEffect(PnpmLockfileRaw);

/**
 * Parse pnpm `pnpm-lock.yaml` content into the unified field bundle.
 *
 * **Details**
 *
 * `pnpm-lock.yaml` is a YAML *stream*, not a single document: a workspace
 * using `configDependencies` gets a config-dependencies preamble document
 * ahead of the lockfile. {@link splitPnpmStream} locates the lockfile
 * deterministically (it is the last document); the preamble is never read as
 * the lockfile.
 *
 * An empty main document after a preamble is **ambiguous**: pnpm 11 and 12
 * write exactly those bytes both for a config-dependency-only workspace with
 * no root `package.json` and for a workspace whose first install failed after
 * its config dependencies were installed. The bytes cannot tell the two apart,
 * so the parser does not decide: only when the caller asserts `configOnly`
 * (it knows the root has no `package.json`) does the stream read as an empty
 * lockfile — no packages, importers or workspace edges, versioned by the
 * preamble's `lockfileVersion` after the preamble passes the same version
 * gate. The preamble's own packages are config dependencies, not the
 * workspace's, so none of them is reported. Without the assertion, and always
 * when there is no preamble to vouch for the stream, an empty main document
 * fails `noLockfileDocument`. The flag loosens nothing else.
 *
 * Workspace packages are keyed by importer *path* with version `"0.0.0"`;
 * `Lockfile#withImporterNames` is the explicit second stage that rewrites
 * them to real names.
 *
 * **Example** (Parse a dependency-free pnpm workspace)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { parsePnpm } from "@beep/lockfiles/internal/pnpm";
 *
 * const fields = Effect.runSync(parsePnpm("lockfileVersion: 9\nimporters:\n  .: {}", false));
 * console.log(fields.lockfileVersion) // 9
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const parsePnpm: {
  (configOnly: boolean): (content: string) => Effect.Effect<LockfileFields, ParseFailure>;
  (content: string, configOnly: boolean): Effect.Effect<LockfileFields, ParseFailure>;
} = dual(
  2,
  Effect.fnUntraced(function* (content: string, configOnly: boolean) {
    const { preamble, main: document, documents } = yield* splitPnpmStream(content);
    if (document === undefined) {
      if (preamble === undefined || !configOnly) {
        return yield* Effect.fail(framingFailure("noLockfileDocument", documents));
      }
      const lockfileVersion = yield* gatePnpmVersion(preamble);
      return LockfileFields.make({
        lockfileVersion,
        packages: [],
        workspaceDependencies: [],
        importers: [],
        extension: { _tag: "pnpm" },
      });
    }
    // Format-version gate. Deliberately NOT a check for `snapshots:` being
    // present or populated: a dependency-free v9 workspace legitimately has
    // zero snapshot entries, so an emptiness guard would reject a valid
    // lockfile. Version is the format's own identity; emptiness is a
    // coincidence of content.
    //
    // It runs BEFORE the shape decode, and must: a pre-v9 single-project
    // lockfile carries no `importers` map, so decoding first would report a
    // too-old lockfile as malformed — losing the distinction the
    // `UnsupportedLockfileVersion` cause exists to carry.
    yield* gatePnpmVersion(document);
    const validated = yield* decodePnpmLockfileRaw(document).pipe(Effect.mapError(validationFailure));
    // pnpm always records at least the root importer ".", so a lockfile
    // document declaring no importers at all describes no workspace. Fail
    // typed rather than hand back an empty Lockfile — an empty result is
    // indistinguishable from "this workspace has no packages", which is the
    // shape that kept the multi-document bug invisible.
    if (R.isEmptyRecord(validated.importers)) {
      return yield* Effect.fail(framingFailure("noImporters", documents));
    }
    return yield* toFields(validated);
  })
);

// ── Transform ──────────────────────────────────────────────────────────────

/**
 * The protocol pnpm records a workspace-directory resolution under.
 *
 * @internal
 */
const LINK_PREFIX = "link:";

/**
 * The specifier protocol pnpm resolves through the workspace itself.
 *
 * @internal
 */
const WORKSPACE_PREFIX = "workspace:";

/**
 * Normalize a `link:` target against the linking importer's path, so a
 * workspace edge can name the workspace importer's instance id.
 * Total: a target that walks above the root yields `None`.
 *
 * **Details**
 *
 * A target that normalizes to NOTHING — `link:.` recorded root-relative —
 * also yields `None` rather than the root importer's ".": the root importer
 * deliberately emits no `ResolvedPackage` row (its path cannot serve as a
 * package name), so mapping the empty target to "." would hand back an id no
 * row carries, and no pnpm output recording that shape has been observed.
 * The edge stays honestly unnameable instead.
 *
 * **Example** (Resolve a root workspace link)
 *
 * ```ts
 * import { resolveLinkTarget } from "@beep/lockfiles/internal/pnpm"
 * import * as O from "effect/Option"
 * console.log(O.getOrUndefined(resolveLinkTarget("", "./packages/lib"))) // packages/lib
 * ```
 *
 * @category utilities
 * @since 0.0.0
 * @internal
 */
export const resolveLinkTarget: {
  (importerPath: string, target: string): O.Option<string>;
  (target: string): (importerPath: string) => O.Option<string>;
} = dual(
  2,
  (importerPath: string, target: string): O.Option<string> =>
    pipe(
      Str.split("/")(`${importerPath}/${target}`),
      A.reduce(O.some<ReadonlyArray<string>>([]), (segments, segment) => O.flatMap(segments, pushSegment(segment))),
      O.filter(A.isReadonlyArrayNonEmpty),
      O.map(A.join("/"))
    )
);

// One path segment applied to the normalized segments so far: `""` and `.`
// change nothing, `..` pops (and fails above the root), anything else appends.
const pushSegment =
  (segment: string) =>
  (segments: ReadonlyArray<string>): O.Option<ReadonlyArray<string>> => {
    if (segment === "" || segment === ".") return O.some(segments);
    if (segment !== "..") return O.some(A.append(segments, segment));
    return A.isReadonlyArrayNonEmpty(segments) ? O.some(A.dropRight(segments, 1)) : O.none();
  };

/**
 * The importer a `link:` target lands INSIDE, longest path first.
 *
 * **Details**
 *
 * pnpm's `publishConfig.linkDirectory` makes a workspace link point at the
 * package's publish directory rather than its root — `link:../bundler/dist/dev/pkg`
 * where `packages/bundler` is the importer — so the target itself is a build
 * output that is no importer and never will be. The owning importer is the
 * longest ancestor of the target that IS one; longest-first so a nested importer
 * beats its parent.
 *
 * The root importer (`"."`) is deliberately unreachable here: it is an ancestor
 * of every path in the workspace, so admitting it would resolve every stray link
 * to the root rather than leaving it unnamed.
 *
 * @internal
 */
const owningImporter: {
  (target: string, importerPaths: MutableHashSet.MutableHashSet<string>): O.Option<string>;
  (importerPaths: MutableHashSet.MutableHashSet<string>): (target: string) => O.Option<string>;
} = dual(
  2,
  (target: string, importerPaths: MutableHashSet.MutableHashSet<string>): O.Option<string> =>
    A.findFirst(A.reverse(slashPrefixes(target)), (candidate) => MutableHashSet.has(importerPaths, candidate))
);

/**
 * The instance a `name@version` edge composes to, verified against the
 * lockfile's own key set rather than trusted — the composed key is v9's bare
 * `name@version` and nothing else, because the format gate admits no lockfile
 * that spells keys the pre-v9 leading-slash way.
 *
 * **Details**
 *
 * A failed composition gets one second reading: the recorded version ITSELF as
 * an instance id. That is how pnpm spells an `npm:` alias — the dependency
 * `typescript-classic: npm:typescript@^6.0.3` is recorded as
 * `typescript-classic: typescript@6.0.3`, the referenced instance's own key,
 * peer suffix included when one applies. Still compose-then-verify, not a
 * guess: a plain version (`6.0.3`) can never be an instance id, because ids
 * always carry a name, so the reading admits exactly the alias shape.
 *
 * @internal
 */
const composedInstance = (name: string, version: string, instanceIds: PnpmIndex["instanceIds"]): O.Option<string> => {
  const bare = `${name}@${version}`;
  if (MutableHashSet.has(instanceIds, bare)) return O.some(bare);
  return MutableHashSet.has(instanceIds, version) ? O.some(version) : O.none();
};

/** The lockfile-wide sets every edge resolution reads. */
type PnpmIndex = {
  readonly instanceIds: MutableHashSet.MutableHashSet<string>;
  readonly importerPaths: MutableHashSet.MutableHashSet<string>;
  readonly publishDirTargets: MutableHashMap.MutableHashMap<string, string>;
};

// A link target that is an instance names it; one that is a DECLARED publish
// directory — `link:packages/lib/dist/dev/pkg` where `packages/lib` declares
// `publishDirectory: dist/dev/pkg` — names that importer on exact evidence.
const linkedInstance = (target: string, index: PnpmIndex): O.Option<string> =>
  MutableHashSet.has(index.instanceIds, target) ? O.some(target) : MutableHashMap.get(index.publishDirTargets, target);

/**
 * Resolve a normalized importer link using exact ids, declared publish
 * directories, then workspace-specifier ownership evidence.
 *
 * **Example** (Leave an unknown link unresolved)
 *
 * ```ts
 * import { resolveImporterLink } from "@beep/lockfiles/internal/pnpm";
 * import * as MutableHashMap from "effect/MutableHashMap";
 * import * as MutableHashSet from "effect/MutableHashSet";
 * import * as O from "effect/Option";
 *
 * console.log(O.isNone(resolveImporterLink("missing/dist", true, {
 *   instanceIds: MutableHashSet.empty<string>(),
 *   importerPaths: MutableHashSet.empty<string>(),
 *   publishDirTargets: MutableHashMap.empty<string, string>()
 * }))); // true
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const resolveImporterLink: {
  (target: string, workspace: boolean, index: PnpmIndex): O.Option<string>;
  (workspace: boolean, index: PnpmIndex): (target: string) => O.Option<string>;
} = dual(
  3,
  (target: string, workspace: boolean, index: PnpmIndex): O.Option<string> =>
    O.orElse(linkedInstance(target, index), () => (workspace ? owningImporter(target, index.importerPaths) : O.none()))
);

/**
 * Resolve one snapshot edge to an instance id.
 *
 * **Details**
 *
 * A `link:` resolution names a directory, not a registry version, so
 * `name@link:...` composes to nothing. pnpm records the same edge twice in two
 * spellings: the snapshot body keeps the readable `link:<path>` while the peer
 * suffix carries a MANGLED identity (`react@packages+fakereact`) that appears
 * nowhere as a key. Neither spelling composes, and a dropped edge for a peer
 * reads one layer up as an unsatisfied peer, turning a satisfied `link:` into a
 * false positive, so the edge is resolved explicitly.
 *
 * A snapshot's `link:` target is recorded relative to the workspace ROOT
 * (importer sections record theirs relative to the importer), so it is
 * normalized against the root and matched against the instance ids, where a
 * workspace importer's id is its path. A `link:` into a directory that is no
 * importer and no declared publish directory — a build output, a vendored
 * stub — names no instance in this lockfile, and stays unresolved.
 *
 * There is no `workspace:`-specifier ancestor walk on this path — a snapshot
 * body records no specifier, so that evidence does not exist here.
 *
 * @internal
 */
const snapshotEdge = (name: string, version: string, index: PnpmIndex): O.Option<string> =>
  Str.startsWith(LINK_PREFIX)(version)
    ? O.flatMap(resolveLinkTarget("", Str.slice(LINK_PREFIX.length)(version)), (target) =>
        linkedInstance(target, index)
      )
    : composedInstance(name, version, index.instanceIds);

/**
 * Resolve one importer edge to an instance id. pnpm records
 * `{ specifier, version }` per importer dependency, where the version is either
 * a registry version (composed as for snapshots) or a `link:` target naming
 * another importer — normalized against this importer's own path.
 *
 * **Details**
 *
 * A `link:` target that is no importer gets two further chances. First the
 * publish-directory map: an importer that DECLARES `publishDirectory` has told
 * the lockfile exactly which build directory its links point at. Then, and only
 * under a `workspace:` SPECIFIER, the ancestor walk: pnpm resolved that edge
 * through the workspace, so the target directory is known to belong to a
 * workspace package, and {@link owningImporter} names it. The specifier is what
 * makes the walk a resolution rather than a guess — a hand-written
 * `link:../vendor/stub` specifier names a directory pnpm never claimed was a
 * workspace package, and attributing it to whichever importer happens to
 * contain it would answer with the wrong package's peers instead of admitting
 * it could not name the edge.
 *
 * @internal
 */
const importerEdge = (
  importerPath: string,
  name: string,
  info: { readonly specifier: string; readonly version: string },
  index: PnpmIndex
): O.Option<string> =>
  Str.startsWith(LINK_PREFIX)(info.version)
    ? O.flatMap(resolveLinkTarget(importerPath, Str.slice(LINK_PREFIX.length)(info.version)), (target) =>
        resolveImporterLink(target, Str.startsWith(WORKSPACE_PREFIX)(info.specifier), index)
      )
    : composedInstance(name, info.version, index.instanceIds);

const importerDepGroups = (importer: PnpmImporterType) =>
  [importer.dependencies, importer.devDependencies, importer.peerDependencies, importer.optionalDependencies] as const;

// One importer's outgoing edges, both resolved and unnameable.
const importerEdges = (importerPath: string, importer: PnpmImporterType, index: PnpmIndex): ResolvedEdges.Encoded =>
  partitionEdges(
    A.flatMap(importerDepGroups(importer), (group) =>
      A.map(R.toEntries(group ?? {}), ([name, info]) => [name, importerEdge(importerPath, name, info, index)] as const)
    )
  );

// One snapshot's (or orphan `packages:` entry's) outgoing edges.
const snapshotEdges = (sections: ReadonlyArray<DependencyMap | undefined>, index: PnpmIndex): ResolvedEdges.Encoded =>
  partitionEdges(
    A.flatMap(sections, (section) =>
      A.map(R.toEntries(section ?? {}), ([name, version]) => [name, snapshotEdge(name, version, index)] as const)
    )
  );

// R.fromEntries (Object.fromEntries) defines own data properties, so a
// "__proto__" key neither pollutes nor drops.
const toSpecifierMap = (
  deps: Readonly<Record<string, { readonly specifier: string; readonly version: string }>> | undefined
): DependencyMap | undefined =>
  deps === undefined
    ? undefined
    : R.fromEntries(A.map(R.toEntries(deps), ([name, info]) => [name, info.specifier] as const));

const specifierSections = (importer: PnpmImporterType): WorkspaceEntry.Encoded =>
  workspaceEntryOf({
    ...O.getSomesStruct({
      dependencies: O.fromUndefinedOr(toSpecifierMap(importer.dependencies)),
      devDependencies: O.fromUndefinedOr(toSpecifierMap(importer.devDependencies)),
      peerDependencies: O.fromUndefinedOr(toSpecifierMap(importer.peerDependencies)),
      optionalDependencies: O.fromUndefinedOr(toSpecifierMap(importer.optionalDependencies)),
    }),
  });

const isWorkspacePath = (path: string): boolean => path !== "." && path !== "";

// Names an importer links to: a `link:` version makes its name a workspace.
const linkedNames = (importer: PnpmImporterType): ReadonlyArray<string> =>
  A.flatMap(importerDepGroups(importer), (group) =>
    A.flatMap(R.toEntries(group ?? {}), ([name, info]) =>
      name !== "" && Str.startsWith(LINK_PREFIX)(info.version) ? [name] : []
    )
  );

// Snapshot keys and `packages:` keys that split as `name@version` once the peer
// suffix is off; a `packages:` key a snapshot already speaks for is no instance.
const instanceKeys = (raw: PnpmLockfileRawType): ReadonlyArray<string> => {
  const snapshotKeys = A.filter(R.keys(raw.snapshots ?? {}), isPnpmIdentity);
  const covered = MutableHashSet.fromIterable(A.map(snapshotKeys, plainOf));
  return A.appendAll(
    snapshotKeys,
    A.filter(R.keys(raw.packages ?? {}), (key) => !MutableHashSet.has(covered, key) && isPnpmIdentity(key))
  );
};

const plainOf = (key: string): string => splitPeerSuffix(key).plain;

const isPnpmIdentity = (key: string): boolean => O.isSome(splitNameVersion(plainOf(key)));

// Only modeled workspace importers can own a publish-directory target. The
// root importer has no package row, so its recorded links stay unresolved.
const publishDirTargetsOf = (raw: PnpmLockfileRawType): MutableHashMap.MutableHashMap<string, string> =>
  MutableHashMap.fromIterable(
    A.flatMap(R.toEntries(raw.importers), ([importerPath, importer]) =>
      isWorkspacePath(importerPath) && importer.publishDirectory !== undefined
        ? O.toArray(
            O.map(resolveLinkTarget(importerPath, importer.publishDirectory), (key) => [key, importerPath] as const)
          )
        : []
    )
  );

const emitPackage: {
  (
    instanceId: string,
    meta: PnpmPackageEntry | undefined,
    sections: ReadonlyArray<DependencyMap | undefined>,
    index: PnpmIndex
  ): Effect.Effect<ReadonlyArray<ResolvedPackage>, ParseFailure>;
  (
    meta: PnpmPackageEntry | undefined,
    sections: ReadonlyArray<DependencyMap | undefined>,
    index: PnpmIndex
  ): (instanceId: string) => Effect.Effect<ReadonlyArray<ResolvedPackage>, ParseFailure>;
} = dual(
  4,
  (
    instanceId: string,
    meta: PnpmPackageEntry | undefined,
    sections: ReadonlyArray<DependencyMap | undefined>,
    index: PnpmIndex
  ): Effect.Effect<ReadonlyArray<ResolvedPackage>, ParseFailure> =>
    // Keys may carry a peer-resolution suffix — "fdir@6.5.0(picomatch@4.0.4)",
    // "lib@file:vendor/lib(react@18.3.1)" — whose inner "@" would corrupt the
    // split; splitPeerSuffix (the one stripping implementation, shared with the
    // importer path) drops it first. Malformed keys are skipped, never thrown on.
    O.match(splitNameVersion(plainOf(instanceId)), {
      onNone: () => Effect.succeed(A.empty()),
      onSome: ({ name, version }) =>
        Effect.map(toIntegrityHash(meta?.resolution?.integrity), (integrity) => [
          ResolvedPackage.make({
            name,
            version,
            instanceId,
            ...O.getSomesStruct({ integrity }),
            isWorkspace: false,
            ...peerDeclarations(meta?.peerDependencies, meta?.peerDependenciesMeta, undefined),
            ...snapshotEdges(sections, index),
          }),
        ]),
    })
);

// Own-property lookup, matching the rest of this package: a key-shaped
// intermediate is never read through the prototype chain.
const ownPackage = (raw: PnpmLockfileRawType, key: string): PnpmPackageEntry | undefined =>
  raw.packages !== undefined && R.has(raw.packages, key) ? raw.packages[key] : undefined;

/**
 * One row per *instance*: one per `snapshots:` entry, because `packages:` is
 * per-*version* metadata and collapses every peer-resolved variant onto one
 * key. Peer declarations live on the matching per-version `packages:` entry,
 * keyed by the plain `name@version` the suffix hangs off. An empty (or absent)
 * `snapshots:` map is valid — a workspace with no dependencies has no
 * instances to record. A `packages:` entry no emitted snapshot covers is an
 * orphan — still emitted rather than dropped, since an unexplained
 * disappearance is the worse failure. It carries no resolution, which is
 * honest: none was recorded.
 *
 * @internal
 */
const instancePackages = Effect.fnUntraced(function* (raw: PnpmLockfileRawType, index: PnpmIndex) {
  const snapshots = A.filter(R.toEntries(raw.snapshots ?? {}), ([key]) => isPnpmIdentity(key));
  const fromSnapshots = yield* Effect.forEach(R.toEntries(raw.snapshots ?? {}), ([key, snapshot]) =>
    emitPackage(key, ownPackage(raw, plainOf(key)), [snapshot.dependencies, snapshot.optionalDependencies], index)
  );
  const covered = MutableHashSet.fromIterable(A.map(snapshots, ([key]) => plainOf(key)));
  const orphans = yield* Effect.forEach(
    A.filter(R.toEntries(raw.packages ?? {}), ([key]) => !MutableHashSet.has(covered, key)),
    ([key, pkg]) => emitPackage(key, pkg, [pkg.dependencies, pkg.optionalDependencies], index)
  );
  return A.appendAll(A.flatten(fromSnapshots), A.flatten(orphans));
});

const toFields = Effect.fn("PnpmLockfile.toFields")(function* (
  raw: PnpmLockfileRawType
): Effect.fn.Return<LockfileFields, ParseFailure> {
  // A nameless importer cannot be modeled; it is skipped, never thrown on.
  const importers = A.filter(R.toEntries(raw.importers), ([path]) => path !== "");
  const workspaceRows = A.filter(importers, ([path]) => isWorkspacePath(path));
  // Importer paths join the id space because a `link:` edge names one.
  const importerPaths = MutableHashSet.fromIterable(A.map(workspaceRows, ([path]) => path));
  const index: PnpmIndex = {
    instanceIds: MutableHashSet.fromIterable(A.appendAll(A.fromIterable(importerPaths), instanceKeys(raw))),
    importerPaths,
    publishDirTargets: publishDirTargetsOf(raw),
  };
  // No peers on workspace rows by design: a pnpm lockfile records a workspace
  // project's *resolved* dependencies only, never its own peer declarations —
  // probed against pnpm 11.22.0 both with and without autoInstallPeers.
  // Workspace rows keep the empty peer defaults, and the importer path is both
  // the name and the instance id.
  const workspacePackages = A.map(workspaceRows, ([path, importer]) =>
    ResolvedPackage.make({
      name: path,
      version: "0.0.0",
      instanceId: path,
      isWorkspace: true,
      relativePath: path,
      ...importerEdges(path, importer, index),
    })
  );
  const instancePackages1 = yield* instancePackages(raw, index);
  const packages = A.appendAll(workspacePackages, instancePackages1);
  const workspaceNames = HashSet.fromIterable(
    A.appendAll(
      A.flatMap(importers, ([, importer]) => linkedNames(importer)),
      A.map(workspaceRows, ([path]) => path)
    )
  );
  return LockfileFields.make({
    lockfileVersion: String(raw.lockfileVersion),
    packages,
    workspaceDependencies: extractWorkspaceDeps(
      MutableHashMap.fromIterable(A.map(importers, ([path, importer]) => [path, specifierSections(importer)] as const)),
      workspaceNames
    ),
    // pnpm records `{ specifier, version }` per importer dependency; a blank
    // version means the section carries only a specifier. The recorded
    // version may carry a peer-disambiguation suffix — the shared builder
    // splits it (splitPeerSuffix) into `version` + `peerSuffix`.
    importers: A.map(importers, ([path, importer]) =>
      LockfileImporter.make({
        path,
        dependencies: importerDependencies(importer, (info) => ({ specifier: info.specifier, version: info.version })),
      })
    ),
    extension: {
      _tag: "pnpm",
      ...O.getSomesStruct({
        publishDirTargets: O.liftPredicate(
          R.fromEntries(index.publishDirTargets),
          (targets) => !R.isEmptyRecord(targets)
        ),
        catalogs: O.fromUndefinedOr(raw.catalogs),
        overrides: O.fromUndefinedOr(raw.overrides),
        settings: O.fromUndefinedOr(raw.settings),
      }),
    },
  });
});
