import { currentHostPlatform } from "@beep/utils/HostProcess";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { afterAll, expect, it, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as NetAddress from "effect/net/NetAddress";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";

const make = vi.fn<typeof import("@effect/platform-bun/BunHttpServer").make>();
vi.doMock("@effect/platform-bun/BunHttpServer", () => ({ make }));
afterAll(() => vi.doUnmock("@effect/platform-bun/BunHttpServer"));

const Services = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, FetchHttpClient.layer);
const emptyResponse = Effect.succeed(HttpServerResponse.empty({ status: 204 }));

it.layer(Services, { timeout: "20 seconds", excludeTestServices: true })((it) => {
  it.effect.skipIf(currentHostPlatform !== "linux")(
    "owns socket modes and cleanup with an injected server constructor",
    () =>
      Effect.gen(function* () {
        const cache = yield* Effect.promise(() => import("@beep/repo-cli/test/Cache"));
        const fixture = yield* Effect.promise(() => import("./cache-conformance-server.ts"));
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        yield* Effect.addFinalizer(() => Effect.sync(() => make.mockReset()));
        // This constructor double tests bookkeeping in the coverage runtime.
        // The separate native lifecycle case proves actual Bun Unix transport.
        make.mockImplementation((options) =>
          Effect.gen(function* () {
            const socket = O.getOrThrow(O.fromUndefinedOr("unix" in options ? options.unix : undefined));
            yield* fs.writeFileString(socket, "constructor double").pipe(Effect.orDie);
            return HttpServer.make({ address: NetAddress.unixPathAddress(socket), serve: () => Effect.void });
          })
        );
        const address = yield* Effect.scoped(
          Effect.gen(function* () {
            const proxy = yield* cache.makeCacheConformanceSocketProxy(
              cache.CacheConformanceProxyOptions.make({
                target: fixture.targetFor({ url: "http://127.0.0.1:0" }),
                bearers: fixture.bearers,
                holdMs: 25,
              })
            );
            const address = Redacted.value(proxy.address);
            expect((yield* fs.stat(address.path)).mode & 0o777).toBe(0o600);
            expect((yield* fs.stat(path.dirname(address.path))).mode & 0o777).toBe(0o700);
            expect(yield* proxy.events).toEqual([]);
            expect(make).toHaveBeenCalledWith({ unix: address.path, maxRequestBodySize: 64 * 1024 * 1024 });
            return address;
          })
        );
        expect(yield* fs.exists(address.path)).toBe(false);
        expect(yield* fs.exists(path.dirname(address.path))).toBe(false);
      })
  );

  it.effect.skipIf(currentHostPlatform !== "linux")("rejects a TCP address and removes the allocated directory", () =>
    Effect.gen(function* () {
      const cache = yield* Effect.promise(() => import("@beep/repo-cli/test/Cache"));
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* Ref.make(O.none<string>());
      const allocate = fs.makeTempDirectoryScoped;
      const allocation = vi
        .spyOn(fs, "makeTempDirectoryScoped")
        .mockImplementation((options) =>
          allocate(options).pipe(Effect.tap((path) => Ref.set(directory, O.some(path))))
        );
      yield* Effect.addFinalizer(() => Effect.sync(() => allocation.mockRestore()));
      yield* Effect.addFinalizer(() => Effect.sync(() => make.mockReset()));
      make.mockReturnValue(
        Effect.succeed(
          HttpServer.make({
            address: Result.getOrThrow(NetAddress.inetAddressFromIpString("127.0.0.1", 0)),
            serve: () => Effect.void,
          })
        )
      );
      const error = yield* cache.serveCachePrivateSocket(emptyResponse, 1024).pipe(Effect.flip, Effect.scoped);
      expect(error.message).toBe("Private cache server did not bind a Unix socket.");
      expect(yield* fs.exists(O.getOrThrow(yield* Ref.get(directory)))).toBe(false);
    })
  );

  it.effect.skipIf(currentHostPlatform !== "linux")("preserves bind defects and removes the allocated directory", () =>
    Effect.gen(function* () {
      const cache = yield* Effect.promise(() => import("@beep/repo-cli/test/Cache"));
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* Ref.make(O.none<string>());
      const allocate = fs.makeTempDirectoryScoped;
      const allocation = vi
        .spyOn(fs, "makeTempDirectoryScoped")
        .mockImplementation((options) =>
          allocate(options).pipe(Effect.tap((path) => Ref.set(directory, O.some(path))))
        );
      yield* Effect.addFinalizer(() => Effect.sync(() => allocation.mockRestore()));
      yield* Effect.addFinalizer(() => Effect.sync(() => make.mockReset()));
      make.mockReturnValue(Effect.die("synthetic private socket bind"));
      const error = yield* cache.serveCachePrivateSocket(emptyResponse, 1024).pipe(Effect.flip, Effect.scoped);
      expect(error.message).toBe("Cannot run the private cache socket server.");
      expect(error.cause).toMatchObject({ cause: "synthetic private socket bind" });
      expect(yield* fs.exists(O.getOrThrow(yield* Ref.get(directory)))).toBe(false);
    })
  );
});
