import { $RepoCliId } from "@beep/identity/packages";
import {
  CacheCommandError,
  CacheConformanceTarget,
  CacheDependencyMaterialization,
  CacheDependencyTree,
  CachePilotRequest,
  CacheSignedPilotRequest,
} from "@beep/repo-cli/commands/Cache";
import {
  CacheAdapterObservationExpectation,
  CacheAdapterProcessSnapshot,
  CacheAdapterRuntimeObservation,
  CacheOwnedAdapterHost,
  CacheOwnedAdapterStartup,
  CacheProducerAdapterLaunch,
  CacheProducerUploadApproval,
  CacheProducerUploadRuntime,
  CacheRuntimeProcess,
  cacheOwnedAdapterHostLive,
  cacheOwnedAdapterLauncher,
  hashCacheProducerUploadKey,
  hashCacheProducerUploadTarget,
  observeCacheAdapterSnapshot,
  withCacheProducerAdapter,
} from "@beep/repo-cli/test/Cache";
import { CacheClientPin, CacheEvidenceReference } from "@beep/repo-configs/cache";
import { LiteralKit, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { HostProcessArchitecture, HostProcessPlatform } from "@beep/utils";
import { currentHostPlatform } from "@beep/utils/HostProcess";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { bearers, targetFor } from "./cache-conformance-server.ts";
import { fakeFileInfo, fakeSpawner } from "./helpers/cache-host-fakes.ts";
import { input } from "./helpers/cache-producer-bundle-fixture.ts";
import type { CacheOwnedAdapterHostShape } from "@beep/repo-cli/test/Cache";

const Fault = LiteralKit([
  "none",
  "start-failure",
  "bad-ready",
  "verify-failure",
  "bad-after",
  "cleanup-failure",
  "backend-exited",
  "callback-failure",
  "wrong-role",
]);
const $I = $RepoCliId.create("test/cache-producer-adapter");
const PreflightFault = LiteralKit([
  "missing-adapter",
  "missing-storage",
  "changed-executable",
  "invalid-pin",
  "missing-git",
  "source-visible-state",
  "unsupported-platform",
  "unsupported-architecture",
]).pipe(
  $I.annoteSchema("PreflightFault", { description: "Independent before-start refusal scenarios for the owned parent." })
);
const hashBytes = S.decodeEffect(Sha256HexFromBytes);
const json = <T extends S.Top>(schema: T) => S.encodeEffect(S.fromJsonString(schema));

// The pipe peer is an inert real Python process, not a cache backend. These
// tests cover parent protocol/lifetime decisions. The separate real-adapter
// process lab supplies executable/listener/cgroup and backend cleanup proof.
const fixture = Effect.fn("ProducerAdapterTest.fixture")(function* (fault: typeof Fault.Type) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const parent = yield* fs.makeTempDirectoryScoped({ prefix: "cache-adapter-parent-" });
  const root = path.join(parent, "runner");
  const source = path.join(parent, "source");
  const dependencies = path.join(parent, "dependencies");
  for (const directory of [root, source, dependencies, path.join(root, "infra/r2-cache")]) {
    yield* fs.makeDirectory(directory, { recursive: true });
  }
  const tool = path.join(parent, "adapter");
  yield* fs.writeFileString(tool, "inert reviewed executable fixture");
  const backendSha256 = yield* hashBytes(new TextEncoder().encode("inert reviewed executable fixture"));
  const digest = Sha256Hex.make(Str.repeat(64)("a"));
  const materialization = CacheDependencyMaterialization.make({
    directory: dependencies,
    lockfileSha256: digest,
    rootManifestSha256: digest,
    tree: CacheDependencyTree.make({
      sha256: digest,
      regularFiles: S.Natural.make(0),
      entries: S.Natural.make(0),
      bytes: S.Natural.make(0),
      links: [],
    }),
    tools: {},
  });
  const text = yield* json(CacheDependencyMaterialization)(materialization);
  yield* fs.writeFileString(path.join(source, "dependencies.json"), text);
  const reference = CacheEvidenceReference.make({
    path: "dependencies.json",
    sha256: yield* hashBytes(new TextEncoder().encode(text)),
  });
  const git = yield* CacheRuntimeProcess.runCapturedStreams({
    command: "/usr/bin/git",
    args: ["init", "--template=", source],
    cwd: parent,
    extendEnv: false,
    env: { PATH: "/usr/bin" },
  });
  expect(git.exitCode).toBe(0);
  const target = CacheConformanceTarget.make({
    ...targetFor({ url: "http://127.0.0.1:19427/" }),
    backend: { id: "inert-adapter", release: "fixture", digest: backendSha256 },
    namespace: { teamId: "team_beep_signed_canary_v1", foreignTeamId: "team_fixture_foreign" },
    storage: O.some({
      endpoint: yield* S.decodeEffect(S.URLFromString)(`https://${Str.repeat(32)("0")}.r2.cloudflarestorage.com/`),
      bucket: "beep-turbo-r2-pilot",
    }),
  });
  const runtime = CacheProducerUploadRuntime.make({
    target,
    bearers,
    signing: Redacted.make("synthetic-native-signing-key"),
    adapter: O.some(
      CacheProducerAdapterLaunch.make({
        executable: tool,
        accessKey: Redacted.make("synthetic-storage-id"),
        secretKey: Redacted.make("synthetic-storage-secret"),
      })
    ),
  });
  const approval = CacheProducerUploadApproval.make({
    targetSha256: yield* hashCacheProducerUploadTarget(target),
    artifactKeySha256: yield* hashCacheProducerUploadKey(runtime.signing),
  });
  const request = CacheSignedPilotRequest.make({
    sourceRoot: source,
    pilot: CachePilotRequest.make({
      channel: "stable",
      client: yield* S.decodeEffect(CacheClientPin)(input.pilot.client),
      executable: tool,
      biomeExecutable: tool,
      nodeExecutable: tool,
      dependencies: reference,
      activation: reference,
      worktrees: [source, dependencies],
      selection: "full",
    }),
  });
  const observation = CacheAdapterRuntimeObservation.make({
    role: "writer",
    phase: "ready",
    tokioNamedThreadsIncludingBlocking: 2,
    totalThreads: 6,
    memoryPeakBytes: S.Natural.make(1024),
  });
  const peer = { started: 0, closed: 0, stopped: 0, environmentNames: A.empty<string>(), values: A.empty<string>() };
  const observe = (phase: "ready" | "after-load") =>
    CacheAdapterRuntimeObservation.make({
      ...observation,
      phase,
      role: fault === "wrong-role" ? "reader" : "writer",
    });
  const fail = (message: string) => Effect.fail(CacheCommandError.new(message));
  // The inert host replaces the systemd user manager. These tests cover parent
  // lifetime decisions; observation and startup-input refusals are covered
  // against recorded process facts and the real launcher below.
  const verifyFailure = Fault.matchOrElse(
    fault,
    {
      "verify-failure": () => O.some("The owned adapter does not hold its loopback listener"),
      "backend-exited": () => O.some("Owned backend stopped before the parent completed"),
    },
    () => O.none<string>()
  );
  const verify = O.match(verifyFailure, {
    onNone: () => Effect.succeed(observe(fault === "bad-after" ? "ready" : "after-load")),
    onSome: fail,
  });
  const stop =
    fault === "cleanup-failure"
      ? fail("Owned adapter cleanup failed in 1 operation(s); every resource was attempted")
      : Effect.sync(() => {
          peer.stopped++;
        });
  const ready = observe(fault === "bad-ready" ? "after-load" : "ready");
  const host: CacheOwnedAdapterHostShape = {
    start: Effect.fnUntraced(function* (startup) {
      peer.started++;
      peer.environmentNames = R.keys(startup.env);
      peer.values = R.values(startup.env);
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          peer.closed++;
        })
      );
      if (fault === "start-failure") return yield* fail("Owned adapter exited before readiness");
      return { ready, verify, stop };
    }),
  };
  return { fs, path, root, request, runtime, approval, tool, backendSha256, host, peer };
});

const prepareFilesystemFault = Effect.fn("ProducerAdapterTest.prepareFilesystemFault")(function* (
  f: Effect.Success<ReturnType<typeof fixture>>,
  fault: typeof PreflightFault.Type
) {
  if (fault === "changed-executable") {
    yield* f.fs.writeFileString(f.tool, "changed executable");
  }
  if (fault === "missing-git") {
    yield* f.fs.remove(f.path.join(f.request.sourceRoot, ".git"), { recursive: true });
  }
});

const withHost =
  (f: Effect.Success<ReturnType<typeof fixture>>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.provideService(effect, CacheOwnedAdapterHost, f.host);

const SECRETS = ["synthetic-storage-id", "synthetic-storage-secret", "synthetic-native-signing-key"];

describe.skipIf(currentHostPlatform !== "linux")("Linux owned adapter parent", () => {
  it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, FetchHttpClient.layer), { timeout: "30 seconds" })(
    "owned adapter parent lifecycle",
    (it) => {
      it.effect.prop(
        "binds every schema-generated claimed executable pin before using the backend",
        { candidate: S.Struct({ sha256: Sha256Hex, useActual: S.Boolean }) },
        ({ candidate }) =>
          Effect.gen(function* () {
            const f = yield* fixture("none");
            const claimed = candidate.useActual ? f.backendSha256 : candidate.sha256;
            const runtime = CacheProducerUploadRuntime.make({
              ...f.runtime,
              target: CacheConformanceTarget.make({
                ...f.runtime.target,
                backend: { ...f.runtime.target.backend, digest: claimed },
              }),
            });
            let callbacks = 0;
            const result = yield* withCacheProducerAdapter(
              f.root,
              f.request,
              runtime,
              f.approval,
              Effect.sync(() => {
                callbacks++;
              })
            ).pipe(withHost(f), Effect.exit);
            const matches = claimed === f.backendSha256;
            Bool.match(matches, {
              onTrue: () => result.pipe(Exit.isSuccess, assertTrue),
              onFalse: () => result.pipe(Exit.isFailure, assertTrue),
            });
            expect(callbacks).toBe(matches ? 1 : 0);
            expect(f.peer.started).toBe(matches ? 1 : 0);
          }),
        { arbitrary: fcRuns(20) }
      );

      it.effect.each(Fault.literals)("joins the expected lifecycle and closes its host scope: %s", (fault) =>
        Effect.gen(function* () {
          const f = yield* fixture(fault);
          let callbacks = 0;
          const result = yield* withCacheProducerAdapter(
            f.root,
            f.request,
            f.runtime,
            f.approval,
            Effect.gen(function* () {
              callbacks++;
              if (fault === "callback-failure") {
                return yield* CacheCommandError.new("Expected upload callback failure");
              }
              return "owned result";
            })
          ).pipe(withHost(f), Effect.exit);
          Bool.match(fault === "none", {
            onTrue: () => result.pipe(Exit.isSuccess, assertTrue),
            onFalse: () => result.pipe(Exit.isFailure, assertTrue),
          });
          expect(callbacks).toBe(A.contains(["start-failure", "bad-ready", "wrong-role"], fault) ? 0 : 1);
          if (Exit.isSuccess(result)) {
            expect(result.value[0]).toBe("owned result");
            expect(result.value[1].targetSha256).toBe(f.approval.targetSha256);
            expect(result.value[1].backendSha256).toBe(f.backendSha256);
            expect(result.value[1].cleaned).toBe(true);
            expect(f.peer.stopped).toBe(1);
          }
          if (fault === "cleanup-failure" && Exit.isFailure(result))
            expect(Cause.pretty(result.cause)).toContain("Owned adapter host did not finish successful cleanup.");
          expect(f.peer.started).toBe(1);
          expect(f.peer.closed).toBe(1);
          expect(f.peer.environmentNames).not.toContain("TURBO_REMOTE_CACHE_SIGNATURE_KEY");
          expect(f.peer.environmentNames).not.toContain("BEEP_CACHE_UPLOAD_SIGNING");
          expect(f.peer.values).not.toContain("synthetic-native-signing-key");
        })
      );

      it.layer(TestClock.layer(), { timeout: "30 seconds" })("isolated owned-backend deadline", (it) => {
        it.effect("interrupts the load before the ten-minute backend cap and closes its host scope", () =>
          Effect.gen(function* () {
            const f = yield* fixture("none");
            const started = yield* Deferred.make<void>();
            let interrupted = false;
            const callback = Deferred.succeed(started, undefined).pipe(
              Effect.andThen(Effect.never),
              Effect.ensuring(
                Effect.sync(() => {
                  interrupted = true;
                })
              )
            );
            const running = yield* withCacheProducerAdapter(f.root, f.request, f.runtime, f.approval, callback).pipe(
              withHost(f),
              Effect.exit,
              Effect.forkScoped
            );
            yield* Deferred.await(started);
            yield* TestClock.adjust("9 minutes");
            expect(interrupted).toBe(true);
            const result = yield* Fiber.join(running);
            result.pipe(Exit.isFailure, assertTrue);
            if (Exit.isFailure(result)) expect(Cause.pretty(result.cause)).toContain("Operation timed out after '9m'");
            expect(f.peer.closed).toBe(1);
            expect(f.peer.stopped).toBe(0);
          })
        );
      });
      it.effect.each(PreflightFault.literals)("refuses before starting a host: %s", (fault) =>
        Effect.gen(function* () {
          const f = yield* fixture("none");
          const runtime = CacheProducerUploadRuntime.make({
            ...f.runtime,
            ...(fault === "missing-adapter" ? { adapter: O.none() } : {}),
            target: CacheConformanceTarget.make({
              ...f.runtime.target,
              ...(fault === "missing-storage" ? { storage: O.none() } : {}),
              backend: { ...f.runtime.target.backend, digest: fault === "invalid-pin" ? "invalid" : f.backendSha256 },
            }),
          });
          yield* prepareFilesystemFault(f, fault);
          let callbacks = 0;
          const result = yield* withCacheProducerAdapter(
            fault === "source-visible-state" ? "/tmp" : f.root,
            f.request,
            runtime,
            f.approval,
            Effect.sync(() => {
              callbacks++;
            })
          ).pipe(
            withHost(f),
            Effect.provideService(HostProcessPlatform, fault === "unsupported-platform" ? "win32" : "linux"),
            Effect.provideService(HostProcessArchitecture, fault === "unsupported-architecture" ? "arm64" : "x64"),
            Effect.exit
          );
          result.pipe(Exit.isFailure, assertTrue);
          expect(callbacks).toBe(0);
          expect(f.peer.started).toBe(0);
        })
      );
    }
  );
});

// --- The in-process host itself (ported from infra/r2-cache/policy_runtime.py) ---

const unit = "beep-cache-owned-0123456789ab-writer.service";
const port = 9427;
const environmentNames = [
  "PATH",
  "HOME",
  "HOST",
  "PORT",
  "TOKIO_WORKER_THREADS",
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET_NAME",
  "S3_USE_PATH_STYLE",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
  "TURBO_TOKEN",
  "BEEP_CACHE_POLICY",
  "BEEP_CACHE_NAMESPACE",
  "BEEP_CACHE_ACCESS_ROLE",
  "OTEL_SDK_DISABLED",
];
const adapterSha256 = "b6660b7a94fe517aba4a1395bdc5d287b7ecca53ea270ee54ebe4de266fcde20";
// Reconstructed from the writer readiness row recorded by the retired Python
// runtime lab (goals/turborepo-cache-trust-observability/research/adapter-runtime-lab.json):
// three actix/arbiter threads, two tokio threads, six in total, 5890048 peak bytes.
const recorded = CacheAdapterProcessSnapshot.make({
  mainPid: 41_337,
  controlGroup: `/user.slice/user-1000.slice/user@1000.service/app.slice/${unit}`,
  executableSha256: adapterSha256,
  socketInodes: ["918273", "918274"],
  tcpTable: A.join(
    [
      "  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode",
      "   0: 0100007F:24D3 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 918273 1 0000000000000000 100 0 0 10 0",
      "   1: 0100007F:24D3 0100007F:9C40 01 00000000:00000000 00:00000000 00000000  1000        0 918274 1 0000000000000000 20 4 30 10 -1",
      "",
    ],
    "\n"
  ),
  environmentNames,
  cpuMax: "200000 100000\n",
  memoryMax: "268435456\n",
  pidsMax: "16\n",
  memoryPeak: "5890048\n",
  runtimeMaxUSec: "10min",
  timeoutStopUSec: "10s",
  killMode: "control-group",
  threadNames: [
    "decay",
    "actix-rt|system",
    "actix-server ac",
    "actix-rt|arbiter",
    "tokio-runtime-w",
    "tokio-runtime-w",
  ],
});
const expectation = CacheAdapterObservationExpectation.make({
  unit,
  role: "writer",
  phase: "ready",
  sha256: adapterSha256,
  environmentNames,
  port,
  pid: 41_337,
});

const Negative = LiteralKit([
  "changed-pid",
  "foreign-cgroup",
  "wrong-executable",
  "wrong-listener",
  "not-listening",
  "foreign-socket",
  "unexpected-environment",
  "signature-key",
  "agent-credential",
  "cpu-quota",
  "unbounded-memory",
  "lifetime",
  "kill-mode",
  "worker-envelope",
]).pipe(
  $I.annoteSchema("NegativeObservation", { description: "Recorded-snapshot mutations the observation must refuse." })
);

const negative = Negative.match({
  "changed-pid": () => ({
    snapshot: { ...recorded, mainPid: 41_338 },
    message: "Runtime proof did not identify its owned adapter cgroup",
  }),
  "foreign-cgroup": () => ({
    snapshot: { ...recorded, controlGroup: `/system.slice/${unit}` },
    message: "Runtime proof did not identify its owned adapter cgroup",
  }),
  "wrong-executable": () => ({
    snapshot: { ...recorded, executableSha256: Str.repeat(64)("0") },
    message: "The resource unit did not execute the reviewed adapter",
  }),
  "wrong-listener": () => ({
    snapshot: { ...recorded, tcpTable: Str.replaceAll("0100007F:24D3", "00000000:24D3")(recorded.tcpTable) },
    message: "The owned adapter does not hold its loopback listener",
  }),
  "not-listening": () => ({
    snapshot: { ...recorded, tcpTable: Str.replace(" 0A ", " 01 ")(recorded.tcpTable) },
    message: "The owned adapter does not hold its loopback listener",
  }),
  "foreign-socket": () => ({
    snapshot: { ...recorded, socketInodes: ["918274"] },
    message: "The owned adapter does not hold its loopback listener",
  }),
  "unexpected-environment": () => ({
    snapshot: { ...recorded, environmentNames: [...environmentNames, "LD_PRELOAD"] },
    message: "The backend inherited environment outside its explicit fixture allowlist",
  }),
  "signature-key": () => ({
    snapshot: { ...recorded, environmentNames: [...environmentNames, "TURBO_REMOTE_CACHE_SIGNATURE_KEY"] },
    message: "The backend inherited environment outside its explicit fixture allowlist",
  }),
  "agent-credential": () => ({
    snapshot: { ...recorded, environmentNames: [...environmentNames, "OP_SERVICE_ACCOUNT_TOKEN"] },
    message: "The backend inherited environment outside its explicit fixture allowlist",
  }),
  "cpu-quota": () => ({
    snapshot: { ...recorded, cpuMax: "max 100000\n" },
    message: "The actual adapter resource envelope differs from the requested caps",
  }),
  "unbounded-memory": () => ({
    snapshot: { ...recorded, memoryMax: "max\n" },
    message: "The actual adapter resource envelope differs from the requested caps",
  }),
  lifetime: () => ({
    snapshot: { ...recorded, runtimeMaxUSec: "infinity" },
    message: "The actual adapter lifetime or stop envelope differs from its requested caps",
  }),
  "kill-mode": () => ({
    snapshot: { ...recorded, killMode: "process" },
    message: "The actual adapter lifetime or stop envelope differs from its requested caps",
  }),
  "worker-envelope": () => ({
    snapshot: { ...recorded, threadNames: A.appendAll(recorded.threadNames, ["actix-rt|arbiter"]) },
    message: "The adapter did not preserve its fixed worker envelope",
  }),
});

const result = <A, E>(exit: Exit.Exit<A, E>) => exit.pipe(Exit.isFailure, assertTrue);

const failureMessage = <A>(exit: Exit.Exit<A, CacheCommandError>) =>
  Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "succeeded";

describe("owned adapter observation", () => {
  it.effect("replays the recorded writer readiness observation", () =>
    Effect.gen(function* () {
      const observation = yield* observeCacheAdapterSnapshot(recorded, expectation);
      expect(observation.role).toBe("writer");
      expect(observation.phase).toBe("ready");
      expect(observation.actixThreadsIncludingAcceptor).toBe(3);
      expect(observation.tokioNamedThreadsIncludingBlocking).toBe(2);
      expect(observation.totalThreads).toBe(6);
      expect(observation.memoryMaxBytes).toBe(268_435_456);
      expect(observation.cpuQuotaMicros).toBe(200_000);
      expect(observation.cpuPeriodMicros).toBe(100_000);
      expect(observation.tasksMax).toBe(16);
      expect(observation.memoryPeakBytes).toBe(5_890_048);
      expect(observation.ownedLoopbackListener).toBe(true);
      expect(observation.sameProcess).toBe(true);
      expect(observation.explicitEnvironmentOnly).toBe(true);
    })
  );

  it.effect.each(Negative.literals)("refuses a recorded snapshot with %s", (fault) =>
    Effect.gen(function* () {
      const { snapshot, message } = negative(fault);
      const exit = yield* observeCacheAdapterSnapshot(CacheAdapterProcessSnapshot.make(snapshot), expectation).pipe(
        Effect.exit
      );
      result(exit);
      expect(failureMessage(exit)).toContain(message);
    })
  );
});

const RefusedInput = LiteralKit([
  "wildcard-host",
  "privileged-port",
  "unsigned-policy",
  "unknown-role",
  "signature-key",
  "foreign-home",
  "changed-digest",
  "not-executable",
]).pipe($I.annoteSchema("RefusedInput", { description: "Startup inputs refused before a unit is allocated." }));

describe.skipIf(currentHostPlatform !== "linux")("owned adapter startup input", () => {
  it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, FetchHttpClient.layer), { timeout: "30 seconds" })(
    "live host refusals",
    (it) => {
      it.effect.each(RefusedInput.literals)("refuses %s before allocating a unit", (fault) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const work = yield* fs.makeTempDirectoryScoped({ prefix: "cache-adapter-host-" });
          const adapter = path.join(work, "adapter");
          yield* fs.writeFileString(adapter, "#!/bin/sh\nexit 0\n");
          yield* fs.chmod(adapter, fault === "not-executable" ? 0o600 : 0o700);
          const sha256 = yield* hashBytes(new TextEncoder().encode("#!/bin/sh\nexit 0\n"));
          const env = {
            PATH: "/usr/bin",
            HOME: fault === "foreign-home" ? "/tmp" : work,
            HOST: fault === "wildcard-host" ? "0.0.0.0" : "127.0.0.1",
            PORT: fault === "privileged-port" ? "80" : "19427",
            BEEP_CACHE_POLICY: fault === "unsigned-policy" ? "open" : "signed-v1",
            BEEP_CACHE_ACCESS_ROLE: fault === "unknown-role" ? "admin" : "writer",
            ...(fault === "signature-key" ? { TURBO_REMOTE_CACHE_SIGNATURE_KEY: "synthetic" } : {}),
          };
          const exit = yield* cacheOwnedAdapterHostLive
            .start(
              CacheOwnedAdapterStartup.make({
                adapter,
                sha256: fault === "changed-digest" ? Sha256Hex.make(Str.repeat(64)("b")) : sha256,
                env,
              }),
              work
            )
            .pipe(Effect.scoped, Effect.exit);
          result(exit);
          expect(failureMessage(exit)).toContain("Owned adapter input differs from its bounded signed profile");
        })
      );

      it.effect("execs the adapter with exactly the piped environment and no secret arguments", () =>
        Effect.gen(function* () {
          const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
          const launcher = cacheOwnedAdapterLauncher({
            runtime: process.execPath,
            bun: P.isNotUndefined(process.versions.bun),
          });
          const config = yield* json(CacheOwnedAdapterStartup)(
            CacheOwnedAdapterStartup.make({
              adapter: "/usr/bin/env",
              sha256: Sha256Hex.make(Str.repeat(64)("c")),
              env: { PATH: "/usr/bin", S3_SECRET_KEY: "synthetic-storage-secret" },
            })
          );
          for (const secret of SECRETS) expect(A.join(launcher, " ")).not.toContain(secret);
          const [command, ...args] = launcher;
          const output = yield* spawner.lines(
            ChildProcess.make(command ?? "/usr/bin/env", args, {
              extendEnv: false,
              env: {
                PATH: "/usr/bin",
                BUN_OPTIONS: "--preload=/nonexistent",
                NODE_OPTIONS: "--require=/nonexistent",
                LEAK: "1",
              },
              stdin: { stream: Stream.make(new TextEncoder().encode(config)) },
            })
          );
          expect(A.sort(output, Str.Order)).toEqual(["PATH=/usr/bin", "S3_SECRET_KEY=synthetic-storage-secret"]);
        })
      );

      it.effect("refuses startup input above its bound", () =>
        Effect.gen(function* () {
          const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
          const [command, ...args] = cacheOwnedAdapterLauncher({
            runtime: process.execPath,
            bun: P.isNotUndefined(process.versions.bun),
          });
          const exitCode = yield* spawner.exitCode(
            ChildProcess.make(command ?? "/usr/bin/env", args, {
              extendEnv: false,
              env: { PATH: "/usr/bin" },
              stdin: { stream: Stream.make(new Uint8Array(32_769)) },
            })
          );
          expect(exitCode).toBe(78);
        })
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Live owned-adapter host over a faked user manager, /proc, cgroup and loopback.
// ---------------------------------------------------------------------------

const hostWork = "/fake/work";
const hostAdapter = "/fake/adapter";
const hostProc = "/proc/41337";
const hostAdapterBytes = new TextEncoder().encode("inert reviewed executable fixture");
const hostEnvironment: Readonly<Record<string, string>> = {
  PATH: "/usr/bin",
  HOME: hostWork,
  HOST: "127.0.0.1",
  PORT: "9427",
  BEEP_CACHE_POLICY: "signed-v1",
  BEEP_CACHE_ACCESS_ROLE: "writer",
  S3_SECRET_KEY: "synthetic-storage-secret",
};

interface HostScenario {
  readonly activeState?: string;
  readonly exited?: boolean;
  readonly health?: number;
  readonly loadState?: string;
  readonly mainPid?: string;
  readonly stopExit?: number;
  readonly stoppedLoadState?: string;
  readonly unreadable?: string;
}

interface HostState {
  readonly calls: Array<ReadonlyArray<string>>;
  running: boolean;
}

const hostText: Readonly<Record<string, string>> = {
  [`${hostProc}/net/tcp`]: recorded.tcpTable,
  "cgroup/cpu.max": recorded.cpuMax,
  "cgroup/memory.max": recorded.memoryMax,
  "cgroup/pids.max": recorded.pidsMax,
  "cgroup/memory.peak": recorded.memoryPeak,
  ...R.fromEntries(A.map(recorded.threadNames, (name, index) => [`${hostProc}/task/${index}/comm`, `${name}\n`])),
};
const hostBinary: Readonly<Record<string, Uint8Array>> = {
  [hostAdapter]: hostAdapterBytes,
  [`${hostProc}/exe`]: hostAdapterBytes,
  [`${hostProc}/environ`]: new TextEncoder().encode(
    A.join(
      A.map(R.keys(hostEnvironment), (name) => `${name}=x\0`),
      ""
    )
  ),
};
const hostDirectories: Readonly<Record<string, ReadonlyArray<string>>> = {
  [`${hostProc}/fd`]: ["3", "4", "5"],
  [`${hostProc}/task`]: A.map(recorded.threadNames, (_, index) => `${index}`),
};
const hostLinks: Readonly<Record<string, string>> = {
  [`${hostProc}/fd/3`]: "socket:[918273]",
  [`${hostProc}/fd/4`]: "pipe:[7]",
};

const lookup = <A>(table: Readonly<Record<string, A>>, path: string) =>
  Effect.fromOption(R.get(table, path)).pipe(
    Effect.mapError(() =>
      PlatformError.systemError({ _tag: "NotFound", module: "FileSystem", method: "read", pathOrDescriptor: path })
    )
  );

// Cgroup facts are served by file name, so the fake needs no knowledge of the random unit.
const cgroupKey = (path: string) =>
  Str.startsWith("/sys/fs/cgroup/")(path) ? `cgroup/${O.getOrElse(A.last(Str.split(path, "/")), () => "")}` : path;

const hostFileSystem = FileSystem.makeNoop({
  realPath: Effect.succeed,
  stat: () => Effect.succeed(fakeFileInfo(0o755)),
  readFile: (path) => lookup(hostBinary, path),
  readFileString: (path) => lookup(hostText, cgroupKey(path)),
  readDirectory: (path) => lookup(hostDirectories, path).pipe(Effect.map(A.fromIterable)),
  readLink: (path) => lookup(hostLinks, path),
});

const hostProperty = (scenario: HostScenario, state: HostState, unitName: string, name: string) => {
  const stopped = A.some(state.calls, (call) => call[2] === "stop");
  const properties: Readonly<Record<string, string>> = {
    LoadState: stopped ? (scenario.stoppedLoadState ?? "not-found") : (scenario.loadState ?? "not-found"),
    MainPID: scenario.mainPid ?? "41337",
    ControlGroup: `/user.slice/user-1000.slice/user@1000.service/app.slice/${unitName}`,
    RuntimeMaxUSec: "10min",
    TimeoutStopUSec: "10s",
    KillMode: "control-group",
    ActiveState: scenario.activeState ?? "inactive",
  };
  return name === scenario.unreadable
    ? { exitCode: 1 }
    : { stdout: `${O.getOrElse(R.get(properties, name), () => "")}\n` };
};

const systemctlAnswer = (scenario: HostScenario, state: HostState, words: ReadonlyArray<string>) =>
  Match.value(words[1]).pipe(
    Match.when("stop", () => ({ exitCode: scenario.stopExit ?? 0 })),
    Match.when("show", () => hostProperty(scenario, state, words[2] ?? "", words[4] ?? "")),
    Match.orElse(() => ({}))
  );

// Cryptography comes from the block's layer; systemd, /proc and the health endpoint are fakes.
const hostServices = (scenario: HostScenario, state: HostState) =>
  pipe(
    Context.make(FileSystem.FileSystem, hostFileSystem),
    Context.add(
      ChildProcessSpawner.ChildProcessSpawner,
      fakeSpawner((command) =>
        Effect.sync(() => {
          const words = A.filter([command.command, ...command.args], P.isString);
          state.calls.push(words);
          return command.command === "/usr/bin/systemctl"
            ? systemctlAnswer(scenario, state, A.drop(words, 1))
            : { running: Effect.sync(() => state.running) };
        })
      )
    ),
    Context.add(
      HttpClient.HttpClient,
      HttpClient.make((request) =>
        Effect.succeed(HttpClientResponse.fromWeb(request, new Response(null, { status: scenario.health ?? 200 })))
      )
    )
  );

const hostHarness = Effect.fnUntraced(function* (
  scenario: HostScenario = {},
  env: Readonly<Record<string, string>> = hostEnvironment
) {
  const state: HostState = { running: scenario.exited !== true, calls: [] };
  const services = hostServices(scenario, state);
  const sha256 = yield* hashBytes(hostAdapterBytes);
  const start = cacheOwnedAdapterHostLive
    .start(CacheOwnedAdapterStartup.make({ adapter: hostAdapter, sha256, env: { ...env } }), hostWork)
    .pipe(Effect.provide(services));
  const provide = <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.provide(effect, services);
  return { state, start, provide };
});

describe("owned adapter live host", () => {
  it.layer(NodeCrypto.layer, { timeout: "30 seconds" })("faked user manager", (it) => {
    it.effect("starts, observes, verifies and stops one owned unit", () =>
      Effect.gen(function* () {
        const h = yield* hostHarness();
        const { ready, after } = yield* Effect.scoped(
          Effect.gen(function* () {
            const host = yield* h.start;
            const verified = yield* h.provide(host.verify);
            yield* h.provide(host.stop);
            return { ready: host.ready, after: verified };
          })
        );
        expect([ready.role, ready.phase, ready.passed]).toEqual(["writer", "ready", true]);
        expect([after.phase, after.memoryPeakBytes, after.totalThreads]).toEqual(["after-load", 5_890_048, 6]);
        const run = O.getOrThrow(A.findFirst(h.state.calls, (call) => call[0] === "/usr/bin/systemd-run"));
        expect(run).toContain(`--working-directory=${hostWork}`);
        expect(run).toContain("--property=KillMode=control-group");
        expect(A.join(run, " ")).not.toContain("synthetic-storage-secret");
        expect(
          A.map(
            A.filter(h.state.calls, (call) => call[2] !== "show"),
            (call) => call[2]
          )
        ).toEqual(["--quiet", "stop", "reset-failed"]);
      })
    );

    it.effect.each([
      ["an existing unit", { loadState: "loaded" }, hostEnvironment, "Owned adapter unit already exists"],
      ["an adapter that exits early", { exited: true }, hostEnvironment, "Owned adapter exited before readiness"],
      ["no main PID", { mainPid: "0" }, hostEnvironment, "Runtime proof did not identify its owned adapter cgroup"],
      [
        "an unreadable property",
        { unreadable: "ControlGroup" },
        hostEnvironment,
        "Cannot read the owned adapter ControlGroup.",
      ],
      ["no home", {}, R.remove(hostEnvironment, "HOME"), "Owned adapter input differs from its bounded signed profile"],
      [
        "oversized input",
        {},
        { ...hostEnvironment, S3_SECRET_KEY: Str.repeat(40_000)("x") },
        "Owned adapter startup input exceeds its bound",
      ],
    ] as const)("refuses to start with %s", ([, scenario, env, message]) =>
      Effect.gen(function* () {
        const h = yield* hostHarness(scenario, env);
        const exit = yield* Effect.scoped(h.start).pipe(Effect.exit);
        expect(failureMessage(exit)).toContain(message);
      })
    );

    it.layer(TestClock.layer(), { timeout: "30 seconds" })("isolated readiness clock", (it) => {
      it.effect("gives up on an adapter that never answers its health check", () =>
        Effect.gen(function* () {
          const h = yield* hostHarness({ health: 503 });
          const exit = yield* Effect.scoped(
            Effect.gen(function* () {
              const fiber = yield* h.start.pipe(Effect.exit, Effect.forkChild);
              yield* TestClock.adjust(Duration.seconds(10));
              return yield* Fiber.join(fiber);
            })
          );
          expect(failureMessage(exit)).toContain("Owned adapter did not become ready");
          expect(A.some(h.state.calls, (call) => call[2] === "stop")).toBe(true);
        })
      );
    });

    it.effect.each([
      ["an unstoppable unit", { stopExit: 1, stoppedLoadState: "loaded" }, "failed in 1 operation(s)"],
      ["a unit that stays active", { activeState: "active" }, "failed in 1 operation(s)"],
      ["an already removed unit", { stopExit: 1, stoppedLoadState: "not-found" }, "succeeded"],
    ] as const)("reports cleanup of %s", ([, scenario, message]) =>
      Effect.gen(function* () {
        const h = yield* hostHarness(scenario);
        const exit = yield* Effect.scoped(Effect.flatMap(h.start, (host) => h.provide(host.stop))).pipe(Effect.exit);
        expect(failureMessage(exit)).toContain(message);
      })
    );

    it.effect("refuses to verify a backend that stopped", () =>
      Effect.gen(function* () {
        const h = yield* hostHarness();
        const exit = yield* Effect.scoped(
          Effect.gen(function* () {
            const host = yield* h.start;
            h.state.running = false;
            return yield* h.provide(host.verify).pipe(Effect.exit);
          })
        );
        expect(failureMessage(exit)).toContain("Owned backend stopped before the parent completed");
      })
    );

    it.layer(TestClock.layer(), { timeout: "30 seconds" })("isolated backend cap clock", (it) => {
      it.effect("refuses to verify a backend past its ten-minute cap", () =>
        Effect.gen(function* () {
          const h = yield* hostHarness();
          const exit = yield* Effect.scoped(
            Effect.gen(function* () {
              const host = yield* h.start;
              yield* TestClock.adjust(Duration.minutes(10));
              return yield* h.provide(host.verify).pipe(Effect.exit);
            })
          );
          expect(failureMessage(exit)).toContain("Owned backend stopped before the parent completed");
        })
      );
    });

    it("starts Bun without dotenv loading", () => {
      expect(cacheOwnedAdapterLauncher({ runtime: "/usr/bin/bun", bun: true })).toContain("--no-env-file");
    });
  });
});
