// "What did this workspace look like at that moment": `at(ref)` reads workspace
// state at a git ref with NO checkout, `worktree()` reads the live tree.
//
// `at(ref)` runs entirely through `@effected/git`'s `Git` service — no
// filesystem enumeration, only the live root walk (the one place it touches the
// working tree, because you need a repository to run git against). Package
// discovery reuses the compiled `@effected/glob` set, matched against
// `Git.lsTree` output rather than a directory descent. Catalogs assemble from the inline
// config source at the ref plus the detected manager's own lockfile at the ref,
// and BOTH pnpm and bun carry catalogs, so the lockfile read is PM-aware.
//
// `worktree()` reuses `WorkspaceDiscovery` and `WorkspaceCatalogs` — the ONE
// shared read path, never a second manifest/lockfile read.

import { $ScratchpadId } from "@beep/identity/packages";
import type { GitCommandError, NotARepositoryError, UnknownRefError } from "../git/index.ts";
import { Git } from "../git/index.ts";
import { GlobSet } from "../glob/index.ts";
import { Lockfile as LockfileModel, filenameFor } from "../lockfiles/index.ts";
import { CatalogAssemblyError } from "../npm/index.ts";
import { Yaml } from "../yaml/index.ts";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import type { HookReplay } from "./ConfigDependencyHooks.ts";
import { ConfigDependencyHooks } from "./ConfigDependencyHooks.ts";
import { importerVersionsOf } from "./internal/importerVersions.ts";
import { findLayerRoot } from "./internal/layerRoot.ts";
import { manifestPatternsOf, pnpmPatternsOf } from "./internal/patterns.ts";
import type { ImporterVersions } from "./WorkspaceCatalogs.ts";
import { CatalogSet, WorkspaceCatalogs, injectFromDocument } from "./WorkspaceCatalogs.ts";
import type { WorkspaceDiscoveryFailure } from "./WorkspaceDiscovery.ts";
import { WorkspaceDiscovery } from "./WorkspaceDiscovery.ts";
import type { WorkspaceRootNotFoundError } from "./WorkspaceRoot.ts";
import { WorkspaceRoot } from "./WorkspaceRoot.ts";
import { PackageStateSnapshot, WorkspaceStateSnapshot } from "./WorkspaceStateSnapshot.ts";

const $I = $ScratchpadId.create("effected/workspaces/WorkspaceSnapshots");

/**
 * Every failure `WorkspaceSnapshots.at` can surface: git's own typed
 * errors, a catalog-assembly failure from the inline config source or the
 * config-dependency hook replay at the ref, or an unfindable workspace root.
 *
 * @remarks
 * Narrow by design. `at` reads through git and never enumerates the live
 * filesystem, so no `WorkspaceDiscoveryError` / `WorkspacePatternError` appears —
 * and a malformed *lockfile* at the ref degrades to no catalogs (a lockfile is a
 * record, not a source of truth), so only the inline source and a
 * `hooks`-source replay failure raise `CatalogAssemblyError`.
 *
 * @public
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
 * @remarks
 * `worktree` never invokes git — it reads the live tree over
 * {@link WorkspaceDiscovery} and {@link WorkspaceCatalogs} — so no git error is
 * reachable.
 *
 * @public
 */
export type WorkspaceSnapshotWorktreeFailure = WorkspaceDiscoveryFailure | CatalogAssemblyError;

/**
 * Options for the {@link WorkspaceSnapshots} layer.
 *
 * @public
 */
export interface WorkspaceSnapshotsOptions {
	/**
	 * The directory `at(ref)` resolves the workspace root from.
	 *
	 * @defaultValue `process.cwd()`, read lazily on first use inside
	 *   `Effect.suspend`, so a `process.chdir` between providing the layer and the
	 *   first call is honoured.
	 */
	readonly cwd?: string;
	/**
	 * A ceiling for the root ascent from `cwd`, passed straight through to the
	 * `stopAt` of {@link WorkspaceRoot}'s `find`.
	 *
	 * @remarks
	 * Inclusive, and resolved to an absolute path exactly as `cwd` is. When no
	 * root is found at or below the ceiling, `at(ref)` fails with
	 * {@link WorkspaceRootNotFoundError} carrying the resolved `stopAt` rather
	 * than adopting an enclosing directory's workspace. Pass the same value as
	 * {@link WorkspaceDiscoveryOptions.stopAt} so every service agrees on the
	 * root; the `Workspaces.*` composites forward one `stopAt` to all of them.
	 *
	 * @defaultValue no ceiling — the ascent runs to the filesystem root.
	 */
	readonly stopAt?: string | undefined;
	/**
	 * Catalogs every snapshot this service produces carries as its
	 * `seededCatalogs` — consulted only where the snapshot's own catalogs cannot
	 * answer.
	 *
	 * @remarks
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
	 */
	readonly seedCatalogs?: CatalogSet;
}

/**
 * The {@link WorkspaceSnapshots} service shape.
 *
 * @public
 */
export interface WorkspaceSnapshotsShape {
	/**
	 * The workspace state at a git ref, read with no checkout. Cached per
	 * `(root, ref)`.
	 *
	 * @remarks
	 * The ref's `pnpm-workspace.yaml` `configDependencies` are replayed through
	 * the {@link ConfigDependencyHooks} layer in scope at the versions THAT ref
	 * declares (a replaying layer resolves them via `.pnpm-config` or the pnpm
	 * store and fails closed when a declared version is installed nowhere;
	 * `layerNoop` executes nothing). The injected catalogs merge above the
	 * ref's lockfile and inline sources, exactly as the live assembler does.
	 */
	readonly at: (ref: string) => Effect.Effect<WorkspaceStateSnapshot, WorkspaceSnapshotAtFailure>;
	/** The live workspace state, over discovery and catalog assembly. Uncached. */
	readonly worktree: Effect.Effect<WorkspaceStateSnapshot, WorkspaceSnapshotWorktreeFailure>;
}

/**
 * Project the live replay record onto the snapshot's `name → version` field:
 * a snapshot is "what the workspace looked like then", and WHERE this machine
 * found each pnpmfile is machine-local provenance that does not belong on a
 * serializable value.
 */
const hookVersionsOf = (replays: Readonly<Record<string, HookReplay>>): Record<string, string> => {
	const versions: Record<string, string> = {};
	for (const [name, replay] of Object.entries(replays)) versions[name] = replay.version;
	return versions;
};

/** Whether `value` is a non-null, non-array object. */
const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether every value in a record is a string — a usable dependency map. */
const isStringRecord = (value: unknown): value is Record<string, string> =>
	isObject(value) && Object.values(value).every((entry) => typeof entry === "string");

/**
 * Parse JSON tolerantly into a plain object. At-ref content is not ours to fix:
 * a corrupt or non-object manifest degrades to `{}` rather than failing the
 * whole snapshot, matching the tolerant projection discovery already uses.
 */
const parseJsonObject = (text: string): Record<string, unknown> => {
	try {
		const parsed: unknown = JSON.parse(text);
		return isObject(parsed) ? parsed : {};
	} catch {
		return {};
	}
};

/**
 * Project one `package.json` text (as read at a ref) into a
 * {@link PackageStateSnapshot}. An absent path, unparseable content, or a
 * manifest with no usable name is skipped — never an error.
 */
const snapshotOf = (content: O.Option<string>, relativePath: string): O.Option<PackageStateSnapshot> => {
	if (O.isNone(content)) return O.none();
	const parsed = parseJsonObject(content.value);
	const name = parsed.name;
	if (typeof name !== "string" || name.length === 0) return O.none();
	// Absent stays absent. At-ref content is not ours to fix, so a present but
	// unusable `version` (a non-string, or `""`) degrades to absent rather than
	// failing the snapshot — the tolerance this projection applies throughout.
	const version = parsed.version;
	return O.some(
		PackageStateSnapshot.make({
			name,
			...(typeof version === "string" && version !== "" ? { version } : {}),
			relativePath,
			...(isStringRecord(parsed.dependencies) ? { dependencies: parsed.dependencies } : {}),
			...(isStringRecord(parsed.devDependencies) ? { devDependencies: parsed.devDependencies } : {}),
			...(isStringRecord(parsed.peerDependencies) ? { peerDependencies: parsed.peerDependencies } : {}),
			...(isStringRecord(parsed.optionalDependencies) ? { optionalDependencies: parsed.optionalDependencies } : {}),
		}),
	);
};

/**
 * bun's inline catalogs from the root manifest's `workspaces.catalog` /
 * `.catalogs`, read **tolerantly** — at-ref content is not ours to fix, so a
 * malformed block degrades rather than failing the snapshot. (The live
 * {@link WorkspaceCatalogs} reader hard-fails the same shape; the difference is
 * deliberate.) Normalization is the shared {@link CatalogSet.fromBunBlocks}.
 */
const bunInlineCatalogs = (manifest: Record<string, unknown>): CatalogSet => {
	const workspaces = manifest.workspaces;
	if (!isObject(workspaces)) return CatalogSet.empty();
	return CatalogSet.fromBunBlocks({ catalog: workspaces.catalog, catalogs: workspaces.catalogs });
};

/**
 * What one parse of a manager's lockfile contributes to a snapshot: the catalogs
 * it records, and each importer's resolved versions.
 *
 * @remarks
 * Both come from the SAME parse deliberately. Reading the lockfile twice — once
 * for catalogs, once for importer versions — would let the two halves disagree
 * if the file changed between reads, and would double the git object reads
 * `at(ref)` performs per snapshot.
 */
interface LockfileRecord {
	readonly catalogs: CatalogSet;
	readonly importerVersions: ImporterVersions;
}

/** The contribution of an absent or malformed lockfile: nothing, on both counts. */
const EMPTY_LOCKFILE_RECORD: LockfileRecord = { catalogs: CatalogSet.empty(), importerVersions: {} };

/** A defect naming the unstubbed test-double method — a test-wiring mistake, not a typed failure. */
const unstubbed = (method: string): Effect.Effect<never> =>
	Effect.die(
		new Error(`WorkspaceSnapshots.makeTest: ${method}() was called but not stubbed — pass a \`${method}\` override.`),
	);

/**
 * Reads workspace state at a git ref with no checkout, and the live worktree.
 *
 * @remarks
 * `at(ref)` is cached per `(resolved root, ref)` via
 * `Effect.cachedInvalidateWithTTL` at `Duration.infinity`, invalidated on any
 * non-success exit — never bare `Effect.cached`, which would memoize an
 * interrupt. A failed `at(ref)` init is therefore retried on the next call, not
 * memoized.
 *
 * @example
 * ```ts
 * import { WorkspaceSnapshots } from "./index.ts";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const snapshots = yield* WorkspaceSnapshots;
 *   const before = yield* snapshots.at("origin/main");
 *   const after = yield* snapshots.worktree;
 *   return { before: before.versions, after: after.versions };
 * });
 * ```
 *
 * @public
 */
export class WorkspaceSnapshots extends Context.Service<WorkspaceSnapshots, WorkspaceSnapshotsShape>()(
	$I`WorkspaceSnapshots`,
) {
	/**
	 * Builds the service over `Git`, {@link WorkspaceRoot}, {@link WorkspaceDiscovery},
	 * {@link WorkspaceCatalogs} and {@link ConfigDependencyHooks}.
	 *
	 * @remarks
	 * `ConfigDependencyHooks` is what `at(ref)` replays a ref's
	 * `configDependencies` through — at the versions THAT ref declares, which is
	 * why the composites hand the same hooks layer to this service and to
	 * `WorkspaceCatalogs`. Under `layerNoop` the ref read executes nothing.
	 */
	static readonly make = (
		options?: WorkspaceSnapshotsOptions,
	): Effect.Effect<
		WorkspaceSnapshotsShape,
		never,
		Git | WorkspaceRoot | WorkspaceDiscovery | WorkspaceCatalogs | ConfigDependencyHooks
	> =>
		Effect.gen(function* () {
			const git = yield* Git;
			const roots = yield* WorkspaceRoot;
			const discovery = yield* WorkspaceDiscovery;
			const catalogsService = yield* WorkspaceCatalogs;
			const hooks = yield* ConfigDependencyHooks;

			// One seed for the layer's life, applied to every snapshot this service
			// hands back. Kept as a function rather than inlined so `at` and
			// `worktree` cannot drift on whether they seed — a seeded `at` diffed
			// against an unseeded `worktree` is precisely the asymmetric-resolution
			// bug the seam exists to remove.
			const seeded = (snapshot: WorkspaceStateSnapshot): WorkspaceStateSnapshot =>
				options?.seedCatalogs === undefined ? snapshot : snapshot.withSeededCatalogs(options.seedCatalogs);

			/** A manager's lockfile text at the ref, `none` when the ref has none. */
			const lockfileText = (
				root: string,
				ref: string,
				format: "pnpm" | "bun",
			): Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError | UnknownRefError> =>
				// `./`-prefixed so git resolves the lockfile relative to `cwd` (the
				// workspace root), NOT the git repo top-level — see `computeAt`.
				git.show(root, ref, `./${filenameFor(format)}`);

			/**
			 * What a manager's lockfile records at the ref: its catalog set and its
			 * importer versions, from ONE parse. Empty on both counts when the
			 * lockfile is absent or malformed.
			 */
			const lockfileRecord = (content: O.Option<string>, format: "pnpm" | "bun"): Effect.Effect<LockfileRecord> =>
				O.match(content, {
					onNone: () => Effect.succeed(EMPTY_LOCKFILE_RECORD),
					onSome: (text) =>
						LockfileModel.parse(text, { format }).pipe(
							Effect.map((lockfile) => ({
								catalogs: CatalogSet.fromLockfile(lockfile),
								importerVersions: importerVersionsOf(lockfile),
							})),
							// A malformed lockfile at the ref is a broken RECORD, not a
							// broken source of truth — degrade to no catalogs, exactly as
							// the live WorkspaceCatalogs does for an unreadable lockfile.
							Effect.orElseSucceed(() => EMPTY_LOCKFILE_RECORD),
						),
				});

			const computeAt = (
				root: string,
				ref: string,
			): Effect.Effect<WorkspaceStateSnapshot, WorkspaceSnapshotAtFailure> =>
				Effect.gen(function* () {
					// Every workspace-relative path here is `./`-prefixed so git resolves
					// it relative to `cwd` (the resolved workspace root), aligning with
					// `git.lsTree`, which already emits cwd-relative paths. A bare path
					// (`package.json`) resolves relative to the git repo TOP-LEVEL, so a
					// workspace root nested inside a larger repo would read the OUTER
					// manifest and drop or misread its members. `Git.show`'s contract is
					// unchanged — the `./` is this consumer's explicit choice.
					const [pnpmWorkspaceText, rootManifestText] = yield* Effect.all(
						[git.show(root, ref, "./pnpm-workspace.yaml"), git.show(root, ref, "./package.json")],
						{ concurrency: 2 },
					);
					const rootManifest = O.match(rootManifestText, {
						onNone: (): Record<string, unknown> => ({}),
						onSome: parseJsonObject,
					});

					let patterns: ReadonlyArray<string>;
					let inline: CatalogSet;
					let injected: CatalogSet;
					let recorded: LockfileRecord;
					// The replay record: what the hooks layer resolved on the pnpm path,
					// empty on the bun one (config dependencies are a pnpm feature).
					let hookReplays: Readonly<Record<string, HookReplay>> = {};

					if (O.isSome(pnpmWorkspaceText)) {
						const document = yield* Yaml.parse(pnpmWorkspaceText.value).pipe(
							Effect.mapError(
								(cause) => CatalogAssemblyError.make({ source: "manifest", path: "pnpm-workspace.yaml", cause }),
							),
						);
						const pnpmPatterns = pnpmPatternsOf(document);
						// A `pnpm-workspace.yaml` with no `packages:` falls back to
						// the root manifest's `workspaces` field, matching live `readPatterns`.
						patterns = pnpmPatterns.length > 0 ? pnpmPatterns : manifestPatternsOf(rootManifest);
						inline = yield* CatalogSet.fromWorkspaceYaml(pnpmWorkspaceText.value);
						// Replay the ref's config-dependency hooks at the versions the ref's
						// OWN `configDependencies` declare, seeded by the ref's inline
						// catalogs — mirroring the live assembler. A replaying layer resolves
						// each declared version through `.pnpm-config` or the pnpm store, so
						// a config dependency bumped between two refs yields two different
						// injected sets; `layerNoop` returns the seed and executes nothing.
						// The ref's OWN lockfile is read once and serves twice: as the
						// record below, and as the integrity source a fetched config
						// dependency is verified against — the base side of a diff is
						// checked against the base side's pins, never the working tree's.
						const lockfile = yield* lockfileText(root, ref, "pnpm");
						const replayed = yield* injectFromDocument(hooks, root, document, inline, {
							lockfile: O.getOrUndefined(lockfile),
							ref,
						});
						injected = replayed.injected;
						hookReplays = replayed.injection.replays;
						recorded = yield* lockfileRecord(lockfile, "pnpm");
					} else {
						// With no `pnpm-workspace.yaml`, the workspace globs come
						// from the root `package.json` `workspaces` field. WITHOUT this, a
						// bun or npm workspace collapses to the root package alone at a ref,
						// and a consumer diffing two snapshots sees every declared dependency
						// as newly added.
						patterns = manifestPatternsOf(rootManifest);
						// Inline catalogs come from the root manifest UNCONDITIONALLY: a bun
						// workspace declaring `workspaces.catalog`/`.catalogs` with no committed
						// `bun.lock` at the ref still has catalogs, and gating them on the
						// lockfile would make `at(ref)` and `worktree()` (which reads inline
						// via `fromManifestWorkspaces` regardless of any lockfile) disagree. `bunInlineCatalogs` is
						// tolerant: an npm/yarn array-form `workspaces` yields empty. The
						// lockfile half degrades the absent `bun.lock` to empty on `Option.none`.
						inline = bunInlineCatalogs(rootManifest);
						// Config dependencies are a pnpm feature; there are none on this path.
						injected = CatalogSet.empty();
						recorded = yield* lockfileRecord(yield* lockfileText(root, ref, "bun"), "bun");
					}

					// Precedence follows the live assembler: lockfile record first, then
					// the inline declaration, then the hook-injected set (which already
					// carries the inline seed).
					const catalogs = CatalogSet.merge(recorded.catalogs, inline, injected);

					const globs = yield* GlobSet.compile(patterns).pipe(
						Effect.mapError(
							(error) => CatalogAssemblyError.make({ source: "manifest", path: error.pattern, cause: error }),
						),
					);

					// Package directories come from the tree listing at the ref, matched
					// against the compiled glob set — no directory descent, because
					// `ls-tree -r` already enumerates every path (globstar included).
					const entries = yield* git.lsTree(root, ref);
					const memberDirs: Array<string> = [];
					let hasRootManifest = false;
					for (const entry of entries) {
						if (entry.type !== "blob") continue;
						if (entry.path === "package.json") {
							hasRootManifest = true;
							continue;
						}
						if (!entry.path.endsWith("/package.json")) continue;
						const dir = entry.path.slice(0, entry.path.length - "/package.json".length);
						if (globs.matches(dir)) memberDirs.push(dir);
					}
					memberDirs.sort();

					const members = yield* Effect.forEach(
						memberDirs,
						(dir) =>
							git.show(root, ref, `./${dir}/package.json`).pipe(Effect.map((content) => snapshotOf(content, dir))),
						{ concurrency: 10 },
					);

					const rootPackage = hasRootManifest ? snapshotOf(rootManifestText, ".") : O.none<PackageStateSnapshot>();
					const packages: Array<PackageStateSnapshot> = [];
					if (O.isSome(rootPackage)) packages.push(rootPackage.value);
					for (const member of members) {
						if (O.isSome(member)) packages.push(member.value);
					}

					return seeded(
						WorkspaceStateSnapshot.make({
							packages,
							catalogs,
							importerVersions: recorded.importerVersions,
							hookReplays: hookVersionsOf(hookReplays),
						}),
					);
				});

			// Per-`(root, ref)` memo of the success-only invalidating cell. A failed
			// init invalidates its cell, so the next call recomputes rather than
			// replaying the failure.
			const atCaches = new Map<string, Effect.Effect<WorkspaceStateSnapshot, WorkspaceSnapshotAtFailure>>();

			const at = Effect.fn("WorkspaceSnapshots.at")(function* (ref: string) {
				// The ambient cwd is read at call time, not layer build (`findLayerRoot` suspends).
				const root = yield* findLayerRoot(roots, options);
				// NUL-separated — a NUL can occur in neither a path nor a ref, so keys
				// cannot collide. Kept as the `\0` escape deliberately: a literal NUL
				// byte makes `file` classify this source as binary and grep/ripgrep
				// silently skip it.
				const key = `${root}\0${ref}`;
				let memo = atCaches.get(key);
				if (memo === undefined) {
					const [resolveOnce, invalidate] = yield* Effect.cachedInvalidateWithTTL(
						computeAt(root, ref),
						Duration.infinity,
					);
					const built = Effect.onExit(resolveOnce, (exit) => (Exit.isSuccess(exit) ? Effect.void : invalidate));
					// Re-check under the benign concurrent-miss race: keep whichever cell
					// landed first so callers dedupe onto one.
					const existing = atCaches.get(key);
					if (existing !== undefined) {
						memo = existing;
					} else {
						memo = built;
						atCaches.set(key, memo);
					}
				}
				return yield* memo;
			});

			const worktree = Effect.suspend(Effect.fn("WorkspaceSnapshots.worktree")(function* () {
				// The ONE shared read path: discovery's memo and the catalog memo, no
				// second manifest/lockfile read.
				const packages = yield* discovery.listPackages;
				const catalogs = yield* catalogsService.set;
				// Off the SAME memoized assemble pass as `set()` — no second lockfile
				// read. Symmetry with `at(ref)` is the point: both sides of a diff must
				// answer an unresolvable `catalog:` specifier the same way, or the
				// fallback would manufacture a bogus row on every run.
				const importerVersions = yield* catalogsService.importerVersions;
				// Same memo again: which version each config dependency replayed from.
				const hookReplays = yield* catalogsService.hookReplays;
				const snapshotPackages = packages.map((pkg) =>
					PackageStateSnapshot.make({
						name: pkg.name,
						// A version-less member omits the key, exactly as `snapshotOf` does
						// for the same manifest at a ref: both sides of a diff must answer
						// the same way, or the missing field would read as a change.
						...(pkg.version === undefined ? {} : { version: pkg.version }),
						relativePath: pkg.relativePath,
						dependencies: pkg.dependencies,
						devDependencies: pkg.devDependencies,
						peerDependencies: pkg.peerDependencies,
						optionalDependencies: pkg.optionalDependencies,
					}),
				);
				return seeded(
					WorkspaceStateSnapshot.make({
						packages: snapshotPackages,
						catalogs,
						importerVersions,
						hookReplays: hookVersionsOf(hookReplays),
					}),
				);
			}));

			return { at, worktree };
		});

	/**
	 * The live layer, reading workspace state at a git ref or from the live
	 * worktree.
	 *
	 * @remarks
	 * Parameterized, so it mints a fresh reference per call — bind it to a
	 * `const` and reuse it, or layer memoization does not apply.
	 *
	 * @param options - Root resolution and the optional `seedCatalogs`.
	 */
	static readonly layer = (
		options?: WorkspaceSnapshotsOptions,
	): Layer.Layer<
		WorkspaceSnapshots,
		never,
		Git | WorkspaceRoot | WorkspaceDiscovery | WorkspaceCatalogs | ConfigDependencyHooks
	> => Layer.effect(WorkspaceSnapshots, WorkspaceSnapshots.make(options));

	/**
	 * A test double satisfying the full {@link WorkspaceSnapshotsShape} with no
	 * git, filesystem, discovery, or catalog assembly.
	 *
	 * @remarks
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
	 * @example
	 * ```ts
	 * import { CatalogSet, WorkspaceSnapshots, WorkspaceStateSnapshot } from "./index.ts";
	 * import { Effect } from "effect";
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
	 * ```
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
	 * @remarks
	 * A parameterized layer factory mints a **fresh reference per call**, and
	 * layers memoize by reference — bind the result to a `const` and reuse it
	 * rather than calling `layerTest(...)` at each composition site.
	 *
	 * @example
	 * ```ts
	 * import { CatalogSet, WorkspaceSnapshots, WorkspaceStateSnapshot } from "./index.ts";
	 * import { Effect } from "effect";
	 *
	 * const TestSnapshots = WorkspaceSnapshots.layerTest({
	 *   worktree:
	 *     Effect.succeed(
	 *       WorkspaceStateSnapshot.make({ packages: [], catalogs: CatalogSet.empty(), importerVersions: {} }),
	 *     ),
	 * });
	 * // program.pipe(Effect.provide(TestSnapshots))
	 * ```
	 */
	static readonly layerTest = (overrides: Partial<WorkspaceSnapshotsShape> = {}): Layer.Layer<WorkspaceSnapshots> =>
		Layer.succeed(WorkspaceSnapshots, WorkspaceSnapshots.makeTest(overrides));
}
