// The opt-in pnpmfile `configDependencies` hook-replay seam.
//
// pnpm's config dependencies (declared under `configDependencies:` in
// `pnpm-workspace.yaml`) install to `node_modules/.pnpm-config/<name>` and may
// ship a `pnpmfile.cjs` whose `updateConfig` hook mutates the resolved config —
// catalogs included. This service replays those hooks over an inline-catalog
// seed so hook-injected catalogs land in assembly.
//
// This executes arbitrary code loaded from a config dependency, so it is **never**
// wired by the default `WorkspaceCatalogs.layer`. It is loaded IN PROCESS via a
// dynamic `import()` — no subprocess is spawned — and lives behind an opt-in,
// Node-coupled layer, the same shape as the other Node-only overlays in this
// package. `layerNoop` returns the seed untouched and is the safe default for
// tests and consumers who want the topology without the execution.
//
// Every replaying layer loads the pnpmfile of the version each entry DECLARES,
// not whatever `node_modules/.pnpm-config` holds right now: the resolution
// ladder in `internal/configDependencyResolution.ts` checks the installed copy
// first and falls back to the pnpm store, which keeps every version ever
// installed. That is what lets `WorkspaceSnapshots.at(ref)` replay a past
// ref's hooks at that ref's pinned version. `layerSubprocess` adds one more
// rung, a verified fetch into the store (`internal/configDependencyFetch.ts`),
// for the version this checkout never installed — the base side of a diff
// across a config-dependency bump.
//
// `internal/catalogs.ts` stays the only `@pnpm/catalogs.*` importer: the shape
// hooks operate on is the plain `catalog name → dependency → range` record, and
// the only normalization borrowed here is the prototype-safe `normalize`.

import { pathToFileURL } from "node:url";
import { Run } from "../commands/index.ts";
import type { PartialReleaseAgeGate } from "../npm/index.ts";
import { CatalogAssemblyError } from "../npm/index.ts";
import { Context, Duration, Effect, Layer, Predicate, Schema } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import type { CatalogEntries } from "./internal/catalogs.ts";
import { normalize } from "./internal/catalogs.ts";
import { makeFetchConfigDependency } from "./internal/configDependencyFetch.ts";
import type { ResolvedPnpmfile } from "./internal/configDependencyResolution.ts";
import { lookupPnpmfiles, resolvePnpmfiles } from "./internal/configDependencyResolution.ts";

/**
 * The pnpm config surface a `pnpmfile.cjs` `updateConfig` hook reads and
 * rewrites: the catalog slice, plus the release-age keys pnpm honours
 * (`minimumReleaseAge` in minutes, `minimumReleaseAgeExclude` as name patterns).
 * The catalog fields are always present; the release-age fields are `undefined`
 * until a hook sets them.
 */
interface HookConfig {
	catalog: Record<string, string>;
	catalogs: Record<string, Record<string, string>>;
	minimumReleaseAge: number | undefined;
	minimumReleaseAgeExclude: readonly string[] | undefined;
	peerDependencyRules: PeerDependencyRules | undefined;
}

/**
 * pnpm's `peerDependencyRules` block — the suppression policy pnpm applies
 * **after** computing peer violations, in pnpm's own shape.
 *
 * @remarks
 * The shape is pnpm's own, because that is what comes back off the threaded
 * config: a replayed hook returns `{ allowedVersions, ignoreMissing, allowAny }`
 * intact, needing no reshaping.
 *
 * All three axes are consumed by `PeerCheck`, matching `pnpm peers check`.
 * `ignoreMissing` and `allowAny` are lists of **peer-name patterns** in pnpm's `@pnpm/matcher`
 * grammar (`*` wildcard, leading `!` negation) — not `parent>peer` keys, which
 * match nothing on those two axes. `ignoreMissing` hides only a required peer
 * that resolved to nothing; `allowAny` hides only a peer that resolved outside
 * its wanted range; the two never cross.
 *
 * `allowedVersions` keys come in two spellings in the wild, and both must be
 * handled: parent-versioned (`"@effect/ai-anthropic@4.0.0>effect"`, as
 * `pnpm:export` materializes them into `pnpm-workspace.yaml`) and unversioned
 * (`"@effect/vitest>vitest"`, as a config-dependency plugin injects them).
 *
 * @public
 */
export interface PeerDependencyRules {
	/** `parent>peer` → the peer version or range the rule permits. */
	readonly allowedVersions: Readonly<Record<string, string>>;
	/** Peer-name patterns whose absence pnpm does not report (a required peer that resolved to nothing). */
	readonly ignoreMissing: ReadonlyArray<string>;
	/** Peer-name patterns for which any resolved version is accepted. */
	readonly allowAny: ReadonlyArray<string>;
}

/**
 * The empty {@link PeerDependencyRules}: every axis present and empty.
 *
 * @remarks
 * Exported so that "I assert this workspace's rules are empty" is **one token**
 * rather than three hand-written empty axes. That matters where the distinction
 * is load-bearing — supplying rules asserts they were looked up, while omitting
 * them asserts nothing — and a caller spelling the object out by hand will
 * eventually fill two of the three axes and mean the third.
 *
 * Frozen, since it is shared.
 *
 * @public
 */
export const NoPeerDependencyRules: PeerDependencyRules = Object.freeze({
	allowedVersions: Object.freeze({}),
	ignoreMissing: Object.freeze([]),
	allowAny: Object.freeze([]),
});

/** Internal alias, kept short at the many call sites in this module. */
const NO_PEER_RULES: PeerDependencyRules = NoPeerDependencyRules;

/**
 * Where a replayed config dependency's declared version was found: the
 * `node_modules/.pnpm-config` copy, the pnpm store's `links/` tree, the store
 * after {@link ConfigDependencyHooks.layerSubprocess} fetched it, or a
 * {@link ConfigDependencyHooks.layerFrom} entry.
 *
 * @public
 */
export type HookReplaySource = "installed" | "store" | "fetched" | "supplied";

/**
 * What the side whose `configDependencies` are being replayed recorded beyond
 * that map — the input the fetch rung needs to verify what it fetches.
 *
 * @remarks
 * Both fields are optional, and omitting the whole context is always valid:
 * nothing here changes which version is replayed. `lockfile` matters only when
 * a replaying layer must fetch a version installed nowhere, and only
 * {@link ConfigDependencyHooks.layerSubprocess} fetches. Without it, a bare
 * `configDependencies` spec has no integrity to verify a fetch against, so the
 * fetch fails closed with `reason: "integrityUnavailable"`.
 *
 * `WorkspaceCatalogs` passes the working tree's lockfile, and
 * `WorkspaceSnapshots.at(ref)` passes the lockfile and the ref it read at, so
 * each side of a diff is verified against its own record.
 *
 * @public
 */
export interface HookReplayContext {
	/**
	 * The declaring side's `pnpm-lock.yaml` text, whose env preamble records each
	 * config dependency's integrity. `undefined` when that side has no lockfile.
	 */
	readonly lockfile?: string | undefined;
	/**
	 * The git ref whose `pnpm-workspace.yaml` declared the `configDependencies`,
	 * used to name the side in error messages. `undefined` for the working tree.
	 */
	readonly ref?: string | undefined;
}

/**
 * Which version of a config dependency a replay actually loaded, and where
 * that version came from.
 *
 * @remarks
 * Recorded per dependency so a consumer diffing two refs can tell not just
 * WHAT the hooks injected but which pinned version injected it — the
 * evidence that a "range moved" row came from a config-dependency bump and
 * not from a hook edit. `installed` is the `node_modules/.pnpm-config` copy,
 * `store` the pnpm store's `links/` tree, `fetched` the store copy
 * {@link ConfigDependencyHooks.layerSubprocess} fetched, verified, because
 * neither held the declared version, and `supplied` a
 * {@link ConfigDependencyHooks.layerFrom} entry.
 *
 * @public
 */
export interface HookReplay {
	/** The declared version that was resolved and replayed. */
	readonly version: string;
	/** Which resolution rung answered. */
	readonly source: HookReplaySource;
}

/**
 * The result of replaying a workspace's `configDependencies` hooks: the catalogs
 * the hooks yield, and the release-age gate contribution they leave on the
 * config (pnpm's `minimumReleaseAge` / `minimumReleaseAgeExclude`).
 *
 * @remarks
 * `releaseAge` is a `PartialReleaseAgeGate` — the age, the exclude list,
 * both, or neither, depending on what the replayed hooks set. It is deliberately
 * a *partial* contribution: a consumer folds it into an effective gate with
 * `ReleaseAgeGate.combine` alongside inline `pnpm-workspace.yaml` values. Hooks
 * that set no release-age keys contribute an empty gate (`{}`).
 *
 * @public
 */
export interface HookInjection {
	/** The catalogs the replayed hooks yield, as `catalog name → dependency → range`. */
	readonly catalogs: Readonly<Record<string, Readonly<Record<string, string>>>>;
	/** The release-age gate contribution the replayed hooks leave on the config. */
	readonly releaseAge: PartialReleaseAgeGate;
	/**
	 * The **effective** peer-dependency rules: the seeded workspace-file rules
	 * with every replayed hook's contribution threaded over them.
	 *
	 * @remarks
	 * Effective rather than hook-only because the rules are **seeded** into the
	 * threaded config and the hooks merge onto them, exactly as pnpm seeds its
	 * own config and takes back what the hooks return, so there is no second
	 * merge implementation to drift from pnpm's threading.
	 *
	 * A plugin whose hook *overwrites* the seeded rules rather than merging
	 * onto them replaces them here exactly as it does under pnpm.
	 */
	readonly peerDependencyRules: PeerDependencyRules;
	/**
	 * Which version each declared config dependency was replayed from, keyed
	 * by name — every dependency the layer resolved, including one that ships
	 * no pnpmfile (resolved, contributed nothing). `{}` under
	 * {@link ConfigDependencyHooks.layerNoop}, which resolves nothing.
	 */
	readonly replays: Readonly<Record<string, HookReplay>>;
}

/**
 * The {@link ConfigDependencyHooks} service shape.
 *
 * @remarks
 * `inject` is given the workspace root, the manifest's `configDependencies`
 * (name → version+integrity), and the inline-catalog seed as a plain
 * `catalog name → dependency name → range` record, and produces a
 * {@link HookInjection}: the catalogs the replayed hooks yield **and** the
 * release-age gate contribution they leave on the config. The default (no-op)
 * implementation returns the seed catalogs unchanged, contributes an empty
 * release-age gate, and loads nothing.
 *
 * @public
 */
export interface ConfigDependencyHooksShape {
	/**
	 * Replay each config dependency's `updateConfig` hook over `seed`, in
	 * declaration order, and return both the resulting catalogs and the
	 * release-age gate contribution the hooks leave behind.
	 *
	 * @remarks
	 * The hooks are replayed once over a single threaded config object, exactly
	 * as pnpm does — so catalogs and the release-age keys
	 * (`minimumReleaseAge` / `minimumReleaseAgeExclude`) are both read off that
	 * one final object, and the config-dependency code executes only once. When
	 * two hooks both set a release-age key the **later hook wins** (it rewrites
	 * the threaded value); a hook that returns a malformed value for a key leaves
	 * the prior threaded value in place (tolerant threading, matching the catalog
	 * slice). A hook failing to load or replay fails typed with a
	 * `hooks`-source `CatalogAssemblyError`, never a silent skip.
	 *
	 * @param root - The workspace root; config dependencies resolve under
	 *   `<root>/node_modules/.pnpm-config/<name>` when that holds the declared
	 *   version, else through the pnpm store.
	 * @param configDependencies - The `configDependencies` map (name →
	 *   `<version>+<integrity>`, or a bare `<version>`) declared in the
	 *   `pnpm-workspace.yaml` being read — the live one, or the one at a ref.
	 *   The replaying layers load the pnpmfile of the DECLARED version.
	 * @param seed - The inline catalogs, as `catalog name → dependency → range`.
	 * @param rules - The workspace file's `peerDependencyRules`, seeded into the
	 *   threaded config so hooks merge onto them rather than replacing them.
	 *   Omitted means "the workspace file declares none", which is different
	 *   from "nobody looked" — the caller owns that distinction.
	 * @param context - What the declaring side recorded beyond the map: its
	 *   lockfile, which verifies a fetched version, and its ref, which names it
	 *   in errors. Only {@link ConfigDependencyHooks.layerSubprocess} reads the
	 *   lockfile; omitting the context never changes which version is replayed.
	 */
	readonly inject: (
		root: string,
		configDependencies: Readonly<Record<string, string>>,
		seed: Readonly<Record<string, Readonly<Record<string, string>>>>,
		rules?: PeerDependencyRules,
		context?: HookReplayContext,
	) => Effect.Effect<HookInjection, CatalogAssemblyError>;
}

/** Turn the seed record into the pnpm hook config, with the default catalog split out under `catalog`. */
const seedToConfig = (
	seed: Readonly<Record<string, Readonly<Record<string, string>>>>,
	rules: PeerDependencyRules | undefined,
): HookConfig => {
	const catalogs: Record<string, Record<string, string>> = {};
	let catalog: Record<string, string> = {};
	for (const [name, entries] of Object.entries(seed)) {
		if (name === "default") catalog = { ...entries };
		else catalogs[name] = { ...entries };
	}
	// The seed carries no release-age keys — only a replayed hook sets them. It
	// DOES carry the peer-dependency rules, because those have a workspace-file
	// source that hooks merge onto rather than replace.
	return {
		catalog,
		catalogs,
		minimumReleaseAge: undefined,
		minimumReleaseAgeExclude: undefined,
		peerDependencyRules: rules,
	};
};

/** A finite number if `value` is one, else the prior threaded value — a garbage age is dropped, not fatal. */
const finiteNumberOr = (value: unknown, fallback: number | undefined): number | undefined =>
	typeof value === "number" && Number.isFinite(value) ? value : fallback;

/** A string array if `value` is one, else the prior threaded value — a malformed exclude is dropped, not fatal. */
const stringArrayOr = (value: unknown, fallback: readonly string[] | undefined): readonly string[] | undefined =>
	Array.isArray(value) && value.every((entry) => typeof entry === "string") ? (value as readonly string[]) : fallback;

/**
 * Read the catalog slice and the release-age keys back out of whatever a hook
 * returned, threading the prior config as the fallback.
 *
 * @remarks
 * Tolerant by design, matching this seam's discipline: a hook's returned *data*
 * is normalized, never a typed failure (only a load/replay *mechanism* failure
 * raises `CatalogAssemblyError`). A hook that omits a key, or returns a
 * malformed value for it, leaves the prior threaded value in place; a hook that
 * sets a well-formed key rewrites it — so across hooks the **last well-formed
 * write wins**, exactly as pnpm's single mutable config object behaves.
 */
const configOf = (value: unknown, fallback: HookConfig): HookConfig => {
	if (!Predicate.isObject(value)) return fallback;
	return {
		catalog: Predicate.isObject(value.catalog) ? (value.catalog as Record<string, string>) : fallback.catalog,
		catalogs: Predicate.isObject(value.catalogs)
			? (value.catalogs as Record<string, Record<string, string>>)
			: fallback.catalogs,
		minimumReleaseAge: finiteNumberOr(value.minimumReleaseAge, fallback.minimumReleaseAge),
		minimumReleaseAgeExclude: stringArrayOr(value.minimumReleaseAgeExclude, fallback.minimumReleaseAgeExclude),
		peerDependencyRules: peerRulesOr(value.peerDependencyRules, fallback.peerDependencyRules),
	};
};

/**
 * A peer-rules block if `value` is one, else the prior threaded value — a
 * malformed block is dropped, not fatal, matching the other slices.
 *
 * Each axis is normalized independently: a hook that rewrites `allowedVersions`
 * and leaves `ignoreMissing` alone must not blank the latter.
 */
const stringRecordOr = (
	value: unknown,
	fallback: Readonly<Record<string, string>> | undefined,
): Readonly<Record<string, string>> | undefined =>
	Predicate.isObject(value) && Object.values(value).every((entry) => typeof entry === "string")
		? (value as Record<string, string>)
		: fallback;

const peerRulesOr = (value: unknown, fallback: PeerDependencyRules | undefined): PeerDependencyRules | undefined => {
	if (!Predicate.isObject(value)) return fallback;
	// Every entry must be a string, not merely the block an object: the public
	// contract is name→RANGE, and a non-string value reaches range parsing as a
	// rule nobody can evaluate. The same all-entries rule `stringArrayOr`
	// applies to the two array axes — a malformed axis keeps the prior threaded
	// value rather than passing junk through.
	const allowed = stringRecordOr(value.allowedVersions, fallback?.allowedVersions);
	const ignoreMissing = stringArrayOr(value.ignoreMissing, fallback?.ignoreMissing);
	const allowAny = stringArrayOr(value.allowAny, fallback?.allowAny);
	if (allowed === undefined && ignoreMissing === undefined && allowAny === undefined) return fallback;
	return {
		allowedVersions: allowed ?? {},
		ignoreMissing: ignoreMissing ?? [],
		allowAny: allowAny ?? [],
	};
};

/** Project the threaded config's rules into the slice, defaulting every axis to empty. */
const peerRulesOf = (config: HookConfig): PeerDependencyRules => config.peerDependencyRules ?? NO_PEER_RULES;

/**
 * Project the threaded config's release-age keys into a partial gate
 * contribution, omitting a key the hooks never set (never an explicit
 * `undefined` — the fields are `optionalKey`).
 */
const releaseAgeOf = (config: HookConfig): PartialReleaseAgeGate => ({
	...(config.minimumReleaseAge !== undefined ? { ageMinutes: config.minimumReleaseAge } : {}),
	...(config.minimumReleaseAgeExclude !== undefined ? { exclude: config.minimumReleaseAgeExclude } : {}),
});

/** Fold the hook config back into the normalized `catalog name → dependency → range` record. */
const configToEntries = (config: HookConfig): CatalogEntries => {
	const raw: Record<string, unknown> = { ...config.catalogs };
	if (Object.keys(config.catalog).length > 0) {
		raw.default = { ...(Predicate.isObject(raw.default) ? raw.default : {}), ...config.catalog };
	}
	return normalize(raw);
};

/** The `updateConfig` hook a loaded `pnpmfile.cjs` exposes, however it is exported. */
type UpdateConfig = (config: HookConfig) => unknown;

/** Locate the `updateConfig` hook across the CJS/ESM export shapes a `pnpmfile.cjs` can present. */
const updateConfigOf = (mod: unknown): UpdateConfig | undefined => {
	for (const candidate of [mod, Predicate.isObject(mod) ? mod.default : undefined]) {
		if (!Predicate.isObject(candidate)) continue;
		const hooks = candidate.hooks;
		if (Predicate.isObject(hooks) && Predicate.isFunction(hooks.updateConfig))
			return hooks.updateConfig as UpdateConfig;
		if (Predicate.isFunction(candidate.updateConfig)) return candidate.updateConfig as UpdateConfig;
	}
	return undefined;
};

/**
 * The seed pass-through: what every layer returns for an empty
 * `configDependencies`, and — with `replays` — what a replaying layer returns
 * when every resolved dependency ships no pnpmfile.
 */
const untouched = (
	seed: Readonly<Record<string, Readonly<Record<string, string>>>>,
	rules: PeerDependencyRules | undefined,
	replays: Readonly<Record<string, HookReplay>> = {},
): HookInjection => ({ catalogs: seed, releaseAge: {}, peerDependencyRules: rules ?? NO_PEER_RULES, replays });

/** The per-name replay record of a resolved set — every resolved dependency, pnpmfile or not. */
const replaysOf = (pnpmfiles: ReadonlyArray<ResolvedPnpmfile>): Readonly<Record<string, HookReplay>> => {
	const replays: Record<string, HookReplay> = {};
	for (const { name, version, source } of pnpmfiles) replays[name] = { version, source };
	return replays;
};

/** Project the final threaded config into the injection, alongside the replay record. */
const injectionOf = (config: HookConfig, pnpmfiles: ReadonlyArray<ResolvedPnpmfile>): HookInjection => ({
	catalogs: configToEntries(config),
	releaseAge: releaseAgeOf(config),
	peerDependencyRules: peerRulesOf(config),
	replays: replaysOf(pnpmfiles),
});

/**
 * Replay already-resolved pnpmfiles IN PROCESS over the seed, in order — the
 * one implementation {@link ConfigDependencyHooks.layerLive} and
 * {@link ConfigDependencyHooks.layerFrom} share; only how the paths were
 * found differs.
 *
 * @remarks
 * Each file is loaded via a dynamic `import()` of its file URL. Because the
 * caller has already established that the file exists (listed by the
 * ladder's directory read, or by the caller's own word under `layerFrom`),
 * ANY load failure — a syntax error, a throwing top level, an unreadable
 * file, an `ERR_MODULE_NOT_FOUND` for a module the pnpmfile itself imports —
 * is a real error and surfaces typed as a
 * `hooks`-source `CatalogAssemblyError` naming the dependency, never a silent
 * skip. A file exposing no `updateConfig` hook contributes nothing. The hook
 * is called synchronously and its returned data threaded tolerantly
 * (`configOf`); a hook that throws fails typed.
 */
const replayInProcess = (
	pnpmfiles: ReadonlyArray<ResolvedPnpmfile>,
	seed: Readonly<Record<string, Readonly<Record<string, string>>>>,
	rules: PeerDependencyRules | undefined,
): Effect.Effect<HookInjection, CatalogAssemblyError> =>
	Effect.gen(function* () {
		let config = seedToConfig(seed, rules);
		for (const { name, path } of pnpmfiles) {
			// Resolved but shipping no pnpmfile: recorded in `replays`, nothing to run.
			if (path === undefined) continue;
			const url = pathToFileURL(path).href;
			const loaded = yield* Effect.tryPromise({
				// `webpackIgnore` keeps webpack-family bundlers from compiling this
				// computed import into a context module: the target is a runtime
				// path under the consumer's own node_modules (or store), unresolvable
				// at bundle time, and every bundled consumer otherwise carries a
				// Critical-dependency warning it cannot silence — even one composing
				// `layerSubprocess`, because this module stays in its import graph
				// either way.
				try: () => import(/* webpackIgnore: true */ url) as Promise<unknown>,
				catch: (cause) => new CatalogAssemblyError({ source: "hooks", path: name, cause }),
			});
			const updateConfig = updateConfigOf(loaded);
			if (updateConfig === undefined) continue;
			const currentConfig = config;
			config = yield* Effect.try({
				try: () => configOf(updateConfig(currentConfig), currentConfig),
				catch: (cause) => new CatalogAssemblyError({ source: "hooks", path: name, cause }),
			});
		}
		return injectionOf(config, pnpmfiles);
	});

/**
 * The subprocess replay program {@link ConfigDependencyHooks.layerSubprocess}
 * hands to `node --input-type=module -e`.
 *
 * @remarks
 * A **static** string constant, deliberately: a bundler compiles a *computed*
 * dynamic `import()` into a context module that cannot resolve a runtime path
 * (`Cannot find module 'file:///…'`), so the computed import has to run in a
 * child process whose program text carries **no interpolated runtime value** —
 * the seed, the rules seed and the resolved `[name, fileUrl]` pairs all
 * arrive via argv (`<seed> <rules> <entries>`, read as `process.argv.slice(1)`
 * under `-e`), never spliced into the script.
 *
 * The PARENT resolves each config dependency to the pnpmfile of its declared
 * version (`internal/configDependencyResolution.ts`) and hands the child only
 * `file:` URLs of existing files, so the child performs no lookup, no path
 * conversion and no skip discrimination: any `import()` failure is a real
 * load failure. The script otherwise mirrors `replayInProcess` exactly so the
 * two layers are drop-in interchangeable: the same hook-locator shapes, the
 * same tolerant threading of returned data (`configOf` / `finiteNumberOr` /
 * `stringArrayOr` clones below), and the same synchronous hook call. Only the
 * *mechanism* failures are reported: the script prints one final line of JSON —
 * `{ ok: true, config }` on success, `{ ok: false, name, message, stack? }`
 * naming the offending dependency on a load/replay failure — and exits through
 * the write callback so the payload is flushed even if a hook left the event
 * loop occupied. The final-line framing tolerates a hook's own `console.log`
 * noise on stdout.
 */
const REPLAY_SCRIPT = `
const [seedJson, rulesJson, entriesJson] = process.argv.slice(1);
const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const finiteNumberOr = (value, fallback) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
const stringArrayOr = (value, fallback) =>
	Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : fallback;
const stringRecordOr = (value, fallback) =>
	isObject(value) && Object.values(value).every((entry) => typeof entry === "string") ? value : fallback;
const peerRulesOr = (value, fallback) => {
	if (!isObject(value)) return fallback;
	const allowed = stringRecordOr(value.allowedVersions, fallback && fallback.allowedVersions);
	const ignoreMissing = stringArrayOr(value.ignoreMissing, fallback && fallback.ignoreMissing);
	const allowAny = stringArrayOr(value.allowAny, fallback && fallback.allowAny);
	if (allowed === undefined && ignoreMissing === undefined && allowAny === undefined) return fallback;
	return { allowedVersions: allowed || {}, ignoreMissing: ignoreMissing || [], allowAny: allowAny || [] };
};
const configOf = (value, fallback) =>
	isObject(value)
		? {
				catalog: isObject(value.catalog) ? value.catalog : fallback.catalog,
				catalogs: isObject(value.catalogs) ? value.catalogs : fallback.catalogs,
				minimumReleaseAge: finiteNumberOr(value.minimumReleaseAge, fallback.minimumReleaseAge),
				minimumReleaseAgeExclude: stringArrayOr(value.minimumReleaseAgeExclude, fallback.minimumReleaseAgeExclude),
				peerDependencyRules: peerRulesOr(value.peerDependencyRules, fallback.peerDependencyRules),
			}
		: fallback;
const failure = (name, cause) => ({
	ok: false,
	name,
	message: cause instanceof Error ? cause.message : String(cause),
	...(cause instanceof Error && typeof cause.stack === "string" ? { stack: cause.stack } : {}),
});
const replay = async () => {
	let catalog = {};
	const catalogs = {};
	for (const [name, entries] of Object.entries(JSON.parse(seedJson))) {
		if (name === "default") catalog = { ...entries };
		else catalogs[name] = { ...entries };
	}
	let config = {
		catalog,
		catalogs,
		minimumReleaseAge: undefined,
		minimumReleaseAgeExclude: undefined,
		peerDependencyRules: JSON.parse(rulesJson),
	};
	for (const [name, url] of JSON.parse(entriesJson)) {
		let loaded;
		try {
			loaded = await import(url);
		} catch (cause) {
			return failure(name, cause);
		}
		let hook;
		for (const candidate of [loaded, isObject(loaded) ? loaded.default : undefined]) {
			if (!isObject(candidate)) continue;
			if (isObject(candidate.hooks) && typeof candidate.hooks.updateConfig === "function") {
				hook = candidate.hooks.updateConfig;
				break;
			}
			if (typeof candidate.updateConfig === "function") {
				hook = candidate.updateConfig;
				break;
			}
		}
		if (hook === undefined) continue;
		try {
			config = configOf(hook(config), config);
		} catch (cause) {
			return failure(name, cause);
		}
	}
	return { ok: true, config };
};
const payload = await replay();
process.stdout.write("\\n" + JSON.stringify(payload) + "\\n", () => process.exit(0));
`;

/**
 * The ceiling on one subprocess replay. A config dependency's `updateConfig`
 * reads and rewrites a config object — no install work, no network — so thirty
 * seconds is generous. Without a ceiling a pnpmfile that loops or awaits a
 * promise that never settles hangs `inject`, and through it the one memoized
 * {@link WorkspaceCatalogs} assemble pass every catalog read blocks on. Expiry
 * kills the child (`Run` scopes it) and surfaces as a `CommandFailedError`
 * through the same typed transport-failure path as any other mechanism failure.
 */
const REPLAY_TIMEOUT = Duration.seconds(30);

/**
 * The subprocess protocol payload — a single JSON line near the end of the
 * child's stdout, framed and parsed by `Run.jsonLine`, which scans lines from
 * the end for the first that decodes (so a hook logging after the payload —
 * e.g. from `process.on("exit", ...)` — cannot displace it). The `ok`
 * discriminant is what keeps an accidental log line from satisfying the
 * envelope. The envelope is strict (a payload without a usable
 * `ok` discriminant is a mechanism failure, typed); the `config` slice inside a
 * success stays `Unknown` because a hook's returned *data* is tolerantly
 * threaded (`configOf`), never fatal.
 */
const ReplayPayload = Schema.Union([
	Schema.Struct({ ok: Schema.Literal(true), config: Schema.Unknown }),
	Schema.Struct({
		ok: Schema.Literal(false),
		name: Schema.optionalKey(Schema.String),
		message: Schema.optionalKey(Schema.String),
		stack: Schema.optionalKey(Schema.String),
	}),
]);

/** Rebuild the subprocess's serialized failure as an `Error`, preserving the child-side stack when it carried one. */
const replayFailureCause = (payload: { readonly message?: string; readonly stack?: string }): Error => {
	const error = new Error(payload.message ?? "config dependency hook replay failed");
	if (payload.stack !== undefined) error.stack = payload.stack;
	return error;
};

/**
 * Replays a workspace's `configDependencies` `updateConfig` hooks over the inline
 * catalogs — the opt-in seam that lets hook-injected catalogs participate in
 * assembly.
 *
 * @remarks
 * A contract-only service: it declares the shape and ships layers, never a
 * baked-in default. {@link ConfigDependencyHooks.layerNoop} executes no
 * config-dependency code (it returns the seed untouched) and is what the default
 * {@link WorkspaceCatalogs} layer wires; {@link ConfigDependencyHooks.layerLive}
 * dynamically imports each pnpmfile and replays it, and is wired only by the
 * explicit `WorkspaceCatalogs.layerWithConfigDependencies` opt-in;
 * {@link ConfigDependencyHooks.layerSubprocess} is its bundler-safe twin; and
 * {@link ConfigDependencyHooks.layerFrom} is the hermetic test seam that
 * replays caller-supplied files with no resolution.
 *
 * Every replaying layer replays the pnpmfile of the version each
 * `configDependencies` entry **declares** — `layerLive` and `layerSubprocess`
 * resolve it through `node_modules/.pnpm-config` and then the pnpm store,
 * failing closed when neither holds that version — so a snapshot read at a
 * past ref replays that ref's pinned hook, not today's.
 *
 * @public
 */
export class ConfigDependencyHooks extends Context.Service<ConfigDependencyHooks, ConfigDependencyHooksShape>()(
	"@effected/workspaces/ConfigDependencyHooks",
) {
	/**
	 * The no-op layer: `inject` returns the seed unchanged and never touches a
	 * config dependency. The default {@link WorkspaceCatalogs} layer wires this, so
	 * the default catalog path provably executes no config-dependency code.
	 */
	static readonly layerNoop: Layer.Layer<ConfigDependencyHooks> = Layer.succeed(ConfigDependencyHooks, {
		inject: (_root, _configDependencies, seed, rules) =>
			// The seed passes through untouched on every slice, rules included: a
			// no-op replay changes nothing, and returning empty rules here would be
			// indistinguishable from a workspace that declares none.
			Effect.succeed(untouched(seed, rules)),
	});

	/**
	 * The live layer: resolves each config dependency to the pnpmfile of its
	 * **declared** version, dynamically imports it (in process, no subprocess)
	 * and replays its `updateConfig` hook over the seed, in declaration order.
	 * A dependency that ships no pnpmfile contributes nothing; a dependency
	 * whose declared version is installed nowhere, or whose file fails to load
	 * or replay, fails typed with a `hooks`-source `CatalogAssemblyError`, never
	 * a silent skip.
	 *
	 * @remarks
	 * Resolution is a ladder, fail-closed, with no registry fetch ever:
	 * `<root>/node_modules/.pnpm-config/<name>` when its `package.json`
	 * `version` equals the declared version (the text before the first `+` of
	 * the `configDependencies` value), else the pnpm store's
	 * `links/<name>/<declared>/*\/node_modules/<name>` (the store is located
	 * from `node_modules/.modules.yaml`, the realpath of any `.pnpm-config`
	 * entry, then `$PNPM_HOME` / `$XDG_DATA_HOME` / the platform default), else
	 * a typed error with `reason: "notInstalled"` naming the package, the
	 * declared version, what is installed, the stores searched, and the
	 * remediation (`pnpm add --config <name>@<version>` in a throwaway
	 * workspace, or the subprocess layer, which fetches). In the
	 * chosen directory the first of `pnpmfile.mjs`, `pnpmfile.cjs`,
	 * `pnpmfile.js` present in one directory listing is loaded; a listed but
	 * unreadable file fails typed at import time, never as "ships no hook".
	 *
	 * Runtime-coupled by design, not node-exclusive. The `import()` loads
	 * **and executes** a config dependency's pnpmfile in-process — code execution,
	 * not IO, so no `FileSystem` / `Path` service abstracts it — and the ladder
	 * reads the real disk through `node:fs` for the same reason: the store it
	 * searches is real even when the caller's `FileSystem` is virtual. Only ever
	 * wired by `WorkspaceCatalogs.layerWithConfigDependencies` and the
	 * `Workspaces` composites of the same name.
	 */
	static readonly layerLive: Layer.Layer<ConfigDependencyHooks> = Layer.succeed(ConfigDependencyHooks, {
		inject: (root, configDependencies, seed, rules, context) =>
			Effect.gen(function* () {
				if (Object.keys(configDependencies).length === 0) return untouched(seed, rules);
				const pnpmfiles = yield* resolvePnpmfiles(root, configDependencies, { side: context });
				return yield* replayInProcess(pnpmfiles, seed, rules);
			}),
	});

	/**
	 * The hermetic layer: replays caller-supplied pnpmfiles, keyed
	 * `"<name>@<version>"` → absolute path, with **no resolution** — it consults
	 * neither `node_modules/.pnpm-config` nor the pnpm store, and never the
	 * effect `FileSystem` service, so it works unchanged under an
	 * `@effected/memfs` volume.
	 *
	 * @remarks
	 * The test seam for anything that replays hooks: a suite can pin what
	 * `at(ref)` replays for a ref declaring `plugin@1.0.0` versus one declaring
	 * `plugin@2.0.0` by mapping both keys to fixture files, with no store on
	 * disk. The version half of the key is the declared version — the text
	 * before the first `+` of the `configDependencies` value — so a
	 * `<version>+<integrity>` spec and a bare `<version>` spec look up the same
	 * entry.
	 *
	 * Same typed semantics as {@link ConfigDependencyHooks.layerLive} past the
	 * lookup: the same in-process `import()`, the same hook-locator shapes, the
	 * same tolerant threading, the same `hooks`-source attribution. A declared
	 * `(name, version)` with no entry fails closed, the same shape as an
	 * uninstalled version under `layerLive`; an empty `configDependencies`
	 * returns the seed untouched. A `..` segment in a name is refused before
	 * any lookup.
	 *
	 * @param entries - `"<name>@<version>"` → the absolute path of the pnpmfile
	 *   to replay for that declared version.
	 *
	 * @example
	 * ```ts
	 * import { ConfigDependencyHooks } from "./index.ts";
	 *
	 * const hooks = ConfigDependencyHooks.layerFrom({
	 *   "@scope/plugin@1.0.0": "/fixtures/plugin-1/pnpmfile.mjs",
	 *   "@scope/plugin@2.0.0": "/fixtures/plugin-2/pnpmfile.mjs",
	 * });
	 * ```
	 */
	static readonly layerFrom = (entries: Readonly<Record<string, string>>): Layer.Layer<ConfigDependencyHooks> =>
		Layer.succeed(ConfigDependencyHooks, {
			inject: (_root, configDependencies, seed, rules) =>
				Effect.gen(function* () {
					if (Object.keys(configDependencies).length === 0) return untouched(seed, rules);
					const pnpmfiles = yield* lookupPnpmfiles(entries, configDependencies);
					return yield* replayInProcess(pnpmfiles, seed, rules);
				}),
		});

	/**
	 * The subprocess layer: replays each config dependency's pnpmfile in a `node`
	 * child process instead of an in-process dynamic `import()`, with identical
	 * typed semantics to {@link ConfigDependencyHooks.layerLive} — the two are
	 * drop-in interchangeable.
	 *
	 * @remarks
	 * `layerLive` computes the `import()` path at runtime, and a bundler (rspack,
	 * for one) compiles a *computed* dynamic import into a context module that
	 * throws `Cannot find module 'file:///…'` at runtime — so in any bundled
	 * consumer, a GitHub Action above all, the in-process replay is unreachable.
	 * This layer keeps every computed load out of the bundle graph: the replay
	 * program is a **static** string constant passed via argv
	 * (`node --input-type=module -e <script> <seed> <rules> <entries>`), and the
	 * child process performs the computed imports where no bundler rewrote them.
	 * A subprocess also keeps config-dependency code out of the consumer's own
	 * process.
	 *
	 * The declared-version resolution is the PARENT's: the same ladder as
	 * `layerLive` (`.pnpm-config` when it holds the declared version, else the
	 * pnpm store) runs here, and the child receives the resolved
	 * `[name, fileUrl]` pairs as one JSON argv argument.
	 *
	 * One rung more than `layerLive`: a version held nowhere is FETCHED into
	 * the store rather than failing, so a diff whose base side declares a
	 * version this checkout never installed still replays that version. pnpm
	 * runs `install --frozen-lockfile` in a scratch workspace (removed
	 * afterwards) whose lockfile pins the integrity the declaring side recorded
	 * — the inline `<version>+<integrity>` spec, else that side's
	 * `pnpm-lock.yaml` env preamble ({@link HookReplayContext.lockfile}) — so
	 * pnpm itself refuses a download that does not match. It writes to the
	 * first store the ladder searched, so the next replay finds the version
	 * there. The replay records `source: "fetched"`. Fail-closed: two recorded
	 * integrities that disagree fail with `reason: "integrityMismatch"`, none
	 * with `reason: "integrityUnavailable"` — nothing is fetched in either case
	 * — and a fetch that fails with `reason: "fetchFailed"`, keeping the
	 * not-installed remediation. The fetch needs `pnpm` 11 or 12 on `PATH` and
	 * registry access, and is bounded at two minutes.
	 *
	 * The scratch workspace fetches through the same registries a
	 * `pnpm install` in the workspace would: the workspace root's `.npmrc` (scoped
	 * registries, mirrors, auth) is copied into it as-is, with `${VAR}`
	 * references left for pnpm to expand, never read or logged, and removed
	 * with the scratch; and the root `pnpm-workspace.yaml`'s `registry` and
	 * `registries` keys are carried into the scratch's. That is the CURRENT
	 * checkout's registry config for both sides of a diff — a base ref's
	 * `.npmrc` is not read through git — and relative paths inside the `.npmrc`
	 * (a `cafile=./ca.pem`) resolve against the scratch, not the root.
	 *
	 * An empty `configDependencies`, or one whose dependencies all
	 * ship no pnpmfile, returns the seed without spawning anything; a `..` path
	 * segment in a dependency name fails typed **before** any spawn; a
	 * load failure in the child — a syntax error, a throwing top level, an
	 * `ERR_MODULE_NOT_FOUND` for a module the pnpmfile itself imports — and a
	 * hook that throws when called are serialized back per-name and surface
	 * typed as a `hooks`-source `CatalogAssemblyError` naming that dependency.
	 * A hook's returned *data* stays tolerantly threaded (last well-formed write
	 * wins), never fatal. Spawn and transport failures — `node` absent, a
	 * non-zero exit without a result payload, unparseable output — fail typed
	 * too, never a defect and never a silent skip.
	 *
	 * Two bounds this layer imposes that `layerLive` cannot: the replay is
	 * given thirty seconds (a pnpmfile that loops or awaits forever fails typed
	 * instead of hanging the memoized assemble pass — a subprocess is killable,
	 * while `layerLive`'s in-process synchronous hook call is not interruptible
	 * by any means, so the asymmetry is inherent, not a parity violation), and
	 * the child's stdout is captured under `Run.jsonLine`'s 16 MiB default
	 * ceiling (a hook that logs more than that fails typed as `tooLarge`, where
	 * `layerLive` — which captures nothing — would succeed).
	 *
	 * Catalog folding and normalization stay in the **parent** (the same
	 * `@pnpm/catalogs`-derived path `layerLive` uses); the child returns only the
	 * raw threaded config slice, since the script cannot import kit code.
	 *
	 * Requires core's `ChildProcessSpawner`, resolved when the layer is built —
	 * the consumer provides it once at the edge (`@effect/platform-node`'s
	 * `NodeServices.layer`), the same discharge `@effected/git` uses. Wired by
	 * `WorkspaceCatalogs.layerWithConfigDependenciesSubprocess` /
	 * `Workspaces.layerWithConfigDependenciesSubprocess`.
	 */
	static readonly layerSubprocess: Layer.Layer<ConfigDependencyHooks, never, ChildProcessSpawner.ChildProcessSpawner> =
		Layer.effect(
			ConfigDependencyHooks,
			Effect.gen(function* () {
				const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
				const fetch = makeFetchConfigDependency(spawner);
				return {
					inject: (root, configDependencies, seed, rules, context) =>
						Effect.gen(function* () {
							if (Object.keys(configDependencies).length === 0) return untouched(seed, rules);

							// Resolve in the parent: the `..` refusal and the declared-version
							// ladder run here, so no subprocess ever sees a traversal name or
							// performs a lookup of its own. Nothing to replay → nothing to spawn.
							// This layer alone wires the fetch rung, over the same spawner.
							const pnpmfiles = yield* resolvePnpmfiles(root, configDependencies, { side: context, fetch });
							const loadable = pnpmfiles.flatMap(({ name, path }) =>
								path === undefined ? [] : [[name, pathToFileURL(path).href] as const],
							);
							if (loadable.length === 0) return untouched(seed, rules, replaysOf(pnpmfiles));

							// Seed, rules and the resolved `[name, fileUrl]` pairs travel via argv — never
							// interpolated into the script, and `ChildProcess.make` spawns without
							// a shell. `Run.jsonLine` owns the framing: scanning stdout lines from
							// the end, the payload is the last line that decodes under the
							// envelope — tolerant of a hook's own console noise before AND after
							// it — parsed REGARDLESS of the exit code, since the envelope's `ok`
							// discriminates in-band. No valid payload (a crash, a non-zero exit
							// with no result, garbage output) is a mechanism failure, typed, with
							// the exit code and stderr carried as context on the
							// `CommandOutputError` cause.
							const command = ChildProcess.make("node", [
								"--input-type=module",
								"-e",
								REPLAY_SCRIPT,
								JSON.stringify(seed),
								// The rules seed rides the same argv channel as the catalog seed —
								// never spliced into the program text, which must stay a static
								// string (a bundler compiles an interpolated dynamic import into an
								// unresolvable context module).
								JSON.stringify(rules ?? NO_PEER_RULES),
								JSON.stringify(loadable),
							]);
							// The replay executes arbitrary config-dependency code; bound it, or a
							// spinning pnpmfile hangs catalog assembly for the whole program. On
							// expiry `Run` kills the child and fails with a `CommandFailedError`,
							// which the catch below maps onto the same typed `hooks` failure as
							// any other transport failure.
							const payload = yield* Run.jsonLine(command, ReplayPayload, { timeout: REPLAY_TIMEOUT }).pipe(
								Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
								Effect.catch((cause) => Effect.fail(new CatalogAssemblyError({ source: "hooks", path: root, cause }))),
							);

							// A serialized per-name failure: the child reports a real load/replay
							// failure by name, so this maps 1:1 onto layerLive's typed error,
							// attribution intact.
							if (payload.ok === false) {
								return yield* Effect.fail(
									new CatalogAssemblyError({
										source: "hooks",
										path: payload.name ?? root,
										cause: replayFailureCause(payload),
									}),
								);
							}

							// The child returned the raw threaded config slice; fold and normalize
							// in the parent exactly as layerLive does, reading the slice tolerantly
							// against the seed (a hook's returned data is never fatal).
							return injectionOf(configOf(payload.config, seedToConfig(seed, rules)), pnpmfiles);
						}),
				};
			}),
		);
}
