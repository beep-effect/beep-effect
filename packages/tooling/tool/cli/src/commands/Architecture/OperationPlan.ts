/**
 * Architecture operation-plan command implementation.
 *
 * @packageDocumentation
 * @category cli-commands
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { DomainError } from "@beep/repo-utils";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A, Str, thunk0, thunkFalse } from "@beep/utils";
import { Effect, FileSystem, identity, Path, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type * as R from "effect/Record";

const $I = $RepoCliId.create("commands/Architecture/OperationPlan");

/**
 * Canonical architecture domain-kind folders.
 *
 * @example
 * ```ts
 * import { ArchitectureDomainKind } from "@beep/repo-cli/commands/Architecture"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ArchitectureDomainKind)("aggregates")) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const ArchitectureDomainKind = LiteralKit(["aggregates", "entities", "values"]).pipe(
  $I.annoteSchema("ArchitectureDomainKind", {
    description: "Domain-kind folder used by canonical architecture operation plans.",
  })
);

/**
 * Canonical architecture domain-kind folder.
 *
 * @category models
 * @since 0.0.0
 */
export type ArchitectureDomainKind = typeof ArchitectureDomainKind.Type;

/**
 * Staged architecture proof targets.
 *
 * @example
 * ```ts
 * import { ArchitecturePlanStage } from "@beep/repo-cli/commands/Architecture"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ArchitecturePlanStage)("persistence")) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const ArchitecturePlanStage = LiteralKit(["core", "persistence", "protocol", "client", "full"]).pipe(
  $I.annoteSchema("ArchitecturePlanStage", {
    description: "Stage selector for canonical slice operation-plan generation.",
  })
);

/**
 * Staged architecture proof target.
 *
 * @category models
 * @since 0.0.0
 */
export type ArchitecturePlanStage = typeof ArchitecturePlanStage.Type;

/**
 * Canonical architecture slice roles.
 *
 * @example
 * ```ts
 * import { ArchitectureSliceRole } from "@beep/repo-cli/commands/Architecture"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ArchitectureSliceRole)("use-cases")) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const ArchitectureSliceRole = LiteralKit([
  "domain",
  "use-cases",
  "config",
  "server",
  "tables",
  "client",
  "ui",
  "proof-app",
  "db-admin",
]).pipe(
  $I.annoteSchema("ArchitectureSliceRole", {
    description: "Role package, proof app, or internal admin target represented in an architecture operation plan.",
  })
);

/**
 * Canonical architecture slice role.
 *
 * @category models
 * @since 0.0.0
 */
export type ArchitectureSliceRole = typeof ArchitectureSliceRole.Type;

/**
 * Slice role packages supported by `beep architecture create package`.
 *
 * @example
 * ```ts
 * import { ArchitecturePackageRole } from "@beep/repo-cli/commands/Architecture/index"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ArchitecturePackageRole)("domain"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const ArchitecturePackageRole = LiteralKit([
  "domain",
  "use-cases",
  "config",
  "server",
  "tables",
  "client",
  "ui",
]).pipe(
  $I.annoteSchema("ArchitecturePackageRole", {
    description: "Normal slice role package that can be created as a shell-only architecture package.",
  })
);

/**
 * Slice role package supported by `beep architecture create package`.
 *
 * @example
 * ```ts
 * import type { ArchitecturePackageRole } from "@beep/repo-cli/commands/Architecture/index"
 *
 * const role: ArchitecturePackageRole = "domain"
 * console.log(role)
 * ```
 * @category models
 * @since 0.0.0
 */
export type ArchitecturePackageRole = typeof ArchitecturePackageRole.Type;

/**
 * Operation kinds supported by canonical architecture operation plans.
 *
 * @example
 * ```ts
 * import { ArchitectureOperationKind } from "@beep/repo-cli/commands/Architecture/index"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ArchitectureOperationKind)("write-file"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const ArchitectureOperationKind = LiteralKit([
  "write-file",
  "write-package-json",
  "ensure-file",
  "ensure-absent-path",
]).pipe(
  $I.annoteSchema("ArchitectureOperationKind", {
    description: "Operation discriminator emitted by schema-versioned architecture operation plans.",
  })
);

/**
 * Operation kind supported by canonical architecture operation plans.
 *
 * @example
 * ```ts
 * import type { ArchitectureOperationKind } from "@beep/repo-cli/commands/Architecture/index"
 *
 * const kind: ArchitectureOperationKind = "ensure-file"
 * console.log(kind)
 * ```
 * @category models
 * @since 0.0.0
 */
export type ArchitectureOperationKind = typeof ArchitectureOperationKind.Type;

/**
 * Writer families selected from normalized architecture operations.
 *
 * @example
 * ```ts
 * import { ArchitectureWriterKind } from "@beep/repo-cli/commands/Architecture"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ArchitectureWriterKind)("package-json")) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const ArchitectureWriterKind = LiteralKit(["template", "json", "jsonc", "package-json", "ts-morph"]).pipe(
  $I.annoteSchema("ArchitectureWriterKind", {
    description: "Writer family selected for an architecture operation-plan file operation.",
  })
);

/**
 * Writer family selected from normalized architecture operations.
 *
 * @category models
 * @since 0.0.0
 */
export type ArchitectureWriterKind = typeof ArchitectureWriterKind.Type;

/**
 * Write-mode metadata for architecture operations.
 *
 * @example
 * ```ts
 * import { ArchitectureOperationWriteMode } from "@beep/repo-cli/commands/Architecture/index"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ArchitectureOperationWriteMode)("write-if-missing"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const ArchitectureOperationWriteMode = LiteralKit([
  "write-if-missing",
  "ensure-present",
  "remove-if-present",
]).pipe(
  $I.annoteSchema("ArchitectureOperationWriteMode", {
    description: "Filesystem write mode used by architecture operation-plan dry-run and check output.",
  })
);

/**
 * Write-mode metadata for an architecture operation.
 *
 * @example
 * ```ts
 * import type { ArchitectureOperationWriteMode } from "@beep/repo-cli/commands/Architecture/index"
 *
 * const mode: ArchitectureOperationWriteMode = "ensure-present"
 * console.log(mode)
 * ```
 * @category models
 * @since 0.0.0
 */
export type ArchitectureOperationWriteMode = typeof ArchitectureOperationWriteMode.Type;

/**
 * Conflict policy metadata for architecture operations.
 *
 * @example
 * ```ts
 * import { ArchitectureOperationConflictPolicy } from "@beep/repo-cli/commands/Architecture/index"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ArchitectureOperationConflictPolicy)("skip-identical-fail-different"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const ArchitectureOperationConflictPolicy = LiteralKit([
  "skip-identical-fail-different",
  "require-present",
  "remove-existing",
]).pipe(
  $I.annoteSchema("ArchitectureOperationConflictPolicy", {
    description: "Conflict behavior declared by an architecture operation before it touches the filesystem.",
  })
);

/**
 * Conflict policy metadata for an architecture operation.
 *
 * @example
 * ```ts
 * import type { ArchitectureOperationConflictPolicy } from "@beep/repo-cli/commands/Architecture/index"
 *
 * const policy: ArchitectureOperationConflictPolicy = "require-present"
 * console.log(policy)
 * ```
 * @category models
 * @since 0.0.0
 */
export type ArchitectureOperationConflictPolicy = typeof ArchitectureOperationConflictPolicy.Type;

/**
 * Source metadata for architecture operations.
 *
 * @example
 * ```ts
 * import { ArchitectureOperationSource } from "@beep/repo-cli/commands/Architecture/index"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ArchitectureOperationSource)("accepted-proof"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const ArchitectureOperationSource = LiteralKit([
  "accepted-proof",
  "package-shell",
  "legacy-cleanup",
  "legacy-plan",
]).pipe(
  $I.annoteSchema("ArchitectureOperationSource", {
    description: "Origin of an architecture operation within the normalized plan factory.",
  })
);

/**
 * Source metadata for an architecture operation.
 *
 * @example
 * ```ts
 * import type { ArchitectureOperationSource } from "@beep/repo-cli/commands/Architecture/index"
 *
 * const source: ArchitectureOperationSource = "package-shell"
 * console.log(source)
 * ```
 * @category models
 * @since 0.0.0
 */
export type ArchitectureOperationSource = typeof ArchitectureOperationSource.Type;

/**
 * Per-operation idempotency status.
 *
 * @example
 * ```ts
 * import { ArchitectureOperationCheckStatus } from "@beep/repo-cli/commands/Architecture/index"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ArchitectureOperationCheckStatus)("matching"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const ArchitectureOperationCheckStatus = LiteralKit([
  "matching",
  "missing",
  "differing",
  "unexpected",
  "absent",
]).pipe(
  $I.annoteSchema("ArchitectureOperationCheckStatus", {
    description: "Result assigned to one architecture operation during idempotency validation.",
  })
);

/**
 * Per-operation idempotency status.
 *
 * @example
 * ```ts
 * import type { ArchitectureOperationCheckStatus } from "@beep/repo-cli/commands/Architecture/index"
 *
 * const status: ArchitectureOperationCheckStatus = "absent"
 * console.log(status)
 * ```
 * @category models
 * @since 0.0.0
 */
export type ArchitectureOperationCheckStatus = typeof ArchitectureOperationCheckStatus.Type;

const OperationId = S.String.pipe(
  S.withConstructorDefault(Effect.succeed("legacy-operation")),
  S.withDecodingDefault(Effect.succeed("legacy-operation"))
);
const WriteIfMissing = ArchitectureOperationWriteMode.pipe(
  S.withConstructorDefault(Effect.succeed("write-if-missing" as const)),
  S.withDecodingDefault(Effect.succeed("write-if-missing" as const))
);
const EnsurePresent = ArchitectureOperationWriteMode.pipe(
  S.withConstructorDefault(Effect.succeed("ensure-present" as const)),
  S.withDecodingDefault(Effect.succeed("ensure-present" as const))
);
const RemoveIfPresent = ArchitectureOperationWriteMode.pipe(
  S.withConstructorDefault(Effect.succeed("remove-if-present" as const)),
  S.withDecodingDefault(Effect.succeed("remove-if-present" as const))
);
const SkipIdenticalFailDifferent = ArchitectureOperationConflictPolicy.pipe(
  S.withConstructorDefault(Effect.succeed("skip-identical-fail-different" as const)),
  S.withDecodingDefault(Effect.succeed("skip-identical-fail-different" as const))
);
const RequirePresent = ArchitectureOperationConflictPolicy.pipe(
  S.withConstructorDefault(Effect.succeed("require-present" as const)),
  S.withDecodingDefault(Effect.succeed("require-present" as const))
);
const RemoveExisting = ArchitectureOperationConflictPolicy.pipe(
  S.withConstructorDefault(Effect.succeed("remove-existing" as const)),
  S.withDecodingDefault(Effect.succeed("remove-existing" as const))
);
const OperationSource = ArchitectureOperationSource.pipe(
  S.withConstructorDefault(Effect.succeed("legacy-plan" as const)),
  S.withDecodingDefault(Effect.succeed("legacy-plan" as const))
);

/**
 * Role package entry in a canonical architecture slice operation plan.
 *
 * @example
 * ```ts
 * import { ArchitectureSliceRolePlan } from "@beep/repo-cli/commands/Architecture"
 *
 * const role = ArchitectureSliceRolePlan.make({
 *   exports: ["."],
 *   packageName: "@beep/research-lab-domain",
 *   path: "packages/research-lab/domain",
 *   role: "domain"
 * })
 * console.log(role.packageName) // "@beep/research-lab-domain"
 * ```
 * @category models
 * @since 0.0.0
 */
export class ArchitectureSliceRolePlan extends S.Class<ArchitectureSliceRolePlan>($I`ArchitectureSliceRolePlan`)(
  {
    role: ArchitectureSliceRole,
    packageName: S.String,
    path: S.String,
    exports: S.Array(S.String),
  },
  $I.annote("ArchitectureSliceRolePlan", {
    description: "Package-level role metadata emitted by the architecture operation-plan factory.",
  })
) {}

/**
 * Normalized architecture creation target.
 *
 * @example
 * ```ts
 * import { ArchitecturePlanTarget } from "@beep/repo-cli/commands/Architecture"
 *
 * const target = ArchitecturePlanTarget.make({
 *   boundedContext: "research-lab",
 *   concept: "Experiment",
 *   conceptPath: "aggregates/Experiment",
 *   domainKind: "aggregates",
 *   stage: "core"
 * })
 * console.log(target.conceptPath) // "aggregates/Experiment"
 * ```
 * @category models
 * @since 0.0.0
 */
export class ArchitecturePlanTarget extends S.Class<ArchitecturePlanTarget>($I`ArchitecturePlanTarget`)(
  {
    boundedContext: S.String,
    concept: S.String,
    domainKind: ArchitectureDomainKind,
    conceptPath: S.String,
    stage: ArchitecturePlanStage,
  },
  $I.annote("ArchitecturePlanTarget", {
    description: "Normalized slice, concept, domain-kind, and stage selected by architecture commands.",
  })
) {}

/**
 * Operation that writes a repo-relative file when absent.
 *
 * @example
 * ```ts
 * import { WriteFileOperation } from "@beep/repo-cli/commands/Architecture"
 *
 * const operation = WriteFileOperation.make({
 *   content: "export const VERSION = \"0.0.0\"",
 *   description: "Write the package index.",
 *   kind: "write-file",
 *   path: "packages/research-lab/domain/src/index.ts",
 *   role: "domain",
 *   writer: "template"
 * })
 * console.log(operation.writeMode) // "write-if-missing"
 * ```
 * @category models
 * @since 0.0.0
 */
export class WriteFileOperation extends S.Class<WriteFileOperation>($I`WriteFileOperation`)(
  {
    kind: S.Literal("write-file"),
    operationId: OperationId,
    role: ArchitectureSliceRole,
    path: S.String,
    writeMode: WriteIfMissing,
    conflictPolicy: SkipIdenticalFailDifferent,
    operationSource: OperationSource,
    writer: ArchitectureWriterKind,
    content: S.String,
    description: S.String,
  },
  $I.annote("WriteFileOperation", {
    description: "Operation that materializes a canonical architecture file with failsafe conflict behavior.",
  })
) {}

/**
 * Operation that writes a structured package manifest.
 *
 * @example
 * ```ts
 * import { WritePackageJsonOperation } from "@beep/repo-cli/commands/Architecture/index"
 *
 * const operation = WritePackageJsonOperation.make({
 *   kind: "write-package-json",
 *   role: "domain",
 *   path: "packages/research-lab/domain/package.json",
 *   packageName: "@beep/research-lab-domain",
 *   packageDescription: "Research lab domain package.",
 *   repositoryDirectory: "packages/research-lab/domain",
 *   exports: ["."],
 *   dependencies: {},
 *   devDependencies: {},
 *   description: "Write the research-lab domain package manifest.",
 * })
 * console.log(operation.packageName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class WritePackageJsonOperation extends S.Class<WritePackageJsonOperation>($I`WritePackageJsonOperation`)(
  {
    kind: S.Literal("write-package-json"),
    operationId: OperationId,
    role: ArchitecturePackageRole,
    path: S.String,
    writeMode: WriteIfMissing,
    conflictPolicy: SkipIdenticalFailDifferent,
    operationSource: OperationSource,
    packageName: S.String,
    packageDescription: S.String,
    repositoryDirectory: S.String,
    exports: S.Array(S.String),
    dependencies: S.Record(S.String, S.String),
    devDependencies: S.Record(S.String, S.String),
    description: S.String,
  },
  $I.annote("WritePackageJsonOperation", {
    description: "Structured package.json operation selected by the architecture operation-plan factory.",
  })
) {}

/**
 * Operation that proves a repo-relative file must exist.
 *
 * @example
 * ```ts
 * import { EnsureFileOperation } from "@beep/repo-cli/commands/Architecture"
 *
 * const operation = EnsureFileOperation.make({
 *   description: "Confirm the domain index exists.",
 *   kind: "ensure-file",
 *   path: "packages/research-lab/domain/src/index.ts",
 *   role: "domain"
 * })
 * console.log(operation.conflictPolicy) // "require-present"
 * ```
 * @category models
 * @since 0.0.0
 */
export class EnsureFileOperation extends S.Class<EnsureFileOperation>($I`EnsureFileOperation`)(
  {
    kind: S.Literal("ensure-file"),
    operationId: OperationId,
    role: ArchitectureSliceRole,
    path: S.String,
    writeMode: EnsurePresent,
    conflictPolicy: RequirePresent,
    operationSource: OperationSource,
    description: S.String,
  },
  $I.annote("EnsureFileOperation", {
    description: "Operation asserting that a canonical slice file is materialized.",
  })
) {}

/**
 * Operation that proves a legacy repo-relative path must not exist.
 *
 * @example
 * ```ts
 * import { EnsureAbsentPathOperation } from "@beep/repo-cli/commands/Architecture"
 *
 * const operation = EnsureAbsentPathOperation.make({
 *   description: "Remove the retired proof fixture.",
 *   kind: "ensure-absent-path",
 *   path: "packages/fixture-lab"
 * })
 * console.log(operation.writeMode) // "remove-if-present"
 * ```
 * @category models
 * @since 0.0.0
 */
export class EnsureAbsentPathOperation extends S.Class<EnsureAbsentPathOperation>($I`EnsureAbsentPathOperation`)(
  {
    kind: S.Literal("ensure-absent-path"),
    operationId: OperationId,
    path: S.String,
    writeMode: RemoveIfPresent,
    conflictPolicy: RemoveExisting,
    operationSource: OperationSource,
    description: S.String,
  },
  $I.annote("EnsureAbsentPathOperation", {
    description: "Operation asserting that a legacy architecture fixture path is absent.",
  })
) {}

/**
 * Canonical operation-plan operation.
 *
 * @example
 * ```ts
 * import { ArchitectureOperation, EnsureFileOperation } from "@beep/repo-cli/commands/Architecture"
 * import * as S from "effect/Schema"
 *
 * const operation = EnsureFileOperation.make({
 *   description: "Confirm the use-case barrel exists.",
 *   kind: "ensure-file",
 *   path: "packages/research-lab/use-cases/src/index.ts",
 *   role: "use-cases"
 * })
 * console.log(S.is(ArchitectureOperation)(operation)) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const ArchitectureOperation = S.Union([
  WriteFileOperation,
  WritePackageJsonOperation,
  EnsureFileOperation,
  EnsureAbsentPathOperation,
]);

/**
 * Canonical operation-plan operation.
 *
 * @category models
 * @since 0.0.0
 */
export type ArchitectureOperation = typeof ArchitectureOperation.Type;

/**
 * Idempotency status for one checked operation.
 *
 * @example
 * ```ts
 * import { ArchitectureOperationCheck } from "@beep/repo-cli/commands/Architecture/index"
 *
 * const status = ArchitectureOperationCheck.make({
 *   operationId: "ensure-file:packages/architecture-lab/domain/src/index.ts",
 *   kind: "ensure-file",
 *   path: "packages/architecture-lab/domain/src/index.ts",
 *   status: "matching",
 * })
 * console.log(status.status)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ArchitectureOperationCheck extends S.Class<ArchitectureOperationCheck>($I`ArchitectureOperationCheck`)(
  {
    operationId: S.String,
    kind: ArchitectureOperationKind,
    path: S.String,
    status: ArchitectureOperationCheckStatus,
  },
  $I.annote("ArchitectureOperationCheck", {
    description: "Per-operation idempotency result returned by architecture operation-plan checks.",
  })
) {}

/**
 * Schema-versioned canonical architecture slice operation plan.
 *
 * @example
 * ```ts
 * import {
 *   CanonicalSliceOperationPlan,
 *   defaultArchitecturePlanTarget,
 * } from "@beep/repo-cli/commands/Architecture"
 *
 * const plan = CanonicalSliceOperationPlan.make({
 *   operations: [],
 *   roles: [],
 *   schemaVersion: "architecture-operation-plan/v1",
 *   target: defaultArchitecturePlanTarget
 * })
 * console.log(plan.slice.aggregate) // "WorkItem"
 * ```
 * @category models
 * @since 0.0.0
 */
export class CanonicalSliceOperationPlan extends S.Class<CanonicalSliceOperationPlan>($I`CanonicalSliceOperationPlan`)(
  {
    schemaVersion: S.Literal("architecture-operation-plan/v1"),
    target: ArchitecturePlanTarget,
    roles: S.Array(ArchitectureSliceRolePlan),
    operations: S.Array(ArchitectureOperation),
  },
  $I.annote("CanonicalSliceOperationPlan", {
    description: "Decoded JSON plan used by beep architecture commands before any filesystem write.",
  })
) {
  /**
   * Backwards-compatible slice metadata for existing operation-plan callers.
   *
   * @returns Legacy aggregate-oriented slice metadata derived from the plan target.
   * @example
   * ```ts
   * import { makeCanonicalSliceOperationPlan } from "@beep/repo-cli/commands/Architecture"
   *
   * const plan = makeCanonicalSliceOperationPlan()
   * console.log(plan.slice.boundedContext) // "architecture-lab"
   * ```
   * @category models
   * @since 0.0.0
   */
  get slice(): {
    readonly aggregate: string;
    readonly aggregatePath: string;
    readonly boundedContext: string;
  } {
    return {
      boundedContext: this.target.boundedContext,
      aggregate: this.target.concept,
      aggregatePath: this.target.conceptPath,
    };
  }
}

/**
 * Result of validating a canonical operation plan against a checkout.
 *
 * @example
 * ```ts
 * import { OperationPlanCheckResult } from "@beep/repo-cli/commands/Architecture"
 *
 * const result = OperationPlanCheckResult.make({
 *   differingPaths: [],
 *   idempotent: false,
 *   missingPaths: ["packages/research-lab/domain/src/index.ts"],
 *   operationStatuses: [],
 *   unexpectedPaths: []
 * })
 * console.log(result.missingPaths.length) // 1
 * ```
 * @category models
 * @since 0.0.0
 */
export class OperationPlanCheckResult extends S.Class<OperationPlanCheckResult>($I`OperationPlanCheckResult`)(
  {
    idempotent: S.Boolean,
    operationStatuses: S.Array(ArchitectureOperationCheck).pipe(
      SchemaUtils.withEmptyArrayDefaults<ArchitectureOperationCheck>()
    ),
    missingPaths: S.Array(S.String),
    differingPaths: S.Array(S.String).pipe(SchemaUtils.withEmptyArrayDefaults<string>()),
    unexpectedPaths: S.Array(S.String),
  },
  $I.annote("OperationPlanCheckResult", {
    description: "Filesystem validation result for a decoded architecture operation plan.",
  })
) {}

/**
 * Result of applying a canonical operation plan.
 *
 * @example
 * ```ts
 * import { OperationPlanApplyResult } from "@beep/repo-cli/commands/Architecture"
 *
 * const result = OperationPlanApplyResult.make({
 *   removedPaths: [],
 *   skippedPaths: ["packages/research-lab/domain/package.json"],
 *   writtenPaths: ["packages/research-lab/domain/src/index.ts"]
 * })
 * console.log(result.writtenPaths.length) // 1
 * ```
 * @category models
 * @since 0.0.0
 */
export class OperationPlanApplyResult extends S.Class<OperationPlanApplyResult>($I`OperationPlanApplyResult`)(
  {
    writtenPaths: S.Array(S.String),
    skippedPaths: S.Array(S.String),
    removedPaths: S.Array(S.String),
  },
  $I.annote("OperationPlanApplyResult", {
    description: "Filesystem write summary for a decoded architecture operation plan.",
  })
) {}

class AcceptedProofFile extends S.Class<AcceptedProofFile>($I`AcceptedProofFile`)(
  {
    role: ArchitectureSliceRole,
    stage: ArchitecturePlanStage,
    path: S.String,
    writer: ArchitectureWriterKind,
  },
  $I.annote("AcceptedProofFile", {
    description: "Internal descriptor for a canonical proof file used to generate architecture operation plans.",
  })
) {}

/**
 * Default architecture target shared by command defaults and plan factories.
 *
 * @example
 * ```ts
 * import { defaultArchitecturePlanTarget } from "@beep/repo-cli/commands/Architecture/index"
 *
 * console.log(defaultArchitecturePlanTarget.boundedContext)
 * ```
 * @category models
 * @since 0.0.0
 */
export const defaultArchitecturePlanTarget = ArchitecturePlanTarget.make({
  boundedContext: "architecture-lab",
  concept: "WorkItem",
  conceptPath: "aggregates/WorkItem",
  domainKind: "aggregates",
  stage: "full",
});
const defaultPlanTarget = defaultArchitecturePlanTarget;

const stageOrder: ReadonlyArray<ArchitecturePlanStage> = ["core", "persistence", "protocol", "client", "full"];
const stageRank = (stage: ArchitecturePlanStage): number =>
  pipe(stageOrder, A.findFirstIndex(Str.equivalence(stage)), O.getOrElse(thunk0));

const isStageIncluded: {
  (requested: ArchitecturePlanStage, fileStage: ArchitecturePlanStage): boolean;
  (fileStage: ArchitecturePlanStage): (requested: ArchitecturePlanStage) => boolean;
} = dual(
  2,
  (requested: ArchitecturePlanStage, fileStage: ArchitecturePlanStage): boolean =>
    Str.equivalence(requested, "full") || stageRank(fileStage) <= stageRank(requested)
);

const aggregateRoles: ReadonlyArray<ArchitectureSliceRole> = [
  "domain",
  "use-cases",
  "config",
  "server",
  "tables",
  "client",
  "ui",
  "proof-app",
  "db-admin",
] as const;
const entityRoles: ReadonlyArray<ArchitectureSliceRole> = ["domain", "use-cases", "server", "tables", "db-admin"];
const valueRoles: ReadonlyArray<ArchitectureSliceRole> = ["domain"];

const rolesForDomainKind = (domainKind: ArchitectureDomainKind): ReadonlyArray<ArchitectureSliceRole> => {
  if (domainKind === "entities") return entityRoles;
  if (domainKind === "values") return valueRoles;
  return aggregateRoles;
};

const roleAllowedForDomainKind = (domainKind: ArchitectureDomainKind, role: ArchitectureSliceRole): boolean =>
  pipe(rolesForDomainKind(domainKind), A.contains(role));

const dbAdminProofTargetAllowed = (target: ArchitecturePlanTarget): boolean =>
  Str.equivalence(target.boundedContext, defaultPlanTarget.boundedContext) &&
  ((Str.equivalence(target.domainKind, "aggregates") && Str.equivalence(target.concept, "WorkItem")) ||
    (Str.equivalence(target.domainKind, "entities") && Str.equivalence(target.concept, "Worker")));

const roleAllowedForTarget = (target: ArchitecturePlanTarget, role: ArchitectureSliceRole): boolean =>
  roleAllowedForDomainKind(target.domainKind, role) && (role !== "db-admin" || dbAdminProofTargetAllowed(target));

const roleBasePath = (role: ArchitectureSliceRole): O.Option<string> => {
  if (role === "proof-app") return O.some("apps/architecture-lab-proof");
  if (role === "db-admin") return O.some("packages/_internal/db-admin");
  return O.some(`packages/architecture-lab/${role}`);
};

const rolePackageFiles = (
  role: ArchitectureSliceRole,
  stage: ArchitecturePlanStage
): ReadonlyArray<AcceptedProofFile> =>
  pipe(
    roleBasePath(role),
    O.map((basePath) => [
      AcceptedProofFile.make({
        role,
        stage,
        path: `${basePath}/AGENTS.md`,
        writer: "template",
      }),
      AcceptedProofFile.make({
        role,
        stage,
        path: `${basePath}/LICENSE`,
        writer: "template",
      }),
      AcceptedProofFile.make({
        role,
        stage,
        path: `${basePath}/README.md`,
        writer: "template",
      }),
      AcceptedProofFile.make({
        role,
        stage,
        path: `${basePath}/docgen.json`,
        writer: "json",
      }),
      AcceptedProofFile.make({
        role,
        stage,
        path: `${basePath}/package.json`,
        writer: "package-json",
      }),
      AcceptedProofFile.make({
        role,
        stage,
        path: `${basePath}/tsconfig.json`,
        writer: "jsonc",
      }),
      AcceptedProofFile.make({
        role,
        stage,
        path: `${basePath}/vitest.config.ts`,
        writer: "template",
      }),
      AcceptedProofFile.make({
        role,
        stage,
        path: `${basePath}/dtslint/.gitkeep`,
        writer: "template",
      }),
      AcceptedProofFile.make({
        role,
        stage,
        path: `${basePath}/test/.gitkeep`,
        writer: "template",
      }),
    ]),
    O.getOrElse(A.empty<AcceptedProofFile>)
  );

const acceptedProofFiles: ReadonlyArray<AcceptedProofFile> = [
  ...rolePackageFiles("domain", "core"),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/aggregates/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/aggregates/WorkItem/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/aggregates/WorkItem/WorkItem.errors.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/aggregates/WorkItem/WorkItem.model.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/aggregates/WorkItem/WorkItem.values.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/test/WorkItem.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/dtslint/WorkItem.tst.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/identity/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/identity/ArchitectureLab.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/entities/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/entities/Worker/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/entities/Worker/Worker.model.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/test/Worker.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/dtslint/Worker.tst.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/values/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/values/WorkPriority/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/values/WorkPriority/WorkPriority.model.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/values/WorkPriority/WorkPriority.behavior.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/test/WorkPriority.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/dtslint/WorkPriority.tst.ts",
    writer: "template",
  }),

  ...rolePackageFiles("use-cases", "core"),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/public.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/server.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/aggregates/WorkItem/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/aggregates/WorkItem/server.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/aggregates/WorkItem/WorkItem.commands.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/aggregates/WorkItem/WorkItem.errors.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/aggregates/WorkItem/WorkItem.repository.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/aggregates/WorkItem/WorkItem.use-cases.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/aggregates/WorkItem/WorkItem.service.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/test/WorkItem.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/test/SchemaParity.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/dtslint/WorkItem.tst.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/entities/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/entities/Worker/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/entities/Worker/server.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/entities/Worker/Worker.commands.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/entities/Worker/Worker.errors.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/entities/Worker/Worker.repository.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/entities/Worker/Worker.use-cases.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/entities/Worker/Worker.service.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/test/Worker.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/dtslint/Worker.tst.ts",
    writer: "template",
  }),

  ...rolePackageFiles("server", "core"),
  AcceptedProofFile.make({
    role: "server",
    stage: "core",
    path: "packages/architecture-lab/server/src/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "core",
    path: "packages/architecture-lab/server/src/Layer.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "core",
    path: "packages/architecture-lab/server/src/test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "core",
    path: "packages/architecture-lab/server/src/aggregates/WorkItem/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "core",
    path: "packages/architecture-lab/server/src/aggregates/WorkItem/WorkItem.layer.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "core",
    path: "packages/architecture-lab/server/src/aggregates/WorkItem/WorkItem.repo.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "core",
    path: "packages/architecture-lab/server/test/WorkItemServer.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "core",
    path: "packages/architecture-lab/server/dtslint/WorkItemServer.tst.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "persistence",
    path: "packages/architecture-lab/server/test/integration/WorkItemDrizzleRepository.pglite.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "protocol",
    path: "packages/architecture-lab/server/src/aggregates/WorkItem/WorkItem.http.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "protocol",
    path: "packages/architecture-lab/server/src/aggregates/WorkItem/WorkItem.rpc.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "protocol",
    path: "packages/architecture-lab/server/src/aggregates/WorkItem/WorkItem.tools.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "core",
    path: "packages/architecture-lab/server/src/entities/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "core",
    path: "packages/architecture-lab/server/src/entities/Worker/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "core",
    path: "packages/architecture-lab/server/src/entities/Worker/Worker.layer.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "core",
    path: "packages/architecture-lab/server/src/entities/Worker/Worker.repo.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "core",
    path: "packages/architecture-lab/server/test/WorkerServer.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "core",
    path: "packages/architecture-lab/server/dtslint/WorkerServer.tst.ts",
    writer: "template",
  }),

  ...rolePackageFiles("config", "persistence"),
  AcceptedProofFile.make({
    role: "config",
    stage: "persistence",
    path: "packages/architecture-lab/config/src/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "config",
    stage: "persistence",
    path: "packages/architecture-lab/config/src/public.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "config",
    stage: "persistence",
    path: "packages/architecture-lab/config/src/server.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "config",
    stage: "persistence",
    path: "packages/architecture-lab/config/src/secrets.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "config",
    stage: "persistence",
    path: "packages/architecture-lab/config/src/layer.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "config",
    stage: "persistence",
    path: "packages/architecture-lab/config/src/test.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "config",
    stage: "persistence",
    path: "packages/architecture-lab/config/src/aggregates/WorkItem/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "config",
    stage: "persistence",
    path: "packages/architecture-lab/config/src/aggregates/WorkItem/WorkItem.config.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "config",
    stage: "persistence",
    path: "packages/architecture-lab/config/src/aggregates/WorkItem/WorkItem.layer.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "config",
    stage: "persistence",
    path: "packages/architecture-lab/config/test/WorkItemConfig.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "config",
    stage: "persistence",
    path: "packages/architecture-lab/config/dtslint/WorkItemConfig.tst.ts",
    writer: "template",
  }),

  ...rolePackageFiles("tables", "persistence"),
  AcceptedProofFile.make({
    role: "tables",
    stage: "persistence",
    path: "packages/architecture-lab/tables/src/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "tables",
    stage: "persistence",
    path: "packages/architecture-lab/tables/src/tables.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "tables",
    stage: "persistence",
    path: "packages/architecture-lab/tables/src/aggregates/WorkItem/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "tables",
    stage: "persistence",
    path: "packages/architecture-lab/tables/src/aggregates/WorkItem/WorkItem.table.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "tables",
    stage: "persistence",
    path: "packages/architecture-lab/tables/test/WorkItemTable.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "tables",
    stage: "persistence",
    path: "packages/architecture-lab/tables/dtslint/WorkItemTable.tst.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "tables",
    stage: "persistence",
    path: "packages/architecture-lab/tables/src/entities/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "tables",
    stage: "persistence",
    path: "packages/architecture-lab/tables/src/entities/Worker/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "tables",
    stage: "persistence",
    path: "packages/architecture-lab/tables/src/entities/Worker/Worker.table.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "tables",
    stage: "persistence",
    path: "packages/architecture-lab/tables/test/WorkerTable.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "tables",
    stage: "persistence",
    path: "packages/architecture-lab/tables/dtslint/WorkerTable.tst.ts",
    writer: "template",
  }),

  ...rolePackageFiles("client", "client"),
  AcceptedProofFile.make({
    role: "client",
    stage: "client",
    path: "packages/architecture-lab/client/src/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "client",
    stage: "client",
    path: "packages/architecture-lab/client/src/aggregates/WorkItem/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "client",
    stage: "client",
    path: "packages/architecture-lab/client/src/aggregates/WorkItem/WorkItem.client.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "client",
    stage: "client",
    path: "packages/architecture-lab/client/test/WorkItemClient.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "client",
    stage: "client",
    path: "packages/architecture-lab/client/dtslint/WorkItemClient.tst.ts",
    writer: "template",
  }),

  ...rolePackageFiles("ui", "client"),
  AcceptedProofFile.make({
    role: "ui",
    stage: "client",
    path: "packages/architecture-lab/ui/src/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "ui",
    stage: "client",
    path: "packages/architecture-lab/ui/src/aggregates/WorkItem/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "ui",
    stage: "client",
    path: "packages/architecture-lab/ui/src/aggregates/WorkItem/WorkItem.view-model.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "ui",
    stage: "client",
    path: "packages/architecture-lab/ui/test/WorkItemViewModel.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "ui",
    stage: "client",
    path: "packages/architecture-lab/ui/dtslint/WorkItemViewModel.tst.ts",
    writer: "template",
  }),

  ...rolePackageFiles("proof-app", "client"),
  AcceptedProofFile.make({
    role: "proof-app",
    stage: "client",
    path: "apps/architecture-lab-proof/src/index.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "proof-app",
    stage: "client",
    path: "apps/architecture-lab-proof/test/ArchitectureLabProof.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "proof-app",
    stage: "client",
    path: "apps/architecture-lab-proof/dtslint/ArchitectureLabProof.tst.ts",
    writer: "template",
  }),

  ...rolePackageFiles("db-admin", "persistence"),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/drizzle.config.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/tsconfig.drizzle.json",
    writer: "jsonc",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/src/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/src/migrate.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/src/schema.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/src/targets.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/src/migrations/ArchitectureLab.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/src/migrations/WorkspaceThread.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/src/migrations/EpistemicUsage.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/drizzle/20260512000000_architecture_lab_work_item/migration.sql",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/drizzle/20260512001000_architecture_lab_worker_archetype/migration.sql",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/drizzle/20260613000000_workspace_thread_domain/migration.sql",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/drizzle/20260613000010_epistemic_usage_record/migration.sql",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/test/ArchitectureLabMigrationTarget.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/test/index.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/test/integration/ArchitectureLabMigration.pglite.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/dtslint/ArchitectureLabMigrationTarget.tst.ts",
    writer: "template",
  }),
];

const legacyFixturePaths = [
  "packages/fixture-lab/specimen",
  "packages/tooling/tool/cli/test/fixtures/repo-architecture-automation",
  "packages/tooling/tool/cli/test/repo-architecture-automation-fixture.test.ts",
] as const;

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

const packageNameForRole = (target: ArchitecturePlanTarget, role: ArchitectureSliceRole): string => {
  if (role === "proof-app") return `@beep/${target.boundedContext}-proof`;
  if (role === "db-admin") return "@beep/db-admin";
  return `@beep/${target.boundedContext}-${role}`;
};

const pathForRole = (target: ArchitecturePlanTarget, role: ArchitectureSliceRole): string => {
  if (role === "proof-app") return `apps/${target.boundedContext}-proof`;
  if (role === "db-admin") return "packages/_internal/db-admin";
  return `packages/${target.boundedContext}/${role}`;
};

const exportsForRole = (target: ArchitecturePlanTarget, role: ArchitectureSliceRole): ReadonlyArray<string> => {
  const conceptExport = `./${target.conceptPath}`;
  if (role === "domain") return [".", `./${target.domainKind}`, conceptExport];
  if (role === "use-cases") return [".", "./public", "./server", conceptExport, `${conceptExport}/server`];
  if (role === "config") return [".", "./public", "./server", "./secrets", "./layer", "./test", conceptExport];
  if (role === "server") return [".", "./layer", "./test", conceptExport];
  if (role === "tables") return [".", "./tables", conceptExport];
  if (role === "client" || role === "ui") return [".", conceptExport];
  return ["."];
};

const rolePlanFor = (target: ArchitecturePlanTarget, role: ArchitectureSliceRole): ArchitectureSliceRolePlan =>
  ArchitectureSliceRolePlan.make({
    role,
    packageName: packageNameForRole(target, role),
    path: pathForRole(target, role),
    exports: exportsForRole(target, role),
  });

const packageShellTargetFor = (boundedContext: string): ArchitecturePlanTarget =>
  ArchitecturePlanTarget.make({
    boundedContext,
    concept: "PackageShell",
    conceptPath: "aggregates/PackageShell",
    domainKind: "aggregates",
    stage: "core",
  });

const packageShellExportsForRole = ArchitecturePackageRole.$match({
  domain: () => [
    ".",
    "./aggregates",
    "./aggregates/*",
    "./entities",
    "./entities/*",
    "./identity",
    "./values",
    "./values/*",
  ],
  "use-cases": () => [
    ".",
    "./public",
    "./server",
    "./aggregates/*",
    "./aggregates/*/server",
    "./entities/*",
    "./entities/*/server",
  ],
  config: () => [".", "./public", "./server", "./secrets", "./layer", "./test", "./aggregates/*"],
  server: () => [".", "./layer", "./test", "./aggregates/*", "./entities/*"],
  tables: () => [".", "./tables", "./aggregates/*", "./entities/*"],
  client: () => [".", "./aggregates/*"],
  ui: () => [".", "./aggregates/*"],
});

const packageShellRolePlanFor = (
  target: ArchitecturePlanTarget,
  role: ArchitecturePackageRole
): ArchitectureSliceRolePlan =>
  ArchitectureSliceRolePlan.make({
    role,
    packageName: packageNameForRole(target, role),
    path: pathForRole(target, role),
    exports: packageShellExportsForRole(role),
  });

const packageShellDescriptionForRole = (target: ArchitecturePlanTarget, role: ArchitecturePackageRole): string => {
  const contextLabel = Str.replaceAll("-", " ")(Str.kebabCase(target.boundedContext));
  if (role === "domain") return `${contextLabel} domain package.`;
  if (role === "use-cases") return `${contextLabel} use-case contract package.`;
  if (role === "config") return `${contextLabel} typed configuration package.`;
  if (role === "server") return `${contextLabel} server adapter package.`;
  if (role === "tables") return `${contextLabel} table declaration package.`;
  if (role === "client") return `${contextLabel} client adapter package.`;
  return `${contextLabel} UI package.`;
};

const packageShellDependenciesForRole = (
  target: ArchitecturePlanTarget,
  role: ArchitecturePackageRole
): R.ReadonlyRecord<string, string> => {
  if (role === "domain") {
    return {
      "@beep/identity": "workspace:^",
      "@beep/schema": "workspace:^",
      "@beep/shared-domain": "workspace:^",
      effect: "catalog:",
    };
  }
  if (role === "use-cases") {
    return {
      [`@beep/${target.boundedContext}-domain`]: "workspace:^",
      "@beep/identity": "workspace:^",
      "@beep/schema": "workspace:^",
      effect: "catalog:",
    };
  }
  if (role === "config") {
    return {
      "@beep/identity": "workspace:^",
      "@beep/schema": "workspace:^",
      effect: "catalog:",
    };
  }
  if (role === "server") {
    return {
      [`@beep/${target.boundedContext}-config`]: "workspace:^",
      [`@beep/${target.boundedContext}-domain`]: "workspace:^",
      [`@beep/${target.boundedContext}-tables`]: "workspace:^",
      [`@beep/${target.boundedContext}-use-cases`]: "workspace:^",
      "@beep/identity": "workspace:^",
      "@beep/postgres": "workspace:^",
      "@beep/schema": "workspace:^",
      "drizzle-orm": "catalog:",
      effect: "catalog:",
    };
  }
  if (role === "tables") {
    return {
      [`@beep/${target.boundedContext}-domain`]: "workspace:^",
      "@beep/drizzle": "workspace:^",
      "drizzle-orm": "catalog:",
      effect: "catalog:",
    };
  }
  if (role === "client") {
    return {
      [`@beep/${target.boundedContext}-domain`]: "workspace:^",
      [`@beep/${target.boundedContext}-use-cases`]: "workspace:^",
      "@beep/identity": "workspace:^",
      effect: "catalog:",
    };
  }
  return {
    [`@beep/${target.boundedContext}-config`]: "workspace:^",
    [`@beep/${target.boundedContext}-domain`]: "workspace:^",
    "@beep/identity": "workspace:^",
    "@beep/schema": "workspace:^",
    "@beep/utils": "workspace:^",
    effect: "catalog:",
  };
};

const packageShellDevDependenciesForRole = (role: ArchitecturePackageRole): R.ReadonlyRecord<string, string> =>
  role === "server"
    ? {
        "@beep/test-utils": "workspace:^",
        "@effect/vitest": "catalog:",
        "@types/node": "catalog:",
      }
    : {
        "@effect/vitest": "catalog:",
        "@types/node": "catalog:",
      };

const shellPackageJsonOperationFor = (
  target: ArchitecturePlanTarget,
  role: ArchitecturePackageRole
): WritePackageJsonOperation =>
  WritePackageJsonOperation.make({
    kind: "write-package-json",
    role,
    path: `${pathForRole(target, role)}/package.json`,
    packageName: packageNameForRole(target, role),
    packageDescription: packageShellDescriptionForRole(target, role),
    repositoryDirectory: pathForRole(target, role),
    exports: packageShellExportsForRole(role),
    dependencies: packageShellDependenciesForRole(target, role),
    devDependencies: packageShellDevDependenciesForRole(role),
    description: `Write structured ${role} package manifest for ${target.boundedContext}.`,
  });

const packageShellAgentsContent = (
  target: ArchitecturePlanTarget,
  role: ArchitecturePackageRole
): string => `# ${packageNameForRole(target, role)} Agent Notes

- This package is the \`${role}\` role package for the \`${target.boundedContext}\` slice.
- Keep package-level wiring here and add concept-qualified modules through \`beep architecture add concept\` or \`beep architecture add role\`.
`;

const packageShellReadmeContent = (
  target: ArchitecturePlanTarget,
  role: ArchitecturePackageRole
): string => `# ${packageNameForRole(target, role)}

Shell-only ${role} package for the \`${target.boundedContext}\` slice.

Use \`beep architecture add concept\` or \`beep architecture add role\` to add concept-qualified modules.
`;

const packageShellDocgenContent = (target: ArchitecturePlanTarget, role: ArchitecturePackageRole): string => `{
  "$schema": "../../../packages/tooling/tool/docgen/schema.json",
  "exclude": ["src/internal/**/*.ts"],
  "srcLink": "https://github.com/beep-effect/beep-effect/tree/main/packages/${target.boundedContext}/${role}/src/"
}
`;

const packageShellTsconfigContent = (): string => `{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../../tsconfig.base.json",
  "include": ["src"],
  "compilerOptions": {
    "types": ["node"],
    "outDir": "dist",
    "rootDir": "src"
  }
}
`;

const packageShellTestTsconfigContent = (): string => `{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../../tsconfig.base.json",
  "include": ["src", "test", "dtslint"],
  "compilerOptions": {
    "composite": false,
    "declaration": false,
    "declarationMap": false,
    "incremental": false,
    "noEmit": true,
    "outDir": "dist-test",
    "rootDir": ".",
    "sourceMap": false,
    "types": ["node", "bun-types"]
  }
}
`;

const packageShellVitestContent = (): string => `import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // Package-specific overrides
    },
  })
);
`;

const categoryForRole = ArchitecturePackageRole.$match({
  domain: () => "aggregates",
  "use-cases": identity,
  config: () => "configuration",
  server: () => "handlers",
  tables: identity,
  client: () => "clients",
  ui: () => "models",
});

const extraExportForRole = ArchitecturePackageRole.$match({
  domain: () =>
    '\n/**\n * Aggregate namespace exports.\n *\n * @category aggregates\n * @since 0.0.0\n */\nexport * as Aggregates from "./aggregates/index.js";\n/**\n * Entity namespace exports.\n *\n * @category entities\n * @since 0.0.0\n */\nexport * as Entities from "./entities/index.js";\n/**\n * Identity namespace exports.\n *\n * @category entity-ids\n * @since 0.0.0\n */\nexport * as Identity from "./identity/index.js";\n/**\n * Value-object namespace exports.\n *\n * @category value-objects\n * @since 0.0.0\n */\nexport * as Values from "./values/index.js";\n',
  "use-cases": () =>
    '\n/**\n * Public use-case exports.\n *\n * @category use-cases\n * @since 0.0.0\n */\nexport * from "./public.js";\n',
  config: () =>
    '\n/**\n * Browser-safe public configuration exports.\n *\n * @category configuration\n * @since 0.0.0\n */\nexport * from "./public.js";\n',
  server: () =>
    '\n/**\n * Server layer exports.\n *\n * @category layers\n * @since 0.0.0\n */\nexport * from "./Layer.js";\n',
  tables: () =>
    '\n/**\n * Table collection exports.\n *\n * @category tables\n * @since 0.0.0\n */\nexport * from "./tables.js";\n',
  client: () => "",
  ui: () => "",
});

const packageShellIndexContent = (target: ArchitecturePlanTarget, role: ArchitecturePackageRole): string => {
  const packageName = packageNameForRole(target, role);
  const category = categoryForRole(role);
  const extraExport = extraExportForRole(role);

  return `/**
 * Package entry point for \`${packageName}\`.
 *
 * @packageDocumentation
 * @category ${category}
 * @since 0.0.0
 */

/**
 * Package version for \`${packageName}\`.
 *
 * @category ${category}
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;
${extraExport}`;
};

const packageShellEmptyModuleContent = (title: string, category: string): string => `/**
 * ${title}.
 *
 * @packageDocumentation
 * @category ${category}
 * @since 0.0.0
 */

export {};
`;

const packageShellLayerContent = (target: ArchitecturePlanTarget, role: "config" | "server"): string => {
  const contextPascal = Str.pascalCase(target.boundedContext);
  const exportName = role === "server" ? `${contextPascal}ServerLive` : `${contextPascal}ConfigLive`;
  return `/**
 * ${Str.replaceAll("-", " ")(target.boundedContext)} ${role} layer.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import { Layer } from "effect";

/**
 * Shell ${role} layer for the ${target.boundedContext} slice.
 *
 * @category layers
 * @since 0.0.0
 */
export const ${exportName} = Layer.empty;
`;
};

const packageShellTestLayerContent = (target: ArchitecturePlanTarget, role: "config" | "server"): string => {
  const contextPascal = Str.pascalCase(target.boundedContext);
  const exportName = role === "server" ? `${contextPascal}ServerTest` : `${contextPascal}ConfigTest`;
  return `/**
 * ${Str.replaceAll("-", " ")(target.boundedContext)} ${role} test layer.
 *
 * @packageDocumentation
 * @category testing
 * @since 0.0.0
 */

import { Layer } from "effect";

/**
 * Shell ${role} test layer for the ${target.boundedContext} slice.
 *
 * @category testing
 * @since 0.0.0
 */
export const ${exportName} = Layer.empty;
`;
};

const packageShellTablesContent = (target: ArchitecturePlanTarget): string => `/**
 * ${Str.replaceAll("-", " ")(target.boundedContext)} table collection.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

/**
 * Empty shell Drizzle schema for the ${target.boundedContext} slice.
 *
 * @category tables
 * @since 0.0.0
 */
export const DbSchema = {};

/**
 * Empty shell Drizzle schema type.
 *
 * @category tables
 * @since 0.0.0
 */
export type DbSchema = typeof DbSchema;
`;

const packageShellFileOperationsFor = (
  target: ArchitecturePlanTarget,
  role: ArchitecturePackageRole
): ReadonlyArray<WriteFileOperation> => {
  const basePath = pathForRole(target, role);
  const commonFiles = [
    WriteFileOperation.make({
      kind: "write-file",
      role,
      path: `${basePath}/AGENTS.md`,
      writer: "template",
      content: packageShellAgentsContent(target, role),
      description: `Write ${role} package agent guidance.`,
    }),
    WriteFileOperation.make({
      kind: "write-file",
      role,
      path: `${basePath}/LICENSE`,
      writer: "template",
      content: "MIT\n",
      description: `Write ${role} package license marker.`,
    }),
    WriteFileOperation.make({
      kind: "write-file",
      role,
      path: `${basePath}/README.md`,
      writer: "template",
      content: packageShellReadmeContent(target, role),
      description: `Write ${role} package README.`,
    }),
    WriteFileOperation.make({
      kind: "write-file",
      role,
      path: `${basePath}/docgen.json`,
      writer: "json",
      content: packageShellDocgenContent(target, role),
      description: `Write ${role} package docgen configuration.`,
    }),
    WriteFileOperation.make({
      kind: "write-file",
      role,
      path: `${basePath}/tsconfig.json`,
      writer: "jsonc",
      content: packageShellTsconfigContent(),
      description: `Write ${role} package TypeScript configuration.`,
    }),
    WriteFileOperation.make({
      kind: "write-file",
      role,
      path: `${basePath}/tsconfig.test.json`,
      writer: "jsonc",
      content: packageShellTestTsconfigContent(),
      description: `Write ${role} package test TypeScript configuration.`,
    }),
    WriteFileOperation.make({
      kind: "write-file",
      role,
      path: `${basePath}/vitest.config.ts`,
      writer: "template",
      content: packageShellVitestContent(),
      description: `Write ${role} package Vitest configuration.`,
    }),
    WriteFileOperation.make({
      kind: "write-file",
      role,
      path: `${basePath}/dtslint/.gitkeep`,
      writer: "template",
      content: "",
      description: `Create ${role} package dtslint directory.`,
    }),
    WriteFileOperation.make({
      kind: "write-file",
      role,
      path: `${basePath}/test/.gitkeep`,
      writer: "template",
      content: "",
      description: `Create ${role} package test directory.`,
    }),
    WriteFileOperation.make({
      kind: "write-file",
      role,
      path: `${basePath}/src/index.ts`,
      writer: "ts-morph",
      content: packageShellIndexContent(target, role),
      description: `Write ${role} package entry point.`,
    }),
  ] as const;

  if (role === "domain") {
    return [
      ...commonFiles,
      WriteFileOperation.make({
        kind: "write-file",
        role,
        path: `${basePath}/src/aggregates/index.ts`,
        writer: "ts-morph",
        content: packageShellEmptyModuleContent(`${target.boundedContext} aggregate exports`, "aggregates"),
        description: "Write aggregate namespace shell.",
      }),
      WriteFileOperation.make({
        kind: "write-file",
        role,
        path: `${basePath}/src/entities/index.ts`,
        writer: "ts-morph",
        content: packageShellEmptyModuleContent(`${target.boundedContext} entity exports`, "entities"),
        description: "Write entity namespace shell.",
      }),
      WriteFileOperation.make({
        kind: "write-file",
        role,
        path: `${basePath}/src/identity/index.ts`,
        writer: "ts-morph",
        content: packageShellEmptyModuleContent(`${target.boundedContext} identity exports`, "entity-ids"),
        description: "Write identity namespace shell.",
      }),
      WriteFileOperation.make({
        kind: "write-file",
        role,
        path: `${basePath}/src/values/index.ts`,
        writer: "ts-morph",
        content: packageShellEmptyModuleContent(`${target.boundedContext} value-object exports`, "value-objects"),
        description: "Write value namespace shell.",
      }),
    ];
  }

  if (role === "use-cases") {
    return [
      ...commonFiles,
      WriteFileOperation.make({
        kind: "write-file",
        role,
        path: `${basePath}/src/public.ts`,
        writer: "ts-morph",
        content: packageShellEmptyModuleContent(`${target.boundedContext} public use-case exports`, "use-cases"),
        description: "Write public use-case shell.",
      }),
      WriteFileOperation.make({
        kind: "write-file",
        role,
        path: `${basePath}/src/server.ts`,
        writer: "ts-morph",
        content: packageShellEmptyModuleContent(`${target.boundedContext} server use-case exports`, "repositories"),
        description: "Write server use-case shell.",
      }),
    ];
  }

  if (role === "config") {
    return [
      ...commonFiles,
      ...A.map(["public", "server", "secrets"] as const, (surface) =>
        WriteFileOperation.make({
          kind: "write-file",
          role,
          path: `${basePath}/src/${surface}.ts`,
          writer: "ts-morph",
          content: packageShellEmptyModuleContent(
            `${target.boundedContext} ${surface} config exports`,
            "configuration"
          ),
          description: `Write ${surface} config shell.`,
        })
      ),
      WriteFileOperation.make({
        kind: "write-file",
        role,
        path: `${basePath}/src/layer.ts`,
        writer: "ts-morph",
        content: packageShellLayerContent(target, "config"),
        description: "Write config layer shell.",
      }),
      WriteFileOperation.make({
        kind: "write-file",
        role,
        path: `${basePath}/src/test.ts`,
        writer: "ts-morph",
        content: packageShellTestLayerContent(target, "config"),
        description: "Write config test layer shell.",
      }),
    ];
  }

  if (role === "server") {
    return [
      ...commonFiles,
      WriteFileOperation.make({
        kind: "write-file",
        role,
        path: `${basePath}/src/Layer.ts`,
        writer: "ts-morph",
        content: packageShellLayerContent(target, "server"),
        description: "Write server layer shell.",
      }),
      WriteFileOperation.make({
        kind: "write-file",
        role,
        path: `${basePath}/src/test.ts`,
        writer: "ts-morph",
        content: packageShellTestLayerContent(target, "server"),
        description: "Write server test layer shell.",
      }),
    ];
  }

  if (role === "tables") {
    return [
      ...commonFiles,
      WriteFileOperation.make({
        kind: "write-file",
        role,
        path: `${basePath}/src/tables.ts`,
        writer: "ts-morph",
        content: packageShellTablesContent(target),
        description: "Write tables collection shell.",
      }),
    ];
  }

  return commonFiles;
};

const isDefaultPlanTarget = (target: ArchitecturePlanTarget): boolean =>
  Str.equivalence(target.boundedContext, defaultPlanTarget.boundedContext) &&
  Str.equivalence(target.concept, defaultPlanTarget.concept) &&
  Str.equivalence(target.domainKind, defaultPlanTarget.domainKind);

const sourceConceptForPath = (sourcePath: string): string => {
  const lowerPath = Str.toLowerCase(sourcePath);
  if (Str.includes("WorkPriority")(sourcePath) || Str.includes("work_priority")(lowerPath)) return "WorkPriority";
  if (Str.includes("WorkItem")(sourcePath) || Str.includes("work_item")(lowerPath)) return "WorkItem";
  if (Str.includes("Worker")(sourcePath) || Str.includes("worker")(lowerPath)) return "Worker";
  return "WorkItem";
};

const sourceDomainKindForPath = (sourcePath: string): O.Option<ArchitectureDomainKind> => {
  const sourceConcept = sourceConceptForPath(sourcePath);
  if (Str.includes("/values/")(sourcePath) || Str.equivalence(sourceConcept, "WorkPriority")) return O.some("values");
  if (Str.includes("/entities/")(sourcePath) || Str.equivalence(sourceConcept, "Worker")) return O.some("entities");
  if (Str.includes("/aggregates/")(sourcePath) || Str.equivalence(sourceConcept, "WorkItem"))
    return O.some("aggregates");
  return O.none();
};

const isPackageScaffoldFile = (sourcePath: string): boolean =>
  pipe(
    [
      "AGENTS.md",
      "LICENSE",
      "README.md",
      "docgen.json",
      "package.json",
      "tsconfig.json",
      "vitest.config.ts",
      "dtslint/.gitkeep",
      "test/.gitkeep",
    ] as const,
    A.some((suffix) => Str.endsWith(suffix)(sourcePath))
  );

const isPackageIndexFile = (sourcePath: string): boolean =>
  pipe(
    [
      "/src/index.ts",
      "/src/public.ts",
      "/src/server.ts",
      "/src/Layer.ts",
      "/src/test.ts",
      "/src/tables.ts",
      "/src/schema.ts",
      "/src/targets.ts",
      "/src/migrations/ArchitectureLab.ts",
      "/drizzle.config.ts",
    ] as const,
    A.some((suffix) => Str.endsWith(suffix)(sourcePath))
  );

const isPackageLevelFile = (sourcePath: string): boolean =>
  isPackageScaffoldFile(sourcePath) || isPackageIndexFile(sourcePath);

const proofFileMatchesDomainKind = (target: ArchitecturePlanTarget, file: AcceptedProofFile): boolean => {
  if (isDefaultPlanTarget(target)) return true;
  if (isPackageLevelFile(file.path)) return true;
  return pipe(sourceDomainKindForPath(file.path), O.map(Str.equivalence(target.domainKind)), O.getOrElse(thunkFalse));
};

const sourceConceptPathFor = (sourcePath: string): string =>
  pipe(
    sourceDomainKindForPath(sourcePath),
    O.map((domainKind) => `${domainKind}/${sourceConceptForPath(sourcePath)}`),
    O.getOrElse(() => "aggregates/WorkItem")
  );

const targetPathFor = (sourcePath: string, target: ArchitecturePlanTarget): string => {
  if (isDefaultPlanTarget(target)) return sourcePath;
  const sourceConcept = sourceConceptForPath(sourcePath);
  const sourceConceptPath = sourceConceptPathFor(sourcePath);
  const conceptPascal = Str.pascalCase(target.concept);
  const conceptKebab = Str.kebabCase(target.concept);
  const conceptSnake = Str.snakeCase(target.concept);
  const sourceConceptKebab = Str.kebabCase(sourceConcept);
  const sourceConceptSnake = Str.snakeCase(sourceConcept);
  const contextKebab = Str.kebabCase(target.boundedContext);
  const contextSnake = Str.snakeCase(target.boundedContext);
  if (Str.startsWith("packages/architecture-lab/")(sourcePath)) {
    return pipe(
      sourcePath,
      Str.replace("packages/architecture-lab/", `packages/${target.boundedContext}/`),
      Str.replaceAll("ArchitectureLab", Str.pascalCase(target.boundedContext)),
      Str.replaceAll("architecture_lab", contextSnake),
      Str.replaceAll(sourceConceptPath, target.conceptPath),
      Str.replaceAll(sourceConcept, conceptPascal),
      Str.replaceAll(sourceConceptKebab, conceptKebab),
      Str.replaceAll(sourceConceptSnake, conceptSnake)
    );
  }
  if (Str.startsWith("apps/architecture-lab-proof/")(sourcePath)) {
    return pipe(
      sourcePath,
      Str.replace("apps/architecture-lab-proof/", `apps/${target.boundedContext}-proof/`),
      Str.replaceAll("ArchitectureLab", Str.pascalCase(target.boundedContext)),
      Str.replaceAll(sourceConcept, conceptPascal),
      Str.replaceAll(sourceConceptKebab, conceptKebab),
      Str.replaceAll(sourceConceptSnake, conceptSnake)
    );
  }
  return pipe(
    sourcePath,
    Str.replaceAll("ArchitectureLab", Str.pascalCase(target.boundedContext)),
    Str.replaceAll("architecture-lab", contextKebab),
    Str.replaceAll("architecture_lab", contextSnake),
    Str.replaceAll(sourceConcept, conceptPascal),
    Str.replaceAll(sourceConceptKebab, conceptKebab),
    Str.replaceAll(sourceConceptSnake, conceptSnake)
  );
};

const replacementPairs = (
  target: ArchitecturePlanTarget,
  sourcePath: string
): ReadonlyArray<readonly [string, string]> => {
  const sourceConcept = sourceConceptForPath(sourcePath);
  const sourceConceptPascal = Str.pascalCase(sourceConcept);
  const sourceConceptCamel = Str.camelCase(sourceConcept);
  const sourceConceptKebab = Str.kebabCase(sourceConcept);
  const sourceConceptSnake = Str.snakeCase(sourceConcept);
  const conceptPascal = Str.pascalCase(target.concept);
  const conceptCamel = Str.camelCase(target.concept);
  const conceptKebab = Str.kebabCase(target.concept);
  const conceptSnake = Str.snakeCase(target.concept);
  const contextPascal = Str.pascalCase(target.boundedContext);
  const contextKebab = Str.kebabCase(target.boundedContext);
  const contextSnake = Str.snakeCase(target.boundedContext);

  return [
    ["ARCHITECTURE_LAB", Str.toUpperCase(contextSnake)],
    [Str.toUpperCase(sourceConceptSnake), Str.toUpperCase(conceptSnake)],
    ["ArchitectureLab", contextPascal],
    ["architecture-lab", contextKebab],
    ["architecture_lab", contextSnake],
    ["architecture lab", Str.replaceAll("-", " ")(contextKebab)],
    [sourceConceptPascal, conceptPascal],
    [sourceConceptCamel, conceptCamel],
    [sourceConceptKebab, conceptKebab],
    [sourceConceptSnake, conceptSnake],
  ];
};

const renderAcceptedTemplate = (content: string, target: ArchitecturePlanTarget, sourcePath: string): string =>
  isDefaultPlanTarget(target)
    ? content
    : pipe(
        replacementPairs(target, sourcePath),
        A.reduce(content, (rendered, [from, to]) => Str.replaceAll(from, to)(rendered))
      );

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

const encodeOperationPlanJson = S.encodeUnknownEffect(S.fromJsonString(CanonicalSliceOperationPlan));
const decodeOperationPlanJson = S.decodeUnknownEffect(S.fromJsonString(CanonicalSliceOperationPlan));

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
          content: targetFileExists ? content : renderAcceptedTemplate(content, target, file.path),
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

/**
 * Encode an operation plan as JSON text.
 *
 * @example
 * ```ts
 * import {
 *   encodeCanonicalSliceOperationPlanJson,
 *   makeCanonicalSliceOperationPlan,
 * } from "@beep/repo-cli/commands/Architecture"
 * import { Effect } from "effect"
 *
 * const program = encodeCanonicalSliceOperationPlanJson(makeCanonicalSliceOperationPlan()).pipe(
 *   Effect.map((json) => json.includes("architecture-operation-plan/v1"))
 * )
 *
 * Effect.runPromise(program).then(console.log)
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const encodeCanonicalSliceOperationPlanJson = encodeOperationPlanJson;

/**
 * Decode operation-plan JSON text.
 *
 * @example
 * ```ts
 * import {
 *   decodeCanonicalSliceOperationPlanJson,
 *   encodeCanonicalSliceOperationPlanJson,
 *   makeCanonicalSliceOperationPlan,
 * } from "@beep/repo-cli/commands/Architecture"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const json = yield* encodeCanonicalSliceOperationPlanJson(makeCanonicalSliceOperationPlan())
 *   const plan = yield* decodeCanonicalSliceOperationPlanJson(json)
 *   return plan.schemaVersion
 * })
 *
 * Effect.runPromise(program).then(console.log)
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const decodeCanonicalSliceOperationPlanJson = decodeOperationPlanJson;
