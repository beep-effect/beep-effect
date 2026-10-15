import { BlobClient, BlockBlobClient } from "@azure/storage-blob";
import { assert, describe, it, vi } from "@effect/vitest";
import { assertNone, assertExitFailure } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import { Artifact, ArtifactError } from "../../effected/github-actions/Artifact.ts";
import { BlobTransferError } from "../../effected/github-actions/BlobTransfer.ts";
import type { FileBlobTransfer } from "../../effected/github-actions/BlobTransfer.ts";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { json, resultsEnv, runtimeToken, twirpFetch } from "./results.ts";

const fault = PlatformError.badArgument({ module: "FileSystem", method: "test", description: "injected failure" });
const handlers = {
  ListArtifacts: () => json({ artifacts: [{ databaseId: "7", name: "logs", size: "4" }] }),
  CreateArtifact: () => json({ ok: true, signedUploadUrl: "https://blob.example/container/artifact?sig=test" }),
  FinalizeArtifact: () => json({ ok: true, artifactId: "7" }),
  GetSignedArtifactURL: () => json({ signedUrl: "https://blob.example/container/artifact?sig=test" }),
  DeleteArtifact: () => json({ ok: true }),
};
interface FixtureOptions {
  readonly responses?: Parameters<typeof twirpFetch>[0];
  readonly env?: Readonly<Record<string, string>>;
  readonly fs?: (fs: FileSystem.FileSystem) => FileSystem.FileSystem;
  readonly spawnFails?: boolean;
  readonly transferFails?: boolean;
  readonly azure?: boolean;
}
const fixture = (options: FixtureOptions = {}) => {
  const rpc = twirpFetch({ ...handlers, ...options.responses });
  const fsLayer = options.fs === undefined ? MemoryFileSystem.layer : Layer.effect(FileSystem.FileSystem,
    Effect.map(FileSystem.FileSystem, options.fs)).pipe(Layer.provide(MemoryFileSystem.layer));
  const spawner = Layer.effect(ChildProcessSpawner.ChildProcessSpawner, Effect.map(FileSystem.FileSystem, (fs) =>
    ChildProcessSpawner.make((command) => Effect.gen(function* () {
      if (options.spawnFails === true) return yield* fault;
      if ("args" in command && command.command === "zip") {
        const destination = command.args[2];
        if (destination === undefined) return yield* Effect.die("missing zip destination");
        yield* fs.writeFileString(destination, "archive bytes");
      }
      return ChildProcessSpawner.makeHandle({
        pid: ChildProcessSpawner.ProcessId(42), exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
        isRunning: Effect.succeed(false), kill: () => Effect.void, stdin: Sink.drain,
        stdout: Stream.empty, stderr: Stream.empty, all: Stream.empty,
        getInputFd: () => Sink.drain, getOutputFd: () => Stream.empty, unref: Effect.succeed(Effect.void),
      });
    })))).pipe(Layer.provide(fsLayer));
  const artifact = options.azure === true ? Artifact.layer : Layer.unwrap(Effect.map(FileSystem.FileSystem, (fs) => {
    const transfer: FileBlobTransfer = {
      uploadFile: () => options.transferFails === true ? Effect.fail(BlobTransferError.make({ reason: "uploadFailed" })) : Effect.void,
      downloadToFile: (_url, destination) => options.transferFails === true
        ? Effect.fail(BlobTransferError.make({ reason: "downloadFailed" }))
        : fs.writeFileString(destination, "archive bytes").pipe(Effect.mapError((cause) => BlobTransferError.make({ reason: "downloadFailed", cause }))),
    };
    return Artifact.layerWith(transfer);
  }));
  return artifact.pipe(Layer.provideMerge(Layer.mergeAll(fsLayer, Path.layer, spawner,
    resultsEnv(options.env), FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch)(rpc.fetch))))));
};
const upload = (artifact: Artifact["Service"]) => artifact.upload("logs", ["/work/a.txt"], "/work");
const failed = <A>(name: string, options: FixtureOptions,
  operation: (artifact: Artifact["Service"]) => Effect.Effect<A, ArtifactError>,
  reason: ArtifactError["reason"], detail?: string) => {
  it.layer(fixture(options), { timeout: "30 seconds" })((it) => {
    it.effect(name, () => Effect.gen(function* () {
      const error = yield* Effect.flip(operation(yield* Artifact));
      assert.strictEqual(error.reason, reason);
      if (detail !== undefined) assert.include(error.message, detail);
    }));
  });
};

describe("Artifact uncovered protocol outcomes", () => {
  failed("invalid token scopes name the misconfiguration", { env: { ACTIONS_RUNTIME_TOKEN: runtimeToken("other:scope") } }, (a) => a.list, "misconfigured");
  failed("malformed Twirp bodies retain the unreachable failure", { responses: { ListArtifacts: () => new Response("not json") } }, (a) => a.list, "unreachable");
  for (const response of [() => json({}, 409), () => json({ ok: false })]) {
    failed("create refusal terminates upload", { responses: { CreateArtifact: response } }, upload, "refused", "already exists");
    failed("finalize refusal terminates upload", { responses: { FinalizeArtifact: response } }, upload, "refused", "did not confirm");
    failed("delete refusal terminates removal", { responses: { DeleteArtifact: response } }, (a) => a.delete("logs"), "refused", "did not confirm");
    failed("signed URL refusal terminates download", { responses: { GetSignedArtifactURL: response } }, (a) => a.download(7), "refused", "no url");
  }
  failed("successful create without URL is refused", { responses: { CreateArtifact: () => json({ ok: true }) } }, upload, "refused", "no upload url");
  failed("upload transfer errors stay typed", { transferFails: true }, upload, "transferFailed");
  failed("download transfer errors stay typed", { transferFails: true }, (a) => a.download(7), "transferFailed");
  failed("spawn failure preserves the archive failure", { spawnFails: true }, upload, "archiveFailed");
  failed("scratch creation failure stays typed", { fs: (fs) => ({ ...fs, makeTempDirectory: () => Effect.fail(fault) }) }, upload, "archiveFailed");
  failed("default download directory failure stays typed", { fs: (fs) => ({ ...fs, makeTempDirectory: () => Effect.fail(fault) }) }, (a) => a.download(7), "archiveFailed");
  failed("explicit download directory failure stays typed", { fs: (fs) => ({ ...fs, makeDirectory: () => Effect.fail(fault) }) }, (a) => a.download(7, { path: "/out" }), "archiveFailed");
  failed("Windows manifest write failure stays typed", { env: { RUNNER_OS: "Windows" }, fs: (fs) => ({ ...fs, writeFileString: () => Effect.fail(fault) }) }, upload, "archiveFailed");
  failed("packed file stat failure stays typed", { fs: (fs) => ({ ...fs, stat: () => Effect.fail(fault) }) }, upload, "archiveFailed");
  failed("packed file digest stream failure stays typed", { fs: (fs) => ({ ...fs, stream: () => Stream.fail(fault) }) }, upload, "archiveFailed");

  for (const [response, expected] of [
    [() => json({}, 409), []],
    [() => json({}), []],
    [() => json({ artifacts: [{}] }), [{ id: 0, name: "", size: 0 }]],
  ] as const) {
    it.layer(fixture({ responses: { ListArtifacts: response } }), { timeout: "30 seconds" })((it) => {
      it.effect("list handles conflicts, missing rows and row defaults", () => Effect.gen(function* () {
        const list = yield* (yield* Artifact).list;
        assert.deepStrictEqual(list, expected);
      }));
    });
  }
  it.layer(fixture({ responses: { FinalizeArtifact: () => json({ ok: true }) } }), { timeout: "30 seconds" })((it) => {
    it.effect("finalize defaults a missing id and delete uses the listed id", () => Effect.gen(function* () {
      const artifact = yield* Artifact;
      assert.strictEqual((yield* upload(artifact)).id, 0);
      assert.deepStrictEqual(yield* artifact.delete("logs"), { id: 7 });
      assertNone(yield* artifact.get("absent"));
      const downloaded = yield* artifact.download(7);
      assert.include(downloaded.downloadPath, "effected-artifact-download-");
    }));
  });
  it.layer(fixture({ responses: { FinalizeArtifact: (body) => {
    assert.strictEqual(body.expiresAt, "1970-01-08T00:00:00.000Z");
    return json({ ok: true, artifactId: "7" });
  } } }), { timeout: "30 seconds" })((it) => {
    it.effect("positive retention and explicit compression upload and explicit paths download", () => Effect.gen(function* () {
      const artifact = yield* Artifact;
      assert.deepStrictEqual(yield* artifact.upload("logs", ["/work/a.txt"], "/work", { retentionDays: 7, compressionLevel: 3 }), { id: 7, size: 13 });
      assert.deepStrictEqual(yield* artifact.download(7, { path: "/out" }), { downloadPath: "/out" });
    }));
  });
  it.layer(fixture({ azure: true }), { timeout: "30 seconds" })((it) => {
    it.effect("Azure rejections are mapped for both live transfer operations", () => Effect.gen(function* () {
      const uploadSpy = vi.spyOn(BlockBlobClient.prototype, "uploadFile").mockRejectedValue(new Error("upload refused"));
      const downloadSpy = vi.spyOn(BlobClient.prototype, "downloadToFile").mockRejectedValue(new Error("download refused"));
      yield* Effect.acquireUseRelease(Effect.void, () => Effect.gen(function* () {
        const artifact = yield* Artifact;
        assert.strictEqual((yield* Effect.flip(upload(artifact))).reason, "transferFailed");
        assert.strictEqual((yield* Effect.flip(artifact.download(7))).reason, "transferFailed");
        assert.strictEqual(uploadSpy.mock.calls.length, 1);
        assert.strictEqual(downloadSpy.mock.calls.length, 1);
      }), () => Effect.sync(() => { uploadSpy.mockRestore(); downloadSpy.mockRestore(); }));
    }));
  });
});

it.effect("unstubbed artifact members die and supplied members take precedence", () => Effect.gen(function* () {
  const artifact = Artifact.makeTest();
  const effects: ReadonlyArray<Effect.Effect<unknown, ArtifactError>> = [artifact.list, artifact.upload("x", [], "/"), artifact.get("x"), artifact.download(1), artifact.delete("x")];
  for (const effect of effects) {
    const exit = yield* Effect.exit(effect);
    assertExitFailure(exit, Exit.isFailure(exit) ? exit.cause : assert.fail("expected defect"));
  }
  assert.deepStrictEqual(yield* Artifact.makeTest({ list: Effect.succeed([]) }).list, []);
}));

it.effect("ArtifactError renders each reason and optional context", () => Effect.sync(() => {
  const messages = [
    ["misconfigured", "The artifact service is not reachable from here"],
    ["unreachable", "The artifact service could not be reached"],
    ["refused", "The artifact service refused"],
    ["notFound", "No artifact exists in this run"],
    ["archiveFailed", "The artifact archive could not be built or extracted"],
    ["transferFailed", "The artifact archive did not transfer"],
    ["invalidOptions", "The artifact call cannot be made as asked"],
  ] as const;
  for (const [reason, message] of messages) assert.strictEqual(ArtifactError.make({ reason }).message, message);
  assert.strictEqual(ArtifactError.make({ reason: "refused", artifact: "logs", status: 403, detail: "denied" }).message,
    'The artifact service refused "logs" with status 403: denied');
  assert.strictEqual(ArtifactError.make({ reason: "archiveFailed", artifact: "logs", stderr: "disk full" }).message,
    'The artifact archive could not be built or extracted "logs": disk full');
}));
