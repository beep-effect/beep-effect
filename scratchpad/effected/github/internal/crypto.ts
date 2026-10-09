import blakejs from "blakejs";
import { Result } from "effect";
import * as Base64 from "effect/encoding/Base64";
import type * as EncodingError from "effect/encoding/EncodingError";
import nacl from "tweetnacl";

// `blakejs` is CommonJS, and Node's cjs-module-lexer detects only PART of its
// export surface: `blake2b` resolves as a named import, and the other nine —
// `blake2bHex` included — do not, throwing "does not provide an export named"
// at runtime after a clean build.
//
// That asymmetry is worse than no named exports at all, because the first
// function you reach for works and the second does not. The default import is
// interop-safe for all ten, so it is what this uses regardless of which one is
// wanted. `crypto.test.ts` pins the detected set, so adding a call to one of the
// undetected functions fails there with an explanation instead of at runtime.
const { blake2b } = blakejs;

/** A sealed box opens with the recipient's key; the nonce is derived, not sent. */
const NONCE_BYTES = 24;
const PUBLIC_KEY_BYTES = 32;

const utf8 = new TextEncoder();

/**
 * Encrypt a secret with libsodium's sealed-box algorithm, the format GitHub's
 * secrets API requires.
 *
 * @remarks
 * A sealed box is `ephemeral_public_key (32 bytes) || ciphertext`. The sender
 * mints a throwaway keypair, derives the nonce deterministically from both
 * public keys, encrypts with `crypto_box`, and discards the ephemeral secret
 * key — so nobody, including this process a moment later, can decrypt what it
 * just wrote. Only the holder of `publicKey`'s private half can.
 *
 * The nonce is `blake2b(ephemeral_pk || recipient_pk, 24)`. It is **derived**
 * rather than random because the recipient has to recompute it from the two
 * public keys alone, having received no nonce alongside the box. Both the
 * concatenation order and the 24-byte length are fixed by the libsodium
 * specification — changing either produces a box GitHub accepts and cannot
 * decrypt, which is a silent failure that surfaces as a workflow reading a
 * corrupt secret rather than as an error here.
 *
 * ## Nothing here is Node-specific
 *
 * Base64 goes through core's `Base64` and text through `TextEncoder`, so this
 * module imports **no builtin**. That is deliberate: an earlier draft used
 * `node:buffer` and was the only thing in this package's reachable graph tying
 * it to a runtime — neither `blakejs` (pure JS; its `util` is a *relative*
 * file) nor `tweetnacl` (which feature-detects `getRandomValues` and falls back
 * to Node's `crypto` only when there is no WebCrypto) locks it.
 *
 * A malformed `publicKey` fails as a typed `Result` rather than throwing:
 * garbage from the API is input, and input failures are typed.
 *
 * @param publicKey - The repository, environment or organization public key,
 * base64, as returned by GitHub's `.../secrets/public-key` endpoints.
 * @param secretValue - The plaintext to seal.
 * @returns The sealed box, base64, ready to send as `encrypted_value`.
 *
 * @internal
 */
export const encryptSecret = (
	publicKey: string,
	secretValue: string,
): Result.Result<string, EncodingError.EncodingError> =>
	Result.map(Base64.decode(publicKey), (publicKeyBytes) => {
		const ephemeralKeyPair = nacl.box.keyPair();

		const nonceInput = new Uint8Array(PUBLIC_KEY_BYTES * 2);
		nonceInput.set(ephemeralKeyPair.publicKey);
		nonceInput.set(publicKeyBytes, PUBLIC_KEY_BYTES);
		const nonce = blake2b(nonceInput, undefined, NONCE_BYTES);

		const ciphertext = nacl.box(utf8.encode(secretValue), nonce, publicKeyBytes, ephemeralKeyPair.secretKey);

		const sealed = new Uint8Array(ephemeralKeyPair.publicKey.length + ciphertext.length);
		sealed.set(ephemeralKeyPair.publicKey);
		sealed.set(ciphertext, ephemeralKeyPair.publicKey.length);

		return Base64.encode(sealed);
	});
