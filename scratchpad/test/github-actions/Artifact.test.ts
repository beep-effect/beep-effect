// Real archive bytes, subprocess extraction, and spawn-time manifest IO need the Node platform.
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { assertNone, assertSome, assertExitFailure } from "@effect/vitest/utils";
import * as O from "effect/Option";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import * as Crypto from "effect/Crypto";
import * as Clock from "effect/Clock";
import { FetchHttpClient } from "effect/http";
import { ChildProcessSpawner } from "effect/process";
import type { FileBlobTransfer } from "../../effected/github-actions/index.ts";
import { Artifact, ArtifactError, BlobTransferError } from "../../effected/github-actions/index.ts";
import { json, resultsEnv, runtimeToken, twirpFetch } from "./results.ts";

const Json = S.fromJsonString(S.Unknown);

const fileTransfer = () => {
	const blobs = new Map<string, Uint8Array>();
	const transfer = (fs: FileSystem.FileSystem): FileBlobTransfer => ({
		uploadFile: (url, file) =>
			fs.readFile(file).pipe(
				Effect.tap((bytes) => Effect.sync(() => blobs.set(url, bytes))),
				Effect.asVoid,
				Effect.mapError((cause) => BlobTransferError.make({ reason: "uploadFailed", cause }))
			),
		downloadToFile: (url, file) =>
			Effect.suspend(() => {
				const found = blobs.get(url);
				return found === undefined
					? Effect.fail(
							BlobTransferError.make({ reason: "downloadFailed", cause: new Error(`nothing was uploaded to ${url}`) })
						)
					: fs
							.writeFile(file, found)
							.pipe(Effect.mapError((cause) => BlobTransferError.make({ reason: "downloadFailed", cause })));
			}),
	});
	return { blobs, transfer };
};

const artifactLayer = (transfer: ReturnType<typeof fileTransfer>["transfer"]) =>
	Layer.unwrap(Effect.map(FileSystem.FileSystem, (fs) => Artifact.layerWith(transfer(fs))));

/** The real filesystem and the real `zip`/`unzip`, over a stubbed backend. */
const live = (
	fetch: typeof globalThis.fetch,
	transfer: ReturnType<typeof fileTransfer>["transfer"],
	env: Readonly<Record<string, string>> = {}
) =>
	artifactLayer(transfer).pipe(
		Layer.provideMerge(
			Layer.mergeAll(
				resultsEnv(env),
				NodeServices.layer,
				FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch)(fetch)))
			)
		)
	);

const protocol = (
	fetch: typeof globalThis.fetch,
	transfer: ReturnType<typeof fileTransfer>["transfer"],
	env: Readonly<Record<string, string>> = {}
) =>
	artifactLayer(transfer).pipe(
		Layer.provideMerge(
			Layer.mergeAll(
				resultsEnv(env),
				MemoryFileSystem.layer,
				Path.layer,
				Layer.mock(ChildProcessSpawner.ChildProcessSpawner, {}),
				FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch)(fetch)))
			)
		)
	);

const uploadable = {
	CreateArtifact: () => json({ ok: true, signedUploadUrl: "https://blob.example/artifact?sig=abc" }),
	FinalizeArtifact: () => json({ ok: true, artifactId: "4242" }),
};

describe("Artifact", () => {
	{
		const { blobs, transfer } = fileTransfer();
		const { calls, fetch } = twirpFetch(uploadable);
		it.layer(live(fetch, transfer), { timeout: "30 seconds" })((it) => {
			it.effect("uploads a real zip, and finalizes against the bytes it uploaded", () =>
				Effect.gen(function* () {
					const fs = yield* FileSystem.FileSystem;
					const { join } = yield* Path.Path;
					const root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-artifact-test-" });
					yield* fs.makeDirectory(join(root, "nested"), { recursive: true });
					yield* fs.writeFileString(join(root, "nested", "log.txt"), "build output");

					const result = yield* Effect.flatMap(Artifact, (artifacts) =>
						artifacts.upload("logs", [join(root, "nested", "log.txt")], root)
					);

					const uploaded = blobs.get("https://blob.example/artifact?sig=abc");
					assert.isDefined(uploaded);
					// `PK\x03\x04`: what was uploaded is a zip, not a description of one.
					assert.deepStrictEqual([...(uploaded ?? []).slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);

					// The protocol version is 7 and has nothing to do with the `v4` in
					// `actions/upload-artifact@v4` — which is the obvious wrong guess, and
					// produces a create the backend rejects.
					const create = calls.find((call) => call.method === "CreateArtifact");
					assert.strictEqual(create?.body.version, 7);
					assert.strictEqual(create?.body.mimeType, "application/zip");

					const finalize = calls.find((call) => call.method === "FinalizeArtifact");
					// The digest is over the STORED zip. Hashing anything else produces a
					// finalize the backend accepts and an artifact it later refuses to serve.
					assert.strictEqual(
						finalize?.body.hash,
						`sha256:${Buffer.from(yield* (yield* Crypto.Crypto).digest("SHA-256", uploaded ?? new Uint8Array())).toString("hex")}`
					);
					assert.strictEqual(finalize?.body.size, String(uploaded?.byteLength));
					assert.strictEqual(result.id, 4242);
					assert.strictEqual(result.size, uploaded?.byteLength);
				})
			);
		});
	}

	{
		const { transfer } = fileTransfer();
		const { fetch } = twirpFetch({
			...uploadable,
			ListArtifacts: () => json({ artifacts: [{ databaseId: "4242", name: "logs", size: "10" }] }),
			GetSignedArtifactURL: () => json({ signedUrl: "https://blob.example/artifact?sig=abc" }),
		});
		it.layer(live(fetch, transfer), { timeout: "30 seconds" })((it) => {
			it.effect("stores entries relative to the root directory, so a download rebuilds the layout", () =>
				Effect.gen(function* () {
					const fs = yield* FileSystem.FileSystem;
					const { join } = yield* Path.Path;
					const root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-artifact-test-" });
					yield* fs.makeDirectory(join(root, "src", "deep"), { recursive: true });
					yield* fs.writeFileString(join(root, "src", "deep", "file.txt"), "contents");

					const destination = join(root, "out");

					const artifacts = yield* Artifact;
					yield* artifacts.upload("logs", [join(root, "src", "deep", "file.txt")], root);
					yield* artifacts.download(4242, { path: destination });

					// Absolute paths in the zip would extract into a tree named after the
					// runner that produced them — the file would be somewhere under
					// `out/private/var/folders/…` rather than where the caller asked.
					assert.strictEqual(yield* fs.readFileString(join(destination, "src", "deep", "file.txt")), "contents");
				})
			);
		});
	}

	{
		const { transfer } = fileTransfer();
		const { calls, fetch } = twirpFetch({ ListArtifacts: () => json({ artifacts: [] }) });
		it.layer(protocol(fetch, transfer), { timeout: "30 seconds" })((it) => {
			it.effect("scopes every call to the run and job in the runtime token", () =>
				Effect.gen(function* () {
					yield* Effect.flatMap(Artifact, (artifacts) => artifacts.list);
					// Unscoped, the backend answers about a different job — or refuses. The
					// ids are not configuration: they are inside the credential.
					assert.strictEqual(calls[0]?.body.workflowRunBackendId, "run-1");
					assert.strictEqual(calls[0]?.body.workflowJobRunBackendId, "job-1");
				})
			);
		});
	}

	{
		const { transfer } = fileTransfer();
		const { calls, fetch } = twirpFetch({});
		it.layer(protocol(fetch, transfer, { ACTIONS_RUNTIME_TOKEN: runtimeToken("Actions.Uploads:x") }), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("reports a runtime token with no Actions.Results scope as a misconfiguration", () =>
				Effect.gen(function* () {
					const error = yield* Effect.flip(Effect.flatMap(Artifact, (artifacts) => artifacts.list));
					assert.instanceOf(error, ArtifactError);
					assert.strictEqual(error.reason, "misconfigured");
					assert.include(error.message, "Actions.Results");
					assert.lengthOf(calls, 0);
				})
			);
		});
	}

	{
		const { transfer } = fileTransfer();
		const { fetch } = twirpFetch({
			ListArtifacts: () =>
				json({
					artifacts: [
						{ databaseId: "1", name: "camel", size: "10", createdAt: "2026-01-01T00:00:00Z" },
						{ database_id: "2", name: "snake", size: "20", created_at: "2026-01-02T00:00:00Z" },
					],
				}),
		});
		it.layer(protocol(fetch, transfer), { timeout: "30 seconds" })((it) => {
			it.effect("reads a listing under either field spelling", () =>
				Effect.gen(function* () {
					const items = yield* Effect.flatMap(Artifact, (artifacts) => artifacts.list);
					assert.deepStrictEqual(
						items.map((item) => [item.id, item.name, item.size, item.createdAt]),
						[
							[1, "camel", 10, "2026-01-01T00:00:00Z"],
							[2, "snake", 20, "2026-01-02T00:00:00Z"],
						]
					);
				})
			);
		});
	}

	for (const idField of ["databaseId", "database_id"]) {
		for (const numericField of [idField, "size"]) {
			for (const malformed of ["not-a-number", "Infinity", "1e309"]) {
				{
					const { transfer } = fileTransfer();
					const { calls, fetch } = twirpFetch({
						ListArtifacts: () =>
							json({
								artifacts: [
									{ [idField]: "1", name: "valid", size: "10" },
									{ [idField]: "2", name: "broken", size: "20", [numericField]: malformed },
								],
							}),
					});
					it.layer(protocol(fetch, transfer), { timeout: "30 seconds" })((it) => {
						it.effect(`rejects malformed ${numericField} ${malformed} in a ${idField} listing`, () =>
							Effect.gen(function* () {
								const error = yield* Effect.flip(Effect.flatMap(Artifact, (artifacts) => artifacts.list));
								assert.instanceOf(error, ArtifactError);
								assert.strictEqual(error.reason, "unreachable");
								assert.strictEqual(error.artifact, "*");
								assert.strictEqual(error.detail, "ListArtifacts did not answer with a Twirp body");
								assert.instanceOf(error.cause, S.SchemaError);
								assert.lengthOf(calls, 1);
							})
						);
					});
				}
			}
		}
	}

	{
		const { transfer } = fileTransfer();
		const { fetch } = twirpFetch({
			ListArtifacts: () => json({ artifacts: [{ databaseId: "7", name: "logs", size: "3" }] }),
		});
		const layer = protocol(fetch, transfer);
		it.layer(layer, { timeout: "30 seconds" })((it) => {
			it.effect("finds one by name, and reports an absent one as nothing", () =>
				Effect.gen(function* () {
					const found = yield* Effect.flatMap(Artifact, (artifacts) => artifacts.get("logs"));
					assertSome(
						O.map(found, (artifact) => artifact.id),
						7
					);
					// Absent is an answer, not a failure — the same convention as a cache miss.
					assertNone(yield* Effect.flatMap(Artifact, (artifacts) => artifacts.get("other")));
				})
			);
		});
	}

	{
		const { transfer } = fileTransfer();
		const { fetch } = twirpFetch({ CreateArtifact: () => new Response(null, { status: 409 }) });
		it.layer(live(fetch, transfer), { timeout: "30 seconds" })((it) => {
			it.effect("refuses a duplicate name, because a run holds one artifact per name", () =>
				Effect.gen(function* () {
					const fs = yield* FileSystem.FileSystem;
					const { join } = yield* Path.Path;
					const root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-artifact-test-" });
					yield* fs.writeFileString(join(root, "a.txt"), "x");

					const error = yield* Effect.flip(
						Effect.flatMap(Artifact, (artifacts) => artifacts.upload("logs", [join(root, "a.txt")], root))
					);
					// Unlike the cache, where a conflict means the write already happened,
					// a second artifact under one name is a mistake the caller must see.
					assert.strictEqual(error.reason, "refused");
				})
			);
		});
	}

	{
		const { transfer } = fileTransfer();
		const { calls, fetch } = twirpFetch({});
		const layer = protocol(fetch, transfer);
		it.layer(layer, { timeout: "30 seconds" })((it) => {
			it.effect("refuses an impossible retention, and an empty file list, without asking the backend", () =>
				Effect.gen(function* () {
					const fs = yield* FileSystem.FileSystem;
					const { join } = yield* Path.Path;
					const root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-artifact-test-" });
					yield* fs.writeFileString(join(root, "a.txt"), "x");

					const retention = yield* Effect.flip(
						Effect.flatMap(Artifact, (artifacts) =>
							artifacts.upload("logs", [join(root, "a.txt")], root, { retentionDays: 0 })
						)
					);
					assert.strictEqual(retention.reason, "invalidOptions");

					const empty = yield* Effect.flip(Effect.flatMap(Artifact, (artifacts) => artifacts.upload("logs", [], root)));
					assert.strictEqual(empty.reason, "invalidOptions");
					// Neither reserved a name for an upload that will never happen.
					assert.lengthOf(calls, 0);
				})
			);
		});
	}

	{
		const { transfer } = fileTransfer();
		const { calls, fetch } = twirpFetch({});
		it.layer(protocol(fetch, transfer), { timeout: "30 seconds" })((it) => {
			it.effect(
				"refuses a file path holding a line break on every platform, naming it, before anything is written",
				() =>
					Effect.gen(function* () {
						const fs = yield* FileSystem.FileSystem;
						const { join } = yield* Path.Path;
						const root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-artifact-test-" });
						// The Windows list travels one path per line; a break would split the
						// entry. Rejected on POSIX too, so an upload cannot pass on one runner
						// and fail on another.
						const broken = join(root, "a\nb.txt");
						yield* fs.writeFileString(broken, "x");

						const error = yield* Effect.flip(
							Effect.flatMap(Artifact, (artifacts) => artifacts.upload("logs", [broken], root))
						);
						assert.strictEqual(error.reason, "invalidOptions");
						assert.include(
							error.message,
							Result.getOrThrowWith(S.encodeResult(Json)("a\nb.txt"), (error) => error)
						);
						assert.lengthOf(calls, 0);
					})
			);
		});
	}

	{
		const { transfer } = fileTransfer();
		const { calls, fetch } = twirpFetch({});
		const spawns: Array<{
			readonly command: string;
			readonly args: ReadonlyArray<string>;
			readonly manifest: Buffer;
		}> = [];
		const spy = Layer.effect(
			ChildProcessSpawner.ChildProcessSpawner,
			Effect.map(FileSystem.FileSystem, (fs) =>
				ChildProcessSpawner.make((command) =>
					Effect.gen(function* () {
						if ("args" in command) {
							const script = command.args[3] ?? "";
							const manifestPath = /ReadAllLines\('([^']*)'\)/.exec(script)?.[1] ?? "";
							spawns.push({
								command: command.command,
								args: [...command.args],
								manifest: Buffer.from(yield* fs.readFile(manifestPath)),
							});
						}
						const bytes = new TextEncoder().encode("System.IO.IOException: disk full");
						return ChildProcessSpawner.makeHandle({
							pid: ChildProcessSpawner.ProcessId(4321),
							exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(1)),
							isRunning: Effect.succeed(false),
							kill: () => Effect.void,
							stdin: Sink.drain,
							stdout: Stream.empty,
							stderr: Stream.fromIterable([bytes]),
							all: Stream.fromIterable([bytes]),
							getInputFd: () => Sink.drain,
							getOutputFd: () => Stream.empty,
							unref: Effect.succeed(Effect.void),
						});
					})
				)
			)
		);
		const layer = artifactLayer(transfer).pipe(
			Layer.provide(spy),
			Layer.provideMerge(
				Layer.mergeAll(
					resultsEnv({ RUNNER_OS: "Windows" }),
					NodeServices.layer,
					FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch)(fetch)))
				)
			)
		);
		it.layer(layer, { timeout: "30 seconds" })((it) => {
			it.effect("Windows: writes the manifest beside the zip, BOM-free, before spawning the constant-size script", () =>
				Effect.gen(function* () {
					const fs = yield* FileSystem.FileSystem;
					const { join, dirname, basename } = yield* Path.Path;
					const root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-artifact-test-" });
					yield* fs.makeDirectory(join(root, "dir"), { recursive: true });
					yield* fs.writeFileString(join(root, "a.txt"), "a");
					yield* fs.writeFileString(join(root, "dir", "b.txt"), "b");

					// Records the spawn — and the manifest's bytes AT SPAWN TIME, since
					// the scratch directory holding it is gone once the upload settles —
					// then answers as a failed pwsh would, so nothing reaches the backend.

					const error = yield* Effect.flip(
						Effect.flatMap(Artifact, (artifacts) =>
							artifacts.upload("logs", [join(root, "a.txt"), join(root, "dir", "b.txt")], root)
						)
					);
					assert.strictEqual(error.reason, "archiveFailed");
					assert.strictEqual(error.stderr, "System.IO.IOException: disk full");
					assert.lengthOf(calls, 0);

					assert.lengthOf(spawns, 1);
					const [spawn] = spawns;
					assert.strictEqual(spawn?.command, "pwsh");
					const script = spawn?.args[3] ?? "";
					// The manifest sits beside the archive inside the scratch directory,
					// so the scratch release removes both.
					const zipPath = /ZipFile\]::Open\('([^']*)'/.exec(script)?.[1] ?? "";
					const manifestPath = /ReadAllLines\('([^']*)'\)/.exec(script)?.[1] ?? "";
					assert.strictEqual(manifestPath, join(dirname(zipPath), "artifact.manifest"));
					assert.strictEqual(basename(zipPath), "artifact.zip");
					// One relative path per line, trailing newline, and NO BOM — .NET's
					// `ReadAllLines` would otherwise prefix the first path with it.
					assert.strictEqual(spawn?.manifest.toString("utf8"), `a.txt\n${join("dir", "b.txt")}\n`);
					assert.notDeepEqual([...(spawn?.manifest.subarray(0, 3) ?? [])], [0xef, 0xbb, 0xbf]);
					// The script itself never names a file: its size is independent of the list.
					assert.notInclude(script, "a.txt");
					assert.notInclude(script, "b.txt");
				})
			);
		});
	}

	{
		const { transfer } = fileTransfer();
		const { calls, fetch } = twirpFetch(uploadable);
		it.layer(live(fetch, transfer), { timeout: "30 seconds" })((it) => {
			it.effect("carries a retention as an expiry the backend understands", () =>
				Effect.gen(function* () {
					const fs = yield* FileSystem.FileSystem;
					const { join } = yield* Path.Path;
					const root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-artifact-test-" });
					yield* fs.writeFileString(join(root, "a.txt"), "x");

					yield* Effect.flatMap(Artifact, (artifacts) =>
						artifacts.upload("logs", [join(root, "a.txt")], root, { retentionDays: 7 })
					);
					const expiry = calls.find((call) => call.method === "FinalizeArtifact")?.body.expiresAt;
					assert.isString(expiry);
					assert.isAbove(Date.parse(String(expiry)), yield* Clock.currentTimeMillis);
				})
			);
		});
	}

	{
		const { transfer } = fileTransfer();
		const { calls, fetch } = twirpFetch(uploadable);
		it.layer(live(fetch, transfer), { timeout: "30 seconds" })((it) => {
			it.effect("omits the expiry entirely when no retention is asked for", () =>
				Effect.gen(function* () {
					const fs = yield* FileSystem.FileSystem;
					const { join } = yield* Path.Path;
					const root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-artifact-test-" });
					// Present-but-undefined is not the same as absent on the wire: the
					// backend would read a null expiry as "expire now".
					yield* fs.writeFileString(join(root, "a.txt"), "x");

					yield* Effect.flatMap(Artifact, (artifacts) => artifacts.upload("logs", [join(root, "a.txt")], root));
					assert.notProperty(calls.find((call) => call.method === "FinalizeArtifact")?.body ?? {}, "expiresAt");
				})
			);
		});
	}

	{
		const { transfer } = fileTransfer();
		const { fetch } = twirpFetch({ ListArtifacts: () => json({ artifacts: [] }) });
		const layer = protocol(fetch, transfer);
		it.layer(layer, { timeout: "30 seconds" })((it) => {
			it.effect("fails typed when an id or a name is not in this run", () =>
				Effect.gen(function* () {
					const download = yield* Effect.flip(Effect.flatMap(Artifact, (artifacts) => artifacts.download(99)));
					assert.strictEqual(download.reason, "notFound");
					const removal = yield* Effect.flip(Effect.flatMap(Artifact, (artifacts) => artifacts.delete("absent")));
					assert.strictEqual(removal.reason, "notFound");
				})
			);
		});
	}

	{
		const { transfer } = fileTransfer();
		const { calls, fetch } = twirpFetch({
			ListArtifacts: () => json({ artifacts: [{ databaseId: "11", name: "logs", size: "1" }] }),
			DeleteArtifact: () => json({ ok: true, artifact_id: "11" }),
		});
		it.layer(protocol(fetch, transfer), { timeout: "30 seconds" })((it) => {
			it.effect("deletes by name and answers with the id that is gone", () =>
				Effect.gen(function* () {
					const gone = yield* Effect.flatMap(Artifact, (artifacts) => artifacts.delete("logs"));
					assert.strictEqual(gone.id, 11);
					assert.deepStrictEqual(
						calls.map((call) => call.method),
						["ListArtifacts", "DeleteArtifact"]
					);
				})
			);
		});
	}

	{
		const { transfer } = fileTransfer();
		const { fetch } = twirpFetch({});
		it.layer(protocol(fetch, transfer, { ACTIONS_RESULTS_URL: "" }), { timeout: "30 seconds" })((it) => {
			it.effect("names the missing variable outside a `uses:` step", () =>
				Effect.gen(function* () {
					const error = yield* Effect.flip(Effect.flatMap(Artifact, (artifacts) => artifacts.list));
					assert.strictEqual(error.reason, "misconfigured");
					assert.include(error.message, "ACTIONS_RESULTS_URL");
				})
			);
		});
	}

	it.layer(Artifact.layerTest(), { timeout: "30 seconds" })("test double", (it) => {
		it.effect("an unstubbed member dies rather than reporting an empty run", () =>
			Effect.gen(function* () {
				const exit = yield* Effect.exit(Effect.flatMap(Artifact, (artifacts) => artifacts.list));
				assertExitFailure(
					exit,
					Exit.isFailure(exit) ? exit.cause : assert.fail("expected the unstubbed member to die")
				);
			})
		);
	});
});
