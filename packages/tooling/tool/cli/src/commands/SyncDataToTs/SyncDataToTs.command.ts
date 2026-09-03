/**
 * Sync checked-in official datasets into deterministic TypeScript modules.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Md } from "@beep/md";
import { findRepoRoot } from "@beep/repo-utils";
import { A, Str, Struct, thunkEffectVoid, thunkTrue } from "@beep/utils";
import { Console, Effect, FileSystem, flow, JsonPointer, Match, Path, pipe, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { resolveRunMode as resolveSharedRunMode, runModeFlagsConflict } from "../../internal/cli/RunMode.ts";
import { formatJson } from "./internal/Source.ts";
import {
  SyncDataRunMode,
  SyncDataTargetResult,
  SyncDataToTsDriftError,
  SyncDataToTsError,
} from "./SyncDataToTs.schemas.ts";
import { syncDataTargets } from "./targets/index.ts";
import type { Crypto, JsonPatch } from "effect";
import type { HttpClient } from "effect/unstable/http";
import type { SyncDataFileResult, SyncDataTarget } from "./SyncDataToTs.schemas.ts";

const targetFlag = Flag.string("target").pipe(
  Flag.withAlias("t"),
  Flag.withDescription("Sync a single checked-in target by id"),
  Flag.optional
);

const allFlag = Flag.boolean("all").pipe(Flag.withDefault(false), Flag.withDescription("Sync every checked-in target"));
const includeAuthenticatedFlag = Flag.boolean("include-authenticated").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Include sync targets that require configured authenticated source access when --all is used")
);
const checkFlag = Flag.boolean("check").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Report drift without writing files and exit non-zero when changes are needed")
);
const dryRunFlag = Flag.boolean("dry-run").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Preview file updates without writing them")
);
const verboseFlag = Flag.boolean("verbose").pipe(
  Flag.withDefault(false),
  Flag.withAlias("v"),
  Flag.withDescription("Log unchanged targets in addition to changed targets")
);
const reportDirFlag = Flag.string("report-dir").pipe(
  Flag.withDescription("Write data-sync-report.md and data-sync-report.json into this directory"),
  Flag.optional
);

const syncDataCanonicalDiffer = S.toDifferJsonPatch(S.Json);
const decodeJsonText = S.decodeUnknownEffect(S.fromJsonString(S.Json));

class SyncDataTargetSelection extends S.Class<SyncDataTargetSelection>("SyncDataTargetSelection")({
  targetId: S.Option(S.String),
  all: S.Boolean,
  includeAuthenticated: S.Boolean,
}) {}

const runModeFlagConflictError = () =>
  SyncDataToTsError.make({
    message: "The --check and --dry-run flags are mutually exclusive.",
  });

const resolveRunMode = (check: boolean, dryRun: boolean): Effect.Effect<SyncDataRunMode, SyncDataToTsError> =>
  runModeFlagsConflict(check, dryRun)
    ? Effect.fail(runModeFlagConflictError())
    : Effect.succeed(
        resolveSharedRunMode(
          [
            [check, "check"],
            [dryRun, "dry-run"],
          ],
          "write"
        )
      );

const targetSelectionConflictError = () =>
  SyncDataToTsError.make({
    message: "Pass either --all or --target, but not both.",
  });

const targetSelectionRequiredError = () =>
  SyncDataToTsError.make({
    message: "Select at least one target with --target <id> or pass --all.",
  });

const unknownTargetError = (targetId: string) =>
  SyncDataToTsError.make({
    message: `Unknown sync target "${targetId}". Available targets: ${pipe(
      syncDataTargets,
      A.map((candidate) => candidate.id),
      A.join(", ")
    )}`,
    targetId,
  });

const resolveTargetById = (targetId: string): Effect.Effect<ReadonlyArray<SyncDataTarget>, SyncDataToTsError> =>
  pipe(
    syncDataTargets,
    A.findFirst((candidate) => candidate.id === targetId),
    O.map(A.of),
    Effect.fromOption,
    Effect.mapError(() => unknownTargetError(targetId))
  );

const resolveSelectedTarget = flow(
  O.map(resolveTargetById),
  O.getOrElse(() => Effect.fail(targetSelectionRequiredError()))
);

const targetIsEnabledForAll =
  (includeAuthenticated: boolean) =>
  (target: SyncDataTarget): boolean =>
    target.access === "public" || includeAuthenticated;

const resolveTargetSelection: (
  selection: SyncDataTargetSelection
) => Effect.Effect<ReadonlyArray<SyncDataTarget>, SyncDataToTsError> = Match.type<SyncDataTargetSelection>().pipe(
  Match.when(
    ({ all, targetId }) => all && O.isSome(targetId),
    () => Effect.fail(targetSelectionConflictError())
  ),
  Match.when(
    ({ all }) => all,
    ({ includeAuthenticated }) =>
      Effect.succeed(pipe(syncDataTargets, A.filter(targetIsEnabledForAll(includeAuthenticated))))
  ),
  Match.orElse(({ targetId }) => resolveSelectedTarget(targetId))
);

const resolveTargets = Effect.fnUntraced(function* (
  targetId: O.Option<string>,
  all: boolean,
  includeAuthenticated: boolean
): Effect.fn.Return<ReadonlyArray<SyncDataTarget>, SyncDataToTsError> {
  return yield* resolveTargetSelection(SyncDataTargetSelection.make({ targetId, all, includeAuthenticated }));
});

const readExistingFile = Effect.fn(function* (
  absolutePath: string,
  targetId: string,
  outputPath: string
): Effect.fn.Return<O.Option<string>, SyncDataToTsError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs.exists(absolutePath).pipe(
    Effect.mapError(() =>
      SyncDataToTsError.make({
        message: `Failed to check whether ${absolutePath} exists.`,
        targetId,
        file: outputPath,
      })
    )
  );

  return yield* fs.readFileString(absolutePath).pipe(
    Effect.asSome,
    Effect.mapError(() =>
      SyncDataToTsError.make({
        message: `Failed to read ${absolutePath}.`,
        targetId,
        file: outputPath,
      })
    ),
    Effect.when(Effect.succeed(exists)),
    Effect.map(O.flatten)
  );
});

const writeGeneratedFile = Effect.fn("writeGeneratedFile")(function* (
  absolutePath: string,
  content: string,
  targetId: string,
  outputPath: string
): Effect.fn.Return<void, SyncDataToTsError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.dirname(absolutePath), { recursive: true }).pipe(
    Effect.mapError(() =>
      SyncDataToTsError.make({
        message: `Failed to create parent directory for ${absolutePath}.`,
        targetId,
        file: outputPath,
      })
    )
  );
  yield* fs.writeFileString(absolutePath, content).pipe(
    Effect.mapError(() =>
      SyncDataToTsError.make({
        message: `Failed to write ${absolutePath}.`,
        targetId,
        file: outputPath,
      })
    )
  );
});

const decodeExistingCanonical = (
  content: string,
  targetId: string,
  outputPath: string
): Effect.Effect<S.Json, SyncDataToTsError> =>
  decodeJsonText(content).pipe(
    Effect.mapError((cause) =>
      SyncDataToTsError.make({
        message: `Failed to parse existing canonical JSON sidecar for ${targetId}.`,
        targetId,
        file: outputPath,
        cause,
      })
    )
  );

const diffCanonical = Effect.fn("SyncDataToTs.diffCanonical")(function* (
  repoRoot: string,
  targetId: string,
  canonicalPath: string,
  canonical: S.Json
): Effect.fn.Return<JsonPatch.JsonPatch, SyncDataToTsError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const existing = yield* readExistingFile(path.resolve(repoRoot, canonicalPath), targetId, canonicalPath);
  const oldCanonical = yield* pipe(
    existing,
    O.map((content) => decodeExistingCanonical(content, targetId, canonicalPath)),
    O.getOrElse(() => Effect.succeed(null))
  );

  return syncDataCanonicalDiffer.diff(oldCanonical, canonical);
});

const syncOutputFile = Effect.fn("SyncDataToTs.syncOutputFile")(function* (
  repoRoot: string,
  mode: SyncDataRunMode,
  targetId: string,
  file: { readonly path: string; readonly content: string }
): Effect.fn.Return<SyncDataFileResult, SyncDataToTsError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const absolutePath = path.resolve(repoRoot, file.path);
  const existing = yield* readExistingFile(absolutePath, targetId, file.path);
  const changed = pipe(
    existing,
    O.map((current) => current !== file.content),
    O.getOrElse(thunkTrue)
  );

  yield* writeGeneratedFile(absolutePath, file.content, targetId, file.path).pipe(
    Effect.when(Effect.succeed(changed && SyncDataRunMode.is.write(mode))),
    Effect.asVoid
  );

  return {
    path: file.path,
    changed,
  };
});

const syncTarget = Effect.fn("syncTarget")(function* (
  repoRoot: string,
  mode: SyncDataRunMode,
  target: SyncDataTarget
): Effect.fn.Return<
  SyncDataTargetResult,
  SyncDataToTsError,
  FileSystem.FileSystem | HttpClient.HttpClient | Path.Path | Crypto.Crypto
> {
  const projection = yield* target.acquire;
  const canonicalPatch = yield* diffCanonical(repoRoot, target.id, projection.canonicalPath, projection.canonical);
  const fileResults = yield* Effect.forEach(
    projection.files,
    (file) => syncOutputFile(repoRoot, mode, target.id, file),
    {
      concurrency: 1,
    }
  );
  const changedFiles = pipe(fileResults, A.filter(Struct.get("changed")), A.map(Struct.get("path")));

  return SyncDataTargetResult.make({
    targetId: target.id,
    outputPaths: pipe(projection.files, A.map(Struct.get("path"))),
    changed: A.length(changedFiles) > 0,
    changedFiles,
    fileResults,
    recordCount: projection.recordCount,
    summary: projection.summary,
    sourceUrls: target.sourceUrls,
    sources: projection.sources,
    canonicalPath: projection.canonicalPath,
    canonicalPatch,
  });
});

/**
 * Test-only access to the per-target producer so schema proofs exercise the
 * same construction path used by the command.
 *
 * **Example** (Check testing helper type)
 *
 * ```ts
 * import { syncTargetForTesting } from "@beep/repo-cli/test/SyncDataToTs"
 *
 * console.log(typeof syncTargetForTesting) // "function"
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const syncTargetForTesting = syncTarget;

const primaryOutputPath = (result: SyncDataTargetResult): string =>
  pipe(
    result.outputPaths,
    A.head,
    O.getOrElse(() => result.canonicalPath)
  );

const renderChangedTargetMessage = (result: SyncDataTargetResult, mode: SyncDataRunMode): string =>
  SyncDataRunMode.$match(mode, {
    write: () => `sync-data-to-ts: updated ${result.targetId} -> ${primaryOutputPath(result)} (${result.summary})`,
    "dry-run": () =>
      `sync-data-to-ts: would update ${result.targetId} -> ${primaryOutputPath(result)} (${result.summary})`,
    check: () => `sync-data-to-ts: drift detected for ${result.targetId} -> ${primaryOutputPath(result)}`,
  });

const renderUnchangedTargetMessage = (result: SyncDataTargetResult): string =>
  `sync-data-to-ts: up to date ${result.targetId} -> ${primaryOutputPath(result)}`;

const targetResultMessage = (mode: SyncDataRunMode, verbose: boolean) =>
  Match.type<SyncDataTargetResult>().pipe(
    Match.when(
      (result) => result.changed,
      (result) => O.some(renderChangedTargetMessage(result, mode))
    ),
    Match.orElse((result) =>
      pipe(
        O.some(renderUnchangedTargetMessage(result)),
        O.filter(() => verbose)
      )
    )
  );

const reportTargetResult = Effect.fn("SyncDataToTs.reportTargetResult")(function* (
  result: SyncDataTargetResult,
  mode: SyncDataRunMode,
  verbose: boolean
) {
  yield* pipe(
    targetResultMessage(mode, verbose)(result),
    O.map(Console.log),
    O.getOrElse(() => Effect.void)
  );
});

const renderSummaryMessage = (mode: SyncDataRunMode, changedCount: number, totalCount: number): string =>
  SyncDataRunMode.$match(mode, {
    write: () => `sync-data-to-ts: wrote ${changedCount} of ${totalCount} target(s)`,
    "dry-run": () => `sync-data-to-ts: ${changedCount} of ${totalCount} target(s) would change`,
    check: () => `sync-data-to-ts: ${changedCount} of ${totalCount} target(s) have drift`,
  });

const reportSummary = Effect.fn("SyncDataToTs.reportSummary")(function* (
  results: ReadonlyArray<SyncDataTargetResult>,
  mode: SyncDataRunMode
) {
  const changedCount = pipe(results, A.filter(Struct.get("changed")), A.length);

  const totalCount = A.length(results);

  yield* Console.log(renderSummaryMessage(mode, changedCount, totalCount));
});

const humanizeJsonPointer = (path: string): string =>
  path === "" ? "/" : pipe(Str.split(path, "/"), A.drop(1), A.map(JsonPointer.unescapeToken), A.join("."));

const patchSummaryRows = (result: SyncDataTargetResult): ReadonlyArray<ReadonlyArray<string>> =>
  pipe(
    result.canonicalPatch,
    A.map((operation) => [
      result.targetId,
      operation.op,
      humanizeJsonPointer(operation.path),
      "value" in operation ? formatJson(operation.value).trimEnd() : "",
    ])
  );

const renderReportMarkdown = (
  results: ReadonlyArray<SyncDataTargetResult>,
  mode: SyncDataRunMode
): Effect.Effect<string, SyncDataToTsError> => {
  const targetRows = pipe(
    results,
    A.map((result) => [
      result.targetId,
      result.changed ? "changed" : "up to date",
      `${result.recordCount}`,
      result.summary,
      A.join(", ")(result.changedFiles),
    ])
  );
  const patchRows = pipe(results, A.flatMap(patchSummaryRows));
  const document = Md.make([
    Md.h1("Official Data Sync Report"),
    Md.p(`Mode: ${mode}`),
    Md.h2("Targets"),
    Md.table([["Target", "Status", "Records", "Summary", "Changed files"], ...targetRows], {
      headerRow: true,
    }),
    Md.h2("Canonical Patch"),
    A.length(patchRows) > 0
      ? Md.table([["Target", "Op", "Path", "Value"], ...patchRows], { headerRow: true })
      : Md.p("No canonical data changes."),
  ]);

  return pipe(
    Md.render(document),
    Result.match({
      onFailure: () =>
        Effect.fail(SyncDataToTsError.make({ message: "Failed to render the data-sync markdown report." })),
      onSuccess: Effect.succeed,
    })
  );
};

const renderReportJson = (results: ReadonlyArray<SyncDataTargetResult>, mode: SyncDataRunMode): string =>
  formatJson({
    schemaVersion: "data-sync-report/v1",
    mode,
    targets: pipe(
      results,
      A.map((result) => ({
        id: result.targetId,
        changed: result.changed,
        changedFiles: result.changedFiles,
        recordCount: result.recordCount,
        summary: result.summary,
        sources: result.sources,
        canonicalPath: result.canonicalPath,
        canonicalPatch: result.canonicalPatch,
      }))
    ),
  });

const writeReportFile = Effect.fn("SyncDataToTs.writeReportFile")(function* (
  reportDir: string,
  filename: string,
  content: string
): Effect.fn.Return<void, SyncDataToTsError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs
    .makeDirectory(reportDir, { recursive: true })
    .pipe(SyncDataToTsError.mapError(`Failed to create report directory ${reportDir}`));
  yield* fs
    .writeFileString(path.join(reportDir, filename), content)
    .pipe(SyncDataToTsError.mapError(`Failed to write report file ${filename}`));
});

const writeReports = Effect.fn("SyncDataToTs.writeReports")(function* (
  reportDir: O.Option<string>,
  results: ReadonlyArray<SyncDataTargetResult>,
  mode: SyncDataRunMode
) {
  if (O.isNone(reportDir)) {
    return;
  }

  const markdownReport = yield* renderReportMarkdown(results, mode);
  yield* writeReportFile(reportDir.value, "data-sync-report.md", markdownReport);
  yield* writeReportFile(reportDir.value, "data-sync-report.json", renderReportJson(results, mode));
});

const failOnChangedTargets = (results: ReadonlyArray<SyncDataTargetResult>) => {
  const changedTargets = pipe(
    results,
    A.filter((result) => result.changed)
  );

  return A.match(changedTargets, {
    onEmpty: thunkEffectVoid,
    onNonEmpty: (nonEmptyTargets) =>
      Effect.fail(
        SyncDataToTsDriftError.new(
          A.length(nonEmptyTargets),
          `Detected drift in ${A.length(nonEmptyTargets)} target(s): ${pipe(
            nonEmptyTargets,
            A.map((result) => result.targetId),
            A.join(", ")
          )}. Run "bun run beep sync-data-to-ts --all" to refresh generated files.`
        )
      ),
  });
};

const failOnCheckDrift = (results: ReadonlyArray<SyncDataTargetResult>, mode: SyncDataRunMode) =>
  failOnChangedTargets(results).pipe(Effect.when(Effect.succeed(SyncDataRunMode.is.check(mode))), Effect.asVoid);

const renderSyncDataErrorContext = (error: SyncDataToTsError): string =>
  pipe(
    A.make(
      pipe(
        O.fromNullishOr(error.targetId),
        O.map((value) => `target=${value}`)
      ),
      pipe(
        O.fromNullishOr(error.file),
        O.map((value) => `file=${value}`)
      )
    ),
    A.getSomes,
    A.join(", ")
  );

const renderSyncDataError = (error: SyncDataToTsError): string =>
  pipe(
    renderSyncDataErrorContext(error),
    O.liftPredicate(Str.isNonEmpty),
    O.map((context) => `sync-data-to-ts: ${error.message} (${context})`),
    O.getOrElse(() => `sync-data-to-ts: ${error.message}`)
  );

/**
 * CLI command for syncing official upstream datasets into checked-in TypeScript modules.
 *
 * **Example** (Run sync data command)
 *
 * ```ts
 * import { syncDataToTsCommand } from "@beep/repo-cli/commands/SyncDataToTs"
 * import { Command } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const run = Command.run(syncDataToTsCommand, { version: "0.0.0" })
 * console.log(Effect.isEffect(run)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const syncDataToTsCommand = Command.make(
  "sync-data-to-ts",
  {
    target: targetFlag,
    all: allFlag,
    includeAuthenticated: includeAuthenticatedFlag,
    check: checkFlag,
    dryRun: dryRunFlag,
    verbose: verboseFlag,
    reportDir: reportDirFlag,
  },
  Effect.fn(
    function* ({ target, all, includeAuthenticated, check, dryRun, verbose, reportDir }) {
      const repoRoot = yield* findRepoRoot();
      const mode = yield* resolveRunMode(check, dryRun);
      const targets = yield* resolveTargets(target, all, includeAuthenticated);
      const results = yield* Effect.forEach(targets, (currentTarget) => syncTarget(repoRoot, mode, currentTarget), {
        concurrency: 1,
      });

      yield* Effect.forEach(results, (result) => reportTargetResult(result, mode, verbose), {
        discard: true,
      });
      yield* writeReports(reportDir, results, mode);
      yield* reportSummary(results, mode);
      yield* failOnCheckDrift(results, mode);
    },
    Effect.catchTags({
      SyncDataToTsDriftError: Effect.fn(function* (error) {
        yield* Console.error(`sync-data-to-ts: ${error.message}`);
        return yield* failWithReportedExit(`sync-data-to-ts: ${error.message}`);
      }),
      SyncDataToTsError: Effect.fn(function* (error) {
        const message = renderSyncDataError(error);
        yield* Console.error(message);
        return yield* failWithReportedExit(message);
      }),
      NoSuchFileError: Effect.fn(function* (error) {
        yield* Console.error(`sync-data-to-ts: ${error.message}`);
        return yield* failWithReportedExit(`sync-data-to-ts: ${error.message}`);
      }),
    })
  )
).pipe(Command.withDescription("Sync official upstream datasets into checked-in TypeScript modules"));
