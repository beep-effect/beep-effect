/**
 * Architecture operation-plan factories.
 *
 * @packageDocumentation
 * @category constructors
 * @since 0.0.0
 */

import { DomainError } from "@beep/repo-utils";
import { A, Str, thunkFalse } from "@beep/utils";
import { Effect, FileSystem, Path, pipe } from "effect";
import * as O from "effect/Option";
import {
  ArchitecturePlanTarget,
  CanonicalSliceOperationPlan,
  defaultArchitecturePlanTarget,
  EnsureAbsentPathOperation,
  EnsureFileOperation,
  WriteFileOperation,
  WritePackageJsonOperation,
} from "./Architecture.schemas.ts";
import { acceptedProofFiles, legacyFixturePaths } from "./internal/AcceptedProofManifest.ts";
import {
  packageShellFileOperationsFor,
  packageShellRolePlanFor,
  packageShellTargetFor,
  shellPackageJsonOperationFor,
} from "./internal/PackageShell.ts";
import { isStageIncluded, roleAllowedForTarget, rolePlanFor } from "./internal/RoleTopology.ts";
import {
  isPackageLevelFile,
  proofFileMatchesDomainKind,
  renderAcceptedTemplateForPlan,
  targetPathFor,
} from "./internal/TemplateRetarget.ts";
import type {
  ArchitectureOperation,
  ArchitectureOperationConflictPolicy,
  ArchitectureOperationKind,
  ArchitectureOperationSource,
  ArchitectureOperationWriteMode,
  ArchitecturePackageRole,
  ArchitectureSliceRole,
  ArchitectureSliceRolePlan,
} from "./Architecture.schemas.ts";
import type { AcceptedProofFile } from "./internal/AcceptedProofManifest.ts";

const defaultPlanTarget = defaultArchitecturePlanTarget;

const operationIdFor = (kind: ArchitectureOperationKind, operationPath: string): string => `${kind}:${operationPath}`;

// Keep these derived defaults aligned with the operation kind literal domain,
// per-operation schema defaults, and withOperationMetadata dispatch below.
const writeModeForKind = (kind: ArchitectureOperationKind): ArchitectureOperationWriteMode => {
  if (kind === "ensure-file") return "ensure-present";
  if (kind === "ensure-absent-path") return "remove-if-present";
  return "write-if-missing";
};

const conflictPolicyForKind = (kind: ArchitectureOperationKind): ArchitectureOperationConflictPolicy => {
  if (kind === "ensure-file") return "require-present";
  if (kind === "ensure-absent-path") return "remove-existing";
  return "skip-identical-fail-different";
};

const withOperationMetadata = (
  operation: ArchitectureOperation,
  operationSource: ArchitectureOperationSource
): ArchitectureOperation => {
  const operationId = operationIdFor(operation.kind, operation.path);
  const writeMode = writeModeForKind(operation.kind);
  const conflictPolicy = conflictPolicyForKind(operation.kind);
  if (operation.kind === "write-file") {
    return WriteFileOperation.make({
      ...operation,
      operationId,
      writeMode,
      conflictPolicy,
      operationSource,
    });
  }
  if (operation.kind === "write-package-json") {
    return WritePackageJsonOperation.make({
      ...operation,
      operationId,
      writeMode,
      conflictPolicy,
      operationSource,
    });
  }
  if (operation.kind === "ensure-file") {
    return EnsureFileOperation.make({
      ...operation,
      operationId,
      writeMode,
      conflictPolicy,
      operationSource,
    });
  }
  return EnsureAbsentPathOperation.make({
    ...operation,
    operationId,
    writeMode,
    conflictPolicy,
    operationSource,
  });
};

const normalizeInput = (input: Partial<ArchitecturePlanTarget> = {}): ArchitecturePlanTarget => {
  const boundedContext = input.boundedContext ?? defaultPlanTarget.boundedContext;
  const concept = input.concept ?? defaultPlanTarget.concept;
  const domainKind = input.domainKind ?? defaultPlanTarget.domainKind;
  return ArchitecturePlanTarget.make({
    boundedContext,
    concept,
    domainKind,
    conceptPath: `${domainKind}/${Str.pascalCase(concept)}`,
    stage: input.stage ?? defaultPlanTarget.stage,
  });
};

const selectFiles = (
  target: ArchitecturePlanTarget,
  roles: O.Option<ReadonlyArray<ArchitectureSliceRole>> = O.none()
): ReadonlyArray<AcceptedProofFile> =>
  pipe(
    acceptedProofFiles,
    A.filter((file) => roleAllowedForTarget(target, file.role)),
    A.filter((file) => isStageIncluded(target.stage, file.stage)),
    A.filter((file) => proofFileMatchesDomainKind(target, file)),
    A.filter((file) =>
      pipe(
        roles,
        O.map(A.contains(file.role)),
        O.getOrElse(() => true)
      )
    )
  );

const rolePlansForFiles = (
  target: ArchitecturePlanTarget,
  files: ReadonlyArray<AcceptedProofFile>
): ReadonlyArray<ArchitectureSliceRolePlan> =>
  pipe(
    files,
    A.map((file) => file.role),
    A.dedupe,
    A.map((role) => rolePlanFor(target, role))
  );

const validateRequestedRoles = Effect.fn(function* (
  target: ArchitecturePlanTarget,
  roles: O.Option<ReadonlyArray<ArchitectureSliceRole>>
) {
  if (O.isNone(roles)) return;
  const disallowedRoles = pipe(
    roles.value,
    A.filter((role) => !roleAllowedForTarget(target, role))
  );
  if (disallowedRoles.length > 0) {
    return yield* DomainError.newMessage(
      `Architecture ${target.domainKind} concepts do not support role(s): ${A.join(disallowedRoles, ", ")}`
    );
  }
});

/**
 * Build the canonical architecture lab WorkItem operation plan.
 *
 * @returns Schema-versioned operations for the canonical WorkItem proof slice.
 * @example
 * ```ts
 * import { makeCanonicalSliceOperationPlan } from "@beep/repo-cli/commands/Architecture"
 *
 * const plan = makeCanonicalSliceOperationPlan()
 * console.log(plan.target.concept) // "WorkItem"
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const makeCanonicalSliceOperationPlan = (): CanonicalSliceOperationPlan =>
  CanonicalSliceOperationPlan.make({
    schemaVersion: "architecture-operation-plan/v1",
    target: defaultPlanTarget,
    roles: pipe(
      ["domain", "use-cases", "config", "server", "tables", "client", "ui", "proof-app", "db-admin"] as const,
      A.map((role) => rolePlanFor(defaultPlanTarget, role))
    ),
    operations: [
      ...pipe(
        acceptedProofFiles,
        A.map((file) =>
          withOperationMetadata(
            EnsureFileOperation.make({
              kind: "ensure-file",
              role: file.role,
              path: file.path,
              description: `Ensure ${file.role} ${defaultPlanTarget.concept} topology file exists.`,
            }),
            "accepted-proof"
          )
        )
      ),
      ...pipe(
        legacyFixturePaths,
        A.map((path) =>
          withOperationMetadata(
            EnsureAbsentPathOperation.make({
              kind: "ensure-absent-path",
              path,
              description: "Remove the legacy fixture-lab Specimen proof surface.",
            }),
            "legacy-cleanup"
          )
        )
      ),
    ],
  });

/**
 * Build a write-capable operation plan from the accepted WorkItem proof files.
 *
 * @effects Reads accepted architecture proof files and existing package-level files under the provided repository root.
 * @example
 * ```ts
 * import { makeArchitectureOperationPlan } from "@beep/repo-cli/commands/Architecture"
 * import { NodeServices } from "@effect/platform-node"
 * import { Effect } from "effect"
 *
 * const program = makeArchitectureOperationPlan("/workspace/beep-effect", {
 *   boundedContext: "research-lab",
 *   concept: "Experiment",
 *   domainKind: "aggregates",
 *   stage: "core"
 * }).pipe(Effect.map((plan) => plan.target.concept))
 *
 * Effect.runPromise(program.pipe(Effect.provide(NodeServices.layer))).then(console.log)
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const makeArchitectureOperationPlan = Effect.fn(function* (
  repoRoot: string,
  input: Partial<ArchitecturePlanTarget> = {},
  roles: O.Option<ReadonlyArray<ArchitectureSliceRole>> = O.none()
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = normalizeInput(input);
  yield* validateRequestedRoles(target, roles);
  const selectedFiles = selectFiles(target, roles);

  const writeOperations = yield* Effect.forEach(
    selectedFiles,
    Effect.fnUntraced(function* (file) {
      const operationPath = targetPathFor(file.path, target);
      const targetFileExists = isPackageLevelFile(file.path)
        ? yield* fs.exists(path.join(repoRoot, operationPath)).pipe(Effect.orElseSucceed(thunkFalse))
        : false;
      const contentPath = targetFileExists ? operationPath : file.path;
      const content = yield* fs
        .readFileString(path.join(repoRoot, contentPath))
        .pipe(Effect.mapError(DomainError.newCause(`Failed to read architecture file "${contentPath}"`)));

      return withOperationMetadata(
        WriteFileOperation.make({
          kind: "write-file",
          role: file.role,
          path: operationPath,
          writer: file.writer,
          content: targetFileExists
            ? content
            : renderAcceptedTemplateForPlan({ content, target, sourcePath: file.path }),
          description: targetFileExists
            ? `Preserve existing ${file.role} package-level file while planning ${target.concept}.`
            : `Write ${file.role} ${target.concept} file from the accepted architecture proof.`,
        }),
        "accepted-proof"
      );
    })
  );

  return CanonicalSliceOperationPlan.make({
    schemaVersion: "architecture-operation-plan/v1",
    target,
    roles: rolePlansForFiles(target, selectedFiles),
    operations: [
      ...writeOperations,
      ...pipe(
        legacyFixturePaths,
        A.map((path) =>
          withOperationMetadata(
            EnsureAbsentPathOperation.make({
              kind: "ensure-absent-path",
              path,
              description: "Remove the legacy fixture-lab Specimen proof surface.",
            }),
            "legacy-cleanup"
          )
        )
      ),
    ],
  });
});

/**
 * Build a shell-only slice role package operation plan.
 *
 * @effects Builds the shell package plan in memory; filesystem writes happen only when the plan is later applied.
 * @example
 * ```ts
 * import { makeArchitecturePackageOperationPlan } from "@beep/repo-cli/commands/Architecture/index"
 * import { Effect } from "effect"
 *
 * const program = Effect.map(
 *   makeArchitecturePackageOperationPlan({ boundedContext: "research-lab", role: "domain" }),
 *   (plan) => plan.roles[0]?.packageName,
 * )
 *
 * Effect.runPromise(program).then(console.log)
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const makeArchitecturePackageOperationPlan = Effect.fn(function* (input: {
  readonly boundedContext: string;
  readonly role: ArchitecturePackageRole;
}) {
  const target = packageShellTargetFor(input.boundedContext);
  const rolePlan = packageShellRolePlanFor(target, input.role);

  return CanonicalSliceOperationPlan.make({
    schemaVersion: "architecture-operation-plan/v1",
    target,
    roles: [rolePlan],
    operations: [
      withOperationMetadata(shellPackageJsonOperationFor(target, input.role), "package-shell"),
      ...pipe(
        packageShellFileOperationsFor(target, input.role),
        A.map((operation) => withOperationMetadata(operation, "package-shell"))
      ),
    ],
  });
});
