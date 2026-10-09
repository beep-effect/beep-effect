import type * as FileSystem from "effect/FileSystem";
import type * as PlatformError from "effect/PlatformError";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import * as Function from "effect/Function";
import * as Hex from "effect/encoding/Hex";

// Effect Crypto cannot provide synchronous or incremental digests.
const { createHash } = process.getBuiltinModule("node:crypto");

/**
 * The raw SHA-256 of a string or byte array held in memory.
 *
 * **Example** (Hash in-memory bytes)
 *
 * ```ts
 * import { sha256 } from "@beep/scratchpad/effected/github-actions/internal/digest";
 *
 * console.log(sha256("hello").length) // 32
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const sha256 = (value: string | Uint8Array): Uint8Array =>
	new Uint8Array(createHash("sha256").update(value).digest());

/**
 * The hex SHA-256 of a string or byte array held in memory.
 *
 * **Example** (Hash text as hexadecimal)
 *
 * ```ts
 * import { sha256Hex } from "@beep/scratchpad/effected/github-actions/internal/digest";
 *
 * console.log(sha256Hex("hello")) // 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const sha256Hex = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");

/**
 * The raw digest of a file's bytes under `algorithm`, streamed rather than
 * buffered. Raw, because a caller that folds several file digests into one
 * (`CacheKey.hashFiles`, byte-compatible with the runner's `hashFiles()`)
 * hashes the digest BYTES, not their hex spelling.
 *
 * **Details**
 *
 * `algorithm` must be one `node:crypto` supports — every caller's grammar
 * admits only `sha1`/`sha256`/`sha384`/`sha512`, so `createHash` cannot throw.
 *
 * **Example** (Digest a supplied byte stream)
 *
 * ```ts
 * import { digestFile } from "@beep/scratchpad/effected/github-actions/internal/digest";
 * import * as Effect from "effect/Effect";
 * import * as FileSystem from "effect/FileSystem";
 * import * as Stream from "effect/Stream";
 *
 * const fs = FileSystem.makeNoop({
 *   stream: () => Stream.make(new TextEncoder().encode("hello")),
 * });
 * const digest = await Effect.runPromise(digestFile(fs, "/hello.txt", "sha256"));
 * console.log(digest.length) // 32
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
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

/**
 * Returns {@link digestFile} as a hexadecimal string.
 *
 * **Example** (Encode a streamed digest as hexadecimal)
 *
 * ```ts
 * import { digestFileHex } from "@beep/scratchpad/effected/github-actions/internal/digest";
 * import * as Effect from "effect/Effect";
 * import * as FileSystem from "effect/FileSystem";
 * import * as Stream from "effect/Stream";
 *
 * const fs = FileSystem.makeNoop({
 *   stream: () => Stream.make(new TextEncoder().encode("hello")),
 * });
 * console.log(await Effect.runPromise(digestFileHex(fs, "/hello.txt", "sha256"))) // 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const digestFileHex: {
	(fs: FileSystem.FileSystem, file: string, algorithm: string): Effect.Effect<string, PlatformError.PlatformError>;
	(file: string, algorithm: string): (fs: FileSystem.FileSystem) => Effect.Effect<string, PlatformError.PlatformError>;
} = Function.dual(3, (
	fs: FileSystem.FileSystem,
	file: string,
	algorithm: string,
): Effect.Effect<string, PlatformError.PlatformError> => Effect.map(digestFile(fs, file, algorithm), Hex.encode));
