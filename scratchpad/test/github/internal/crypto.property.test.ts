import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Base64 from "effect/encoding/Base64";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import blakejs from "blakejs";
import nacl from "tweetnacl";
import { encryptSecret } from "../../../effected/github/internal/crypto.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop("sealed boxes recover the UTF-8 plaintext only with the recipient key", [Arbitrary.schema(S.String)], ([text]) => Effect.sync(() => {
  const recipient = nacl.box.keyPair();
  const encoded = Result.getOrThrow(encryptSecret(Base64.encode(recipient.publicKey), text));
  const sealed = Result.getOrThrow(Base64.decode(encoded));
  const ephemeralPublicKey = sealed.slice(0, 32);
  const nonceInput = new Uint8Array(64);
  nonceInput.set(ephemeralPublicKey);
  nonceInput.set(recipient.publicKey, 32);
  const nonce = blakejs.blake2b(nonceInput, undefined, 24);
  const plaintext = nacl.box.open(sealed.slice(32), nonce, ephemeralPublicKey, recipient.secretKey);
  assert.deepStrictEqual(plaintext, new TextEncoder().encode(text));
  assert.strictEqual(nacl.box.open(sealed.slice(32), nonce, ephemeralPublicKey, nacl.box.keyPair().secretKey), null);
  assert.strictEqual(sealed.length, new TextEncoder().encode(text).length + 48);
}), runs);
