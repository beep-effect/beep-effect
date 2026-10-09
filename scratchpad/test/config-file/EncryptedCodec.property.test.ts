import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
import { ConfigEncryptionError } from "../../effected/config-file/EncryptedCodec.ts";

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(name + ": decoding an encoded value succeeds and recovers the value", [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assert.isTrue(S.toEquivalence(schema)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

describe("EncryptedCodec schema properties", () => {
  roundTrips("ConfigEncryptionError", ConfigEncryptionError);
});

import { EncryptedCodec, EncryptedCodecKey } from "../../effected/config-file/EncryptedCodec.ts";
import { JsonCodec } from "../../effected/config-file/JsonCodec.ts";
import { JsoncCodec } from "../../effected/config-file/JsoncCodec.ts";

// A real generated key keeps the property inexpensive while exercising AES-GCM.
const generatedKey = EncryptedCodecKey.fromCryptoKey(Effect.promise(() =>
  globalThis.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])));
const encryptedJson = EncryptedCodec(JsonCodec, generatedKey);
const encryptedJsonc = EncryptedCodec(generatedKey)(JsoncCodec);

for (const codec of [encryptedJson, encryptedJsonc]) {
  it.effect.prop(codec.name + ": decrypting an encoded value succeeds and preserves document fidelity", [Arbitrary.schema(S.Json)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* codec.stringify(value);
      const decoded = yield* S.decodeUnknownEffect(S.Json)(yield* codec.parse(encoded));
      assert.isTrue(S.toEquivalence(S.Json)(decoded, value));
      const reparsed = yield* codec.parse(yield* codec.stringify(decoded));
      assert.deepStrictEqual(reparsed, decoded);
      // Normalize the plaintext: ciphertext intentionally changes with each random IV.
      assert.strictEqual(yield* JsonCodec.stringify(reparsed), yield* JsonCodec.stringify(decoded));
    }), runs);
}
