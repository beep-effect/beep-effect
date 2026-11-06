// Honest absence — the effected#249 contract and the reason this package
// exists: a path nothing arranged is NotFound, never fabricated content.

import { MemoryFileSystem } from "@beep/memfs";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

describe("honest absence — the effected#249 contract", () => {
  // THE FOUNDING CONTRACT. This package exists because a hand-stubbed
  // FileSystem.layerNoop that answered an unarranged read with "" caused a
  // real silent-changeset-drop bug downstream. An unseeded path must fail
  // typed NotFound, loudly naming the path — never fabricate content.
  it.effect("reading an unseeded path fails typed NotFound, never ''", () =>
    Effect.gen(function* () {
      const fs = yield* MemoryFileSystem.makeWith({ "/present.txt": "here" });

      const readError = yield* Effect.flip(fs.readFileString("/absent/changesets/config.json"));
      assert.strictEqual(readError._tag, "PlatformError");
      // Assert helpers are not type predicates, so narrow with a real `if`.
      if (readError.reason._tag === "BadArgument") {
        assert.fail("expected a SystemError NotFound, got BadArgument");
      }
      assert.strictEqual(readError.reason._tag, "NotFound");
      assert.strictEqual(readError.reason.method, "readFile");
      assert.strictEqual(readError.reason.pathOrDescriptor, "/absent/changesets/config.json");

      const statError = yield* Effect.flip(fs.stat("/absent.txt"));
      assert.strictEqual(statError.reason._tag, "NotFound");

      const openError = yield* fs.open("/absent.txt", { flag: "r" }).pipe(Effect.flip);
      assert.strictEqual(openError.reason._tag, "NotFound");

      // The seeded path still answers — absence is per-path, not global.
      const readFileString1 = yield* fs.readFileString("/present.txt");
      assert.strictEqual(readFileString1, "here");
    })
  );

  it.effect("an empty volume answers exists with false and reads with NotFound", () =>
    Effect.gen(function* () {
      const fs = yield* MemoryFileSystem.make;
      const exists2 = yield* fs.exists("/anything");
      assert.isFalse(exists2);
      const error = yield* Effect.flip(fs.readFile("/anything"));
      assert.strictEqual(error.reason._tag, "NotFound");
    })
  );
});
