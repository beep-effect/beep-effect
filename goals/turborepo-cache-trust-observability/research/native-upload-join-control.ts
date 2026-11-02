/**
 * Reproduce the native task/upload join against disposable loopback storage.
 * Run with the repository's pinned Bun. The bounded result is written under
 * `.beep/producer-upload`; it authenticates no producer and qualifies no task.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import {
  CacheCommandError,
  CacheConformanceProxyEvent,
  CacheConformanceProxyOptions,
  CacheProducerBinding,
  CacheProtocolNativeSummary,
  makeCacheConformanceFaultProxy,
  resolveCacheConformanceClient,
} from "@beep/repo-cli/commands/Cache";
import {
  CacheHostedProducerUpload,
  CacheRuntimeProcess,
  decodeCacheExperimentText,
  hashCacheExperimentExecutable,
  joinCacheProducerUpload,
  readCacheExperimentBytes,
} from "@beep/repo-cli/test/Cache";
import { CacheClientChannel, CacheClientPin } from "@beep/repo-configs/cache";
import { Sha256Hex } from "@beep/schema";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  bearers,
  goodMode,
  makeConformanceServer,
  repoRoot,
  targetFor,
  teamId,
} from "../../../packages/tooling/tool/cli/test/cache-conformance-server.ts";
import { input } from "../../../packages/tooling/tool/cli/test/helpers/cache-producer-bundle-fixture.ts";

const $I = $RepoCliId.create("research/native-upload-join-control");
const NativeObservation = S.Struct({
  channel: CacheClientChannel,
  client: CacheClientPin,
  bunVersion: CacheClientPin.fields.version,
  bunSha256: Sha256Hex,
  summary: CacheProtocolNativeSummary,
  events: S.Array(CacheConformanceProxyEvent).check(S.isMaxLength(200)),
  upload: CacheHostedProducerUpload,
}).pipe(
  $I.annoteSchema("NativeObservation", {
    description: "Pinned native execution and its observed upload; synthetic binding and no authentication authority.",
  })
);
const ControlReport = S.Struct({
  schemaVersion: S.tag("cache-native-upload-join-control/v1"),
  recordedAt: S.DateTimeUtcFromString,
  authority: S.tag("synthetic-mechanism-observation-only"),
  observations: S.Array(NativeObservation).check(S.isMinLength(2), S.isMaxLength(2)),
  productionChanges: S.tag(false),
  qualified: S.tag(false),
  protectedProducer: S.tag(false),
}).pipe(
  $I.annoteSchema("ControlReport", {
    description: "Exactly two current pinned client controls; no production, qualification or producer grant.",
  })
);
const encodeManifest = S.encodeEffect(S.fromJsonString(S.Json));
const decodeSummary = S.decodeUnknownEffect(S.fromJsonString(CacheProtocolNativeSummary));
const encodeReport = S.encodeEffect(S.fromJsonString(ControlReport, { space: 2 }));
const bound = CacheRuntimeProcess.OutputBound.make({
  maxChars: 65536,
  truncatedNotice: "control capture exceeded bound",
});

const runOne = Effect.fn("NativeUploadControl.runOne")(function* (channel: CacheClientChannel) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* repoRoot;
  const bunVersion = yield* S.decodeUnknownEffect(CacheClientPin.fields.version)(process.versions.bun).pipe(
    CacheCommandError.mapError("This control requires the pinned native Bun runtime.")
  );
  const expectedBun = yield* fs.readFileString(path.join(root, ".bun-version"));
  if (bunVersion !== Str.trim(expectedBun))
    return yield* CacheCommandError.new("Native Bun differs from the repository pin.");
  const bun = yield* fs.realPath(process.execPath);
  const bunSha256 = yield* hashCacheExperimentExecutable(bun);
  const { pin, executable } = yield* resolveCacheConformanceClient(root, channel, false);
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "producer-native-join-" });
  yield* fs.makeDirectory(path.join(directory, "packages/owned"), { recursive: true });
  yield* fs.writeFileString(
    path.join(directory, "package.json"),
    yield* encodeManifest({
      name: "producer-native-join-fixture",
      private: true,
      packageManager: `bun@${bunVersion}`,
      workspaces: ["packages/*"],
    })
  );
  yield* fs.writeFileString(
    path.join(directory, "packages/owned/package.json"),
    yield* encodeManifest({ name: "@beep/producer-fixture", private: true, scripts: { build: "bun build.ts" } })
  );
  yield* fs.writeFileString(
    path.join(directory, "packages/owned/build.ts"),
    'await Bun.write("dist/result.txt", "owned-native-upload\\n");\n'
  );
  yield* fs.writeFileString(
    path.join(directory, "turbo.json"),
    yield* encodeManifest({ remoteCache: { signature: true }, tasks: { build: { outputs: ["dist/**"] } } })
  );
  const env = { PATH: `${path.dirname(bun)}:/usr/bin:/bin`, HOME: directory, CI: "1", DO_NOT_TRACK: "1" };
  const installed = yield* CacheRuntimeProcess.runCaptured({
    command: bun,
    args: ["install", "--ignore-scripts"],
    cwd: directory,
    extendEnv: false,
    env,
    timeout: "30 seconds",
    bound,
  });
  if (installed.exitCode !== 0 || installed.truncated)
    return yield* CacheCommandError.new("Synthetic dependency-free workspace install failed.");
  const server = yield* makeConformanceServer({ ...goodMode, responseCacheResult: "allowed" });
  const proxy = yield* makeCacheConformanceFaultProxy(
    CacheConformanceProxyOptions.make({ target: targetFor({ url: server.url }), bearers, holdMs: 400, maxEvents: 200 })
  );
  const signing = Redacted.make("synthetic-producer-fixture-signature-key-32-bytes");
  const execution = yield* CacheRuntimeProcess.runCaptured({
    command: executable,
    args: [
      "--skip-infer",
      "run",
      "build",
      "--filter=@beep/producer-fixture",
      "--cache=remote:w",
      "--summarize",
      "--env-mode=strict",
      "--concurrency=1",
      "--no-daemon",
    ],
    cwd: directory,
    extendEnv: false,
    env: {
      ...env,
      TURBO_API: proxy.url,
      TURBO_TEAMID: teamId,
      TURBO_TOKEN: Redacted.value(bearers.writer),
      TURBO_TELEMETRY_DISABLED: "1",
      TURBO_REMOTE_CACHE_SIGNATURE_KEY: Redacted.value(signing),
    },
    timeout: "45 seconds",
    bound,
  });
  if (execution.exitCode !== 0 || execution.truncated)
    return yield* CacheCommandError.new("Owned synthetic native task failed.");
  const names = yield* fs.readDirectory(path.join(directory, ".turbo/runs"));
  const name = yield* A.head(names).pipe(
    Effect.fromOption(() => CacheCommandError.new("Native producer emitted no summary."))
  );
  if (names.length !== 1) return yield* CacheCommandError.new("Native producer emitted multiple summaries.");
  const summary = yield* readCacheExperimentBytes(directory, path.join(".turbo/runs", name), 1024 * 1024).pipe(
    Effect.flatMap(decodeCacheExperimentText),
    Effect.flatMap(decodeSummary)
  );
  const binding = yield* S.decodeUnknownEffect(CacheProducerBinding)({
    ...input.pilot,
    key: {
      ...input.pilot.key,
      computation: "@beep/producer-fixture#build",
      profile: "synthetic-native-upload-join",
      epoch: "fixture-only",
    },
    client: { ...input.pilot.client, version: pin.version, sha256: pin.executableSha256 },
    protocolClient: input.protocol.observation.client,
    workflowRevision: input.pilot.sourceRevision,
    workflowImplementation: input.pilot.configurationDigest,
    policyDigest: input.pilot.configurationDigest,
  });
  const events = yield* proxy.events;
  const upload = yield* joinCacheProducerUpload(binding, summary, events);
  return NativeObservation.make({
    channel,
    client: CacheClientPin.make({ version: pin.version, sha256: pin.executableSha256, namespace: teamId }),
    bunVersion,
    bunSha256,
    summary,
    events,
    upload,
  });
});

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* repoRoot;
  const observations = yield* Effect.forEach(
    [CacheClientChannel.Enum.stable, CacheClientChannel.Enum.canary],
    flow(runOne, Effect.scoped),
    { concurrency: 1 }
  );
  const output = path.join(root, ".beep/producer-upload/native-upload-join-current.json");
  yield* fs.makeDirectory(path.dirname(output), { recursive: true });
  yield* fs.writeFileString(
    output,
    yield* encodeReport(ControlReport.make({ recordedAt: yield* DateTime.now, observations }))
  );
  yield* Effect.logInfo("Both pinned native task/upload joins passed; synthetic observation only.");
}).pipe(Effect.provide(Layer.mergeAll(NodeServices.layer, FetchHttpClient.layer)));

NodeRuntime.runMain(program);
