import { encryptSecret } from "@beep/github/internal/crypto";
import { assert, describe, it } from "@effect/vitest";
import { blake2b } from "@noble/hashes/blake2.js";
import * as Base64 from "effect/encoding/Base64";
import * as EncodingError from "effect/encoding/EncodingError";
import * as Hex from "effect/encoding/Hex";
import * as Result from "effect/Result";
import nacl from "tweetnacl";

const PUBLIC_KEY_BYTES = 32;

const sealBytes = (publicKey: string, value: string): Uint8Array => {
  const sealed = Result.getOrThrow(encryptSecret(publicKey, value));
  return Result.getOrThrow(Base64.decode(sealed));
};

const b64 = (bytes: Uint8Array): string => Base64.encode(bytes);

describe("encryptSecret", () => {
  it("produces a sealed box the recipient can open", () => {
    const recipient = nacl.box.keyPair();
    const publicKey = b64(recipient.publicKey);

    const sealed = sealBytes(publicKey, "hunter2");

    const ephemeralPublicKey = sealed.subarray(0, PUBLIC_KEY_BYTES);
    const ciphertext = sealed.subarray(PUBLIC_KEY_BYTES);

    const nonceInput = new Uint8Array(PUBLIC_KEY_BYTES * 2);
    nonceInput.set(ephemeralPublicKey);
    nonceInput.set(recipient.publicKey, PUBLIC_KEY_BYTES);
    const nonce = blake2b(nonceInput, { dkLen: 24 });

    const opened = nacl.box.open(ciphertext, nonce, ephemeralPublicKey, recipient.secretKey);

    assert.isNotNull(opened, "the recipient derives the nonce from the two public keys alone");
    assert.strictEqual(new TextDecoder().decode(opened), "hunter2");
  });

  it("puts the ephemeral public key in the first 32 bytes", () => {
    const recipient = nacl.box.keyPair();
    const publicKey = b64(recipient.publicKey);

    const first = sealBytes(publicKey, "x").subarray(0, PUBLIC_KEY_BYTES);
    const second = sealBytes(publicKey, "x").subarray(0, PUBLIC_KEY_BYTES);

    assert.lengthOf(first, PUBLIC_KEY_BYTES);
    assert.notStrictEqual(b64(first), b64(second), "a reused ephemeral keypair would seal the same box twice");
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
    const nonce = blake2b(nonceInput, { dkLen: 24 });

    assert.isNull(nacl.box.open(ciphertext, nonce, ephemeralPublicKey, stranger.secretKey));
  });

  it("fails as a typed Result on a public key that is not base64", () => {
    const sealed = encryptSecret("!!! not base64 !!!", "hunter2");

    assert.strictEqual(Result.isFailure(sealed), true, "a typed failure lets the caller map it onto a GitHubError");
  });

  it("never returns the plaintext", () => {
    const recipient = nacl.box.keyPair();
    const publicKey = b64(recipient.publicKey);

    const text = Result.getOrThrow(encryptSecret(publicKey, "hunter2"));

    assert.notInclude(text, "hunter2");
    assert.notInclude(new TextDecoder().decode(sealBytes(publicKey, "hunter2")), "hunter2");
  });
});

describe("the sealed-box nonce is BLAKE2b with a 24-byte output length, not a sliced 64-byte digest", () => {
  it("matches the BLAKE2b-192 known answer for a 64-byte key pair input", () => {
    const input = Uint8Array.from({ length: PUBLIC_KEY_BYTES * 2 }, (_, index) => index);
    assert.strictEqual(
      Hex.encode(blake2b(input, { dkLen: 24 })),
      "aa054507b4916837a6d2b35b1ce7c525facdb7868ed55a8a",
      "known answer from CPython hashlib.blake2b(digest_size=24)"
    );
  });

  it("matches the BLAKE2b-192 known answer for the empty input", () => {
    assert.strictEqual(
      Hex.encode(blake2b(new Uint8Array(0), { dkLen: 24 })),
      "ab3b5331a7135ed50d0f182d026e60abdb3646fd51bcf8a3",
      "known answer from CPython hashlib.blake2b(digest_size=24)"
    );
  });
});

describe("encryptSecret key shape", () => {
  for (const size of [0, 31, 33]) {
    it(`returns an EncodingError Result for a ${size}-byte public key`, () => {
      const publicKey = b64(new Uint8Array(size));
      const sealed = encryptSecret(publicKey, "hunter2");
      assert.strictEqual(Result.isFailure(sealed), true);
      const error = sealed.pipe(Result.flip, Result.getOrThrow);
      assert.strictEqual(EncodingError.isEncodingError(error), true);
      assert.strictEqual(error.kind, "Decode");
      assert.strictEqual(error.module, "encryptSecret");
      assert.strictEqual(error.input, publicKey);
      assert.include(error.message, `got ${size} bytes`);
      assert.notInclude(error.message, "hunter2");
    });
  }
});
