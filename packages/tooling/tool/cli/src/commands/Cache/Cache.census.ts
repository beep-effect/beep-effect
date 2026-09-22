/**
 * Exact-client discovery of executable workspace quality computations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { CacheTaskConfiguration } from "@beep/repo-configs/cache";
import { FsUtils, readPackageJsonFile, resolveWorkspacePackages } from "@beep/repo-utils";
import { NonNegativeInt, Sha256HexFromBytes } from "@beep/schema";
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { Duration, Effect, FileSystem, Match, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { hashFileSha256 } from "../../internal/cli/FsGuards.ts";
import { isTurboCacheControlArg } from "../../internal/cli/TurboCache.ts";
import { globMatches } from "../../internal/GlobPattern.ts";
import { OutputBound, runCaptured } from "../../internal/process/index.ts";
import {
  CacheCensusNode,
  CacheCensusReport,
  CacheCensusSource,
  CacheCensusWorkspace,
  CacheCommandError,
} from "./Cache.schemas.ts";

// Turbo's wire objects are decoded before producing the public census model.
const TurboWorkspaceList = S.Struct({
  packages: S.Struct({ items: S.Array(S.Struct({ name: S.String, path: S.String })) }),
});
const TurboConfiguration = S.Struct({ tasks: S.Record(S.String, S.Unknown) });
const TurboDefinition = S.Struct({
  ...CacheTaskConfiguration.fields,
  passThroughEnv: S.String.pipe(S.Array, S.OptionFromNullOr),
});
const encodeInputEntries = S.Tuple([S.String, S.String]).pipe(S.Array, S.fromJsonString, S.encodeEffect);
const TurboPlan = S.Struct({
  tasks: S.Array(
    S.Struct({
      taskId: S.NonEmptyString,
      task: S.NonEmptyString,
      package: S.NonEmptyString,
      command: S.String,
      dependencies: S.Array(S.String),
      inputs: S.Record(S.String, S.String),
      resolvedTaskDefinition: TurboDefinition,
    })
  ),
});

const TurboRuntimePlan = S.Struct({
  ...TurboPlan.fields,
  envMode: S.Literals(["strict", "loose"]),
  globalCacheInputs: S.Struct({
    environmentVariables: S.Struct({
      specified: S.Struct({
        env: S.Array(S.String),
        passThroughEnv: S.Array(S.String).pipe(S.OptionFromNullOr),
      }),
    }),
  }),
});
const decodeTurboRuntimePlanJson = S.decodeUnknownEffect(S.fromJsonString(TurboRuntimePlan));

/**
 * Resolve an already-installed native Turbo binary without launcher overrides or installation fallback.
 *
 * **Example** (Plan native client resolution)
 *
 * ```ts
 * import { resolveCacheTurboBinary } from "@beep/repo-cli/commands/Cache"
 * import * as Effect from "effect/Effect"
 * console.assert(Effect.isEffect(resolveCacheTurboBinary("/repo")))
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const resolveCacheTurboBinary = Effect.fn("Cache.resolveTurboBinary")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const platform = yield* Match.value(process.platform).pipe(
    Match.when("linux", () => Effect.succeed("linux")),
    Match.when("darwin", () => Effect.succeed("darwin")),
    Match.when("win32", () => Effect.succeed("windows")),
    Match.orElse(() => Effect.fail(CacheCommandError.new("Native Turbo discovery does not support this platform.")))
  );
  const arch = yield* Match.value(process.arch).pipe(
    Match.when("x64", () => Effect.succeed("64")),
    Match.when("arm64", () => Effect.succeed("arm64")),
    Match.orElse(() => Effect.fail(CacheCommandError.new("Native Turbo discovery does not support this architecture.")))
  );
  const suffix = platform === "windows" ? ".exe" : "";
  for (const packageName of [`@turbo/${platform}-${arch}`, `turbo-${platform}-${arch}`]) {
    const candidate = path.join(root, "node_modules", packageName, "bin", `turbo${suffix}`);
    if (yield* fs.exists(candidate)) return yield* fs.realPath(candidate);
  }
  return yield* CacheCommandError.new("Native Turbo is not installed; discovery will not install or emulate a client.");
}, CacheCommandError.mapError("Cannot resolve the installed native Turbo client."));

const CENSUS_CAPTURE_MAX_CHARS = 512 * 1024 * 1024;

const capture = Effect.fn("CacheCensus.capture")(function* (
  root: string,
  command: string,
  args: ReadonlyArray<string>
) {
  const result = yield* runCaptured({
    command,
    args,
    cwd: root,
    source: "stdout",
    // Whole-tree root tasks list every matched file in the dry run, so the JSON is far larger
    // than the package-only graph the bound was sized for (C3.5).
    bound: OutputBound.make({ maxChars: CENSUS_CAPTURE_MAX_CHARS, truncatedNotice: "[census output truncated]" }),
    timeout: Duration.seconds(180),
    env: {
      TURBO_TOKEN: "",
      TURBO_TEAM: "",
      TURBO_API: "",
      TURBO_REMOTE_CACHE_SIGNATURE_KEY: "",
      TURBO_TELEMETRY_DISABLED: "1",
      TURBO_BINARY_PATH: "",
    },
    extendEnv: true,
  }).pipe(CacheCommandError.mapError("Unable to collect census subprocess output."));
  if (result.exitCode !== 0 || result.truncated) {
    return yield* CacheCommandError.new("Census subprocess failed or exceeded its 512 MiB capture bound.");
  }
  return result.output;
});
const hashBytes = S.decodeEffect(Sha256HexFromBytes);

/**
 * Join a decoded exact-client graph to script presence, rejecting command and workspace mismatches.
 *
 * **Example** (Reject a malformed dry plan)
 *
 * ```ts
 * import { joinCacheCensusPlan } from "@beep/repo-cli/test/Cache"
 * import * as Effect from "effect/Effect"
 * const invalid = joinCacheCensusPlan([], { tasks: [] })
 * console.assert(Effect.isEffect(invalid))
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const joinCacheCensusPlan = Effect.fn("CacheCensus.joinPlan")(function* (
  workspaces: ReadonlyArray<CacheCensusWorkspace>,
  dry: typeof TurboPlan.Type
) {
  const ids = A.map(dry.tasks, (node) => node.taskId);
  if (A.length(A.dedupe(ids)) !== A.length(ids)) {
    return yield* CacheCommandError.new("Dry plan contains duplicate task identities.");
  }
  return yield* Effect.forEach(
    dry.tasks,
    Effect.fn("CacheCensus.joinNode")(function* (node) {
      if (node.taskId !== `${node.package}#${node.task}`) {
        return yield* CacheCommandError.new("Dry plan task identity disagrees with its workspace and task.");
      }
      const workspace = yield* A.findFirst(workspaces, (workspace) => workspace.name === node.package).pipe(
        Effect.fromOption(() => CacheCommandError.new(`Dry plan contains an undeclared workspace: ${node.package}.`))
      );
      const command = R.get(workspace.scripts, node.task).pipe(O.filter((value) => Str.isNonEmpty(Str.trim(value))));
      if (O.isSome(command) && command.value !== node.command) {
        return yield* CacheCommandError.new("Manifest script differs from the exact Turbo dry command.");
      }
      const sortedInputs = A.sort(
        R.toEntries(node.inputs),
        Order.mapInput(Order.String, (entry: readonly [string, string]) => entry[0])
      );
      const inputJson = yield* encodeInputEntries(sortedInputs);
      const inputsDigest = yield* hashBytes(new TextEncoder().encode(inputJson));
      const scriptJson = yield* encodeInputEntries(
        A.sort(
          R.toEntries(workspace.scripts),
          Order.mapInput(Order.String, (entry: readonly [string, string]) => entry[0])
        )
      );
      const commandDigest = yield* hashBytes(new TextEncoder().encode(scriptJson));
      return CacheCensusNode.make({
        id: node.taskId,
        workspace: node.package,
        task: node.task,
        command,
        commandDigest,
        dependencies: node.dependencies,
        configuration: CacheTaskConfiguration.make({
          ...node.resolvedTaskDefinition,
          passThroughEnv: O.getOrElse(node.resolvedTaskDefinition.passThroughEnv, A.empty<string>),
        }),
        inputCount: NonNegativeInt.make(A.length(sortedInputs)),
        inputsDigest,
      });
    }),
    { concurrency: 1 }
  );
}, CacheCommandError.mapError("Cannot join census graph and manifest scripts."));
const decodeTurboWorkspaceListJson = S.decodeUnknownEffect(S.fromJsonString(TurboWorkspaceList));

const decodeTurboConfiguration = S.decodeUnknownEffect(TurboConfiguration);

const decodeTurboPlanJson = S.decodeUnknownEffect(S.fromJsonString(TurboPlan));

/**
 * Identify explicit Turbo inspection modes before the task argument separator.
 *
 * **Example** (Recognize a dry plan option)
 *
 * ```ts
 * import { isCacheTaskInspectionArg } from "@beep/repo-cli/commands/Cache"
 * console.log(isCacheTaskInspectionArg("--dry=json")) // true
 * ```
 *
 * @param arg - A Turbo option before the task argument separator.
 * @returns Whether the option requests inspection instead of task execution.
 * @category predicates
 * @since 0.0.0
 */
export const isCacheTaskInspectionArg = (arg: string): boolean =>
  A.some(
    ["--dry", "--dry-run", "--graph", "--help", "--version", "-h", "-V"],
    (option) => arg === option || Str.startsWith(`${option}=`)(arg)
  );

/**
 * Prepare an execution invocation for bounded native task selection.
 *
 * **Details**
 * Task selectors and forwarded arguments retain their order. Existing cache
 * controls are replaced; explicit output modes and directory overrides are
 * rejected because this operation selects executable tasks in the supplied root.
 *
 * **Example** (Replace the execution cache posture)
 *
 * ```ts
 * import { cacheTaskSelectionArgs } from "@beep/repo-cli/commands/Cache"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.runSync(cacheTaskSelectionArgs(["run", "lint", "--cache=remote:r"])))
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const cacheTaskSelectionArgs = Effect.fn("Cache.taskSelectionArgs")(function* (args: ReadonlyArray<string>) {
  if (!O.exists(A.head(args), (arg) => arg === "run")) {
    return yield* CacheCommandError.new("Runtime selection requires an explicit Turbo run invocation.");
  }
  let selected: Array<string> = [];
  let cacheValuePending = false;
  let optionalBooleanPending = false;
  const [selectionArgs, forwardedArgs] = A.splitAt(
    args,
    O.getOrElse(
      A.findFirstIndex(args, (arg) => arg === "--"),
      () => A.length(args)
    )
  );
  yield* Effect.forEach(
    selectionArgs,
    Effect.fn("Cache.selectTaskArgument")(function* (arg) {
      if (cacheValuePending) {
        cacheValuePending = false;
        if (Str.startsWith("-")(arg) || Str.isEmpty(arg)) {
          return yield* CacheCommandError.new("Runtime selection received a missing cache option value.");
        }
        return;
      }
      const skipBoolean = optionalBooleanPending && A.contains(["true", "false"], arg);
      optionalBooleanPending = false;
      if (skipBoolean) return;
      return yield* Match.value(arg).pipe(
        Match.when(
          (value) =>
            isCacheTaskInspectionArg(value) ||
            A.some(
              ["--cwd", "--heap", "--profile", "--trace"],
              (option) => value === option || Str.startsWith(`${option}=`)(value)
            ),
          () => CacheCommandError.new("Runtime selection does not accept output modes or directory overrides.")
        ),
        Match.when("--cache", () =>
          Effect.sync(() => {
            cacheValuePending = true;
          })
        ),
        Match.when(isTurboCacheControlArg, (value) =>
          Effect.sync(() => {
            optionalBooleanPending = A.contains(["--force", "--remote-only", "--remote-cache-read-only"], value);
          })
        ),
        Match.orElse((value) =>
          Effect.sync(() => {
            selected = A.append(selected, value);
          })
        )
      );
    }),
    { discard: true }
  );
  if (cacheValuePending)
    return yield* CacheCommandError.new("Runtime selection received a missing cache option value.");
  return A.appendAll(A.appendAll(selected, ["--dry=json", "--cache=local:"]), forwardedArgs);
});

const validateIdentityProfileScope = Effect.fn("Cache.validateIdentityProfileScope")(function* (
  root: string,
  rows: ReadonlyArray<CacheCensusWorkspace>,
  nodes: ReadonlyArray<CacheCensusNode>,
  dry: typeof TurboRuntimePlan.Type
) {
  const paths = yield* Path.Path;
  const identity = yield* A.findFirst(nodes, (node) => node.id === "@beep/identity#lint").pipe(
    Effect.fromOption(() => CacheCommandError.new("Governed identity task is absent."))
  );
  if (
    !A.contains(identity.configuration.passThroughEnv, "BIOME_CONFIG_PATH") ||
    A.some(identity.configuration.env, (pattern) => globMatches(pattern)("BIOME_CONFIG_PATH"))
  )
    return yield* CacheCommandError.new(
      "Identity lint profile routing must use passThroughEnv, with profile bytes hashed as inputs."
    );
  const workspace = yield* A.findFirst(rows, (row) => row.name === identity.workspace).pipe(
    Effect.fromOption(() => CacheCommandError.new("Governed identity workspace is absent."))
  );
  const native = yield* A.findFirst(dry.tasks, (task) => task.taskId === identity.id).pipe(
    Effect.fromOption(() => CacheCommandError.new("Governed identity native task is absent."))
  );
  const profileInput = Str.replaceAll(
    "\\",
    "/"
  )(paths.relative(paths.resolve(root, workspace.directory), paths.resolve(root, "biome.identity.jsonc")));
  if (!R.has(native.inputs, profileInput))
    return yield* CacheCommandError.new("Native identity task inputs omit the generated lint profile bytes.");
  const global = dry.globalCacheInputs.environmentVariables.specified;
  const outsideProfile = [
    ...global.env,
    ...O.getOrElse(global.passThroughEnv, A.empty<string>),
    ...A.flatMap(nodes, (node) =>
      node.id !== "@beep/identity#lint" && O.isSome(node.command)
        ? [...node.configuration.env, ...node.configuration.passThroughEnv]
        : []
    ),
  ];
  if (A.some(outsideProfile, (pattern) => globMatches(pattern)("BIOME_CONFIG_PATH")))
    return yield* CacheCommandError.new("Identity lint profile must not be forwarded globally or to another task.");
});

/**
 * Select tasks through the installed native client and verify their manifest commands.
 *
 * **Details**
 * No tasks execute and no toolchain profile is required. Transit nodes retain
 * their absent command, so callers can distinguish them from executable tasks.
 * Governed executable cache tasks require the native plan to report strict
 * environment mode. Identity lint profile selection also requires strict mode
 * with caching disabled, and rejects global or cross-task profile forwarding.
 * Positive matching declarations are rejected conservatively even if a later
 * negative pattern would exclude the profile. This neither calculates an
 * identity nor grants reuse.
 *
 * **Example** (Select a package and its task dependencies)
 *
 * ```ts
 * import { collectCacheTaskSelection } from "@beep/repo-cli/commands/Cache"
 * import * as Effect from "effect/Effect"
 *
 * console.assert(Effect.isEffect(collectCacheTaskSelection(".", ["run", "lint", "--filter=@beep/identity"])))
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const collectCacheTaskSelection = Effect.fn("Cache.collectTaskSelection")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>
) {
  const selectedArgs = yield* cacheTaskSelectionArgs(args);
  const paths = yield* Path.Path;
  const root = paths.resolve(repoRoot);
  const turbo = yield* resolveCacheTurboBinary(root);
  const dry = yield* capture(root, turbo, selectedArgs).pipe(
    Effect.flatMap(decodeTurboRuntimePlanJson),
    CacheCommandError.mapError("Native task selection did not produce a valid dry plan.")
  );
  const workspaces = yield* resolveWorkspacePackages(root);
  const rootManifest = yield* readPackageJsonFile(paths.join(root, "package.json"));
  const rows = [
    CacheCensusWorkspace.make({
      name: "//",
      directory: ".",
      scripts: O.getOrElse(rootManifest.scripts, () => ({})),
    }),
    ...pipe(
      workspaces,
      A.fromIterable,
      A.map(([name, workspace]) =>
        CacheCensusWorkspace.make({
          name,
          directory: paths.relative(root, workspace.dir),
          scripts: workspace.scripts,
        })
      )
    ),
  ];
  const nodes = yield* joinCacheCensusPlan(rows, dry);
  const needsProfile = A.some(
    nodes,
    (node) =>
      node.id === "@beep/identity#lint" &&
      O.isSome(node.command) &&
      A.contains([...node.configuration.env, ...node.configuration.passThroughEnv], "BIOME_CONFIG_PATH")
  );
  if (needsProfile) yield* validateIdentityProfileScope(root, rows, nodes, dry);
  if (
    dry.envMode !== "strict" &&
    (needsProfile ||
      A.some(
        nodes,
        (node) =>
          O.isSome(node.command) &&
          node.configuration.cache &&
          A.contains(node.configuration.env, "BEEP_CACHE_TOOLCHAIN_DIGEST")
      ))
  ) {
    return yield* CacheCommandError.new("Governed cache execution requires strict Turbo environment mode.");
  }
  return nodes;
}, CacheCommandError.mapError("Cannot collect the native runtime task selection."));

/**
 * Collect exact Turbo definitions and join them to declared workspace scripts without running tasks.
 *
 * **Details**
 *
 * Cache reads and writes are disabled. Graph-only nodes carry no command.
 * Entrypoint source files are fingerprinted for subsequent semantic review;
 * the unresolved list prevents that source inventory from being mistaken for
 * a fully reviewed computation contract.
 *
 * **Example** (Plan an executable census)
 *
 * ```ts
 * import { collectCacheCensus } from "@beep/repo-cli/commands/Cache"
 * import * as Effect from "effect/Effect"
 * const computation = collectCacheCensus(".")
 * console.assert(Effect.isEffect(computation))
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const collectCacheCensus = Effect.fn("Cache.collectCacheCensus")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;
  const fsUtils = yield* FsUtils;
  const root = paths.resolve(repoRoot);
  const turbo = yield* resolveCacheTurboBinary(root);
  const workspaces = yield* resolveWorkspacePackages(root).pipe(
    CacheCommandError.mapError("Cannot discover workspace manifests.")
  );
  const query = yield* capture(root, turbo, ["query", "ls", "--output", "json"]).pipe(
    Effect.flatMap(decodeTurboWorkspaceListJson),
    CacheCommandError.mapError("Turbo workspace query did not match the census wire contract.")
  );
  const queryNames = pipe(
    query.packages.items,
    A.map((item) => item.name),
    A.sort(Order.String)
  );
  const discoveredNames = pipe(HashMap.keys(workspaces), A.fromIterable, A.sort(Order.String));
  if (!S.toEquivalence(S.Array(S.String))(queryNames, discoveredNames)) {
    return yield* CacheCommandError.new("Turbo workspace population differs from declared workspace discovery.");
  }
  for (const item of query.packages.items) {
    const workspace = yield* HashMap.get(workspaces, item.name).pipe(
      Effect.fromOption(() => CacheCommandError.new("Turbo returned an undeclared workspace."))
    );
    if (paths.resolve(root, item.path) !== workspace.dir) {
      return yield* CacheCommandError.new("Turbo workspace path differs from the declared canonical workspace.");
    }
  }
  const rootManifest = yield* readPackageJsonFile(paths.join(root, "package.json")).pipe(
    CacheCommandError.mapError("Cannot read root scripts.")
  );
  const rootJson = yield* fs
    .readFileString(paths.join(root, "turbo.json"))
    .pipe(
      Effect.flatMap(decodeJsoncTextAs(S.JsonObject)),
      CacheCommandError.mapError("Invalid root Turbo configuration.")
    );
  const rootConfig = yield* decodeTurboConfiguration(rootJson).pipe(
    CacheCommandError.mapError("Root Turbo tasks are invalid.")
  );
  let tasks = R.keys(rootConfig.tasks);
  let sourcePaths = ["turbo.json", "package.json", "bun.lock", ".bun-version", ".nvmrc"];
  let workspaceRows = [
    CacheCensusWorkspace.make({ name: "//", directory: ".", scripts: O.getOrElse(rootManifest.scripts, () => ({})) }),
  ];
  const collectChildConfigurations = Effect.fn("CacheCensus.collectChildConfigurations")(function* (
    name: string,
    directory: string
  ) {
    for (const configName of ["turbo.json", "turbo.jsonc"]) {
      const childPath = paths.join(directory, configName);
      if (yield* fs.exists(paths.join(root, childPath))) {
        const child = yield* fs
          .readFileString(paths.join(root, childPath))
          .pipe(
            Effect.flatMap(decodeJsoncTextAs(TurboConfiguration)),
            CacheCommandError.mapError("Invalid child Turbo configuration.")
          );
        tasks = A.appendAll(
          tasks,
          A.map(R.keys(child.tasks), (task) => `${name}#${task}`)
        );
        sourcePaths = A.append(sourcePaths, childPath);
      }
    }
  });
  for (const name of discoveredNames) {
    const workspace = yield* HashMap.get(workspaces, name).pipe(
      Effect.fromOption(() => CacheCommandError.new("Workspace disappeared during discovery."))
    );
    const directory = paths.relative(root, workspace.dir);
    workspaceRows = A.append(workspaceRows, CacheCensusWorkspace.make({ name, directory, scripts: workspace.scripts }));
    sourcePaths = A.append(sourcePaths, paths.join(directory, "package.json"));
    yield* collectChildConfigurations(name, directory);
  }
  const selectedTasks = pipe(tasks, A.dedupe, A.sort(Order.String));
  const dry = yield* capture(root, turbo, [
    "run",
    ...selectedTasks,
    "--dry=json",
    "--cache=local:",
    "--env-mode=strict",
  ]).pipe(
    Effect.flatMap(decodeTurboPlanJson),
    CacheCommandError.mapError("Turbo dry plan did not match the census wire contract.")
  );
  const nodes = yield* joinCacheCensusPlan(workspaceRows, dry);
  const entrypointSources = yield* fsUtils
    .globFiles(
      [
        ".github/workflows/*.{yml,yaml}",
        ".github/actions/**/action.{yml,yaml}",
        "packages/tooling/tool/cli/src/commands/{Cache,Ci,Quality,Yeet}/**/*.ts",
      ],
      { cwd: root, absolute: false }
    )
    .pipe(Effect.map(A.sort(Order.String)), CacheCommandError.mapError("Cannot inventory quality entrypoint sources."));
  sourcePaths = pipe(A.appendAll(sourcePaths, entrypointSources), A.dedupe, A.sort(Order.String));
  const sources = yield* Effect.forEach(
    sourcePaths,
    Effect.fn("CacheCensus.hashSource")(function* (path) {
      const sha256 = yield* hashFileSha256(paths.join(root, path), (cause) =>
        CacheCommandError.new("Cannot fingerprint a census source.", cause)
      );
      return CacheCensusSource.make({ path, sha256 });
    }),
    { concurrency: 4 }
  );
  return CacheCensusReport.make({
    revision: Str.trim(yield* capture(root, "git", ["rev-parse", "HEAD"])),
    turboVersion: Str.trim(yield* capture(root, turbo, ["--version"])),
    rootScripts: O.getOrElse(rootManifest.scripts, () => ({})),
    globalConfiguration: R.filter(rootJson, (_, key) => key !== "tasks" && key !== "$schema"),
    workspaces: workspaceRows,
    nodes: A.sort(
      nodes,
      Order.mapInput(Order.String, (node: CacheCensusNode) => node.id)
    ),
    sources,
    entrypointSources,
    unresolved: [
      "Classify nested workspace and root command semantics.",
      "Review dynamic Cache/CI/Quality/Yeet entrypoint branches and their external verdicts.",
    ],
  });
}, CacheCommandError.mapError("Executable census failed."));
