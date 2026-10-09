import type * as FileSystem from "effect/FileSystem";
import type * as PlatformError from "effect/PlatformError";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import * as Function from "effect/Function";
import * as Hex from "effect/encoding/Hex";

// Effect Crypto cannot provide synchronous or incremental digests.
const { createHash } = process.getBuiltinModule("node:crypto");

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
export const digestFile: {
	(fs: FileSystem.FileSystem, file: string, algorithm: string): Effect.Effect<Uint8Array, PlatformError.PlatformError>;
	(file: string, algorithm: string): (fs: FileSystem.FileSystem) => Effect.Effect<Uint8Array, PlatformError.PlatformError>;
} = Function.dual(3, (
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
	}));

/** {@link digestFile}, as hex. @internal */
export const digestFileHex: {
	(fs: FileSystem.FileSystem, file: string, algorithm: string): Effect.Effect<string, PlatformError.PlatformError>;
	(file: string, algorithm: string): (fs: FileSystem.FileSystem) => Effect.Effect<string, PlatformError.PlatformError>;
} = Function.dual(3, (
	fs: FileSystem.FileSystem,
	file: string,
	algorithm: string,
): Effect.Effect<string, PlatformError.PlatformError> => Effect.map(digestFile(fs, file, algorithm), Hex.encode));
