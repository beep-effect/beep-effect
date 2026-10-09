// Config-dependency replay reads the real Node module store even when the supplied FileSystem is virtual.
// @effect-diagnostics nodeBuiltinImport:skip-file
import { dual } from "effect/Function";
// Resolving a declared pnpm config dependency to the pnpmfile of the version
// it DECLARES — not whatever happens to be installed right now.
//
// `configDependencies` in `pnpm-workspace.yaml` pins each config dependency
// to `<version>+<integrity>` (or a bare `<version>`). pnpm installs the
// declared version to `<root>/node_modules/.pnpm-config/<name>` — a SYMLINK
// into the store's `links/` tree — and the store keeps EVERY version ever
// installed on the machine at `<store>/links/<name>/<version>/<hash>/node_modules/<name>/`.
// So a past ref's pnpmfile is recoverable without a checkout, a fetch, or a
// registry: read the ref's declared version, then find that version in the
// store. This module is that ladder, shared by `layerLive` and
// `layerSubprocess` (the parent resolves; the child only imports).
//
// Runtime-coupled by design, like the seam it serves: `node:fs/promises` and
// `node:path` here are the same coupling the dynamic `import()` already has,
// and the ladder must NOT read through the effect `FileSystem` service — a
// caller running on `@effected/memfs` still has a REAL store on disk, and
// routing the store walk through a virtual filesystem would find nothing.
//
// Fail-closed. A declared version found neither under `.pnpm-config` nor in
// any store goes to the fetch rung when the caller wired one
// (`configDependencyFetch.ts`, only `layerSubprocess` does), which fetches it
// verified against the declaring side's recorded integrity; otherwise, and
// whenever that fails, it fails typed with a `reason` and the remediation in
// the message. Nothing is ever fetched unverified.

import { readFile, readdir, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { PnpmEnvLockfile } from "../../lockfiles/index.ts";
import type { CatalogAssemblyError } from "../../npm/index.ts";
import { PackageManagerCache } from "../../npm/index.ts";
import { Yaml } from "../../yaml/index.ts";
import * as Arr from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import type { HookReplayContext, HookReplaySource } from "../ConfigDependencyHooks.ts";
import type { FetchConfigDependency, FetchFailure, RecordedLocks } from "./configDependencyFetch.ts";
import type { ManifestVersion } from "./configDependencyShared.ts";
import { carries, hooksError, ioOrNone, manifestVersion, sideLabel } from "./configDependencyShared.ts";
import { splitConfigDependencySpec } from "./configDependencySpecGrammar.ts";

/**
 * One config dependency resolved at its declared version: where it was
 * found, and the pnpmfile to load — `undefined` when that version ships
 * none (resolved, but contributing nothing).
 */
export interface ResolvedPnpmfile {
	/** The config dependency's name, as declared. */
	readonly name: string;
	/** The declared version that was resolved. */
	readonly version: string;
	/** Which rung answered: the installed `.pnpm-config` copy, the pnpm store, the fetch rung, or a caller-supplied map. */
	readonly source: HookReplaySource;
	/** The absolute path of the pnpmfile to load, or `undefined` when the dependency ships none. */
	readonly path: string | undefined;
}

/** The pnpmfile filenames a config dependency may ship, in the order pnpm tries them. */
const PNPMFILE_CANDIDATES = ["pnpmfile.mjs", "pnpmfile.cjs", "pnpmfile.js"] as const;

/**
 * The version part of a `configDependencies` spec: the text before the first
 * `+` (`0.9.0+sha512-…` → `0.9.0`); a bare `0.9.0` is returned whole.
 *
 * Deliberately lenient — it goes through the same split as the public
 * `ConfigDependencySpec` but validates neither half. See
 * `configDependencySpecGrammar.ts` for why replay must not adopt the strict
 * model's rejections.
 */
const declaredVersionOf = (spec: string): string => splitConfigDependencySpec(spec).version;

/**
 * Whether a config-dependency `name` carries a `..` path segment. A scoped name
 * legitimately contains `/` (`@scope/pkg`), so only a `..` *segment* is rejected —
 * it would traverse out of `.pnpm-config` and feed an attacker-chosen path to the
 * dynamic `import()`.
 */
const hasTraversalSegment = (name: string): boolean => name.split(/[/\\]/).includes("..");

/** A declared `(name, version)` pair, validated, with the spec it came from. */
interface DeclaredEntry {
	readonly name: string;
	readonly version: string;
	/** The declared spec verbatim; the fetch rung reads its inline integrity. */
	readonly spec: string;
}

/**
 * The declared `(name, version)` pairs of a `configDependencies` map, in
 * declaration order, with EVERY name validated before any path is built from
 * one: a `..` segment fails typed. Shared by both resolvers so the refusal and
 * the version split cannot drift between them.
 */
const declaredEntries = (
	configDependencies: Readonly<Record<string, string>>,
): Effect.Effect<ReadonlyArray<DeclaredEntry>, CatalogAssemblyError> => {
	const entries = Object.entries(configDependencies).map(([name, spec]) => ({
		name,
		version: declaredVersionOf(spec),
		spec,
	}));
	const traversal = entries.find((entry) => hasTraversalSegment(entry.name));
	return traversal === undefined
		? Effect.succeed(entries)
		: Effect.fail(
				hooksError(traversal.name, new Error(`config dependency name has a '..' path segment: ${traversal.name}`)),
			);
};

/** Directory entries of `dir`, or `[]` when it is absent; typed on any other failure. */
const entriesOf = (path: string, dir: string): Effect.Effect<ReadonlyArray<string>, CatalogAssemblyError> =>
	ioOrNone(path, () => readdir(dir)).pipe(Effect.map(O.getOrElse((): ReadonlyArray<string> => [])));

/** The `<root>/node_modules/.pnpm-config` directory. */
const pnpmConfigDir = (root: string): string => join(root, "node_modules", ".pnpm-config");

/**
 * The store directory a realpath'd `.pnpm-config` entry lives under: the
 * parent of the ancestor directory named `links`. `None` when the resolved
 * path is not under a `links` tree (a non-store installation).
 */
const storeOfLinkedPath = (resolved: string): O.Option<string> => {
	let current = resolved;
	for (;;) {
		const parent = dirname(current);
		if (parent === current) return O.none();
		if (basename(current) === "links") return O.some(parent);
		current = parent;
	}
};

/**
 * Rung 1 of store discovery: the `storeDir` key of
 * `<root>/node_modules/.modules.yaml`. Absent in a config-only install; a
 * malformed file or a missing key contributes nothing (discovery is
 * best-effort — the final error lists what was searched); a non-absent IO
 * failure is typed.
 */
const storeFromModulesYaml = (root: string): Effect.Effect<ReadonlyArray<string>, CatalogAssemblyError> =>
	ioOrNone(root, () => readFile(join(root, "node_modules", ".modules.yaml"), "utf8")).pipe(
		Effect.map((text) => {
			if (O.isNone(text)) return [];
			const parsed = Yaml.parseResult(text.value);
			if (Result.isFailure(parsed)) return [];
			const document = parsed.success;
			return P.isObject(document) && typeof document.storeDir === "string" && document.storeDir.length > 0
				? [document.storeDir]
				: [];
		}),
	);

/**
 * Rung 2 of store discovery: the realpath of every `.pnpm-config` entry,
 * each walked up to its `links` ancestor. Scoped entries (`@scope/pkg`) are
 * one level deeper.
 */
const storesFromLinks = (root: string): Effect.Effect<ReadonlyArray<string>, CatalogAssemblyError> =>
	Effect.gen(function* () {
		const base = pnpmConfigDir(root);
		const candidates: Array<string> = [];
		for (const entry of yield* entriesOf(root, base)) {
			if (entry.startsWith("@")) {
				for (const inner of yield* entriesOf(root, join(base, entry))) candidates.push(`${entry}/${inner}`);
			} else {
				candidates.push(entry);
			}
		}
		const stores: Array<string> = [];
		for (const candidate of candidates) {
			const resolved = yield* ioOrNone(root, () => realpath(join(base, candidate)));
			if (O.isNone(resolved)) continue;
			const store = storeOfLinkedPath(resolved.value);
			if (O.isSome(store)) stores.push(store.value);
		}
		return stores;
	});

/**
 * Rung 3 of store discovery: the conventional store roots — `$PNPM_HOME/store`,
 * `$XDG_DATA_HOME/pnpm/store`, `%LOCALAPPDATA%\pnpm\store` on Windows, then
 * the platform default from `@effected/npm`'s cache table — each expanded to
 * its `v*` subdirectories (a store root holds one directory per store
 * version, `v11` today).
 */
const storesFromEnvironment = (root: string): Effect.Effect<ReadonlyArray<string>, CatalogAssemblyError> =>
	Effect.gen(function* () {
		const env = process.env;
		const platform = process.platform;
		const roots: Array<string> = [];
		if (env.PNPM_HOME !== undefined && env.PNPM_HOME !== "") roots.push(join(env.PNPM_HOME, "store"));
		if (env.XDG_DATA_HOME !== undefined && env.XDG_DATA_HOME !== "") roots.push(join(env.XDG_DATA_HOME, "pnpm", "store"));
		if (platform === "win32" && env.LOCALAPPDATA !== undefined && env.LOCALAPPDATA !== "") roots.push(join(env.LOCALAPPDATA, "pnpm", "store"));
		const home = homedir();
		roots.push(PackageManagerCache.defaultDirectory("pnpm", { platform, home }));
		// The XDG path is also searched off-platform: a pnpm installed through its
		// standalone script sets `PNPM_HOME` to `~/.local/share/pnpm` on macOS too,
		// and a shell that did not export it (CI, a login-less runner) would
		// otherwise miss a store that is really there.
		if (platform !== "win32") roots.push(join(home, ".local", "share", "pnpm", "store"));
		const stores: Array<string> = [];
		for (const storeRoot of roots) {
			// NEWEST store format first — and numerically, not lexically: a plain
			// `.sort()` orders `v10 < v11 < v9`, and since the first store holding
			// a version now answers, a pnpm upgrade that left `v10` beside `v11`
			// would otherwise replay the stale copy without a word.
			const versions = (yield* entriesOf(root, storeRoot))
				.filter((entry) => /^v\d+$/.test(entry))
				.sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)));
			for (const version of versions) stores.push(join(storeRoot, version));
		}
		return stores;
	});

/**
 * Every store directory the ladder searches, in discovery order,
 * deduplicated. IO failures during discovery are attributed to the workspace
 * root, since discovery serves every dependency of one `resolvePnpmfiles`
 * call rather than any single one.
 */
const discoverStores = (root: string): Effect.Effect<ReadonlyArray<string>, CatalogAssemblyError> =>
	Effect.gen(function* () {
		const [fromYaml, fromLinks, fromEnvironment] = yield* Effect.all([
			storeFromModulesYaml(root),
			storesFromLinks(root),
			storesFromEnvironment(root),
		]);
		// Dedupe by PHYSICAL directory, not by spelling: rung 2 already answers a
		// realpath, while `.modules.yaml` and the environment rungs answer
		// whatever spelling they were given — a symlinked home, `/var` versus
		// `/private/var` — so string equality would keep one store twice and every
		// entry in it would then read as two copies. A store that does not exist
		// is dropped here; it could never hold anything.
		const canonical: Array<string> = [];
		for (const store of [...fromYaml, ...fromLinks, ...fromEnvironment]) {
			const resolved = yield* ioOrNone(root, () => realpath(store));
			if (O.isSome(resolved) && !canonical.includes(resolved.value)) canonical.push(resolved.value);
		}
		return canonical;
	});

/**
 * The `<store>/links/<name>/<declared>/<hash>/node_modules/<name>` directories
 * whose manifest carries exactly `declared`, from the FIRST store (in
 * discovery order) that holds any — `[]` when none does.
 *
 * @remarks
 * The `<hash>` segment is pnpm's, and it is NOT derivable from the declared
 * integrity (sha256/sha512 of the integrity string, its decoded bytes, the
 * `name@version` dep path and the tarball URL were all tried and none match),
 * and the store keeps no integrity metadata beside the entry — so the
 * manifest version is the only identity this rung can check.
 *
 * Two rules follow. The decision is scoped to ONE store: discovery order
 * already encodes authority (`.modules.yaml` names the store this workspace
 * installed from, the environment rungs are guesses), so a version held by
 * several distinct stores — `store/v10` beside `store/v11`, a workspace store
 * beside the platform default — resolves from the first, exactly as the rung
 * order intends. Within that store every match is returned rather than the
 * first taken, because the CALLER must fail closed when more than one hash
 * directory carries the version: two honest copies of one version (a
 * same-version re-publish, a private mirror, a hand-populated store) cannot be
 * told apart here, and importing whichever `readdir` listed first would
 * execute code the ref's own integrity pin was written to exclude. The stores
 * are already deduplicated by realpath, so two matches here are two entries,
 * never one entry reached by two spellings.
 */
const findInStores = (
	name: string,
	declared: string,
	stores: ReadonlyArray<string>,
): Effect.Effect<{ readonly store: string; readonly matches: ReadonlyArray<string> }, CatalogAssemblyError> =>
	Effect.gen(function* () {
		for (const store of stores) {
			const versionDir = join(store, "links", name, declared);
			const matches: Array<string> = [];
			for (const hash of yield* entriesOf(name, versionDir)) {
				const dir = join(versionDir, hash, "node_modules", name);
				const version = yield* manifestVersion(name, dir);
				if (carries(version, declared)) matches.push(dir);
			}
			if (matches.length > 0) return { store, matches };
		}
		return { store: "", matches: [] };
	});

/** The fail-closed message for a version ONE store holds more than once: which store, which copies, how to disambiguate. */
const ambiguousMessage = (name: string, declared: string, store: string, matches: ReadonlyArray<string>): string =>
	`config dependency ${name}@${declared} is ambiguous: the pnpm store at ${store} holds ${matches.length} copies of that version ` +
	`(${matches.join(", ")}) and the store records no integrity to tell them apart, so none is replayed. ` +
	`Remove the stale copies, or install ${name}@${declared} in this workspace so node_modules/.pnpm-config answers instead.`;

/**
 * The fail-closed message: what was declared, by which side, what is
 * installed, where we looked, why that happens, and how to fix it. `fetch`
 * is the fetch rung's failure when one ran.
 */
const notInstalledMessage = (
	name: string,
	declared: string,
	installed: ManifestVersion,
	stores: ReadonlyArray<string>,
	side: HookReplayContext,
	fetch: O.Option<FetchFailure>,
): string => {
	const holds =
		installed._tag === "absent"
			? "nothing"
			: installed._tag === "unversioned"
				? "a package with no version"
				: `version ${installed.version}`;
	const searched = stores.length === 0 ? "no pnpm store directory could be located" : `searched ${stores.join(", ")}`;
	const by = side.ref === undefined ? "" : ` (declared at ${sideLabel(side)})`;
	const found =
		`config dependency ${name}@${declared}${by} is not installed: node_modules/.pnpm-config/${name} holds ${holds}, ` +
		`and no store copy of ${name}@${declared} was found (${searched}).`;
	// The case: the replayed side pins a DIFFERENT version from the
	// installed one, which is what the base side of a diff across a
	// config-dependency bump always does on a fresh checkout.
	const why =
		installed._tag === "version" && installed.version !== declared
			? "This side declares a different version from the installed one, as the base side of a diff across a " +
				"config-dependency bump does: that version was never installed in this checkout."
			: "";
	const tried = O.match(fetch, {
		onNone: () =>
			"This replay layer does not fetch; ConfigDependencyHooks.layerSubprocess, which the *Subprocess Workspaces " +
			"composites use, fetches the declared version, verified, into the store.",
		onSome: (failure) =>
			failure.reason === "fetchFailed" ? `Fetching it into the store failed: ${failure.message}` : failure.message,
	});
	// Two recorded integrities that disagree are the one case where populating
	// the store by hand is the wrong advice: the fetch message says to
	// reconcile the pins instead.
	const remedy = O.exists(fetch, (failure) => failure.reason === "integrityMismatch")
		? ""
		: `Run \`pnpm add --config ${name}@${declared}\` in a throwaway workspace to populate the store, then retry.`;
	return [found, why, tried, remedy].filter((sentence) => sentence !== "").join(" ");
};

/**
 * The first pnpmfile candidate present in `dir`, from ONE directory listing.
 * `None` when the dependency ships none. Presence is settled by the listing
 * alone: a listed-but-unreadable file (`EACCES`, say) is returned and fails
 * typed at `import()` time — it never reads as "this dependency ships no
 * hook".
 */
const pnpmfileIn = (name: string, dir: string): Effect.Effect<O.Option<string>, CatalogAssemblyError> =>
	entriesOf(name, dir).pipe(
		Effect.map((entries) =>
			O.map(
				Arr.findFirst(PNPMFILE_CANDIDATES, (candidate) => entries.includes(candidate)),
				(filename) => join(dir, filename),
			),
		),
	);

/**
 * Resolve one declared config dependency to the directory holding its
 * declared version: `.pnpm-config` when it holds exactly that version, else
 * the store, else the fetch rung when one is wired, else a typed fail-closed
 * error. `stores` is the memoized discovery, run at most once per
 * {@link resolvePnpmfiles} call and only on the first `.pnpm-config` miss;
 * `locks` is the declaring side's memoized lockfile decode, run at most once
 * per call and only by the fetch rung.
 *
 * @remarks
 * A fetch failure is folded into the not-installed message, so the error
 * still says what was declared, what is installed and where the ladder
 * looked, and it keeps the fetch rung's own `reason` (`integrityMismatch`,
 * `integrityUnavailable`, `fetchFailed`). The `pnpm add --config`
 * remediation is kept except for `integrityMismatch`, where the pins must be
 * reconciled first.
 */
const resolveDirectory = (
	root: string,
	entry: DeclaredEntry,
	stores: Effect.Effect<ReadonlyArray<string>, CatalogAssemblyError>,
	locks: RecordedLocks,
	options: ResolveOptions,
): Effect.Effect<{ readonly dir: string; readonly source: HookReplaySource }, CatalogAssemblyError> =>
	Effect.gen(function* () {
		const { name, version: declared } = entry;
		const side = options.side ?? {};
		const installedDir = join(pnpmConfigDir(root), name);
		const installed = yield* manifestVersion(name, installedDir);
		if (carries(installed, declared)) return { dir: installedDir, source: "installed" };
		const searched = yield* stores;
		const { store, matches } = yield* findInStores(name, declared, searched);
		const [only, ...rest] = matches;
		if (only !== undefined && rest.length === 0) return { dir: only, source: "store" };
		// Two or more copies of one version in ONE store: nothing here can say
		// which one the ref's integrity pinned, so replaying either would be a
		// guess about which code to execute. Fail closed and say why.
		if (only !== undefined)
			return yield* hooksError(name, new Error(ambiguousMessage(name, declared, store, matches)), "ambiguous");
		const notInstalled = (fetch: O.Option<FetchFailure>) => {
			const message = notInstalledMessage(name, declared, installed, searched, side, fetch);
			const cause = O.getOrUndefined(fetch)?.cause;
			return hooksError(
				name,
				cause === undefined ? new Error(message) : new Error(message, { cause }),
				O.match(fetch, { onNone: () => "notInstalled" as const, onSome: (failure) => failure.reason }),
			);
		};
		if (options.fetch === undefined) return yield* notInstalled(O.none());
		const fetched = yield* options
			.fetch({ root, name, version: declared, spec: entry.spec, stores: searched, side, locks })
			.pipe(Effect.mapError((failure) => notInstalled(O.some(failure))));
		return { dir: fetched, source: "fetched" };
	});

/**
 * A lazy memo of `effect`, scoped to one {@link resolvePnpmfiles} call: the
 * house success-only memo (never `Effect.cached`, which would pin an
 * interrupt), so a failed or interrupted run is retried by the next user.
 */
const memoizeSuccess = <A, E>(effect: Effect.Effect<A, E>): Effect.Effect<Effect.Effect<A, E>> =>
	Effect.map(Effect.cachedInvalidateWithTTL(effect, Duration.infinity), ([once, invalidate]) =>
		Effect.onExit(once, (exit) => (Exit.isSuccess(exit) ? Effect.void : invalidate)),
	);

/** What a {@link resolvePnpmfiles} call may use beyond the declared map. */
export interface ResolveOptions {
	/** What the declaring side recorded: its lockfile (integrity for a bare spec) and its ref (for messages). */
	readonly side?: HookReplayContext | undefined;
	/** The fetch rung. Absent, a version found nowhere fails typed with `reason: "notInstalled"`. */
	readonly fetch?: FetchConfigDependency | undefined;
}

/**
 * Resolve every declared config dependency at its declared version, in
 * declaration order. A dependency that ships no pnpmfile is still returned
 * (resolved, `path` undefined — the one legitimate skip at replay time); a
 * `..` segment in a name, an unresolvable declared version, or any
 * non-absent IO failure fails typed as a `hooks`-source
 * `CatalogAssemblyError`. `options.fetch`, when wired, is tried for a version
 * found nowhere before that fails.
 */
export const resolvePnpmfiles: {
	(configDependencies: Readonly<Record<string, string>>, options?: ResolveOptions): (root: string) => Effect.Effect<ReadonlyArray<ResolvedPnpmfile>, CatalogAssemblyError>;
	(root: string, configDependencies: Readonly<Record<string, string>>, options?: ResolveOptions): Effect.Effect<ReadonlyArray<ResolvedPnpmfile>, CatalogAssemblyError>;
} = dual((args) => typeof args[0] === "string" && args.length >= 2, (
	root: string,
	configDependencies: Readonly<Record<string, string>>,
	options: ResolveOptions = {},
): Effect.Effect<ReadonlyArray<ResolvedPnpmfile>, CatalogAssemblyError> =>
	Effect.gen(function* () {
		const entries = yield* declaredEntries(configDependencies);
		// Store discovery and the declaring side's lockfile decode are each shared
		// across the whole call and run lazily on first use (the first
		// `.pnpm-config` miss, the first fetch); concurrent users dedupe onto one
		// run.
		const stores = yield* memoizeSuccess(discoverStores(root));
		const lockfile = options.side?.lockfile;
		const locks: RecordedLocks =
			lockfile === undefined
				? Effect.as(Effect.void, undefined)
				: yield* memoizeSuccess(PnpmEnvLockfile.configDependencies(lockfile));
		return yield* Effect.forEach(
			entries,
			(entry) =>
				Effect.gen(function* () {
					const { name, version } = entry;
					const { dir, source } = yield* resolveDirectory(root, entry, stores, locks, options);
					const pnpmfile = yield* pnpmfileIn(name, dir);
					return { name, version, source, path: O.getOrUndefined(pnpmfile) } satisfies ResolvedPnpmfile;
				}),
			{ concurrency: "unbounded" },
		);
	}));

/**
 * The `layerFrom` counterpart of {@link resolvePnpmfiles}: look each declared
 * `(name, version)` up in a caller-supplied `"<name>@<version>" → path` map.
 * Same order, same `..` refusal, same fail-closed shape for a missing entry
 * — no filesystem is consulted, so it is safe under any `FileSystem` layer.
 */
export const lookupPnpmfiles: {
	(configDependencies: Readonly<Record<string, string>>): (entries: Readonly<Record<string, string>>) => Effect.Effect<ReadonlyArray<ResolvedPnpmfile>, CatalogAssemblyError>;
	(entries: Readonly<Record<string, string>>, configDependencies: Readonly<Record<string, string>>): Effect.Effect<ReadonlyArray<ResolvedPnpmfile>, CatalogAssemblyError>;
} = dual(2, (
	entries: Readonly<Record<string, string>>,
	configDependencies: Readonly<Record<string, string>>,
): Effect.Effect<ReadonlyArray<ResolvedPnpmfile>, CatalogAssemblyError> =>
	Effect.flatMap(declaredEntries(configDependencies), (declared) =>
		Effect.forEach(declared, ({ name, version }) => {
			const key = `${name}@${version}`;
			const path = entries[key];
			if (path === undefined) {
				const known = Object.keys(entries);
				return Effect.fail(
					hooksError(
						name,
						new Error(
							`config dependency ${key} has no entry in the supplied pnpmfile map (known: ${
								known.length === 0 ? "none" : known.join(", ")
							})`,
						),
					),
				);
			}
			return Effect.succeed({ name, version, source: "supplied", path } satisfies ResolvedPnpmfile);
		}),
	));
