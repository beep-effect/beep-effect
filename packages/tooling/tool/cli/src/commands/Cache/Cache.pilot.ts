/**
 * Admitted local execution of the real identity lint computation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { CacheClientPin, CacheQualificationKey, CacheTaskConfiguration } from "@beep/repo-configs/cache";
import { LiteralKit, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { GitObjectId } from "@beep/schema/Conformance";
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { Crypto, Duration, Effect, FileSystem, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as Hex from "effect/encoding/Hex";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { readContainedFileBytesNoFollow, writeContainedFileString } from "../../internal/cli/FsGuards.ts";
import { OutputBound, runCapturedStreams } from "../../internal/process/index.ts";
import { AdmissionRequest } from "../../internal/repo-run/QualityScheduler.schemas.ts";
import { noAdmissionOriginGate, withQualityAdmission } from "../../internal/repo-run/QualityScheduler.ts";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";
import { resolveWorktreeContext } from "../Worktree/index.ts";
import { collectCacheCensus, collectCacheTaskSelection, joinCacheCensusPlan } from "./Cache.census.ts";
import { CacheDependencyMaterialization } from "./Cache.dependencies.schemas.ts";
import { verifyCacheDependencies } from "./Cache.dependencies.ts";
import {
  decodeCacheExperimentText as decodeText,
  hashCacheExperimentExecutable as hashExecutable,
  readCacheExperimentBytes as readBytes,
  readCacheEvidenceBytes,
} from "./Cache.evidence.ts";
import { CacheSyntheticCheck, CacheSyntheticRun } from "./Cache.experiment.schemas.ts";
import { inspectCacheFixtureCapture } from "./Cache.experiment.ts";
import { fingerprintCacheComputation } from "./Cache.fingerprint.ts";
import { collectCacheRuntimeLinker, inspectCacheLinkedFile, parseCacheLinkerOutput } from "./Cache.linker.ts";
import { extractCachePilotLog, extractCacheSignedPilotLog } from "./Cache.pilot.capture.ts";
import {
  CachePilotLogInput,
  CachePilotMutation,
  CachePilotNonExecution,
  CachePilotOutcome,
  CachePilotReceipt,
  CachePilotRun,
  CachePilotShadow,
  CachePilotTask,
  CacheSignedPilotLogInput,
} from "./Cache.pilot.schemas.ts";
import {
  CacheSignedPilotFreshPair,
  CacheSignedPilotPair,
  CacheSignedPilotProtection,
  CacheSignedPilotReceipt,
  CacheSignedPilotRun,
  CacheSignedPilotShadow,
  CacheSignedPilotTask,
} from "./Cache.pilot.signed.schemas.ts";
import { validateCacheSignedPilotFreshPair, validateCacheSignedPilotShadow } from "./Cache.pilot.signed.ts";
import { renderCacheIdentityLintProfile, verifyCacheIdentityLintProfile } from "./Cache.profile.ts";
import { CacheFixtureCredentials, CacheFixtureScenario } from "./Cache.protocol.fixture.schemas.ts";
import { makeCacheProtocolFixture } from "./Cache.protocol.fixture.ts";
import { assertCachePrivateNetwork } from "./Cache.protocol.runner.ts";
import {
  CacheActivationPreview,
  CacheActivationRequest,
  CacheCommandError,
  CacheDependencyTree,
  CacheExecutablePin,
  CacheLinkedFile,
  CacheLinkerResolution,
  CacheRuntimeExecutable,
  CacheRuntimeLinkerSnapshot,
  CacheToolchainSnapshot,
} from "./Cache.schemas.ts";
import { CacheQualificationService } from "./Cache.service.ts";
import type * as PlatformError from "effect/PlatformError";
import type { FsGuardError } from "../../internal/cli/FsGuards.ts";
import type { CachePilotRequest } from "./Cache.pilot.schemas.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.pilot");
const PilotMode = LiteralKit(["local", "signed"]);
const PilotCapability = S.Redacted(S.NonEmptyString);
class PilotTransport extends S.Class<PilotTransport>($I`PilotTransport`)(
  {
    endpoint: S.NonEmptyString,
    namespace: S.NonEmptyString,
    bearer: PilotCapability,
    signing: PilotCapability,
    secrets: S.Array(PilotCapability),
  },
  $I.annote("PilotTransport", {
    description: "Supervisor-owned ephemeral transport for one signed execution; never decoded from a public request.",
  })
) {}

const identityDirectory = "packages/foundation/modeling/identity";
const typesDirectory = "packages/foundation/primitive/types";
const identityTask = "@beep/identity#lint";
const typesTask = "@beep/types#lint";
const additionalDependencyDirectories: Readonly<Record<string, string>> = {
  "@beep/fc-runs#lint": "packages/tooling/test-kit/fc-runs",
  "@beep/test-runner#lint": "packages/tooling/test-kit/test-runner",
};
const captureBound = OutputBound.make({ maxChars: 1024 * 1024, truncatedNotice: "[pilot capture overflow]" });
const hashBytes = S.decodeEffect(Sha256HexFromBytes);
const hashText = (text: string) => hashBytes(new TextEncoder().encode(text));
const InputEntries = S.Array(S.Tuple([S.String, S.String]));

// External native summary fields are decoded before constructing domain observations.
const NativeTask = S.Struct({
  taskId: S.NonEmptyString,
  task: S.NonEmptyString,
  package: S.NonEmptyString,
  command: S.String,
  dependencies: S.Array(S.String),
  inputs: S.Record(S.String, S.String),
  resolvedTaskDefinition: S.Struct({
    ...CacheTaskConfiguration.fields,
    passThroughEnv: S.String.pipe(S.Array, S.OptionFromNullOr),
  }),
  hash: CacheSyntheticRun.fields.taskHash,
  cache: S.Struct({ status: S.Literals(["HIT", "MISS"]), local: S.Boolean, remote: S.Boolean }),
  environmentVariables: S.Struct({
    configured: S.Array(S.String),
    passthrough: S.Array(S.String).pipe(S.OptionFromNullOr),
  }),
  execution: S.OptionFromOptionalKey(S.Struct({ exitCode: S.OptionFromOptionalKey(S.Int) })),
});
const NativeSummary = S.Struct({ tasks: S.Array(NativeTask) });
class PilotFile extends S.Class<PilotFile>($I`PilotFile`)(
  { path: S.NonEmptyString, mode: S.Natural, sha256: Sha256Hex },
  $I.annote("PilotFile", { description: "A regular package source file observed before or after execution." })
) {}
class PilotRoot extends S.Class<PilotRoot>($I`PilotRoot`)(
  {
    label: CachePilotRun.fields.root,
    source: S.NonEmptyString,
    directory: S.NonEmptyString,
    gitFile: S.NonEmptyString,
    identity: S.NonEmptyString,
    types: S.NonEmptyString,
    additionalPackages: S.Record(S.String, S.String),
    before: S.String,
    after: S.String,
    rootFiles: S.Record(S.String, S.String),
    omitted: S.Array(S.NonEmptyString),
    omitChild: S.Boolean,
  },
  $I.annote("PilotRoot", {
    description: "Owned disposable package overlays backed by a read-only registered worktree.",
  })
) {}
class PilotShadowScenario extends S.Class<PilotShadowScenario>($I`PilotShadowScenario`)(
  {
    id: CacheSignedPilotShadow.fields.case,
    sourceChange: LiteralKit(["none", "source-comment", "added-source", "readme"]),
    env: S.Record(S.String, S.String),
    guest: S.NonEmptyString,
    expectedInputHash: CachePilotShadow.fields.expectedInputHash,
  },
  $I.annote("PilotShadowScenario", {
    description: "A fixed local perturbation with a declared task-hash expectation and separate fresh authority.",
  })
) {}

const captureHost = Effect.fn("CachePilot.captureHost")(function* (root: string, args: ReadonlyArray<string>) {
  const result = yield* runCapturedStreams({
    command: "/usr/bin/git",
    args,
    cwd: root,
    extendEnv: false,
    env: { PATH: "/usr/bin", HOME: "/nonexistent", GIT_CONFIG_NOSYSTEM: "1", GIT_OPTIONAL_LOCKS: "0" },
    bound: captureBound,
  }).pipe(Effect.timeout(Duration.seconds(30)));
  if (result.exitCode !== 0 || result.truncated)
    return yield* CacheCommandError.new("Pilot Git identity check failed or exceeded its bound.");
  return Str.trim(result.stdout);
});
const inputDigest = Effect.fn("CachePilot.inputDigest")(function* (inputs: Readonly<Record<string, string>>) {
  const entries = A.sort(
    R.toEntries(inputs),
    Order.mapInput(Order.String, (entry: readonly [string, string]) => entry[0])
  );
  return yield* JsonStringCodec(InputEntries).encode(entries).pipe(Effect.flatMap(hashText));
});
const copyPackage = Effect.fn("CachePilot.copyPackage")(function* (source: string, target: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  let entries = 0;
  const visit = Effect.fn("CachePilot.copyPackageEntry")(function* (
    relative: string,
    depth: number
  ): Effect.fn.Return<void, CacheCommandError | PlatformError.PlatformError> {
    if (depth > 16 || ++entries > 5000)
      return yield* CacheCommandError.new("Pilot source tree exceeded its traversal bound.");
    const from = path.join(source, relative);
    const to = path.join(target, relative);
    const link = yield* fs.readLink(from).pipe(Effect.option);
    if (O.isSome(link)) {
      // Portable copy rewrites relative links to host paths. Preserve their Git input bytes.
      yield* fs.symlink(link.value, to);
      return;
    }
    const info = yield* fs.stat(from);
    if (info.type === "Directory") {
      yield* fs.makeDirectory(to);
      for (const name of A.sort(yield* fs.readDirectory(from), Order.String))
        yield* visit(path.join(relative, name), depth + 1);
    } else if (info.type === "File") yield* fs.copyFile(from, to);
    else return yield* CacheCommandError.new("Pilot package source contains an unsupported file kind.");
  });
  yield* visit("", 0);
});
const snapshot = Effect.fn("CachePilot.snapshot")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const files: Array<PilotFile> = [];
  const visit = Effect.fn("CachePilot.snapshotVisit")(function* (
    relative: string,
    depth: number
  ): Effect.fn.Return<
    void,
    CacheCommandError | FsGuardError | S.SchemaError | PlatformError.PlatformError,
    FileSystem.FileSystem | Path.Path | Crypto.Crypto
  > {
    if (depth > 16 || files.length > 5000)
      return yield* CacheCommandError.new("Pilot source tree exceeded its traversal bound.");
    yield* Effect.forEach(
      A.sort(yield* fs.readDirectory(path.join(root, relative)), Order.String),
      Effect.fn("CachePilot.snapshotEntry")(function* (name) {
        if (relative === "" && name === ".turbo") return;
        const child = path.join(relative, name);
        const link = yield* fs.readLink(path.join(root, child)).pipe(Effect.option);
        if (O.isSome(link)) {
          files.push(
            PilotFile.make({ path: child, mode: S.Natural.make(0o120000), sha256: yield* hashText(link.value) })
          );
          return;
        }
        const info = yield* fs.stat(path.join(root, child));
        if (info.type === "Directory") yield* visit(child, depth + 1);
        else if (info.type === "File")
          files.push(
            PilotFile.make({
              path: child,
              mode: S.Natural.make(info.mode & 0o777),
              sha256: yield* readBytes(root, child).pipe(Effect.flatMap(hashBytes)),
            })
          );
        else return yield* CacheCommandError.new("Pilot package source contains an unsupported file kind.");
      }),
      { concurrency: 1, discard: true }
    );
  });
  yield* visit("", 0);
  return yield* PilotFile.pipe(S.Array, JsonStringCodec).encode(files).pipe(Effect.flatMap(hashText));
});

const validatePilotClient = Effect.fn("CachePilot.validateClient")(function* (
  current: CacheActivationPreview,
  request: CachePilotRequest
) {
  if ((request.channel === "canary") !== Str.includes("-canary.")(request.client.version))
    return yield* CacheCommandError.new("Pilot client version and channel disagree.");
  if (
    request.channel === "stable" &&
    !S.toEquivalence(S.Struct({ version: S.String, sha256: Sha256Hex }))(request.client, current.source.toolchain.turbo)
  )
    return yield* CacheCommandError.new("Stable pilot client differs from the reviewed toolchain.");
});

const validatePilotClosure = Effect.fn("CachePilot.validateClosure")(function* (
  current: CacheActivationPreview,
  dependencies: CacheDependencyMaterialization
) {
  const installed = yield* current.source.toolchain.installedDependencies.pipe(
    Effect.fromOption(() => CacheCommandError.new("Pilot qualification requires an installed dependency identity."))
  );
  if (!S.toEquivalence(CacheDependencyTree)(installed, dependencies.tree))
    return yield* CacheCommandError.new("Pilot dependency snapshot differs from the observed normal installation.");
  const selectedNode = yield* A.findFirst(current.source.configuration.nodes, (node) => node.id === identityTask).pipe(
    Effect.fromOption(() => CacheCommandError.new("The pilot computation is absent."))
  );
  if (!A.contains(selectedNode.configuration.env, "BEEP_CACHE_TOOLCHAIN_DIGEST"))
    return yield* CacheCommandError.new("The pilot must declare BEEP_CACHE_TOOLCHAIN_DIGEST as a hashed input.");
  const dependencyNodes = A.filter(current.source.configuration.nodes, (node) => node.id !== identityTask);
  if (
    A.some(
      dependencyNodes,
      (node) => (node.id !== typesTask && !R.has(additionalDependencyDirectories, node.id)) || node.configuration.cache
    )
  )
    return yield* CacheCommandError.new(
      "Pilot dependencies must be limited to fresh, unqualified types, fc-runs and test-runner lint."
    );
  return dependencyNodes;
});

const matchesNonExecutionDiagnostic = (reason: CachePilotNonExecution["reason"], stderr: string) =>
  Str.includes(reason === "missing-root-config" ? "could not find turbo.json" : "failed to parse turbo.json")(
    Str.toLowerCase(stderr)
  );
const decodeGitObjectId = S.decodeUnknownEffect(GitObjectId);

const decodeJsonObject = S.decodeUnknownEffect(S.JsonObject);

const decodeArrayString = S.decodeUnknownEffect(S.Array(S.String));

const decodeNonEmptyArrayJson = S.decodeUnknownEffect(S.NonEmptyArray(S.Json));

const decodeNonEmptyString = S.decodeUnknownEffect(S.NonEmptyString);

const runPilot = Effect.fn("CachePilot.run")(
  function* (
    root: string,
    request: CachePilotRequest,
    mode: typeof PilotMode.Type = "local",
    protectedIssuerMaterial: O.Option<string> = O.none()
  ) {
    if (process.platform !== "linux" || process.arch !== "x64")
      return yield* CacheCommandError.new("The real pilot sandbox requires Linux x64.");
    if (mode === "signed") yield* assertCachePrivateNetwork;
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const cache = yield* CacheQualificationService;
    const preview = yield* readCacheEvidenceBytes(root, request.activation).pipe(
      Effect.flatMap(decodeText),
      Effect.flatMap(JsonStringCodec(CacheActivationPreview).decode)
    );
    const activationRequest = CacheActivationRequest.make({ computation: identityTask, ...preview.activation });
    const current = yield* cache.activation(root, activationRequest);
    if (!S.toEquivalence(CacheActivationPreview)(current, preview))
      return yield* CacheCommandError.new("The pilot activation preview is stale.");
    if (mode === "signed" && request.selection !== "full")
      return yield* CacheCommandError.new("Signed comparisons require full selection.");
    const dependencies = yield* readCacheEvidenceBytes(root, request.dependencies).pipe(
      Effect.flatMap(decodeText),
      Effect.flatMap(JsonStringCodec(CacheDependencyMaterialization).decode)
    );
    yield* verifyCacheDependencies(root, dependencies);
    const dependencyNodes = yield* validatePilotClosure(current, dependencies);
    const expectedTasks = A.sort(
      A.map(current.source.configuration.nodes, (node) => node.id),
      Order.String
    );
    const expectedDependencies = A.sort(
      A.map(dependencyNodes, (node) => node.id),
      Order.String
    );
    const census = yield* collectCacheCensus(root);
    const needsProfile = A.some(
      census.nodes,
      (node) =>
        node.id === identityTask &&
        O.isSome(node.command) &&
        A.contains(node.configuration.passThroughEnv, "BIOME_CONFIG_PATH")
    );
    const profileObservation = Effect.fn("CachePilot.profileObservation")(function* (guest: string) {
      return `BIOME_CONFIG_PATH=${yield* hashText(path.join(guest, "biome.identity.jsonc"))}`;
    });
    if (needsProfile) {
      yield* verifyCacheIdentityLintProfile(root);
      yield* collectCacheTaskSelection(root, ["run", "lint", "--filter=@beep/identity", "--env-mode=strict"]);
    }
    const context = yield* resolveWorktreeContext(root);
    const revision = yield* captureHost(root, ["rev-parse", "HEAD"]).pipe(Effect.flatMap(decodeGitObjectId));
    const commonGit = yield* captureHost(root, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
    const sourceRoots = yield* Effect.forEach(request.worktrees, (source) => fs.realPath(source), { concurrency: 1 });
    const sourceRootA = O.getOrThrow(A.get(sourceRoots, 0));
    const sourceRootB = O.getOrThrow(A.get(sourceRoots, 1));
    if (sourceRootA === sourceRootB)
      return yield* CacheCommandError.new("Cross-root pilot observations require two distinct registered worktrees.");
    yield* Effect.forEach(
      sourceRoots,
      Effect.fn("CachePilot.verifySourceWorktree")(function* (source) {
        if (!A.some(context.entries, (entry) => entry.path === source && entry.head === revision) || source === root)
          return yield* CacheCommandError.new(
            "A pilot source is not a distinct registered worktree at the current revision."
          );
        if ((yield* captureHost(source, ["status", "--porcelain", "--untracked-files=all"])) !== "")
          return yield* CacheCommandError.new("Pilot source worktrees must be clean before read-only execution.");
      }),
      { concurrency: 1, discard: true }
    );
    const bun = yield* fs.realPath(process.execPath);
    const biome = yield* fs.realPath(request.biomeExecutable);
    const node = yield* fs.realPath(request.nodeExecutable);
    const turbo = yield* fs.realPath(request.executable);
    const verifyTools = Effect.fn("CachePilot.verifyTools")(function* () {
      for (const [executable, expected] of [
        [bun, current.source.toolchain.bun.sha256],
        [biome, current.source.toolchain.biome.sha256],
        [node, current.source.toolchain.node.sha256],
        [turbo, request.client.sha256],
      ] as const) {
        if ((yield* hashExecutable(executable)) !== expected)
          return yield* CacheCommandError.new("A pilot executable differs from its exact content pin.");
      }
    });
    yield* verifyTools();
    const runtimeExecutables = { bun, biome, node, turbo, bash: "/usr/bin/bash", sh: "/usr/bin/sh" };
    const reviewedLinker = yield* current.source.toolchain.runtimeLinker.pipe(
      Effect.fromOption(() => CacheCommandError.new("Pilot qualification requires startup library identity."))
    );
    const runtimeLinker = yield* collectCacheRuntimeLinker(root, runtimeExecutables);
    if (
      !S.toEquivalence(CacheRuntimeLinkerSnapshot)(
        runtimeLinker,
        CacheRuntimeLinkerSnapshot.make({
          ...reviewedLinker,
          executables: { ...reviewedLinker.executables, turbo: runtimeLinker.executables.turbo },
        })
      )
    )
      return yield* CacheCommandError.new("Pilot libraries differ from the reviewed normal runtime.");
    const runtimeIdentity = yield* fingerprintCacheComputation(
      current.source.key,
      census,
      CacheToolchainSnapshot.make({
        ...current.source.toolchain,
        turbo: CacheExecutablePin.make({ version: request.client.version, sha256: request.client.sha256 }),
        runtimeLinker: O.some(runtimeLinker),
      })
    );
    const runtimeKeyObservation = `BEEP_CACHE_TOOLCHAIN_DIGEST=${yield* hashText(runtimeIdentity.toolchainDigest)}`;
    yield* validatePilotClient(current, request);
    const before = yield* readCacheEvidenceBytes(root, current.activation.before).pipe(Effect.flatMap(decodeText));
    const after = yield* readCacheEvidenceBytes(root, current.activation.after).pipe(Effect.flatMap(decodeText));
    const typesConfig = yield* readBytes(root, `${typesDirectory}/turbo.json`).pipe(Effect.flatMap(decodeText));
    yield* writeContainedFileString(root, ".beep/cache/experiments/owner", "Cache-owned disposable local fixtures.\n");
    const experiment = yield* fs.makeTempDirectoryScoped({
      directory: path.join(root, ".beep/cache/experiments"),
      prefix: "pilot-",
    });
    const prepare = Effect.fn("CachePilot.prepare")(function* (
      source: string,
      label: PilotRoot["label"],
      name: string
    ) {
      if (needsProfile) yield* verifyCacheIdentityLintProfile(source);
      const directory = path.join(experiment, name);
      yield* fs.makeDirectory(directory);
      const identity = path.join(directory, "identity");
      const types = path.join(directory, "types");
      yield* copyPackage(path.join(source, identityDirectory), identity);
      yield* copyPackage(path.join(source, typesDirectory), types);
      const additionalPackages = yield* Effect.forEach(
        R.toEntries(additionalDependencyDirectories),
        Effect.fn("CachePilot.prepareDependency")(function* ([task, relative]) {
          if (!A.contains(expectedDependencies, task)) return O.none();
          const target = path.join(directory, "dependencies", relative);
          yield* fs.makeDirectory(path.dirname(target), { recursive: true });
          yield* copyPackage(path.join(source, relative), target);
          return O.some(Tuple.make(relative, target));
        }),
        { concurrency: 1 }
      ).pipe(Effect.map((entries) => R.fromEntries(A.getSomes(entries))));
      for (const packageRoot of [identity, types, ...R.values(additionalPackages)]) {
        if (yield* fs.exists(path.join(packageRoot, ".turbo")))
          return yield* CacheCommandError.new("Clean pilot source unexpectedly contains runtime outputs.");
        yield* fs.makeDirectory(path.join(packageRoot, ".turbo"));
      }
      yield* writeContainedFileString(types, "turbo.json", typesConfig);
      yield* writeContainedFileString(identity, "turbo.json", before);
      const gitDirectory = yield* captureHost(source, ["rev-parse", "--absolute-git-dir"]);
      if (path.dirname(gitDirectory) !== path.join(commonGit, "worktrees"))
        return yield* CacheCommandError.new("Pilot source uses unsupported Git metadata placement.");
      const gitFile = path.join(directory, "gitfile");
      yield* writeContainedFileString(directory, "gitfile", `gitdir: /git/worktrees/${path.basename(gitDirectory)}\n`);
      return PilotRoot.make({
        label,
        source,
        directory,
        identity,
        types,
        additionalPackages,
        gitFile,
        before,
        after,
        rootFiles: {},
        omitted: [],
        omitChild: false,
      });
    });
    const overlayRootFile = Effect.fn("CachePilot.overlayRootFile")(function* (
      fixture: PilotRoot,
      relative: string,
      text: string
    ) {
      const target = `overrides/${relative}`;
      yield* writeContainedFileString(fixture.directory, target, text);
      return PilotRoot.make({
        ...fixture,
        rootFiles: R.set(fixture.rootFiles, relative, path.join(fixture.directory, target)),
      });
    });
    const mountSource = Effect.fn("CachePilot.mountSource")(function* (fixture: PilotRoot, guest: string) {
      const replacements: Readonly<Record<string, string>> = {
        ...fixture.additionalPackages,
        ...fixture.rootFiles,
        ".git": fixture.gitFile,
        node_modules: path.join(dependencies.directory, "node_modules"),
        ".turbo": path.join(fixture.directory, "run"),
        [identityDirectory]: fixture.identity,
        [typesDirectory]: fixture.types,
      };
      const mounts: Array<string> = [];
      const parents: Array<string> = [];
      const mountDirectory = Effect.fn("CachePilot.mountDirectory")(function* (relative: string, destination: string) {
        mounts.push("--tmpfs", destination);
        parents.push(destination);
        const existing = yield* fs.readDirectory(path.join(fixture.source, relative));
        const added = pipe(
          R.keys(replacements),
          A.map((key) => {
            const prefix = relative === "" ? "" : `${relative}/`;
            if (!Str.startsWith(prefix)(key)) return O.none();
            return A.head(Str.split("/")(Str.slice(prefix.length)(key)));
          }),
          A.getSomes
        );
        for (const name of A.sort(A.dedupe([...existing, ...added]), Order.String))
          yield* visit(path.join(relative, name));
      });
      const visit = Effect.fn("CachePilot.mountVisit")(function* (
        relative: string
      ): Effect.fn.Return<void, PlatformError.PlatformError> {
        if (A.contains(fixture.omitted, relative)) return;
        const destination = path.join(guest, relative);
        const replacement = R.get(replacements, relative);
        if (O.isSome(replacement)) {
          mounts.push(relative === ".turbo" ? "--bind" : "--ro-bind", replacement.value, destination);
        } else if (relative === "" || A.some(R.keys(replacements), (key) => Str.startsWith(`${relative}/`)(key))) {
          yield* mountDirectory(relative, destination);
        } else mounts.push("--ro-bind", path.join(fixture.source, relative), destination);
      });
      yield* visit("");
      for (const [directory, name] of [
        [identityDirectory, "identity-log"],
        [typesDirectory, "types-log"],
      ] as const)
        mounts.push("--bind", path.join(fixture.directory, name), path.join(guest, directory, ".turbo"));
      for (const relative of R.keys(fixture.additionalPackages))
        mounts.push(
          "--bind",
          path.join(fixture.directory, "dependency-logs", relative),
          path.join(guest, relative, ".turbo")
        );
      for (const parent of A.reverse(parents)) mounts.push("--remount-ro", parent);
      return mounts;
    });
    const invoke = Effect.fn("CachePilot.invoke")(function* (
      fixture: PilotRoot,
      guest: string,
      args: ReadonlyArray<string>,
      env: Readonly<Record<string, string>> = {},
      transport: O.Option<PilotTransport> = O.none()
    ) {
      if (needsProfile && env.BIOME_CONFIG_PATH !== undefined)
        return yield* CacheCommandError.new("Pilot scenario cannot override the governed lint profile.");
      for (const name of ["run", "identity-log", "types-log", "cache"])
        yield* fs.makeDirectory(path.join(fixture.directory, name), { recursive: true });
      for (const relative of R.keys(fixture.additionalPackages))
        yield* fs.makeDirectory(path.join(fixture.directory, "dependency-logs", relative), { recursive: true });
      if (O.isSome(transport)) {
        yield* writeContainedFileString(
          fixture.directory,
          "run/config.json",
          yield* JsonStringCodec(S.Struct({ teamId: S.String })).encode({ teamId: transport.value.namespace })
        );
      }
      return yield* runCapturedStreams({
        command: "/usr/bin/bwrap",
        args: [
          ...(O.isSome(transport)
            ? ["--unshare-user", "--unshare-pid", "--unshare-ipc", "--unshare-uts"]
            : ["--unshare-all"]),
          "--die-with-parent",
          "--new-session",
          "--ro-bind",
          "/usr",
          "/usr",
          "--symlink",
          "usr/lib",
          "/lib",
          "--symlink",
          "usr/lib",
          "/lib64",
          "--symlink",
          "usr/bin",
          "/bin",
          "--proc",
          "/proc",
          "--dev",
          "/dev",
          "--tmpfs",
          "/tmp",
          "--dir",
          "/tools",
          "--ro-bind",
          bun,
          "/tools/bun",
          "--ro-bind",
          biome,
          "/tools/biome",
          "--ro-bind",
          node,
          "/tools/node",
          "--ro-bind",
          turbo,
          "/tools/turbo",
          "--ro-bind",
          commonGit,
          "/git",
          "--bind",
          path.join(fixture.directory, "cache"),
          "/cache",
          ...(yield* mountSource(fixture, guest)),
          "--chdir",
          guest,
          "--",
          ...(args[0] === "/tools/turbo" ? ["/tools/turbo", "--skip-infer", ...A.drop(args, 1)] : args),
        ],
        cwd: root,
        extendEnv: false,
        env: {
          PATH: "/tools:/usr/bin",
          HOME: "/tmp",
          XDG_CACHE_HOME: "/tmp",
          XDG_CONFIG_HOME: "/tmp",
          TMPDIR: "/tmp",
          LANG: "C",
          LC_ALL: "C",
          CI: "1",
          NO_COLOR: "1",
          TURBO_TELEMETRY_DISABLED: "1",
          DO_NOT_TRACK: "1",
          GIT_CONFIG_NOSYSTEM: "1",
          GIT_OPTIONAL_LOCKS: "0",
          ...env,
          ...(O.isSome(transport)
            ? {
                TURBO_API: transport.value.endpoint,
                TURBO_TOKEN: Redacted.value(transport.value.bearer),
                TURBO_REMOTE_CACHE_SIGNATURE_KEY: Redacted.value(transport.value.signing),
              }
            : {}),
          ...(needsProfile ? { BIOME_CONFIG_PATH: path.join(guest, "biome.identity.jsonc") } : {}),
          BEEP_CACHE_TOOLCHAIN_DIGEST: runtimeIdentity.toolchainDigest,
        },
        bound: captureBound,
      }).pipe(Effect.timeout(Duration.seconds(60)));
    });
    const roots = [
      yield* prepare(sourceRootA, "root-a", "initial-a"),
      yield* prepare(sourceRootB, "root-b", "initial-b"),
    ];
    const firstRoot = O.getOrThrow(A.head(roots));
    const verifySandboxLibraries = Effect.fn("CachePilot.verifySandboxLibraries")(function* () {
      yield* Effect.forEach(
        CacheRuntimeExecutable.literals,
        Effect.fn("CachePilot.verifySandboxLibrary")(function* (role) {
          const executable = CacheRuntimeExecutable.$match({
            bun: () => "/tools/bun",
            node: () => "/tools/node",
            turbo: () => "/tools/turbo",
            biome: () => `/fixture/node_modules/@biomejs/cli-linux-x64/biome`,
            bash: () => "/usr/bin/bash",
            sh: () => "/usr/bin/sh",
          })(role);
          const observed = yield* invoke(firstRoot, "/fixture", ["/usr/bin/ldd", "--", executable]);
          if (observed.exitCode !== 0 || observed.truncated || Str.trim(observed.stderr) !== "")
            return yield* CacheCommandError.new(`Sandbox ${role} library discovery failed.`);
          const paths = yield* parseCacheLinkerOutput(observed.stdout);
          const expectedFiles = CacheLinkerResolution.match(runtimeLinker.executables[role], {
            Static: A.empty<CacheLinkedFile>,
            Dynamic: ({ files }): ReadonlyArray<CacheLinkedFile> => files,
          });
          const expected = A.map(expectedFiles, (file) => file.path);
          if (!S.toEquivalence(S.Array(S.String))(paths, expected))
            return yield* CacheCommandError.new(
              `Sandbox ${role} library resolution differs from the reviewed runtime.`
            );
          for (const file of expectedFiles)
            if (!S.toEquivalence(CacheLinkedFile)(file, yield* inspectCacheLinkedFile(file.path)))
              return yield* CacheCommandError.new(`Sandbox ${role} library target changed during validation.`);
        }),
        { concurrency: 1, discard: true }
      );
    });
    yield* verifySandboxLibraries();
    const verifySandboxVersions = Effect.fn("CachePilot.verifySandboxVersions")(function* () {
      for (const [executable, expected] of [
        ["bun", current.source.toolchain.bun.version],
        ["biome", current.source.toolchain.biome.version],
        ["node", current.source.toolchain.node.version],
        ["turbo", request.client.version],
      ]) {
        const observed = yield* invoke(firstRoot, "/fixture", [`/tools/${executable}`, "--version"]);
        if (observed.exitCode !== 0 || observed.truncated || Str.trim(observed.stdout) !== expected)
          return yield* CacheCommandError.new(
            `Sandbox ${executable} version check failed (exit ${observed.exitCode}).`
          );
      }
    });
    yield* verifySandboxVersions();
    yield* Effect.logInfo(`Pilot ${request.channel}: installed runtime and exact client checks passed.`);
    const verifyNativePlans = Effect.fn("CachePilot.verifyNativePlans")(function* () {
      const expectedProfile = yield* profileObservation("/fixture");
      yield* Effect.forEach(
        roots,
        Effect.fn("CachePilot.verifyNativePlan")(function* (fixture) {
          const dry = yield* invoke(fixture, "/fixture", [
            "/tools/turbo",
            "run",
            "lint",
            "--filter=@beep/identity",
            "--no-daemon",
            "--cache=local:",
            "--env-mode=strict",
            "--dry=json",
          ]);
          if (dry.exitCode !== 0 || dry.truncated)
            return yield* CacheCommandError.new("Pilot dry-run setup failed or exceeded its capture bound.");
          const plan = yield* JsonStringCodec(NativeSummary).decode(dry.stdout);
          if (
            !A.some(
              plan.tasks,
              (task) =>
                task.taskId === identityTask &&
                A.contains(task.environmentVariables.configured, runtimeKeyObservation) &&
                (!needsProfile || O.exists(task.environmentVariables.passthrough, A.contains(expectedProfile)))
            )
          )
            return yield* CacheCommandError.new("The native pilot plan omitted the verified runtime key.");
          const joined = yield* joinCacheCensusPlan(census.workspaces, plan);
          if (
            !S.toEquivalence(S.Array(S.String))(
              A.sort(
                A.map(joined, (node) => node.id),
                Order.String
              ),
              expectedTasks
            )
          )
            return yield* CacheCommandError.new("Pilot graph differs from the reviewed identity task closure.");
          for (const node of joined) {
            const expected = yield* A.findFirst(census.nodes, (row) => row.id === node.id).pipe(
              Effect.fromOption(() => CacheCommandError.new("Pilot dry node is absent from the current census."))
            );
            if (
              node.inputsDigest !== expected.inputsDigest ||
              node.commandDigest !== expected.commandDigest ||
              !S.toEquivalence(CacheTaskConfiguration)(node.configuration, expected.configuration)
            )
              return yield* CacheCommandError.new(
                "Read-only pilot inputs or configuration differ from the live census."
              );
          }
        }),
        { concurrency: 1, discard: true }
      );
    });
    yield* verifyNativePlans();
    const taskObservation = Effect.fn("CachePilot.taskObservation")(function* (task: typeof NativeTask.Type) {
      const exitCode = yield* task.execution.pipe(
        O.flatMap((execution) => execution.exitCode),
        Effect.fromOption(() => CacheCommandError.new("A native task omitted its execution verdict."))
      );
      if (task.cache.remote || (task.cache.status === "HIT" && !task.cache.local))
        return yield* CacheCommandError.new("A pilot hit lacks exclusive local origin evidence.");
      return CachePilotTask.make({
        computation: task.taskId,
        taskHash: task.hash,
        origin: task.cache.status === "HIT" ? "local-hit" : "fresh",
        exitCode,
        inputsDigest: yield* inputDigest(task.inputs),
      });
    });
    const validateDependencyObservations = Effect.fn("CachePilot.validateDependencyObservations")(function* (
      fixture: PilotRoot,
      dependencies: ReadonlyArray<CachePilotTask>
    ) {
      // Removing the child config may remove its dependency edges. Any remaining
      // dependency must still belong to the reviewed closure and execute fresh.
      if (
        (!fixture.omitChild &&
          !S.toEquivalence(S.Array(S.String))(
            A.sort(
              A.map(dependencies, (task) => task.computation),
              Order.String
            ),
            expectedDependencies
          )) ||
        A.some(dependencies, (task) => !A.contains(expectedDependencies, task.computation) || task.origin !== "fresh")
      )
        return yield* CacheCommandError.new("Pilot dependency was unexpected or reused an unqualified artifact.");
    });
    const verifyReplayLog = Effect.fn("CachePilot.verifyReplayLog")(function* (
      fixture: PilotRoot,
      text: string,
      enabled: boolean
    ) {
      const logNames = yield* fs.readDirectory(path.join(fixture.directory, "identity-log"));
      if (A.some(logNames, (name) => name !== "turbo-lint.log"))
        return yield* CacheCommandError.new("Pilot produced an undeclared persistent output beside its replay log.");
      const log = yield* readContainedFileBytesNoFollow(
        fixture.directory,
        "identity-log/turbo-lint.log",
        S.Natural.make(64 * 1024)
      );
      const replayLogMatches =
        O.isSome(log.contents) && (yield* hashBytes(log.contents.value)) === (yield* hashText(text));
      if (enabled && !replayLogMatches)
        return yield* CacheCommandError.new("Enabled pilot execution omitted an identical bounded replay log.");
      return replayLogMatches;
    });
    const prepareExecution = Effect.fn("CachePilot.prepareExecution")(function* (fixture: PilotRoot, enabled: boolean) {
      for (const name of ["run", "identity-log", "types-log", "dependency-logs"])
        yield* fs.remove(path.join(fixture.directory, name), { recursive: true, force: true });
      if (fixture.omitChild) yield* fs.remove(path.join(fixture.identity, "turbo.json"), { force: true });
      else yield* writeContainedFileString(fixture.identity, "turbo.json", enabled ? fixture.after : fixture.before);
    });
    const verifyExecutionEnvironment = Effect.fn("CachePilot.verifyExecutionEnvironment")(function* (
      fixture: PilotRoot,
      id: string,
      task: typeof NativeTask.Type,
      expectedProfile: string
    ) {
      if (!fixture.omitChild && !A.contains(task.environmentVariables.configured, runtimeKeyObservation))
        return yield* CacheCommandError.new(`Native pilot run ${id} omitted the verified runtime key.`);
      if (
        needsProfile &&
        !fixture.omitChild &&
        !O.exists(task.environmentVariables.passthrough, A.contains(expectedProfile))
      )
        return yield* CacheCommandError.new(`Native pilot run ${id} omitted the verified lint profile.`);
    });
    const executeNative = Effect.fn("CachePilot.executeNative")(function* (
      fixture: PilotRoot,
      id: string,
      enabled: boolean,
      reuse: boolean,
      guest = "/fixture",
      env: Readonly<Record<string, string>> = {},
      transport: O.Option<PilotTransport> = O.none()
    ) {
      const expectedProfile = yield* profileObservation(guest);
      yield* prepareExecution(fixture, enabled);
      const beforeTrees = yield* Effect.forEach(
        [fixture.identity, fixture.types, ...R.values(fixture.additionalPackages)],
        snapshot,
        { concurrency: 2 }
      );
      const captured = yield* invoke(
        fixture,
        guest,
        [
          "/tools/turbo",
          "run",
          "lint",
          "--filter=@beep/identity",
          "--no-daemon",
          `--cache=${O.isSome(transport) ? "remote:rw" : reuse ? "local:rw" : "local:"}`,
          "--cache-dir=/cache",
          "--env-mode=strict",
          "--summarize",
          "--output-logs=full",
          "--log-order=grouped",
          "--log-prefix=task",
          "--ui=stream",
          "--concurrency=1",
        ],
        env,
        transport
      );
      if (captured.truncated) return yield* CacheCommandError.new("Pilot process capture exceeded its bound.");
      const names = yield* fs.readDirectory(path.join(fixture.directory, "run/runs"));
      if (names.length !== 1)
        return yield* CacheCommandError.new("Pilot did not produce exactly one native run summary.");
      const bytes = yield* readBytes(fixture.directory, `run/runs/${O.getOrThrow(A.head(names))}`);
      if (O.isSome(transport)) {
        const text = yield* decodeText(bytes);
        if (
          A.some(transport.value.secrets, (secret) =>
            A.some([captured.stdout, captured.stderr, text], (value) => Str.includes(Redacted.value(secret))(value))
          )
        )
          return yield* CacheCommandError.new("Signed pilot capture contains synthetic credential material.");
      }
      const summary = yield* decodeText(bytes).pipe(Effect.flatMap(JsonStringCodec(NativeSummary).decode));
      const dependencies = yield* Effect.forEach(
        A.filter(summary.tasks, (task) => task.taskId !== identityTask),
        taskObservation,
        { concurrency: 1 }
      );
      yield* validateDependencyObservations(fixture, dependencies);
      const selected = A.filter(summary.tasks, (task) => task.taskId === identityTask);
      if (selected.length > 1) return yield* CacheCommandError.new("Native pilot summary repeated the selected task.");
      const afterTrees = yield* Effect.forEach(
        [fixture.identity, fixture.types, ...R.values(fixture.additionalPackages)],
        snapshot,
        { concurrency: 2 }
      );
      const sourceTreeUnchanged = S.toEquivalence(S.Array(Sha256Hex))(beforeTrees, afterTrees);
      if (!sourceTreeUnchanged)
        return yield* CacheCommandError.new("Read-only pilot package source changed during execution.");
      const outcome = yield* O.match(A.head(selected), {
        onNone: Effect.fn("CachePilot.blocked")(function* () {
          const failed = A.filter(dependencies, (task) => task.exitCode !== 0);
          if (captured.exitCode === 0 || !A.isArrayNonEmpty(failed))
            return yield* CacheCommandError.new("Selected task was omitted without an observed failed dependency.");
          return CachePilotOutcome.cases.Blocked.make({ failedDependencies: failed });
        }),
        onSome: Effect.fn("CachePilot.executed")(function* (task: typeof NativeTask.Type) {
          yield* verifyExecutionEnvironment(fixture, id, task, expectedProfile);
          const observation = yield* O.match(transport, {
            onNone: () => taskObservation(task),
            onSome: Effect.fn("CachePilot.observeSignedTask")(function* () {
              const exitCode = yield* task.execution.pipe(
                O.flatMap((execution) => execution.exitCode),
                Effect.fromOption(() => CacheCommandError.new("Signed selected task omitted its exit verdict."))
              );
              if (task.cache.local || (task.cache.status === "HIT") !== task.cache.remote)
                return yield* CacheCommandError.new("Signed selected task lacks exclusive remote origin evidence.");
              return CacheSignedPilotTask.make({
                computation: task.taskId,
                taskHash: task.hash,
                origin: task.cache.status === "HIT" ? "remote-hit" : "fresh",
                exitCode,
                inputsDigest: yield* inputDigest(task.inputs),
              });
            }),
          });
          if (task.command !== "bun run beep:lint" || (captured.exitCode === 0) !== (observation.exitCode === 0))
            return yield* CacheCommandError.new("Selected pilot command or verdict disagrees with its graph.");
          const capture = {
            computation: identityTask,
            taskHash: task.hash,
            origin: observation.origin,
            cacheEnabled: enabled,
            stdout: captured.stdout,
            stderr: captured.stderr,
            truncated: captured.truncated,
          };
          const text = yield* O.isSome(transport)
            ? S.decodeUnknownEffect(CacheSignedPilotLogInput)(capture).pipe(Effect.flatMap(extractCacheSignedPilotLog))
            : S.decodeUnknownEffect(CachePilotLogInput)(capture).pipe(Effect.flatMap(extractCachePilotLog));
          if (
            A.isReadonlyArrayNonEmpty(inspectCacheFixtureCapture(text, false)) ||
            Str.includes("qualification-canary")(text)
          )
            return yield* CacheCommandError.new("Selected pilot capture exposed an unsafe canary or absolute path.");
          const replayLogMatches = yield* verifyReplayLog(fixture, text, enabled);
          return {
            _tag: "Executed",
            selected: observation,
            logSha256: yield* hashText(text),
            logBytes: S.Natural.make(new TextEncoder().encode(text).byteLength),
            replayLogMatches,
          };
        }),
      });
      const observed = {
        nativeRuntimeKeyObserved: A.some(selected, (task) =>
          A.contains(task.environmentVariables.configured, runtimeKeyObservation)
        ),
        id,
        root: fixture.label,
        cacheEnabled: enabled,
        graphExitCode: captured.exitCode,
        outcome,
        dependencies,
        summarySha256: yield* hashBytes(bytes),
        sourceTreeUnchanged,
      };
      return yield* O.isSome(transport)
        ? S.decodeUnknownEffect(CacheSignedPilotRun)(observed)
        : S.decodeUnknownEffect(CachePilotRun)(observed);
    });
    const execute = Effect.fn("CachePilot.execute")(function* (
      fixture: PilotRoot,
      id: string,
      enabled: boolean,
      reuse: boolean,
      guest = "/fixture",
      env: Readonly<Record<string, string>> = {}
    ) {
      return yield* executeNative(fixture, id, enabled, reuse, guest, env).pipe(
        Effect.flatMap(S.decodeUnknownEffect(CachePilotRun))
      );
    });
    const verifyFinalIntegrity = Effect.fn("CachePilot.verifyFinalIntegrity")(function* () {
      yield* verifyTools();
      if (
        !S.toEquivalence(CacheRuntimeLinkerSnapshot)(
          runtimeLinker,
          yield* collectCacheRuntimeLinker(root, runtimeExecutables)
        )
      )
        return yield* CacheCommandError.new("Pilot startup libraries changed during execution.");
      if (!S.toEquivalence(CacheActivationPreview)(yield* cache.activation(root, activationRequest), current))
        return yield* CacheCommandError.new("Pilot source configuration drifted during execution.");
      for (const source of sourceRoots)
        if (
          (yield* captureHost(source, ["status", "--porcelain", "--untracked-files=all"])) !== "" ||
          (yield* captureHost(source, ["rev-parse", "HEAD"])) !== revision
        )
          return yield* CacheCommandError.new("Read-only pilot worktree changed during execution.");
      yield* verifyCacheDependencies(root, dependencies);
    });

    const applyShadowSource = Effect.fn("CachePilot.applyShadowSource")(function* (
      fixture: PilotRoot,
      scenario: PilotShadowScenario
    ) {
      if (scenario.sourceChange === "source-comment") {
        const original = yield* readBytes(fixture.identity, "src/index.ts").pipe(Effect.flatMap(decodeText));
        yield* writeContainedFileString(
          fixture.identity,
          "src/index.ts",
          `${original}\n// Qualification shadow input.\n`
        );
      } else if (scenario.sourceChange === "added-source") {
        yield* writeContainedFileString(
          fixture.identity,
          "src/qualification-shadow.ts",
          'export const qualificationShadow = "fixture";\n'
        );
      } else if (scenario.sourceChange === "readme") {
        const original = yield* readBytes(fixture.identity, "README.md").pipe(Effect.flatMap(decodeText));
        yield* writeContainedFileString(fixture.identity, "README.md", `${original}\nQualification shadow input.\n`);
      }
    });
    const unchanged = PilotShadowScenario.make({
      id: "baseline",
      sourceChange: "none",
      env: {},
      guest: "/fixture",
      expectedInputHash: "stable",
    });
    const scenarios = [
      unchanged,
      PilotShadowScenario.make({
        ...unchanged,
        id: "source-comment",
        sourceChange: "source-comment",
        expectedInputHash: "changed",
      }),
      PilotShadowScenario.make({
        ...unchanged,
        id: "added-source",
        sourceChange: "added-source",
        expectedInputHash: "changed",
      }),
      PilotShadowScenario.make({
        ...unchanged,
        id: "readme",
        sourceChange: "readme",
        expectedInputHash: "changed",
      }),
      PilotShadowScenario.make({
        ...unchanged,
        id: "declared-env",
        env: { BEEP_ESLINT_PROFILE: "qualification" },
        expectedInputHash: "changed",
      }),
      PilotShadowScenario.make({
        ...unchanged,
        id: "declared-env-empty",
        env: { BEEP_ESLINT_PROFILE: "" },
        expectedInputHash: "changed",
      }),
      PilotShadowScenario.make({
        ...unchanged,
        id: "orchestration-env",
        env: { BEEP_AGENT_SESSION_ID: "qualification-canary-metadata" },
      }),
      PilotShadowScenario.make({ ...unchanged, id: "locale", env: { LANG: "C.UTF-8", LC_ALL: "C.UTF-8" } }),
      PilotShadowScenario.make({ ...unchanged, id: "timezone", env: { TZ: "Pacific/Honolulu" } }),
      PilotShadowScenario.make({ ...unchanged, id: "absolute-root", guest: "/fixture-other" }),
    ];
    if (mode === "signed") {
      const crypto = yield* Crypto.Crypto;
      const rootConfig = yield* readBytes(root, "turbo.json").pipe(
        Effect.flatMap(decodeText),
        Effect.flatMap(decodeJsoncTextAs(S.JsonObject))
      );
      const flags = yield* O.match(R.get(rootConfig, "futureFlags"), {
        onNone: () => Effect.succeed({}),
        onSome: decodeJsonObject,
      });
      const usesGlobal = S.is(S.Literal(true))(R.get(flags, "globalConfiguration").pipe(O.getOrUndefined));
      const configuration = usesGlobal ? yield* decodeJsonObject(rootConfig.global) : rootConfig;
      const remoteConfig = yield* O.match(R.get(configuration, "remoteCache"), {
        onNone: () => Effect.succeed({}),
        onSome: decodeJsonObject,
      });
      const signedConfiguration = R.set(configuration, "remoteCache", {
        ...remoteConfig,
        enabled: true,
        signature: true,
      });
      const signedConfig = yield* JsonStringCodec(S.JsonObject).encode(
        usesGlobal ? R.set(rootConfig, "global", signedConfiguration) : signedConfiguration
      );
      const signedRootConfiguration = yield* hashText(signedConfig);
      const freshPairs = yield* Effect.forEach(
        A.range(0, 2),
        Effect.fn("CachePilot.signedFreshPair")(function* (pair) {
          const leftRoot = yield* prepare(sourceRootA, "root-a", `signed-fresh-${pair}-left`).pipe(
            Effect.flatMap((fixture) => overlayRootFile(fixture, "turbo.json", signedConfig))
          );
          const rightRoot = yield* prepare(sourceRootB, "root-b", `signed-fresh-${pair}-right`).pipe(
            Effect.flatMap((fixture) => overlayRootFile(fixture, "turbo.json", signedConfig))
          );
          // Each new root starts without a cache; native observations must still prove fresh execution.
          for (const fixture of [leftRoot, rightRoot])
            if (yield* fs.exists(path.join(fixture.directory, "cache")))
              return yield* CacheCommandError.new("Signed fresh comparison requires a new isolated cache directory.");
          const left = yield* execute(leftRoot, `signed-fresh-${pair}-left`, true, true);
          const right = yield* execute(rightRoot, `signed-fresh-${pair}-right`, true, true);
          const result = CacheSignedPilotFreshPair.make({
            id: pair,
            leftRoot: yield* hashText(`beep/cache-pilot-isolation/v1\0${yield* fs.realPath(leftRoot.directory)}`),
            rightRoot: yield* hashText(`beep/cache-pilot-isolation/v1\0${yield* fs.realPath(rightRoot.directory)}`),
            left,
            right,
          });
          yield* validateCacheSignedPilotFreshPair(result, current.source.key);
          return result;
        }),
        { concurrency: 1 }
      );
      const runSignedPair = Effect.fn("CachePilot.signedPair")(function* (pair: number, scenario: PilotShadowScenario) {
        const namespace = `team_${request.channel}_${yield* hashText(`${request.client.namespace}:${pair}`)}`;
        const client = CacheClientPin.make({ ...request.client, namespace });
        const writer = Redacted.make(Hex.encode(yield* crypto.randomBytes(32)));
        const reader = Redacted.make(Hex.encode(yield* crypto.randomBytes(32)));
        const signing = Redacted.make(Hex.encode(yield* crypto.randomBytes(32)));
        const issuerCanary = Redacted.make(Hex.encode(yield* crypto.randomBytes(32)));
        const secrets = [writer, reader, signing, issuerCanary];
        const fresh = yield* prepare(sourceRootA, "root-a", `signed-${pair}-authority`).pipe(
          Effect.flatMap((fixture) => overlayRootFile(fixture, "turbo.json", signedConfig))
        );
        const producerRoot = yield* prepare(sourceRootA, "root-a", `signed-${pair}-producer`).pipe(
          Effect.flatMap((fixture) => overlayRootFile(fixture, "turbo.json", signedConfig))
        );
        const readerRoot = yield* prepare(sourceRootB, "root-b", `signed-${pair}-reader`).pipe(
          Effect.flatMap((fixture) => overlayRootFile(fixture, "turbo.json", signedConfig))
        );
        yield* Effect.forEach([fresh, producerRoot, readerRoot], (fixture) => applyShadowSource(fixture, scenario), {
          concurrency: 1,
          discard: true,
        });
        const authoritative = yield* execute(
          fresh,
          `signed-${pair}-authority`,
          false,
          false,
          scenario.guest,
          scenario.env
        );
        const fixture = yield* makeCacheProtocolFixture(CacheFixtureCredentials.make({ namespace, writer, reader }));
        const transport = PilotTransport.make({
          endpoint: fixture.url,
          namespace,
          bearer: writer,
          signing,
          secrets,
        });
        yield* fixture.setScenario(CacheFixtureScenario.make({ id: `pair-${pair}-producer`, fault: "none" }));
        const producer = yield* executeNative(
          producerRoot,
          `signed-${pair}-producer`,
          true,
          true,
          scenario.guest,
          scenario.env,
          O.some(transport)
        ).pipe(Effect.flatMap(S.decodeUnknownEffect(CacheSignedPilotRun)));
        const protectedKeyPath = path.join(experiment, `protected-${pair}.key`);
        const protectedRecordPath = path.join(experiment, `protected-${pair}.json`);
        const protectedRecord = yield* JsonStringCodec(CacheSignedPilotRun).encode(producer);
        yield* writeContainedFileString(experiment, `protected-${pair}.key`, Redacted.value(issuerCanary));
        yield* writeContainedFileString(experiment, `protected-${pair}.json`, protectedRecord);
        yield* fs.chmod(protectedKeyPath, 0o600);
        yield* fs.chmod(protectedRecordPath, 0o600);
        yield* fixture.setScenario(CacheFixtureScenario.make({ id: `pair-${pair}-reader`, fault: "none" }));
        const replay = yield* executeNative(
          readerRoot,
          `signed-${pair}-reader`,
          true,
          true,
          "/fixture",
          scenario.env,
          O.some(PilotTransport.make({ ...transport, bearer: reader }))
        ).pipe(Effect.flatMap(S.decodeUnknownEffect(CacheSignedPilotRun)));
        const protectedPaths = yield* S.String.pipe(S.Array, JsonStringCodec).encode([
          protectedKeyPath,
          protectedRecordPath,
        ]);
        const forbiddenDigests = yield* S.String.pipe(S.Array, JsonStringCodec).encode([
          yield* writer.pipe(Redacted.value, hashText),
          yield* issuerCanary.pipe(Redacted.value, hashText),
        ]);
        const issuerProbe = yield* S.String.pipe(S.OptionFromNullOr, JsonStringCodec).encode(protectedIssuerMaterial);
        const probeScript = `const fs=require("node:fs");const crypto=require("node:crypto");
const paths=${protectedPaths};const forbidden=${forbiddenDigests};const issuer=${issuerProbe};
const denied=(file,flags)=>{try{const fd=fs.openSync(file,flags);fs.closeSync(fd);return false;}catch(error){if(error.code==="ENOENT"||error.code==="EACCES"||error.code==="EPERM"||error.code==="EROFS")return true;throw error;}};
const values=Object.values(process.env);try{for(const item of fs.readFileSync("/proc/1/environ","utf8").split("\\0")){const at=item.indexOf("=");if(at>=0)values.push(item.slice(at+1));}}catch(error){if(error.code!=="ENOENT"&&error.code!=="EACCES"&&error.code!=="EPERM")throw error;}
const hidden=values.every(value=>!forbidden.includes(crypto.createHash("sha256").update(value).digest("hex")));
console.log(JSON.stringify({protectedFiles:paths.length,readsDenied:paths.every(file=>denied(file,"r")),writesDenied:paths.every(file=>denied(file,"r+")),writerEnvironmentHidden:hidden,issuerMaterialDenied:issuer===null?undefined:denied(issuer,"r")&&denied(issuer,"r+")}));`;
        const protectionProbe = yield* invoke(
          readerRoot,
          "/fixture",
          ["/tools/bun", "-e", probeScript],
          scenario.env,
          O.some(PilotTransport.make({ ...transport, bearer: reader }))
        );
        if (protectionProbe.exitCode !== 0 || protectionProbe.truncated || Str.trim(protectionProbe.stderr) !== "")
          return yield* CacheCommandError.new("Signed pilot reader protection probe failed.");
        const protectionResult = yield* JsonStringCodec(S.JsonObject).decode(protectionProbe.stdout);
        const protectedBytesUnchanged =
          (yield* readBytes(experiment, `protected-${pair}.key`, 1024).pipe(Effect.flatMap(decodeText))) ===
            Redacted.value(issuerCanary) &&
          (yield* readBytes(experiment, `protected-${pair}.json`, 256 * 1024).pipe(Effect.flatMap(decodeText))) ===
            protectedRecord;
        const protection = yield* S.decodeUnknownEffect(CacheSignedPilotProtection)({
          ...protectionResult,
          mechanism: "nested-reader-denial/v1",
          protectedBytesUnchanged,
        });
        if (
          !CachePilotOutcome.isAnyOf(["Executed"])(authoritative.outcome) ||
          authoritative.graphExitCode !== 0 ||
          producer.graphExitCode !== 0 ||
          replay.graphExitCode !== 0 ||
          authoritative.outcome.selected.origin !== "fresh" ||
          producer.outcome.selected.origin !== "fresh" ||
          replay.outcome.selected.origin !== "remote-hit" ||
          authoritative.outcome.logSha256 !== producer.outcome.logSha256 ||
          producer.outcome.logSha256 !== replay.outcome.logSha256 ||
          producer.outcome.selected.taskHash !== replay.outcome.selected.taskHash ||
          producer.outcome.selected.inputsDigest !== replay.outcome.selected.inputsDigest ||
          !producer.outcome.replayLogMatches ||
          !replay.outcome.replayLogMatches ||
          producer.summarySha256 === replay.summarySha256
        )
          return yield* CacheCommandError.new(
            "Signed pilot diverged from fresh authority or lacked independent remote replay."
          );
        const events = yield* fixture.events;
        const taskHash = producer.outcome.selected.taskHash;
        const puts = A.filter(events, (event) => event.operation === "put");
        const reads = A.filter(events, (event) => event.operation === "get" && event.role === "reader");
        const put = yield* A.head(puts).pipe(
          Effect.fromOption(() => CacheCommandError.new("Signed producer upload missing."))
        );
        const read = yield* A.head(reads).pipe(
          Effect.fromOption(() => CacheCommandError.new("Signed reader download missing."))
        );
        if (
          puts.length !== 1 ||
          reads.length !== 1 ||
          put.status !== 200 ||
          put.role !== "writer" ||
          read.status !== 200 ||
          !O.contains(taskHash)(put.artifact) ||
          !O.contains(taskHash)(read.artifact) ||
          !put.tagPresent ||
          !read.tagPresent ||
          put.bytes === 0 ||
          put.bytes !== read.bytes ||
          O.isNone(put.digest) ||
          !O.contains(put.digest.value)(read.digest) ||
          !A.some(
            events,
            (event) =>
              event.operation === "get" &&
              event.role === "writer" &&
              event.status === 404 &&
              O.contains(taskHash)(event.artifact)
          )
        )
          return yield* CacheCommandError.new("Signed pilot lacks matching direct miss/upload/download evidence.");
        return CacheSignedPilotPair.make({
          id: S.Natural.make(pair),
          client,
          authorityRoot: yield* hashText(`beep/cache-pilot-isolation/v1\0${yield* fs.realPath(fresh.directory)}`),
          producerRoot: yield* hashText(`beep/cache-pilot-isolation/v1\0${yield* fs.realPath(producerRoot.directory)}`),
          replayRoot: yield* hashText(`beep/cache-pilot-isolation/v1\0${yield* fs.realPath(readerRoot.directory)}`),
          authoritative,
          producer,
          replay,
          events,
          protection,
        });
      }, Effect.scoped);
      const pairs = yield* Effect.forEach(A.range(0, 2), (pair) => runSignedPair(pair, unchanged), { concurrency: 1 });
      const baselinePair = O.getOrThrow(A.head(pairs));
      const shadows = yield* Effect.forEach(
        scenarios,
        Effect.fn("CachePilot.signedShadow")(function* (scenario, index) {
          const comparison = yield* runSignedPair(index + 3, scenario);
          const shadow = CacheSignedPilotShadow.make({ case: scenario.id, comparison });
          return yield* validateCacheSignedPilotShadow(shadow, baselinePair);
        }),
        { concurrency: 1 }
      );
      yield* verifyFinalIntegrity();
      return CacheSignedPilotReceipt.make({
        key: CacheQualificationKey.make({
          ...current.source.key,
          profile: `${current.source.key.profile}-private-loopback-signed-v1`,
        }),
        baseKey: current.source.key,
        sourceRevision: revision,
        channel: request.channel,
        client: request.client,
        runtimeKeyDigest: runtimeIdentity.toolchainDigest,
        runtimeLinker: O.some(runtimeLinker),
        bun: current.source.toolchain.bun,
        biome: current.source.toolchain.biome,
        node: current.source.toolchain.node,
        installedDependencies: dependencies.tree,
        activation: request.activation,
        configurationDigest: current.source.configurationDigest,
        toolchainDigest: current.source.toolchainDigest,
        signedRootConfiguration,
        shadows,
        freshPairs,
        pairs,
      });
    }

    const runs: Array<CachePilotRun> = [];
    const checks: Array<CacheSyntheticCheck> = [];
    const shadowDecisions: Array<CachePilotShadow> = [];
    const mutations: Array<CachePilotMutation> = [];
    const nonExecutions: Array<CachePilotNonExecution> = [];
    const compare = (left: CachePilotRun, right: CachePilotRun, hashes: boolean) =>
      CachePilotOutcome.isAnyOf(["Executed"])(left.outcome) &&
      CachePilotOutcome.isAnyOf(["Executed"])(right.outcome) &&
      left.graphExitCode === 0 &&
      right.graphExitCode === 0 &&
      left.sourceTreeUnchanged &&
      right.sourceTreeUnchanged &&
      left.outcome.logSha256 === right.outcome.logSha256 &&
      (!hashes || left.outcome.selected.taskHash === right.outcome.selected.taskHash);
    if (request.selection === "full") {
      const runInitialComparisons = Effect.fn("CachePilot.runInitialComparisons")(function* () {
        for (let pair = 0; pair < 3; pair++) {
          const paired = yield* Effect.forEach(
            roots,
            (fixture) => execute(fixture, `fresh-${pair}-${fixture.label}`, false, false),
            { concurrency: 1 }
          );
          runs.push(...paired);
          checks.push(
            CacheSyntheticCheck.make({
              name: `fresh-pair-${pair}`,
              passed: compare(O.getOrThrow(A.get(paired, 0)), O.getOrThrow(A.get(paired, 1)), true),
            })
          );
        }
        const producer = yield* execute(firstRoot, "activation-producer", true, true);
        const replay = yield* execute(firstRoot, "activation-replay", true, true);
        runs.push(producer, replay);
        checks.push(
          CacheSyntheticCheck.make({
            name: "activation-capture-equivalence",
            passed: compare(O.getOrThrow(A.get(runs, 0)), producer, false),
          })
        );
        checks.push(
          CacheSyntheticCheck.make({
            name: "local-replay",
            passed:
              compare(producer, replay, true) &&
              CachePilotOutcome.isAnyOf(["Executed"])(replay.outcome) &&
              replay.outcome.selected.origin === "local-hit",
          })
        );
        const concurrent = yield* Effect.forEach(
          roots,
          (fixture) => execute(fixture, `concurrent-${fixture.label}`, false, false),
          { concurrency: 2 }
        );
        runs.push(...concurrent);
        checks.push(
          CacheSyntheticCheck.make({
            name: "concurrent-fresh-equivalence",
            passed: compare(O.getOrThrow(A.get(concurrent, 0)), O.getOrThrow(A.get(concurrent, 1)), true),
          })
        );
        const otherRoot = yield* execute(firstRoot, "alternate-absolute-root", false, false, "/fixture-other");
        runs.push(otherRoot);
        checks.push(
          CacheSyntheticCheck.make({
            name: "absolute-root-equivalence",
            passed: compare(O.getOrThrow(A.get(runs, 0)), otherRoot, true),
          })
        );
        if (A.some(checks, (check) => !check.passed)) {
          const failed = yield* CacheSyntheticCheck.pipe(S.Array, JsonStringCodec).encode(
            A.filter(checks, (check) => !check.passed)
          );
          const observations = yield* CachePilotRun.pipe(S.Array, JsonStringCodec).encode(runs);
          return yield* CacheCommandError.new(
            `Initial real-pilot comparisons diverged; local reuse has stopped. Checks: ${failed}. Runs: ${observations}`
          );
        }
      });
      yield* runInitialComparisons();
      const baseline = O.getOrThrow(A.get(runs, 0));
      const equivalentShadowReplay = (authoritative: CachePilotRun, produced: CachePilotRun, replayed: CachePilotRun) =>
        compare(authoritative, produced, false) &&
        compare(produced, replayed, true) &&
        CachePilotOutcome.isAnyOf(["Executed"])(replayed.outcome) &&
        replayed.outcome.selected.origin === "local-hit";
      const runShadowComparisons = Effect.fn("CachePilot.runShadowComparisons")(function* () {
        for (const scenario of scenarios) {
          const writer = yield* prepare(sourceRootA, "root-a", `shadow-${scenario.id}-a`);
          const reader = yield* prepare(sourceRootB, "root-b", `shadow-${scenario.id}-b`);
          yield* Effect.forEach([writer, reader], (fixture) => applyShadowSource(fixture, scenario), {
            concurrency: 1,
            discard: true,
          });
          const authoritative = yield* execute(
            writer,
            `shadow-${scenario.id}-authoritative`,
            false,
            false,
            scenario.guest,
            scenario.env
          );
          const produced = yield* execute(
            writer,
            `shadow-${scenario.id}-producer`,
            true,
            true,
            scenario.guest,
            scenario.env
          );
          yield* fs.copy(path.join(writer.directory, "cache"), path.join(reader.directory, "cache"));
          const replayed = yield* execute(reader, `shadow-${scenario.id}-replay`, true, true, "/fixture", scenario.env);
          runs.push(authoritative, produced, replayed);
          const equivalent = equivalentShadowReplay(authoritative, produced, replayed);
          const sameInputHash =
            CachePilotOutcome.isAnyOf(["Executed"])(baseline.outcome) &&
            CachePilotOutcome.isAnyOf(["Executed"])(authoritative.outcome) &&
            baseline.outcome.selected.taskHash === authoritative.outcome.selected.taskHash;
          const inputHashExpectationMet = scenario.expectedInputHash === "stable" ? sameInputHash : !sameInputHash;
          shadowDecisions.push(
            CachePilotShadow.make({
              id: scenario.id,
              authoritative: authoritative.id,
              producer: produced.id,
              replay: replayed.id,
              environmentNames: A.sort(R.keys(scenario.env), Order.String),
              expectedInputHash: scenario.expectedInputHash,
              inputHashExpectationMet,
              equivalent,
            })
          );
          checks.push(CacheSyntheticCheck.make({ name: `shadow-${scenario.id}`, passed: equivalent }));
          checks.push(CacheSyntheticCheck.make({ name: `input-${scenario.id}`, passed: inputHashExpectationMet }));
          if (!equivalent || !inputHashExpectationMet)
            return yield* CacheCommandError.new(`Real pilot shadow ${scenario.id} diverged; local reuse has stopped.`);
        }
      });
      yield* runShadowComparisons();
      const runFailedSourceControl = Effect.fn("CachePilot.runFailedSourceControl")(function* () {
        const failedFixture = yield* prepare(sourceRoots[0], "root-a", "failed-source");
        yield* writeContainedFileString(failedFixture.identity, "src/index.ts", "export const = ;\n");
        const firstFailure = yield* execute(failedFixture, "invalid-source-first", true, true);
        const secondFailure = yield* execute(failedFixture, "invalid-source-repeat", true, true);
        runs.push(firstFailure, secondFailure);
        const failureNotReused = A.every(
          [firstFailure, secondFailure],
          (run) =>
            run.graphExitCode !== 0 &&
            CachePilotOutcome.isAnyOf(["Executed"])(run.outcome) &&
            run.outcome.selected.exitCode !== 0 &&
            run.outcome.selected.origin === "fresh"
        );
        checks.push(CacheSyntheticCheck.make({ name: "failed-source-not-reused", passed: failureNotReused }));
      });
      yield* runFailedSourceControl();
    }
    const mutationIds = LiteralKit([
      "root-task-config",
      "child-task-config",
      "missing-child-config",
      "root-lint-config",
      "lockfile",
      "package-manager",
      "generated-alias",
      "dependency-source",
    ]);
    const validMutationReplay = (
      seeded: CachePilotRun,
      changed: CachePilotRun,
      replayed: CachePilotRun,
      expectedBaselineExit: number
    ) =>
      CachePilotOutcome.isAnyOf(["Executed"])(seeded.outcome) &&
      CachePilotOutcome.isAnyOf(["Executed"])(changed.outcome) &&
      CachePilotOutcome.isAnyOf(["Executed"])(replayed.outcome) &&
      seeded.graphExitCode === expectedBaselineExit &&
      seeded.outcome.selected.origin === "fresh" &&
      changed.outcome.selected.origin === "fresh" &&
      seeded.outcome.selected.taskHash !== changed.outcome.selected.taskHash &&
      compare(changed, replayed, true) &&
      replayed.outcome.selected.origin === "local-hit";
    const runMutationControls = Effect.fn("CachePilot.runMutationControls")(function* () {
      const runMutationControl = Effect.fn("CachePilot.runMutationControl")(function* (id: typeof mutationIds.Type) {
        const fixture = yield* prepare(sourceRoots[0], "root-a", `mutation-${id}`);
        const expectedBaselineExit = A.contains(
          mutationIds.pick(["root-lint-config", "dependency-source"]).literals,
          id
        )
          ? 1
          : 0;
        if (id === "root-lint-config")
          yield* writeContainedFileString(fixture.identity, "src/index.ts", "export const = ;\n");
        if (id === "dependency-source") {
          yield* writeContainedFileString(
            fixture.identity,
            "src/qualification-dependency.ts",
            'import { qualificationDependency } from "../../../primitive/types/src/index.ts";\n\nexport const qualificationValue = qualificationDependency;\n'
          );
          const dependencySource = yield* readBytes(fixture.types, "src/index.ts").pipe(Effect.flatMap(decodeText));
          yield* writeContainedFileString(
            fixture.types,
            "src/index.ts",
            `${dependencySource}\n/** @deprecated qualification dependency control */\nexport const qualificationDependency = 1;\n`
          );
        }
        const env = { QUALIFICATION_CONFIG_INPUT: "changed", QUALIFICATION_CHILD_INPUT: "changed" };
        const seeded = yield* execute(fixture, `${id}-baseline`, true, true, "/fixture", env);
        let changedFixture = fixture;
        let changedPath = "turbo.json";
        let original = yield* readBytes(fixture.source, changedPath).pipe(Effect.flatMap(decodeText));
        let changedText = original;
        const changeChildConfiguration = Effect.fn("CachePilot.changeChildConfiguration")(function* () {
          changedPath = `${identityDirectory}/turbo.json`;
          original = fixture.after;
          if (id === "missing-child-config") changedFixture = PilotRoot.make({ ...fixture, omitChild: true });
          else {
            const change = Effect.fn("CachePilot.changeChild")(function* (text: string) {
              const config = yield* decodeJsoncTextAs(S.JsonObject)(text);
              const tasks = yield* decodeJsonObject(config.tasks);
              const lint = yield* decodeJsonObject(tasks.lint);
              const declared = yield* decodeArrayString(lint.env);
              const encoded = yield* JsonStringCodec(S.JsonObject).encode(
                R.set(
                  config,
                  "tasks",
                  R.set(tasks, "lint", R.set(lint, "env", A.append(declared, "QUALIFICATION_CHILD_INPUT")))
                )
              );
              yield* writeContainedFileString(fixture.identity, "turbo.json", encoded);
              const formatted = yield* invoke(fixture, "/fixture", [
                "/bin/sh",
                "-c",
                `exec /tools/biome format --stdin-file-path=/fixture/${identityDirectory}/turbo.json < /fixture/${identityDirectory}/turbo.json`,
              ]);
              if (formatted.exitCode !== 0 || formatted.truncated)
                return yield* CacheCommandError.new("Cannot format the child-config control with pinned Biome.");
              return formatted.stdout;
            });
            changedText = yield* change(fixture.after);
            changedFixture = PilotRoot.make({ ...fixture, before: yield* change(fixture.before), after: changedText });
          }
        });
        const changeRootMetadata = Effect.fn("CachePilot.changeRootMetadata")(function* () {
          changedPath = mutationIds.$match({
            "root-lint-config": () => "biome.jsonc",
            lockfile: () => "bun.lock",
            "package-manager": () => "package.json",
            "generated-alias": () => "tsconfig.json",
            "root-task-config": () => "tsconfig.json",
            "child-task-config": () => "tsconfig.json",
            "missing-child-config": () => "tsconfig.json",
            "dependency-source": () => "tsconfig.json",
          })(id);
          original = yield* readBytes(fixture.source, changedPath).pipe(Effect.flatMap(decodeText));
          const config = yield* decodeJsoncTextAs(S.JsonObject)(original);
          if (id === "root-lint-config") {
            const files = yield* decodeJsonObject(config.files);
            const includes = yield* decodeArrayString(files.includes);
            changedText = yield* JsonStringCodec(S.JsonObject).encode(
              R.set(config, "files", R.set(files, "includes", A.append(includes, "!**/src/index.ts")))
            );
          } else if (id === "lockfile") {
            const packages = yield* decodeJsonObject(config.packages);
            const dependency = yield* decodeNonEmptyArrayJson(packages.effect);
            const descriptor = yield* decodeNonEmptyString(dependency[0]);
            changedText = yield* JsonStringCodec(S.JsonObject).encode(
              R.set(
                config,
                "packages",
                R.set(packages, "effect", [`${descriptor}-qualification`, ...A.drop(dependency, 1)])
              )
            );
          } else if (id === "package-manager") {
            changedText = yield* JsonStringCodec(S.JsonObject).encode(R.set(config, "packageManager", "bun@1.4.1"));
          } else {
            const options = yield* decodeJsonObject(config.compilerOptions);
            const aliases = yield* decodeJsonObject(options.paths);
            changedText = yield* JsonStringCodec(S.JsonObject).encode(
              R.set(
                config,
                "compilerOptions",
                R.set(
                  options,
                  "paths",
                  R.set(aliases, "@beep/qualification-alias", [`./${identityDirectory}/src/index.ts`])
                )
              )
            );
          }
        });
        const applyMutation = Effect.fn("CachePilot.applyMutation")(function* () {
          if (id === "root-task-config") {
            const config = yield* decodeJsoncTextAs(S.JsonObject)(original);
            const global = yield* decodeJsonObject(config.global);
            const declared = yield* decodeArrayString(global.env);
            changedText = yield* JsonStringCodec(S.JsonObject).encode(
              R.set(config, "global", R.set(global, "env", A.append(declared, "QUALIFICATION_CONFIG_INPUT")))
            );
          } else if (id === "child-task-config" || id === "missing-child-config") {
            yield* changeChildConfiguration();
          } else if (id === "dependency-source") {
            changedPath = `${typesDirectory}/src/index.ts`;
            original = yield* readBytes(fixture.types, "src/index.ts").pipe(Effect.flatMap(decodeText));
            changedText = Str.replace("/** @deprecated qualification dependency control */\n", "")(original);
            yield* writeContainedFileString(fixture.types, "src/index.ts", changedText);
          } else {
            yield* changeRootMetadata();
          }
        });
        yield* applyMutation();
        if (
          !A.contains(mutationIds.pick(["child-task-config", "missing-child-config", "dependency-source"]).literals, id)
        )
          changedFixture = yield* overlayRootFile(fixture, changedPath, changedText);
        if (needsProfile && id === "root-lint-config")
          changedFixture = yield* overlayRootFile(
            changedFixture,
            "biome.identity.jsonc",
            yield* renderCacheIdentityLintProfile(changedText)
          );
        const changed = yield* execute(changedFixture, `${id}-changed`, true, true, "/fixture", env);
        const replayed = yield* execute(changedFixture, `${id}-replay`, true, true, "/fixture", env);
        runs.push(seeded, changed, replayed);
        const passed = validMutationReplay(seeded, changed, replayed, expectedBaselineExit);
        mutations.push(
          CachePilotMutation.make({
            id,
            changedPath,
            beforeSha256: yield* hashText(original),
            afterSha256: id === "missing-child-config" ? O.none() : O.some(yield* hashText(changedText)),
            baseline: seeded.id,
            changed: changed.id,
            replay: replayed.id,
            expectedBaselineExit,
            expectedChangedExit: 0,
            passed,
          })
        );
        checks.push(CacheSyntheticCheck.make({ name: `invalidation-${id}`, passed }));
        return passed;
      });
      for (const id of mutationIds.literals) {
        if (!(yield* runMutationControl(id))) break;
      }
    });
    yield* runMutationControls();
    // These controls disable reuse and remain independent of a failed replay comparison.
    const prepareNonExecution = Effect.fn("CachePilot.prepareNonExecution")(function* (
      reason: CachePilotNonExecution["reason"]
    ) {
      let fixture = yield* prepare(sourceRoots[0], "root-a", `non-execution-${reason}`);
      if (reason === "missing-root-config")
        fixture = PilotRoot.make({ ...fixture, omitted: ["turbo.json", "turbo.jsonc"] });
      else if (reason === "malformed-root-config") fixture = yield* overlayRootFile(fixture, "turbo.json", '{"tasks":');
      else if (reason === "malformed-child-config")
        yield* writeContainedFileString(fixture.identity, "turbo.json", '{"tasks":');
      else {
        const manifest = yield* readBytes(fixture.identity, "package.json").pipe(
          Effect.flatMap(decodeText),
          Effect.flatMap(decodeJsoncTextAs(S.JsonObject))
        );
        const scripts = yield* decodeJsonObject(manifest.scripts);
        yield* writeContainedFileString(
          fixture.identity,
          "package.json",
          yield* JsonStringCodec(S.JsonObject).encode(R.set(manifest, "scripts", R.remove(scripts, "lint")))
        );
      }
      return fixture;
    });
    const observeSelectedExecution = Effect.fn("CachePilot.observeSelectedExecution")(function* (
      fixture: PilotRoot,
      names: ReadonlyArray<string>
    ) {
      if (names.length !== 1) return false;
      const native = yield* readBytes(fixture.directory, `run/runs/${O.getOrThrow(A.head(names))}`).pipe(
        Effect.flatMap(decodeText),
        Effect.flatMap(JsonStringCodec(NativeSummary).decode)
      );
      return A.some(
        native.tasks,
        (task) =>
          task.taskId === identityTask &&
          task.command !== "<NONEXISTENT>" &&
          Str.trim(task.command) !== "" &&
          O.isSome(task.execution)
      );
    });
    const runNonExecutionControls = Effect.fn("CachePilot.runNonExecutionControls")(function* () {
      const runNonExecutionControl = Effect.fn("CachePilot.runNonExecutionControl")(function* (
        reason: CachePilotNonExecution["reason"]
      ) {
        const fixture = yield* prepareNonExecution(reason);
        const captured = yield* invoke(fixture, "/fixture", [
          "/tools/turbo",
          "run",
          "lint",
          "--filter=@beep/identity",
          "--no-daemon",
          "--cache=local:",
          "--env-mode=strict",
          "--summarize",
          "--output-logs=full",
          "--log-order=grouped",
          "--log-prefix=task",
          "--ui=stream",
        ]);
        if (captured.truncated)
          return yield* CacheCommandError.new("A native non-execution control exceeded its capture bound.");
        const summaryDirectory = path.join(fixture.directory, "run/runs");
        const names = (yield* fs.exists(summaryDirectory)) ? yield* fs.readDirectory(summaryDirectory) : [];
        const summaryPresent = names.length === 1;
        const selectedExecutionObserved = yield* observeSelectedExecution(fixture, names);
        const expectedDiagnostic = matchesNonExecutionDiagnostic(reason, captured.stderr);
        const passed =
          !selectedExecutionObserved &&
          (reason === "absent-script"
            ? captured.exitCode === 0 && summaryPresent
            : captured.exitCode !== 0 && !summaryPresent && expectedDiagnostic);
        nonExecutions.push(
          CachePilotNonExecution.make({
            id: reason,
            reason,
            exitCode: captured.exitCode,
            stdoutSha256: yield* hashText(captured.stdout),
            stderrSha256: yield* hashText(captured.stderr),
            summaryPresent,
            selectedExecutionObserved,
            passed,
          })
        );
        checks.push(CacheSyntheticCheck.make({ name: `non-execution-${reason}`, passed }));
        if (!passed) {
          const diagnostics = `.beep/cache/pilot-observations/${path.basename(experiment)}/${reason}`;
          yield* writeContainedFileString(root, `${diagnostics}/stdout.txt`, captured.stdout);
          yield* writeContainedFileString(root, `${diagnostics}/stderr.txt`, captured.stderr);
          yield* Effect.logWarning(`Native control mismatch; bounded private diagnostics: ${diagnostics}`);
          return false;
        }
        return true;
      });
      for (const reason of CachePilotNonExecution.fields.reason.literals) {
        if (!(yield* runNonExecutionControl(reason))) break;
      }
    });
    yield* runNonExecutionControls();
    yield* verifyFinalIntegrity();
    yield* Effect.logInfo(
      `Pilot ${request.channel}: completed ${runs.length} observations and ${checks.length} checks.`
    );
    return CachePilotReceipt.make({
      schemaVersion: "cache-pilot-local/v5",
      clientSelection: "pinned-native-skip-infer",
      runtimeKeying: "toolchain-sha256-env/v1",
      runtimeKeyDigest: runtimeIdentity.toolchainDigest,
      runtimeLinker: O.some(runtimeLinker),
      authority: "local-observation-only",
      key: current.source.key,
      sourceRevision: revision,
      channel: request.channel,
      client: request.client,
      bun: current.source.toolchain.bun,
      biome: current.source.toolchain.biome,
      node: current.source.toolchain.node,
      installedDependencies: dependencies.tree,
      activation: request.activation,
      configurationDigest: current.source.configurationDigest,
      toolchainDigest: current.source.toolchainDigest,
      runs,
      checks,
      shadowDecisions,
      selection: request.selection,
      mutations,
      nonExecutions,
      remaining: [
        "Complete native read/write and capture-adversary coverage",
        "Enforce verified runtime-key calculation in ordinary entrypoints before enabling live reuse",
        "Accepted signed remote comparisons and final qualification",
        ...(request.selection === "controls"
          ? ["Run the full matrix before using these control-only observations"]
          : []),
      ],
    });
  },
  Effect.scoped,
  CacheCommandError.mapError("Real pilot setup or execution failed.")
);

/**
 * Exercise pilot orchestration with supplied process and qualification services.
 *
 * **Example** (Reference the process-boundary test entrypoint)
 *
 * ```ts
 * import { runCachePilotForTesting } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof runCachePilotForTesting === "function")
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const runCachePilotForTesting = Effect.fn("CachePilot.runLocalForTesting")(function* (
  root: string,
  request: CachePilotRequest
) {
  return yield* runPilot(root, request).pipe(
    Effect.filterOrFail(S.is(CachePilotReceipt), () => CacheCommandError.new("Expected an offline pilot receipt."))
  );
});

/**
 * Execute admitted real-pilot comparisons in disposable overlays of read-only worktrees.
 *
 * **Details**
 * The live checkout, registered worktrees and Git metadata remain read-only.
 * Task-log/cache mounts and disposable namespace storage are writable; this
 * is not a complete write-trace audit. Returned local observations cannot
 * promote a qualification tuple.
 *
 * **Example** (Plan the admitted experiment)
 *
 * ```ts
 * import { runCachePilotExperiment } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof runCachePilotExperiment === "function")
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const runCachePilotExperiment = Effect.fn("Cache.runPilotExperiment")(function* (
  root: string,
  request: CachePilotRequest
) {
  return yield* withQualityAdmission(
    AdmissionRequest.make({
      kind: "review-fix",
      weightTokens: 1,
      priority: "verify",
      originKey: "",
      checkoutRoot: root,
      branch: "",
      command: "bun run beep cache pilot",
    }),
    noAdmissionOriginGate,
    runCachePilotForTesting(root, request)
  );
}, CacheCommandError.mapError("Real pilot admission or execution failed."));

/**
 * Execute signed real-pilot pairs inside a supervisor-owned private network.
 *
 * **Details**
 * Derives a distinct private-loopback profile from the reviewed base activation
 * and requires clean registered
 * source roots. The caller owns admission and the outer namespace. Returned
 * observations do not establish protected-producer or qualification authority.
 *
 * **Example** (Reference the signed worker)
 * ```ts
 * import { runCacheSignedPilotWorker } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof runCacheSignedPilotWorker === "function")
 * ```
 *
 * @internal
 * @category fixtures
 * @since 0.0.0
 */
export const runCacheSignedPilotWorker = Effect.fn("CachePilot.runSignedWorker")(function* (
  root: string,
  request: CachePilotRequest,
  protectedIssuerMaterial: O.Option<string> = O.none()
) {
  return yield* runPilot(root, request, "signed", protectedIssuerMaterial).pipe(
    Effect.filterOrFail(S.is(CacheSignedPilotReceipt), () => CacheCommandError.new("Expected a signed pilot receipt."))
  );
});
