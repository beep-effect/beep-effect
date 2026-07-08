/**
 * Architecture operation-plan filesystem execution.
 *
 * @packageDocumentation
 * @category cli-commands
 * @since 0.0.0
 */

import { DomainError } from "@beep/repo-utils";
import { normalizePath } from "@beep/schema";
import { A, Str, thunkFalse } from "@beep/utils";
import { Effect, FileSystem, Match, Path } from "effect";
import { dual } from "effect/Function";
import {
  ArchitectureOperationCheck,
  OperationPlanApplyResult,
  OperationPlanCheckResult,
} from "./Architecture.schemas.js";
import { renderPackageJsonOperation } from "./OperationPlanPackageJson.js";
import type {
  ArchitectureOperation,
  ArchitectureOperationCheckStatus,
  CanonicalSliceOperationPlan,
  WriteFileOperation,
  WritePackageJsonOperation,
} from "./Architecture.schemas.js";

type EnsureAbsentPathOperation = Extract<ArchitectureOperation, { readonly kind: "ensure-absent-path" }>;
type EnsureFileOperation = Extract<ArchitectureOperation, { readonly kind: "ensure-file" }>;

const operationIdFor = (kind: ArchitectureOperation["kind"], operationPath: string): string =>
  `${kind}:${operationPath}`;

const pathExists = Effect.fn(function* (absolutePath: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.exists(absolutePath).pipe(Effect.orElseSucceed(thunkFalse));
});

const resolveOperationPath = Effect.fn(function* (rootDir: string, operationPath: string) {
  const path = yield* Path.Path;
  const resolvedRoot = path.resolve(rootDir);
  const resolvedPath = path.resolve(resolvedRoot, operationPath);
  const relativeFromRoot = normalizePath(path.relative(resolvedRoot, resolvedPath));

  if (path.isAbsolute(operationPath) || relativeFromRoot === ".." || Str.startsWith("../")(relativeFromRoot)) {
    return yield* DomainError.newMessage(`Architecture operation path escapes repository root: ${operationPath}`);
  }

  return resolvedPath;
});

const checkStatusFor = (
  operation: ArchitectureOperation,
  status: ArchitectureOperationCheckStatus
): ArchitectureOperationCheck =>
  ArchitectureOperationCheck.make({
    operationId: Str.equivalence(operation.operationId, "legacy-operation")
      ? operationIdFor(operation.kind, operation.path)
      : operation.operationId,
    kind: operation.kind,
    path: operation.path,
    status,
  });

const renderWritableOperation = (
  operation: WriteFileOperation | WritePackageJsonOperation
): Effect.Effect<string, DomainError> => {
  if (operation.kind === "write-file") return Effect.succeed(operation.content);
  return renderPackageJsonOperation(operation);
};

const readOperationFile = (
  fs: FileSystem.FileSystem,
  operationPath: string,
  sourcePath: string
): Effect.Effect<string, DomainError> =>
  fs.readFileString(operationPath).pipe(Effect.mapError(DomainError.newCause(`Failed to read "${sourcePath}"`)));

const ensureWritableOperationMatches = Effect.fn("Architecture.ensureWritableOperationMatches")(function* (
  fs: FileSystem.FileSystem,
  operationPath: string,
  writableOperation: WriteFileOperation | WritePackageJsonOperation,
  expected: string
) {
  const current = yield* readOperationFile(fs, operationPath, writableOperation.path);

  if (!Str.equivalence(current, expected)) {
    return yield* DomainError.newMessage(
      `Architecture operation would overwrite a differing file: ${writableOperation.path}`
    );
  }
});

const writeMissingWritableOperation = Effect.fn("Architecture.writeMissingWritableOperation")(function* (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  operationPath: string,
  writableOperation: WriteFileOperation | WritePackageJsonOperation,
  expected: string
) {
  yield* fs
    .makeDirectory(path.dirname(operationPath), { recursive: true })
    .pipe(Effect.mapError(DomainError.newCause(`Failed to create parent directory for "${writableOperation.path}"`)));
  yield* fs
    .writeFileString(operationPath, expected)
    .pipe(Effect.mapError(DomainError.newCause(`Failed to write "${writableOperation.path}"`)));
});

const applyWritableOperation = Effect.fn("Architecture.applyWritableOperation")(function* (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  operationPath: string,
  exists: boolean,
  writtenPaths: Array<string>,
  skippedPaths: Array<string>,
  writableOperation: WriteFileOperation | WritePackageJsonOperation
) {
  const expected = yield* renderWritableOperation(writableOperation);

  if (exists) {
    yield* ensureWritableOperationMatches(fs, operationPath, writableOperation, expected);
    A.appendInPlace(skippedPaths, writableOperation.path);
    return;
  }

  yield* writeMissingWritableOperation(fs, path, operationPath, writableOperation, expected);
  A.appendInPlace(writtenPaths, writableOperation.path);
});

const applyEnsureFileOperation = Effect.fn("Architecture.applyEnsureFileOperation")(function* (
  exists: boolean,
  skippedPaths: Array<string>,
  ensureFileOperation: EnsureFileOperation
) {
  if (exists) {
    A.appendInPlace(skippedPaths, ensureFileOperation.path);
    return;
  }

  return yield* DomainError.newMessage(`Required architecture file is missing: ${ensureFileOperation.path}`);
});

const applyEnsureAbsentPathOperation = Effect.fn("Architecture.applyEnsureAbsentPathOperation")(function* (
  fs: FileSystem.FileSystem,
  operationPath: string,
  exists: boolean,
  removedPaths: Array<string>,
  skippedPaths: Array<string>,
  ensureAbsentPathOperation: EnsureAbsentPathOperation
) {
  if (!exists) {
    A.appendInPlace(skippedPaths, ensureAbsentPathOperation.path);
    return;
  }

  yield* fs
    .remove(operationPath, { force: true, recursive: true })
    .pipe(Effect.mapError(DomainError.newCause(`Failed to remove "${ensureAbsentPathOperation.path}"`)));
  A.appendInPlace(removedPaths, ensureAbsentPathOperation.path);
});

/**
 * Validate a decoded operation plan against a repository root.
 *
 * @effects Reads repository-relative files named by the plan and reports missing, differing, or unexpected paths.
 * @example
 * ```ts
 * import {
 *   checkCanonicalSliceOperationPlan,
 *   makeCanonicalSliceOperationPlan,
 * } from "@beep/repo-cli/commands/Architecture/index"
 * import { NodeServices } from "@effect/platform-node"
 * import { Effect } from "effect"
 *
 * const program = checkCanonicalSliceOperationPlan("/workspace/beep-effect", makeCanonicalSliceOperationPlan())
 * Effect.runPromise(program.pipe(Effect.provide(NodeServices.layer))).then((result) => console.log(result.idempotent))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const checkCanonicalSliceOperationPlan: {
  (
    plan: CanonicalSliceOperationPlan
  ): (rootDir: string) => Effect.Effect<OperationPlanCheckResult, DomainError, FileSystem.FileSystem | Path.Path>;
  (
    rootDir: string,
    plan: CanonicalSliceOperationPlan
  ): Effect.Effect<OperationPlanCheckResult, DomainError, FileSystem.FileSystem | Path.Path>;
} = dual(
  2,
  Effect.fn(function* (rootDir: string, plan: CanonicalSliceOperationPlan) {
    const fs = yield* FileSystem.FileSystem;
    const missingPaths: Array<string> = [];
    const differingPaths: Array<string> = [];
    const unexpectedPaths: Array<string> = [];
    const operationStatuses: Array<ArchitectureOperationCheck> = [];

    for (const operation of plan.operations) {
      const operationPath = yield* resolveOperationPath(rootDir, operation.path);
      const exists = yield* pathExists(operationPath);
      const checkWritableOperation = Effect.fn("checkWritableOperation")(function* (
        writableOperation: WriteFileOperation | WritePackageJsonOperation
      ) {
        const expected = yield* renderWritableOperation(writableOperation);
        if (!exists) {
          A.appendInPlace(missingPaths, writableOperation.path);
          A.appendInPlace(operationStatuses, checkStatusFor(writableOperation, "missing"));
          return;
        }

        const current = yield* readOperationFile(fs, operationPath, writableOperation.path);
        if (!Str.equivalence(current, expected)) {
          A.appendInPlace(differingPaths, writableOperation.path);
          A.appendInPlace(operationStatuses, checkStatusFor(writableOperation, "differing"));
        } else {
          A.appendInPlace(operationStatuses, checkStatusFor(writableOperation, "matching"));
        }
      });

      yield* Match.value(operation).pipe(
        Match.withReturnType<Effect.Effect<void, DomainError>>(),
        Match.discriminatorsExhaustive("kind")({
          "ensure-file": (ensureFileOperation) =>
            Effect.sync(() => {
              if (!exists) {
                A.appendInPlace(missingPaths, ensureFileOperation.path);
                A.appendInPlace(operationStatuses, checkStatusFor(ensureFileOperation, "missing"));
              } else {
                A.appendInPlace(operationStatuses, checkStatusFor(ensureFileOperation, "matching"));
              }
            }),
          "ensure-absent-path": (ensureAbsentPathOperation) =>
            Effect.sync(() => {
              if (exists) {
                A.appendInPlace(unexpectedPaths, ensureAbsentPathOperation.path);
                A.appendInPlace(operationStatuses, checkStatusFor(ensureAbsentPathOperation, "unexpected"));
              } else {
                A.appendInPlace(operationStatuses, checkStatusFor(ensureAbsentPathOperation, "absent"));
              }
            }),
          "write-file": checkWritableOperation,
          "write-package-json": checkWritableOperation,
        })
      );
    }

    return OperationPlanCheckResult.make({
      idempotent: missingPaths.length === 0 && differingPaths.length === 0 && unexpectedPaths.length === 0,
      operationStatuses,
      missingPaths,
      differingPaths,
      unexpectedPaths,
    });
  })
);

/**
 * Apply a decoded operation plan with failsafe conflict behavior.
 *
 * @effects Creates parent directories, writes missing files, removes legacy paths, and reads existing files to reject conflicting content.
 * @example
 * ```ts
 * import {
 *   applyCanonicalSliceOperationPlan,
 *   makeCanonicalSliceOperationPlan,
 * } from "@beep/repo-cli/commands/Architecture/index"
 * import { NodeServices } from "@effect/platform-node"
 * import { Effect } from "effect"
 *
 * const program = applyCanonicalSliceOperationPlan("/workspace/beep-effect", makeCanonicalSliceOperationPlan())
 * Effect.runPromise(program.pipe(Effect.provide(NodeServices.layer))).then((result) => console.log(result.writtenPaths.length))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const applyCanonicalSliceOperationPlan: {
  (
    plan: CanonicalSliceOperationPlan
  ): (rootDir: string) => Effect.Effect<OperationPlanApplyResult, DomainError, FileSystem.FileSystem | Path.Path>;
  (
    rootDir: string,
    plan: CanonicalSliceOperationPlan
  ): Effect.Effect<OperationPlanApplyResult, DomainError, FileSystem.FileSystem | Path.Path>;
} = dual(
  2,
  Effect.fn(function* (rootDir: string, plan: CanonicalSliceOperationPlan) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const writtenPaths: Array<string> = [];
    const skippedPaths: Array<string> = [];
    const removedPaths: Array<string> = [];

    for (const operation of plan.operations) {
      const operationPath = yield* resolveOperationPath(rootDir, operation.path);
      const exists = yield* pathExists(operationPath);
      yield* Match.value(operation).pipe(
        Match.withReturnType<Effect.Effect<void, DomainError>>(),
        Match.discriminatorsExhaustive("kind")({
          "ensure-file": (ensureFileOperation) => applyEnsureFileOperation(exists, skippedPaths, ensureFileOperation),
          "ensure-absent-path": (ensureAbsentPathOperation) =>
            applyEnsureAbsentPathOperation(
              fs,
              operationPath,
              exists,
              removedPaths,
              skippedPaths,
              ensureAbsentPathOperation
            ),
          "write-file": (writableOperation) =>
            applyWritableOperation(fs, path, operationPath, exists, writtenPaths, skippedPaths, writableOperation),
          "write-package-json": (writableOperation) =>
            applyWritableOperation(fs, path, operationPath, exists, writtenPaths, skippedPaths, writableOperation),
        })
      );
    }

    return OperationPlanApplyResult.make({ writtenPaths, skippedPaths, removedPaths });
  })
);
