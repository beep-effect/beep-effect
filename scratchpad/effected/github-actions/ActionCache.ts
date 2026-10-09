import { $ScratchpadId } from "@beep/identity/packages";
import { BlobClient, BlockBlobClient } from "@azure/storage-blob";
import { GlobPattern, GlobSet } from "../glob/index.ts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { HttpClient } from "effect/http";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { ActionEnvironment } from "./ActionEnvironment.ts";
import type { FileBlobTransfer } from "./BlobTransfer.ts";
import { BlobTransferError } from "./BlobTransfer.ts";
import type { CacheKey } from "./CacheKey.ts";
import { misconfiguredDetail, resultsBackend } from "./internal/actionsResults.ts";
import type { CacheServiceClient } from "./internal/cacheService.ts";
import { CACHE_SERVICE, finalizeUpload, lookupDownload, reserveUpload } from "./internal/cacheService.ts";
import { sha256Hex } from "./internal/digest.ts";
import { isWindowsRunner } from "./internal/runner.ts";
import { spawnOnce } from "./internal/spawn.ts";
import { twirpCall, twirpFailureFields } from "./internal/twirp.ts";
import { unstubbed } from "./internal/unstubbed.ts";

const $I = $ScratchpadId.create("effected/github-actions/ActionCache");

/**
 * Raised when the runner's cache cannot be read or written.
 *
 * @public
 */
export class ActionCacheError extends S.TaggedError<ActionCacheError>($I`ActionCacheError`)("ActionCacheError", {
	/**
	 * `misconfigured` — the results backend is not reachable from here (see
	 * {@link ActionCache}). `unreachable` — it could not be contacted, or
	 * answered with something that is not a Twirp body. `refused` — it answered,
	 * unhappily. `archiveFailed` — `tar` would not pack or unpack the paths.
	 * `transferFailed` — the archive itself did not move.
	 */
	reason: S.Literals(["misconfigured", "unreachable", "refused", "archiveFailed", "transferFailed"]).annotateKey({ description: "`misconfigured` — the results backend is not reachable from here (see ActionCache). `unreachable` — it could not be contacted, or answered with something that is not a Twirp body. `refused` — it answered, unhappily. `archiveFailed` — `tar` would not pack or unpack the paths. `transferFailed` — the archive itself did not move." }),
	/** The cache key involved. A stable identifier, never a value. */
	key: S.optionalKey(S.String).annotateKey({ description: "The cache key involved. A stable identifier, never a value." }),
	/** The HTTP status, when the backend answered. */
	status: S.optionalKey(S.Finite).annotateKey({ description: "The HTTP status, when the backend answered." }),
	/** What went wrong, when the reason alone does not say. */
	detail: S.optionalKey(S.String).annotateKey({ description: "What went wrong, when the reason alone does not say." }),
	/** `tar`'s own complaint, which is the only useful part of an archive failure. */
	stderr: S.optionalKey(S.String).annotateKey({ description: "`tar`'s own complaint, which is the only useful part of an archive failure." }),
	/** The underlying failure, preserved structurally. */
	cause: S.optionalKey(S.Defect()).annotateKey({ description: "The underlying failure, preserved structurally." }),
}, $I.annote("ActionCacheError", { description: "Raised when the runner's cache cannot be read or written." })) {
	override get message(): string {
		const about = this.key === undefined ? "" : ` for "${this.key}"`;
		const detail = this.detail === undefined ? "" : `: ${this.detail}`;
		switch (this.reason) {
			case "misconfigured":
				return `The Actions cache is not reachable from here${detail}`;
			case "unreachable":
				return `The Actions cache could not be reached${about}${detail}`;
			case "refused":
				return `The Actions cache refused the request${about}${this.status === undefined ? "" : ` with status ${this.status}`}${detail}`;
			case "archiveFailed":
				return `The cache archive could not be built or extracted${about}${this.stderr === undefined ? "" : `: ${this.stderr}`}`;
			default:
				return `The cache archive did not transfer${about}`;
		}
	}
}

/**
 * The members of the {@link ActionCache} service: `save` a set of paths under a
 * key and `restore` them in a later job.
 *
 * @public
 */
export interface ActionCacheShape {
	/**
	 * Archive the files and directories matching `paths` and store them under
	 * `key`.
	 *
	 * @remarks
	 * `paths` is a list of glob **patterns**, resolved with `actions/cache`
	 * parity before `tar` ever sees them: a pattern may match directories (a
	 * matched directory is archived recursively, never expanded into its
	 * descendants), a pattern that matches nothing — including a literal path
	 * that is not on disk — is silently dropped, and a list that resolves to
	 * nothing at all fails typed rather than reserving an entry no archive will
	 * ever back. A leading `~` expands to the caller's home directory, relative
	 * patterns root at `GITHUB_WORKSPACE` (falling back to the working
	 * directory), and a leading `!` marks an exclusion.
	 *
	 * The entry **version** is a digest of the literal pattern list, exactly as
	 * `actions/cache` computes it — resolution feeds `tar` only, never the
	 * version — so {@link ActionCacheShape.restore | restore}, which resolves
	 * nothing, derives the same version from the same list for free.
	 *
	 * One deliberate divergence from the toolkit: where `actions/cache` re-roots
	 * every match relative to the workspace, resolved paths here stay
	 * **absolute** and are archived with `tar -P`, so a restore puts every file
	 * back where it came from regardless of the restoring step's working
	 * directory.
	 *
	 * A key that already exists is a **success**: cache entries are immutable, so
	 * another job having written it first is the outcome the caller wanted.
	 */
	readonly save: (paths: ReadonlyArray<string>, key: string | CacheKey) => Effect.Effect<void, ActionCacheError>;
	/**
	 * Restore `paths` from the first entry that matches, and answer with the key
	 * that matched.
	 *
	 * @remarks
	 * `Option.none()` is a miss, not a failure — a cold cache is the normal state
	 * of a new branch. Passing a {@link CacheKey} supplies its restore-key ladder
	 * automatically; passing a `string` and no ladder means "this key or nothing".
	 *
	 * `paths` only derives the entry version and MUST be the same literal list
	 * the save used — no glob resolution happens here, because none is needed:
	 * extraction consumes no path list (the archive already names its contents),
	 * and `actions/cache` likewise hashes the un-resolved list on both sides.
	 */
	readonly restore: (
		paths: ReadonlyArray<string>,
		key: string | CacheKey,
		restoreKeys?: ReadonlyArray<string>,
	) => Effect.Effect<O.Option<string>, ActionCacheError>;
}

/**
 * The entry version, byte-compatible with `actions/cache`.
 *
 * @remarks
 * A cache entry is keyed on `(key, version)`, and the version is a digest of
 * the archived paths plus the compression method. **The paths are not sorted**,
 * because upstream does not sort them: sorting here would compute a version no
 * other cache step in the workflow agrees with, and the entry a sibling step
 * wrote would simply never be found.
 *
 * **The digest covers the LITERAL pattern list, never the resolved paths.**
 * That is upstream's choice, not ours: `getCacheVersion` hashes the caller's
 * `paths` argument verbatim (`actions/toolkit`, `cache/src/internal/`
 * `cacheUtils.ts:136-159`), and both `saveCacheV2` (`cache/src/cache.ts:689`)
 * and `restoreCacheV2` (`cache.ts:361`) hand it the un-resolved list — restore
 * never resolves at all. Hashing the resolved list here would compute a
 * version the restore side cannot reproduce, and every save would be an entry
 * no restore ever finds.
 */
const versionOf = (paths: ReadonlyArray<string>): string => sha256Hex([...paths, "gzip", "1.0"].join("|"));

/**
 * The Azure half, duplicated on purpose.
 *
 * @remarks
 * `@azure/storage-blob` may be imported here, by `Artifact` and by
 * `BlobStore.githubCache`, and nowhere else — hoisting these two calls into a
 * shared `internal/` helper is exactly how a heavy import leaks into the graph
 * of a module that only sets an output. `__test__/reachability.test.ts`
 * measures that these are the only three.
 */
const azure: FileBlobTransfer = {
	uploadFile: (url, file) =>
		Effect.tryPromise({
			try: () =>
				new BlockBlobClient(url).uploadFile(file, {
					// The block size and concurrency `actions/cache` itself uses: a
					// multi-gigabyte toolchain cache is the normal case, not the
					// exceptional one.
					blockSize: 64 * 1024 * 1024,
					concurrency: 8,
					maxSingleShotSize: 128 * 1024 * 1024,
				}),
			catch: (cause) => BlobTransferError.make({ reason: "uploadFailed", cause }),
		}).pipe(Effect.asVoid),
	downloadToFile: (url, file) =>
		Effect.tryPromise({
			try: () => new BlobClient(url).downloadToFile(file),
			catch: (cause) => BlobTransferError.make({ reason: "downloadFailed", cause }),
		}).pipe(Effect.asVoid),
};

/** The primary key and the ladder to fall back through. */
const ladder = (key: string | CacheKey, restoreKeys: ReadonlyArray<string> | undefined) =>
	typeof key === "string"
		? { primary: key, fallbacks: restoreKeys ?? [] }
		: { primary: key.key, fallbacks: restoreKeys ?? key.restoreKeys };

const make = (
	transfer: FileBlobTransfer,
): Effect.Effect<
	ActionCacheShape,
	never,
	| ActionEnvironment
	| HttpClient.HttpClient
	| FileSystem.FileSystem
	| Path.Path
	| ChildProcessSpawner.ChildProcessSpawner
> =>
	Effect.gen(function* () {
		const http = yield* HttpClient.HttpClient;
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
		// Resolved once, at construction, so every member's `R` is `never`.
		const env = yield* ActionEnvironment;
		const windows = yield* isWindowsRunner(env);

		/** A filesystem or subprocess failure on the way to or from the archive. */
		const archiveFailed = (key: string) => (cause: unknown) =>
			ActionCacheError.make({ reason: "archiveFailed", key, cause });

		const backend = resultsBackend(env).pipe(
			Effect.mapError(
				(name) => ActionCacheError.make({ reason: "misconfigured", detail: misconfiguredDetail(name, "Actions cache") }),
			),
		);

		/** The cache service, for one key: every failure names it. */
		const cacheService = (key: string): CacheServiceClient<ActionCacheError> => ({
			call: Effect.fn("call")(function*(method, body) {
					const { baseUrl, token } = yield* backend;
					return yield* twirpCall({ http, baseUrl, service: CACHE_SERVICE, token, method, body }).pipe(
						Effect.mapError((failure) => ActionCacheError.make({ ...twirpFailureFields(failure), key })),
					);
				}),
			refused: (detail) => ActionCacheError.make({ reason: "refused", key, detail }),
		});

		/**
		 * Run `tar` ONCE, keeping its stderr.
		 *
		 * @remarks
		 * On Windows, extraction runs with `-k` so a file another process holds
		 * open is skipped rather than failing the whole restore — and `tar` then
		 * exits 1 to say so, which is a warning rather than an error. Exit 2 and
		 * above stays a failure on every platform.
		 *
		 * Output and exit code come from the SAME `spawn` handle
		 * (`internal/spawn.ts` — the spawner's convenience members each spawn
		 * independently, so reading both from them would run `tar` twice).
		 */
		const tar = Effect.fn("tar")(function*(args: ReadonlyArray<string>, key: string, tolerateWarnings: boolean) {
				const { output, code } = yield* spawnOnce(spawner, ChildProcess.make("tar", [...args])).pipe(
					Effect.mapError(archiveFailed(key)),
				);
				if (code !== 0 && !(tolerateWarnings && code === 1)) {
					return yield* ActionCacheError.make({ reason: "archiveFailed", key, stderr: output.trim() });
				}
			});

		/**
		 * A scratch archive path — plus the scratch directory itself, where the
		 * save side writes its tar manifest — removed on every exit path.
		 */
		const withArchive = <A>(
			key: string,
			use: (archive: string, scratch: string) => Effect.Effect<A, ActionCacheError>,
		): Effect.Effect<A, ActionCacheError> =>
			Effect.acquireUseRelease(
				fs.makeTempDirectory({ prefix: "effected-cache-" }).pipe(Effect.mapError(archiveFailed(key))),
				(directory) => use(path.join(directory, "cache.tar.gz"), directory),
				(directory) => Effect.ignore(fs.remove(directory, { recursive: true, force: true })),
			);

		const moved = (key: string) =>
			Effect.mapError((cause: BlobTransferError) => ActionCacheError.make({ reason: "transferFailed", key, cause }));

		/** Platform separators to the dialect's — applied to paths WE produce, never to the caller's pattern text, where a backslash is minimatch's escape character. */
		const posix = (value: string): string => value.replaceAll("\\", "/");

		/**
		 * Resolve the caller's patterns to the concrete files and directories
		 * `tar` will archive, with `actions/cache` parity.
		 *
		 * @remarks
		 * The toolkit resolves through `@actions/glob` with `implicitDescendants`
		 * disabled (`cacheUtils.ts:48-70`): a matched directory is answered as
		 * itself and `tar` recurses into it, a pattern that matches nothing —
		 * including a literal path that is not on disk — contributes nothing
		 * (`internal-globber.ts:90-100` existence-filters every search path), a
		 * leading `~` expands to the home directory with the expansion
		 * glob-escaped (`internal-pattern.ts:226-234`), and blank or `#` members
		 * are skipped (the toolkit joins the list with newlines, where both are
		 * inert). A fully empty resolution is the toolkit's hard
		 * "Path Validation Error" (`cache.ts:662-666`) and a typed failure here.
		 *
		 * Two knowing departures: matches stay ABSOLUTE for the `-P` archive
		 * posture rather than being re-rooted at the workspace (the version
		 * hashes the literal list, so the wire protocol never sees the
		 * difference), and the walk does not follow directory symlinks, where
		 * the toolkit's globber does.
		 */
		const resolvePaths = (
			patterns: ReadonlyArray<string>,
			key: string,
		): Effect.Effect<ReadonlyArray<string>, ActionCacheError> =>
			Effect.gen(function* () {
				const failed = (detail: string, cause?: unknown) =>
					ActionCacheError.make({ reason: "archiveFailed", key, detail, ...(cause === undefined ? {} : { cause }) });
				const cleaned = patterns.map((pattern) => pattern.trim()).filter((p) => p !== "" && !p.startsWith("#"));
				// The toolkit roots relative patterns at the process working directory
				// and relativizes matches against GITHUB_WORKSPACE; on a runner the two
				// are the same directory, and the variable is the one a test controls.
				const workspace = O.getOrElse(yield* env.getOptional("GITHUB_WORKSPACE"), () => ".");
				const base = posix(path.resolve(workspace));

				const rooted: Array<string> = [];
				for (const pattern of cleaned) {
					const excluded = pattern.startsWith("!");
					let target = excluded ? pattern.slice(1) : pattern;
					if (target === "~" || target.startsWith("~/")) {
						let home = yield* env.getOptional("HOME");
						if (O.isNone(home)) {
							home = yield* env.getOptional("USERPROFILE");
						}
						if (O.isNone(home)) {
							return yield* failed(`cannot expand "~" in "${pattern}" — neither HOME nor USERPROFILE is set`);
						}
						target = `${GlobPattern.escape(posix(path.resolve(home.value)))}${target.slice(1)}`;
					}
					if (!path.isAbsolute(target)) {
						// The prepended root is escaped, as the toolkit escapes its
						// (`Pattern.globEscape`) — a `[` in a directory name is a path
						// here, not a character class.
						target = `${GlobPattern.escape(base)}/${target}`;
					}
					rooted.push(excluded ? `!${target}` : target);
				}

				const set = yield* GlobSet.compile(rooted).pipe(
					Effect.mapError((cause) => failed(`"${cause.pattern}" is not a usable glob pattern`, cause)),
				);

				// Search roots: the longest literal prefix of every include — the same
				// derivation as `@actions/glob`'s search paths, with descendant roots
				// folded into their ancestors so nothing is walked twice. Wildcard
				// roots are remembered apart from literal ones, because only a
				// wildcard can match BELOW a root: a root that literals alone
				// contributed is stat-and-admitted without the recursive walk (a
				// literal `~/.pnpm-store` must not cost a full store enumeration
				// that can admit nothing), while a folded-in wildcard root keeps
				// the toolkit-parity descent for the ancestor that absorbed it.
				const roots: Array<string> = [];
				const wildcardRoots: Array<string> = [];
				const addRoot = (root: string, fromWildcard: boolean) => {
					if (root === "") {
						return;
					}
					if (!roots.includes(root)) {
						roots.push(root);
					}
					if (fromWildcard && !wildcardRoots.includes(root)) {
						wildcardRoots.push(root);
					}
				};
				for (const literal of set.literals) {
					addRoot(literal, false);
				}
				for (const wildcard of set.wildcards) {
					// A whole-pattern negation only filters; it contributes no root.
					if (wildcard.negated) {
						continue;
					}
					const prefix = wildcard.enumerationPrefix;
					addRoot(prefix === "" ? base : prefix === "/" ? "/" : prefix.slice(0, -1), true);
				}
				const under = (child: string, parent: string) =>
					parent === "/" ? child !== "/" : child.startsWith(`${parent}/`);
				const searchRoots = roots.filter((root) => !roots.some((other) => other !== root && under(root, other)));
				const needsWalk = (root: string) => wildcardRoots.some((w) => w === root || under(w, root));

				const matched: Array<string> = [];
				const seen = new Set<string>();
				const admit = (candidate: string) => {
					if (!seen.has(candidate) && set.matches(candidate)) {
						seen.add(candidate);
						matched.push(candidate);
					}
				};
				for (const root of searchRoots) {
					// Existence IS the filter: a literal that is not on disk and a
					// pattern whose literal prefix directory is absent both contribute
					// nothing, exactly as the toolkit's globber skips an ENOENT search
					// path. `stat` follows symlinks, so a broken link is also nothing.
					const info = yield* fs.stat(root).pipe(Effect.option);
					if (O.isNone(info)) {
						continue;
					}
					admit(root);
					// Descend only where a wildcard can match: a literal-only root
					// admits itself (or not) at the stat above, and every deeper
					// candidate would fail `set.matches` anyway — the walk would be
					// pure cost, at pnpm-store scale a multi-second one.
					if (info.value.type === "Directory" && needsWalk(root)) {
						const entries = yield* fs
							.readDirectory(root, { recursive: true })
							.pipe(Effect.mapError((cause) => failed(`could not enumerate "${root}"`, cause)));
						for (const entry of entries) {
							admit(`${root}/${posix(entry)}`);
						}
					}
				}
				if (matched.length === 0) {
					return yield* failed(`no file or directory matched the cache paths: ${cleaned.join(", ")}`);
				}
				return matched;
			});

		return {
			save: Effect.fn("ActionCache.save")(function* (paths: ReadonlyArray<string>, key: string | CacheKey) {
				const { primary } = ladder(key, undefined);
				yield* Effect.annotateCurrentSpan({ key: primary });
				if (paths.length === 0) {
					return yield* ActionCacheError.make({ reason: "archiveFailed", key: primary, detail: "no paths were given to cache" });
				}
				// The LITERAL list, before resolution — see `versionOf` for why.
				const version = versionOf(paths);
				const resolved = yield* resolvePaths(paths, primary);
				yield* withArchive(primary, (archive, scratch) =>
					Effect.gen(function* () {
						// The resolved list reaches tar through a MANIFEST FILE, never
						// argv: resolution admits every matched descendant, so a pattern
						// like `${workspace}/**` resolves to tens of thousands of
						// absolute paths and overflows the kernel's argv limit (E2BIG)
						// before tar ever runs. Same fix as the toolkit, which writes
						// manifest.txt and passes `--files-from`
						// (`cache/src/internal/tar.ts`). The flag is spelled `-T`: GNU
						// tar (Linux runners) and bsdtar (macOS runners, and Windows'
						// system tar.exe) both document `-T` and `--files-from` as
						// synonyms — probed against bsdtar 3.5.3 with this exact
						// invocation — and the short spelling sidesteps GNU's
						// `--files-from=FILE` vs bsdtar's `--files-from FILE` split.
						// GNU tar reads a manifest line starting with `-` as an option
						// (its escape hatch, `--verbatim-files-from`, is GNU-only), but
						// resolved paths here are always absolute, so no line can.
						const manifest = path.join(scratch, "manifest.txt");
						yield* fs
							.writeFileString(manifest, `${resolved.join("\n")}\n`)
							.pipe(Effect.mapError(archiveFailed(primary)));
						// `-P` keeps leading separators, so an absolute path is stored
						// verbatim and restored where it came from rather than under the
						// working directory of whichever step happens to restore it.
						yield* tar(["czPf", archive, "-T", manifest], primary, false);
						const size = yield* fs.stat(archive).pipe(Effect.mapError(archiveFailed(primary)));

						const service = cacheService(primary);
						// None: another job saved this key first, and the cache already
						// holds what the caller wanted.
						const url = yield* reserveUpload(service, primary, version);
						if (O.isNone(url)) {
							return;
						}
						yield* transfer.uploadFile(url.value, archive).pipe(moved(primary));
						yield* finalizeUpload(service, primary, version, size.size);
					}),
				);
			}),

			restore: Effect.fn("ActionCache.restore")(function* (
				paths: ReadonlyArray<string>,
				key: string | CacheKey,
				restoreKeys?: ReadonlyArray<string>,
			) {
				const { primary, fallbacks } = ladder(key, restoreKeys);
				yield* Effect.annotateCurrentSpan({ key: primary });
				const hit = yield* lookupDownload(cacheService(primary), primary, fallbacks, versionOf(paths));
				if (O.isNone(hit)) {
					return O.none<string>();
				}
				yield* withArchive(primary, (archive) =>
					Effect.gen(function* () {
						yield* transfer.downloadToFile(hit.value.url, archive).pipe(moved(primary));
						yield* tar([windows ? "xzPkf" : "xzPf", archive], primary, windows);
					}),
				);
				// The matched key is what the caller branches on: a hit on a restore
				// key is a partial hit, and re-saving under the primary key is the
				// whole point of knowing the difference.
				return O.some(hit.value.matchedKey ?? primary);
			}),
		} satisfies ActionCacheShape;
	});

const dies = unstubbed("ActionCache.makeTest");

/**
 * The runner's own cache: archive a set of paths under a key, and get them back
 * in a later job.
 *
 * @remarks
 * Speaks the Actions cache **Twirp v2** protocol at `ACTIONS_RESULTS_URL`,
 * which answers with a pre-signed Azure blob url for the archive itself. No
 * `@actions/cache` dependency — that package alone brings a dependency tree
 * larger than this one.
 *
 * **Only reachable from a `uses:` step.** The runner injects
 * `ACTIONS_RESULTS_URL` and `ACTIONS_RUNTIME_TOKEN` into action execution
 * contexts and not into `run:` shell steps, so the identical code fails as
 * `misconfigured` when a workflow invokes it with `node ./main.js`. The failure
 * names the absent variable, because nothing else distinguishes the two cases.
 *
 * @example
 * ```ts
 * import { ActionCache, CacheKey } from "./index.ts";
 * import { Effect, Option } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const cache = yield* ActionCache;
 *   const key = CacheKey.of("Linux", "pnpm-store", "abc123");
 *   const hit = yield* cache.restore(["~/.pnpm-store"], key);
 *   if (Option.isNone(hit)) {
 *     yield* cache.save(["~/.pnpm-store"], key);
 *   }
 * });
 * ```
 *
 * @public
 */
export class ActionCache extends Context.Service<ActionCache, ActionCacheShape>()(
	$I`ActionCache`,
) {
	/** The cache, over the real Azure client and the real `tar`. */
	static readonly layer: Layer.Layer<
		ActionCache,
		never,
		| ActionEnvironment
		| HttpClient.HttpClient
		| FileSystem.FileSystem
		| Path.Path
		| ChildProcessSpawner.ChildProcessSpawner
	> = Layer.effect(this, make(azure));

	/**
	 * The cache, over a supplied transport.
	 *
	 * @remarks
	 * The protocol, the version derivation, the conflict handling and the archive
	 * are what this package owns; the pre-signed `PUT` is not. Supplying the
	 * transport is what lets a test exercise all of the first group without the
	 * second, and what an integration test uses to point the same protocol at a
	 * local blob endpoint.
	 *
	 * A parameterized layer factory mints a fresh layer per call and layers
	 * memoize by reference — bind it to a `const` rather than calling it at each
	 * composition site.
	 */
	static readonly layerWith = (
		transfer: FileBlobTransfer,
	): Layer.Layer<
		ActionCache,
		never,
		| ActionEnvironment
		| HttpClient.HttpClient
		| FileSystem.FileSystem
		| Path.Path
		| ChildProcessSpawner.ChildProcessSpawner
	> => Layer.effect(ActionCache, make(transfer));

	/** A test double. Unstubbed members die rather than reporting a miss. */
	static readonly makeTest = (overrides: Partial<ActionCacheShape> = {}): ActionCacheShape => ({
		save: () => dies("save"),
		restore: () => dies("restore"),
		...overrides,
	});

	/** {@link ActionCache.makeTest} behind `Layer.succeed`. */
	static readonly layerTest = (overrides: Partial<ActionCacheShape> = {}): Layer.Layer<ActionCache> =>
		Layer.succeed(ActionCache, ActionCache.makeTest(overrides));
}
