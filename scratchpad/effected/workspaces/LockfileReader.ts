// The IO half of `@effected/lockfiles`.
//
// The seam is `content: string`: lockfiles is pure and parses text,
// workspaces finds the root, detects the manager, reads the file
// and — for pnpm — supplies the importer-path → name map that the pure
// `Lockfile.withImporterNames` second stage needs. That map is built here
// because building it requires reading every workspace `package.json`, which is
// IO, which is precisely what a pure package cannot do.

import type { Lockfile, LockfileFramingError, LockfileParseError, ResolvedPackage } from "../lockfiles/index.ts";
import { LockfileFormat, LockfileIntegrity, Lockfile as LockfileModel, filenameFor } from "../lockfiles/index.ts";
import { Context, Duration, Effect, Exit, FileSystem, Layer, Option, Path, Schema } from "effect";
import { findLayerRoot } from "./internal/layerRoot.ts";
import type { PackageManagerDetectionFailure } from "./PackageManagerName.ts";
import { PackageManagerDetector } from "./PackageManagerName.ts";
import type { WorkspaceDiscoveryFailure } from "./WorkspaceDiscovery.ts";
import { WorkspaceDiscovery } from "./WorkspaceDiscovery.ts";
import type { WorkspaceRootNotFoundError } from "./WorkspaceRoot.ts";
import { WorkspaceRoot } from "./WorkspaceRoot.ts";

const JsonValue = Schema.fromJsonString(Schema.Unknown);

/**
 * Raised when the workspace's lockfile cannot be read off disk.
 *
 * @remarks
 * Parse failures are `@effected/lockfiles`' `LockfileParseError`, not this —
 * this is strictly the IO half.
 *
 * @public
 */
export class LockfileReadError extends Schema.TaggedError<LockfileReadError>()("LockfileReadError", {
	/** Absolute path to the lockfile that could not be read. */
	lockfilePath: Schema.String,
	// `LockfileFormat` is @effected/lockfiles' own schema, not a re-spelling of it.
	// Hand-rolling `Schema.Literals([...])` here duplicates the source of truth and
	// would silently disagree the day upstream adds a format.
	/** The format the detected package manager implies. */
	format: LockfileFormat,
	/** The originating failure. */
	cause: Schema.Defect(),
}) {
	/** Renders the unreadable path into a one-line message. */
	override get message(): string {
		return `Cannot read ${this.format} lockfile at ${this.lockfilePath}`;
	}
}

/**
 * Every failure the lockfile methods can surface.
 *
 * @remarks
 * Layer construction does no IO, so every member surfaces from the *methods*
 * rather than from `Layer.build`: the root cannot be found, no package manager
 * can be attributed to it (or its manifest is corrupt), its lockfile cannot be
 * read, the lockfile is malformed, or the lockfile's YAML stream carries no
 * lockfile document.
 *
 * @public
 */
export type LockfileReadFailure =
	| WorkspaceRootNotFoundError
	| PackageManagerDetectionFailure
	| LockfileReadError
	| LockfileParseError
	| LockfileFramingError;

/**
 * The {@link LockfileReader} service shape.
 *
 * @public
 */
export interface LockfileReaderShape {
	/** The parsed lockfile, with pnpm importer paths already resolved to real names. */
	readonly read: Effect.Effect<Lockfile, LockfileReadFailure>;
	/**
	 * The lockfile's record of a package, when it records one.
	 *
	 * @remarks
	 * A name can resolve at **several versions** in one lockfile (two members
	 * depending on different majors of the same package). This returns the
	 * **first** entry in lockfile order and does not rank them. Callers
	 * that must see every resolution should read `lockfile.packagesNamed(name)`
	 * off `read()` directly.
	 */
	readonly resolvedVersion: (packageName: string) => Effect.Effect<Option.Option<ResolvedPackage>, LockfileReadFailure>;
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
 * @public
 */
export interface LockfileReaderOptions {
	/**
	 * The directory the workspace root is resolved from.
	 *
	 * @defaultValue `process.cwd()`, read lazily on first use.
	 */
	readonly cwd?: string;
	/**
	 * A ceiling for the root ascent from `cwd`, passed straight through to the
	 * `stopAt` of {@link WorkspaceRoot}'s `find`.
	 *
	 * @remarks
	 * Inclusive, and resolved to an absolute path exactly as `cwd` is. When no
	 * root is found at or below the ceiling, `read` fails with
	 * {@link WorkspaceRootNotFoundError} carrying the resolved `stopAt` rather
	 * than adopting an enclosing directory's workspace. Pass the same value as
	 * {@link WorkspaceDiscoveryOptions.stopAt} so every service agrees on the
	 * root; the `Workspaces.*` composites forward one `stopAt` to all of them.
	 *
	 * @defaultValue no ceiling — the ascent runs to the filesystem root.
	 */
	readonly stopAt?: string | undefined;
}

/** A defect naming the unstubbed test-double method — a test-wiring mistake, not a typed failure. */
const unstubbed = (method: string): Effect.Effect<never> =>
	Effect.die(
		new Error(`LockfileReader.makeTest: ${method}() was called but not stubbed — pass a \`${method}\` override.`),
	);

/**
 * Reads and parses the workspace's lockfile.
 *
 * @remarks
 * Layer construction is O(1). The root walk, package-manager detection, file
 * read, parse and pnpm name resolution all happen on the first method call and
 * are memoized success-only for the lifetime of the layer.
 *
 * @example
 * ```ts
 * import { LockfileReader } from "./index.ts";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const reader = yield* LockfileReader;
 *   const lockfile = yield* reader.read;
 *   return lockfile.packages.length;
 * });
 * ```
 *
 * @public
 */
export class LockfileReader extends Context.Service<LockfileReader, LockfileReaderShape>()(
	"@beep/scratchpad/effected/workspaces/LockfileReader",
) {
	/** Builds the service. */
	static readonly make = (
		options?: LockfileReaderOptions,
	): Effect.Effect<
		LockfileReaderShape,
		never,
		WorkspaceRoot | PackageManagerDetector | WorkspaceDiscovery | FileSystem.FileSystem | Path.Path
	> =>
		Effect.gen(function* () {
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
				const names = new Map<string, string>();
				for (const [relativePath, name] of resolved) {
					if (Option.isSome(name)) names.set(relativePath, name.value);
				}
				return lockfile.withImporterNames(names);
			});

			/** A workspace member's name, or none — an unreadable manifest is a miss, not a failure. */
			const readName = (manifestPath: string): Effect.Effect<Option.Option<string>> =>
				Effect.gen(function* () {
					const content = yield* fs.readFileString(manifestPath).pipe(Effect.orElseSucceed(() => ""));
					if (content === "") return Option.none<string>();
					// `JSON.parse` returns `undefined` for nothing: a manifest of `null`
					// parses to `null`, and reading `.name` off it would throw a TypeError
					// as an unhandled DEFECT. Narrow to a plain object before touching it.
					const parsed = yield* Schema.decodeEffect(JsonValue)(content).pipe(Effect.orElseSucceed(() => undefined));
					if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return Option.none<string>();
					const name = (parsed as Record<string, unknown>).name;
					return typeof name === "string" && name.length > 0 ? Option.some(name) : Option.none<string>();
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
					return Option.fromUndefinedOr(matches[0]);
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
	 * @remarks
	 * Parameterized, so it mints a fresh reference per call — bind it to a
	 * `const` and reuse it.
	 *
	 * @param options - Root resolution (`cwd`, `stopAt`).
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
	 * @remarks
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
	 * @example
	 * ```ts
	 * import { Lockfile } from "../lockfiles/index.ts";
	 * import { LockfileReader } from "./index.ts";
	 * import { Effect } from "effect";
	 *
	 * const double = LockfileReader.makeTest({
	 *   read:
	 *     Effect.succeed(
	 *       Lockfile.make({ format: "pnpm", lockfileVersion: "9.0", packages: [], workspaceDependencies: [] }),
	 *     ),
	 * });
	 * // `resolvedVersion` now answers consistently from that lockfile.
	 * ```
	 */
	static readonly makeTest = (overrides: Partial<LockfileReaderShape> = {}): LockfileReaderShape => {
		const read = overrides.read;
		return {
			read: Effect.suspend(() => unstubbed("read")),
			resolvedVersion:
				read !== undefined
					? (packageName: string) =>
							Effect.map(read, (lockfile) => Option.fromUndefinedOr(lockfile.packagesNamed(packageName)[0]))
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
	 * @remarks
	 * A parameterized layer factory mints a **fresh reference per call**, and
	 * layers memoize by reference — bind the result to a `const` and reuse it
	 * rather than calling `layerTest(...)` at each composition site.
	 *
	 * @example
	 * ```ts
	 * import { LockfileReader } from "./index.ts";
	 *
	 * const TestLockfiles = LockfileReader.layerTest();
	 * // program.pipe(Effect.provide(TestLockfiles)) — dies loudly if touched.
	 * ```
	 */
	static readonly layerTest = (overrides: Partial<LockfileReaderShape> = {}): Layer.Layer<LockfileReader> =>
		Layer.succeed(LockfileReader, LockfileReader.makeTest(overrides));
}
