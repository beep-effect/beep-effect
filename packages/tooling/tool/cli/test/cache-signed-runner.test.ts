import {
  CacheCommandError,
  CacheConformanceExchange,
  CacheConformanceProxyEvent,
  CacheDependencyMaterialization,
  CacheDependencyTree,
  CachePilotRequest,
  CacheProducerBinding,
  CacheProtocolExecution,
  CacheProtocolNativeSummary,
  CacheProtocolRequest,
  CacheSignedPilotReceipt,
  CacheSignedPilotRequest,
  CacheSignedPilotRun,
  runCacheProtocolExperiment,
  runCacheSignedPilotExperiment,
} from "@beep/repo-cli/commands/Cache";
import * as Adapter from "@beep/repo-cli/commands/Cache/Cache.adapter";
import * as ConformanceProxy from "@beep/repo-cli/commands/Cache/Cache.conformance.proxy";
import * as Evidence from "@beep/repo-cli/commands/Cache/Cache.evidence";
import {
  CacheAdapterRuntimeObservation,
  CacheProducerAdapterReceipt,
  CacheProducerUploadApproval,
  CacheProducerUploadRuntime,
  CacheRuntimeAdmission,
  CacheRuntimeProcess,
  runCacheProducerUploadExperiment,
} from "@beep/repo-cli/test/Cache";
import { MemoryStats } from "@beep/repo-cli/test/RepoRun";
import { CacheClientPin, CacheEvidenceReference } from "@beep/repo-configs/cache";
import { LiteralKit, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { HostProcessPlatform } from "@beep/utils";
import { NodeCrypto, NodeFileSystem, NodePath } from "@effect/platform-node";
import { afterEach, expect, it, vi } from "@effect/vitest";
import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as NetAddress from "effect/net/NetAddress";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import * as TestClock from "effect/testing/TestClock";
import { bearers, secrets, targetFor } from "./cache-conformance-server.ts";
import { makeOwnedUploadFixture } from "./helpers/cache-producer-upload-fixture.ts";
import { executionInput } from "./helpers/cache-protocol-fixture.ts";
import { signedPilotInput } from "./helpers/cache-signed-pilot-fixture.ts";

const Fault = LiteralKit(["none", "pin", "git", "exit", "truncated", "identity", "issuer-change", "issuer-exposed"]);
const isPrivateCaptureFault = S.is(Fault.pick(["exit", "truncated"]));
const privateSupervisorStream = (fault: unknown) =>
  isPrivateCaptureFault(fault) ? "synthetic-private-supervisor-stream" : "";
const digest = Sha256Hex.make(Str.repeat(64)("a"));
const hash = S.decodeEffect(Sha256HexFromBytes);
const encodeDependencies = S.encodeEffect(S.fromJsonString(CacheDependencyMaterialization));
const decodeReport = S.decodeUnknownEffect(CacheSignedPilotReceipt);
const encodeReport = S.encodeEffect(S.fromJsonString(CacheSignedPilotReceipt));
const encodePilotRun = S.encodeEffect(S.fromJsonString(CacheSignedPilotRun));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// The admission and process seams are controlled; filesystem containment, request
// serialization, report decoding and supervisor validation use their real code.
const fixture = Effect.fn("SignedRunnerTest.fixture")(function* (fault: typeof Fault.Type) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const parent = yield* fs.makeTempDirectoryScoped({ prefix: "cache-signed-runner-" });
  const root = path.join(parent, "runner");
  const sourceRoot = path.join(parent, "source");
  const tool = path.join(parent, "tool");
  const issuer = path.join(parent, "issuer.key");
  for (const directory of [root, sourceRoot, path.join(parent, "dependencies"), path.join(parent, "git")])
    yield* fs.makeDirectory(directory);
  yield* fs.writeFileString(tool, "fixture executable");
  yield* fs.writeFileString(issuer, "synthetic issuer fixture");
  const dependencies = CacheDependencyMaterialization.make({
    schemaVersion: "cache-dependency-materialization/v1",
    authority: "local-installed-tree-snapshot",
    directory: path.join(parent, "dependencies"),
    lockfileSha256: digest,
    rootManifestSha256: digest,
    tree: CacheDependencyTree.make({
      format: "canonical-gnu-tar/v1",
      sha256: digest,
      regularFiles: S.Natural.make(0),
      entries: S.Natural.make(0),
      bytes: S.Natural.make(0),
      links: [],
    }),
    tools: {},
  });
  const text = yield* encodeDependencies(dependencies);
  yield* fs.writeFileString(path.join(sourceRoot, "dependencies.json"), text);
  const reference = CacheEvidenceReference.make({
    path: "dependencies.json",
    sha256: yield* hash(new TextEncoder().encode(text)),
  });
  const request = CacheSignedPilotRequest.make({
    sourceRoot,
    pilot: CachePilotRequest.make({
      channel: "stable",
      client: CacheClientPin.make({ ...signedPilotInput.client, sha256: digest }),
      executable: tool,
      biomeExecutable: tool,
      nodeExecutable: tool,
      dependencies: reference,
      activation: reference,
      worktrees: [root, sourceRoot],
      selection: "full",
    }),
  });
  const admission = vi
    .spyOn(CacheRuntimeAdmission, "withQualityAdmission")
    .mockImplementation(
      <Success, Error, Requirements>(
        _request: unknown,
        _gate: unknown,
        use: Effect.Effect<Success, Error, Requirements>
      ) => use
    );
  vi.spyOn(Evidence, "hashCacheExperimentExecutable").mockReturnValue(
    Effect.succeed(fault === "pin" ? Sha256Hex.make(Str.repeat(64)("b")) : digest)
  );
  const capturedProcess = vi.spyOn(CacheRuntimeProcess, "runCapturedStreams").mockImplementation(
    Effect.fn("SignedRunnerTest.process")(function* (options) {
      if (options.command === "/usr/bin/git")
        return CacheRuntimeProcess.CapturedStreams.make({
          exitCode: fault === "git" ? 1 : 0,
          stdout: path.join(parent, "git"),
          stderr: "",
          truncated: false,
        });
      expect(options.command).toBe("/usr/bin/bwrap");
      expect(options.extendEnv).toBe(false);
      const args = O.getOrThrow(O.fromUndefinedOr(options.args));
      expect(args).toContain("--unshare-all");
      expect(args).not.toContain(issuer);
      expect(options.env?.PATH).toBe("/tools:/usr/bin");
      expect(A.window(args, 3)).toContainEqual(["--ro-bind", yield* fs.realPath(process.execPath), "/tools/bun"]);
      expect(A.window(args, 3)).toContainEqual(["--ro-bind", tool, "/tools/node"]);
      const worker = O.getOrThrow(A.last(args));
      const directory = path.dirname(worker);
      expect((yield* fs.stat(directory)).mode & 0o777).toBe(0o700);
      expect(Str.startsWith(`${root}/`)(directory)).toBe(false);
      expect(Str.startsWith(`${sourceRoot}/`)(directory)).toBe(false);
      expect(yield* fs.readLink(path.join(directory, "node_modules"))).toBe(path.join(root, "node_modules"));
      const config = `--config=${path.join(directory, "bunfig.toml")}`;
      expect(args).toContain(config);
      expect(yield* fs.readFileString(path.join(directory, "bunfig.toml"))).toBe("");
      expect(yield* fs.readFileString(worker)).toContain("runCacheSignedPilotWorker");
      const protect = (pair: (typeof signedPilotInput.pairs)[number]) => ({
        ...pair,
        protection: { ...pair.protection, issuerMaterialDenied: true },
      });
      const report = yield* decodeReport({
        ...signedPilotInput,
        shadows: A.map(signedPilotInput.shadows, (shadow) => ({ ...shadow, comparison: protect(shadow.comparison) })),
        mutations: A.map(signedPilotInput.mutations, (mutation) => ({
          ...mutation,
          comparison: protect(mutation.comparison),
        })),
        channel: fault === "identity" ? "canary" : "stable",
        pairs: A.map(signedPilotInput.pairs, (pair) => ({
          ...pair,
          protection: {
            ...pair.protection,
            ...(fault === "issuer-exposed" ? {} : { issuerMaterialDenied: true }),
          },
        })),
      });
      yield* fs.writeFileString(path.join(directory, "report.json"), yield* encodeReport(report));
      if (fault === "issuer-change") yield* fs.writeFileString(issuer, "changed fixture");
      return CacheRuntimeProcess.CapturedStreams.make({
        exitCode: fault === "exit" ? 1 : 0,
        stdout: privateSupervisorStream(fault),
        stderr: privateSupervisorStream(fault),
        truncated: fault === "truncated",
      });
    }, Effect.orDie)
  );
  return { root, issuer, request, admission, process: capturedProcess };
});

const UploadFault = LiteralKit(["none", "exit", "truncated", "missing-summary", "foreign-read", "issuer-change"]);

// The existing real HTTP fixture supplies upload bytes/events. The process and
// Unix-listener constructors are controlled; this is supervisor orchestration
// proof, not a claim that native Turbo or a real Unix listener executed here.
const ownedUploadFixture = Effect.fn("SignedRunnerTest.uploadFixture")(function* (fault: typeof UploadFault.Type) {
  const f = yield* fixture("none");
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const captured = yield* makeOwnedUploadFixture();
  const runtime = CacheProducerUploadRuntime.make({
    target: targetFor({ url: "http://127.0.0.1:19427/" }),
    bearers,
    signing: Redacted.make("synthetic-owned-upload-signing"),
  });
  const binding = CacheProducerBinding.make({
    ...captured.binding,
    client: f.request.pilot.client,
    uploadApproval: O.some(CacheProducerUploadApproval.make({ targetSha256: digest, artifactKeySha256: digest })),
  });
  const observed = CacheAdapterRuntimeObservation.make({
    role: "writer",
    phase: "ready",
    tokioNamedThreadsIncludingBlocking: 2,
    totalThreads: 6,
    memoryPeakBytes: S.Natural.make(1024),
  });
  const adapterReceipt = CacheProducerAdapterReceipt.make({
    backendSha256: digest,
    targetSha256: digest,
    ready: { ...observed, role: "writer", phase: "ready" },
    afterLoad: { ...observed, role: "writer", phase: "after-load" },
  });
  const adapterStarted = vi.fn();
  const adapter = vi
    .spyOn(Adapter, "withCacheProducerAdapter")
    .mockImplementation(
      <Success, Error, Requirements>(
        _root: string,
        _request: CacheSignedPilotRequest,
        _runtime: CacheProducerUploadRuntime,
        _approval: CacheProducerUploadApproval,
        use: Effect.Effect<Success, Error, Requirements>
      ) =>
        Effect.sync(adapterStarted).pipe(
          Effect.flatMap(() => use),
          Effect.map((result) => Tuple.make(result, adapterReceipt)),
          CacheCommandError.mapError("Controlled adapter failed.")
        )
    );
  const summary = CacheProtocolNativeSummary.make({ ...captured.summary, turboVersion: binding.client.version });
  const address = Redacted.make(NetAddress.unixPathAddress(f.request.pilot.executable));
  const extra = CacheConformanceProxyEvent.make({
    ...captured.event,
    exchange: CacheConformanceExchange.make({
      ...captured.event.exchange,
      method: "GET",
      requestBytes: 0,
      requestSha256: O.none(),
      requestTagSha256: O.none(),
    }),
  });
  const events = fault === "foreign-read" ? [...captured.events, extra] : captured.events;
  const listener = vi.spyOn(ConformanceProxy, "makeCacheConformanceSocketProxy").mockReturnValue(
    Effect.succeed({
      address,
      events: Effect.succeed(events),
      setScenario: () => Effect.void,
    })
  );
  const original = O.getOrThrow(O.fromUndefinedOr(f.process.getMockImplementation()));
  f.process.mockImplementation(
    Effect.fn("SignedRunnerTest.uploadProcess")(function* (options) {
      if (options.command === "/usr/bin/git") return yield* original(options);
      expect(options.command).toBe("/usr/bin/bwrap");
      expect(options.args).toContain("--unshare-all");
      expect(options.args).toContain("/cache-upload.sock");
      expect(options.args).toContain(Redacted.value(address).path);
      expect(options.args).not.toContain(f.issuer);
      expect(options.extendEnv).toBe(false);
      expect(options.env).toMatchObject({
        BEEP_CACHE_UPLOAD_BEARER: secrets.writer,
        BEEP_CACHE_UPLOAD_SIGNING: Redacted.value(runtime.signing),
      });
      const values = R.values(O.getOrElse(O.fromUndefinedOr(options.env), R.empty<string>));
      for (const secret of [secrets.reader, secrets.foreign, secrets.unknown]) expect(values).not.toContain(secret);
      const worker = O.getOrThrow(A.last(options.args ?? []));
      expect(Str.startsWith(`${f.root}/`)(worker)).toBe(false);
      expect(Str.startsWith(`${f.request.sourceRoot}/`)(worker)).toBe(false);
      const text = yield* fs.readFileString(worker);
      expect(text).toContain('Config.Redacted("BEEP_CACHE_UPLOAD_BEARER")');
      expect(text).toContain(";\nimport { CacheConformanceTarget }");
      for (const secret of [secrets.writer, Redacted.value(runtime.signing)]) expect(text).not.toContain(secret);
      const seed = yield* S.decodeUnknownEffect(CacheSignedPilotRun)(signedPilotInput.pairs[0].producer);
      const report = CacheSignedPilotRun.make({
        ...seed,
        nativeSummary: fault === "missing-summary" ? O.none() : O.some(summary),
      });
      yield* fs.writeFileString(path.join(path.dirname(worker), "report.json"), yield* encodePilotRun(report));
      if (fault === "issuer-change") yield* fs.writeFileString(f.issuer, "changed owned issuer");
      return CacheRuntimeProcess.CapturedStreams.make({
        exitCode: fault === "exit" ? 1 : 0,
        stdout: "",
        stderr: "",
        truncated: fault === "truncated",
      });
    }, Effect.orDie)
  );
  return { ...f, binding, runtime, captured, listener, adapter, adapterStarted, adapterReceipt };
});

it.layer(
  Layer.mergeAll(
    NodeFileSystem.layer,
    NodePath.layer,
    Layer.succeed(
      ChildProcessSpawner.ChildProcessSpawner,
      ChildProcessSpawner.make(() => Effect.die("Unexpected native process"))
    ),
    NodeCrypto.layer,
    FetchHttpClient.layer,
    Layer.succeed(MemoryStats, MemoryStats.of({ availableGib: Effect.succeed(64), totalGib: Effect.succeed(64) }))
  ),
  { timeout: "30 seconds" }
)("signed pilot supervisor", (it) => {
  it.effect("rejects missing backend approval before admission or supervisor side effects", () =>
    Effect.gen(function* () {
      const f = yield* ownedUploadFixture("none");
      const error = yield* runCacheProducerUploadExperiment(
        f.root,
        f.request,
        f.runtime,
        CacheProducerBinding.make({ ...f.binding, uploadApproval: O.none() }),
        [f.binding.key.computation],
        f.issuer
      ).pipe(Effect.flip);
      expect(error.message).toBe("Owned upload requires its independent backend approval.");
      expect(f.admission).not.toHaveBeenCalled();
      expect(f.adapter).not.toHaveBeenCalled();
      expect(f.adapterStarted).not.toHaveBeenCalled();
      expect(f.listener).not.toHaveBeenCalled();
      expect(f.process).not.toHaveBeenCalled();
    })
  );
  it.effect("joins the owned worker summary to the complete parent upload capture", () =>
    Effect.gen(function* () {
      const f = yield* ownedUploadFixture("none");
      const [upload, backend] = yield* runCacheProducerUploadExperiment(
        f.root,
        f.request,
        f.runtime,
        f.binding,
        [f.binding.key.computation],
        f.issuer
      );
      expect(backend).toEqual(f.adapterReceipt);
      expect(f.admission).toHaveBeenCalledOnce();
      expect(f.adapterStarted).toHaveBeenCalledOnce();
      expect(upload.archiveSha256).toBe(f.captured.archiveSha256);
      expect(upload.archiveBytes).toBe(f.captured.archiveBytes);
      expect(f.listener).toHaveBeenCalledWith(
        expect.objectContaining({ maxEvents: 200, maxBodyBytes: 50 * 1024 * 1024, maxCaptureBytes: 50 * 1024 * 1024 })
      );
      expect(f.process).toHaveBeenCalledTimes(2);
    })
  );
  it.layer(TestClock.layer(), { timeout: "30 seconds" })("isolated upload admission clock", (it) => {
    it.effect("reports a comparison deadline safely and releases its private worker directory", () =>
      Effect.gen(function* () {
        const { root, request, process: captured } = yield* fixture("none");
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const started = yield* Deferred.make<string>();
        const original = O.getOrThrow(O.fromUndefinedOr(captured.getMockImplementation()));
        captured.mockImplementation((options) =>
          options.command === "/usr/bin/bwrap"
            ? Deferred.succeed(started, O.getOrThrow(A.last(options.args ?? []))).pipe(Effect.andThen(Effect.never))
            : original(options)
        );
        const worker = yield* runCacheSignedPilotExperiment(root, request).pipe(Effect.result, Effect.forkScoped);
        const script = yield* Deferred.await(started);
        yield* TestClock.adjust("21 minutes");
        const result = yield* Fiber.join(worker);
        Result.match(result, {
          onSuccess: () => expect.fail("Supervisor accepted an expired comparison"),
          onFailure: (error) => {
            expect(error.message).toBe("Signed pilot comparison exceeded its twenty-minute execution limit.");
            expect(error.cause).toBeUndefined();
          },
        });
        expect(yield* fs.exists(path.dirname(script))).toBe(false);
      })
    );
    it.effect("does not start an owned backend while waiting for upload admission", () =>
      Effect.gen(function* () {
        const f = yield* ownedUploadFixture("none");
        const queued = yield* Deferred.make<void>();
        const admitted = yield* Deferred.make<void>();
        f.admission.mockImplementation(
          <Success, Error, Requirements>(
            _request: unknown,
            _gate: unknown,
            use: Effect.Effect<Success, Error, Requirements>
          ) => Deferred.succeed(queued, undefined).pipe(Effect.andThen(Deferred.await(admitted)), Effect.andThen(use))
        );
        const worker = yield* runCacheProducerUploadExperiment(
          f.root,
          f.request,
          f.runtime,
          f.binding,
          [f.binding.key.computation],
          f.issuer
        ).pipe(Effect.forkScoped);
        yield* Deferred.await(queued);
        yield* TestClock.adjust("11 minutes");
        expect(f.adapterStarted).not.toHaveBeenCalled();
        expect(f.listener).not.toHaveBeenCalled();
        expect(f.process).not.toHaveBeenCalled();
        yield* Deferred.succeed(admitted, undefined);
        const [upload] = yield* Fiber.join(worker);
        expect(upload.archiveSha256).toBe(f.captured.archiveSha256);
        expect(f.adapterStarted).toHaveBeenCalledOnce();
        expect(f.admission).toHaveBeenCalledOnce();
      })
    );
  });
  it.effect("refuses failed, truncated, incomplete, extra-read and changed-issuer upload executions", () =>
    Effect.gen(function* () {
      for (const fault of UploadFault.pick(["exit", "truncated", "missing-summary", "foreign-read", "issuer-change"])
        .literals) {
        const f = yield* ownedUploadFixture(fault);
        const failed = yield* runCacheProducerUploadExperiment(
          f.root,
          f.request,
          f.runtime,
          f.binding,
          [f.binding.key.computation],
          f.issuer
        ).pipe(Effect.isFailure);
        expect(failed, fault).toBe(true);
        expect(f.process).toHaveBeenCalledTimes(2);
        vi.restoreAllMocks();
      }
    })
  );
  it.effect("validates the supervised report with and without persistent issuer protection", () =>
    Effect.gen(function* () {
      const { root, request, issuer, admission, process } = yield* fixture("none");
      for (const protectedMaterial of [O.none<string>(), O.some(issuer)]) {
        const report = yield* runCacheSignedPilotExperiment(root, request, protectedMaterial);
        expect(report.channel).toBe("stable");
      }
      expect(admission).toHaveBeenCalledTimes(2);
      expect(process).toHaveBeenCalledTimes(4);
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      for (const [options] of process.mock.calls) {
        if (options.command !== "/usr/bin/bwrap") continue;
        const worker = O.getOrThrow(A.last(options.args ?? []));
        expect(yield* fs.exists(path.dirname(worker))).toBe(false);
      }
    })
  );
  it.effect.prop(
    "rejects schema-generated mismatched binary pins before execution",
    [Sha256Hex],
    ([sha256]) =>
      Effect.gen(function* () {
        const { root, request, process: captured } = yield* fixture("none");
        if (sha256 === digest) return;
        const changed = CacheSignedPilotRequest.make({
          ...request,
          pilot: CachePilotRequest.make({
            ...request.pilot,
            client: CacheClientPin.make({ ...request.pilot.client, sha256 }),
          }),
        });
        const result = yield* runCacheSignedPilotExperiment(root, changed).pipe(Effect.result);
        Result.match(result, {
          onSuccess: () => expect.fail("Supervisor accepted an unbound executable"),
          onFailure: (error) => expect(error.message).toContain("binary pin"),
        });
        expect(captured).not.toHaveBeenCalled();
      }),
    { arbitrary: fcRuns(40) }
  );
  it.effect("refuses unsupported hosts before reading tools or launching processes", () =>
    Effect.gen(function* () {
      const { root, request, process: captured } = yield* fixture("none");
      const result = yield* runCacheSignedPilotExperiment(root, request).pipe(
        Effect.provideService(HostProcessPlatform, "darwin"),
        Effect.result
      );
      Result.match(result, {
        onSuccess: () => expect.fail("Supervisor accepted an unsupported host"),
        onFailure: (error) => expect(error.message).toContain("Linux x64"),
      });
      expect(captured).not.toHaveBeenCalled();
    })
  );
  it.effect("refuses a private storage alias inside a source mount before writing the request", () =>
    Effect.gen(function* () {
      const { root, request, process } = yield* fixture("none");
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const alias = path.join(root, "private-storage-alias");
      yield* fs.makeDirectory(alias);
      const result = yield* runCacheSignedPilotExperiment(root, request).pipe(
        Effect.provideService(FileSystem.FileSystem, {
          ...fs,
          realPath: (file) =>
            Str.startsWith("/tmp/beep-cache-supervisor-")(file) ? Effect.succeed(alias) : fs.realPath(file),
        }),
        Effect.result
      );
      Result.match(result, {
        onSuccess: () => expect.fail("Supervisor accepted a source-visible private directory"),
        onFailure: (error) => expect(error.message).toContain("Private supervisor storage must remain outside"),
      });
      expect(yield* fs.exists(path.join(alias, "request.json"))).toBe(false);
      expect(process).toHaveBeenCalledTimes(1);
    })
  );
  it.effect("refuses issuer material inside a read-only input mount before starting the worker", () =>
    Effect.gen(function* () {
      const { root, request, process } = yield* fixture("none");
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const mountedIssuer = path.join(root, "issuer.key");
      yield* fs.writeFileString(mountedIssuer, "synthetic mounted issuer");
      const result = yield* runCacheSignedPilotExperiment(root, request, O.some(mountedIssuer)).pipe(Effect.result);
      Result.match(result, {
        onSuccess: () => expect.fail("Supervisor exposed issuer material"),
        onFailure: (error) => expect(error.message).toContain("outside every signed pilot input mount"),
      });
      expect(process).toHaveBeenCalledTimes(1);
    })
  );
  for (const fault of ["pin", "git", "exit", "truncated", "identity", "issuer-change", "issuer-exposed"] as const)
    it.effect(`rejects ${fault} before returning an observation`, () =>
      Effect.gen(function* () {
        const { root, request, issuer } = yield* fixture(fault);
        (yield* runCacheSignedPilotExperiment(root, request, O.some(issuer)).pipe(Effect.result)).pipe(
          Result.match({
            onSuccess: () => expect.fail("Supervisor accepted the injected fault"),
            onFailure: (error) => {
              expect(error.message).toContain(
                {
                  pin: "binary pin",
                  git: "Git metadata",
                  exit: "exit code 1",
                  truncated: "capture bound",
                  identity: "supervised identities",
                  "issuer-change": "exposed or changed",
                  "issuer-exposed": "exposed or changed",
                }[fault]
              );
              expect(error.message).not.toContain("synthetic-private-supervisor-stream");
              if (fault === "exit" || fault === "truncated") expect(error.cause).toBeUndefined();
            },
          })
        );
      })
    );
});

const ProtocolFault = LiteralKit(["none", "exit", "truncated", "client", "channel", "bun"]);
const decodeExecution = S.decodeUnknownEffect(CacheProtocolExecution);
const encodeExecution = S.encodeEffect(S.fromJsonString(CacheProtocolExecution));
const protocolFixture = Effect.fn("ProtocolSupervisorTest.fixture")(function* (fault: typeof ProtocolFault.Type) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "cache-protocol-supervisor-" });
  const executable = path.join(root, "turbo");
  yield* fs.writeFileString(executable, "synthetic executable");
  const request = CacheProtocolRequest.make({
    channel: "stable",
    executable,
    client: CacheClientPin.make({ ...executionInput.observation.client, sha256: digest }),
  });
  vi.spyOn(CacheRuntimeAdmission, "withQualityAdmission").mockImplementation(
    <Success, Error, Requirements>(
      _request: unknown,
      _gate: unknown,
      use: Effect.Effect<Success, Error, Requirements>
    ) => use
  );
  vi.spyOn(Evidence, "hashCacheExperimentExecutable").mockReturnValue(
    Effect.succeed(Sha256Hex.make(executionInput.bunSha256))
  );
  vi.spyOn(CacheRuntimeProcess, "runCapturedStreams").mockImplementation(
    Effect.fn("ProtocolSupervisorTest.process")(function* (options) {
      expect(options.command).toBe("/usr/bin/bwrap");
      expect(options.extendEnv).toBe(false);
      expect(options.args).toContain("--unshare-all");
      const args = options.args ?? [];
      const directory = O.getOrThrow(A.get(args, O.getOrThrow(A.findFirstIndex(args, (arg) => arg === "--chdir")) + 1));
      expect(yield* fs.readFileString(path.join(directory, "worker.ts"))).toContain("runCacheProtocolWorker");
      const report = yield* decodeExecution({
        ...executionInput,
        bunSha256: fault === "bun" ? digest : executionInput.bunSha256,
        observation: {
          ...executionInput.observation,
          channel: fault === "channel" ? "canary" : "stable",
          client: {
            ...executionInput.observation.client,
            namespace: fault === "client" ? "other" : request.client.namespace,
          },
        },
      });
      yield* fs.writeFileString(path.join(directory, "report.json"), yield* encodeExecution(report));
      return CacheRuntimeProcess.CapturedStreams.make({
        exitCode: fault === "exit" ? 1 : 0,
        stdout: privateSupervisorStream(fault),
        stderr: privateSupervisorStream(fault),
        truncated: fault === "truncated",
      });
    }, Effect.orDie)
  );
  return { root, request };
});
it.layer(
  Layer.mergeAll(
    NodeFileSystem.layer,
    NodePath.layer,
    NodeCrypto.layer,
    Layer.succeed(MemoryStats, MemoryStats.of({ availableGib: Effect.succeed(64), totalGib: Effect.succeed(64) })),
    Layer.succeed(
      ChildProcessSpawner.ChildProcessSpawner,
      ChildProcessSpawner.make(() => Effect.die("Unexpected native process"))
    )
  ),
  { timeout: "30 seconds" }
)("protocol supervisor", (it) => {
  it.effect("decodes and validates a report from the private worker", () =>
    Effect.gen(function* () {
      const { root, request } = yield* protocolFixture("none");
      const report = yield* runCacheProtocolExperiment(root, request);
      expect(report.roots).toHaveLength(9);
    })
  );
  it.effect("rejects unsupported hosts before launching the worker", () =>
    Effect.gen(function* () {
      const { root, request } = yield* protocolFixture("none");
      Result.match(
        yield* runCacheProtocolExperiment(root, request).pipe(
          Effect.provideService(HostProcessPlatform, "darwin"),
          Effect.result
        ),
        {
          onSuccess: () => expect.fail("Supervisor accepted unsupported host"),
          onFailure: (error) => expect(error.message).toContain("Linux x64"),
        }
      );
    })
  );
  for (const fault of ["exit", "truncated", "client", "channel", "bun"] as const)
    it.effect(`rejects ${fault}`, () =>
      Effect.gen(function* () {
        const { root, request } = yield* protocolFixture(fault);
        Result.match(yield* runCacheProtocolExperiment(root, request).pipe(Effect.result), {
          onSuccess: () => expect.fail("Supervisor accepted the injected fault"),
          onFailure: (error) => {
            expect(error.message).toContain(
              {
                exit: "exit code 1",
                truncated: "capture bound",
                client: "supervised identities",
                channel: "supervised identities",
                bun: "supervised identities",
              }[fault]
            );
            expect(error.message).not.toContain("synthetic-private-supervisor-stream");
            if (fault === "exit" || fault === "truncated") expect(error.cause).toBeUndefined();
          },
        });
      })
    );
});
