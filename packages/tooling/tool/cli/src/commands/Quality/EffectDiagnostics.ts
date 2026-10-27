/**
 * Effect-rule diagnostics independent of the typecheck compiler.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { TsconfigLoader } from "@beep/repo-tsconfig/TsconfigLoader";
import { findRepoRoot, readPackageJsonFile } from "@beep/repo-utils";
import { resolveWorkspacePackages } from "@beep/repo-utils/Workspaces";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Cache from "effect/Cache";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { configStringOption } from "../../internal/cli/EnvConfig.ts";
import { runCapturedStreams } from "../../internal/process/index.ts";
import { collectChangedFiles } from "../../internal/repo-run/ChangedFiles.ts";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";
import {
  CoverageScopeOwner,
  workspaceCoverageScopeOwners,
  workspaceDependentOwners,
} from "./internal/CoverageScope.ts";
import { testTsgoPrograms } from "./internal/TestTsgoPrograms.ts";
import { QualityScriptCommandError } from "./Quality.errors.ts";

const $I = $RepoCliId.create("commands/Quality/EffectDiagnostics");

const effectDiagnosticsProfilePath = "standards/effect-diagnostics.profile.json";

class EffectDiagnosticsProfile extends S.Opaque<EffectDiagnosticsProfile, { readonly brand: unique symbol }>()(
  S.Struct({
    diagnosticSeverity: S.Struct({
      effectSleepZeroToYieldNow: S.tag("error"),
      errorPayloadShadowsName: S.tag("error"),
      flatMapToTap: S.tag("error"),
      preferBarrelImport: S.tag("off"),
      preferEffectArray: S.tag("error"),
      preferEffectRecord: S.tag("error"),
      preferEffectString: S.tag("error"),
      preferNamespaceImport: S.tag("off"),
      preferSchemaTaggedError: S.tag("error"),
      schemaClassMissingBrand: S.tag("error"),
      schemaClassObjectLiteral: S.tag("error"),
    }),
  }).pipe(
    $I.annoteSchema("EffectDiagnosticsProfile", {
      description:
        "The eleven rules armed only in the standalone @effect/tsgo lane until they fold into the root compiler map.",
    })
  )
) {}

const decodeProfile = S.decodeEffect(S.fromJsonString(EffectDiagnosticsProfile), { onExcessProperty: "error" });

/**
 * Read the checked-in rules that only the standalone diagnostics compiler knows.
 *
 * **Example** (Read the standalone rule policy)
 *
 * ```ts
 * import { readEffectDiagnosticsProfile } from "@beep/repo-cli/commands/Quality/EffectDiagnostics"
 * import * as Effect from "effect/Effect"
 * const profile = readEffectDiagnosticsProfile(".")
 * console.log(Effect.isEffect(profile)) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const readEffectDiagnosticsProfile = Effect.fn("EffectDiagnostics.readProfile")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs
    .readFileString(path.join(repoRoot, effectDiagnosticsProfilePath))
    .pipe(
      Effect.flatMap(decodeProfile),
      QualityScriptCommandError.mapError("Invalid standalone Effect diagnostics profile.")
    );
});

const RuleSeverity = LiteralKit(["off", "error", "warning", "suggestion", "message"]).pipe(
  $I.annoteSchema("RuleSeverity", { description: "Configured Effect rule severities retained from project options." })
);
class EffectPlugin extends S.Opaque<EffectPlugin, { readonly brand: unique symbol }>()(
  S.StructWithRest(
    S.Struct({ name: S.tag("@effect/language-service"), diagnosticSeverity: S.Record(S.String, RuleSeverity) }),
    [S.Record(S.String, S.Unknown)]
  ).pipe(
    $I.annoteSchema("EffectPlugin", {
      description: "Effective project plugin options, retaining all settings and per-file overrides.",
    })
  )
) {}
const pluginCodec = JsonStringCodec(EffectPlugin);

const DiagnosticSeverity = LiteralKit(["error", "warning", "message"]).pipe(
  $I.annoteSchema("DiagnosticSeverity", { description: "Severity labels emitted by standalone Effect diagnostics." })
);

const DiagnosticCount = S.Natural.pipe(
  $I.annoteSchema("DiagnosticCount", { description: "Nonnegative count reported by the Effect diagnostics process." })
);

class EffectDiagnostic extends S.Opaque<EffectDiagnostic, { readonly brand: unique symbol }>()(
  S.Struct({
    file: S.String,
    line: S.Int,
    column: S.Int,
    code: S.Int,
    name: S.NonEmptyString,
    severity: DiagnosticSeverity,
    message: S.String,
  }).pipe($I.annoteSchema("EffectDiagnostic", { description: "One detached Effect-rule diagnostic." }))
) {}

class EffectDiagnosticsSummary extends S.Opaque<EffectDiagnosticsSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    filesChecked: DiagnosticCount,
    filesWithoutPlugin: DiagnosticCount,
    totalFiles: DiagnosticCount,
    errors: DiagnosticCount,
    warnings: DiagnosticCount,
    messages: DiagnosticCount,
  }).pipe(
    $I.annoteSchema("EffectDiagnosticsSummary", {
      description: "Coverage and severity counts returned by a standalone Effect diagnostics run.",
    })
  )
) {}

class EffectDiagnosticsOutput extends S.Opaque<EffectDiagnosticsOutput, { readonly brand: unique symbol }>()(
  S.Struct({
    diagnostics: S.Array(EffectDiagnostic),
    summary: EffectDiagnosticsSummary,
  }).pipe(
    $I.annoteSchema("EffectDiagnosticsOutput", {
      description: "Structured output required from the installed Effect diagnostics CLI.",
    })
  )
) {}

class EffectDiagnosticsOptions extends S.Opaque<EffectDiagnosticsOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    filter: S.Option(S.String),
    base: S.Option(S.String),
    concurrency: S.Int.check(S.isBetween({ minimum: 1, maximum: 6 })),
  }).pipe(
    $I.annoteSchema("EffectDiagnosticsOptions", {
      description: "Optional workspace-name filter for a bounded diagnostics edit loop.",
    })
  )
) {}

/**
 * Select changed workspace owners and their transitive workspace dependents.
 *
 * **Details**
 * Reuses the coverage lane's workspace inventory and inverted dependency walk;
 * coverage capability never restricts diagnostics. Root compiler, lockfile and
 * runner changes invalidate all projects; docs outside workspaces select none.
 *
 * **Example** (Ignore repository prose)
 *
 * ```ts
 * import { effectDiagnosticsAffectedPackages } from "@beep/repo-cli/commands/Quality/EffectDiagnostics"
 * console.log(effectDiagnosticsAffectedPackages([], ["docs/note.md"])) // []
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const effectDiagnosticsAffectedPackages: {
  (files: ReadonlyArray<string>): (owners: ReadonlyArray<CoverageScopeOwner>) => ReadonlyArray<string>;
  (owners: ReadonlyArray<CoverageScopeOwner>, files: ReadonlyArray<string>): ReadonlyArray<string>;
} = dual(2, (owners: ReadonlyArray<CoverageScopeOwner>, files: ReadonlyArray<string>): ReadonlyArray<string> => {
  const global = A.some(
    files,
    (file) =>
      A.contains(["package.json", "bun.lock", "turbo.json", effectDiagnosticsProfilePath], file) ||
      Str.startsWith("tsconfig")(file) ||
      Str.startsWith(".github/")(file) ||
      Str.startsWith("packages/tooling/tool/cli/src/commands/Quality/")(file) ||
      Str.startsWith("packages/tooling/tool/cli/src/internal/")(file)
  );
  const direct = A.map(
    A.filter(
      owners,
      (owner) =>
        global ||
        A.some(files, (file) =>
          owner.packagePath === "."
            ? Str.endsWith(".ts")(file) ||
              Str.endsWith(".tsx")(file) ||
              A.some(
                owners,
                (workspace) => workspace.packagePath !== "." && Str.startsWith(`${workspace.packagePath}/`)(file)
              )
            : Str.startsWith(`${owner.packagePath}/`)(file)
        )
    ),
    (owner) => owner.packageName
  );
  return pipe(A.union(direct, workspaceDependentOwners(owners, direct)), A.sort(Order.String));
});

const checkCommands = (scripts: Readonly<Record<string, string>>, root: boolean) => {
  let pending = A.filter(
    R.keys(scripts),
    (name) => name === "check" || name === "beep:check" || (root && Str.startsWith("check:")(name))
  );
  let visited = HashSet.empty<string>();
  let commands = A.empty<string>();
  while (A.isReadonlyArrayNonEmpty(pending)) {
    const [name, ...rest] = pending;
    pending = rest;
    if (HashSet.has(visited, name)) continue;
    visited = HashSet.add(visited, name);
    const script = pipe(
      scripts,
      R.get(name),
      O.getOrElse(() => "")
    );
    commands = A.appendAll(commands, Str.split(script, /&&|\|\||[;|]/u));
    pending = A.appendAll(
      pending,
      pipe(
        script,
        Str.matchAll(/\bbun\s+run\s+(?:--if-present\s+)?([\w:-]+)/gu),
        A.fromIterable,
        A.flatMap((match) => A.fromOption(O.fromUndefinedOr(match[1])))
      )
    );
  }
  return pipe(
    commands,
    A.map(Str.trim),
    A.filter((command) => O.isSome(Str.match(/^(?:tsrs|tsgo)\s/u)(command)))
  );
};

const scriptProjects = (commands: ReadonlyArray<string>, build: boolean) =>
  pipe(
    commands,
    A.flatMap((command) =>
      pipe(
        command,
        Str.matchAll(
          build
            ? /(?:^|\s)(?:-b|--build)(?:=|\s+)([^;&|]+)/gu
            : /(?:^|\s)(?:-p|--project)(?:=|\s+)("[^"]+"|'[^']+'|[^\s;&|]+)/gu
        ),
        A.fromIterable,
        A.flatMap((match) =>
          pipe(
            O.fromUndefinedOr(match[1]),
            O.map((value) => (build ? Str.split(value, /\s+/u) : [value])),
            O.getOrElse(A.empty<string>)
          )
        ),
        A.filter((value) => !Str.startsWith("-")(value)),
        A.map(Str.replace(/^['"]|['"]$/gu, ""))
      )
    )
  );

type ResolveProject = (
  project: string
) => Effect.Effect<
  Effect.Success<ReturnType<typeof TsconfigLoader.resolve>>,
  Effect.Error<ReturnType<typeof TsconfigLoader.resolve>>,
  Effect.Services<ReturnType<typeof TsconfigLoader.resolve>>
>;

// One resolver per run: the inventory and every project run share each resolved
// extends chain, so a base config is read and decoded once instead of per project.
const makeProjectResolver = Effect.map(
  Cache.make({ lookup: TsconfigLoader.resolve, capacity: 4096 }),
  (cache): ResolveProject =>
    (project) =>
      Cache.get(cache, project)
);

const buildProjects = Effect.fn("EffectDiagnostics.buildProjects")(function* (
  initial: ReadonlyArray<string>,
  resolveProject: ResolveProject
) {
  const path = yield* Path.Path;
  let pending = initial;
  let visited = HashSet.empty<string>();
  while (A.isReadonlyArrayNonEmpty(pending)) {
    const [next, ...rest] = pending;
    pending = rest;
    const project = Str.endsWith(".json")(next) ? next : path.join(next, "tsconfig.json");
    if (HashSet.has(visited, project)) continue;
    visited = HashSet.add(visited, project);
    const config = yield* resolveProject(project).pipe(
      QualityScriptCommandError.mapError(`Failed to resolve build project ${project}.`)
    );
    pending = A.appendAll(
      pending,
      A.map(config.references ?? [], (ref) => path.resolve(path.dirname(project), ref.path))
    );
  }
  return A.fromIterable(visited);
});

const checkProjects = Effect.fn("EffectDiagnostics.checkProjects")(function* (
  dir: string,
  scripts: Readonly<Record<string, string>>,
  root: boolean,
  resolveProject: ResolveProject
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const commands = checkCommands(scripts, root);
  const normalize = (project: string) => {
    const resolved = path.resolve(dir, project);
    return Str.endsWith(".json")(resolved) ? resolved : path.join(resolved, "tsconfig.json");
  };
  const builds = yield* buildProjects(A.map(scriptProjects(commands, true), normalize), resolveProject);
  const projects = pipe(
    A.appendAll(A.map(scriptProjects(commands, false), normalize), builds),
    A.dedupe,
    A.sort(Order.String)
  );
  yield* Effect.forEach(
    projects,
    Effect.fnUntraced(function* (project) {
      if (!(yield* fs.exists(project)))
        return yield* QualityScriptCommandError.make({
          message: `Missing check project ${project}.`,
          exitCode: 1,
        });
    }),
    { concurrency: 1 }
  );
  return projects;
});

/**
 * Derive each owner's diagnostics programs from its canonical check scripts.
 *
 * **Details**
 * Includes the repository manifest and expands build-mode references recursively.
 * Missing declared projects fail instead of silently dropping rule coverage.
 *
 * **Example** (Discover the repository programs)
 *
 * ```ts
 * import { effectDiagnosticsProjects } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(effectDiagnosticsProjects("."))) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const collectDiagnosticsInventory = Effect.fn("EffectDiagnostics.inventory")(function* (
  repoRoot: string,
  resolveProject: ResolveProject
) {
  const path = yield* Path.Path;
  const workspaces = yield* resolveWorkspacePackages(repoRoot);
  const root = yield* readPackageJsonFile(path.join(repoRoot, "package.json"));
  const owners = A.append(
    A.map(HashMap.toEntries(workspaces), ([name, workspace]) => [name, workspace.dir, workspace.scripts] as const),
    [root.name, repoRoot, O.getOrElse(root.scripts, () => ({}))] as const
  );
  let inventory = HashMap.fromIterable(
    yield* Effect.forEach(
      owners,
      ([name, dir, scripts]) =>
        Effect.map(
          checkProjects(dir, scripts, dir === repoRoot, resolveProject),
          (projects) => [name, projects] as const
        ),
      { concurrency: 1 }
    )
  );
  const tests = yield* testTsgoPrograms.uncovered(repoRoot);
  for (const program of tests) {
    inventory = HashMap.set(
      inventory,
      program.packageName,
      pipe(
        O.getOrElse(HashMap.get(inventory, program.packageName), A.empty<string>),
        A.append(program.tsconfigPath),
        A.dedupe,
        A.sort(Order.String)
      )
    );
  }
  return [inventory, tests] as const;
});

/**
 * Resolve compiler-script projects plus the shared fallback test-tsgo programs.
 *
 * **Example** (Inspect complete rule-gate discovery)
 * ```ts
 * import { effectDiagnosticsProjects } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(effectDiagnosticsProjects("."))) // true
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const effectDiagnosticsProjects = Effect.fn("EffectDiagnostics.projects")(function* (repoRoot: string) {
  const [inventory] = yield* collectDiagnosticsInventory(repoRoot, yield* makeProjectResolver);
  return inventory;
});

const decodeOutput = S.decodeUnknownEffect(S.fromJsonString(EffectDiagnosticsOutput));

const projectConfigWith = Effect.fn("EffectDiagnostics.projectConfig")(function* (
  resolveProject: ResolveProject,
  profile: EffectDiagnosticsProfile,
  project: string
) {
  const { compilerOptions } = yield* resolveProject(project).pipe(
    QualityScriptCommandError.mapError(`Failed to resolve ${project}.`)
  );
  const plugin = A.findFirst(compilerOptions.plugins ?? A.empty(), S.is(EffectPlugin));
  if (O.isNone(plugin))
    return yield* QualityScriptCommandError.make({
      message: `No complete Effect plugin in ${project}.`,
      exitCode: 1,
    });
  return yield* pluginCodec
    .encode(
      EffectPlugin.make({
        ...plugin.value,
        diagnosticSeverity: { ...plugin.value.diagnosticSeverity, ...profile.diagnosticSeverity },
      })
    )
    .pipe(QualityScriptCommandError.mapError(`Failed to encode Effect plugin for ${project}.`));
});

/**
 * Resolve a project's inherited plugin and overlay the standalone rule profile.
 *
 * **Example** (Resolve a package without losing its exceptions)
 *
 * ```ts
 * import { effectDiagnosticsProjectConfig, readEffectDiagnosticsProfile } from "@beep/repo-cli/commands/Quality/EffectDiagnostics"
 * import * as Effect from "effect/Effect"
 * const config = readEffectDiagnosticsProfile(".").pipe(
 *   Effect.flatMap(effectDiagnosticsProjectConfig("packages/ecosystem/effect-drizzle/tsconfig.json"))
 * )
 * console.log(Effect.isEffect(config)) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const effectDiagnosticsProjectConfig: {
  (
    project: string
  ): (
    profile: EffectDiagnosticsProfile
  ) => Effect.Effect<string, QualityScriptCommandError, FileSystem.FileSystem | Path.Path>;
  (
    profile: EffectDiagnosticsProfile,
    project: string
  ): Effect.Effect<string, QualityScriptCommandError, FileSystem.FileSystem | Path.Path>;
} = dual(2, (profile: EffectDiagnosticsProfile, project: string) =>
  projectConfigWith(TsconfigLoader.resolve, profile, project)
);

const runProject = Effect.fn("EffectDiagnostics.project")(function* (
  repoRoot: string,
  node: string,
  project: string,
  profile: EffectDiagnosticsProfile,
  resolveProject: ResolveProject,
  config: string = project
) {
  const path = yield* Path.Path;
  const label = `${path.relative(repoRoot, project)}${config === project ? "" : " [test-tsgo overlay]"}`;
  const lspconfig = yield* projectConfigWith(resolveProject, profile, project);
  const result = yield* runCapturedStreams({
    command: node,
    args: [
      path.join(repoRoot, "node_modules", "@effect", "tsgo", "dist", "effect-tsgo.cjs"),
      "diagnostics",
      "--project",
      config,
      "--format",
      "json",
      "--strict",
      "--lspconfig",
      lspconfig,
    ],
    cwd: repoRoot,
  }).pipe(
    Effect.timeoutOrElse({
      duration: "5 minutes",
      orElse: () =>
        QualityScriptCommandError.make({ message: `Effect diagnostics timed out for ${label}.`, exitCode: 1 }),
    })
  );
  const report = yield* decodeOutput(result.stdout).pipe(
    QualityScriptCommandError.mapError(
      `Invalid Effect diagnostics JSON for ${label}: stdout=${Str.takeLeft(result.stdout, 2048)}; stderr=${Str.takeLeft(result.stderr, 2048)}`
    )
  );
  const { summary } = report;
  if (summary.totalFiles === 0 || summary.filesWithoutPlugin !== 0 || summary.filesChecked !== summary.totalFiles) {
    return yield* QualityScriptCommandError.make({
      message: `Incomplete Effect diagnostics coverage for ${label}: checked ${summary.filesChecked}/${summary.totalFiles}, ${summary.filesWithoutPlugin} without plugin. stderr=${Str.takeLeft(result.stderr, 2048)}`,
      exitCode: 1,
    });
  }
  const expectedExit = summary.errors > 0 || summary.warnings > 0 ? 1 : 0;
  if (result.exitCode !== expectedExit) {
    return yield* QualityScriptCommandError.make({
      message: `Effect diagnostics exit ${result.exitCode} disagrees with the severity summary for ${label}. stderr=${Str.takeLeft(result.stderr, 2048)}`,
      exitCode: 1,
    });
  }
  for (const diagnostic of report.diagnostics) {
    yield* Console.error(
      `${path.relative(repoRoot, diagnostic.file)}(${diagnostic.line},${diagnostic.column}): ${diagnostic.severity} TS${diagnostic.code}: ${diagnostic.message} effect(${diagnostic.name})`
    );
  }
  yield* Console.log(
    `[quality:effect-diagnostics] ${label}: ${summary.filesChecked} files, ${summary.errors} errors, ${summary.warnings} warnings, ${summary.messages} messages`
  );
  return report;
});

const runDiscoveredProject = Effect.fn("EffectDiagnostics.discoveredProject")(function* (
  repoRoot: string,
  node: string,
  project: string,
  profile: EffectDiagnosticsProfile,
  tests: Effect.Success<ReturnType<typeof testTsgoPrograms.uncovered>>,
  resolveProject: ResolveProject
) {
  const program = A.findFirst(tests, (test) => test.tsconfigPath === project);
  if (O.isNone(program)) return yield* runProject(repoRoot, node, project, profile, resolveProject);
  const fs = yield* FileSystem.FileSystem;
  const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-effect-diagnostics-" });
  const config = yield* testTsgoPrograms.writeConfig(repoRoot, tempDir, program.value);
  return yield* runProject(repoRoot, node, project, profile, resolveProject, config);
});

const runEffectDiagnostics = Effect.fn("EffectDiagnostics.run")(function* (options: EffectDiagnosticsOptions) {
  const repoRoot = yield* findRepoRoot();
  const profile = yield* readEffectDiagnosticsProfile(repoRoot);
  const node = O.getOrElse(yield* configStringOption("BEEP_NODE_BIN"), () => "node");
  const resolveProject = yield* makeProjectResolver;
  const [inventory, tests] = yield* collectDiagnosticsInventory(repoRoot, resolveProject);
  const root = yield* readPackageJsonFile(`${repoRoot}/package.json`);
  const owners = A.append(
    yield* workspaceCoverageScopeOwners(repoRoot),
    CoverageScopeOwner.make({
      packageName: root.name,
      packagePath: ".",
      workspaceDependencies: [],
      hasCoverage: false,
    })
  );
  const selected = O.isSome(options.base)
    ? O.some(
        HashSet.fromIterable(
          effectDiagnosticsAffectedPackages(owners, yield* collectChangedFiles(repoRoot, options.base.value, "HEAD"))
        )
      )
    : O.none<HashSet.HashSet<string>>();
  const projects = pipe(
    HashMap.toEntries(inventory),
    A.filter(([name]) => O.isNone(selected) || HashSet.has(selected.value, name)),
    A.filter(([name]) =>
      O.match(options.filter, { onNone: () => true, onSome: (filter) => Str.includes(filter)(name) })
    ),
    A.flatMap(([, projects]) => projects),
    A.dedupe,
    A.sort(Order.String)
  );
  if (A.isReadonlyArrayEmpty(projects)) {
    if (O.isSome(options.base) && O.isNone(options.filter)) {
      yield* Console.log("[quality:effect-diagnostics] no affected projects (skipped)");
      return;
    }
    return yield* QualityScriptCommandError.make({ message: "No Effect diagnostics projects selected.", exitCode: 1 });
  }

  yield* Console.log(
    `[quality:effect-diagnostics] checking ${A.length(projects)} check program(s), concurrency ${options.concurrency}`
  );
  const reports = yield* Effect.forEach(
    projects,
    (project) => runDiscoveredProject(repoRoot, node, project, profile, tests, resolveProject).pipe(Effect.scoped),
    {
      concurrency: options.concurrency,
    }
  );
  let census = HashMap.empty<string, number>();
  for (const diagnostic of A.flatMap(reports, (report) => report.diagnostics)) {
    census = HashMap.set(census, diagnostic.name, O.getOrElse(HashMap.get(census, diagnostic.name), () => 0) + 1);
  }
  const filesChecked = A.reduce(reports, 0, (total, report) => total + report.summary.filesChecked);
  const failed = A.some(reports, ({ summary }) => summary.errors > 0 || summary.warnings > 0);
  for (const [rule, count] of pipe(
    HashMap.toEntries(census),
    A.sortWith(([rule]) => rule, Order.String)
  )) {
    yield* Console.log(`[quality:effect-diagnostics] ${rule}: ${count}`);
  }
  yield* Console.log(
    `[quality:effect-diagnostics] checked ${A.length(projects)} projects, ${filesChecked} file visits`
  );
  if (failed) {
    return yield* QualityScriptCommandError.make({
      message: "Effect diagnostics found errors or warnings.",
      exitCode: 1,
    });
  }
});

/**
 * Run the installed Effect rules over every workspace and root check program.
 *
 * **Details**
 *
 * Project plugin configuration is authoritative, including documented package
 * exceptions. The bounded runner requires complete JSON coverage and never treats
 * a malformed response, missing plugin or unexpected child exit as a clean pass.
 * Shared test-tsgo discovery and overlays retain rule coverage for fallback test programs.
 * A dedicated hosted heavy matrix job calls this same CLI implementation.
 *
 * **Example** (Register the diagnostics command)
 *
 * ```ts
 * import { effectDiagnosticsCommand } from "@beep/repo-cli/commands/Quality/EffectDiagnostics"
 * import * as A from "effect/Array"
 * import * as Command from "effect/cli/Command";
 * const quality = Command.make("quality").pipe(Command.withSubcommands([effectDiagnosticsCommand]))
 * const names = A.flatMap(quality.subcommands, (group) => A.map(group.commands, (command) => command.name))
 * names // => ["effect-diagnostics"]
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const effectDiagnosticsCommand = Command.make(
  "effect-diagnostics",
  {
    base: Flag.String("base").pipe(
      Flag.optional,
      Flag.withDescription("Select affected workspaces and dependents since this git base")
    ),
    concurrency: Flag.Int("concurrency").pipe(
      Flag.withFallbackConfig(Config.Int("BEEP_EFFECT_DIAGNOSTICS_CONCURRENCY").pipe(Config.withDefault(2))),
      Flag.withDescription("Concurrent projects (1-6); environment: BEEP_EFFECT_DIAGNOSTICS_CONCURRENCY")
    ),
    filter: Flag.String("filter").pipe(
      Flag.optional,
      Flag.withDescription("Only workspaces whose name contains this text")
    ),
  },
  (options) =>
    S.decodeEffect(EffectDiagnosticsOptions)(options).pipe(
      QualityScriptCommandError.mapError("Invalid Effect diagnostics options (concurrency must be 1-6)."),
      Effect.flatMap(runEffectDiagnostics)
    )
).pipe(Command.withDescription("Run standalone Effect-rule diagnostics independently of the typecheck compiler"));
