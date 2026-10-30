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
  CacheAdapterRuntimeObservation,
  CacheProducerAdapterLaunch,
  CacheProducerUploadApproval,
  CacheProducerUploadRuntime,
  CacheRuntimeProcess,
  hashCacheProducerUploadKey,
  hashCacheProducerUploadTarget,
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
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { bearers, targetFor } from "./cache-conformance-server.ts";
import { input } from "./helpers/cache-producer-bundle-fixture.ts";

const Fault = LiteralKit([
  "none",
  "early-exit",
  "bad-json",
  "oversized",
  "bad-ready",
  "bad-after",
  "bad-cleanup",
  "nonzero",
  "extra-frame",
  "callback-failure",
  "wrong-role",
  "changed-resource",
  "delayed-extra-frame",
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
  for (const directory of [root, source, dependencies, path.join(root, "infra/r2-cache")])
    yield* fs.makeDirectory(directory, { recursive: true });
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
  const encoded = yield* json(S.String)(yield* json(CacheAdapterRuntimeObservation)(observation));
  const marker = path.join(parent, "peer.json");
  const python = `import json, os, sys, time
from pathlib import Path
fault = ${yield* json(S.String)(fault)}
config = json.loads(sys.stdin.buffer.readline())
Path(${yield* json(S.String)(marker)}).write_text(json.dumps({"pid": os.getpid(), "keys": sorted(config["env"]), "argv": sys.argv[1:]}))
observation = json.loads(${encoded})
if fault == "wrong-role": observation["role"] = "reader"
if fault == "changed-resource": observation["memoryMaxBytes"] = 0
def emit(status):
    value = {"status": status}
    if status != "cleaned":
        value["observation"] = {**observation, "phase": status}
    print(json.dumps(value), flush=True)
if fault == "early-exit": raise SystemExit(1)
if fault == "bad-json": print("invalid-json", flush=True); raise SystemExit(1)
if fault == "oversized": print("x" * 4097, flush=True); raise SystemExit(1)
emit("after-load" if fault == "bad-ready" else "ready")
if sys.stdin.buffer.readline() != b"verify\\n": raise SystemExit(2)
emit("cleaned" if fault == "bad-after" else "after-load")
if sys.stdin.buffer.readline() != b"stop\\n": raise SystemExit(3)
if fault == "extra-frame":
    os.write(sys.stdout.fileno(), b'{"status":"cleaned"}\\n{"status":"cleaned"}\\n')
else:
    emit("ready" if fault == "bad-cleanup" else "cleaned")
if fault == "delayed-extra-frame": time.sleep(0.05); emit("cleaned")
raise SystemExit(1 if fault == "nonzero" else 0)
`;
  yield* fs.writeFileString(path.join(root, "infra/r2-cache/policy_runtime.py"), python);
  return { fs, path, root, request, runtime, approval, marker, tool, backendSha256 };
});

const prepareFilesystemFault = Effect.fn("ProducerAdapterTest.prepareFilesystemFault")(function* (
  f: Effect.Success<ReturnType<typeof fixture>>,
  fault: typeof PreflightFault.Type
) {
  if (fault === "changed-executable") yield* f.fs.writeFileString(f.tool, "changed executable");
  if (fault === "missing-git") yield* f.fs.remove(f.path.join(f.request.sourceRoot, ".git"), { recursive: true });
});

const Peer = S.Struct({ pid: S.Int, keys: S.Array(S.String), argv: S.Array(S.String) });
const decodePeer = S.decodeEffect(S.fromJsonString(Peer));

describe.skipIf(currentHostPlatform !== "linux")("Linux owned adapter parent", () => {
  it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "30 seconds" })(
    "owned adapter parent protocol",
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
            ).pipe(Effect.exit);
            const matches = claimed === f.backendSha256;
            Bool.match(matches, {
              onTrue: () => result.pipe(Exit.isSuccess, assertTrue),
              onFalse: () => result.pipe(Exit.isFailure, assertTrue),
            });
            expect(callbacks).toBe(matches ? 1 : 0);
          }),
        { arbitrary: fcRuns(20) }
      );

      it.effect.each(Fault.literals)("joins the expected protocol and closes its peer: %s", (fault) =>
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
              if (fault === "callback-failure") return yield* CacheCommandError.new("Expected upload callback failure");
              return "owned result";
            })
          ).pipe(Effect.exit);
          Bool.match(fault === "none", {
            onTrue: () => result.pipe(Exit.isSuccess, assertTrue),
            onFalse: () => result.pipe(Exit.isFailure, assertTrue),
          });
          if ((fault === "extra-frame" || fault === "delayed-extra-frame") && Exit.isFailure(result))
            expect(Cause.pretty(result.cause)).toContain("Owned adapter host emitted trailing frames.");
          expect(callbacks).toBe(
            A.contains(["early-exit", "bad-json", "oversized", "bad-ready", "wrong-role", "changed-resource"], fault)
              ? 0
              : 1
          );
          if (Exit.isSuccess(result)) {
            expect(result.value[0]).toBe("owned result");
            expect(result.value[1].targetSha256).toBe(f.approval.targetSha256);
            expect(result.value[1].backendSha256).toBe(f.backendSha256);
            expect(result.value[1].cleaned).toBe(true);
          }
          const peer = yield* f.fs.readFileString(f.marker).pipe(Effect.flatMap(decodePeer));
          expect(yield* f.fs.exists(`/proc/${peer.pid}`)).toBe(false);
          expect(peer.keys).not.toContain("TURBO_REMOTE_CACHE_SIGNATURE_KEY");
          expect(peer.keys).not.toContain("BEEP_CACHE_UPLOAD_SIGNING");
          for (const secret of ["synthetic-storage-id", "synthetic-storage-secret", "synthetic-native-signing-key"])
            expect(A.join(peer.argv, " ")).not.toContain(secret);
        })
      );

      it.effect.each(PreflightFault.literals)("refuses before starting a peer: %s", (fault) =>
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
            Effect.provideService(HostProcessPlatform, fault === "unsupported-platform" ? "win32" : "linux"),
            Effect.provideService(HostProcessArchitecture, fault === "unsupported-architecture" ? "arm64" : "x64"),
            Effect.exit
          );
          result.pipe(Exit.isFailure, assertTrue);
          expect(callbacks).toBe(0);
          expect(yield* f.fs.exists(f.marker)).toBe(false);
        })
      );
    }
  );
});
