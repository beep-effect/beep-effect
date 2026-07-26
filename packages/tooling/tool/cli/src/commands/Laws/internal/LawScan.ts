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
import { A } from "@beep/utils";
import { Effect, Order, Path } from "effect";
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
export const isExcludedLawScanPath = (excludePaths: ReadonlyArray<string>, filePath: string): boolean => {
  const normalized = toPosixPath(filePath);
  return (
    A.some(excludePaths, (excludePath) => normalized === toPosixPath(excludePath)) ||
    isExcludedTypeScriptSourcePath(normalized)
  );
};

/**
 * Inputs for a single supplemental-law project scan.
 *
 * @category models
 * @since 0.0.0
 */
export type LawScanOptions<Diagnostic> = {
  readonly sourceFileGlobs: ReadonlyArray<string>;
  readonly excludePaths: ReadonlyArray<string>;
  readonly strictCheck: boolean;
  readonly collect: (relativeFilePath: string, sourceFile: SourceFile) => ReadonlyArray<Diagnostic>;
};

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
    let scannedSourceFiles = A.empty<ScannedSourceFile>();

    for (const sourceFile of sourceFiles) {
      const relativeFilePath = toPosixPath(path.relative(scope.repoRootPath, sourceFile.getFilePath()));

      if (isExcludedLawScanPath(options.excludePaths, relativeFilePath)) {
        continue;
      }

      scannedSourceFiles = A.append(scannedSourceFiles, [relativeFilePath, sourceFile] as const);
    }

    scannedSourceFiles = A.sort(scannedSourceFiles, byScannedSourceFilePathAscending);

    let diagnostics = A.empty<Diagnostic>();
    let affectedFiles = A.empty<string>();

    for (const [relativeFilePath, sourceFile] of scannedSourceFiles) {
      const fileDiagnostics = options.collect(relativeFilePath, sourceFile);
      if (A.isReadonlyArrayNonEmpty(fileDiagnostics)) {
        affectedFiles = A.append(affectedFiles, relativeFilePath);
        diagnostics = A.appendAll(diagnostics, fileDiagnostics);
      }
    }

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
