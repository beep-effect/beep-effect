import {
  CacheCommandError,
  CacheLinkedFile,
  CachePilotRequest,
  CacheProducerBinding,
  CacheProducerBundle,
  CacheSignedPilotRequest,
  CacheToolchainSnapshot,
} from "@beep/repo-cli/commands/Cache";
import * as Fingerprint from "@beep/repo-cli/commands/Cache/Cache.fingerprint";
import * as Linker from "@beep/repo-cli/commands/Cache/Cache.linker";
import * as SignedRunner from "@beep/repo-cli/commands/Cache/Cache.pilot.runner";
import * as ProtocolRunner from "@beep/repo-cli/commands/Cache/Cache.protocol.runner";
import {
  assertCacheProducerWorkflowLocation,
  assertCacheProducerWorkflowProfile,
  CacheProducerWorkflow,
  CacheRuntimeAdmission,
  collectCacheProducerWorkflowFiles,
  hashCacheProducerContract,
  hashCacheProducerWorkflow,
  initializeCacheProducerIssuer,
  inspectCacheProducerWorkflow,
  openCacheProducerVerifier,
  runCacheProducerWorkflow,
  CacheRuntimeProcess as StepExec,
} from "@beep/repo-cli/test/Cache";
import { MemoryStats } from "@beep/repo-cli/test/RepoRun";
import { CacheEvidenceReference, CacheTaskContract } from "@beep/repo-configs/cache";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { Sha256Hex } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { afterEach, expect, it, vi } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import { Effect, FileSystem, Layer, Match, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { input as bundleInput, contractInput } from "./helpers/cache-producer-bundle-fixture.ts";

afterEach(() => vi.restoreAllMocks());

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

const supervisedFixture = Effect.fn("WorkflowTest.supervisedFixture")(function* () {
  const base = yield* inspectedFixture();
  const { root, path, fs, bundle, workflow } = base;
  const contract = yield* S.decodeUnknownEffect(CacheTaskContract)(contractInput);
  const binding = yield* S.decodeUnknownEffect(CacheProducerBinding)({
    ...bundleInput.pilot,
    protocolClient: bundle.protocol.observation.client,
    workflowRevision: workflow.revision,
    workflowImplementation: yield* hashCacheProducerWorkflow(workflow),
    policyDigest: yield* hashCacheProducerContract(contract),
  });
  const directory = path.join(path.dirname(root), "issuer");
  yield* initializeCacheProducerIssuer(directory, binding, contract);
  const reference = CacheEvidenceReference.make({ path: "fixture.json", sha256: bundle.pilot.configurationDigest });
  const request = CacheSignedPilotRequest.make({
    sourceRoot: root,
    pilot: CachePilotRequest.make({
      channel: binding.channel,
      client: binding.client,
      executable: "/fixture/turbo",
      biomeExecutable: "/fixture/biome",
      nodeExecutable: "/fixture/node",
      dependencies: reference,
      activation: reference,
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
  const run = runCacheProducerWorkflow(root, request, directory, binding).pipe(
    Effect.provideService(FileSystem.FileSystem, {
      ...fs,
      // The real loaded-location rejection is covered separately; this scoped
      // mapping lets a temporary Git fixture exercise the complete issuer flow.
      realPath: (file) =>
        Str.endsWith("/Cache.workflow.ts")(file)
          ? Effect.succeed(path.join(root, "packages/tooling/tool/cli/src/commands/Cache/Cache.workflow.ts"))
          : fs.realPath(file),
    })
  );
  return { ...base, directory, binding, request, signed, protocol, admission, run };
});

it.layer(
  Layer.mergeAll(
    NodeCrypto.layer,
    NodeServices.layer,
    FsUtilsLive.pipe(Layer.provide(NodeServices.layer)),
    Layer.succeed(MemoryStats, MemoryStats.of({ availableGib: Effect.succeed(64), totalGib: Effect.succeed(64) }))
  ),
  { timeout: "30 seconds" }
)("producer workflow source identity", (it) => {
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
      expect(workflow.inspectionTools).toHaveLength(6);
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
      const { root, fs, path } = yield* fixture();
      yield* fs.remove(path.join(root, ".git"), { recursive: true });
      (yield* collectCacheProducerWorkflowFiles(root).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
      (yield* assertCacheProducerWorkflowProfile(root).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
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
