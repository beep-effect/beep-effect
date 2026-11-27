import { $ConfigFileId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $ConfigFileId.create("internal/crypto");

const owaspPbkdf2Sha256Iterations = 600_000;

/**
 * AES-GCM's standard IV length, in bytes.
 *
 * **Example** (Inspect the AES-GCM IV length)
 *
 * ```ts
 * import { IV_LENGTH } from "@beep/config-file/internal/crypto";
 *
 * console.log(IV_LENGTH); // 12
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const IV_LENGTH = 12;

/**
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const CryptoPhase = LiteralKit(["key-derivation", "encrypt", "decrypt", "encoding"]).pipe(
  $I.annoteSchema("CryptoPhase", { description: "Where a cryptographic step failed." })
);

/**
 * Decoded value produced by {@link (CryptoPhase:variable)}.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type CryptoPhase = typeof CryptoPhase.Type;

/**
 * The internal failure shape. `EncryptedCodec.ts` maps this to `ConfigEncryptionError`.
 *
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class CryptoFailure extends S.Opaque<CryptoFailure, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The host failure, preserved structurally. */
    cause: S.Defect().pipe(
      $I.annoteKey("CryptoFailure.cause", { description: "The host failure, preserved structurally." })
    ),
    /** The cryptographic step that failed. */
    phase: CryptoPhase.pipe(
      $I.annoteKey("CryptoFailure.phase", { description: "The cryptographic step that failed." })
    ),
  }).pipe(
    $I.annoteSchema("CryptoFailure", { description: "A cryptographic step's failure, before it is made public." })
  )
) {}

const fail =
  (phase: CryptoPhase) =>
  (cause: unknown): CryptoFailure =>
    CryptoFailure.make({ phase, cause });

/**
 * Copy a `Uint8Array` into a fresh `Uint8Array` backed by a plain `ArrayBuffer`,
 * which is required by Web Crypto APIs that accept `BufferSource`.
 *
 * **Example** (Copy bytes for Web Crypto)
 *
 * ```ts
 * import { toArrayBufferView } from "@beep/config-file/internal/crypto";
 *
 * const source = new Uint8Array([1, 2, 3]);
 * const copy = toArrayBufferView(source);
 * source[0] = 9;
 * console.log(copy[0], copy.buffer instanceof ArrayBuffer); // 1 true
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
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
 * **Details**
 *
 * The caller memoizes this so PBKDF2 runs once per codec instance.
 *
 * **Example** (Derive a non-extractable encryption key)
 *
 * ```ts
 * import { deriveKey } from "@beep/config-file/internal/crypto";
 * import * as Effect from "effect/Effect";
 *
 * const key = await Effect.runPromise(deriveKey("example-passphrase", new Uint8Array(16)));
 * console.log(key.type, key.extractable); // secret false
 * ```
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const deriveKey: {
  (salt: Uint8Array): (passphrase: string) => Effect.Effect<CryptoKey, CryptoFailure>;
  (passphrase: string, salt: Uint8Array): Effect.Effect<CryptoKey, CryptoFailure>;
} = dual(
  2,
  (passphrase: string, salt: Uint8Array): Effect.Effect<CryptoKey, CryptoFailure> =>
    Effect.tryPromise({
      try: () => {
        const enc = new TextEncoder();
        return globalThis.crypto.subtle
          .importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"])
          .then((keyMaterial) =>
            globalThis.crypto.subtle.deriveKey(
              {
                name: "PBKDF2",
                salt: toArrayBufferView(salt),
                iterations: owaspPbkdf2Sha256Iterations,
                hash: "SHA-256",
              },
              keyMaterial,
              { name: "AES-GCM", length: 256 },
              false,
              ["encrypt", "decrypt"]
            )
          );
      },
      catch: fail("key-derivation"),
    })
);

/**
 * The PBKDF2 key derivation a passphrase-keyed codec resolves its key with.
 *
 * **Details**
 *
 * Defaults to {@link deriveKey}. It is read from the fiber that first resolves
 * a codec's key, so a test can wrap the real derivation with
 * `Effect.provideService` and count PBKDF2 runs per codec instance without a
 * global spy. That count stays exact while other tests derive keys concurrently.
 *
 * **Example** (Count the PBKDF2 derivations of one program)
 *
 * ```ts
 * import { deriveKey, PassphraseKeyDerivation } from "@beep/config-file/internal/crypto";
 * import * as Effect from "effect/Effect";
 *
 * let derivations = 0;
 * const program = PassphraseKeyDerivation.use((derive) => derive("example-passphrase", new Uint8Array(16)));
 * await Effect.runPromise(
 *   Effect.provideService(program, PassphraseKeyDerivation, (passphrase, salt) => {
 *     derivations++;
 *     return deriveKey(passphrase, salt);
 *   })
 * );
 * console.log(derivations); // 1
 * ```
 *
 * @internal
 * @category services
 * @since 0.0.0
 */
export const PassphraseKeyDerivation = Context.Reference<
  (passphrase: string, salt: Uint8Array) => Effect.Effect<CryptoKey, CryptoFailure>
>($I`PassphraseKeyDerivation`, {
  defaultValue: () => deriveKey,
});

/**
 * Decode base64 into bytes.
 *
 * **Details**
 *
 * `atob` is available in all modern environments (Node 20+, Bun, Deno). It
 * yields one character per byte (0-255), so every character's code is defined
 * and decoding drops no byte.
 *
 * **Example** (Decode base64 bytes)
 *
 * ```ts
 * import { fromBase64 } from "@beep/config-file/internal/crypto";
 * import * as Effect from "effect/Effect";
 *
 * const bytes = Effect.runSync(fromBase64("AQID"));
 * console.log(bytes.join(",")); // 1,2,3
 * ```
 *
 * @internal
 * @category decoding
 * @since 0.0.0
 */
export const fromBase64 = (raw: string): Effect.Effect<Uint8Array<ArrayBuffer>, CryptoFailure> =>
  Effect.try({
    try: () => {
      const binary = atob(raw);
      const bytes = new Uint8Array(new ArrayBuffer(binary.length));
      bytes.set(A.getSomes(A.map(A.fromIterable(binary), (char) => Str.charCodeAt(char, 0))));
      return bytes;
    },
    catch: fail("encoding"),
  });

/**
 * Prepend the IV to the ciphertext and base64-encode the envelope.
 *
 * **Example** (Encode an IV and ciphertext envelope)
 *
 * ```ts
 * import { IV_LENGTH, toBase64 } from "@beep/config-file/internal/crypto";
 * import * as Effect from "effect/Effect";
 *
 * const iv = new Uint8Array(IV_LENGTH);
 * const encoded = Effect.runSync(toBase64(iv, new Uint8Array([1, 2, 3]).buffer));
 * console.log(encoded); // AAAAAAAAAAAAAAAAAQID
 * ```
 *
 * @internal
 * @category encoding
 * @since 0.0.0
 */
export const toBase64: {
  (ciphertext: ArrayBuffer): (iv: Uint8Array) => Effect.Effect<string, CryptoFailure>;
  (iv: Uint8Array, ciphertext: ArrayBuffer): Effect.Effect<string, CryptoFailure>;
} = dual(
  2,
  (iv: Uint8Array, ciphertext: ArrayBuffer): Effect.Effect<string, CryptoFailure> =>
    Effect.try({
      try: () => {
        const ciphertextBytes = new Uint8Array(ciphertext);
        const resultBuf = new ArrayBuffer(IV_LENGTH + ciphertextBytes.length);
        const result = new Uint8Array(resultBuf);
        result.set(iv, 0);
        result.set(ciphertextBytes, IV_LENGTH);
        return btoa(
          A.join(
            A.map(A.fromIterable(result), (b) => String.fromCharCode(b)),
            ""
          )
        );
      },
      catch: fail("encoding"),
    })
);

/**
 * Decrypt AES-GCM ciphertext under `iv`.
 *
 * **Example** (Decrypt an AES-GCM round trip)
 *
 * ```ts
 * import { deriveKey, encrypt, decrypt, randomIv } from "@beep/config-file/internal/crypto";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function*() {
 *   const key = yield* deriveKey("example-passphrase", new Uint8Array(16));
 *   const iv = randomIv();
 *   const ciphertext = yield* encrypt(key, iv, new TextEncoder().encode("hello"));
 *   const plaintext = yield* decrypt(key, iv, new Uint8Array(ciphertext));
 *   return new TextDecoder().decode(plaintext);
 * });
 * console.log(await Effect.runPromise(program)); // hello
 * ```
 *
 * @internal
 * @category decoding
 * @since 0.0.0
 */
export const decrypt: {
  (
    iv: Uint8Array<ArrayBuffer>,
    ciphertext: Uint8Array<ArrayBuffer>
  ): (key: CryptoKey) => Effect.Effect<ArrayBuffer, CryptoFailure>;
  (
    key: CryptoKey,
    iv: Uint8Array<ArrayBuffer>,
    ciphertext: Uint8Array<ArrayBuffer>
  ): Effect.Effect<ArrayBuffer, CryptoFailure>;
} = dual(
  3,
  (
    key: CryptoKey,
    iv: Uint8Array<ArrayBuffer>,
    ciphertext: Uint8Array<ArrayBuffer>
  ): Effect.Effect<ArrayBuffer, CryptoFailure> =>
    Effect.tryPromise({
      try: () => globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext),
      catch: fail("decrypt"),
    })
);

/**
 * Encrypt `plaintext` with AES-GCM under `iv`.
 *
 * **Example** (Encrypt an AES-GCM round trip)
 *
 * ```ts
 * import { deriveKey, encrypt, decrypt, randomIv } from "@beep/config-file/internal/crypto";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function*() {
 *   const key = yield* deriveKey("example-passphrase", new Uint8Array(16));
 *   const iv = randomIv();
 *   const ciphertext = yield* encrypt(key, iv, new TextEncoder().encode("hello"));
 *   const plaintext = yield* decrypt(key, iv, new Uint8Array(ciphertext));
 *   return new TextDecoder().decode(plaintext);
 * });
 * console.log(await Effect.runPromise(program)); // hello
 * ```
 *
 * @internal
 * @category encoding
 * @since 0.0.0
 */
export const encrypt: {
  (
    iv: Uint8Array<ArrayBuffer>,
    plaintext: Uint8Array<ArrayBuffer>
  ): (key: CryptoKey) => Effect.Effect<ArrayBuffer, CryptoFailure>;
  (
    key: CryptoKey,
    iv: Uint8Array<ArrayBuffer>,
    plaintext: Uint8Array<ArrayBuffer>
  ): Effect.Effect<ArrayBuffer, CryptoFailure>;
} = dual(
  3,
  (
    key: CryptoKey,
    iv: Uint8Array<ArrayBuffer>,
    plaintext: Uint8Array<ArrayBuffer>
  ): Effect.Effect<ArrayBuffer, CryptoFailure> =>
    Effect.tryPromise({
      try: () => globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext),
      catch: fail("encrypt"),
    })
);

/**
 * A fresh cryptographically random 12-byte IV.
 *
 * **Example** (Generate a correctly sized random IV)
 *
 * ```ts
 * import { randomIv } from "@beep/config-file/internal/crypto";
 *
 * console.log(randomIv().byteLength); // 12
 * ```
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const randomIv = (): Uint8Array<ArrayBuffer> =>
  globalThis.crypto.getRandomValues(new Uint8Array(new ArrayBuffer(IV_LENGTH)));
