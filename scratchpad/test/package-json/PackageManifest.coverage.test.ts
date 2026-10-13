import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { PackageManifest } from "../../effected/package-json/PackageManifest.ts";
describe("manifest fallback and serialization failures", () => {
  it.effect("absence defaults private to false; false stays false", () => Effect.gen(function* () {
    assert.strictEqual((yield* PackageManifest.decode({})).isPrivate, false);
    assert.strictEqual((yield* PackageManifest.decode({ private: false })).isPrivate, false);
  }));
  it.effect("serialization rejects a mutated invalid manifest rather than emitting an invalid name", () => Effect.gen(function* () {
    const value = yield* PackageManifest.decode({ private: true });
    Reflect.set(value, "name", "Bad Name");
    assert.throws(() => value.toJsonString());
  }));
});
