import {
  CacheActivationPreview,
  CacheCensusNode,
  CacheCensusReport,
  CacheCensusWorkspace,
  CacheComputationConfiguration,
  CacheDependencyMaterialization,
  CacheDependencyTree,
  CacheExecutablePin,
  CacheLinkedFile,
  CacheLinkerResolution,
  CacheLiveIdentity,
  CachePilotRequest,
  CacheQualificationService,
  CacheRuntimeLinkerSnapshot,
  CacheToolchainSnapshot,
} from "@beep/repo-cli/commands/Cache";
import * as Census from "@beep/repo-cli/commands/Cache/Cache.census";
import * as Dependencies from "@beep/repo-cli/commands/Cache/Cache.dependencies";
import * as Evidence from "@beep/repo-cli/commands/Cache/Cache.evidence";
import * as Fingerprint from "@beep/repo-cli/commands/Cache/Cache.fingerprint";
import * as Linker from "@beep/repo-cli/commands/Cache/Cache.linker";
import * as Worktree from "@beep/repo-cli/commands/Worktree";
import { runCachePilotForTesting } from "@beep/repo-cli/test/Cache";
import {
  CacheActivationProjection,
  CacheClientPin,
  CacheEvidenceReference,
  CacheQualificationKey,
  CacheTaskConfiguration,
} from "@beep/repo-configs/cache";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { LiteralKit, NonNegativeInt, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Crypto, Effect, FileSystem, Layer, Path, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as Equal from "effect/Equal";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { afterEach, vi } from "vitest";

const platform = Layer.mergeAll(
  NodeServices.layer,
  NodeCrypto.layer,
  FsUtilsLive.pipe(Layer.provide(NodeServices.layer))
);
const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown));
const hashBytes = S.decodeEffect(Sha256HexFromBytes);
const hash = (text: string) => hashBytes(new TextEncoder().encode(text));
const digest = Sha256Hex.make(Str.repeat(64)("a"));
const revision = Str.repeat(40)("a");
const identityDirectory = "packages/foundation/modeling/identity";
const typesDirectory = "packages/foundation/primitive/types";
const task = "@beep/identity#lint";
const dependencyTask = "@beep/types#lint";
const faultDomain = LiteralKit([
  "none",
  "remote-hit",
  "dependency-hit",
  "missing-runtime-key",
  "wrong-command",
  "extra-summary",
  "unsafe-log",
  "missing-log",
  "source-write",
  "missing-selected",
  "library-mismatch",
  "version-mismatch",
]);
const encodePreview = S.encodeEffect(S.fromJsonString(CacheActivationPreview));
const encodeDependencies = S.encodeEffect(S.fromJsonString(CacheDependencyMaterialization));
const configuration = CacheTaskConfiguration.make({
  cache: false,
  inputs: ["$TURBO_DEFAULT$"],
  outputs: [],
  env: ["BEEP_CACHE_TOOLCHAIN_DIGEST"],
  passThroughEnv: [],
  dependsOn: ["^lint"],
  persistent: false,
  interactive: false,
  interruptible: false,
  outputLogs: "full",
});
const pin = CacheExecutablePin.make({ version: "1.4.2", sha256: digest });
const linked = CacheLinkedFile.make({ path: "/usr/lib/fixture", target: "/usr/lib/fixture", sha256: digest });
const linker = CacheRuntimeLinkerSnapshot.make({
  format: "glibc-ldd/v1",
  detector: linked,
  loader: linked,
  executables: {
    bun: CacheLinkerResolution.cases.Static.make({}),
    node: CacheLinkerResolution.cases.Static.make({}),
    turbo: CacheLinkerResolution.cases.Static.make({}),
    biome: CacheLinkerResolution.cases.Static.make({}),
    bash: CacheLinkerResolution.cases.Static.make({}),
    sh: CacheLinkerResolution.cases.Static.make({}),
  },
});

// Real contained-file operations and pilot control flow surround a deterministic
// process double. No Git worktree, native tool, scheduler or cache service is run.
const fixture = Effect.fn("PilotOrchestrationTest.fixture")(function* (fault: typeof faultDomain.Type = "none") {
  const crypto = yield* Crypto.Crypto;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "cache-pilot-orchestration-" });
  const write = Effect.fnUntraced(function* (directory: string, relative: string, text: string) {
    const target = path.join(directory, relative);
    yield* fs.makeDirectory(path.dirname(target), { recursive: true });
    yield* fs.writeFileString(target, text);
  });
  const rootFiles = {
    "turbo.json": '{"global":{"env":[]},"tasks":{"lint":{}}}',
    "biome.jsonc": '{"files":{"includes":["**"]}}',
    "bun.lock": '{"packages":{"effect":["effect@4.0.0"]}}',
    "package.json": '{"packageManager":"bun@1.4.2"}',
    "tsconfig.json": '{"compilerOptions":{"paths":{}}}',
  };
  const before = '{"extends":["//"],"tasks":{"lint":{"cache":false,"env":["BEEP_CACHE_TOOLCHAIN_DIGEST"]}}}';
  const after = Str.replace('"cache":false', '"cache":true')(before);
  const sourceRoots = [path.join(root, "source-a"), path.join(root, "source-b")] as const;
  for (const directory of [root, ...sourceRoots]) {
    for (const [relative, text] of R.toEntries(rootFiles)) yield* write(directory, relative, text);
    for (const packageDirectory of [identityDirectory, typesDirectory]) {
      yield* write(directory, `${packageDirectory}/src/index.ts`, "export const fixture = 1;\n");
      yield* write(directory, `${packageDirectory}/README.md`, "Fixture\n");
      yield* write(directory, `${packageDirectory}/package.json`, '{"scripts":{"lint":"bun run beep:lint"}}');
      yield* write(directory, `${packageDirectory}/turbo.json`, before);
    }
  }
  yield* write(root, "tool", "fixture");
  const reference = Effect.fnUntraced(function* (relative: string, text: string) {
    yield* write(root, relative, text);
    return CacheEvidenceReference.make({ path: relative, sha256: yield* hash(text) });
  });
  const tree = CacheDependencyTree.make({
    format: "canonical-gnu-tar/v1",
    sha256: digest,
    regularFiles: NonNegativeInt.make(0),
    entries: NonNegativeInt.make(0),
    bytes: NonNegativeInt.make(0),
    links: [],
  });
  const dependencies = CacheDependencyMaterialization.make({
    schemaVersion: "cache-dependency-materialization/v1",
    authority: "local-installed-tree-snapshot",
    directory: path.join(root, "dependencies"),
    lockfileSha256: digest,
    rootManifestSha256: digest,
    tree,
    tools: {},
  });
  const nodes = A.map([task, dependencyTask] as const, (id) =>
    CacheCensusNode.make({
      id,
      workspace: id === task ? "@beep/identity" : "@beep/types",
      task: "lint",
      command: O.some("bun run beep:lint"),
      commandDigest: digest,
      dependencies: id === task ? [dependencyTask] : [],
      configuration,
      inputCount: NonNegativeInt.make(0),
      inputsDigest: digest,
    })
  );
  const census = CacheCensusReport.make({
    revision,
    turboVersion: pin.version,
    rootScripts: {},
    globalConfiguration: {},
    workspaces: A.map(nodes, (node) =>
      CacheCensusWorkspace.make({
        name: node.workspace,
        directory: node.id === task ? identityDirectory : typesDirectory,
        scripts: { lint: "bun run beep:lint" },
      })
    ),
    nodes,
    sources: [],
    entrypointSources: [],
    unresolved: [],
  });
  const source = CacheLiveIdentity.make({
    key: CacheQualificationKey.make({
      computation: task,
      layer: "turbo-task-result",
      profile: "local-linux-x64-bun1.4.2",
      epoch: "test",
    }),
    configuration: CacheComputationConfiguration.make({
      computation: task,
      globalConfiguration: {},
      nodes,
      sources: [],
    }),
    configurationDigest: digest,
    toolchainDigest: digest,
    toolchain: CacheToolchainSnapshot.make({
      profile: "local-linux-x64-bun1.4.2",
      kernel: "fixture",
      libc: "fixture",
      bun: pin,
      node: pin,
      turbo: pin,
      biome: pin,
      sources: [],
      installedDependencies: O.some(tree),
      runtimeLinker: O.some(linker),
    }),
  });
  const activation = CacheActivationProjection.make({
    path: `${identityDirectory}/turbo.json`,
    before: yield* reference("before.json", before),
    after: yield* reference("after.json", after),
    sourceConfiguration: digest,
  });
  const preview = CacheActivationPreview.make({ source, target: source, activation });
  const request = CachePilotRequest.make({
    channel: "stable",
    client: CacheClientPin.make({ ...pin, namespace: "test" }),
    executable: path.join(root, "tool"),
    biomeExecutable: path.join(root, "tool"),
    nodeExecutable: path.join(root, "tool"),
    dependencies: yield* reference("dependencies.json", yield* encodeDependencies(dependencies)),
    worktrees: sourceRoots,
    activation: yield* reference("activation.json", yield* encodePreview(preview)),
    selection: "full",
  });
  vi.spyOn(Census, "collectCacheCensus").mockReturnValue(Effect.succeed(census));
  vi.spyOn(Census, "joinCacheCensusPlan").mockReturnValue(Effect.succeed(nodes));
  vi.spyOn(Dependencies, "verifyCacheDependencies").mockImplementation(
    Effect.fn("PilotOrchestrationTest.verifyDependencies")(function* (observedRoot, receipt) {
      expect(observedRoot).toBe(root);
      expect(receipt).toEqual(dependencies);
      yield* Effect.void;
      return undefined;
    })
  );
  vi.spyOn(Evidence, "hashCacheExperimentExecutable").mockReturnValue(Effect.succeed(digest));
  vi.spyOn(Fingerprint, "fingerprintCacheComputation").mockReturnValue(Effect.succeed(source));
  vi.spyOn(Linker, "collectCacheRuntimeLinker").mockReturnValue(Effect.succeed(linker));
  vi.spyOn(Worktree, "resolveWorktreeContext").mockReturnValue(
    Effect.succeed(
      Worktree.WorktreeContext.make({
        currentRoot: root,
        mainCheckout: root,
        worktreesRoot: root,
        entries: A.map(sourceRoots, (directory) =>
          Worktree.WorktreeListEntry.make({
            path: directory,
            head: revision,
            branch: null,
            detached: true,
            locked: false,
            prunable: false,
          })
        ),
      })
    )
  );
  const runtimeKey = `BEEP_CACHE_TOOLCHAIN_DIGEST=${yield* hash(digest)}`;
  const calls: Array<string> = [];
  const counts = MutableHashMap.empty<string, number>();
  const spawner = ChildProcessSpawner.make(
    Effect.fnUntraced(
      function* (command) {
        if (!ChildProcess.isStandardCommand(command)) return yield* Effect.die("Unexpected piped command");
        const args = command.args;
        let stdout = "";
        let stderr = "";
        let exitCode = 0;
        if (command.command === "/usr/bin/git") {
          const gitOutput = () =>
            A.contains(args, "--git-common-dir")
              ? path.join(root, ".git")
              : A.contains(args, "--absolute-git-dir")
                ? path.join(root, ".git/worktrees", path.basename(command.options.cwd ?? root))
                : A.contains(args, "status")
                  ? ""
                  : revision;
          stdout = gitOutput();
        } else {
          const observeSandbox = Effect.fn("PilotOrchestrationTest.observeSandbox")(function* () {
            expect(command.command).toBe("/usr/bin/bwrap");
            expect(command.options.extendEnv).toBe(false);
            expect(args).toContain("--unshare-all");
            const invocation = A.drop(args, O.getOrThrow(A.findFirstIndex(args, Equal.equals("--"))) + 1);
            const mounted = (guest: string) => args[O.getOrThrow(A.findFirstIndex(args, Equal.equals(guest))) - 1];
            const guest = args[O.getOrThrow(A.findFirstIndex(args, Equal.equals("--chdir"))) + 1];
            const identity = mounted(`${guest}/${identityDirectory}`);
            const types = mounted(`${guest}/${typesDirectory}`);
            const directory = path.dirname(identity);
            const label = path.basename(directory);
            const nativeTask = (id: string, taskHash: string, hit = false, code = 0) => ({
              taskId: id,
              task: "lint",
              package: id === task ? "@beep/identity" : "@beep/types",
              command: fault === "wrong-command" ? "unreviewed" : "bun run beep:lint",
              dependencies: id === task ? [dependencyTask] : [],
              inputs: {},
              resolvedTaskDefinition: { ...configuration, passThroughEnv: [] },
              hash: taskHash,
              cache: { status: hit ? "HIT" : "MISS", local: hit, remote: fault === "remote-hit" },
              environmentVariables: { configured: fault === "missing-runtime-key" ? [] : [runtimeKey] },
              execution: { exitCode: code },
            });
            const observeInvocation = Effect.fn("PilotOrchestrationTest.observeInvocation")(function* () {
              if (invocation[0] === "/usr/bin/ldd") {
                stdout = fault === "library-mismatch" ? "/usr/lib/other (0x123)" : "statically linked";
                return;
              }
              if (A.contains(invocation, "--version")) {
                stdout = fault === "version-mismatch" ? "wrong" : pin.version;
                return;
              }
              if (invocation[0] === "/bin/sh") {
                stdout = yield* fs.readFileString(path.join(identity, "turbo.json"));
                return;
              }
              if (A.contains(invocation, "--dry=json")) {
                stdout = yield* encodeJson({ tasks: [nativeTask(task, "0123456789abcdef")] });
                return;
              }
              const observeTask = Effect.fn("PilotOrchestrationTest.observeTask")(function* () {
                calls.push(label);
                if (Str.startsWith("non-execution-")(label)) {
                  if (label === "non-execution-absent-script")
                    yield* write(directory, "run/runs/run.json", '{"tasks":[]}');
                  else {
                    exitCode = 1;
                    stderr =
                      label === "non-execution-missing-root-config"
                        ? "could not find turbo.json"
                        : "failed to parse turbo.json";
                  }
                } else {
                  const observeExecution = Effect.fn("PilotOrchestrationTest.observeExecution")(function* () {
                    const number = O.getOrElse(MutableHashMap.get(counts, directory), () => 0);
                    MutableHashMap.set(counts, directory, number + 1);
                    const childExists = yield* fs.exists(path.join(identity, "turbo.json"));
                    const child = childExists ? yield* fs.readFileString(path.join(identity, "turbo.json")) : "";
                    const enabled = Str.includes('"cache":true')(child) || !childExists;
                    const reuse = A.contains(invocation, "--cache=local:rw");
                    const sourceText = yield* fs.readFileString(path.join(identity, "src/index.ts"));
                    const readme = yield* fs.readFileString(path.join(identity, "README.md"));
                    const added = yield* fs.exists(path.join(identity, "src/qualification-shadow.ts"));
                    const env = command.options.env ?? {};
                    const mutation = Str.startsWith("mutation-")(label);
                    const mutationKey = () => (mutation ? label + (number === 0 ? "before" : "after") : "");
                    const taskHash = Str.slice(
                      0,
                      16
                    )(
                      yield* hash(
                        `${sourceText}:${readme}:${added}:${env.BEEP_ESLINT_PROFILE ?? "absent"}:${enabled}:${mutationKey()}`
                      )
                    );
                    const cacheFile = `cache/${taskHash}`;
                    const hit = reuse && (yield* fs.exists(path.join(directory, cacheFile)));
                    const fixtureExitCode = () =>
                      label === "failed-source" ||
                      (number === 0 && A.contains(["mutation-root-lint-config", "mutation-dependency-source"], label))
                        ? 1
                        : 0;
                    exitCode = fixtureExitCode();
                    if (reuse && exitCode === 0) yield* write(directory, cacheFile, "fixture");
                    const writeObservation = Effect.fn("PilotOrchestrationTest.writeObservation")(function* () {
                      const selected = nativeTask(task, taskHash, hit, exitCode);
                      const dependency = nativeTask(dependencyTask, "fedcba9876543210", fault === "dependency-hit");
                      yield* write(
                        directory,
                        "run/runs/run.json",
                        yield* encodeJson({
                          tasks: fault === "missing-selected" ? [dependency] : [selected, dependency],
                        })
                      );
                      if (fault === "extra-summary") yield* write(directory, "run/runs/extra.json", "{}");
                      if (fault === "source-write") yield* write(identity, "src/index.ts", "unexpected write");
                      const log = fault === "unsafe-log" ? "/fixture/private.ts\n" : "lint observation\n";
                      if (fault !== "missing-log") yield* write(directory, "identity-log/turbo-lint.log", log);
                      const progress = hit
                        ? "cache hit, replaying logs"
                        : enabled
                          ? "cache miss, executing"
                          : "cache bypass, force executing";
                      stdout = `@beep/identity:lint: ${progress} ${taskHash}\n@beep/identity:lint: ${log}`;
                    });
                    yield* writeObservation();
                    expect(yield* fs.exists(path.join(types, "src/index.ts"))).toBe(true);
                  });
                  yield* observeExecution();
                }
              });
              yield* observeTask();
            });
            yield* observeInvocation();
          });
          yield* observeSandbox();
        }
        return ChildProcessSpawner.makeHandle({
          all: Stream.make(new TextEncoder().encode(stdout + stderr)),
          stdout: Stream.make(new TextEncoder().encode(stdout)),
          stderr: Stream.make(new TextEncoder().encode(stderr)),
          stdin: Sink.drain,
          exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
          getInputFd: () => Sink.drain,
          getOutputFd: () => Stream.empty,
          isRunning: Effect.succeed(false),
          kill: () => Effect.void,
          pid: ChildProcessSpawner.ProcessId(1),
          unref: Effect.succeed(Effect.void),
        });
      },
      Effect.orDie,
      Effect.provideService(Crypto.Crypto, crypto)
    )
  );
  const uncalled = () => Effect.die("Unexpected qualification mutation or unrelated service call");
  const service = CacheQualificationService.of({
    activation: Effect.fn("PilotOrchestrationTest.activation")(() => Effect.succeed(preview)),
    audit: uncalled,
    baseline: uncalled,
    fingerprint: uncalled,
    inspect: uncalled,
    transition: uncalled,
  });
  const run = (changed = request) =>
    runCachePilotForTesting(root, changed).pipe(
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
      Effect.provideService(CacheQualificationService, service)
    );
  return { root, fs, path, run, request, calls, preview, sourceRoots };
});

afterEach(() => vi.restoreAllMocks());

describe("pilot orchestration process boundary", () => {
  it.effect(
    "binds fresh/replay controls to native summaries, validates mutations and cleans overlays",
    Effect.fnUntraced(function* () {
      const { root, fs, path, run, sourceRoots } = yield* fixture();
      const receipt = yield* run();
      expect(A.filter(receipt.checks, (check) => !check.passed)).toEqual([]);
      expect(receipt.shadowDecisions).toHaveLength(10);
      expect(receipt.mutations).toHaveLength(8);
      expect(receipt.nonExecutions).toHaveLength(4);
      expect(receipt.runs.length).toBeGreaterThan(60);
      expect(receipt.authority).toBe("local-observation-only");
      expect(yield* fs.readDirectory(path.join(root, ".beep/cache/experiments"))).toEqual(["owner"]);
      for (const source of sourceRoots)
        expect(yield* fs.readFileString(path.join(source, identityDirectory, "src/index.ts"))).toBe(
          "export const fixture = 1;\n"
        );
    }, provideScopedLayer(platform))
  );

  it.effect(
    "rejects schema-generated binary pins before execution",
    Effect.fnUntraced(function* () {
      const { run, request } = yield* fixture();
      const result = yield* Arbitrary.checkEffect(
        Arbitrary.schema(Sha256Hex),
        (sha256) =>
          run(CachePilotRequest.make({ ...request, client: CacheClientPin.make({ ...request.client, sha256 }) })).pipe(
            Effect.result,
            Effect.map((outcome) => Result.isFailure(outcome) === (sha256 !== digest))
          ),
        fcRuns(40)
      );
      expect(result._tag).toBe("Passed");
    }, provideScopedLayer(platform))
  );

  for (const fault of faultDomain.omitOptions(["none"])) {
    it.effect(
      `rejects ${fault} without producing a receipt`,
      Effect.fnUntraced(function* () {
        const { root, fs, path, run } = yield* fixture(fault);
        expect(Result.isFailure(yield* run().pipe(Effect.result))).toBe(true);
        expect(yield* fs.readDirectory(path.join(root, ".beep/cache/experiments"))).toEqual(["owner"]);
      }, provideScopedLayer(platform))
    );
  }
});
