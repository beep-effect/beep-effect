/**
 * Build-equivalence mode of the check census: proves that every emitting
 * package's `tsconfig.json` build program reports exactly the diagnostics of
 * its `tsconfig.check.json` check program, from a caller-declared initial
 * state, warm, and cold, with or without a seeded type error.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { formatJsonc, renderTruncatedLines, writeArtifact } from "@beep/repo-cli-kit/artifacts/index";
import { failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import { printLines } from "@beep/repo-cli-kit/cli/Printer";
import { runCaptured } from "@beep/repo-cli-kit/process/index";
import { workspaceManifests } from "@beep/repo-cli-kit/RepoWorkspaces";
import { TsconfigLoader } from "@beep/repo-tsconfig/TsconfigLoader";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { A, Str, thunkFalse } from "@beep/utils";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Equivalence from "effect/Equivalence";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { compilerOutputLines, isCompilerDiagnosticLine, nameFilterPredicate } from "./internal/CheckCensusOutput.ts";
import { QualityScriptCommandError } from "./Quality.errors.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const $I = $RepoCliId.create("commands/Quality/CheckCensusBuildEquivalence");

const BUILD_EQUIVALENCE_SCHEMA_VERSION = "check-census-build-equivalence/v1";
const BUILD_CONFIG = "tsconfig.json";
const CHECK_CONFIG = "tsconfig.check.json";
// The base config emits to `${configDir}/dist`; a package that sets no
// `outDir` of its own builds there.
const DEFAULT_OUT_DIR = "dist";
// One `&&` segment of an emitting `beep:build`. A no-emit build
// (`tsrs -p tsconfig.check.json`, the package-scripts NOEMIT notion) never
// matches it, so its packages have no build program to compare.
const EMITTING_BUILD_COMMAND = "tsrs -p tsconfig.json";
const UNSET_TSRS_FAST = "unset";
const renderedLineLimit = 20;
const packageColumnWidth = 40;

/**
 * Default build-equivalence JSON report path, relative to the repository root.
 *
 * **Example** (Locate the default report)
 *
 * ```ts
 * import { CHECK_CENSUS_BUILD_EQUIVALENCE_OUTPUT_PATH } from "@beep/repo-cli/commands/Quality/CheckCensusBuildEquivalence"
 *
 * console.log(CHECK_CENSUS_BUILD_EQUIVALENCE_OUTPUT_PATH) // ".beep/quality/check-census-build-equivalence.json"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const CHECK_CENSUS_BUILD_EQUIVALENCE_OUTPUT_PATH = ".beep/quality/check-census-build-equivalence.json";

/**
 * File the seeded pass writes into a package's `src` directory while it runs;
 * removed, with any emitted output, before the pass returns.
 *
 * **Example** (Recognise a leftover probe)
 *
 * ```ts
 * import { CHECK_CENSUS_PROBE_FILE_NAME } from "@beep/repo-cli/commands/Quality/CheckCensusBuildEquivalence"
 *
 * console.log(CHECK_CENSUS_PROBE_FILE_NAME) // "__census_probe.ts"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const CHECK_CENSUS_PROBE_FILE_NAME = "__census_probe.ts";

/**
 * Source of the seeded probe: one TS2322 type error and one floating Effect
 * (TS377001), so both the TypeScript checker and the Effect rules must bite.
 *
 * **Details**
 *
 * A package that cannot resolve `effect` reports TS2307 from both programs
 * instead; the comparison still holds, and the TS2322 line still makes the
 * probe effective.
 *
 * **Example** (Count the probe's lines)
 *
 * ```ts
 * import { CHECK_CENSUS_PROBE_SOURCE } from "@beep/repo-cli/commands/Quality/CheckCensusBuildEquivalence"
 *
 * console.log(CHECK_CENSUS_PROBE_SOURCE.split("\n").length) // 6
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const CHECK_CENSUS_PROBE_SOURCE = A.join(
  [
    'import * as Effect from "effect/Effect";',
    "",
    'export const censusProbeTypeError: number = "not a number";',
    "",
    "Effect.succeed(1);",
    "",
  ],
  "\n"
);

/**
 * Incremental state a build program started from.
 *
 * **Details**
 *
 * `warm` follows an earlier build of the same package and `cold` follows the
 * removal of its outDir. `restored` is only ever the caller's
 * `--initial-state` label: the caller ran a Turbo cache restore before the
 * census, which cannot observe that itself.
 *
 * **Example** (Name the cold state)
 *
 * ```ts
 * import { BuildEquivalenceState } from "@beep/repo-cli/commands/Quality/CheckCensusBuildEquivalence"
 *
 * console.log(BuildEquivalenceState.Enum.cold) // "cold"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const BuildEquivalenceState = LiteralKit(["restored", "warm", "cold"]).pipe(
  $I.annoteSchema("BuildEquivalenceState", {
    description:
      "Incremental state a build program started from: caller-restored from the Turbo cache, warm after an earlier build, or cold after its outDir was removed.",
  })
);

/**
 * Runtime type of {@link BuildEquivalenceState}.
 *
 * @category models
 * @since 0.0.0
 */
export type BuildEquivalenceState = typeof BuildEquivalenceState.Type;

/**
 * Caller-declared label of the state each package's first build finds.
 *
 * **Example** (Guard a restored label)
 *
 * ```ts
 * import { BuildEquivalenceInitialState } from "@beep/repo-cli/commands/Quality/CheckCensusBuildEquivalence"
 *
 * console.log(BuildEquivalenceInitialState.is.restored("restored")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const BuildEquivalenceInitialState = BuildEquivalenceState.pick(["restored", "warm"]).pipe(
  $I.annoteSchema("BuildEquivalenceInitialState", {
    description:
      "Label of the incremental state each package's first build finds: restored after a caller's Turbo cache restore, or warm.",
  })
);

/**
 * Runtime type of {@link BuildEquivalenceInitialState}.
 *
 * @category models
 * @since 0.0.0
 */
export type BuildEquivalenceInitialState = typeof BuildEquivalenceInitialState.Type;

/**
 * Source state of one comparison.
 *
 * **Details**
 *
 * `clean` is the package's own source, `seeded` adds the census probe, and
 * `recovered` is clean source built from incremental state a seeded build
 * left behind.
 *
 * **Example** (Name the recovered seed)
 *
 * ```ts
 * import { BuildEquivalenceSeed } from "@beep/repo-cli/commands/Quality/CheckCensusBuildEquivalence"
 *
 * console.log(BuildEquivalenceSeed.Enum.recovered) // "recovered"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const BuildEquivalenceSeed = LiteralKit(["clean", "seeded", "recovered"]).pipe(
  $I.annoteSchema("BuildEquivalenceSeed", {
    description:
      "Source state of a comparison: clean source, source with the census probe, or clean source rebuilt from seeded incremental state.",
  })
);

/**
 * Runtime type of {@link BuildEquivalenceSeed}.
 *
 * @category models
 * @since 0.0.0
 */
export type BuildEquivalenceSeed = typeof BuildEquivalenceSeed.Type;

/**
 * Which pass a build-equivalence run made over every package.
 *
 * **Example** (Name the seeded pass)
 *
 * ```ts
 * import { BuildEquivalenceMode } from "@beep/repo-cli/commands/Quality/CheckCensusBuildEquivalence"
 *
 * console.log(BuildEquivalenceMode.Enum.seeded) // "seeded"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const BuildEquivalenceMode = LiteralKit(["clean", "seeded"]).pipe(
  $I.annoteSchema("BuildEquivalenceMode", {
    description: "Build-equivalence pass: clean source only, or a seeded probe followed by a clean recovery.",
  })
);

/**
 * Runtime type of {@link BuildEquivalenceMode}.
 *
 * @category models
 * @since 0.0.0
 */
export type BuildEquivalenceMode = typeof BuildEquivalenceMode.Type;

const BuildEquivalenceCount = S.Natural.pipe(
  $I.annoteSchema("BuildEquivalenceCount", {
    description: "Non-negative count, or wall time in milliseconds, recorded by the build-equivalence census.",
  })
);

/**
 * One compiler run: exit code, wall time, and its trimmed non-empty output
 * lines sorted with `String.Order`.
 *
 * **Details**
 *
 * A non-zero exit is data, not a failure. Sorting makes the comparison
 * independent of the order the checkers report files in.
 *
 * **Example** (Record a failing run)
 *
 * ```ts
 * import { BuildEquivalenceRun } from "@beep/repo-cli/commands/Quality/CheckCensusBuildEquivalence"
 *
 * const run = BuildEquivalenceRun.make({
 *   exitCode: 2,
 *   wallMs: 410,
 *   lines: ["src/__census_probe.ts(3,14): error TS2322: Type 'string' is not assignable to type 'number'."],
 * })
 * console.log(run.lines.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BuildEquivalenceRun extends S.Opaque<BuildEquivalenceRun, { readonly brand: unique symbol }>()(
  S.Struct({
    exitCode: S.Int,
    wallMs: BuildEquivalenceCount,
    lines: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("BuildEquivalenceRun", {
      description: "Exit code, wall time, and sorted trimmed non-empty output lines of one compiler run.",
    })
  )
) {}

/**
 * One build run compared with the check run of the same source.
 *
 * **Details**
 *
 * `identical` holds when the exit codes are equal and the sorted line arrays
 * are equal; wall time never takes part.
 *
 * **Example** (Find a differing comparison)
 *
 * ```ts
 * import type { BuildEquivalenceComparison } from "@beep/repo-cli/commands/Quality/CheckCensusBuildEquivalence"
 *
 * const differs = (comparison: BuildEquivalenceComparison) => !comparison.identical
 * console.log(differs.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BuildEquivalenceComparison extends S.Opaque<
  BuildEquivalenceComparison,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    state: BuildEquivalenceState,
    seed: BuildEquivalenceSeed,
    build: BuildEquivalenceRun,
    check: BuildEquivalenceRun,
    identical: S.Boolean,
  }).pipe(
    $I.annoteSchema("BuildEquivalenceComparison", {
      description:
        "A build run, its incremental state and source seed, the check run of the same source, and whether both reported the same exit code and lines.",
    })
  )
) {}

/**
 * One package's comparisons, in the order they ran.
 *
 * **Details**
 *
 * `probeEffective` is present only on seeded rows: `false` when the seeded
 * check exited 0 or printed no `error TS` line, so the probe proved nothing.
 * It is absent from the JSON of a clean row.
 *
 * **Example** (Build a clean row)
 *
 * ```ts
 * import { BuildEquivalenceRow } from "@beep/repo-cli/commands/Quality/CheckCensusBuildEquivalence"
 * import * as O from "effect/Option"
 *
 * const row = BuildEquivalenceRow.make({ package: "@beep/schema", comparisons: [] })
 * console.log(O.isNone(row.probeEffective)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BuildEquivalenceRow extends S.Opaque<BuildEquivalenceRow, { readonly brand: unique symbol }>()(
  S.Struct({
    package: S.String,
    comparisons: S.Array(BuildEquivalenceComparison),
    probeEffective: S.OptionFromOptionalKey(S.Boolean).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<boolean>()))
    ),
  }).pipe(
    $I.annoteSchema("BuildEquivalenceRow", {
      description:
        "Build-versus-check comparisons of one package, with whether the seeded probe produced a diagnostic on seeded rows.",
    })
  )
) {}

/**
 * Totals of one build-equivalence run.
 *
 * **Example** (Read the difference count)
 *
 * ```ts
 * import { BuildEquivalenceSummary } from "@beep/repo-cli/commands/Quality/CheckCensusBuildEquivalence"
 *
 * const summary = BuildEquivalenceSummary.make({
 *   packages: 2,
 *   comparisons: 6,
 *   identical: 6,
 *   different: 0,
 *   ineffectiveProbes: 0,
 * })
 * console.log(summary.different) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BuildEquivalenceSummary extends S.Opaque<BuildEquivalenceSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    packages: BuildEquivalenceCount,
    comparisons: BuildEquivalenceCount,
    identical: BuildEquivalenceCount,
    different: BuildEquivalenceCount,
    ineffectiveProbes: BuildEquivalenceCount,
  }).pipe(
    $I.annoteSchema("BuildEquivalenceSummary", {
      description: "Package, comparison, identical, different, and ineffective-probe counts of one run.",
    })
  )
) {}

/**
 * The build-equivalence report written to `--equivalence-output-json`.
 *
 * **Details**
 *
 * `compiler` is the first line `tsrs --version` printed and `tsrsFast` the
 * literal `TSRS_FAST` value the compilers inherited, or `unset`.
 *
 * **Example** (Build an empty report)
 *
 * ```ts
 * import { BuildEquivalenceReport, BuildEquivalenceSummary } from "@beep/repo-cli/commands/Quality/CheckCensusBuildEquivalence"
 *
 * const report = BuildEquivalenceReport.make({
 *   generatedAt: "2026-11-10T00:00:00.000Z",
 *   compiler: "Version 7.1.0-beta+effect-tsgo.0.67.5",
 *   tsrsFast: "1",
 *   mode: "seeded",
 *   initialState: "restored",
 *   rows: [],
 *   summary: BuildEquivalenceSummary.make({ packages: 0, comparisons: 0, identical: 0, different: 0, ineffectiveProbes: 0 }),
 * })
 * console.log(report.schemaVersion) // "check-census-build-equivalence/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BuildEquivalenceReport extends S.Opaque<BuildEquivalenceReport, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag(BUILD_EQUIVALENCE_SCHEMA_VERSION),
    generatedAt: S.String,
    compiler: S.String,
    tsrsFast: S.String,
    mode: BuildEquivalenceMode,
    initialState: BuildEquivalenceInitialState,
    rows: S.Array(BuildEquivalenceRow),
    summary: BuildEquivalenceSummary,
  }).pipe(
    $I.annoteSchema("BuildEquivalenceReport", {
      description:
        "Build-versus-check diagnostic comparisons of every emitting package, with the compiler, TSRS_FAST, pass, and initial-state label they ran under.",
    })
  )
) {}

/**
 * A workspace package whose build program emits and is compared.
 *
 * **Example** (Describe a package)
 *
 * ```ts
 * import { BuildEquivalencePackage } from "@beep/repo-cli/commands/Quality/CheckCensusBuildEquivalence"
 *
 * const pkg = BuildEquivalencePackage.make({ name: "@beep/schema", dir: "/repo/packages/foundation/modeling/schema" })
 * console.log(pkg.name) // "@beep/schema"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BuildEquivalencePackage extends S.Opaque<BuildEquivalencePackage, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String,
    dir: S.String,
  }).pipe(
    $I.annoteSchema("BuildEquivalencePackage", {
      description: "Workspace package name and absolute directory compared by the build-equivalence census.",
    })
  )
) {}

/**
 * Inputs of one build-equivalence run.
 *
 * **Example** (Seed two packages from a restored state)
 *
 * ```ts
 * import { BuildEquivalenceOptions } from "@beep/repo-cli/commands/Quality/CheckCensusBuildEquivalence"
 *
 * const options = BuildEquivalenceOptions.make({
 *   repoRoot: "/repo",
 *   tsrsPath: "/repo/node_modules/.bin/tsrs",
 *   packages: [{ name: "@beep/schema", dir: "/repo/packages/foundation/modeling/schema" }],
 *   mode: "seeded",
 *   initialState: "restored",
 * })
 * console.log(options.mode) // "seeded"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BuildEquivalenceOptions extends S.Opaque<BuildEquivalenceOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    repoRoot: S.String,
    tsrsPath: S.String,
    packages: S.Array(BuildEquivalencePackage),
    mode: BuildEquivalenceMode.pipe(S.withConstructorDefault(Effect.succeed(BuildEquivalenceMode.Enum.clean))),
    initialState: BuildEquivalenceInitialState.pipe(
      S.withConstructorDefault(Effect.succeed(BuildEquivalenceInitialState.Enum.warm))
    ),
  }).pipe(
    $I.annoteSchema("BuildEquivalenceOptions", {
      description: "Repository root, tsrs binary, package selection, pass, and initial-state label of one run.",
    })
  )
) {}

/**
 * Inputs of `beep quality check-census --build-equivalence`.
 *
 * **Example** (Describe a clean run over one family)
 *
 * ```ts
 * import { BuildEquivalenceCliOptions } from "@beep/repo-cli/commands/Quality/CheckCensusBuildEquivalence"
 * import * as O from "effect/Option"
 *
 * const options = BuildEquivalenceCliOptions.make({
 *   repoRoot: "/repo",
 *   filter: O.some("@beep/schema"),
 *   mode: "clean",
 *   initialState: "warm",
 *   outputJson: ".beep/quality/check-census-build-equivalence.json",
 * })
 * console.log(O.isSome(options.filter)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BuildEquivalenceCliOptions extends S.Opaque<
  BuildEquivalenceCliOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    repoRoot: S.String,
    filter: S.Option(S.String),
    mode: BuildEquivalenceMode,
    initialState: BuildEquivalenceInitialState,
    outputJson: S.String,
  }).pipe(
    $I.annoteSchema("BuildEquivalenceCliOptions", {
      description:
        "Repository root, package-name filter, pass, initial-state label, and report path of one build-equivalence command run.",
    })
  )
) {}

type BuildEquivalenceTarget = {
  readonly pkg: BuildEquivalencePackage;
  readonly outDir: string;
};

type CompilerEnvironment = SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner;
type BuildEquivalenceEnvironment = FileSystem.FileSystem | Path.Path | CompilerEnvironment;

const buildsWithEmittingConfig = (scripts: HashMap.HashMap<string, string>): boolean =>
  O.exists(
    HashMap.get(scripts, "beep:build"),
    flow(Str.split("&&"), A.map(Str.trim), A.contains(EMITTING_BUILD_COMMAND))
  );

const hasBuildEquivalenceSources = Effect.fn("CheckCensusBuildEquivalence.hasSources")(function* (
  dir: string
): Effect.fn.Return<boolean, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const [build, check, src] = yield* Effect.all([
    fs.exists(path.join(dir, BUILD_CONFIG)).pipe(Effect.orElseSucceed(thunkFalse)),
    fs.exists(path.join(dir, CHECK_CONFIG)).pipe(Effect.orElseSucceed(thunkFalse)),
    fs.stat(path.join(dir, "src")).pipe(
      Effect.map((stat) => stat.type === "Directory"),
      Effect.orElseSucceed(thunkFalse)
    ),
  ]);

  return build && check && src;
});

/**
 * Resolve the emitting workspace packages: both `tsconfig.json` and
 * `tsconfig.check.json`, a `src` directory, and a `beep:build` that runs
 * `tsrs -p tsconfig.json`, optionally narrowed by a name substring.
 *
 * **Details**
 *
 * Packages whose `beep:build` only type-checks (`tsrs -p tsconfig.check.json`)
 * or uses a framework builder are skipped: they have no emitting build program
 * to compare with the check.
 *
 * **Example** (Select one package family)
 *
 * ```ts
 * import { selectBuildEquivalencePackages } from "@beep/repo-cli/commands/Quality/CheckCensusBuildEquivalence"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const program = selectBuildEquivalencePackages("/repo", O.some("@beep/schema"))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param repoRoot - Repository root whose workspaces are scanned.
 * @param filter - Optional substring every selected package name must contain.
 * @returns Packages sorted by name.
 * @category use-cases
 * @since 0.0.0
 */
export const selectBuildEquivalencePackages = Effect.fn("CheckCensusBuildEquivalence.selectPackages")(function* (
  repoRoot: string,
  filter: O.Option<string>
): Effect.fn.Return<
  ReadonlyArray<BuildEquivalencePackage>,
  QualityScriptCommandError,
  FileSystem.FileSystem | Path.Path
> {
  const workspaces = yield* workspaceManifests(repoRoot).pipe(
    QualityScriptCommandError.mapError("Failed to resolve workspace packages.")
  );
  const candidates = pipe(
    HashMap.toEntries(workspaces),
    A.filter(
      ([name, member]) => nameFilterPredicate(filter)(name) && buildsWithEmittingConfig(member.manifest.scripts)
    ),
    A.map(([name, member]) => BuildEquivalencePackage.make({ name, dir: member.dir })),
    A.sortWith((pkg) => pkg.name, Order.String)
  );

  return yield* Effect.filter(candidates, (pkg) => hasBuildEquivalenceSources(pkg.dir));
});

const isStrictlyInside = (path: Path.Path, parent: string, child: string): boolean => {
  const relative = path.relative(parent, child);

  return (
    Str.isNonEmpty(relative) &&
    !path.isAbsolute(relative) &&
    relative !== ".." &&
    !Str.startsWith(`..${path.sep}`)(relative)
  );
};

// The cold steps delete the outDir recursively, so it is resolved through the
// full `extends` chain (as the census resolves referenced declaration output)
// and refused unless it lies strictly inside the package directory.
const resolveBuildEquivalenceTarget = Effect.fn("CheckCensusBuildEquivalence.resolveTarget")(function* (
  pkg: BuildEquivalencePackage
): Effect.fn.Return<BuildEquivalenceTarget, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const tsconfigPath = path.join(pkg.dir, BUILD_CONFIG);
  const compilerOptions = yield* TsconfigLoader.compilerOptions(tsconfigPath).pipe(
    QualityScriptCommandError.mapError(`Failed to resolve compilerOptions.outDir of ${tsconfigPath}.`)
  );
  const outDir = path.resolve(pkg.dir, compilerOptions.outDir ?? DEFAULT_OUT_DIR);

  if (!isStrictlyInside(path, pkg.dir, outDir)) {
    return yield* QualityScriptCommandError.make({
      message: `${pkg.name}: refusing to delete outDir ${outDir}, which is not strictly inside ${pkg.dir}.`,
    });
  }
  return { pkg, outDir };
});

const readCompilerVersion = Effect.fn("CheckCensusBuildEquivalence.compilerVersion")(function* (
  tsrsPath: string,
  cwd: string
): Effect.fn.Return<string, QualityScriptCommandError, CompilerEnvironment> {
  const captured = yield* runCaptured({ command: tsrsPath, args: ["--version"], cwd, source: "all", trim: true }).pipe(
    QualityScriptCommandError.mapError(`Failed to run ${tsrsPath} --version.`)
  );

  return yield* Effect.fromOption(A.head(compilerOutputLines(captured.output)), () =>
    QualityScriptCommandError.make({ message: `${tsrsPath} --version printed nothing.` })
  );
});

// Both programs run from the package directory with the caller's environment,
// so the `TSRS_FAST` the report records is the one the compiler saw. A
// non-zero exit is data: the run records it with the output either way.
const runProgram = Effect.fn("CheckCensusBuildEquivalence.runProgram")(function* (
  tsrsPath: string,
  target: BuildEquivalenceTarget,
  config: string
): Effect.fn.Return<BuildEquivalenceRun, QualityScriptCommandError, CompilerEnvironment> {
  const [elapsed, captured] = yield* runCaptured({
    command: tsrsPath,
    args: ["-p", config, "--pretty", "false"],
    cwd: target.pkg.dir,
    source: "all",
    extendEnv: true,
  }).pipe(
    QualityScriptCommandError.mapError(`Failed to run ${tsrsPath} -p ${config} for ${target.pkg.name}.`),
    Effect.timed
  );

  return BuildEquivalenceRun.make({
    exitCode: captured.exitCode,
    wallMs: Num.round(Duration.toMillis(elapsed), 0),
    lines: A.sort(compilerOutputLines(captured.output), Str.Order),
  });
});

const sameDiagnostics: Equivalence.Equivalence<BuildEquivalenceRun> = Equivalence.Struct({
  exitCode: Equivalence.Number,
  lines: A.makeEquivalence(Str.Equivalence),
});

const compareBuild = (
  tsrsPath: string,
  target: BuildEquivalenceTarget,
  check: BuildEquivalenceRun,
  state: BuildEquivalenceState,
  seed: BuildEquivalenceSeed
): Effect.Effect<BuildEquivalenceComparison, QualityScriptCommandError, CompilerEnvironment> =>
  Effect.map(runProgram(tsrsPath, target, BUILD_CONFIG), (build) =>
    BuildEquivalenceComparison.make({ state, seed, build, check, identical: sameDiagnostics(build, check) })
  );

const removeOutDir = Effect.fn("CheckCensusBuildEquivalence.removeOutDir")(function* (
  target: BuildEquivalenceTarget
): Effect.fn.Return<void, QualityScriptCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  yield* fs
    .remove(target.outDir, { recursive: true, force: true })
    .pipe(QualityScriptCommandError.mapError(`Failed to remove ${target.outDir}.`));
});

const removeProbe = Effect.fn("CheckCensusBuildEquivalence.removeProbe")(function* (
  probePath: string
): Effect.fn.Return<void, QualityScriptCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  yield* fs
    .remove(probePath, { force: true })
    .pipe(QualityScriptCommandError.mapError(`Failed to remove ${probePath}.`));
});

// The check is stateless, so one check run serves every clean comparison.
const cleanPass = Effect.fn("CheckCensusBuildEquivalence.cleanPass")(function* (
  options: BuildEquivalenceOptions,
  target: BuildEquivalenceTarget
): Effect.fn.Return<BuildEquivalenceRow, QualityScriptCommandError, BuildEquivalenceEnvironment> {
  const check = yield* runProgram(options.tsrsPath, target, CHECK_CONFIG);
  const asFound = yield* compareBuild(options.tsrsPath, target, check, options.initialState, "clean");
  // A warm initial state already is the warm comparison.
  const warm = yield* Effect.when(
    compareBuild(options.tsrsPath, target, check, "warm", "clean"),
    Effect.succeed(!BuildEquivalenceInitialState.is.warm(options.initialState))
  );
  yield* removeOutDir(target);
  const cold = yield* compareBuild(options.tsrsPath, target, check, "cold", "clean");

  return BuildEquivalenceRow.make({ package: target.pkg.name, comparisons: [asFound, ...O.toArray(warm), cold] });
});

// The seeded probe bites when the check fails with at least one diagnostic.
const probeBit = (check: BuildEquivalenceRun): boolean =>
  check.exitCode !== 0 && A.some(check.lines, isCompilerDiagnosticLine);

const seededComparisons = Effect.fn("CheckCensusBuildEquivalence.seededComparisons")(function* (
  options: BuildEquivalenceOptions,
  target: BuildEquivalenceTarget,
  probePath: string
): Effect.fn.Return<BuildEquivalenceRow, QualityScriptCommandError, BuildEquivalenceEnvironment> {
  const seededCheck = yield* runProgram(options.tsrsPath, target, CHECK_CONFIG);
  const asFound = yield* compareBuild(options.tsrsPath, target, seededCheck, options.initialState, "seeded");
  // Nothing changed since the last build: a retry must not go green.
  const retry = yield* compareBuild(options.tsrsPath, target, seededCheck, "warm", "seeded");
  yield* removeOutDir(target);
  const cold = yield* compareBuild(options.tsrsPath, target, seededCheck, "cold", "seeded");
  yield* removeProbe(probePath);
  const cleanCheck = yield* runProgram(options.tsrsPath, target, CHECK_CONFIG);
  // Clean source again, built from the incremental state a seeded build left.
  const recovered = yield* compareBuild(options.tsrsPath, target, cleanCheck, "warm", "recovered");
  yield* removeOutDir(target);
  const coldClean = yield* compareBuild(options.tsrsPath, target, cleanCheck, "cold", "clean");

  return BuildEquivalenceRow.make({
    package: target.pkg.name,
    comparisons: [asFound, retry, cold, recovered, coldClean],
    probeEffective: O.some(probeBit(seededCheck)),
  });
});

// A seeded pass that succeeded ended on its cold clean rebuild. Any other
// exit (a failure, an interruption) may leave `__census_probe.*` output in
// the outDir, so the outDir is removed together with the probe.
const releaseProbe = Effect.fn("CheckCensusBuildEquivalence.releaseProbe")(function* (
  target: BuildEquivalenceTarget,
  probePath: string,
  exit: Exit.Exit<unknown, unknown>
): Effect.fn.Return<void, QualityScriptCommandError, FileSystem.FileSystem> {
  const completed = Exit.isSuccess(exit);
  yield* removeProbe(probePath);
  yield* Effect.when(removeOutDir(target), Effect.succeed(!completed));
});

const seededPass = Effect.fn("CheckCensusBuildEquivalence.seededPass")(function* (
  options: BuildEquivalenceOptions,
  target: BuildEquivalenceTarget
): Effect.fn.Return<BuildEquivalenceRow, QualityScriptCommandError, BuildEquivalenceEnvironment> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const probePath = path.join(target.pkg.dir, "src", CHECK_CENSUS_PROBE_FILE_NAME);

  return yield* Effect.acquireUseRelease(
    fs
      .writeFileString(probePath, CHECK_CENSUS_PROBE_SOURCE)
      .pipe(QualityScriptCommandError.mapError(`Failed to write ${probePath}.`)),
    () => seededComparisons(options, target, probePath),
    (_, exit) => releaseProbe(target, probePath, exit)
  );
});

const equivalencePass = (
  options: BuildEquivalenceOptions,
  target: BuildEquivalenceTarget
): Effect.Effect<BuildEquivalenceRow, QualityScriptCommandError, BuildEquivalenceEnvironment> =>
  Effect.logInfo("check-census build equivalence: comparing package").pipe(
    Effect.annotateLogs({ package: target.pkg.name, mode: options.mode }),
    Effect.andThen(
      BuildEquivalenceMode.match(options.mode, {
        clean: () => cleanPass(options, target),
        seeded: () => seededPass(options, target),
      })
    )
  );

const isIneffectiveProbe = (row: BuildEquivalenceRow): boolean => O.contains(row.probeEffective, false);

const summarize = (rows: ReadonlyArray<BuildEquivalenceRow>): BuildEquivalenceSummary => {
  const comparisons = A.flatMap(rows, (row) => row.comparisons);
  const identical = A.length(A.filter(comparisons, (comparison) => comparison.identical));

  return BuildEquivalenceSummary.make({
    packages: A.length(rows),
    comparisons: A.length(comparisons),
    identical,
    different: A.length(comparisons) - identical,
    ineffectiveProbes: A.length(A.filter(rows, isIneffectiveProbe)),
  });
};

/**
 * Compare every selected package's build program with its check program.
 *
 * **Details**
 *
 * Every program runs as `tsrs -p <config> --pretty false` from the package
 * directory with the caller's environment. The clean pass runs the check
 * once, then builds as found (labelled with `initialState`), again when that
 * label is not already `warm`, and cold after removing the outDir. The seeded
 * pass writes {@link CHECK_CENSUS_PROBE_FILE_NAME} into `src`, compares the
 * as-found, warm-retry, and cold builds with the seeded check, removes the
 * probe, compares a recovered warm build and a cold clean build with a fresh
 * clean check, and marks the row `probeEffective: false` when the seeded check
 * passed. Its finalizer removes the probe and, unless the pass completed, the
 * outDir, so no probe output survives a failure or an interruption.
 *
 * **Gotchas**
 *
 * Builds run in place and the cold steps delete outDirs that downstream
 * programs read, so packages run strictly one at a time. Every outDir is
 * resolved and checked to lie strictly inside its package before any compiler
 * runs.
 *
 * **Example** (Seed one package)
 *
 * ```ts
 * import {
 *   BuildEquivalenceOptions,
 *   runCheckCensusBuildEquivalence,
 * } from "@beep/repo-cli/commands/Quality/CheckCensusBuildEquivalence"
 * import * as Effect from "effect/Effect"
 *
 * const program = runCheckCensusBuildEquivalence(
 *   BuildEquivalenceOptions.make({
 *     repoRoot: "/repo",
 *     tsrsPath: "/repo/node_modules/.bin/tsrs",
 *     packages: [{ name: "@beep/schema", dir: "/repo/packages/foundation/modeling/schema" }],
 *     mode: "seeded",
 *   })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - Repository root, tsrs binary, package selection, pass, and initial-state label.
 * @returns The report, rows in the order the packages were given.
 * @category use-cases
 * @since 0.0.0
 */
export const runCheckCensusBuildEquivalence = Effect.fn("CheckCensusBuildEquivalence.run")(function* (
  options: BuildEquivalenceOptions
): Effect.fn.Return<BuildEquivalenceReport, QualityScriptCommandError, BuildEquivalenceEnvironment> {
  const compiler = yield* readCompilerVersion(options.tsrsPath, options.repoRoot);
  const tsrsFast = yield* Config.String("TSRS_FAST").pipe(
    Config.withDefault(UNSET_TSRS_FAST),
    QualityScriptCommandError.mapError("Failed to read TSRS_FAST.")
  );
  const targets = yield* Effect.forEach(options.packages, resolveBuildEquivalenceTarget, { concurrency: 1 });
  const generatedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  // Strictly serial: builds run in place, and a cold step deletes the
  // package's outDir, which downstream packages' programs read.
  const rows = yield* Effect.forEach(targets, (target) => equivalencePass(options, target), { concurrency: 1 });

  return BuildEquivalenceReport.make({
    generatedAt,
    compiler,
    tsrsFast,
    mode: options.mode,
    initialState: options.initialState,
    rows,
    summary: summarize(rows),
  });
});

const verdictCell = (comparison: BuildEquivalenceComparison): string =>
  `${comparison.state}/${comparison.seed}${comparison.identical ? "=" : "≠"}`;

const renderRow = (row: BuildEquivalenceRow): string =>
  A.join(
    [
      Str.padEnd(packageColumnWidth)(row.package),
      ...A.map(row.comparisons, verdictCell),
      ...(isIneffectiveProbe(row) ? A.of("probe did not bite") : A.empty<string>()),
    ],
    "  "
  );

const renderRun = (label: string, run: BuildEquivalenceRun): ReadonlyArray<string> => [
  `  ${label}: exit ${run.exitCode}, ${A.length(run.lines)} line(s)`,
  ...renderTruncatedLines({ items: run.lines, render: (line: string) => `  - ${line}`, limit: renderedLineLimit }),
];

const renderDifferences = (row: BuildEquivalenceRow): ReadonlyArray<string> =>
  pipe(
    row.comparisons,
    A.filter((comparison) => !comparison.identical),
    A.flatMap((comparison) => [
      `≠ ${row.package} ${comparison.state}/${comparison.seed}`,
      ...renderRun("build", comparison.build),
      ...renderRun("check", comparison.check),
    ])
  );

/**
 * Render the build-equivalence report as text lines for stdout.
 *
 * **Details**
 *
 * One header, one verdict line per package (`state/seed=` identical,
 * `state/seed≠` different), both programs' lines of every differing
 * comparison (truncated), and the summary.
 *
 * **Example** (Render an empty report)
 *
 * ```ts
 * import {
 *   BuildEquivalenceReport,
 *   BuildEquivalenceSummary,
 *   renderBuildEquivalenceLines,
 * } from "@beep/repo-cli/commands/Quality/CheckCensusBuildEquivalence"
 *
 * const lines = renderBuildEquivalenceLines(
 *   BuildEquivalenceReport.make({
 *     generatedAt: "2026-11-10T00:00:00.000Z",
 *     compiler: "Version 7.1.0-beta",
 *     tsrsFast: "unset",
 *     mode: "clean",
 *     initialState: "warm",
 *     rows: [],
 *     summary: BuildEquivalenceSummary.make({ packages: 0, comparisons: 0, identical: 0, different: 0, ineffectiveProbes: 0 }),
 *   })
 * )
 * console.log(lines.length) // 2
 * ```
 *
 * @param report - The report to render.
 * @returns Header, verdict, difference, and summary lines.
 * @category formatting
 * @since 0.0.0
 */
export const renderBuildEquivalenceLines = (report: BuildEquivalenceReport): ReadonlyArray<string> => [
  `check census build equivalence (${report.mode} pass, initial state ${report.initialState}, TSRS_FAST=${report.tsrsFast}, ${report.compiler}, ${report.generatedAt})`,
  ...A.map(report.rows, renderRow),
  ...A.flatMap(report.rows, renderDifferences),
  `summary: ${report.summary.packages} package(s), ${report.summary.comparisons} comparison(s), ${report.summary.identical} identical, ${report.summary.different} different, ${report.summary.ineffectiveProbes} ineffective probe(s)`,
];

const buildEquivalenceFailed = (report: BuildEquivalenceReport): boolean =>
  report.summary.different > 0 || report.summary.ineffectiveProbes > 0;

const encodeBuildEquivalenceReport = S.encodeEffect(BuildEquivalenceReport);

const writeBuildEquivalenceReport = Effect.fn("CheckCensusBuildEquivalence.writeReport")(function* (
  outputPath: string,
  report: BuildEquivalenceReport
): Effect.fn.Return<void, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const encoded = yield* encodeBuildEquivalenceReport(report).pipe(
    QualityScriptCommandError.mapError("Failed to encode the build-equivalence report.")
  );
  const body = yield* formatJsonc(encoded).pipe(
    QualityScriptCommandError.mapError("Failed to encode the build-equivalence report.")
  );

  yield* writeArtifact({
    path: outputPath,
    body,
    onError: QualityScriptCommandError.new(`Failed to write ${outputPath}.`),
  });
});

/**
 * Run `beep quality check-census --build-equivalence`: select the emitting
 * packages, compare their programs, print the verdicts, write the report, and
 * exit non-zero when any comparison differs or a seeded probe did not bite.
 *
 * **Details**
 *
 * The report is written before the failure is raised. A selection with no
 * emitting package fails up front, so a mistyped `--filter` cannot pass
 * vacuously.
 *
 * **Example** (Compose a clean run)
 *
 * ```ts
 * import {
 *   BuildEquivalenceCliOptions,
 *   CHECK_CENSUS_BUILD_EQUIVALENCE_OUTPUT_PATH,
 *   runCheckCensusBuildEquivalenceCli,
 * } from "@beep/repo-cli/commands/Quality/CheckCensusBuildEquivalence"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const program = runCheckCensusBuildEquivalenceCli(
 *   BuildEquivalenceCliOptions.make({
 *     repoRoot: "/repo",
 *     filter: O.none(),
 *     mode: "clean",
 *     initialState: "warm",
 *     outputJson: CHECK_CENSUS_BUILD_EQUIVALENCE_OUTPUT_PATH,
 *   })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - Repository root, filter, pass, initial-state label, and report path.
 * @returns Succeeds when every comparison is identical and every seeded probe bit.
 * @category use-cases
 * @since 0.0.0
 */
export const runCheckCensusBuildEquivalenceCli = Effect.fn("CheckCensusBuildEquivalence.cli")(function* (
  options: BuildEquivalenceCliOptions
) {
  const path = yield* Path.Path;
  const packages = yield* selectBuildEquivalencePackages(options.repoRoot, options.filter);

  if (A.isReadonlyArrayEmpty(packages)) {
    return yield* QualityScriptCommandError.make({
      message: `check-census --build-equivalence selected no emitting package${O.match(options.filter, {
        onNone: () => "",
        onSome: (filter) => ` matching --filter ${filter}`,
      })}.`,
    });
  }
  const report = yield* runCheckCensusBuildEquivalence(
    BuildEquivalenceOptions.make({
      repoRoot: options.repoRoot,
      tsrsPath: path.join(options.repoRoot, "node_modules", ".bin", "tsrs"),
      packages,
      mode: options.mode,
      initialState: options.initialState,
    })
  );
  const outputPath = path.resolve(options.repoRoot, options.outputJson);

  yield* printLines(renderBuildEquivalenceLines(report));
  yield* writeBuildEquivalenceReport(outputPath, report);
  yield* Console.log(`wrote ${path.relative(options.repoRoot, outputPath)}`);
  if (buildEquivalenceFailed(report)) {
    return yield* failWithReportedExit(
      `check-census build equivalence failed: ${report.summary.different} comparison(s) differ and ${report.summary.ineffectiveProbes} seeded probe(s) did not bite.`
    );
  }
});
