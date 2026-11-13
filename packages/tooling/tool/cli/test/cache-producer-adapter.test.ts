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
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
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
      const ready = fault === "bad-ready" ? observe("after-load") : observe("ready");
      const verify =
        fault === "verify-failure"
          ? fail("The owned adapter does not hold its loopback listener")
          : fault === "backend-exited"
            ? fail("Owned backend stopped before the parent completed")
            : Effect.succeed(fault === "bad-after" ? observe("ready") : observe("after-load"));
      const stop =
        fault === "cleanup-failure"
          ? fail("Owned adapter cleanup failed in 1 operation(s); every resource was attempted")
          : Effect.sync(() => {
              peer.stopped++;
            });
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
const expectation = {
  unit,
  role: "writer",
  phase: "ready" as const,
  sha256: adapterSha256,
  environmentNames,
  port,
  pid: 41_337,
};

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
