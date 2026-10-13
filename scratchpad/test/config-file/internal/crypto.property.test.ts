import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { decrypt, encrypt, fromBase64, IV_LENGTH, randomIv, toArrayBufferView, toBase64 } from "../../../effected/config-file/internal/crypto.ts";

const runs = { arbitrary: fcRuns(100) };
const Byte = S.Int.check(S.isBetween({ minimum: 0, maximum: 255 }));
const Envelope = S.Struct({ iv: S.Array(Byte).check(S.isBetweenLength(IV_LENGTH, IV_LENGTH)), payload: S.Array(Byte) });

describe("crypto byte fidelity properties", () => {
  it.effect.prop("base64 envelopes recover every IV and payload byte and canonical encoding is idempotent", [Arbitrary.schema(Envelope)], ([sample]) =>
    Effect.gen(function* () {
      const iv = new Uint8Array(sample.iv);
      const payload = new Uint8Array(sample.payload);
      const encoded = yield* toBase64(iv, payload.buffer);
      const decoded = yield* fromBase64(encoded);
      assert.deepStrictEqual(decoded, new Uint8Array([...sample.iv, ...sample.payload]));
      const normalized = yield* toBase64(decoded.slice(0, IV_LENGTH), decoded.slice(IV_LENGTH).buffer);
      assert.strictEqual(normalized, encoded);
      const reparsed = yield* fromBase64(normalized);
      assert.deepStrictEqual(reparsed, decoded);
      assert.strictEqual(yield* toBase64(reparsed.slice(IV_LENGTH).buffer)(reparsed.slice(0, IV_LENGTH)), normalized);
    }), runs);

  it.effect.prop("AES-GCM recovers arbitrary plaintext bytes through both calling styles and the base64 envelope", [Byte.pipe(S.Array, Arbitrary.schema)], ([sample]) =>
    Effect.gen(function* () {
      const key = yield* Effect.promise(() => globalThis.crypto.subtle.importKey("raw", new Uint8Array(32), "AES-GCM", false, ["encrypt", "decrypt"]));
      const iv = randomIv();
      const plaintext = toArrayBufferView(new Uint8Array(sample));
      const ciphertext = yield* encrypt(iv, plaintext)(key);
      const envelope = yield* fromBase64(yield* toBase64(iv, ciphertext));
      const decoded = yield* decrypt(key, envelope.slice(0, IV_LENGTH), envelope.slice(IV_LENGTH));
      assert.deepStrictEqual(new Uint8Array(decoded), plaintext);
      const direct = yield* encrypt(key, iv, plaintext);
      assert.deepStrictEqual(direct, ciphertext);
      assert.deepStrictEqual(new Uint8Array(yield* decrypt(iv, new Uint8Array(direct))(key)), plaintext);
    }), runs);

  it.effect.prop("ArrayBuffer views copy all bytes without retaining the source storage", [Byte.pipe(S.Array, Arbitrary.schema)], ([sample]) =>
    Effect.gen(function* () {
      const source = new Uint8Array(sample);
      const copy = toArrayBufferView(source);
      assert.deepStrictEqual(copy, source);
      assert.notStrictEqual(copy.buffer, source.buffer);
      source.fill(0);
      assert.deepStrictEqual(copy, new Uint8Array(sample));
    }), runs);
});
