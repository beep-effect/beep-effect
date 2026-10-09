import { BlobClient, BlockBlobClient } from "@azure/storage-blob";
import { Context, Effect, FileSystem, Layer, Option, Path, Result, Schema, Clock, DateTime } from "effect";
import { HttpClient } from "effect/http";
import type { ChildProcess } from "effect/process";
import { ChildProcessSpawner } from "effect/process";
import { ActionEnvironment } from "./ActionEnvironment.ts";
import type { FileBlobTransfer } from "./BlobTransfer.ts";
import { BlobTransferError } from "./BlobTransfer.ts";
import type { BackendIds } from "./internal/actionsResults.ts";
import { misconfiguredDetail, resultsBackend } from "./internal/actionsResults.ts";
import { unzipCommand, zipCommand, zipManifest } from "./internal/archiveCommands.ts";
import { digestFileHex } from "./internal/digest.ts";
import { isWindowsRunner } from "./internal/runner.ts";
import { spawnOnce } from "./internal/spawn.ts";
import { CONFLICT, field, isOk, stringField, twirpCall, twirpFailureFields } from "./internal/twirp.ts";
import { unstubbed } from "./internal/unstubbed.ts";

const Json = Schema.fromJsonString(Schema.Unknown);

/**
 * Raised when an artifact cannot be uploaded, listed, downloaded or deleted.
 *
 * @public
 */
export class ArtifactError extends Schema.TaggedError<ArtifactError>()("ArtifactError", {
	/**
	 * `misconfigured` — the results backend is not reachable from here (see
	 * {@link Artifact}). `unreachable` — it could not be contacted, or answered
	 * with something that is not a Twirp body. `refused` — it answered,
	 * unhappily; re-uploading a name that already exists in the run is the
	 * common case. `notFound` — no artifact by that name or id exists in this
	 * run. `archiveFailed` — `zip` would not pack or unpack the files.
	 * `transferFailed` — the archive itself did not move. `invalidOptions` — the
	 * call cannot be made as asked.
	 */
	reason: Schema.Literals([
		"misconfigured",
		"unreachable",
		"refused",
		"notFound",
		"archiveFailed",
		"transferFailed",
		"invalidOptions",
	]),
	/** The artifact's name or id. A stable identifier, never a value. */
	artifact: Schema.optionalKey(Schema.String),
	/** The HTTP status, when the backend answered. */
	status: Schema.optionalKey(Schema.Finite),
	/** What went wrong, when the reason alone does not say. */
	detail: Schema.optionalKey(Schema.String),
	/** `zip`'s own complaint, which is the only useful part of an archive failure. */
	stderr: Schema.optionalKey(Schema.String),
	/** The underlying failure, preserved structurally. */
	cause: Schema.optionalKey(Schema.Defect()),
}) {
	override get message(): string {
		const about = this.artifact === undefined ? "" : ` "${this.artifact}"`;
		const detail = this.detail === undefined ? "" : `: ${this.detail}`;
		switch (this.reason) {
			case "misconfigured":
				return `The artifact service is not reachable from here${detail}`;
			case "unreachable":
				return `The artifact service could not be reached${detail}`;
			case "refused":
				return `The artifact service refused${about}${this.status === undefined ? "" : ` with status ${this.status}`}${detail}`;
			case "notFound":
				return `No artifact${about} exists in this run`;
			case "archiveFailed":
				return `The artifact archive could not be built or extracted${about}${this.stderr === undefined ? "" : `: ${this.stderr}`}`;
			case "transferFailed":
				return `The artifact archive did not transfer${about}`;
			default:
				return `The artifact call cannot be made as asked${detail}`;
		}
	}
}

/**
 * One artifact, as the backend describes it.
 *
 * @public
 */
export interface ArtifactItem {
	/** The database id, which is what `download` takes. */
	readonly id: number;
	/** The name the artifact was uploaded under. */
	readonly name: string;
	/** The size of the stored zip, in bytes. */
	readonly size: number;
	/** When it was created, ISO-8601, when the backend says. */
	readonly createdAt?: string | undefined;
}

/**
 * How to pack an upload.
 *
 * @public
 */
export interface UploadOptions {
	/**
	 * How long to keep it, in days.
	 *
	 * @remarks
	 * Bounded by the repository's own retention setting; omitted means the
	 * repository default. Zero or negative fails as `invalidOptions` rather than
	 * being silently corrected, because "delete it immediately" and "keep it for
	 * the default period" are too far apart to guess between.
	 */
	readonly retentionDays?: number | undefined;
	/**
	 * The zlib level, 0–9, defaulting to 6 as `@actions/artifact` does.
	 *
	 * @remarks
	 * Out-of-range values are clamped. On Windows the level maps onto .NET's
	 * `CompressionLevel`: `0` is `NoCompression`, `1..3` `Fastest`, `4..8`
	 * `Optimal`, `9` `SmallestSize`.
	 */
	readonly compressionLevel?: number | undefined;
}

/**
 * What an upload produced.
 *
 * @public
 */
export interface UploadResult {
	/** The new artifact's database id, which `download` takes. */
	readonly id: number;
	/** The size of the uploaded zip, in bytes. */
	readonly size: number;
}

/**
 * Where a download should land.
 *
 * @public
 */
export interface DownloadOptions {
	/** The destination directory. A fresh temporary directory when omitted. */
	readonly path?: string | undefined;
}

/**
 * What a download produced.
 *
 * @public
 */
export interface DownloadResult {
	/** The directory the artifact's contents were extracted into. */
	readonly downloadPath: string;
}

/**
 * The id of an artifact that `delete` removed.
 *
 * @public
 */
export interface ArtifactRef {
	/** The deleted artifact's database id. */
	readonly id: number;
}

/**
 * The members of the {@link Artifact} service: upload, list, get, download and
 * delete, each failing with {@link ArtifactError}.
 *
 * @public
 */
export interface ArtifactShape {
	/**
	 * Zip `files` — paths under `rootDirectory` — and upload them under `name`.
	 *
	 * @remarks
	 * Entries are stored relative to `rootDirectory`, so what a later download
	 * extracts is the layout the caller meant rather than its absolute path on
	 * whichever runner produced it. A name already used in this run is refused by
	 * the backend: artifacts are immutable within a run.
	 */
	readonly upload: (
		name: string,
		files: ReadonlyArray<string>,
		rootDirectory: string,
		options?: UploadOptions,
	) => Effect.Effect<UploadResult, ArtifactError>;
	/** Every artifact in the current run. */
	readonly list: () => Effect.Effect<ReadonlyArray<ArtifactItem>, ArtifactError>;
	/** One artifact by name, or nothing — absent is not a failure. */
	readonly get: (name: string) => Effect.Effect<Option.Option<ArtifactItem>, ArtifactError>;
	/** Download an artifact by id and unzip it. Answers with where it landed. */
	readonly download: (artifactId: number, options?: DownloadOptions) => Effect.Effect<DownloadResult, ArtifactError>;
	/** Delete an artifact by name, answering with the id that is now gone. */
	readonly delete: (name: string) => Effect.Effect<ArtifactRef, ArtifactError>;
}

/** The Twirp service the artifact protocol lives under. */
const SERVICE = "github.actions.results.api.v1.ArtifactService";

/**
 * `CreateArtifact`'s `version` field.
 *
 * @remarks
 * `7`, read off `actions/toolkit`'s own upload path. It is a *protocol*
 * version, unrelated to the `v4` in `actions/upload-artifact@v4`, and guessing
 * it from the action's major version — which is the obvious guess — produces a
 * create the backend rejects.
 */
const ARTIFACT_VERSION = 7;

/**
 * The Azure half, duplicated on purpose.
 *
 * @remarks
 * `@azure/storage-blob` may be imported here, by `ActionCache` and by
 * `BlobStore.githubCache`, and nowhere else. Hoisting these two calls into a
 * shared `internal/` helper is exactly how a heavy import leaks into the graph
 * of a module that only sets an output; `__test__/reachability.test.ts`
 * measures that these are the only three.
 */
const azure: FileBlobTransfer = {
	uploadFile: (url, file) =>
		Effect.tryPromise({
			try: () =>
				new BlockBlobClient(url).uploadFile(file, {
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

/** One row of a `ListArtifacts` answer, read under either field spelling. */
const toItem = (row: unknown): ArtifactItem => {
	const createdAt = stringField(row, "createdAt");
	return {
		id: Number(stringField(row, "databaseId") ?? 0),
		name: stringField(row, "name") ?? "",
		size: Number(stringField(row, "size") ?? 0),
		...(createdAt === undefined ? {} : { createdAt }),
	};
};

const make = (
	transfer: FileBlobTransfer,
): Effect.Effect<
	ArtifactShape,
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

		const backend = (artifact: string) =>
			resultsBackend(env).pipe(
				Effect.mapError(
					(name) =>
						ArtifactError.make({
							reason: "misconfigured",
							artifact,
							detail: misconfiguredDetail(name, "artifact service"),
						}),
				),
				Effect.flatMap((resolved) =>
					// The backend ids come from the runtime token's own scope claim, so a
					// token without one is a misconfiguration rather than a call failure —
					// and saying which is the difference between a fixable workflow and a
					// bug report.
					Result.isFailure(resolved.backendIds)
						? Effect.fail(ArtifactError.make({ reason: "misconfigured", artifact, detail: resolved.backendIds.failure }))
						: Effect.succeed({
								baseUrl: resolved.baseUrl,
								token: resolved.token,
								ids: resolved.backendIds.success satisfies BackendIds,
							}),
				),
			);

		const call = Effect.fn("call")(function*(method: string, body: (ids: BackendIds) => Record<string, unknown>, artifact: string) {
				const { baseUrl, ids, token } = yield* backend(artifact);
				return yield* twirpCall({
					http,
					baseUrl,
					service: SERVICE,
					token,
					method,
					body: { ...ids, ...body(ids) },
				}).pipe(Effect.mapError((failure) => ArtifactError.make({ ...twirpFailureFields(failure), artifact })));
			});

		const listAll = (artifact: string) =>
			Effect.map(
				call("ListArtifacts", () => ({}), artifact),
				(answer) => {
					if (answer === CONFLICT) {
						return [] as ReadonlyArray<ArtifactItem>;
					}
					const rows = field(answer, "artifacts");
					return Array.isArray(rows) ? rows.map(toItem) : ([] as ReadonlyArray<ArtifactItem>);
				},
			);

		/** Run an archiving command ONCE (`internal/spawn.ts`), keeping its stderr. */
		const archive = Effect.fn("archive")(function*(command: ChildProcess.Command, artifact: string) {
				const { output, code } = yield* spawnOnce(spawner, command).pipe(
					Effect.mapError((cause) => ArtifactError.make({ reason: "archiveFailed", artifact, cause })),
				);
				if (code !== 0) {
					return yield* ArtifactError.make({ reason: "archiveFailed", artifact, stderr: output.trim() });
				}
			});

		const scratch = <A>(
			artifact: string,
			use: (directory: string) => Effect.Effect<A, ArtifactError>,
		): Effect.Effect<A, ArtifactError> =>
			Effect.acquireUseRelease(
				fs
					.makeTempDirectory({ prefix: "effected-artifact-" })
					.pipe(Effect.mapError((cause) => ArtifactError.make({ reason: "archiveFailed", artifact, cause }))),
				use,
				(directory) => Effect.ignore(fs.remove(directory, { recursive: true, force: true })),
			);

		/**
		 * The SHA-256 the backend finalizes against.
		 *
		 * @remarks
		 * Over the *stored zip*, streamed rather than read: an artifact is the one
		 * payload in this package with no upper bound on size, and a runner has
		 * roughly seven gigabytes of memory for everything.
		 */
		const digestOf = (file: string, artifact: string) =>
			digestFileHex(fs, file, "sha256").pipe(
				Effect.mapError((cause) => ArtifactError.make({ reason: "archiveFailed", artifact, cause })),
			);

		const moved = (artifact: string) =>
			Effect.mapError((cause: BlobTransferError) => ArtifactError.make({ reason: "transferFailed", artifact, cause }));

		const zip = Effect.fn("zip")(function*(files: ReadonlyArray<string>, root: string, destination: string, level: number, artifact: string)
			// Stored relative to `rootDirectory`: `zip` records the paths exactly
			// as given, and the Windows script states each entry name explicitly
			// from the same relative path, so the two archives have one structure
			// — and absolute inputs would extract into a tree named after the
			// runner that produced them.
			{
				const relative = files.map((file) => path.relative(root, file));
				// The Windows list travels one path per line (`internal/archiveCommands.ts`
				// says why), so a path holding a line break cannot be represented.
				// Rejected on every platform: the same upload must not succeed on one
				// runner and fail on another.
				const unrepresentable = relative.find((file) => file.includes("\n") || file.includes("\r"));
				if (unrepresentable !== undefined) {
					return yield* ArtifactError.make({
							reason: "invalidOptions",
							artifact,
							detail: `a file path may not contain a line break: ${Result.getOrThrowWith(Schema.encodeResult(Json)(unrepresentable), (error) => error)}`,
						});
				}
				// Beside the archive inside the scratch directory, so `scratch`'s
				// release removes it with the zip. `writeFileString` is UTF-8 with no
				// BOM, which is what `File.ReadAllLines` needs to read the first path
				// intact.
				const manifest = path.join(path.dirname(destination), "artifact.manifest");
				if (windows) {
					yield* fs
						.writeFileString(manifest, zipManifest(relative))
						.pipe(Effect.mapError((cause) => ArtifactError.make({ reason: "archiveFailed", artifact, cause })));
				}
				yield* archive(zipCommand({ windows, root, files: relative, manifest, destination, level }), artifact);
			});

		// One spelling with ToolInstaller.extractZip (`internal/archiveCommands.ts`):
		// the Windows half must use the overwrite overload, or a download into a
		// non-empty path fails with an empty stderr.
		const unzip = (source: string, destination: string, artifact: string) =>
			archive(unzipCommand({ windows, source, destination }), artifact);

		return {
			upload: Effect.fn("Artifact.upload")(function* (
				name: string,
				files: ReadonlyArray<string>,
				rootDirectory: string,
				options?: UploadOptions,
			) {
				yield* Effect.annotateCurrentSpan({ name });
				if (files.length === 0) {
					return yield* ArtifactError.make({ reason: "invalidOptions", artifact: name, detail: "no files were given to upload" });
				}
				if (options?.retentionDays !== undefined && options.retentionDays <= 0) {
					return yield* ArtifactError.make({
							reason: "invalidOptions",
							artifact: name,
							detail: "retentionDays must be positive — omit it to use the repository default",
						});
				}
				return yield* scratch(name, (directory) =>
					Effect.gen(function* () {
						const packed = path.join(directory, "artifact.zip");
						yield* zip(files, rootDirectory, packed, options?.compressionLevel ?? 6, name);

						const created = yield* call(
							"CreateArtifact",
							() => ({ name, version: ARTIFACT_VERSION, mimeType: "application/zip" }),
							name,
						);
						// Unlike the cache, a conflict here is a real failure: a run may
						// hold one artifact per name, so the second upload is a mistake
						// rather than a race that resolved itself.
						if (created === CONFLICT || !isOk(created)) {
							return yield* ArtifactError.make({
									reason: "refused",
									artifact: name,
									detail: "an artifact with this name already exists in this run",
								});
						}
						const url = stringField(created, "signedUploadUrl");
						if (url === undefined) {
							return yield* ArtifactError.make({
									reason: "refused",
									artifact: name,
									detail: "CreateArtifact returned no upload url",
								});
						}
						yield* transfer.uploadFile(url, packed).pipe(moved(name));

						const size = yield* fs
							.stat(packed)
							.pipe(Effect.mapError((cause) => ArtifactError.make({ reason: "archiveFailed", artifact: name, cause })));
						const digest = yield* digestOf(packed, name);
						const now = options?.retentionDays === undefined ? undefined : yield* Clock.currentTimeMillis;
						const finalized = yield* call(
							"FinalizeArtifact",
							() => ({
								name,
								size: String(size.size),
								hash: `sha256:${digest}`,
								...(options?.retentionDays === undefined
									? {}
									: { expiresAt: DateTime.formatIso(DateTime.makeUnsafe((now ?? 0) + options.retentionDays * 86_400_000)) }),
							}),
							name,
						);
						if (finalized === CONFLICT || !isOk(finalized)) {
							return yield* ArtifactError.make({
									reason: "refused",
									artifact: name,
									detail: "FinalizeArtifact did not confirm the upload",
								});
						}
						return {
							id: Number(stringField(finalized, "artifactId") ?? 0),
							size: Number(size.size),
						} satisfies UploadResult;
					}),
				);
			}),

			list: Effect.fn("Artifact.list")(function* () {
				return yield* listAll("*");
			}),

			get: Effect.fn("Artifact.get")(function* (name: string) {
				yield* Effect.annotateCurrentSpan({ name });
				const all = yield* listAll(name);
				return Option.fromNullishOr(all.find((item) => item.name === name));
			}),

			download: Effect.fn("Artifact.download")(function* (artifactId: number, options?: DownloadOptions) {
				const label = String(artifactId);
				yield* Effect.annotateCurrentSpan({ artifactId });
				// The signed-url RPC takes a NAME, and a caller holds an id — so the
				// listing is how the two are reconciled, not an extra round trip that
				// could be optimized away.
				const all = yield* listAll(label);
				const found = all.find((item) => item.id === artifactId);
				if (found === undefined) {
					return yield* ArtifactError.make({ reason: "notFound", artifact: label });
				}
				const signed = yield* call("GetSignedArtifactURL", () => ({ name: found.name }), label);
				const url = signed === CONFLICT ? undefined : stringField(signed, "signedUrl");
				if (url === undefined) {
					return yield* ArtifactError.make({
							reason: "refused",
							artifact: label,
							detail: "GetSignedArtifactURL returned no url",
						});
				}
				const destination = options?.path;
				const downloadPath =
					destination === undefined
						? yield* fs
								.makeTempDirectory({ prefix: "effected-artifact-download-" })
								.pipe(
									Effect.mapError((cause) => ArtifactError.make({ reason: "archiveFailed", artifact: label, cause })),
								)
						: yield* fs.makeDirectory(destination, { recursive: true }).pipe(
								Effect.as(destination),
								Effect.mapError((cause) => ArtifactError.make({ reason: "archiveFailed", artifact: label, cause })),
							);
				yield* scratch(label, (directory) =>
					Effect.gen(function* () {
						const packed = path.join(directory, "artifact.zip");
						yield* transfer.downloadToFile(url, packed).pipe(moved(label));
						yield* unzip(packed, downloadPath, label);
					}),
				);
				return { downloadPath } satisfies DownloadResult;
			}),

			delete: Effect.fn("Artifact.delete")(function* (name: string) {
				yield* Effect.annotateCurrentSpan({ name });
				const all = yield* listAll(name);
				const found = all.find((item) => item.name === name);
				if (found === undefined) {
					return yield* ArtifactError.make({ reason: "notFound", artifact: name });
				}
				const deleted = yield* call("DeleteArtifact", () => ({ name }), name);
				if (deleted === CONFLICT || !isOk(deleted)) {
					return yield* ArtifactError.make({ reason: "refused", artifact: name, detail: "DeleteArtifact did not confirm" });
				}
				return { id: Number(stringField(deleted, "artifactId") ?? found.id) } satisfies ArtifactRef;
			}),
		} satisfies ArtifactShape;
	});

const dies = unstubbed("Artifact.makeTest");

/**
 * Upload, list, download and delete GitHub Actions artifacts.
 *
 * @remarks
 * Speaks the artifact **Twirp v2** protocol at `ACTIONS_RESULTS_URL`, which
 * answers with a pre-signed Azure blob url for the zip. No `@actions/artifact`
 * dependency.
 *
 * **Only reachable from a `uses:` step**, like {@link ActionCache} — the two
 * variables it needs are injected into action execution contexts and not into
 * `run:` shell steps. The `Actions.Results` scope inside the runtime token is a
 * third thing that can be absent, and it is reported as `misconfigured` for the
 * same reason.
 *
 * **This surface is provisional.** It has not yet been shaped by a real call
 * site, so it may be reworked once a consumer adopts it. It covers the current
 * run only: there is no cross-run lookup, and adding one later would be
 * additive.
 *
 * @example
 * ```ts
 * import { Artifact } from "./index.ts";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const artifacts = yield* Artifact;
 *   return yield* artifacts.upload("logs", ["/tmp/build/log.txt"], "/tmp/build");
 * });
 * ```
 *
 * @public
 */
export class Artifact extends Context.Service<Artifact, ArtifactShape>()("@beep/scratchpad/effected/github-actions/Artifact") {
	/** The service, over the real Azure client and the real `zip`. */
	static readonly layer: Layer.Layer<
		Artifact,
		never,
		| ActionEnvironment
		| HttpClient.HttpClient
		| FileSystem.FileSystem
		| Path.Path
		| ChildProcessSpawner.ChildProcessSpawner
	> = Layer.effect(this, make(azure));

	/**
	 * The service, over a supplied transport.
	 *
	 * @remarks
	 * The protocol, the zip, the digest and the conflict handling are what this
	 * package owns; the pre-signed `PUT` is not. Supplying the transport is what
	 * lets a test exercise all of the first group without the second.
	 *
	 * A parameterized layer factory mints a fresh layer per call and layers
	 * memoize by reference — bind it to a `const` rather than calling it at each
	 * composition site.
	 */
	static readonly layerWith = (
		transfer: FileBlobTransfer,
	): Layer.Layer<
		Artifact,
		never,
		| ActionEnvironment
		| HttpClient.HttpClient
		| FileSystem.FileSystem
		| Path.Path
		| ChildProcessSpawner.ChildProcessSpawner
	> => Layer.effect(Artifact, make(transfer));

	/** A test double. Unstubbed members die rather than reporting an empty run. */
	static readonly makeTest = (overrides: Partial<ArtifactShape> = {}): ArtifactShape => ({
		upload: () => dies("upload"),
		list: () => dies("list"),
		get: () => dies("get"),
		download: () => dies("download"),
		delete: () => dies("delete"),
		...overrides,
	});

	/** {@link Artifact.makeTest} behind `Layer.succeed`. */
	static readonly layerTest = (overrides: Partial<ArtifactShape> = {}): Layer.Layer<Artifact> =>
		Layer.succeed(Artifact, Artifact.makeTest(overrides));
}
