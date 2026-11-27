import { $LockfilesId } from "@beep/identity/packages";
import { Jsonc } from "@beep/jsonc";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { BunExtension } from "../BunExtension.ts";
import { LockfileImporter } from "../LockfileImporter.ts";
import { ResolvedPackage } from "../ResolvedPackage.ts";
import {
  extractWorkspaceDeps,
  importerDependencies,
  installNameOf,
  LockfileFields,
  peerDeclarations,
  resolveByCandidates,
  sectionNames,
  slashPrefixes,
  splitNameVersion,
  syntaxFailure,
  toIntegrityHash,
  validationFailure,
  workspaceEntryOf,
} from "./shared.ts";
import type { DependencyMap, ParseFailure } from "./shared.ts";

const $I = $LockfilesId.create("internal/bun");

const DepRecord = S.optionalKey(S.Record(S.String, S.String)).pipe(
  $I.annoteSchema("DepRecord", { description: "Optional dependency names and their declared specifier strings" })
);

const OptionalPeers = S.String.pipe(
  S.Array,
  S.optionalKey,
  $I.annoteSchema("OptionalPeers", {
    description:
      "Optional peer dependency names bun records as an array, not a meta object, in workspace entries and package tuples",
  })
);

const BunWorkspaceEntry = S.Struct({
  name: S.optionalKey(S.String).pipe(
    $I.annoteKey("BunWorkspaceEntry.name", { description: "Recorded package or workspace name" })
  ),
  version: S.optionalKey(S.String).pipe(
    $I.annoteKey("BunWorkspaceEntry.version", {
      description: "Recorded package version or resolved dependency version",
    })
  ),
  dependencies: DepRecord.pipe(
    $I.annoteKey("BunWorkspaceEntry.dependencies", {
      description: "Declared runtime dependencies keyed by package name",
    })
  ),
  devDependencies: DepRecord.pipe(
    $I.annoteKey("BunWorkspaceEntry.devDependencies", {
      description: "Declared development dependencies keyed by package name",
    })
  ),
  peerDependencies: DepRecord.pipe(
    $I.annoteKey("BunWorkspaceEntry.peerDependencies", {
      description: "Declared peer dependencies keyed by package name",
    })
  ),
  optionalDependencies: DepRecord.pipe(
    $I.annoteKey("BunWorkspaceEntry.optionalDependencies", {
      description: "Declared optional dependencies keyed by package name",
    })
  ),
  optionalPeers: OptionalPeers.pipe(
    $I.annoteKey("BunWorkspaceEntry.optionalPeers", { description: "Peer dependency names bun marks optional" })
  ),
}).pipe(
  $I.annoteSchema("BunWorkspaceEntry", {
    description: "Permissive bun workspace manifest entry with declared dependencies and optional peer names",
  })
);

/**
 * The info object at package-tuple index 2. bun's tuple shape is
 * under-documented upstream, so it is read permissively and *out of band*: a
 * shape that does not decode is skipped (the package still lands, with no
 * peers) rather than failing the whole parse.
 *
 * @internal
 */
const BunPackageInfo = S.Struct({
  dependencies: DepRecord.pipe(
    $I.annoteKey("BunPackageInfo.dependencies", { description: "Declared runtime dependencies keyed by package name" })
  ),
  devDependencies: DepRecord.pipe(
    $I.annoteKey("BunPackageInfo.devDependencies", {
      description: "Declared development dependencies keyed by package name",
    })
  ),
  optionalDependencies: DepRecord.pipe(
    $I.annoteKey("BunPackageInfo.optionalDependencies", {
      description: "Declared optional dependencies keyed by package name",
    })
  ),
  peerDependencies: DepRecord.pipe(
    $I.annoteKey("BunPackageInfo.peerDependencies", { description: "Declared peer dependencies keyed by package name" })
  ),
  optionalPeers: OptionalPeers.pipe(
    $I.annoteKey("BunPackageInfo.optionalPeers", { description: "Peer dependency names bun marks optional" })
  ),
}).pipe(
  $I.annoteSchema("BunPackageInfo", {
    description: "Optional tuple metadata decoded independently so malformed metadata does not discard its package",
  })
);

const decodeBunPackageInfo = S.decodeUnknownExit(BunPackageInfo);

type BunPackageInfoType = typeof BunPackageInfo.Type;

const readBunPackageInfo = (value: unknown): O.Option<BunPackageInfoType> =>
  Exit.getSuccess(decodeBunPackageInfo(value));

const BunLockfileRaw = S.Struct({
  lockfileVersion: S.Finite.pipe(
    $I.annoteKey("BunLockfileRaw.lockfileVersion", {
      description: "Recorded format version, preserved verbatim before gating or string conversion",
    })
  ),
  workspaces: S.optionalKey(S.Record(S.String, BunWorkspaceEntry)).pipe(
    $I.annoteKey("BunLockfileRaw.workspaces", { description: "Workspace entries keyed by their recorded directory" })
  ),
  packages: S.optionalKey(S.Record(S.String, S.Array(S.Unknown))).pipe(
    $I.annoteKey("BunLockfileRaw.packages", { description: "Resolved package entries in lockfile traversal order" })
  ),
  catalog: S.optionalKey(S.Record(S.String, S.Unknown)).pipe(
    $I.annoteKey("BunLockfileRaw.catalog", { description: "Default bun dependency catalog preserved as recorded" })
  ),
  catalogs: S.optionalKey(S.Record(S.String, S.Record(S.String, S.Unknown))).pipe(
    $I.annoteKey("BunLockfileRaw.catalogs", { description: "Named dependency catalogs preserved as recorded" })
  ),
  overrides: BunExtension.fields.overrides,
  trustedDependencies: S.String.pipe(
    S.Array,
    S.optionalKey,
    $I.annoteKey("BunLockfileRaw.trustedDependencies", {
      description: "Dependency names bun trusts to run install scripts",
    })
  ),
}).pipe(
  $I.annoteSchema("BunLockfileRaw", {
    description: "Permissive bun JSONC lockfile with workspace entries, package tuples and extension fields",
  })
);

type BunLockfileRawType = typeof BunLockfileRaw.Type;
type BunWorkspaceEntryType = typeof BunWorkspaceEntry.Type;

const decodeBunLockfileRaw = S.decodeUnknownEffect(BunLockfileRaw);

/**
 * Parse bun `bun.lock` (JSONC) content into the unified field bundle.
 * Resolved packages are tuples whose first element is `"name@version"`;
 * the integrity hash is assumed at tuple index 3 (a permissive
 * reading of an under-documented upstream shape).
 *
 * **Example** (Parse an empty text bun lockfile)
 *
 * ```ts
 * import { parseBun } from "@beep/lockfiles/internal/bun";
 * import * as Effect from "effect/Effect";
 *
 * const fields = Effect.runSync(parseBun('{"lockfileVersion":1,"workspaces":{},"packages":{}}'));
 * console.log(fields.packages.length); // 0
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const parseBun = Effect.fn("BunLockfile.parse")(function* (
  content: string
): Effect.fn.Return<LockfileFields, ParseFailure> {
  const parsed = yield* Jsonc.parse(content).pipe(Effect.mapError(syntaxFailure));
  const validated = yield* decodeBunLockfileRaw(parsed).pipe(Effect.mapError(validationFailure));
  return yield* toFields(validated);
});

/**
 * Resolve one entry's outgoing edges by replaying bun's own key scheme.
 *
 * **Details**
 *
 * bun encodes install position in the `packages` key: a nested install is
 * keyed `<parent-key>/<name>`, so `"react-dom/react"` is literally "the react
 * react-dom got". Package names are themselves slash-bearing when scoped, so
 * the parent chain is **not** computed by splitting on `/` — it is read off
 * the key space, taking those prefixes of the key that are themselves keys,
 * longest first. Deepest wins; the root (`<name>` alone) is tried last.
 *
 * Only keys that exist are emitted, so an edge bun did not record is omitted
 * rather than invented.
 *
 * @internal
 */
const resolveBunEdges: {
  (
    key: string,
    sections: ReadonlyArray<DependencyMap | undefined>,
    positionKeys: MutableHashSet.MutableHashSet<string>,
    instanceIds: MutableHashSet.MutableHashSet<string>
  ): Record<string, string>;
  (
    sections: ReadonlyArray<DependencyMap | undefined>,
    positionKeys: MutableHashSet.MutableHashSet<string>,
    instanceIds: MutableHashSet.MutableHashSet<string>
  ): (key: string) => Record<string, string>;
} = dual(
  4,
  (
    key: string,
    sections: ReadonlyArray<DependencyMap | undefined>,
    positionKeys: MutableHashSet.MutableHashSet<string>,
    instanceIds: MutableHashSet.MutableHashSet<string>
  ): Record<string, string> => {
    const names = sectionNames(sections);
    if (MutableHashSet.size(names) === 0) return {};
    const ancestors = A.filter(slashPrefixes(key), (prefix) => MutableHashSet.has(positionKeys, prefix));
    const prefixes = A.append(A.sort(A.prepend(ancestors, key), LONGEST_FIRST), "");
    return resolveByCandidates(names, prefixes, nestedKey, instanceIds);
  }
);

const nestedKey = (prefix: string, name: string): string => (prefix === "" ? name : `${prefix}/${name}`);

const LONGEST_FIRST = Order.mapInput(Order.flip(Order.Number), (prefix: string) => prefix.length);

const infoSections = (info: O.Option<BunPackageInfoType>): ReadonlyArray<DependencyMap | undefined> =>
  O.match(info, {
    onNone: A.empty,
    onSome: (value) => [value.dependencies, value.devDependencies, value.optionalDependencies, value.peerDependencies],
  });

const workspaceSections = (entry: BunWorkspaceEntryType): ReadonlyArray<DependencyMap | undefined> => [
  entry.dependencies,
  entry.devDependencies,
  entry.optionalDependencies,
  entry.peerDependencies,
];

type BunWorkspaceRow = { readonly path: string; readonly entry: BunWorkspaceEntryType; readonly name: string };

type BunPackageRow = {
  readonly key: string;
  readonly tuple: ReadonlyArray<unknown>;
  readonly name: string;
  readonly installName: string;
  readonly version: string;
};

const workspaceRows = (raw: BunLockfileRawType): ReadonlyArray<BunWorkspaceRow> =>
  A.flatMap(R.toEntries(raw.workspaces ?? {}), ([path, entry]) =>
    path === "" ? [] : [{ path, entry, name: entry.name === undefined || entry.name === "" ? path : entry.name }]
  );

const packageRows = (raw: BunLockfileRawType): ReadonlyArray<BunPackageRow> =>
  A.flatMap(R.toEntries(raw.packages ?? {}), ([key, tuple]) =>
    key === ""
      ? []
      : O.toArray(
          O.zipWith(
            installNameOf(key),
            O.flatMap(O.filter(A.get(tuple, 0), P.isString), splitNameVersion),
            (installName, { name, version }) => ({ key, tuple, name, installName, version })
          )
        )
  );

const toFields = Effect.fn("BunLockfile.toFields")(function* (
  raw: BunLockfileRawType
): Effect.fn.Return<LockfileFields, ParseFailure> {
  const positionKeys = MutableHashSet.fromIterable(R.keys(raw.packages ?? {}));
  const workspaces = workspaceRows(raw);
  const workspaceNames = HashSet.fromIterable(A.map(workspaces, (row) => row.name));
  // decision: bun-workspace-id-is-package-key
  const workspaceIdOf = (row: BunWorkspaceRow): string =>
    MutableHashSet.has(positionKeys, row.name) ? row.name : row.path;
  const externals = A.filter(packageRows(raw), (row) => !HashSet.has(workspaceNames, row.name));
  const instanceIds = MutableHashSet.fromIterable(
    A.appendAll(
      A.map(workspaces, workspaceIdOf),
      A.map(externals, (row) => row.key)
    )
  );
  const workspacePackages = A.map(workspaces, (row) => {
    const instanceId = workspaceIdOf(row);
    return ResolvedPackage.make({
      name: row.name,
      version: row.entry.version ?? "0.0.0",
      instanceId,
      isWorkspace: true,
      relativePath: row.path,
      ...peerDeclarations(row.entry.peerDependencies, undefined, row.entry.optionalPeers),
      resolved: resolveBunEdges(instanceId, workspaceSections(row.entry), positionKeys, instanceIds),
    });
  });
  const externalPackages = yield* Effect.forEach(externals, (row) => externalPackage(row, positionKeys, instanceIds), {
    concurrency: 1,
  });
  return LockfileFields.make({
    lockfileVersion: String(raw.lockfileVersion),
    packages: A.appendAll(workspacePackages, externalPackages),
    workspaceDependencies: extractWorkspaceDeps(
      MutableHashMap.fromIterable(A.map(workspaces, (row) => [row.name, workspaceEntryOf(row.entry)] as const)),
      workspaceNames
    ),
    importers: bunImporters(raw),
    extension: bunExtension(raw),
  });
});

const bunImporters = (raw: BunLockfileRawType): ReadonlyArray<LockfileImporter> =>
  A.map(R.toEntries(raw.workspaces ?? {}), ([path, entry]) =>
    LockfileImporter.make({
      path: path === "" ? "." : path,
      dependencies: importerDependencies(entry, (specifier) => ({ specifier })),
    })
  );

const bunExtension = (raw: BunLockfileRawType): BunExtension.Encoded => ({
  _tag: "bun",
  ...O.getSomesStruct({
    catalog: O.fromUndefinedOr(raw.catalog),
    catalogs: O.fromUndefinedOr(raw.catalogs),
    overrides: O.fromUndefinedOr(raw.overrides),
    trustedDependencies: O.fromUndefinedOr(raw.trustedDependencies),
  }),
});

const TUPLE_INFO_INDEX = 2;
const TUPLE_INTEGRITY_INDEX = 3;

const externalPackage: {
  (
    row: BunPackageRow,
    keys: MutableHashSet.MutableHashSet<string>,
    instanceIds: MutableHashSet.MutableHashSet<string>
  ): Effect.Effect<ResolvedPackage, ParseFailure>;
  (
    keys: MutableHashSet.MutableHashSet<string>,
    instanceIds: MutableHashSet.MutableHashSet<string>
  ): (row: BunPackageRow) => Effect.Effect<ResolvedPackage, ParseFailure>;
} = dual(
  3,
  Effect.fnUntraced(function* (
    row: BunPackageRow,
    keys: MutableHashSet.MutableHashSet<string>,
    instanceIds: MutableHashSet.MutableHashSet<string>
  ) {
    const integrity = yield* toIntegrityHash(
      A.get(row.tuple, TUPLE_INTEGRITY_INDEX).pipe(O.filter(P.isString), O.getOrUndefined)
    );
    const info = O.flatMap(A.get(row.tuple, TUPLE_INFO_INDEX), readBunPackageInfo);
    const peers = O.getOrUndefined(info);
    const alias = O.liftPredicate(row.installName, (installName) => installName !== row.name);
    return ResolvedPackage.make({
      name: row.name,
      version: row.version,
      instanceId: row.key,
      ...O.getSomesStruct({ integrity, alias }),
      isWorkspace: false,
      ...peerDeclarations(peers?.peerDependencies, undefined, peers?.optionalPeers),
      resolved: resolveBunEdges(row.key, infoSections(info), keys, instanceIds),
    });
  })
);
