import { NodeServices } from "@effect/platform-node";
import { assert, describe, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { errnoCases } from "../ErrnoParityContract.ts";
import { fileSystemCases } from "../FileSystemContract.ts";

layer(NodeServices.layer, { timeout: "30 seconds" })((it) => {
  it.effect("the reference resolves a link it created on the host temp volume", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const madeTempDirectoryScoped = yield* fs.makeTempDirectoryScoped({ prefix: "memfs-node-" });
      const d = yield* fs.realPath(madeTempDirectoryScoped);
      yield* fs.writeFileString(`${d}/target.txt`, "x");
      yield* fs.symlink(`${d}/target.txt`, `${d}/link`);
      const realPath1 = yield* fs.realPath(`${d}/link`);
      assert.strictEqual(
        realPath1,
        `${d}/target.txt`,
        "both contracts lean on POSIX links; the host temp volume must create and resolve them natively"
      );
      const readLink2 = yield* fs.readLink(`${d}/link`);
      assert.strictEqual(readLink2, `${d}/target.txt`);
    })
  );

  describe("FileSystem (node), the reference a disagreeing memory run is wrong against, in scoped os.tmpdir()", () =>
    fileSystemCases(it));
  describe(
    "FileSystem errno parity (node), not concurrent so a just-closed fd is never reused by another test",
    { concurrent: false },
    () => errnoCases(it, "node")
  );
});
