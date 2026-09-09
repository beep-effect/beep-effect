/**
 * Check-program census: measures every package's `tsconfig.check.json` program
 * against a synthesized reference-keeping overlay (quality-lane audit D3).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot, jsonStringifyPretty } from "@beep/repo-utils";
import { resolveWorkspacePackages } from "@beep/repo-utils/Workspaces";
import { A, Str, thunkFalse } from "@beep/utils";
import { Console, DateTime, Duration, Effect, FileSystem, HashMap, HashSet, Order, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { parse as parseJsonc } from "jsonc-parser";
import { renderTruncatedLines } from "../../internal/artifacts/index.ts";
import { printLines } from "../../internal/cli/Printer.ts";
import { runCaptured } from "../../internal/process/index.ts";
import { QualityScriptCommandError } from "./Quality.errors.ts";
import type { FsUtils } from "@beep/repo-utils";
import type { ChildProcessSpawner } from "effect/unstable/process";

const $I = $RepoCliId.create("commands/Quality/CheckCensus");

// Default JSON report path, relative to the repository root.
const DEFAULT_CHECK_CENSUS_OUTPUT_PATH = ".beep/quality/check-census.json";

// Bound on concurrent package measurements; each one spawns two full tsgo
// programs, so the census stays under the 16GB hosted-runner posture.
const CHECK_CENSUS_CONCURRENCY = 4;

// The base config emits declarations to `${configDir}/dist`; a referenced
// project that sets no `outDir` of its own lands there.
const DEFAULT_DECLARATION_OUT_DIR = "dist";
const DECLARATION_INDEX_FILE = "index.d.ts";
const BUILD_REMEDIATION = "bun run build";
const renderedMissingOutputLimit = 40;

/**
 * Temporary overlay written into a package while its reference-keeping
 * program is measured; removed once the measurement finishes.
 *
 * **Example** (Recognise the census overlay in a package listing)
 *
 * ```ts
 * import { CHECK_CENSUS_OVERLAY_FILE_NAME } from "@beep/repo-cli/commands/Quality/CheckCensus"
 *
 * console.log(CHECK_CENSUS_OVERLAY_FILE_NAME) // "tsconfig.__census.json"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const CHECK_CENSUS_OVERLAY_FILE_NAME = "tsconfig.__census.json";

const CensusCount = S.Int.pipe(
  $I.annoteSchema("CensusCount", {
    description: "Non-negative integer measured from one tsgo program (files, upstream files, wall ms, diagnostics).",
  })
);

const CensusDelta = S.Int.pipe(
  $I.annoteSchema("CensusDelta", {
    description: "Signed difference between the reference-keeping overlay and the committed check overlay.",
  })
);

const censusProgramFields = {
  files: CensusCount,
  upstreamSrc: CensusCount,
  upstreamDist: CensusCount,
  wallMs: CensusCount,
  diagnostics: CensusCount,
} as const;

/**
 * One measured tsgo program: program size, upstream source and declaration
 * files it consumed, wall time of the `--extendedDiagnostics` run, and the
 * number of diagnostics it reported.
 *
 * **Example** (Build a measurement)
 *
 * ```ts
 * import { CheckCensusProgram } from "@beep/repo-cli/commands/Quality/CheckCensus"
 *
 * const program = CheckCensusProgram.make({ files: 2712, upstreamSrc: 537, upstreamDist: 0, wallMs: 8100, diagnostics: 0 })
 * console.log(program.upstreamSrc) // 537
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckCensusProgram extends S.Class<CheckCensusProgram>($I`CheckCensusProgram`)(
  censusProgramFields,
  $I.annote("CheckCensusProgram", {
    description: "Size, upstream consumption, wall time, and diagnostic count of one measured tsgo program.",
  })
) {}

/**
 * Signed per-field difference of the reference-keeping overlay minus the
 * committed check overlay.
 *
 * **Example** (A smaller, faster program)
 *
 * ```ts
 * import { CheckCensusDelta } from "@beep/repo-cli/commands/Quality/CheckCensus"
 *
 * const delta = CheckCensusDelta.make({ files: -371, upstreamSrc: -537, upstreamDist: 452, wallMs: -3600, diagnostics: 0 })
 * console.log(delta.diagnostics) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckCensusDelta extends S.Class<CheckCensusDelta>($I`CheckCensusDelta`)(
  {
    files: CensusDelta,
    upstreamSrc: CensusDelta,
    upstreamDist: CensusDelta,
    wallMs: CensusDelta,
    diagnostics: CensusDelta,
  },
  $I.annote("CheckCensusDelta", {
    description: "Reference-keeping overlay minus committed check overlay, per measured field.",
  })
) {}

/**
 * One package's census row.
 *
 * **Details**
 *
 * `overlay` measures the committed `tsconfig.check.json`; `referenceKeeping`
 * measures a synthesized overlay that extends `tsconfig.json`, keeps its
 * `references`, and only disables composite/incremental/declaration emit.
 * `buildOverlapFiles` counts files the check overlay shares with the
 * `tsconfig.json` build program.
 *
 * **Example** (Read the delta of a row)
 *
 * ```ts
 * import { CheckCensusRow } from "@beep/repo-cli/commands/Quality/CheckCensus"
 *
 * const isZeroDiagnosticDelta = (row: CheckCensusRow) => row.delta.diagnostics === 0
 * console.log(isZeroDiagnosticDelta.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckCensusRow extends S.Class<CheckCensusRow>($I`CheckCensusRow`)(
  {
    package: S.String,
    overlay: CheckCensusProgram,
    referenceKeeping: CheckCensusProgram,
    delta: CheckCensusDelta,
    buildOverlapFiles: CensusCount,
  },
  $I.annote("CheckCensusRow", {
    description: "Committed check overlay versus reference-keeping overlay measurements for one workspace package.",
  })
) {}

/**
 * The census report written to `--output-json`.
 *
 * **Example** (Count rows)
 *
 * ```ts
 * import { CheckCensusReport } from "@beep/repo-cli/commands/Quality/CheckCensus"
 *
 * const report = CheckCensusReport.make({ generatedAt: "2026-09-09T00:00:00.000Z", concurrency: 4, rows: [] })
 * console.log(report.rows.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckCensusReport extends S.Class<CheckCensusReport>($I`CheckCensusReport`)(
  {
    generatedAt: S.String,
    concurrency: CensusCount,
    rows: S.Array(CheckCensusRow),
  },
  $I.annote("CheckCensusReport", {
    description: "Check-program census over every measured workspace package.",
  })
) {}

/**
 * A workspace package selected for the census.
 *
 * **Example** (Describe a package)
 *
 * ```ts
 * import { CheckCensusPackage } from "@beep/repo-cli/commands/Quality/CheckCensus"
 *
 * const pkg = CheckCensusPackage.make({ name: "@beep/n3", dir: "/repo/packages/drivers/n3" })
 * console.log(pkg.name) // "@beep/n3"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckCensusPackage extends S.Class<CheckCensusPackage>($I`CheckCensusPackage`)(
  {
    name: S.String,
    dir: S.String,
  },
  $I.annote("CheckCensusPackage", {
    description: "Workspace package name and absolute directory measured by the check census.",
  })
) {}

/**
 * Inputs of one census run.
 *
 * **Example** (Census two packages with a bounded worker pool)
 *
 * ```ts
 * import { CheckCensusOptions } from "@beep/repo-cli/commands/Quality/CheckCensus"
 *
 * const options = CheckCensusOptions.make({
 *   repoRoot: "/repo",
 *   tsgoPath: "/repo/node_modules/.bin/tsgo",
 *   packages: [{ name: "@beep/n3", dir: "/repo/packages/drivers/n3" }],
 *   concurrency: 2,
 * })
 * console.log(options.packages.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckCensusOptions extends S.Class<CheckCensusOptions>($I`CheckCensusOptions`)(
  {
    repoRoot: S.String,
    tsgoPath: S.String,
    packages: S.Array(CheckCensusPackage),
    concurrency: CensusCount.pipe(S.withConstructorDefault(Effect.succeed(CHECK_CENSUS_CONCURRENCY))),
  },
  $I.annote("CheckCensusOptions", {
    description: "Repository root, tsgo binary, package selection, and worker bound for one check census.",
  })
) {}

/**
 * A referenced project whose declaration output is absent, so a
 * reference-keeping program would report TS6305 noise instead of evidence.
 *
 * **Example** (Describe a missing output)
 *
 * ```ts
 * import { CheckCensusMissingOutput } from "@beep/repo-cli/commands/Quality/CheckCensus"
 *
 * const missing = CheckCensusMissingOutput.make({
 *   package: "@beep/n3",
 *   reference: "../../foundation/modeling/schema/tsconfig.json",
 *   declarationFile: "packages/foundation/modeling/schema/dist/index.d.ts",
 * })
 * console.log(missing.declarationFile.endsWith("index.d.ts")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckCensusMissingOutput extends S.Class<CheckCensusMissingOutput>($I`CheckCensusMissingOutput`)(
  {
    package: S.String,
    reference: S.String,
    declarationFile: S.String,
  },
  $I.annote("CheckCensusMissingOutput", {
    description: "A project referenced by a census package whose declaration index (outDir/index.d.ts) does not exist.",
  })
) {}

const TsconfigReference = S.Struct({ path: S.String }).annotate(
  $I.annote("TsconfigReference", { description: "One project reference entry of a package tsconfig.json." })
);
const TsconfigReferences = S.Struct({
  references: S.Array(TsconfigReference).pipe(S.optionalKey),
}).annotate(
  $I.annote("TsconfigReferences", {
    description: "The `references` block read from a package tsconfig.json for the reference-keeping overlay.",
  })
);
const decodeTsconfigReferences = S.decodeUnknownEffect(TsconfigReferences);

type CensusEnvironment = FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner;

const diagnosticLinePattern = /\berror TS\d+:/u;
const isDiagnosticLine = (line: string): boolean => diagnosticLinePattern.test(line);
const outputLines = (output: string): ReadonlyArray<string> =>
  pipe(Str.split(output, "\n"), A.map(Str.trim), A.filter(Str.isNonEmpty));

const listProgramFiles = Effect.fn("CheckCensus.listProgramFiles")(function* (
  tsgoPath: string,
  configPath: string,
  cwd: string
): Effect.fn.Return<ReadonlyArray<string>, QualityScriptCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* runCaptured({
    command: tsgoPath,
    args: ["-p", configPath, "--listFilesOnly"],
    cwd,
    source: "stdout",
    trim: true,
  }).pipe(QualityScriptCommandError.mapError(`Failed to list program files for ${configPath}.`));

  return pipe(
    outputLines(result.output),
    A.filter((line) => !isDiagnosticLine(line))
  );
});

const measureDiagnostics = Effect.fn("CheckCensus.measureDiagnostics")(function* (
  tsgoPath: string,
  configPath: string,
  cwd: string
): Effect.fn.Return<
  { readonly wallMs: number; readonly diagnostics: number },
  QualityScriptCommandError,
  ChildProcessSpawner.ChildProcessSpawner
> {
  const [elapsed, result] = yield* runCaptured({
    command: tsgoPath,
    args: ["-p", configPath, "--extendedDiagnostics", "--pretty", "false"],
    cwd,
    source: "all",
    trim: true,
  }).pipe(QualityScriptCommandError.mapError(`Failed to check ${configPath}.`), Effect.timed);

  return {
    wallMs: Math.round(Duration.toMillis(elapsed)),
    diagnostics: A.length(A.filter(outputLines(result.output), isDiagnosticLine)),
  };
});

// Classification works on the path below the repository root so a checkout
// that itself lives under a `node_modules/` segment (fixture repos, tool
// clones under ~/.cache) still separates workspace files from dependencies.
const repoRelativeUpstreamFile = (repoRoot: string, packageDir: string, file: string): O.Option<string> => {
  if (!Str.startsWith(`${repoRoot}/`)(file) || Str.startsWith(`${packageDir}/`)(file)) {
    return O.none();
  }
  const relative = `/${Str.slice(repoRoot.length + 1)(file)}`;

  return Str.includes("/node_modules/")(relative) ? O.none() : O.some(relative);
};
const isDistFile = (file: string): boolean => Str.includes("/dist/")(file) || Str.includes("/build/")(file);
const isSrcFile = (file: string): boolean => Str.includes("/src/")(file);

const measureProgram = Effect.fn("CheckCensus.measureProgram")(function* (
  tsgoPath: string,
  repoRoot: string,
  packageDir: string,
  configPath: string
): Effect.fn.Return<
  { readonly program: CheckCensusProgram; readonly files: HashSet.HashSet<string> },
  QualityScriptCommandError,
  ChildProcessSpawner.ChildProcessSpawner
> {
  const files = yield* listProgramFiles(tsgoPath, configPath, packageDir);
  const upstream = pipe(
    files,
    A.map((file) => repoRelativeUpstreamFile(repoRoot, packageDir, file)),
    A.getSomes
  );
  const { diagnostics, wallMs } = yield* measureDiagnostics(tsgoPath, configPath, packageDir);

  return {
    program: CheckCensusProgram.make({
      files: A.length(files),
      upstreamSrc: A.length(A.filter(upstream, (file) => isSrcFile(file) && !isDistFile(file))),
      upstreamDist: A.length(A.filter(upstream, isDistFile)),
      wallMs,
      diagnostics,
    }),
    files: HashSet.fromIterable(files),
  };
});

const readTsconfigReferences = Effect.fn("CheckCensus.readTsconfigReferences")(function* (
  packageDir: string
): Effect.fn.Return<
  ReadonlyArray<{ readonly path: string }>,
  QualityScriptCommandError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const tsconfigPath = path.join(packageDir, "tsconfig.json");
  const text = yield* fs
    .readFileString(tsconfigPath)
    .pipe(QualityScriptCommandError.mapError(`Failed to read ${tsconfigPath}.`));
  const decoded = yield* decodeTsconfigReferences(parseJsonc(text)).pipe(
    QualityScriptCommandError.mapError(`Failed to decode references from ${tsconfigPath}.`)
  );

  return decoded.references ?? A.empty();
});

const TsconfigOutDir = S.Struct({
  compilerOptions: S.Struct({ outDir: S.optionalKey(S.String) }).pipe(S.optionalKey),
}).annotate(
  $I.annote("TsconfigOutDir", {
    description: "The `compilerOptions.outDir` read from a referenced project's tsconfig.",
  })
);
const decodeTsconfigOutDir = S.decodeUnknownEffect(TsconfigOutDir);

// A reference names a tsconfig file or a directory holding tsconfig.json.
const referencedTsconfigPath = Effect.fn("CheckCensus.referencedTsconfigPath")(function* (
  packageDir: string,
  reference: string
): Effect.fn.Return<string, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const resolved = path.resolve(packageDir, reference);
  const stat = yield* fs.stat(resolved).pipe(Effect.option);

  return O.isSome(stat) && stat.value.type === "Directory" ? path.join(resolved, "tsconfig.json") : resolved;
});

// The declaration index a reference-keeping program resolves the referenced
// project through: `<outDir>/index.d.ts` next to its tsconfig.
const referencedDeclarationIndex = Effect.fn("CheckCensus.referencedDeclarationIndex")(function* (
  tsconfigPath: string
): Effect.fn.Return<string, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const text = yield* fs
    .readFileString(tsconfigPath)
    .pipe(QualityScriptCommandError.mapError(`Failed to read referenced project ${tsconfigPath}.`));
  const decoded = yield* decodeTsconfigOutDir(parseJsonc(text)).pipe(
    QualityScriptCommandError.mapError(`Failed to decode compilerOptions.outDir from ${tsconfigPath}.`)
  );
  const outDir = decoded.compilerOptions?.outDir ?? DEFAULT_DECLARATION_OUT_DIR;

  return path.resolve(path.dirname(tsconfigPath), outDir, DECLARATION_INDEX_FILE);
});

const missingReferenceOutputs = Effect.fn("CheckCensus.missingReferenceOutputs")(function* (
  repoRoot: string,
  pkg: CheckCensusPackage
): Effect.fn.Return<
  ReadonlyArray<CheckCensusMissingOutput>,
  QualityScriptCommandError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const references = yield* readTsconfigReferences(pkg.dir);

  return yield* Effect.forEach(
    references,
    Effect.fnUntraced(function* (reference) {
      const tsconfigPath = yield* referencedTsconfigPath(pkg.dir, reference.path);
      const declarationFile = yield* referencedDeclarationIndex(tsconfigPath);
      const exists = yield* fs.exists(declarationFile).pipe(Effect.orElseSucceed(thunkFalse));

      return exists
        ? A.empty<CheckCensusMissingOutput>()
        : A.of(
            CheckCensusMissingOutput.make({
              package: pkg.name,
              reference: reference.path,
              declarationFile: path.relative(repoRoot, declarationFile),
            })
          );
    }),
    { concurrency: 1 }
  ).pipe(Effect.map(A.flatten));
});

const renderMissingOutput = (missing: CheckCensusMissingOutput): string =>
  `  - ${missing.package}: ${missing.reference} -> ${missing.declarationFile}`;

/**
 * Fail unless every project the selected packages reference has its
 * declaration index (`<outDir>/index.d.ts`) on disk.
 *
 * **Details**
 *
 * The reference-keeping overlay resolves upstream packages through their
 * built declarations, exactly as `turbo run check` does after `^build`. On
 * an unbuilt tree tsgo reports TS6305 for every missing output, so a census
 * measured there counts noise, not the diagnostic delta the switch is gated
 * on. The check is filesystem-only and runs before any compiler spawns.
 *
 * **Example** (Guard a census run)
 *
 * ```ts
 * import { assertCheckCensusTreeBuilt, CheckCensusOptions } from "@beep/repo-cli/commands/Quality/CheckCensus"
 * import * as Effect from "effect/Effect"
 *
 * const program = assertCheckCensusTreeBuilt(
 *   CheckCensusOptions.make({
 *     repoRoot: "/repo",
 *     tsgoPath: "/repo/node_modules/.bin/tsgo",
 *     packages: [{ name: "@beep/n3", dir: "/repo/packages/drivers/n3" }],
 *   })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - The census selection whose references are verified.
 * @returns Succeeds on a built tree; fails naming every package and missing declaration index otherwise.
 * @category use-cases
 * @since 0.0.0
 */
export const assertCheckCensusTreeBuilt = Effect.fn("CheckCensus.assertTreeBuilt")(function* (
  options: CheckCensusOptions
): Effect.fn.Return<void, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const missing = yield* Effect.forEach(options.packages, (pkg) => missingReferenceOutputs(options.repoRoot, pkg), {
    concurrency: options.concurrency,
  }).pipe(Effect.map(A.flatten));

  if (A.isReadonlyArrayNonEmpty(missing)) {
    const packages = pipe(
      missing,
      A.map((entry) => entry.package),
      A.dedupe
    );
    return yield* QualityScriptCommandError.make({
      message: A.join(
        [
          `check-census needs a built tree: ${A.length(missing)} referenced project(s) across ${A.length(packages)} package(s) have no declaration output.`,
          ...renderTruncatedLines({ items: missing, render: renderMissingOutput, limit: renderedMissingOutputLimit }),
          `Run \`${BUILD_REMEDIATION}\` (or \`bunx turbo run build --filter=<package>^...\` for one package's upstream) and re-run the census.`,
        ],
        "\n"
      ),
    });
  }
});

// The committed check overlay may narrow or widen the program (effect-drizzle
// includes `scripts` its tsconfig.json does not), so the synthesized overlay
// copies that selection and isolates the reference strategy it measures.
const TsconfigSelection = S.Struct({
  include: S.Array(S.String).pipe(S.optionalKey),
  exclude: S.Array(S.String).pipe(S.optionalKey),
});
const decodeTsconfigSelection = S.decodeUnknownEffect(TsconfigSelection);

const readCheckOverlaySelection = Effect.fn("CheckCensus.readCheckOverlaySelection")(function* (
  packageDir: string
): Effect.fn.Return<typeof TsconfigSelection.Type, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const overlayPath = path.join(packageDir, "tsconfig.check.json");
  const text = yield* fs
    .readFileString(overlayPath)
    .pipe(QualityScriptCommandError.mapError(`Failed to read ${overlayPath}.`));
  return yield* decodeTsconfigSelection(parseJsonc(text)).pipe(
    QualityScriptCommandError.mapError(`Failed to decode include/exclude from ${overlayPath}.`)
  );
});

// The reference-keeping overlay is the committed check overlay with two
// differences: it keeps `references` (so upstream packages resolve through
// their declaration output, as `tsc -p tsconfig.json` does) and it leaves the
// module settings to the base config. Everything else mirrors
// `tsconfig.check.json`: no emit, no composite/incremental state, and a
// repository-root `rootDir` so upstream files are legal program members.
const withReferenceKeepingOverlay = Effect.fnUntraced(function* <A, E, R>(
  repoRoot: string,
  packageDir: string,
  use: (configPath: string) => Effect.Effect<A, E, R>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const references = yield* readTsconfigReferences(packageDir);
  const selection = yield* readCheckOverlaySelection(packageDir);
  const configPath = path.join(packageDir, CHECK_CENSUS_OVERLAY_FILE_NAME);
  const configText = yield* jsonStringifyPretty({
    extends: "./tsconfig.json",
    ...selection,
    references,
    compilerOptions: {
      composite: false,
      incremental: false,
      declaration: false,
      declarationMap: false,
      emitDeclarationOnly: false,
      noEmit: true,
      rootDir: path.relative(packageDir, repoRoot),
    },
  }).pipe(QualityScriptCommandError.mapError("Failed to encode the reference-keeping overlay."));

  return yield* Effect.acquireRelease(
    fs
      .writeFileString(configPath, `${configText}\n`)
      .pipe(QualityScriptCommandError.mapError(`Failed to write ${configPath}.`), Effect.as(configPath)),
    (written) => fs.remove(written, { force: true }).pipe(Effect.ignore)
  ).pipe(Effect.flatMap(use), Effect.scoped);
});

const censusPackage = Effect.fn("CheckCensus.censusPackage")(function* (
  options: CheckCensusOptions,
  pkg: CheckCensusPackage
): Effect.fn.Return<CheckCensusRow, QualityScriptCommandError, CensusEnvironment> {
  const path = yield* Path.Path;
  const overlay = yield* measureProgram(
    options.tsgoPath,
    options.repoRoot,
    pkg.dir,
    path.join(pkg.dir, "tsconfig.check.json")
  );
  const buildFiles = yield* listProgramFiles(options.tsgoPath, path.join(pkg.dir, "tsconfig.json"), pkg.dir);
  const referenceKeeping = yield* withReferenceKeepingOverlay(options.repoRoot, pkg.dir, (configPath) =>
    measureProgram(options.tsgoPath, options.repoRoot, pkg.dir, configPath)
  );

  return CheckCensusRow.make({
    package: pkg.name,
    overlay: overlay.program,
    referenceKeeping: referenceKeeping.program,
    delta: CheckCensusDelta.make({
      files: referenceKeeping.program.files - overlay.program.files,
      upstreamSrc: referenceKeeping.program.upstreamSrc - overlay.program.upstreamSrc,
      upstreamDist: referenceKeeping.program.upstreamDist - overlay.program.upstreamDist,
      wallMs: referenceKeeping.program.wallMs - overlay.program.wallMs,
      diagnostics: referenceKeeping.program.diagnostics - overlay.program.diagnostics,
    }),
    buildOverlapFiles: A.length(A.filter(buildFiles, (file) => HashSet.has(overlay.files, file))),
  });
});

/**
 * Measure every selected package's check overlay against a synthesized
 * reference-keeping overlay, `concurrency` packages at a time.
 *
 * **Details**
 *
 * The run first proves the tree is built ({@link assertCheckCensusTreeBuilt}):
 * every project the selected packages reference must have its declaration
 * index on disk, or the census fails naming the packages and the
 * `bun run build` remediation before any compiler spawns. Per package it
 * then runs `tsgo -p tsconfig.check.json --listFilesOnly` and
 * `--extendedDiagnostics --pretty false`, lists `tsconfig.json` for the
 * build overlap column, then writes a temporary `tsconfig.__census.json`
 * (extends `./tsconfig.json`,
 * keeps its `references`, disables composite/incremental/declaration output,
 * `noEmit`, `rootDir` at the repository root), runs the same two commands
 * against it, and removes it. The census is evidence, not a gate:
 * diagnostics are counted, never raised.
 *
 * **Example** (Census one package)
 *
 * ```ts
 * import { runCheckCensus } from "@beep/repo-cli/commands/Quality/CheckCensus"
 *
 * const report = runCheckCensus({
 *   repoRoot: "/repo",
 *   tsgoPath: "/repo/node_modules/.bin/tsgo",
 *   packages: [{ name: "@beep/n3", dir: "/repo/packages/drivers/n3" }],
 *   concurrency: 1,
 * })
 * console.log(typeof report) // "object"
 * ```
 *
 * @param options - Repository root, tsgo binary, package selection, and worker bound.
 * @returns The census report, rows in the order the packages were given.
 * @category use-cases
 * @since 0.0.0
 */
export const runCheckCensus = Effect.fn("CheckCensus.run")(function* (
  options: CheckCensusOptions
): Effect.fn.Return<CheckCensusReport, QualityScriptCommandError, CensusEnvironment> {
  yield* assertCheckCensusTreeBuilt(options);
  const generatedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const rows = yield* Effect.forEach(options.packages, (pkg) => censusPackage(options, pkg), {
    concurrency: options.concurrency,
  });

  return CheckCensusReport.make({ generatedAt, concurrency: options.concurrency, rows });
});

const columnWidths = {
  package: 40,
  count: 7,
  wall: 9,
} as const;

const cell = (value: number | string, width: number): string => Str.padStart(width)(String(value));

const renderProgramCells = (program: CheckCensusProgram): string =>
  A.join(
    [
      cell(program.files, columnWidths.count),
      cell(program.upstreamSrc, columnWidths.count),
      cell(program.upstreamDist, columnWidths.count),
      cell(program.wallMs, columnWidths.wall),
      cell(program.diagnostics, columnWidths.count),
    ],
    " "
  );

const signed = (value: number): string => (value > 0 ? `+${value}` : String(value));

/**
 * Render the census as fixed-width text lines for stdout.
 *
 * **Example** (Render an empty report)
 *
 * ```ts
 * import { CheckCensusReport, renderCheckCensusLines } from "@beep/repo-cli/commands/Quality/CheckCensus"
 *
 * const lines = renderCheckCensusLines(CheckCensusReport.make({ generatedAt: "2026-09-09T00:00:00.000Z", concurrency: 4, rows: [] }))
 * console.log(lines.length) // 2
 * ```
 *
 * @param report - The census report to render.
 * @returns Header and one line per row.
 * @category rendering
 * @since 0.0.0
 */
export const renderCheckCensusLines = (report: CheckCensusReport): ReadonlyArray<string> => {
  const programHeader = A.join(
    [
      cell("files", columnWidths.count),
      cell("upSrc", columnWidths.count),
      cell("upDist", columnWidths.count),
      cell("wallMs", columnWidths.wall),
      cell("diags", columnWidths.count),
    ],
    " "
  );
  const header = `${Str.padEnd(columnWidths.package)("package")} | overlay: ${programHeader} | reference-keeping: ${programHeader} | delta files/wallMs/diags | build overlap`;

  return [
    `check census (${report.rows.length} packages, concurrency ${report.concurrency}, ${report.generatedAt})`,
    header,
    ...A.map(
      report.rows,
      (row) =>
        `${Str.padEnd(columnWidths.package)(row.package)} | overlay: ${renderProgramCells(row.overlay)} | reference-keeping: ${renderProgramCells(row.referenceKeeping)} | ${signed(row.delta.files)}/${signed(row.delta.wallMs)}/${signed(row.delta.diagnostics)} | ${row.buildOverlapFiles}`
    ),
  ];
};

const hasCheckOverlay = Effect.fn("CheckCensus.hasCheckOverlay")(function* (
  dir: string
): Effect.fn.Return<boolean, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const [overlay, build] = yield* Effect.all([
    fs.exists(path.join(dir, "tsconfig.check.json")).pipe(Effect.orElseSucceed(thunkFalse)),
    fs.exists(path.join(dir, "tsconfig.json")).pipe(Effect.orElseSucceed(thunkFalse)),
  ]);

  return overlay && build;
});

const nameMatches = (filter: O.Option<string>, name: string): boolean =>
  O.match(filter, { onNone: () => true, onSome: (needle) => Str.includes(needle)(name) });

/**
 * Resolve the workspace packages that own both `tsconfig.json` and
 * `tsconfig.check.json`, optionally narrowed by a name substring.
 *
 * **Example** (Select drivers only)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { selectCheckCensusPackages } from "@beep/repo-cli/commands/Quality/CheckCensus"
 *
 * const program = selectCheckCensusPackages("/repo", O.some("@beep/n3"))
 * console.log(typeof program) // "object"
 * ```
 *
 * @param repoRoot - Repository root whose workspaces are scanned.
 * @param filter - Optional substring every selected package name must contain.
 * @returns Packages sorted by name.
 * @category use-cases
 * @since 0.0.0
 */
export const selectCheckCensusPackages = Effect.fn("CheckCensus.selectPackages")(function* (
  repoRoot: string,
  filter: O.Option<string>
): Effect.fn.Return<
  ReadonlyArray<CheckCensusPackage>,
  QualityScriptCommandError,
  FileSystem.FileSystem | Path.Path | FsUtils
> {
  const workspaces = yield* resolveWorkspacePackages(repoRoot).pipe(
    QualityScriptCommandError.mapError("Failed to resolve workspace packages.")
  );
  const candidates = pipe(
    HashMap.toEntries(workspaces),
    A.filter(([name]) => nameMatches(filter, name)),
    A.map(([name, workspace]) => CheckCensusPackage.make({ name, dir: workspace.dir })),
    A.sortWith((pkg) => pkg.name, Order.String)
  );

  return yield* Effect.filter(candidates, (pkg) => hasCheckOverlay(pkg.dir));
});

const runCheckCensusCli = Effect.fn("CheckCensus.cli")(function* (
  outputJsonPath: string,
  filter: O.Option<string>
): Effect.fn.Return<void, QualityScriptCommandError, CensusEnvironment | FsUtils> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot().pipe(QualityScriptCommandError.mapError("Failed to locate repository root."));
  const packages = yield* selectCheckCensusPackages(repoRoot, filter);
  const report = yield* runCheckCensus(
    CheckCensusOptions.make({
      repoRoot,
      tsgoPath: path.join(repoRoot, "node_modules", ".bin", "tsgo"),
      packages,
    })
  );
  const outputPath = path.resolve(repoRoot, outputJsonPath);
  const json = yield* jsonStringifyPretty(report).pipe(
    QualityScriptCommandError.mapError("Failed to encode the check census report.")
  );

  yield* printLines(renderCheckCensusLines(report));
  yield* fs
    .makeDirectory(path.dirname(outputPath), { recursive: true })
    .pipe(QualityScriptCommandError.mapError(`Failed to create ${path.dirname(outputPath)}.`));
  yield* fs
    .writeFileString(outputPath, `${json}\n`)
    .pipe(QualityScriptCommandError.mapError(`Failed to write ${outputPath}.`));
  yield* Console.log(`wrote ${path.relative(repoRoot, outputPath)}`);
});

/**
 * `beep quality check-census`: measure every check overlay against a
 * reference-keeping overlay and write the report (evidence for the PR-2
 * overlay switch; exit 0 unless the census itself fails). Requires a built
 * tree: every referenced project's declaration output must exist.
 *
 * **Example** (Register the subcommand)
 *
 * ```ts
 * import { checkCensusCommand } from "@beep/repo-cli/commands/Quality/CheckCensus"
 *
 * console.log(typeof checkCensusCommand) // "object"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const checkCensusCommand = Command.make(
  "check-census",
  {
    outputJson: Flag.string("output-json").pipe(
      Flag.withDefault(DEFAULT_CHECK_CENSUS_OUTPUT_PATH),
      Flag.withDescription("JSON report path, relative to the repository root")
    ),
    filter: Flag.string("filter").pipe(
      Flag.withDescription("Only census packages whose name contains this text"),
      Flag.optional
    ),
  },
  ({ filter, outputJson }) => runCheckCensusCli(outputJson, filter)
).pipe(
  Command.withDescription(
    "Measure check overlays against a reference-keeping overlay (program size, upstream, wall); needs a built tree"
  )
);
