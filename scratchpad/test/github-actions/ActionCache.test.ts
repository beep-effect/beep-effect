import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure, assertNone, assertSome } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Hex from "effect/encoding/Hex";
import * as Path from "effect/Path";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import { FetchHttpClient } from "effect/http";
import { ChildProcessSpawner } from "effect/process";
import type { FileBlobTransfer } from "../../effected/github-actions/index.ts";
import { ActionCache, ActionCacheError, BlobTransferError, CacheKey } from "../../effected/github-actions/index.ts";
import { UnstubbedMemberError } from "../../effected/github-actions/internal/unstubbed.ts";
import { json, resultsEnv, twirpFetch } from "./results.ts";

/**
 * A transport that keeps whole files in memory.
 *
 * **Details**
 * Real bytes, not a recorded call: the round-trip test saves through `tar`,
 * deletes the originals and restores them, so what this map holds has to be an
 * archive a real `tar` will accept.
 */
const fileTransfer = (fs: FileSystem.FileSystem) => {
	const blobs = new Map<string, Uint8Array>();
	const transfer: FileBlobTransfer = {
		uploadFile: (url, file) =>
			fs.readFile(file).pipe(
				Effect.tap((bytes) =>
					Effect.sync(() => {
						blobs.set(url, bytes);
					})
				),
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
	};
	return { blobs, transfer };
};

/** The real filesystem and the real `tar`, over a stubbed backend and transport. */
const live = (fetch: typeof globalThis.fetch, transfer: FileBlobTransfer, env: Readonly<Record<string, string>> = {}) =>
	ActionCache.layerWith(transfer).pipe(
		Layer.provide(
			Layer.mergeAll(
				resultsEnv(env),
				NodeServices.layer,
				FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch)(fetch)))
			)
		)
	);

/** The digest `actions/cache` computes for the same path set. */
const versionOf = (paths: ReadonlyArray<string>) =>
	Crypto.Crypto.use((crypto) =>
		crypto.digest("SHA-256", new TextEncoder().encode([...paths, "gzip", "1.0"].join("|"))).pipe(Effect.map(Hex.encode))
	);

describe("ActionCache", () => {
	{
		const setup = Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const { join } = yield* Path.Path;
			const root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-cache-test-" });

			const file = join(root, "payload.txt");
			yield* fs.writeFileString(file, "cached contents");
			const url = "https://blob.example/archive?sig=abc";
			const { blobs, transfer } = fileTransfer(fs);
			const { fetch } = twirpFetch({
				CreateCacheEntry: () => json({ ok: true, signedUploadUrl: url }),
				FinalizeCacheEntryUpload: () => json({ ok: true }),
				GetCacheEntryDownloadURL: () => json({ ok: true, signedDownloadUrl: url, matched_key: "the-key" }),
			});
			return { root, file, url, blobs, transfer, fetch, layer: live(fetch, transfer) };
		});
		class Fixture1 extends Context.Service<Fixture1, Effect.Success<typeof setup>>()(
			"@beep/scratchpad/test/github-actions/ActionCache.test/Fixture1"
		) {}
		const fixtureLayer = Layer.effect(Fixture1, setup).pipe(Layer.provideMerge(NodeServices.layer));
		it.layer(Layer.unwrap(Effect.map(Fixture1, (fixture) => fixture.layer)).pipe(Layer.provideMerge(fixtureLayer)), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("round-trips real files through a real archive", () =>
				Effect.gen(function* () {
					const fs = yield* FileSystem.FileSystem;
					const { file, url, blobs } = yield* Fixture1;

					const cache = yield* ActionCache;
					yield* cache.save([file], "the-key");
					const matched = yield* cache.restore([file], "the-key");

					assertSome(matched, "the-key");
					assert.strictEqual(blobs.size, 1);
					// gzip's magic: what was uploaded is an archive, not a description of one.
					assert.deepStrictEqual([...(blobs.get(url) ?? []).slice(0, 2)], [0x1f, 0x8b]);
					assert.strictEqual(yield* fs.readFileString(file), "cached contents");
				})
			);
		});
	}

	{
		const setup = Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const { join } = yield* Path.Path;
			const root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-cache-test-" });

			const file = join(root, "gone.txt");
			yield* fs.writeFileString(file, "recovered");
			const url = "https://blob.example/a";
			const { transfer } = fileTransfer(fs);
			const { fetch } = twirpFetch({
				CreateCacheEntry: () => json({ ok: true, signedUploadUrl: url }),
				FinalizeCacheEntryUpload: () => json({ ok: true }),
				GetCacheEntryDownloadURL: () => json({ ok: true, signedDownloadUrl: url }),
			});
			return { root, file, url, transfer, fetch, layer: live(fetch, transfer) };
		});
		class Fixture2 extends Context.Service<Fixture2, Effect.Success<typeof setup>>()(
			"@beep/scratchpad/test/github-actions/ActionCache.test/Fixture2"
		) {}
		const fixtureLayer = Layer.effect(Fixture2, setup).pipe(Layer.provideMerge(NodeServices.layer));
		it.layer(Layer.unwrap(Effect.map(Fixture2, (fixture) => fixture.layer)).pipe(Layer.provideMerge(fixtureLayer)), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("restores a file the save archived and the caller then deleted", () =>
				Effect.gen(function* () {
					const fs = yield* FileSystem.FileSystem;
					const { file } = yield* Fixture2;

					yield* Effect.flatMap(ActionCache, (cache) => cache.save([file], "k"));
					yield* fs.remove(file);
					yield* Effect.flatMap(ActionCache, (cache) => cache.restore([file], "k"));
					// The whole claim of a cache, and the one an in-memory double cannot make.
					assert.strictEqual(yield* fs.readFileString(file), "recovered");
				})
			);
		});
	}

	{
		const setup = Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const { transfer } = fileTransfer(fs);
			const { calls, fetch } = twirpFetch({ GetCacheEntryDownloadURL: () => json({ ok: false }) });
			return { transfer, calls, fetch, layer: live(fetch, transfer) };
		});
		class Fixture3 extends Context.Service<Fixture3, Effect.Success<typeof setup>>()(
			"@beep/scratchpad/test/github-actions/ActionCache.test/Fixture3"
		) {}
		const fixtureLayer = Layer.effect(Fixture3, setup).pipe(Layer.provideMerge(NodeServices.layer));
		it.layer(Layer.unwrap(Effect.map(Fixture3, (fixture) => fixture.layer)).pipe(Layer.provideMerge(fixtureLayer)), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("derives the entry version from the paths, in the order given", () =>
				Effect.gen(function* () {
					const { calls } = yield* Fixture3;

					yield* Effect.flatMap(ActionCache, (cache) => cache.restore(["b", "a"], "k"));
					// Sorting the paths would be the obvious tidy-up and would compute a
					// version no other cache step in the workflow agrees with — the entry a
					// sibling `actions/cache` step wrote would simply never be found.
					assert.strictEqual(calls[0]?.body.version, yield* versionOf(["b", "a"]));
					assert.notStrictEqual(yield* versionOf(["b", "a"]), yield* versionOf(["a", "b"]));
				})
			);
		});
	}

	{
		const setup = Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const key = CacheKey.of("Linux", "pnpm-store", "abc123");
			const { transfer } = fileTransfer(fs);
			const { calls, fetch } = twirpFetch({ GetCacheEntryDownloadURL: () => json({ ok: false }) });
			return { key, transfer, calls, fetch, layer: live(fetch, transfer) };
		});
		class Fixture4 extends Context.Service<Fixture4, Effect.Success<typeof setup>>()(
			"@beep/scratchpad/test/github-actions/ActionCache.test/Fixture4"
		) {}
		const fixtureLayer = Layer.effect(Fixture4, setup).pipe(Layer.provideMerge(NodeServices.layer));
		it.layer(Layer.unwrap(Effect.map(Fixture4, (fixture) => fixture.layer)).pipe(Layer.provideMerge(fixtureLayer)), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("sends a CacheKey's own restore-key ladder", () =>
				Effect.gen(function* () {
					const { key, calls } = yield* Fixture4;

					yield* Effect.flatMap(ActionCache, (cache) => cache.restore(["x"], key));
					assert.strictEqual(calls[0]?.body.key, "Linux-pnpm-store-abc123");
					// Deriving the ladder at the call site is what every consumer re-invents
					// and gets subtly wrong; passing the key passes the ladder with it.
					assert.deepStrictEqual(calls[0]?.body.restore_keys, [...key.restoreKeys]);
				})
			);
		});
	}

	{
		const setup = Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			// The whole point of the ladder policy: the typed-key path must carry
			// it, or every consumer with a policy is back to hand-building the
			// restore-key list and bypassing CacheKey. The expected rungs are
			// LITERAL: an implementation that ignores the policy sends four
			// derived prefixes here, and asserting against `key.restoreKeys`
			// would agree with that mutant on both sides.
			const key = CacheKey.of("Linux", "X64", "v1hash", "main", "lockhash").withRestoreDepths([4, 3]);
			const { transfer } = fileTransfer(fs);
			const { calls, fetch } = twirpFetch({ GetCacheEntryDownloadURL: () => json({ ok: false }) });
			return { key, transfer, calls, fetch, layer: live(fetch, transfer) };
		});
		class Fixture5 extends Context.Service<Fixture5, Effect.Success<typeof setup>>()(
			"@beep/scratchpad/test/github-actions/ActionCache.test/Fixture5"
		) {}
		const fixtureLayer = Layer.effect(Fixture5, setup).pipe(Layer.provideMerge(NodeServices.layer));
		it.layer(Layer.unwrap(Effect.map(Fixture5, (fixture) => fixture.layer)).pipe(Layer.provideMerge(fixtureLayer)), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("hands a policy-carrying key's EXACT ladder through, not the derived prefixes", () =>
				Effect.gen(function* () {
					const { key, calls } = yield* Fixture5;

					yield* Effect.flatMap(ActionCache, (cache) => cache.restore(["x"], key));
					assert.strictEqual(calls[0]?.body.key, "Linux-X64-v1hash-main-lockhash");
					assert.deepStrictEqual(calls[0]?.body.restore_keys, ["Linux-X64-v1hash-main-", "Linux-X64-v1hash-"]);
				})
			);
		});
	}

	{
		const setup = Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			// The cache-bust mode: a stale partial hit is worse than a cold start,
			// so the body must carry an EMPTY restore_keys — an implementation
			// that reads the empty policy as "no policy" sends the two derived
			// prefixes here instead.
			const key = CacheKey.of("Linux", "pnpm-store", "abc123").withoutRestoreKeys();
			const { transfer } = fileTransfer(fs);
			const { calls, fetch } = twirpFetch({ GetCacheEntryDownloadURL: () => json({ ok: false }) });
			return { key, transfer, calls, fetch, layer: live(fetch, transfer) };
		});
		class Fixture6 extends Context.Service<Fixture6, Effect.Success<typeof setup>>()(
			"@beep/scratchpad/test/github-actions/ActionCache.test/Fixture6"
		) {}
		const fixtureLayer = Layer.effect(Fixture6, setup).pipe(Layer.provideMerge(NodeServices.layer));
		it.layer(Layer.unwrap(Effect.map(Fixture6, (fixture) => fixture.layer)).pipe(Layer.provideMerge(fixtureLayer)), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("sends ZERO restore keys for an exact-match-only key", () =>
				Effect.gen(function* () {
					const { key, calls } = yield* Fixture6;

					yield* Effect.flatMap(ActionCache, (cache) => cache.restore(["x"], key));
					assert.strictEqual(calls[0]?.body.key, "Linux-pnpm-store-abc123");
					assert.deepStrictEqual(calls[0]?.body.restore_keys, []);
				})
			);
		});
	}

	{
		const setup = Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const { transfer } = fileTransfer(fs);
			const { fetch } = twirpFetch({ GetCacheEntryDownloadURL: () => json({ ok: false }) });
			return { transfer, fetch, layer: live(fetch, transfer) };
		});
		class Fixture7 extends Context.Service<Fixture7, Effect.Success<typeof setup>>()(
			"@beep/scratchpad/test/github-actions/ActionCache.test/Fixture7"
		) {}
		const fixtureLayer = Layer.effect(Fixture7, setup).pipe(Layer.provideMerge(NodeServices.layer));
		it.layer(Layer.unwrap(Effect.map(Fixture7, (fixture) => fixture.layer)).pipe(Layer.provideMerge(fixtureLayer)), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("reports a miss as nothing", () =>
				Effect.gen(function* () {
					const found = yield* Effect.flatMap(ActionCache, (cache) => cache.restore(["x"], "k"));
					assertNone(found);
				})
			);
		});
	}

	{
		const setup = Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const { join } = yield* Path.Path;
			const root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-cache-test-" });

			const file = join(root, "f.txt");
			yield* fs.writeFileString(file, "x");
			const url = "https://blob.example/b";
			const { transfer } = fileTransfer(fs);
			const { fetch } = twirpFetch({
				CreateCacheEntry: () => json({ ok: true, signedUploadUrl: url }),
				FinalizeCacheEntryUpload: () => json({ ok: true }),
				GetCacheEntryDownloadURL: () => json({ ok: true, signedDownloadUrl: url, matchedKey: "Linux-pnpm-store-" }),
			});
			return { root, file, url, transfer, fetch, layer: live(fetch, transfer) };
		});
		class Fixture8 extends Context.Service<Fixture8, Effect.Success<typeof setup>>()(
			"@beep/scratchpad/test/github-actions/ActionCache.test/Fixture8"
		) {}
		const fixtureLayer = Layer.effect(Fixture8, setup).pipe(Layer.provideMerge(NodeServices.layer));
		it.layer(Layer.unwrap(Effect.map(Fixture8, (fixture) => fixture.layer)).pipe(Layer.provideMerge(fixtureLayer)), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("answers with the key that actually matched, not the one asked for", () =>
				Effect.gen(function* () {
					const { file } = yield* Fixture8;

					yield* Effect.flatMap(ActionCache, (cache) => cache.save([file], "primary"));
					const matched = yield* Effect.flatMap(ActionCache, (cache) => cache.restore([file], "primary", ["Linux-"]));
					// A hit on a restore key is a PARTIAL hit; a caller that cannot tell it
					// from an exact hit never re-saves and the cache never warms.
					assertSome(matched, "Linux-pnpm-store-");
				})
			);
		});
	}

	{
		const setup = Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const { transfer } = fileTransfer(fs);
			const { calls, fetch } = twirpFetch({});
			return { transfer, calls, fetch, layer: live(fetch, transfer) };
		});
		class Fixture9 extends Context.Service<Fixture9, Effect.Success<typeof setup>>()(
			"@beep/scratchpad/test/github-actions/ActionCache.test/Fixture9"
		) {}
		const fixtureLayer = Layer.effect(Fixture9, setup).pipe(Layer.provideMerge(NodeServices.layer));
		it.layer(Layer.unwrap(Effect.map(Fixture9, (fixture) => fixture.layer)).pipe(Layer.provideMerge(fixtureLayer)), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("refuses to save nothing, without asking the backend", () =>
				Effect.gen(function* () {
					const { calls } = yield* Fixture9;

					const error = yield* Effect.flip(Effect.flatMap(ActionCache, (cache) => cache.save([], "k")));
					assert.instanceOf(error, ActionCacheError);
					assert.strictEqual(error.reason, "archiveFailed");
					// Reserving an entry for an archive that will never exist leaves a key
					// that answers "present" and serves nothing.
					assert.lengthOf(calls, 0);
				})
			);
		});
	}

	{
		const setup = Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			// A missing path no longer reaches tar (resolution existence-filters
			// it), so the stderr channel is proved on the extract side: bytes that
			// are not a gzip archive.
			const corrupt: FileBlobTransfer = {
				uploadFile: () => Effect.void,
				downloadToFile: (_url, file) =>
					fs
						.writeFileString(file, "this is not an archive")
						.pipe(Effect.mapError((cause) => BlobTransferError.make({ reason: "downloadFailed", cause }))),
			};
			const { fetch } = twirpFetch({
				GetCacheEntryDownloadURL: () => json({ ok: true, signedDownloadUrl: "https://blob.example/junk" }),
			});
			return { corrupt, fetch, layer: live(fetch, corrupt) };
		});
		class Fixture10 extends Context.Service<Fixture10, Effect.Success<typeof setup>>()(
			"@beep/scratchpad/test/github-actions/ActionCache.test/Fixture10"
		) {}
		const fixtureLayer = Layer.effect(Fixture10, setup).pipe(Layer.provideMerge(NodeServices.layer));
		it.layer(Layer.unwrap(Effect.map(Fixture10, (fixture) => fixture.layer)).pipe(Layer.provideMerge(fixtureLayer)), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("fails with tar's own complaint when the archive cannot be extracted", () =>
				Effect.gen(function* () {
					const error = yield* Effect.flip(Effect.flatMap(ActionCache, (cache) => cache.restore(["x"], "k")));
					assert.strictEqual(error.reason, "archiveFailed");
					// The exit code says it failed; only stderr says why, and the difference
					// between "not in gzip format" and "tar is not installed" is the whole message.
					assert.isDefined(error.stderr);
				})
			);
		});
	}

	{
		const setup = Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const { join } = yield* Path.Path;
			const root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-cache-test-" });

			const file = join(root, "f.txt");
			yield* fs.writeFileString(file, "x");
			const { blobs, transfer } = fileTransfer(fs);
			const { calls, fetch } = twirpFetch({ CreateCacheEntry: () => new Response(null, { status: 409 }) });
			return { root, file, blobs, transfer, calls, fetch, layer: live(fetch, transfer) };
		});
		class Fixture11 extends Context.Service<Fixture11, Effect.Success<typeof setup>>()(
			"@beep/scratchpad/test/github-actions/ActionCache.test/Fixture11"
		) {}
		const fixtureLayer = Layer.effect(Fixture11, setup).pipe(Layer.provideMerge(NodeServices.layer));
		it.layer(Layer.unwrap(Effect.map(Fixture11, (fixture) => fixture.layer)).pipe(Layer.provideMerge(fixtureLayer)), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("treats a create conflict as a save that already happened", () =>
				Effect.gen(function* () {
					const { file, blobs, calls } = yield* Fixture11;

					yield* Effect.flatMap(ActionCache, (cache) => cache.save([file], "k"));
					assert.strictEqual(blobs.size, 0);
					assert.lengthOf(calls, 1);
				})
			);
		});
	}

	{
		const setup = Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const { join } = yield* Path.Path;
			const root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-cache-test-" });

			const file = join(root, "f.txt");
			yield* fs.writeFileString(file, "x");
			const { blobs, transfer } = fileTransfer(fs);
			const { fetch } = twirpFetch({
				CreateCacheEntry: () => json({ ok: true, signedUploadUrl: "https://blob.example/c" }),
				FinalizeCacheEntryUpload: () => json({ ok: false }),
			});
			return { root, file, blobs, transfer, fetch, layer: live(fetch, transfer) };
		});
		class Fixture12 extends Context.Service<Fixture12, Effect.Success<typeof setup>>()(
			"@beep/scratchpad/test/github-actions/ActionCache.test/Fixture12"
		) {}
		const fixtureLayer = Layer.effect(Fixture12, setup).pipe(Layer.provideMerge(NodeServices.layer));
		it.layer(Layer.unwrap(Effect.map(Fixture12, (fixture) => fixture.layer)).pipe(Layer.provideMerge(fixtureLayer)), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("fails when the upload is never finalized, even though every byte arrived", () =>
				Effect.gen(function* () {
					const { file, blobs } = yield* Fixture12;

					const error = yield* Effect.flip(Effect.flatMap(ActionCache, (cache) => cache.save([file], "k")));
					assert.strictEqual(blobs.size, 1, "the archive did arrive");
					assert.strictEqual(error.reason, "refused");
					assert.include(error.message, "FinalizeCacheEntryUpload");
				})
			);
		});
	}

	{
		const setup = Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const { join } = yield* Path.Path;
			const root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-cache-test-" });

			const file = join(root, "f.txt");
			yield* fs.writeFileString(file, "x");
			const failing: FileBlobTransfer = {
				uploadFile: () => Effect.fail(BlobTransferError.make({ reason: "uploadFailed" })),
				downloadToFile: () => Effect.fail(BlobTransferError.make({ reason: "downloadFailed" })),
			};
			const { fetch } = twirpFetch({
				CreateCacheEntry: () => json({ ok: true, signedUploadUrl: "https://blob.example/d" }),
			});
			return { root, file, failing, fetch, layer: live(fetch, failing) };
		});
		class Fixture13 extends Context.Service<Fixture13, Effect.Success<typeof setup>>()(
			"@beep/scratchpad/test/github-actions/ActionCache.test/Fixture13"
		) {}
		const fixtureLayer = Layer.effect(Fixture13, setup).pipe(Layer.provideMerge(NodeServices.layer));
		it.layer(Layer.unwrap(Effect.map(Fixture13, (fixture) => fixture.layer)).pipe(Layer.provideMerge(fixtureLayer)), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("distinguishes a transfer failure from a protocol failure", () =>
				Effect.gen(function* () {
					const { file } = yield* Fixture13;

					const error = yield* Effect.flip(Effect.flatMap(ActionCache, (cache) => cache.save([file], "k")));
					assert.strictEqual(error.reason, "transferFailed");
				})
			);
		});
	}

	{
		const setup = Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const { transfer } = fileTransfer(fs);
			const { fetch } = twirpFetch({});
			return { transfer, fetch, layer: live(fetch, transfer, { ACTIONS_RESULTS_URL: "" }) };
		});
		class Fixture14 extends Context.Service<Fixture14, Effect.Success<typeof setup>>()(
			"@beep/scratchpad/test/github-actions/ActionCache.test/Fixture14"
		) {}
		const fixtureLayer = Layer.effect(Fixture14, setup).pipe(Layer.provideMerge(NodeServices.layer));
		it.layer(Layer.unwrap(Effect.map(Fixture14, (fixture) => fixture.layer)).pipe(Layer.provideMerge(fixtureLayer)), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("names the variable that is missing outside a `uses:` step", () =>
				Effect.gen(function* () {
					const error = yield* Effect.flip(Effect.flatMap(ActionCache, (cache) => cache.restore(["x"], "k")));
					assert.strictEqual(error.reason, "misconfigured");
					assert.include(error.message, "ACTIONS_RESULTS_URL");
				})
			);
		});
	}

	describe("glob resolution on save", () => {
		/** A tree with two node_modules at different depths and a bystander file. */
		const tree = Effect.fn("tree")(function* (root: string) {
			const fs = yield* FileSystem.FileSystem;
			const { join } = yield* Path.Path;
			const aDep = join(root, "a", "node_modules", "pkg", "dep.txt");
			const bDep = join(root, "b", "node_modules", "dep.txt");
			const bystander = join(root, "src", "keep.ts");
			for (const file of [aDep, bDep, bystander]) {
				yield* fs.makeDirectory(join(file, ".."), { recursive: true });
				yield* fs.writeFileString(file, `contents of ${file}`);
			}
			return { aDep, bDep, bystander };
		});

		const backend = (url = "https://blob.example/resolved") =>
			twirpFetch({
				CreateCacheEntry: () => json({ ok: true, signedUploadUrl: url }),
				FinalizeCacheEntryUpload: () => json({ ok: true }),
				GetCacheEntryDownloadURL: () => json({ ok: true, signedDownloadUrl: url }),
			});

		{
			const setup = Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-cache-test-" });

				// The real-runner repro: `tar: **/node_modules: Cannot stat` — the
				// pattern must be resolved BEFORE tar, and a matched directory is
				// archived recursively (implicitDescendants stays off, as in
				// actions/toolkit cacheUtils.ts:48-70; tar's own recursion does the
				// descending). Handing the pattern to tar verbatim fails this test
				// with tar's exact production complaint.
				const { aDep, bDep, bystander } = yield* tree(root);
				const { transfer } = fileTransfer(fs);
				const { fetch } = backend();
				const scope = live(fetch, transfer);
				return { root, aDep, bDep, bystander, transfer, fetch, scope, layer: scope };
			});
			class Fixture15 extends Context.Service<Fixture15, Effect.Success<typeof setup>>()(
				"@beep/scratchpad/test/github-actions/ActionCache.test/Fixture15"
			) {}
			const fixtureLayer = Layer.effect(Fixture15, setup).pipe(Layer.provideMerge(NodeServices.layer));
			it.layer(Layer.unwrap(Effect.map(Fixture15, (fixture) => fixture.layer)).pipe(Layer.provideMerge(fixtureLayer)), {
				timeout: "30 seconds",
			})((it) => {
				it.effect("resolves `**/` patterns to real directories and archives them recursively", () =>
					Effect.gen(function* () {
						const fs = yield* FileSystem.FileSystem;
						const { join } = yield* Path.Path;
						const { root, aDep, bDep, bystander } = yield* Fixture15;

						yield* Effect.flatMap(ActionCache, (cache) => cache.save([`${root}/**/node_modules`], "k"));
						yield* fs.remove(join(root, "a"), { recursive: true });
						yield* fs.remove(join(root, "b"), { recursive: true });
						yield* fs.remove(bystander);
						yield* Effect.flatMap(ActionCache, (cache) => cache.restore([`${root}/**/node_modules`], "k"));
						assert.strictEqual(yield* fs.readFileString(aDep), `contents of ${aDep}`);
						assert.strictEqual(yield* fs.readFileString(bDep), `contents of ${bDep}`);
						// The bystander never matched, so the archive must not resurrect it.
						assert.isFalse(yield* fs.exists(bystander));
					})
				);
			});
		}

		{
			const setup = Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-cache-test-" });

				// actions/toolkit hashes the caller's un-resolved list on both
				// sides (getCacheVersion, cacheUtils.ts:136-159; cache.ts:689 and
				// :361) — restore resolves nothing, so hashing the RESOLVED list on
				// save would compute a version restore can never reproduce, and
				// every save would be an entry no restore finds.
				yield* tree(root);
				const literals = [`${root}/**/node_modules`, `${root}/src`];
				const { transfer } = fileTransfer(fs);
				const { calls, fetch } = backend();
				const scope = live(fetch, transfer);
				return { root, literals, transfer, calls, fetch, scope, layer: scope };
			});
			class Fixture16 extends Context.Service<Fixture16, Effect.Success<typeof setup>>()(
				"@beep/scratchpad/test/github-actions/ActionCache.test/Fixture16"
			) {}
			const fixtureLayer = Layer.effect(Fixture16, setup).pipe(Layer.provideMerge(NodeServices.layer));
			it.layer(Layer.unwrap(Effect.map(Fixture16, (fixture) => fixture.layer)).pipe(Layer.provideMerge(fixtureLayer)), {
				timeout: "30 seconds",
			})((it) => {
				it.effect("hashes the LITERAL pattern list into the version, on save AND restore", () =>
					Effect.gen(function* () {
						const { literals, calls } = yield* Fixture16;

						yield* Effect.flatMap(ActionCache, (cache) => cache.save(literals, "k"));
						yield* Effect.flatMap(ActionCache, (cache) => cache.restore(literals, "k"));
						const create = calls.find((call) => call.method === "CreateCacheEntry");
						const lookup = calls.find((call) => call.method === "GetCacheEntryDownloadURL");
						assert.strictEqual(create?.body.version, yield* versionOf(literals));
						assert.strictEqual(lookup?.body.version, yield* versionOf(literals));
					})
				);
			});
		}

		{
			const setup = Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const { join } = yield* Path.Path;
				const root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-cache-test-" });

				// Toolkit parity: the globber simply yields nothing for a pattern
				// with no matches — and for a LITERAL path that is not on disk,
				// which goes through the same existence filter
				// (internal-globber.ts:90-100). Neither is an error while anything
				// else matched.
				const file = join(root, "payload.txt");
				yield* fs.writeFileString(file, "kept");
				const { blobs, transfer } = fileTransfer(fs);
				const { fetch } = backend();
				return { root, file, blobs, transfer, fetch, layer: live(fetch, transfer) };
			});
			class Fixture17 extends Context.Service<Fixture17, Effect.Success<typeof setup>>()(
				"@beep/scratchpad/test/github-actions/ActionCache.test/Fixture17"
			) {}
			const fixtureLayer = Layer.effect(Fixture17, setup).pipe(Layer.provideMerge(NodeServices.layer));
			it.layer(Layer.unwrap(Effect.map(Fixture17, (fixture) => fixture.layer)).pipe(Layer.provideMerge(fixtureLayer)), {
				timeout: "30 seconds",
			})((it) => {
				it.effect("drops a pattern that matches nothing and saves the rest", () =>
					Effect.gen(function* () {
						const { join } = yield* Path.Path;
						const { root, file, blobs } = yield* Fixture17;

						yield* Effect.flatMap(ActionCache, (cache) =>
							cache.save([file, `${root}/nothing-*`, join(root, "absent-literal")], "k")
						);
						assert.strictEqual(blobs.size, 1, "the archive with the surviving path was uploaded");
					})
				);
			});
		}

		{
			const setup = Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-cache-test-" });

				const { transfer } = fileTransfer(fs);
				const { calls, fetch } = twirpFetch({});
				return { root, transfer, calls, fetch, layer: live(fetch, transfer) };
			});
			class Fixture18 extends Context.Service<Fixture18, Effect.Success<typeof setup>>()(
				"@beep/scratchpad/test/github-actions/ActionCache.test/Fixture18"
			) {}
			const fixtureLayer = Layer.effect(Fixture18, setup).pipe(Layer.provideMerge(NodeServices.layer));
			it.layer(Layer.unwrap(Effect.map(Fixture18, (fixture) => fixture.layer)).pipe(Layer.provideMerge(fixtureLayer)), {
				timeout: "30 seconds",
			})((it) => {
				it.effect("fails typed, before the backend, when nothing at all matches", () =>
					Effect.gen(function* () {
						const { root, calls } = yield* Fixture18;

						const error = yield* Effect.flip(
							Effect.flatMap(ActionCache, (cache) => cache.save([`${root}/nothing-*`], "k"))
						);
						assert.strictEqual(error.reason, "archiveFailed");
						assert.include(error.detail, "matched");
						// Reserving an entry for an archive that will never exist leaves a
						// key that answers "present" and serves nothing — same rule as the
						// empty input list, which is the toolkit's hard Path Validation
						// Error (cache.ts:662-666).
						assert.lengthOf(calls, 0);
					})
				);
			});
		}

		{
			const setup = Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-cache-test-" });

				// The canonical actions/cache idiom, exactly as a workflow writes it.
				const { aDep } = yield* tree(root);
				const { transfer } = fileTransfer(fs);
				const { fetch } = backend();
				const scope = live(fetch, transfer, { GITHUB_WORKSPACE: root });
				return { root, aDep, transfer, fetch, scope, layer: scope };
			});
			class Fixture19 extends Context.Service<Fixture19, Effect.Success<typeof setup>>()(
				"@beep/scratchpad/test/github-actions/ActionCache.test/Fixture19"
			) {}
			const fixtureLayer = Layer.effect(Fixture19, setup).pipe(Layer.provideMerge(NodeServices.layer));
			it.layer(Layer.unwrap(Effect.map(Fixture19, (fixture) => fixture.layer)).pipe(Layer.provideMerge(fixtureLayer)), {
				timeout: "30 seconds",
			})((it) => {
				it.effect("roots a relative pattern at GITHUB_WORKSPACE", () =>
					Effect.gen(function* () {
						const fs = yield* FileSystem.FileSystem;
						const { join } = yield* Path.Path;
						const { root, aDep } = yield* Fixture19;

						yield* Effect.flatMap(ActionCache, (cache) => cache.save(["**/node_modules"], "k"));
						yield* fs.remove(join(root, "a"), { recursive: true });
						yield* Effect.flatMap(ActionCache, (cache) => cache.restore(["**/node_modules"], "k"));
						assert.strictEqual(yield* fs.readFileString(aDep), `contents of ${aDep}`);
					})
				);
			});
		}

		{
			const setup = Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const { join } = yield* Path.Path;
				const root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-cache-test-" });

				const file = join(root, "payload.txt");
				yield* fs.writeFileString(file, "from home");
				const { blobs, transfer } = fileTransfer(fs);
				const { fetch } = backend();
				return { root, file, blobs, transfer, fetch, layer: live(fetch, transfer, { HOME: root }) };
			});
			class Fixture20 extends Context.Service<Fixture20, Effect.Success<typeof setup>>()(
				"@beep/scratchpad/test/github-actions/ActionCache.test/Fixture20"
			) {}
			const fixtureLayer = Layer.effect(Fixture20, setup).pipe(Layer.provideMerge(NodeServices.layer));
			it.layer(Layer.unwrap(Effect.map(Fixture20, (fixture) => fixture.layer)).pipe(Layer.provideMerge(fixtureLayer)), {
				timeout: "30 seconds",
			})((it) => {
				it.effect("expands a leading ~ against HOME", () =>
					Effect.gen(function* () {
						const { blobs } = yield* Fixture20;

						yield* Effect.flatMap(ActionCache, (cache) => cache.save(["~/payload.txt"], "k"));
						assert.strictEqual(blobs.size, 1);
					})
				);
			});
		}

		{
			const setup = Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-cache-test-" });

				const { aDep, bDep } = yield* tree(root);
				const { transfer } = fileTransfer(fs);
				const { fetch } = backend();
				const patterns = [`${root}/**/node_modules`, `!${root}/b/**`];
				const scope = live(fetch, transfer);
				return { root, aDep, bDep, transfer, fetch, patterns, scope, layer: scope };
			});
			class Fixture21 extends Context.Service<Fixture21, Effect.Success<typeof setup>>()(
				"@beep/scratchpad/test/github-actions/ActionCache.test/Fixture21"
			) {}
			const fixtureLayer = Layer.effect(Fixture21, setup).pipe(Layer.provideMerge(NodeServices.layer));
			it.layer(Layer.unwrap(Effect.map(Fixture21, (fixture) => fixture.layer)).pipe(Layer.provideMerge(fixtureLayer)), {
				timeout: "30 seconds",
			})((it) => {
				it.effect("a `!` exclusion filters what the includes matched", () =>
					Effect.gen(function* () {
						const fs = yield* FileSystem.FileSystem;
						const { join } = yield* Path.Path;
						const { root, aDep, bDep, patterns } = yield* Fixture21;

						yield* Effect.flatMap(ActionCache, (cache) => cache.save(patterns, "k"));
						yield* fs.remove(join(root, "a"), { recursive: true });
						yield* fs.remove(join(root, "b"), { recursive: true });
						yield* Effect.flatMap(ActionCache, (cache) => cache.restore(patterns, "k"));
						assert.strictEqual(yield* fs.readFileString(aDep), `contents of ${aDep}`);
						assert.isFalse(yield* fs.exists(bDep));
					})
				);
			});
		}

		/** The real spawner, recording each spawn's argv — and, when a `-T` flag is present, the named manifest's content AT SPAWN TIME, before the scratch directory is removed. */
		const spyingSpawner = () => {
			const spawns: Array<{ readonly args: ReadonlyArray<string>; readonly manifest?: string }> = [];
			const layer = Layer.effect(
				ChildProcessSpawner.ChildProcessSpawner,
				Effect.gen(function* () {
					const real = yield* ChildProcessSpawner.ChildProcessSpawner;
					const fs = yield* FileSystem.FileSystem;
					return {
						...real,
						spawn: Effect.fn("ChildProcessSpawner.ChildProcessSpawner.spawn")(function* (
							...spawnArgs: Parameters<typeof real.spawn>
						) {
							const [command] = spawnArgs;
							if ("args" in command) {
								const args = [...command.args];
								const flag = args.indexOf("-T");
								const manifestPath = flag === -1 ? undefined : args[flag + 1];
								spawns.push({
									args,
									...(manifestPath === undefined ? {} : { manifest: yield* fs.readFileString(manifestPath) }),
								});
							}
							return yield* real.spawn(...spawnArgs);
						}),
					};
				})
			).pipe(Layer.provide(NodeServices.layer));
			return { spawns, layer };
		};

		/** The real FileSystem with a live `readDirectory` call counter. */
		const countingFileSystem = () => {
			let reads = 0;
			const layer = Layer.effect(
				FileSystem.FileSystem,
				Effect.gen(function* () {
					const real = yield* FileSystem.FileSystem;
					return {
						...real,
						readDirectory: Effect.fn("FileSystem.FileSystem.readDirectory")(
							(...readArgs: Parameters<typeof real.readDirectory>) => {
								reads += 1;
								return real.readDirectory(...readArgs);
							}
						),
					};
				})
			).pipe(Layer.provide(NodeServices.layer));
			return { layer, reads: () => reads };
		};

		{
			const setup = Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const { join } = yield* Path.Path;
				const root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-cache-test-" });

				// ~2.7MB of resolved absolute paths: past Linux's ~2MB and
				// macOS's 1MB execve budgets, so handing the list to tar as
				// argv would die as E2BIG before tar even started — the
				// `${workspace}/**` shape at production scale.
				const segment = (label: string) => `${label}-${"x".repeat(180)}`;
				const deep = join(root, segment("d1"), segment("d2"), segment("d3"), segment("d4"));
				yield* fs.makeDirectory(deep, { recursive: true });
				const files: Array<string> = [];
				for (let index = 0; index < 2800; index += 1) {
					const file = join(deep, `file-${String(index).padStart(4, "0")}-${"y".repeat(180)}.txt`);
					yield* fs.writeFileString(file, `payload ${index}`);
					files.push(file);
				}
				assert.isAbove(
					files.reduce((total, file) => total + file.length + 1, 0),
					2_500_000,
					"the fixture must be big enough that argv would actually overflow"
				);

				const { transfer } = fileTransfer(fs);
				const { fetch } = backend();
				const spy = spyingSpawner();
				const scope = ActionCache.layerWith(transfer).pipe(
					Layer.provide(spy.layer),
					Layer.provide(
						Layer.mergeAll(
							resultsEnv({}),
							NodeServices.layer,
							FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch)(fetch)))
						)
					)
				);
				const pattern = `${deep}/*`;
				return { root, segment, deep, files, transfer, fetch, spy, scope, pattern, layer: scope };
			});
			class Fixture22 extends Context.Service<Fixture22, Effect.Success<typeof setup>>()(
				"@beep/scratchpad/test/github-actions/ActionCache.test/Fixture22"
			) {}
			const fixtureLayer = Layer.effect(Fixture22, setup).pipe(Layer.provideMerge(NodeServices.layer));
			it.layer(Layer.unwrap(Effect.map(Fixture22, (fixture) => fixture.layer)).pipe(Layer.provideMerge(fixtureLayer)), {
				timeout: "30 seconds",
			})((it) => {
				it.effect(
					"a resolution too large for argv reaches tar through a manifest file",
					() =>
						Effect.gen(function* () {
							const fs = yield* FileSystem.FileSystem;
							const { deep, files, spy, pattern } = yield* Fixture22;

							yield* Effect.flatMap(ActionCache, (cache) => cache.save([pattern], "k"));
							yield* fs.remove(deep, { recursive: true });
							yield* Effect.flatMap(ActionCache, (cache) => cache.restore([pattern], "k"));
							// The real-IO round trip held at manifest scale.
							assert.strictEqual(yield* fs.readFileString(files[0] ?? ""), "payload 0");
							assert.strictEqual(yield* fs.readFileString(files[2799] ?? ""), "payload 2799");

							// The create invocation carried `-T <manifest>` and not one
							// resolved path; the manifest listed every match.
							const create = spy.spawns.find((spawn) => spawn.args.includes("-T"));
							assert.isDefined(create, "tar was never invoked with a manifest");
							const resolvedSet = new Set(files);
							assert.isFalse(
								create?.args.some((arg) => resolvedSet.has(arg)),
								"resolved paths must not travel as argv"
							);
							const listed = (create?.manifest ?? "").split("\n").filter((line) => line !== "");
							assert.deepStrictEqual([...listed].sort(), [...files].sort());
						}),
					120_000
				);
			});
		}

		{
			const setup = Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const { join } = yield* Path.Path;
				const root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-cache-test-" });

				// A pnpm-store-shaped literal: a directory with real contents
				// that only tar's own recursion should ever descend into.
				const store = join(root, "store");
				yield* fs.makeDirectory(join(store, "v3"), { recursive: true });
				yield* fs.writeFileString(join(store, "v3", "entry.txt"), "stored");
				const { transfer } = fileTransfer(fs);
				const { fetch } = backend();
				const counting = countingFileSystem();
				const scope = ActionCache.layerWith(transfer).pipe(
					Layer.provide(counting.layer),
					Layer.provide(
						Layer.mergeAll(
							resultsEnv({}),
							NodeServices.layer,
							FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch)(fetch)))
						)
					)
				);
				return { root, store, transfer, fetch, counting, scope, layer: scope };
			});
			class Fixture23 extends Context.Service<Fixture23, Effect.Success<typeof setup>>()(
				"@beep/scratchpad/test/github-actions/ActionCache.test/Fixture23"
			) {}
			const fixtureLayer = Layer.effect(Fixture23, setup).pipe(Layer.provideMerge(NodeServices.layer));
			it.layer(Layer.unwrap(Effect.map(Fixture23, (fixture) => fixture.layer)).pipe(Layer.provideMerge(fixtureLayer)), {
				timeout: "30 seconds",
			})((it) => {
				it.effect("stat-and-admits a literal directory without enumerating it", () =>
					Effect.gen(function* () {
						const fs = yield* FileSystem.FileSystem;
						const { join } = yield* Path.Path;
						const { store, counting } = yield* Fixture23;

						yield* Effect.flatMap(ActionCache, (cache) => cache.save([store], "k"));
						yield* fs.remove(store, { recursive: true });
						yield* Effect.flatMap(ActionCache, (cache) => cache.restore([store], "k"));
						// The literal contributed the only search root, and no pattern can
						// match below it: admission comes from the stat alone, on save AND
						// restore — a store-sized literal must not cost a full enumeration
						// that can admit nothing. tar's recursion still archived the
						// contents, which is what the round trip above proves.
						assert.strictEqual(yield* fs.readFileString(join(store, "v3", "entry.txt")), "stored");
						assert.strictEqual(counting.reads(), 0, "a literal-only resolution must not enumerate the directory");
						// The control: a wildcard below the same root MUST enumerate —
						// proof the counter is live rather than the wrapper being blind.
						yield* Effect.flatMap(ActionCache, (cache) => cache.save([`${store}/**`], "k2"));
						assert.isAbove(counting.reads(), 0, "the toolkit-parity walk must survive for actual patterns");
					})
				);
			});
		}

		{
			const setup = Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-cache-test-" });

				// The engine refuses a pattern past its 64KB guard — the one way a
				// pattern fails to COMPILE rather than merely failing to match.
				const { transfer } = fileTransfer(fs);
				const { calls, fetch } = twirpFetch({});
				return { root, transfer, calls, fetch, layer: live(fetch, transfer) };
			});
			class Fixture24 extends Context.Service<Fixture24, Effect.Success<typeof setup>>()(
				"@beep/scratchpad/test/github-actions/ActionCache.test/Fixture24"
			) {}
			const fixtureLayer = Layer.effect(Fixture24, setup).pipe(Layer.provideMerge(NodeServices.layer));
			it.layer(Layer.unwrap(Effect.map(Fixture24, (fixture) => fixture.layer)).pipe(Layer.provideMerge(fixtureLayer)), {
				timeout: "30 seconds",
			})((it) => {
				it.effect("an uncompilable pattern fails typed, naming it", () =>
					Effect.gen(function* () {
						const { root, calls } = yield* Fixture24;

						const error = yield* Effect.flip(
							Effect.flatMap(ActionCache, (cache) => cache.save([`${root}/${"a".repeat(70_000)}`], "k"))
						);
						assert.strictEqual(error.reason, "archiveFailed");
						assert.include(error.detail, "not a usable glob pattern");
						assert.lengthOf(calls, 0);
					})
				);
			});
		}
	});

	it.layer(ActionCache.layerTest(), { timeout: "30 seconds" })("test double", (it) => {
		it.effect("an unstubbed member dies rather than reporting a miss", () =>
			Effect.gen(function* () {
				const exit = yield* Effect.exit(Effect.flatMap(ActionCache, (cache) => cache.restore(["x"], "k")));
				assertExitFailure(
					exit,
					Cause.die(
						UnstubbedMemberError.make({
							message: "ActionCache.makeTest: restore() was called but not stubbed — pass a `restore` override.",
						})
					)
				);
			})
		);
	});
});
