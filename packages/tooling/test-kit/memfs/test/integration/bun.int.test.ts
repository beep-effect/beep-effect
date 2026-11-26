import * as BunServices from "@effect/platform-bun/BunServices";
import { assert, describe, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { fileSystemCases } from "../FileSystemContract.ts";

layer(BunServices.layer, { timeout: "30 seconds" })((it) => {
  it.effect("runs on the Bun runtime", () =>
    Effect.sync(() => {
      assert.isDefined(
        process.versions.bun,
        "the integration script runs this file under bunx --bun vitest; on Node it would prove only compatibility"
      );
    })
  );

  it.effect("the reference resolves a link it created on the host temp volume", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const madeTempDirectoryScoped = yield* fs.makeTempDirectoryScoped({ prefix: "memfs-bun-" });
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

  // decision: bun-leg-runs-behavioral-contract-only
  describe("FileSystem (bun) on the real filesystem, confined to scoped os.tmpdir() directories", () =>
    fileSystemCases(it));
});
