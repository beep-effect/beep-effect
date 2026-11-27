import { $LockfilesId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { LockfileImporter } from "../LockfileImporter.ts";
import { ResolvedPackage } from "../ResolvedPackage.ts";
import {
  extractWorkspaceDeps,
  importerDependencies,
  LockfileFields,
  peerDeclarations,
  requireLockfileVersion,
  resolveByCandidates,
  sectionNames,
  slashPrefixes,
  syntaxFailure,
  toIntegrityHash,
  validationFailure,
  workspaceEntryOf,
} from "./shared.ts";
import type { DependencyMap, ParseFailure } from "./shared.ts";

const $I = $LockfilesId.create("internal/npm");

const DepRecord = S.optionalKey(S.Record(S.String, S.String)).pipe(
  $I.annoteSchema("DepRecord", { description: "Optional dependency names and their declared specifier strings" })
);

const PeerMetaRecord = S.optionalKey(
  S.Record(
    S.String,
    S.Struct({
      optional: S.optionalKey(S.Boolean).pipe(
        $I.annoteKey("PeerMetaRecord.optional", { description: "Whether this peer dependency is optional" })
      ),
    })
  )
).pipe(
  $I.annoteSchema("PeerMetaRecord", { description: "Optional per-peer metadata recording whether a peer is optional" })
);

const NpmPackageEntry = S.Struct({
  name: S.optionalKey(S.String).pipe(
    $I.annoteKey("NpmPackageEntry.name", { description: "Recorded package or workspace name" })
  ),
  version: S.optionalKey(S.String).pipe(
    $I.annoteKey("NpmPackageEntry.version", { description: "Recorded package version or resolved dependency version" })
  ),
  resolved: S.optionalKey(S.String).pipe(
    $I.annoteKey("NpmPackageEntry.resolved", {
      description: "Recorded resolution location or resolved instance ids keyed by dependency name",
    })
  ),
  integrity: S.optionalKey(S.String).pipe(
    $I.annoteKey("NpmPackageEntry.integrity", { description: "Recorded subresource integrity hash" })
  ),
  link: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("NpmPackageEntry.link", { description: "Whether this package entry links to a workspace" })
  ),
  dev: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("NpmPackageEntry.dev", { description: "Whether npm marks the package as development-only" })
  ),
  dependencies: DepRecord.pipe(
    $I.annoteKey("NpmPackageEntry.dependencies", { description: "Declared runtime dependencies keyed by package name" })
  ),
  devDependencies: DepRecord.pipe(
    $I.annoteKey("NpmPackageEntry.devDependencies", {
      description: "Declared development dependencies keyed by package name",
    })
  ),
  peerDependencies: DepRecord.pipe(
    $I.annoteKey("NpmPackageEntry.peerDependencies", {
      description: "Declared peer dependencies keyed by package name",
    })
  ),
  peerDependenciesMeta: PeerMetaRecord.pipe(
    $I.annoteKey("NpmPackageEntry.peerDependenciesMeta", {
      description: "Optionality metadata keyed by peer dependency name",
    })
  ),
  optionalDependencies: DepRecord.pipe(
    $I.annoteKey("NpmPackageEntry.optionalDependencies", {
      description: "Declared optional dependencies keyed by package name",
    })
  ),
}).pipe(
  $I.annoteSchema("NpmPackageEntry", {
    description: "Permissive npm package entry with identity, resolution and dependency sections",
  })
);

/**
 * The version gate's own input: `lockfileVersion` and nothing else.
 *
 * **Details**
 *
 * The gate has to read the version *before* the shape decode, because the
 * shape it would decode against is the shape of a supported version. `packages`
 * is a required key here and a v1 tree does not have one, so a shape-first
 * order reports npm v1 as **malformed** rather than as **too old** — losing
 * exactly the distinction the `UnsupportedLockfileVersion` cause exists to
 * carry.
 *
 * @internal
 */
const NpmVersionProbe = S.Struct({
  lockfileVersion: S.Union([S.Finite, S.String]).pipe(
    $I.annoteKey("NpmVersionProbe.lockfileVersion", {
      description: "Recorded format version, preserved verbatim before gating or string conversion",
    })
  ),
}).pipe(
  $I.annoteSchema("NpmVersionProbe", {
    description: "Version-only npm boundary read before decoding the supported package-map shape",
  })
);

const NpmLockfileRaw = S.Struct({
  name: S.optionalKey(S.String).pipe(
    $I.annoteKey("NpmLockfileRaw.name", { description: "Recorded package or workspace name" })
  ),
  version: S.optionalKey(S.String).pipe(
    $I.annoteKey("NpmLockfileRaw.version", { description: "Recorded package version or resolved dependency version" })
  ),
  lockfileVersion: S.Union([S.Finite, S.String]).pipe(
    $I.annoteKey("NpmLockfileRaw.lockfileVersion", {
      description: "Recorded format version, preserved verbatim before gating or string conversion",
    })
  ),
  requires: S.optionalKey(S.Boolean).pipe(
    $I.annoteKey("NpmLockfileRaw.requires", {
      description: "Whether npm records that this lockfile requires dependencies",
    })
  ),
  packages: S.Record(S.String, NpmPackageEntry).pipe(
    $I.annoteKey("NpmLockfileRaw.packages", { description: "Resolved package entries in lockfile traversal order" })
  ),
}).pipe(
  $I.annoteSchema("NpmLockfileRaw", {
    description: "Permissive package-lock document containing a version and installed package entries",
  })
);

type NpmLockfileRawType = typeof NpmLockfileRaw.Type;
type NpmPackageEntryType = typeof NpmPackageEntry.Type;

const decodeNpmVersionProbe = S.decodeUnknownEffect(NpmVersionProbe);
const decodeNpmLockfileRaw = S.decodeUnknownEffect(NpmLockfileRaw);

const NODE_MODULES_PREFIX = "node_modules/";
const NESTED_NODE_MODULES = "/node_modules/";

/**
 * Where a `packages` key's package name starts: after the **last**
 * `node_modules/` segment, not the first.
 *
 * **Details**
 *
 * npm encodes the whole install position in the key, so
 * `node_modules/express/node_modules/debug` is *debug*, nested under express —
 * and `packages/lib/node_modules/react` is *react*, nested under a workspace
 * directory and carrying no `node_modules/` prefix at all. `None` for a key
 * that is not a package position (the root `""` entry, a workspace path
 * entry), which the caller skips.
 *
 * @internal
 */
const packageNameStart = (key: string): O.Option<number> => {
  const nested = Str.lastIndexOf(NESTED_NODE_MODULES)(key);
  if (O.isSome(nested)) return O.some(nested.value + NESTED_NODE_MODULES.length);
  return Str.startsWith(NODE_MODULES_PREFIX)(key) ? O.some(NODE_MODULES_PREFIX.length) : O.none();
};

/**
 * Resolve one entry's outgoing edges by replaying node resolution over the key
 * space: from the depending package's own directory, try
 * `<prefix>/node_modules/<name>`, then strip one path segment and try again,
 * out to the root — **deepest first**, first hit wins. That order is the whole
 * algorithm: outermost-first would return the hoisted copy and silently
 * mis-report every shadowed dependency.
 *
 * **Details**
 *
 * Only keys that actually exist in the lockfile are emitted, so an edge npm
 * did not record is omitted rather than invented.
 *
 * @internal
 */
const resolveNpmEdges: {
  (
    start: string,
    sections: ReadonlyArray<DependencyMap | undefined>,
    instanceIds: MutableHashSet.MutableHashSet<string>
  ): Record<string, string>;
  (
    sections: ReadonlyArray<DependencyMap | undefined>,
    instanceIds: MutableHashSet.MutableHashSet<string>
  ): (start: string) => Record<string, string>;
} = dual(
  3,
  (
    start: string,
    sections: ReadonlyArray<DependencyMap | undefined>,
    instanceIds: MutableHashSet.MutableHashSet<string>
  ): Record<string, string> => {
    const names = sectionNames(sections);
    if (MutableHashSet.size(names) === 0) return {};
    const prefixes = A.append(A.prepend(A.reverse(slashPrefixes(start)), start), "");
    return resolveByCandidates(names, prefixes, installPath, instanceIds);
  }
);

const installPath = (prefix: string, name: string): string =>
  prefix === "" ? `${NODE_MODULES_PREFIX}${name}` : `${prefix}${NESTED_NODE_MODULES}${name}`;

const entrySections = (entry: NpmPackageEntryType | undefined): ReadonlyArray<DependencyMap | undefined> => [
  entry?.dependencies,
  entry?.devDependencies,
  entry?.optionalDependencies,
  entry?.peerDependencies,
];

const decodeJsonText = S.decodeEffect(S.fromJsonString(S.Unknown));

/**
 * Parse npm `package-lock.json` content into the unified field bundle —
 * `lockfileVersion` 3 and newer; v2 and older fail typed at validation.
 * Schema JSON decoding maps malformed input into the typed `stage: "syntax"`
 * failure channel before version and shape validation.
 *
 * **Example** (Parse an empty npm package map)
 *
 * ```ts
 * import { parseNpm } from "@beep/lockfiles/internal/npm";
 * import * as Effect from "effect/Effect";
 *
 * const fields = Effect.runSync(parseNpm('{"lockfileVersion":3,"packages":{}}'));
 * console.log(fields.lockfileVersion); // 3
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const parseNpm = Effect.fn("NpmLockfile.parse")(function* (
  content: string
): Effect.fn.Return<LockfileFields, ParseFailure> {
  const raw = yield* decodeJsonText(content).pipe(Effect.mapError(syntaxFailure));
  const probe = yield* decodeNpmVersionProbe(raw).pipe(Effect.mapError(validationFailure));
  yield* requireLockfileVersion("npm", probe.lockfileVersion);
  const validated = yield* decodeNpmLockfileRaw(raw).pipe(Effect.mapError(validationFailure));
  return yield* toFields(validated);
});

type NpmRow =
  | {
      readonly _tag: "link";
      readonly key: string;
      readonly name: string;
      readonly resolved: string | undefined;
      readonly resolvedEntry: NpmPackageEntryType | undefined;
    }
  | {
      readonly _tag: "package";
      readonly key: string;
      readonly name: string;
      readonly alias: O.Option<string>;
      readonly version: string;
      readonly entry: NpmPackageEntryType;
    };

const packageRow = (key: string, keyName: string, entry: NpmPackageEntryType): O.Option<NpmRow> => {
  if (keyName === "" || entry.version === undefined) return O.none();
  const name = entry.name === undefined || entry.name === "" ? keyName : entry.name;
  const alias = O.liftPredicate(keyName, (installName) => installName !== name);
  return O.some({ _tag: "package", key, name, alias, version: entry.version, entry });
};

const linkRow = (
  raw: NpmLockfileRawType,
  key: string,
  keyName: string,
  entry: NpmPackageEntryType
): O.Option<NpmRow> => {
  const resolvedEntry = O.getOrUndefined(
    O.flatMap(O.fromUndefinedOr(entry.resolved), (resolved) => R.get(raw.packages, resolved))
  );
  const name = resolvedEntry?.name ?? entry.name ?? keyName;
  return name === "" ? O.none() : O.some({ _tag: "link", key, name, resolved: entry.resolved, resolvedEntry });
};

// Name resolution is the same for every pass (the resolved entry first), so a
// link stub disagreeing with its resolved entry cannot drop inter-workspace
// edges. A nameless entry cannot be modeled; it is skipped, never thrown on.
const npmRow: {
  (raw: NpmLockfileRawType, key: string, entry: NpmPackageEntryType): O.Option<NpmRow>;
  (key: string, entry: NpmPackageEntryType): (raw: NpmLockfileRawType) => O.Option<NpmRow>;
} = dual(
  3,
  (raw: NpmLockfileRawType, key: string, entry: NpmPackageEntryType): O.Option<NpmRow> =>
    O.flatMap(packageNameStart(key), (start): O.Option<NpmRow> => {
      const keyName = Str.slice(start)(key);
      return entry.link === true ? linkRow(raw, key, keyName, entry) : packageRow(key, keyName, entry);
    })
);

const linkPackage: {
  (row: Extract<NpmRow, { _tag: "link" }>, instanceIds: MutableHashSet.MutableHashSet<string>): ResolvedPackage;
  (instanceIds: MutableHashSet.MutableHashSet<string>): (row: Extract<NpmRow, { _tag: "link" }>) => ResolvedPackage;
} = dual(
  2,
  (row: Extract<NpmRow, { _tag: "link" }>, instanceIds: MutableHashSet.MutableHashSet<string>): ResolvedPackage =>
    ResolvedPackage.make({
      name: row.name,
      version: row.resolvedEntry?.version ?? "0.0.0",
      instanceId: row.key,
      isWorkspace: true,
      ...O.getSomesStruct({ relativePath: O.fromUndefinedOr(row.resolved) }),
      ...peerDeclarations(row.resolvedEntry?.peerDependencies, row.resolvedEntry?.peerDependenciesMeta, undefined),
      resolved: resolveNpmEdges(workspaceDirectoryOf(row) ?? row.key, entrySections(row.resolvedEntry), instanceIds),
    })
);

const workspaceDirectoryOf = (row: Extract<NpmRow, { _tag: "link" }>): string | undefined =>
  row.resolved === "" ? undefined : row.resolved;

const regularPackage: {
  (
    row: Extract<NpmRow, { _tag: "package" }>,
    instanceIds: MutableHashSet.MutableHashSet<string>
  ): Effect.Effect<ResolvedPackage, ParseFailure>;
  (
    instanceIds: MutableHashSet.MutableHashSet<string>
  ): (row: Extract<NpmRow, { _tag: "package" }>) => Effect.Effect<ResolvedPackage, ParseFailure>;
} = dual(
  2,
  (
    row: Extract<NpmRow, { _tag: "package" }>,
    instanceIds: MutableHashSet.MutableHashSet<string>
  ): Effect.Effect<ResolvedPackage, ParseFailure> =>
    Effect.map(toIntegrityHash(row.entry.integrity), (integrity) =>
      ResolvedPackage.make({
        name: row.name,
        version: row.version,
        instanceId: row.key,
        ...O.getSomesStruct({ integrity, alias: row.alias }),
        isWorkspace: false,
        dependencies: row.entry.dependencies ?? {},
        ...peerDeclarations(row.entry.peerDependencies, row.entry.peerDependenciesMeta, undefined),
        resolved: resolveNpmEdges(row.key, entrySections(row.entry), instanceIds),
      })
    )
);

const npmImporters = (raw: NpmLockfileRawType, links: ReadonlyArray<Extract<NpmRow, { _tag: "link" }>>) =>
  A.appendAll(
    O.toArray(O.map(R.get(raw.packages, ""), (root) => importerOf(".", root))),
    A.flatMap(links, (row) =>
      O.toArray(O.map(O.fromUndefinedOr(workspaceDirectoryOf(row)), (path) => importerOf(path, row.resolvedEntry)))
    )
  );

const importerOf = (path: string, entry: NpmPackageEntryType | undefined): LockfileImporter =>
  LockfileImporter.make({
    path,
    dependencies: entry === undefined ? [] : importerDependencies(entry, (specifier) => ({ specifier })),
  });

const isLink = (row: NpmRow): row is Extract<NpmRow, { _tag: "link" }> => row._tag === "link";

const toFields = Effect.fn("NpmLockfile.toFields")(function* (
  raw: NpmLockfileRawType
): Effect.fn.Return<LockfileFields, ParseFailure> {
  const rows = A.flatMap(R.toEntries(raw.packages), ([key, entry]) => O.toArray(npmRow(raw, key, entry)));
  const links = A.filter(rows, isLink);
  const instanceIds = MutableHashSet.fromIterable(A.map(rows, (row) => row.key));
  const packages: Array<ResolvedPackage> = [];
  for (const row of rows) {
    packages.push(row._tag === "link" ? linkPackage(row, instanceIds) : yield* regularPackage(row, instanceIds));
  }
  const workspaceEntries = MutableHashMap.fromIterable(
    A.flatMap(links, (row) =>
      row.resolvedEntry === undefined ? [] : [[row.name, workspaceEntryOf(row.resolvedEntry)] as const]
    )
  );
  return LockfileFields.make({
    lockfileVersion: String(raw.lockfileVersion),
    packages,
    workspaceDependencies: extractWorkspaceDeps(
      workspaceEntries,
      HashSet.fromIterable(A.map(links, (row) => row.name))
    ),
    importers: npmImporters(raw, links),
  });
});
