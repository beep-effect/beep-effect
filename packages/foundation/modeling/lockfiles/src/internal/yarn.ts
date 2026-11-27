import { $LockfilesId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Num from "effect/Number";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ResolvedPackage } from "../ResolvedPackage.ts";
import { selectSoleDocument } from "./documents.ts";
import {
  extractWorkspaceDeps,
  LockfileFields,
  partitionEdges,
  peerDeclarations,
  toIntegrityHash,
  validationFailure,
  workspaceEntryOf,
} from "./shared.ts";
import type { DependencyMap, ParseFailure, ResolvedEdges, WorkspaceEntry } from "./shared.ts";

const $I = $LockfilesId.create("internal/yarn");

const YarnLockfileRaw = S.Record(S.String, S.Unknown).pipe(
  $I.annoteSchema("YarnLockfileRaw", {
    description:
      "Yarn Berry entry map retaining unknown values for per-entry and metadata decoding; a classic v1 file's scalar entries fail the entry decode",
  })
);

const DepRecord = S.optionalKey(S.Record(S.String, S.String)).pipe(
  $I.annoteSchema("DepRecord", { description: "Optional dependency names and their declared specifier strings" })
);

const YarnEntry = S.Struct({
  version: S.optionalKey(S.String).pipe(
    $I.annoteKey("YarnEntry.version", { description: "Recorded package version or resolved dependency version" })
  ),
  resolution: S.optionalKey(S.String).pipe(
    $I.annoteKey("YarnEntry.resolution", { description: "Optional package resolution metadata" })
  ),
  dependencies: DepRecord.pipe(
    $I.annoteKey("YarnEntry.dependencies", { description: "Declared runtime dependencies keyed by package name" })
  ),
  devDependencies: DepRecord.pipe(
    $I.annoteKey("YarnEntry.devDependencies", {
      description: "Declared development dependencies keyed by package name",
    })
  ),
  peerDependencies: DepRecord.pipe(
    $I.annoteKey("YarnEntry.peerDependencies", { description: "Declared peer dependencies keyed by package name" })
  ),
  peerDependenciesMeta: S.optionalKey(
    S.Record(
      S.String,
      S.Struct({
        optional: S.optionalKey(S.Boolean).pipe(
          $I.annoteKey("YarnEntry.peerDependenciesMeta.optional", {
            description: "Whether this peer dependency is optional",
          })
        ),
      })
    )
  ).pipe(
    $I.annoteKey("YarnEntry.peerDependenciesMeta", {
      description: "Optionality metadata keyed by peer dependency name",
    })
  ),
  optionalDependencies: DepRecord.pipe(
    $I.annoteKey("YarnEntry.optionalDependencies", {
      description: "Declared optional dependencies keyed by package name",
    })
  ),
  checksum: S.optionalKey(S.String).pipe(
    $I.annoteKey("YarnEntry.checksum", { description: "Recorded Yarn package cache checksum" })
  ),
  languageName: S.optionalKey(S.String).pipe(
    $I.annoteKey("YarnEntry.languageName", { description: "Recorded Yarn package language" })
  ),
  linkType: S.optionalKey(S.String).pipe(
    $I.annoteKey("YarnEntry.linkType", { description: "Recorded Yarn link type, including soft workspace links" })
  ),
  bin: S.optionalKey(S.Unknown).pipe(
    $I.annoteKey("YarnEntry.bin", { description: "Raw Yarn executable metadata left permissive" })
  ),
}).pipe(
  $I.annoteSchema("YarnEntry", {
    description: "Permissive Yarn Berry package entry with resolution, dependency and checksum data",
  })
);

type YarnEntryType = typeof YarnEntry.Type;

const decodeYarnLockfileRaw = S.decodeUnknownEffect(YarnLockfileRaw);
const decodeYarnEntry = S.decodeUnknownEffect(YarnEntry);

const YarnMetadata = S.Struct({
  version: S.optionalKey(S.Union([S.String, S.Finite])).pipe(
    $I.annoteKey("YarnMetadata.version", { description: "Recorded package version or resolved dependency version" })
  ),
}).pipe(
  $I.annoteSchema("YarnMetadata", {
    description: "Optional Yarn Berry lockfile version metadata; a non-finite number fails decoding",
  })
);

/**
 * Parse yarn Berry `yarn.lock` content into the unified field bundle.
 *
 * **Details**
 *
 * Yarn Berry lockfiles are YAML with a flat key structure where each key
 * encodes package name + resolution descriptor(s) (e.g.
 * `"@scope/name@npm:^1.0.0"`); workspace entries carry `linkType: "soft"`.
 *
 * **Example** (Read Yarn Berry metadata)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { parseYarn } from "@beep/lockfiles/internal/yarn";
 *
 * const fields = Effect.runSync(parseYarn("__metadata:\n  version: 8"));
 * console.log(fields.lockfileVersion) // 8
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const parseYarn = Effect.fn("YarnLockfile.parse")(function* (
  content: string
): Effect.fn.Return<LockfileFields, ParseFailure> {
  const { document } = yield* selectSoleDocument(content);
  const raw = yield* decodeYarnLockfileRaw(document).pipe(Effect.mapError(validationFailure));
  const lockfileVersion = yield* yarnLockfileVersion(raw.__metadata);
  const decoded = yield* Effect.forEach(
    A.filter(R.toEntries(raw), ([key]) => key !== "__metadata"),
    ([key, value]) =>
      decodeYarnEntry(value).pipe(
        Effect.mapBoth({ onFailure: validationFailure, onSuccess: (entry) => [key, entry] as const })
      ),
    { concurrency: 1 }
  );
  return yield* toFields(lockfileVersion, MutableHashMap.fromIterable(decoded));
});

const decodeYarnMetadata = S.decodeUnknownEffect(YarnMetadata);

const yarnLockfileVersion = (metadata: unknown): Effect.Effect<string, ParseFailure> =>
  decodeYarnMetadata(metadata === undefined ? {} : metadata).pipe(
    Effect.mapBoth({
      onFailure: validationFailure,
      onSuccess: ({ version }) => (version === undefined ? "unknown" : String(version)),
    })
  );

type YarnRow = {
  readonly key: string;
  readonly entry: YarnEntryType;
  readonly name: string;
  readonly instanceId: string;
};

const locatorOf = (key: string, entry: YarnEntryType): string =>
  entry.resolution ?? A.headNonEmpty(Str.split(key, ", "));

/**
 * The descriptor→locator index. yarn's lockfile *is* this index — every key
 * lists the descriptors that resolve to that entry — so building it is a read,
 * not a guess.
 *
 * @internal
 */
const locatorIndex = (
  entries: ReadonlyArray<readonly [string, YarnEntryType]>
): MutableHashMap.MutableHashMap<string, string> =>
  MutableHashMap.fromIterable(
    A.flatMap(entries, ([key, entry]) => {
      const locator = locatorOf(key, entry);
      return locator === ""
        ? []
        : A.flatMap(Str.split(key, ", "), (descriptor) => (descriptor === "" ? [] : [[descriptor, locator] as const]));
    })
  );

const toFields: {
  (
    lockfileVersion: string,
    decoded: MutableHashMap.MutableHashMap<string, YarnEntryType>
  ): Effect.Effect<LockfileFields, ParseFailure>;
  (
    decoded: MutableHashMap.MutableHashMap<string, YarnEntryType>
  ): (lockfileVersion: string) => Effect.Effect<LockfileFields, ParseFailure>;
} = dual(
  2,
  Effect.fn("YarnLockfile.toFields")(function* (
    lockfileVersion: string,
    decoded: MutableHashMap.MutableHashMap<string, YarnEntryType>
  ): Effect.fn.Return<LockfileFields, ParseFailure> {
    const entries = A.fromIterable(decoded);
    const locators = locatorIndex(entries);
    const rows = A.flatMap(entries, ([key, entry]) =>
      O.toArray(
        O.map(extractYarnPackageName(key), (name): YarnRow => ({ key, entry, name, instanceId: locatorOf(key, entry) }))
      )
    );
    const instanceIds = HashSet.fromIterable(A.flatMap(rows, (row) => (isEmittedRow(row) ? [row.instanceId] : [])));
    const packages = yield* Effect.forEach(rows, (row) => yarnPackage(row, locators, instanceIds), { concurrency: 1 });
    const workspaceEntries = MutableHashMap.fromIterable(
      A.flatMap(rows, (row) =>
        isSoftLink(row.entry) && isEmittedRow(row) ? [[row.name, yarnWorkspaceEntry(row.entry)] as const] : []
      )
    );
    return LockfileFields.make({
      lockfileVersion,
      packages: A.flatten(packages),
      workspaceDependencies: extractWorkspaceDeps(
        workspaceEntries,
        HashSet.fromIterable(A.flatMap(rows, (row) => (isSoftLink(row.entry) ? [row.name] : [])))
      ),
      importers: [],
    });
  })
);

const isEmittedRow = (row: YarnRow): boolean => row.instanceId !== "";

const isSoftLink = (entry: YarnEntryType): boolean => entry.linkType === "soft";

const yarnWorkspaceEntry = (entry: YarnEntryType): WorkspaceEntry.Encoded =>
  workspaceEntryOf({
    ...O.getSomesStruct({
      dependencies: O.fromUndefinedOr(cleanYarnDeps(entry.dependencies)),
      devDependencies: O.fromUndefinedOr(cleanYarnDeps(entry.devDependencies)),
      peerDependencies: O.fromUndefinedOr(cleanYarnDeps(entry.peerDependencies)),
      optionalDependencies: O.fromUndefinedOr(cleanYarnDeps(entry.optionalDependencies)),
    }),
  });

const yarnPackage: {
  (
    row: YarnRow,
    locators: MutableHashMap.MutableHashMap<string, string>,
    instanceIds: HashSet.HashSet<string>
  ): Effect.Effect<ReadonlyArray<ResolvedPackage>, ParseFailure>;
  (
    locators: MutableHashMap.MutableHashMap<string, string>,
    instanceIds: HashSet.HashSet<string>
  ): (row: YarnRow) => Effect.Effect<ReadonlyArray<ResolvedPackage>, ParseFailure>;
} = dual(
  3,
  Effect.fnUntraced(function* (
    row: YarnRow,
    locators: MutableHashMap.MutableHashMap<string, string>,
    instanceIds: HashSet.HashSet<string>
  ) {
    const isWorkspace = isSoftLink(row.entry);
    const integrity = yield* toIntegrityHash(row.entry.checksum);
    const plainPeerRanges = row.entry.peerDependencies;
    if (!isEmittedRow(row)) return A.empty();
    return [
      ResolvedPackage.make({
        name: row.name,
        version: row.entry.version ?? "0.0.0",
        instanceId: row.instanceId,
        ...O.getSomesStruct({
          integrity,
          relativePath: isWorkspace ? extractYarnWorkspacePath(row.key) : O.none<string>(),
        }),
        isWorkspace,
        ...peerDeclarations(plainPeerRanges, row.entry.peerDependenciesMeta, undefined),
        ...resolveYarnEdges(row.entry, locators, instanceIds),
      }),
    ];
  })
);

/**
 * Resolve one entry's outgoing edges through the descriptor→locator index.
 *
 * **Details**
 *
 * A yarn dependency value is a *descriptor* range (`"npm:5.3.0"`), and the
 * lockfile keys enumerate exactly which descriptors resolve to which locator,
 * so the lookup is exact rather than reconstructed.
 *
 * **`devDependencies` is not a section a Berry lockfile has.** yarn folds a
 * workspace's dev declarations into the entry's `dependencies` map — the
 * lockfile a project produces is byte-identical whether a dependency is
 * declared under `dependencies` or `devDependencies` (probed against yarn
 * 4.9.1). Dev edges are therefore already resolved here; iterating
 * `entry.devDependencies` would be dead code, and the schema keeps the field
 * only as permissive scaffolding for hand-edited input.
 *
 * **Dependency edges only.** yarn resolves peers virtually — a peer-bearing
 * package gets a `@virtual:` locator per consumer, and this lockfile shape does
 * not record which one satisfied which peer. Emitting a peer edge here would
 * mean guessing, so peers are left out: an absent edge is a true statement, a
 * plausible one would not be.
 *
 * The descriptor IS the recorded edge; a missing index entry or a locator
 * without an emitted instance is unresolved, not absent.
 *
 * @internal
 */
const resolveYarnEdges: {
  (
    entry: YarnEntryType,
    locators: MutableHashMap.MutableHashMap<string, string>,
    instanceIds: HashSet.HashSet<string>
  ): ResolvedEdges.Encoded;
  (
    locators: MutableHashMap.MutableHashMap<string, string>,
    instanceIds: HashSet.HashSet<string>
  ): (entry: YarnEntryType) => ResolvedEdges.Encoded;
} = dual(
  3,
  (
    entry: YarnEntryType,
    locators: MutableHashMap.MutableHashMap<string, string>,
    instanceIds: HashSet.HashSet<string>
  ): ResolvedEdges.Encoded =>
    partitionEdges(
      A.flatMap([entry.dependencies, entry.optionalDependencies], (section) =>
        A.map(
          R.toEntries(section ?? {}),
          ([name, range]) =>
            [
              name,
              O.filter(MutableHashMap.get(locators, `${name}@${range}`), (locator) =>
                HashSet.has(instanceIds, locator)
              ),
            ] as const
        )
      )
    )
);

const PATCH_PROTOCOL = "@patch:";
const NPM_PROTOCOL = "@npm:";
const WORKSPACE_PROTOCOL = "@workspace:";

/**
 * Extract the package name from a yarn lockfile key. Handles compound keys
 * (`"a@workspace:*, a@workspace:packages/a"`) via the first descriptor and
 * `@patch:` descriptors (which embed `@npm:` inside, so `@patch:` is read
 * first). Total: malformed keys yield `None`.
 *
 * @internal
 */
const extractYarnPackageName = (key: string): O.Option<string> => {
  const descriptor = A.headNonEmpty(Str.split(key, ", "));
  return pipe(
    Str.indexOf(PATCH_PROTOCOL)(descriptor),
    O.filter(isPositive),
    O.orElse(() => O.filter(lastProtocolIndex(descriptor), isPositive)),
    O.map((index) => Str.slice(0, index)(descriptor))
  );
};

const isPositive = (index: number): boolean => index > 0;

const lastProtocolIndex = (descriptor: string): O.Option<number> =>
  A.match(A.getSomes([Str.lastIndexOf(NPM_PROTOCOL)(descriptor), Str.lastIndexOf(WORKSPACE_PROTOCOL)(descriptor)]), {
    onEmpty: O.none,
    onNonEmpty: (indexes) => O.some(A.max(indexes, Num.Order)),
  });

/**
 * Extract the workspace-relative path from a yarn lockfile key: the segment
 * after `@workspace:` in the first descriptor carrying a non-`*` path.
 *
 * @internal
 */
const extractYarnWorkspacePath = (key: string): O.Option<string> =>
  A.findFirst(Str.split(key, ", "), (descriptor) =>
    pipe(
      Str.lastIndexOf(WORKSPACE_PROTOCOL)(descriptor),
      O.map((index) => Str.slice(index + WORKSPACE_PROTOCOL.length)(descriptor)),
      O.filter((path) => path !== "" && path !== "*")
    )
  );

/**
 * Strip the `"npm:"` prefix from yarn dependency specifiers.
 *
 * @internal
 */
const cleanYarnDeps = (deps: DependencyMap | undefined): DependencyMap | undefined =>
  deps === undefined
    ? undefined
    : R.fromEntries(
        A.map(
          R.toEntries(deps),
          ([name, value]) => [name, Str.startsWith("npm:")(value) ? Str.slice(4)(value) : value] as const
        )
      );
