import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import { assertTrue } from "@effect/vitest/utils";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { Sbom, SbomWriteError } from "../../effected/sbom/Sbom.ts";
import { Component } from "../../effected/sbom/SbomDocument.ts";

const document = Sbom.generate({ root: Component.make({ type: "library", name: "root" }), components: [] });

describe("Sbom filesystem coverage", () => {
  it.layer(MemoryFileSystem.layer, { timeout: "30 seconds" })((it) => {
    it.effect("writes the requested JSON bytes and replaces an existing file", () => Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.writeFileString("/bom.json", "old");
      yield* Sbom.write(document, "/bom.json", { space: 0 });
      assert.strictEqual(yield* fs.readFileString("/bom.json"), Sbom.toJson(document, { space: 0 }));
      yield* Sbom.write(document, "/bom.json");
      assert.strictEqual(yield* fs.readFileString("/bom.json"), Sbom.toJson(document));
    }));
    it.effect("reports the path and original filesystem failure when the parent is absent", () => Effect.gen(function* () {
      const error = yield* Effect.flip(Sbom.write(document, "/missing/bom.json"));
      assert.instanceOf(error, SbomWriteError);
      assert.strictEqual(error.path, "/missing/bom.json");
      const Failure = S.Struct({ reason: S.TaggedStruct("NotFound", {}) });
      assertTrue(S.is(Failure)(error.cause));
      assert.strictEqual(error.message, 'Failed to write the SBOM to /missing/bom.json');
    }));
  });
});
