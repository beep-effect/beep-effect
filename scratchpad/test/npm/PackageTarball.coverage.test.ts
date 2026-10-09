import { assert, describe, it } from "@effect/vitest";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import { HttpClient, HttpClientResponse } from "effect/http";
import { MemoryFileSystem, type MemoryFileSystemFaults } from "../../effected/memfs/index.ts";
import { PublishedVersion } from "../../effected/npm/NpmRegistry.ts";
import { PackageTarball, TarballError } from "../../effected/npm/PackageTarball.ts";
import { scripted } from "./publish-fixtures.ts";

const denied = PlatformError.systemError({ _tag: "PermissionDenied", module: "FileSystem", method: "writeFile" });
const http = Layer.succeed(HttpClient.HttpClient, HttpClient.make((request) =>
  Effect.succeed(HttpClientResponse.fromWeb(request, new Response(new Uint8Array([1, 2, 3]))))));
const crypto = Layer.succeed(Crypto.Crypto, Crypto.make({
  randomBytes: (size) => new Uint8Array(size),
  digest: () => Effect.succeed(new Uint8Array([0])),
}));

describe("PackageTarball remaining service paths", () => {
  for (const integrity of ["sha1-AA==", "sha256-AA==", "sha384-AA==", "sha224.ab", "sha512.ab", "1/ab"]) {
    const spawner = scripted(() => ({ exit: 0 }));
    const layer = PackageTarball.layer.pipe(Layer.provide(Layer.mergeAll(http, crypto, spawner.layer, MemoryFileSystem.layer)));
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect(`extracts or explicitly skips unsupported verification for ${integrity}`, () => Effect.gen(function* () {
        const published = yield* S.decodeEffect(PublishedVersion)({ name: "pkg", version: "1.0.0", tarball: "https://registry.test/pkg.tgz", integrity });
        const tarball = yield* PackageTarball;
        assert.match(yield* tarball.extract(published), /\/package$/);
        assert.strictEqual(spawner.spawns.length, 1);
        assert.strictEqual(spawner.spawns[0]?.command, "tar");
      }));
    });
  }
  for (const method of ["makeTempDirectoryScoped", "writeFile"] as const) {
    const faults: MemoryFileSystemFaults = { [method]: () => Effect.fail(denied) };
    const spawner = scripted(() => ({ exit: 0 }));
    const layer = PackageTarball.layer.pipe(Layer.provide(Layer.mergeAll(http, crypto, spawner.layer, MemoryFileSystem.layerWith({}, { faults }))));
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect(`preserves ${method} failure and never spawns tar`, () => Effect.gen(function* () {
        const published = yield* S.decodeEffect(PublishedVersion)({ name: "pkg", version: "1.0.0", tarball: "https://registry.test/pkg.tgz" });
        const tarball = yield* PackageTarball;
        const failure = yield* Effect.flip(tarball.extract(published));
        assert.strictEqual(failure.reason, "extractFailed");
        assert.strictEqual(failure.cause, denied);
        assert.deepStrictEqual(spawner.spawns, []);
      }));
    });
  }
  const brokenBody = Layer.succeed(HttpClient.HttpClient, HttpClient.make((request) =>
    Effect.succeed(HttpClientResponse.fromWeb(request, new Response(new ReadableStream({
      start: (controller) => controller.error(new Error("body interrupted")),
    }))))));
  const spawner = scripted(() => ({ exit: 0 }));
  const layer = PackageTarball.layer.pipe(Layer.provide(Layer.mergeAll(brokenBody, crypto, spawner.layer, MemoryFileSystem.layer)));
  it.layer(layer, { timeout: "30 seconds" })((it) => {
    it.effect("maps a failed response body to http without extracting", () => Effect.gen(function* () {
      const published = yield* S.decodeEffect(PublishedVersion)({ name: "pkg", version: "1.0.0", tarball: "https://registry.test/pkg.tgz" });
      const tarball = yield* PackageTarball;
      const failure = yield* Effect.flip(tarball.extract(published));
      assert.strictEqual(failure.reason, "http");
      assert.deepStrictEqual(spawner.spawns, []);
    }));
  });
});

it.effect("includes a known HTTP status in the tarball diagnostic", () => Effect.sync(() => {
  assert.strictEqual(TarballError.make({ reason: "http", package: "pkg", version: "1.0.0", status: 503 }).message,
    "Could not download the tarball for pkg@1.0.0 (HTTP 503)");
}));
