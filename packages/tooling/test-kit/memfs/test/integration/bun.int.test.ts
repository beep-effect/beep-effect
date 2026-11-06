// The Bun leg of the differential oracle: the identical vendored contract
// suite, run against the REAL filesystem through @effect/platform-bun (a
// devDependency). BunServices serves `FileSystem.FileSystem` from the Bun
// adapter. Everything the suite touches lives under a scoped temp directory,
// so this run is confined to the host's os.tmpdir() and never touches the
// repository tree.
//
// The Bun adapter shares the node adapter's implementation, but runs it on
// Bun's own `node:fs`. The subpath also loads on Node, where a run proves only
// compatibility: the package's integration script executes this file under
// `bunx --bun vitest` so it proves the Bun runtime behavior.

import * as BunServices from "@effect/platform-bun/BunServices";
import { assert, describe, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { fileSystemCases } from "../FileSystemContract.ts";

layer(BunServices.layer, { timeout: "30 seconds" })((it) => {
  it.effect("runs on the Bun runtime", () =>
    Effect.sync(() => {
      assert.isDefined(process.versions.bun);
    })
  );

  // Both contracts lean on POSIX links; the reference's host temp volume must
  // create and resolve them natively for its answers to mean anything.
  it.effect("the reference resolves a link it created on the host temp volume", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const madeTempDirectoryScoped = yield* fs.makeTempDirectoryScoped({ prefix: "memfs-bun-" });
      const d = yield* fs.realPath(madeTempDirectoryScoped);
      yield* fs.writeFileString(`${d}/target.txt`, "x");
      yield* fs.symlink(`${d}/target.txt`, `${d}/link`);
      const realPath1 = yield* fs.realPath(`${d}/link`);
      assert.strictEqual(realPath1, `${d}/target.txt`);
      const readLink2 = yield* fs.readLink(`${d}/link`);
      assert.strictEqual(readLink2, `${d}/target.txt`);
    })
  );

  // Only the behavioral contract runs here. The errno parity contract pins the
  // node adapter's failure shapes on Node's `node:fs`, which memfs mirrors;
  // Bun's `node:fs` maps several edge cases to other errnos (copyFile from a
  // directory, remove with a trailing slash, recursive makeDirectory through
  // dangling or looping symlinks), so it is not that oracle.
  describe("FileSystem (bun)", () => fileSystemCases(it));
});
