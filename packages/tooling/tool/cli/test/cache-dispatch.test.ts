import { Git } from "@beep/git/Git";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  CacheActivationPreview,
  CacheActivationRequest,
  CacheBaselineRequest,
  CacheCensusDefinition,
  CacheCommandError,
  CacheComputationConfiguration,
  CacheExecutablePin,
  CacheLinkedFile,
  CacheLiveIdentity,
  CachePilotRequest,
  CacheProducerApproval,
  CacheProducerBinding,
  CacheProducerBody,
  CacheProducerBundle,
  CacheProducerEnvelope,
  CacheQualificationService,
  CacheSignedPilotRequest,
  CacheToolchainSnapshot,
  CacheTransitionRequest,
} from "@beep/repo-cli/commands/Cache";
import {
  CacheProducerImportRequest,
  CacheProducerPublication,
} from "@beep/repo-cli/commands/Cache/Cache.acceptance.schemas";
import * as AcceptanceStore from "@beep/repo-cli/commands/Cache/Cache.acceptance.store";
import * as Producer from "@beep/repo-cli/commands/Cache/Cache.producer";
import * as Profile from "@beep/repo-cli/commands/Cache/Cache.profile";
import * as Runtime from "@beep/repo-cli/commands/Cache/Cache.runtime";
import * as Workflow from "@beep/repo-cli/commands/Cache/Cache.workflow";
import { CacheHostedProducerReference } from "@beep/repo-cli/commands/Cache/Cache.workflow.github.schemas";
import {
  CacheHostedProducerCompleteReport,
  CacheProducerExecutionProfile,
  CacheProducerObservation,
  CacheProducerUploadRuntime,
  CacheProducerWorkflow,
  CacheProducerWorkflowFile,
  hashCacheProducerContract,
  makeCacheCommandForTesting,
} from "@beep/repo-cli/test/Cache";
import {
  CacheActivationProjection,
  CacheEvidenceReference,
  CachePolicyAuditReport,
  CachePolicyBaseline,
  CachePolicyBaselineRecord,
  CachePolicyFinding,
  CachePolicyProjection,
  CacheQualificationEntry,
  CacheQualificationKey,
  CacheQualificationStore,
  CacheReviewDecision,
  CacheTaskConfiguration,
  CacheTaskContract,
} from "@beep/repo-configs/cache";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { GitObjectId } from "@beep/schema/Conformance";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import * as NodeChildProcessSpawner from "@effect/platform-node/NodeChildProcessSpawner";
import * as NodePath from "@effect/platform-node/NodePath";
import * as NodeStdio from "@effect/platform-node/NodeStdio";
import * as NodeTerminal from "@effect/platform-node/NodeTerminal";
import { afterEach, describe, expect, vi } from "@effect/vitest";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import * as TestConsole from "effect/testing/TestConsole";
import { bearers, targetFor } from "./cache-conformance-server.ts";
import { input as bundleInput, contractInput, pilot, protocol } from "./helpers/cache-producer-bundle-fixture.ts";

const digest = Sha256Hex.make(Str.repeat(64)("a"));
const key = CacheQualificationKey.make({
  computation: "@beep/fixture#lint",
  layer: "turbo-task-result",
  profile: "local-linux-x64-bun1.4.2",
  epoch: "fixture",
});
const reference = CacheEvidenceReference.make({ path: "review.json", sha256: digest });
const review = CacheReviewDecision.make({ reviewer: "fixture", reason: "bounded fixture review", basis: reference });
const baseline = CachePolicyBaseline.make({
  reviews: { "//": review },
  scope: [key.computation],
  profile: key.profile,
  epoch: key.epoch,
  projection: CachePolicyProjection.make({ globalConfiguration: {}, nodes: [], sources: [] }),
});
const entry = CacheQualificationEntry.make({ key, status: { state: "excluded", review } });
const store = CacheQualificationStore.make({ revision: S.Natural.make(1), entries: [entry], history: [] });
const executable = CacheExecutablePin.make({ version: "1.4.2", sha256: digest });
const identity = CacheLiveIdentity.make({
  key,
  configuration: CacheComputationConfiguration.make({
    computation: key.computation,
    globalConfiguration: {},
    nodes: [
      CacheCensusDefinition.make({
        id: key.computation,
        command: O.some("biome check ."),
        commandDigest: digest,
        dependencies: [],
        configuration: CacheTaskConfiguration.make({
          cache: false,
          inputs: [],
          outputs: [],
          env: [],
          passThroughEnv: [],
          dependsOn: [],
          persistent: false,
          interactive: false,
          interruptible: false,
          outputLogs: "full",
        }),
      }),
    ],
    sources: [],
  }),
  configurationDigest: digest,
  toolchainDigest: digest,
  toolchain: CacheToolchainSnapshot.make({
    profile: "local-linux-x64-bun1.4.2",
    kernel: "fixture",
    libc: "fixture",
    bun: executable,
    node: executable,
    turbo: executable,
    biome: executable,
    sources: [],
  }),
});
const activation = CacheActivationProjection.make({
  path: "packages/fixture/turbo.json",
  before: reference,
  after: CacheEvidenceReference.make({ ...reference, path: "after.json" }),
  sourceConfiguration: digest,
});
const preview = CacheActivationPreview.make({ activation, source: identity, target: identity });
const emptyAudit = CachePolicyAuditReport.make({ findings: [], unassessed: [key.computation] });
const encodeSignedPilotRequest = S.encodeEffect(S.fromJsonString(CacheSignedPilotRequest));
const decodeProducerObservation = S.decodeEffect(S.fromJsonString(CacheProducerObservation));
const decodeCompleteReport = S.decodeEffect(S.fromJsonString(CacheHostedProducerCompleteReport));
const encodeProducerImport = S.encodeEffect(S.fromJsonString(CacheProducerImportRequest));
const encodeBaselineRequest = S.encodeEffect(S.fromJsonString(CacheBaselineRequest));
const encodeTransitionRequest = S.encodeEffect(S.fromJsonString(CacheTransitionRequest));
const encodeActivationRequest = S.encodeEffect(S.fromJsonString(CacheActivationRequest));
const decodeIdentity = S.decodeUnknownEffect(S.fromJsonString(CacheLiveIdentity));
const decodePreview = S.decodeUnknownEffect(S.fromJsonString(CacheActivationPreview));
const workflow = CacheProducerWorkflow.make({
  revision: GitObjectId.make(Str.repeat(40)("a")),
  files: [CacheProducerWorkflowFile.make({ path: "source.ts", sha256: digest, mode: 0o644, linkTarget: O.none() })],
  toolchain: identity.toolchain,
  inspectionTools: A.makeBy(7, (index) =>
    CacheLinkedFile.make({ path: `/tool-${index}`, target: `/tool-${index}`, sha256: digest })
  ),
});
const decodeWorkflow = S.decodeUnknownEffect(S.fromJsonString(CacheProducerWorkflow));
const encodeProducerApproval = S.encodeEffect(S.fromJsonString(CacheProducerApproval));
const encodeProducerExecutionProfile = S.encodeEffect(S.fromJsonString(CacheProducerExecutionProfile));
const encodeProducerMaterial = S.encodeEffect(S.Uint8ArrayFromBase64);
const decodeProducerBinding = S.decodeUnknownEffect(CacheProducerBinding);
const decodeProducerContract = S.decodeUnknownEffect(CacheTaskContract);
const producerProvisioning = Effect.fn("CacheDispatchTest.producerProvisioning")(function* () {
  const contract = yield* decodeProducerContract(contractInput);
  const binding = yield* decodeProducerBinding({
    ...pilot,
    protocolClient: protocol.observation.client,
    workflowRevision: Str.repeat(40)("a"),
    workflowImplementation: digest,
    policyDigest: yield* hashCacheProducerContract(contract),
  });
  return Tuple.make(
    CacheProducerApproval.make({ binding, contract }),
    CacheProducerExecutionProfile.make({
      target: targetFor({ url: "http://127.0.0.1:19427/" }),
      adapterExecutable: "/fixture/adapter",
    })
  );
});
const testLayer = Layer.mergeAll(
  NodeServices.layer,
  NodeCrypto.layer,
  TestConsole.layer,
  FsUtilsLive.pipe(Layer.provide(NodeServices.layer)),
  Git.layer.pipe(Layer.provide(NodeServices.layer))
);

const memoryFsLayer = Layer.effect(
  FileSystem.FileSystem,
  Effect.gen(function* () {
    const fs = yield* MemoryFileSystem.make;
    yield* fs.makeDirectory(process.cwd(), { recursive: true });
    return fs;
  })
);
const memoryPlatform = Layer.mergeAll(
  memoryFsLayer,
  NodePath.layer,
  NodeCrypto.layer,
  TestConsole.layer,
  NodeChildProcessSpawner.layer.pipe(Layer.provide(Layer.merge(memoryFsLayer, NodePath.layer))),
  NodeStdio.layer,
  NodeTerminal.layer
);
const memoryLayer = Layer.mergeAll(
  memoryPlatform,
  FsUtilsLive.pipe(Layer.provide(memoryPlatform)),
  Git.layer.pipe(Layer.provide(memoryPlatform))
);

const defaultBaselineRequest = CacheBaselineRequest.make({
  review,
  scope: baseline.scope,
  profile: baseline.profile,
  epoch: baseline.epoch,
  subjects: O.none(),
  previous: O.none(),
});

const consoleText = TestConsole.logLines.pipe(Effect.map(A.filter(P.isString)), Effect.map(A.join("\n")));
const errorText = TestConsole.errorLines.pipe(Effect.map(A.filter(P.isString)), Effect.map(A.join("\n")));
const fixture = Effect.fn("CacheDispatchTest.fixture")(function* (
  report = emptyAudit,
  baselineRequest = defaultBaselineRequest
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ directory: process.cwd(), prefix: ".cache-dispatch-test-" });
  const requests = {
    baseline: path.join(root, "baseline.json"),
    transition: path.join(root, "transition.json"),
    activation: path.join(root, "activation.json"),
  };
  const transitionRequest = CacheTransitionRequest.make({ expectedRevision: S.Natural.make(0), entry });
  const activationRequest = CacheActivationRequest.make({
    computation: key.computation,
    path: activation.path,
    before: activation.before,
    after: activation.after,
  });
  const encodedBaselineRequest = yield* encodeBaselineRequest(baselineRequest);
  yield* fs.writeFileString(requests.baseline, encodedBaselineRequest);
  const encodedTransitionRequest = yield* encodeTransitionRequest(transitionRequest);
  yield* fs.writeFileString(requests.transition, encodedTransitionRequest);
  const encodedActivationRequest = yield* encodeActivationRequest(activationRequest);
  yield* fs.writeFileString(requests.activation, encodedActivationRequest);
  const calls = A.empty<string>();
  const layer = Layer.succeed(
    CacheQualificationService,
    CacheQualificationService.of({
      remoteReads: Effect.fn("CacheQualificationService.remoteReads")(() => Effect.die("Unexpected remote-read setup")),
      audit: Effect.fn("CacheDispatchTest.audit")(() => Effect.succeed(report)),
      inspect: Effect.fn("CacheDispatchTest.inspect")(() => Effect.succeed(store)),
      fingerprint: Effect.fn("CacheDispatchTest.fingerprint")(function* (_root, computation) {
        if (computation !== key.computation) {
          return yield* CacheCommandError.new("Unknown computation.");
        }
        return identity;
      }),
      baseline: Effect.fn("CacheDispatchTest.baseline")((_root, request) =>
        Effect.sync(() => {
          expect(request).toEqual(baselineRequest);
          A.appendInPlace(calls, "baseline");
          return CachePolicyBaselineRecord.make({ baseline, stamped: ["//"], carried: [], dropped: [] });
        })
      ),
      transition: Effect.fn("CacheDispatchTest.transition")((_root, request) =>
        Effect.sync(() => {
          expect(request).toEqual(transitionRequest);
          A.appendInPlace(calls, "transition");
          return store;
        })
      ),
      activation: Effect.fn("CacheDispatchTest.activation")((_root, request) =>
        Effect.sync(() => {
          expect(request).toEqual(activationRequest);
          A.appendInPlace(calls, "activation");
          return preview;
        })
      ),
    })
  );
  return {
    fs,
    path,
    root,
    requests,
    calls,
    run: Command.runWith(makeCacheCommandForTesting(layer), { version: "0.0.0" }),
  };
});

afterEach(() => vi.restoreAllMocks());

describe("cache qualification command dispatch", () => {
  it.layer(testLayer, { timeout: "30 seconds" })((it) => {
    it.effect("rejects malformed native and acceptance requests without output or qualification mutation", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const request = f.path.join(f.root, "invalid-acceptance.json");
        const output = f.path.join(f.root, "acceptance-reference.json");
        yield* f.fs.writeFileString(request, "{}");
        for (const command of ["accept", "pilot-signed", "protocol-run", "protocol-review"]) {
          const pipe1 = yield* f.run([command, "--request", request, "--output", output]).pipe(Effect.isFailure);
          expect(pipe1).toBe(true);
        }
        const exists2 = yield* f.fs.exists(output);
        expect(exists2).toBe(false);
        expect(f.calls).toEqual([]);
        const errorText3 = yield* errorText;
        expect(errorText3).toContain("Cannot decode the pinned local experiment request.");
      })
    );
  });

  it.layer(testLayer, { timeout: "30 seconds" })((it) => {
    it.effect("checks and regenerates the profile only through the selected operation", () =>
      Effect.gen(function* () {
        const verify = vi.spyOn(Profile, "verifyCacheIdentityLintProfile").mockReturnValue(Effect.void);
        const write = vi.spyOn(Profile, "writeCacheIdentityLintProfile").mockReturnValue(Effect.void);
        const f = yield* fixture();
        yield* f.run(["profile"]);
        expect(verify).toHaveBeenCalledWith(process.cwd());
        expect(write).not.toHaveBeenCalled();
        yield* f.run(["profile", "--write"]);
        expect(verify).toHaveBeenCalledTimes(1);
        expect(write).toHaveBeenCalledWith(process.cwd());
        const text = yield* consoleText;
        expect(text).toContain("Identity lint candidate profile is current.");
        expect(text).toContain("Identity lint candidate profile written.");
        verify.mockReturnValue(Effect.fail(CacheCommandError.new("stale profile fixture")));
        const pipe4 = yield* f.run(["profile"]).pipe(Effect.isFailure);
        expect(pipe4).toBe(true);
        const errorText5 = yield* errorText;
        expect(errorText5).toContain("stale profile fixture");
      })
    );
  });

  it.layer(testLayer, { timeout: "30 seconds" })((it) => {
    it.effect("forwards native arguments and reports unsuccessful native execution", () =>
      Effect.gen(function* () {
        const execute = vi.spyOn(Runtime, "runCacheRuntimeTasks").mockReturnValue(Effect.succeed(0));
        const f = yield* fixture();
        const args = ["run", "lint", "--filter=@beep/identity"];
        yield* f.run(["execute", "--", ...args]);
        expect(execute).toHaveBeenCalledWith(process.cwd(), args);
        execute.mockReturnValue(Effect.succeed(7));
        const pipe6 = yield* f.run(["execute", "--", ...args]).pipe(Effect.isFailure);
        expect(pipe6).toBe(true);
      })
    );
  });

  it.layer(memoryLayer, { timeout: "30 seconds" })((it) => {
    it.effect.prop(
      "preserves arbitrary reviewed baseline requests through file decoding and command dispatch",
      [CacheBaselineRequest],
      ([request]) =>
        Effect.gen(function* () {
          const f = yield* fixture(emptyAudit, request);
          yield* f.run(["baseline", "--request", f.requests.baseline]);
          expect(f.calls).toEqual(["baseline"]);
        }),
      { arbitrary: fcRuns(40) }
    );
  });

  it.layer(testLayer, { timeout: "30 seconds" })((it) => {
    it.effect("renders the index and audit formats through the injected authority", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        yield* f.run([]);
        yield* f.run(["audit"]);
        yield* f.run(["audit", "--json"]);
        const text = yield* consoleText;
        expect(text).toContain("cache commands: census");
        expect(text).toContain("0 blocking findings; 1 unassessed");
        expect(text).toContain('"unassessed"');
      })
    );
  });

  it.layer(testLayer, { timeout: "30 seconds" })((it) => {
    it.effect("prints review and blocking findings and fails only on blocking audit results", () =>
      Effect.gen(function* () {
        const advisory = CachePolicyFinding.make({
          kind: "configuration-source-drift",
          subject: "turbo.json",
          blocking: false,
        });
        const blocking = CachePolicyFinding.make({
          kind: "unqualified-reuse",
          subject: key.computation,
          blocking: true,
        });
        const reviewed = yield* fixture(CachePolicyAuditReport.make({ findings: [advisory], unassessed: [] }));
        yield* reviewed.run(["audit"]);
        const refused = yield* fixture(CachePolicyAuditReport.make({ findings: [advisory, blocking], unassessed: [] }));
        const pipe7 = yield* refused.run(["audit"]).pipe(Effect.isFailure);
        expect(pipe7).toBe(true);
        const pipe8 = yield* refused.run(["audit", "--json"]).pipe(Effect.isFailure);
        expect(pipe8).toBe(true);
        const consoleText9 = yield* consoleText;
        expect(consoleText9).toContain("REVIEW configuration-source-drift: turbo.json");
        const consoleText10 = yield* consoleText;
        expect(consoleText10).toContain("BLOCK unqualified-reuse: @beep/fixture#lint");
        const errorText11 = yield* errorText;
        expect(errorText11).toContain("Current cache reuse differs from reviewed policy.");
      })
    );
  });

  it.layer(testLayer, { timeout: "30 seconds" })((it) => {
    it.effect("decodes reviewed requests before dispatching baseline, transition and activation operations", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        yield* f.run(["baseline", "--request", f.requests.baseline]);
        yield* f.run(["transition", "--request", f.requests.transition]);
        const output = f.path.join(f.root, "preview.json");
        yield* f.run(["activation", "--request", f.requests.activation, "--output", output]);
        const pipe12 = yield* f.fs.readFileString(output).pipe(Effect.flatMap(decodePreview));
        expect(pipe12).toEqual(preview);
        expect(f.calls).toEqual(["baseline", "transition", "activation"]);
        const consoleText13 = yield* consoleText;
        expect(consoleText13).toContain("Reviewed baseline written for 0 executable computations");
        const consoleText14 = yield* consoleText;
        expect(consoleText14).toContain("Qualification revision 1: @beep/fixture#lint is excluded.");
      })
    );
  });

  it.layer(testLayer, { timeout: "30 seconds" })((it) => {
    it.effect("prints fingerprints or writes their exact schema representation to a selected file", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        yield* f.run(["fingerprint", "--computation", key.computation]);
        const output = f.path.join(f.root, "identity.json");
        yield* f.run(["fingerprint", "--computation", key.computation, "--output", output]);
        const pipe15 = yield* f.fs.readFileString(output).pipe(Effect.flatMap(decodeIdentity));
        expect(pipe15).toEqual(identity);
        const consoleText16 = yield* consoleText;
        expect(consoleText16).toContain('"cache-live-identity/v1"');
        const consoleText17 = yield* consoleText;
        expect(consoleText17).toContain("Fingerprint recorded for @beep/fixture#lint");
        const pipe18 = yield* f.run(["fingerprint", "--computation", "@beep/unknown#lint"]).pipe(Effect.isFailure);
        expect(pipe18).toBe(true);
        const acquireUseRelease19 = yield* Effect.acquireUseRelease(
          Effect.sync(() => vi.spyOn(Bun, "write").mockRejectedValue(new Error("fixture write failure"))),
          () => f.run(["fingerprint", "--computation", key.computation, "--output", output]).pipe(Effect.isFailure),
          (spy) => Effect.sync(() => spy.mockRestore())
        );
        expect(acquireUseRelease19).toBe(true);
        const errorText20 = yield* errorText;
        expect(errorText20).toContain("Unknown computation.");
        const errorText21 = yield* errorText;
        expect(errorText21).toContain("Failed to write");
      })
    );
  });

  it.layer(testLayer, { timeout: "30 seconds" })((it) => {
    it.effect("rejects malformed, missing, escaping and invalid UTF-8 requests before calling an operation", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const bad = f.path.join(f.root, "bad.json");
        yield* f.fs.writeFileString(bad, "{}");
        for (const command of ["baseline", "transition", "activation", "pilot"]) {
          const pipe22 = yield* f.run([command, "--request", bad]).pipe(Effect.isFailure);
          expect(pipe22).toBe(true);
        }
        yield* f.fs.writeFile(bad, new Uint8Array([255]));
        const pipe23 = yield* f.run(["activation", "--request", bad]).pipe(Effect.isFailure);
        expect(pipe23).toBe(true);
        const errorText24 = yield* errorText;
        expect(errorText24).toContain("not valid UTF-8");
        const pipe25 = yield* f
          .run(["activation", "--request", f.path.join(f.root, "missing.json")])
          .pipe(Effect.isFailure);
        expect(pipe25).toBe(true);
        const pipe26 = yield* f.run(["activation", "--request", "/outside-request.json"]).pipe(Effect.isFailure);
        expect(pipe26).toBe(true);
        expect(f.calls).toEqual([]);
      })
    );
  });
  it.layer(testLayer, { timeout: "30 seconds" })((it) => {
    it.effect("preserves external review paths and typed failures when sharing review request decoding", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const external = yield* f.fs.makeTempDirectoryScoped({ prefix: "cache-review-request-" });
        const baselinePath = f.path.join(external, "baseline.json");
        const transitionPath = f.path.join(external, "transition.json");
        yield* f.fs.copyFile(f.requests.baseline, baselinePath);
        yield* f.fs.copyFile(f.requests.transition, transitionPath);
        yield* f.run(["baseline", "--request", baselinePath]);
        yield* f.run(["transition", "--request", transitionPath]);
        expect(f.calls).toEqual(["baseline", "transition"]);
        yield* f.fs.writeFileString(baselinePath, "invalid JSON");
        const pipe27 = yield* f.run(["baseline", "--request", baselinePath]).pipe(Effect.isFailure);
        expect(pipe27).toBe(true);
        const errorText28 = yield* errorText;
        expect(errorText28).toContain("Cannot decode baseline review request.");
        yield* f.fs.remove(transitionPath);
        const pipe29 = yield* f.run(["transition", "--request", transitionPath]).pipe(Effect.isFailure);
        expect(pipe29).toBe(true);
        const errorText30 = yield* errorText;
        expect(errorText30).toContain("Cannot decode qualification transition request.");
        expect(f.calls).toEqual(["baseline", "transition"]);
      })
    );
    it.effect("writes producer inspection without reading credentials or changing qualification", () =>
      Effect.gen(function* () {
        const inspect = vi.spyOn(Workflow, "inspectCacheProducerWorkflow").mockReturnValue(Effect.succeed(workflow));
        const f = yield* fixture();
        const output = f.path.join(f.root, "producer-inspection.json");
        const forbidConfiguration = ConfigProvider.make(() => Effect.die("Inspection read credential configuration."));
        yield* f
          .run(["producer-inspect", "--output", output])
          .pipe(Effect.provideService(ConfigProvider.ConfigProvider, forbidConfiguration));
        expect(inspect).toHaveBeenCalledWith(process.cwd());
        const pipe31 = yield* f.fs.readFileString(output).pipe(Effect.flatMap(decodeWorkflow));
        expect(pipe31).toEqual(workflow);
        expect(f.calls).toEqual([]);
        const consoleText32 = yield* consoleText;
        expect(consoleText32).not.toContain('"inspectionTools"');
        inspect.mockReturnValue(Effect.fail(CacheCommandError.new("Source drift fixture.")));
        const pipe33 = yield* f.run(["producer-inspect", "--output", output]).pipe(Effect.isFailure);
        expect(pipe33).toBe(true);
        const pipe34 = yield* f.fs.readFileString(output).pipe(Effect.flatMap(decodeWorkflow));
        expect(pipe34).toEqual(workflow);
      })
    );
    it.effect("refuses an oversized producer inspection before overwriting output", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const output = f.path.join(f.root, "bounded-inspection.json");
        yield* f.fs.writeFileString(output, "preserved");
        vi.spyOn(Workflow, "inspectCacheProducerWorkflow").mockReturnValue(
          Effect.succeed(
            CacheProducerWorkflow.make({
              ...workflow,
              files: [
                CacheProducerWorkflowFile.make({
                  ...A.getUnsafe(workflow.files, 0),
                  path: Str.repeat(4 * 1024 * 1024)("x"),
                }),
              ],
            })
          )
        );
        const pipe35 = yield* f.run(["producer-inspect", "--output", output]).pipe(Effect.isFailure);
        expect(pipe35).toBe(true);
        const readFileString36 = yield* f.fs.readFileString(output);
        expect(readFileString36).toBe("preserved");
        const errorText37 = yield* errorText;
        expect(errorText37).toContain("exceeds its configured byte bound");
      })
    );
    it.effect("requires independent producer configuration without dispatching an experiment", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const pipe38 = yield* f
          .run(["producer-run", "--request", f.requests.baseline])
          .pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({})), Effect.isFailure);
        expect(pipe38).toBe(true);
        const errorText39 = yield* errorText;
        expect(errorText39).toContain("An independently provisioned producer store is required.");
        expect(f.calls).toEqual([]);
      })
    );
    it.effect.each([false, true])("writes only the owned producer result with hosted publication %s", (publish) =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const binding = yield* decodeProducerBinding({
          ...pilot,
          protocolClient: protocol.observation.client,
          workflowRevision: Str.repeat(40)("a"),
          workflowImplementation: digest,
          policyDigest: digest,
        });
        const runtime = CacheProducerUploadRuntime.make({
          target: targetFor({ url: "http://127.0.0.1:19427/" }),
          bearers,
          signing: Redacted.make("synthetic-dispatch-key"),
          adapter: O.none(),
        });
        const observation = CacheProducerObservation.make({
          observation: yield* S.decodeUnknownEffect(CacheProducerBundle)({
            ...bundleInput,
            upload: {
              taskHash: "0123456789abcdef",
              archiveSha256: digest,
              archiveBytes: 128,
              status: 202,
              backendResult: "allowed",
            },
          }),
          envelope: CacheProducerEnvelope.make({
            body: CacheProducerBody.make({
              issuer: digest,
              binding,
              payloadSha256: digest,
              issuedAtMs: 1,
              expiresAtMs: 60_001,
            }),
            mac: digest,
          }),
        });
        const selected = CacheSignedPilotRequest.make({
          sourceRoot: f.root,
          pilot: CachePilotRequest.make({
            channel: binding.channel,
            client: binding.client,
            executable: "/fixture/turbo",
            biomeExecutable: "/fixture/biome",
            nodeExecutable: "/fixture/node",
            dependencies: reference,
            activation: reference,
            worktrees: [f.root, f.path.dirname(f.root)],
            selection: "full",
          }),
        });
        const request = f.path.join(f.root, "producer-request.json");
        const output = f.path.join(f.root, "private-observation.json");
        const publication = f.path.join(f.root, "cache-producer.json");
        const encodedSignedPilotRequest = yield* encodeSignedPilotRequest(selected);
        yield* f.fs.writeFileString(request, encodedSignedPilotRequest);
        const load = vi
          .spyOn(Workflow, "loadCacheProducerExecutionRuntime")
          .mockReturnValue(Effect.succeed(Tuple.make(binding, runtime)));
        const run = vi.spyOn(Workflow, "runCacheProducerWorkflow").mockReturnValue(Effect.succeed(observation));
        const execute = f
          .run([
            "producer-run",
            "--request",
            request,
            "--output",
            output,
            ...(publish ? ["--publication", publication] : []),
          ])
          .pipe(
            Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromUnknown({
                BEEP_CACHE_PRODUCER_STORE: "/trusted/producer",
                ...(publish ? { GITHUB_RUN_ID: "11", GITHUB_RUN_ATTEMPT: "2" } : {}),
              })
            )
          );
        yield* execute;
        expect(load).toHaveBeenCalledWith("/trusted/producer");
        deepStrictEqual(run.mock.calls, [[process.cwd(), selected, "/trusted/producer", binding, O.some(runtime)]]);
        const contents = yield* f.fs.readFileString(output);
        const decodedProducerObservation = yield* decodeProducerObservation(contents);
        expect(decodedProducerObservation).toEqual(observation);
        expect((yield* f.fs.stat(output)).mode & 0o777).toBe(0o600);
        const exists40 = yield* f.fs.exists(publication);
        expect(exists40).toBe(publish);
        if (publish) {
          const report = yield* f.fs.readFileString(publication).pipe(Effect.flatMap(decodeCompleteReport));
          expect(report.runId).toBe(11);
          expect(report.attempt).toBe(2);
          expect(report.binding).toEqual(binding);
          expect(report.uploads).toEqual(O.toArray(observation.observation.upload));
          const expectation = expect(report.observationSha256);
          const value1 = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(Str.trimEnd(contents)));
          expectation.toBe(value1);
          expect((yield* f.fs.stat(publication)).mode & 0o777).toBe(0o600);
          const transported = CacheProducerPublication.make({
            reference: CacheHostedProducerReference.make({ runId: 11, attempt: 2, artifactId: 111 }),
            archive: new Uint8Array(1024 * 1024),
          });
          const encodedImport = yield* encodeProducerImport(
            CacheProducerImportRequest.make({
              observations: { stable: observation, canary: observation },
              publications: O.some({ stable: transported, canary: transported }),
            })
          );
          const channelJson = Str.trimEnd(contents);
          const channelBytes = new TextEncoder().encode(channelJson).byteLength;
          expect(channelBytes).toBeLessThan(8 * 1024 * 1024);
          const paddedChannel = Str.concat(channelJson, Str.repeat(8 * 1024 * 1024 - channelBytes)(" "));
          const composed = Str.replaceAll(channelJson, paddedChannel)(encodedImport);
          const composedBytes = new TextEncoder().encode(composed).byteLength;
          expect(composedBytes).toBeGreaterThan(18 * 1024 * 1024);
          expect(composedBytes).toBeLessThan(20 * 1024 * 1024);
          const importFile = f.path.join(f.root, "complete-import.json");
          yield* f.fs.writeFileString(importFile, composed);
          const configure = vi
            .spyOn(AcceptanceStore, "loadCacheProducerStoreConfiguration")
            .mockReturnValue(Effect.fail(CacheCommandError.new("Complete bounded pair decoded before trust lookup.")));
          const pipe41 = yield* f.run(["accept", "--request", importFile]).pipe(Effect.isFailure);
          expect(pipe41).toBe(true);
          expect(configure).toHaveBeenCalledTimes(1);
          const errorText42 = yield* errorText;
          expect(errorText42).toContain("Complete bounded pair decoded before trust lookup.");
          configure.mockClear();
          yield* f.fs.writeFileString(
            importFile,
            Str.concat(composed, Str.repeat(20 * 1024 * 1024 + 1 - composedBytes)(" "))
          );
          const pipe43 = yield* f.run(["accept", "--request", importFile]).pipe(Effect.isFailure);
          expect(pipe43).toBe(true);
          expect(configure).not.toHaveBeenCalled();
        }
        yield* f.fs.writeFileString(output, "preserved observation");
        const pipe44 = yield* execute.pipe(Effect.isFailure);
        expect(pipe44).toBe(true);
        const readFileString45 = yield* f.fs.readFileString(output);
        expect(readFileString45).toBe("preserved observation");
        const linked = f.path.join(f.root, "preserved-linked-target.json");
        const missing = f.path.join(f.root, "missing-linked-target.json");
        yield* f.fs.writeFileString(linked, "preserved linked target");
        yield* f.fs.remove(output);
        yield* f.fs.symlink(linked, output);
        const pipe46 = yield* execute.pipe(Effect.isFailure);
        expect(pipe46).toBe(true);
        const readFileString47 = yield* f.fs.readFileString(linked);
        expect(readFileString47).toBe("preserved linked target");
        yield* f.fs.remove(output);
        yield* f.fs.symlink(missing, output);
        const pipe48 = yield* execute.pipe(Effect.isFailure);
        expect(pipe48).toBe(true);
        const exists49 = yield* f.fs.exists(missing);
        expect(exists49).toBe(false);
        yield* f.fs.remove(output);
        yield* f.fs.link(linked, output);
        const pipe50 = yield* execute.pipe(Effect.isFailure);
        expect(pipe50).toBe(true);
        const readFileString51 = yield* f.fs.readFileString(linked);
        expect(readFileString51).toBe("preserved linked target");
        yield* f.fs.remove(output);
        if (publish) {
          const published = yield* f.fs.readFileString(publication);
          const pipe52 = yield* execute.pipe(Effect.isFailure);
          expect(pipe52).toBe(true);
          const readFileString53 = yield* f.fs.readFileString(publication);
          expect(readFileString53).toBe(published);
          expect((yield* f.fs.stat(output)).mode & 0o777).toBe(0o600);
          yield* f.fs.writeFileString(output, "preserved observation");
          yield* f.fs.writeFileString(publication, "preserved publication");
          run.mockReturnValue(
            Effect.succeed(
              CacheProducerObservation.make({
                ...observation,
                observation: CacheProducerBundle.make({ ...observation.observation, upload: O.none() }),
              })
            )
          );
          const pipe54 = yield* f
            .run(["producer-run", "--request", request, "--output", output, "--publication", publication])
            .pipe(
              Effect.provideService(
                ConfigProvider.ConfigProvider,
                ConfigProvider.fromUnknown({
                  BEEP_CACHE_PRODUCER_STORE: "/trusted/producer",
                  GITHUB_RUN_ID: "11",
                  GITHUB_RUN_ATTEMPT: "2",
                })
              ),
              Effect.isFailure
            );
          expect(pipe54).toBe(true);
          const errorText55 = yield* errorText;
          expect(errorText55).toContain("Complete producer publication requires its owned upload");
          const readFileString56 = yield* f.fs.readFileString(output);
          expect(readFileString56).toBe("preserved observation");
          const readFileString57 = yield* f.fs.readFileString(publication);
          expect(readFileString57).toBe("preserved publication");
        }
        expect(f.calls).toEqual([]);
        const consoleText58 = yield* consoleText;
        expect(consoleText58).not.toContain('"observation"');
        const consoleText59 = yield* consoleText;
        expect(consoleText59).not.toContain('"uploads"');
      })
    );
    it.effect.each([
      {},
      { GITHUB_RUN_ID: "11" },
      { GITHUB_RUN_ID: "0", GITHUB_RUN_ATTEMPT: "2" },
      { GITHUB_RUN_ID: "11", GITHUB_RUN_ATTEMPT: "1.5" },
      { GITHUB_RUN_ID: "9007199254740992", GITHUB_RUN_ATTEMPT: "2" },
    ])("refuses invalid hosted run identity before capability loading: %s", (configuration) =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const load = vi.spyOn(Workflow, "loadCacheProducerExecutionRuntime");
        const output = f.path.join(f.root, "private-observation.json");
        const publication = f.path.join(f.root, "cache-producer.json");
        const pipe60 = yield* f
          .run(["producer-run", "--request", f.requests.baseline, "--output", output, "--publication", publication])
          .pipe(
            Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromUnknown({ BEEP_CACHE_PRODUCER_STORE: "/trusted/producer", ...configuration })
            ),
            Effect.isFailure
          );
        expect(pipe60).toBe(true);
        expect(load).not.toHaveBeenCalled();
        const exists61 = yield* f.fs.exists(output);
        expect(exists61).toBe(false);
        const exists62 = yield* f.fs.exists(publication);
        expect(exists62).toBe(false);
        const errorText63 = yield* errorText;
        expect(errorText63).toContain("requires valid GITHUB_RUN_ID and GITHUB_RUN_ATTEMPT");
      })
    );
    it.effect.each(["missing-output", "same-path", "wrong-member"])(
      "refuses unsafe publication output layout before configuration: %s",
      (layout) =>
        Effect.gen(function* () {
          const f = yield* fixture();
          const publication = f.path.join(f.root, layout === "wrong-member" ? "report.json" : "cache-producer.json");
          const output = layout === "same-path" ? publication : f.path.join(f.root, "observation.json");
          const forbidConfiguration = ConfigProvider.make(() =>
            Effect.die("Read configuration before layout refusal.")
          );
          const pipe64 = yield* f
            .run([
              "producer-run",
              "--request",
              f.requests.baseline,
              ...(layout === "missing-output" ? [] : ["--output", output]),
              "--publication",
              publication,
            ])
            .pipe(Effect.provideService(ConfigProvider.ConfigProvider, forbidConfiguration), Effect.isFailure);
          expect(pipe64).toBe(true);
          const errorText65 = yield* errorText;
          expect(errorText65).toContain("requires --output and a distinct cache-producer.json path");
          expect(f.calls).toEqual([]);
        })
    );
    it.effect("requires separate trusted provisioning configuration without loading an experiment", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const pipe66 = yield* f
          .run(["producer-provision"])
          .pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({})), Effect.isFailure);
        expect(pipe66).toBe(true);
        const errorText67 = yield* errorText;
        expect(errorText67).toContain("Independently selected provisioning inputs and producer store are required.");
        expect(f.calls).toEqual([]);
      })
    );
    it.effect("uses only the two closed provisioning locations and no runtime capability configuration", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const [approval, profile] = yield* producerProvisioning();
        const read = vi
          .spyOn(Producer, "readCacheProducerProvisioning")
          .mockReturnValue(Effect.succeed(Tuple.make(approval, profile, O.none())));
        const initialize = vi.spyOn(Workflow, "initializeCacheProducerExecution").mockReturnValue(Effect.void);
        yield* f.run(["producer-provision"]).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromUnknown({
              BEEP_CACHE_PRODUCER_PROVISIONING: "/trusted/inputs",
              BEEP_CACHE_PRODUCER_STORE: "/trusted/store",
            })
          )
        );
        expect(read).toHaveBeenCalledWith("/trusted/inputs", process.cwd());
        deepStrictEqual(initialize.mock.calls, [[process.cwd(), "/trusted/store", approval, profile, O.none()]]);
        const pipe68 = yield* f.run(["producer-install"]).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromUnknown({
              BEEP_CACHE_PRODUCER_PROVISIONING: "/trusted/inputs",
              BEEP_CACHE_PRODUCER_STORE: "/trusted/store",
            })
          ),
          Effect.isFailure
        );
        expect(pipe68).toBe(true);
        expect(initialize).toHaveBeenCalledTimes(1);
        const errorText69 = yield* errorText;
        expect(errorText69).toContain("requires independently transferred issuer material");
        const material = O.some(Redacted.make(new Uint8Array(96)));
        read.mockReturnValue(Effect.succeed(Tuple.make(approval, profile, material)));
        yield* f.run(["producer-install"]).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromUnknown({
              BEEP_CACHE_PRODUCER_PROVISIONING: "/trusted/inputs",
              BEEP_CACHE_PRODUCER_STORE: "/trusted/store",
            })
          )
        );
        expect(initialize).toHaveBeenLastCalledWith(process.cwd(), "/trusted/store", approval, profile, material);
        expect(f.calls).toEqual([]);
        const consoleText70 = yield* consoleText;
        expect(consoleText70).toContain("provisioned from independent approval");
        const consoleText71 = yield* consoleText;
        expect(consoleText71).not.toContain("/trusted");
      })
    );
    it.effect("installs protected environment records through the existing initializer without reading files", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const [approval, profile] = yield* producerProvisioning();
        const read = vi.spyOn(Producer, "readCacheProducerProvisioning");
        const initialize = vi.spyOn(Workflow, "initializeCacheProducerExecution").mockReturnValue(Effect.void);
        const bytes = new Uint8Array(96);
        yield* f.run(["producer-install", "--from-environment"]).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromUnknown({
              BEEP_CACHE_PRODUCER_STORE: "/trusted/store",
              BEEP_CACHE_PRODUCER_APPROVAL_JSON: yield* encodeProducerApproval(approval),
              BEEP_CACHE_PRODUCER_RUNTIME_JSON: yield* encodeProducerExecutionProfile(profile),
              BEEP_CACHE_PRODUCER_ISSUER_MATERIAL_BASE64: yield* encodeProducerMaterial(bytes),
            })
          )
        );
        const installed = yield* A.last(initialize.mock.calls).pipe(
          Effect.fromOption(() => CacheCommandError.new("Expected the existing producer initializer."))
        );
        deepStrictEqual(A.take(installed, 4), [process.cwd(), "/trusted/store", approval, profile]);
        const material = yield* O.fromUndefinedOr(installed[4]).pipe(
          O.flatten,
          Effect.fromOption(() => CacheCommandError.new("Expected transferred issuer material."))
        );
        deepStrictEqual(Redacted.value(material), bytes);
        expect(read).not.toHaveBeenCalled();
        expect(f.calls).toEqual([]);
        const consoleText72 = yield* consoleText;
        expect(consoleText72).not.toContain("/trusted");
        const consoleText73 = yield* consoleText;
        expect(consoleText73).not.toContain("issuerMaterial");
      })
    );
    it.effect("keeps environment installation opt-in and unavailable to issuer provisioning", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const initialize = vi.spyOn(Workflow, "initializeCacheProducerExecution");
        const read = vi.spyOn(Producer, "readCacheProducerProvisioning");
        const configuration = ConfigProvider.fromUnknown({
          BEEP_CACHE_PRODUCER_STORE: "/trusted/store",
          BEEP_CACHE_PRODUCER_APPROVAL_JSON: "private-unused-approval",
          BEEP_CACHE_PRODUCER_RUNTIME_JSON: "private-unused-runtime",
          BEEP_CACHE_PRODUCER_ISSUER_MATERIAL_BASE64: "private-unused-material",
        });
        yield* f
          .run(["producer-install"])
          .pipe(Effect.provideService(ConfigProvider.ConfigProvider, configuration), Effect.flip);
        const errorText74 = yield* errorText;
        expect(errorText74).toContain("Independently selected provisioning inputs and producer store are required.");
        yield* f
          .run(["producer-provision", "--from-environment"])
          .pipe(Effect.provideService(ConfigProvider.ConfigProvider, configuration), Effect.flip);
        expect(initialize).not.toHaveBeenCalled();
        expect(read).not.toHaveBeenCalled();
        expect(f.calls).toEqual([]);
        const errorText75 = yield* errorText;
        expect(errorText75).not.toContain("private-unused");
      })
    );
    it.effect.each([
      "missing-records",
      "malformed-approval",
      "oversized-approval",
      "malformed-runtime",
      "oversized-runtime",
      "unicode-byte-bound",
      "mismatched-approval",
      "schema-validation-error",
      "missing-material",
      "short-material",
      "long-material",
      "invalid-base64",
    ])("refuses invalid protected environment input before installation: %s", (testCase) =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const [approval, profile] = yield* producerProvisioning();
        const marker = `private-input-sentinel-${testCase}`;
        const records = {
          BEEP_CACHE_PRODUCER_STORE: "/trusted/store",
          BEEP_CACHE_PRODUCER_APPROVAL_JSON: yield* encodeProducerApproval(approval),
          BEEP_CACHE_PRODUCER_RUNTIME_JSON: yield* encodeProducerExecutionProfile(profile),
        };
        const material = yield* encodeProducerMaterial(new Uint8Array(96));
        const short = yield* encodeProducerMaterial(new Uint8Array(95));
        const long = yield* encodeProducerMaterial(new Uint8Array(97));
        const mismatched = yield* encodeProducerApproval(
          CacheProducerApproval.make({
            ...approval,
            binding: CacheProducerBinding.make({
              ...approval.binding,
              policyDigest: Sha256Hex.make(Str.repeat(64)("b")),
            }),
          })
        );
        const complete = { ...records, BEEP_CACHE_PRODUCER_ISSUER_MATERIAL_BASE64: material };
        const [configuration, diagnostic] = Match.value(testCase).pipe(
          Match.when("missing-records", () =>
            Tuple.make(
              { BEEP_CACHE_PRODUCER_STORE: "/trusted/store" },
              "Independent producer approval and runtime records are required."
            )
          ),
          Match.when("malformed-approval", () =>
            Tuple.make(
              { ...records, BEEP_CACHE_PRODUCER_APPROVAL_JSON: marker },
              "Producer environment approval is invalid."
            )
          ),
          Match.when("oversized-approval", () =>
            Tuple.make(
              {
                ...records,
                BEEP_CACHE_PRODUCER_APPROVAL_JSON: records.BEEP_CACHE_PRODUCER_APPROVAL_JSON + Str.repeat(16385)(" "),
              },
              "Producer environment records exceed their sixteen KiB bound."
            )
          ),
          Match.when("malformed-runtime", () =>
            Tuple.make(
              { ...records, BEEP_CACHE_PRODUCER_RUNTIME_JSON: marker },
              "Producer environment runtime profile is invalid."
            )
          ),
          Match.when("oversized-runtime", () =>
            Tuple.make(
              {
                ...records,
                BEEP_CACHE_PRODUCER_RUNTIME_JSON: records.BEEP_CACHE_PRODUCER_RUNTIME_JSON + Str.repeat(16385)(" "),
              },
              "Producer environment records exceed their sixteen KiB bound."
            )
          ),
          Match.when("unicode-byte-bound", () =>
            Tuple.make(
              { ...records, BEEP_CACHE_PRODUCER_APPROVAL_JSON: Str.repeat(8193)("é") },
              "Producer environment records exceed their sixteen KiB bound."
            )
          ),
          Match.when("mismatched-approval", () =>
            Tuple.make(
              { ...records, BEEP_CACHE_PRODUCER_APPROVAL_JSON: mismatched },
              "Producer approval's full policy differs from its fixed binding."
            )
          ),
          Match.when("schema-validation-error", () => Tuple.make(records, "Producer environment approval is invalid.")),
          Match.when("missing-material", () =>
            Tuple.make(records, "Independently transferred producer issuer material is required.")
          ),
          Match.when("short-material", () =>
            Tuple.make(
              { ...records, BEEP_CACHE_PRODUCER_ISSUER_MATERIAL_BASE64: short },
              "Producer issuer transport must encode exactly ninety-six bytes."
            )
          ),
          Match.when("long-material", () =>
            Tuple.make(
              { ...records, BEEP_CACHE_PRODUCER_ISSUER_MATERIAL_BASE64: long },
              "Producer issuer transport exceeds its fixed encoded bound."
            )
          ),
          Match.orElse(() =>
            Tuple.make(
              { ...complete, BEEP_CACHE_PRODUCER_ISSUER_MATERIAL_BASE64: marker },
              "Producer issuer transport must encode exactly ninety-six bytes."
            )
          )
        );
        const initialize = vi.spyOn(Workflow, "initializeCacheProducerExecution");
        const read = vi.spyOn(Producer, "readCacheProducerProvisioning");
        if (testCase === "schema-validation-error") {
          const failure = yield* decodeProducerBinding(marker).pipe(Effect.flip);
          vi.spyOn(Producer, "validateCacheProducerApproval").mockReturnValue(Effect.fail(failure));
        }
        yield* f
          .run(["producer-install", "--from-environment"])
          .pipe(
            Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(configuration)),
            Effect.flip
          );
        expect(initialize).not.toHaveBeenCalled();
        expect(read).not.toHaveBeenCalled();
        expect(f.calls).toEqual([]);
        const consoleText76 = yield* consoleText;
        expect(consoleText76).not.toContain(marker);
        const errorText77 = yield* errorText;
        expect(errorText77).not.toContain(marker);
        const errorText78 = yield* errorText;
        expect(errorText78).toContain(diagnostic);
      })
    );
    it.effect.each(["--request", "--store", "--approval", "--runtime", "--target", "--signing-key"])(
      "refuses caller-selected provisioning authority through %s",
      (flag) =>
        Effect.gen(function* () {
          const f = yield* fixture();
          const forbidConfiguration = ConfigProvider.make(() =>
            Effect.die("Provisioning configuration read before argument refusal.")
          );
          const pipe79 = yield* f
            .run(["producer-provision", flag, "/untrusted-input"])
            .pipe(Effect.provideService(ConfigProvider.ConfigProvider, forbidConfiguration), Effect.isFailure);
          expect(pipe79).toBe(true);
          expect(f.calls).toEqual([]);
        })
    );
    it.effect.each([
      "--store",
      "--issuer",
      "--target",
      "--signing-key",
      "--run-id",
      "--attempt",
      "--artifact-id",
      "--upload",
    ])("refuses request-side producer authority selection through %s", (flag) =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const forbidConfiguration = ConfigProvider.make(() =>
          Effect.die("Producer configuration was read before invalid arguments were rejected.")
        );
        const pipe80 = yield* f
          .run(["producer-run", "--request", f.requests.baseline, flag, "/untrusted-selection"])
          .pipe(Effect.provideService(ConfigProvider.ConfigProvider, forbidConfiguration), Effect.isFailure);
        expect(pipe80).toBe(true);
        expect(f.calls).toEqual([]);
      })
    );
  });
});
