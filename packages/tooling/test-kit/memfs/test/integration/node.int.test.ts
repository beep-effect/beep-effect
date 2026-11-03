// The differential oracle: the identical vendored contract suite, run against
// the REAL filesystem through @effect/platform-node (a devDependency — the
// `@effected/workspaces` self.int.test.ts precedent). NodeServices serves
// `FileSystem.FileSystem` from the node adapter, the reference implementation.
// Everything the suite touches lives under a scoped temp directory, so this
// run is confined to the host's os.tmpdir() and never touches the repository
// tree.
//
// If the memory run and this run ever disagree, the engine is wrong, never the
// expectation — the platform layer is the reference implementation.

import { NodeServices } from "@effect/platform-node";
import { assert, describe, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { errnoCases } from "../ErrnoParityContract.ts";
import { fileSystemCases } from "../FileSystemContract.ts";

layer(NodeServices.layer, { timeout: "30 seconds" })((it) => {
  // Both contracts lean on POSIX links; the reference's host temp volume must
  // create and resolve them natively for its answers to mean anything.
  it.effect("the reference resolves a link it created on the host temp volume", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const madeTempDirectoryScoped = yield* fs.makeTempDirectoryScoped({ prefix: "memfs-node-" });
      const d = yield* fs.realPath(madeTempDirectoryScoped);
      yield* fs.writeFileString(`${d}/target.txt`, "x");
      yield* fs.symlink(`${d}/target.txt`, `${d}/link`);
      const realPath1 = yield* fs.realPath(`${d}/link`);
      assert.strictEqual(realPath1, `${d}/target.txt`);
      const readLink2 = yield* fs.readLink(`${d}/link`);
      assert.strictEqual(readLink2, `${d}/target.txt`);
    })
  );

  describe("FileSystem (node)", () => fileSystemCases(it));
  // Not concurrent, so it runs alone in this worker: the closed-descriptor
  // cases expect EBADF from a just-closed fd, and the repo runs tests
  // concurrently (vitest `sequence.concurrent`), so an open in a concurrent
  // test could reuse that fd number and answer the stat — a harness race, not
  // the adapter's answer.
  describe("FileSystem errno parity (node)", { concurrent: false }, () => errnoCases(it, "node"));
});
