/**
 * Shared project-scan scaffolding for repo-local supplemental laws.
 *
 * Owns the pieces every ts-morph-backed law repeats: the project inspection
 * request, repo-relative path exclusion, deterministic source-file ordering,
 * per-file diagnostic accumulation, and the scanned/touched/violation summary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { isExcludedTypeScriptSourcePath, toPosixPath } from "@beep/repo-utils/schemas/TypeScriptSourceExclusions";
import { TSMorphService, TsMorphProjectInspectionRequest } from "@beep/repo-utils/TSMorph/index";
import { A, Str } from "@beep/utils";
import { Effect, Order, Path, pipe } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type { TSMorphServiceError } from "@beep/repo-utils/TSMorph/index";
import type { SourceFile } from "ts-morph";

/**
 * Production TypeScript globs scanned by the repo-local supplemental laws.
 *
 * @category constants
 * @since 0.0.0
 */
export const LAW_SCAN_INCLUDED_GLOBS = ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}", "infra/**/*.ts"] as const;

const ECOSYSTEM_MEMBER_SOURCE_PREFIX = "packages/ecosystem/";

/**
 * Reports whether a normalized repo-relative path is inside an ecosystem member.
 *
 * @param filePath - Repo-relative source path under consideration.
 * @returns `true` for paths shaped as `packages/ecosystem/<member>/...`.
 * @category predicates
 * @since 0.0.0
 */
export const isEcosystemMemberSourcePath = (filePath: string): boolean => {
  const normalized = toPosixPath(filePath);
  return (
    Str.startsWith(ECOSYSTEM_MEMBER_SOURCE_PREFIX)(normalized) &&
    Str.includes("/")(Str.slice(ECOSYSTEM_MEMBER_SOURCE_PREFIX.length)(normalized))
  );
};

type ScannedSourceFile = readonly [file: string, sourceFile: SourceFile];

const byScannedSourceFilePathAscending = Order.mapInput(Order.String, ([file]: ScannedSourceFile) => file);

const decodeProjectInspectionRequest = S.decodeUnknownEffect(TsMorphProjectInspectionRequest);

/**
 * Reports whether a repo-relative path is outside the scanned law surface.
 *
 * @param excludePaths - Repo-relative paths the caller opted out of scanning.
 * @param filePath - The repo-relative path under consideration.
 * @returns `true` when the path is excluded and must not be scanned.
 * @category predicates
 * @since 0.0.0
 */
export const isExcludedLawScanPath: {
  (filePath: string): (excludePaths: ReadonlyArray<string>) => boolean;
  (excludePaths: ReadonlyArray<string>, filePath: string): boolean;
} = dual(2, (excludePaths: ReadonlyArray<string>, filePath: string): boolean => {
  const normalized = toPosixPath(filePath);
  return (
    A.some(excludePaths, (excludePath) => normalized === toPosixPath(excludePath)) ||
    isExcludedTypeScriptSourcePath(normalized)
  );
});

/**
 * Inputs for a single supplemental-law project scan.
 *
 * @category models
 * @since 0.0.0
 */
export type LawScanOptions<Diagnostic> = {
  readonly sourceFileGlobs: ReadonlyArray<string>;
  readonly includePaths: ReadonlyArray<string> | undefined;
  readonly excludePaths: ReadonlyArray<string>;
  readonly strictCheck: boolean;
  readonly collect: (relativeFilePath: string, sourceFile: SourceFile) => ReadonlyArray<Diagnostic>;
};

/**
 * Select the default law globs unless an explicit file scope was supplied.
 *
 * **Example** (Select a changed-file scope)
 *
 * ```ts
 * import { lawScanSourcePaths } from "@beep/repo-cli/commands/Laws/internal/LawScan"
 *
 * console.log(lawScanSourcePaths(["packages/demo/src/index.ts"]))
 * ```
 *
 * @param includePaths - Explicit repo-relative files, or `undefined` for the full law scope.
 * @returns Source paths suitable for ts-morph project inspection.
 * @category utilities
 * @since 0.0.0
 */
export const lawScanSourcePaths = (includePaths: ReadonlyArray<string> | undefined): ReadonlyArray<string> =>
  includePaths ?? LAW_SCAN_INCLUDED_GLOBS;

type LawScanDiagnostics<Diagnostic> = {
  readonly affectedFiles: ReadonlyArray<string>;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
};

const noLawScanDiagnostics = <Diagnostic>(): LawScanDiagnostics<Diagnostic> => ({
  affectedFiles: A.empty<string>(),
  diagnostics: A.empty<Diagnostic>(),
});

const isScannedLawSourcePath = <Diagnostic>(options: LawScanOptions<Diagnostic>, relativeFilePath: string): boolean =>
  !isExcludedLawScanPath(options.excludePaths, relativeFilePath) &&
  (options.includePaths === undefined || A.contains(options.includePaths, relativeFilePath));

const collectScannedSourceFiles = <Diagnostic>(
  options: LawScanOptions<Diagnostic>,
  sourceFiles: ReadonlyArray<SourceFile>,
  toRelativeFilePath: (sourceFile: SourceFile) => string
): ReadonlyArray<ScannedSourceFile> =>
  pipe(
    sourceFiles,
    A.map((sourceFile): ScannedSourceFile => [toRelativeFilePath(sourceFile), sourceFile]),
    A.filter(([relativeFilePath]) => isScannedLawSourcePath(options, relativeFilePath)),
    A.sort(byScannedSourceFilePathAscending)
  );

const collectLawScanDiagnostics = <Diagnostic>(
  scannedSourceFiles: ReadonlyArray<ScannedSourceFile>,
  collect: LawScanOptions<Diagnostic>["collect"]
): LawScanDiagnostics<Diagnostic> =>
  A.reduce(scannedSourceFiles, noLawScanDiagnostics<Diagnostic>(), (scanned, [relativeFilePath, sourceFile]) => {
    const fileDiagnostics = collect(relativeFilePath, sourceFile);
    return A.isReadonlyArrayNonEmpty(fileDiagnostics)
      ? {
          affectedFiles: A.append(scanned.affectedFiles, relativeFilePath),
          diagnostics: A.appendAll(scanned.diagnostics, fileDiagnostics),
        }
      : scanned;
  });

/**
 * Accumulated result of a supplemental-law project scan.
 *
 * @category models
 * @since 0.0.0
 */
export type LawScanResult<Diagnostic> = {
  readonly scannedFiles: number;
  readonly touchedFiles: number;
  readonly violationCount: number;
  readonly strictFailure: boolean;
  readonly affectedFiles: ReadonlyArray<string>;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
};

/**
 * Scan repo TypeScript source with a per-source-file diagnostic visitor.
 *
 * @category utilities
 * @since 0.0.0
 */
export const runLawScan = Effect.fn("LawScan.runLawScan")(function* <Diagnostic>(
  options: LawScanOptions<Diagnostic>
): Effect.fn.Return<LawScanResult<Diagnostic>, S.SchemaError | TSMorphServiceError, TSMorphService | Path.Path> {
  const service = yield* TSMorphService;
  const path = yield* Path.Path;

  const request = yield* decodeProjectInspectionRequest({
    entrypoint: {
      _tag: "tsconfig",
      tsConfigPath: "tsconfig.json",
    },
    repoRootPath: null,
    mode: "syntax",
    referencePolicy: "workspaceOnly",
    filePaths: A.empty(),
    sourceFileGlobs: A.fromIterable(options.sourceFileGlobs),
  });

  return yield* service.inspectProject(request, ({ scope, sourceFiles }) => {
    const scannedSourceFiles = collectScannedSourceFiles(options, sourceFiles, (sourceFile) =>
      toPosixPath(path.relative(scope.repoRootPath, sourceFile.getFilePath()))
    );
    const { affectedFiles, diagnostics } = collectLawScanDiagnostics(scannedSourceFiles, options.collect);
    const violationCount = A.length(diagnostics);

    return {
      scannedFiles: A.length(scannedSourceFiles),
      touchedFiles: A.length(affectedFiles),
      violationCount,
      strictFailure: options.strictCheck && violationCount > 0,
      affectedFiles,
      diagnostics,
    };
  });
});
