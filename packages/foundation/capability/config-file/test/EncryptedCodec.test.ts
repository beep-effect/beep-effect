import { ConfigEncryptionError, EncryptedCodec, EncryptedCodecKey } from "@beep/config-file/EncryptedCodec";
import { deriveKey, PassphraseKeyDerivation } from "@beep/config-file/internal/crypto";
import { JsonCodec } from "@beep/config-file/JsonCodec";
import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure, assertSome } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { ConfigCodec } from "@beep/config-file/ConfigCodec";

const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
const key = () => EncryptedCodecKey.fromPassphrase("correct horse battery staple", salt);

/** A real AES-GCM key, generated rather than derived — drives the `fromCryptoKey` variant. */
const generateKeyForTest = (): Effect.Effect<CryptoKey, ConfigEncryptionError> =>
  Effect.promise(() =>
    globalThis.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
  );

/** A codec that hands its input straight through, so we can encrypt bytes the json codec would reject. */
const passthrough: ConfigCodec<never> = {
  name: "raw",
  parse: (raw) => Effect.succeed(raw),
  stringify: (value) => {
    if (!P.isString(value)) return assert.fail("expected raw text to encrypt");
    return Effect.succeed(value);
  },
};

/**
 * Wrap the real PBKDF2 derivation with a counter. The count is provided to
 * one program only, so tests running concurrently in this file never see
 * each other's derivations (a global `crypto.subtle` spy would).
 */
const countingDerivation = () => {
  let derivations = 0;
  return {
    count: () => derivations,
    provide: <A, E, R>(self: Effect.Effect<A, E, R>) =>
      Effect.provideService(self, PassphraseKeyDerivation, (passphrase, salt) =>
        Effect.suspend(() => {
          derivations++;
          return deriveKey(passphrase, salt);
        })
      ),
  };
};

describe("EncryptedCodec", () => {
  it.effect("round-trips a value through encryption", () =>
    Effect.gen(function* () {
      const codec = EncryptedCodec(JsonCodec, key());
      const ciphertext = yield* codec.stringify({ port: 8080 });
      const parsed = yield* codec.parse(ciphertext);
      assert.deepStrictEqual(parsed, { port: 8080 });
    })
  );

  it.effect("the ciphertext does not leak the plaintext", () =>
    Effect.gen(function* () {
      const codec = EncryptedCodec(JsonCodec, key());
      const ciphertext = yield* codec.stringify({ port: 8080, secret: "hunter2" });
      // Neither the base64 envelope nor its decoded bytes may contain the plaintext.
      assert.notInclude(ciphertext, "8080");
      assert.notInclude(ciphertext, "hunter2");
      const decoded = atob(ciphertext);
      assert.notInclude(decoded, "8080");
      assert.notInclude(decoded, "hunter2");
      assert.notInclude(decoded, "port");
    })
  );

  it.effect("produces a different ciphertext each time — the IV is random", () =>
    Effect.gen(function* () {
      const codec = EncryptedCodec(JsonCodec, key());
      const a = yield* codec.stringify({ port: 1 });
      const b = yield* codec.stringify({ port: 1 });
      assert.notStrictEqual(a, b);
      // The 12-byte IV prefix differs...
      assert.notStrictEqual(Str.slice(0, 12)(atob(a)), Str.slice(0, 12)(atob(b)));
      // ...and both still decrypt to the same plaintext.
      const parsed1 = yield* codec.parse(a);
      assert.deepStrictEqual(parsed1, { port: 1 });
      const parsed2 = yield* codec.parse(b);
      assert.deepStrictEqual(parsed2, { port: 1 });
    })
  );

  it.effect("fails with ConfigEncryptionError when the ciphertext is too short for an IV", () =>
    Effect.gen(function* () {
      const codec = EncryptedCodec(JsonCodec, key());
      const error = yield* codec.parse(btoa("short")).pipe(Effect.asVoid, Effect.flip);
      assert.instanceOf(error, ConfigEncryptionError);
      assert.isTrue(S.is(ConfigEncryptionError)(error));
      assert.strictEqual(error._tag, "ConfigEncryptionError");
      assert.strictEqual(error.phase, "decrypt");
    })
  );

  it.effect("a too-short ciphertext fails typed, never as a defect", () =>
    Effect.gen(function* () {
      const codec = EncryptedCodec(JsonCodec, key());
      const exit = yield* Effect.exit(codec.parse(btoa("short")));
      const cause = Exit.getCause(exit);
      assertSome(cause, O.getOrThrow(cause));
      assertExitFailure(exit, cause.value);
      assert.isTrue(Cause.hasFails(cause.value));
      assert.isFalse(Cause.hasDies(cause.value));
    })
  );

  it.effect("fails with phase encoding when the input is not valid base64", () =>
    Effect.gen(function* () {
      const codec = EncryptedCodec(JsonCodec, key());
      const error = yield* codec.parse("!!! not base64 !!!").pipe(Effect.asVoid, Effect.flip);
      assert.instanceOf(error, ConfigEncryptionError);
      assert.isTrue(S.is(ConfigEncryptionError)(error));
      assert.strictEqual(error.phase, "encoding");
      // The caught host failure rides along structurally — never String(e).
      assert.notStrictEqual(typeof error.cause, "string");
    })
  );

  it.effect("fails with ConfigEncryptionError on a wrong passphrase", () =>
    Effect.gen(function* () {
      const ciphertext = yield* EncryptedCodec(JsonCodec, key()).stringify({ port: 1 });
      const wrong = EncryptedCodec(JsonCodec, EncryptedCodecKey.fromPassphrase("wrong", salt));
      const error = yield* wrong.parse(ciphertext).pipe(Effect.asVoid, Effect.flip);
      assert.instanceOf(error, ConfigEncryptionError);
      assert.isTrue(S.is(ConfigEncryptionError)(error));
      assert.strictEqual(error.phase, "decrypt");
    })
  );

  it.effect("a wrong passphrase fails typed, never as a defect", () =>
    Effect.gen(function* () {
      const ciphertext = yield* EncryptedCodec(JsonCodec, key()).stringify({ port: 1 });
      const wrong = EncryptedCodec(JsonCodec, EncryptedCodecKey.fromPassphrase("wrong", salt));
      const exit = yield* Effect.exit(wrong.parse(ciphertext));
      const cause = Exit.getCause(exit);
      assertSome(cause, O.getOrThrow(cause));
      assertExitFailure(exit, cause.value);
      assert.isTrue(Cause.hasFails(cause.value));
      assert.isFalse(Cause.hasDies(cause.value));
    })
  );

  it.effect("surfaces the inner codec's error after successful decryption", () =>
    Effect.gen(function* () {
      // Encrypt invalid JSON with a raw passthrough codec, then decrypt with json.
      const ciphertext = yield* EncryptedCodec(passthrough, key()).stringify("{ not json");
      const error = yield* EncryptedCodec(JsonCodec, key()).parse(ciphertext).pipe(Effect.asVoid, Effect.flip);
      // The inner codec's error, widened not flattened.
      assert.strictEqual(error._tag, "ConfigCodecError");
      assert.notInstanceOf(error, ConfigEncryptionError);
      // Decryption succeeded and JSON decoding then failed, so its SchemaError
      // must reach the caller intact. Without this, a regression that
      // replaced `cause` with its string form would still pass.
      assert.instanceOf(error.cause, S.SchemaError);
    })
  );

  it("names itself after the codec it wraps", () => {
    assert.strictEqual(EncryptedCodec(JsonCodec, key()).name, "encrypted(json)");
  });

  it.effect("derives the key exactly once across many operations", () =>
    Effect.gen(function* () {
      // Count derivations directly. Never assert on wall-clock time: it is
      // machine-dependent, and "the second call was fast" is not the claim.
      let derivations = 0;
      const counting = EncryptedCodecKey.fromCryptoKey(
        Effect.suspend(() => {
          derivations++;
          return generateKeyForTest();
        })
      );
      const codec = EncryptedCodec(JsonCodec, counting);

      const a = yield* codec.stringify({ a: 1 });
      yield* codec.stringify({ a: 2 });
      yield* codec.parse(a);

      assert.strictEqual(derivations, 1);
    })
  );

  it.effect("does not derive the key until the codec is first used", () =>
    Effect.gen(function* () {
      let derivations = 0;
      const counting = EncryptedCodecKey.fromCryptoKey(
        Effect.suspend(() => {
          derivations++;
          return generateKeyForTest();
        })
      );
      // Constructing the codec must not run the key effect.
      const codec = EncryptedCodec(JsonCodec, counting);
      assert.strictEqual(derivations, 0);
      yield* codec.stringify({ a: 1 });
      assert.strictEqual(derivations, 1);
    })
  );

  it.effect("runs PBKDF2 exactly once per codec instance across parse and stringify", () => {
    // Count the real derivations at the PBKDF2 seam, so the passphrase path is
    // held to the same standard as `fromCryptoKey`.
    const derivation = countingDerivation();
    return Effect.gen(function* () {
      const codec = EncryptedCodec(JsonCodec, key());

      const a = yield* codec.stringify({ a: 1 });
      yield* codec.stringify({ a: 2 });
      yield* codec.parse(a);
      yield* codec.parse(a);

      assert.strictEqual(derivation.count(), 1);
    }).pipe(derivation.provide);
  });

  it.effect("a separate codec instance derives its own key", () => {
    const derivation = countingDerivation();
    return Effect.gen(function* () {
      yield* EncryptedCodec(JsonCodec, key()).stringify({ a: 1 });
      yield* EncryptedCodec(JsonCodec, key()).stringify({ a: 1 });
      assert.strictEqual(derivation.count(), 2);
    }).pipe(derivation.provide);
  });

  it.effect("a failing key effect is retried after failure", () =>
    Effect.gen(function* () {
      let attempts = 0;
      const boom = ConfigEncryptionError.make({ phase: "key-derivation", cause: new Error("kms down") });
      const failing = EncryptedCodecKey.fromCryptoKey(
        Effect.suspend(() => {
          attempts++;
          return Effect.fail(boom);
        })
      );
      const codec = EncryptedCodec(JsonCodec, failing);

      const first = yield* Effect.flip(codec.stringify({ a: 1 }));
      // A well-formed envelope: parse validates it before resolving the key, so
      // this reaches the key rather than short-circuiting on the too-short guard.
      const second = yield* codec.parse(btoa(Str.repeat(32)("x"))).pipe(Effect.asVoid, Effect.flip);
      // The deterministic failure still fails, by identity, every time...
      assert.strictEqual(first, boom);
      assert.strictEqual(second, boom);
      // ...but only success is memoized, so each operation resolves the key again.
      assert.strictEqual(attempts, 2);
    })
  );

  it.effect("an interrupted operation does not poison the codec", () =>
    Effect.gen(function* () {
      let attempts = 0;
      const counting = EncryptedCodecKey.fromCryptoKey(
        Effect.suspend((): Effect.Effect<CryptoKey, ConfigEncryptionError> => {
          attempts++;
          // Park the first resolution so the sibling failure interrupts it.
          return attempts === 1 ? Effect.never : generateKeyForTest();
        })
      );
      const codec = EncryptedCodec(JsonCodec, counting);

      // Clock-free by construction: `it.effect` runs on a virtual TestClock, so a
      // timeout- or sleep-driven interrupt would never fire. A failing sibling
      // under `Effect.all` interrupts the parked key resolution immediately.
      const exit = yield* Effect.exit(
        Effect.all([codec.stringify({ a: 1 }), Effect.fail("sibling")], { concurrency: 2 })
      );
      assertExitFailure(exit, exit.pipe(Exit.getCause, O.getOrThrow));

      // The interrupt was not memoized: the codec re-resolves and still works.
      const ciphertext = yield* codec.stringify({ port: 8080 });
      const parsed3 = yield* codec.parse(ciphertext);
      assert.deepStrictEqual(parsed3, { port: 8080 });
      assert.strictEqual(attempts, 2);
    })
  );

  it.effect("a transient key failure recovers on the next operation", () =>
    Effect.gen(function* () {
      let attempts = 0;
      const flaky = EncryptedCodecKey.fromCryptoKey(
        Effect.suspend((): Effect.Effect<CryptoKey, ConfigEncryptionError> => {
          attempts++;
          return attempts === 1
            ? Effect.fail(ConfigEncryptionError.make({ phase: "key-derivation", cause: new Error("kms down") }))
            : generateKeyForTest();
        })
      );
      const codec = EncryptedCodec(JsonCodec, flaky);

      const flip4 = yield* Effect.flip(codec.stringify({ a: 1 }));
      assert.instanceOf(flip4, ConfigEncryptionError);
      // The failure was not cached, so the retry derives a usable key.
      const ciphertext = yield* codec.stringify({ port: 8080 });
      const parsed5 = yield* codec.parse(ciphertext);
      assert.deepStrictEqual(parsed5, { port: 8080 });
      assert.strictEqual(attempts, 2);
    })
  );

  it.effect("a key effect that throws instead of failing is a defect, not a typed error", () =>
    Effect.gen(function* () {
      // Caller-supplied code with a declared error channel: a throw is a
      // programmer bug and must not be laundered into ConfigEncryptionError.
      const throwing = EncryptedCodecKey.fromCryptoKey(
        Effect.suspend((): Effect.Effect<CryptoKey, ConfigEncryptionError> => {
          throw new Error("bug");
        })
      );
      const exit = yield* Effect.exit(EncryptedCodec(JsonCodec, throwing).stringify({ a: 1 }));
      const cause = Exit.getCause(exit);
      assertSome(cause, O.getOrThrow(cause));
      assertExitFailure(exit, cause.value);
      assert.isTrue(Cause.hasDies(cause.value));
      assert.isFalse(Cause.hasFails(cause.value));
    })
  );

  it.effect("a ciphertext written by one instance decrypts in another with the same passphrase", () =>
    Effect.gen(function* () {
      const written = yield* EncryptedCodec(JsonCodec, key()).stringify({ port: 8080 });
      const read = yield* EncryptedCodec(JsonCodec, key()).parse(written);
      assert.deepStrictEqual(read, { port: 8080 });
    })
  );
});
