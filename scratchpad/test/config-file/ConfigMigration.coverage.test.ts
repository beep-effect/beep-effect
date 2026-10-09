import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ConfigMigrationError, VersionAccess } from "../../effected/config-file/ConfigMigration.ts";

describe("migration version stamping", () => {
  it.effect("stamps object, nonempty text, empty text and primitive migration outputs", () => Effect.gen(function* () {
    assert.deepStrictEqual<unknown>(yield* VersionAccess.default.set({ retained: 1 }, 2), { retained: 1, version: 2 });
    assert.deepStrictEqual<unknown>(yield* VersionAccess.default.set("ab", 2), { 0: "a", 1: "b", version: 2 });
    assert.deepStrictEqual<unknown>(yield* VersionAccess.default.set("", 2), { version: 2 });
    assert.deepStrictEqual<unknown>(yield* VersionAccess.default.set(42, 2), { version: 2 });
    assert.strictEqual(ConfigMigrationError.make({ version: 0, name: "", phase: "read-version", cause: "missing" }).message, "Failed to read the config version");
    assert.strictEqual(ConfigMigrationError.make({ version: 2, name: "stamp", phase: "write-version", cause: "failure" }).message, 'Migration "stamp" (v2) failed during write-version');
  }));
});

import { ConfigMigration } from "../../effected/config-file/ConfigMigration.ts";
import * as S from "effect/Schema";

it.effect("the static migration facade is constructible and numeric error versions round-trip at domain edges", () => Effect.gen(function* () {
  assert.isTrue(Reflect.construct(ConfigMigration, []) instanceof ConfigMigration);
  for (const version of [NaN, Infinity, -Infinity]) {
    const error = ConfigMigrationError.make({ version, name: "edge", phase: "apply", cause: "failure" });
    const encoded = yield* S.encodeEffect(ConfigMigrationError)(error);
    assert.isTrue(S.toEquivalence(ConfigMigrationError)(yield* S.decodeEffect(ConfigMigrationError)(encoded), error));
  }
}));

it.effect("the default version reader rejects primitive documents with a structured reason", () => Effect.gen(function* () {
  const error = yield* Effect.flip(VersionAccess.default.get(null));
  assert.strictEqual(error.message, "config is not an object");
  const textError = yield* Effect.flip(VersionAccess.default.get("not an object"));
  assert.strictEqual(textError.message, "config is not an object");
}));
