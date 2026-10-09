import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as Stream from "effect/Stream";

// Exercise native sockets and the installed dependency graph in a bounded child.
// MemoryFileSystem cannot represent either boundary.
it.layer(NodeServices.layer, {
  excludeTestServices: true,
  timeout: "15 seconds",
})((it) => {
  it.effect("keeps the installed FTP override compatible with get-uri downloads and caching", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const fixture = path.join(import.meta.dirname, "fixtures", "basic-ftp-compatibility.mjs");
      const root = path.resolve(import.meta.dirname, "../../../../..");
      const child = yield* spawner.spawn(ChildProcess.make(process.execPath, [fixture, root]));
      const [output, code] = yield* Effect.all([child.all.pipe(Stream.decodeText(), Stream.mkString), child.exitCode], {
        concurrency: "unbounded",
      });
      expect(code, output).toBe(0);
      expect(output).toContain('"download":"exact payload"');
      expect(output).toContain('"missing":"ENOTFOUND"');
      expect(output).toContain('"cache":"ENOTMODIFIED"');
    })
  );
});
