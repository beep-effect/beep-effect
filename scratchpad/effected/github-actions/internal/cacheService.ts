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

import { $ScratchpadId } from "@beep/identity/packages";
import * as Bool from "effect/Boolean";
import * as S from "effect/Schema";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Function from "effect/Function";
import type { TwirpResult } from "./twirp.ts";
import { CONFLICT, isOk, stringField } from "./twirp.ts";

const $I = $ScratchpadId.create("effected/github-actions/internal/cacheService");

/**
 * The Twirp service the Actions cache protocol lives under.
 *
 * **Example** (Name the cache RPC service)
 *
 * ```ts
 * import { CACHE_SERVICE } from "@beep/scratchpad/effected/github-actions/internal/cacheService";
 *
 * console.log(CACHE_SERVICE) // github.actions.results.api.v1.CacheService
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const CACHE_SERVICE = "github.actions.results.api.v1.CacheService";

/**
 * How a caller reaches the cache service for one key: the RPC, already
 * mapped into the caller's error, and the caller's own `refused` error.
 * @internal
 * @category services
 * @since 0.0.0
 */
export interface CacheServiceClient<E> {
	readonly call: (method: string, body: Record<string, unknown>) => Effect.Effect<TwirpResult<unknown>, E>;
	readonly refused: (detail: string) => E;
}

/**
 * Reserve `(key, version)` for an upload. `Option.none()` means another job
 * saved this key first — entries are immutable, so the cache already holds
 * what the caller wanted and there is nothing left to do.
 * **Example** (Observe an existing cache reservation)
 *
 * ```ts
 * import { reserveUpload } from "@beep/scratchpad/effected/github-actions/internal/cacheService";
 * import * as O from "effect/Option";
 * import * as Effect from "effect/Effect";
 * import { CONFLICT } from "@beep/scratchpad/effected/github-actions/internal/twirp";
 *
 * const client = {
 *   call: () => Effect.succeed(CONFLICT),
 *   refused: (detail: string) => new Error(detail)
 * };
 *
 * const program = reserveUpload(client, "tool", "v1");
 * console.log(O.isNone(Effect.runSync(program))) // true
 * ```
 * @internal
 * @category commands
 * @since 0.0.0
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
		return Bool.match(!isOk(created) || url === undefined, {
			onTrue: () => Effect.fail(client.refused("CreateCacheEntry returned no upload url")),
			onFalse: () => Effect.succeed(O.fromUndefinedOr(url)),
		});
	}));

/**
 * Confirm an upload. Not folded in with the reservation: an unfinalized upload
 * leaves bytes in Azure that no lookup can reach — a silent no-op that reads
 * as a successful save — so it is a failure even though every byte arrived.
 * **Example** (Compose upload finalization)
 *
 * ```ts
 * import { finalizeUpload } from "@beep/scratchpad/effected/github-actions/internal/cacheService";
 * import * as Effect from "effect/Effect";
 * import { CONFLICT } from "@beep/scratchpad/effected/github-actions/internal/twirp";
 *
 * const client = {
 *   call: () => Effect.succeed(CONFLICT),
 *   refused: (detail: string) => new Error(detail)
 * };
 *
 * const program = finalizeUpload(client, "tool", "v1", 128);
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @internal
 * @category commands
 * @since 0.0.0
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
			Bool.match(finalized === CONFLICT || !isOk(finalized), {
				onTrue: () => Effect.fail(client.refused("FinalizeCacheEntryUpload did not confirm the upload")),
				onFalse: () => Effect.void,
			}),
	));

/**
 * A hit: where to download from, and which key in the ladder matched.
 *
 * **Example** (Validate CacheHit input)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import * as Console from "effect/Console";
 * import * as Effect from "effect/Effect";
 * import { CacheHit } from "@beep/scratchpad/effected/github-actions/internal/cacheService";
 *
 * const input = { url: "https://cache.example/blob", matchedKey: undefined };
 * Effect.runSync(Console.log(S.is(CacheHit)(input))) // true
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export const CacheHit = S.Struct({
	url: S.String.annotateKey({ description: "The signed download URL." }),
	/** Absent when the backend did not say; a caller treats that as the primary key. */
	matchedKey: S.UndefinedOr(S.String).annotateKey({ description: "The matched cache key; explicitly undefined when the backend did not say." }),
}).annotate($I.annote("CacheHit", { description: "A plain-object cache download location and the key that matched." }));

/**
 * The plain-object hit accepted by {@link CacheHit}.
 * @category type-level
 * @since 0.0.0
 */
export type CacheHit = typeof CacheHit.Type;

/**
 * The signed download url for a key, walking the restore-key ladder.
 * `Option.none()` is a miss, not a failure — a cold cache is the normal state.
 * **Example** (Observe a cold cache)
 *
 * ```ts
 * import { lookupDownload } from "@beep/scratchpad/effected/github-actions/internal/cacheService";
 * import * as O from "effect/Option";
 * import * as Effect from "effect/Effect";
 * import { CONFLICT } from "@beep/scratchpad/effected/github-actions/internal/twirp";
 *
 * const client = {
 *   call: () => Effect.succeed(CONFLICT),
 *   refused: (detail: string) => new Error(detail)
 * };
 *
 * const program = lookupDownload(client, "tool", ["fallback"], "v1");
 * console.log(O.isNone(Effect.runSync(program))) // true
 * ```
 * @internal
 * @category queries
 * @since 0.0.0
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
