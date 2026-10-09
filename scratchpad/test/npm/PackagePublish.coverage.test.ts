import { assert, describe, it } from "@effect/vitest";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PlatformError from "effect/PlatformError";
import * as Redacted from "effect/Redacted";
import { LocalExec } from "../../effected/commands/index.ts";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { PackagePublish } from "../../effected/npm/PackagePublish.ts";
import { scripted, fakeCrypto } from "./publish-fixtures.ts";

const denied = PlatformError.systemError({ _tag: "PermissionDenied", module: "FileSystem", method: "writeFile" });

describe("PackagePublish remaining failure paths", () => {
  const spawner = scripted(() => ({ stdout: "stdout failure", exit: 3 }));
  const layer = PackagePublish.layer.pipe(Layer.provide(Layer.mergeAll(spawner.layer, fakeCrypto, MemoryFileSystem.layer, LocalExec.layerNone)));
  it.layer(layer, { timeout: "30 seconds" })((it) => {
    it.effect("uses stdout when stderr is empty for pack, publish and dry-run failures", () => Effect.gen(function* () {
      const publisher = yield* PackagePublish;
      const pack = yield* Effect.flip(publisher.pack("/pkg"));
      assert.strictEqual(pack.kind, "pack");
      assert.strictEqual(pack.output, "stdout failure");
      const publish = yield* Effect.flip(publisher.publishTarball("/pkg.tgz", { registry: "https://registry.test" }));
      assert.strictEqual(publish.kind, "publish");
      assert.strictEqual(publish.output, "stdout failure");
      assert.deepStrictEqual(yield* publisher.dryRun("/pkg"), { ok: false, output: "stdout failure" });
    }));
  });
  const writeLayer = PackagePublish.layer.pipe(Layer.provide(Layer.mergeAll(
    spawner.layer, fakeCrypto, LocalExec.layerNone,
    MemoryFileSystem.layerWith({ "/config": MemoryFileSystem.directory() }, { faults: { writeFileString: () => Effect.fail(denied) } }),
  )));
  it.layer(writeLayer, { timeout: "30 seconds" })((it) => {
    it.effect("maps an npmrc write failure to auth and preserves its cause", () => Effect.gen(function* () {
      const publisher = yield* PackagePublish;
      const failure = yield* Effect.flip(publisher.setupAuth({ registry: "https://registry.test", npmrcPath: "/config/.npmrc", credential: { kind: "token", token: Redacted.make("fixture") } }));
      assert.strictEqual(failure.kind, "auth");
      assert.strictEqual(failure.cause, denied);
    }));
  });
  const packSpawner = scripted(() => ({ stdout: '[{"name":"pkg","version":"1.0.0","filename":"pkg.tgz"}]' }));
  const refusingCrypto = Layer.succeed(Crypto.Crypto, Crypto.make({ randomBytes: (size) => new Uint8Array(size), digest: () => Effect.fail(denied) }));
  const digestLayer = PackagePublish.layer.pipe(Layer.provide(Layer.mergeAll(packSpawner.layer, refusingCrypto, LocalExec.layerNone, MemoryFileSystem.layerWith({ "/pkg/pkg.tgz": "bytes" }))));
  it.layer(digestLayer, { timeout: "30 seconds" })((it) => {
    it.effect("maps digest computation failure after a successful pack", () => Effect.gen(function* () {
      const publisher = yield* PackagePublish;
      const failure = yield* Effect.flip(publisher.pack("/pkg"));
      assert.strictEqual(failure.kind, "digest");
      assert.strictEqual(failure.subject, "/pkg/pkg.tgz");
      assert.strictEqual(failure.cause, denied);
    }));
  });
  const transportSpawner = scripted(() => denied);
  const transportLayer = PackagePublish.layer.pipe(Layer.provide(Layer.mergeAll(transportSpawner.layer, fakeCrypto, MemoryFileSystem.layer, LocalExec.layerNone)));
  it.layer(transportLayer, { timeout: "30 seconds" })((it) => {
    it.effect("maps a failed npm spawn through the workflow error boundary", () => Effect.gen(function* () {
      const publisher = yield* PackagePublish;
      const failure = yield* Effect.flip(publisher.pack("/pkg"));
      assert.strictEqual(failure.kind, "pack");
      assert.strictEqual(failure.subject, "/pkg");
      assert.isDefined(failure.cause);
    }));
  });
  const fs = MemoryFileSystem.makeSync({ "/config/.npmrc": "registry=https://registry.test" });
  const authLayer = PackagePublish.layer.pipe(Layer.provide(Layer.mergeAll(spawner.layer, fakeCrypto, fs.layer, LocalExec.layerNone)));
  it.layer(authLayer, { timeout: "30 seconds" })((it) => {
    it.effect("appends one separator to an npmrc lacking a newline and keeps a registry trailing slash", () => Effect.gen(function* () {
      const publisher = yield* PackagePublish;
      yield* publisher.setupAuth({ registry: "https://registry.test/", npmrcPath: "/config/.npmrc", credential: { kind: "token", token: Redacted.make("fixture") } });
      assert.strictEqual(fs.volume.text("/config/.npmrc"), "registry=https://registry.test\n//registry.test/:_authToken=fixture\n");
    }));
  });
  it.effect("every unstubbed test-double method dies naming the invoked method", () => Effect.gen(function* () {
    const publisher = PackagePublish.makeTest();
    const calls = [
      ["pack", publisher.pack("/pkg")],
      ["dryRun", publisher.dryRun("/pkg")],
      ["publishTarball", publisher.publishTarball("/pkg.tgz", { registry: "https://registry.test" })],
      ["setupAuth", publisher.setupAuth({ registry: "https://registry.test", npmrcPath: "/config/.npmrc", credential: { kind: "token", token: Redacted.make("fixture") } })],
    ] as const;
    for (const [method, call] of calls) {
      const defects = yield* Effect.flip(Effect.catchDefect(call, (defect) => Effect.fail(String(defect))));
      assert.include(defects, `${method}() was called but not stubbed`);
    }
  }));
});
