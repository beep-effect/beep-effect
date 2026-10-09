// The composite layers.
//
// The composites split on PLATFORM REQUIREMENTS, not on a feature flag:
// `layer` needs a filesystem, `layerWithGit` additionally needs core's
// `ChildProcessSpawner` (behind `@effected/git`'s `Git` service) to run git.

import { ExecContext, LocalExec, LocalExecError } from "../commands/index.ts";
import { Git } from "../git/index.ts";
import type {
	CatalogAssemblyError,
	CatalogResolver,
	DependencyResolutionError,
	Manifest,
	UnresolvedDependencyError,
	WorkspaceResolver,
} from "../npm/index.ts";
import type { FileSystem, Path } from "effect";
import { Effect, Layer, Option } from "effect";
import type { ChildProcessSpawner } from "effect/process";
import { ChangeDetector } from "./ChangeDetector.ts";
import { ConfigDependencyHooks } from "./ConfigDependencyHooks.ts";
import type { LockfileReaderOptions } from "./LockfileReader.ts";
import { LockfileReader } from "./LockfileReader.ts";
import type { DetectedPackageManager } from "./PackageManagerName.ts";
import { PackageManagerDetector } from "./PackageManagerName.ts";
import type { WorkspaceCatalogsOptions } from "./WorkspaceCatalogs.ts";
import { WorkspaceCatalogs } from "./WorkspaceCatalogs.ts";
import type { WorkspaceDiscoveryOptions } from "./WorkspaceDiscovery.ts";
import { WorkspaceDiscovery } from "./WorkspaceDiscovery.ts";
import { WorkspaceRoot } from "./WorkspaceRoot.ts";
import type { WorkspaceSnapshotsOptions } from "./WorkspaceSnapshots.ts";
import { WorkspaceSnapshots } from "./WorkspaceSnapshots.ts";

/**
 * Options shared by the composite layers.
 *
 * @remarks
 * Derived from the option shapes of the services a composite builds —
 * {@link WorkspaceDiscoveryOptions}, {@link LockfileReaderOptions} and
 * {@link WorkspaceCatalogsOptions} — and handed to each of them unchanged, so a
 * root-resolving option one service grows cannot silently stop at the
 * composite. `cwd` and `stopAt` are re-declared here only to document them as
 * the one concern they are across the composite.
 *
 * @public
 */
export interface WorkspacesOptions extends WorkspaceDiscoveryOptions, LockfileReaderOptions, WorkspaceCatalogsOptions {
	/**
	 * The directory every root-consuming service resolves the workspace root
	 * from — one explicit concern, applied uniformly.
	 *
	 * @defaultValue `process.cwd()`, read lazily on first use.
	 */
	readonly cwd?: string;
	/**
	 * A ceiling for the root ascent from `cwd`, forwarded to EVERY
	 * root-resolving service the composite builds — {@link WorkspaceDiscovery},
	 * {@link LockfileReader}, {@link WorkspaceCatalogs} and, on the git
	 * composites, {@link WorkspaceSnapshots}.
	 *
	 * @remarks
	 * Inclusive and resolved to an absolute path, as {@link WorkspaceRoot}'s
	 * `find` does. Pass `stopAt: cwd` for a checkout nested inside someone
	 * else's workspace: every service then fails with
	 * {@link WorkspaceRootNotFoundError} consistently, instead of discovery
	 * refusing the enclosing workspace while the lockfile and catalog reads
	 * adopt it. A checkout that is itself a workspace root still resolves.
	 *
	 * @defaultValue no ceiling — the ascent runs to the filesystem root.
	 */
	readonly stopAt?: string | undefined;
}

/**
 * Options for the composites that additionally provide {@link WorkspaceSnapshots}
 * — {@link Workspaces.layerWithGit} and the two config-dependency variants.
 *
 * @remarks
 * {@link WorkspacesOptions} plus whatever {@link WorkspaceSnapshotsOptions}
 * adds, so `seedCatalogs` reaches `at(ref)` through the composite instead of
 * forcing a consumer to hand-compose the graph just to pass one option. The
 * two interfaces agree on `cwd`, which stays one explicit concern applied
 * uniformly.
 *
 * @public
 */
export interface WorkspacesGitOptions extends WorkspacesOptions, WorkspaceSnapshotsOptions {}

/**
 * Every service the git-free composite layer provides.
 *
 * @public
 */
export type WorkspacesServices =
	| WorkspaceRoot
	| PackageManagerDetector
	| WorkspaceDiscovery
	| LockfileReader
	| WorkspaceCatalogs;

// Shared composition helper for Workspaces.layer,
// Workspaces.layerWithConfigDependencies and
// Workspaces.layerWithConfigDependenciesSubprocess; the public contracts live
// on those statics. It takes the ConfigDependencyHooks layer EXPLICITLY —
// built once per composite and handed to WorkspaceCatalogs here and, by
// `withGit`, to WorkspaceSnapshots — so both services replay through ONE
// hooks reference (layer memoization is by reference) while the composite's
// OUTPUT never carries ConfigDependencyHooks: `WorkspacesServices` is
// unchanged. Generic in R so a hooks layer carrying an extra requirement (the
// subprocess variant's ChildProcessSpawner) threads it through to the
// composite's R.
const compose = <R = never>(
	options: WorkspacesOptions | undefined,
	hooks: Layer.Layer<ConfigDependencyHooks, never, R>,
): Layer.Layer<WorkspacesServices, never, FileSystem.FileSystem | Path.Path | R> => {
	const roots = WorkspaceRoot.layer;
	const detector = PackageManagerDetector.layer;
	const discovery = WorkspaceDiscovery.layer(options).pipe(Layer.provide(roots));
	const lockfiles = LockfileReader.layer(options).pipe(
		Layer.provide(roots),
		Layer.provide(detector),
		Layer.provide(discovery),
	);
	const catalogs = WorkspaceCatalogs.layerWithHooks(hooks, options).pipe(
		Layer.provide(roots),
		Layer.provide(lockfiles),
	);

	// PublishabilityDetector is deliberately ABSENT from this merge. Supplying a
	// default here made the npm-semantics choice invisible and, because
	// `Layer.mergeAll` is last-wins, made the natural spelling of an override —
	// `Layer.mergeAll(myDetector, Workspaces.layer())` — silently lose to it.
	// For the service that decides whether a package publishes and where, a
	// silent revert to "publishes to the public registry" is the worst failure
	// available. Note the composite does not REQUIRE a detector either — nothing
	// inside it consumes one, so `R` stays `FileSystem | Path`. The requirement
	// surfaces in the R of each operation that asks a publishability question
	// (`VersioningStrategy.detect`, e.g.), which is where unwired programs fail
	// to compile; a consumer that never asks never supplies a policy.
	return Layer.mergeAll(roots, detector, discovery, lockfiles, catalogs);
};

// Implementation of Workspaces.layer; the public contract lives on the static.
const layer = (
	options?: WorkspacesOptions,
): Layer.Layer<WorkspacesServices, never, FileSystem.FileSystem | Path.Path> =>
	compose(options, ConfigDependencyHooks.layerNoop);

/**
 * The core composite widened with the git tier: `Git`, `ChangeDetector` and
 * `WorkspaceSnapshots`. It builds the core over `hooks` ITSELF, so the SAME
 * hooks layer reaches `WorkspaceCatalogs` (through `compose`) and
 * `WorkspaceSnapshots` by construction — `at(ref)` replays a ref's config
 * dependencies exactly as the live assembler replays the worktree's: one
 * reference, one memo, one policy for both sides of a diff.
 */
const withGit = <R = never>(
	hooks: Layer.Layer<ConfigDependencyHooks, never, R>,
	options?: WorkspacesGitOptions,
): Layer.Layer<
	WorkspacesServices | ChangeDetector | WorkspaceSnapshots | Git,
	never,
	FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner | R
> => {
	const core = compose(options, hooks);
	const git = Git.layer;
	return Layer.mergeAll(
		core,
		git,
		ChangeDetector.layer.pipe(Layer.provide(git), Layer.provide(core)),
		WorkspaceSnapshots.layer(options).pipe(Layer.provide(git), Layer.provide(hooks), Layer.provide(core)),
	);
};

// Implementation of Workspaces.layerWithGit; the public contract lives on the static.
const layerWithGit = (
	options?: WorkspacesGitOptions,
): Layer.Layer<
	WorkspacesServices | ChangeDetector | WorkspaceSnapshots | Git,
	never,
	FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> => withGit(ConfigDependencyHooks.layerNoop, options);

// Implementation of Workspaces.resolvers; the public contract lives on the static.
const resolvers: Layer.Layer<CatalogResolver | WorkspaceResolver, never, WorkspaceCatalogs | WorkspaceDiscovery> =
	Layer.mergeAll(WorkspaceCatalogs.catalogResolver, WorkspaceDiscovery.workspaceResolver);

// Implementation of Workspaces.layerWithConfigDependencies; the public contract lives on the static.
const layerWithConfigDependencies = (
	options?: WorkspacesOptions,
): Layer.Layer<WorkspacesServices, never, FileSystem.FileSystem | Path.Path> =>
	compose(options, ConfigDependencyHooks.layerLive);

// Implementation of Workspaces.layerWithConfigDependenciesSubprocess; the public contract lives on the static.
const layerWithConfigDependenciesSubprocess = (
	options?: WorkspacesOptions,
): Layer.Layer<
	WorkspacesServices,
	never,
	FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> => compose(options, ConfigDependencyHooks.layerSubprocess);

// Implementation of Workspaces.layerWithGitAndConfigDependencies; the public
// contract lives on the static.
const layerWithGitAndConfigDependencies = (
	options?: WorkspacesGitOptions,
): Layer.Layer<
	WorkspacesServices | ChangeDetector | WorkspaceSnapshots | Git,
	never,
	FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> => withGit(ConfigDependencyHooks.layerLive, options);

// Implementation of Workspaces.layerWithGitAndConfigDependenciesSubprocess; the
// public contract lives on the static.
const layerWithGitAndConfigDependenciesSubprocess = (
	options?: WorkspacesGitOptions,
): Layer.Layer<
	WorkspacesServices | ChangeDetector | WorkspaceSnapshots | Git,
	never,
	FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> => withGit(ConfigDependencyHooks.layerSubprocess, options);

// Implementation of Workspaces.resolverLayer; the public contract lives on the static.
const resolverLayer = (
	options?: WorkspacesOptions,
): Layer.Layer<CatalogResolver | WorkspaceResolver, never, FileSystem.FileSystem | Path.Path> =>
	resolvers.pipe(Layer.provide(layerWithConfigDependencies(options)));

// Implementation of Workspaces.resolveManifest; the public contract lives on the static.
const resolveManifest: (
	manifest: Manifest,
	options?: WorkspacesOptions,
) => Effect.Effect<
	Manifest,
	CatalogAssemblyError | DependencyResolutionError | UnresolvedDependencyError,
	FileSystem.FileSystem | Path.Path
> = Effect.fn("Workspaces.resolveManifest")(function* (manifest: Manifest, options?: WorkspacesOptions) {
	return yield* manifest.resolve().pipe(Effect.provide(resolverLayer(options)));
});

// Implementation of Workspaces.localExecLayer; the public contract lives on the static.
const localExecLayer = (options?: {
	readonly cwd?: string;
	readonly stopAt?: string | undefined;
}): Layer.Layer<LocalExec, never, PackageManagerDetector | WorkspaceRoot> =>
	Layer.effect(
		LocalExec,
		Effect.gen(function* () {
			const roots = yield* WorkspaceRoot;
			const detector = yield* PackageManagerDetector;

			const context = Effect.gen(function* () {
				// `Effect.suspend` inside `find` is not enough — the ambient read has
				// to happen per call, not at layer construction, so a `process.chdir`
				// between provide and first use is honoured. The house `{ cwd }`
				// convention, applied here too.
				const cwd = options?.cwd ?? globalThis.process?.cwd?.() ?? "/";
				const stopAt = options?.stopAt;

				// A ceiling that finds no root is the ordinary None case, like any
				// other absent root: nothing project-local to run here.
				const root = yield* roots
					.find(cwd, stopAt === undefined ? undefined : { stopAt })
					.pipe(Effect.asSome, Effect.orElseSucceed(Option.none<string>));
				if (Option.isNone(root)) return Option.none<ExecContext>();

				const detected = yield* detector.detect(root.value).pipe(
					Effect.asSome,
					// A detection REFUSAL is not a mechanism failure: the detector
					// found no evidence and declined to guess, which is exactly "no
					// identifiable project-local launcher" — the None case. A
					// WorkspaceManifestError is different in kind and must escape.
					Effect.catchTag("PackageManagerDetectionError", () => Effect.succeed(Option.none<DetectedPackageManager>())),
					// Everything left is a broken manifest. Wrap it in the contract's
					// error, preserving the original structurally rather than
					// flattening it to a message.
					Effect.mapError((cause) => new LocalExecError({ directory: root.value, cause })),
				);
				if (Option.isNone(detected)) return Option.none<ExecContext>();

				const { prefix, dlxPrefix, scriptPrefix } = LocalExec.prefixes(detected.value.name);
				return Option.some(
					ExecContext.make({
						label: detected.value.name,
						prefix,
						dlxPrefix,
						scriptPrefix,
						directory: root.value,
					}),
				);
			});

			return { context };
		}),
	);

/**
 * The composite layers.
 *
 * @public
 */
export class Workspaces {
	private constructor() {}

	/**
	 * Every service that needs only a filesystem: root, package-manager
	 * detection, discovery, lockfile reading and catalogs.
	 *
	 * @remarks
	 * Requires core `FileSystem` and `Path`, which the consumer provides at the
	 * edge (`@effect/platform-node`, `@effect/platform-bun`, or a test's
	 * `@effected/memfs` volume).
	 *
	 * **`PublishabilityDetector` is neither provided nor required here.** The
	 * composite supplies no default policy, and — because nothing inside it asks
	 * a publishability question — it does not require one in `R` either. The
	 * requirement surfaces in the `R` of each operation that
	 * asks (`VersioningStrategy.detect`, e.g.), so a program that asks and never
	 * wires a detector fails to compile at that operation, and a program that
	 * never asks never supplies a publish policy. Wire one explicitly where
	 * needed: `Layer.mergeAll(Workspaces.layer(), PublishabilityDetector.layerNpm)`.
	 *
	 * **Bind the result to a `const`.** This is a parameterized factory and
	 * layers memoize by reference, so calling it twice builds everything twice.
	 *
	 * @example
	 * ```ts
	 * import { Workspaces } from "./index.ts";
	 * import { Layer } from "effect";
	 *
	 * const WorkspacesLayer = Workspaces.layer();
	 * const AppLayer = Layer.provide(WorkspacesLayer, PlatformLayer);
	 * ```
	 */
	static readonly layer = layer;

	/**
	 * The git-free composite, but with catalog assembly that **replays config
	 * dependency `pnpmfile.cjs` hooks** —
	 * {@link WorkspaceCatalogs.layerWithConfigDependencies} in place of the
	 * default no-op catalogs layer.
	 *
	 * @remarks
	 * Identical requirement set to {@link Workspaces.layer}; the only
	 * difference is that config-dependency code is executed in process. Opt in
	 * deliberately — the default {@link Workspaces.layer} never executes
	 * config-dependency code.
	 *
	 * **Bind the result to a `const`.**
	 */
	static readonly layerWithConfigDependencies = layerWithConfigDependencies;

	/**
	 * The git-free composite with config-dependency hook replay in a `node`
	 * **child process** —
	 * {@link WorkspaceCatalogs.layerWithConfigDependenciesSubprocess} in place of
	 * the in-process replay.
	 *
	 * @remarks
	 * Same typed semantics as {@link Workspaces.layerWithConfigDependencies}; the
	 * difference is mechanism, and it matters in exactly one environment class: a
	 * **bundled** consumer. The in-process replay's computed dynamic `import()`
	 * is compiled by bundlers (rspack among them) into a context module that
	 * throws `Cannot find module 'file:///…'` at runtime, which makes
	 * `WorkspaceCatalogs.releaseAgeGate()` unreachable from any bundled GitHub
	 * Action. Here the computed import runs inside a `node` child process whose
	 * program text is a static string handed over argv, so nothing computed
	 * enters the bundle graph.
	 *
	 * The extra requirement is core's `ChildProcessSpawner`, provided once at
	 * the edge (`@effect/platform-node`'s `NodeServices.layer`) — the same
	 * sanctioned R-widening as {@link Workspaces.layerWithGit}, and the reason
	 * this is a separate composite rather than a flag: a consumer that keeps the
	 * in-process replay should not have to be able to spawn a subprocess.
	 *
	 * **Bind the result to a `const`.**
	 */
	static readonly layerWithConfigDependenciesSubprocess = layerWithConfigDependenciesSubprocess;

	/**
	 * The git-free composite plus {@link ChangeDetector} and
	 * {@link WorkspaceSnapshots}, over `@effected/git`'s `Git` service.
	 *
	 * @remarks
	 * The extra requirement is core's `ChildProcessSpawner` (behind `Git`),
	 * which is why it is a separate layer rather than a flag: a consumer that
	 * never detects changes or reads at a ref should not have to be able to
	 * spawn a subprocess. The consumer provides `ChildProcessSpawner` once at
	 * the edge (`@effect/platform-node`'s `NodeServices.layer`); a test
	 * provides `Git.layerTest({ … })` — git's own shipped double, whose
	 * unstubbed members die named — and needs no repository on disk.
	 */
	static readonly layerWithGit = layerWithGit;

	/**
	 * {@link Workspaces.layerWithGit} over
	 * {@link Workspaces.layerWithConfigDependencies} — snapshots, change
	 * detection and git, with catalog assembly that **replays config dependency
	 * `pnpmfile.cjs` hooks**.
	 *
	 * @remarks
	 * `layerWithGit` wires the no-op catalogs layer, so this is the composite to
	 * reach for when you want snapshots, git and hook replay together without
	 * assembling the service graph by hand.
	 *
	 * Requirements are unchanged from {@link Workspaces.layerWithGit}: a
	 * filesystem, a path service, and core's `ChildProcessSpawner` (behind
	 * `Git`). The in-process replay adds no requirement of its own — it is a
	 * dynamic `import()`, not a subprocess. **If the consumer is bundled, reach
	 * for {@link Workspaces.layerWithGitAndConfigDependenciesSubprocess}
	 * instead**; the computed import does not survive a bundler, and the
	 * `ChildProcessSpawner` the subprocess variant needs is already required
	 * here for git, so on this composite the subprocess form costs nothing extra.
	 *
	 * Opt in deliberately: this executes config-dependency code in process, and
	 * {@link Workspaces.layerWithGit} never does.
	 *
	 * **Bind the result to a `const`.** A parameterized factory mints a fresh
	 * reference per call and layers memoize by reference.
	 *
	 * @example
	 * ```ts
	 * import { Workspaces } from "./index.ts";
	 *
	 * const KitLayer = Workspaces.layerWithGitAndConfigDependencies();
	 * ```
	 */
	static readonly layerWithGitAndConfigDependencies = layerWithGitAndConfigDependencies;

	/**
	 * {@link Workspaces.layerWithGitAndConfigDependencies}, with the hook replay
	 * in a `node` **child process** rather than in process.
	 *
	 * @remarks
	 * Same typed semantics; the difference is mechanism, and it decides whether
	 * catalog assembly works at all in a **bundled** consumer — see
	 * {@link Workspaces.layerWithConfigDependenciesSubprocess} for why the
	 * in-process computed `import()` dies under a bundler.
	 *
	 * **This composite's requirement set is identical to the in-process one.**
	 * The subprocess replay needs core's `ChildProcessSpawner`, which this
	 * composite already requires for `Git` — so unlike the git-free pair, there
	 * is no R-widening to weigh here and a bundled consumer pays nothing to be
	 * correct. Prefer this variant whenever the program ships as a bundle.
	 *
	 * **Bind the result to a `const`.**
	 *
	 * @example
	 * ```ts
	 * import { Workspaces } from "./index.ts";
	 *
	 * // A bundled CLI or MCP server: the computed import never enters the graph.
	 * const KitLayer = Workspaces.layerWithGitAndConfigDependenciesSubprocess();
	 * ```
	 */
	static readonly layerWithGitAndConfigDependenciesSubprocess = layerWithGitAndConfigDependenciesSubprocess;

	/**
	 * The git composite over a **caller-supplied** hooks layer — the same graph
	 * as {@link Workspaces.layerWithGit} and its two config-dependency
	 * variants, with the `ConfigDependencyHooks` policy chosen by the caller.
	 *
	 * @remarks
	 * The three fixed git composites are this function applied to
	 * {@link ConfigDependencyHooks.layerNoop}, {@link ConfigDependencyHooks.layerLive}
	 * and {@link ConfigDependencyHooks.layerSubprocess}. It exists for the fourth
	 * policy: {@link ConfigDependencyHooks.layerFrom}, the hermetic seam, which a
	 * snapshot-backed test otherwise cannot reach without rebuilding the whole
	 * git graph by hand. The ONE hooks reference is handed to both `WorkspaceCatalogs`
	 * and `WorkspaceSnapshots`, so `at(ref)` and `worktree()` cannot drift on
	 * which policy they replay. A hooks layer carrying its own requirement (the
	 * subprocess variant's `ChildProcessSpawner`) threads it through to the
	 * composite's `R` unchanged.
	 *
	 * **Bind the result to a `const`.**
	 *
	 * @param hooks - The `ConfigDependencyHooks` layer to wire on both sides.
	 * @param options - The composite options, as for {@link Workspaces.layerWithGit}.
	 *
	 * @example
	 * ```ts
	 * import { ConfigDependencyHooks, Workspaces } from "./index.ts";
	 *
	 * // A test pinning what at(ref) replays for two declared plugin versions.
	 * const KitLayer = Workspaces.layerWithGitAndHooks(
	 *   ConfigDependencyHooks.layerFrom({
	 *     "@scope/plugin@1.0.0": "/fixtures/plugin-1/pnpmfile.mjs",
	 *     "@scope/plugin@2.0.0": "/fixtures/plugin-2/pnpmfile.mjs",
	 *   }),
	 * );
	 * ```
	 */
	static readonly layerWithGitAndHooks = withGit;

	/**
	 * This package's implementation of `@effected/commands`' `LocalExec`
	 * contract: how to run a project-local binary here.
	 *
	 * @remarks
	 * **An inverted contract, like `@effected/npm`'s `CatalogResolver`.** Tool
	 * discovery needs package-manager detection and workspace-root resolution,
	 * both of which live here, but `@effected/commands` must not depend on this
	 * package. So `commands` declares the narrow `LocalExec` contract and this
	 * package ships the layer.
	 *
	 * **The argv knowledge is not duplicated.** `LocalExec.prefixes(name)` is
	 * the one home of the four managers' `exec`/`dlx`/script-runner prefixes;
	 * this layer
	 * detects *which* manager owns the directory and asks `commands` what that
	 * manager's argv looks like. Neither package reimplements the other's
	 * half.
	 *
	 * **`None` is success.** Outside any workspace — and inside one whose
	 * manager cannot be identified — the answer is `Option.none()`: "there is
	 * no project-local way to run tools here" is an ordinary fact, not an
	 * exceptional one, and a consumer running in a bare directory should not
	 * have to catch an error to learn it. The contract's typed
	 * `LocalExecError` is reserved for **mechanism** failure — a manifest that
	 * exists but cannot be read or parsed, which means something is broken
	 * rather than absent. That is npm's resolver convention, adopted
	 * verbatim.
	 *
	 * `directory` is the resolved **workspace root**, not the caller's cwd: a
	 * project-local launcher has to run where the workspace is. `stopAt` caps
	 * that ascent exactly as {@link WorkspacesOptions.stopAt} does, and a
	 * ceiling with no root at or below it is the same `Option.none()` as no
	 * root at all.
	 *
	 * A consumer with no monorepo never needs this layer, and therefore never
	 * installs this package — `LocalExec.layerNone` and `LocalExec.layerFor`
	 * are one-liners in `@effected/commands`.
	 *
	 * **Bind the result to a `const`** — a parameterized layer factory mints a
	 * fresh reference per call and layers memoize by reference.
	 *
	 * @example
	 * ```ts
	 * import { NodeServices } from "@effect/platform-node";
	 * import { ToolDiscovery } from "../commands/index.ts";
	 * import { Workspaces } from "./index.ts";
	 * import { Layer } from "effect";
	 *
	 * // Bound to consts per the warning above: each factory call mints a
	 * // fresh layer reference, and layers memoize by reference.
	 * const LocalExecLayer = Workspaces.localExecLayer();
	 * const WorkspacesLayer = Workspaces.layer();
	 *
	 * const AppLayer = ToolDiscovery.layer.pipe(
	 *   Layer.provide(LocalExecLayer),
	 *   Layer.provide(WorkspacesLayer),
	 *   Layer.provide(NodeServices.layer),
	 * );
	 * ```
	 */
	static readonly localExecLayer = localExecLayer;

	/**
	 * Resolve every `catalog:` and `workspace:` specifier in one `Manifest`
	 * against the real workspace, in one call — the 90% path. Decode stays at
	 * the consumer's edge: build the `Manifest` with `Manifest.decode` (from
	 * `@effected/npm`), hand it here, and get a new `Manifest` back with
	 * concrete ranges; `toRecord()` returns to the wire shape.
	 *
	 * @remarks
	 * Composes `manifest.resolve()` with a fresh {@link Workspaces.resolverLayer}
	 * per call, so the workspace root is re-discovered from `options.cwd` (or
	 * the current `process.cwd()`) on every invocation. Consumers processing
	 * many manifests should check `manifest.needsResolution` first and skip
	 * the call entirely when no dependency field carries a
	 * `catalog:`/`workspace:` specifier — that predicate is pure and avoids
	 * catalog assembly altogether.
	 *
	 * A specifier the workspace cannot answer fails typed as
	 * `UnresolvedDependencyError`; assembly and mechanism failures surface as
	 * `CatalogAssemblyError` / `DependencyResolutionError`.
	 *
	 * @example
	 * ```ts
	 * import { Manifest } from "../npm/index.ts";
	 * import { Workspaces } from "./index.ts";
	 * import { Effect } from "effect";
	 *
	 * const program = Effect.gen(function* () {
	 *   const manifest = yield* Manifest.decode({ dependencies: { effect: "catalog:" } });
	 *   const resolved = manifest.needsResolution ? yield* Workspaces.resolveManifest(manifest) : manifest;
	 *   return resolved.toRecord();
	 * });
	 * ```
	 */
	static readonly resolveManifest = resolveManifest;

	/**
	 * The one-call resolver factory: {@link Workspaces.resolvers} pre-wired
	 * over {@link Workspaces.layerWithConfigDependencies}, so the two
	 * `@effected/npm` contracts (`CatalogResolver`, `WorkspaceResolver`) need
	 * only a platform (`FileSystem` + `Path`) from the consumer.
	 *
	 * @remarks
	 * This is deliberately a **parameterized layer function, and the fresh
	 * layer per call is the feature**: layers memoize by reference, so each
	 * call mints an unmemoized layer whose root discovery re-runs — including
	 * a per-call `process.cwd()` read when `options.cwd` is omitted. A build
	 * tool that changes directory between manifests gets a correct
	 * re-discovery each time precisely because nothing is shared across
	 * calls. When you *want* sharing, bind one call's result to a `const` and
	 * provide that; the memoization rule is unchanged, this factory just
	 * refuses to hide it.
	 *
	 * Catalog assembly replays config-dependency `pnpmfile` hooks (the
	 * `layerWithConfigDependencies` path) — the semantics a real pnpm install
	 * has. Compose {@link Workspaces.resolvers} with {@link Workspaces.layer}
	 * yourself if config-dependency code must not run in process.
	 *
	 * @example
	 * ```ts
	 * import { Workspaces } from "./index.ts";
	 * import { Effect } from "effect";
	 *
	 * const program = doSomethingWithResolvers.pipe(
	 *   Effect.provide(Workspaces.resolverLayer()),
	 * );
	 * ```
	 */
	static readonly resolverLayer = resolverLayer;

	/**
	 * The two `@effected/npm` resolver contracts, implemented for real.
	 *
	 * @remarks
	 * Provide this alongside `@effected/package-json`'s `Package.resolve` and
	 * a manifest's `catalog:` and `workspace:` specifiers resolve against the
	 * actual workspace instead of the no-op layers' `Option.none()`.
	 *
	 * @example
	 * ```ts
	 * import { Package } from "../package-json/index.ts";
	 * import { Workspaces } from "./index.ts";
	 * import { Layer } from "effect";
	 *
	 * const WorkspacesLayer = Workspaces.layer();
	 * const Resolvers = Workspaces.resolvers.pipe(Layer.provide(WorkspacesLayer));
	 * ```
	 */
	static readonly resolvers = resolvers;
}
