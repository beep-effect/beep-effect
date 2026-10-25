// runBin / runCarrierBin stdin against a REAL spawned bin that echoes what it
// reads. A hand-made consumer over a temp directory: no package manager runs.

import { InstalledConsumer } from "@beep/repo-workspaces/testing";
import { afterAll, assert, beforeAll, layer } from "@effect/vitest";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as Stream from "effect/Stream";
import { makeNodeFixture, nodeHost } from "../utils/nodeFixture.ts";

// Writes "got:<stdin>" and the byte count; reads to end of input, so an open pipe would hang.
const ECHO = `#!/usr/bin/env node
const chunks = [];
process.stdin.on("data", (c) => chunks.push(c));
process.stdin.on("end", () => {
  const input = Buffer.concat(chunks);
  process.stdout.write("got:" + input.toString("utf8") + "|" + input.length);
});
`;
const CARRIER_MANIFEST = '{"name":"carrier","version":"1.0.0","bin":{"echo":"bin/echo.js"}}';

const fixture = makeNodeFixture();
/** The consumer directory, realpath'd, written once before the suite runs. */
let directory = "";

beforeAll(() =>
  fixture.runtime.runPromise(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.realPath(yield* fixture.tempDirectory("run-bin-stdin-"));
      const carrier = path.join(dir, "node_modules", "carrier");
      const shim = path.join(dir, "node_modules", ".bin", "echo");
      yield* fs.makeDirectory(path.join(dir, "node_modules", ".bin"), { recursive: true });
      yield* fs.makeDirectory(path.join(carrier, "bin"), { recursive: true });
      yield* fs.writeFileString(path.join(carrier, "bin", "echo.js"), ECHO);
      yield* fs.writeFileString(path.join(carrier, "package.json"), CARRIER_MANIFEST);
      yield* fs.writeFileString(shim, ECHO);
      yield* fs.chmod(shim, 0o755);
      directory = dir;
    })
  )
);
afterAll(() => fixture.close());

/** The consumer over the real PATH, read through `Config` so the ambient provider decides. */
const consumer = Config.String("PATH").pipe(
  Config.withDefault(""),
  Effect.map((path) =>
    InstalledConsumer.make({
      manager: "npm",
      managerVersion: "0.0.0",
      directory,
      carrier: "carrier",
      env: Redacted.make({ PATH: path }),
    })
  )
);

layer(nodeHost, { timeout: "30 seconds" })("runBin and runCarrierBin stdin, real spawn", (it) => {
  it.effect("a string is written to the bin's stdin and closed", () =>
    Effect.gen(function* () {
      const output = yield* (yield* consumer).runBin("echo", [], { stdin: "héllo" });
      assert.strictEqual(output.stdout, "got:héllo|6");
    })
  );

  it.effect("bytes and a chunked stream arrive whole", () =>
    Effect.gen(function* () {
      const bytes = yield* (yield* consumer).runBin("echo", [], { stdin: new Uint8Array([104, 105]) });
      assert.strictEqual(bytes.stdout, "got:hi|2");
      const encoder = new TextEncoder();
      const streamed = yield* (yield* consumer).runBin("echo", [], {
        stdin: Stream.make(encoder.encode("ab"), encoder.encode("cd")),
      });
      assert.strictEqual(streamed.stdout, "got:abcd|4");
    })
  );

  it.effect("omitted stdin is end of input at once: the bin exits instead of hanging", () =>
    Effect.gen(function* () {
      const output = yield* (yield* consumer).runBin("echo", [], { timeout: "10 seconds" });
      assert.strictEqual(output.stdout, "got:|0");
      assert.isTrue(output.succeeded);
    })
  );

  it.effect("runCarrierBin takes stdin the same way", () =>
    Effect.gen(function* () {
      const output = yield* (yield* consumer).runCarrierBin("echo", [], { stdin: "framed" });
      assert.strictEqual(output.stdout, "got:framed|6");
      const bare = yield* (yield* consumer).runCarrierBin("echo", [], { timeout: "10 seconds" });
      assert.strictEqual(bare.stdout, "got:|0");
    })
  );
});
