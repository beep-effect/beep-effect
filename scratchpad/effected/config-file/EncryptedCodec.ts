import { Duration, Effect, Exit, Schema } from "effect";
import type { ConfigCodec } from "./ConfigCodec.ts";
import type { CryptoFailure } from "./internal/crypto.ts";
import { IV_LENGTH, decrypt, deriveKey, encrypt, fromBase64, randomIv, toBase64 } from "./internal/crypto.ts";

/**
 * Indicates that an encryption, decryption, key-derivation or base64 step
 * failed.
 *
 * @remarks
 * Its own error rather than a value on the generic `ConfigCodecError.operation`
 * union, so an encryption-only concern does not leak into every codec's error
 * type. `cause` preserves the underlying host failure structurally.
 *
 * @public
 */
export class ConfigEncryptionError extends Schema.TaggedError<ConfigEncryptionError>()("ConfigEncryptionError", {
	/** Which cryptographic stage failed. */
	phase: Schema.Literals(["key-derivation", "encrypt", "decrypt", "encoding"]),
	/** The underlying failure, preserved structurally. */
	cause: Schema.Defect(),
}) {
	override get message(): string {
		return `Config encryption failed during ${this.phase}`;
	}
}

/** Lift `internal/crypto`'s dependency-free failure into the public error. */
const toPublic = (failure: CryptoFailure): ConfigEncryptionError =>
	new ConfigEncryptionError({ phase: failure.phase, cause: failure.cause });

/**
 * Key source union for {@link EncryptedCodec}.
 *
 * @remarks
 * Use {@link (EncryptedCodecKey:variable).fromCryptoKey} to supply a pre-derived
 * `CryptoKey`, or {@link (EncryptedCodecKey:variable).fromPassphrase} to derive
 * one via PBKDF2 at first use.
 *
 * @public
 */
export type EncryptedCodecKey =
	| { readonly _tag: "CryptoKey"; readonly key: Effect.Effect<CryptoKey, ConfigEncryptionError> }
	| { readonly _tag: "Passphrase"; readonly passphrase: string; readonly salt: Uint8Array };

/**
 * Convenience constructors for {@link (EncryptedCodecKey:type)}.
 *
 * @public
 */
export const EncryptedCodecKey = {
	/**
	 * Use a pre-derived `CryptoKey` effect directly.
	 *
	 * @remarks
	 * The effect is resolved once per codec instance and its **success** is
	 * reused for every encrypt/decrypt operation. A failure or an interruption
	 * is not cached — the next operation resolves it again. Supply your own
	 * `Effect.retry` inside this effect to bound retries; wrap it in
	 * `Effect.cached` yourself if you want a failure to be terminal.
	 *
	 * A `throw` from it is a programmer bug and stays a defect; signal
	 * recoverable failure with `Effect.fail`.
	 */
	fromCryptoKey: (key: Effect.Effect<CryptoKey, ConfigEncryptionError>): EncryptedCodecKey => ({
		_tag: "CryptoKey",
		key,
	}),

	/**
	 * Derive a `CryptoKey` from a passphrase and salt via PBKDF2.
	 *
	 * @remarks
	 * Derivation runs lazily on the first encrypt/decrypt call. It is resolved
	 * once per codec instance and its **success** is reused for subsequent
	 * operations on that instance. A failure or an interruption is not cached —
	 * the next operation derives again.
	 */
	fromPassphrase: (passphrase: string, salt: Uint8Array): EncryptedCodecKey => ({
		_tag: "Passphrase",
		passphrase,
		salt,
	}),
} as const;

/** The key effect a codec instance resolves against, before memoization. */
const keyEffect = (keySource: EncryptedCodecKey): Effect.Effect<CryptoKey, ConfigEncryptionError> =>
	keySource._tag === "CryptoKey"
		? keySource.key
		: Effect.mapError(deriveKey(keySource.passphrase, keySource.salt), toPublic);

/**
 * Wrap any {@link (ConfigCodec:interface)} with AES-GCM encryption.
 *
 * @remarks
 * `stringify` serializes with the inner codec, generates a random 12-byte IV,
 * encrypts, prepends the IV to the ciphertext and base64-encodes the result.
 * `parse` reverses that: the first 12 bytes of the decoded envelope are the IV,
 * the remainder is the ciphertext, and the plaintext is handed to the inner
 * codec's `parse`.
 *
 * The error channel **widens** to `E | ConfigEncryptionError` rather than
 * flattening — the inner codec's failures stay distinguishable from
 * cryptographic ones.
 *
 * @example
 * ```ts
 * import { EncryptedCodec, EncryptedCodecKey, JsonCodec } from "./index.ts";
 *
 * const salt = new Uint8Array(16); // use a stored, random per-deployment salt
 * const codec = EncryptedCodec(JsonCodec, EncryptedCodecKey.fromPassphrase("correct horse", salt));
 * ```
 *
 * @public
 */
export function EncryptedCodec<E>(
	inner: ConfigCodec<E>,
	keySource: EncryptedCodecKey,
): ConfigCodec<E | ConfigEncryptionError> {
	const name = `encrypted(${inner.name})`;

	// Memoize so the key is resolved once per codec instance, even across forked
	// fibers.
	//
	// Only SUCCESS may be memoized. `Effect.cached` alone memoizes the whole
	// `Exit`, so an interrupt — a property of whichever caller's fiber touched
	// the key first, not of the key effect — would be replayed forever, outside
	// this codec's declared error channel and unrecoverable via `Effect.catch`.
	// Invalidating on any non-success exit lets the next caller resolve again.
	// Lazy either way: nothing runs until the first parse/stringify.
	const [resolveKey, invalidateKey] = Effect.runSync(
		Effect.cachedInvalidateWithTTL(keyEffect(keySource), Duration.infinity),
	);
	const getKey: Effect.Effect<CryptoKey, ConfigEncryptionError> = Effect.onExit(resolveKey, (exit) =>
		Exit.isSuccess(exit) ? Effect.void : invalidateKey,
	);

	return {
		name,
		parse: (raw) =>
			Effect.gen(function* () {
				// Validate the envelope before resolving the key: malformed input must
				// not be able to force a key resolution, which may be a KMS round-trip.
				const combined = yield* Effect.mapError(fromBase64(raw), toPublic);

				if (combined.length <= IV_LENGTH) {
					return yield* Effect.fail(
						new ConfigEncryptionError({ phase: "decrypt", cause: new Error("Ciphertext too short to contain IV") }),
					);
				}

				const key = yield* getKey;
				const iv = combined.slice(0, IV_LENGTH);
				const ciphertext = combined.slice(IV_LENGTH);
				const plaintext = yield* Effect.mapError(decrypt(key, iv, ciphertext), toPublic);

				return yield* inner.parse(new TextDecoder().decode(plaintext));
			}),
		stringify: (value) =>
			Effect.gen(function* () {
				const key = yield* getKey;
				const serialized = yield* inner.stringify(value);

				const encoded = new TextEncoder().encode(serialized);
				const iv = randomIv();
				const ciphertext = yield* Effect.mapError(encrypt(key, iv, encoded), toPublic);

				return yield* Effect.mapError(toBase64(iv, ciphertext), toPublic);
			}),
	};
}
