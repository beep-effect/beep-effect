import { it } from "@beep/test-runner";
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import { NodeServices } from "@effect/platform-node";
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import { assert } from "@effect/vitest";
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
// written through Bun.file and Bun.write, which the shim provides too.
const shimLockDirectory: unknown = Reflect.get(Bun, "shimPortLockDirectory");
const lockDirectory = P.isString(shimLockDirectory) ? shimLockDirectory : "";
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
      const serve = (text: string) =>
        Effect.gen(function* () {
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
        }).pipe(Effect.scoped);
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
      const response = yield* HttpClient.get("http://localhost/").pipe(
        Effect.flatMap((response) => response.text),
        Effect.provide(NodeHttpClient.layerNodeHttpOptions({ socketPath: socket }))
      );
      assert.strictEqual(response, "owner");
    })
  );
});
