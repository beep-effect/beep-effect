import * as NodeURL from "node:url";
import { NodeServices } from "@effect/platform-node";
import { expect, it, vi } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as Str from "effect/String";

// Native process contract under test: unlike the Bun shim, Node's spawnSync supports a timeout.
interface NativeProcessBoundary {
  readonly spawnSync: (
    command: string,
    args: ReadonlyArray<string>,
    options: {
      readonly cwd: string;
      readonly encoding: "utf8";
      readonly timeout: number;
      readonly stdio: readonly ["ignore", "pipe", "pipe"];
    }
  ) => {
    readonly error?: Error;
    readonly signal: NodeJS.Signals | null;
    readonly status: number | null;
    readonly stdout: string;
    readonly stderr: string;
  };
}

// Exercise the complete setup in a disposable Node process. Only Vitest's assertion-registration
// import is stubbed: there is no test runner inside that process. Real HTTP servers are unref'd
// so natural process exit can test lock cleanup without terminating or signalling a worker.
const probe = String.raw`
const assert = require("node:assert/strict");
assert.equal(process.versions.bun, undefined, "The cleanup probe requires real Node.");
const fs = require("node:fs");
const vm = require("node:vm");
const http = require("node:http");
const source = fs.readFileSync(process.argv[2], "utf8");
const original = http.createServer;
http.createServer = (...args) => {
  const server = original(...args);
  server.unref();
  return server;
};
const initialListeners = process.listenerCount("exit");
const initialLimit = process.getMaxListeners();
(async () => {
  for (let evaluation = 0; evaluation < 12; evaluation++) {
    if (process.argv[3] === "reinstall") delete globalThis.Bun;
    vm.runInThisContext("(function(require,module,exports){" + source + "\n})")(
      require, { exports: {} }, {}
    );
    const retained = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => new Response("retained") });
    const lock = Bun.shimPortLockDirectory + "/" + retained.port + ".lock";
    assert.equal(fs.readFileSync(lock, "utf8"), "" + process.pid);
    console.log("retained=" + lock);
    const stopped = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => new Response("stopped") });
    const stoppedLock = Bun.shimPortLockDirectory + "/" + stopped.port + ".lock";
    assert.equal(fs.readFileSync(stoppedLock, "utf8"), "" + process.pid);
    await stopped.stop();
    assert.equal(fs.existsSync(stoppedLock), false);
    assert.equal(fs.existsSync(lock), true);
  }
  console.log("listener-delta=" + (process.listenerCount("exit") - initialListeners));
  assert.equal(process.getMaxListeners(), initialLimit);
  assert.equal(process.listenerCount("exit") - initialListeners, 1);
})().catch((error) => { console.error(error); process.exitCode = 1; });
`;

it.layer(NodeServices.layer)("Bun shim exit cleanup", (it) => {
  for (const mode of ["retained", "reinstall"]) {
    it.effect.skipIf(!P.hasProperty(Bun, "shimPortLockDirectory"))(
      `keeps one exit listener and releases every reservation across 12 ${mode} setup evaluations`,
      () =>
        Effect.gen(function* () {
          const NodeChildProcess = yield* Effect.promise(() =>
            vi.importActual<NativeProcessBoundary>("node:child_process")
          );
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = NodeURL.fileURLToPath(new URL("../../../../../", import.meta.url));
          const fixture = yield* fs.makeTempDirectoryScoped({ prefix: "vitest-exit-cleanup-" });
          const equalityStub = path.join(fixture, "equality.ts");
          const bundle = path.join(fixture, "setup.cjs");
          const runner = path.join(fixture, "probe.cjs");
          yield* fs.writeFileString(equalityStub, "export const addEqualityTesters = () => {};\n");
          yield* fs.writeFileString(runner, probe);
          const build = yield* Effect.sync(() =>
            NodeChildProcess.spawnSync(
              path.join(root, "node_modules/.bin/esbuild"),
              [
                path.join(root, "vitest.setup.ts"),
                "--bundle",
                "--platform=node",
                "--format=cjs",
                `--alias:@effect/vitest=${equalityStub}`,
                `--outfile=${bundle}`,
              ],
              { cwd: root, encoding: "utf8", timeout: 20_000, stdio: ["ignore", "pipe", "pipe"] }
            )
          );
          expect(build.error).toBeUndefined();
          expect(build.status, build.stderr).toBe(0);
          const child = yield* Effect.sync(() =>
            NodeChildProcess.spawnSync(process.execPath, ["--trace-warnings", runner, bundle, mode], {
              cwd: root,
              encoding: "utf8",
              timeout: 20_000,
              stdio: ["ignore", "pipe", "pipe"],
            })
          );
          const output = child.stdout + child.stderr;
          const locks = A.map(A.filter(Str.split(output, "\n"), Str.startsWith("retained=")), Str.slice(9));
          expect(locks).toHaveLength(12);
          for (const lock of locks) expect(yield* fs.exists(lock), lock).toBe(false);
          expect(child.error).toBeUndefined();
          expect(child.signal).toBeNull();
          expect(child.status, output).toBe(0);
          expect(output).toContain("listener-delta=1");
          expect(output).not.toContain("MaxListenersExceededWarning");
        })
    );
  }
});
