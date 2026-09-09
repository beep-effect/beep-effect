/**
 * Admitted local execution of the real identity lint computation.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { CacheTaskConfiguration } from "@beep/repo-configs/cache";
import { LiteralKit, NonNegativeInt, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { GitObjectId } from "@beep/schema/Conformance";
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { Duration, Effect, FileSystem, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { readContainedFileBytesNoFollow, writeContainedFileString } from "../../internal/cli/FsGuards.ts";
import { OutputBound, runCapturedStreams } from "../../internal/process/index.ts";
import { AdmissionRequest } from "../../internal/repo-run/QualityScheduler.schemas.ts";
import { noAdmissionOriginGate, withQualityAdmission } from "../../internal/repo-run/QualityScheduler.ts";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";
import { resolveWorktreeContext } from "../Worktree/index.ts";
import { collectCacheCensus, joinCacheCensusPlan } from "./Cache.census.ts";
import { readCacheEvidenceBytes } from "./Cache.evidence.ts";
import { CacheSyntheticCheck, CacheSyntheticRun } from "./Cache.experiment.schemas.ts";
import { inspectCacheFixtureCapture } from "./Cache.experiment.ts";
import { extractCachePilotLog } from "./Cache.pilot.capture.ts";
import {
  CachePilotLogInput,
  CachePilotMutation,
  CachePilotNonExecution,
  CachePilotOutcome,
  CachePilotReceipt,
  CachePilotRun,
  CachePilotShadow,
  CachePilotTask,
} from "./Cache.pilot.schemas.ts";
import { CacheActivationPreview, CacheActivationRequest, CacheCommandError } from "./Cache.schemas.ts";
import { CacheQualificationService } from "./Cache.service.ts";
import type * as Crypto from "effect/Crypto";
import type * as PlatformError from "effect/PlatformError";
import type { FsGuardError } from "../../internal/cli/FsGuards.ts";
import type { CachePilotRequest } from "./Cache.pilot.schemas.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.pilot");
const identityDirectory = "packages/foundation/modeling/identity";
const typesDirectory = "packages/foundation/primitive/types";
const identityTask = "@beep/identity#lint";
const typesTask = "@beep/types#lint";
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
  execution: S.OptionFromOptionalKey(S.Struct({ exitCode: S.OptionFromOptionalKey(S.Int) })),
});
const NativeSummary = S.Struct({ tasks: S.Array(NativeTask) });
class PilotFile extends S.Class<PilotFile>($I`PilotFile`)(
  { path: S.NonEmptyString, mode: NonNegativeInt, sha256: Sha256Hex },
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
    id: S.NonEmptyString,
    sourceChange: LiteralKit(["none", "source-comment", "added-source", "readme"]),
    env: S.Record(S.String, S.String),
    guest: S.NonEmptyString,
    expectedInputHash: CachePilotShadow.fields.expectedInputHash,
  },
  $I.annote("PilotShadowScenario", {
    description: "A fixed local perturbation with a declared task-hash expectation and separate fresh authority.",
  })
) {}

const readBytes = Effect.fn("CachePilot.readBytes")(function* (root: string, relative: string, limit = 1024 * 1024) {
  const result = yield* readContainedFileBytesNoFollow(root, relative, NonNegativeInt.make(limit));
  return yield* result.contents.pipe(
    Effect.fromOption(() => CacheCommandError.new("A required bounded pilot file is absent."))
  );
});
const decodeText = (bytes: Uint8Array) =>
  Effect.try({
    try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    catch: () => CacheCommandError.new("Pilot data is not valid UTF-8."),
  });
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
const hashExecutable = Effect.fn("CachePilot.hashExecutable")(function* (executable: string) {
  const path = yield* Path.Path;
  return yield* readBytes(path.dirname(executable), executable, 128 * 1024 * 1024).pipe(Effect.flatMap(hashBytes));
});
const inputDigest = Effect.fn("CachePilot.inputDigest")(function* (inputs: Readonly<Record<string, string>>) {
  const entries = A.sort(
    R.toEntries(inputs),
    Order.mapInput(Order.String, (entry: readonly [string, string]) => entry[0])
  );
  return yield* JsonStringCodec(InputEntries).encode(entries).pipe(Effect.flatMap(hashText));
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
    for (const name of A.sort(yield* fs.readDirectory(path.join(root, relative)), Order.String)) {
      if (relative === "" && name === ".turbo") continue;
      const child = path.join(relative, name);
      const info = yield* fs.stat(path.join(root, child));
      if (info.type === "Directory") yield* visit(child, depth + 1);
      else if (info.type === "File")
        files.push(
          PilotFile.make({
            path: child,
            mode: NonNegativeInt.make(info.mode & 0o777),
            sha256: yield* readBytes(root, child).pipe(Effect.flatMap(hashBytes)),
          })
        );
      else return yield* CacheCommandError.new("Pilot package source contains an unsupported file kind.");
    }
  });
  yield* visit("", 0);
  return yield* PilotFile.pipe(S.Array, JsonStringCodec).encode(files).pipe(Effect.flatMap(hashText));
});

const runPilot = Effect.fn("CachePilot.run")(
  function* (root: string, request: CachePilotRequest) {
    if (process.platform !== "linux" || process.arch !== "x64")
      return yield* CacheCommandError.new("The real pilot sandbox requires Linux x64.");
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
    const dependency = yield* A.findFirst(current.source.configuration.nodes, (node) => node.id === typesTask).pipe(
      Effect.fromOption(() => CacheCommandError.new("The real pilot's required types dependency is absent."))
    );
    if (dependency.configuration.cache)
      return yield* CacheCommandError.new("The unqualified types dependency must execute fresh.");
    const census = yield* collectCacheCensus(root);
    const context = yield* resolveWorktreeContext(root);
    const revision = yield* captureHost(root, ["rev-parse", "HEAD"]).pipe(
      Effect.flatMap(S.decodeUnknownEffect(GitObjectId))
    );
    const commonGit = yield* captureHost(root, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
    const sourceRoots = yield* Effect.forEach(request.worktrees, (source) => fs.realPath(source), { concurrency: 1 });
    if (sourceRoots[0] === sourceRoots[1])
      return yield* CacheCommandError.new("Cross-root pilot observations require two distinct registered worktrees.");
    for (const source of sourceRoots) {
      if (!A.some(context.entries, (entry) => entry.path === source && entry.head === revision) || source === root)
        return yield* CacheCommandError.new(
          "A pilot source is not a distinct registered worktree at the current revision."
        );
      if ((yield* captureHost(source, ["status", "--porcelain", "--untracked-files=all"])) !== "")
        return yield* CacheCommandError.new("Pilot source worktrees must be clean before read-only execution.");
    }
    const bun = yield* fs.realPath(process.execPath);
    const biome = yield* fs.realPath(request.biomeExecutable);
    const turbo = yield* fs.realPath(request.executable);
    const verifyTools = Effect.fn("CachePilot.verifyTools")(function* () {
      for (const [executable, expected] of [
        [bun, current.source.toolchain.bun.sha256],
        [biome, current.source.toolchain.biome.sha256],
        [turbo, request.client.sha256],
      ]) {
        if ((yield* hashExecutable(executable)) !== expected)
          return yield* CacheCommandError.new("A pilot executable differs from its exact content pin.");
      }
    });
    yield* verifyTools();
    if ((request.channel === "canary") !== Str.includes("-canary.")(request.client.version))
      return yield* CacheCommandError.new("Pilot client version and channel disagree.");
    if (
      request.channel === "stable" &&
      !S.toEquivalence(S.Struct({ version: S.String, sha256: Sha256Hex }))(
        request.client,
        current.source.toolchain.turbo
      )
    )
      return yield* CacheCommandError.new("Stable pilot client differs from the reviewed toolchain.");
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
      const directory = path.join(experiment, name);
      yield* fs.makeDirectory(directory);
      const identity = path.join(directory, "identity");
      const types = path.join(directory, "types");
      yield* fs.copy(path.join(source, identityDirectory), identity);
      yield* fs.copy(path.join(source, typesDirectory), types);
      for (const packageRoot of [identity, types]) {
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
        ...fixture.rootFiles,
        ".git": fixture.gitFile,
        ".turbo": path.join(fixture.directory, "run"),
        [identityDirectory]: fixture.identity,
        [typesDirectory]: fixture.types,
      };
      const mounts: Array<string> = [];
      const parents: Array<string> = [];
      const visit = Effect.fn("CachePilot.mountVisit")(function* (
        relative: string
      ): Effect.fn.Return<void, PlatformError.PlatformError> {
        if (A.contains(fixture.omitted, relative)) return;
        const destination = path.join(guest, relative);
        const replacement = R.get(replacements, relative);
        if (O.isSome(replacement)) {
          mounts.push(relative === ".turbo" ? "--bind" : "--ro-bind", replacement.value, destination);
        } else if (relative === "" || A.some(R.keys(replacements), (key) => Str.startsWith(`${relative}/`)(key))) {
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
        } else mounts.push("--ro-bind", path.join(fixture.source, relative), destination);
      });
      yield* visit("");
      for (const [directory, name] of [
        [identityDirectory, "identity-log"],
        [typesDirectory, "types-log"],
      ])
        mounts.push("--bind", path.join(fixture.directory, name), path.join(guest, directory, ".turbo"));
      for (const parent of A.reverse(parents)) mounts.push("--remount-ro", parent);
      return mounts;
    });
    const invoke = Effect.fn("CachePilot.invoke")(function* (
      fixture: PilotRoot,
      guest: string,
      args: ReadonlyArray<string>,
      env: Readonly<Record<string, string>> = {}
    ) {
      for (const name of ["run", "identity-log", "types-log", "cache"])
        yield* fs.makeDirectory(path.join(fixture.directory, name), { recursive: true });
      return yield* runCapturedStreams({
        command: "/usr/bin/bwrap",
        args: [
          "--unshare-all",
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
          ...args,
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
        },
        bound: captureBound,
      }).pipe(Effect.timeout(Duration.seconds(60)));
    });
    const roots = [
      yield* prepare(sourceRoots[0], "root-a", "initial-a"),
      yield* prepare(sourceRoots[1], "root-b", "initial-b"),
    ];
    const firstRoot = O.getOrThrow(A.head(roots));
    for (const [executable, expected] of [
      ["bun", current.source.toolchain.bun.version],
      ["biome", current.source.toolchain.biome.version],
      ["turbo", request.client.version],
    ]) {
      const observed = yield* invoke(firstRoot, "/fixture", [`/tools/${executable}`, "--version"]);
      if (observed.exitCode !== 0 || observed.truncated || Str.trim(observed.stdout) !== expected)
        return yield* CacheCommandError.new(`Sandbox ${executable} version check failed (exit ${observed.exitCode}).`);
    }
    for (const fixture of roots) {
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
      const joined = yield* joinCacheCensusPlan(census.workspaces, plan);
      if (joined.length !== 2)
        return yield* CacheCommandError.new("Pilot graph differs from identity plus its types dependency.");
      for (const node of joined) {
        const expected = yield* A.findFirst(census.nodes, (row) => row.id === node.id).pipe(
          Effect.fromOption(() => CacheCommandError.new("Pilot dry node is absent from the current census."))
        );
        if (
          node.inputsDigest !== expected.inputsDigest ||
          node.commandDigest !== expected.commandDigest ||
          !S.toEquivalence(CacheTaskConfiguration)(node.configuration, expected.configuration)
        )
          return yield* CacheCommandError.new("Read-only pilot inputs or configuration differ from the live census.");
      }
    }
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
    const execute = Effect.fn("CachePilot.execute")(function* (
      fixture: PilotRoot,
      id: string,
      enabled: boolean,
      reuse: boolean,
      guest = "/fixture",
      env: Readonly<Record<string, string>> = {}
    ) {
      for (const name of ["run", "identity-log", "types-log"])
        yield* fs.remove(path.join(fixture.directory, name), { recursive: true, force: true });
      if (fixture.omitChild) yield* fs.remove(path.join(fixture.identity, "turbo.json"), { force: true });
      else yield* writeContainedFileString(fixture.identity, "turbo.json", enabled ? fixture.after : fixture.before);
      const beforeTrees = yield* Effect.all([snapshot(fixture.identity), snapshot(fixture.types)], { concurrency: 2 });
      const captured = yield* invoke(
        fixture,
        guest,
        [
          "/tools/turbo",
          "run",
          "lint",
          "--filter=@beep/identity",
          "--no-daemon",
          `--cache=${reuse ? "local:rw" : "local:"}`,
          "--cache-dir=/cache",
          "--env-mode=strict",
          "--summarize",
          "--output-logs=full",
          "--log-order=grouped",
          "--log-prefix=task",
          "--ui=stream",
          "--concurrency=1",
        ],
        env
      );
      if (captured.truncated) return yield* CacheCommandError.new("Pilot process capture exceeded its bound.");
      const names = yield* fs.readDirectory(path.join(fixture.directory, "run/runs"));
      if (names.length !== 1)
        return yield* CacheCommandError.new("Pilot did not produce exactly one native run summary.");
      const bytes = yield* readBytes(fixture.directory, `run/runs/${O.getOrThrow(A.head(names))}`);
      const summary = yield* decodeText(bytes).pipe(Effect.flatMap(JsonStringCodec(NativeSummary).decode));
      const dependencies = yield* Effect.forEach(
        A.filter(summary.tasks, (task) => task.taskId !== identityTask),
        taskObservation,
        { concurrency: 1 }
      );
      if (A.some(dependencies, (task) => task.computation !== typesTask || task.origin !== "fresh"))
        return yield* CacheCommandError.new("Pilot dependency was unexpected or reused an unqualified artifact.");
      const selected = A.filter(summary.tasks, (task) => task.taskId === identityTask);
      if (selected.length > 1) return yield* CacheCommandError.new("Native pilot summary repeated the selected task.");
      const afterTrees = yield* Effect.all([snapshot(fixture.identity), snapshot(fixture.types)], { concurrency: 2 });
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
          const observation = yield* taskObservation(task);
          if (task.command !== "bun run beep:lint" || (captured.exitCode === 0) !== (observation.exitCode === 0))
            return yield* CacheCommandError.new("Selected pilot command or verdict disagrees with its graph.");
          const text = yield* extractCachePilotLog(
            CachePilotLogInput.make({
              computation: identityTask,
              taskHash: task.hash,
              origin: observation.origin,
              cacheEnabled: enabled,
              stdout: captured.stdout,
              stderr: captured.stderr,
              truncated: captured.truncated,
            })
          );
          if (
            A.isReadonlyArrayNonEmpty(inspectCacheFixtureCapture(text, false)) ||
            Str.includes("qualification-canary")(text)
          )
            return yield* CacheCommandError.new("Selected pilot capture exposed an unsafe canary or absolute path.");
          const logNames = yield* fs.readDirectory(path.join(fixture.directory, "identity-log"));
          if (A.some(logNames, (name) => name !== "turbo-lint.log"))
            return yield* CacheCommandError.new(
              "Pilot produced an undeclared persistent output beside its replay log."
            );
          const log = yield* readContainedFileBytesNoFollow(
            fixture.directory,
            "identity-log/turbo-lint.log",
            NonNegativeInt.make(64 * 1024)
          );
          const replayLogMatches =
            O.isSome(log.contents) && (yield* hashBytes(log.contents.value)) === (yield* hashText(text));
          if (enabled && !replayLogMatches)
            return yield* CacheCommandError.new("Enabled pilot execution omitted an identical bounded replay log.");
          return CachePilotOutcome.cases.Executed.make({
            selected: observation,
            logSha256: yield* hashText(text),
            logBytes: NonNegativeInt.make(new TextEncoder().encode(text).byteLength),
            replayLogMatches,
          });
        }),
      });
      return CachePilotRun.make({
        id,
        root: fixture.label,
        cacheEnabled: enabled,
        graphExitCode: captured.exitCode,
        outcome,
        dependencies,
        summarySha256: yield* hashBytes(bytes),
        sourceTreeUnchanged,
      });
    });
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
      for (let pair = 0; pair < 3; pair++) {
        const paired = yield* Effect.forEach(
          roots,
          (fixture) => execute(fixture, `fresh-${pair}-${fixture.label}`, false, false),
          { concurrency: 1 }
        );
        runs.push(...paired);
        checks.push(
          CacheSyntheticCheck.make({ name: `fresh-pair-${pair}`, passed: compare(paired[0], paired[1], true) })
        );
      }
      const producer = yield* execute(firstRoot, "activation-producer", true, true);
      const replay = yield* execute(firstRoot, "activation-replay", true, true);
      runs.push(producer, replay);
      checks.push(
        CacheSyntheticCheck.make({ name: "activation-capture-equivalence", passed: compare(runs[0], producer, false) })
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
          passed: compare(concurrent[0], concurrent[1], true),
        })
      );
      const otherRoot = yield* execute(firstRoot, "alternate-absolute-root", false, false, "/fixture-other");
      runs.push(otherRoot);
      checks.push(
        CacheSyntheticCheck.make({ name: "absolute-root-equivalence", passed: compare(runs[0], otherRoot, true) })
      );
      if (A.some(checks, (check) => !check.passed))
        return yield* CacheCommandError.new("Initial real-pilot comparisons diverged; local reuse has stopped.");
      const baseline = runs[0];
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
        PilotShadowScenario.make({ ...unchanged, id: "readme", sourceChange: "readme", expectedInputHash: "changed" }),
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
      for (const scenario of scenarios) {
        const writer = yield* prepare(sourceRoots[0], "root-a", `shadow-${scenario.id}-a`);
        const reader = yield* prepare(sourceRoots[1], "root-b", `shadow-${scenario.id}-b`);
        for (const fixture of [writer, reader]) {
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
            yield* writeContainedFileString(
              fixture.identity,
              "README.md",
              `${original}\nQualification shadow input.\n`
            );
          }
        }
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
        const equivalent =
          compare(authoritative, produced, false) &&
          compare(produced, replayed, true) &&
          CachePilotOutcome.isAnyOf(["Executed"])(replayed.outcome) &&
          replayed.outcome.selected.origin === "local-hit";
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
    }
    const mutationIds = LiteralKit([
      "root-task-config",
      "child-task-config",
      "missing-child-config",
      "root-lint-config",
      "lockfile",
      "package-manager",
      "generated-alias",
    ]);
    for (const id of mutationIds.Options) {
      const fixture = yield* prepare(sourceRoots[0], "root-a", `mutation-${id}`);
      const expectedBaselineExit = id === "root-lint-config" ? 1 : 0;
      if (id === "root-lint-config")
        yield* writeContainedFileString(fixture.identity, "src/index.ts", "export const = ;\n");
      const env = { QUALIFICATION_CONFIG_INPUT: "changed", QUALIFICATION_CHILD_INPUT: "changed" };
      const seeded = yield* execute(fixture, `${id}-baseline`, true, true, "/fixture", env);
      let changedFixture = fixture;
      let changedPath = "turbo.json";
      let original = yield* readBytes(fixture.source, changedPath).pipe(Effect.flatMap(decodeText));
      let changedText = original;
      if (id === "root-task-config") {
        const config = yield* decodeJsoncTextAs(S.JsonObject)(original);
        const global = yield* S.decodeUnknownEffect(S.JsonObject)(config.global);
        const declared = yield* S.decodeUnknownEffect(S.Array(S.String))(global.env);
        changedText = yield* JsonStringCodec(S.JsonObject).encode(
          R.set(config, "global", R.set(global, "env", A.append(declared, "QUALIFICATION_CONFIG_INPUT")))
        );
      } else if (id === "child-task-config" || id === "missing-child-config") {
        changedPath = `${identityDirectory}/turbo.json`;
        original = fixture.after;
        if (id === "missing-child-config") changedFixture = PilotRoot.make({ ...fixture, omitChild: true });
        else {
          const change = Effect.fn("CachePilot.changeChild")(function* (text: string) {
            const config = yield* decodeJsoncTextAs(S.JsonObject)(text);
            const tasks = yield* S.decodeUnknownEffect(S.JsonObject)(config.tasks);
            const lint = yield* S.decodeUnknownEffect(S.JsonObject)(tasks.lint);
            return yield* JsonStringCodec(S.JsonObject).encode(
              R.set(config, "tasks", R.set(tasks, "lint", R.set(lint, "env", ["QUALIFICATION_CHILD_INPUT"])))
            );
          });
          changedText = yield* change(fixture.after);
          changedFixture = PilotRoot.make({ ...fixture, before: yield* change(fixture.before), after: changedText });
        }
      } else {
        changedPath =
          id === "root-lint-config"
            ? "biome.jsonc"
            : id === "lockfile"
              ? "bun.lock"
              : id === "package-manager"
                ? "package.json"
                : "tsconfig.json";
        original = yield* readBytes(fixture.source, changedPath).pipe(Effect.flatMap(decodeText));
        const config = yield* decodeJsoncTextAs(S.JsonObject)(original);
        if (id === "root-lint-config") {
          const files = yield* S.decodeUnknownEffect(S.JsonObject)(config.files);
          const includes = yield* S.decodeUnknownEffect(S.Array(S.String))(files.includes);
          changedText = yield* JsonStringCodec(S.JsonObject).encode(
            R.set(config, "files", R.set(files, "includes", A.append(includes, "!**/src/index.ts")))
          );
        } else if (id === "lockfile") {
          const packages = yield* S.decodeUnknownEffect(S.JsonObject)(config.packages);
          const dependency = yield* S.decodeUnknownEffect(S.NonEmptyArray(S.Json))(packages.effect);
          const descriptor = yield* S.decodeUnknownEffect(S.NonEmptyString)(dependency[0]);
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
          const options = yield* S.decodeUnknownEffect(S.JsonObject)(config.compilerOptions);
          const aliases = yield* S.decodeUnknownEffect(S.JsonObject)(options.paths);
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
      }
      if (id !== "child-task-config" && id !== "missing-child-config")
        changedFixture = yield* overlayRootFile(fixture, changedPath, changedText);
      const changed = yield* execute(changedFixture, `${id}-changed`, true, true, "/fixture", env);
      const replayed = yield* execute(changedFixture, `${id}-replay`, true, true, "/fixture", env);
      runs.push(seeded, changed, replayed);
      const passed =
        CachePilotOutcome.isAnyOf(["Executed"])(seeded.outcome) &&
        CachePilotOutcome.isAnyOf(["Executed"])(changed.outcome) &&
        CachePilotOutcome.isAnyOf(["Executed"])(replayed.outcome) &&
        seeded.graphExitCode === expectedBaselineExit &&
        seeded.outcome.selected.origin === "fresh" &&
        changed.outcome.selected.origin === "fresh" &&
        seeded.outcome.selected.taskHash !== changed.outcome.selected.taskHash &&
        compare(changed, replayed, true) &&
        replayed.outcome.selected.origin === "local-hit";
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
      if (!passed) break;
    }
    if (A.every(checks, (check) => check.passed)) {
      for (const reason of CachePilotNonExecution.fields.reason.Options) {
        let fixture = yield* prepare(sourceRoots[0], "root-a", `non-execution-${reason}`);
        if (reason === "missing-root-config")
          fixture = PilotRoot.make({ ...fixture, omitted: ["turbo.json", "turbo.jsonc"] });
        else if (reason === "malformed-root-config")
          fixture = yield* overlayRootFile(fixture, "turbo.json", '{"tasks":');
        else if (reason === "malformed-child-config")
          yield* writeContainedFileString(fixture.identity, "turbo.json", '{"tasks":');
        else {
          const manifest = yield* readBytes(fixture.identity, "package.json").pipe(
            Effect.flatMap(decodeText),
            Effect.flatMap(decodeJsoncTextAs(S.JsonObject))
          );
          const scripts = yield* S.decodeUnknownEffect(S.JsonObject)(manifest.scripts);
          yield* writeContainedFileString(
            fixture.identity,
            "package.json",
            yield* JsonStringCodec(S.JsonObject).encode(R.set(manifest, "scripts", R.remove(scripts, "lint")))
          );
        }
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
        let selectedExecutionObserved = false;
        if (summaryPresent) {
          const native = yield* readBytes(fixture.directory, `run/runs/${O.getOrThrow(A.head(names))}`).pipe(
            Effect.flatMap(decodeText),
            Effect.flatMap(JsonStringCodec(NativeSummary).decode)
          );
          selectedExecutionObserved = A.some(
            native.tasks,
            (task) =>
              task.taskId === identityTask &&
              task.command !== "<NONEXISTENT>" &&
              Str.trim(task.command) !== "" &&
              O.isSome(task.execution)
          );
        }
        const error = Str.toLowerCase(captured.stderr);
        const expectedDiagnostic =
          reason === "missing-root-config"
            ? Str.includes("could not find turbo.json")(error)
            : Str.includes("failed to parse turbo.json")(error);
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
          break;
        }
      }
    }
    yield* verifyTools();
    if (!S.toEquivalence(CacheActivationPreview)(yield* cache.activation(root, activationRequest), current))
      return yield* CacheCommandError.new("Pilot source configuration drifted during execution.");
    for (const source of sourceRoots)
      if (
        (yield* captureHost(source, ["status", "--porcelain", "--untracked-files=all"])) !== "" ||
        (yield* captureHost(source, ["rev-parse", "HEAD"])) !== revision
      )
        return yield* CacheCommandError.new("Read-only pilot worktree changed during execution.");
    return CachePilotReceipt.make({
      schemaVersion: "cache-pilot-local/v2",
      authority: "local-observation-only",
      key: current.source.key,
      sourceRevision: revision,
      channel: request.channel,
      client: request.client,
      bun: current.source.toolchain.bun,
      biome: current.source.toolchain.biome,
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
 * @category operations
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
    runPilot(root, request)
  );
}, CacheCommandError.mapError("Real pilot admission or execution failed."));
