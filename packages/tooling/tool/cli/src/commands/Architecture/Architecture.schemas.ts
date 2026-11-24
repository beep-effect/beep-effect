/**
 * Architecture operation-plan schemas.
 *
 * @packageDocumentation
 * @category schemas
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type * as AST from "effect/SchemaAST";

const $I = $RepoCliId.create("commands/Architecture/Architecture.schemas");

/**
 * **Example** (Validate aggregates domain kind)
 *
 * ```ts
 * import { ArchitectureDomainKind } from "@beep/repo-cli/commands/Architecture"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ArchitectureDomainKind)("aggregates")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ArchitectureDomainKind = LiteralKit(["aggregates", "entities", "values"]).pipe(
  $I.annoteSchema("ArchitectureDomainKind", {
    description: "Domain-kind folder used by canonical architecture operation plans.",
  })
);

/**
 * **Example** (Type-level domain kind)
 *
 * ```ts
 * import type { ArchitectureDomainKind } from "@beep/repo-cli/commands/Architecture/Architecture.schemas"
 *
 * const example: ArchitectureDomainKind | undefined = undefined
 * console.log(example === undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ArchitectureDomainKind = typeof ArchitectureDomainKind.Type;

/**
 * Staged architecture proof targets.
 *
 * **Example** (Validate persistence plan stage)
 *
 * ```ts
 * import { ArchitecturePlanStage } from "@beep/repo-cli/commands/Architecture"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ArchitecturePlanStage)("persistence")) // true
 * ```
 *
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
 * **Example** (Type-level plan stage)
 *
 * ```ts
 * import type { ArchitecturePlanStage } from "@beep/repo-cli/commands/Architecture/Architecture.schemas"
 *
 * const example: ArchitecturePlanStage | undefined = undefined
 * console.log(example === undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ArchitecturePlanStage = typeof ArchitecturePlanStage.Type;

/**
 * **Example** (Validate use-cases slice role)
 *
 * ```ts
 * import { ArchitectureSliceRole } from "@beep/repo-cli/commands/Architecture"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ArchitectureSliceRole)("use-cases")) // true
 * ```
 *
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
  "contract",
  "model",
  "host",
  "web",
]).pipe(
  $I.annoteSchema("ArchitectureSliceRole", {
    description:
      "Role package, proof app, or internal admin target represented in an architecture operation plan: the legacy seven-package roles and the model-first context roles.",
  })
);

/**
 * **Example** (Type-level slice role)
 *
 * ```ts
 * import type { ArchitectureSliceRole } from "@beep/repo-cli/commands/Architecture/Architecture.schemas"
 *
 * const example: ArchitectureSliceRole | undefined = undefined
 * console.log(example === undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ArchitectureSliceRole = typeof ArchitectureSliceRole.Type;

/**
 * Package roles of a model-first bounded context: one package per dependency
 * closure.
 *
 * **Example** (Validate the contract role)
 *
 * ```ts
 * import { ArchitectureContextRole } from "@beep/repo-cli/commands/Architecture"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ArchitectureContextRole)("contract")) // true
 * console.log(S.is(ArchitectureContextRole)("use-cases")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ArchitectureContextRole = LiteralKit(["contract", "model", "host", "web"]).pipe(
  $I.annoteSchema("ArchitectureContextRole", {
    description: "Package role of a model-first bounded context: contract, model, host or web.",
  })
);

/**
 * **Example** (Assign the model role)
 *
 * ```ts
 * import type { ArchitectureContextRole } from "@beep/repo-cli/commands/Architecture"
 *
 * const role: ArchitectureContextRole = "model"
 * console.log(role) // "model"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ArchitectureContextRole = typeof ArchitectureContextRole.Type;

/**
 * Slice shapes an architecture operation plan can describe: the model-first
 * four-package context, or the legacy seven-package slice.
 *
 * **Example** (Validate the legacy shape)
 *
 * ```ts
 * import { ArchitectureShape } from "@beep/repo-cli/commands/Architecture"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ArchitectureShape)("legacy")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ArchitectureShape = LiteralKit(["model-first", "legacy"]).pipe(
  $I.annoteSchema("ArchitectureShape", {
    description: "Slice shape of an architecture operation plan: model-first or legacy.",
  })
);

/**
 * **Example** (Assign the model-first shape)
 *
 * ```ts
 * import type { ArchitectureShape } from "@beep/repo-cli/commands/Architecture"
 *
 * const shape: ArchitectureShape = "model-first"
 * console.log(shape) // "model-first"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ArchitectureShape = typeof ArchitectureShape.Type;

/**
 * Slice role packages supported by `beep architecture create package`.
 *
 * **Example** (Validate domain package role)
 *
 * ```ts
 * import { ArchitecturePackageRole } from "@beep/repo-cli/commands/Architecture/index"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ArchitecturePackageRole)("domain"))
 * ```
 *
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
 * **Example** (Assign domain package role)
 *
 * ```ts
 * import type { ArchitecturePackageRole } from "@beep/repo-cli/commands/Architecture/index"
 *
 * const role: ArchitecturePackageRole = "domain"
 * console.log(role) // example value
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ArchitecturePackageRole = typeof ArchitecturePackageRole.Type;

/**
 * Operation kinds supported by canonical architecture operation plans.
 *
 * **Example** (Validate write-file operation kind)
 *
 * ```ts
 * import { ArchitectureOperationKind } from "@beep/repo-cli/commands/Architecture/index"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ArchitectureOperationKind)("write-file"))
 * ```
 *
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
 * **Example** (Assign ensure-file operation kind)
 *
 * ```ts
 * import type { ArchitectureOperationKind } from "@beep/repo-cli/commands/Architecture/index"
 *
 * const kind: ArchitectureOperationKind = "ensure-file"
 * console.log(kind) // example value
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ArchitectureOperationKind = typeof ArchitectureOperationKind.Type;

/**
 * **Example** (Validate package-json writer kind)
 *
 * ```ts
 * import { ArchitectureWriterKind } from "@beep/repo-cli/commands/Architecture"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ArchitectureWriterKind)("package-json")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ArchitectureWriterKind = LiteralKit(["template", "json", "jsonc", "package-json", "ts-morph"]).pipe(
  $I.annoteSchema("ArchitectureWriterKind", {
    description: "Writer family selected for an architecture operation-plan file operation.",
  })
);

/**
 * **Example** (Type-level writer kind)
 *
 * ```ts
 * import type { ArchitectureWriterKind } from "@beep/repo-cli/commands/Architecture/Architecture.schemas"
 *
 * const example: ArchitectureWriterKind | undefined = undefined
 * console.log(example === undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ArchitectureWriterKind = typeof ArchitectureWriterKind.Type;

/**
 * **Example** (Validate write-if-missing mode)
 *
 * ```ts
 * import { ArchitectureOperationWriteMode } from "@beep/repo-cli/commands/Architecture/index"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ArchitectureOperationWriteMode)("write-if-missing"))
 * ```
 *
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
 * **Example** (Assign ensure-present write mode)
 *
 * ```ts
 * import type { ArchitectureOperationWriteMode } from "@beep/repo-cli/commands/Architecture/index"
 *
 * const mode: ArchitectureOperationWriteMode = "ensure-present"
 * console.log(mode) // example value
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ArchitectureOperationWriteMode = typeof ArchitectureOperationWriteMode.Type;

/**
 * **Example** (Validate conflict policy value)
 *
 * ```ts
 * import { ArchitectureOperationConflictPolicy } from "@beep/repo-cli/commands/Architecture/index"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ArchitectureOperationConflictPolicy)("skip-identical-fail-different"))
 * ```
 *
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
 * **Example** (Assign require-present policy)
 *
 * ```ts
 * import type { ArchitectureOperationConflictPolicy } from "@beep/repo-cli/commands/Architecture/index"
 *
 * const policy: ArchitectureOperationConflictPolicy = "require-present"
 * console.log(policy) // example value
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ArchitectureOperationConflictPolicy = typeof ArchitectureOperationConflictPolicy.Type;

/**
 * **Example** (Validate accepted-proof source)
 *
 * ```ts
 * import { ArchitectureOperationSource } from "@beep/repo-cli/commands/Architecture/index"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ArchitectureOperationSource)("accepted-proof"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ArchitectureOperationSource = LiteralKit([
  "accepted-proof",
  "package-shell",
  "legacy-cleanup",
  "legacy-plan",
  "model-first-template",
]).pipe(
  $I.annoteSchema("ArchitectureOperationSource", {
    description: "Origin of an architecture operation within the normalized plan factory.",
  })
);

/**
 * **Example** (Assign package-shell source)
 *
 * ```ts
 * import type { ArchitectureOperationSource } from "@beep/repo-cli/commands/Architecture/index"
 *
 * const source: ArchitectureOperationSource = "package-shell"
 * console.log(source) // example value
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ArchitectureOperationSource = typeof ArchitectureOperationSource.Type;

/**
 * **Example** (Validate matching check status)
 *
 * ```ts
 * import { ArchitectureOperationCheckStatus } from "@beep/repo-cli/commands/Architecture/index"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ArchitectureOperationCheckStatus)("matching"))
 * ```
 *
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
 * **Example** (Assign absent check status)
 *
 * ```ts
 * import type { ArchitectureOperationCheckStatus } from "@beep/repo-cli/commands/Architecture/index"
 *
 * const status: ArchitectureOperationCheckStatus = "absent"
 * console.log(status) // example value
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ArchitectureOperationCheckStatus = typeof ArchitectureOperationCheckStatus.Type;

const OperationId = S.String.pipe(
  S.withConstructorDefault(Effect.succeed("legacy-operation")),
  S.withDecodingDefaultKey(Effect.succeed("legacy-operation"))
);
const WriteIfMissing = ArchitectureOperationWriteMode.pipe(
  S.withConstructorDefault(Effect.succeed("write-if-missing" as const)),
  S.withDecodingDefaultKey(Effect.succeed("write-if-missing" as const))
);
const EnsurePresent = ArchitectureOperationWriteMode.pipe(
  S.withConstructorDefault(Effect.succeed("ensure-present" as const)),
  S.withDecodingDefaultKey(Effect.succeed("ensure-present" as const))
);
const RemoveIfPresent = ArchitectureOperationWriteMode.pipe(
  S.withConstructorDefault(Effect.succeed("remove-if-present" as const)),
  S.withDecodingDefaultKey(Effect.succeed("remove-if-present" as const))
);
const SkipIdenticalFailDifferent = ArchitectureOperationConflictPolicy.pipe(
  S.withConstructorDefault(Effect.succeed("skip-identical-fail-different" as const)),
  S.withDecodingDefaultKey(Effect.succeed("skip-identical-fail-different" as const))
);
const RequirePresent = ArchitectureOperationConflictPolicy.pipe(
  S.withConstructorDefault(Effect.succeed("require-present" as const)),
  S.withDecodingDefaultKey(Effect.succeed("require-present" as const))
);
const RemoveExisting = ArchitectureOperationConflictPolicy.pipe(
  S.withConstructorDefault(Effect.succeed("remove-existing" as const)),
  S.withDecodingDefaultKey(Effect.succeed("remove-existing" as const))
);
const OperationSource = ArchitectureOperationSource.pipe(
  S.withConstructorDefault(Effect.succeed("legacy-plan" as const)),
  S.withDecodingDefaultKey(Effect.succeed("legacy-plan" as const))
);

/**
 * **Example** (Create slice role plan)
 *
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
 *
 * @category models
 * @since 0.0.0
 */
export class ArchitectureSliceRolePlan extends S.Opaque<ArchitectureSliceRolePlan, { readonly brand: unique symbol }>()(
  S.Struct({
    role: ArchitectureSliceRole,
    packageName: S.String,
    path: S.String,
    exports: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("ArchitectureSliceRolePlan", {
      description: "Package-level role metadata emitted by the architecture operation-plan factory.",
    })
  )
) {}

/**
 * **Example** (Create architecture plan target)
 *
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
 *
 * @category models
 * @since 0.0.0
 */
export class ArchitecturePlanTarget extends S.Opaque<ArchitecturePlanTarget, { readonly brand: unique symbol }>()(
  S.Struct({
    boundedContext: S.String,
    concept: S.String,
    domainKind: ArchitectureDomainKind,
    conceptPath: S.String,
    stage: ArchitecturePlanStage,
  }).pipe(
    $I.annoteSchema("ArchitecturePlanTarget", {
      description: "Normalized slice, concept, domain-kind, and stage selected by architecture commands.",
    })
  )
) {}

/**
 * Operation that writes a repo-relative file when absent.
 *
 * **Example** (Create write-file operation)
 *
 * ```ts
 * import { WriteFileOperation } from "@beep/repo-cli/commands/Architecture"
 *
 * const operation = WriteFileOperation.make({
 *   content: "export {};",
 *   description: "Write the package index.",
 *   kind: "write-file",
 *   path: "packages/research-lab/domain/src/index.ts",
 *   role: "domain",
 *   writer: "template"
 * })
 * console.log(operation.writeMode) // "write-if-missing"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WriteFileOperation extends S.Opaque<WriteFileOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("write-file"),
    operationId: OperationId,
    role: ArchitectureSliceRole,
    path: S.String,
    writeMode: WriteIfMissing,
    conflictPolicy: SkipIdenticalFailDifferent,
    operationSource: OperationSource,
    writer: ArchitectureWriterKind,
    content: S.String,
    description: S.String,
  }).pipe(
    $I.annoteSchema("WriteFileOperation", {
      description: "Operation that materializes a canonical architecture file with failsafe conflict behavior.",
    })
  )
) {}

/**
 * **Example** (Create package-json operation)
 *
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
 *
 * @category models
 * @since 0.0.0
 */
export class WritePackageJsonOperation extends S.Opaque<WritePackageJsonOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("write-package-json"),
    operationId: OperationId,
    role: S.Union([ArchitecturePackageRole, ArchitectureContextRole]),
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
  }).pipe(
    $I.annoteSchema("WritePackageJsonOperation", {
      description: "Structured package.json operation selected by the architecture operation-plan factory.",
    })
  )
) {}

/**
 * Operation that proves a repo-relative file must exist.
 *
 * **Example** (Create ensure-file operation)
 *
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
 *
 * @category models
 * @since 0.0.0
 */
export class EnsureFileOperation extends S.Opaque<EnsureFileOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("ensure-file"),
    operationId: OperationId,
    role: ArchitectureSliceRole,
    path: S.String,
    writeMode: EnsurePresent,
    conflictPolicy: RequirePresent,
    operationSource: OperationSource,
    description: S.String,
  }).pipe(
    $I.annoteSchema("EnsureFileOperation", {
      description: "Operation asserting that a canonical slice file is materialized.",
    })
  )
) {}

/**
 * Operation that proves a legacy repo-relative path must not exist.
 *
 * **Example** (Create ensure-absent operation)
 *
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
 *
 * @category models
 * @since 0.0.0
 */
export class EnsureAbsentPathOperation extends S.Opaque<EnsureAbsentPathOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("ensure-absent-path"),
    operationId: OperationId,
    path: S.String,
    writeMode: RemoveIfPresent,
    conflictPolicy: RemoveExisting,
    operationSource: OperationSource,
    description: S.String,
  }).pipe(
    $I.annoteSchema("EnsureAbsentPathOperation", {
      description: "Operation asserting that a legacy architecture fixture path is absent.",
    })
  )
) {}

/**
 * **Example** (Validate ensure-file as operation)
 *
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
 *
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
 * **Example** (Type-level architecture operation)
 *
 * ```ts
 * import type { ArchitectureOperation } from "@beep/repo-cli/commands/Architecture"
 *
 * const operation: ArchitectureOperation | undefined = undefined
 * console.log(operation === undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ArchitectureOperation = typeof ArchitectureOperation.Type;

/**
 * Idempotency status for one checked operation.
 *
 * **Example** (Create operation check status)
 *
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
 *
 * @category models
 * @since 0.0.0
 */
export class ArchitectureOperationCheck extends S.Opaque<
  ArchitectureOperationCheck,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    operationId: S.String,
    kind: ArchitectureOperationKind,
    path: S.String,
    status: ArchitectureOperationCheckStatus,
  }).pipe(
    $I.annoteSchema("ArchitectureOperationCheck", {
      description: "Per-operation idempotency result returned by architecture operation-plan checks.",
    })
  )
) {}

/**
 * **Example** (Create empty operation plan)
 *
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
 *
 * @category models
 * @since 0.0.0
 */
export class CanonicalSliceOperationPlan extends S.Class<
  CanonicalSliceOperationPlan,
  { readonly brand: unique symbol }
>($I`CanonicalSliceOperationPlan`)(
  {
    schemaVersion: S.tag("architecture-operation-plan/v1"),
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
   * **Example** (Read legacy slice metadata)
   *
   * ```ts
   * import { makeCanonicalSliceOperationPlan } from "@beep/repo-cli/commands/Architecture"
   *
   * const plan = makeCanonicalSliceOperationPlan()
   * console.log(plan.slice.boundedContext) // "architecture-lab"
   * ```
   *
   * @returns Legacy aggregate-oriented slice metadata derived from the plan target.
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

const operationPlanCheckResultOperationStatusesDefault = A.empty<ArchitectureOperationCheck>();
const operationPlanCheckResultDifferingPathsDefault = A.empty<string>();
/**
 * Result of validating a canonical operation plan against a checkout.
 *
 * **Example** (Create plan check result)
 *
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
 *
 * @category models
 * @since 0.0.0
 */
export class OperationPlanCheckResult extends S.Opaque<OperationPlanCheckResult, { readonly brand: unique symbol }>()(
  S.Struct({
    idempotent: S.Boolean,
    operationStatuses: S.Array(ArchitectureOperationCheck).pipe(
      S.withConstructorDefault(Effect.succeed(operationPlanCheckResultOperationStatusesDefault)),
      S.withDecodingDefaultType(Effect.succeed(operationPlanCheckResultOperationStatusesDefault))
    ),
    missingPaths: S.Array(S.String),
    differingPaths: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(operationPlanCheckResultDifferingPathsDefault)),
      S.withDecodingDefaultType(Effect.succeed(operationPlanCheckResultDifferingPathsDefault))
    ),
    unexpectedPaths: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("OperationPlanCheckResult", {
      description: "Filesystem validation result for a decoded architecture operation plan.",
    })
  )
) {}

/**
 * **Example** (Create plan apply result)
 *
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
 *
 * @category models
 * @since 0.0.0
 */
export class OperationPlanApplyResult extends S.Opaque<OperationPlanApplyResult, { readonly brand: unique symbol }>()(
  S.Struct({
    writtenPaths: S.Array(S.String),
    skippedPaths: S.Array(S.String),
    removedPaths: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("OperationPlanApplyResult", {
      description: "Filesystem write summary for a decoded architecture operation plan.",
    })
  )
) {}

/**
 * Default architecture target shared by command defaults and plan factories.
 *
 * **Example** (Read default plan target)
 *
 * ```ts
 * import { defaultArchitecturePlanTarget } from "@beep/repo-cli/commands/Architecture/index"
 *
 * console.log(defaultArchitecturePlanTarget.boundedContext)
 * ```
 *
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
 * **Example** (Encode plan as JSON)
 *
 * ```ts
 * import {
 *   encodeCanonicalSliceOperationPlanJson,
 *   makeCanonicalSliceOperationPlan,
 * } from "@beep/repo-cli/commands/Architecture"
 * import * as Effect from "effect/Effect";
 * const program = encodeCanonicalSliceOperationPlanJson(makeCanonicalSliceOperationPlan()).pipe(
 *   Effect.map((json) => json.includes("architecture-operation-plan/v1"))
 * )
 *
 * Effect.runPromise(program).then(console.log)
 * ```
 *
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
 * **Example** (Round-trip plan JSON decode)
 *
 * ```ts
 * import {
 *   decodeCanonicalSliceOperationPlanJson,
 *   encodeCanonicalSliceOperationPlanJson,
 *   makeCanonicalSliceOperationPlan,
 * } from "@beep/repo-cli/commands/Architecture"
 * import * as Effect from "effect/Effect";
 * const program = Effect.gen(function* () {
 *   const json = yield* encodeCanonicalSliceOperationPlanJson(makeCanonicalSliceOperationPlan())
 *   const plan = yield* decodeCanonicalSliceOperationPlanJson(json)
 *   return plan.schemaVersion
 * })
 *
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeCanonicalSliceOperationPlanJson: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<CanonicalSliceOperationPlan, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<CanonicalSliceOperationPlan, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, decodeOperationPlanJson);
