import { $RepoWorkspacesId } from "@beep/identity/packages";
import { dual, pipe } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";
// decision: config-dependency-reads-through-caller-filesystem

import { PnpmEnvLockfile } from "@beep/lockfiles";
import { PackageManagerCache } from "@beep/npm-spec/PackageManagerCache";
import { HostProcessPlatform } from "@beep/utils/HostProcess";
import * as O from "@beep/utils/Option";
import { Yaml } from "@beep/yaml";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import { HookReplayContext, HookReplaySource } from "../ConfigDependencyReplay.ts";
import { FetchRequest } from "./configDependencyFetch.ts";
import { carries, hooksError, ioOrNone, manifestVersion, sideLabel } from "./configDependencyShared.ts";
import { splitConfigDependencySpec } from "./configDependencySpecGrammar.ts";
import type { CatalogAssemblyError } from "@beep/npm-spec/CatalogAssemblyError";
import type { FetchConfigDependency, FetchFailure, RecordedLocks } from "./configDependencyFetch.ts";
import type { ManifestVersion } from "./configDependencyShared.ts";

const $I = $RepoWorkspacesId.create("internal/configDependencyResolution");

class ConfigDependencyResolutionError extends S.TaggedError<
  ConfigDependencyResolutionError,
  { readonly brand: unique symbol }
>($I`ConfigDependencyResolutionError`)(
  "ConfigDependencyResolutionError",
  { message: S.String, cause: S.optionalKey(S.Defect({ includeStack: true })) },
  $I.annoteError<ConfigDependencyResolutionError>("ConfigDependencyResolutionError", {
    description:
      "Explains why a declared config dependency could not be resolved; retained as the cause of the hooks catalog assembly error.",
  })
) {}

/**
 * One config dependency resolved at its declared version: where it was
 * found, and the pnpmfile to load — `undefined` when that version ships
 * none (resolved, but contributing nothing).
 *
 * **Example** (Validate a resolved package without a pnpmfile)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { ResolvedPnpmfile } from "@beep/repo-workspaces/internal/configDependencyResolution";
 *
 * console.log(S.is(ResolvedPnpmfile)({ name: "cfg", version: "1.0.0", source: "installed", path: undefined })) // true
 * console.log(S.is(ResolvedPnpmfile)(null)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ResolvedPnpmfile extends S.Opaque<ResolvedPnpmfile, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The config dependency's name, as declared. */
    name: S.String.pipe(
      $I.annoteKey("ResolvedPnpmfile.name", { description: "The config dependency name as declared." })
    ),
    /** The declared version that was resolved. */
    version: S.String.pipe(
      $I.annoteKey("ResolvedPnpmfile.version", { description: "The declared version text resolved by the ladder." })
    ),
    /** Which rung answered: the installed `.pnpm-config` copy, the pnpm store, the fetch rung, or a caller-supplied map. */
    source: HookReplaySource.pipe(
      $I.annoteKey("ResolvedPnpmfile.source", { description: "The resolution rung that supplied this version." })
    ),
    /** The absolute path of the pnpmfile to load, or `undefined` when the dependency ships none. */
    path: S.UndefinedOr(S.String).pipe(
      $I.annoteKey("ResolvedPnpmfile.path", {
        description: "The pnpmfile path, explicitly undefined when this version ships none.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ResolvedPnpmfile", {
      description: "A plain resolved config dependency and its optional pnpmfile contribution.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ResolvedPnpmfile {
  /**
   * The plain, unbranded encoded shape of a {@link ResolvedPnpmfile}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ResolvedPnpmfile.Encoded;
}

const PNPMFILE_CANDIDATES = ["pnpmfile.mjs", "pnpmfile.cjs", "pnpmfile.js"] as const;

const declaredVersionOf = (spec: string): string => splitConfigDependencySpec(spec).version;

const hasTraversalSegment = (name: string): boolean => Str.split(name, /[/\\]/).includes("..");

const DeclaredEntry = S.Struct({
  name: S.String.pipe(
    $I.annoteKey("DeclaredEntry.name", {
      description: "The declared config dependency name, checked for traversal by the ladder.",
    })
  ),
  version: S.String.pipe(
    $I.annoteKey("DeclaredEntry.version", {
      description: "The version text before the first plus sign, checked for traversal by the ladder.",
    })
  ),
  spec: S.String.pipe(
    $I.annoteKey("DeclaredEntry.spec", {
      description: "The complete declared spec, retained for fetch integrity verification.",
    })
  ),
}).pipe(
  $I.annoteSchema("DeclaredEntry", {
    description: "A plain declared config dependency in declaration order, without strict spec validation.",
  })
);

type DeclaredEntry = typeof DeclaredEntry.Type;

const declaredEntries = (
  configDependencies: Readonly<Record<string, string>>
): Effect.Effect<ReadonlyArray<DeclaredEntry>, CatalogAssemblyError> => {
  const entries = A.map(R.toEntries(configDependencies), ([name, spec]) => ({
    name,
    version: declaredVersionOf(spec),
    spec,
  }));
  return O.match(
    A.findFirst(entries, (entry) => hasTraversalSegment(entry.name) || hasTraversalSegment(entry.version)),
    {
      onNone: () => Effect.succeed(entries),
      onSome: (traversal) =>
        Effect.fail(
          hooksError(
            traversal.name,
            ConfigDependencyResolutionError.make({
              message: hasTraversalSegment(traversal.name)
                ? `config dependency name has a '..' path segment: ${traversal.name}`
                : `config dependency version has a '..' path segment: ${traversal.version}`,
            }),
            undefined
          )
        ),
    }
  );
};

type LadderServices = FileSystem.FileSystem | Path.Path;

const entriesOf: {
  (path: string, dir: string): Effect.Effect<ReadonlyArray<string>, CatalogAssemblyError, LadderServices>;
  (dir: string): (path: string) => Effect.Effect<ReadonlyArray<string>, CatalogAssemblyError, LadderServices>;
} = dual(
  2,
  Effect.fnUntraced(function* (
    path: string,
    dir: string
  ): Effect.fn.Return<ReadonlyArray<string>, CatalogAssemblyError, LadderServices> {
    const fs = yield* FileSystem.FileSystem;
    const ioOrNone1 = yield* ioOrNone(path, fs.readDirectory(dir));
    return O.getOrElse(ioOrNone1, A.empty<string>);
  })
);

const realPathOf: {
  (path: string, target: string): Effect.Effect<O.Option<string>, CatalogAssemblyError, LadderServices>;
  (target: string): (path: string) => Effect.Effect<O.Option<string>, CatalogAssemblyError, LadderServices>;
} = dual(
  2,
  Effect.fnUntraced(function* (
    path: string,
    target: string
  ): Effect.fn.Return<O.Option<string>, CatalogAssemblyError, LadderServices> {
    const fs = yield* FileSystem.FileSystem;
    return yield* ioOrNone(path, fs.realPath(target));
  })
);

const pnpmConfigDir: {
  (path: Path.Path, root: string): string;
  (root: string): (path: Path.Path) => string;
} = dual(2, (path: Path.Path, root: string): string => path.join(root, "node_modules", ".pnpm-config"));

const parentOfLinksAncestor: {
  (path: Path.Path, resolved: string): O.Option<string>;
  (resolved: string): (path: Path.Path) => O.Option<string>;
} = dual(2, (path: Path.Path, resolved: string): O.Option<string> => {
  let current = resolved;
  for (;;) {
    const parent = path.dirname(current);
    if (parent === current) return O.none();
    if (path.basename(current) === "links") return O.some(parent);
    current = parent;
  }
});

const nonEmptyStoreDirOf = (text: string): ReadonlyArray<string> =>
  Result.match(Yaml.parseResult(text), {
    onFailure: A.empty<string>,
    onSuccess: (document) =>
      P.isObject(document) && P.isString(document.storeDir) && document.storeDir.length > 0 ? [document.storeDir] : [],
  });

const storeFromModulesYaml = Effect.fnUntraced(function* (
  root: string
): Effect.fn.Return<ReadonlyArray<string>, CatalogAssemblyError, LadderServices> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const text = yield* ioOrNone(root, fs.readFileString(path.join(root, "node_modules", ".modules.yaml")));
  return O.match(text, { onNone: A.empty<string>, onSome: nonEmptyStoreDirOf });
});

const pnpmConfigEntries = Effect.fnUntraced(function* (
  root: string,
  base: string
): Effect.fn.Return<ReadonlyArray<string>, CatalogAssemblyError, LadderServices> {
  const path = yield* Path.Path;
  const entriesOf2 = yield* entriesOf(root, base);
  const nested = yield* Effect.forEach(
    entriesOf2,
    (entry) =>
      Str.startsWith("@")(entry)
        ? Effect.map(
            entriesOf(root, path.join(base, entry)),
            A.map((inner) => `${entry}/${inner}`)
          )
        : Effect.succeed([entry]),
    { concurrency: 1 }
  );
  return A.flatten(nested);
});

const storesFromLinks = Effect.fn("ConfigDependencyResolution.storesFromLinks")(function* (
  root: string
): Effect.fn.Return<ReadonlyArray<string>, CatalogAssemblyError, LadderServices> {
  const path = yield* Path.Path;
  const base = pnpmConfigDir(path, root);
  const pnpmConfigEntries3 = yield* pnpmConfigEntries(root, base);
  const resolved = yield* Effect.forEach(
    pnpmConfigEntries3,
    (candidate) => realPathOf(root, path.join(base, candidate)),
    { concurrency: 1 }
  );
  return A.getSomes(A.map(A.getSomes(resolved), (target) => parentOfLinksAncestor(path, target)));
});

const environmentValue = (name: string): Effect.Effect<O.Option<string>> =>
  Config.option(Config.String(name)).pipe(
    Effect.orElseSucceed(O.none<string>),
    Effect.map(O.filter((value) => value !== ""))
  );

const environmentStoreRoots = Effect.fnUntraced(function* (): Effect.fn.Return<
  ReadonlyArray<string>,
  never,
  Path.Path
> {
  const path = yield* Path.Path;
  const platform = yield* HostProcessPlatform;
  const [pnpmHome, xdgDataHome, localAppData, home, userProfile] = yield* Effect.all(
    [
      environmentValue("PNPM_HOME"),
      environmentValue("XDG_DATA_HOME"),
      environmentValue("LOCALAPPDATA"),
      environmentValue("HOME"),
      environmentValue("USERPROFILE"),
    ],
    { concurrency: 1 }
  );
  const windows = platform === "win32";
  const homeDirectory = O.orElse(windows ? userProfile : home, () => (windows ? home : userProfile));
  return A.getSomes([
    O.map(pnpmHome, (dir) => path.join(dir, "store")),
    O.map(xdgDataHome, (dir) => path.join(dir, "pnpm", "store")),
    windows ? O.map(localAppData, (dir) => path.join(dir, "pnpm", "store")) : O.none(),
    O.map(homeDirectory, (dir) => PackageManagerCache.defaultDirectory("pnpm", { platform, home: dir })),
    windows ? O.none() : O.map(homeDirectory, (dir) => path.join(dir, ".local", "share", "pnpm", "store")),
  ]);
});

const NewestStoreFormatFirst: Order.Order<string> = Order.mapInput(Order.flip(Order.Number), (version: string) =>
  Number(Str.slice(1)(version))
);

const storesFromEnvironment = Effect.fn("ConfigDependencyResolution.storesFromEnvironment")(function* (
  root: string
): Effect.fn.Return<ReadonlyArray<string>, CatalogAssemblyError, LadderServices> {
  const path = yield* Path.Path;
  const environmentStoreRoots4 = yield* environmentStoreRoots();
  const expanded = yield* Effect.forEach(
    environmentStoreRoots4,
    (storeRoot) =>
      Effect.map(entriesOf(root, storeRoot), (entries) =>
        A.map(
          A.sort(
            A.filter(entries, (entry) => /^v\d+$/.test(entry)),
            NewestStoreFormatFirst
          ),
          (version) => path.join(storeRoot, version)
        )
      ),
    { concurrency: 1 }
  );
  return A.flatten(expanded);
});

const discoverStores = Effect.fn("ConfigDependencyResolution.discoverStores")(function* (
  root: string
): Effect.fn.Return<ReadonlyArray<string>, CatalogAssemblyError, LadderServices> {
  const [fromYaml, fromLinks, fromEnvironment] = yield* Effect.all(
    [storeFromModulesYaml(root), storesFromLinks(root), storesFromEnvironment(root)],
    { concurrency: 1 }
  );
  const resolved = yield* Effect.forEach(
    [...fromYaml, ...fromLinks, ...fromEnvironment],
    (store) => realPathOf(root, store),
    { concurrency: 1 }
  );
  return A.dedupe(A.getSomes(resolved));
});

const findInStores: {
  (
    name: string,
    declared: string,
    stores: ReadonlyArray<string>
  ): Effect.Effect<
    { readonly store: string; readonly matches: ReadonlyArray<string> },
    CatalogAssemblyError,
    LadderServices
  >;
  (
    declared: string,
    stores: ReadonlyArray<string>
  ): (
    name: string
  ) => Effect.Effect<
    { readonly store: string; readonly matches: ReadonlyArray<string> },
    CatalogAssemblyError,
    LadderServices
  >;
} = dual(
  3,
  Effect.fn("ConfigDependencyResolution.findInStores")(function* (
    name: string,
    declared: string,
    stores: ReadonlyArray<string>
  ): Effect.fn.Return<
    { readonly store: string; readonly matches: ReadonlyArray<string> },
    CatalogAssemblyError,
    LadderServices
  > {
    const path = yield* Path.Path;
    for (const store of stores) {
      const versionDir = path.join(store, "links", name, declared);
      const entriesOf5 = yield* entriesOf(name, versionDir);
      const candidates = A.map(entriesOf5, (hash) => path.join(versionDir, hash, "node_modules", name));
      const matches = yield* Effect.filter(candidates, (dir) =>
        Effect.map(manifestVersion(name, dir), carries(declared))
      );
      if (A.isReadonlyArrayNonEmpty(matches)) return { store, matches };
    }
    return { store: "", matches: A.empty<string>() };
  })
);

const ambiguousMessage: {
  (name: string, declared: string, store: string, matches: ReadonlyArray<string>): string;
  (declared: string, store: string, matches: ReadonlyArray<string>): (name: string) => string;
} = dual(
  4,
  (name: string, declared: string, store: string, matches: ReadonlyArray<string>): string =>
    `config dependency ${name}@${declared} is ambiguous: the pnpm store at ${store} holds ${matches.length} copies of that version ` +
    `(${A.join(matches, ", ")}) and the store records no integrity to tell them apart, so none is replayed. ` +
    `Remove the stale copies, or install ${name}@${declared} in this workspace so node_modules/.pnpm-config answers instead.`
);

const notInstalledMessage: {
  (
    name: string,
    declared: string,
    installed: ManifestVersion,
    stores: ReadonlyArray<string>,
    side: HookReplayContext.Encoded,
    fetch: O.Option<FetchFailure>
  ): string;
  (
    declared: string,
    installed: ManifestVersion,
    stores: ReadonlyArray<string>,
    side: HookReplayContext.Encoded,
    fetch: O.Option<FetchFailure>
  ): (name: string) => string;
} = dual(
  6,
  (
    name: string,
    declared: string,
    installed: ManifestVersion,
    stores: ReadonlyArray<string>,
    side: HookReplayContext.Encoded,
    fetch: O.Option<FetchFailure>
  ): string => {
    const holds =
      installed._tag === "absent"
        ? "nothing"
        : installed._tag === "unversioned"
          ? "a package with no version"
          : `version ${installed.version}`;
    const searched =
      stores.length === 0 ? "no pnpm store directory could be located" : `searched ${A.join(stores, ", ")}`;
    const by = side.ref === undefined ? "" : ` (declared at ${sideLabel(side)})`;
    const found =
      `config dependency ${name}@${declared}${by} is not installed: node_modules/.pnpm-config/${name} holds ${holds}, ` +
      `and no store copy of ${name}@${declared} was found (${searched}).`;
    const why =
      installed._tag === "version" && installed.version !== declared
        ? "This side declares a different version from the installed one, as the base side of a diff across a " +
          "config-dependency bump does: that version was never installed in this checkout."
        : "";
    const tried = O.match(fetch, {
      onNone: () =>
        "This replay layer does not fetch; ConfigDependencyHooks.layerSubprocess, which the *Subprocess Workspaces " +
        "composites use, fetches the declared version, verified, into the store.",
      onSome: (failure) =>
        failure.reason === "fetchFailed" ? `Fetching it into the store failed: ${failure.message}` : failure.message,
    });
    const pinsNeedReconcilingNotPopulating = O.exists(fetch, (failure) => failure.reason === "integrityMismatch");
    const remedy = pinsNeedReconcilingNotPopulating
      ? ""
      : `Run \`pnpm add --config ${name}@${declared}\` in a throwaway workspace to populate the store, then retry.`;
    return pipe(
      [found, why, tried, remedy],
      A.filter((sentence) => sentence !== ""),
      A.join(" ")
    );
  }
);

const pnpmfileIn: {
  (name: string, dir: string): Effect.Effect<O.Option<string>, CatalogAssemblyError, LadderServices>;
  (dir: string): (name: string) => Effect.Effect<O.Option<string>, CatalogAssemblyError, LadderServices>;
} = dual(
  2,
  Effect.fnUntraced(function* (
    name: string,
    dir: string
  ): Effect.fn.Return<O.Option<string>, CatalogAssemblyError, LadderServices> {
    const path = yield* Path.Path;
    const entries = yield* entriesOf(name, dir);
    return O.map(
      A.findFirst(PNPMFILE_CANDIDATES, (candidate) => A.contains(entries, candidate)),
      (filename) => path.join(dir, filename)
    );
  })
);

interface LadderCall {
  readonly fetch: O.Option<FetchConfigDependency>;
  readonly locks: RecordedLocks;
  readonly side: HookReplayContext.Encoded;
  readonly stores: Effect.Effect<ReadonlyArray<string>, CatalogAssemblyError>;
}

const resolveDirectory: {
  (
    root: string,
    entry: DeclaredEntry,
    call: LadderCall
  ): Effect.Effect<{ readonly dir: string; readonly source: HookReplaySource }, CatalogAssemblyError, LadderServices>;
  (
    entry: DeclaredEntry,
    call: LadderCall
  ): (
    root: string
  ) => Effect.Effect<{ readonly dir: string; readonly source: HookReplaySource }, CatalogAssemblyError, LadderServices>;
} = dual(
  3,
  Effect.fn("ConfigDependencyResolution.resolveDirectory")(function* (
    root: string,
    entry: DeclaredEntry,
    call: LadderCall
  ): Effect.fn.Return<
    { readonly dir: string; readonly source: HookReplaySource },
    CatalogAssemblyError,
    LadderServices
  > {
    const path = yield* Path.Path;
    const { name, version: declared } = entry;
    const installedDir = path.join(pnpmConfigDir(path, root), name);
    const installed = yield* manifestVersion(name, installedDir);
    if (carries(installed, declared)) return { dir: installedDir, source: "installed" };
    const searched = yield* call.stores;
    const { store, matches } = yield* findInStores(name, declared, searched);
    const [only, ...rest] = matches;
    if (only !== undefined && A.isReadonlyArrayEmpty(rest)) return { dir: only, source: "store" };
    if (only !== undefined)
      return yield* hooksError(
        name,
        ConfigDependencyResolutionError.make({ message: ambiguousMessage(name, declared, store, matches) }),
        "ambiguous"
      );
    const notInstalled = (fetch: O.Option<FetchFailure>) => {
      const message = notInstalledMessage(name, declared, installed, searched, call.side, fetch);
      const cause = O.getOrUndefined(fetch)?.cause;
      return hooksError(
        name,
        ConfigDependencyResolutionError.make({ message, ...O.getSomesStruct({ cause: O.fromUndefinedOr(cause) }) }),
        O.match(fetch, { onNone: () => "notInstalled" as const, onSome: (failure) => failure.reason })
      );
    };
    if (O.isNone(call.fetch)) return yield* notInstalled(O.none());
    const request = FetchRequest.make({
      root,
      name,
      version: declared,
      spec: entry.spec,
      stores: searched,
      side: HookReplayContext.make(call.side),
    });
    const fetched = yield* call.fetch
      .value(request, call.locks)
      .pipe(Effect.mapError((failure) => notInstalled(O.some(failure))));
    return { dir: fetched, source: "fetched" };
  })
);

const memoizeSuccess = <A, E>(effect: Effect.Effect<A, E>): Effect.Effect<Effect.Effect<A, E>> =>
  Effect.map(Effect.cachedInvalidateWithTTL(effect, Duration.infinity), ([once, invalidate]) =>
    Effect.onError(once, () => invalidate)
  );

/**
 * Resolve every declared config dependency at its declared version, in
 * declaration order. A dependency that ships no pnpmfile is still returned
 * (resolved, `path` undefined — the one legitimate skip at replay time); a
 * `..` segment in a name or version, an unresolvable declared version, or any
 * non-absent IO failure fails typed as a `hooks`-source
 * `CatalogAssemblyError`. `fetch`, when wired, is tried for a version found
 * nowhere before that fails; `side` is what the declaring side recorded.
 *
 * **Example** (Resolve an empty dependency declaration)
 *
 * ```ts
 * import { resolvePnpmfiles } from "@beep/repo-workspaces/internal/configDependencyResolution"
 * import * as Effect from "effect/Effect"
 *
 * const resolved = await Effect.runPromise(resolvePnpmfiles("/workspace", {}))
 *
 * console.log(resolved.length) // 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const resolvePnpmfiles: {
  (
    configDependencies: Readonly<Record<string, string>>,
    side?: HookReplayContext.Encoded,
    fetch?: FetchConfigDependency
  ): (root: string) => Effect.Effect<ReadonlyArray<ResolvedPnpmfile>, CatalogAssemblyError, LadderServices>;
  (
    root: string,
    configDependencies: Readonly<Record<string, string>>,
    side?: HookReplayContext.Encoded,
    fetch?: FetchConfigDependency
  ): Effect.Effect<ReadonlyArray<ResolvedPnpmfile>, CatalogAssemblyError, LadderServices>;
} = dual(
  (args) => P.isString(args[0]) && args.length >= 2,
  Effect.fnUntraced(function* (
    root: string,
    configDependencies: Readonly<Record<string, string>>,
    side: HookReplayContext.Encoded = {},
    fetch?: FetchConfigDependency
  ): Effect.fn.Return<ReadonlyArray<ResolvedPnpmfile>, CatalogAssemblyError, LadderServices> {
    const entries = yield* declaredEntries(configDependencies);
    const services = yield* Effect.context<LadderServices>();
    // decision: store-discovery-shared-per-call
    const stores = yield* memoizeSuccess(discoverStores(root).pipe(Effect.provide(services)));
    const locks: RecordedLocks =
      side.lockfile === undefined
        ? Effect.as(Effect.void, undefined)
        : yield* memoizeSuccess(PnpmEnvLockfile.configDependencies(side.lockfile));
    const call: LadderCall = { stores, locks, side, fetch: O.fromUndefinedOr(fetch) };
    return yield* Effect.forEach(
      entries,
      Effect.fnUntraced(function* (entry) {
        const { name, version } = entry;
        const { dir, source } = yield* resolveDirectory(root, entry, call);
        const pnpmfile = yield* pnpmfileIn(name, dir);
        return ResolvedPnpmfile.make({ name, version, source, path: O.getOrUndefined(pnpmfile) });
      }),
      { concurrency: "unbounded" }
    );
  })
);

/**
 * The `layerFrom` counterpart of {@link resolvePnpmfiles}: look each declared
 * `(name, version)` up in a caller-supplied `"<name>@<version>" → path` map.
 * Same order, same `..` refusal, same fail-closed shape for a missing entry
 * — no filesystem is consulted, so it is safe under any `FileSystem` layer.
 *
 * **Example** (Resolve a hook from a supplied map)
 *
 * ```ts
 * import { lookupPnpmfiles } from "@beep/repo-workspaces/internal/configDependencyResolution"
 * import * as Effect from "effect/Effect"
 *
 * const resolved = Effect.runSync(lookupPnpmfiles(
 *   { "workspace-config@1.0.0": "/hooks/pnpmfile.cjs" },
 *   { "workspace-config": "1.0.0" },
 * ))
 *
 * console.log(resolved[0]?.path) // /hooks/pnpmfile.cjs
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const lookupPnpmfiles: {
  (
    configDependencies: Readonly<Record<string, string>>
  ): (
    entries: Readonly<Record<string, string>>
  ) => Effect.Effect<ReadonlyArray<ResolvedPnpmfile>, CatalogAssemblyError>;
  (
    entries: Readonly<Record<string, string>>,
    configDependencies: Readonly<Record<string, string>>
  ): Effect.Effect<ReadonlyArray<ResolvedPnpmfile>, CatalogAssemblyError>;
} = dual(
  2,
  (
    entries: Readonly<Record<string, string>>,
    configDependencies: Readonly<Record<string, string>>
  ): Effect.Effect<ReadonlyArray<ResolvedPnpmfile>, CatalogAssemblyError> =>
    Effect.flatMap(declaredEntries(configDependencies), (declared) =>
      Effect.forEach(
        declared,
        ({ name, version }) => {
          const key = `${name}@${version}`;
          const path = entries[key];
          if (path === undefined) {
            const known = R.keys(entries);
            return Effect.fail(
              hooksError(
                name,
                ConfigDependencyResolutionError.make({
                  message: `config dependency ${key} has no entry in the supplied pnpmfile map (known: ${
                    known.length === 0 ? "none" : A.join(known, ", ")
                  })`,
                }),
                undefined
              )
            );
          }
          return Effect.succeed(ResolvedPnpmfile.make({ name, version, source: "supplied", path }));
        },
        { concurrency: 1 }
      )
    )
);
