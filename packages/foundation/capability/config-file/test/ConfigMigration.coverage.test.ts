import { ConfigMigrationError, VersionAccess } from "@beep/config-file/ConfigMigration";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

describe("migration version stamping", () => {
  it.effect("stamps object, nonempty text, empty text and primitive migration outputs", () =>
    Effect.gen(function* () {
      const set1 = yield* VersionAccess.default.set({ retained: 1 }, 2);
      assert.deepStrictEqual<unknown>(set1, {
        retained: 1,
        version: 2,
      });
      const set2 = yield* VersionAccess.default.set("ab", 2);
      assert.deepStrictEqual<unknown>(set2, { 0: "a", 1: "b", version: 2 });
      const set3 = yield* VersionAccess.default.set("", 2);
      assert.deepStrictEqual<unknown>(set3, { version: 2 });
      const set4 = yield* VersionAccess.default.set(42, 2);
      assert.deepStrictEqual<unknown>(set4, { version: 2 });
      assert.strictEqual(
        ConfigMigrationError.make({ version: 0, migration: "", phase: "read-version", cause: "missing" }).message,
        "Failed to read the config version"
      );
      assert.strictEqual(
        ConfigMigrationError.make({ version: 2, migration: "stamp", phase: "write-version", cause: "failure" }).message,
        'Migration "stamp" (v2) failed during write-version'
      );
    })
  );
});

import { ConfigMigration } from "@beep/config-file/ConfigMigration";
import * as S from "effect/Schema";

it.effect("the static migration facade is constructible and numeric error versions round-trip at domain edges", () =>
  Effect.gen(function* () {
    assert.isTrue(Reflect.construct(ConfigMigration, []) instanceof ConfigMigration);
    for (const version of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const error = ConfigMigrationError.make({ version, migration: "edge", phase: "apply", cause: "failure" });
      const encoded = yield* S.encodeEffect(ConfigMigrationError)(error);
      const argument = S.toEquivalence(ConfigMigrationError);
      const value = yield* S.decodeEffect(ConfigMigrationError)(encoded);
      assert.isTrue(argument(value, error));
    }
  })
);

it.effect("the default version reader rejects primitive documents with a structured reason", () =>
  Effect.gen(function* () {
    const error = yield* Effect.flip(VersionAccess.default.get(null));
    assert.strictEqual(error.message, "config is not an object");
    const textError = yield* Effect.flip(VersionAccess.default.get("not an object"));
    assert.strictEqual(textError.message, "config is not an object");
  })
);
