import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  DevApiKey,
  DevApiKeyCreate,
  DevApiKeyCreateWire,
  DevApiKeyCreated,
  DevApiKeyCreatedWire,
  DevApiKeyDb,
  DevApiKeyDbWire,
  DevApiKeyWire,
} from "../../beep/DevApiKey.ts";

const decode = <A>(schema: S.ConstraintDecoder<A>, input: unknown): A =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const row = {
  id: "k1",
  name: "ci",
  key_prefix: "omi_",
  created_at: "2020-01-02T03:04:05.000Z",
};

describe("DevApiKey", () => {
  it("decodes a public key with null and missing optional fields", () => {
    const present = decode(DevApiKeyWire, { ...row, last_used_at: "2020-01-03T03:04:05.000Z", scopes: ["read"] });
    assert.strictEqual(present.keyPrefix, "omi_");
    assert.strictEqual(O.getOrElse(present.scopes, () => []).length, 1);
    const nulled = decode(DevApiKeyWire, { ...row, last_used_at: null, scopes: null });
    assert.strictEqual(O.isNone(nulled.lastUsedAt), true);
    assert.strictEqual(O.isNone(nulled.scopes), true);
    const missing = decode(DevApiKeyWire, row);
    assert.strictEqual(O.isNone(missing.lastUsedAt), true);
  });

  it("keeps the hash and the one-shot secret on their own models", () => {
    const stored = decode(DevApiKeyDbWire, { ...row, user_id: "user-1", hashed_key: "hash" });
    assert.strictEqual(stored.hashedKey, "hash");
    const created = decode(DevApiKeyCreatedWire, { ...row, key: "omi_secret" });
    assert.strictEqual(created.key, "omi_secret");
    const request = decode(DevApiKeyCreateWire, { name: "ci" });
    assert.strictEqual(O.isNone(request.scopes), true);
    assert.strictEqual(DateTime.isDateTime(stored.createdAt), true);
  });

  it("derives an arbitrary for each model", () => {
    for (const schema of [DevApiKey, DevApiKeyDb, DevApiKeyCreate, DevApiKeyCreated]) {
      assert.strictEqual(schema.pipe(Arbitrary.schema, Arbitrary.isArbitrary), true);
    }
  });
});
