import { MemoryFileSystem } from "@beep/memfs";
import { Sbom, SbomWriteError } from "@beep/sbom/Sbom";
import { Component } from "@beep/sbom/SbomDocument";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";

const document = Sbom.generate({ root: Component.make({ type: "library", name: "root" }), components: [] });

describe("Sbom filesystem coverage", () => {
  // TypeScript's private constructor is erased for JavaScript consumers.
  // Reflective construction must not turn the static emitter into an instance API.
  it.effect("keeps emitter operations on the static facade after reflective construction", () =>
    Effect.sync(() => {
      const instance: unknown = Reflect.construct(Sbom, []);
      assertTrue(instance instanceof Sbom);
      assert.notProperty(instance, "generate");
      assert.notProperty(instance, "toJson");
      assert.notProperty(instance, "write");
      assert.deepStrictEqual(
        Sbom.generate({ root: Component.make({ type: "library", name: "root" }), components: [] }),
        document
      );
    })
  );
  it.layer(MemoryFileSystem.layer, { timeout: "30 seconds" })((it) => {
    it.effect("writes the requested JSON bytes and replaces an existing file", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.writeFileString("/bom.json", "old");
        yield* Sbom.write(document, "/bom.json", { space: 0 });
        const readFileString1 = yield* fs.readFileString("/bom.json");
        assert.strictEqual(readFileString1, Sbom.toJson(document, { space: 0 }));
        yield* Sbom.write(document, "/bom.json");
        const readFileString2 = yield* fs.readFileString("/bom.json");
        assert.strictEqual(readFileString2, Sbom.toJson(document));
      })
    );
    it.effect("reports the path and original filesystem failure when the parent is absent", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(Sbom.write(document, "/missing/bom.json"));
        assert.instanceOf(error, SbomWriteError);
        assert.strictEqual(error.path, "/missing/bom.json");
        const Failure = S.Struct({ reason: S.TaggedStruct("NotFound", {}) });
        assertTrue(S.is(Failure)(error.cause));
        assert.strictEqual(error.message, "Failed to write the SBOM to /missing/bom.json");
      })
    );
  });
});
