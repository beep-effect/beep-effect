import * as Match from "effect/Match";
import { $ScratchpadId } from "@beep/identity/packages";
import type * as Duration from "effect/Duration";
import type * as PlatformError from "effect/PlatformError";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { HttpClient } from "effect/http";
import type { ChildProcess } from "effect/process";
import { ChildProcessSpawner } from "effect/process";
import { ActionEnvironment } from "./ActionEnvironment.ts";
import { tarExtractCommand, unzipCommand } from "./internal/archiveCommands.ts";
import { isErrno, typeAt } from "./internal/fsProbe.ts";
import { isWindowsRunner, toolCacheRoot } from "./internal/runner.ts";
import { spawnOnce } from "./internal/spawn.ts";
import { unstubbed } from "./internal/unstubbed.ts";

const $I = $ScratchpadId.create("effected/github-actions/ToolInstaller");

/**
 * Raised when a tool cannot be downloaded, extracted or cached.
 *
 * @public
 */
export class ToolInstallerError extends S.TaggedError<ToolInstallerError>($I`ToolInstallerError`)("ToolInstallerError", {
	/**
	 * `downloadFailed` — the archive could not be fetched. `extractFailed` — the
	 * extraction tool refused the archive or is not installed. `cacheFailed` —
	 * the tool could not be written into the runner's tool cache.
	 */
	reason: S.Literals(["downloadFailed", "extractFailed", "cacheFailed"]).annotateKey({ description: "`downloadFailed` — the archive could not be fetched. `extractFailed` — the extraction tool refused the archive or is not installed. `cacheFailed` — the tool could not be written into the runner's tool cache." }),
	/** The HTTP status, when there was one. Drives the retry decision. */
	status: S.optionalKey(S.Finite).annotateKey({ description: "The HTTP status, when there was one. Drives the retry decision." }),
	/** What was being worked on — a url, an archive path, or a tool name. */
	subject: S.String.annotateKey({ description: "What was being worked on — a url, an archive path, or a tool name." }),
	/** The extraction tool's own complaint, which is the only useful part of a tar failure. */
	stderr: S.optionalKey(S.String).annotateKey({ description: "The extraction tool's own complaint, which is the only useful part of a tar failure." }),
	/** The underlying failure, preserved structurally. */
	cause: S.optionalKey(S.Defect()).annotateKey({ description: "The underlying failure, preserved structurally." }),
}, $I.annote("ToolInstallerError", { description: "Raised when a tool cannot be downloaded, extracted or cached." })) {
	override get message(): string {
		return Match.value(this.reason).pipe(
			Match.when("downloadFailed", () => `Could not download ${this.subject}${this.status === undefined ? "" : ` (HTTP ${this.status})`}`),
			Match.when("extractFailed", () => `Could not extract ${this.subject}${this.stderr === undefined ? "" : `: ${this.stderr}`}`),
			Match.orElse(() => `Could not cache ${this.subject} into the tool cache`),
		);
	}

	/**
  * Whether retrying could plausibly help.
  *
  * **Details**
  *
  * A derived getter rather than a field, so it cannot be set inconsistently
  * with the status it is derived from. `408`, `429` and any `5xx` are the
  * server saying "later"; a `404` is it saying "never", and retrying that
  * three times just makes a broken url take longer to fail.
  */
	get retryable(): boolean {
		if (this.reason !== "downloadFailed") {
			return false;
		}
		if (this.status === undefined) {
			// No status means the request never completed — a transport fault, which
			// is the most retryable thing there is.
			return true;
		}
		return this.status >= 500 || this.status === 408 || this.status === 429;
	}
}

/**
 * Where extraction should put its output.
 *
 * @public
 */
export interface ExtractOptions {
	/** The destination. A fresh temporary directory when omitted. */
	readonly destination?: string | undefined;
	/**
  * Flags for `tar`. Defaults to `["xzf"]`, i.e. a gzipped tarball.
  *
  * **Gotchas**
  *
  * The argv is assembled as `[...flags, archive, "-C", destination]` — the
  * archive path is appended directly AFTER the flags, so the LAST flag must
  * be the one that consumes the archive operand. `["xzf"]` works because `f`
  * is last inside the cluster; a custom set like `["xz", "--strip=1", "-f"]`
  * must end the same way, deliberately rather than by ordering luck.
  */
	readonly flags?: ReadonlyArray<string> | undefined;
}

/**
 * How a {@link ToolInstallerShape.download} should behave.
 *
 * @public
 */
export interface ToolDownloadOptions {
	/**
  * The overall time budget for ONE download attempt (request plus streaming
  * the body to disk). Defaults to five minutes.
  *
  * **Details**
  *
  * The default is deliberately generous: toolchain archives run to hundreds
  * of megabytes, and a healthy runner connection moves tens of megabytes a
  * second — even a 500 MB archive on a degraded 2 MB/s link fits in five
  * minutes. What the budget exists for is the connection that stops moving
  * entirely: without it, a dead connection is a silent CI hang until the job
  * timeout; with it, the attempt fails typed as `downloadFailed` with no
  * status — which `retryable` classifies as a transport fault — and the
  * download's own retry policy tries again.
  */
	readonly timeout?: Duration.Input | undefined;
}

/**
 * What {@link ToolInstallerShape.provisionFile} should provision.
 *
 * @public
 */
export interface ProvisionFileOptions {
	/** The tool-cache name the binary is provisioned under, e.g. `"biome"`. */
	readonly tool: string;
	/** The exact version — a tool-cache path segment, so spell it canonically. */
	readonly version: string;
	/** The url the binary downloads from on a cache miss. */
	readonly url: string;
	/**
	 * The cached file's name — what the tool is invoked as once its directory
	 * is on the `PATH` (e.g. `"biome"`, or `"biome.exe"` on Windows).
	 */
	readonly binary: string;
}

/**
 * Where {@link ToolInstallerShape.provisionFile} put a single-binary tool.
 *
 * **Details**
 *
 * The same `directory`/`binDir` shape as `PackageManagerInstaller`'s
 * `CachedPackageManager`, so a consumer publishes either the same way. For a
 * single binary the two coincide: the cached directory contains exactly the
 * executable, so it IS the directory to hand to `ActionOutputs.addPath`.
 *
 * @public
 */
export interface ProvisionedFile {
	/** The cached entry: `<tool-cache>/<tool>/<version>/<arch>`. */
	readonly directory: string;
	/** The directory to `addPath` — for a single binary, the cached directory itself. */
	readonly binDir: string;
}

/**
 * The members of the {@link ToolInstaller} service: find, download, extract and
 * cache tools in the runner's tool cache, each failing with
 * {@link ToolInstallerError}.
 *
 * @public
 */
export interface ToolInstallerShape {
	/**
  * A cached tool, if this runner already has it.
  *
  * **Gotchas**
  *
  * Absent is not an error, and neither is an unreadable cache: both mean
  * "install it", which is the only thing a caller can do about either.
  *
  * **The tool cache is SHARED.** The hosted runner image pre-populates it and
  * every `setup-*` action writes into it — this package is a co-writer, not
  * the owner. A hit guarantees only the `<root>/<tool>/<version>/<arch>`
  * location contract ({@link ToolInstaller.cachePath}); the directory's
  * *interior* layout is whatever its writer produced, which is not
  * necessarily what this consumer's own `cacheDir` would have written.
  * Validate the layout of a foreign hit before relying on it — an
  * assumption from your own install path (an archive-wrapper subdirectory,
  * say) may not hold for a foreign entry.
  */
	readonly find: (tool: string, version: string) => Effect.Effect<O.Option<string>>;
	/**
  * Where this installer's `cacheDir` / `cacheFile` will land `tool@version`:
  * the final `<root>/<tool>/<version>/<arch>`, over the root this layer
  * resolved at construction.
  *
  * **Details**
  *
  * Pure — no IO, nothing is created — and exposed so a caller that must
  * write the final path INTO the staged tree before the swap (a shim that
  * names its own cached entry) reads the one answer `cacheDir` is about to
  * use, instead of deriving root and arch a second time and guarding the
  * two against drifting apart. {@link ToolInstaller.cachePath} is the same
  * layout as a static function of an explicit root.
  */
	readonly cachePath: (tool: string, version: string) => string;
	/** Download a url to a temporary file, retrying what is worth retrying. */
	readonly download: (url: string, options?: ToolDownloadOptions) => Effect.Effect<string, ToolInstallerError>;
	/** Extract a tarball. Returns the directory its contents landed in. */
	readonly extractTar: (archive: string, options?: ExtractOptions) => Effect.Effect<string, ToolInstallerError>;
	/** Extract a zip. Returns the directory its contents landed in. */
	readonly extractZip: (archive: string, options?: ExtractOptions) => Effect.Effect<string, ToolInstallerError>;
	/**
  * Install a directory into the tool cache. Returns its cached path.
  *
  * **Gotchas**
  *
  * **`source` is consumed.** On success it no longer exists at its original
  * path: the tree is renamed into the cache when the two share a filesystem
  * (`RUNNER_TEMP` and `RUNNER_TOOL_CACHE` do on hosted runners, making the
  * install O(1) rather than a recursive copy of the whole toolchain), and
  * otherwise copied and then removed. Write everything the cached entry must
  * contain — shims, overlaid binaries — into `source` *before* this call,
  * and read nothing from it afterwards.
  */
	readonly cacheDir: (source: string, tool: string, version: string) => Effect.Effect<string, ToolInstallerError>;
	/** Install a single file into the tool cache under `name`. Returns the cached directory. */
	readonly cacheFile: (
		source: string,
		name: string,
		tool: string,
		version: string,
	) => Effect.Effect<string, ToolInstallerError>;
	/**
  * Provision a single-binary tool: the whole `find` → `download` →
  * chmod → `cacheFile` composition as one call.
  *
  * **Details**
  *
  * The one packaged workflow among the primitives, because the single-binary
  * shape (biome, and every Rust/Go tool distributed as a bare executable) has
  * no per-tool variation left to compose: there is no archive, so no
  * extraction and no layout fixup. A cache hit whose entry contains the
  * named `binary` short-circuits; a hit *missing* it — a foreign or partial
  * entry, see {@link ToolInstallerShape.find}'s shared-cache warning — is
  * treated as a miss and reinstalled over, rather than handing back a
  * directory that cannot run the tool. On the install path the downloaded
  * file is made executable (`0o755`) BEFORE caching — skipped when
  * `RUNNER_OS` is Windows, where the bit does not exist — so the cache only
  * ever contains a runnable tool; a chmod failure is `cacheFailed` with the
  * file as its subject.
  */
	readonly provisionFile: (options: ProvisionFileOptions) => Effect.Effect<ProvisionedFile, ToolInstallerError>;
}

/** How many times a retryable download is retried before giving up. */
const DOWNLOAD_RETRIES = 2;

/** The default per-attempt download budget. See {@link ToolDownloadOptions.timeout}. */
const DOWNLOAD_TIMEOUT: Duration.Input = "5 minutes";

const make = Effect.gen(function* () {
	const env = yield* ActionEnvironment;
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const http = yield* HttpClient.HttpClient;
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

	// Resolved once, at construction (`internal/runner.ts` says why not at import).
	const root = yield* toolCacheRoot(env, path);
	const windows = yield* isWindowsRunner(env);

	const cachePath = (tool: string, version: string): string =>
		ToolInstaller.cachePath({ root, tool, version, arch: process.arch });

	const destinationFor = (options: ExtractOptions | undefined): Effect.Effect<string, ToolInstallerError> => {
		const requested = options?.destination;
		if (requested === undefined) {
			return fs
				.makeTempDirectory({ prefix: "effected-extract-" })
				.pipe(
					Effect.mapError(
						(cause) =>
							ToolInstallerError.make({ reason: "extractFailed", subject: "a temporary extraction directory", cause }),
					),
				);
		}
		return fs.makeDirectory(requested, { recursive: true }).pipe(
			Effect.as(requested),
			Effect.mapError((cause) => ToolInstallerError.make({ reason: "extractFailed", subject: requested, cause })),
		);
	};

	/**
  * Run an extraction command ONCE, keeping its stderr.
  *
  * **Gotchas**
  *
  * `tar`'s exit code says only that it failed; its stderr says why, and it is
  * the difference between "this is not a gzip archive" and "tar is not
  * installed". Discarding it is what makes an extraction failure unactionable.
  *
  * **One spawn, not two — load-bearing**, and why is spelled once in
  * `internal/spawn.ts`: a second run fails on Windows because .NET's
  * `ZipFile.ExtractToDirectory` refuses to overwrite.
  */
	const extractWith = Effect.fnUntraced(function* (command: ChildProcess.Command, archive: string) {
			const { output, code } = yield* spawnOnce(spawner, command).pipe(
				Effect.mapError((cause) => ToolInstallerError.make({ reason: "extractFailed", subject: archive, cause })),
			);
			if (code !== 0) {
				return yield* ToolInstallerError.make({ reason: "extractFailed", subject: archive, stderr: output.trim() });
			}
		});

	/**
  * Install a staged directory into the tool cache by renaming it into place.
  *
  * **Details**
  *
  * **Stage then swap**, and the reason is that the alternative is worse than a
  * failed install: copying straight into the cache path leaves a *partial*
  * tool behind when the copy fails halfway, and `find` reports a partial
  * directory as a hit. Every later run then uses a half-extracted toolchain
  * and never re-downloads it. A rename within one filesystem is atomic, so the
  * cache only ever contains complete tools.
  */
	const swapIntoCache = (staging: string, tool: string, version: string): Effect.Effect<string, ToolInstallerError> =>
		Effect.gen(function* () {
			const destination = cachePath(tool, version);
			yield* fs.makeDirectory(path.dirname(destination), { recursive: true });
			// A previous interrupted install, or a re-install of the same version.
			yield* fs.remove(destination, { recursive: true, force: true });
			yield* fs.rename(staging, destination);
			return destination;
		}).pipe(Effect.mapError((cause) => ToolInstallerError.make({ reason: "cacheFailed", subject: tool, cause })));

	/**
  * Move a source tree into the staging directory, consuming the source.
  *
  * **Details**
  *
  * A rename first: on the same filesystem it is O(1) however large the
  * toolchain is, where a recursive copy of a hundreds-of-MB tree is the
  * dominant cost of an install. The staging directory is removed before the
  * rename because Windows refuses to rename onto an existing directory; its
  * mktemp name stays reserved in practice. The copy fallback is taken ONLY
  * for `EXDEV` — a cross-filesystem move, the one case a rename cannot do —
  * and every other rename failure is reported as-is: a copy after a
  * permission error would turn a real failure into a slow success. The
  * fallback removes the source afterwards so the contract is the same on
  * both paths; that removal is best-effort, since the entry is already
  * complete and a leftover temp directory is not worth failing the install.
  */
	const moveIntoStaging = (source: string, staging: string): Effect.Effect<void, PlatformError.PlatformError> =>
		fs.remove(staging, { recursive: true, force: true }).pipe(
			Effect.flatMap(() => fs.rename(source, staging)),
			Effect.catchIf(
				(error) => isErrno(error.cause, "EXDEV"),
				() =>
					fs
						.copy(source, staging, { overwrite: true })
						.pipe(Effect.andThen(Effect.ignore(fs.remove(source, { recursive: true, force: true })))),
			),
		);

	/** A staging directory beside the cache, so the swap is a rename and not a copy. */
	const staged = <A>(
		tool: string,
		use: (staging: string) => Effect.Effect<A, ToolInstallerError>,
	): Effect.Effect<A, ToolInstallerError> =>
		Effect.gen(function* () {
			// `directory: root` matters: a rename across filesystems is not atomic
			// (and on many platforms not permitted at all), so the staging area has
			// to live under the cache root rather than in the system temp directory.
			yield* fs.makeDirectory(root, { recursive: true });
      return yield * fs.makeTempDirectory({
        directory: root,
        prefix: ".staging-"
      });
		}).pipe(
			Effect.mapError((cause) => ToolInstallerError.make({ reason: "cacheFailed", subject: tool, cause })),
			Effect.flatMap((staging) =>
				use(staging).pipe(
					// Removed on the failure path only: on the success path it has
					// already been renamed away and is no longer there to remove.
					Effect.tapCause(() => Effect.ignore(fs.remove(staging, { recursive: true, force: true }))),
				),
			),
		);

	const download = Effect.fn("ToolInstaller.download")(function* (url: string, options?: ToolDownloadOptions) {
		const attempt = Effect.gen(function* () {
			const response = yield* http
				.get(url)
				.pipe(Effect.mapError((cause) => ToolInstallerError.make({ reason: "downloadFailed", subject: url, cause })));
			if (response.status < 200 || response.status >= 300) {
				return yield* ToolInstallerError.make({ reason: "downloadFailed", subject: url, status: response.status });
			}
			const directory = yield* fs
				.makeTempDirectory({ prefix: "effected-download-" })
				.pipe(Effect.mapError((cause) => ToolInstallerError.make({ reason: "downloadFailed", subject: url, cause })));
			const file = path.join(directory, "download");
			// Streamed to disk rather than buffered: a toolchain archive is measured
			// in hundreds of megabytes and a runner is not generous with memory.
			yield* Stream.run(response.stream, fs.sink(file)).pipe(
				Effect.mapError((cause) => ToolInstallerError.make({ reason: "downloadFailed", subject: url, cause })),
			);
			return file;
		});

		return yield* attempt.pipe(
			// The per-attempt budget sits INSIDE the retry: a connection that stops
			// moving becomes a typed, statusless (and therefore retryable)
			// downloadFailed instead of a silent hang to the job timeout.
			Effect.timeout(options?.timeout ?? DOWNLOAD_TIMEOUT),
			Effect.catchTag("TimeoutError", (cause) =>
				Effect.fail(ToolInstallerError.make({ reason: "downloadFailed", subject: url, cause })),
			),
			Effect.retry({
				schedule: Schedule.exponential("1 second"),
				times: DOWNLOAD_RETRIES,
				while: (error: ToolInstallerError) => error.retryable,
			}),
		);
	});

	const find = (tool: string, version: string): Effect.Effect<O.Option<string>> =>
		Effect.map(typeAt(fs, cachePath(tool, version)), (type) =>
			type === "Directory" ? O.some(cachePath(tool, version)) : O.none(),
		);

	const cacheFile = Effect.fn("ToolInstaller.cacheFile")(function* (
		source: string,
		name: string,
		tool: string,
		version: string,
	) {
		yield* Effect.annotateCurrentSpan({ tool, version });
		return yield* staged(tool, (staging) =>
			fs.copyFile(source, path.join(staging, name)).pipe(
				Effect.mapError((cause) => ToolInstallerError.make({ reason: "cacheFailed", subject: tool, cause })),
				Effect.flatMap(() => swapIntoCache(staging, tool, version)),
			),
		);
	});

	return {
		find,

		cachePath,

		download,

		extractTar: Effect.fn("ToolInstaller.extractTar")(function* (archive: string, options?: ExtractOptions) {
			const destination = yield* destinationFor(options);
			yield* extractWith(tarExtractCommand({ archive, destination, flags: options?.flags }), archive);
			return destination;
		}),

		extractZip: Effect.fn("ToolInstaller.extractZip")(function* (archive: string, options?: ExtractOptions) {
			const destination = yield* destinationFor(options);
			// The platform comes from `RUNNER_OS` rather than `process.platform`,
			// which is both the runner's own answer and the only version of this
			// branch that a test on any host can reach. The command text — and why
			// the Windows half is belt-and-braces — lives in `internal/archiveCommands.ts`.
			yield* extractWith(unzipCommand({ windows, source: archive, destination }), archive);
			return destination;
		}),

		cacheDir: Effect.fn("ToolInstaller.cacheDir")(function* (source: string, tool: string, version: string) {
			yield* Effect.annotateCurrentSpan({ tool, version });
			return yield* staged(tool, (staging) =>
				moveIntoStaging(source, staging).pipe(
					Effect.mapError((cause) => ToolInstallerError.make({ reason: "cacheFailed", subject: tool, cause })),
					Effect.flatMap(() => swapIntoCache(staging, tool, version)),
				),
			);
		}),

		cacheFile,

		provisionFile: Effect.fn("ToolInstaller.provisionFile")(function* (options: ProvisionFileOptions) {
			yield* Effect.annotateCurrentSpan({ tool: options.tool, version: options.version });
			const cached = yield* find(options.tool, options.version);
			if (O.isSome(cached)) {
				// The hit is validated, per find's shared-cache warning: the entry may
				// have been written by the runner image or a setup-* action, and a hit
				// without the named binary is a directory that cannot run the tool.
				// Absence falls through to a reinstall over the entry rather than
				// failing — the install path is the only recovery a caller has anyway.
				if ((yield* typeAt(fs, path.join(cached.value, options.binary))) === "File") {
					return { directory: cached.value, binDir: cached.value };
				}
			}
			const file = yield* download(options.url);
			if (!windows) {
				// A downloaded file has no executable bit, and the cached binary must
				// be invokable as-is; on Windows the bit does not exist and chmod is
				// skipped entirely. BEFORE caching, so the cache only ever contains a
				// runnable tool — same ordering as PackageManagerInstaller's bun path.
				yield* fs
					.chmod(file, 0o755)
					.pipe(Effect.mapError((cause) => ToolInstallerError.make({ reason: "cacheFailed", subject: file, cause })));
			}
			const directory = yield* cacheFile(file, options.binary, options.tool, options.version);
			return { directory, binDir: directory };
		}),
	} satisfies ToolInstallerShape;
});

const dies = unstubbed("ToolInstaller.makeTest");

/**
 * The root {@link ToolInstaller.makeTest}'s `cachePath` answers under: the
 * same resolution as `make`'s (`internal/runner.ts`), read from the ambient
 * environment because a double has no `ActionEnvironment` to ask. The literal
 * `/tmp/runner-tool-cache` is what `make`'s `path.join("/tmp", "runner-tool-cache")`
 * spells on POSIX, which is the only place a test double runs. Test-double
 * only.
 */
const testRoot = (): string => Effect.runSync(
	Config.String("RUNNER_TOOL_CACHE").pipe(Config.withDefault("/tmp/runner-tool-cache"))
		.parse(ConfigProvider.fromEnv({ preserveEmptyStrings: true })),
);

/**
 * Download, extract and cache a toolchain in the runner's tool cache.
 *
 * **Details**
 *
 * The primitives, plus exactly one packaged workflow: a consumer composes
 * `find` → `download` → `extractTar` → `cacheDir` in whatever order its tool
 * needs, because the orders genuinely differ (a tarball with a nested root
 * directory needs a path fixup between extract and cache). The one shape with
 * no per-tool variation — a single bare binary, which skips extraction and
 * needs only the executable bit — ships whole as
 * {@link ToolInstallerShape.provisionFile}.
 *
 * No `@actions/tool-cache` dependency — the cache is a directory layout, and
 * this reproduces the layout rather than importing a package to compute it.
 *
 * **Example** (Download and cache Node on a cache miss)
 *
 * ```ts
 * import { ToolInstaller } from "./index.ts";
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 *
 * const install = Effect.gen(function* () {
 *   const installer = yield* ToolInstaller;
 *   const cached = yield* installer.find("node", "22.11.0");
 *   if (O.isSome(cached)) return cached.value;
 *   const archive = yield* installer.download("https://nodejs.org/dist/v22.11.0/node.tar.gz");
 *   const extracted = yield* installer.extractTar(archive);
 *   return yield* installer.cacheDir(extracted, "node", "22.11.0");
 * });
 * ```
 *
 * @public
 */
export class ToolInstaller extends Context.Service<ToolInstaller, ToolInstallerShape>()(
	$I`ToolInstaller`,
) {
	/**
  * The live installer, over the runner's tool cache, `HttpClient` and `tar`.
  *
  * **Details**
  *
  * The cache root comes from `RUNNER_TOOL_CACHE`, resolved once at layer
  * construction.
  */
	static readonly layer: Layer.Layer<
		ToolInstaller,
		never,
		| ActionEnvironment
		| FileSystem.FileSystem
		| Path.Path
		| HttpClient.HttpClient
		| ChildProcessSpawner.ChildProcessSpawner
	> = Layer.effect(this, make);

	/**
  * Where a tool lives in the cache.
  *
  * **Details**
  *
  * Pure, exported and tested on its own, because the layout is a **contract
  * with the runner**: `<root>/<tool>/<version>/<arch>` is what the hosted
  * image populates and what `@actions/tool-cache` reads, so a tool cached at
  * any other path is invisible to every other step in the workflow. The `arch`
  * segment uses Node's `process.arch` spelling (`x64`) rather than the
  * runner's `RUNNER_ARCH` (`X64`) for the same reason.
  */
	static readonly cachePath = (options: {
		readonly root: string;
		readonly tool: string;
		readonly version: string;
		readonly arch: string;
	}): string => `${options.root}/${options.tool}/${options.version}/${options.arch}`;

	/**
  * A test double. Unstubbed members die rather than reporting a tool that is
  * not there.
  *
  * **Details**
  *
  * `cachePath` is the one member with a default rather than a death: it is
  * pure and total, and a caller composing it into shim contents would
  * otherwise have to stub it in every test. The default is the static layout
  * over `RUNNER_TOOL_CACHE`, or the same off-runner root `make` resolves
  * (`internal/runner.ts`). **That is a read of the ambient environment**,
  * sanctioned here only because a double has no `ActionEnvironment` to ask,
  * and limited to the test double.
  */
	static readonly makeTest = (overrides: Partial<ToolInstallerShape> = {}): ToolInstallerShape => ({
		find: () => dies("find"),
		cachePath: (tool, version) => ToolInstaller.cachePath({ root: testRoot(), tool, version, arch: process.arch }),
		download: () => dies("download"),
		extractTar: () => dies("extractTar"),
		extractZip: () => dies("extractZip"),
		cacheDir: () => dies("cacheDir"),
		cacheFile: () => dies("cacheFile"),
		provisionFile: () => dies("provisionFile"),
		...overrides,
	});

	/** {@link ToolInstaller.makeTest} behind `Layer.succeed`. */
	static readonly layerTest = (overrides: Partial<ToolInstallerShape> = {}): Layer.Layer<ToolInstaller> =>
		Layer.succeed(ToolInstaller, ToolInstaller.makeTest(overrides));
}
