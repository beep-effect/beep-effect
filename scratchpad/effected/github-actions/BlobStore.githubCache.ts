import { BlobClient, BlockBlobClient } from "@azure/storage-blob";
import type * as S from "effect/Schema";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { HttpClient } from "effect/http";
import { ActionEnvironment } from "./ActionEnvironment.ts";
import { BlobEnvelope } from "./BlobEnvelope.ts";
import type { BlobStoreShape, StoredBlob } from "./BlobStore.ts";
import { BlobStore, BlobStoreError } from "./BlobStore.ts";
import type { DataBlobTransfer } from "./BlobTransfer.ts";
import { BlobTransferError } from "./BlobTransfer.ts";
import { misconfiguredDetail, resultsBackend } from "./internal/actionsResults.ts";
import type { CacheServiceClient } from "./internal/cacheService.ts";
import { CACHE_SERVICE, finalizeUpload, lookupDownload, reserveUpload } from "./internal/cacheService.ts";
import { sha256Hex } from "./internal/digest.ts";
import { twirpCall, twirpFailureFields } from "./internal/twirp.ts";

/**
 * The `version` every entry is filed under.
 *
 * @remarks
 * The cache protocol keys an entry on `(key, version)`, and `actions/cache`
 * derives the version from the *paths* it archives. A blob store has no paths —
 * the key is caller-supplied and the payload is opaque — so the version is a
 * constant, which is what makes any key map to a reproducible slot.
 *
 * It is deliberately **not** a format version: {@link BlobEnvelope} carries that
 * inside the blob, so a framing change is a clean miss rather than a key change
 * that strands every existing entry.
 */
const VERSION = sha256Hex("blobstore|1.0");

/**
 * The Azure half, ~15 lines and duplicated on purpose.
 *
 * @remarks
 * `@azure/storage-blob` may be imported by this module, `ActionCache` and
 * `Artifact` and by nothing else. Hoisting these two calls into a shared
 * `internal/` helper is exactly how the import would leak into the graph of a
 * module that only sets an output — so the three modules each carry their own,
 * and `__test__/reachability.test.ts` measures that they are the only three.
 */
const azure: DataBlobTransfer = {
	uploadData: (url, data) =>
		Effect.tryPromise({
			try: () => new BlockBlobClient(url).uploadData(data),
			catch: (cause) => BlobTransferError.make({ reason: "uploadFailed", cause }),
		}).pipe(Effect.asVoid),
	downloadToBuffer: (url) =>
		Effect.tryPromise({
			try: () => new BlobClient(url).downloadToBuffer(),
			catch: (cause) => BlobTransferError.make({ reason: "downloadFailed", cause }),
		}).pipe(Effect.map((buffer) => new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength))),
};

const make = (
	transfer: DataBlobTransfer,
): Effect.Effect<BlobStoreShape, never, HttpClient.HttpClient | ActionEnvironment> =>
	Effect.gen(function* () {
		const http = yield* HttpClient.HttpClient;
		// Resolved once, at construction, so every member's `R` is `never`.
		const env = yield* ActionEnvironment;

		const backend = resultsBackend(env).pipe(
			Effect.mapError(
				(name) =>
					BlobStoreError.make({ reason: "misconfigured", detail: misconfiguredDetail(name, "Actions results backend") }),
			),
		);

		/** The cache service, for one key: every failure names it. */
		const cacheService = (key: string): CacheServiceClient<BlobStoreError> => ({
			call: Effect.fn("call")(function*(method, body) {
					const { baseUrl, token } = yield* backend;
					return yield* twirpCall({ http, baseUrl, service: CACHE_SERVICE, token, method, body }).pipe(
						Effect.mapError((failure) => BlobStoreError.make({ ...twirpFailureFields(failure), key })),
					);
				}),
			refused: (detail) => BlobStoreError.make({ reason: "refused", key, detail }),
		});

		/** The signed download url for a key, or nothing — a miss is not a failure. */
		const download = (key: string) =>
			Effect.map(
				lookupDownload(cacheService(key), key, [], VERSION),
				O.map((hit) => hit.url),
			);

		const moved = (key: string) =>
			Effect.mapError((cause: BlobTransferError) => BlobStoreError.make({ reason: "unreachable", key, cause }));

		return {
			get: Effect.fn("get")(function*<A, I>(key: string, schema: S.Codec<A, I>) {
					const url = yield* download(key);
					if (O.isNone(url)) {
						return O.none<StoredBlob<A>>();
					}
					const bytes = yield* transfer.downloadToBuffer(url.value).pipe(moved(key));
					return O.some(yield* Effect.fromResult(BlobEnvelope.decodeResult(bytes, schema)));
				}),

			put: Effect.fn("put")(function*<A, I>(key: string, blob: StoredBlob<A>, schema: S.Codec<A, I>) {
					const framed = yield* Effect.fromResult(BlobEnvelope.encodeResult(blob.metadata, blob.body, schema));
					const service = cacheService(key);
					// None: another job wrote this key first. The entry is immutable,
					// so the write has already happened and the caller got what it
					// asked for.
					const url = yield* reserveUpload(service, key, VERSION);
					if (O.isNone(url)) {
						return;
					}
					yield* transfer.uploadData(url.value, framed).pipe(moved(key));
					yield* finalizeUpload(service, key, VERSION, framed.byteLength);
				}),

			has: (key: string) => Effect.map(download(key), O.isSome),
		} satisfies BlobStoreShape;
	});

/**
 * The {@link BlobStore} backend that stores blobs in the runner's own Actions
 * cache.
 *
 * @remarks
 * The Actions cache is reachable over a Twirp v2 protocol at
 * `ACTIONS_RESULTS_URL`, which answers a `CreateCacheEntry` /
 * `GetCacheEntryDownloadURL` RPC with a **pre-signed Azure blob url** — which is
 * why this backend lives in its own module rather than beside the S3 one: it,
 * `ActionCache` and `Artifact` are the only three modules that import the
 * Azure client.
 *
 * **Only reachable from a `uses:` step.** The runner injects
 * `ACTIONS_RESULTS_URL` and `ACTIONS_RUNTIME_TOKEN` into action execution
 * contexts and not into `run:` shell steps, so a program that works when
 * invoked from a bundled action fails as `misconfigured` when the same code is
 * run by `node ./main.js` in a workflow step. The failure names the variable
 * for exactly that reason.
 *
 * The layer statics live here rather than on {@link BlobStore} because a static
 * belongs to the module that owns the dependency it needs: putting
 * `BlobStore.layerGitHubCache` on the service class would make `@azure/storage-blob`
 * reachable from every module that reads a blob.
 *
 * @example
 * ```ts
 * import { GitHubCacheBlobStore } from "./index.ts";
 *
 * const layer = GitHubCacheBlobStore.layer;
 * ```
 *
 * @public
 */
export class GitHubCacheBlobStore {
	private constructor() {}

	/**
	 * The backend, over the real Azure client.
	 *
	 * @remarks
	 * Requires `ActionEnvironment` for `ACTIONS_RESULTS_URL` and
	 * `ACTIONS_RUNTIME_TOKEN`; fails with `BlobStoreError` (`misconfigured`) when
	 * either is absent.
	 */
	static readonly layer: Layer.Layer<BlobStore, never, HttpClient.HttpClient | ActionEnvironment> = Layer.effect(
		BlobStore,
		make(azure),
	);

	/**
	 * The backend, over a supplied transport.
	 *
	 * @remarks
	 * The Twirp protocol — the RPC sequence, the conflict handling, the retry
	 * policy, the framing — is what this package owns and what a test needs to
	 * exercise; the Azure client is a pre-signed `PUT` that owns none of it. This
	 * is also the seam an integration test uses to point the same protocol at a
	 * local blob endpoint.
	 *
	 * A parameterized layer factory mints a fresh layer per call and layers
	 * memoize by reference — bind it to a `const` rather than calling it at each
	 * composition site.
	 */
	static readonly layerWith = (
		transfer: DataBlobTransfer,
	): Layer.Layer<BlobStore, never, HttpClient.HttpClient | ActionEnvironment> =>
		Layer.effect(BlobStore, make(transfer));
}
