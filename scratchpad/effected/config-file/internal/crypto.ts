/**
 * AES-GCM primitives over WebCrypto.
 *
 * @remarks
 * This module imports nothing from the rest of the package. `EncryptedCodec.ts`
 * imports these helpers, so a back-import of `ConfigEncryptionError` would close
 * a cycle that Biome's error-level `noImportCycles` rule rejects. Staying
 * dependency-free also keeps the module cheap to extract later.
 *
 * Failures surface as the plain {@link CryptoFailure} record; the public module
 * lifts them into `ConfigEncryptionError`.
 *
 * @internal
 */
import { Effect } from "effect";

/** AES-GCM's standard IV length, in bytes. @internal */
export const IV_LENGTH = 12;

/** Where a cryptographic step failed. @internal */
export type CryptoPhase = "key-derivation" | "encrypt" | "decrypt" | "encoding";

/** The internal failure shape. `EncryptedCodec.ts` maps this to `ConfigEncryptionError`. @internal */
export interface CryptoFailure {
	readonly phase: CryptoPhase;
	readonly cause: unknown;
}

/** Tag a caught host failure with the phase that produced it, preserving it by identity. */
const fail =
	(phase: CryptoPhase) =>
	(cause: unknown): CryptoFailure => ({ phase, cause });

/**
 * Copy a `Uint8Array` into a fresh `Uint8Array` backed by a plain `ArrayBuffer`,
 * which is required by Web Crypto APIs that accept `BufferSource`.
 *
 * @internal
 */
export function toArrayBufferView(src: Uint8Array): Uint8Array<ArrayBuffer> {
	const buf = new ArrayBuffer(src.length);
	const view = new Uint8Array(buf);
	view.set(src);
	return view;
}

/**
 * Derive an AES-GCM key from a passphrase via PBKDF2.
 *
 * @remarks
 * The caller memoizes this so PBKDF2 runs once per codec instance.
 *
 * @internal
 */
export const deriveKey = (passphrase: string, salt: Uint8Array): Effect.Effect<CryptoKey, CryptoFailure> =>
	Effect.tryPromise({
		try: async () => {
			const enc = new TextEncoder();
			const keyMaterial = await globalThis.crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, [
				"deriveKey",
			]);
			return await globalThis.crypto.subtle.deriveKey(
				{
					name: "PBKDF2",
					// Copy into ArrayBuffer-backed Uint8Array — required by PBKDF2Params.salt
					salt: toArrayBufferView(salt),
					// OWASP Password Storage Cheat Sheet, PBKDF2-HMAC-SHA256.
					// Derivation is memoized per codec instance, so the cost is paid once.
					iterations: 600_000,
					hash: "SHA-256",
				},
				keyMaterial,
				{ name: "AES-GCM", length: 256 },
				false,
				["encrypt", "decrypt"],
			);
		},
		catch: fail("key-derivation"),
	});

/**
 * Decode base64 into bytes.
 *
 * @remarks
 * `atob` is available in all modern environments (Node 20+, Bun, Deno).
 *
 * @internal
 */
export const fromBase64 = (raw: string): Effect.Effect<Uint8Array<ArrayBuffer>, CryptoFailure> =>
	Effect.try({
		try: () => {
			const binary = atob(raw);
			const buf = new ArrayBuffer(binary.length);
			const bytes = new Uint8Array(buf);
			for (let i = 0; i < binary.length; i++) {
				bytes[i] = binary.charCodeAt(i);
			}
			return bytes;
		},
		catch: fail("encoding"),
	});

/**
 * Prepend the IV to the ciphertext and base64-encode the envelope.
 *
 * @internal
 */
export const toBase64 = (iv: Uint8Array, ciphertext: ArrayBuffer): Effect.Effect<string, CryptoFailure> =>
	Effect.try({
		try: () => {
			const ciphertextBytes = new Uint8Array(ciphertext);
			const resultBuf = new ArrayBuffer(IV_LENGTH + ciphertextBytes.length);
			const result = new Uint8Array(resultBuf);
			result.set(iv, 0);
			result.set(ciphertextBytes, IV_LENGTH);
			return btoa(Array.from(result, (b) => String.fromCharCode(b)).join(""));
		},
		catch: fail("encoding"),
	});

/** Decrypt AES-GCM ciphertext under `iv`. @internal */
export const decrypt = (
	key: CryptoKey,
	iv: Uint8Array<ArrayBuffer>,
	ciphertext: Uint8Array<ArrayBuffer>,
): Effect.Effect<ArrayBuffer, CryptoFailure> =>
	Effect.tryPromise({
		try: () => globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext),
		catch: fail("decrypt"),
	});

/** Encrypt `plaintext` with AES-GCM under `iv`. @internal */
export const encrypt = (
	key: CryptoKey,
	iv: Uint8Array<ArrayBuffer>,
	plaintext: Uint8Array<ArrayBuffer>,
): Effect.Effect<ArrayBuffer, CryptoFailure> =>
	Effect.tryPromise({
		try: () => globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext),
		catch: fail("encrypt"),
	});

/** A fresh cryptographically random 12-byte IV. @internal */
export const randomIv = (): Uint8Array<ArrayBuffer> =>
	globalThis.crypto.getRandomValues(new Uint8Array(new ArrayBuffer(IV_LENGTH)));
