import * as NodeModule from "node:module";
import { it } from "@beep/test-runner";
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import { NodeServices } from "@effect/platform-node";
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import { assert, vi } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";
import * as Stream from "effect/Stream";

// These cases exercise the Bun.serve shim that vitest.setup.ts installs for Node runs, which names
// its port lock directory on the Bun global; real Bun binds port 0 itself and has no such property.
// The reserved range sits below the Linux ephemeral floor of 32768. Lock files are read and
// read through Bun.file; fixture writes publish a complete inode without replacing another owner.
// This is the native boundary being tested, not a substitute FileSystem service. Vitest loads
// the real module so the race control can intercept the shim's unlink and retain real sockets.
interface ShimFileSystemBoundary {
  readonly default: {
    readonly rmSync: (path: string, options: { readonly force: boolean; readonly recursive?: boolean }) => void;
    readonly mkdtempSync: (prefix: string) => string;
    readonly writeFileSync: (path: string, contents: string, options: { readonly flag: "wx" }) => void;
    readonly renameSync: (existingPath: string, newPath: string) => void;
    readonly linkSync: (existingPath: string, newPath: string) => void;
    readonly existsSync: (path: string) => boolean;
  };
}
const nativeFileSystem = Effect.promise(() => vi.importActual<ShimFileSystemBoundary>("node:fs")).pipe(
  Effect.map((module) => module.default)
);

const shimLockDirectory: unknown = Reflect.get(Bun, "shimPortLockDirectory");
const lockDirectory = P.isString(shimLockDirectory) ? shimLockDirectory : "";
const shimActive = lockDirectory !== "";
const shimPortFloor = 20_000;
const ephemeralPortFloor = 32_768;
const shimPortCount = 12_000;
// No process can hold this pid: Linux caps pids at 2^22.
const exitedPid = 2_147_483_647;

const lockPath = (port: number) => `${lockDirectory}/${port}.lock`;
const readLock = (port: number) => Effect.tryPromise(() => Bun.file(lockPath(port)).text());
// Publish a fully written marker exclusively. A fixture may retire only its own live marker;
// cooperative allocators cannot replace that marker while this process is still alive.
const writeLock = Effect.fnUntraced(function* (port: number, owner: number, retireOwned?: boolean) {
  const fs = yield* nativeFileSystem;
  if (retireOwned === true) assert.strictEqual(yield* readLock(port), `${process.pid}`);
  yield* Effect.try(() => {
    const directory = fs.mkdtempSync(`${lockDirectory}/fixture-`);
    const staging = `${directory}/owner`;
    try {
      fs.writeFileSync(staging, `${owner}`, { flag: "wx" });
      if (retireOwned === true) fs.renameSync(staging, lockPath(port));
      else fs.linkSync(staging, lockPath(port));
    } finally {
      fs.rmSync(directory, { force: true, recursive: true });
    }
  });
});
const followingPort = (port: number, offset = 1) => shimPortFloor + ((port - shimPortFloor + offset) % shimPortCount);

const serveText = (text: string) =>
  Effect.sync(() => Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response(text) }));

// Bun types `port` as optional (a Unix-socket server has none); a TCP server always has one.
const portOf = (server: { readonly port?: number | undefined }): number => server.port ?? -1;

const stop = (server: { readonly stop: () => Promise<void> }) => Effect.promise(() => server.stop());

const fetchText = (port: number) =>
  HttpClient.get(`http://127.0.0.1:${port}/`).pipe(
    Effect.flatMap((response) => response.text),
    Effect.orDie
  );

// Serves once and stops at once, returning the port the shim handed out.
const servedPort = Effect.fnUntraced(function* (text: string) {
  const server = yield* serveText(text);
  yield* stop(server);
  return portOf(server);
});

// Retry only exclusive fixture acquisition when another process owns the candidate. Assertions
// and the controlled reclaimer interleaving run once after acquisition, outside this retry.
const reserveFixturePorts = Effect.fnUntraced(function* (owners: ReadonlyArray<number>, label: string) {
  return yield* Effect.gen(function* () {
    const first = yield* servedPort(label);
    const liveMarkers: Array<number> = [];
    return yield* Effect.gen(function* () {
      yield* Effect.forEach(
        owners,
        (owner, index) => {
          const port = followingPort(first, index + 1);
          return writeLock(port, owner).pipe(
            Effect.tap(() =>
              Effect.sync(() => {
                if (owner === process.pid) liveMarkers.push(port);
              })
            )
          );
        },
        { discard: true }
      );
      return first;
    }).pipe(
      Effect.onError(() =>
        Effect.forEach(liveMarkers, (port) => writeLock(port, exitedPid, true), { discard: true }).pipe(Effect.orDie)
      )
    );
  }).pipe(
    Effect.retry({
      times: 16,
      while: (error) => P.isError(error.cause) && P.hasProperty(error.cause, "code") && error.cause.code === "EEXIST",
    })
  );
});

it.layer(FetchHttpClient.layer)("vitest Bun.serve shim", (it) => {
  it.effect.skipIf(!shimActive)("serves every port-0 server on its own reserved port below the ephemeral range", () =>
    Effect.gen(function* () {
      const names = A.map(A.range(1, 40), (index) => `server-${index}`);
      const servers = yield* Effect.forEach(names, serveText);
      const ports = A.map(servers, portOf);
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

  it.effect.skipIf(!shimActive)("does not displace another reclaimer after reading an abandoned reservation", () =>
    Effect.gen(function* () {
      const first = yield* reserveFixturePorts([exitedPid], "before-reclaim");
      const abandoned = followingPort(first);
      const servers: Array<{ readonly port?: number | undefined; readonly stop: () => Promise<void> }> = [];
      const fs = yield* nativeFileSystem;
      const remove = fs.rmSync;
      let interleaved = false;
      // Pause at the actual unlink boundary: another allocator observes the same abandoned port
      // before the first allocator can remove it. Requests still exercise real Node HTTP servers.
      const removal = vi.spyOn(fs, "rmSync").mockImplementation((path, options) => {
        if (path === lockPath(abandoned) && !interleaved) {
          interleaved = true;
          servers.push(Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("contender") }));
        }
        remove(path, options);
      });
      NodeModule.syncBuiltinESMExports();
      yield* Effect.gen(function* () {
        servers.push(yield* serveText("reclaimer"));
        removal.mockRestore();
        NodeModule.syncBuiltinESMExports();
        assert.isTrue(interleaved);
        const ports = A.map(servers, portOf);
        assert.strictEqual(HashSet.size(HashSet.fromIterable(ports)), 2);
        const replies = yield* Effect.forEach(ports, fetchText, { concurrency: "unbounded" });
        assert.deepStrictEqual(replies, ["contender", "reclaimer"]);
      }).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            removal.mockRestore();
            NodeModule.syncBuiltinESMExports();
          })
        ),
        Effect.ensuring(Effect.forEach(servers, stop, { discard: true }))
      );
    })
  );

  it.effect.skipIf(!shimActive)("reclaims abandoned reservation links left by exited allocators", () =>
    Effect.gen(function* () {
      const first = yield* reserveFixturePorts([exitedPid], "before-abandoned-links");
      const abandoned = followingPort(first);
      const fs = yield* nativeFileSystem;
      const staging = `${lockDirectory}/${abandoned}.${exitedPid}.abandoned-${process.pid}.tmp`;
      const intent = `${lockDirectory}/${abandoned}.${exitedPid}.abandoned-${process.pid}.reap`;
      yield* Effect.sync(() => {
        fs.linkSync(lockPath(abandoned), staging);
        fs.linkSync(lockPath(abandoned), intent);
      });
      yield* Effect.gen(function* () {
        assert.strictEqual(yield* servedPort("after-abandoned-links"), abandoned);
        assert.isFalse(fs.existsSync(staging));
        assert.isFalse(fs.existsSync(intent));
      }).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            fs.rmSync(staging, { force: true });
            fs.rmSync(intent, { force: true });
          })
        )
      );
    })
  );

  it.effect.skipIf(!shimActive)("leaves an abandoned reservation alone while another reclaimer is live", () =>
    Effect.gen(function* () {
      const first = yield* reserveFixturePorts([exitedPid], "before-live-reclaimer");
      const abandoned = followingPort(first);
      const fs = yield* nativeFileSystem;
      const intent = `${lockDirectory}/${abandoned}.${process.pid}.active.reap`;
      yield* Effect.sync(() => fs.linkSync(lockPath(abandoned), intent));
      yield* Effect.gen(function* () {
        const port = yield* servedPort("after-live-reclaimer");
        assert.notStrictEqual(port, abandoned);
        assert.strictEqual(yield* readLock(abandoned), `${exitedPid}`);
        assert.isTrue(fs.existsSync(intent));
      }).pipe(Effect.ensuring(Effect.sync(() => fs.rmSync(intent, { force: true }))));
    })
  );

  it.effect.skipIf(!shimActive)("refuses to overwrite an existing live reservation while preparing a fixture", () =>
    Effect.gen(function* () {
      const first = yield* reserveFixturePorts([process.pid], "before-exclusive-fixture");
      const reserved = followingPort(first);
      yield* Effect.gen(function* () {
        const occupied = yield* Effect.flip(writeLock(reserved, exitedPid));
        assert.propertyVal(occupied.cause, "code", "EEXIST");
        assert.strictEqual(yield* readLock(reserved), `${process.pid}`);
      }).pipe(Effect.ensuring(writeLock(reserved, exitedPid, true).pipe(Effect.orDie)));
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
      const first = yield* reserveFixturePorts([process.pid, exitedPid], "first");
      // Afterwards the stand-in live reservation names an exited owner, so any process may reclaim it.
      const reclaimed = yield* servedPort("reclaimed").pipe(
        Effect.ensuring(writeLock(followingPort(first), exitedPid, true).pipe(Effect.orDie))
      );
      assert.strictEqual(reclaimed, followingPort(first, 2));
    })
  );
});

// Exercise the same public adapter and real socket used by managed launch clients.
it.layer(NodeServices.layer, { excludeTestServices: true })("vitest Bun.serve Unix socket", (it) => {
  it.effect("serves, reloads, stops and rebinds a Unix socket without a TCP reservation", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* fs.makeTempDirectoryScoped({ directory: "/tmp", prefix: "bun-uds-" });
      const socket = `${directory}/server.sock`;
      const client = yield* Layer.build(NodeHttpClient.layerNodeHttpOptions({ socketPath: socket }));
      const get = HttpClient.get("http://localhost/").pipe(
        Effect.flatMap((response) => response.text),
        Effect.provide(client)
      );
      const serve = Effect.fnUntraced(function* (text: string) {
        const context = yield* Layer.build(BunHttpServer.layer({ unix: socket }));
        const server = Context.get(context, HttpServer.HttpServer);
        assert.strictEqual(server.address._tag, "UnixPathAddress");
        yield* server.serve(Effect.succeed(HttpServerResponse.text(text)));
        assert.strictEqual((yield* fs.stat(socket)).type, "Socket");
        assert.strictEqual(yield* get, text);
        yield* server.serve(
          Effect.gen(function* () {
            const request = yield* HttpServerRequest.HttpServerRequest;
            return HttpServerResponse.text(
              request.method === "POST"
                ? yield* request.stream.pipe(
                    Stream.runFold(
                      () => "",
                      (text, bytes) => text + new TextDecoder().decode(bytes)
                    )
                  )
                : `${text}-reloaded`
            );
          })
        );
        assert.strictEqual(yield* get, `${text}-reloaded`);
        const posted = yield* HttpClientRequest.post("http://localhost/").pipe(
          HttpClientRequest.bodyText("synthetic-post"),
          HttpClient.execute,
          Effect.flatMap((response) => response.text),
          Effect.provide(client)
        );
        assert.strictEqual(posted, "synthetic-post");
      }, Effect.scoped);
      yield* serve("first");
      assert.strictEqual(yield* fs.exists(socket), false);
      yield* serve("rebound");
      assert.strictEqual(yield* fs.exists(socket), false);
    })
  );
  it.effect("refuses an occupied Unix socket without replacing its owner", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* fs.makeTempDirectoryScoped({ directory: "/tmp", prefix: "bun-uds-owned-" });
      const socket = `${directory}/server.sock`;
      const first = Context.get(yield* Layer.build(BunHttpServer.layer({ unix: socket })), HttpServer.HttpServer);
      yield* first.serve(Effect.succeed(HttpServerResponse.text("owner")));
      const original = yield* fs.stat(socket);
      const duplicate = yield* Effect.gen(function* () {
        const second = Context.get(yield* Layer.build(BunHttpServer.layer({ unix: socket })), HttpServer.HttpServer);
        // Node reports listen failures asynchronously; reload surfaces the retained bind error.
        yield* Effect.sleep("50 millis");
        yield* second.serve(Effect.succeed(HttpServerResponse.text("replacement")));
      }).pipe(Effect.scoped, Effect.exit);
      assert.strictEqual(duplicate._tag, "Failure");
      assert.deepStrictEqual((yield* fs.stat(socket)).ino, original.ino);
      const client = yield* Layer.build(NodeHttpClient.layerNodeHttpOptions({ socketPath: socket }));
      const response = yield* HttpClient.get("http://localhost/").pipe(
        Effect.flatMap((response) => response.text),
        Effect.provide(client)
      );
      assert.strictEqual(response, "owner");
    })
  );
});
