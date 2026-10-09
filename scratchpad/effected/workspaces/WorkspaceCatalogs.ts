import { $ScratchpadId } from "@beep/identity/packages";
import { dual } from "effect/Function";
// pnpm catalogs: the `CatalogSet` value, the service that assembles it for a
// workspace, and the real implementation of `@effected/npm`'s `CatalogResolver`
// contract.
//
// Assembly precedence follows pnpm: lockfile-recorded catalogs first, then the
// inline `pnpm-workspace.yaml` catalogs, which win.

import type { Lockfile } from "../lockfiles/index.ts";
import { filenameFor } from "../lockfiles/index.ts";
import {
	CatalogAssemblyError,
	CatalogResolver,
	DependencyResolutionError,
	PartialReleaseAgeGate,
	ReleaseAgeGate,
} from "../npm/index.ts";
import { Yaml } from "../yaml/index.ts";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import type { ChildProcessSpawner } from "effect/process";
import type {
	ConfigDependencyHooksShape,
	HookInjection,
	HookReplay,
	HookReplayContext,
	PeerDependencyRules,
} from "./ConfigDependencyHooks.ts";
import { ConfigDependencyHooks, NoPeerDependencyRules } from "./ConfigDependencyHooks.ts";
import { inlineCatalogs, merge, normalize, rangeOf } from "./internal/catalogs.ts";
import { importerVersionsOf } from "./internal/importerVersions.ts";
import { findLayerRoot } from "./internal/layerRoot.ts";
import { configDependenciesOf, inlinePeerDependencyRules } from "./internal/workspaceYaml.ts";
import type { LockfileReadFailure } from "./LockfileReader.ts";
import { LockfileReader } from "./LockfileReader.ts";
import type { WorkspaceRootNotFoundError } from "./WorkspaceRoot.ts";
import { WorkspaceRoot } from "./WorkspaceRoot.ts";

const $I = $ScratchpadId.create("effected/workspaces/WorkspaceCatalogs");

const JsonValue = S.fromJsonString(S.Unknown);

/**
 * Each importer's dependency-name → resolved-version map, keyed by importer path
 * (`"."` for the root package — the same keys `WorkspaceDiscovery.importerMap`
 * uses, and the same value `PackageStateSnapshot.relativePath` carries).
 *
 * @remarks
 * What a manager's lockfile records as actually installed, as opposed to what a
 * manifest declares. It answers a `catalog:` specifier no committed catalog
 * source declares — the shape a pnpm config-dependency pnpmfile hook produces —
 * which would otherwise resolve to nothing on both sides of a diff and hide a
 * real version movement.
 *
 * Versions are normalized: pnpm's peer-disambiguation suffix
 * (`1.2.3(effect@4.0.0)`) is stripped, and `link:` / `file:` entries are omitted
 * because a filesystem edge is not a version. Only pnpm records importer
 * versions; bun and npm yield an empty index.
 *
 * @public
 */
export type ImporterVersions = Readonly<Record<string, Readonly<Record<string, string>>>>;

/**
 * An immutable, fully-normalized catalog collection — the one catalog
 * resolution semantic in the package.
 *
 * @remarks
 * `entries` is catalog name → dependency → range, with pnpm's unnamed
 * top-level `catalog:` block normalized under the key `"default"`. Lockfile
 * catalog entries, which pnpm records as `{ specifier, version }`, are
 * normalized to their `specifier` — the declared range, which is what a catalog
 * resolves to.
 *
 * @public
 */
export class CatalogSet extends S.Class<CatalogSet>($I`CatalogSet`)({
	/** Catalog name → dependency name → version range. */
	entries: S.Record(S.String, S.Record(S.String, S.String)).annotateKey({ description: "Catalog name → dependency name → version range." }),
}, $I.annote("CatalogSet", { description: "An immutable, fully-normalized catalog collection — the one catalog resolution semantic in the package." })) {
	/** The empty set — a workspace with no catalogs. */
	static empty(): CatalogSet {
		return CatalogSet.make({ entries: {} });
	}

	/** Wrap a pnpm `Catalogs` map, dropping unusable entries. */
	static fromCatalogs(catalogs: unknown): CatalogSet {
		return CatalogSet.make({ entries: normalize(catalogs) });
	}

	/**
	 * The `catalog:` and `catalogs:` blocks of a `pnpm-workspace.yaml` document.
	 *
	 * @param text - The raw YAML text.
	 */
	static readonly fromWorkspaceYaml = Effect.fn("CatalogSet.fromWorkspaceYaml")(function* (text: string) {
		const document = yield* Yaml.parse(text).pipe(
			Effect.mapError((cause) => CatalogAssemblyError.make({ source: "manifest", path: "pnpm-workspace.yaml", cause })),
		);
		return CatalogSet.fromCatalogs(inlineCatalogs(catalogBlocksOf(document)));
	});

	/**
	 * The `catalogs:` section of a pnpm lockfile, whose entries are either a bare
	 * range or a `{ specifier, version }` pair.
	 */
	static fromLockfileCatalogs(raw: unknown): CatalogSet {
		return CatalogSet.make({ entries: normalize(raw) });
	}

	/**
	 * The catalog set a parsed lockfile records, PM-aware.
	 *
	 * @remarks
	 * Both pnpm and bun record catalogs in the lockfile, in different shapes:
	 * pnpm under `extension.catalogs`, bun under `extension.catalog` /
	 * `extension.catalogs`. Assembly reads whichever the parsed lockfile carries
	 * rather than assuming the pnpm extension. A lockfile with no extension, or a
	 * pnpm one with no catalogs, yields the empty set.
	 *
	 * @param lockfile - A parsed lockfile from `@effected/lockfiles`.
	 */
	static fromLockfile(lockfile: Lockfile): CatalogSet {
		const ext = lockfile.extension;
		if (ext === undefined) return CatalogSet.empty();
		if (ext._tag === "pnpm") {
			return ext.catalogs !== undefined ? CatalogSet.fromLockfileCatalogs(ext.catalogs) : CatalogSet.empty();
		}
		return CatalogSet.fromBunBlocks({ catalog: ext.catalog, catalogs: ext.catalogs });
	}

	/**
	 * A catalog set from bun's `{ catalog, catalogs }` blocks — used for the
	 * `bun.lock` extension and for the root `package.json` `workspaces` block. The
	 * unnamed default catalog normalizes under `"default"`. Tolerant: unusable
	 * values are dropped, never fatal.
	 *
	 * @param blocks - The `catalog` (default) and `catalogs` (named) blocks.
	 */
	static fromBunBlocks(blocks: { readonly catalog?: unknown; readonly catalogs?: unknown }): CatalogSet {
		const raw: Record<string, unknown> = {};
		if (isObject(blocks.catalogs)) Object.assign(raw, blocks.catalogs);
		if (isObject(blocks.catalog)) {
			raw.default = { ...(isObject(raw.default) ? raw.default : {}), ...blocks.catalog };
		}
		return CatalogSet.fromCatalogs(raw);
	}

	/**
	 * The `catalog` / `catalogs` blocks of a root `package.json` `workspaces` field
	 * — bun's package.json analogue of pnpm's `pnpm-workspace.yaml` blocks.
	 *
	 * @remarks
	 * **Hard-fail by design**, preserving the semantics catalog output is
	 * load-bearing for: a present-but-malformed `workspaces` shape (a number, a
	 * string, an object with a malformed `packages` / `catalog` / `catalogs`), or
	 * the default catalog declared twice — once as `workspaces.catalog` and again
	 * as `workspaces.catalogs.default` — fails with `CatalogAssemblyError`
	 * naming what was wrong. An absent `workspaces` field, one explicitly `null`,
	 * or the plain array form (npm/yarn patterns, which carry no catalogs) yields
	 * the empty set. Presence is checked structurally, so an explicitly-declared
	 * empty `catalog: {}` still counts as a declaration.
	 *
	 * @param text - The raw root `package.json` text.
	 */
	static readonly fromManifestWorkspaces = Effect.fn("CatalogSet.fromManifestWorkspaces")(function* (text: string) {
		const manifest = yield* S.decodeEffect(JsonValue)(text).pipe(Effect.mapError((cause) => CatalogAssemblyError.make({ source: "manifest", path: "package.json", cause })));
		if (!isObject(manifest)) {
			return yield* CatalogAssemblyError.make({
					source: "manifest",
					path: "package.json",
					cause: new Error("package.json is not a JSON object"),
				});
		}
		const blocks = yield* manifestCatalogBlocks(manifest.workspaces);
		return CatalogSet.fromBunBlocks(blocks);
	});

	/** Merge sets. Later sets win per dependency within a catalog. */
	static merge(...sets: ReadonlyArray<CatalogSet>): CatalogSet {
		return CatalogSet.fromCatalogs(merge(...sets.map((set) => set.entries)));
	}

	/** Whether any catalog declares anything. */
	get isEmpty(): boolean {
		return Object.keys(this.entries).length === 0;
	}

	/**
	 * The range a `catalog:` specifier resolves to.
	 *
	 * @remarks
	 * Total: an unmatched dependency, an unknown catalog name, or a non-catalog
	 * specifier all yield `Option.none()`. A *malformed* catalog — one pnpm
	 * itself rejects — also yields `Option.none()` here; the fallible surface is
	 * {@link WorkspaceCatalogs}, which fails typed on assembly instead.
	 *
	 * @param dependency - The package name being resolved.
	 * @param specifier - The declared specifier, e.g. `catalog:` or `catalog:build`.
	 */
	resolveSpecifier(dependency: string, specifier: string): O.Option<string> {
		const resolved = rangeOf(this.entries, dependency, specifier);
		return typeof resolved === "string" ? O.some(resolved) : O.none();
	}

	/**
	 * The range `dependency` carries in a named catalog, or in the default
	 * catalog when `catalog` is `Option.none()`.
	 *
	 * @remarks
	 * The shape `@effected/npm`'s `CatalogResolver` contract asks for.
	 */
	rangeOf(dependency: string, catalog: O.Option<string>): O.Option<string> {
		const name = O.getOrElse(catalog, () => "default");
		return O.fromUndefinedOr(this.entries[name]?.[dependency]);
	}
}

/** Whether `value` is a non-null, non-array object. */
const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether every value in an object is a string — a usable `dependency → range` catalog. */
const isStringRecord = (value: unknown): value is Record<string, string> =>
	isObject(value) && Object.values(value).every((entry) => typeof entry === "string");

/** The `catalog` / `catalogs` blocks of a parsed pnpm-workspace document. */
const catalogBlocksOf = (
	document: unknown,
): {
	readonly catalog?: Record<string, string> | undefined;
	readonly catalogs?: Record<string, Record<string, string>> | undefined;
} => {
	if (document === null || typeof document !== "object") return {};
	const catalog = "catalog" in document ? document.catalog : undefined;
	const catalogs = "catalogs" in document ? document.catalogs : undefined;
	// Preserve pnpm's duplicate-default refusal before dropping unusable entries.
	if (catalog !== undefined && catalog !== null &&
		typeof catalogs === "object" && catalogs !== null && "default" in catalogs &&
		catalogs.default !== undefined && catalogs.default !== null) return {};
	return {
		catalogs: normalize({
			default: catalog,
			...(typeof catalogs === "object" && catalogs !== null ? catalogs : {}),
		}),
	};
};

/**
 * The inline release-age gate contribution of a parsed `pnpm-workspace.yaml`
 * document — pnpm's top-level `minimumReleaseAge` (minutes) and
 * `minimumReleaseAgeExclude` (name patterns) keys, mapped onto
 * `@effected/npm`'s `PartialReleaseAgeGate` field names
 * (`ageMinutes` / `exclude`).
 *
 * @remarks
 * **Hard-fail by design**, the same posture as the live catalog-block reader:
 * a present-but-malformed value (a non-numeric `minimumReleaseAge`, a
 * `minimumReleaseAgeExclude` that is not a string array) fails typed as a
 * `CatalogAssemblyError` rather than being silently dropped, because a
 * silently-ignored gate is the "install refuses a too-young version the
 * resolver already picked" bug this vocabulary exists to prevent. An absent or
 * explicitly `null` key contributes nothing; the permissive
 * `PartialReleaseAgeGate` accepts any finite `ageMinutes` (negatives and
 * fractions included) — `ReleaseAgeGate.combine` is the single clamping
 * authority, exactly as on the hook path.
 */
const inlineReleaseAge = (document: unknown): Effect.Effect<PartialReleaseAgeGate, CatalogAssemblyError> => {
	if (!isObject(document)) return Effect.succeed({});
	const raw: Record<string, unknown> = {};
	if (document.minimumReleaseAge !== undefined && document.minimumReleaseAge !== null) {
		raw.ageMinutes = document.minimumReleaseAge;
	}
	if (document.minimumReleaseAgeExclude !== undefined && document.minimumReleaseAgeExclude !== null) {
		raw.exclude = document.minimumReleaseAgeExclude;
	}
	if (Object.keys(raw).length === 0) return Effect.succeed({});
	return S.decodeEffect(PartialReleaseAgeGate)(raw).pipe(
		Effect.catchTag(
			"SchemaError",
			(cause) => CatalogAssemblyError.make({ source: "manifest", path: "pnpm-workspace.yaml", cause }),
		),
	);
};

/** A hard-fail catalog-assembly failure naming the malformed part of a `workspaces` field. */
const malformed = (source: "manifest" | "catalog", path: string, detail: string): CatalogAssemblyError =>
	CatalogAssemblyError.make({ source, path, cause: new Error(detail) });

/**
 * Validate a `catalog` (default) / `catalogs` (named) block pair, hard-failing on
 * a malformed shape or the default catalog declared twice.
 *
 * @remarks
 * Shared by the bun `package.json` `workspaces` reader
 * ({@link CatalogSet.fromManifestWorkspaces}) and the pnpm `pnpm-workspace.yaml`
 * reader, so both fail typed on exactly the same conditions rather than one
 * hard-failing and the other silently normalizing to `{}` — the "every dependency
 * looks newly added" bug. `labels` names the two blocks in the diagnostics so the
 * error reads in the caller's vocabulary (`workspaces.catalog` vs. `catalog`).
 */
const validatedCatalogBlocks = (
	catalog: unknown,
	catalogs: unknown,
	labels: { readonly catalog: string; readonly catalogs: string },
): Effect.Effect<
	{ readonly catalog?: Record<string, string>; readonly catalogs?: Record<string, Record<string, string>> },
	CatalogAssemblyError
> => {
	let validCatalog: Record<string, string> | undefined;
	if (catalog !== undefined && catalog !== null) {
		if (!isStringRecord(catalog)) {
			return Effect.fail(
				malformed("catalog", labels.catalog, `"${labels.catalog}" must map dependency names to version strings`),
			);
		}
		validCatalog = catalog;
	}

	let validCatalogs: Record<string, Record<string, string>> | undefined;
	if (catalogs !== undefined && catalogs !== null) {
		if (!isObject(catalogs)) {
			return Effect.fail(
				malformed("catalog", labels.catalogs, `"${labels.catalogs}" must map catalog names to catalogs`),
			);
		}
		const checked: Record<string, Record<string, string>> = {};
		for (const [name, entries] of Object.entries(catalogs)) {
			if (!isStringRecord(entries)) {
				return Effect.fail(
					malformed(
						"catalog",
						`${labels.catalogs}.${name}`,
						`"${labels.catalogs}.${name}" must map dependency names to version strings`,
					),
				);
			}
			Object.defineProperty(checked, name, { value: entries, enumerable: true, writable: true, configurable: true });
		}
		validCatalogs = checked;
	}

	// The default catalog declared twice — pnpm rejects the equivalent
	// duplication. Structural presence: an explicit `catalog: {}` still counts.
	if (validCatalog !== undefined && validCatalogs !== undefined && "default" in validCatalogs) {
		return Effect.fail(
			malformed(
				"catalog",
				"default",
				`The default catalog is declared twice: as "${labels.catalog}" and as "${labels.catalogs}.default"`,
			),
		);
	}

	return Effect.succeed({
		...(validCatalog !== undefined ? { catalog: validCatalog } : {}),
		...(validCatalogs !== undefined ? { catalogs: validCatalogs } : {}),
	});
};

/**
 * The `catalog` / `catalogs` blocks of a root `package.json` `workspaces` field,
 * hard-failing on a malformed shape or the default catalog declared twice.
 */
const manifestCatalogBlocks = (
	workspaces: unknown,
): Effect.Effect<
	{ readonly catalog?: Record<string, string>; readonly catalogs?: Record<string, Record<string, string>> },
	CatalogAssemblyError
> => {
	// Absent, explicitly null, or the npm/yarn array form: nothing to misread.
	if (workspaces === undefined || workspaces === null || Array.isArray(workspaces)) return Effect.succeed({});
	if (!isObject(workspaces)) {
		return Effect.fail(
			malformed("manifest", "package.json", `"workspaces" must be an array or object, got ${typeof workspaces}`),
		);
	}

	if (workspaces.packages !== undefined && workspaces.packages !== null) {
		const packages = workspaces.packages;
		if (!Array.isArray(packages) || !packages.every((entry) => typeof entry === "string")) {
			return Effect.fail(malformed("manifest", "package.json", `"workspaces.packages" must be an array of strings`));
		}
	}

	return validatedCatalogBlocks(workspaces.catalog, workspaces.catalogs, {
		catalog: "workspaces.catalog",
		catalogs: "workspaces.catalogs",
	});
};

/**
 * Validate the inline `catalog` / `catalogs` blocks of a parsed
 * `pnpm-workspace.yaml` document, hard-failing on the same malformed-shape and
 * duplicate-default conditions as the bun `package.json` path.
 *
 * @remarks
 * The live pnpm reader in {@link WorkspaceCatalogs.make} runs this BEFORE
 * normalizing with `inlineCatalogs`, so an invalid inline catalog fails typed
 * rather than normalizing to `{}` and reading as ABSENT. A non-object document,
 * or one with no catalog blocks, validates to `{}` — absent/empty still yields
 * empty. The return is discarded; normalization stays on the shared
 * `inlineCatalogs` path.
 */
const validatePnpmWorkspaceCatalogs = (document: unknown): Effect.Effect<void, CatalogAssemblyError> => {
	if (!isObject(document)) return Effect.void;
	return Effect.asVoid(
		validatedCatalogBlocks(document.catalog, document.catalogs, { catalog: "catalog", catalogs: "catalogs" }),
	);
};

/**
 * Every failure catalog assembly can surface.
 *
 * @public
 */
export type CatalogAssemblyFailure = CatalogAssemblyError | WorkspaceRootNotFoundError;

/** A defect naming the unstubbed test-double method — a test-wiring mistake, not a typed failure. */
const unstubbed = (method: string): Effect.Effect<never> =>
	Effect.die(
		new Error(`WorkspaceCatalogs.makeTest: ${method}() was called but not stubbed — pass a \`${method}\` override.`),
	);

/** The single assembly pass's outputs, memoized together. */
interface Assembled {
	readonly catalogs: CatalogSet;
	readonly releaseAgeGate: ReleaseAgeGate;
	readonly importerVersions: ImporterVersions;
	readonly peerDependencyRules: PeerDependencyRules;
	readonly hookReplays: Readonly<Record<string, HookReplay>>;
}

/**
 * Replay a parsed `pnpm-workspace.yaml` document's `configDependencies`
 * hooks over its inline catalogs, seeded by its inline `peerDependencyRules`
 * — the ONE call into `hooks.inject` that both the live assembler and the
 * at-ref reader (`WorkspaceSnapshots`) make, so the two sides of a diff
 * cannot disagree about what a document declares or how it is seeded.
 *
 * @remarks
 * Rules are SEEDED, not merged afterwards: the workspace file's block goes
 * into the threaded config so the hooks merge onto it, exactly as pnpm seeds
 * its own config and takes back what the hooks return. `context` is the
 * document's own side — its lockfile and, at a ref, the ref — so a fetched
 * config dependency is verified against the record of the side that declared
 * it. Not part of the public surface; `WorkspaceSnapshots` imports it
 * directly.
 */
export const injectFromDocument: {
	(root: string, document: unknown, inline: CatalogSet, context: HookReplayContext): (hooks: ConfigDependencyHooksShape) => Effect.Effect<{ readonly injected: CatalogSet; readonly injection: HookInjection }, CatalogAssemblyError>;
	(hooks: ConfigDependencyHooksShape, root: string, document: unknown, inline: CatalogSet, context: HookReplayContext): Effect.Effect<{ readonly injected: CatalogSet; readonly injection: HookInjection }, CatalogAssemblyError>;
} = dual(5, (
	hooks: ConfigDependencyHooksShape,
	root: string,
	document: unknown,
	inline: CatalogSet,
	context: HookReplayContext,
): Effect.Effect<{ readonly injected: CatalogSet; readonly injection: HookInjection }, CatalogAssemblyError> =>
	Effect.map(
		hooks.inject(root, configDependenciesOf(document), inline.entries, inlinePeerDependencyRules(document), context),
		(injection) => ({ injected: CatalogSet.fromCatalogs(injection.catalogs), injection }),
	));

/**
 * The {@link WorkspaceCatalogs} service shape.
 *
 * @public
 */
export interface WorkspaceCatalogsShape {
	/** The assembled catalog set for the workspace. Memoized after the first call. */
	readonly set: Effect.Effect<CatalogSet, CatalogAssemblyFailure>;
	/** Resolve one `catalog:` specifier; `Option.none()` when it names nothing. */
	readonly resolveSpecifier: (
		dependency: string,
		specifier: string,
	) => Effect.Effect<O.Option<string>, CatalogAssemblyFailure>;
	/**
	 * The effective pnpm release-age gate for the workspace, combined
	 * strictest-wins from the inline `pnpm-workspace.yaml` keys
	 * (`minimumReleaseAge` / `minimumReleaseAgeExclude`) and the replayed
	 * config-dependency hooks. Assembled from the same single read and hook
	 * replay as `set`, and memoized with it.
	 *
	 * @remarks
	 * Under the default layer (no-op hooks) only inline values contribute; under
	 * {@link WorkspaceCatalogs.layerWithConfigDependencies} the replayed hooks
	 * contribute too. A workspace with no pnpm-workspace.yaml (a bun/npm
	 * workspace) has no release-age keys, so the gate is the inert zero gate.
	 */
	readonly releaseAgeGate: Effect.Effect<ReleaseAgeGate, CatalogAssemblyFailure>;
	/**
	 * The workspace's **effective** `peerDependencyRules` — pnpm's post-hoc
	 * suppression policy, which the lockfile does not record at all.
	 *
	 * @remarks
	 * Assembled from the same single read and hook replay as `set`, and memoized
	 * with it. The `pnpm-workspace.yaml` block (what `pnpm:export` materializes)
	 * is **seeded** into the replayed config and the config-dependency hooks
	 * merge onto it, so one object carries both sources — the kit never merges
	 * them itself, because that would be a second implementation of a rule the
	 * hook seam already enforces.
	 *
	 * A consumer needs these to avoid **reporting** what pnpm suppresses: pnpm
	 * computes the same peer violations and then hides the ones a rule allows,
	 * so a checker without them reports findings pnpm calls clean. `PeerCheck`
	 * applies all three axes.
	 */
	readonly peerDependencyRules: Effect.Effect<PeerDependencyRules, CatalogAssemblyFailure>;
	/**
	 * Each importer's dependency-name → resolved-version map, as the manager's
	 * lockfile records it. Read from the same single lockfile read as `set`, and
	 * memoized with it.
	 *
	 * @remarks
	 * Feeds `WorkspaceStateSnapshot`'s fallback for a `catalog:` specifier no
	 * committed catalog source declares — the shape a config-dependency pnpmfile
	 * hook produces. Only pnpm records importer versions; a bun or npm workspace
	 * yields an empty index, and an absent or unreadable lockfile contributes
	 * nothing rather than failing.
	 */
	readonly importerVersions: Effect.Effect<ImporterVersions, CatalogAssemblyFailure>;
	/**
	 * Which version each declared config dependency was replayed from, keyed
	 * by name — off the same single memoized assemble pass as `set()`.
	 *
	 * @remarks
	 * Every dependency the hooks layer resolved when a `pnpm-workspace.yaml`
	 * was read — `{}` when it declares no config dependencies or under the
	 * no-op layer, which resolves nothing. Config dependencies are a pnpm
	 * feature, so the bun / `package.json` path yields `{}` too, exactly as
	 * `importerVersions` does.
	 */
	readonly hookReplays: Effect.Effect<Readonly<Record<string, HookReplay>>, CatalogAssemblyFailure>;
	/**
	 * Discard the memoized assembly so the **next** read re-assembles — the same
	 * single read and hook replay as the first, over the workspace as it stands
	 * then.
	 *
	 * @remarks
	 * The explicit memoization boundary for a tool that **mutates the workspace
	 * mid-run** — installs, bumps a config dependency, regenerates the lockfile.
	 * Release-age gating wants the before-state, a post-install peer check the
	 * after-state, and one infinite memo cannot serve both without this call in
	 * between; without it, `peerDependencyRules` keeps answering from the
	 * pre-mutation hook replay and the checker reports findings the new rules
	 * suppress.
	 *
	 * Unconditional and infallible: the memo is already success-only (a failed
	 * or interrupted assembly retries by itself), so `refresh` exists solely to
	 * discard a *successful* assembly that mutation has made stale. Calling it
	 * before any read is harmless.
	 */
	readonly refresh: Effect.Effect<void>;
}

/**
 * Options for the {@link WorkspaceCatalogs} layer.
 *
 * @public
 */
export interface WorkspaceCatalogsOptions {
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
	 * root is found at or below the ceiling, catalog assembly fails with
	 * {@link WorkspaceRootNotFoundError} carrying the resolved `stopAt` rather
	 * than adopting an enclosing directory's workspace. Pass the same value as
	 * {@link WorkspaceDiscoveryOptions.stopAt} so every service agrees on the
	 * root; the `Workspaces.*` composites forward one `stopAt` to all of them.
	 *
	 * @defaultValue no ceiling — the ascent runs to the filesystem root.
	 */
	readonly stopAt?: string | undefined;
}

/**
 * Assembles a workspace's catalogs, package-manager-aware.
 *
 * @remarks
 * The inline source is picked by **file presence**, the same rule
 * `internal/patterns.ts` uses for globs: a `pnpm-workspace.yaml` selects the pnpm
 * path (its `catalog:` / `catalogs:` blocks); its absence selects the root
 * `package.json` `workspaces.catalog` / `workspaces.catalogs` (bun's analogue).
 * The lockfile source is PM-aware too — whichever extension the parsed lockfile
 * carries (pnpm or bun) contributes its recorded catalogs.
 *
 * Precedence, lowest first: catalogs recorded in the lockfile, then the inline
 * declaration, then — only under {@link WorkspaceCatalogs.layerWithConfigDependencies}
 * — the config-dependency `pnpmfile.cjs` hooks, each layer winning per dependency
 * within a catalog. An unreadable or absent lockfile degrades to no lockfile
 * catalogs rather than failing (the inline declaration is the source of truth, the
 * lockfile a record of what was installed); a malformed inline source **fails
 * typed** with `CatalogAssemblyError`, because a silently-empty catalog read
 * is the "every dependency looks newly added" bug.
 *
 * Assembly is deferred to the first call and memoized success-only, matching
 * {@link WorkspaceDiscovery}.
 *
 * @public
 */
export class WorkspaceCatalogs extends Context.Service<WorkspaceCatalogs, WorkspaceCatalogsShape>()(
	$I`WorkspaceCatalogs`,
) {
	/** Builds the service. */
	static readonly make = (
		options?: WorkspaceCatalogsOptions,
	): Effect.Effect<
		WorkspaceCatalogsShape,
		never,
		WorkspaceRoot | LockfileReader | ConfigDependencyHooks | FileSystem.FileSystem | Path.Path
	> =>
		Effect.gen(function* () {
			const roots = yield* WorkspaceRoot;
			const lockfiles = yield* LockfileReader;
			const hooks = yield* ConfigDependencyHooks;
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;

			// A file-presence probe that distinguishes genuine absence from a probe
			// FAILURE. `fs.exists` already normalizes a NotFound PlatformError to
			// `false`, so any error that escapes it (a permission or IO failure) is a
			// genuine probe failure — surfacing it typed rather than collapsing it to
			// "absent" is what keeps a locked-down `pnpm-workspace.yaml` from silently
			// selecting the package.json reader (a silently-empty catalog is the "every
			// dependency looks newly added" bug). The explicit NotFound arm is
			// belt-and-suspenders for a backend whose `exists` surfaces NotFound.
			//
			// A `PlatformError` wraps one of two variants: `SystemError` (a normalized
			// `reason._tag` such as `NotFound` / `PermissionDenied`) or `BadArgument`
			// (`reason._tag === "BadArgument"`, no system reason). Only a `SystemError`
			// whose reason is `NotFound` is genuine absence; every other reason — a
			// `BadArgument`, or a `SystemError` with any other tag — is a real probe
			// failure and surfaces typed.
			const probeExists = (target: string): Effect.Effect<boolean, CatalogAssemblyError> =>
				fs.exists(target).pipe(
					Effect.catchTag("PlatformError", (error) => {
						const reason = error.reason;
						return reason instanceof PlatformError.SystemError && reason._tag === "NotFound"
							? Effect.succeed(false)
							: Effect.fail(CatalogAssemblyError.make({ source: "manifest", path: target, cause: error }));
					}),
				);

			// The single assembly pass produces BOTH the catalog set and the effective
			// release-age gate off one root discovery, one inline read, and one hook
			// replay — so the config-dependency hooks (which execute arbitrary code)
			// run exactly once, and both outputs share the same memo.
			const assemble: Effect.Effect<Assembled, CatalogAssemblyFailure> = Effect.gen(function* () {
				const root = yield* findLayerRoot(roots, options);

				// The lockfile is a RECORD of what was installed; an absent or
				// unreadable one is not a catalog failure, it just contributes nothing.
				// PM-aware: whichever extension (pnpm or bun) the lockfile carries.
				// Both catalog and importer-version outputs come off this ONE read, the
				// same "one pass, several outputs" discipline `releaseAgeGate` follows.
				const lockfileOutputs = yield* lockfiles.read.pipe(
					Effect.map((lockfile) => ({
						catalogs: CatalogSet.fromLockfile(lockfile),
						importerVersions: importerVersionsOf(lockfile),
					})),
					Effect.catch((_failure: LockfileReadFailure) =>
						Effect.succeed({ catalogs: CatalogSet.empty(), importerVersions: {} }),
					),
				);
				const fromLockfile = lockfileOutputs.catalogs;
				const importerVersions = lockfileOutputs.importerVersions;

				// File presence picks the inline reader, the same rule the glob
				// enumerator uses: pnpm-workspace.yaml → the pnpm path (config
				// dependencies live only here); absent → the package.json path.
				const workspaceYaml = path.join(root, "pnpm-workspace.yaml");
				const hasPnpmWorkspace = yield* probeExists(workspaceYaml);

				let inline: CatalogSet;
				let injected: CatalogSet;
				// The release-age gate contributions: inline pnpm-workspace.yaml keys and
				// the replayed hooks. Both empty on the bun/package.json path (release-age
				// is a pnpm feature and config dependencies live only in pnpm-workspace.yaml).
				let inlineGate: PartialReleaseAgeGate = {};
				let hookGate: PartialReleaseAgeGate = {};
				// The EFFECTIVE rules: the workspace file's block seeded into the
				// threaded config, with every replayed hook's contribution merged onto
				// it. Read back off the injection rather than recomputed here — the
				// point of seeding is that one object carries the answer.
				let peerDependencyRules: PeerDependencyRules = NoPeerDependencyRules;
				// Which version each config dependency replayed from; empty where
				// config dependencies do not exist.
				let hookReplays: Readonly<Record<string, HookReplay>> = {};
				if (hasPnpmWorkspace) {
					const text = yield* fs
						.readFileString(workspaceYaml)
						.pipe(
							Effect.mapError((cause) => CatalogAssemblyError.make({ source: "manifest", path: workspaceYaml, cause })),
						);
					const document = yield* Yaml.parse(text).pipe(
						Effect.mapError(
							(cause) => CatalogAssemblyError.make({ source: "manifest", path: "pnpm-workspace.yaml", cause }),
						),
					);
					// Validate the inline shape BEFORE normalizing: a malformed catalog block
					// or the default catalog declared twice must fail typed here, exactly as
					// the bun package.json path does — normalization would otherwise swallow
					// it and read as an ABSENT catalog. Absent/empty catalogs still yield empty.
					yield* validatePnpmWorkspaceCatalogs(document);
					inline = CatalogSet.fromCatalogs(inlineCatalogs(catalogBlocksOf(document)));
					// The inline release-age keys, hard-failing on a malformed value the same
					// way the catalog blocks do.
					inlineGate = yield* inlineReleaseAge(document);
					// The opt-in hook replay, seeded by the inline catalogs and merged on
					// top. The default layer's no-op hooks return the seed untouched, so
					// this executes no config-dependency code. It surfaces the injected
					// catalogs, the hooks' release-age contribution, the effective rules
					// and the replay record from ONE replay.
					// The working tree's own lockfile text, the integrity record a fetched
					// config dependency is verified against. Unreadable reads as absent
					// here, as it does for the lockfile record above: only a fetch needs
					// it, and a fetch without it fails closed on its own. Read only when
					// a config dependency is declared, since nothing else can use it.
					// Read as TEXT beside `lockfiles.read()` because the env preamble
					// the fetch verifies against is a document `Lockfile` does not model.
					const lockfileText =
						Object.keys(configDependenciesOf(document)).length === 0
							? undefined
							: yield* fs
									.readFileString(path.join(root, filenameFor("pnpm")))
									.pipe(Effect.orElseSucceed(() => undefined));
					const replayed = yield* injectFromDocument(hooks, root, document, inline, { lockfile: lockfileText });
					injected = replayed.injected;
					hookGate = replayed.injection.releaseAge;
					peerDependencyRules = replayed.injection.peerDependencyRules;
					hookReplays = replayed.injection.replays;
				} else {
					const manifestPath = path.join(root, "package.json");
					// The presence probe must distinguish genuine absence from a probe
					// FAILURE here too: a non-NotFound PlatformError (a permission/IO error)
					// on `package.json` must fail typed rather than collapse to "absent" and
					// return lockfile-only catalogs — the "every dependency looks newly
					// added" bug on the bun branch. `probeExists` already does this.
					const hasManifest = yield* probeExists(manifestPath);
					if (!hasManifest)
						return {
							catalogs: fromLockfile,
							releaseAgeGate: ReleaseAgeGate.combine(),
							importerVersions,
							peerDependencyRules: NoPeerDependencyRules,
							hookReplays: {},
						};
					const text = yield* fs
						.readFileString(manifestPath)
						.pipe(
							Effect.mapError((cause) => CatalogAssemblyError.make({ source: "manifest", path: manifestPath, cause })),
						);
					inline = yield* CatalogSet.fromManifestWorkspaces(text);
					// Config dependencies are a pnpm feature; there are none on this path.
					injected = CatalogSet.empty();
				}

				const assembled = CatalogSet.merge(fromLockfile, inline, injected);
				// Strictest-wins across the two sources: max age (clamped non-negative),
				// exclude sets unioned — `ReleaseAgeGate.combine` is the single authority.
				const releaseAgeGate = ReleaseAgeGate.combine(inlineGate, hookGate);
				yield* Effect.logDebug("Catalogs assembled").pipe(
					Effect.annotateLogs({
						"workspace.root": root,
						"workspace.catalogs": Object.keys(assembled.entries).join(","),
						"workspace.releaseAgeMinutes": releaseAgeGate.ageMinutes,
					}),
				);
				return { catalogs: assembled, releaseAgeGate, importerVersions, peerDependencyRules, hookReplays };
			});

			const [resolveOnce, invalidate] = yield* Effect.cachedInvalidateWithTTL(assemble, Duration.infinity);
			const memo = Effect.onExit(resolveOnce, (exit) => (Exit.isSuccess(exit) ? Effect.void : invalidate));

			return {
				set: Effect.suspend(Effect.fn("WorkspaceCatalogs.set")(function* () {
					return (yield* memo).catalogs;
				})),
				resolveSpecifier: Effect.fn("WorkspaceCatalogs.resolveSpecifier")(function* (
					dependency: string,
					specifier: string,
				) {
					return (yield* memo).catalogs.resolveSpecifier(dependency, specifier);
				}),
				peerDependencyRules: Effect.suspend(Effect.fn("WorkspaceCatalogs.peerDependencyRules")(function* () {
					return (yield* memo).peerDependencyRules;
				})),
				releaseAgeGate: Effect.suspend(Effect.fn("WorkspaceCatalogs.releaseAgeGate")(function* () {
					return (yield* memo).releaseAgeGate;
				})),
				importerVersions: Effect.suspend(Effect.fn("WorkspaceCatalogs.importerVersions")(function* () {
					return (yield* memo).importerVersions;
				})),
				hookReplays: Effect.suspend(Effect.fn("WorkspaceCatalogs.hookReplays")(function* () {
					return (yield* memo).hookReplays;
				})),
				// Infallible bookkeeping, not a fallible boundary — no span. The next
				// read after this runs the full assembly again.
				refresh: Effect.suspend(() => invalidate),
			};
		});

	/**
	 * The service over an explicit {@link ConfigDependencyHooks} layer — the
	 * one builder every `layer*` static and the `Workspaces` composites
	 * delegate to, so the hooks layer is provided to {@link WorkspaceCatalogs.make}
	 * in exactly one place.
	 *
	 * @remarks
	 * Reach for it when the hooks layer is chosen elsewhere — a composite that
	 * must hand ONE hooks reference to both this service and
	 * `WorkspaceSnapshots` (layers memoize by reference, so two references
	 * would replay twice and could run two policies), or a test wiring
	 * {@link ConfigDependencyHooks.layerFrom}. The three `layer*` statics are
	 * this with the hooks layer fixed. `R` is the hooks layer's own
	 * requirement (the subprocess variant's `ChildProcessSpawner`), threaded
	 * through. Parameterized, so bind it to a `const` and reuse it.
	 *
	 * @param hooks - The {@link ConfigDependencyHooks} layer to replay through.
	 * @param options - The same options the other layer statics take.
	 */
	static readonly layerWithHooks = <R = never>(
		hooks: Layer.Layer<ConfigDependencyHooks, never, R>,
		options?: WorkspaceCatalogsOptions,
	): Layer.Layer<WorkspaceCatalogs, never, WorkspaceRoot | LockfileReader | FileSystem.FileSystem | Path.Path | R> =>
		Layer.effect(WorkspaceCatalogs, WorkspaceCatalogs.make(options)).pipe(Layer.provide(hooks));

	/**
	 * The live layer — the default, which **never executes config-dependency
	 * code**: it wires {@link ConfigDependencyHooks.layerNoop}, whose hooks return
	 * the inline-catalog seed untouched.
	 *
	 * @remarks
	 * Parameterized, so it mints a fresh reference per call — bind it to a
	 * `const` and reuse it, or layer memoization does not apply.
	 */
	static readonly layer = (
		options?: WorkspaceCatalogsOptions,
	): Layer.Layer<WorkspaceCatalogs, never, WorkspaceRoot | LockfileReader | FileSystem.FileSystem | Path.Path> =>
		WorkspaceCatalogs.layerWithHooks(ConfigDependencyHooks.layerNoop, options);

	/**
	 * The opt-in live layer that **does** replay config-dependency `pnpmfile.cjs`
	 * hooks: it wires {@link ConfigDependencyHooks.layerLive}, which dynamically
	 * imports and runs each config dependency's `updateConfig` in process.
	 *
	 * @remarks
	 * Same output and requirement set as {@link WorkspaceCatalogs.layer} — the only
	 * difference is that config-dependency code is executed. Use it deliberately;
	 * the default catalog path stays free of any config-dependency execution.
	 * Parameterized, so bind it to a `const` and reuse it.
	 */
	static readonly layerWithConfigDependencies = (
		options?: WorkspaceCatalogsOptions,
	): Layer.Layer<WorkspaceCatalogs, never, WorkspaceRoot | LockfileReader | FileSystem.FileSystem | Path.Path> =>
		WorkspaceCatalogs.layerWithHooks(ConfigDependencyHooks.layerLive, options);

	/**
	 * The opt-in layer that replays config-dependency `pnpmfile` hooks in a
	 * `node` **child process**: it wires
	 * {@link ConfigDependencyHooks.layerSubprocess} in place of the in-process
	 * `layerLive`.
	 *
	 * @remarks
	 * Same typed semantics as {@link WorkspaceCatalogs.layerWithConfigDependencies}
	 * — the two hook layers are drop-in interchangeable — but the replay's
	 * computed dynamic `import()` runs in the subprocess, so it survives bundling
	 * (a bundler compiles a computed in-process `import()` into a context module
	 * that cannot resolve at runtime — every bundled GitHub Action hits this).
	 * The cost is one extra requirement: core's `ChildProcessSpawner`, provided
	 * once at the edge (`@effect/platform-node`'s `NodeServices.layer`) — the
	 * same sanctioned R-widening as `Workspaces.layerWithGit`. Parameterized, so
	 * bind it to a `const` and reuse it.
	 */
	static readonly layerWithConfigDependenciesSubprocess = (
		options?: WorkspaceCatalogsOptions,
	): Layer.Layer<
		WorkspaceCatalogs,
		never,
		WorkspaceRoot | LockfileReader | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
	> => WorkspaceCatalogs.layerWithHooks(ConfigDependencyHooks.layerSubprocess, options);

	/**
	 * A test double satisfying the full {@link WorkspaceCatalogsShape} with no
	 * filesystem, lockfile read, or hook replay.
	 *
	 * @remarks
	 * There is **no honest default catalog set**: an empty `CatalogSet` that
	 * looks like a legitimate answer is the "every dependency looks newly added"
	 * failure class the live assembler hard-fails to prevent, so every method
	 * **dies** with an instructive defect until stubbed — a test-wiring mistake
	 * fails loudly as a defect rather than succeeding with a lie or failing with
	 * a dishonest typed error.
	 *
	 * The one derivation mirrors `WorkspaceDiscovery.makeTest`'s
	 * derived-from-the-primary rule: when a `set` override is supplied,
	 * `resolveSpecifier` answers from that `CatalogSet`'s own
	 * {@link CatalogSet.resolveSpecifier} — exactly what the live service runs
	 * over its assembled set — so the two stay consistent by construction.
	 * `releaseAgeGate`, `importerVersions` and `hookReplays` are **not**
	 * derivable from a catalog set (the gate comes from release-age keys and
	 * hook contributions, the importer index from the lockfile's importer
	 * blocks, the replay record from the hooks layer — none is in a
	 * `CatalogSet`) and always die unless stubbed.
	 *
	 * `refresh` defaults to `Effect.void` honestly: the double holds no memo,
	 * so "drop the memoized assembly" is genuinely a no-op — the stubs answer
	 * fresh on every call already. This mirrors `WorkspaceDiscovery.makeTest`'s
	 * `refresh`.
	 *
	 * @example
	 * ```ts
	 * import { CatalogSet, WorkspaceCatalogs } from "./index.ts";
	 * import { Effect } from "effect";
	 *
	 * const double = WorkspaceCatalogs.makeTest({
	 *   set: Effect.succeed(CatalogSet.fromCatalogs({ default: { effect: "4.0.0" } })),
	 * });
	 * // `resolveSpecifier` now answers consistently from that set.
	 * ```
	 */
	static readonly makeTest = (overrides: Partial<WorkspaceCatalogsShape> = {}): WorkspaceCatalogsShape => {
		const set = overrides.set;
		return {
			set: Effect.suspend(() => unstubbed("set")),
			resolveSpecifier:
				set !== undefined
					? (dependency: string, specifier: string) =>
							Effect.map(set, (catalogs) => catalogs.resolveSpecifier(dependency, specifier))
					: () => unstubbed("resolveSpecifier"),
			peerDependencyRules: Effect.suspend(() => unstubbed("peerDependencyRules")),
			releaseAgeGate: Effect.suspend(() => unstubbed("releaseAgeGate")),
			importerVersions: Effect.suspend(() => unstubbed("importerVersions")),
			hookReplays: Effect.suspend(() => unstubbed("hookReplays")),
			refresh: Effect.suspend(() => Effect.void),
			...overrides,
		};
	};

	/**
	 * The test layer: {@link WorkspaceCatalogs.makeTest} behind `Layer.succeed`,
	 * so a suite provides only the methods it exercises.
	 *
	 * @remarks
	 * A parameterized layer factory mints a **fresh reference per call**, and
	 * layers memoize by reference — bind the result to a `const` and reuse it
	 * rather than calling `layerTest(...)` at each composition site.
	 *
	 * @example
	 * ```ts
	 * import { CatalogSet, WorkspaceCatalogs } from "./index.ts";
	 * import { Effect } from "effect";
	 *
	 * const TestCatalogs = WorkspaceCatalogs.layerTest({
	 *   set: Effect.succeed(CatalogSet.empty()),
	 * });
	 * // program.pipe(Effect.provide(TestCatalogs))
	 * ```
	 */
	static readonly layerTest = (overrides: Partial<WorkspaceCatalogsShape> = {}): Layer.Layer<WorkspaceCatalogs> =>
		Layer.succeed(WorkspaceCatalogs, WorkspaceCatalogs.makeTest(overrides));

	/**
	 * The real implementation of `@effected/npm`'s `CatalogResolver` contract —
	 * the one `@effected/package-json` declares but cannot fill.
	 *
	 * @remarks
	 * `rangeOf` returns `Option.none()` for a dependency no catalog declares, per
	 * the contract's convention. A failed catalog *assembly* — an unreadable or
	 * malformed `pnpm-workspace.yaml`, a broken config-dependency hook — passes
	 * through **typed** as the contract's `CatalogAssemblyError`; only the
	 * remaining mechanism failure, an unfindable workspace root, is wrapped as
	 * `DependencyResolutionError`.
	 */
	static readonly catalogResolver: Layer.Layer<CatalogResolver, never, WorkspaceCatalogs> = Layer.effect(
		CatalogResolver,
		Effect.gen(function* () {
			const catalogs = yield* WorkspaceCatalogs;
			return {
				rangeOf: Effect.fn("CatalogResolver.rangeOf")((packageName: string, catalog: O.Option<string>) => catalogs.set.pipe(
						Effect.map((set) => set.rangeOf(packageName, catalog)),
						Effect.catchTag("WorkspaceRootNotFoundError", (cause) =>
							Effect.fail(
								DependencyResolutionError.make({
									specifier: O.match(catalog, {
										onNone: () => "catalog:",
										onSome: (name) => `catalog:${name}`,
									}),
									cause,
								}),
							),
						),
					)),
			};
		}),
	);
}
