import { dual } from "effect/Function";
// The fetch rung of the config-dependency ladder: when neither
// `node_modules/.pnpm-config` nor any discovered store holds the version a
// side DECLARES, have pnpm put exactly that version into the store, verified
// against the integrity the declaring side recorded.
//
// Only `ConfigDependencyHooks.layerSubprocess` wires this rung; every other
// replaying layer fails typed with `reason: "notInstalled"` instead. The
// subprocess goes through `@effected/commands`' `Run` over core's
// `ChildProcessSpawner`, the same seam the replay itself uses.
//
// How the fetch is verified. pnpm is run in a SCRATCH workspace whose
// `pnpm-workspace.yaml` declares the config dependency as a bare version and
// whose `pnpm-lock.yaml` env preamble records it with the expected integrity,
// under `install --frozen-lockfile`. pnpm then checks the tarball against that
// integrity itself, and refuses on a mismatch even when the store already
// holds a copy (probed on pnpm 11.27.1 and 12.6.0). The integrity is decided
// here, BEFORE the spawn, fail-closed: the inline `<version>+<integrity>` spec
// when present, the declaring side's lockfile preamble otherwise, and a typed
// failure when the two disagree or neither exists. Nothing is ever fetched
// unverified.
//
// The declaring workspace's registry config comes along. pnpm reads a
// workspace's registry and auth from `<root>/.npmrc` and its `registry` /
// `registries` keys from `<root>/pnpm-workspace.yaml`, and a scratch under
// the OS temp dir sees neither, so a config dependency resolved through a
// scoped registry, a mirror or repo-level auth would fetch from the public
// registry and fail. The rung copies `<root>/.npmrc` into the scratch as-is
// (never read, never logged; `${VAR}` references stay verbatim for pnpm to
// expand) and carries those two yaml keys into the scratch
// `pnpm-workspace.yaml` (probed on pnpm 11.27.1 and 12.6.0: both keys are
// read from the workspace yaml; `npmrcAuthFile` is ignored there and auth
// lives only in `.npmrc`). `root` is the CURRENT workspace root for both
// sides of a diff: the base ref's `.npmrc` is not read through git, since
// registry config describes where this checkout fetches from, not what a ref
// declared.
//
// Runtime-coupled by design, like the rest of the ladder: the scratch
// workspace and the store are real directories even when a caller's
// `FileSystem` is virtual, so this reads and writes through `node:fs`.

import { tmpdir } from "node:os";
import { Run } from "../../commands/index.ts";
import type { ConfigDependencyLock, LockfileFramingError, LockfileParseError } from "../../lockfiles/index.ts";
import { IntegrityHash } from "../../npm/index.ts";
import { Yaml } from "../../yaml/index.ts";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import type { HookReplayContext } from "../ConfigDependencyHooks.ts";
import { carries, manifestVersion, messageOf, sideLabel } from "./configDependencyShared.ts";
import { splitConfigDependencySpec } from "./configDependencySpecGrammar.ts";
import * as R from "effect/Record";

// The caller's Effect FileSystem may be virtual; fetching must use the real scratch workspace and store.
const { copyFile, mkdtemp, readFile, realpath, rm, writeFile } = process.getBuiltinModule("node:fs/promises");
const { basename, dirname, join } = process.getBuiltinModule("node:path");

/**
 * The config dependencies the declaring side's `pnpm-lock.yaml` env preamble
 * records, decoded at most once per replay and shared by every fetch in it:
 * `undefined` when that side has no lockfile.
 */
export type RecordedLocks = Effect.Effect<
	ReadonlyMap<string, ConfigDependencyLock> | undefined,
	LockfileParseError | LockfileFramingError
>;

/** One config dependency the ladder could not find, handed to the fetch rung. */
export interface FetchRequest {
	/**
	 * The current workspace root, whose `.npmrc` and registry keys the scratch
	 * workspace inherits — for both sides of a diff.
	 */
	readonly root: string;
	/** The config dependency's name, already `..`-checked. */
	readonly name: string;
	/** The declared version. */
	readonly version: string;
	/** The declared spec verbatim, `<version>` or the legacy `<version>+<integrity>`. */
	readonly spec: string;
	/** The stores the ladder searched, in discovery order; the first is where the fetch writes. */
	readonly stores: ReadonlyArray<string>;
	/** What the declaring side recorded. */
	readonly side: HookReplayContext;
	/** The declaring side's recorded config-dependency locks, decoded lazily and once per replay. */
	readonly locks: RecordedLocks;
}

/** Why the fetch rung failed: the public `CatalogAssemblyError` reasons it can report. */
export type FetchFailureReason = "fetchFailed" | "integrityMismatch" | "integrityUnavailable";

/**
 * The fetch rung's internal failure record. The ladder, not the rung, builds
 * the one public `CatalogAssemblyError` from it, folding `message` into the
 * not-installed diagnosis and keeping `cause` on the chain.
 */
export interface FetchFailure {
	readonly reason: FetchFailureReason;
	/** The complete sentence(s) the ladder splices into its message. */
	readonly message: string;
	/** The underlying failure, when there is one. */
	readonly cause?: unknown;
}

const fetchFailure = (reason: FetchFailureReason, message: string, cause?: unknown): FetchFailure =>
	cause === undefined ? { reason, message } : { reason, message, cause };

/**
 * The fetch rung: put `<name>@<version>` into the store, verified, and answer
 * the store directory pnpm linked. Fails with a {@link FetchFailure} and never
 * returns an unverified copy.
 */
export type FetchConfigDependency = (request: FetchRequest) => Effect.Effect<string, FetchFailure>;

/**
 * The ceiling on one fetch. It downloads one small tarball; two minutes covers
 * a slow registry without letting a hung pnpm stall catalog assembly forever.
 */
const FETCH_TIMEOUT = Duration.minutes(2);

/**
 * The integrity the fetched copy must match, decided before anything is
 * spawned: the inline spec integrity (legacy) and the declaring side's
 * lockfile preamble entry for exactly `<name>@<version>`. Both present and
 * different, neither present, an inline integrity that is not SRI, or a
 * lockfile that cannot be read all fail typed. A lockfile that records the
 * name at a different version is not a source for this version.
 *
 * @remarks
 * An unreadable lockfile fails closed even when the spec carries an inline
 * integrity: the lockfile is the declaring side's own checksum store, and a
 * store that cannot be read cannot be confirmed to agree with the inline pin.
 */
export const expectedIntegrity = (
	request: Pick<FetchRequest, "name" | "version" | "spec" | "side" | "locks">,
): Effect.Effect<string, FetchFailure> =>
	Effect.gen(function* () {
		const { name, version, side } = request;
		const key = `${name}@${version}`;
		const inline = splitConfigDependencySpec(request.spec).integrity;
		if (inline !== undefined && !IntegrityHash.isSri(inline)) {
			return yield* Effect.fail(
				fetchFailure(
					"integrityUnavailable",
					`config dependency ${key} declared by ${sideLabel(side)} carries an inline integrity that is not an SRI hash, ` +
						"so a fetched copy cannot be verified and nothing was fetched.",
				),
			);
		}
		const locks = yield* request.locks.pipe(
			Effect.mapError((cause) =>
				fetchFailure(
					"integrityUnavailable",
					`config dependency ${key} must be fetched, but the pnpm-lock.yaml of ${sideLabel(side)} cannot be read ` +
						`(${messageOf(cause)}), so its recorded integrity cannot be checked and nothing was fetched.`,
					cause,
				),
			),
		);
		const lock = locks?.get(name);
		const locked = lock !== undefined && lock.version === version ? lock.integrity : undefined;
		if (inline !== undefined && locked !== undefined && inline !== locked) {
			return yield* Effect.fail(
				fetchFailure(
					"integrityMismatch",
					`config dependency ${key} declared by ${sideLabel(side)} has two different recorded integrities: ` +
						`pnpm-workspace.yaml pins ${inline} and pnpm-lock.yaml records ${locked}. Nothing was fetched; ` +
						"reconcile the two (a fresh `pnpm install` rewrites the lockfile) before retrying.",
				),
			);
		}
		const integrity = inline ?? locked;
		if (integrity === undefined) {
			return yield* Effect.fail(
				fetchFailure(
					"integrityUnavailable",
					`config dependency ${key} must be fetched, but ${sideLabel(side)} records no integrity for it ` +
						"(no inline integrity in pnpm-workspace.yaml and no pnpm-lock.yaml entry for that version), " +
						"so a fetched copy could not be verified and nothing was fetched.",
				),
			);
		}
		return integrity;
	});

/**
 * The registry settings pnpm reads from a `pnpm-workspace.yaml`: the default
 * `registry` and the per-scope `registries` map. Anything that is not a string
 * is dropped, as pnpm would not use it.
 */
export interface RegistrySettings {
	readonly registry?: string;
	readonly registries: Readonly<Record<string, string>>;
}

/** The {@link RegistrySettings} of a parsed `pnpm-workspace.yaml` document. */
export const registrySettingsOf = (document: unknown): RegistrySettings => {
	if (!P.isObject(document)) return { registries: {} };
	const registries: Record<string, string> = {};
	if (P.isObject(document.registries)) {
		for (const [scope, url] of R.toEntries(document.registries)) {
			if (P.isString(url)) registries[scope] = url;
		}
	}
	return P.isString(document.registry) ? { registry: document.registry, registries } : { registries };
};

/**
 * The scratch workspace's `pnpm-workspace.yaml`: the one config dependency,
 * plus the declaring workspace's registry settings. Every key and scalar is a
 * JSON-quoted string, which YAML reads verbatim, so no declared text can
 * change the document's structure.
 */
export const scratchWorkspaceYaml: {
	(version: string, settings?: RegistrySettings): (name: string) => string;
	(name: string, version: string, settings?: RegistrySettings): string;
} = dual((args) => P.isString(args[1]), (
	name: string,
	version: string,
	settings: RegistrySettings = { registries: {} },
): string => {
	const lines = ["configDependencies:", `  ${JSON.stringify(name)}: ${JSON.stringify(version)}`];
	if (settings.registry !== undefined) lines.push(`registry: ${JSON.stringify(settings.registry)}`);
	const scopes = R.toEntries(settings.registries);
	if (scopes.length > 0) {
		lines.push("registries:");
		for (const [scope, url] of scopes) lines.push(`  ${JSON.stringify(scope)}: ${JSON.stringify(url)}`);
	}
	return `${lines.join("\n")}\n`;
});

/** Whether `error` is a node filesystem "no such file" failure. */
const isNotFound = (error: unknown): boolean => P.isObject(error) && error.code === "ENOENT";

/**
 * The scratch workspace's `pnpm-lock.yaml`: the env preamble pnpm 11 and 12
 * write for a lone config dependency, pinned to `integrity`, followed by the
 * empty lockfile document they write when there are no projects.
 */
const scratchLockfile = (name: string, version: string, integrity: string): string => {
	const key = JSON.stringify(`${name}@${version}`);
	return [
		"---",
		"lockfileVersion: '9.0'",
		"",
		"importers:",
		"",
		"  .:",
		"    configDependencies:",
		`      ${JSON.stringify(name)}:`,
		`        specifier: ${JSON.stringify(version)}`,
		`        version: ${JSON.stringify(version)}`,
		"",
		"packages:",
		"",
		`  ${key}:`,
		`    resolution: {integrity: ${JSON.stringify(integrity)}}`,
		"",
		"snapshots:",
		"",
		`  ${key}: {}`,
		"",
		"---",
		"",
	].join("\n");
};

/**
 * The `--store-dir` to hand pnpm so it writes into the store the ladder
 * searched first. Discovered stores are the versioned directories
 * (`<root>/v11`), and pnpm appends that segment itself, so a versioned
 * directory is passed as its parent. `undefined` (pnpm's own default) when no
 * store was discovered.
 */
export const storeDirArgument = (stores: ReadonlyArray<string>): string | undefined => {
	const first = stores[0];
	if (first === undefined) return undefined;
	return /^v\d+$/.test(basename(first)) ? dirname(first) : first;
};

/** The pnpm argv for the verified fetch. */
export const fetchArgs: {
	(stores: ReadonlyArray<string>): (scratch: string) => ReadonlyArray<string>;
	(scratch: string, stores: ReadonlyArray<string>): ReadonlyArray<string>;
} = dual(2, (scratch: string, stores: ReadonlyArray<string>): ReadonlyArray<string> => {
	const storeDir = storeDirArgument(stores);
	return [
		"install",
		"--frozen-lockfile",
		"--dir",
		scratch,
		...(storeDir === undefined ? [] : ["--store-dir", storeDir]),
	];
});

/** Whether `resolved` sits under a store's `links/<name>/<version>/` tree. */
const isStoreEntry = (resolved: string, name: string, version: string): boolean =>
	resolved.split(/[/\\]/).join("/").includes(`/links/${name}/${version}/`);

/**
 * Build the fetch rung over a spawner. Wired only by
 * `ConfigDependencyHooks.layerSubprocess`.
 */
export const makeFetchConfigDependency =
	(spawner: ChildProcessSpawner.ChildProcessSpawner["Service"]): FetchConfigDependency =>
	(request) =>
		Effect.scoped(
			Effect.gen(function* () {
				const { name, version } = request;
				const key = `${name}@${version}`;
				const failed = (message: string, cause?: unknown) => fetchFailure("fetchFailed", message, cause);
				const io = <A>(what: string, run: () => Promise<A>) =>
					Effect.tryPromise({ try: run, catch: (cause) => failed(`${what} failed: ${messageOf(cause)}`, cause) });

				const integrity = yield* expectedIntegrity(request);
				// The declaring workspace's registry keys, read before anything is
				// spawned. An absent yaml carries none; an unparseable one fails,
				// since fetching past it could reach a registry the workspace
				// never configured.
				const rootYaml = yield* io("reading the workspace pnpm-workspace.yaml", () =>
					readFile(join(request.root, "pnpm-workspace.yaml"), "utf8").catch((error: unknown) => {
						if (isNotFound(error)) return undefined;
						throw error;
					}),
				);
				const settings =
					rootYaml === undefined
						? registrySettingsOf(undefined)
						: registrySettingsOf(
								yield* Yaml.parse(rootYaml).pipe(
									Effect.mapError((cause) =>
										failed(`reading the workspace pnpm-workspace.yaml failed: ${messageOf(cause)}`, cause),
									),
								),
							);
				const scratch = yield* Effect.acquireRelease(
					io("creating a scratch workspace", () => mkdtemp(join(tmpdir(), "effected-config-dependency-"))),
					(dir) => Effect.promise(() => rm(dir, { recursive: true, force: true }).catch(() => undefined)),
				);
				const lockfile = scratchLockfile(name, version, integrity);
				yield* io("writing the scratch workspace", () =>
					writeFile(join(scratch, "pnpm-workspace.yaml"), scratchWorkspaceYaml(name, version, settings))
						.then(() => writeFile(join(scratch, "pnpm-lock.yaml"), lockfile))
						.then(() =>
					// Copied as-is, never read: it may carry auth. The scratch's release
					// removes it with the rest of the directory.
					copyFile(join(request.root, ".npmrc"), join(scratch, ".npmrc")).catch((error: unknown) => {
						if (!isNotFound(error)) throw error;
					}),
						),
				);

				const command = ChildProcess.make("pnpm", fetchArgs(scratch, request.stores), { cwd: scratch });
				yield* Run.text(command, { timeout: FETCH_TIMEOUT }).pipe(
					Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
					Effect.mapError((cause) =>
						failed(
							`fetching ${key} with \`pnpm ${fetchArgs("<scratch>", request.stores).join(" ")}\` failed: ${messageOf(cause)}`,
							cause,
						),
					),
				);

				// `--frozen-lockfile` forbids pnpm from rewriting the pin. A pnpm that
				// did anyway (one that does not read the env preamble, say) installed
				// something the pin never verified, so its result is not used.
				const after = yield* io("reading back the scratch lockfile", () =>
					readFile(join(scratch, "pnpm-lock.yaml"), "utf8"),
				);
				if (after !== lockfile) {
					return yield* Effect.fail(
						failed(
							`fetching ${key}: pnpm rewrote the integrity-pinned scratch lockfile instead of installing from it, ` +
								"so the installed copy was not verified against the recorded integrity and is not used.",
						),
					);
				}

				// The copy pnpm linked is the one it verified: resolve the scratch
				// workspace's `.pnpm-config` entry to its store directory.
				const linked = join(scratch, "node_modules", ".pnpm-config", name);
				const resolved = yield* io(`resolving ${linked}`, () => realpath(linked));
				const manifest = yield* manifestVersion(name, resolved).pipe(
					Effect.mapError((error) =>
						failed(`the fetched ${key} has an unreadable package.json: ${messageOf(error.cause)}`, error.cause),
					),
				);
				if (!carries(manifest, version) || !isStoreEntry(resolved, name, version)) {
					return yield* Effect.fail(
						failed(
							`fetching ${key}: pnpm linked ${resolved}, which is not a store copy of that version ` +
								`(its manifest reads ${manifest._tag === "version" ? manifest.version : "no version"}).`,
						),
					);
				}
				return resolved;
			}),
		);
