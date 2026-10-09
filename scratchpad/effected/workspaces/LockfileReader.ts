// The IO half of `@effected/lockfiles`.
//
// The seam is `content: string`: lockfiles is pure and parses text,
// workspaces finds the root, detects the manager, reads the file
// and — for pnpm — supplies the importer-path → name map that the pure
// `Lockfile.withImporterNames` second stage needs. That map is built here
// because building it requires reading every workspace `package.json`, which is
// IO, which is precisely what a pure package cannot do.

import { $ScratchpadId } from "@beep/identity/packages";
import type { Lockfile, LockfileFramingError, LockfileParseError, ResolvedPackage } from "../lockfiles/index.ts";
import { LockfileFormat, LockfileIntegrity, Lockfile as LockfileModel, filenameFor } from "../lockfiles/index.ts";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as P from "effect/Predicate";
import { findLayerRoot } from "./internal/layerRoot.ts";
import type { PackageManagerDetectionFailure } from "./PackageManagerName.ts";
import { PackageManagerDetector } from "./PackageManagerName.ts";
import type { WorkspaceDiscoveryFailure } from "./WorkspaceDiscovery.ts";
import { WorkspaceDiscovery } from "./WorkspaceDiscovery.ts";
import type { WorkspaceRootNotFoundError } from "./WorkspaceRoot.ts";
import { WorkspaceRoot } from "./WorkspaceRoot.ts";

const $I = $ScratchpadId.create("effected/workspaces/LockfileReader");

const JsonValue = S.fromJsonString(S.Unknown);

/**
 * Raised when the workspace's lockfile cannot be read off disk.
 *
 * **Details**
 *
 * Parse failures are `@effected/lockfiles`' `LockfileParseError`, not this —
 * this is strictly the IO half.
 *
 * **Example** (Describe an unreadable lockfile)
 *
 * ```ts
 * import { LockfileReadError } from "@beep/scratchpad/effected/workspaces/LockfileReader";
 *
 * const error = LockfileReadError.make({
 *   lockfilePath: "/repo/pnpm-lock.yaml", format: "pnpm", cause: new Error("Permission denied"),
 * });
 * console.log(error.message) // Cannot read pnpm lockfile at /repo/pnpm-lock.yaml
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class LockfileReadError extends S.TaggedError<LockfileReadError>($I`LockfileReadError`)("LockfileReadError", {
	/** Absolute path to the lockfile that could not be read. */
	lockfilePath: S.String.annotateKey({ description: "Absolute path to the lockfile that could not be read." }),
	// `LockfileFormat` is @effected/lockfiles' own schema, not a re-spelling of it.
	// Hand-rolling `Schema.Literals([...])` here duplicates the source of truth and
	// would silently disagree the day upstream adds a format.
	/** The format the detected package manager implies. */
	format: LockfileFormat.annotateKey({ description: "The format the detected package manager implies." }),
	/** The originating failure. */
	cause: S.Defect({ includeStack: true }).annotateKey({ description: "The originating failure." }),
}, $I.annote("LockfileReadError", { description: "Raised when the workspace's lockfile cannot be read off disk." })) {
	/**
	 * Renders the unreadable path into a one-line message.
	 *
	 * **Example** (Render the unreadable lockfile path)
	 *
	 * ```ts
	 * import { LockfileReadError } from "@beep/scratchpad/effected/workspaces/LockfileReader";
	 *
	 * const error = LockfileReadError.make({
	 *   lockfilePath: "/repo/pnpm-lock.yaml", format: "pnpm", cause: new Error("Permission denied"),
	 * });
	 * console.log(error.message) // Cannot read pnpm lockfile at /repo/pnpm-lock.yaml
	 * ```
	 *
	 * @category formatting
	 * @since 0.0.0
	 */
	override get message(): string {
		return `Cannot read ${this.format} lockfile at ${this.lockfilePath}`;
	}
}

/**
 * Every failure the lockfile methods can surface.
 *
 * **Details**
 *
 * Layer construction does no IO, so every member surfaces from the *methods*
 * rather than from `Layer.build`: the root cannot be found, no package manager
 * can be attributed to it (or its manifest is corrupt), its lockfile cannot be
 * read, the lockfile is malformed, or the lockfile's YAML stream carries no
 * lockfile document.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type LockfileReadFailure =
	| WorkspaceRootNotFoundError
	| PackageManagerDetectionFailure
	| LockfileReadError
	| LockfileParseError
	| LockfileFramingError;

/**
 * Defines parsed reads, version lookup, integrity checks and refresh for {@link LockfileReader}.
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export interface LockfileReaderShape {
	/** The parsed lockfile, with pnpm importer paths already resolved to real names. */
	readonly read: Effect.Effect<Lockfile, LockfileReadFailure>;
	/**
  * The lockfile's record of a package, when it records one.
  *
  * **Gotchas**
  *
  * A name can resolve at **several versions** in one lockfile (two members
  * depending on different majors of the same package). This returns the
  * **first** entry in lockfile order and does not rank them. Callers
  * that must see every resolution should read `lockfile.packagesNamed(name)`
  * off `read()` directly.
  */
	readonly resolvedVersion: (packageName: string) => Effect.Effect<O.Option<ResolvedPackage>, LockfileReadFailure>;
	/**
	 * Whether the lockfile agrees with the workspace manifests on disk — the
	 * pure `LockfileIntegrity.compare`, fed the manifests this package reads.
	 */
	readonly integrity: Effect.Effect<LockfileIntegrity, LockfileReadFailure | WorkspaceDiscoveryFailure>;
	/** Drop the memoized read so the next call re-reads the lockfile. */
	readonly refresh: Effect.Effect<void>;
}

/**
 * Options for the {@link LockfileReader} layer.
 *
 * **Example** (Decode bounded root-resolution options)
 *
 * ```ts
 * import { LockfileReaderOptions } from "@beep/scratchpad/effected/workspaces/LockfileReader";
 * import * as S from "effect/Schema";
 *
 * const options = S.decodeUnknownSync(LockfileReaderOptions)({ cwd: "/repo", stopAt: "/repo" });
 * console.log(options.stopAt) // /repo
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const LockfileReaderOptions = S.Struct({
	/**
	 * The directory the workspace root is resolved from.
	 *
	 * @defaultValue `process.cwd()`, read lazily on first use.
	 */
	cwd: S.optionalKey(S.String).annotateKey({ description: "The directory to resolve the workspace root from; defaults lazily to the current directory on first use." }),
	/**
  * A ceiling for the root ascent from `cwd`, passed straight through to the
  * `stopAt` of {@link WorkspaceRoot}'s `find`.
  *
  * **Details**
  *
  * Inclusive, and resolved to an absolute path exactly as `cwd` is. When no
  * root is found at or below the ceiling, `read` fails with
  * {@link WorkspaceRootNotFoundError} carrying the resolved `stopAt` rather
  * than adopting an enclosing directory's workspace. Pass the same value as
  * {@link WorkspaceDiscoveryOptions.stopAt} so every service agrees on the
  * root; the `Workspaces.*` composites forward one `stopAt` to all of them.
  *
  * @defaultValue no ceiling — the ascent runs to the filesystem root.
  */
	stopAt: S.optional(S.String).annotateKey({ description: "An inclusive ceiling for the workspace-root ascent; absent or undefined means no ceiling." }),
}).pipe($I.annoteSchema("LockfileReaderOptions", { description: "Root-resolution options for the lockfile reader, leaving current-directory resolution lazy." }));

/**
 * The root-resolution options accepted by the lockfile reader layer.
 * @category type-level
 * @since 0.0.0
 */
export type LockfileReaderOptions = typeof LockfileReaderOptions.Type;

class LockfileReaderTestDoubleError extends S.TaggedError<LockfileReaderTestDoubleError>($I`LockfileReaderTestDoubleError`)("LockfileReaderTestDoubleError", {
	message: S.String,
}, $I.annote("LockfileReaderTestDoubleError", { description: "An unstubbed lockfile reader test-double method." })) {}

/** A defect naming the unstubbed test-double method — a test-wiring mistake, not a typed failure. */
const unstubbed = (method: string): Effect.Effect<never> =>
	Effect.die(
		LockfileReaderTestDoubleError.make({ message: `LockfileReader.makeTest: ${method}() was called but not stubbed — pass a \`${method}\` override.` }),
	);

/**
 * Reads and parses the workspace's lockfile.
 *
 * **Details**
 *
 * Layer construction is O(1). The root walk, package-manager detection, file
 * read, parse and pnpm name resolution all happen on the first method call and
 * are memoized success-only for the lifetime of the layer.
 *
 * **Example** (Count packages in the workspace lockfile)
 *
 * ```ts
 * import { LockfileReader } from "@beep/scratchpad/effected/workspaces/LockfileReader";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const reader = yield* LockfileReader;
 *   const lockfile = yield* reader.read;
 *   return lockfile.packages.length;
 * });
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class LockfileReader extends Context.Service<LockfileReader, LockfileReaderShape>()(
	$I`LockfileReader`,
) {
	/**
	 * Builds the reader from workspace and filesystem services without reading the lockfile.
	 *
	 * **Example** (Construct a bounded lockfile reader)
	 *
	 * ```ts
	 * import { LockfileReader } from "@beep/scratchpad/effected/workspaces/LockfileReader";
	 * import * as Effect from "effect/Effect";
	 *
	 * const program = LockfileReader.make({ cwd: "/repo", stopAt: "/repo" });
	 * console.log(Effect.isEffect(program)) // true
	 * ```
	 *
	 * @category constructors
	 * @since 0.0.0
	 */
	static readonly make = Effect.fn("make")(function* (
		options?: LockfileReaderOptions,
	): Effect.fn.Return<
		LockfileReaderShape,
		never,
		WorkspaceRoot | PackageManagerDetector | WorkspaceDiscovery | FileSystem.FileSystem | Path.Path
	> {
		const roots = yield* WorkspaceRoot;
		const detector = yield* PackageManagerDetector;
		const discovery = yield* WorkspaceDiscovery;
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;

		const init: Effect.Effect<Lockfile, LockfileReadFailure> = Effect.gen(function* () {
			const root = yield* findLayerRoot(roots, options);
			const detected = yield* detector.detect(root);
			// `PackageManagerName` and `LockfileFormat` are the same four literals;
			// the assignment is what makes the two concepts interoperate for free.
			const format: LockfileFormat = detected.name;
			const lockfilePath = path.join(root, filenameFor(format));

			const content = yield* fs
				.readFileString(lockfilePath)
				.pipe(Effect.mapError((cause) => LockfileReadError.make({ lockfilePath, format, cause })));

			// `Lockfile.parse` owns YAML-stream framing: `pnpm-lock.yaml` is a
			// stream, and pnpm's writer always emits the config-dependencies document
			// as a PREFIX, so the real lockfile is deterministically the last one. A
			// stream carrying no lockfile document fails typed as a
			// `LockfileFramingError`.
			//
			// A preamble followed by an EMPTY main document is ambiguous: pnpm writes
			// those bytes for a config-dependency-only workspace with no root
			// `package.json`, and also when a first install fails after the config
			// dependencies went in. The pure parser cannot tell them apart, so this
			// reader — which can look — asserts `configOnly` only when the root has
			// no `package.json`. A failing `exists` probe (anything but NotFound,
			// which `exists` already answers `false`) is read as "present": the flag
			// is an assertion of absence, so it is made only on evidence of absence.
			// That fails closed without widening the error channel — at worst an
			// ambiguous stream fails `noLockfileDocument`, and an unambiguous one
			// parses as it would have anyway.
			const configOnly =
				format === "pnpm" &&
				!(yield* fs.exists(path.join(root, "package.json")).pipe(Effect.orElseSucceed(() => true)));
			const lockfile = yield* LockfileModel.parse(content, { format, configOnly });
			if (format !== "pnpm") return lockfile;

			// The pure second stage. pnpm names workspace packages by IMPORTER PATH;
			// only reading each `package.json` turns those into real names, and that
			// read is IO — which is exactly why the stage lives here and not in the
			// pure package.
			//
			// Bounded at concurrency 10, matching `WorkspaceDiscovery`'s per-package
			// read: a large workspace should not serialize one read per member.
			const importers = lockfile.packages.filter(
				(pkg): pkg is typeof pkg & { readonly relativePath: string } =>
					pkg.isWorkspace && pkg.relativePath !== undefined,
			);
			const resolved = yield* Effect.forEach(
				importers,
				(pkg) =>
					readName(path.join(root, pkg.relativePath, "package.json")).pipe(
						Effect.map((name) => [pkg.relativePath, name] as const),
					),
				{ concurrency: 10 },
			);
			const names = MutableHashMap.empty<string, string>();
			for (const [relativePath, name] of resolved) {
				if (O.isSome(name)) MutableHashMap.set(names, relativePath, name.value);
			}
			// String keys live in the documented native backing map, which keeps
			// the lockfile's ReadonlyMap boundary unchanged.
			return lockfile.withImporterNames(names.backing);
		});

		/** A workspace member's name, or none — an unreadable manifest is a miss, not a failure. */
		const readName = Effect.fnUntraced(function* (manifestPath: string): Effect.fn.Return<O.Option<string>> {
			const content = yield* fs.readFileString(manifestPath).pipe(Effect.orElseSucceed(() => ""));
			if (content === "") return O.none<string>();
			// `JSON.parse` returns `undefined` for nothing: a manifest of `null`
			// parses to `null`, and reading `.name` off it would throw a TypeError
			// as an unhandled DEFECT. Narrow to a plain object before touching it.
			const parsed = yield* S.decodeEffect(JsonValue)(content).pipe(Effect.orElseSucceed(() => undefined));
			if (!P.isObject(parsed)) return O.none<string>();
			const name = parsed.name;
			return P.isString(name) && name.length > 0 ? O.some(name) : O.none<string>();
		});

		const [resolveOnce, invalidate] = yield* Effect.cachedInvalidateWithTTL(init, Duration.infinity);
		const memo = Effect.onExit(resolveOnce, (exit) => (Exit.isSuccess(exit) ? Effect.void : invalidate));

		return {
			read: Effect.suspend(Effect.fn("LockfileReader.read")(function* () {
				return yield* memo;
			})),

			resolvedVersion: Effect.fn("LockfileReader.resolvedVersion")(function* (packageName: string) {
				const lockfile = yield* memo;
				const matches = lockfile.packagesNamed(packageName);
				return O.fromUndefinedOr(matches[0]);
			}),

			integrity: Effect.suspend(Effect.fn("LockfileReader.integrity")(function* () {
				const lockfile = yield* memo;
				const packages = yield* discovery.listPackages;
				return LockfileIntegrity.compare(
					lockfile,
					packages.map((pkg) => pkg.toWorkspaceManifest()),
				);
			})),

			refresh: Effect.suspend(() => invalidate),
		};
	});

	/**
	 * The live layer: reads the lockfile of the detected package manager at the
	 * workspace root.
	 *
	 * **Gotchas**
	 *
	 * Parameterized, so it mints a fresh reference per call — bind it to a
	 * `const` and reuse it.
	 *
	 * **Example** (Compose a reusable live lockfile layer)
	 *
	 * ```ts
	 * import { LockfileReader } from "@beep/scratchpad/effected/workspaces/LockfileReader";
	 * import * as Effect from "effect/Effect";
	 *
	 * const LiveLockfiles = LockfileReader.layer({ cwd: "/repo" });
	 * const program = Effect.gen(function* () {
	 *   const reader = yield* LockfileReader;
	 *   return yield* reader.read;
	 * }).pipe(Effect.provide(LiveLockfiles));
	 * console.log(Effect.isEffect(program)) // true
	 * ```
	 *
	 * @param options - Root resolution (`cwd`, `stopAt`).
	 * @category layers
	 * @since 0.0.0
	 */
	static readonly layer = (
		options?: LockfileReaderOptions,
	): Layer.Layer<
		LockfileReader,
		never,
		WorkspaceRoot | PackageManagerDetector | WorkspaceDiscovery | FileSystem.FileSystem | Path.Path
	> => Layer.effect(LockfileReader, LockfileReader.make(options));

	/**
	 * A test double satisfying the full {@link LockfileReaderShape} with no
	 * filesystem, root walk, or package-manager detection.
	 *
	 * **Gotchas**
	 *
	 * There is **no honest default lockfile**: an empty one that looks like a
	 * legitimate answer is indistinguishable from "this workspace resolves
	 * nothing" — the silent-empty failure class this package documents on the
	 * live paths — so `read` **dies** with an instructive defect until stubbed.
	 *
	 * The one derivation mirrors `WorkspaceDiscovery.makeTest`'s
	 * derived-from-the-primary rule: when a `read` override is supplied,
	 * `resolvedVersion` answers as the live service does — the **first** entry
	 * of `lockfile.packagesNamed(name)` in lockfile order, `Option.none()` on a
	 * miss — so the two stay consistent by construction. `integrity` is **not**
	 * derivable: the live method compares the lockfile against the workspace
	 * manifests discovery enumerates, and the double has no discovery to ask, so
	 * it dies unless stubbed.
	 *
	 * `refresh` defaults to `Effect.void` honestly: the live contract is "drop
	 * the memoized read so the next call re-reads", and this double memoizes
	 * nothing — every `read()` call re-invokes the override — so there is
	 * nothing to drop and the no-op is truthful, the same reasoning as
	 * `WorkspaceDiscovery.makeTest`'s `refresh`.
	 *
	 * **Example** (Stub a lockfile read with consistent version lookup)
	 *
	 * ```ts
	 * import { LockfileReader } from "@beep/scratchpad/effected/workspaces/LockfileReader";
	 * import * as Effect from "effect/Effect";
	 * import * as O from "effect/Option";
	 * import { Lockfile } from "@beep/scratchpad/effected/lockfiles/Lockfile";
	 * const lockfile = Lockfile.make({
	 *   format: "pnpm", lockfileVersion: "9.0", packages: [], workspaceDependencies: [],
	 * });
	 *
	 * const double = LockfileReader.makeTest({ read: Effect.succeed(lockfile) });
	 * // `resolvedVersion` now answers consistently from that lockfile.
	 * console.log(O.isNone(Effect.runSync(double.resolvedVersion("effect")))) // true
	 * ```
	 *
	 * @category testing
	 * @since 0.0.0
	 */
	static readonly makeTest = (overrides: Partial<LockfileReaderShape> = {}): LockfileReaderShape => {
		const read = overrides.read;
		return {
			read: Effect.suspend(() => unstubbed("read")),
			resolvedVersion:
				read !== undefined
					? (packageName: string) =>
							Effect.map(read, (lockfile) => O.fromUndefinedOr(lockfile.packagesNamed(packageName)[0]))
					: () => unstubbed("resolvedVersion"),
			integrity: Effect.suspend(() => unstubbed("integrity")),
			refresh: Effect.suspend(() => Effect.void),
			...overrides,
		};
	};

	/**
	 * The test layer: {@link LockfileReader.makeTest} behind `Layer.succeed`, so
	 * a suite provides only the methods it exercises.
	 *
	 * **Gotchas**
	 *
	 * A parameterized layer factory mints a **fresh reference per call**, and
	 * layers memoize by reference — bind the result to a `const` and reuse it
	 * rather than calling `layerTest(...)` at each composition site.
	 *
	 * **Example** (Create a reusable unstubbed lockfile test layer)
	 *
	 * ```ts
	 * import { LockfileReader } from "@beep/scratchpad/effected/workspaces/LockfileReader";
	 * import * as Effect from "effect/Effect";
	 *
	 * const TestLockfiles = LockfileReader.layerTest();
	 * // Providing this layer dies loudly if an unstubbed read is touched.
	 * const program = Effect.gen(function* () {
	 *   const reader = yield* LockfileReader;
	 *   return yield* reader.refresh;
	 * }).pipe(Effect.provide(TestLockfiles));
	 * console.log(Effect.runSync(program)) // undefined
	 * ```
	 *
	 * @category layers
	 * @since 0.0.0
	 */
	static readonly layerTest = (overrides: Partial<LockfileReaderShape> = {}): Layer.Layer<LockfileReader> =>
		Layer.succeed(LockfileReader, LockfileReader.makeTest(overrides));
}
