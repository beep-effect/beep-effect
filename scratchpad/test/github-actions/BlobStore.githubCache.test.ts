// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";
import type { DataBlobTransfer } from "../../effected/github-actions/index.ts";
import { BlobStore, BlobStoreError, BlobTransferError, GitHubCacheBlobStore } from "../../effected/github-actions/index.ts";
import { json, resultsEnv, settle, twirpFetch } from "./results.ts";

class Meta extends S.Class<Meta>("Meta")({ tag: S.String, durationMs: S.Finite }) {}

/** A transport that keeps what it was given, keyed by the url it was given it at. */
const memoryTransfer = () => {
	const blobs = new Map<string, Uint8Array>();
	const transfer: DataBlobTransfer = {
		uploadData: (url, data) =>
			Effect.sync(() => {
				blobs.set(url, data);
			}),
		downloadToBuffer: (url) =>
			Effect.suspend(() => {
				const found = blobs.get(url);
				return found === undefined
					? Effect.fail(BlobTransferError.make({ reason: "downloadFailed" }))
					: Effect.succeed(found);
			}),
	};
	return { blobs, transfer };
};

const store = (
	fetch: typeof globalThis.fetch,
	transfer: DataBlobTransfer,
	env: Layer.Layer<never> | ReturnType<typeof resultsEnv> = resultsEnv(),
) =>
	GitHubCacheBlobStore.layerWith(transfer).pipe(
		Layer.provide(
			Layer.mergeAll(env, FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch)(fetch)))),
		),
	);

describe("GitHubCacheBlobStore", () => {
	it.effect("names the missing variable rather than failing anonymously", () =>
		Effect.gen(function* () {
			// The single most common misuse: the results backend is injected into
			// `uses:` steps and not into `run:` steps, so the same code that works
			// inside a bundled action fails here — and the failure has to say which
			// variable is absent, because nothing else in the environment differs.
			const { fetch } = twirpFetch({});
			const error = yield* Effect.flip(
				Effect.flatMap(BlobStore, (blobs) => blobs.has("k")).pipe(
					Effect.provide(store(fetch, memoryTransfer().transfer, resultsEnv({ ACTIONS_RESULTS_URL: "" }))),
				),
			);
			assert.instanceOf(error, BlobStoreError);
			assert.strictEqual(error.reason, "misconfigured");
			assert.include(error.message, "ACTIONS_RESULTS_URL");
		}),
	);

	it.effect("puts through create → upload → finalize, at the url the RPC handed back", () =>
		Effect.gen(function* () {
			const { blobs, transfer } = memoryTransfer();
			const { calls, fetch } = twirpFetch({
				CreateCacheEntry: () => json({ ok: true, signed_upload_url: "https://blob.example/upload?sig=abc" }),
				FinalizeCacheEntryUpload: () => json({ ok: true, entry_id: "1" }),
			});
			yield* Effect.flatMap(BlobStore, (blobStore) =>
				blobStore.put(
					"build/1",
					{ metadata: Meta.make({ tag: "x", durationMs: 12 }), body: new Uint8Array([1, 2, 3]) },
					Meta,
				),
			).pipe(Effect.provide(store(fetch, transfer)));

			assert.deepStrictEqual(
				calls.map((call) => call.method),
				["CreateCacheEntry", "FinalizeCacheEntryUpload"],
			);
			// The url is the one the backend signed, not one this package composed.
			const uploaded = blobs.get("https://blob.example/upload?sig=abc");
			assert.isDefined(uploaded);
			// The finalized size is the size of the FRAMED bytes. Reporting the
			// caller's body length instead produces an entry the backend accepts and
			// then serves truncated.
			assert.strictEqual(calls[1]?.body.size_bytes, String(uploaded?.byteLength));
			assert.isAbove(uploaded?.byteLength ?? 0, 3);
		}),
	);

	it.effect("a missing runtime token is named too, and no request is made", () =>
		Effect.gen(function* () {
			const { calls, fetch } = twirpFetch({});
			const error = yield* Effect.flip(
				Effect.flatMap(BlobStore, (blobs) => blobs.has("k")).pipe(
					Effect.provide(store(fetch, memoryTransfer().transfer, resultsEnv({ ACTIONS_RUNTIME_TOKEN: "" }))),
				),
			);
			assert.include(error.message, "ACTIONS_RUNTIME_TOKEN");
			assert.lengthOf(calls, 0);
		}),
	);

	it.effect("appends the trailing slash the Twirp path needs and sends the token as a bearer", () =>
		Effect.gen(function* () {
			const { calls, fetch } = twirpFetch({
				GetCacheEntryDownloadURL: () => json({ ok: false }),
			});
			yield* Effect.flatMap(BlobStore, (blobs) => blobs.has("k")).pipe(
				Effect.provide(store(fetch, memoryTransfer().transfer)),
			);
			// `ACTIONS_RESULTS_URL` has no trailing slash in the fixture; without one
			// the path collapses to `…/twirpbasetwirp/…` and every RPC 404s.
			assert.strictEqual(
				calls[0]?.url,
				"https://results.example/twirpbase/twirp/github.actions.results.api.v1.CacheService/GetCacheEntryDownloadURL",
			);
			assert.include(calls[0]?.authorization ?? "", "Bearer ");
		}),
	);

	it.effect("round-trips metadata and body through the real envelope framing", () =>
		Effect.gen(function* () {
			const { transfer } = memoryTransfer();
			const url = "https://blob.example/one?sig=abc";
			const { fetch } = twirpFetch({
				CreateCacheEntry: () => json({ ok: true, signedUploadUrl: url }),
				FinalizeCacheEntryUpload: () => json({ ok: true }),
				GetCacheEntryDownloadURL: () => json({ ok: true, signedDownloadUrl: url }),
			});
			yield* Effect.gen(function* () {
				const blobStore = yield* BlobStore;
				yield* blobStore.put(
					"k",
					{ metadata: Meta.make({ tag: "turbo", durationMs: 4200 }), body: new Uint8Array([7, 8]) },
					Meta,
				);
				const found = yield* blobStore.get("k", Meta);
				assert.isTrue(O.isSome(found));
				if (O.isSome(found)) {
					assert.deepStrictEqual(found.value.metadata, Meta.make({ tag: "turbo", durationMs: 4200 }));
					assert.deepStrictEqual([...found.value.body], [7, 8]);
				}
			}).pipe(Effect.provide(store(fetch, transfer)));
		}),
	);

	it.effect("reads both the camelCase and the snake_case spelling of a signed url", () =>
		Effect.gen(function* () {
			// The backend is an internal protocol whose two halves disagree; reading
			// one spelling only presents as "the cache never hits", which is the
			// hardest cache failure to notice.
			const { transfer, blobs } = memoryTransfer();
			blobs.set("https://blob.example/snake", new Uint8Array([1]));
			const { fetch } = twirpFetch({
				GetCacheEntryDownloadURL: () => json({ ok: true, signed_download_url: "https://blob.example/snake" }),
			});
			assert.isTrue(
				yield* Effect.flatMap(BlobStore, (blobStore) => blobStore.has("k")).pipe(
					Effect.provide(store(fetch, transfer)),
				),
			);
		}),
	);

	it.effect("treats a create conflict as a write that already happened", () =>
		Effect.gen(function* () {
			// Two jobs racing on the same key: the entry is immutable, so the loser
			// got what it asked for and must not upload over it.
			const { blobs, transfer } = memoryTransfer();
			const { calls, fetch } = twirpFetch({ CreateCacheEntry: () => new Response(null, { status: 409 }) });
			yield* Effect.flatMap(BlobStore, (blobStore) =>
				blobStore.put("k", { metadata: Meta.make({ tag: "x", durationMs: 1 }), body: new Uint8Array([1]) }, Meta),
			).pipe(Effect.provide(store(fetch, transfer)));
			assert.strictEqual(blobs.size, 0, "a conflicting create must not upload");
			assert.lengthOf(calls, 1, "and must not finalize either");
		}),
	);

	it.effect("fails typed when the create returns no upload url", () =>
		Effect.gen(function* () {
			const { fetch } = twirpFetch({ CreateCacheEntry: () => json({ ok: true }) });
			const error = yield* Effect.flip(
				Effect.flatMap(BlobStore, (blobStore) =>
					blobStore.put("k", { metadata: Meta.make({ tag: "x", durationMs: 1 }), body: new Uint8Array([1]) }, Meta),
				).pipe(Effect.provide(store(fetch, memoryTransfer().transfer))),
			);
			assert.strictEqual(error._tag, "BlobStoreError");
			assert.include(error.message, "CreateCacheEntry");
		}),
	);

	it.effect("fails when the upload is never finalized, even though every byte arrived", () =>
		Effect.gen(function* () {
			// Bytes in Azure that no lookup can find are worse than no write: the
			// caller believes the entry exists.
			const { blobs, transfer } = memoryTransfer();
			const { fetch } = twirpFetch({
				CreateCacheEntry: () => json({ ok: true, signedUploadUrl: "https://blob.example/x" }),
				FinalizeCacheEntryUpload: () => json({ ok: false }),
			});
			const error = yield* Effect.flip(
				Effect.flatMap(BlobStore, (blobStore) =>
					blobStore.put("k", { metadata: Meta.make({ tag: "x", durationMs: 1 }), body: new Uint8Array([1]) }, Meta),
				).pipe(Effect.provide(store(fetch, transfer))),
			);
			assert.strictEqual(blobs.size, 1);
			assert.include(error.message, "FinalizeCacheEntryUpload");
		}),
	);

	it.effect("reports a miss as nothing, and a transport failure as a failure", () =>
		Effect.gen(function* () {
			const miss = twirpFetch({ GetCacheEntryDownloadURL: () => json({ ok: false }) });
			assert.isTrue(
				O.isNone(
					yield* Effect.flatMap(BlobStore, (blobStore) => blobStore.get("absent", Meta)).pipe(
						Effect.provide(store(miss.fetch, memoryTransfer().transfer)),
					),
				),
			);

			// The url resolved but the bytes did not arrive. That is not a miss —
			// reporting it as one would silently discard a cache the runner has.
			const present = twirpFetch({
				GetCacheEntryDownloadURL: () => json({ ok: true, signedDownloadUrl: "https://blob.example/gone" }),
			});
			const error = yield* Effect.flip(
				Effect.flatMap(BlobStore, (blobStore) => blobStore.get("k", Meta)).pipe(
					Effect.provide(store(present.fetch, memoryTransfer().transfer)),
				),
			);
			assert.strictEqual(error._tag, "BlobStoreError");
		}),
	);

	describe("the retry policy", () => {
		it.effect("retries a 503 and succeeds", () =>
			Effect.gen(function* () {
				const { calls, fetch } = twirpFetch({
					GetCacheEntryDownloadURL: (_body, index) =>
						index === 0 ? new Response(null, { status: 503 }) : json({ ok: false }),
				});
				const exit = yield* settle(
					Effect.flatMap(BlobStore, (blobStore) => blobStore.has("k")).pipe(
						Effect.provide(store(fetch, memoryTransfer().transfer)),
					),
					TestClock.adjust("10 seconds"),
				);
				assert.isTrue(Exit.isSuccess(exit));
				assert.lengthOf(calls, 2, "a 503 is the backend saying `later`");
			}),
		);

		it.effect("does not retry a 400", () =>
			Effect.gen(function* () {
				const { calls, fetch } = twirpFetch({ GetCacheEntryDownloadURL: () => new Response(null, { status: 400 }) });
				const error = yield* Effect.flip(
					Effect.flatMap(BlobStore, (blobStore) => blobStore.has("k")).pipe(
						Effect.provide(store(fetch, memoryTransfer().transfer)),
					),
				);
				// Never sleeps, so this test needs no clock at all — which is itself
				// the assertion that a rejected request is not retried four times.
				assert.lengthOf(calls, 1);
				assert.strictEqual(error.reason === "refused" ? error.status : undefined, 400);
			}),
		);
	});
});
