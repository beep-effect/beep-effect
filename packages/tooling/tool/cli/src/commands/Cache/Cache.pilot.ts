/**
 * Admitted local execution of the real identity lint computation.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { CacheTaskConfiguration } from "@beep/repo-configs/cache";
import { NonNegativeInt, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { GitObjectId } from "@beep/schema/Conformance";
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
  CachePilotOutcome,
  CachePilotReceipt,
  CachePilotRun,
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
  },
  $I.annote("PilotRoot", {
    description: "Owned disposable package overlays backed by a read-only registered worktree.",
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
      return PilotRoot.make({ label, source, directory, identity, types, gitFile, before, after });
    });
    const mountSource = Effect.fn("CachePilot.mountSource")(function* (fixture: PilotRoot, guest: string) {
      const replacements: Readonly<Record<string, string>> = {
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
        const destination = path.join(guest, relative);
        const replacement = R.get(replacements, relative);
        if (O.isSome(replacement)) {
          mounts.push(relative === ".turbo" ? "--bind" : "--ro-bind", replacement.value, destination);
        } else if (relative === "" || A.some(R.keys(replacements), (key) => Str.startsWith(`${relative}/`)(key))) {
          mounts.push("--dir", destination);
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
        return yield* CacheCommandError.new("Observed sandbox tool version differs from its reviewed pin.");
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
      yield* writeContainedFileString(fixture.identity, "turbo.json", enabled ? fixture.after : fixture.before);
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
    const compare = (left: CachePilotRun, right: CachePilotRun, hashes: boolean) =>
      CachePilotOutcome.isAnyOf(["Executed"])(left.outcome) &&
      CachePilotOutcome.isAnyOf(["Executed"])(right.outcome) &&
      left.graphExitCode === 0 &&
      right.graphExitCode === 0 &&
      left.sourceTreeUnchanged &&
      right.sourceTreeUnchanged &&
      left.outcome.logSha256 === right.outcome.logSha256 &&
      (!hashes || left.outcome.selected.taskHash === right.outcome.selected.taskHash);
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
      schemaVersion: "cache-pilot-local/v1",
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
      remaining: [
        "Complete semantic perturbations and ten representative shadow decisions",
        "Complete native read/write and capture-adversary coverage",
        "Accepted signed remote comparisons and final qualification",
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
 * Only owned task-log/cache directories are writable inside the network-isolated
 * namespace. Returned local observations cannot promote a qualification tuple.
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
