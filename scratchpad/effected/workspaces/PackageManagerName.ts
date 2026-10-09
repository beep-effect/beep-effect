// Which package manager drives this workspace, and how we work that out.
//
// `PackageManagerName` is structurally identical to `@effected/lockfiles`'
// `LockfileFormat` and assigns freely to it — which is exactly what
// `LockfileReader` relies on. They are kept as separate names because they are
// separate concepts (which PM runs the repo vs. which lockfile grammar to
// parse), and because `@effected/package-json` already exports a
// `PackageManager` class for the corepack `pnpm@10.33.0` field.

import { PackageManager } from "../package-json/index.ts";
import { Context, Effect, FileSystem, Layer, Option, Path, Schema } from "effect";
import { WorkspaceManifestError } from "./WorkspacePackage.ts";

/**
 * The four package managers this package understands.
 *
 * @public
 */
export const PackageManagerName = Schema.Literals(["npm", "pnpm", "yarn", "bun"]);

/**
 * The decoded type of {@link (PackageManagerName:variable)}: `"npm" | "pnpm" | "yarn" | "bun"`.
 *
 * @public
 */
export type PackageManagerName = typeof PackageManagerName.Type;

/**
 * The markers {@link PackageManagerDetector} probes, in the priority order it
 * probes them.
 *
 * @remarks
 * One vocabulary serves both halves of the detection contract: the failure path
 * reports every member as `PackageManagerDetectionError.checked`, and the
 * success path reports the one that fired as
 * `DetectedPackageManager.evidence`. A closed literal union rather than
 * free text, so a consumer logging *why* a workspace was classified asserts
 * against the kit's vocabulary instead of re-deriving the probe with its own
 * filesystem reads.
 *
 * The `package.json#…` spellings name manifest *fields*; the rest are marker
 * files at the workspace root.
 *
 * @public
 */
export const PackageManagerEvidence = Schema.Literals([
	// The workspace tier: which manager runs this WORKSPACE.
	"pnpm-workspace.yaml",
	"bun.lock",
	"bun.lockb",
	"yarn.lock",
	"package.json#workspaces",
	// The standalone tier: which manager runs this single-package repo.
	"pnpm-lock.yaml",
	"package-lock.json",
	// The declaration tier: which manager is MEANT to run, before any install.
	// devEngines first: it is authoritative for the name (`declaredName`
	// believes it over the top-level field), so the union order IS the decision
	// precedence — the same rule that orders every other member.
	"package.json#devEngines.packageManager",
	"package.json#packageManager",
]);

/**
 * The decoded type of {@link (PackageManagerEvidence:variable)}: the marker
 * that decided a detection.
 *
 * @public
 */
export type PackageManagerEvidence = typeof PackageManagerEvidence.Type;

/**
 * The outcome of package-manager detection at a workspace root.
 *
 * @remarks
 * `version` is `Option.none()` unless a manifest field naming the *same* manager
 * that was detected also carries a version — a `packageManager: "yarn@4"` in a
 * pnpm workspace tells us nothing about pnpm's version, so it is not reported as
 * one. The two fields consulted are the corepack top-level `packageManager` and
 * `devEngines.packageManager`; see {@link PackageManagerDetector} for the
 * precedence between them.
 *
 * `evidence` is the rung of the priority order that decided the **name** — the
 * verdict's provenance, in the same vocabulary the failure path reports as
 * `PackageManagerDetectionError.checked`. For the bun and yarn rungs the
 * lockfile is the recorded signal even though the rung is a conjunction (the
 * lockfile *plus* a manifest field naming the manager): the manifest field alone
 * would have resolved in the declaration tier, so the lockfile is what this rung
 * added. The version's provenance is deliberately not carried — it follows the
 * two-field precedence above, which is a rule, not a probe.
 *
 * @public
 */
export class DetectedPackageManager extends Schema.Class<DetectedPackageManager>("DetectedPackageManager")({
	/** The detected manager. */
	name: PackageManagerName,
	/** Its version, when a manifest field agrees on the manager and carries one. */
	version: Schema.Option(Schema.String),
	/** The JavaScript runtime the manager implies. */
	runtime: Schema.Literals(["node", "bun"]),
	/** The rung of the priority order that decided the name. */
	evidence: PackageManagerEvidence,
}) {}

/**
 * A manager named by one of the two manifest fields: the name, plus the exact
 * version when the field carries one that parses.
 */
interface ManagerHint {
	readonly name: string;
	readonly version: Option.Option<string>;
}

/** Whether `value` is a non-null, non-array object — corepack's own shape test. */
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The exact version a `name` + `version` pair denotes, or none when the version
 * is not an exact version.
 *
 * Reuses the corepack `name@version+integrity` grammar rather than a second
 * parser, so a `devEngines` version carrying a hash (`11.11.0+sha512.…`)
 * normalizes to the same `11.11.0` the
 * top-level field reports — and a *range* (`^11`, `11.x`) yields none, because a
 * range is not a version and corepack will not run one either.
 */
const exactVersionOf = (name: string, version: string): Option.Option<string> =>
	Schema.decodeOption(PackageManager.FromString)(`${name}@${version}`).pipe(Option.map((pm) => pm.version));

/**
 * The `devEngines.packageManager` hint, or none.
 *
 * Every malformed shape corepack itself tolerates is tolerated here by *ignoring
 * the field*, never by failing detection: a non-object `devEngines`, a
 * non-object `packageManager`, an **array** of them (corepack does not support
 * arrays in this slot and falls back), a missing or non-string `name`, and a
 * `name` containing `@`. A version that is not an exact version is dropped on its
 * own, keeping the name — the name is still a valid disambiguator.
 */
const devEnginesHint = (manifest: Record<string, unknown>): Option.Option<ManagerHint> => {
	const devEngines = manifest.devEngines;
	if (!isPlainObject(devEngines)) return Option.none();

	const slot = devEngines.packageManager;
	if (!isPlainObject(slot)) return Option.none();

	const name = slot.name;
	if (typeof name !== "string" || name === "" || name.includes("@")) return Option.none();

	const version = slot.version;
	return Option.some({
		name,
		version: typeof version === "string" && version !== "" ? exactVersionOf(name, version) : Option.none<string>(),
	});
};

/** The corepack top-level `packageManager` hint, or none when absent or malformed. */
const corepackHint = (manifest: Record<string, unknown>): Option.Option<ManagerHint> => {
	const raw = manifest.packageManager;
	if (typeof raw !== "string") return Option.none();
	return Schema.decodeOption(PackageManager.FromString)(raw).pipe(
		Option.map((pm) => ({ name: pm.name, version: Option.some(pm.version) })),
	);
};

/**
 * Raised when a directory carries no lockfile and no workspace configuration,
 * so no package manager can be attributed to it.
 *
 * @public
 */
export class PackageManagerDetectionError extends Schema.TaggedError<PackageManagerDetectionError>()(
	"PackageManagerDetectionError",
	{
		/** The workspace root that was probed. */
		root: Schema.String,
		/** The marker files probed, in the order they were probed. */
		checked: Schema.Array(Schema.String),
	},
) {
	/** Renders the root and probed markers into a one-line message. */
	override get message(): string {
		return `No package manager detected at ${this.root} (checked ${this.checked.join(", ")})`;
	}
}

/**
 * The markers probed, in priority order. Derived from the evidence vocabulary so
 * the failure path's `checked` and the success path's `evidence` cannot drift.
 */
const CHECKED = PackageManagerEvidence.literals;

/**
 * Every failure {@link PackageManagerDetector} can surface: no manager could be
 * attributed to the root, or the root's `package.json` exists but cannot be read
 * or parsed.
 *
 * @public
 */
export type PackageManagerDetectionFailure = PackageManagerDetectionError | WorkspaceManifestError;

/**
 * The {@link PackageManagerDetector} service shape.
 *
 * @remarks
 * Exported so a consumer can type a bespoke double against the contract without
 * reaching into the class — the `WorkspaceDiscoveryShape` /
 * `PublishabilityDetectorShape` convention.
 *
 * @public
 */
export interface PackageManagerDetectorShape {
	/** Detect the package manager at a workspace root. */
	readonly detect: (root: string) => Effect.Effect<DetectedPackageManager, PackageManagerDetectionFailure>;
}

/**
 * Detects which package manager owns a workspace root.
 *
 * @remarks
 * **Lockfile evidence is the primary signal** — it is what says which manager
 * actually ran. Priority, first match wins: a `pnpm-workspace.yaml` means pnpm;
 * a bun lockfile *plus* a manifest field naming bun means bun; a `yarn.lock`
 * *plus* a manifest field naming yarn means yarn; a root `package.json` with a
 * `workspaces` field falls back to npm.
 *
 * The manifest conjunction is deliberate: a stray `yarn.lock` in an npm repo is
 * common, and only a declared manager name disambiguates it.
 *
 * **Two manifest fields declare a manager, and they are not interchangeable.**
 * Corepack reads both, and this is the rule that falls out of how it treats
 * them:
 *
 * - `devEngines.packageManager.name` is authoritative for the **name**.
 *   Corepack *errors* when a top-level `packageManager` disagrees with it (per
 *   `devEngines.packageManager.onFail`), so where both are present and disagree,
 *   `devEngines` is the one to believe. When `devEngines` names a manager, the
 *   top-level field's name is not consulted as a disambiguator at all.
 * - The top-level `packageManager` is authoritative for the exact **version**:
 *   it is the field that carries the integrity hash. Where both name the same
 *   manager, its version wins; where it is absent, `devEngines.packageManager.version`
 *   supplies the version instead.
 *
 * A version is reported **only when the field it came from names the manager
 * that was actually detected**. A `packageManager: "yarn@4"` in a pnpm workspace
 * says nothing about pnpm's version, so no version is reported — and the same
 * discipline applies to `devEngines`.
 *
 * Malformed manifest *hints* are ignored rather than fatal, matching corepack: a
 * non-object or array `devEngines.packageManager`, a `name` containing `@`, or a
 * version that is not an exact version cannot turn a detectable workspace into a
 * detection failure. A manifest that exists but cannot be **read or parsed** is a
 * different thing entirely and fails with a `WorkspaceManifestError` — a corrupt
 * root manifest is a real problem, not a missing hint.
 *
 * @public
 */
export class PackageManagerDetector extends Context.Service<PackageManagerDetector, PackageManagerDetectorShape>()(
	"@beep/scratchpad/effected/workspaces/PackageManagerName/PackageManagerDetector",
) {
	/** Builds the service over core `FileSystem` and `Path`. */
	static readonly make: Effect.Effect<
		{ readonly detect: (root: string) => Effect.Effect<DetectedPackageManager, PackageManagerDetectionFailure> },
		never,
		FileSystem.FileSystem | Path.Path
	> = Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;

		const has = (root: string, file: string): Effect.Effect<boolean> =>
			fs.exists(path.join(root, file)).pipe(Effect.orElseSucceed(() => false));

		/**
		 * The root manifest, read and parsed **once** per detection.
		 *
		 * An absent manifest is `Option.none()` — a bun or yarn repo with no root
		 * `package.json` is unusual but not an error. A manifest that is present but
		 * unreadable, unparseable, or not a JSON object fails typed: those are
		 * corrupt-manifest conditions, and swallowing them would report "no manager
		 * declared" for a repo whose manifest is simply broken.
		 */
		const manifestOf = (root: string): Effect.Effect<Option.Option<Record<string, unknown>>, WorkspaceManifestError> =>
			Effect.gen(function* () {
				const packageJsonPath = path.join(root, "package.json");
				const exists = yield* fs.exists(packageJsonPath).pipe(Effect.orElseSucceed(() => false));
				if (!exists) return Option.none<Record<string, unknown>>();

				const content = yield* fs
					.readFileString(packageJsonPath)
					.pipe(Effect.mapError((cause) => WorkspaceManifestError.make({ packageJsonPath, kind: "read", cause })));

				const parsed = yield* Effect.try({
					try: () => JSON.parse(content) as unknown,
					catch: (cause) => WorkspaceManifestError.make({ packageJsonPath, kind: "decode", cause }),
				});

				if (!isPlainObject(parsed)) {
					return yield* WorkspaceManifestError.make({
							packageJsonPath,
							kind: "decode",
							cause: new Error("package.json is not a JSON object"),
						});
				}
				return Option.some(parsed);
			});

		/**
		 * The manager name the manifest declares, if any.
		 *
		 * `devEngines` first — it is authoritative for the name, and corepack errors
		 * when the top-level field contradicts it.
		 */
		const declaredName = (hints: {
			readonly devEngines: Option.Option<ManagerHint>;
			readonly corepack: Option.Option<ManagerHint>;
		}): Option.Option<string> =>
			Option.map(
				Option.orElse(hints.devEngines, () => hints.corepack),
				(hint) => hint.name,
			);

		/** Whether the manifest declares `name` as its manager. */
		const namesManager = (
			hints: { readonly devEngines: Option.Option<ManagerHint>; readonly corepack: Option.Option<ManagerHint> },
			name: PackageManagerName,
		): boolean => Option.contains(declaredName(hints), name);

		/**
		 * The version to report for the manager that was detected — none unless a
		 * field naming *that* manager carries one.
		 *
		 * The top-level `packageManager` wins when it names the manager, because it
		 * is the field carrying the integrity hash; `devEngines` supplies the version
		 * when it does not.
		 */
		const versionFor = (
			hints: { readonly devEngines: Option.Option<ManagerHint>; readonly corepack: Option.Option<ManagerHint> },
			name: PackageManagerName,
		): Option.Option<string> => {
			if (!namesManager(hints, name)) return Option.none();
			const fromCorepack = Option.flatMap(hints.corepack, (hint) =>
				hint.name === name ? hint.version : Option.none<string>(),
			);
			return Option.orElse(fromCorepack, () =>
				Option.flatMap(hints.devEngines, (hint) => (hint.name === name ? hint.version : Option.none<string>())),
			);
		};

		const detect = Effect.fn("PackageManagerDetector.detect")(function* (root: string) {
			const manifest = yield* manifestOf(root);
			const hints = {
				devEngines: Option.flatMap(manifest, devEnginesHint),
				corepack: Option.flatMap(manifest, corepackHint),
			};

			if (yield* has(root, "pnpm-workspace.yaml")) {
				return DetectedPackageManager.make({
					name: "pnpm",
					version: versionFor(hints, "pnpm"),
					runtime: "node",
					evidence: "pnpm-workspace.yaml",
				});
			}

			// Which bun lockfile is present, probed in priority order — the marker
			// itself is the evidence a success reports, so the OR is not collapsed
			// into a bare boolean.
			const bunLock: Option.Option<"bun.lock" | "bun.lockb"> = (yield* has(root, "bun.lock"))
				? Option.some("bun.lock")
				: (yield* has(root, "bun.lockb"))
					? Option.some("bun.lockb")
					: Option.none();
			if (Option.isSome(bunLock) && namesManager(hints, "bun")) {
				return DetectedPackageManager.make({
					name: "bun",
					version: versionFor(hints, "bun"),
					runtime: "bun",
					evidence: bunLock.value,
				});
			}

			if ((yield* has(root, "yarn.lock")) && namesManager(hints, "yarn")) {
				return DetectedPackageManager.make({
					name: "yarn",
					version: versionFor(hints, "yarn"),
					runtime: "node",
					evidence: "yarn.lock",
				});
			}

			const workspaces = Option.map(manifest, (fields) => fields.workspaces);
			if (Option.isSome(workspaces) && workspaces.value !== undefined && workspaces.value !== null) {
				return DetectedPackageManager.make({
					name: "npm",
					version: versionFor(hints, "npm"),
					runtime: "node",
					evidence: "package.json#workspaces",
				});
			}

			// ── the standalone tier ────────────────────────────────────────────
			//
			// Every workspace marker has missed, so this is not a workspace. Most
			// repos are not: a single-package repo with a pnpm-lock.yaml and no
			// `workspaces` field must still be detectable.
			//
			// It runs after the workspace tier on purpose, so no input that
			// already resolved there can change its answer, and a stray package-lock.json
			// cannot turn a pnpm workspace into an npm repo.
			//
			// The conjunctions mirror the workspace tier exactly rather than
			// inventing a looser second rule inside one service: a pnpm or npm
			// lockfile is written by exactly one manager and stands alone, while a
			// yarn or bun lockfile still needs the manifest to name its manager,
			// because a stray yarn.lock is as common here as in a workspace.
			if (yield* has(root, "pnpm-lock.yaml")) {
				return DetectedPackageManager.make({
					name: "pnpm",
					version: versionFor(hints, "pnpm"),
					runtime: "node",
					evidence: "pnpm-lock.yaml",
				});
			}

			if (Option.isSome(bunLock) && namesManager(hints, "bun")) {
				return DetectedPackageManager.make({
					name: "bun",
					version: versionFor(hints, "bun"),
					runtime: "bun",
					evidence: bunLock.value,
				});
			}

			if ((yield* has(root, "yarn.lock")) && namesManager(hints, "yarn")) {
				return DetectedPackageManager.make({
					name: "yarn",
					version: versionFor(hints, "yarn"),
					runtime: "node",
					evidence: "yarn.lock",
				});
			}

			if (yield* has(root, "package-lock.json")) {
				return DetectedPackageManager.make({
					name: "npm",
					version: versionFor(hints, "npm"),
					runtime: "node",
					evidence: "package-lock.json",
				});
			}

			// ── the declaration tier ───────────────────────────────────────────
			//
			// No lockfile at all. A fresh clone before its first install has none to
			// read, but its manifest still says plainly which manager is meant to
			// run — weaker evidence than a lockfile, which is why it is consulted
			// last, but evidence nonetheless.
			const declared = declaredName(hints);
			if (Option.isSome(declared)) {
				const name = declared.value;
				if (name === "pnpm" || name === "npm" || name === "yarn" || name === "bun") {
					return DetectedPackageManager.make({
						name,
						version: versionFor(hints, name),
						runtime: name === "bun" ? "bun" : "node",
						// The field that supplied the name — `declaredName` believes
						// devEngines first, so the evidence mirrors that precedence.
						evidence: Option.isSome(hints.devEngines)
							? "package.json#devEngines.packageManager"
							: "package.json#packageManager",
					});
				}
			}

			// Nothing matched, and the package REFUSES TO GUESS: a default is policy,
			// not detection. A caller who wants one writes `Effect.orElseSucceed`
			// where a reader can see it.
			return yield* PackageManagerDetectionError.make({ root, checked: CHECKED });
		});

		return {
			detect: (root: string) =>
				detect(root).pipe(Effect.provideService(FileSystem.FileSystem, fs), Effect.provideService(Path.Path, path)),
		};
	});

	/** The live layer. */
	static readonly layer: Layer.Layer<PackageManagerDetector, never, FileSystem.FileSystem | Path.Path> = Layer.effect(
		PackageManagerDetector,
		PackageManagerDetector.make,
	);

	/**
	 * The sanctioned in-memory double.
	 *
	 * @remarks
	 * **`detect` has no honest default, so an unstubbed call dies** — the
	 * `WorkspaceDiscovery.info` posture, for the same reason. A stand-in that
	 * answered `"pnpm"` would hand a consumer a fact nothing established, and it
	 * would contradict the very service it stands in for: the live detector's
	 * defining property is that it refuses to guess when no evidence matches.
	 * A double that guesses is worse than no double.
	 *
	 * Failing typed would be the subtler mistake: `PackageManagerDetectionError`
	 * reads as a legitimate "no manager here" answer, so a consumer would branch
	 * on it and proceed, never learning that the test simply forgot to stub.
	 *
	 * The defect is also not absorbed by `Effect.catch` or any typed-error
	 * handler — deliberately, so code under test with a best-effort `catch`
	 * around detection cannot make the mandatory stub look optional; the
	 * unstubbed call still fails the test.
	 *
	 * @param overrides - Members to supply; anything omitted dies on use.
	 *
	 * @example
	 * ```ts
	 * import { DetectedPackageManager, PackageManagerDetector } from "./index.ts";
	 * import { Effect, Option } from "effect";
	 *
	 * const TestDetector = PackageManagerDetector.layerTest({
	 *   detect: () =>
	 *     Effect.succeed(
	 *       DetectedPackageManager.make({
	 *         name: "pnpm",
	 *         version: Option.none(),
	 *         runtime: "node",
	 *         evidence: "pnpm-workspace.yaml",
	 *       }),
	 *     ),
	 * });
	 * ```
	 */
	static readonly makeTest = (overrides: Partial<PackageManagerDetectorShape> = {}): PackageManagerDetectorShape => ({
		detect: () =>
			Effect.die(
				new Error(
					"PackageManagerDetector.makeTest: detect() was called but not stubbed — no honest default DetectedPackageManager exists for a test double; pass a `detect` override.",
				),
			),
		...overrides,
	});

	/**
	 * {@link PackageManagerDetector.makeTest} behind `Layer.succeed`.
	 *
	 * @remarks
	 * A parameterized layer factory mints a **fresh reference per call**, and
	 * layers memoize by reference — bind the result to a `const` and reuse it
	 * rather than calling `layerTest(...)` at each composition site.
	 *
	 * Pairs with `WorkspaceRoot.layerTest` and `WorkspaceDiscovery.layerTest` to
	 * stand up the whole discovery path with no filesystem at all.
	 */
	static readonly layerTest = (
		overrides: Partial<PackageManagerDetectorShape> = {},
	): Layer.Layer<PackageManagerDetector> =>
		Layer.succeed(PackageManagerDetector, PackageManagerDetector.makeTest(overrides));
}
