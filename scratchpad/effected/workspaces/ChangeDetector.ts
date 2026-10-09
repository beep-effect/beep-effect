// Git-based change detection: changedFiles → changedPackages →
// affectedPackages, three depths of analysis on one service.
//
// It runs git through `@effected/git`'s `Git` service rather than a raw
// subprocess seam, so a test provides `Layer.succeed(Git, …)` and needs no
// repository on disk. `Git` requires core's `ChildProcessSpawner` in `R`, which
// the consumer's platform layer discharges at the edge.

import { $ScratchpadId } from "@beep/identity/packages";
import type { GitCommandError, NotARepositoryError, UnknownRefError } from "../git/index.ts";
import { Git } from "../git/index.ts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as A from "effect/Array";
import * as Str from "effect/String";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import { DependencyGraph } from "./DependencyGraph.ts";
import type { WorkspaceDiscoveryFailure } from "./WorkspaceDiscovery.ts";
import { WorkspaceDiscovery } from "./WorkspaceDiscovery.ts";
import type { WorkspacePackage } from "./WorkspacePackage.ts";

const $I = $ScratchpadId.create("effected/workspaces/ChangeDetector");

/**
 * Which git refs to compare, and whether to fold in the working tree.
 *
 * @example
 * ```ts
 * import { ChangeDetectionOptions } from "./index.ts";
 *
 * ChangeDetectionOptions.make({});                       // HEAD~1...HEAD
 * ChangeDetectionOptions.make({ base: "origin/main" });  // against a branch
 * ```
 *
 * @public
 */
export class ChangeDetectionOptions extends S.Class<ChangeDetectionOptions>($I`ChangeDetectionOptions`)({
	/**
	 * The ref to compare against.
	 *
	 * @defaultValue `"HEAD~1"`
	 */
	base: S.String.pipe(
		S.withDecodingDefaultKey(Effect.succeed("HEAD~1")),
		S.withConstructorDefault(Effect.succeed("HEAD~1")),
	).annotateKey({ description: "The ref to compare against." }),
	/**
	 * The ref to compare to.
	 *
	 * @defaultValue `"HEAD"`
	 */
	head: S.String.pipe(
		S.withDecodingDefaultKey(Effect.succeed("HEAD")),
		S.withConstructorDefault(Effect.succeed("HEAD")),
	).annotateKey({ description: "The ref to compare to." }),
	/**
	 * Whether to include staged, unstaged and untracked working-tree changes on
	 * top of the committed range.
	 *
	 * @defaultValue `false`
	 */
	includeUncommitted: S.Boolean.pipe(
		S.withDecodingDefaultKey(Effect.succeed(false)),
		S.withConstructorDefault(Effect.succeed(false)),
	).annotateKey({ description: "Whether to include staged, unstaged and untracked working-tree changes on top of the committed range." }),
}, $I.annote("ChangeDetectionOptions", { description: "Which git refs to compare, and whether to fold in the working tree." })) {}

/**
 * Raised when change detection cannot proceed for a reason that is not one of
 * git's own typed failures — the wrapper for "detection has no ground to stand
 * on".
 *
 * @remarks
 * A git command that merely *fails* surfaces as one of `@effected/git`'s typed
 * errors ({@link ChangeDetectionFailure} carries `GitCommandError`,
 * `NotARepositoryError` and `UnknownRefError`) rather than being flattened into
 * this wrapper — a caller branches on git's taxonomy directly.
 *
 * @public
 */
export class ChangeDetectionError extends S.TaggedError<ChangeDetectionError>($I`ChangeDetectionError`)("ChangeDetectionError", {
	/** The operation that could not run. */
	operation: S.String.annotateKey({ description: "The operation that could not run." }),
	/** The originating failure. */
	cause: S.Defect({ includeStack: true }).annotateKey({ description: "The originating failure." }),
}, $I.annote("ChangeDetectionError", { description: "Raised when change detection cannot proceed for a reason that is not one of git's own typed failures — the wrapper for \"detection has no ground to stand on\"." })) {
	/** Renders the failed operation into a one-line message. */
	override get message(): string {
		return `Change detection failed during ${this.operation}`;
	}
}

/**
 * Every failure the change-detection methods can surface.
 *
 * @remarks
 * `@effected/git`'s typed errors surface directly alongside
 * {@link ChangeDetectionError} and the discovery failures — a git command that
 * fails is reported as git classified it (`NotARepositoryError` for a
 * non-repository, `UnknownRefError` for a bad ref, `GitCommandError`
 * otherwise), not re-wrapped.
 *
 * @public
 */
export type ChangeDetectionFailure =
	| ChangeDetectionError
	| GitCommandError
	| NotARepositoryError
	| UnknownRefError
	| WorkspaceDiscoveryFailure;

/**
 * The {@link ChangeDetector} service shape.
 *
 * @public
 */
export interface ChangeDetectorShape {
	/** The file paths (workspace-root-relative, as git reports them) changed in the range. */
	readonly changedFiles: (
		options?: ChangeDetectionOptions,
	) => Effect.Effect<ReadonlyArray<string>, ChangeDetectionFailure>;
	/** The workspace packages owning those files. */
	readonly changedPackages: (
		options?: ChangeDetectionOptions,
	) => Effect.Effect<ReadonlyArray<WorkspacePackage>, ChangeDetectionFailure>;
	/** Those packages plus every workspace package that transitively depends on one. */
	readonly affectedPackages: (
		options?: ChangeDetectionOptions,
	) => Effect.Effect<ReadonlyArray<WorkspacePackage>, ChangeDetectionFailure>;
}

/**
 * Detects which workspace packages a git range touches.
 *
 * @remarks
 * Three depths on one service, cheapest first — raw file paths, the packages
 * owning them, and the transitive blast radius through the dependency graph.
 *
 * @example
 * ```ts
 * import { ChangeDetectionOptions, ChangeDetector } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const detector = yield* ChangeDetector;
 *   const affected = yield* detector.affectedPackages(
 *     ChangeDetectionOptions.make({ base: "origin/main" }),
 *   );
 *   return affected.map((pkg) => pkg.name);
 * });
 * ```
 *
 * @public
 */
export class ChangeDetector extends Context.Service<ChangeDetector, ChangeDetectorShape>()(
	$I`ChangeDetector`,
) {
	/** Builds the service over `Git` and {@link WorkspaceDiscovery}. */
	static readonly make: Effect.Effect<ChangeDetectorShape, never, Git | WorkspaceDiscovery> = Effect.gen(function* () {
		const git = yield* Git;
		const discovery = yield* WorkspaceDiscovery;

		/**
		 * The changed files of the range, plus the working tree when asked.
		 *
		 * Every query runs with `relative: true`, so `Git` reports paths relative
		 * to `cwd` — the workspace root — and excludes changes outside it. That is
		 * what makes a workspace nested inside a larger git repository correct:
		 * without it, `git diff` reports repository-top-level paths that resolve to
		 * nothing under the workspace root. `Git` owns the `--relative` mechanics;
		 * this detector only asks for the relative mode.
		 */
		const filesOf = Effect.fnUntraced(function* (
			root: string,
			options: ChangeDetectionOptions,
		): Effect.fn.Return<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError> {
			const committed = yield* git.changedFiles(root, {
				base: options.base,
				head: options.head,
				relative: true,
			});
			if (!options.includeUncommitted) return A.sort(A.fromIterable(committed), Str.Order);

			const working = yield* git.workingChanges(root, { relative: true });
			return A.sort(A.fromIterable(MutableHashSet.fromIterable([...committed, ...working])), Str.Order);
		});

		/**
		 * Every git query above reports paths relative to `cwd` — the workspace
		 * root — so the workspace root is the correct bridge to the absolute paths
		 * discovery indexes by. That holds whether or not the workspace root and
		 * the git root coincide, which is the point: a workspace nested inside a
		 * larger repository is legitimate.
		 */
		const rootOf = (): Effect.Effect<string, WorkspaceDiscoveryFailure> =>
			discovery.info.pipe(Effect.map((info) => info.root));

		const packagesOf = Effect.fnUntraced(function* (
			options: ChangeDetectionOptions,
		): Effect.fn.Return<ReadonlyArray<WorkspacePackage>, ChangeDetectionFailure> {
			const root = yield* rootOf();
			const files = yield* filesOf(root, options);
			const absolute = files.map((file) => (file.startsWith("/") ? file : `${root}/${file}`));
			return yield* discovery.resolveFiles(absolute);
		});

		return {
			changedFiles: Effect.fn("ChangeDetector.changedFiles")(function* (options?: ChangeDetectionOptions) {
				const root = yield* rootOf();
				const files = yield* filesOf(root, options ?? ChangeDetectionOptions.make({}));
				yield* Effect.logDebug("Changed files detected").pipe(
					Effect.annotateLogs("workspace.files.count", files.length),
				);
				return files;
			}),

			changedPackages: Effect.fn("ChangeDetector.changedPackages")(function* (options?: ChangeDetectionOptions) {
				const packages = yield* packagesOf(options ?? ChangeDetectionOptions.make({}));
				yield* Effect.logDebug("Changed packages detected").pipe(
					Effect.annotateLogs("workspace.packages.count", packages.length),
				);
				return packages;
			}),

			affectedPackages: Effect.fn("ChangeDetector.affectedPackages")(function* (options?: ChangeDetectionOptions) {
				const changed = yield* packagesOf(options ?? ChangeDetectionOptions.make({}));
				const all = yield* discovery.listPackages;
				const graph = DependencyGraph.make({ packages: all });
				const names = yield* graph.affectedBy(changed.map((pkg) => pkg.name));
				const byName = MutableHashMap.fromIterable(all.map((pkg) => [pkg.name, pkg] as const));
				const affected = names
					.map((name) => O.getOrUndefined(MutableHashMap.get(byName, name)))
					.filter((pkg): pkg is WorkspacePackage => pkg !== undefined);
				yield* Effect.logDebug("Affected packages detected").pipe(
					Effect.annotateLogs("workspace.packages.count", affected.length),
				);
				return affected;
			}),
		};
	});

	/** The live layer. */
	static readonly layer: Layer.Layer<ChangeDetector, never, Git | WorkspaceDiscovery> = Layer.effect(
		ChangeDetector,
		ChangeDetector.make,
	);
}
