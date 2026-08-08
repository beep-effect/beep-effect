/**
 * Architecture operation-plan schemas.
 *
 * @packageDocumentation
 * @category schemas
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Effect } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type * as AST from "effect/SchemaAST";

const $I = $RepoCliId.create("commands/Architecture/Architecture.schemas");

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
 * @example
 * ```ts
 * import type { ArchitectureDomainKind } from "@beep/repo-cli/commands/Architecture/Architecture.schemas"
 *
 * const example: ArchitectureDomainKind | undefined = undefined
 * console.log(example === undefined) // true
 * ```
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
 * @example
 * ```ts
 * import type { ArchitecturePlanStage } from "@beep/repo-cli/commands/Architecture/Architecture.schemas"
 *
 * const example: ArchitecturePlanStage | undefined = undefined
 * console.log(example === undefined) // true
 * ```
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
 * @example
 * ```ts
 * import type { ArchitectureSliceRole } from "@beep/repo-cli/commands/Architecture/Architecture.schemas"
 *
 * const example: ArchitectureSliceRole | undefined = undefined
 * console.log(example === undefined) // true
 * ```
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
 * console.log(role) // example value
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
 * console.log(kind) // example value
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
 * @example
 * ```ts
 * import type { ArchitectureWriterKind } from "@beep/repo-cli/commands/Architecture/Architecture.schemas"
 *
 * const example: ArchitectureWriterKind | undefined = undefined
 * console.log(example === undefined) // true
 * ```
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
 * console.log(mode) // example value
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
 * console.log(policy) // example value
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
 * console.log(source) // example value
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
 * console.log(status) // example value
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
]).pipe(
  $I.annoteSchema("ArchitectureOperation", {
    description: "Canonical operation-plan operation.",
  })
);

/**
 * Canonical operation-plan operation.
 *
 * @example
 * ```ts
 * import type { ArchitectureOperation } from "@beep/repo-cli/commands/Architecture"
 *
 * const operation: ArchitectureOperation | undefined = undefined
 * console.log(operation === undefined) // true
 * ```
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
const encodeOperationPlanJson = S.encodeUnknownEffect(S.fromJsonString(CanonicalSliceOperationPlan));
const decodeOperationPlanJson = S.decodeUnknownEffect(S.fromJsonString(CanonicalSliceOperationPlan));

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
export const encodeCanonicalSliceOperationPlanJson: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<string, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<string, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, encodeOperationPlanJson);

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
export const decodeCanonicalSliceOperationPlanJson: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<CanonicalSliceOperationPlan, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<CanonicalSliceOperationPlan, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, decodeOperationPlanJson);
