import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";

// These cases exercise the Bun.serve shim that vitest.setup.ts installs for Node runs, which names
// its port lock directory in this variable; real Bun binds port 0 itself and leaves it unset. The
// reserved range sits below the Linux ephemeral floor of 32768. Lock files are read and written
// through Bun.file and Bun.write, which the shim provides too.
const lockDirectory = process.env.BEEP_BUN_SERVE_SHIM_PORT_LOCKS ?? "";
const shimActive = lockDirectory !== "";
const shimPortFloor = 20_000;
const ephemeralPortFloor = 32_768;
// No process can hold this pid: Linux caps pids at 2^22.
const exitedPid = 2_147_483_647;

const lockPath = (port: number) => `${lockDirectory}/${port}.lock`;
const readLock = (port: number) => Effect.tryPromise(() => Bun.file(lockPath(port)).text());
const writeLock = (port: number, owner: number) => Effect.promise(() => Bun.write(lockPath(port), `${owner}`));

const serveText = (text: string) =>
  Effect.sync(() => Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response(text) }));

const stop = (server: { readonly stop: () => Promise<void> }) => Effect.promise(() => server.stop());

const fetchText = (port: number) =>
  Effect.promise(() => fetch(`http://127.0.0.1:${port}/`).then((response) => response.text()));

// Serves once and stops at once, returning the port the shim handed out.
const servedPort = Effect.fnUntraced(function* (text: string) {
  const server = yield* serveText(text);
  yield* stop(server);
  return server.port;
});

it.effect.skipIf(!shimActive)("serves every port-0 server on its own reserved port below the ephemeral range", () =>
  Effect.gen(function* () {
    const names = A.map(A.range(1, 40), (index) => `server-${index}`);
    const servers = yield* Effect.forEach(names, serveText);
    const ports = A.map(servers, (server) => server.port);
    yield* Effect.gen(function* () {
      assert.strictEqual(HashSet.size(HashSet.fromIterable(ports)), names.length);
      for (const port of ports) {
        assert.isAtLeast(port, shimPortFloor);
        assert.isBelow(port, ephemeralPortFloor);
        assert.strictEqual(yield* readLock(port), `${process.pid}`);
      }
      const replies = yield* Effect.forEach(ports, fetchText, { concurrency: "unbounded" });
      assert.deepStrictEqual(replies, names);
    }).pipe(Effect.ensuring(Effect.forEach(servers, stop, { discard: true })));
  })
);

it.effect.skipIf(!shimActive)("removes the port reservation when the server stops", () =>
  Effect.gen(function* () {
    const port = yield* servedPort("stopped");
    const missing = yield* Effect.flip(readLock(port));
    assert.propertyVal(missing.cause, "code", "ENOENT");
  })
);

it.effect.skipIf(!shimActive)("skips a port a live process reserved and reclaims one whose owner exited", () =>
  Effect.gen(function* () {
    // Ports are handed out in order after the last one this process claimed.
    const first = yield* servedPort("first");
    yield* writeLock(first + 1, process.ppid);
    yield* writeLock(first + 2, exitedPid);
    // Afterwards the stand-in live reservation names an exited owner, so any process may reclaim it.
    const reclaimed = yield* servedPort("reclaimed").pipe(Effect.ensuring(writeLock(first + 1, exitedPid)));
    assert.strictEqual(reclaimed, first + 2);
  })
);
