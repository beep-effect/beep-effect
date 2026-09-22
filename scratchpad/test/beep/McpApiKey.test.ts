import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { McpApiKey, McpApiKeyCreate, McpApiKeyCreated, McpApiKeyDB } from "../../beep/McpApiKey.ts";

const decode = <A>(schema: S.Codec<A, unknown, never, unknown>, input: unknown): A =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const base = {
  id: "key-1",
  name: "desktop",
  keyPrefix: "omi_live",
  createdAt: "2020-01-02T03:04:05.000Z",
};

describe("McpApiKey", () => {
  it("decodes present optional fields", () => {
    const decoded = decode(McpApiKey, {
      ...base,
      lastUsedAt: "2020-01-03T00:00:00.000Z",
      appId: "app-1",
      scopes: ["memory:read"],
    });
    assert.strictEqual(decoded.name, "desktop");
    assert.strictEqual(
      O.isSome(decoded.lastUsedAt) && DateTime.formatIso(decoded.lastUsedAt.value),
      "2020-01-03T00:00:00.000Z",
    );
    assert.strictEqual(O.isSome(decoded.appId) && decoded.appId.value, "app-1");
    assert.strictEqual(O.isSome(decoded.scopes) && decoded.scopes.value[0], "memory:read");
  });

  it("decodes null and missing optional fields as None", () => {
    const nulled = decode(McpApiKey, { ...base, lastUsedAt: null, appId: null, scopes: null });
    assert.strictEqual(O.isNone(nulled.lastUsedAt), true);
    assert.strictEqual(O.isNone(nulled.appId), true);
    assert.strictEqual(O.isNone(nulled.scopes), true);
    const missing = decode(McpApiKey, base);
    assert.strictEqual(O.isNone(missing.lastUsedAt), true);
    assert.strictEqual(O.isNone(missing.appId), true);
    assert.strictEqual(O.isNone(missing.scopes), true);
  });

  it("keeps the stored hash and the one-time secret on different models", () => {
    const stored = decode(McpApiKeyDB, { ...base, userId: "user-1", hashedKey: "hash" });
    const created = decode(McpApiKeyCreated, { ...base, key: "secret" });
    const request = decode(McpApiKeyCreate, { name: "desktop" });
    assert.strictEqual(stored.hashedKey, "hash");
    assert.strictEqual(stored.userId, "user-1");
    assert.strictEqual(created.key, "secret");
    assert.strictEqual(request.name, "desktop");
  });

  it("derives an arbitrary for every exported model", () => {
    const schemas = [McpApiKey, McpApiKeyDB, McpApiKeyCreate, McpApiKeyCreated];
    A.forEach(schemas, (schema) => {
      assert.strictEqual(Arbitrary.isArbitrary(schema.pipe(Arbitrary.schema)), true);
    });
  });
});
