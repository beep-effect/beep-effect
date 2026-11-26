/**
 * "What did this workspace look like at that moment": `at(ref)` reads workspace
 * state at a git ref with NO checkout, `worktree()` reads the live tree.
 *
 * **Details**
 *
 * `at(ref)` runs entirely through `@beep/git`'s `Git` service — no
 * filesystem enumeration, only the live root walk (the one place it touches the
 * working tree, because you need a repository to run git against). Package
 * discovery reuses the compiled `@beep/glob` set, matched against
 * `Git.lsTree` output rather than a directory descent. Catalogs assemble from the inline
 * config source at the ref plus the detected manager's own lockfile at the ref,
 * and BOTH pnpm and bun carry catalogs, so the lockfile read is PM-aware.
 *
 * `worktree()` reuses `WorkspaceDiscovery` and `WorkspaceCatalogs` — the ONE
 * shared read path, never a second manifest/lockfile read.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Git } from "@beep/git";
import { GlobSet } from "@beep/glob";
import { $RepoWorkspacesId } from "@beep/identity/packages";
import { filenameFor, Lockfile as LockfileModel } from "@beep/lockfiles";
import { CatalogAssemblyError } from "@beep/npm-spec/CatalogAssemblyError";
import * as O from "@beep/utils/Option";
import { Yaml } from "@beep/yaml";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ConfigDependencyHooks } from "./ConfigDependencyHooks.ts";
import { importerVersionsOf } from "./internal/importerVersions.ts";
import { findLayerRoot } from "./internal/layerRoot.ts";
import { dependencyBlocksOf } from "./internal/manifestFields.ts";
import { CatalogSet, ImporterVersions, injectFromDocument, WorkspaceCatalogs } from "./WorkspaceCatalogs.ts";
import { WorkspaceDiscovery } from "./WorkspaceDiscovery.ts";
import { WorkspacePatterns } from "./WorkspacePatterns.ts";
import { WorkspaceRoot } from "./WorkspaceRoot.ts";
import { PackageStateSnapshot, WorkspaceStateSnapshot } from "./WorkspaceStateSnapshot.ts";
import type { GitCommandError, NotARepositoryError, UnknownRefError } from "@beep/git";
import type { HookReplay } from "./ConfigDependencyReplay.ts";
import type { WorkspaceDiscoveryFailure } from "./WorkspaceDiscovery.ts";
import type { WorkspaceRootNotFoundError } from "./WorkspaceRoot.ts";

const $I = $RepoWorkspacesId.create("WorkspaceSnapshots");
const JsonValue = S.fromJsonString(S.Unknown);
const JsonObject = S.Record(S.String, S.Unknown).pipe(
  $I.annoteSchema("JsonObject", { description: "A non-array JSON object read from a manifest." })
);

/**
 * Every failure `WorkspaceSnapshots.at` can surface: git's own typed
 * errors, a catalog-assembly failure from the inline config source or the
 * config-dependency hook replay at the ref, or an unfindable workspace root.
 *
 * **Details**
 *
 * Narrow by design. `at` reads through git and never enumerates the live
 * filesystem, so no `WorkspaceDiscoveryError` / `WorkspacePatternError` appears —
 * and a malformed *lockfile* at the ref degrades to no catalogs (a lockfile is a
 * record, not a source of truth), so only the inline source and a
 * `hooks`-source replay failure raise `CatalogAssemblyError`.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type WorkspaceSnapshotAtFailure =
  | GitCommandError
  | NotARepositoryError
  | UnknownRefError
  | CatalogAssemblyError
  | WorkspaceRootNotFoundError;

/**
 * Every failure `WorkspaceSnapshots.worktree` can surface: the discovery
 * failures plus a catalog-assembly failure.
 *
 * **Details**
 *
 * `worktree` never invokes git — it reads the live tree over
 * {@link WorkspaceDiscovery} and {@link WorkspaceCatalogs} — so no git error is
 * reachable.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type WorkspaceSnapshotWorktreeFailure = WorkspaceDiscoveryFailure | CatalogAssemblyError;

/**
 * Configures root resolution and fallback catalogs for the {@link WorkspaceSnapshots} layer.
 *
 * **Example** (Read optional snapshot inputs)
 *
 * ```ts
 * import { WorkspaceSnapshotsOptions } from "@beep/repo-workspaces/WorkspaceSnapshots";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(WorkspaceSnapshotsOptions)({})) // true
 * ```
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export class WorkspaceSnapshotsOptions extends S.Opaque<WorkspaceSnapshotsOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * The directory `at(ref)` resolves the workspace root from.
     *
     * @defaultValue `process.cwd()`, read lazily on first use inside
     *   `Effect.suspend`, so a `process.chdir` between providing the layer and the
     *   first call is honoured.
     *
     * @since 0.0.0
     */
    cwd: S.optionalKey(S.String).pipe(
      $I.annoteKey("WorkspaceSnapshotsOptions.cwd", { description: "Starting directory, defaulted lazily on use." })
    ),
    /**
     * A ceiling for the root ascent from `cwd`, passed straight through to the
     * `stopAt` of {@link WorkspaceRoot}'s `find`.
     *
     * **Details**
     *
     * Inclusive, and resolved to an absolute path exactly as `cwd` is. When no
     * root is found at or below the ceiling, `at(ref)` fails with
     * {@link WorkspaceRootNotFoundError} carrying the resolved `stopAt` rather
     * than adopting an enclosing directory's workspace. Pass the same value as
     * {@link WorkspaceDiscoveryOptions.stopAt} so every service agrees on the
     * root; the `Workspaces.*` composites forward one `stopAt` to all of them.
     *
     * @defaultValue no ceiling — the ascent runs to the filesystem root.
     *
     * @since 0.0.0
     */
    stopAt: S.optionalKey(S.String).pipe(
      $I.annoteKey("WorkspaceSnapshotsOptions.stopAt", {
        description: "Inclusive ceiling; absent leaves ascent unbounded.",
      })
    ),
    /**
     * Catalogs every snapshot this service produces carries as its
     * `seededCatalogs` — consulted only where the snapshot's own catalogs cannot
     * answer.
     *
     * **Details**
     *
     * The layer-level spelling of `WorkspaceStateSnapshot.withSeededCatalogs`,
     * for the common case where the seed is the same for every read: a consumer
     * diffing many refs against one live workspace seeds once here instead of
     * remembering to call `withSeededCatalogs` at each site — and a forgotten
     * call is a silently missing diff row, not a type error.
     *
     * **This executes nothing by itself.** The caller supplies the set, and
     * `at(ref)` still never fetches. Whether `at(ref)` replays that ref's
     * config-dependency hooks is decided by the {@link ConfigDependencyHooks}
     * layer in scope, not by this option: under a replaying layer the ref's own
     * replay answers first and the seed fills only what neither source declared;
     * under `layerNoop` the seed is the only way a hook-injected catalog reaches
     * the ref side at all.
     *
     * Applied to `worktree()` too, for symmetry. There it is usually inert: a
     * live set assembled under a config-dependency layer already contains the
     * hook-injected catalogs at full precedence, so the seed answers nothing the
     * snapshot could not answer itself.
     *
     * @defaultValue absent — no seed.
     *
     * @since 0.0.0
     */
    seedCatalogs: S.optionalKey(CatalogSet).pipe(
      $I.annoteKey("WorkspaceSnapshotsOptions.seedCatalogs", {
        description: "Fallback catalogs consulted after the snapshot own catalogs.",
      })
    ),
  }).pipe(
    $I.annoteSchema("WorkspaceSnapshotsOptions", {
      description: "Plain-object snapshot root and seed options with defaults applied on use.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace WorkspaceSnapshotsOptions {
  /**
   * The plain, unbranded encoded shape of a {@link WorkspaceSnapshotsOptions}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof WorkspaceSnapshotsOptions.Encoded;
  /**
   * The constructor input of a {@link WorkspaceSnapshotsOptions}: decoded field values without the
   * brand, so a caller passes a live `CatalogSet` seed rather than their encoded forms.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Input = (typeof WorkspaceSnapshotsOptions)["~type.make.in"];
}

/**
 * Defines the git-ref and live-worktree reads a {@link WorkspaceSnapshots} service must provide.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface WorkspaceSnapshotsShape {
  /**
   * The workspace state at a git ref, read with no checkout. Cached per
   * `(root, ref)`.
   *
   * **Details**
   *
   * The ref's `pnpm-workspace.yaml` `configDependencies` are replayed through
   * the {@link ConfigDependencyHooks} layer in scope at the versions THAT ref
   * declares (a replaying layer resolves them via `.pnpm-config` or the pnpm
   * store and fails closed when a declared version is installed nowhere;
   * `layerNoop` executes nothing). The injected catalogs merge above the
   * ref's lockfile and inline sources, exactly as the live assembler does.
   *
   * @since 0.0.0
   */
  readonly at: (ref: string) => Effect.Effect<WorkspaceStateSnapshot, WorkspaceSnapshotAtFailure>;
  /**
   * The live workspace state, over discovery and catalog assembly. Uncached.
   *
   * @since 0.0.0
   */
  readonly worktree: Effect.Effect<WorkspaceStateSnapshot, WorkspaceSnapshotWorktreeFailure>;
}

const hookVersionsOf = (replays: Readonly<Record<string, HookReplay>>): Record<string, string> =>
  R.fromEntries(A.map(R.toEntries(replays), ([name, replay]) => [name, replay.version]));

const isObject = S.is(JsonObject);

const parseJsonObject = (text: string): Record<string, unknown> =>
  Result.match(S.decodeResult(JsonValue)(text), {
    onFailure: () => ({}),
    onSuccess: (parsed) => (isObject(parsed) ? parsed : {}),
  });

const snapshotOf: {
  (content: O.Option<string>, relativePath: string): O.Option<PackageStateSnapshot>;
  (relativePath: string): (content: O.Option<string>) => O.Option<PackageStateSnapshot>;
} = dual(2, (content: O.Option<string>, relativePath: string): O.Option<PackageStateSnapshot> => {
  if (O.isNone(content)) return O.none();
  const parsed = parseJsonObject(content.value);
  const name = parsed.name;
  if (!P.isString(name) || name.length === 0) return O.none();
  const version = parsed.version;
  return PackageStateSnapshot.makeOption({
    name,
    ...(P.isString(version) && version !== "" ? { version } : {}),
    relativePath,
    ...dependencyBlocksOf(parsed),
  });
});

interface RefDeclarations {
  readonly hookReplays: Readonly<Record<string, HookReplay>>;
  readonly injected: CatalogSet;
  readonly inline: CatalogSet;
  readonly patterns: ReadonlyArray<string>;
  readonly recorded: LockfileRecord;
}

const manifestDirOf = (path: string): O.Option<string> =>
  Str.endsWith("/package.json")(path) ? O.some(Str.slice(0, path.length - "/package.json".length)(path)) : O.none();

const memberDirsOf = (
  entries: ReadonlyArray<{ readonly path: string; readonly type: string }>,
  globs: GlobSet
): { readonly hasRootManifest: boolean; readonly memberDirs: ReadonlyArray<string> } => {
  const blobs = A.filter(entries, (entry) => entry.type === "blob");
  return {
    hasRootManifest: A.some(blobs, (entry) => entry.path === "package.json"),
    memberDirs: A.sort(
      A.filter(A.getSomes(A.map(blobs, (entry) => manifestDirOf(entry.path))), (dir) => globs.matches(dir)),
      Order.String
    ),
  };
};

const bunInlineCatalogs = (manifest: Record<string, unknown>): CatalogSet => {
  const topLevel = CatalogSet.fromBunBlocks({ catalog: manifest.catalog, catalogs: manifest.catalogs });
  const workspaces = manifest.workspaces;
  if (!isObject(workspaces)) return topLevel;
  return CatalogSet.merge(
    topLevel,
    CatalogSet.fromBunBlocks({ catalog: workspaces.catalog, catalogs: workspaces.catalogs })
  );
};

const LockfileRecord = S.Struct({
  catalogs: CatalogSet.pipe(
    $I.annoteKey("LockfileRecord.catalogs", { description: "Catalogs recorded by the lockfile." })
  ),
  importerVersions: ImporterVersions.pipe(
    $I.annoteKey("LockfileRecord.importerVersions", {
      description: "Resolved importer versions from the same lockfile parse.",
    })
  ),
}).pipe(
  $I.annoteSchema("LockfileRecord", { description: "The plain-object contribution of a single lockfile parse." })
);
type LockfileRecord = typeof LockfileRecord.Type;

const EMPTY_LOCKFILE_RECORD: LockfileRecord = { catalogs: CatalogSet.empty(), importerVersions: {} };

class WorkspaceSnapshotsTestDoubleError extends S.TaggedError<
  WorkspaceSnapshotsTestDoubleError,
  { readonly brand: unique symbol }
>($I`WorkspaceSnapshotsTestDoubleError`)(
  "WorkspaceSnapshotsTestDoubleError",
  {
    message: S.String,
  },
  $I.annoteError<WorkspaceSnapshotsTestDoubleError>("WorkspaceSnapshotsTestDoubleError", {
    description: "An unstubbed workspace snapshot test-double method.",
  })
) {}

const unstubbed = (method: string): Effect.Effect<never> =>
  Effect.die(
    WorkspaceSnapshotsTestDoubleError.make({
      message: `WorkspaceSnapshots.makeTest: ${method}() was called but not stubbed — pass a \`${method}\` override.`,
    })
  );

/**
 * Reads workspace state at a git ref with no checkout, and the live worktree.
 *
 * **Details**
 *
 * `at(ref)` is cached per `(resolved root, ref)` via
 * `Effect.cachedInvalidateWithTTL` at `Duration.infinity`, invalidated on any
 * non-success exit — never bare `Effect.cached`, which would memoize an
 * interrupt. A failed `at(ref)` init is therefore retried on the next call, not
 * memoized.
 *
 * **Example** (Read package versions from a git ref and the worktree)
 *
 * ```ts
 * import { WorkspaceSnapshots } from "@beep/repo-workspaces/WorkspaceSnapshots";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const snapshots = yield* WorkspaceSnapshots;
 *   const before = yield* snapshots.at("origin/main");
 *   const after = yield* snapshots.worktree;
 *   return { before: before.versions, after: after.versions };
 * });
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class WorkspaceSnapshots extends Context.Service<WorkspaceSnapshots, WorkspaceSnapshotsShape>()(
  $I`WorkspaceSnapshots`
) {
  /**
   * Builds the service over `Git`, {@link WorkspaceRoot}, {@link WorkspaceDiscovery},
   * {@link WorkspaceCatalogs} and {@link ConfigDependencyHooks}.
   *
   * **Details**
   *
   * `ConfigDependencyHooks` is what `at(ref)` replays a ref's
   * `configDependencies` through — at the versions THAT ref declares, which is
   * why the composites hand the same hooks layer to this service and to
   * `WorkspaceCatalogs`. Under `layerNoop` the ref read executes nothing.
   *
   * **Example** (Construct a workspace snapshot reader)
   *
   * ```ts
   * import { WorkspaceSnapshots } from "@beep/repo-workspaces/WorkspaceSnapshots";
   * import * as Effect from "effect/Effect";
   *
   * const construction = WorkspaceSnapshots.make({ cwd: "/repo", stopAt: "/repo" });
   * console.log(Effect.isEffect(construction)) // true
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly make = Effect.fn("WorkspaceSnapshots.make")(function* (
    options?: WorkspaceSnapshotsOptions.Input
  ): Effect.fn.Return<
    WorkspaceSnapshotsShape,
    never,
    Git | WorkspaceRoot | WorkspaceDiscovery | WorkspaceCatalogs | ConfigDependencyHooks
  > {
    const git = yield* Git;
    const roots = yield* WorkspaceRoot;
    const discovery = yield* WorkspaceDiscovery;
    const catalogsService = yield* WorkspaceCatalogs;
    const hooks = yield* ConfigDependencyHooks;

    const seeded = (snapshot: WorkspaceStateSnapshot): WorkspaceStateSnapshot =>
      options?.seedCatalogs === undefined ? snapshot : snapshot.withSeededCatalogs(options.seedCatalogs);

    const lockfileText: {
      (
        root: string,
        ref: string,
        format: "pnpm" | "bun"
      ): Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
      (
        ref: string,
        format: "pnpm" | "bun"
      ): (root: string) => Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    } = dual(
      3,
      (
        root: string,
        ref: string,
        format: "pnpm" | "bun"
      ): Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError | UnknownRefError> =>
        git.show(root, ref, `./${filenameFor(format)}`)
    );

    const lockfileRecord: {
      (content: O.Option<string>, format: "pnpm" | "bun"): Effect.Effect<LockfileRecord>;
      (format: "pnpm" | "bun"): (content: O.Option<string>) => Effect.Effect<LockfileRecord>;
    } = dual(
      2,
      (content: O.Option<string>, format: "pnpm" | "bun"): Effect.Effect<LockfileRecord> =>
        O.match(content, {
          onNone: () => Effect.succeed(EMPTY_LOCKFILE_RECORD),
          onSome: (text) =>
            LockfileModel.parse(text, { format }).pipe(
              Effect.map((lockfile) => ({
                catalogs: CatalogSet.fromLockfile(lockfile),
                importerVersions: importerVersionsOf(lockfile),
              })),
              Effect.orElseSucceed(() => EMPTY_LOCKFILE_RECORD)
            ),
        })
    );

    const pnpmDeclarations = Effect.fnUntraced(function* (
      root: string,
      ref: string,
      text: string,
      rootManifest: Record<string, unknown>
    ) {
      const document = yield* Yaml.parse(text).pipe(
        Effect.mapError((cause) =>
          CatalogAssemblyError.make({ source: "manifest", path: "pnpm-workspace.yaml", cause })
        )
      );
      const pnpmPatterns = WorkspacePatterns.fromPnpmWorkspace(document);
      const inline = yield* CatalogSet.fromWorkspaceYaml(text);
      const lockfile = yield* lockfileText(root, ref, "pnpm");
      const replayed = yield* injectFromDocument(hooks, root, document, inline, {
        ...O.getSomesStruct({ lockfile }),
        ref,
      });
      const recorded = yield* lockfileRecord(lockfile, "pnpm");
      return {
        patterns: pnpmPatterns.length > 0 ? pnpmPatterns : WorkspacePatterns.fromManifest(rootManifest),
        inline,
        injected: replayed.injected,
        hookReplays: replayed.injection.replays,
        recorded,
      } satisfies RefDeclarations;
    });

    const bunDeclarations = Effect.fnUntraced(function* (
      root: string,
      ref: string,
      rootManifest: Record<string, unknown>
    ) {
      const lockfileText1 = yield* lockfileText(root, ref, "bun");
      const recorded = yield* lockfileRecord(lockfileText1, "bun");
      return {
        patterns: WorkspacePatterns.fromManifest(rootManifest),
        inline: bunInlineCatalogs(rootManifest),
        injected: CatalogSet.empty(),
        hookReplays: {},
        recorded,
      } satisfies RefDeclarations;
    });

    const computeAt: {
      (root: string, ref: string): Effect.Effect<WorkspaceStateSnapshot, WorkspaceSnapshotAtFailure>;
      (ref: string): (root: string) => Effect.Effect<WorkspaceStateSnapshot, WorkspaceSnapshotAtFailure>;
    } = dual(
      2,
      Effect.fnUntraced(function* (
        root: string,
        ref: string
      ): Effect.fn.Return<WorkspaceStateSnapshot, WorkspaceSnapshotAtFailure> {
        const [pnpmWorkspaceText, rootManifestText] = yield* Effect.all(
          [git.show(root, ref, "./pnpm-workspace.yaml"), git.show(root, ref, "./package.json")],
          { concurrency: 2 }
        );
        const rootManifest = O.match(rootManifestText, {
          onNone: (): Record<string, unknown> => ({}),
          onSome: parseJsonObject,
        });

        const { patterns, inline, injected, recorded, hookReplays } = O.isSome(pnpmWorkspaceText)
          ? yield* pnpmDeclarations(root, ref, pnpmWorkspaceText.value, rootManifest)
          : yield* bunDeclarations(root, ref, rootManifest);

        const catalogs = CatalogSet.merge(recorded.catalogs, inline, injected);

        const globs = yield* GlobSet.compile(WorkspacePatterns.forMatching(patterns)).pipe(
          Effect.mapError((error) =>
            CatalogAssemblyError.make({ source: "manifest", path: error.pattern, cause: error })
          )
        );

        const lsTree2 = yield* git.lsTree(root, ref);
        const { hasRootManifest, memberDirs } = memberDirsOf(lsTree2, globs);

        const members = yield* Effect.forEach(
          memberDirs,
          (dir) => git.show(root, ref, `./${dir}/package.json`).pipe(Effect.map(snapshotOf(dir))),
          { concurrency: 10 }
        );

        const rootPackage = hasRootManifest ? snapshotOf(rootManifestText, ".") : O.none<PackageStateSnapshot>();
        const packages = A.getSomes([rootPackage, ...members]);

        return seeded(
          WorkspaceStateSnapshot.make({
            packages,
            catalogs,
            importerVersions: recorded.importerVersions,
            hookReplays: hookVersionsOf(hookReplays),
          })
        );
      })
    );

    const atCaches = MutableHashMap.empty<string, Effect.Effect<WorkspaceStateSnapshot, WorkspaceSnapshotAtFailure>>();

    const at = Effect.fn("WorkspaceSnapshots.at")(function* (ref: string) {
      const root = yield* findLayerRoot(roots, options);
      const key = `${root}\0${ref}`;
      let memo = O.getOrUndefined(MutableHashMap.get(atCaches, key));
      if (memo === undefined) {
        const [resolveOnce, invalidate] = yield* Effect.cachedInvalidateWithTTL(
          computeAt(root, ref),
          Duration.infinity
        );
        const built = Effect.onError(resolveOnce, () => invalidate);
        const existing = O.getOrUndefined(MutableHashMap.get(atCaches, key));
        if (existing !== undefined) {
          memo = existing;
        } else {
          memo = built;
          MutableHashMap.set(atCaches, key, memo);
        }
      }
      return yield* memo;
    });

    const worktree = Effect.suspend(
      Effect.fn("WorkspaceSnapshots.worktree")(function* () {
        const packages = yield* discovery.listPackages;
        const catalogs = yield* catalogsService.set;
        const importerVersions = yield* catalogsService.importerVersions;
        const hookReplays = yield* catalogsService.hookReplays;
        const snapshotPackages = A.map(packages, (pkg) =>
          PackageStateSnapshot.make({
            name: pkg.name,
            ...O.getSomesStruct({ version: O.fromUndefinedOr(pkg.version) }),
            relativePath: pkg.relativePath,
            dependencies: pkg.dependencies,
            devDependencies: pkg.devDependencies,
            peerDependencies: pkg.peerDependencies,
            optionalDependencies: pkg.optionalDependencies,
          })
        );
        return seeded(
          WorkspaceStateSnapshot.make({
            packages: snapshotPackages,
            catalogs,
            importerVersions,
            hookReplays: hookVersionsOf(hookReplays),
          })
        );
      })
    );

    return { at, worktree };
  });

  /**
   * The live layer, reading workspace state at a git ref or from the live
   * worktree.
   *
   * **Gotchas**
   *
   * Parameterized, so it mints a fresh reference per call — bind it to a
   * `const` and reuse it, or layer memoization does not apply.
   *
   * **Example** (Compose a ref read with a reusable live layer)
   *
   * ```ts
   * import { WorkspaceSnapshots } from "@beep/repo-workspaces/WorkspaceSnapshots";
   * import * as Effect from "effect/Effect";
   *
   * const LiveSnapshots = WorkspaceSnapshots.layer({ cwd: "/repo", stopAt: "/repo" });
   * const program = Effect.flatMap(WorkspaceSnapshots, (snapshots) => snapshots.at("origin/main"));
   * const readAtRef = program.pipe(Effect.provide(LiveSnapshots));
   * console.log(Effect.isEffect(readAtRef)) // true
   * ```
   *
   * @param options - Root resolution and the optional `seedCatalogs`.
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = (
    options?: WorkspaceSnapshotsOptions.Input
  ): Layer.Layer<
    WorkspaceSnapshots,
    never,
    Git | WorkspaceRoot | WorkspaceDiscovery | WorkspaceCatalogs | ConfigDependencyHooks
  > => Layer.effect(WorkspaceSnapshots, WorkspaceSnapshots.make(options));

  /**
   * A test double satisfying the full {@link WorkspaceSnapshotsShape} with no
   * git, filesystem, discovery, or catalog assembly.
   *
   * **Gotchas**
   *
   * There are **no honest defaults and no derivations** here: `at(ref)` and
   * `worktree()` are two independent reads of two different sources (a git ref
   * vs. the live tree), so neither can be honestly derived from the other, and
   * a fabricated empty {@link WorkspaceStateSnapshot} on either side of a
   * before/after diff reads as every dependency newly added or removed — the
   * exact silent-empty failure class this package documents on the live paths.
   * Both methods therefore **die** with an instructive defect until stubbed; a
   * test-wiring mistake fails loudly as a defect rather than succeeding with a
   * lie.
   *
   * **A defect is not absorbed by `Effect.catch` or any typed-error handler**,
   * and that is the point: code under test with a best-effort `catch` around
   * its snapshot reads cannot make a mandatory stub look optional — the
   * unstubbed call still fails the test instead of quietly taking the catch
   * branch. Only defect-level combinators (`Effect.catchDefect`,
   * `Effect.exit`) would see it.
   *
   * **Example** (Stub both workspace snapshot reads)
   *
   * ```ts
   * import { WorkspaceSnapshots } from "@beep/repo-workspaces/WorkspaceSnapshots";
   * import { CatalogSet } from "@beep/repo-workspaces/WorkspaceCatalogs";
   * import { WorkspaceStateSnapshot } from "@beep/repo-workspaces/WorkspaceStateSnapshot";
   * import * as Effect from "effect/Effect";
   *
   * const empty = WorkspaceStateSnapshot.make({
   *   packages: [],
   *   catalogs: CatalogSet.empty(),
   *   importerVersions: {},
   * });
   * const double = WorkspaceSnapshots.makeTest({
   *   at: () => Effect.succeed(empty),
   *   worktree: Effect.succeed(empty),
   * });
   * console.log(Effect.runSync(double.at("origin/main")).packages.length) // 0
   * console.log(Effect.runSync(double.worktree).packages.length) // 0
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly makeTest = (overrides: Partial<WorkspaceSnapshotsShape> = {}): WorkspaceSnapshotsShape => ({
    at: () => unstubbed("at"),
    worktree: Effect.suspend(() => unstubbed("worktree")),
    ...overrides,
  });

  /**
   * The test layer: {@link WorkspaceSnapshots.makeTest} behind `Layer.succeed`,
   * so a suite provides only the methods it exercises.
   *
   * **Gotchas**
   *
   * A parameterized layer factory mints a **fresh reference per call**, and
   * layers memoize by reference — bind the result to a `const` and reuse it
   * rather than calling `layerTest(...)` at each composition site.
   *
   * **Example** (Provide a test layer for worktree snapshots)
   *
   * ```ts
   * import { WorkspaceSnapshots } from "@beep/repo-workspaces/WorkspaceSnapshots";
   * import { CatalogSet } from "@beep/repo-workspaces/WorkspaceCatalogs";
   * import { WorkspaceStateSnapshot } from "@beep/repo-workspaces/WorkspaceStateSnapshot";
   * import * as Effect from "effect/Effect";
   *
   * const TestSnapshots = WorkspaceSnapshots.layerTest({
   *   worktree:
   *     Effect.succeed(
   *       WorkspaceStateSnapshot.make({ packages: [], catalogs: CatalogSet.empty(), importerVersions: {} }),
   *     ),
   * });
   * const program = Effect.flatMap(WorkspaceSnapshots, (snapshots) => snapshots.worktree).pipe(
   *   Effect.provide(TestSnapshots),
   * );
   * console.log(Effect.runSync(program).packages.length) // 0
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerTest = (overrides: Partial<WorkspaceSnapshotsShape> = {}): Layer.Layer<WorkspaceSnapshots> =>
    Layer.succeed(WorkspaceSnapshots, WorkspaceSnapshots.makeTest(overrides));
}
