// @effect-diagnostics asyncFunction:skip-file
import { assert, describe, it } from "@effect/vitest";
import blakejs from "blakejs";
import * as Result from "effect/Result";
import * as Base64 from "effect/encoding/Base64";
import nacl from "tweetnacl";
import { encryptSecret } from "../../effected/github/internal/crypto.ts";

const PUBLIC_KEY_BYTES = 32;

/** The sealed box, or a thrown assertion — the Result is the point elsewhere. */
const sealBytes = (publicKey: string, value: string): Uint8Array => {
	const sealed = Result.getOrThrow(encryptSecret(publicKey, value));
	return Result.getOrThrow(Base64.decode(sealed));
};

const b64 = (bytes: Uint8Array): string => Base64.encode(bytes);

const named = (namespace: Record<string, unknown>): ReadonlyArray<string> =>
	Object.keys(namespace).filter((key) => key !== "default" && key !== "module.exports");

describe("encryptSecret", () => {
	it("produces a sealed box the recipient can open", () => {
		const recipient = nacl.box.keyPair();
		const publicKey = b64(recipient.publicKey);

		const sealed = sealBytes(publicKey, "hunter2");

		// A sealed box is `ephemeral_public_key (32) || ciphertext`.
		const ephemeralPublicKey = sealed.subarray(0, PUBLIC_KEY_BYTES);
		const ciphertext = sealed.subarray(PUBLIC_KEY_BYTES);

		// The recipient recomputes the nonce from the two public keys alone,
		// having received no nonce alongside the box — which is why it is derived
		// rather than random.
		const nonceInput = new Uint8Array(PUBLIC_KEY_BYTES * 2);
		nonceInput.set(ephemeralPublicKey);
		nonceInput.set(recipient.publicKey, PUBLIC_KEY_BYTES);
		const nonce = blakejs.blake2b(nonceInput, undefined, 24);

		const opened = nacl.box.open(ciphertext, nonce, ephemeralPublicKey, recipient.secretKey);

		assert.isNotNull(opened);
		assert.strictEqual(new TextDecoder().decode(opened as Uint8Array), "hunter2");
	});

	it("puts the ephemeral public key in the first 32 bytes", () => {
		const recipient = nacl.box.keyPair();
		const publicKey = b64(recipient.publicKey);

		const first = sealBytes(publicKey, "x").subarray(0, PUBLIC_KEY_BYTES);
		const second = sealBytes(publicKey, "x").subarray(0, PUBLIC_KEY_BYTES);

		assert.lengthOf(first, PUBLIC_KEY_BYTES);
		// The keypair is ephemeral: encrypting the same plaintext twice must not
		// produce the same box, or the sender is reusing a keypair it promised to
		// discard.
		assert.notStrictEqual(b64(first), b64(second));
	});

	it("cannot be opened by a different recipient", () => {
		const recipient = nacl.box.keyPair();
		const stranger = nacl.box.keyPair();
		const publicKey = b64(recipient.publicKey);

		const sealed = sealBytes(publicKey, "hunter2");
		const ephemeralPublicKey = sealed.subarray(0, PUBLIC_KEY_BYTES);
		const ciphertext = sealed.subarray(PUBLIC_KEY_BYTES);

		const nonceInput = new Uint8Array(PUBLIC_KEY_BYTES * 2);
		nonceInput.set(ephemeralPublicKey);
		nonceInput.set(recipient.publicKey, PUBLIC_KEY_BYTES);
		const nonce = blakejs.blake2b(nonceInput, undefined, 24);

		assert.isNull(nacl.box.open(ciphertext, nonce, ephemeralPublicKey, stranger.secretKey));
	});

	it("fails as a typed Result on a public key that is not base64", () => {
		// Garbage from the API is INPUT. It fails typed rather than throwing, which
		// is what lets the caller map it onto a GitHubError instead of a defect.
		const sealed = encryptSecret("!!! not base64 !!!", "hunter2");

		assert.strictEqual(Result.isFailure(sealed), true);
	});

	it("never returns the plaintext", () => {
		const recipient = nacl.box.keyPair();
		const publicKey = b64(recipient.publicKey);

		const text = Result.getOrThrow(encryptSecret(publicKey, "hunter2"));

		assert.notInclude(text, "hunter2");
		assert.notInclude(new TextDecoder().decode(sealBytes(publicKey, "hunter2")), "hunter2");
	});
});

describe("the blakejs interop surface", () => {
	/**
	 * `blakejs` is CommonJS, and Node's cjs-module-lexer detects only **part** of
	 * its export surface. This pins exactly which part, so that adding a call to
	 * one of the undetected functions fails here with an explanation rather than
	 * at runtime with "does not provide an export named".
	 *
	 * The claim "blakejs has no named ESM exports" is **false** and was believed
	 * in two codebases: `blake2b` resolves as a named import perfectly well. It is
	 * the other nine that do not, which is far easier to trip over precisely
	 * because the first one you try works.
	 */
	it("detects blake2b as a named export and nothing else", async () => {
		const namespace = await import("blakejs");
		assert.deepStrictEqual(named(namespace), ["blake2b"]);
	});

	it("reaches every other function only through the default import", async () => {
		const namespace = await import("blakejs");
		const onDefault = Object.keys(namespace.default);

		// The one this package would reach for next, and the one that bit the
		// consumer this crypto was ported from.
		assert.include(onDefault, "blake2bHex");
		assert.notInclude(Object.keys(namespace), "blake2bHex");

		// Everything the module actually offers is on the default, which is why
		// the default import is the interop-safe form regardless of which
		// function you want.
		assert.isAbove(onDefault.length, named(namespace).length);
	});
});
