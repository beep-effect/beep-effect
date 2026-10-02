import {
  CacheDependencyMaterialization,
  CacheDependencyTree,
  CachePilotRequest,
  CacheProtocolExecution,
  CacheProtocolRequest,
  CacheSignedPilotReceipt,
  CacheSignedPilotRequest,
  runCacheProtocolExperiment,
  runCacheSignedPilotExperiment,
} from "@beep/repo-cli/commands/Cache";
import * as Evidence from "@beep/repo-cli/commands/Cache/Cache.evidence";
import { CacheRuntimeAdmission, CacheRuntimeProcess } from "@beep/repo-cli/test/Cache";
import { MemoryStats } from "@beep/repo-cli/test/RepoRun";
import { CacheClientPin, CacheEvidenceReference } from "@beep/repo-configs/cache";
import { LiteralKit, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { NodeCrypto, NodeFileSystem, NodePath } from "@effect/platform-node";
import { afterEach, expect, it, vi } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { ChildProcessSpawner } from "effect/process";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { executionInput } from "./helpers/cache-protocol-fixture.ts";
import { signedPilotInput } from "./helpers/cache-signed-pilot-fixture.ts";

const Fault = LiteralKit(["none", "pin", "git", "exit", "truncated", "identity", "issuer-change", "issuer-exposed"]);
const digest = Sha256Hex.make(Str.repeat(64)("a"));
const hash = S.decodeEffect(Sha256HexFromBytes);
const encodeDependencies = S.encodeEffect(S.fromJsonString(CacheDependencyMaterialization));
const decodeReport = S.decodeUnknownEffect(CacheSignedPilotReceipt);
const encodeReport = S.encodeEffect(S.fromJsonString(CacheSignedPilotReceipt));
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
  const process = vi.spyOn(CacheRuntimeProcess, "runCapturedStreams").mockImplementation(
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
      expect(options.args).toContain("--unshare-all");
      expect(options.args).not.toContain(issuer);
      const worker = O.getOrThrow(A.last(options.args ?? []));
      const directory = path.dirname(worker);
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
        stdout: "",
        stderr: "",
        truncated: fault === "truncated",
      });
    }, Effect.orDie)
  );
  return { root, issuer, request, admission, process };
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
    Layer.succeed(MemoryStats, MemoryStats.of({ availableGib: Effect.succeed(64), totalGib: Effect.succeed(64) }))
  ),
  { timeout: "30 seconds" }
)("signed pilot supervisor", (it) => {
  it.effect("validates the supervised report with and without persistent issuer protection", () =>
    Effect.gen(function* () {
      const { root, request, issuer, admission, process } = yield* fixture("none");
      for (const protectedMaterial of [O.none<string>(), O.some(issuer)]) {
        const report = yield* runCacheSignedPilotExperiment(root, request, protectedMaterial);
        expect(report.channel).toBe("stable");
      }
      expect(admission).toHaveBeenCalledTimes(2);
      expect(process).toHaveBeenCalledTimes(4);
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
      vi.stubGlobal("process", { ...process, platform: "darwin" });
      const result = yield* runCacheSignedPilotExperiment(root, request).pipe(Effect.result);
      Result.match(result, {
        onSuccess: () => expect.fail("Supervisor accepted an unsupported host"),
        onFailure: (error) => expect(error.message).toContain("Linux x64"),
      });
      expect(captured).not.toHaveBeenCalled();
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
            onFailure: (error) =>
              expect(error.message).toContain(
                {
                  pin: "binary pin",
                  git: "Git metadata",
                  exit: "capture bound",
                  truncated: "capture bound",
                  identity: "supervised identities",
                  "issuer-change": "exposed or changed",
                  "issuer-exposed": "exposed or changed",
                }[fault]
              ),
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
        stdout: "",
        stderr: "",
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
      vi.stubGlobal("process", { ...process, platform: "darwin" });
      Result.match(yield* runCacheProtocolExperiment(root, request).pipe(Effect.result), {
        onSuccess: () => expect.fail("Supervisor accepted unsupported host"),
        onFailure: (error) => expect(error.message).toContain("Linux x64"),
      });
    })
  );
  for (const fault of ["exit", "truncated", "client", "channel", "bun"] as const)
    it.effect(`rejects ${fault}`, () =>
      Effect.gen(function* () {
        const { root, request } = yield* protocolFixture(fault);
        Result.match(yield* runCacheProtocolExperiment(root, request).pipe(Effect.result), {
          onSuccess: () => expect.fail("Supervisor accepted the injected fault"),
          onFailure: (error) =>
            expect(error.message).toContain(
              fault === "exit" || fault === "truncated" ? "capture bound" : "supervised identities"
            ),
        });
      })
    );
});
