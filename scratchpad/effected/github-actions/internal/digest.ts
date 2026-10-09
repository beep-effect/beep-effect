// The sanctioned `node:crypto` digests, spelled once.
//
// Core `Crypto` offers one-shot SHA digests over bytes already in memory, but
// no HMAC and no incremental hasher, so this package's licence for a `node:`
// import covers hashing. Keeping every
// `createHash` behind this module is what makes that licence auditable in one
// place rather than six, and keeps the streamed file digest — the shape a
// multi-gigabyte toolchain archive needs — from being re-derived per caller.

import { createHash } from "node:crypto";
import type { FileSystem, PlatformError } from "effect";
import { Effect, Stream } from "effect";
import * as Hex from "effect/encoding/Hex";

/** The raw SHA-256 of a string or byte array held in memory. @internal */
export const sha256 = (value: string | Uint8Array): Uint8Array =>
	new Uint8Array(createHash("sha256").update(value).digest());

/** The hex SHA-256 of a string or byte array held in memory. @internal */
export const sha256Hex = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");

/**
 * The raw digest of a file's bytes under `algorithm`, streamed rather than
 * buffered. Raw, because a caller that folds several file digests into one
 * (`CacheKey.hashFiles`, byte-compatible with the runner's `hashFiles()`)
 * hashes the digest BYTES, not their hex spelling.
 *
 * `algorithm` must be one `node:crypto` supports — every caller's grammar
 * admits only `sha1`/`sha256`/`sha384`/`sha512`, so `createHash` cannot throw.
 *
 * @internal
 */
export const digestFile = (
	fs: FileSystem.FileSystem,
	file: string,
	algorithm: string,
): Effect.Effect<Uint8Array, PlatformError.PlatformError> =>
	Effect.suspend(() => {
		const accumulator = createHash(algorithm);
		return Stream.runForEach(fs.stream(file), (chunk) =>
			Effect.sync(() => {
				accumulator.update(chunk);
			}),
		).pipe(Effect.map(() => new Uint8Array(accumulator.digest())));
	});

/** {@link digestFile}, as hex. @internal */
export const digestFileHex = (
	fs: FileSystem.FileSystem,
	file: string,
	algorithm: string,
): Effect.Effect<string, PlatformError.PlatformError> => Effect.map(digestFile(fs, file, algorithm), Hex.encode);
