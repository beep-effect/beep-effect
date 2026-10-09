// Workspace-root discovery, expressed over `@effected/walker`.
//
// The markers, in priority order: a `pnpm-workspace.yaml`, then a
// `package.json` carrying a `workspaces` field. Walker's per-probe error
// absorption is load-bearing — one unreadable ancestor must not hide a valid
// root above it.

import { $ScratchpadId } from "@beep/identity/packages";
import { Walker } from "../walker/index.ts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Result from "effect/Result";

const $I = $ScratchpadId.create("effected/workspaces/WorkspaceRoot");

const JsonValue = S.fromJsonString(S.Unknown);

/**
 * The marker filenames {@link WorkspaceRoot} probes for, in priority order.
 *
 * @public
 */
export const WORKSPACE_MARKERS: ReadonlyArray<string> = ["pnpm-workspace.yaml", "package.json"];

/** How the not-found message names the `package.json` marker: only one with a `workspaces` field counts. */
const PACKAGE_JSON_MARKER_PROSE = 'package.json with a "workspaces" field';

/**
 * Options for {@link WorkspaceRoot}'s `find`.
 *
 * @remarks
 * Both bounds are passed straight through to `@effected/walker`'s
 * `Walker.ascend`; this package does not re-decide either.
 *
 * @public
 */
export interface FindWorkspaceRootOptions {
	/**
	 * A ceiling directory. The ascent stops after probing it, so an unmarked
	 * `stopAt` fails typed as {@link WorkspaceRootNotFoundError} rather than
	 * silently escaping into an enclosing repository.
	 *
	 * @remarks
	 * Resolved to an absolute path before comparison, exactly as `cwd` is — a
	 * relative or non-normalized ceiling that never string-matched an ancestor
	 * would reintroduce the unbounded ascent it was passed to prevent.
	 */
	readonly stopAt?: string;
	/**
	 * Hard cap on the number of directories probed.
	 *
	 * @remarks
	 * A non-integer or non-positive value is a **defect**, not a typed failure —
	 * it is developer wiring, and walker's guard raises it.
	 *
	 * @defaultValue 256
	 */
	readonly maxDepth?: number;
}

/**
 * Raised when no workspace root can be found by ascending from a directory.
 *
 * @remarks
 * `markers` records what was probed, so the failure names the contract rather
 * than paraphrasing it in prose.
 *
 * @public
 */
export class WorkspaceRootNotFoundError extends S.TaggedError<WorkspaceRootNotFoundError>($I`WorkspaceRootNotFoundError`)(
	"WorkspaceRootNotFoundError",
	{
		/** The directory the ascent started from. */
		searchPath: S.String.annotateKey({ description: "The directory the ascent started from." }),
		/** The marker filenames probed at each ancestor. */
		markers: S.Array(S.String).annotateKey({ description: "The marker filenames probed at each ancestor." }),
		/**
		 * The resolved ceiling the ascent was bounded by, when one was supplied.
		 *
		 * @remarks
		 * Absent means the ascent ran to the filesystem root. Its presence is what
		 * lets a caller tell "there is no workspace root anywhere above me" from
		 * "there is none below the ceiling I set" — two failures that otherwise
		 * render identically.
		 */
		stopAt: S.optionalKey(S.String).annotateKey({ description: "The resolved ceiling the ascent was bounded by, when one was supplied." }),
	}, $I.annote("WorkspaceRootNotFoundError", { description: "Raised when no workspace root can be found by ascending from a directory." }),
) {
	/** Renders the search path, probed markers and any ceiling into a one-line message. */
	override get message(): string {
		const bound = this.stopAt === undefined ? "" : ` up to ${this.stopAt}`;
		// Worded here, not in `markers`: a bare `package.json` would claim the
		// probe looked for a file a single-package repo plainly has, when only one
		// carrying a `workspaces` field counts. `markers` keeps the raw filenames.
		const looked = this.markers.map((marker) => (marker === "package.json" ? PACKAGE_JSON_MARKER_PROSE : marker));
		return `No workspace root above ${this.searchPath}${bound} (looked for ${looked.join(", ")})`;
	}
}

/**
 * Whether `dir` is a workspace root: it holds a `pnpm-workspace.yaml`, or a
 * `package.json` with a `workspaces` field.
 *
 * A malformed root `package.json` is "not a root", not an error — the ascent
 * continues past it, matching walker's absorption contract.
 */
const isWorkspaceRoot = (dir: string): Effect.Effect<boolean, never, FileSystem.FileSystem | Path.Path> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;

		const pnpmWorkspace = yield* fs
			.exists(path.join(dir, "pnpm-workspace.yaml"))
			.pipe(Effect.orElseSucceed(() => false));
		if (pnpmWorkspace) return true;

		const packageJson = path.join(dir, "package.json");
		const hasManifest = yield* fs.exists(packageJson).pipe(Effect.orElseSucceed(() => false));
		if (!hasManifest) return false;

		const content = yield* fs.readFileString(packageJson).pipe(Effect.orElseSucceed(() => "{}"));
		// JSON.parse throws; inside a `never`-channelled effect that would be a
		// defect, so it is wrapped at the point it can throw rather than trusted
		// to a catch further out.
		const parsed = yield* Effect.try({
			try: (): unknown => Result.getOrThrow(S.decodeResult(JsonValue)(content)),
			catch: () => undefined,
		}).pipe(Effect.orElseSucceed(() => ({})));

		// A JSON null previously failed on property access; retain that defect.
		if (parsed === null) throw new TypeError("Cannot read properties of null (reading 'workspaces')");
		return typeof parsed === "object" && "workspaces" in parsed &&
			parsed.workspaces !== undefined && parsed.workspaces !== null;
	});

/**
 * The {@link WorkspaceRoot} service contract.
 *
 * @remarks
 * Named so a consumer can type its own double — or a `Layer.succeed` — against
 * the contract rather than re-deriving it, exactly as `WorkspaceDiscoveryShape`
 * does. Prefer {@link WorkspaceRoot.layerTest} to hand-rolling one.
 *
 * @public
 */
export interface WorkspaceRootShape {
	/**
	 * The nearest workspace root at or above `cwd`.
	 *
	 * @param cwd - The directory to start the ascent from; resolved to an
	 *   absolute path first.
	 * @param options - Optional ascent bounds. Unbounded by default, which
	 *   walks to the filesystem root and can therefore resolve to an enclosing
	 *   repository's root; pass `stopAt` when the caller knows the ceiling.
	 */
	readonly find: (cwd: string, options?: FindWorkspaceRootOptions) => Effect.Effect<string, WorkspaceRootNotFoundError>;
}

/** Whether `descendant` is `ancestor` itself or lies beneath it, on POSIX or win32 separators. */
const isAtOrBelow = (descendant: string, ancestor: string): boolean => {
	if (descendant === ancestor) return true;
	const prefix = ancestor.endsWith("/") || ancestor.endsWith("\\") ? ancestor : `${ancestor}/`;
	return descendant.startsWith(prefix) || descendant.startsWith(prefix.replace(/\/$/, "\\"));
};

/**
 * Locates the workspace root by ascending from a starting directory.
 *
 * @example
 * ```ts
 * import { WorkspaceRoot } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const root = yield* WorkspaceRoot;
 *   return yield* root.find("/repo/packages/utils/src");
 * });
 * ```
 *
 * @example
 * Bounded: an unmarked fixture directory fails typed instead of escaping into
 * the enclosing repository.
 *
 * ```ts
 * import { WorkspaceRoot } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const roots = yield* WorkspaceRoot;
 *   return yield* roots.find("/tmp/fixture/packages/a", { stopAt: "/tmp/fixture" });
 * });
 * ```
 *
 * @public
 */
export class WorkspaceRoot extends Context.Service<WorkspaceRoot, WorkspaceRootShape>()(
	$I`WorkspaceRoot`,
) {
	/** Builds the service over core `FileSystem` and `Path`. */
	static readonly make: Effect.Effect<WorkspaceRootShape, never, FileSystem.FileSystem | Path.Path> = Effect.gen(
		function* () {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;

			const find = Effect.fn("WorkspaceRoot.find")(function* (cwd: string, options?: FindWorkspaceRootOptions) {
				const start = path.resolve(cwd);
				// Resolved, not passed through raw: walker compares the ceiling to each
				// ancestor by string equality, so an unresolved `stopAt` would never
				// match and would silently degrade to the unbounded ascent this option
				// exists to prevent.
				const ceiling = options?.stopAt === undefined ? undefined : path.resolve(options.stopAt);
				const chain = yield* Walker.ascend(start, {
					// Conditional spreads, not explicit `undefined`: walker reads these
					// with `?? default`, and an explicit `undefined` is fine there, but
					// the house rule keeps optional keys absent when unset.
					...O.getSomesStruct({ stopAt: O.fromUndefinedOr(ceiling) }),
					...(options?.maxDepth === undefined ? {} : { maxDepth: options.maxDepth }),
				});
				const found = yield* Walker.findRoot(chain, isWorkspaceRoot);
				if (O.isNone(found)) {
					return yield* WorkspaceRootNotFoundError.make({
							searchPath: start,
							markers: WORKSPACE_MARKERS,
							...O.getSomesStruct({ stopAt: O.fromUndefinedOr(ceiling) }),
						});
				}
				yield* Effect.logDebug("Workspace root found").pipe(Effect.annotateLogs("workspace.root", found.value));
				return found.value;
			});

			return {
				find: (cwd: string, options?: FindWorkspaceRootOptions) =>
					find(cwd, options).pipe(
						Effect.provideService(FileSystem.FileSystem, fs),
						Effect.provideService(Path.Path, path),
					),
			};
		},
	);

	/** The live layer. */
	static readonly layer: Layer.Layer<WorkspaceRoot, never, FileSystem.FileSystem | Path.Path> = Layer.effect(
		WorkspaceRoot,
		WorkspaceRoot.make,
	);

	/**
	 * A test double resolving every `find` to `root`, with no filesystem.
	 *
	 * @remarks
	 * Stands in for a hand-written `Layer.succeed` over a `find` that ignores its
	 * arguments. Unlike that, this double **honours `stopAt`**: a `find` that
	 * ignores the ceiling makes a bounded call pass under test and fail against
	 * the live service, which is the failure mode the option exists to catch. A `root` above the ceiling fails
	 * here exactly as it would live, with the same
	 * {@link WorkspaceRootNotFoundError}.
	 *
	 * The ceiling is `path.resolve`d through the injected `Path` service before
	 * the comparison, exactly as the live `make` path does — so a `stopAt`
	 * carrying `..` segments bounds the double identically to the live service,
	 * not by raw string. This is why `makeTest` yields an `Effect` requiring
	 * `Path`: it captures the service once at construction, the same shape as
	 * `make`. Consumers reach for {@link WorkspaceRoot.layerTest}, which provides
	 * `Path.layer` internally, so the requirement never surfaces at their call
	 * site.
	 *
	 * `maxDepth` is deliberately NOT modelled: the double does not walk, so it has
	 * no depth to cap, and pretending otherwise would encode a fiction. A suite
	 * exercising the depth guard wants the live service over a fixture tree.
	 *
	 * @param root - The root every unbounded `find` resolves to.
	 */
	static readonly makeTest = (root: string): Effect.Effect<WorkspaceRootShape, never, Path.Path> =>
		Effect.gen(function* () {
			const path = yield* Path.Path;
			return {
				find: (cwd: string, options?: FindWorkspaceRootOptions) =>
					// Resolve the ceiling through the injected `Path` exactly as the live
					// `make` path does before the raw string comparison in `isAtOrBelow` —
					// an unresolved ceiling (`..` segments) would match differently here
					// than live, the divergence this double exists to prevent.
					options?.stopAt !== undefined && !isAtOrBelow(root, path.resolve(options.stopAt))
						? Effect.fail(
								WorkspaceRootNotFoundError.make({
									searchPath: cwd,
									markers: WORKSPACE_MARKERS,
									stopAt: options.stopAt,
								}),
							)
						: Effect.succeed(root),
			};
		});

	/**
	 * The test layer: {@link WorkspaceRoot.makeTest} with `Path.layer` provided.
	 *
	 * @remarks
	 * `makeTest` requires `Path` to normalize the `stopAt` ceiling; this layer
	 * supplies core's `Path.layer` internally, so the requirement never reaches a
	 * consumer — the published type stays `Layer.Layer<WorkspaceRoot>`.
	 *
	 * A parameterized layer factory mints a **fresh reference per call**, and
	 * layers memoize by reference — bind the result to a `const` and reuse it
	 * rather than calling `layerTest(...)` at each composition site.
	 *
	 * Pair it with `WorkspaceDiscovery.layerTest` to stand up the whole discovery
	 * path without a filesystem; between them there is nothing left for a
	 * module-level mock of `@effected/workspaces` to do, and a provided layer
	 * keeps the service graph — and its typed errors — intact.
	 *
	 * @example
	 * ```ts
	 * import { WorkspaceDiscovery, WorkspaceRoot } from "./index.ts";
	 * import * as Effect from "effect/Effect";
	 *
	 * const TestRoot = WorkspaceRoot.layerTest("/repo");
	 * const TestDiscovery = WorkspaceDiscovery.layerTest({
	 *   listPackages: Effect.succeed([]),
	 * });
	 * // program.pipe(Effect.provide(TestRoot), Effect.provide(TestDiscovery))
	 * ```
	 */
	static readonly layerTest = (root: string): Layer.Layer<WorkspaceRoot> =>
		Layer.effect(WorkspaceRoot, WorkspaceRoot.makeTest(root)).pipe(Layer.provide(Path.layer));
}
