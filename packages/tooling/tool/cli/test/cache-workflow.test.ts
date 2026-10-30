import {
  CacheActivationPreview,
  CacheCensusDefinition,
  CacheCommandError,
  CacheComputationConfiguration,
  CacheConformanceTarget,
  CacheLinkedFile,
  CacheLiveIdentity,
  CachePilotRequest,
  CacheProducerApproval,
  CacheProducerBinding,
  CacheProducerBundle,
  CacheSignedPilotReceipt,
  CacheSignedPilotRequest,
  CacheToolchainSnapshot,
} from "@beep/repo-cli/commands/Cache";
import * as Adapter from "@beep/repo-cli/commands/Cache/Cache.adapter";
import * as Fingerprint from "@beep/repo-cli/commands/Cache/Cache.fingerprint";
import * as Linker from "@beep/repo-cli/commands/Cache/Cache.linker";
import * as SignedRunner from "@beep/repo-cli/commands/Cache/Cache.pilot.runner";
import * as ProtocolRunner from "@beep/repo-cli/commands/Cache/Cache.protocol.runner";
import {
  assertCacheProducerWorkflowLocation,
  assertCacheProducerWorkflowProfile,
  CacheAdapterRuntimeObservation,
  CacheHostedProducerUpload,
  CacheProducerAdapterLaunch,
  CacheProducerAdapterReceipt,
  CacheProducerUploadApproval,
  CacheProducerUploadRuntime,
  CacheProducerExecutionProfile,
  CacheProducerWorkflow,
  CacheRuntimeAdmission,
  collectCacheProducerWorkflowFiles,
  hashCacheProducerContract,
  hashCacheProducerUploadKey,
  hashCacheProducerUploadTarget,
  hashCacheProducerWorkflow,
  initializeCacheProducerExecution,
  initializeCacheProducerIssuer,
  inspectCacheProducerWorkflow,
  openCacheProducerVerifier,
  readCacheProducerExecutionProfile,
  runCacheProducerWorkflow,
  CacheRuntimeProcess as StepExec,
} from "@beep/repo-cli/test/Cache";
import { MemoryStats } from "@beep/repo-cli/test/RepoRun";
import { JsonStringCodec } from "@beep/repo-cli/test/SharedInternals";
import { CacheClientPin, CacheEvidenceReference, CacheTaskContract } from "@beep/repo-configs/cache";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { GitObjectId } from "@beep/schema/Conformance";
import { fcRuns } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { afterEach, expect, it, vi } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { bearers, targetFor } from "./cache-conformance-server.ts";
import { input as bundleInput, contractInput } from "./helpers/cache-producer-bundle-fixture.ts";

afterEach(() => vi.restoreAllMocks());
const activationJson = JsonStringCodec(CacheActivationPreview);

const fixture = Effect.fn("WorkflowTest.fixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const parent = yield* fs.makeTempDirectoryScoped({ prefix: "cache-workflow-" });
  const root = path.join(parent, "checkout");
  yield* fs.makeDirectory(root);
  const git = Effect.fn("WorkflowTest.git")(function* (args: ReadonlyArray<string>) {
    const result = yield* StepExec.runCaptured({
      command: "/usr/bin/git",
      args,
      cwd: root,
      extendEnv: false,
      env: { PATH: "/usr/bin", HOME: root, GIT_CONFIG_NOSYSTEM: "1" },
      source: "all",
    });
    expect(result.exitCode).toBe(0);
  });
  yield* git(["init", "--template=", "."]);
  yield* fs.makeDirectory(path.join(root, "packages/fixture/src"), { recursive: true });
  const source = path.join(root, "packages/fixture/src/main.ts");
  yield* fs.writeFileString(source, "export const value = 1;\n");
  yield* fs.writeFileString(path.join(root, ".gitignore"), "ignored.ts\nnode_modules/\n");
  yield* git(["add", "."]);
  yield* git([
    "-c",
    "user.name=Workflow Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-qm",
    "fixture sources",
  ]);
  return { root, fs, path, source, git };
});
const encodeExecutionProfile = S.encodeEffect(S.fromJsonString(CacheProducerExecutionProfile));
const inspectedFixture = Effect.fn("WorkflowTest.inspectedFixture")(function* () {
  const base = yield* fixture();
  const bundle = yield* S.decodeUnknownEffect(CacheProducerBundle)(bundleInput);
  const pilot = bundle.pilot;
  const toolchain = CacheToolchainSnapshot.make({
    profile: "local-linux-x64-bun1.4.2",
    kernel: "fixture",
    libc: "fixture",
    bun: { ...pilot.bun, version: "1.4.2" },
    node: pilot.node,
    biome: pilot.biome,
    turbo: pilot.client,
    sources: [],
  });
  const tools = vi.spyOn(Fingerprint, "collectCacheToolchain").mockReturnValue(Effect.succeed(toolchain));
  vi.spyOn(Linker, "inspectCacheLinkedFile").mockImplementation((file) =>
    Effect.succeed(CacheLinkedFile.make({ path: file, target: file, sha256: pilot.configurationDigest }))
  );
  const workflow = yield* inspectCacheProducerWorkflow(base.root);
  return { ...base, bundle, toolchain, tools, workflow };
});

const supervisedFixture = Effect.fn("WorkflowTest.supervisedFixture")(function* (
  withUpload: typeof S.Boolean.Type = false
) {
  const base = yield* inspectedFixture();
  const { root, path, fs, bundle: inspectedBundle, workflow } = base;
  const bundle = CacheProducerBundle.make({
    ...inspectedBundle,
    pilot: CacheSignedPilotReceipt.make({
      ...inspectedBundle.pilot,
      sourceRevision: workflow.revision,
      client: CacheClientPin.make({
        ...inspectedBundle.pilot.client,
        namespace: withUpload ? "team_beep_signed_canary_v1" : inspectedBundle.pilot.client.namespace,
      }),
    }),
  });
  const contract = yield* S.decodeUnknownEffect(CacheTaskContract)({
    ...contractInput,
    clients: { ...contractInput.clients, stable: bundle.pilot.client },
  });
  let binding = yield* S.decodeUnknownEffect(CacheProducerBinding)({
    ...bundleInput.pilot,
    client: bundle.pilot.client,
    sourceRevision: workflow.revision,
    protocolClient: bundle.protocol.observation.client,
    workflowRevision: workflow.revision,
    workflowImplementation: yield* hashCacheProducerWorkflow(workflow),
    policyDigest: yield* hashCacheProducerContract(contract),
  });
  let runtime: O.Option<CacheProducerUploadRuntime> = O.none();
  if (withUpload) {
    const target = CacheConformanceTarget.make({
      ...targetFor({ url: "http://127.0.0.1:19427/" }),
      namespace: { teamId: binding.client.namespace, foreignTeamId: "team_foreign_workflow_test" },
      backend: { id: "fixture-adapter", release: "fixture", digest: Str.repeat(64)("d") },
      storage: O.some({
        endpoint: yield* S.decodeEffect(S.URLFromString)(`https://${Str.repeat(32)("0")}.r2.cloudflarestorage.com/`),
        bucket: "beep-turbo-r2-pilot",
      }),
    });
    const supplied = CacheProducerUploadRuntime.make({
      target,
      bearers,
      signing: Redacted.make("synthetic-workflow-artifact-key"),
      adapter: O.some(
        CacheProducerAdapterLaunch.make({
          executable: "/fixture/adapter",
          accessKey: Redacted.make("synthetic-storage-id"),
          secretKey: Redacted.make("synthetic-storage-secret"),
        })
      ),
    });
    runtime = O.some(supplied);
    binding = CacheProducerBinding.make({
      ...binding,
      uploadApproval: O.some(
        CacheProducerUploadApproval.make({
          targetSha256: yield* hashCacheProducerUploadTarget(target),
          artifactKeySha256: yield* hashCacheProducerUploadKey(supplied.signing),
        })
      ),
    });
  }
  const directory = path.join(path.dirname(root), "issuer");
  yield* initializeCacheProducerIssuer(directory, binding, contract);
  const reference = CacheEvidenceReference.make({ path: "fixture.json", sha256: bundle.pilot.configurationDigest });
  let activation = reference;
  if (withUpload) {
    const source = CacheLiveIdentity.make({
      key: bundle.pilot.baseKey,
      configuration: CacheComputationConfiguration.make({
        computation: binding.key.computation,
        globalConfiguration: {},
        nodes: [
          CacheCensusDefinition.make({
            id: binding.key.computation,
            command: O.some("bun run beep:lint"),
            commandDigest: binding.configurationDigest,
            dependencies: [],
            configuration: contract.configuration,
          }),
        ],
        sources: [],
      }),
      configurationDigest: binding.configurationDigest,
      toolchain: base.toolchain,
      toolchainDigest: binding.toolchainDigest,
    });
    const text = yield* activationJson.encode(
      CacheActivationPreview.make({ source, target: source, activation: O.getOrThrow(contract.activation) })
    );
    yield* fs.writeFileString(path.join(root, "activation.json"), text);
    activation = CacheEvidenceReference.make({
      path: "activation.json",
      sha256: yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(text)),
    });
  }
  const request = CacheSignedPilotRequest.make({
    sourceRoot: root,
    pilot: CachePilotRequest.make({
      channel: binding.channel,
      client: binding.client,
      executable: "/fixture/turbo",
      biomeExecutable: "/fixture/biome",
      nodeExecutable: "/fixture/node",
      dependencies: reference,
      activation,
      worktrees: [root, path.dirname(root)],
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
  const signed = vi.spyOn(SignedRunner, "runCacheSignedPilotExperiment").mockReturnValue(Effect.succeed(bundle.pilot));
  const protocol = vi
    .spyOn(ProtocolRunner, "runCacheProtocolExperiment")
    .mockReturnValue(Effect.succeed(bundle.protocol));
  const observedFs: FileSystem.FileSystem = {
    ...fs,
    // The real loaded-location rejection is covered separately; this scoped
    // mapping lets a temporary Git fixture exercise the complete issuer flow.
    realPath: (file) =>
      Str.endsWith("/Cache.workflow.ts")(file)
        ? Effect.succeed(path.join(root, "packages/tooling/tool/cli/src/commands/Cache/Cache.workflow.ts"))
        : fs.realPath(file),
  };
  const run = runCacheProducerWorkflow(root, request, directory, binding, runtime).pipe(
    Effect.provideService(FileSystem.FileSystem, observedFs)
  );
  return { ...base, bundle, directory, binding, contract, request, signed, protocol, admission, runtime, run, observedFs };
});

const provisioningFixture = Effect.fn("WorkflowTest.provisioningFixture")(function* () {
  const state = yield* supervisedFixture();
  const baseTarget = targetFor({ url: "http://127.0.0.1:19427/" });
  const target = CacheConformanceTarget.make({
    ...baseTarget,
    backend: { ...baseTarget.backend, digest: state.bundle.pilot.configurationDigest },
  });
  const profile = CacheProducerExecutionProfile.make({ target, adapterExecutable: "/fixture/owned-adapter" });
  const binding = CacheProducerBinding.make({
    ...state.binding,
    uploadApproval: O.some(
      CacheProducerUploadApproval.make({
        targetSha256: yield* hashCacheProducerUploadTarget(target),
        artifactKeySha256: Sha256Hex.make(Str.repeat(64)("c")),
      })
    ),
  });
  const approval = CacheProducerApproval.make({ binding, contract: state.contract });
  vi.spyOn(Linker, "inspectCacheLinkedFile").mockImplementation((file) =>
    Effect.succeed(
      CacheLinkedFile.make({
        path: file,
        target: file,
        sha256: state.bundle.pilot.configurationDigest,
      })
    )
  );
  const destination = state.path.join(state.path.dirname(state.directory), "execution-store");
  const provision = (approved = approval, selected = profile, directory = destination) =>
    initializeCacheProducerExecution(state.root, directory, approved, selected).pipe(
      Effect.provideService(FileSystem.FileSystem, state.observedFs)
    );
  return { ...state, approval, profile, destination, provision };
});

it.layer(
  Layer.mergeAll(
    NodeCrypto.layer,
    NodeServices.layer,
    FetchHttpClient.layer,
    FsUtilsLive.pipe(Layer.provide(NodeServices.layer)),
    Layer.succeed(MemoryStats, MemoryStats.of({ availableGib: Effect.succeed(64), totalGib: Effect.succeed(64) }))
  ),
  { timeout: "30 seconds" }
)("producer workflow source identity", (it) => {
  it.effect("provisions private execution once and preserves existing material on a second attempt", () =>
    Effect.gen(function* () {
      const f = yield* provisioningFixture();
      yield* f.provision();
      const [binding, profile] = yield* readCacheProducerExecutionProfile(f.destination);
      expect(binding).toEqual(f.approval.binding);
      expect(profile).toEqual(f.profile);
      for (const name of ["approval.json", "issuer.key", "runtime.json"])
        expect((yield* f.fs.stat(f.path.join(f.destination, name))).mode & 0o777).toBe(0o600);
      const key = f.path.join(f.destination, "issuer.key");
      const material = yield* f.fs.readFile(key);
      expect(yield* f.provision().pipe(Effect.isFailure)).toBe(true);
      expect(yield* f.fs.readFile(key)).toEqual(material);
    })
  );
  it.effect("installs the separately approved issuer into execution without replacing its material", () =>
    Effect.gen(function* () {
      const f = yield* provisioningFixture();
      const approvedStore = f.path.join(f.path.dirname(f.directory), "approved-issuer");
      yield* initializeCacheProducerIssuer(approvedStore, f.approval.binding, f.contract);
      const original = yield* f.fs.readFile(f.path.join(approvedStore, "issuer.key"));
      yield* initializeCacheProducerExecution(
        f.root,
        f.destination,
        f.approval,
        f.profile,
        O.some(Redacted.make(original))
      ).pipe(Effect.provideService(FileSystem.FileSystem, f.observedFs));
      expect(yield* f.fs.readFile(f.path.join(f.destination, "issuer.key"))).toEqual(original);
      const [binding, profile] = yield* readCacheProducerExecutionProfile(f.destination);
      expect(binding).toEqual(f.approval.binding);
      expect(profile).toEqual(f.profile);
    })
  );
  it.effect("refuses a different loaded checkout before reserving an execution store", () =>
    Effect.gen(function* () {
      const f = yield* provisioningFixture();
      expect(
        yield* initializeCacheProducerExecution(f.root, f.destination, f.approval, f.profile).pipe(Effect.isFailure)
      ).toBe(true);
      expect(yield* f.fs.exists(f.destination)).toBe(false);
    })
  );
  it.effect("refuses relative and source-visible execution stores before creating material", () =>
    Effect.gen(function* () {
      const f = yield* provisioningFixture();
      for (const directory of ["relative-store", f.root, f.path.join(f.root, "private-store")])
        expect(yield* f.provision(f.approval, f.profile, directory).pipe(Effect.isFailure)).toBe(true);
      expect(yield* f.fs.exists(f.path.join(f.root, "private-store"))).toBe(false);
    })
  );
  it.effect("refuses oversized approval and runtime records before reserving a store", () =>
    Effect.gen(function* () {
      const f = yield* provisioningFixture();
      const contract = CacheTaskContract.make({ ...f.contract, negativeCases: [Str.repeat(16385)("x")] });
      const oversizedApproval = CacheProducerApproval.make({ ...f.approval, contract });
      const oversizedProfile = CacheProducerExecutionProfile.make({
        ...f.profile,
        adapterExecutable: `/${Str.repeat(16385)("x")}`,
      });
      expect(yield* f.provision(oversizedApproval).pipe(Effect.isFailure)).toBe(true);
      expect(yield* f.provision(f.approval, oversizedProfile).pipe(Effect.isFailure)).toBe(true);
      expect(yield* f.fs.exists(f.destination)).toBe(false);
    })
  );
  it.effect("refuses absent upload approval, target drift and relative or changed executable selection", () =>
    Effect.gen(function* () {
      const f = yield* provisioningFixture();
      const absent = CacheProducerApproval.make({
        ...f.approval,
        binding: CacheProducerBinding.make({ ...f.approval.binding, uploadApproval: O.none() }),
      });
      expect(yield* f.provision(absent).pipe(Effect.isFailure)).toBe(true);
      const changed = CacheProducerExecutionProfile.make({
        ...f.profile,
        target: CacheConformanceTarget.make({
          ...targetFor({ url: "http://127.0.0.1:19428/" }),
          backend: f.profile.target.backend,
        }),
      });
      expect(yield* f.provision(f.approval, changed).pipe(Effect.isFailure)).toBe(true);
      const linker = vi.spyOn(Linker, "inspectCacheLinkedFile");
      linker.mockClear();
      expect(
        yield* f
          .provision(f.approval, CacheProducerExecutionProfile.make({ ...f.profile, adapterExecutable: "relative" }))
          .pipe(Effect.isFailure)
      ).toBe(true);
      expect(linker).not.toHaveBeenCalled();
      linker.mockImplementation((file) =>
        Effect.succeed(
          CacheLinkedFile.make({
            path: file,
            target: file,
            sha256:
              file === f.profile.adapterExecutable
                ? Sha256Hex.make(Str.repeat(64)("e"))
                : f.bundle.pilot.configurationDigest,
          })
        )
      );
      expect(yield* f.provision().pipe(Effect.isFailure)).toBe(true);
      expect(yield* f.fs.exists(f.destination)).toBe(false);
    })
  );
  it.effect("refuses stale workflow revision and source identity before reserving a store", () =>
    Effect.gen(function* () {
      const f = yield* provisioningFixture();
      for (const binding of [
        CacheProducerBinding.make({ ...f.approval.binding, workflowRevision: GitObjectId.make(Str.repeat(40)("e")) }),
        CacheProducerBinding.make({
          ...f.approval.binding,
          workflowImplementation: Sha256Hex.make(Str.repeat(64)("e")),
        }),
      ])
        expect(yield* f.provision(CacheProducerApproval.make({ ...f.approval, binding })).pipe(Effect.isFailure)).toBe(
          true
        );
      expect(yield* f.fs.exists(f.destination)).toBe(false);
    })
  );
  it.effect("revokes the reserved execution store when source drifts after private installation", () =>
    Effect.gen(function* () {
      const f = yield* provisioningFixture();
      f.tools
        .mockReturnValueOnce(Effect.succeed(f.toolchain))
        .mockReturnValueOnce(
          f.fs
            .writeFileString(f.source, "export const changed = true;\n")
            .pipe(CacheCommandError.mapError("Cannot mutate workflow fixture."), Effect.as(f.toolchain))
        );
      expect(yield* f.provision().pipe(Effect.isFailure)).toBe(true);
      expect(yield* f.fs.exists(f.path.join(f.destination, "revoked"))).toBe(true);
      expect(yield* readCacheProducerExecutionProfile(f.destination).pipe(Effect.isFailure)).toBe(true);
    })
  );
  it.effect("revokes an interrupted private profile installation", () =>
    Effect.gen(function* () {
      const f = yield* provisioningFixture();
      const exit = yield* initializeCacheProducerExecution(f.root, f.destination, f.approval, f.profile).pipe(
        Effect.provideService(FileSystem.FileSystem, {
          ...f.observedFs,
          writeFileString: (file, body, options) =>
            file === f.path.join(f.destination, "runtime.json")
              ? Effect.interrupt
              : f.fs.writeFileString(file, body, options),
        }),
        Effect.exit
      );
      if (Exit.isFailure(exit)) expect(Cause.hasInterrupts(exit.cause)).toBe(true);
      else expect.unreachable("Interrupted installation completed successfully.");
      expect(yield* f.fs.exists(f.path.join(f.destination, "revoked"))).toBe(true);
    })
  );
  it.effect("preserves a competing runtime record and revokes the reserved store", () =>
    Effect.gen(function* () {
      const f = yield* provisioningFixture();
      const runtimeFile = f.path.join(f.destination, "runtime.json");
      const installation = initializeCacheProducerExecution(f.root, f.destination, f.approval, f.profile).pipe(
        Effect.provideService(FileSystem.FileSystem, {
          ...f.observedFs,
          writeFileString: (file, body, options) =>
            file === runtimeFile
              ? f.fs
                  .writeFileString(runtimeFile, "reserved", { flag: "wx", mode: 0o600 })
                  .pipe(Effect.andThen(f.fs.writeFileString(file, body, options)))
              : f.fs.writeFileString(file, body, options),
        })
      );
      expect(yield* installation.pipe(Effect.isFailure)).toBe(true);
      expect(yield* f.fs.readFileString(runtimeFile)).toBe("reserved");
      expect(yield* f.fs.exists(f.path.join(f.destination, "revoked"))).toBe(true);
    })
  );
  it.effect("revokes a profile whose installed permissions fail the normal reopen boundary", () =>
    Effect.gen(function* () {
      const f = yield* provisioningFixture();
      const runtimeFile = f.path.join(f.destination, "runtime.json");
      const installation = initializeCacheProducerExecution(f.root, f.destination, f.approval, f.profile).pipe(
        Effect.provideService(FileSystem.FileSystem, {
          ...f.observedFs,
          writeFileString: (file, body, options) =>
            f.fs
              .writeFileString(file, body, options)
              .pipe(Effect.andThen(file === runtimeFile ? f.fs.chmod(file, 0o644) : Effect.void)),
        })
      );
      expect(yield* installation.pipe(Effect.isFailure)).toBe(true);
      expect(yield* f.fs.exists(f.path.join(f.destination, "revoked"))).toBe(true);
    })
  );
  it.effect("revokes a valid private record changed during installation", () =>
    Effect.gen(function* () {
      const f = yield* provisioningFixture();
      const runtimeFile = f.path.join(f.destination, "runtime.json");
      const changed = yield* encodeExecutionProfile(
        CacheProducerExecutionProfile.make({ ...f.profile, adapterExecutable: "/fixture/changed-adapter" })
      );
      const installation = initializeCacheProducerExecution(f.root, f.destination, f.approval, f.profile).pipe(
        Effect.provideService(FileSystem.FileSystem, {
          ...f.observedFs,
          writeFileString: (file, body, options) =>
            f.fs.writeFileString(file, file === runtimeFile ? changed : body, options),
        })
      );
      expect(yield* installation.pipe(Effect.isFailure)).toBe(true);
      expect(yield* f.fs.exists(f.path.join(f.destination, "revoked"))).toBe(true);
    })
  );
  it.effect.prop(
    "binds every schema-generated source digest into the workflow identity",
    { sha256: Sha256Hex },
    ({ sha256 }) =>
      Effect.gen(function* () {
        const { workflow } = yield* inspectedFixture();
        const original = A.getUnsafe(workflow.files, 0);
        const changed = CacheProducerWorkflow.make({
          ...workflow,
          files: A.map(workflow.files, (file) => ({ ...file, sha256 })),
        });
        expect((yield* hashCacheProducerWorkflow(changed)) === (yield* hashCacheProducerWorkflow(workflow))).toBe(
          sha256 === original.sha256
        );
      }),
    { arbitrary: fcRuns(20) }
  );
  it.effect("binds complete inspection identity and rejects a revision changed during inspection", () =>
    Effect.gen(function* () {
      const { root, git, workflow, toolchain, tools } = yield* inspectedFixture();
      expect(workflow.inspectionTools).toHaveLength(7);
      expect(workflow.files).toHaveLength(1);
      tools.mockReturnValue(
        git([
          "-c",
          "user.name=Workflow Fixture",
          "-c",
          "user.email=fixture@example.invalid",
          "-c",
          "commit.gpgsign=false",
          "commit",
          "--allow-empty",
          "-qm",
          "changed revision",
        ]).pipe(Effect.as(toolchain), CacheCommandError.mapError("Workflow fixture revision update failed."))
      );
      const error = yield* inspectCacheProducerWorkflow(root).pipe(Effect.flip);
      expect(error.message).toContain("Workflow revision changed during inspection");
    })
  );
  it.effect("refuses an unapproved client or channel before starting either native phase", () =>
    Effect.gen(function* () {
      for (const field of ["channel", "client"]) {
        const f = yield* supervisedFixture();
        const changed =
          field === "channel"
            ? "canary"
            : CacheClientPin.make({ ...f.request.pilot.client, sha256: Sha256Hex.make(Str.repeat(64)("b")) });
        assertTrue(Reflect.set(f.request.pilot, field, changed));
        const result = yield* f.run.pipe(Effect.result);
        expect(f.signed).not.toHaveBeenCalled();
        expect(f.protocol).not.toHaveBeenCalled();
        Result.match(result, {
          onSuccess: () => expect.fail("Workflow accepted an independently unapproved request"),
          onFailure: (error) => expect(error.message).toContain("independently approved client or channel"),
        });
        vi.restoreAllMocks();
      }
    })
  );
  it.effect("snapshots the caller request before starting supervised execution", () =>
    Effect.gen(function* () {
      const f = yield* supervisedFixture();
      f.signed.mockImplementation(() =>
        Effect.sync(() => {
          assertTrue(Reflect.set(f.request, "sourceRoot", f.path.join(f.root, "unapproved-source")));
          return f.bundle.pilot;
        })
      );
      const observed = yield* f.run;
      expect(observed.observation).toEqual(f.bundle);
      expect(O.getOrThrow(A.head(f.signed.mock.calls))[1].sourceRoot).toBe(f.root);
      expect(f.request.sourceRoot).toBe(f.path.join(f.root, "unapproved-source"));
    })
  );
  it.effect("issues only the supervised bundle after all three identity checks", () =>
    Effect.gen(function* () {
      const { run, directory, bundle, signed, protocol, admission, root, path, tools } = yield* supervisedFixture();
      const result = yield* run;
      expect(result.observation).toEqual(bundle);
      expect(signed).toHaveBeenCalledOnce();
      expect(protocol).toHaveBeenCalledOnce();
      expect(admission).toHaveBeenCalledOnce();
      expect(tools).toHaveBeenCalledTimes(4);
      expect(signed.mock.calls[0]?.[0]).toBe(root);
      assertSome(
        O.fromNullishOr(A.getUnsafe(signed.mock.calls, 0)[2]).pipe(O.flatten),
        path.join(directory, "issuer.key")
      );
      const verifier = yield* openCacheProducerVerifier(directory);
      expect((yield* verifier.verify(result.envelope, result.observation)).contract.key).toEqual(bundle.pilot.key);
    })
  );
  it.effect("owns upload execution and authenticates its callback result only after adapter cleanup", () =>
    Effect.gen(function* () {
      const f = yield* supervisedFixture(true);
      const approval = O.getOrThrow(f.binding.uploadApproval);
      const upload = CacheHostedProducerUpload.make({
        taskHash: "0123456789abcdef",
        archiveSha256: f.binding.configurationDigest,
        archiveBytes: 17,
        status: 200,
      });
      const observed = CacheAdapterRuntimeObservation.make({
        role: "writer",
        phase: "ready",
        tokioNamedThreadsIncludingBlocking: 2,
        totalThreads: 6,
        memoryPeakBytes: 1024,
      });
      const receipt = CacheProducerAdapterReceipt.make({
        backendSha256: Sha256Hex.make(O.getOrThrow(f.runtime).target.backend.digest),
        targetSha256: approval.targetSha256,
        ready: { ...observed, role: "writer", phase: "ready" },
        afterLoad: { ...observed, role: "writer", phase: "after-load" },
      });
      const execution = vi
        .spyOn(SignedRunner, "runCacheProducerUploadExperiment")
        .mockReturnValue(Effect.succeed(Tuple.make(upload, receipt)));
      const result = yield* f.run;
      expect(execution).toHaveBeenCalledOnce();
      expect(execution.mock.calls[0]?.[4]).toEqual([f.binding.key.computation]);
      expect(execution.mock.calls[0]?.[5]).toBe(f.path.join(f.directory, "issuer.key"));
      assertSome(result.observation.upload, upload);
      assertSome(result.observation.adapterRuntime, receipt);
      const verifier = yield* openCacheProducerVerifier(f.directory);
      expect((yield* verifier.verify(result.envelope, result.observation)).contract.key).toEqual(f.binding.key);
    })
  );
  it.effect("refuses a changed activation before launching the upload adapter", () =>
    Effect.gen(function* () {
      const f = yield* supervisedFixture(true);
      const file = f.path.join(f.root, f.request.pilot.activation.path);
      const preview = yield* f.fs.readFileString(file).pipe(Effect.flatMap(activationJson.decode));
      const text = yield* activationJson.encode(
        CacheActivationPreview.make({
          ...preview,
          source: CacheLiveIdentity.make({
            ...preview.source,
            configurationDigest: Sha256Hex.make(Str.repeat(64)("0")),
          }),
        })
      );
      yield* f.fs.writeFileString(file, text);
      assertTrue(
        Reflect.set(
          f.request.pilot,
          "activation",
          CacheEvidenceReference.make({
            path: f.request.pilot.activation.path,
            sha256: yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(text)),
          })
        )
      );
      const execution = vi.spyOn(SignedRunner, "runCacheProducerUploadExperiment");
      const adapter = vi.spyOn(Adapter, "withCacheProducerAdapter");
      const error = yield* f.run.pipe(Effect.flip);
      expect(error.message).toContain("task closure differs from independent configuration approval");
      expect(execution).not.toHaveBeenCalled();
      expect(adapter).not.toHaveBeenCalled();
    })
  );
  it.effect("refuses changed implementation identity before execution and after each native phase", () =>
    Effect.gen(function* () {
      for (const phase of ["before", "signed", "protocol"]) {
        const { run, toolchain, tools, signed, protocol, bundle } = yield* supervisedFixture();
        const drift = Effect.sync(() =>
          tools.mockReturnValue(Effect.succeed(CacheToolchainSnapshot.make({ ...toolchain, kernel: "changed kernel" })))
        );
        yield* Match.value(phase).pipe(
          Match.when("before", () => drift),
          Match.when("signed", () => Effect.sync(() => signed.mockReturnValue(drift.pipe(Effect.as(bundle.pilot))))),
          Match.orElse(() => Effect.sync(() => protocol.mockReturnValue(drift.pipe(Effect.as(bundle.protocol)))))
        );
        const error = yield* run.pipe(Effect.flip);
        expect(error.message).toContain("differs from its independently approved identity");
        expect(signed).toHaveBeenCalledTimes(phase === "before" ? 0 : 1);
        expect(protocol).toHaveBeenCalledTimes(phase === "protocol" ? 1 : 0);
        vi.restoreAllMocks();
      }
    })
  );
  it.effect("refuses a new source revision before either supervised native phase", () =>
    Effect.gen(function* () {
      const f = yield* supervisedFixture();
      yield* f.git([
        "-c",
        "user.name=Workflow Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "--allow-empty",
        "-qm",
        "source revision changed",
      ]);
      const error = yield* f.run.pipe(Effect.flip);
      expect(error.message).toContain("Live producer source differs from its independently approved revision");
      expect(f.signed).not.toHaveBeenCalled();
      expect(f.protocol).not.toHaveBeenCalled();
    })
  );
  it.effect("binds dirty tracked bytes and newly introduced source files", () =>
    Effect.gen(function* () {
      const { root, fs, path, source } = yield* fixture();
      const original = yield* collectCacheProducerWorkflowFiles(root);
      yield* fs.writeFileString(source, "export const value = 2;\n");
      const changed = yield* collectCacheProducerWorkflowFiles(root);
      expect(changed).not.toEqual(original);
      yield* fs.writeFileString(path.join(root, "packages/fixture/src/new.ts"), "export {};\n");
      expect(A.map(yield* collectCacheProducerWorkflowFiles(root), (file) => file.path)).toEqual([
        "packages/fixture/src/main.ts",
        "packages/fixture/src/new.ts",
      ]);
    })
  );
  it.effect("preserves whitespace in Git paths instead of hashing a different file", () =>
    Effect.gen(function* () {
      const { root, fs, path } = yield* fixture();
      const relative = "packages/fixture/src/ space\nname.ts";
      yield* fs.writeFileString(path.join(root, relative), "export {};\n");
      expect(A.some(yield* collectCacheProducerWorkflowFiles(root), (file) => file.path === relative)).toBe(true);
    })
  );
  it.effect("binds source alias targets and executable permission changes", () =>
    Effect.gen(function* () {
      const { root, fs, path, source } = yield* fixture();
      const alias = path.join(root, "packages/fixture/src/alias.ts");
      yield* fs.symlink("main.ts", alias);
      const original = yield* collectCacheProducerWorkflowFiles(root);
      assertTrue(A.some(original, (file) => O.contains(file.linkTarget, "main.ts")));
      yield* fs.chmod(source, 0o700);
      expect(yield* collectCacheProducerWorkflowFiles(root)).not.toEqual(original);
    })
  );
  it.effect("rejects an alias escaping the workflow checkout", () =>
    Effect.gen(function* () {
      const { root, fs, path } = yield* fixture();
      yield* fs.writeFileString(path.join(path.dirname(root), "outside.ts"), "outside fixture bytes");
      yield* fs.symlink("../../../../outside.ts", path.join(root, "packages/fixture/src/alias.ts"));
      (yield* collectCacheProducerWorkflowFiles(root).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
    })
  );
  it.effect("rejects absolute source aliases even when the target stays inside the checkout", () =>
    Effect.gen(function* () {
      const { root, fs, path, source } = yield* fixture();
      yield* fs.symlink(source, path.join(root, "packages/fixture/src/absolute.ts"));
      const result = yield* collectCacheProducerWorkflowFiles(root).pipe(Effect.result);
      result.pipe(Result.isFailure, assertTrue);
    })
  );
  it.effect("rejects an empty source inventory instead of approving an empty workflow", () =>
    Effect.gen(function* () {
      const { root, fs, path, git } = yield* fixture();
      yield* git(["rm", "-r", "packages"]);
      yield* fs.makeDirectory(path.join(root, "packages"));
      (yield* collectCacheProducerWorkflowFiles(root).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
    })
  );
  it.effect("rejects an unreadable Git inventory instead of treating it as clean", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "cache-workflow-no-git-" });
      const files = yield* collectCacheProducerWorkflowFiles(root).pipe(Effect.result);
      files.pipe(Result.isFailure, assertTrue);
      if (Result.isFailure(files)) expect(files.failure.message).toContain("Git inventory");
      const profile = yield* assertCacheProducerWorkflowProfile(root).pipe(Effect.result);
      profile.pipe(Result.isFailure, assertTrue);
      if (Result.isFailure(profile)) expect(profile.failure.message).toContain("Git inventory");
    })
  );
  it.effect("rejects inventories above the declared source bound before reading their files", () =>
    Effect.gen(function* () {
      const { root } = yield* fixture();
      const capture = StepExec.runCapturedStreams;
      const oversized = vi.spyOn(StepExec, "runCapturedStreams").mockImplementation((request) =>
        capture(request).pipe(
          Effect.map((result) => ({
            ...result,
            stdout: pipe(
              A.range(0, 20000),
              A.map((n) => `packages/fixture/src/${n}.ts`),
              A.join("\0"),
              Str.concat("\0")
            ),
          }))
        )
      );
      const error = yield* collectCacheProducerWorkflowFiles(root).pipe(
        Effect.flip,
        Effect.ensuring(Effect.sync(() => oversized.mockRestore()))
      );
      expect(error.message).toContain("Workflow source inventory exceeded its entry bound");
    })
  );
  it.effect("rejects files introduced while the workflow inventory is being bound", () =>
    Effect.gen(function* () {
      const { root, fs, path } = yield* fixture();
      const error = yield* collectCacheProducerWorkflowFiles(root).pipe(
        Effect.provideService(FileSystem.FileSystem, {
          ...fs,
          stat: (file) =>
            fs
              .stat(file)
              .pipe(
                Effect.tap(() => fs.writeFileString(path.join(root, "packages/fixture/src/raced.ts"), "export {};\n"))
              ),
        }),
        Effect.flip
      );
      expect(error.message).toContain("Workflow source inventory changed during inspection");
    })
  );
  it.effect("rejects missing tracked sources instead of silently dropping their binding", () =>
    Effect.gen(function* () {
      const { root, fs, source } = yield* fixture();
      yield* fs.remove(source);
      (yield* collectCacheProducerWorkflowFiles(root).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
    })
  );

  it.effect("accepts committed source without hidden executable inputs", () =>
    Effect.gen(function* () {
      const { root } = yield* fixture();
      yield* assertCacheProducerWorkflowProfile(root);
    })
  );
  it.effect("rejects unstaged and staged source changes", () =>
    Effect.gen(function* () {
      const { root, fs, source, git } = yield* fixture();
      yield* fs.writeFileString(source, "export const value = 2;\n");
      (yield* assertCacheProducerWorkflowProfile(root).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
      yield* git(["add", "packages"]);
      (yield* assertCacheProducerWorkflowProfile(root).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
    })
  );
  it.effect("rejects untracked and ignored executable additions", () =>
    Effect.gen(function* () {
      const { root, fs, path } = yield* fixture();
      for (const name of ["unreviewed.ts", "ignored.ts"]) {
        const file = path.join(root, "packages/fixture/src", name);
        yield* fs.writeFileString(file, "export {};\n");
        (yield* assertCacheProducerWorkflowProfile(root).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
        yield* fs.remove(file);
      }
      yield* assertCacheProducerWorkflowProfile(root);
    })
  );
  it.effect("rejects workspace-local dependency resolution overrides", () =>
    Effect.gen(function* () {
      const { root, fs, path } = yield* fixture();
      const directory = path.join(root, "packages/fixture/node_modules/effect");
      yield* fs.makeDirectory(directory, { recursive: true });
      yield* fs.writeFileString(path.join(directory, "index.js"), "export {};\n");
      (yield* assertCacheProducerWorkflowProfile(root).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
    })
  );
  it.effect("rejects ambient dotenv files without reading their contents", () =>
    Effect.gen(function* () {
      const { root, fs, path } = yield* fixture();
      for (const name of [".env", ".env.production.local", ".env.test.local"]) {
        const file = path.join(root, name);
        yield* fs.writeFileString(file, "FIXTURE_ONLY=true\n");
        (yield* assertCacheProducerWorkflowProfile(root).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
        yield* fs.remove(file);
      }
      yield* fs.symlink("missing-env-target", path.join(root, ".env.local"));
      (yield* assertCacheProducerWorkflowProfile(root).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
    })
  );
  it.effect("binds the loaded supervisor to its own checkout", () =>
    Effect.gen(function* () {
      const { root, path } = yield* fixture();
      const testFile = yield* path.fromFileUrl(new URL(import.meta.url));
      const owner = path.resolve(path.dirname(testFile), "../../../../..");
      yield* assertCacheProducerWorkflowLocation(owner);
      (yield* assertCacheProducerWorkflowLocation(root).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
    })
  );
});
