/**
 * Worker entity model.
 *
 * @packageDocumentation
 * @category entities
 * @since 0.0.0
 */

import { $ArchitectureLabDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as Shared from "@beep/shared-domain/identity/Shared";
import * as S from "effect/Schema";
import * as ArchitectureLab from "../../identity/ArchitectureLab.ts";

const $I = $ArchitectureLabDomainId.create("entities/Worker/Worker.model");

/**
 * Entity identifier for a persisted architecture lab Worker.
 *
 * **Example** (Decode WorkerId schema)
 *
 * ```ts
 * import { WorkerId, type WorkerId as WorkerIdValue } from "@beep/architecture-lab-domain/entities/Worker"
 * import * as S from "effect/Schema"
 *
 * const id: WorkerIdValue = S.decodeUnknownSync(WorkerId)(1)
 *
 * if (id !== 1) {
 *   throw new Error("expected decoded Worker id")
 * }
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const WorkerId = ArchitectureLab.WorkerId;

/**
 * Runtime type for {@link WorkerId}.
 *
 * **Example** (Type WorkerId values)
 *
 * ```ts
 * import { WorkerId, type WorkerId as WorkerIdValue } from "@beep/architecture-lab-domain/entities/Worker"
 * import * as S from "effect/Schema"
 *
 * const id: WorkerIdValue = S.decodeUnknownSync(WorkerId)(1)
 * const ids: ReadonlyArray<WorkerIdValue> = [id]
 *
 * if (ids.length !== 1) {
 *   throw new Error("expected Worker id evidence")
 * }
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type WorkerId = typeof WorkerId.Type;

/**
 * Organization identity used by the Worker proof entity.
 *
 * **Example** (Decode organization id)
 *
 * ```ts
 * import { WorkerOrganizationId, type WorkerOrganizationId as WorkerOrganizationIdValue } from "@beep/architecture-lab-domain/entities/Worker"
 * import * as S from "effect/Schema"
 *
 * const organizationId: WorkerOrganizationIdValue = S.decodeUnknownSync(WorkerOrganizationId)(1)
 *
 * if (organizationId !== 1) {
 *   throw new Error("expected decoded organization id")
 * }
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const WorkerOrganizationId = Shared.OrganizationId;

/**
 * Runtime type for {@link WorkerOrganizationId}.
 *
 * **Example** (Type organization id)
 *
 * ```ts
 * import {
 *   WorkerOrganizationId,
 *   type WorkerOrganizationId as WorkerOrganizationIdValue
 * } from "@beep/architecture-lab-domain/entities/Worker"
 * import * as S from "effect/Schema"
 *
 * const organizationId: WorkerOrganizationIdValue = S.decodeUnknownSync(WorkerOrganizationId)(1)
 *
 * if (organizationId !== 1) {
 *   throw new Error("expected organization id evidence")
 * }
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type WorkerOrganizationId = typeof WorkerOrganizationId.Type;

/**
 * Closed lifecycle vocabulary for the Worker proof entity.
 *
 * **Example** (Use active WorkerStatus)
 *
 * ```ts
 * import { WorkerStatus, type WorkerStatus as WorkerStatusValue } from "@beep/architecture-lab-domain/entities/Worker"
 *
 * const status: WorkerStatusValue = WorkerStatus.Enum.active
 * const isActive = status === "active"
 *
 * console.log(isActive)
 *
 * if (status !== "active") {
 *   throw new Error("expected active Worker status")
 * }
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const WorkerStatus = LiteralKit(["active", "inactive"]).pipe(
  $I.annoteSchema("WorkerStatus", {
    title: "Worker status",
    description: "Lifecycle status for a synthetic architecture lab Worker entity.",
  })
);

/**
 * Runtime type for {@link WorkerStatus}.
 *
 * **Example** (Type inactive WorkerStatus)
 *
 * ```ts
 * import type { WorkerStatus } from "@beep/architecture-lab-domain/entities/Worker"
 *
 * const status: WorkerStatus = "inactive"
 * const isInactive = status === "inactive"
 *
 * console.log(isInactive)
 *
 * if (status !== "inactive") {
 *   throw new Error("expected inactive Worker status")
 * }
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type WorkerStatus = typeof WorkerStatus.Type;

/**
 * Persisted Worker entity used by WorkItem assignment flows.
 *
 * **Example** (Create Worker entity)
 *
 * ```ts
 * import {
 *   CreateWorkerInput,
 *   Worker,
 *   WorkerId,
 *   WorkerOrganizationId,
 *   create
 * } from "@beep/architecture-lab-domain/entities/Worker"
 * import * as S from "effect/Schema"
 *
 * const worker: Worker = create(
 *   CreateWorkerInput.make({
 *     id: S.decodeUnknownSync(WorkerId)(1),
 *     organizationId: S.decodeUnknownSync(WorkerOrganizationId)(1),
 *     displayName: "Ada Lovelace"
 *   })
 * )
 *
 * if (worker.entityType !== WorkerId.entityType || worker.status !== "active") {
 *   throw new Error("expected active Worker entity")
 * }
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class Worker extends BaseEntity.Class<Worker>($I`Worker`)(
  WorkerId,
  {
    fields: {
      displayName: S.NonEmptyString.annotateKey({
        description: "Display name shown for the Worker in assignment flows.",
      }),
      status: WorkerStatus.annotateKey({
        description: "Lifecycle status for the Worker.",
      }),
    },
    persisted: {
      displayName: EntitySchema.persist.text({
        columnName: "display_name",
      }),
      status: EntitySchema.persist.literal({
        indexHints: [EntitySchema.IndexHint.lookup],
      }),
    },
  },
  $I.annote("Worker", {
    title: "Worker",
    description: "Canonical architecture lab persisted entity used to prove entity archetype generation.",
  })
) {
  static readonly fromUnknown = S.decodeUnknownSync(Worker);
}

/**
 * Constructor input for an active Worker in an organization.
 *
 * **Example** (Make CreateWorkerInput)
 *
 * ```ts
 * import { CreateWorkerInput, WorkerId, WorkerOrganizationId } from "@beep/architecture-lab-domain/entities/Worker"
 * import * as S from "effect/Schema"
 *
 * const input = CreateWorkerInput.make({
 *   id: S.decodeUnknownSync(WorkerId)(1),
 *   organizationId: S.decodeUnknownSync(WorkerOrganizationId)(1),
 *   displayName: "Ada Lovelace"
 * })
 *
 * if (input.displayName !== "Ada Lovelace") {
 *   throw new Error("expected Worker input")
 * }
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class CreateWorkerInput extends S.Class<CreateWorkerInput>($I`CreateWorkerInput`)(
  {
    id: WorkerId.annotateKey({
      description: "Worker entity identifier.",
    }),
    organizationId: WorkerOrganizationId.annotateKey({
      description: "Organization that owns the Worker.",
    }),
    displayName: S.NonEmptyString.annotateKey({
      description: "Display name for the Worker.",
    }),
  },
  $I.annote("CreateWorkerInput", {
    title: "Create Worker input",
    description: "Input required to create an active architecture lab Worker entity.",
  })
) {}

const systemPrincipal = {
  component: "Runtime",
  kind: "System",
} as const;

const publicIdFor = (id: WorkerId): string => `${WorkerId.tableName}_a${id}`;

/**
 * Create a new active Worker entity.
 *
 * **Example** (Create active Worker)
 *
 * ```ts
 * import { CreateWorkerInput, WorkerId, WorkerOrganizationId, create } from "@beep/architecture-lab-domain/entities/Worker"
 * import * as S from "effect/Schema"
 *
 * const worker = create(
 *   CreateWorkerInput.make({
 *     id: S.decodeUnknownSync(WorkerId)(1),
 *     organizationId: S.decodeUnknownSync(WorkerOrganizationId)(1),
 *     displayName: "Ada Lovelace"
 *   })
 * )
 *
 * if (worker.status !== "active" || worker.displayName !== "Ada Lovelace") {
 *   throw new Error("expected active Worker")
 * }
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export const create = (input: CreateWorkerInput): Worker =>
  Worker.fromUnknown({
    createdAt: 0,
    createdByPrincipal: systemPrincipal,
    displayName: input.displayName,
    entityType: WorkerId.entityType,
    id: input.id,
    orgId: input.organizationId,
    publicId: publicIdFor(input.id),
    rowVersion: 1,
    schemaVersion: "0.1.0",
    source: "Application",
    status: "active",
    updatedAt: 0,
    updatedByPrincipal: systemPrincipal,
  });
