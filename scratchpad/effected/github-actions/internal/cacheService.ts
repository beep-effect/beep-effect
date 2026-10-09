// The Actions `CacheService` choreography — reserve, upload, finalize; look up
// — spelled once for the two services that speak it.
//
// `ActionCache` files a tar archive under a path-derived version and
// `BlobStore.githubCache` files an envelope under a constant one, but the
// three RPCs between them and their conflict semantics are identical. Each
// caller supplies its own per-key `call` and its own `refused` constructor, so
// the errors stay the caller's; this module owns only the protocol. It reaches
// `effect` and the Twirp client and nothing heavier — the Azure transfer of
// the bytes between the two RPCs stays in the three modules licensed to import
// it (`__test__/reachability.test.ts`).

import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Function from "effect/Function";
import type { TwirpResult } from "./twirp.ts";
import { CONFLICT, isOk, stringField } from "./twirp.ts";

/** The Twirp service the Actions cache protocol lives under. @internal */
export const CACHE_SERVICE = "github.actions.results.api.v1.CacheService";

/**
 * How a caller reaches the cache service for one key: the RPC, already
 * mapped into the caller's error, and the caller's own `refused` error.
 *
 * @internal
 */
export interface CacheServiceClient<E> {
	readonly call: (method: string, body: Record<string, unknown>) => Effect.Effect<TwirpResult<unknown>, E>;
	readonly refused: (detail: string) => E;
}

/**
 * Reserve `(key, version)` for an upload. `Option.none()` means another job
 * saved this key first — entries are immutable, so the cache already holds
 * what the caller wanted and there is nothing left to do.
 *
 * @internal
 */
export const reserveUpload: {
	<E>(client: CacheServiceClient<E>, key: string, version: string): Effect.Effect<O.Option<string>, E>;
	(key: string, version: string): <E>(client: CacheServiceClient<E>) => Effect.Effect<O.Option<string>, E>;
} = Function.dual(3, <E>(
	client: CacheServiceClient<E>,
	key: string,
	version: string,
): Effect.Effect<O.Option<string>, E> =>
	Effect.flatMap(client.call("CreateCacheEntry", { key, version }), (created) => {
		if (created === CONFLICT) {
			return Effect.succeedNone;
		}
		const url = stringField(created, "signedUploadUrl");
		return !isOk(created) || url === undefined
			? Effect.fail(client.refused("CreateCacheEntry returned no upload url"))
			: Effect.succeedSome(url);
	}));

/**
 * Confirm an upload. Not folded in with the reservation: an unfinalized upload
 * leaves bytes in Azure that no lookup can reach — a silent no-op that reads
 * as a successful save — so it is a failure even though every byte arrived.
 *
 * @internal
 */
export const finalizeUpload: {
	<E>(client: CacheServiceClient<E>, key: string, version: string, sizeBytes: number | bigint): Effect.Effect<void, E>;
	(key: string, version: string, sizeBytes: number | bigint): <E>(client: CacheServiceClient<E>) => Effect.Effect<void, E>;
} = Function.dual(4, <E>(
	client: CacheServiceClient<E>,
	key: string,
	version: string,
	sizeBytes: number | bigint,
): Effect.Effect<void, E> =>
	Effect.flatMap(
		client.call("FinalizeCacheEntryUpload", { key, version, size_bytes: String(sizeBytes) }),
		(finalized) =>
			finalized === CONFLICT || !isOk(finalized)
				? Effect.fail(client.refused("FinalizeCacheEntryUpload did not confirm the upload"))
				: Effect.void,
	));

/** A hit: where to download from, and which key in the ladder matched. @internal */
export interface CacheHit {
	readonly url: string;
	/** Absent when the backend did not say; a caller treats that as the primary key. */
	readonly matchedKey: string | undefined;
}

/**
 * The signed download url for a key, walking the restore-key ladder.
 * `Option.none()` is a miss, not a failure — a cold cache is the normal state.
 *
 * @internal
 */
export const lookupDownload: {
	<E>(client: CacheServiceClient<E>, key: string, restoreKeys: ReadonlyArray<string>, version: string): Effect.Effect<O.Option<CacheHit>, E>;
	(key: string, restoreKeys: ReadonlyArray<string>, version: string): <E>(client: CacheServiceClient<E>) => Effect.Effect<O.Option<CacheHit>, E>;
} = Function.dual(4, <E>(
	client: CacheServiceClient<E>,
	key: string,
	restoreKeys: ReadonlyArray<string>,
	version: string,
): Effect.Effect<O.Option<CacheHit>, E> =>
	Effect.map(client.call("GetCacheEntryDownloadURL", { key, restore_keys: [...restoreKeys], version }), (found) => {
		if (found === CONFLICT || !isOk(found)) {
			return O.none();
		}
		const url = stringField(found, "signedDownloadUrl");
		return url === undefined ? O.none() : O.some({ url, matchedKey: stringField(found, "matchedKey") });
	}));
